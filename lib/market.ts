// Market intelligence layer.
//
// Uses the LLM's training knowledge of real markets to assess saturation,
// commoditization, buyer urgency, and distribution difficulty. This is the
// crucial signal that distinguishes "lots of discussion" from "real opportunity".
//
// Combines competitor identification + market assessment in ONE LLM call to
// minimize latency.

import { z } from 'zod';
import { complete } from './llm';
import type { Classification } from './classify';
import type { Competitor } from './competitors';

// ─── Types ────────────────────────────────────────────────────────────────────

export type MarketType = 'saturated' | 'commodity' | 'mature' | 'emerging' | 'niche' | 'untapped';

export interface MarketAssessment {
  /** 0-100 — how many established players exist (LLM training knowledge) */
  saturation: number;
  /** 0-100 — commodity (race-to-bottom) vs differentiable */
  commoditization: number;
  /** 0-100 — would target users actually pay? */
  buyer_urgency: number;
  /** 0-100 — how hard to reach customers (incumbents own distribution) */
  distribution_difficulty: number;
  market_type: MarketType;
  /** 1-3 sentence specific explanation citing actual products */
  reasoning: string;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const ResponseSchema = z.object({
  competitors: z
    .array(
      z.object({
        name: z.string().min(1),
        tagline: z.string().optional(),
      }),
    )
    .max(20),
  market: z.object({
    saturation: z.number().min(0).max(100),
    commoditization: z.number().min(0).max(100),
    buyer_urgency: z.number().min(0).max(100),
    distribution_difficulty: z.number().min(0).max(100),
    market_type: z.enum(['saturated', 'commodity', 'mature', 'emerging', 'niche', 'untapped']),
    reasoning: z.string().min(10),
  }),
});

const TOOL_BLACKLIST = new Set([
  'ai', 'llm', 'ml', 'app', 'apps', 'tool', 'tools', 'platform', 'service',
  'software', 'product', 'system', 'framework', 'library',
]);

// ─── Default fallback ─────────────────────────────────────────────────────────

const DEFAULT_ASSESSMENT: MarketAssessment = {
  saturation: 50,
  commoditization: 50,
  buyer_urgency: 50,
  distribution_difficulty: 50,
  market_type: 'mature',
  reasoning: 'Market assessment unavailable — using neutral defaults.',
};

// ─── Combined LLM call ────────────────────────────────────────────────────────

/**
 * Single LLM call that returns BOTH competitor names AND a market assessment.
 * Combining saves latency — the model needs to think about competitors anyway
 * to grade saturation, so we get both for the price of one.
 */
export async function analyzeMarketIntelligence(
  idea: string,
  classification: Classification,
): Promise<{ competitors: Competitor[]; market: MarketAssessment }> {
  const prompt = `You are a startup market analyst with deep knowledge of products, companies, and markets across every industry.

═══════════════════════════════════════════════════════════════════
ORIGINAL IDEA (this is the ground truth — read it carefully):
═══════════════════════════════════════════════════════════════════

"${idea}"

Auto-classification (use as supplementary context only — the original idea above takes precedence if classification looks generic):
- Audience: ${classification.audience}
- Problem: ${classification.problem}
- Solution: ${classification.solution}
- Industry: ${classification.industry}

If the original idea contains specific technical terms, product names, or domain
jargon (e.g. "Sentinel-1", "InSAR", "AOI", "Postgres CDC"), assess THAT specific
market — not the generalized version in the auto-classification.

═══════════════════════════════════════════════════════════════════
PART 1 — REAL COMPETITORS
═══════════════════════════════════════════════════════════════════

Name 8-15 REAL EXISTING products, services, websites, or companies that compete with — or are very similar to — this idea. Use your training knowledge.

INCLUDE:
- Big names (e.g. "Notion", "Linear", "Figma", "Airtable")
- Indie/niche products you specifically know exist
- Both direct competitors and adjacent products solving similar problems

EXCLUDE:
- Generic categories ("a project management tool")
- Concepts ("AI", "blockchain")
- Made-up or hallucinated names — only products you ACTUALLY know
- Abandoned/dead products

Each entry: a real name + a ONE-PHRASE tagline.

═══════════════════════════════════════════════════════════════════
PART 2 — MARKET REALITY ASSESSMENT
═══════════════════════════════════════════════════════════════════

Rate this market on 4 dimensions (0-100). Use your knowledge of how this market actually works in 2025-2026 — not just keyword volume.

A. SATURATION (0-100): How many established players already exist?
   0-20: Almost no existing solutions (greenfield)
   21-40: Niche players, room for new entrants
   41-60: Several established options, but space for differentiation
   61-80: Crowded — multiple big players competing for share
   81-100: Heavily saturated, dominated by incumbents (e.g. weather apps, calculators, generic todo lists)

B. COMMODITIZATION (0-100): Commodity (race to the bottom) vs differentiable?
   0-20: Highly differentiable — many angles to compete on
   21-40: Some differentiation possible
   41-60: Established patterns but room for innovation
   61-80: Mostly commoditized, hard to stand out
   81-100: Pure commodity — price/UX the only levers (e.g. weather data, basic calendars, file storage)

C. BUYER_URGENCY (0-100): Would target users actually PAY for a solution?
   0-20: Users won't pay — expected to be free (most consumer utilities)
   21-40: Some willingness, but free alternatives dominate
   41-60: Pay if value is clearly demonstrated
   61-80: Users actively seek and pay for paid solutions (most B2B)
   81-100: Critical pain — users desperately need this and budget exists

D. DISTRIBUTION_DIFFICULTY (0-100): How hard is it to reach customers?
   0-20: Easy — clear channels, low CAC, organic discovery works
   21-40: Manageable — some marketing required
   41-60: Moderate — sustained content/SEO/community needed
   61-80: Hard — incumbents own distribution, app-store buried, etc.
   81-100: Nearly impossible — bundled with bigger products or platform-locked (e.g. weather apps preinstalled on every phone)

Then choose ONE market_type:
- "untapped"   = nothing meaningful exists yet
- "emerging"   = a few new entrants, growing fast
- "niche"      = small market, defined audience, low competition
- "mature"     = stable market, multiple players, room to differentiate
- "commodity"  = race to the bottom, generic feature parity
- "saturated"  = oversupplied, incumbents dominate, hard to break in

Provide reasoning in 1-3 specific sentences. Cite ACTUAL companies and explain WHY the scores are what they are.

═══════════════════════════════════════════════════════════════════
RESPONSE FORMAT
═══════════════════════════════════════════════════════════════════

Return ONLY this JSON (no markdown, no commentary):
{
  "competitors": [
    {"name": "Notion", "tagline": "all-in-one workspace"},
    {"name": "Linear", "tagline": "issue tracking for fast teams"}
  ],
  "market": {
    "saturation": 0,
    "commoditization": 0,
    "buyer_urgency": 0,
    "distribution_difficulty": 0,
    "market_type": "mature",
    "reasoning": "Specific explanation citing actual products and what the numbers reflect."
  }
}`;

  try {
    const raw = await complete(prompt, { json: true });
    const parsed = ResponseSchema.parse(JSON.parse(raw));

    const competitors: Competitor[] = parsed.competitors
      .filter((p) => {
        const lower = p.name.trim().toLowerCase();
        return lower.length >= 2 && !TOOL_BLACKLIST.has(lower);
      })
      .map((p) => ({
        name: p.name.trim(),
        mentions: 1,
        source: 'llm-knowledge' as const,
        tagline: p.tagline?.trim(),
      }));

    return { competitors, market: parsed.market };
  } catch (err) {
    console.error('analyzeMarketIntelligence failed:', err);
    return { competitors: [], market: DEFAULT_ASSESSMENT };
  }
}
