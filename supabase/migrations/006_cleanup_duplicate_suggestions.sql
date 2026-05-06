-- Cleans the `keyword_suggestions` table of false-positives that the original
-- (buggy) flag logic created:
--
--   1. Suggestions whose `suggested_keyword` equals the name of `closest_match`
--      — i.e. the LLM picked a term that's already in the taxonomy.
--   2. Suggestions longer than 5 words — these are sentences, not keyword
--      candidates worth adding to the taxonomy.
--   3. Suggestions whose value exists as an exact keyword of the same type.
--   4. Suggestions whose value exists as an alias.
--
-- Only deletes rows in 'pending' state — approved/rejected history is preserved.

-- 1. Same-name as closest_match
DELETE FROM keyword_suggestions ks
USING keywords k
WHERE ks.status = 'pending'
  AND ks.closest_match = k.id
  AND lower(trim(ks.suggested_keyword)) = lower(trim(k.name));

-- 2. Sentence-length entries (more than 5 whitespace-separated tokens)
DELETE FROM keyword_suggestions
WHERE status = 'pending'
  AND array_length(regexp_split_to_array(trim(suggested_keyword), '\s+'), 1) > 5;

-- 3. Suggestion value already exists as a keyword of the same type
DELETE FROM keyword_suggestions ks
WHERE ks.status = 'pending'
  AND EXISTS (
    SELECT 1 FROM keywords k
    WHERE k.type = ks.type
      AND lower(trim(k.name)) = lower(trim(ks.suggested_keyword))
  );

-- 4. Suggestion value already exists as an alias
DELETE FROM keyword_suggestions ks
WHERE ks.status = 'pending'
  AND EXISTS (
    SELECT 1 FROM aliases a
    WHERE lower(trim(a.alias)) = lower(trim(ks.suggested_keyword))
  );
