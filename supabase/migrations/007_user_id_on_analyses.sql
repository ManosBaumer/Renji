-- Tags every analysis with the authenticated user who ran it.
-- Existing rows (run before auth was wired up) stay NULL.

ALTER TABLE analyses
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS analyses_user_id_idx ON analyses (user_id);
