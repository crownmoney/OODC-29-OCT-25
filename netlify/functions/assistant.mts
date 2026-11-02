import Anthropic from "@anthropic-ai/sdk";
import type { Config } from "@netlify/functions";

// The Anthropic API key lives only in Netlify's environment variables
// (ANTHROPIC_API_KEY, scope: Functions). It never reaches the browser.
const client = new Anthropic({ apiKey: Netlify.env.get("ANTHROPIC_API_KEY") });

const SYSTEM_PROMPT = `You are "Cody", the expert Financial Strategist for Crown Money.
Your goal is to explain the financial logic and results to the sales team.

STRICT RESPONSE RULES:
1. NO MARKDOWN: Never use asterisks (*) or double asterisks (**).
2. HTML ONLY: Use <div>, <p>, <strong>, <br>, <ul>, <li>, and <table>.
3. TONE: Professional but simple. No complex jargon unless explained.
4. ACCURACY: Refer to the context data for all numbers.`;

const MAX_CONTEXT_CHARS = 50_000;
const MAX_QUESTION_CHARS = 4_000;

export default async (req: Request) => {
  if (!Netlify.env.get("ANTHROPIC_API_KEY")) {
    return Response.json({ error: "Assistant is not configured." }, { status: 500 });
  }

  let context: unknown;
  let question: unknown;
  try {
    ({ context, question } = await req.json());
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (
    typeof context !== "string" || typeof question !== "string" ||
    !question.trim() || context.length > MAX_CONTEXT_CHARS || question.length > MAX_QUESTION_CHARS
  ) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `CONTEXT DATA:\n${context}\n\nUser Question: "${question}"`,
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return Response.json({ text: "<p>Sorry, I can't help with that request.</p>" });
    }

    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

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
};
