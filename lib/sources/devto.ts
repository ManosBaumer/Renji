// Dev.to — engineering & startup blog articles.
// Uses the public articles endpoint. No auth needed.

import type { Post } from './types';

interface DevtoArticle {
  id: number;
  title: string;
  description?: string;
  positive_reactions_count: number;
  comments_count: number;
  published_timestamp: string;
  url: string;
  tag_list?: string[] | string;
  user?: { username?: string };
}

/**
 * Dev.to has no traditional fulltext search API, but the articles endpoint
 * supports `tag` and per-keyword search via the search endpoint. We try the
 * search endpoint first, then fall back to tag matching for short keywords.
 */
export async function searchDevto(keyword: string, limit = 20): Promise<Post[]> {
  // The /api/articles/search endpoint isn't documented stably; use the public
  // search-feed JSON which dev.to renders for /search?q=...
  const url = new URL('https://dev.to/search/feed_content');
  url.searchParams.set('per_page', String(Math.min(limit, 30)));
  url.searchParams.set('page', '0');
  url.searchParams.set('search_fields', keyword);
  url.searchParams.set('class_name', 'Article');

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'Renji-Validator/0.2', Accept: 'application/json' },
    });
  } catch {
    return [];
  }
  if (!res.ok) return [];

  let json: { result?: DevtoArticle[] };
  try {
    json = (await res.json()) as { result?: DevtoArticle[] };
  } catch {
    return [];
  }

  const articles = json.result ?? [];

  return articles.map((a): Post => {
    const created = Math.floor(new Date(a.published_timestamp).getTime() / 1000);
    const tags = Array.isArray(a.tag_list)
      ? a.tag_list.join(' ')
      : (a.tag_list ?? '');
    return {
      id: String(a.id),
      title: a.title,
      selftext: [a.description ?? '', tags].filter(Boolean).join(' '),
      ups: a.positive_reactions_count ?? 0,
      num_comments: a.comments_count ?? 0,
      created_utc: created,
      subreddit: a.user?.username ?? 'devto',
      permalink: a.url.startsWith('http') ? a.url : `https://dev.to${a.url}`,
      source: 'devto',
    };
  });
}
