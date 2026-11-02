import type { Config } from "@netlify/functions";
import { hasValidSession } from "../lib/session.mts";

// Forwards the "Upload Record" payload to Zapier. The webhook address lives
// only in Netlify's environment variables (ZAPIER_WEBHOOK_URL), so it is not
// exposed in the website's code and only signed-in users can send records.

const MAX_BODY_BYTES = 2_000_000;

export default async (req: Request) => {
  if (!hasValidSession(req)) {
    return Response.json({ error: "Please log in again." }, { status: 401 });
  }
  const webhook = Netlify.env.get("ZAPIER_WEBHOOK_URL");
  if (!webhook) {
    return Response.json({ error: "Upload is not configured." }, { status: 500 });
  }

  const body = await req.text();
  if (!body || body.length > MAX_BODY_BYTES) {
    return Response.json({ error: "Invalid upload." }, { status: 400 });
  }
  try {
    JSON.parse(body);
  } catch {
    return Response.json({ error: "Invalid upload." }, { status: 400 });
  }

  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (!res.ok) {
      console.error(`Zapier responded ${res.status}`);
      return Response.json({ error: "Zapier didn't accept the record." }, { status: 502 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Zapier request failed:", error);
    return Response.json({ error: "Couldn't reach Zapier." }, { status: 502 });
  }
};

export const config: Config = {
  path: "/api/zapier",
  method: "POST",
  rateLimit: { windowLimit: 20, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
