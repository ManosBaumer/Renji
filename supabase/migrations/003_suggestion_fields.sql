-- Run this in your Supabase SQL editor after migration 002
--
-- Adds context columns to keyword_suggestions so admins can
-- understand what triggered each suggestion and take action.

ALTER TABLE keyword_suggestions
  ADD COLUMN IF NOT EXISTS field TEXT,   -- which field triggered it: audience/problem/solution/industry
  ADD COLUMN IF NOT EXISTS type  TEXT,   -- keyword type (same value, used when approving → new keyword)
  ADD COLUMN IF NOT EXISTS idea  TEXT;   -- the original user idea, for context during review
