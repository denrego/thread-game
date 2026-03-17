// supabase/functions/score-theme/index.ts
// This function receives a player's theme guess and scores it using AI

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle browser preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { words, theme, guess } = await req.json();

    // Call Claude API to score the guess
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") ?? "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001", // Fast + cheap for scoring
        max_tokens: 200,
        system: `You are a fair and generous judge for a word puzzle game called THREAD.
Your job: decide if a player's theme guess is correct.

Be GENEROUS — accept synonyms, related phrases, broader or narrower categories.
Only mark wrong if the guess is clearly off-base.

Respond ONLY in this exact JSON (no markdown, no extra text):
{"correct": true, "score": 85, "reasoning": "One short sentence."}`,
        messages: [{
          role: "user",
          content: `Puzzle words: ${words.join(", ")}
Correct theme: "${theme}"
Player guessed: "${guess}"

Is the player correct? Be generous.`,
        }],
      }),
    });

    const data = await response.json();
    const text = data.content?.[0]?.text ?? "{}";

    let result;
    try {
      result = JSON.parse(text.trim());
    } catch {
      // If parsing fails, do a simple keyword check as fallback
      const lower = guess.toLowerCase();
      const themeWords = theme.toLowerCase().split(" ");
      const matched = themeWords.some((w) => lower.includes(w));
      result = {
        correct: matched,
        score: matched ? 70 : 20,
        reasoning: matched ? "Close enough!" : "Not quite the right connection.",
      };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ correct: false, score: 0, reasoning: "Scoring unavailable — try again!" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
