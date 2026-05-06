// Estimates daily/hourly external-API usage from the analyses count.
// Each analysis fires a known fixed number of calls per service; we multiply
// by today's analysis count and compare against published free-tier limits.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || secret === 'change-me') return false;
  const auth = request.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;
  const cookie = request.cookies.get('admin_token')?.value;
  return cookie === secret;
}

// Per-analysis API call counts — keep in sync with analyze.ts orchestration.
const PER_ANALYSIS = {
  groq:          6, // extract terms + classify + market+competitors + forum mentions + rerank + insight
  gemini:        1, // 1 idea embedding
  hn:            5, // 1 per query keyword (capped at 5)
  reddit:        5,
  github:        5,
  stackexchange: 20, // 5 keywords × 4 sites in parallel
  lobsters:      5,
  devto:         5,
  supabase_writes: 3, // analyze, suggestions, +1 buffer
};

interface ServiceUsage {
  name: string;
  used: number;
  limit: number;
  per: 'day' | 'hour';
  pct: number;
  status: 'ok' | 'warning' | 'critical';
  multiplier: string;
  notes?: string;
}

function statusFor(pct: number): ServiceUsage['status'] {
  if (pct >= 90) return 'critical';
  if (pct >= 70) return 'warning';
  return 'ok';
}

function pct(used: number, limit: number): number {
  return Math.round(Math.min(100, (used / Math.max(1, limit)) * 100));
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Counts: today (since 00:00 local) and last hour
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  let analysesToday = 0;
  let analysesHour = 0;

  try {
    const [{ count: tCount }, { count: hCount }] = await Promise.all([
      supabaseAdmin
        .from('analyses')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', todayStart.toISOString()),
      supabaseAdmin
        .from('analyses')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', oneHourAgo.toISOString()),
    ]);
    analysesToday = tCount ?? 0;
    analysesHour  = hCount ?? 0;
  } catch (err) {
    console.error('quota count failed:', err);
  }

  const groqUsedDay  = analysesToday * PER_ANALYSIS.groq;
  const geminiUsedDay = analysesToday * PER_ANALYSIS.gemini;
  const stackUsedDay = analysesToday * PER_ANALYSIS.stackexchange;
  const ghUsedHour   = analysesHour * PER_ANALYSIS.github;
  const hnUsedDay    = analysesToday * PER_ANALYSIS.hn;
  const redditUsedHour = analysesHour * PER_ANALYSIS.reddit;
  const lobstersUsedDay = analysesToday * PER_ANALYSIS.lobsters;
  const devtoUsedDay = analysesToday * PER_ANALYSIS.devto;

  const services: ServiceUsage[] = [
    {
      name: 'Groq (LLM)',
      used: groqUsedDay,
      limit: 14400,
      per: 'day',
      pct: pct(groqUsedDay, 14400),
      status: statusFor(pct(groqUsedDay, 14400)),
      multiplier: `${PER_ANALYSIS.groq} calls/analysis`,
      notes: 'llama-3.3-70b free tier: 14,400 RPD',
    },
    {
      name: 'Gemini (Embeddings)',
      used: geminiUsedDay,
      limit: 1000,
      per: 'day',
      pct: pct(geminiUsedDay, 1000),
      status: statusFor(pct(geminiUsedDay, 1000)),
      multiplier: `${PER_ANALYSIS.gemini} call/analysis`,
      notes: 'gemini-embedding-001 free tier: 1,000 RPD',
    },
    {
      name: 'StackExchange',
      used: stackUsedDay,
      limit: process.env.STACKEXCHANGE_KEY ? 10000 : 300,
      per: 'day',
      pct: pct(stackUsedDay, process.env.STACKEXCHANGE_KEY ? 10000 : 300),
      status: statusFor(pct(stackUsedDay, process.env.STACKEXCHANGE_KEY ? 10000 : 300)),
      multiplier: `${PER_ANALYSIS.stackexchange} calls/analysis (5 kw × 4 sites)`,
      notes: process.env.STACKEXCHANGE_KEY
        ? '10k/day with key'
        : '300/day per IP — set STACKEXCHANGE_KEY for 10k',
    },
    {
      name: 'GitHub Search',
      used: ghUsedHour,
      limit: process.env.GITHUB_TOKEN ? 5000 : 60,
      per: 'hour',
      pct: pct(ghUsedHour, process.env.GITHUB_TOKEN ? 5000 : 60),
      status: statusFor(pct(ghUsedHour, process.env.GITHUB_TOKEN ? 5000 : 60)),
      multiplier: `${PER_ANALYSIS.github} calls/analysis`,
      notes: process.env.GITHUB_TOKEN
        ? '5,000/hr authenticated'
        : '60/hr unauthenticated — set GITHUB_TOKEN for 5,000/hr',
    },
    {
      name: 'Reddit (public)',
      used: redditUsedHour,
      limit: 600, // approx — public JSON endpoint, no published quota
      per: 'hour',
      pct: pct(redditUsedHour, 600),
      status: statusFor(pct(redditUsedHour, 600)),
      multiplier: `${PER_ANALYSIS.reddit} calls/analysis`,
      notes: 'no published quota — informal ~600/hr per IP',
    },
    {
      name: 'Hacker News (Algolia)',
      used: hnUsedDay,
      limit: 100000,
      per: 'day',
      pct: pct(hnUsedDay, 100000),
      status: statusFor(pct(hnUsedDay, 100000)),
      multiplier: `${PER_ANALYSIS.hn} calls/analysis`,
      notes: 'effectively unlimited',
    },
    {
      name: 'Lobsters',
      used: lobstersUsedDay,
      limit: 5000,
      per: 'day',
      pct: pct(lobstersUsedDay, 5000),
      status: statusFor(pct(lobstersUsedDay, 5000)),
      multiplier: `${PER_ANALYSIS.lobsters} calls/analysis`,
      notes: 'no published quota',
    },
    {
      name: 'Dev.to',
      used: devtoUsedDay,
      limit: 5000,
      per: 'day',
      pct: pct(devtoUsedDay, 5000),
      status: statusFor(pct(devtoUsedDay, 5000)),
      multiplier: `${PER_ANALYSIS.devto} calls/analysis`,
      notes: 'no published quota',
    },
  ];

  // Compute "remaining analyses possible today" — bottleneck on whichever
  // daily-quota service is closest to its cap.
  const dailyBottleneck = services
    .filter((s) => s.per === 'day' && s.limit < 50000)
    .map((s) => ({
      name: s.name,
      remaining: Math.max(0, s.limit - s.used),
      perAnalysis: s.used / Math.max(1, analysesToday),
    }))
    .map((s) => ({
      ...s,
      analysesLeft: s.perAnalysis > 0 ? Math.floor(s.remaining / s.perAnalysis) : Infinity,
    }))
    .sort((a, b) => a.analysesLeft - b.analysesLeft);

  const remainingAnalyses =
    dailyBottleneck.length > 0 && Number.isFinite(dailyBottleneck[0].analysesLeft)
      ? dailyBottleneck[0].analysesLeft
      : null;
  const bottleneckService = remainingAnalyses != null ? dailyBottleneck[0].name : null;

  return NextResponse.json({
    analyses_today: analysesToday,
    analyses_this_hour: analysesHour,
    remaining_analyses: remainingAnalyses,
    bottleneck_service: bottleneckService,
    services,
  });
}
