// Competitor identification combines THREE signals:
//   1. Direct from GitHub: every repo we found IS a real product (the most authoritative)
//   2. LLM training knowledge: ask the model to name real competing products it knows about
//   3. Post-mention extraction: products named in forum discussions
//
// We then merge, dedupe, and rank by mention count + verification status.

import { z } from 'zod';
import { complete } from './llm';
import type { Post } from './sources';
import type { Classification } from './classify';

export interface Competitor {
  name: string;
  mentions: number;
  /** Where this competitor came from. */
  source: 'github' | 'forum' | 'llm-knowledge' | 'github+forum' | 'llm+forum';
  /** GitHub repo URL or product website if we have one */
  url?: string;
  /** Short tagline if available */
  tagline?: string;
}

// ─── Blacklist for forum extraction ───────────────────────────────────────────

const TOOL_BLACKLIST = new Set([
  // Tech acronyms / concepts
  'ai', 'llm', 'ml', 'nlp', 'rag', 'mcp', 'api', 'sdk', 'cli', 'gui', 'ide',
  'sql', 'nosql', 'http', 'https', 'rest', 'graphql', 'grpc', 'json', 'yaml',
  'xml', 'html', 'css', 'tcp', 'udp', 'ssl', 'tls', 'oauth', 'jwt', 'orm',
  'crud', 'mvc', 'spa', 'pwa', 'saas', 'paas', 'iaas',
  // Generic product categories
  'app', 'apps', 'tool', 'tools', 'platform', 'service', 'software', 'product',
  'system', 'systems', 'framework', 'library', 'package', 'module', 'plugin',
  'extension', 'addon', 'chatbot', 'bot', 'assistant', 'agent', 'engine',
  // Other false positives
  'code', 'codes', 'file', 'files', 'data', 'model', 'models',
  'server', 'client', 'browser', 'internet', 'web',
]);

// ─── 1. GitHub repos as competitors ───────────────────────────────────────────

/**
 * Extracts the top-N GitHub repos as competitors. Each repo's stargazer count
 * acts as the "mentions" signal — popular repos rank higher.
 */
function competitorsFromGitHub(posts: Post[]): Competitor[] {
  const repos = posts.filter((p) => p.source === 'github');
  return repos
    .sort((a, b) => b.ups - a.ups) // stars
    .slice(0, 25)
    .map((r): Competitor => ({
      name: r.subreddit, // full repo name e.g. "owner/name"
      mentions: r.ups,   // stars-as-mentions
      source: 'github',
      url: r.permalink,
      tagline: extractTagline(r.title) ?? r.selftext.slice(0, 120),
    }));
}

function extractTagline(title: string): string | undefined {
  // GitHub titles look like "name — description"
  const parts = title.split(/—|–|-/);
  if (parts.length > 1) return parts.slice(1).join('-').trim();
  return undefined;
}

// ─── 2. LLM training-knowledge competitors ────────────────────────────────────

const KnownProductsSchema = z.object({
  products: z.array(
    z.object({
      name: z.string().min(1),
      tagline: z.string().optional(),
    }),
  ),
});

/**
 * Asks the LLM to name REAL existing products that compete with this idea.
 * Uses the model's training-knowledge of brands like Notion, Linear, Figma, etc.
 * Much higher signal than post-extraction for "what competitors exist".
 */
export async function findKnownCompetitors(
  idea: string,
  classification: Classification,
): Promise<Competitor[]> {
  const prompt = `You are a startup researcher. Name REAL EXISTING products, services, websites, or companies that compete with — or are very similar to — this idea.

IDEA: "${idea}"
- Audience: ${classification.audience}
- Problem: ${classification.problem}
- Solution: ${classification.solution}
- Industry: ${classification.industry}

INCLUDE:
- Products/companies you know exist (e.g. "Notion", "Linear", "Figma", "Airtable", "Calendly")
- Both direct competitors and adjacent products solving similar problems
- Big names AND smaller indie products you have specific knowledge of

EXCLUDE:
- Generic categories ("a project management tool")
- Concepts or technologies ("AI", "blockchain")
- Made-up names — only real products you actually know
- Products that no longer exist or are abandoned

Aim for 8-15 specific named products. Each tagline should be ONE short phrase explaining what they do (e.g. "all-in-one workspace for notes and docs").

Return ONLY this JSON (no markdown, no commentary):
{"products": [{"name": "Notion", "tagline": "all-in-one workspace"}, {"name": "Linear", "tagline": "issue tracking for fast teams"}]}`;

  try {
    const raw = await complete(prompt, { json: true });
    const parsed = KnownProductsSchema.parse(JSON.parse(raw));
    return parsed.products
      .filter((p) => {
        const lower = p.name.trim().toLowerCase();
        return lower.length >= 2 && !TOOL_BLACKLIST.has(lower);
      })
      .map((p): Competitor => ({
        name: p.name.trim(),
        mentions: 1, // baseline mention count
        source: 'llm-knowledge',
        tagline: p.tagline?.trim(),
      }));
  } catch (err) {
    console.error('findKnownCompetitors failed:', err);
    return [];
  }
}

// ─── 3. Forum-mention extraction ──────────────────────────────────────────────

const ToolsSchema = z.object({ tools: z.array(z.string()) });

/**
 * Extracts product/tool names from forum-style posts (HN, Reddit, etc.).
 * Skips GitHub repos (those are handled separately).
 */
export async function extractForumMentions(posts: Post[]): Promise<Competitor[]> {
  const forumPosts = posts.filter((p) => p.source !== 'github');
  if (forumPosts.length === 0) return [];

  const sample = forumPosts
    .slice()
    .sort((a, b) => b.ups + b.num_comments * 2 - (a.ups + a.num_comments * 2))
    .slice(0, 25);

  const text = sample
    .map((p) => `${p.title}\n${(p.selftext ?? '').slice(0, 250)}`)
    .join('\n---\n')
    .slice(0, 9000);

  const prompt = `Extract BRANDED product, tool, app, company, or service NAMES mentioned across these posts.

INCLUDE: Real product brands like "Notion", "Figma", "Linear", "Slack" — capitalized proper nouns.
EXCLUDE: tech acronyms (AI, LLM, API, JSON, SQL), generic categories (app, tool, platform), programming languages (Python, Rust, Go).

POSTS:
${text}

Return ONLY this JSON: {"tools": ["name1", "name2", ...]}`;

  try {
    const raw = await complete(prompt, { json: true });
    const parsed = ToolsSchema.parse(JSON.parse(raw));

    const allText = forumPosts
      .map((p) => `${p.title} ${p.selftext ?? ''}`)
      .join(' ');
    const allTextLower = allText.toLowerCase();

    const counts = new Map<string, number>();
    for (const t of parsed.tools) {
      const name = t.trim().toLowerCase();
      if (!name || name.length < 3) continue;
      if (TOOL_BLACKLIST.has(name)) continue;
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Require capitalized appearance — proper noun check
      const capRe = new RegExp(`\\b${escaped}\\b`, 'gi');
      const matches = allText.match(capRe) ?? [];
      const hasCap = matches.some((m) => /^[A-Z]/.test(m));
      if (!hasCap) continue;

      const count = (allTextLower.match(new RegExp(`\\b${escaped}\\b`, 'g')) ?? []).length;
      if (count > 0) counts.set(name, count);
    }

    return [...counts.entries()].map(([name, mentions]) => ({
      name,
      mentions,
      source: 'forum' as const,
    }));
  } catch (err) {
    console.error('extractForumMentions failed:', err);
    return [];
  }
}

// ─── Combiner ─────────────────────────────────────────────────────────────────

/**
 * Combines all three sources into a single ranked competitor list.
 * Dedupes case-insensitively. Verified products (GitHub, LLM-known) rank above
 * forum-only mentions even if forum mentions are higher.
 */
export function mergeCompetitors(
  fromGitHub: Competitor[],
  fromLLM: Competitor[],
  fromForum: Competitor[],
): Competitor[] {
  const map = new Map<string, Competitor>();

  // Helper — case-insensitive key, but keep original name (preferring capitalized)
  const upsert = (c: Competitor) => {
    const key = c.name.toLowerCase().trim();
    if (!key) return;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...c });
      return;
    }
    // Merge: combine mentions, upgrade source tag, prefer better-cased name
    const merged: Competitor = {
      ...existing,
      mentions: existing.mentions + c.mentions,
      tagline: existing.tagline ?? c.tagline,
      url: existing.url ?? c.url,
      source: combineSources(existing.source, c.source),
    };
    // Prefer the version with a capital letter (real brand casing)
    if (/^[A-Z]/.test(c.name) && !/^[A-Z]/.test(existing.name)) {
      merged.name = c.name;
    }
    map.set(key, merged);
  };

  fromGitHub.forEach(upsert);
  fromLLM.forEach(upsert);
  fromForum.forEach(upsert);

  // Rank: verified (github / llm-known) sources rank above forum-only.
  return [...map.values()].sort((a, b) => {
    const verifiedA = a.source !== 'forum' ? 1 : 0;
    const verifiedB = b.source !== 'forum' ? 1 : 0;
    if (verifiedA !== verifiedB) return verifiedB - verifiedA;
    return b.mentions - a.mentions;
  });
}

function combineSources(
  a: Competitor['source'],
  b: Competitor['source'],
): Competitor['source'] {
  const has = (s: string) => a.includes(s) || b.includes(s);
  if (has('github') && has('forum')) return 'github+forum';
  if (has('llm-knowledge') && has('forum')) return 'llm+forum';
  return a === 'forum' ? b : a;
}
