// StackExchange API — covers Stack Overflow, Software Engineering, Server Fault, etc.
// Free with a 300/day quota per IP. Use STACKEXCHANGE_KEY env to bump to 10k/day.

import type { Post } from './types';

interface SEItem {
  question_id: number;
  title: string;
  body_markdown?: string;
  score: number;
  answer_count: number;
  view_count?: number;
  creation_date: number;
  link: string;
  tags?: string[];
  is_answered?: boolean;
}

interface SEResponse {
  items: SEItem[];
  has_more?: boolean;
  quota_remaining?: number;
}

const SITES = ['stackoverflow', 'softwareengineering', 'startups', 'workplace'];

/**
 * Searches across multiple StackExchange sites in parallel and combines results.
 * Q&A questions with high score = real problem signal.
 */
export async function searchStackExchange(keyword: string, limit = 25): Promise<Post[]> {
  const oneYearAgo = Math.floor(Date.now() / 1000) - 365 * 86400;

  const requests = SITES.map(async (site): Promise<Post[]> => {
    const url = new URL('https://api.stackexchange.com/2.3/search/advanced');
    url.searchParams.set('q', keyword);
    url.searchParams.set('site', site);
    url.searchParams.set('sort', 'votes');
    url.searchParams.set('order', 'desc');
    url.searchParams.set('pagesize', String(Math.min(limit, 50)));
    url.searchParams.set('fromdate', String(oneYearAgo));
    url.searchParams.set('filter', 'withbody');
    if (process.env.STACKEXCHANGE_KEY) {
      url.searchParams.set('key', process.env.STACKEXCHANGE_KEY);
    }

    let res: Response;
    try {
      res = await fetch(url.toString());
    } catch {
      return [];
    }
    if (!res.ok) return [];

    const data = (await res.json()) as SEResponse;

    return (data.items ?? []).map((q): Post => ({
      id: `${site}-${q.question_id}`,
      title: decodeHtmlEntities(q.title),
      selftext: stripHtml(q.body_markdown ?? '').slice(0, 400),
      ups: q.score,
      num_comments: q.answer_count,
      created_utc: q.creation_date,
      subreddit: site,
      permalink: q.link,
      source: 'stackexchange',
    }));
  });

  const results = await Promise.all(requests);
  return results.flat();
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
