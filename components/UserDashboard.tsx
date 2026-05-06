'use client';

import { useState, useMemo, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Analysis {
  id: string;
  idea: string;
  audience: string | null;
  problem: string | null;
  solution: string | null;
  industry: string | null;
  keywords: string[] | null;
  demand: number | null;
  competition: number | null;
  opportunity: number | null;
  trend_label: string | null;
  trend_pct: number | null;
  total_posts: number | null;
  num_competitors: number | null;
  insight_verdict: string | null;
  source: string | null;
  saturation: number | null;
  commoditization: number | null;
  buyer_urgency: number | null;
  distribution_difficulty: number | null;
  market_type: string | null;
  market_reasoning: string | null;
  created_at: string;
}

interface Props {
  userEmail: string;
  memberSince: string;
  analyses: Analysis[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export function UserDashboard({ userEmail, memberSince, analyses: initialAnalyses }: Props) {
  const router = useRouter();
  const [analyses, setAnalyses] = useState(initialAnalyses);
  const [search, setSearch] = useState('');
  const [marketFilter, setMarketFilter] = useState<string>('all');
  const [menuOpen, setMenuOpen] = useState(false);
  const [, startTransition] = useTransition();

  // ── Stats ────────────────────────────────────────────────────────────────────
  const stats = useMemo(() => computeStats(analyses), [analyses]);

  // ── Filters ──────────────────────────────────────────────────────────────────
  const visible = useMemo(() => {
    const s = search.trim().toLowerCase();
    return analyses.filter((a) => {
      if (marketFilter !== 'all' && a.market_type !== marketFilter) return false;
      if (!s) return true;
      const blob = [a.idea, a.audience, a.industry, a.problem, a.solution, ...(a.keywords ?? [])]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return blob.includes(s);
    });
  }, [analyses, search, marketFilter]);

  const marketTypes = useMemo(() => {
    const set = new Set<string>();
    for (const a of analyses) {
      if (a.market_type) set.add(a.market_type);
    }
    return [...set].sort();
  }, [analyses]);

  // ── Actions ──────────────────────────────────────────────────────────────────
  const handleSignout = async () => {
    await fetch('/api/auth/signout', { method: 'POST' });
    router.push('/auth/login');
    router.refresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this analysis? This cannot be undone.')) return;
    const res = await fetch(`/api/user/analysis/${id}`, { method: 'DELETE' });
    if (res.ok) {
      startTransition(() => {
        setAnalyses((prev) => prev.filter((a) => a.id !== id));
      });
    } else {
      alert('Failed to delete. Try again.');
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-xl font-bold tracking-tight text-zinc-900 hover:opacity-70 transition-opacity">
              renji<span className="text-indigo-600">.</span>pro
            </Link>
            <nav className="hidden sm:flex items-center gap-1 text-sm">
              <Link href="/" className="rounded-lg px-3 py-1.5 text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-colors">
                Analyze
              </Link>
              <span className="rounded-lg px-3 py-1.5 font-semibold text-zinc-900 bg-zinc-100">
                Dashboard
              </span>
            </nav>
          </div>

          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs hover:bg-zinc-50 transition-colors"
            >
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700 uppercase">
                {userEmail.charAt(0)}
              </span>
              <span className="text-zinc-700 max-w-[180px] truncate">{userEmail}</span>
              <span className="text-zinc-400">▾</span>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-zinc-200 bg-white shadow-lg overflow-hidden z-10">
                <Link href="/" className="block px-4 py-2 text-xs text-zinc-700 hover:bg-zinc-50">
                  New analysis →
                </Link>
                <button
                  onClick={handleSignout}
                  className="block w-full px-4 py-2 text-left text-xs text-zinc-700 hover:bg-zinc-50 border-t border-zinc-100"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 space-y-8">
        {/* Welcome / hero */}
        <section className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">
              Welcome back, <span className="text-indigo-600">{userEmail.split('@')[0]}</span>
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Member since {new Date(memberSince).toLocaleDateString(undefined, {
                year: 'numeric', month: 'long', day: 'numeric',
              })}
            </p>
          </div>
          <Link
            href="/"
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors shadow-sm"
          >
            + New Analysis
          </Link>
        </section>

        {/* Stat cards */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Analyses"
            value={stats.total}
            hint={stats.thisMonth > 0 ? `${stats.thisMonth} this month` : 'all-time'}
          />
          <StatCard
            label="Avg Opportunity"
            value={stats.avgOpp}
            valueSuffix="/100"
            color={stats.avgOpp >= 60 ? 'emerald' : stats.avgOpp >= 40 ? 'amber' : 'red'}
          />
          <StatCard
            label="Best Opportunity"
            value={stats.bestOpp ?? '—'}
            valueSuffix={stats.bestOpp ? '/100' : ''}
            hint={stats.bestIdea ? truncate(stats.bestIdea, 28) : undefined}
            color="emerald"
          />
          <StatCard
            label="Top Industry"
            value={stats.topIndustry ?? '—'}
            valueAsString
            hint={stats.topIndustryCount ? `${stats.topIndustryCount} queries` : undefined}
          />
        </section>

        {/* Insights row */}
        {analyses.length > 0 && (
          <section className="grid gap-4 sm:grid-cols-3">
            <InsightTile
              label="Most common market type"
              value={stats.topMarketType ?? '—'}
              icon="📊"
            />
            <InsightTile
              label="Saturated ideas explored"
              value={`${stats.saturatedCount}`}
              icon="⚠"
              hint={`${Math.round((stats.saturatedCount / Math.max(1, stats.total)) * 100)}% of total`}
            />
            <InsightTile
              label="Strong opportunities found"
              value={`${stats.strongOpportunityCount}`}
              icon="🎯"
              hint="opportunity ≥ 65"
            />
          </section>
        )}

        {/* Query history */}
        <section>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h2 className="text-lg font-semibold text-zinc-900">
              Query History
              <span className="ml-2 text-sm font-normal text-zinc-400">
                ({visible.length}{visible.length !== analyses.length ? ` of ${analyses.length}` : ''})
              </span>
            </h2>

            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search ideas, keywords…"
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-700 placeholder:text-zinc-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 w-48"
              />
              {marketTypes.length > 0 && (
                <select
                  value={marketFilter}
                  onChange={(e) => setMarketFilter(e.target.value)}
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 capitalize"
                >
                  <option value="all">All markets</option>
                  {marketTypes.map((m) => (
                    <option key={m} value={m} className="capitalize">{m}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {analyses.length === 0 ? (
            <EmptyState />
          ) : visible.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center">
              <p className="text-sm text-zinc-400">No analyses match your filters.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {visible.map((a) => (
                <AnalysisRow key={a.id} analysis={a} onDelete={() => handleDelete(a.id)} />
              ))}
            </div>
          )}
        </section>

        {/* Account section */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900 mb-4">Account</h2>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-zinc-400 uppercase tracking-wider">Email</dt>
              <dd className="mt-1 text-sm text-zinc-800">{userEmail}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-400 uppercase tracking-wider">Member since</dt>
              <dd className="mt-1 text-sm text-zinc-800">
                {new Date(memberSince).toLocaleDateString()}
              </dd>
            </div>
          </dl>
          <button
            onClick={handleSignout}
            className="mt-6 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
          >
            Sign out
          </button>
        </section>
      </main>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  valueSuffix,
  hint,
  color,
  valueAsString,
}: {
  label: string;
  value: number | string;
  valueSuffix?: string;
  hint?: string;
  color?: 'emerald' | 'amber' | 'red';
  valueAsString?: boolean;
}) {
  const colorMap = {
    emerald: 'text-emerald-600',
    amber: 'text-amber-600',
    red: 'text-red-500',
  };
  const valueColor = color ? colorMap[color] : 'text-zinc-900';
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-xs text-zinc-400 uppercase tracking-wider mb-2">{label}</p>
      <div className="flex items-baseline gap-1">
        <span className={`${valueAsString ? 'text-xl capitalize' : 'text-3xl'} font-bold tabular-nums ${valueColor}`}>
          {value}
        </span>
        {valueSuffix && <span className="text-sm text-zinc-400">{valueSuffix}</span>}
      </div>
      {hint && <p className="mt-1 text-xs text-zinc-500 truncate">{hint}</p>}
    </div>
  );
}

function InsightTile({
  label,
  value,
  icon,
  hint,
}: {
  label: string;
  value: string;
  icon: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-100 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-base">{icon}</span>
        <span className="text-xs text-zinc-500">{label}</span>
      </div>
      <div className="text-sm font-semibold text-zinc-900 capitalize">{value}</div>
      {hint && <div className="text-xs text-zinc-400 mt-0.5">{hint}</div>}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center">
      <p className="text-sm font-medium text-zinc-700">No analyses yet</p>
      <p className="mt-1 text-xs text-zinc-400">Run your first idea validation to see it here.</p>
      <Link
        href="/"
        className="mt-4 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors"
      >
        + New Analysis
      </Link>
    </div>
  );
}

function AnalysisRow({ analysis: a, onDelete }: { analysis: Analysis; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);

  const opp = a.opportunity ?? 0;
  const oppColor =
    opp >= 65 ? 'text-emerald-600' :
    opp >= 40 ? 'text-amber-600' :
                'text-red-500';
  const trendLabel = a.trend_label?.replace(/_/g, ' ') ?? '—';

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
      <button onClick={() => setExpanded((v) => !v)} className="w-full px-5 py-4 text-left">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-900 line-clamp-1">{a.idea}</p>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-zinc-400">
              {a.market_type && (
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 capitalize text-zinc-600">
                  {a.market_type}
                </span>
              )}
              {a.audience && <span>👥 {a.audience}</span>}
              {a.industry && <span>🏭 {a.industry}</span>}
              <span>{relativeDate(a.created_at)}</span>
            </div>
          </div>
          <div className="flex items-center gap-4 flex-shrink-0">
            <ScorePill label="D" value={a.demand} color="text-indigo-600" />
            <ScorePill label="C" value={a.competition} color="text-rose-500" />
            <div className={`text-center ${oppColor}`}>
              <div className="text-lg font-bold tabular-nums">{a.opportunity ?? '—'}</div>
              <div className="text-xs">opp</div>
            </div>
            <span className="text-zinc-300 ml-1">{expanded ? '▲' : '▼'}</span>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-zinc-100 px-5 py-4 space-y-3 bg-zinc-50/60">
          <div className="grid gap-3 sm:grid-cols-2">
            {a.problem && <Field label="Problem" value={a.problem} />}
            {a.solution && <Field label="Solution" value={a.solution} />}
            {a.keywords && a.keywords.length > 0 && (
              <Field label="Keywords" value={a.keywords.join(', ')} />
            )}
            <Field label="Trend" value={`${trendLabel}${a.trend_pct != null ? ` (${a.trend_pct > 0 ? '+' : ''}${a.trend_pct}%)` : ''}`} />
            <Field label="Posts analyzed" value={String(a.total_posts ?? '—')} />
            <Field label="Competitors" value={String(a.num_competitors ?? '—')} />
            {a.saturation != null && <Field label="Saturation" value={`${a.saturation}/100`} />}
            {a.buyer_urgency != null && <Field label="Buyer urgency" value={`${a.buyer_urgency}/100`} />}
          </div>
          {a.insight_verdict && (
            <div className="rounded-xl bg-white border border-zinc-100 px-4 py-3">
              <p className="text-xs font-medium text-zinc-400 mb-1 uppercase tracking-wider">AI Verdict</p>
              <p className="text-sm text-zinc-700 leading-relaxed">{a.insight_verdict}</p>
            </div>
          )}
          {a.market_reasoning && (
            <div className="rounded-xl bg-white border border-zinc-100 px-4 py-3">
              <p className="text-xs font-medium text-zinc-400 mb-1 uppercase tracking-wider">Market reasoning</p>
              <p className="text-sm text-zinc-700 leading-relaxed">{a.market_reasoning}</p>
            </div>
          )}
          <div className="flex justify-end">
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors"
            >
              Delete this analysis
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ScorePill({ label, value, color }: { label: string; value: number | null; color: string }) {
  return (
    <div className={`text-center ${color}`}>
      <div className="text-base font-bold tabular-nums">{value ?? '—'}</div>
      <div className="text-xs text-zinc-400">{label}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-zinc-400 mb-0.5 font-medium uppercase tracking-wider">{label}</p>
      <p className="text-sm text-zinc-800 capitalize">{value}</p>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function relativeDate(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} day${day === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString();
}

interface Stats {
  total: number;
  avgOpp: number;
  bestOpp: number | null;
  bestIdea: string | null;
  thisMonth: number;
  topIndustry: string | null;
  topIndustryCount: number;
  topMarketType: string | null;
  saturatedCount: number;
  strongOpportunityCount: number;
}

function computeStats(analyses: Analysis[]): Stats {
  const total = analyses.length;
  if (total === 0) {
    return {
      total: 0, avgOpp: 0, bestOpp: null, bestIdea: null, thisMonth: 0,
      topIndustry: null, topIndustryCount: 0, topMarketType: null,
      saturatedCount: 0, strongOpportunityCount: 0,
    };
  }

  const oppValues = analyses.map((a) => a.opportunity ?? 0);
  const avgOpp = Math.round(oppValues.reduce((s, n) => s + n, 0) / total);

  const best = analyses.reduce<Analysis | null>(
    (m, a) => ((a.opportunity ?? 0) > (m?.opportunity ?? -1) ? a : m),
    null,
  );

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const thisMonth = analyses.filter(
    (a) => new Date(a.created_at) >= monthStart,
  ).length;

  const industries = countBy(analyses, (a) => a.industry);
  const topIndustryEntry = topEntry(industries);

  const marketTypes = countBy(analyses, (a) => a.market_type);
  const topMarketEntry = topEntry(marketTypes);

  const saturatedCount = analyses.filter(
    (a) => a.market_type === 'saturated' || a.market_type === 'commodity',
  ).length;

  const strongOpportunityCount = analyses.filter(
    (a) => (a.opportunity ?? 0) >= 65,
  ).length;

  return {
    total,
    avgOpp,
    bestOpp: best?.opportunity ?? null,
    bestIdea: best?.idea ?? null,
    thisMonth,
    topIndustry: topIndustryEntry?.[0] ?? null,
    topIndustryCount: topIndustryEntry?.[1] ?? 0,
    topMarketType: topMarketEntry?.[0] ?? null,
    saturatedCount,
    strongOpportunityCount,
  };
}

function countBy<T>(arr: T[], key: (x: T) => string | null): Map<string, number> {
  const m = new Map<string, number>();
  for (const x of arr) {
    const k = key(x);
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

function topEntry(m: Map<string, number>): [string, number] | null {
  let best: [string, number] | null = null;
  for (const entry of m.entries()) {
    if (!best || entry[1] > best[1]) best = entry;
  }
  return best;
}
