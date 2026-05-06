'use client';

import { useState } from 'react';
import type { AnalysisResult } from '@/lib/analyze';
import type { Classification } from '@/lib/classify';
import { ScoreBar } from './ScoreBar';
import { TrendBadge } from './TrendBadge';
import { ClassificationEditor } from './ClassificationEditor';
import { InsightPanel } from './InsightPanel';
import { MarketRealityPanel } from './MarketRealityPanel';

interface ResultsViewProps {
  idea: string;
  result: AnalysisResult;
  onReanalyze: (classification: Classification) => void;
  onReset: () => void;
  reanalyzing: boolean;
  reanalyzeError: string;
}

export function ResultsView({
  idea,
  result,
  onReanalyze,
  onReset,
  reanalyzing,
  reanalyzeError,
}: ResultsViewProps) {
  const { classification, flags, metrics, competitors, top_posts, insight, market } = result;
  const [editingClassification, setEditingClassification] = useState(false);

  const opportunityColor =
    metrics.opportunity >= 65
      ? 'text-emerald-600'
      : metrics.opportunity >= 40
      ? 'text-amber-600'
      : 'text-red-500';

  const opportunityLabel =
    metrics.opportunity >= 65 ? 'Strong Opportunity' : metrics.opportunity >= 40 ? 'Moderate Opportunity' : 'Crowded / Weak Signal';

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 space-y-6">
      {/* Top bar */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs text-zinc-400 mb-1 uppercase tracking-wider">Idea analyzed</p>
          <p className="text-sm text-zinc-700 max-w-xl font-medium">&ldquo;{idea}&rdquo;</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => setEditingClassification((v) => !v)}
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
          >
            {editingClassification ? 'Close Editor' : 'Edit Classification'}
          </button>
          <button
            onClick={onReset}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors"
          >
            New Idea
          </button>
        </div>
      </div>

      {/* Classification editor (collapsible) */}
      {editingClassification && (
        <ClassificationEditor
          classification={classification}
          flags={flags}
          userProvided={result.user_provided}
          onReanalyze={(c) => {
            setEditingClassification(false);
            onReanalyze(c);
          }}
          reanalyzing={reanalyzing}
          error={reanalyzeError}
        />
      )}

      {reanalyzing && (
        <div className="flex items-center gap-3 rounded-xl bg-indigo-50 border border-indigo-100 px-5 py-4 text-sm text-indigo-700">
          <svg className="h-4 w-4 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Re-analyzing with updated classification…
        </div>
      )}

      {/* Opportunity hero */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs text-zinc-400 uppercase tracking-wider mb-1">Overall Opportunity Score</p>
            <div className="flex items-baseline gap-3">
              <span className={`text-5xl font-bold tabular-nums ${opportunityColor}`}>
                {metrics.opportunity}
              </span>
              <span className="text-zinc-400 text-sm">/ 100</span>
            </div>
            <p className={`mt-1 text-sm font-semibold ${opportunityColor}`}>{opportunityLabel}</p>
          </div>
          <div className="flex gap-6">
            <ScoreCircle label="Demand" value={metrics.demand} color="indigo" />
            <ScoreCircle label="Competition" value={metrics.competition} color="rose" />
          </div>
        </div>

        {/* Trend + source breakdown */}
        <div className="mt-5 flex items-center gap-4 flex-wrap border-t border-zinc-100 pt-4">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span>Trend:</span>
            <TrendBadge trend={metrics.trend} />
          </div>
          <div className="text-xs text-zinc-400">
            {metrics.total_posts} posts · {metrics.keywords_analyzed.length} keywords
          </div>
        </div>

        {/* Source breakdown bar */}
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(metrics.source_counts)
            .filter(([, n]) => n > 0)
            .sort(([, a], [, b]) => b - a)
            .map(([src, count]) => (
              <span
                key={src}
                className="inline-flex items-center gap-1.5 rounded-full bg-zinc-50 border border-zinc-200 px-2.5 py-0.5 text-xs text-zinc-600"
              >
                <span className="capitalize font-medium text-zinc-700">{src}</span>
                <span className="text-zinc-400">{count}</span>
              </span>
            ))}
        </div>
      </div>

      {/* Score bars */}
      <div className="grid gap-4 sm:grid-cols-3">
        <ScoreCard
          title="Topic Activity"
          value={metrics.demand}
          color="indigo"
          description="Discussion volume + engagement across forums. High here doesn't mean opportunity — see Buyer Urgency below."
        />
        <ScoreCard
          title="Competition"
          value={metrics.competition}
          color="rose"
          description={`${competitors.length} products identified, blended with the LLM's saturation knowledge.`}
        />
        <ScoreCard
          title="Opportunity"
          value={metrics.opportunity}
          color="emerald"
          description="Geometric blend of supply quality (low saturation) and demand quality (urgency × reachability)."
        />
      </div>

      {/* Market reality check — explains the WHY behind the opportunity score */}
      <MarketRealityPanel market={market} />

      {/* Insight */}
      {insight && <InsightPanel insight={insight} />}

      {/* Similar Products / Competitors — full width because this is the most useful section */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-zinc-900">
            Similar Products & Competitors
            <span className="ml-2 text-xs font-normal text-zinc-400">({competitors.length})</span>
          </h2>
          <div className="flex flex-wrap gap-1.5 text-xs">
            <SourceLegend label="GitHub" color="bg-zinc-700" />
            <SourceLegend label="LLM-known" color="bg-violet-500" />
            <SourceLegend label="Forum" color="bg-emerald-500" />
          </div>
        </div>

        {competitors.length === 0 ? (
          <p className="text-sm text-zinc-400 italic">No specific products detected. Try refining the classification fields.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {competitors.slice(0, 16).map((c) => (
              <CompetitorCard key={`${c.source}-${c.name}`} competitor={c} />
            ))}
          </div>
        )}
      </div>

      {/* Top discussions */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900 mb-4">
          Top Discussions
          <span className="ml-2 text-xs font-normal text-zinc-400">(by engagement, all sources)</span>
        </h2>
        {top_posts.length === 0 ? (
          <p className="text-sm text-zinc-400 italic">No posts found for these keywords.</p>
        ) : (
          <ol className="space-y-3">
            {top_posts.slice(0, 8).map((p) => (
              <li key={p.permalink}>
                <a
                  href={p.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block"
                >
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 inline-flex flex-shrink-0 rounded-md bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-600 capitalize">
                      {p.source}
                    </span>
                    <p className="flex-1 text-sm text-zinc-800 group-hover:text-indigo-600 transition-colors line-clamp-2 leading-snug">
                      {p.title}
                    </p>
                  </div>
                  <div className="mt-1 ml-1 flex items-center gap-3 text-xs text-zinc-400">
                    <span>{p.subreddit}</span>
                    <span>▲ {p.ups}</span>
                    <span>💬 {p.num_comments}</span>
                  </div>
                </a>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Keywords used */}
      <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-5 py-4">
        <p className="text-xs text-zinc-400 mb-2 font-medium uppercase tracking-wider">Keywords Analyzed</p>
        <div className="flex flex-wrap gap-2">
          {metrics.keywords_analyzed.map((kw) => (
            <span key={kw} className="rounded-full bg-white border border-zinc-200 px-3 py-1 text-xs text-zinc-600">
              {kw}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreCard({
  title,
  value,
  color,
  description,
}: {
  title: string;
  value: number;
  color: 'indigo' | 'rose' | 'emerald';
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-xs text-zinc-400 uppercase tracking-wider mb-2">{title}</p>
      <ScoreBar value={value} color={color} />
      <p className="mt-3 text-xs text-zinc-500 leading-relaxed">{description}</p>
    </div>
  );
}

function ScoreCircle({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: 'indigo' | 'rose';
}) {
  const colorMap = {
    indigo: 'text-indigo-600',
    rose: 'text-rose-500',
  };
  return (
    <div className="text-center">
      <div className={`text-2xl font-bold tabular-nums ${colorMap[color]}`}>{value}</div>
      <div className="text-xs text-zinc-400 mt-0.5">{label}</div>
    </div>
  );
}

// ─── Competitor card ──────────────────────────────────────────────────────────

interface CompetitorMini {
  name: string;
  mentions: number;
  source: string;
  url?: string;
  tagline?: string;
}

function sourceBadge(source: string): { label: string; color: string } {
  if (source.includes('github')) return { label: 'GitHub', color: 'bg-zinc-700' };
  if (source.includes('llm')) return { label: 'Known', color: 'bg-violet-500' };
  return { label: 'Forum', color: 'bg-emerald-500' };
}

function CompetitorCard({ competitor: c }: { competitor: CompetitorMini }) {
  const badge = sourceBadge(c.source);
  const inner = (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors h-full">
      <div className="flex items-start gap-2">
        <span className={`flex-shrink-0 inline-block h-2 w-2 rounded-full mt-1.5 ${badge.color}`} title={badge.label} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-semibold text-zinc-900 truncate">{c.name}</span>
            {c.url && (
              <span className="text-xs text-indigo-500" aria-hidden>
                ↗
              </span>
            )}
          </div>
          {c.tagline && (
            <p className="mt-0.5 text-xs text-zinc-500 line-clamp-2 leading-snug">{c.tagline}</p>
          )}
          <div className="mt-1 flex items-center gap-2 text-xs text-zinc-400">
            <span className="capitalize">{badge.label}</span>
            <span>·</span>
            <span>{c.mentions}{c.source.includes('github') ? '★' : '×'}</span>
          </div>
        </div>
      </div>
    </div>
  );

  return c.url ? (
    <a href={c.url} target="_blank" rel="noopener noreferrer" className="block">
      {inner}
    </a>
  ) : (
    inner
  );
}

function SourceLegend({ label, color }: { label: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-zinc-500">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}
