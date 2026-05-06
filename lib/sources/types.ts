// Common types for all data sources.

export type SourceName =
  | 'hn'           // Hacker News (Algolia)
  | 'reddit'       // Reddit public search JSON
  | 'github'       // GitHub repository search
  | 'stackexchange'// StackOverflow + sister sites
  | 'lobsters'     // lobste.rs
  | 'devto';       // dev.to articles

export interface SourceMeta {
  name: SourceName;
  label: string;       // human-readable
  weight: number;      // demand-score weight; products like GitHub get less weight
  isProductSource: boolean; // GitHub repos are products by definition; counted as competitors
}

export const SOURCE_META: Record<SourceName, Omit<SourceMeta, 'name'>> = {
  hn:            { label: 'Hacker News',   weight: 1.0, isProductSource: false },
  reddit:        { label: 'Reddit',        weight: 1.0, isProductSource: false },
  stackexchange: { label: 'StackExchange', weight: 0.8, isProductSource: false },
  lobsters:      { label: 'Lobsters',      weight: 0.6, isProductSource: false },
  devto:         { label: 'Dev.to',        weight: 0.6, isProductSource: false },
  github:        { label: 'GitHub',        weight: 0.4, isProductSource: true  },
};

/** Normalized post shape used by score.ts and analyze.ts, regardless of source. */
export interface Post {
  id: string;            // unique within a source
  title: string;
  selftext: string;
  ups: number;
  num_comments: number;
  created_utc: number;   // unix seconds
  subreddit: string;     // community label: subreddit name, hostname, "hn", repo full_name, etc.
  permalink: string;     // direct URL
  source: SourceName;    // which platform this came from
}
