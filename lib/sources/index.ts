// Multi-source aggregator. Runs every enabled source in parallel for each
// keyword and returns a deduplicated, source-tagged list of posts.

import type { Post, SourceName } from './types';
import { SOURCE_META } from './types';
import { searchHN } from './hackernews';
import { searchReddit } from './reddit';
import { searchGitHub } from './github';
import { searchStackExchange } from './stackexchange';
import { searchLobsters } from './lobsters';
import { searchDevto } from './devto';

export type { Post, SourceName, SourceMeta } from './types';
export { SOURCE_META } from './types';

// ─── Source registry ──────────────────────────────────────────────────────────

type SearchFn = (keyword: string, limit: number) => Promise<Post[]>;

const REGISTRY: Record<SourceName, { search: SearchFn; defaultLimit: number }> = {
  hn:            { search: searchHN,            defaultLimit: 50 },
  reddit:        { search: searchReddit,        defaultLimit: 50 },
  github:        { search: searchGitHub,        defaultLimit: 25 },
  stackexchange: { search: searchStackExchange, defaultLimit: 20 },
  lobsters:      { search: searchLobsters,      defaultLimit: 20 },
  devto:         { search: searchDevto,         defaultLimit: 20 },
};

const ALL_SOURCES: SourceName[] = [
  'hn', 'reddit', 'github', 'stackexchange', 'lobsters', 'devto',
];

/** Returns the source list — overridable via ENABLED_SOURCES env var. */
export function getEnabledSources(): SourceName[] {
  const raw = process.env.ENABLED_SOURCES;
  if (!raw) return ALL_SOURCES;
  const requested = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is SourceName => s in REGISTRY);
  return requested.length > 0 ? requested : ALL_SOURCES;
}

/** Human-readable list label for prompts and UI ("Hacker News, Reddit, GitHub…"). */
export function getSourcesLabel(): string {
  return getEnabledSources().map((s) => SOURCE_META[s].label).join(', ');
}

/** Backwards-compat shim — returns "multi" when more than one source is enabled. */
export function getSourceName(): string {
  const sources = getEnabledSources();
  return sources.length === 1 ? sources[0] : 'multi';
}

/** Backwards-compat shim. */
export function getSourceLabel(): string {
  return getSourcesLabel();
}

// ─── Main aggregation ─────────────────────────────────────────────────────────

/**
 * Runs every enabled source in parallel for the given keyword.
 * Each source has an independent timeout so a slow one can't block the rest.
 */
export async function searchPosts(keyword: string, _limit = 100): Promise<Post[]> {
  const enabled = getEnabledSources();

  const tasks = enabled.map(async (name): Promise<Post[]> => {
    const cfg = REGISTRY[name];
    try {
      return await withTimeout(cfg.search(keyword, cfg.defaultLimit), 10_000);
    } catch (err) {
      console.error(`Source "${name}" failed for "${keyword}":`, err);
      return [];
    }
  });

  const results = await Promise.all(tasks);
  return results.flat();
}

/** Promise.race against a timeout that resolves with []. */
function withTimeout<T>(p: Promise<T[]>, ms: number): Promise<T[]> {
  return Promise.race([
    p,
    new Promise<T[]>((resolve) => setTimeout(() => resolve([]), ms)),
  ]);
}
