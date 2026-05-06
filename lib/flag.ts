import { supabaseAdmin } from './supabase-admin';
import type { Classification, RetrievedKeyword, KeywordType } from './classify';

// ─── Types ────────────────────────────────────────────────────────────────────

export type FlagStatus = 'auto' | 'flagged' | 'suggestion';

export interface FieldFlag {
  status: FlagStatus;
  score: number;          // embeddingSim (primary threshold signal)
  embeddingSim: number;   // best cosine similarity for retrieved keywords of this type
  llmConfidence: number;  // LLM self-rated confidence (display/metadata only)
}

export type ScalarField = 'audience' | 'problem' | 'solution' | 'industry';
export type FieldKey = ScalarField | 'keywords';
export type Flags = Record<FieldKey, FieldFlag>;

// ─── Thresholds ───────────────────────────────────────────────────────────────

const THRESHOLD_AUTO = 0.82;
const THRESHOLD_FLAG = 0.65;

// Maximum words for a value to be considered a keyword candidate.
// Anything longer is a phrase/sentence that shouldn't enter the taxonomy.
const MAX_KEYWORD_WORDS = 5;

function toStatus(embSim: number): FlagStatus {
  if (embSim > THRESHOLD_AUTO) return 'auto';
  if (embSim > THRESHOLD_FLAG) return 'flagged';
  return 'suggestion';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function bestSim(retrieved: RetrievedKeyword[], type: KeywordType): number {
  const matches = retrieved.filter((k) => k.type === type);
  if (matches.length === 0) return 0;
  return Math.max(...matches.map((k) => k.similarity));
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function isShortEnoughForTaxonomy(value: string): boolean {
  return value.trim().split(/\s+/).filter(Boolean).length <= MAX_KEYWORD_WORDS;
}

/**
 * True iff the LLM's chosen value already exists VERBATIM in the retrieved
 * keyword set for this type. This catches the case where the LLM picked
 * a term that's already in our taxonomy — no flag needed.
 */
function hasExactMatch(
  value: string,
  retrieved: RetrievedKeyword[],
  type: KeywordType,
): boolean {
  const norm = value.trim().toLowerCase();
  return retrieved.some(
    (k) => k.type === type && k.name.trim().toLowerCase() === norm,
  );
}

// ─── Core ─────────────────────────────────────────────────────────────────────

/**
 * Computes the flag status for each classification field.
 *
 * The status is 'auto' when EITHER:
 *   - the embedding similarity is high (idea matches taxonomy well), OR
 *   - the LLM's chosen value exactly matches a retrieved keyword name
 *     (the term is already in our taxonomy, regardless of idea similarity).
 *
 * The exact-match override fixes the case where short ideas like "weather
 * app" get a low idea→keyword similarity score even when the LLM correctly
 * picked an existing term ("outdoor" → exists in audience type).
 */
export function computeFlags(
  classification: Classification,
  retrieved: RetrievedKeyword[],
): Flags {
  const scalarFields: Array<{ key: ScalarField; type: KeywordType }> = [
    { key: 'audience', type: 'audience' },
    { key: 'problem',  type: 'problem'  },
    { key: 'solution', type: 'solution' },
    { key: 'industry', type: 'industry' },
  ];

  const flags = {} as Flags;

  for (const { key, type } of scalarFields) {
    const llmConf = classification.confidence[key];
    const value   = classification[key];
    const embSim  = bestSim(retrieved, type);

    // If the chosen value is verbatim in the taxonomy, force 'auto' —
    // we don't need to flag terms we already have.
    const exact = hasExactMatch(value, retrieved, type);

    flags[key] = {
      status:        exact ? 'auto' : toStatus(embSim),
      score:         round2(embSim),
      embeddingSim:  round2(embSim),
      llmConfidence: llmConf,
    };
  }

  // Keywords array: average the four scalar scores as a proxy
  const scalarAvg = round2(
    (flags.audience.score + flags.problem.score + flags.solution.score + flags.industry.score) / 4,
  );
  flags.keywords = {
    status:        toStatus(scalarAvg),
    score:         scalarAvg,
    embeddingSim:  scalarAvg,
    llmConfidence: classification.confidence.keywords,
  };

  return flags;
}

// ─── Persistence ──────────────────────────────────────────────────────────────

/**
 * Writes a `keyword_suggestions` row for every scalar field whose status is
 * 'suggestion', AFTER applying these dedup checks:
 *
 *   1. Skip if the value is longer than MAX_KEYWORD_WORDS — it's a sentence,
 *      not a keyword candidate.
 *   2. Skip if the value already exists in the `keywords` table for this type
 *      (catches taxonomy entries that weren't in the top-K retrieved set).
 *   3. Skip if the value already exists as an alias of an existing keyword.
 *
 * Net effect: the admin "Keyword Flags" tab shows only genuinely novel terms.
 */
export async function persistSuggestions(
  idea: string,
  classification: Classification,
  flags: Flags,
  retrieved: RetrievedKeyword[],
): Promise<void> {
  const scalarFields: ScalarField[] = ['audience', 'problem', 'solution', 'industry'];

  // Initial pass: collect suggestion-status fields that pass the length filter
  const candidates = scalarFields
    .filter((field) => flags[field].status === 'suggestion')
    .map((field) => ({
      field,
      type:  field as KeywordType,
      value: classification[field].trim().toLowerCase(),
      flag:  flags[field],
    }))
    .filter((c) => c.value.length > 0)
    .filter((c) => isShortEnoughForTaxonomy(c.value));

  if (candidates.length === 0) return;

  // Bulk-check the keywords table: which (type, value) pairs already exist?
  // Using a single OR query to minimize round-trips.
  const existsInDb = new Set<string>(); // key: `${type}:${value}`

  const orFilter = candidates
    .map((c) => `and(type.eq.${c.type},name.eq.${escapePgValue(c.value)})`)
    .join(',');

  if (orFilter.length > 0) {
    const { data: existing } = await supabaseAdmin
      .from('keywords')
      .select('name, type')
      .or(orFilter);

    for (const row of existing ?? []) {
      existsInDb.add(`${row.type}:${row.name.trim().toLowerCase()}`);
    }
  }

  // Bulk-check the aliases table by alias text
  const allValues = candidates.map((c) => c.value);
  const { data: aliasRows } = await supabaseAdmin
    .from('aliases')
    .select('alias')
    .in('alias', allValues);
  const aliasSet = new Set(
    (aliasRows ?? []).map((a) => a.alias.trim().toLowerCase()),
  );

  // Final filter
  const toInsert = candidates.filter((c) => {
    if (existsInDb.has(`${c.type}:${c.value}`)) return false;
    if (aliasSet.has(c.value)) return false;
    return true;
  });

  if (toInsert.length === 0) return;

  const rows = toInsert.map((c) => {
    const closestMatch = retrieved.find((k) => k.type === c.type);
    return {
      suggested_keyword: c.value,
      closest_match:     closestMatch?.id ?? null,
      similarity:        c.flag.embeddingSim,
      field:             c.field,
      type:              c.type,
      idea,
      status:            'pending',
    };
  });

  const { error } = await supabaseAdmin
    .from('keyword_suggestions')
    .insert(rows);

  if (error) {
    console.error('persistSuggestions error:', error.message);
  }
}

/**
 * Postgres-safe value escaping for `or()` filter strings.
 * Supabase's PostgREST treats commas, parens, and dots specially in OR filters.
 */
function escapePgValue(v: string): string {
  return `"${v.replace(/"/g, '\\"')}"`;
}
