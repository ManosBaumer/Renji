'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { SiteNav } from '@/components/SiteNav';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DashAnalysis {
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
  saturation: number | null;
  market_type: string | null;
  trend_label: string | null;
  trend_pct: number | null;
  total_posts: number | null;
  num_competitors: number | null;
  insight_verdict: string | null;
  source: string | null;
  created_at: string;
}

interface Props {
  userEmail: string;
  analyses: DashAnalysis[];
}

// User-defined thresholds (per spec: "strong opportunities >65", "flagged saturated").
const STRONG_OPP = 65;
const SATURATED = 65;

// ─── Component ──────────────────────────────────────────────────────────────

export function DashboardClient({ userEmail, analyses }: Props) {
  const stats = useMemo(() => computeStats(analyses), [analyses]);
  const empty = analyses.length === 0;
  const firstName = useMemo(() => {
    const local = (userEmail.split('@')[0] ?? userEmail).trim();
    if (!local) return userEmail;
    return local.charAt(0).toUpperCase() + local.slice(1);
  }, [userEmail]);

  return (
    <>
      <div className="r-page r-page--veil">
        <div className="r-hero-screen r-dash-shell">
          <SiteNav activePage="dashboard" userEmail={userEmail} large />

          <main className="r-dash-main">
            <DashHead empty={empty} stats={stats} firstName={firstName} />

            {empty ? (
              <EmptyPanel />
            ) : (
              <>
                <Scoreboard stats={stats} />
                <Highlights stats={stats} />
                <HistoryBlock analyses={analyses} />
              </>
            )}
          </main>

          <DashFooter />
        </div>
      </div>
    </>
  );
}

// ─── Header ─────────────────────────────────────────────────────────────────

function DashHead({
  empty,
  stats,
  firstName,
}: {
  empty: boolean;
  stats: ComputedStats;
  firstName: string;
}) {
  return (
    <header className="r-dash-head">
      <div className="r-dash-head-l">
        <div className="r-dash-eyebrow">
          <span className="r-dash-dot" />
          Dashboard · {firstName}
        </div>
        <h1 className="r-dash-title">
          {empty ? (
            <>Nothing analyzed yet.</>
          ) : (
            <>
              Your validation log
              <em>
                {' '}— {stats.total} {stats.total === 1 ? 'idea' : 'ideas'}.
              </em>
            </>
          )}
        </h1>
        {!empty && (
          <p className="r-dash-sub">
            {stats.subline}
            {stats.strongCount > 0 && (
              <>
                {' '}
                <strong>{stats.strongCount}</strong>{' '}
                {stats.strongCount === 1 ? 'opportunity' : 'opportunities'} above{' '}
                {STRONG_OPP}.
              </>
            )}
          </p>
        )}
      </div>
      <Link href="/" className="r-dash-cta">
        {empty ? 'Run your first analysis' : 'New analysis'}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </Link>
    </header>
  );
}

// ─── KPI scoreboard — single horizontal strip with thin dividers ───────────

function Scoreboard({ stats }: { stats: ComputedStats }) {
  return (
    <section className="r-dash-board" aria-label="Metrics">
      <BoardCell num={String(stats.total)} label="Total ideas" />
      <BoardCell
        num={stats.avgOpp != null ? String(stats.avgOpp) : '—'}
        unit={stats.avgOpp != null ? '/100' : ''}
        label="Avg opportunity"
      />
      <BoardCell
        num={stats.bestOpp?.opportunity != null ? String(stats.bestOpp.opportunity) : '—'}
        unit={stats.bestOpp?.opportunity != null ? '/100' : ''}
        label="Best opportunity"
        tone={
          stats.bestOpp?.opportunity != null && stats.bestOpp.opportunity >= STRONG_OPP
            ? 'good'
            : 'neutral'
        }
      />
      <BoardCell
        num={String(stats.strongCount)}
        label={`Strong (>${STRONG_OPP})`}
        tone={stats.strongCount > 0 ? 'good' : 'neutral'}
      />
      <BoardCell
        num={String(stats.saturatedCount)}
        label={`Flagged saturated (≥${SATURATED})`}
        tone={stats.saturatedCount > 0 ? 'warn' : 'neutral'}
      />
    </section>
  );
}

function BoardCell({
  num,
  unit,
  label,
  tone = 'neutral',
}: {
  num: string;
  unit?: string;
  label: string;
  tone?: 'good' | 'warn' | 'neutral';
}) {
  return (
    <div className={`r-dash-board-cell r-dash-board-cell--${tone}`}>
      <div className="r-dash-board-num">
        <span className="num">{num}</span>
        {unit && <span className="unit">{unit}</span>}
      </div>
      <div className="r-dash-board-lbl">{label}</div>
    </div>
  );
}

// ─── Highlights — featured "best opportunity" + stacked side facts ──────────

function Highlights({ stats }: { stats: ComputedStats }) {
  return (
    <section className="r-dash-features" aria-label="Highlights">
      <FeaturedBest best={stats.bestOpp} />
      <div className="r-dash-features-side">
        <FactCard
          kicker="Top industry"
          value={stats.topIndustry?.name ? formatTitle(stats.topIndustry.name) : '—'}
          hint={
            stats.topIndustry
              ? `${stats.topIndustry.count} ${stats.topIndustry.count === 1 ? 'idea' : 'ideas'}`
              : 'Run more analyses to see a trend'
          }
        />
        <FactCard
          kicker="Most common market"
          value={stats.topMarket?.name ? formatTitle(stats.topMarket.name) : '—'}
          hint={
            stats.topMarket
              ? `${stats.topMarket.count} ${stats.topMarket.count === 1 ? 'idea' : 'ideas'}`
              : 'Not enough data yet'
          }
        />
      </div>
    </section>
  );
}

function FeaturedBest({ best }: { best: DashAnalysis | null }) {
  if (!best || best.opportunity == null) {
    return (
      <article className="r-dash-feature r-dash-feature--empty">
        <div className="r-dash-feature-kicker">Best opportunity</div>
        <div className="r-dash-feature-num">—</div>
        <div className="r-dash-feature-quote">No scored opportunities yet.</div>
      </article>
    );
  }

  const tone = best.opportunity >= STRONG_OPP ? 'good' : best.opportunity >= 40 ? 'warn' : 'bad';

  return (
    <article className={`r-dash-feature r-dash-feature--${tone}`}>
      <div className="r-dash-feature-kicker">Best opportunity</div>
      <div className="r-dash-feature-num">
        <span>{best.opportunity}</span>
        <span className="unit">/100</span>
      </div>
      <div className="r-dash-feature-quote">
        <span className="mark">“</span>
        {trim(best.idea, 220)}
        <span className="mark">”</span>
      </div>
      <div className="r-dash-feature-meta">
        {best.industry && <span>{formatTitle(best.industry)}</span>}
        {best.market_type && <span>{formatTitle(best.market_type)}</span>}
        <span>{formatDate(best.created_at)}</span>
      </div>
    </article>
  );
}

function FactCard({
  kicker,
  value,
  hint,
}: {
  kicker: string;
  value: string;
  hint: string;
}) {
  return (
    <article className="r-dash-fact">
      <div className="r-dash-fact-kicker">{kicker}</div>
      <div className="r-dash-fact-value">{value}</div>
      <div className="r-dash-fact-hint">{hint}</div>
    </article>
  );
}

// ─── Query history ──────────────────────────────────────────────────────────

function HistoryBlock({ analyses }: { analyses: DashAnalysis[] }) {
  return (
    <section className="r-dash-history" aria-label="Query history">
      <div className="r-dash-history-head">
        <div>
          <div className="r-dash-section-eyebrow">Query history</div>
          <h2 className="r-dash-section-h">Everything you&apos;ve analyzed</h2>
        </div>
        <span className="r-dash-history-count">
          {analyses.length} {analyses.length === 1 ? 'analysis' : 'analyses'}
        </span>
      </div>

      <ol className="r-history-list">
        {analyses.map((a) => (
          <HistoryRow key={a.id} a={a} />
        ))}
      </ol>
    </section>
  );
}

function HistoryRow({ a }: { a: DashAnalysis }) {
  const opp = a.opportunity ?? null;
  const oppTone = opp == null ? 'neutral' : opp >= STRONG_OPP ? 'good' : opp >= 40 ? 'warn' : 'bad';
  const isSaturated = a.saturation != null && a.saturation >= SATURATED;

  return (
    <li className="r-history-row">
      <div className="r-history-row-main">
        <p className="r-history-idea">{a.idea}</p>
        <div className="r-history-meta">
          {a.industry && <span>{formatTitle(a.industry)}</span>}
          {a.market_type && <span>{formatTitle(a.market_type)}</span>}
          {a.audience && <span>{a.audience}</span>}
          <span className="r-history-date">{formatDate(a.created_at)}</span>
          {isSaturated && <span className="r-history-flag">saturated</span>}
        </div>
      </div>

      <div className="r-history-scores">
        <Score label="D" value={a.demand} />
        <Score label="C" value={a.competition} />
        <Score label="OPP" value={opp} tone={oppTone} big />
      </div>
    </li>
  );
}

function Score({
  label,
  value,
  tone = 'neutral',
  big = false,
}: {
  label: string;
  value: number | null;
  tone?: 'good' | 'warn' | 'bad' | 'neutral';
  big?: boolean;
}) {
  return (
    <div className={`r-score r-score--${tone}${big ? ' r-score--big' : ''}`}>
      <div className="r-score-num">{value ?? '—'}</div>
      <div className="r-score-lbl">{label}</div>
    </div>
  );
}

// ─── Empty panel ────────────────────────────────────────────────────────────

function EmptyPanel() {
  return (
    <div className="r-dash-empty">
      <div className="r-dash-empty-eyebrow">No analyses yet</div>
      <p className="r-dash-empty-line">
        Once you validate your first idea, every signal — demand, competition, opportunity, market saturation — will land here, ranked, searchable, and yours forever.
      </p>
    </div>
  );
}

// ─── Slim footer ────────────────────────────────────────────────────────────

function DashFooter() {
  return (
    <footer className="r-dash-footer">
      <div className="r-dash-footer-inner">
        <span>Renji · validate before you build</span>
        <span className="r-status">
          <i className="r-status-dot" /> All systems operational
        </span>
      </div>
    </footer>
  );
}

// ─── Stats helpers ──────────────────────────────────────────────────────────

interface ComputedStats {
  total: number;
  avgOpp: number | null;
  bestOpp: DashAnalysis | null;
  strongCount: number;
  saturatedCount: number;
  topIndustry: { name: string; count: number } | null;
  topMarket: { name: string; count: number } | null;
  subline: string;
}

function computeStats(items: DashAnalysis[]): ComputedStats {
  const total = items.length;

  const opps = items.map((a) => a.opportunity).filter((v): v is number => typeof v === 'number');
  const avgOpp = opps.length > 0 ? Math.round(opps.reduce((s, v) => s + v, 0) / opps.length) : null;

  const bestOpp = items.reduce<DashAnalysis | null>((best, cur) => {
    if (cur.opportunity == null) return best;
    if (best == null || (best.opportunity ?? -Infinity) < cur.opportunity) return cur;
    return best;
  }, null);

  const strongCount = items.filter((a) => (a.opportunity ?? -1) > STRONG_OPP).length;
  const saturatedCount = items.filter((a) => (a.saturation ?? -1) >= SATURATED).length;

  const topIndustry = mode(items.map((a) => a.industry).filter((v): v is string => Boolean(v)));
  const topMarket = mode(items.map((a) => a.market_type).filter((v): v is string => Boolean(v)));

  const industryCount = new Set(items.map((a) => a.industry).filter(Boolean)).size;
  const subline =
    industryCount > 0
      ? `Across ${industryCount} ${industryCount === 1 ? 'industry' : 'industries'}.`
      : 'Across your saved analyses.';

  return {
    total,
    avgOpp,
    bestOpp,
    strongCount,
    saturatedCount,
    topIndustry,
    topMarket,
    subline,
  };
}

function mode(values: string[]): { name: string; count: number } | null {
  if (values.length === 0) return null;
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: { name: string; count: number } | null = null;
  for (const [name, count] of counts) {
    if (!best || count > best.count) best = { name, count };
  }
  return best;
}

function formatTitle(s: string): string {
  return s
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function trim(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + '…';
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = diffMs / 36e5;
  if (diffH < 1) return 'just now';
  if (diffH < 24) return `${Math.round(diffH)}h ago`;
  const diffD = diffH / 24;
  if (diffD < 7) return `${Math.round(diffD)}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
