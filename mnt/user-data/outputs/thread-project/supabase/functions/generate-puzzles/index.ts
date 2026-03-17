// supabase/functions/generate-puzzles/index.ts
// Run this manually once a month to generate 30 days of puzzles automatically
// Call it from the Supabase dashboard or with a cron job

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Difficulty rotation: Mon=easy, Tue-Wed=medium, Thu-Fri=hard, Sat=expert, Sun=medium
function getDifficulty(date: Date): string {
  const day = date.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  if (day === 1) return "easy";
  if (day === 6) return "expert";
  if (day === 4 || day === 5) return "hard";
  return "medium";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // How many days to generate (default 30)
    const body = await req.json().catch(() => ({}));
    const daysToGenerate = body.days ?? 30;

    // Find the last puzzle date already in the database
    const { data: lastPuzzle } = await supabase
      .from("puzzles")
      .select("publish_date")
      .order("publish_date", { ascending: false })
      .limit(1)
      .single();

    // Start generating from the day after the last existing puzzle
    const startDate = lastPuzzle
      ? new Date(lastPuzzle.publish_date)
      : new Date();
    startDate.setDate(startDate.getDate() + 1);

    const results = [];

    for (let i = 0; i < daysToGenerate; i++) {
      const targetDate = new Date(startDate);
      targetDate.setDate(startDate.getDate() + i);
      const dateStr = targetDate.toISOString().split("T")[0];
      const difficulty = getDifficulty(targetDate);

      // Ask Claude to generate a puzzle for this date
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") ?? "",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 300,
          system: `You generate puzzles for a word game called THREAD.
Each puzzle has exactly 5 common English words (all exactly 5 letters) that share a theme.

Difficulty levels:
- easy: very common words, very obvious theme (e.g. fruit, colors)
- medium: familiar words, theme needs a moment of thought
- hard: less common words, theme is more specific or abstract
- expert: challenging words, tricky or surprising theme connection

Rules:
- ALL words must be EXACTLY 5 letters
- ALL words must be real, common English words
- Words should be individually solvable as Wordle puzzles
- The theme should feel satisfying and clear in hindsight
- Do NOT use proper nouns

Respond ONLY in this exact JSON format (no markdown):
{"theme": "Theme Name", "words": ["WORD1", "WORD2", "WORD3", "WORD4", "WORD5"]}`,
          messages: [{
            role: "user",
            content: `Generate a ${difficulty} difficulty THREAD puzzle for ${dateStr}.
Make it fresh — don't use themes like kitchen utensils or fruit that are overused.
Think creatively: music, sports, movies, nature, science, history, etc.`,
          }],
        }),
      });

      const aiData = await response.json();
      const text = aiData.content?.[0]?.text ?? "{}";

      let puzzle;
      try {
        puzzle = JSON.parse(text.trim());
      } catch {
        console.error(`Failed to parse puzzle for ${dateStr}:`, text);
        continue;
      }

      // Validate: must have exactly 5 words, all 5 letters
      if (
        !puzzle.theme ||
        !puzzle.words ||
        puzzle.words.length !== 5 ||
        puzzle.words.some((w: string) => w.length !== 5)
      ) {
        console.error(`Invalid puzzle for ${dateStr}:`, puzzle);
        continue;
      }

      // Save to database
      const { error } = await supabase.from("puzzles").insert({
        publish_date: dateStr,
        theme: puzzle.theme,
        words: puzzle.words.map((w: string) => w.toUpperCase()),
        difficulty: difficulty,
        auto_generated: true,
      });

      if (error) {
        console.error(`DB error for ${dateStr}:`, error);
        continue;
      }

      results.push({ date: dateStr, theme: puzzle.theme, difficulty });

      // Small delay to avoid rate limiting
      await new Promise((r) => setTimeout(r, 500));
    }

    return new Response(
      JSON.stringify({
        success: true,
        generated: results.length,
        puzzles: results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
