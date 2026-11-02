import Anthropic from "@anthropic-ai/sdk";
import type { Config } from "@netlify/functions";
import { hasValidSession } from "../lib/session.mts";

// The Anthropic API key lives only in Netlify's environment variables
// (ANTHROPIC_API_KEY, scope: Functions). It never reaches the browser.
const client = new Anthropic({ apiKey: Netlify.env.get("ANTHROPIC_API_KEY") });

// "chat": Cody answers questions about the client's numbers.
// "builder": Mike builds a custom HTML strategy section for a tab.
const SYSTEM_PROMPTS = {
  chat: `You are "Cody", the expert Financial Strategist for Crown Money.
Your goal is to explain the financial logic and results to the sales team.

STRICT RESPONSE RULES:
1. NO MARKDOWN: Never use asterisks (*) or double asterisks (**).
2. HTML ONLY: Use <div>, <p>, <strong>, <br>, <ul>, <li>, and <table>.
3. TONE: Professional but simple. No complex jargon unless explained.
4. ACCURACY: Refer to the context data for all numbers.`,
  builder: `You are Mike, the Strategy Expert at Crown Money.
Build a professional strategy section (Table, Insights, or Comparison) for the sales team using pure HTML.
STYLE: Use Tailwind CSS utility classes. Professional and clean.
STRICT: Output raw HTML only. No markdown, no asterisks, no backticks, no code fences.
ACCURACY: Use the context data for all numbers.`,
} as const;

type Mode = keyof typeof SYSTEM_PROMPTS;

const MAX_CONTEXT_CHARS = 100_000;
const MAX_QUESTION_CHARS = 4_000;

export default async (req: Request) => {
  if (!hasValidSession(req)) {
    return Response.json({ error: "Please log in again." }, { status: 401 });
  }
  if (!Netlify.env.get("ANTHROPIC_API_KEY")) {
    return Response.json({ error: "Assistant is not configured." }, { status: 500 });
  }

  let body: { mode?: unknown; context?: unknown; question?: unknown; target?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  const mode: Mode = body.mode === "builder" ? "builder" : "chat";
  const { context, question } = body;
  const target = typeof body.target === "string" ? body.target.slice(0, 100) : "";
  if (
    typeof context !== "string" || typeof question !== "string" ||
    !question.trim() || context.length > MAX_CONTEXT_CHARS || question.length > MAX_QUESTION_CHARS
  ) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const userContent = mode === "builder"
    ? `CONTEXT DATA:\n${context}\n\nTarget view: ${target}\n\nBuild this specific view for the sales team: ${question}`
    : `CONTEXT DATA:\n${context}\n\nUser Question: "${question}"`;

  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM_PROMPTS[mode],
      messages: [{ role: "user", content: userContent }],
    });

    if (response.stop_reason === "refusal") {
      return Response.json({ text: "<p>Sorry, I can't help with that request.</p>" });
    }

    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .replace(/^```(?:html)?\s*|\s*```$/g, "");

    return Response.json({ text: text || "<p>I couldn't generate a response.</p>" });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      console.error("Anthropic rate limit:", error.message);
      return Response.json({ error: "Busy right now, please try again shortly." }, { status: 429 });
    }
    if (error instanceof Anthropic.APIError) {
      console.error(`Anthropic API error ${error.status}:`, error.message);
    } else {
      console.error(error);
    }
    return Response.json({ error: "Assistant request failed." }, { status: 502 });
  }
};

export const config: Config = {
  path: "/api/assistant",
  method: "POST",
  rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
