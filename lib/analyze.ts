import { z } from 'zod';
import { classifyIdea, type Classification, type RetrievedKeyword } from './classify';
import { computeFlags, type Flags } from './flag';
import {
  searchPosts,
  getEnabledSources,
  getSourcesLabel,
  type Post,
  type SourceName,
} from './sources';
import {
  computeDemand,
  computeCompetitionV2,
  computeOpportunityV2,
  computeTrend,
  type Trend,
} from './score';
import { complete } from './llm';
import {
  extractForumMentions,
  mergeCompetitors,
  type Competitor,
} from './competitors';
import { analyzeMarketIntelligence, type MarketAssessment } from './market';
import { rerankPosts } from './rerank';

// Re-export so callers don't need to know about sub-modules
export type { Competitor } from './competitors';
export type { MarketAssessment, MarketType } from './market';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TopPost {
  title: string;
  subreddit: string;
  ups: number;
  num_comments: number;
  permalink: string;
  source: SourceName;
}

export interface Insight {
  verdict: string;
  demand_signal: string;
  competition_signal: string;
  opportunity: string;
  risks: string;
  next_steps: string[];
}

export interface AnalysisResult {
  classification: Classification;
  retrieved: RetrievedKeyword[];
  flags: Flags;
  user_provided: boolean;
  metrics: {
    sources: SourceName[];
    source_counts: Record<string, number>;
    demand: number;
    competition: number;
    opportunity: number;
    trend: Trend;
    total_posts: number;
    keywords_analyzed: string[];
  };
  /** LLM-based market reality check (saturation, urgency, etc.) */
  market: MarketAssessment;
  competitors: Competitor[];
  top_posts: TopPost[];
  insight: Insight | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MAX_QUERY_KEYWORDS = 5;

/**
 * Pick which queries to send to the data sources.
 *
 * Priority order — KEYWORDS FIRST. The keywords array contains the most
 * specific terms (Sentinel-1, InSAR, AOI, etc.) and runs first so the post
 * pool is dominated by relevant content. Problem/solution strings tend to
 * be longer and more generic, so they go last.
 *
 * Audience composition is applied selectively: only when the keyword is
 * generic enough that pairing with the audience adds signal. Specific
 * technical terms ("InSAR change detection") query well on their own —
 * adding "engineers InSAR change detection" can actually hurt recall.
 */
function pickQueryKeywords(c: Classification): string[] {
  const audience = c.audience.trim().toLowerCase();
  const audienceTokens = new Set(
    audience.split(/\s+/).filter((t) => t.length >= 3),
  );

  // Prefer keywords (specific) over problem/solution (often generalized).
  const topics = [...c.keywords, c.problem, c.solution];
  const seen = new Set<string>();
  const queries: string[] = [];

  for (const topic of topics) {
    if (queries.length >= MAX_QUERY_KEYWORDS) break;
    const t = topic.trim().toLowerCase();
    if (!t) continue;

    // Skip if the entire topic is just audience tokens (returns generic news)
    const topicTokens = t.split(/\s+/).filter((tok) => tok.length >= 3);
    if (
      topicTokens.length > 0 &&
      topicTokens.every((tok) => audienceTokens.has(tok))
    ) {
      continue;
    }

    // Don't pre-pend audience to specific technical terms — they query well
    // on their own. Only pair with audience for short generic terms.
    const isSpecific = isSpecificTerm(t);
    const containsAudience = [...audienceTokens].some((tok) => t.includes(tok));
    const query =
      isSpecific || containsAudience || !audience ? t : `${audience} ${t}`;

    if (!seen.has(query)) {
      seen.add(query);
      queries.push(query);
    }
  }
  return queries;
}

/**
 * A term is "specific" if it looks like technical jargon: contains an
 * uppercase letter (acronyms get lowercased so we check the original),
 * a hyphen, or is multi-word with at least one uncommon token.
 *
 * After lowercase normalization, we look for hyphenated forms (Sentinel-1),
 * version numbers, or 4+ chars with consonant clusters (typical of jargon).
 */
function isSpecificTerm(t: string): boolean {
  // Hyphens or version numbers → likely specific (sentinel-1, c++, web3)
  if (/[-]/.test(t) || /\d/.test(t)) return true;
  // Multi-word phrases with at least one uncommon (4+ char) token
  const words = t.split(/\s+/);
  if (words.length >= 2 && words.some((w) => w.length >= 6)) return true;
  return false;
}

const InsightSchema = z.object({
  verdict: z.string().min(1),
  demand_signal: z.string().min(1),
  competition_signal: z.string().min(1),
  opportunity: z.string().min(1),
  risks: z.string().min(1),
  next_steps: z.array(z.string().min(1)).min(1).max(5),
});

async function generateInsight(args: {
  idea: string;
  classification: Classification;
  metrics: AnalysisResult['metrics'];
  market: MarketAssessment;
  competitors: Competitor[];
  topPosts: TopPost[];
}): Promise<Insight | null> {
  const { idea, classification, metrics, market, competitors, topPosts } = args;

  const competitorList = competitors.length
    ? competitors
        .slice(0, 12)
        .map((c, i) => {
          const tag = c.tagline ? ` — ${c.tagline}` : '';
          return `${i + 1}. ${c.name}${tag} (${c.source}, ${c.mentions}×)`;
        })
        .join('\n')
    : '(none detected)';

  const postList = topPosts.length
    ? topPosts
        .slice(0, 8)
        .map(
          (p) =>
            `- [${p.source}] "${p.title}" (${p.subreddit}, ${p.ups} pts, ${p.num_comments} comments)`,
        )
        .join('\n')
    : '(no posts)';

  const sourceLabel = getSourcesLabel();
  const breakdown = Object.entries(metrics.source_counts)
    .filter(([, n]) => n > 0)
    .map(([s, n]) => `${s}=${n}`)
    .join(', ');

  const prompt = `You are an expert startup analyst. Given multi-source market data for a startup idea, write structured insights for the founder. Ground every observation in the SPECIFIC data — name actual communities, tools, and posts. Avoid generic startup advice.

IDEA: "${idea}"

CLASSIFICATION:
- Audience: ${classification.audience}
- Core problem: ${classification.problem}
- Solution type: ${classification.solution}
- Industry: ${classification.industry}

MULTI-SOURCE MARKET DATA (past 12 months from ${sourceLabel}):
- Posts analyzed: ${metrics.total_posts} (${breakdown}) across ${metrics.keywords_analyzed.length} keywords: ${metrics.keywords_analyzed.join(', ')}
- Demand (topic activity): ${metrics.demand}/100
- Competition (saturation-aware): ${metrics.competition}/100 (${competitors.length} products identified)
- Opportunity (geometric blend): ${metrics.opportunity}/100
- Trend: ${metrics.trend.label} (${metrics.trend.pct_change}% change in posting rate)

MARKET REALITY CHECK (LLM training-knowledge assessment):
- Market type: ${market.market_type}
- Saturation: ${market.saturation}/100 (how many established players exist)
- Commoditization: ${market.commoditization}/100 (race-to-bottom risk)
- Buyer urgency: ${market.buyer_urgency}/100 (will users actually pay?)
- Distribution difficulty: ${market.distribution_difficulty}/100 (incumbent grip)
- Reasoning: ${market.reasoning}

COMPETITORS / SIMILAR PRODUCTS (verified by GitHub stars, LLM knowledge, or forum mentions):
${competitorList}

REPRESENTATIVE POSTS (highest engagement):
${postList}

Return JSON with these fields (no markdown, no commentary):
{
  "verdict": "1-2 sentence overall assessment of viability for THIS idea",
  "demand_signal": "What the demand score and post pattern reveal about this market — name actual subreddits/sites",
  "competition_signal": "What the competitor list reveals — name 2-3 specific products that compete and HOW they compete",
  "opportunity": "ONE specific concrete angle/gap/niche this idea could exploit, grounded in the data",
  "risks": "Top 2 risks for this specific idea (specific, not generic)",
  "next_steps": ["3 concrete actions for the founder this week", "...", "..."]
}`;

  try {
    const raw = await complete(prompt, { json: true });
    const parsed = InsightSchema.parse(JSON.parse(raw));
    return parsed;
  } catch (err) {
    console.error('generateInsight failed:', err);
    return null;
  }
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export async function analyzeIdea(
  idea: string,
  /** When provided, skip re-classification and use these fields directly. */
  classificationOverride?: Classification,
): Promise<AnalysisResult> {
  const trimmed = idea.trim();
  if (trimmed.length === 0) throw new Error('Idea cannot be empty');

  // 1. Classify or use override
  let classification: Classification;
  let retrieved: RetrievedKeyword[];
  let flags: Flags;

  if (classificationOverride) {
    classification = classificationOverride;
    retrieved = [];
    flags = computeFlags(classification, retrieved);
  } else {
    const result = await classifyIdea(trimmed);
    classification = result.classification;
    retrieved = result.retrieved;
    flags = computeFlags(classification, retrieved);
  }

  // 2. Build keyword queries + parallel multi-source fetch
  //    searchPosts is now a multi-source aggregator under the hood.
  const queryKeywords = pickQueryKeywords(classification);
  const postsPerKeyword = await Promise.all(
    queryKeywords.map((k) => searchPosts(k, 100)),
  );

  // Dedupe across keywords AND sources, keyed by source+id
  const seen = new Set<string>();
  const allPosts: Post[] = [];
  for (const posts of postsPerKeyword) {
    for (const p of posts) {
      const key = `${p.source}:${p.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        allPosts.push(p);
      }
    }
  }

  // Per-source breakdown for UI + insight prompt
  const source_counts: Record<string, number> = {};
  for (const p of allPosts) {
    source_counts[p.source] = (source_counts[p.source] ?? 0) + 1;
  }

  // 3. Demand & trend (compute on FORUM posts only — GitHub stars aren't
  //    "demand", they're "supply"; we exclude github when scoring demand).
  const forumPosts = allPosts.filter((p) => p.source !== 'github');
  const demand = computeDemand(forumPosts);
  const trend  = computeTrend(forumPosts);

  // 4. Competitors: 3-way merge — GitHub repos + LLM-market call + forum mentions
  const githubRepos = allPosts.filter((p) => p.source === 'github');
  const competitorsFromRepos = githubRepos
    .sort((a, b) => b.ups - a.ups)
    .slice(0, 25)
    .map((r): Competitor => ({
      name: r.subreddit,
      mentions: r.ups,
      source: 'github',
      url: r.permalink,
      tagline:
        r.title.split(/—|–|-/).slice(1).join('-').trim() ||
        r.selftext.slice(0, 120),
    }));

  // Single LLM call returns BOTH known competitors AND market assessment.
  // Run in parallel with forum-mention extraction AND post reranking — all
  // three are independent and can fire simultaneously to mask latency.
  const [marketIntel, forumComps, rerankedPosts] = await Promise.all([
    analyzeMarketIntelligence(trimmed, classification),
    extractForumMentions(allPosts),
    rerankPosts(trimmed, classification, allPosts),
  ]);

  const competitors = mergeCompetitors(
    competitorsFromRepos,
    marketIntel.competitors,
    forumComps,
  );

  // V2 scoring: blend tool count with LLM saturation knowledge
  const competition = computeCompetitionV2(competitors.length, marketIntel.market);
  const opportunity = computeOpportunityV2(demand, marketIntel.market);

  // 5. Top posts — already reranked by founder-relevance via LLM, fallback to
  //    engagement-sort happens internally if the rerank fails.
  const topPosts: TopPost[] = rerankedPosts.map((p) => ({
    title: p.title,
    subreddit: p.subreddit,
    ups: p.ups,
    num_comments: p.num_comments,
    permalink: p.permalink,
    source: p.source,
  }));

  const metrics: AnalysisResult['metrics'] = {
    sources: getEnabledSources(),
    source_counts,
    demand,
    competition,
    opportunity,
    trend,
    total_posts: allPosts.length,
    keywords_analyzed: queryKeywords,
  };

  // 6. Insight generation
  const insight = await generateInsight({
    idea: trimmed,
    classification,
    metrics,
    market: marketIntel.market,
    competitors,
    topPosts,
  });

  return {
    classification,
    retrieved,
    flags,
    user_provided: !!classificationOverride,
    metrics,
    market: marketIntel.market,
    competitors,
    top_posts: topPosts,
    insight,
  };
}
