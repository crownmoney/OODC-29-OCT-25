import type { Config } from "@netlify/functions";
import { checkPassword, clearSessionCookie, createSessionCookie, hasValidSession } from "../lib/session.mts";

// POST /api/login    { password }  -> sets the session cookie
// GET  /api/session                 -> 200 if signed in, 401 if not
// POST /api/logout                  -> clears the session cookie
export default async (req: Request) => {
  const path = new URL(req.url).pathname;

  if (path === "/api/session") {
    return Response.json({ authenticated: hasValidSession(req) }, { status: hasValidSession(req) ? 200 : 401 });
  }

  if (path === "/api/logout") {
    return Response.json({ ok: true }, { headers: { "Set-Cookie": clearSessionCookie() } });
  }

  let password: unknown;
  try {
    ({ password } = await req.json());
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  if (typeof password !== "string" || password.length > 200 || !checkPassword(password)) {
    return Response.json({ error: "Incorrect password. Please try again." }, { status: 401 });
  }
  return Response.json({ ok: true }, { headers: { "Set-Cookie": createSessionCookie() } });
};

export const config: Config = {
  path: ["/api/login", "/api/session", "/api/logout"],
  rateLimit: { windowLimit: 20, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
