'use client';

import { useState, useMemo, useTransition, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

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
  const menuRef = useRef<HTMLDivElement>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const stats = useMemo(() => computeStats(analyses), [analyses]);

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
    for (const a of analyses) if (a.market_type) set.add(a.market_type);
    return [...set].sort();
  }, [analyses]);

  const handleSignout = async () => {
    await fetch('/api/auth/signout', { method: 'POST' });
    router.push('/auth/login');
    router.refresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this analysis? This cannot be undone.')) return;
    const res = await fetch(`/api/user/analysis/${id}`, { method: 'DELETE' });
    if (res.ok) {
      startTransition(() => setAnalyses((prev) => prev.filter((a) => a.id !== id)));
    } else {
      alert('Failed to delete. Try again.');
    }
  };

  const userHandle = userEmail.split('@')[0];
  const memberSinceLabel = new Date(memberSince).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <>
      <div className="bg-orb-dashboard" aria-hidden="true" />
      <div className="grain-quiet" aria-hidden="true" />

      <div className="r-page">
        <header className="r-nav">
          <Link href="/" className="r-brand r-brand--md" aria-label="Renji home">
            <Image src="/typeface-logo.png" alt="Renji" width={152} height={38} priority />
          </Link>

          <nav className="r-nav-pill" aria-label="Primary">
            <Link href="/">Analyze</Link>
            <Link href="/dashboard" className="active">Dashboard</Link>
          </nav>

          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              type="button"
              className="r-user-pill"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <span className="r-avatar">{userEmail.charAt(0)}</span>
              <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {userEmail}
              </span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {menuOpen && (
              <div className="r-user-menu" role="menu">
                <Link href="/" role="menuitem" onClick={() => setMenuOpen(false)}>
                  New analysis →
                </Link>
                <div className="r-divider" />
                <button type="button" role="menuitem" onClick={handleSignout}>
                  Sign out
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="r-dash-main">
          {/* Welcome header */}
          <section className="r-dash-head">
            <div>
              <h1>
                Welcome back, <span style={{ color: 'var(--accent-2)' }}>{userHandle}</span>.
              </h1>
              <div className="r-meta">Member since · {memberSinceLabel}</div>
            </div>
            <Link href="/" className="r-new-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              New analysis
            </Link>
          </section>

          {/* Top stats */}
          <section className="r-stats">
            <StatCard
              label="Total analyses"
              value={stats.total}
              unit="runs"
              hint={stats.thisMonth > 0 ? `${stats.thisMonth} this month` : 'all-time'}
            />
            <StatCard
              label="Avg opportunity"
              value={stats.avgOpp}
              unit="/100"
              hint="across saved ideas"
              tone={stats.avgOpp >= 60 ? 'good' : stats.avgOpp >= 40 ? 'warn' : 'bad'}
            />
            <StatCard
              label="Best opportunity"
              value={stats.bestOpp ?? '—'}
              unit={stats.bestOpp ? '/100' : ''}
              hint={stats.bestIdea ? truncate(stats.bestIdea, 32) : undefined}
              tone="good"
            />
            <StatCard
              label="Top industry"
              value={stats.topIndustry ?? '—'}
              hint={stats.topIndustryCount ? `${stats.topIndustryCount} queries` : undefined}
              text
            />
          </section>

          {/* Insights row */}
          {analyses.length > 0 && (
            <section className="r-stats r-stats--three">
              <StatCard
                label="Most common market"
                value={stats.topMarketType ?? '—'}
                hint={
                  stats.topMarketTypeCount
                    ? `${stats.topMarketTypeCount} of ${stats.total} ideas`
                    : undefined
                }
                text
              />
              <StatCard
                label="Saturated ideas"
                value={stats.saturatedCount}
                unit="flagged"
                hint={`${Math.round((stats.saturatedCount / Math.max(1, stats.total)) * 100)}% of all explored`}
              />
              <StatCard
                label="Strong opportunities"
                value={stats.strongOpportunityCount}
                unit="≥ 65"
                hint="worth pursuing"
                tone="good"
              />
            </section>
          )}

          {/* Query history header */}
          <div className="r-sec-head">
            <h2>
              Query history
              <span className="r-count">{visible.length} {visible.length === 1 ? 'SAVED' : 'SAVED'}</span>
            </h2>
            <div className="r-filters">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search ideas, keywords…"
              />
              {marketTypes.length > 0 && (
                <select
                  value={marketFilter}
                  onChange={(e) => setMarketFilter(e.target.value)}
                  style={{ textTransform: 'capitalize' }}
                >
                  <option value="all">All markets</option>
                  {marketTypes.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* List */}
          {analyses.length === 0 ? (
            <EmptyState />
          ) : visible.length === 0 ? (
            <div className="r-empty">
              <p className="r-empty-h">No matches</p>
              <p className="r-empty-sub">Try clearing your filters or search query.</p>
            </div>
          ) : (
            <div className="r-list">
              {visible.map((a) => (
                <AnalysisRow key={a.id} analysis={a} onDelete={() => handleDelete(a.id)} />
              ))}
            </div>
          )}

          {/* Account */}
          <section className="r-account">
            <div className="r-acc-field">
              <div className="r-k">Email</div>
              <div className="r-v">{userEmail}</div>
            </div>
            <div className="r-acc-field">
              <div className="r-k">Member since</div>
              <div className="r-v">{memberSinceLabel}</div>
            </div>
            <button type="button" className="r-signout" onClick={handleSignout}>
              Sign out
            </button>
          </section>
        </main>
      </div>
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  unit,
  hint,
  tone,
  text,
}: {
  label: string;
  value: number | string;
  unit?: string;
  hint?: string;
  tone?: 'good' | 'warn' | 'bad';
  text?: boolean;
}) {
  const cls = ['r-stat'];
  if (tone) cls.push(`r-stat--${tone}`);
  if (text) cls.push('r-stat--text');
  return (
    <div className={cls.join(' ')}>
      <div className="r-lbl">{label}</div>
      <div className="r-val">
        {value}
        {unit && <span className="r-unit">{unit}</span>}
      </div>
      {hint && <div className="r-hint">{hint}</div>}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="r-empty">
      <p className="r-empty-h">No analyses yet</p>
      <p className="r-empty-sub">Run your first idea validation to see it here.</p>
      <div style={{ marginTop: 18 }}>
        <Link href="/" className="r-new-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New analysis
        </Link>
      </div>
    </div>
  );
}

function AnalysisRow({ analysis: a, onDelete }: { analysis: Analysis; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);

  const opp = a.opportunity ?? 0;
  const oppTone = opp >= 65 ? 'r-good' : opp >= 40 ? 'r-warn' : 'r-bad';
  const trendLabel = a.trend_label?.replace(/_/g, ' ') ?? '—';

  return (
    <article className="r-row" style={{ display: 'block' }}>
      <button
        type="button"
        className="r-row-toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 24, alignItems: 'center' }}>
          <div style={{ minWidth: 0 }}>
            <div className="r-idea">{a.idea}</div>
            <div className="r-row-meta">
              {a.market_type && <span className="r-tag r-tag--market">{a.market_type}</span>}
              {a.audience && <span>👥 {a.audience}</span>}
              {a.industry && <span>🏭 {a.industry}</span>}
              <span>{relativeDate(a.created_at)}</span>
            </div>
          </div>
          <div className="r-scores">
            <div className="r-score r-score--demand">
              <div className="r-num">{a.demand ?? '—'}</div>
              <div className="r-lbl">Demand</div>
            </div>
            <div className="r-score r-score--comp">
              <div className="r-num">{a.competition ?? '—'}</div>
              <div className="r-lbl">Comp</div>
            </div>
            <div className="r-score-divider" />
            <div className={`r-score r-score--opp ${oppTone}`}>
              <div className="r-num">{a.opportunity ?? '—'}</div>
              <div className="r-lbl">Opportunity</div>
            </div>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="r-row-detail">
          <div className="r-grid2">
            {a.problem && <DetailField label="Problem" value={a.problem} />}
            {a.solution && <DetailField label="Solution" value={a.solution} />}
            {a.keywords && a.keywords.length > 0 && (
              <DetailField label="Keywords" value={a.keywords.join(', ')} />
            )}
            <DetailField
              label="Trend"
              value={`${trendLabel}${
                a.trend_pct != null ? ` (${a.trend_pct > 0 ? '+' : ''}${a.trend_pct}%)` : ''
              }`}
            />
            <DetailField label="Posts analyzed" value={String(a.total_posts ?? '—')} />
            <DetailField label="Competitors" value={String(a.num_competitors ?? '—')} />
            {a.saturation != null && <DetailField label="Saturation" value={`${a.saturation}/100`} />}
            {a.buyer_urgency != null && (
              <DetailField label="Buyer urgency" value={`${a.buyer_urgency}/100`} />
            )}
          </div>
          {a.insight_verdict && (
            <div className="r-detail-card">
              <div className="r-k">AI verdict</div>
              <p className="r-v" style={{ margin: 0 }}>
                {a.insight_verdict}
              </p>
            </div>
          )}
          {a.market_reasoning && (
            <div className="r-detail-card">
              <div className="r-k">Market reasoning</div>
              <p className="r-v" style={{ margin: 0 }}>
                {a.market_reasoning}
              </p>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="r-delete-btn"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              Delete this analysis
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="r-detail-field">
      <div className="r-k">{label}</div>
      <div className="r-v">{value}</div>
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
  topMarketTypeCount: number;
  saturatedCount: number;
  strongOpportunityCount: number;
}

function computeStats(analyses: Analysis[]): Stats {
  const total = analyses.length;
  if (total === 0) {
    return {
      total: 0,
      avgOpp: 0,
      bestOpp: null,
      bestIdea: null,
      thisMonth: 0,
      topIndustry: null,
      topIndustryCount: 0,
      topMarketType: null,
      topMarketTypeCount: 0,
      saturatedCount: 0,
      strongOpportunityCount: 0,
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
  const thisMonth = analyses.filter((a) => new Date(a.created_at) >= monthStart).length;

  const industries = countBy(analyses, (a) => a.industry);
  const topIndustryEntry = topEntry(industries);

  const marketTypes = countBy(analyses, (a) => a.market_type);
  const topMarketEntry = topEntry(marketTypes);

  const saturatedCount = analyses.filter(
    (a) => a.market_type === 'saturated' || a.market_type === 'commodity',
  ).length;

  const strongOpportunityCount = analyses.filter((a) => (a.opportunity ?? 0) >= 65).length;

  return {
    total,
    avgOpp,
    bestOpp: best?.opportunity ?? null,
    bestIdea: best?.idea ?? null,
    thisMonth,
    topIndustry: topIndustryEntry?.[0] ?? null,
    topIndustryCount: topIndustryEntry?.[1] ?? 0,
    topMarketType: topMarketEntry?.[0] ?? null,
    topMarketTypeCount: topMarketEntry?.[1] ?? 0,
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
