'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { QuotaPanel } from './QuotaPanel';

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
  user_id?: string | null;
  user_email?: string | null;
  created_at: string;
}

interface ClosestMatch {
  id: string;
  name: string;
  type: string;
}

interface Suggestion {
  id: string;
  suggested_keyword: string;
  field: string | null;
  type: string | null;
  idea: string | null;
  similarity: number | null;
  status: string;
  created_at: string;
  closest_match: ClosestMatch | null;
}

interface Props {
  initialAnalyses: Analysis[];
  initialSuggestions: Suggestion[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AdminDashboard({ initialAnalyses, initialSuggestions }: Props) {
  const [tab, setTab] = useState<'queries' | 'flags'>('queries');
  const [analyses] = useState<Analysis[]>(initialAnalyses);
  const [suggestions, setSuggestions] = useState<Suggestion[]>(initialSuggestions);
  const [, startTransition] = useTransition();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin/login');
    router.refresh();
  };

  const handleSuggestionAction = async (
    id: string,
    action: 'reject' | 'approve' | 'merge',
    keyword_id?: string,
  ) => {
    const body =
      action === 'merge'
        ? { id, action, keyword_id }
        : { id, action };

    const res = await fetch('/api/admin/suggestions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      startTransition(() => {
        setSuggestions((prev) => prev.filter((s) => s.id !== id));
      });
    } else {
      const data = (await res.json()) as { error?: string };
      alert(`Action failed: ${data.error ?? 'Unknown error'}`);
    }
  };

  const pendingCount = suggestions.length;

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="text-xl font-bold tracking-tight text-zinc-900">
              renji<span className="text-indigo-600">.</span>pro
            </a>
            <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
              Admin
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        {/* Quota usage panel — at the top so it's visible at a glance */}
        <QuotaPanel />

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl bg-zinc-100 p-1 w-fit">
          <TabButton active={tab === 'queries'} onClick={() => setTab('queries')}>
            User Queries
            <span className="ml-1.5 rounded-full bg-white px-1.5 text-xs text-zinc-500">
              {analyses.length}
            </span>
          </TabButton>
          <TabButton active={tab === 'flags'} onClick={() => setTab('flags')}>
            Keyword Flags
            {pendingCount > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 text-xs text-white">
                {pendingCount}
              </span>
            )}
          </TabButton>
        </div>

        {/* Queries tab */}
        {tab === 'queries' && (
          <div className="space-y-3">
            {analyses.length === 0 ? (
              <EmptyState message="No analyses recorded yet. Run your first idea validation to see it here." />
            ) : (
              analyses.map((a) => <AnalysisRow key={a.id} analysis={a} />)
            )}
          </div>
        )}

        {/* Flags tab */}
        {tab === 'flags' && (
          <div className="space-y-3">
            {suggestions.length === 0 ? (
              <EmptyState message="No pending keyword flags. All caught up!" />
            ) : (
              <>
                <p className="text-xs text-zinc-500">
                  These terms were not found in the keyword taxonomy. Approve to add as a new keyword, merge into the closest existing one, or reject to discard.
                </p>
                {suggestions.map((s) => (
                  <SuggestionRow
                    key={s.id}
                    suggestion={s}
                    onAction={handleSuggestionAction}
                  />
                ))}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? 'bg-white text-zinc-900 shadow-sm'
          : 'text-zinc-500 hover:text-zinc-700'
      }`}
    >
      {children}
    </button>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center">
      <p className="text-sm text-zinc-400">{message}</p>
    </div>
  );
}

function AnalysisRow({ analysis: a }: { analysis: Analysis }) {
  const [expanded, setExpanded] = useState(false);

  const opp = a.opportunity ?? 0;
  const oppColor =
    opp >= 65 ? 'text-emerald-600' : opp >= 40 ? 'text-amber-600' : 'text-red-500';

  const trendLabel = a.trend_label?.replace(/_/g, ' ') ?? '—';

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-5 py-4 text-left"
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-900 truncate">{a.idea}</p>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-zinc-400">
              {a.user_email ? (
                <span className="font-medium text-indigo-600">✉ {a.user_email}</span>
              ) : a.user_id ? (
                <span className="font-mono text-zinc-400">user {a.user_id.slice(0, 8)}…</span>
              ) : (
                <span className="italic text-zinc-300">anonymous</span>
              )}
              {a.audience && <span>👥 {a.audience}</span>}
              {a.industry && <span>🏭 {a.industry}</span>}
              <span>{new Date(a.created_at).toLocaleString()}</span>
              <span className="capitalize">{a.source ?? 'hn'}</span>
            </div>
          </div>
          <div className="flex items-center gap-4 flex-shrink-0">
            <ScorePill label="D" value={a.demand} color="indigo" />
            <ScorePill label="C" value={a.competition} color="rose" />
            <div className={`text-center ${oppColor}`}>
              <div className="text-lg font-bold tabular-nums">{a.opportunity ?? '—'}</div>
              <div className="text-xs">opp</div>
            </div>
            <span className="text-zinc-300">{expanded ? '▲' : '▼'}</span>
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
            <Field
              label="Trend"
              value={`${trendLabel}${a.trend_pct != null ? ` (${a.trend_pct > 0 ? '+' : ''}${a.trend_pct}%)` : ''}`}
            />
            <Field label="Posts analyzed" value={String(a.total_posts ?? '—')} />
            <Field label="Competitors detected" value={String(a.num_competitors ?? '—')} />
          </div>
          {a.insight_verdict && (
            <div className="rounded-xl bg-white border border-zinc-100 px-4 py-3">
              <p className="text-xs font-medium text-zinc-400 mb-1 uppercase tracking-wider">AI Verdict</p>
              <p className="text-sm text-zinc-700 leading-relaxed">{a.insight_verdict}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SuggestionRow({
  suggestion: s,
  onAction,
}: {
  suggestion: Suggestion;
  onAction: (id: string, action: 'reject' | 'approve' | 'merge', keyword_id?: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  const act = async (action: 'reject' | 'approve' | 'merge', keyword_id?: string) => {
    setBusy(action);
    await onAction(s.id, action, keyword_id);
    setBusy(null);
  };

  const simPct = Math.round((s.similarity ?? 0) * 100);
  const simColor =
    simPct >= 82 ? 'text-emerald-600' : simPct >= 65 ? 'text-amber-600' : 'text-red-500';

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-zinc-900">
              &ldquo;{s.suggested_keyword}&rdquo;
            </span>
            {s.field && (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 capitalize">
                {s.field}
              </span>
            )}
            <span className={`text-xs font-medium ${simColor}`}>
              {simPct}% sim
            </span>
          </div>

          {s.idea && (
            <p className="mt-1 text-xs text-zinc-400 truncate">
              from: &ldquo;{s.idea}&rdquo;
            </p>
          )}

          {s.closest_match && (
            <p className="mt-1 text-xs text-zinc-500">
              Closest match:{' '}
              <span className="font-medium text-zinc-700">{s.closest_match.name}</span>
              <span className="text-zinc-400"> ({s.closest_match.type})</span>
            </p>
          )}

          <p className="mt-1 text-xs text-zinc-400">
            {new Date(s.created_at).toLocaleString()}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <ActionButton
            onClick={() => act('approve')}
            disabled={busy !== null}
            loading={busy === 'approve'}
            variant="green"
            title="Create as new keyword in taxonomy"
          >
            Approve
          </ActionButton>

          {s.closest_match && (
            <ActionButton
              onClick={() => act('merge', s.closest_match!.id)}
              disabled={busy !== null}
              loading={busy === 'merge'}
              variant="blue"
              title={`Add as alias of "${s.closest_match.name}"`}
            >
              Merge →&nbsp;{s.closest_match.name}
            </ActionButton>
          )}

          <ActionButton
            onClick={() => act('reject')}
            disabled={busy !== null}
            loading={busy === 'reject'}
            variant="red"
            title="Reject this suggestion"
          >
            Reject
          </ActionButton>
        </div>
      </div>
    </div>
  );
}

function ActionButton({
  onClick,
  disabled,
  loading,
  variant,
  title,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  loading: boolean;
  variant: 'green' | 'blue' | 'red';
  title: string;
  children: React.ReactNode;
}) {
  const colors = {
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
    blue: 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100',
    red: 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${colors[variant]}`}
    >
      {loading ? '…' : children}
    </button>
  );
}

function ScorePill({ label, value, color }: { label: string; value: number | null; color: 'indigo' | 'rose' }) {
  const c = { indigo: 'text-indigo-600', rose: 'text-rose-500' };
  return (
    <div className={`text-center ${c[color]}`}>
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
