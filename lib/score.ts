// Pure scoring functions. No I/O — easy to unit test.

import type { Post } from './sources';
import type { MarketAssessment } from './market';

// ─── Demand ───────────────────────────────────────────────────────────────────

/**
 * Demand = blend of post frequency and per-post engagement.
 *
 * Both inputs are log-scaled because Reddit post counts and upvote counts are
 * heavy-tailed: a linear scale would peg most keywords at 0 and a few at 100.
 *
 * Frequency anchor: 100 posts/year saturates at 100 (Reddit caps search at 100/call).
 * Engagement anchor: ~1000 avg engagement saturates at 100.
 */
export function computeDemand(posts: Post[]): number {
  if (posts.length === 0) return 0;

  const postCount = posts.length;
  const totalEngagement = posts.reduce((s, p) => s + p.ups + p.num_comments * 2, 0);
  const avgEngagement = totalEngagement / postCount;

  const freqScore = Math.min(100, Math.log10(postCount + 1) * 50);          // 1→15, 10→50, 100→100
  const engScore  = Math.min(100, Math.log10(avgEngagement + 1) * 33.3);    // 1→10, 10→33, 100→67, 1000→100

  return Math.round(freqScore * 0.7 + engScore * 0.3);
}

// ─── Competition ──────────────────────────────────────────────────────────────

/**
 * Competition v1 — pure tool count, log-scaled.
 * Kept for backwards compat / unit tests.
 */
export function computeCompetition(toolCount: number): number {
  if (toolCount <= 0) return 0;
  return Math.min(100, Math.round(Math.log10(toolCount + 1) * 50));
}

/**
 * Competition v2 — combines counted tools with the LLM's market saturation
 * assessment. Takes the MAX of both signals — if the LLM knows the market
 * is saturated (e.g. weather apps), trust that even when forum extraction
 * happens to find few names.
 */
export function computeCompetitionV2(
  toolCount: number,
  market: MarketAssessment,
): number {
  const fromCount = computeCompetition(toolCount);
  // Saturation alone isn't competition — also blend commoditization
  const fromMarket = market.saturation * 0.7 + market.commoditization * 0.3;
  return Math.round(Math.max(fromCount, fromMarket));
}

// ─── Opportunity ──────────────────────────────────────────────────────────────

/**
 * Opportunity v1 — naive linear gap between demand and competition.
 * Treats all "demand" as if it were paying-customer demand. Kept for tests.
 */
export function computeOpportunity(demand: number, competition: number): number {
  return Math.round(Math.max(0, Math.min(100, (100 + demand - competition) / 2)));
}

/**
 * Opportunity v2 — geometric mean of supply-quality and demand-quality.
 *
 * Why geometric? It punishes any weak factor much harder than an arithmetic
 * mean. A market with great demand but terrible supply (saturated commodity)
 * should NOT score 65 — it should score ~15.
 *
 *   Weather app (saturation 95, urgency 20):
 *     supply_quality   = 100 - (95*0.6 + 95*0.4) =  5
 *     demand_quality   = 100*0.4 + 20*0.4 + 10*0.2 = 50
 *     opportunity      = sqrt(5 * 50) = 16
 *
 *   Startup analyzer (saturation 40, urgency 70):
 *     supply_quality   = 100 - (40*0.6 + 30*0.4) = 64
 *     demand_quality   = 100*0.4 + 70*0.4 + 40*0.2 = 76
 *     opportunity      = sqrt(64 * 76) = 70
 *
 * Both inputs were artificially close to 100 in v1 — this collapses them to
 * realistic, well-separated scores.
 */
export function computeOpportunityV2(
  demand: number,           // 0-100 from forum activity
  market: MarketAssessment, // 0-100 each, from LLM
): number {
  // Supply quality: low saturation + low commoditization is good.
  const supplyQuality = Math.max(
    0,
    100 - (market.saturation * 0.6 + market.commoditization * 0.4),
  );

  // Demand quality: blend raw activity with willingness-to-pay & reachability.
  const reachability = 100 - market.distribution_difficulty;
  const demandQuality = Math.max(
    0,
    Math.min(100, demand * 0.4 + market.buyer_urgency * 0.4 + reachability * 0.2),
  );

  // Geometric mean — both factors must be decent for high opportunity.
  const score = Math.sqrt(supplyQuality * demandQuality);
  return Math.round(Math.max(0, Math.min(100, score)));
}

// ─── Trend ────────────────────────────────────────────────────────────────────

export type TrendLabel =
  | 'strong_growth' | 'growing' | 'steady' | 'declining' | 'falling'
  | 'insufficient_data';

export interface Trend {
  pct_change: number;
  label: TrendLabel;
}

/**
 * Compares the last 4 weeks of posting rate against the prior 8 weeks.
 * Returns insufficient_data if either bucket is too sparse.
 */
export function computeTrend(posts: Post[]): Trend {
  if (posts.length < 6) return { pct_change: 0, label: 'insufficient_data' };

  const now = Date.now() / 1000;
  const RECENT_WEEKS = 4;
  const OLDER_WEEKS = 8;
  const RECENT_CUTOFF = now - RECENT_WEEKS * 7 * 86400;
  const OLDER_CUTOFF  = now - (RECENT_WEEKS + OLDER_WEEKS) * 7 * 86400;

  const recentCount = posts.filter((p) => p.created_utc >= RECENT_CUTOFF).length;
  const olderCount  = posts.filter(
    (p) => p.created_utc >= OLDER_CUTOFF && p.created_utc < RECENT_CUTOFF
  ).length;

  const recentRate = recentCount / RECENT_WEEKS;
  const olderRate  = olderCount  / OLDER_WEEKS;

  if (olderRate < 0.25) return { pct_change: 0, label: 'insufficient_data' };

  const pct = ((recentRate - olderRate) / olderRate) * 100;
  let label: TrendLabel;
  if (pct >  30) label = 'strong_growth';
  else if (pct >  10) label = 'growing';
  else if (pct > -10) label = 'steady';
  else if (pct > -30) label = 'declining';
  else                label = 'falling';

  return { pct_change: Math.round(pct), label };
}
