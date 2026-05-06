// Reddit public search JSON. No auth required when using a proper User-Agent.
// Reddit blocks default fetch UAs but accepts arbitrary identifiers.

import type { Post } from './types';

const USER_AGENT = 'Renji/0.2 (startup idea validator; +https://renji.pro)';

interface RedditChild {
  data: {
    id?: string;
    title?: string;
    selftext?: string;
    ups?: number;
    score?: number;
    num_comments?: number;
    created_utc?: number;
    subreddit?: string;
    permalink?: string;
  };
}
interface RedditListing {
  data?: { children?: RedditChild[] };
}

export async function searchReddit(keyword: string, limit = 50): Promise<Post[]> {
  const url = new URL('https://www.reddit.com/search.json');
  url.searchParams.set('q', keyword);
  url.searchParams.set('sort', 'top');
  url.searchParams.set('t', 'year');
  url.searchParams.set('limit', String(Math.min(limit, 100)));
  url.searchParams.set('type', 'link');

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });
  } catch (err) {
    console.error(`Reddit search network error for "${keyword}":`, err);
    return [];
  }
  if (!res.ok) {
    if (res.status !== 429) {
      console.error(`Reddit search failed for "${keyword}": ${res.status}`);
    }
    return [];
  }

  let data: RedditListing;
  try {
    data = (await res.json()) as RedditListing;
  } catch {
    return [];
  }

  return (data.data?.children ?? []).map((c): Post => {
    const d = c.data;
    return {
      id: String(d.id ?? ''),
      title: String(d.title ?? ''),
      selftext: String(d.selftext ?? ''),
      ups: Number(d.ups ?? d.score ?? 0),
      num_comments: Number(d.num_comments ?? 0),
      created_utc: Number(d.created_utc ?? 0),
      subreddit: String(d.subreddit ?? ''),
      permalink: d.permalink ? `https://reddit.com${d.permalink}` : '',
      source: 'reddit',
    };
  }).filter((p) => p.id && p.title);
}
