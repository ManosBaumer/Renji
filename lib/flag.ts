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
//
// We threshold on embeddingSim only — it is objective and reproducible.
// LLM confidence is unreliable here because the model is always confident
// in terms it generates itself, even when the term is genuinely novel.
//
//   embSim > 0.82  → auto   (DB has a strong match; use it)
//   embSim > 0.65  → flagged (uncertain match; show to user for review)
//   embSim ≤ 0.65  → suggestion (no good match in DB; capture for expansion)

const THRESHOLD_AUTO = 0.82;
const THRESHOLD_FLAG = 0.65;

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

// ─── Core ─────────────────────────────────────────────────────────────────────

/**
 * Blends embedding similarity (objective) with LLM confidence (subjective)
 * and assigns a flag status to each field.
 */
export function computeFlags(
  classification: Classification,
  retrieved: RetrievedKeyword[]
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
    const embSim  = bestSim(retrieved, type);
    flags[key] = {
      status:        toStatus(embSim),
      score:         round2(embSim),
      embeddingSim:  round2(embSim),
      llmConfidence: llmConf,
    };
  }

  // Keywords array: no single embedding type to compare against.
  // Average the four scalar field scores as a proxy.
  const scalarAvg = round2(
    (flags.audience.score + flags.problem.score + flags.solution.score + flags.industry.score) / 4
  );
  const kwConf = classification.confidence.keywords;
  flags.keywords = {
    status:        toStatus(scalarAvg),
    score:         scalarAvg,
    embeddingSim:  scalarAvg,
    llmConfidence: kwConf,
  };

  return flags;
}

/**
 * Writes a `keyword_suggestions` row for every scalar field whose
 * blended score fell below the suggestion threshold.
 * Safe to call fire-and-forget in non-critical paths.
 */
export async function persistSuggestions(
  idea: string,
  classification: Classification,
  flags: Flags,
  retrieved: RetrievedKeyword[]
): Promise<void> {
  const scalarFields: ScalarField[] = ['audience', 'problem', 'solution', 'industry'];

  const rows = scalarFields
    .filter((field) => flags[field].status === 'suggestion')
    .map((field) => {
      const type           = field as KeywordType;
      const suggestedValue = classification[field];
      const closestMatch   = retrieved.find((k) => k.type === type);
      return {
        suggested_keyword: suggestedValue,
        closest_match:     closestMatch?.id ?? null,
        similarity:        flags[field].embeddingSim,
        field,
        type,
        idea,
        status: 'pending',
      };
    });

  if (rows.length === 0) return;

  const { error } = await supabaseAdmin
    .from('keyword_suggestions')
    .insert(rows);

  if (error) {
    // Non-fatal — log but don't break the classify response
    console.error('persistSuggestions error:', error.message);
  }
}
