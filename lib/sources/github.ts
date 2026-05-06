// GitHub repository search. Returns repos as Posts — each repo IS a competitor.
// Free 60 req/hour without token, 5000/hour with GITHUB_TOKEN.

import type { Post } from './types';

interface Repo {
  id: number;
  full_name: string;
  name: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  watchers_count: number;
  pushed_at: string;
  html_url: string;
  language: string | null;
  topics?: string[];
}

interface GitHubSearchResponse {
  total_count: number;
  items: Repo[];
}

/**
 * Searches public GitHub repositories. Restricts to repos pushed in the last 2 years
 * to filter out abandoned projects. Sorted by stars desc.
 */
export async function searchGitHub(keyword: string, limit = 30): Promise<Post[]> {
  const twoYearsAgoIso = new Date(Date.now() - 2 * 365 * 86400 * 1000)
    .toISOString()
    .slice(0, 10);

  // GitHub search query: keyword + push activity filter
  const query = `${keyword} pushed:>${twoYearsAgoIso}`;

  const url = new URL('https://api.github.com/search/repositories');
  url.searchParams.set('q', query);
  url.searchParams.set('sort', 'stars');
  url.searchParams.set('order', 'desc');
  url.searchParams.set('per_page', String(Math.min(limit, 100)));

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'Renji-Validator/0.2',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  let res: Response;
  try {
    res = await fetch(url.toString(), { headers });
  } catch (err) {
    console.error(`GitHub search network error for "${keyword}":`, err);
    return [];
  }

  if (!res.ok) {
    if (res.status === 403 || res.status === 429) {
      console.warn(`GitHub rate limit hit for "${keyword}"`);
    } else {
      console.error(`GitHub search failed for "${keyword}": ${res.status}`);
    }
    return [];
  }

  const data = (await res.json()) as GitHubSearchResponse;

  return (data.items ?? []).map((r): Post => {
    const created = Math.floor(new Date(r.pushed_at).getTime() / 1000);
    const titleParts = [r.name, r.description].filter(Boolean).join(' — ');
    return {
      id: String(r.id),
      title: titleParts || r.full_name,
      selftext: [r.description ?? '', r.topics?.join(' ') ?? '', r.language ?? '']
        .filter(Boolean)
        .join(' '),
      ups: r.stargazers_count,
      num_comments: r.forks_count,
      created_utc: created,
      subreddit: r.full_name, // repo full name acts as community label
      permalink: r.html_url,
      source: 'github',
    };
  });
}
