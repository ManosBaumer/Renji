-- Adds the LLM market-reality-check dimensions to the analyses table.
-- These distinguish "high topic activity" from "viable market opportunity".

ALTER TABLE analyses
  ADD COLUMN IF NOT EXISTS saturation              INTEGER,
  ADD COLUMN IF NOT EXISTS commoditization         INTEGER,
  ADD COLUMN IF NOT EXISTS buyer_urgency           INTEGER,
  ADD COLUMN IF NOT EXISTS distribution_difficulty INTEGER,
  ADD COLUMN IF NOT EXISTS market_type             TEXT,
  ADD COLUMN IF NOT EXISTS market_reasoning        TEXT;
