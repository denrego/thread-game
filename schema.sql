-- =====================================================
-- THREAD Game — Supabase Database Setup
-- Run this in the Supabase SQL Editor (one time only)
-- =====================================================

-- The puzzles table stores every daily puzzle
CREATE TABLE IF NOT EXISTS puzzles (
  id              SERIAL PRIMARY KEY,           -- Auto-incrementing puzzle number
  publish_date    DATE UNIQUE NOT NULL,         -- The date this puzzle goes live
  theme           TEXT NOT NULL,               -- The connecting theme (e.g. "Kitchen Utensils")
  words           TEXT[] NOT NULL,             -- Array of 5 words e.g. {SPOON,KNIFE,WHISK,LADLE,TONGS}
  difficulty      TEXT DEFAULT 'medium',       -- easy / medium / hard / expert
  auto_generated  BOOLEAN DEFAULT FALSE,       -- Was this made by AI or by you manually?
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Allow anyone to READ puzzles (players need to fetch today's puzzle)
-- But only your server can WRITE puzzles (via service role key)
ALTER TABLE puzzles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read puzzles"
  ON puzzles FOR SELECT
  USING (true);

-- Insert your first puzzle manually as a test
INSERT INTO puzzles (publish_date, theme, words, difficulty)
VALUES (
  CURRENT_DATE,
  'Kitchen Utensils',
  ARRAY['SPOON', 'KNIFE', 'WHISK', 'LADLE', 'TONGS'],
  'easy'
) ON CONFLICT (publish_date) DO NOTHING;

-- =====================================================
-- Optional: scores table for leaderboards (add later)
-- =====================================================
-- CREATE TABLE IF NOT EXISTS scores (
--   id           SERIAL PRIMARY KEY,
--   puzzle_id    INTEGER REFERENCES puzzles(id),
--   player_id    TEXT,                        -- anonymous session ID
--   score        INTEGER,
--   guesses_used INTEGER,
--   theme_correct BOOLEAN,
--   completed_at TIMESTAMPTZ DEFAULT NOW()
-- );
