-- Run this in your Supabase SQL editor (Dashboard → SQL Editor → New query)

-- 1. Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Keywords — core taxonomy table
CREATE TABLE IF NOT EXISTS keywords (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('audience', 'problem', 'solution', 'industry', 'keyword')),
  embedding   VECTOR(768),
  cluster_id  UUID,                                          -- set by cluster_keywords script
  canonical_id UUID REFERENCES keywords(id) ON DELETE SET NULL, -- null = IS canonical
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Unique keyword per type (names are stored lowercase)
CREATE UNIQUE INDEX IF NOT EXISTS keywords_name_type_unique ON keywords(name, type);

-- HNSW index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS keywords_embedding_hnsw
  ON keywords USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS keywords_cluster_idx    ON keywords(cluster_id)    WHERE cluster_id    IS NOT NULL;
CREATE INDEX IF NOT EXISTS keywords_canonical_idx  ON keywords(canonical_id)  WHERE canonical_id  IS NOT NULL;

-- 3. Aliases — additional string variants for canonical keywords
CREATE TABLE IF NOT EXISTS aliases (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword_id UUID NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
  alias      TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS aliases_keyword_alias_unique ON aliases(keyword_id, alias);
CREATE INDEX IF NOT EXISTS aliases_keyword_idx ON aliases(keyword_id);

-- 4. Keyword suggestions — captured when classification confidence is low
CREATE TABLE IF NOT EXISTS keyword_suggestions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggested_keyword TEXT NOT NULL,
  closest_match     UUID REFERENCES keywords(id) ON DELETE SET NULL,
  similarity        FLOAT,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS keyword_suggestions_status_idx ON keyword_suggestions(status);
