// Hacker News via Algolia HN Search API. Free, no auth.

import type { Post } from './types';

const API_BASE = 'https://hn.algolia.com/api/v1/search';

interface AlgoliaHit {
  objectID: string;
  title: string | null;
  story_text: string | null;
  url: string | null;
  points: number | null;
  num_comments: number | null;
  created_at_i: number;
}

interface AlgoliaResponse { hits: AlgoliaHit[] }

export async function searchHN(keyword: string, limit = 50): Promise<Post[]> {
  const oneYearAgo = Math.floor(Date.now() / 1000) - 365 * 86400;

  const url = new URL(API_BASE);
  url.searchParams.set('query', keyword);
  url.searchParams.set('tags', 'story');
  url.searchParams.set('hitsPerPage', String(Math.min(limit, 100)));
  url.searchParams.set('numericFilters', `created_at_i>${oneYearAgo}`);

  let res: Response;
  try {
    res = await fetch(url.toString());
  } catch (err) {
    console.error(`HN search network error for "${keyword}":`, err);
    return [];
  }
  if (!res.ok) {
    console.error(`HN search failed for "${keyword}": ${res.status}`);
    return [];
  }

  const data = (await res.json()) as AlgoliaResponse;

  return data.hits.map((h): Post => ({
    id: h.objectID,
    title: h.title ?? '',
    selftext: h.story_text ?? '',
    ups: h.points ?? 0,
    num_comments: h.num_comments ?? 0,
    created_utc: h.created_at_i,
    subreddit: extractHost(h.url) ?? 'hn',
    permalink: `https://news.ycombinator.com/item?id=${h.objectID}`,
    source: 'hn',
  }));
}

function extractHost(url: string | null): string | null {
  if (!url) return null;
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return null; }
}
