import { z } from 'zod';
import { embed, complete } from './llm';
import { supabaseAdmin } from './supabase-admin';

export const ClassificationSchema = z.object({
  audience: z.string().min(1),
  problem: z.string().min(1),
  solution: z.string().min(1),
  industry: z.string().min(1),
  keywords: z.array(z.string().min(1)).min(1).max(8),
  confidence: z.object({
    audience: z.number().min(0).max(1),
    problem: z.number().min(0).max(1),
    solution: z.number().min(0).max(1),
    industry: z.number().min(0).max(1),
    keywords: z.number().min(0).max(1),
  }),
});

export type Classification = z.infer<typeof ClassificationSchema>;

export type KeywordType = 'audience' | 'problem' | 'solution' | 'industry' | 'keyword';

export interface RetrievedKeyword {
  id: string;
  name: string;
  type: KeywordType;
  similarity: number;
}

const KEYWORDS_PER_TYPE = 8;

async function retrieveKeywords(embedding: number[]): Promise<RetrievedKeyword[]> {
  const { data, error } = await supabaseAdmin.rpc('match_keywords', {
    query_embedding: embedding,
    match_per_type: KEYWORDS_PER_TYPE,
  });
  if (error) throw new Error(`Keyword retrieval failed: ${error.message}`);
  return (data ?? []) as RetrievedKeyword[];
}

function buildPrompt(idea: string, retrieved: RetrievedKeyword[]): string {
  const byType: Record<KeywordType, string[]> = {
    audience: [],
    problem: [],
    solution: [],
    industry: [],
    keyword: [],
  };
  for (const k of retrieved) {
    if (byType[k.type]) byType[k.type].push(k.name);
  }

  const fmt = (xs: string[]) => (xs.length ? xs.join(', ') : '(none)');

  return `You classify startup ideas into structured fields. Be specific and grounded.

USER'S IDEA:
"${idea}"

CANDIDATE KEYWORDS FROM OUR TAXONOMY (semantically nearest):

Audiences:
${fmt(byType.audience)}

Problems:
${fmt(byType.problem)}

Solutions:
${fmt(byType.solution)}

Industries:
${fmt(byType.industry)}

General keywords:
${fmt(byType.keyword)}

RULES:
1. Choose from candidates when one fits naturally. If none fit well, generate a concise novel term (2-4 words, lowercase).
2. Pick 3-6 keywords total. Favour candidates; include obvious missing terms only when needed.
3. Confidence per field (0.0-1.0):
   - 0.9+ when a candidate fits the idea precisely
   - 0.6-0.9 when the candidate is close, OR you generated a confident novel term
   - 0.3-0.6 when the fit is weak or the idea is vague in this dimension
   - <0.3 when you really had to guess
4. Be specific. "freelance designers" beats "professionals". "subscription billing" beats "payments".

Return ONLY this JSON object (no markdown, no code fences, no commentary):
{
  "audience": "string",
  "problem": "string",
  "solution": "string",
  "industry": "string",
  "keywords": ["string", "..."],
  "confidence": {
    "audience": 0.0,
    "problem": 0.0,
    "solution": 0.0,
    "industry": 0.0,
    "keywords": 0.0
  }
}`;
}

function normalize(c: Classification): Classification {
  return {
    audience: c.audience.trim().toLowerCase(),
    problem: c.problem.trim().toLowerCase(),
    solution: c.solution.trim().toLowerCase(),
    industry: c.industry.trim().toLowerCase(),
    keywords: c.keywords.map((k) => k.trim().toLowerCase()),
    confidence: c.confidence,
  };
}

async function classifyOnce(prompt: string): Promise<Classification> {
  const raw = await complete(prompt, { json: true });
  const parsed = JSON.parse(raw);
  const validated = ClassificationSchema.parse(parsed);
  return normalize(validated);
}

export async function classifyIdea(idea: string): Promise<{
  classification: Classification;
  retrieved: RetrievedKeyword[];
}> {
  const trimmed = idea.trim();
  if (trimmed.length === 0) throw new Error('Idea cannot be empty');

  const embedding = await embed(trimmed);
  const retrieved = await retrieveKeywords(embedding);
  const prompt = buildPrompt(trimmed, retrieved);

  let classification: Classification;
  try {
    classification = await classifyOnce(prompt);
  } catch {
    // One retry with stricter framing on parse / validation failure
    const retryPrompt = `${prompt}\n\nIMPORTANT: Your previous response could not be parsed. Return ONLY valid JSON matching the schema exactly. No markdown, no code fences, no extra fields.`;
    classification = await classifyOnce(retryPrompt);
  }

  return { classification, retrieved };
}