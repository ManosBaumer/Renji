// LLM-based post relevance reranker.
//
// The "top posts" panel is the most-read part of the result page after the
// score numbers. Without reranking, posts with high engagement but tangential
// relevance dominate (e.g. for "weather app", you get general iOS-development
// threads that happen to mention weather instead of "I built a weather app
// and got 1k users" from r/SideProject).
//
// This module asks the LLM to pick the N most useful posts for a founder
// VALIDATING the idea — considering both relevance and engagement.

import { z } from 'zod';
import { complete } from './llm';
import type { Post } from './sources';
import type { Classification } from './classify';

const ResponseSchema = z.object({
  indices: z.array(z.number().int().nonnegative()).min(1).max(15),
});

const MIN_CANDIDATES = 8;
const MAX_CANDIDATES = 30;
const TARGET_OUTPUT = 10;

/**
 * Reranks `posts` by founder-relevance, considering both topical match and
 * community engagement. Falls back to the engagement-sorted input on any LLM
 * failure so the result page never breaks.
 */
export async function rerankPosts(
  idea: string,
  classification: Classification,
  posts: Post[],
): Promise<Post[]> {
  // Below threshold, no point reranking — just return engagement-sorted
  if (posts.length <= MIN_CANDIDATES) return posts.slice(0, TARGET_OUTPUT);

  // Pre-filter to top candidates by raw engagement so prompt size stays small
  const candidates = posts
    .slice()
    .sort((a, b) => b.ups + b.num_comments * 2 - (a.ups + a.num_comments * 2))
    .slice(0, MAX_CANDIDATES);

  const numbered = candidates
    .map((p, i) => {
      const eng = `▲${p.ups} 💬${p.num_comments}`;
      const community = p.subreddit ? ` in ${p.subreddit}` : '';
      const text = (p.title + ' ' + (p.selftext ?? ''))
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 220);
      return `${i}. [${p.source}${community}] ${text} (${eng})`;
    })
    .join('\n');

  const prompt = `You are filtering forum/repo posts to find the MOST USEFUL ones for a founder validating this startup idea.

IDEA: "${idea}"
- Audience: ${classification.audience}
- Problem: ${classification.problem}
- Solution: ${classification.solution}

CANDIDATE POSTS (numbered, with source + engagement):
${numbered}

Pick the ${TARGET_OUTPUT} posts that would be MOST valuable for the founder. Strongly prefer posts that:
  ✓ Describe building/launching/maintaining a product in this exact space (e.g. "Show HN: my weather app", "I built X and got Y users")
  ✓ Discuss the specific problem this idea solves (real users complaining, asking for solutions)
  ✓ Compare or review existing products in this space
  ✓ Come from communities aligned with the target audience (r/SideProject, r/SaaS, r/startups, Show HN, etc.)
  ✓ Have meaningful engagement (high score + comments) — engagement still matters

Avoid:
  ✗ Posts that mention the topic only in passing
  ✗ News articles or general industry pieces unrelated to building/using
  ✗ Tangential dev/marketing advice not specific to this product

Order your indices by usefulness — most useful first. Return ${TARGET_OUTPUT} indices unless there are fewer truly relevant ones.

Return ONLY this JSON: {"indices": [3, 7, 12, 0, ...]}`;

  try {
    const raw = await complete(prompt, { json: true });
    const parsed = ResponseSchema.parse(JSON.parse(raw));
    const seen = new Set<number>();
    const ordered: Post[] = [];
    for (const idx of parsed.indices) {
      if (idx < 0 || idx >= candidates.length) continue;
      if (seen.has(idx)) continue;
      seen.add(idx);
      ordered.push(candidates[idx]);
      if (ordered.length >= TARGET_OUTPUT) break;
    }
    // Fall back if the LLM returned too few valid indices
    if (ordered.length < MIN_CANDIDATES) return candidates.slice(0, TARGET_OUTPUT);
    return ordered;
  } catch (err) {
    console.error('rerankPosts failed, falling back to engagement order:', err);
    return candidates.slice(0, TARGET_OUTPUT);
  }
}
