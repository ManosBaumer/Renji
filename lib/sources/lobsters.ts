// Lobsters — small but high-signal HN-like community.
// No API auth required.

import type { Post } from './types';

interface LobstersStory {
  short_id: string;
  title: string;
  description?: string;
  score: number;
  comment_count: number;
  created_at: string;
  url: string;
  short_id_url: string;
  tags?: string[];
}

export async function searchLobsters(keyword: string, limit = 25): Promise<Post[]> {
  const url = new URL('https://lobste.rs/search.json');
  url.searchParams.set('q', keyword);
  url.searchParams.set('what', 'stories');
  url.searchParams.set('order', 'relevance');

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'Renji-Validator/0.2' },
    });
  } catch (err) {
    console.error(`Lobsters network error for "${keyword}":`, err);
    return [];
  }
  if (!res.ok) {
    if (res.status !== 429) console.error(`Lobsters search failed: ${res.status}`);
    return [];
  }

  let stories: LobstersStory[] = [];
  try {
    const json = (await res.json()) as LobstersStory[];
    stories = Array.isArray(json) ? json : [];
  } catch {
    return [];
  }

  const oneYearAgo = Math.floor(Date.now() / 1000) - 365 * 86400;

  return stories
    .slice(0, limit)
    .map((s): Post => {
      const created = Math.floor(new Date(s.created_at).getTime() / 1000);
      const tagsStr = s.tags?.join(' ') ?? '';
      return {
        id: s.short_id,
        title: s.title,
        selftext: [s.description ?? '', tagsStr].filter(Boolean).join(' '),
        ups: s.score,
        num_comments: s.comment_count,
        created_utc: created,
        subreddit: 'lobsters',
        permalink: s.short_id_url,
        source: 'lobsters',
      };
    })
    .filter((p) => p.created_utc >= oneYearAgo);
}
