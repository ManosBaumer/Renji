import { z } from 'zod';
import { embed, complete } from './llm';
import { supabaseAdmin } from './supabase-admin';

export const ClassificationSchema = z.object({
  audience: z.string().min(1),
  problem: z.string().min(1),
  solution: z.string().min(1),
  industry: z.string().min(1),
  keywords: z.array(z.string().min(1)).min(1).max(8),
  confidence: z.object({
    audience: z.number().min(0).max(1),
    problem: z.number().min(0).max(1),
    solution: z.number().min(0).max(1),
    industry: z.number().min(0).max(1),
    keywords: z.number().min(0).max(1),
  }),
});

export type Classification = z.infer<typeof ClassificationSchema>;

export type KeywordType = 'audience' | 'problem' | 'solution' | 'industry' | 'keyword';

export interface RetrievedKeyword {
  id: string;
  name: string;
  type: KeywordType;
  similarity: number;
}

const KEYWORDS_PER_TYPE = 8;

// ─── Retrieval ────────────────────────────────────────────────────────────────

async function retrieveKeywords(embedding: number[]): Promise<RetrievedKeyword[]> {
  const { data, error } = await supabaseAdmin.rpc('match_keywords', {
    query_embedding: embedding,
    match_per_type: KEYWORDS_PER_TYPE,
  });
  if (error) throw new Error(`Keyword retrieval failed: ${error.message}`);
  return (data ?? []) as RetrievedKeyword[];
}

// ─── Specific-term extraction ─────────────────────────────────────────────────

const SpecificTermsSchema = z.object({ terms: z.array(z.string()) });

/**
 * Extracts verbatim technical/domain terms from the idea — product names,
 * acronyms, technical jargon. These are the terms that MUST be preserved
 * through classification so the downstream search and scoring queries the
 * actual market, not a generalized one.
 *
 * Example:
 *   Idea: "satellite imagery change alerts using Sentinel-1 InSAR for selected AOIs"
 *   → ["Sentinel-1", "InSAR", "AOI"]
 */
async function extractSpecificTerms(idea: string): Promise<string[]> {
  const prompt = `Extract SPECIFIC technical terms, product names, acronyms, or domain jargon from this startup idea. These will be used as exact-match keywords for searching forums and discussions.

IDEA: "${idea}"

INCLUDE (verbatim, preserving casing):
- Product / service names (e.g. "Sentinel-1", "ChatGPT", "Notion", "Stripe")
- Technical acronyms (e.g. "InSAR", "GraphQL", "CRDT", "AOI", "ARR", "MRR")
- Specific technologies / algorithms (e.g. "synthetic aperture radar", "CRDT")
- Domain jargon that wouldn't appear in a generic startup pitch (e.g. "change detection", "AOI monitoring")
- Specific industry verticals when named (e.g. "fintech", "logistics", "agritech")

EXCLUDE:
- Generic words ("dashboard", "platform", "users", "data", "system", "analytics")
- Common business terms ("subscription", "marketplace", "B2B")
- Filler ("software", "tool", "app", "service")

Return EMPTY array if no specific terms exist (idea is purely generic).
Otherwise return them EXACTLY as they appear in the idea (preserve casing/hyphens).

Return ONLY this JSON: {"terms": ["term1", "term2", ...]}`;

  try {
    const raw = await complete(prompt, { json: true });
    const parsed = SpecificTermsSchema.parse(JSON.parse(raw));
    // Dedupe case-insensitively, preserve original casing
    const seen = new Set<string>();
    const out: string[] = [];
    for (const t of parsed.terms) {
      const key = t.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(t.trim());
    }
    return out.slice(0, 6); // cap to keep keywords array reasonable
  } catch (err) {
    console.error('extractSpecificTerms failed:', err);
    return [];
  }
}

// ─── Main prompt ──────────────────────────────────────────────────────────────

function buildPrompt(
  idea: string,
  retrieved: RetrievedKeyword[],
  specificTerms: string[],
): string {
  const byType: Record<KeywordType, string[]> = {
    audience: [],
    problem: [],
    solution: [],
    industry: [],
    keyword: [],
  };
  for (const k of retrieved) {
    if (byType[k.type]) byType[k.type].push(k.name);
  }

  const fmt = (xs: string[]) => (xs.length ? xs.join(', ') : '(none)');

  // Detect weak retrieval — if no candidate cleared 0.5 similarity, the
  // taxonomy doesn't cover this domain and the LLM should generate novel terms.
  const maxSim = Math.max(0, ...retrieved.map((r) => r.similarity));
  const taxonomyCoversDomain = maxSim >= 0.5;

  const specificTermsBlock = specificTerms.length > 0
    ? `\nSPECIFIC TERMS DETECTED IN THE IDEA (you MUST preserve these verbatim in the keywords array):\n${specificTerms.map((t) => `  • ${t}`).join('\n')}\n`
    : '';

  const taxonomyWarning = !taxonomyCoversDomain
    ? `\n⚠ TAXONOMY COVERAGE: Our generic startup taxonomy has weak matches for this idea (max similarity ${maxSim.toFixed(2)}). The candidate keywords below are LIKELY WRONG. Prefer generating novel specific terms over picking from the candidates.\n`
    : '';

  return `You classify startup ideas into structured fields. The MOST IMPORTANT RULE is to PRESERVE the specific technical terminology from the user's idea — generic classifications destroy the signal needed for downstream market analysis.

USER'S IDEA:
"${idea}"
${specificTermsBlock}${taxonomyWarning}
CANDIDATE KEYWORDS FROM TAXONOMY (semantically nearest):

Audiences:    ${fmt(byType.audience)}
Problems:     ${fmt(byType.problem)}
Solutions:    ${fmt(byType.solution)}
Industries:   ${fmt(byType.industry)}
General keywords: ${fmt(byType.keyword)}

═══════════════════════════════════════════════════════════════════
CRITICAL RULES
═══════════════════════════════════════════════════════════════════

1. PRESERVE TECHNICAL SPECIFICITY ABOVE ALL.
   Examples of FAILURE → CORRECT:
     ✗ "Sentinel-1 InSAR" → "geospatial analytics"   ← LOSES the actual market
     ✓ "Sentinel-1 InSAR" → "Sentinel-1 InSAR change detection"
     ✗ "AOI monitoring"   → "automated reporting"
     ✓ "AOI monitoring"   → "AOI change alerts"
     ✗ "Postgres CDC"     → "real-time data"
     ✓ "Postgres CDC"     → "Postgres change-data-capture"

   If the idea contains acronyms (InSAR, AOI, CDC, GraphQL), product names
   (Sentinel-1, Stripe, Notion), or domain jargon — they MUST appear in the
   keywords array verbatim.

2. PROBLEM = the SPECIFIC pain, never a category.
     ✗ "lack of customized dashboards"
     ✓ "no easy way to monitor Sentinel-1 InSAR changes for a custom AOI"

3. SOLUTION = the SPECIFIC mechanism, never the category.
     ✗ "geospatial analytics"
     ✓ "automated email/webhook alerts on satellite-detected change in user-selected AOIs"

4. CHOOSE FROM CANDIDATES ONLY when they're as specific as the input.
   When the input contains terms that aren't in the candidates, GENERATE
   matching novel terms. Do NOT fall back to generic candidates.

5. KEYWORDS array (3-6 entries) MUST contain:
   • Every specific term listed above (verbatim) if any were detected
   • Plus 1-3 supporting search-friendly terms

6. CONFIDENCE per field:
   • 0.9+ when the field captures the specific essence of the idea
   • 0.6-0.9 when adequate but slightly generic
   • <0.6 when forced to generalize (rare — if you're <0.6, try harder)

═══════════════════════════════════════════════════════════════════

Return ONLY this JSON object (no markdown, no code fences, no commentary):
{
  "audience": "string",
  "problem": "string",
  "solution": "string",
  "industry": "string",
  "keywords": ["string", "..."],
  "confidence": {
    "audience": 0.0,
    "problem": 0.0,
    "solution": 0.0,
    "industry": 0.0,
    "keywords": 0.0
  }
}`;
}

// ─── Normalization & merging ──────────────────────────────────────────────────

function normalize(c: Classification): Classification {
  return {
    audience: c.audience.trim().toLowerCase(),
    problem: c.problem.trim().toLowerCase(),
    solution: c.solution.trim().toLowerCase(),
    industry: c.industry.trim().toLowerCase(),
    keywords: c.keywords.map((k) => k.trim().toLowerCase()),
    confidence: c.confidence,
  };
}

/**
 * After classification, ensure every detected specific term appears in the
 * keywords array — even if the LLM forgot. The classify prompt instructs it
 * to include them, but we enforce it here as a safety net.
 */
function enforceSpecificTerms(c: Classification, specificTerms: string[]): Classification {
  if (specificTerms.length === 0) return c;

  const existing = new Set(c.keywords);
  const additions: string[] = [];
  for (const term of specificTerms) {
    const norm = term.trim().toLowerCase();
    if (!existing.has(norm)) additions.push(norm);
  }
  if (additions.length === 0) return c;

  // Prepend specific terms (most important come first), cap to 8 total
  const merged = [...additions, ...c.keywords].slice(0, 8);
  return { ...c, keywords: merged };
}

async function classifyOnce(prompt: string): Promise<Classification> {
  const raw = await complete(prompt, { json: true });
  const parsed = JSON.parse(raw);
  const validated = ClassificationSchema.parse(parsed);
  return normalize(validated);
}

// ─── Public entry point ───────────────────────────────────────────────────────

export async function classifyIdea(idea: string): Promise<{
  classification: Classification;
  retrieved: RetrievedKeyword[];
}> {
  const trimmed = idea.trim();
  if (trimmed.length === 0) throw new Error('Idea cannot be empty');

  // Run extraction + embedding + retrieval in parallel — extractSpecificTerms
  // doesn't need the embedding, so we save its latency entirely.
  const [specificTerms, embedding] = await Promise.all([
    extractSpecificTerms(trimmed),
    embed(trimmed),
  ]);
  const retrieved = await retrieveKeywords(embedding);
  const prompt = buildPrompt(trimmed, retrieved, specificTerms);

  let classification: Classification;
  try {
    classification = await classifyOnce(prompt);
  } catch {
    const retryPrompt = `${prompt}\n\nIMPORTANT: Your previous response could not be parsed. Return ONLY valid JSON matching the schema exactly. No markdown, no code fences, no extra fields.`;
    classification = await classifyOnce(retryPrompt);
  }

  // Safety net: re-inject any specific terms the LLM dropped
  classification = enforceSpecificTerms(classification, specificTerms);

  return { classification, retrieved };
}
