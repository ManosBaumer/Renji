-- Stores a lightweight record of each analysis run for the admin dashboard.
-- Full result JSON is NOT stored — just the key signals and the idea text.

CREATE TABLE IF NOT EXISTS analyses (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  idea            text        NOT NULL,
  audience        text,
  problem         text,
  solution        text,
  industry        text,
  keywords        text[]      DEFAULT '{}',
  demand          integer,
  competition     integer,
  opportunity     integer,
  trend_label     text,
  trend_pct       integer,
  total_posts     integer,
  num_competitors integer,
  insight_verdict text,
  source          text        DEFAULT 'hn',
  created_at      timestamptz DEFAULT now()
);

-- Admin reads newest-first
CREATE INDEX IF NOT EXISTS analyses_created_at_idx ON analyses (created_at DESC);
