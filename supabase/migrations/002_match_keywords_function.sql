-- Run this in your Supabase SQL editor after migration 001
--
-- match_keywords(query_embedding, match_per_type)
--   Returns the top-N keywords PER TYPE (audience/problem/solution/industry/keyword)
--   nearest to the input embedding, after resolving any non-canonical keywords
--   (where canonical_id IS NOT NULL) to their canonical row.
--
-- Why per-type? A flat global top-K can be skewed (e.g. all problems, no audiences).
-- Why resolve to canonical? Aliases share embedding space with their canonical;
--   we still want to leverage their recall but present clean labels to the LLM.

CREATE OR REPLACE FUNCTION match_keywords(
  query_embedding VECTOR(768),
  match_per_type  INT DEFAULT 8
)
RETURNS TABLE (
  id          UUID,
  name        TEXT,
  type        TEXT,
  similarity  FLOAT
)
LANGUAGE SQL STABLE
AS $$
  WITH scored AS (
    SELECT
      COALESCE(k.canonical_id, k.id)        AS resolved_id,
      1 - (k.embedding <=> query_embedding) AS sim
    FROM keywords k
    WHERE k.embedding IS NOT NULL
  ),
  resolved AS (
    SELECT
      canonical.id   AS id,
      canonical.name AS name,
      canonical.type AS type,
      MAX(s.sim)     AS similarity
    FROM scored s
    JOIN keywords canonical ON canonical.id = s.resolved_id
    GROUP BY canonical.id, canonical.name, canonical.type
  ),
  ranked AS (
    SELECT
      id, name, type, similarity,
      ROW_NUMBER() OVER (PARTITION BY type ORDER BY similarity DESC) AS rn
    FROM resolved
  )
  SELECT id, name, type, similarity
  FROM ranked
  WHERE rn <= match_per_type
  ORDER BY type, similarity DESC;
$$;
