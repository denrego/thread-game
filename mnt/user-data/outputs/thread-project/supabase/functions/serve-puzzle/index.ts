// supabase/functions/serve-puzzle/index.ts
// Fetches today's puzzle from the database and serves it to the game

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get today's date in UTC
    const today = new Date().toISOString().split("T")[0]; // e.g. "2026-03-12"

    // Fetch today's puzzle from the puzzles table
    const { data: puzzle, error } = await supabase
      .from("puzzles")
      .select("id, theme, words, publish_date, difficulty")
      .eq("publish_date", today)
      .single();

    if (error || !puzzle) {
      // No puzzle for today — return a fallback
      return new Response(
        JSON.stringify({
          id: 0,
          theme: "Kitchen Utensils",
          words: ["SPOON", "KNIFE", "WHISK", "LADLE", "TONGS"],
          publish_date: today,
          difficulty: "medium",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(puzzle), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Failed to load puzzle" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
