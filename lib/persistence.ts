// Non-blocking persistence helpers. All functions are safe to call
// fire-and-forget — they catch and log their own errors.

import { supabaseAdmin } from './supabase-admin';
import type { AnalysisResult } from './analyze';

/**
 * Persists a lightweight snapshot of an analysis to the `analyses` table.
 * Safe to call without await.
 */
export async function persistAnalysis(
  idea: string,
  result: AnalysisResult,
  userId: string | null = null,
): Promise<void> {
  const { classification, metrics, competitors, insight, market } = result;

  const { error } = await supabaseAdmin.from('analyses').insert({
    idea,
    user_id: userId,
    audience: classification.audience,
    problem: classification.problem,
    solution: classification.solution,
    industry: classification.industry,
    keywords: classification.keywords,
    demand: metrics.demand,
    competition: metrics.competition,
    opportunity: metrics.opportunity,
    trend_label: metrics.trend.label,
    trend_pct: metrics.trend.pct_change,
    total_posts: metrics.total_posts,
    num_competitors: competitors.length,
    insight_verdict: insight?.verdict ?? null,
    source: metrics.sources.join(','),
    // Market assessment dimensions (added in migration 005)
    saturation: market.saturation,
    commoditization: market.commoditization,
    buyer_urgency: market.buyer_urgency,
    distribution_difficulty: market.distribution_difficulty,
    market_type: market.market_type,
    market_reasoning: market.reasoning,
  });

  if (error) {
    console.error('persistAnalysis error:', error.message);
  }
}
