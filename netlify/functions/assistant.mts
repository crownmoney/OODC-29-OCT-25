import Anthropic from "@anthropic-ai/sdk";
import type { Config } from "@netlify/functions";
import { hasValidSession } from "../lib/session.mts";

// The Anthropic API key lives only in Netlify's environment variables
// (ANTHROPIC_API_KEY, scope: Functions). It never reaches the browser.
const client = new Anthropic({ apiKey: Netlify.env.get("ANTHROPIC_API_KEY") });

// "chat": Cody answers questions about the client's numbers.
// "builder": Mike builds a custom HTML strategy section for a tab.
// "extract": turns pasted free text into the income/expense JSON the
//            Income & Expenses tab imports.
// Reps use this tool live on Zoom with the client watching a shared screen,
// so every answer must be safe for the client to read.
const CLIENT_SAFE = `
SCREEN-SHARE SAFETY: Your answer may be shown on a shared screen to the client during a meeting. Write so the client can read it comfortably: address the household directly ("you", "your loan") or neutrally, never as "the client" or "the lead". Never include sales tactics, objection-handling tips, comments about the client's character or likelihood to buy, internal notes, or anything you would not want the client to see.`;

const SYSTEM_PROMPTS = {
  chat: `You are "Cody", the expert Financial Strategist for Crown Money.
Your goal is to explain the financial logic and results clearly, for a Crown Money consultant and the household they're meeting with.

STRICT RESPONSE RULES:
1. NO MARKDOWN: Never use asterisks (*) or double asterisks (**).
2. HTML ONLY: Use <div>, <p>, <strong>, <br>, <ul>, <li>, and <table>.
3. TONE: Professional but simple. No complex jargon unless explained.
4. ACCURACY: Refer to the context data for all numbers.` + CLIENT_SAFE,
  builder: `You are Mike, the Strategy Expert at Crown Money.
Build a professional strategy section (Table, Insights, or Comparison) using pure HTML, to be shown to the household during the meeting.
STYLE: Use Tailwind CSS utility classes. Professional and clean.
STRICT: Output raw HTML only. No markdown, no asterisks, no backticks, no code fences.
ACCURACY: Use the context data for all numbers.` + CLIENT_SAFE,
  extract: `You are a financial data extraction tool. Extract all incomes, living expenses, and personal details from the provided text into the EXACT JSON format below. Output pure JSON only: no markdown, no backticks, no commentary.

{
"Form Field Details": {
  "Incomes": { "Income Source 1": "xxxx monthly", "Income Source 2": "yyyy weekly" },
  "FFF": { "Food": "xxx weekly", "Fun": "xxx weekly", "Fuel": "xxx weekly" },
  "Hard Expenses": { "Item 1": "xxx monthly", "Item 2": "yyy annually" },
  "Soft Expenses": { "Item 1": "xxx monthly" },
  "Person 1": "First Last",
  "Person 2": "First Last",
  "Email": "email@example.com"
}
}

Use frequencies matching exactly one of: weekly, fortnightly, monthly, quarterly, annually. Map standard household expenses into either 'FFF', 'Hard Expenses', or 'Soft Expenses'.`,
} as const;

type Mode = keyof typeof SYSTEM_PROMPTS;

const MAX_CONTEXT_CHARS = 100_000;
const MAX_QUESTION_CHARS = 30_000;

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
  const mode: Mode = body.mode === "builder" || body.mode === "extract" ? body.mode : "chat";
  const { context, question } = body;
  const target = typeof body.target === "string" ? body.target.slice(0, 100) : "";
  if (
    typeof context !== "string" || typeof question !== "string" ||
    !question.trim() || context.length > MAX_CONTEXT_CHARS || question.length > MAX_QUESTION_CHARS
  ) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const userContent =
    mode === "builder" ? `CONTEXT DATA:\n${context}\n\nTarget view: ${target}\n\nBuild this specific view: ${question}`
    : mode === "extract" ? `Text to parse:\n${question}`
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
      .replace(/^```(?:html|json)?\s*|\s*```$/g, "");

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
