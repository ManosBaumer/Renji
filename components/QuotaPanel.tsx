'use client';

import { useEffect, useState } from 'react';

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

interface QuotaData {
  analyses_today: number;
  analyses_this_hour: number;
  remaining_analyses: number | null;
  bottleneck_service: string | null;
  services: ServiceUsage[];
}

const STATUS_COLORS: Record<ServiceUsage['status'], { bar: string; text: string; bg: string }> = {
  ok:       { bar: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' },
  warning:  { bar: 'bg-amber-500',   text: 'text-amber-700',   bg: 'bg-amber-50' },
  critical: { bar: 'bg-red-500',     text: 'text-red-700',     bg: 'bg-red-50' },
};

export function QuotaPanel() {
  const [data, setData] = useState<QuotaData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/quota', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as QuotaData;
      setData(json);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load quota');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  if (loading && !data) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-zinc-400">Loading quota usage…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
        <p className="text-sm text-red-700">Quota fetch failed: {error}</p>
      </div>
    );
  }

  if (!data) return null;

  const remaining = data.remaining_analyses;
  const bottleneck = data.bottleneck_service;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
      {/* Header / summary bar */}
      <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-6 flex-wrap">
          <Stat label="Analyses today" value={data.analyses_today} />
          <Stat label="Last hour" value={data.analyses_this_hour} />
          {remaining != null && (
            <Stat
              label="Analyses remaining today"
              value={remaining}
              hint={bottleneck ? `bottleneck: ${bottleneck}` : undefined}
              color={
                remaining > 50 ? 'text-emerald-600' :
                remaining > 10 ? 'text-amber-600' :
                                 'text-red-500'
              }
            />
          )}
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
        >
          {loading ? '…' : 'Refresh'}
        </button>
      </div>

      {/* Service usage bars */}
      <div className="grid gap-px bg-zinc-100 sm:grid-cols-2 lg:grid-cols-4">
        {data.services.map((s) => (
          <ServiceCard key={s.name} svc={s} />
        ))}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
  hint,
}: {
  label: string;
  value: number;
  color?: string;
  hint?: string;
}) {
  return (
    <div>
      <div className="text-xs text-zinc-400 uppercase tracking-wider">{label}</div>
      <div className={`text-2xl font-bold tabular-nums ${color ?? 'text-zinc-900'}`}>
        {value.toLocaleString()}
      </div>
      {hint && <div className="text-xs text-zinc-400 mt-0.5">{hint}</div>}
    </div>
  );
}

function ServiceCard({ svc }: { svc: ServiceUsage }) {
  const colors = STATUS_COLORS[svc.status];
  return (
    <div className="bg-white px-4 py-3">
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <span className="text-xs font-medium text-zinc-700 truncate">{svc.name}</span>
        <span className={`text-xs font-semibold tabular-nums ${colors.text}`}>
          {svc.pct}%
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 mb-1.5">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colors.bar}`}
          style={{ width: `${svc.pct}%` }}
        />
      </div>
      <div className="flex items-baseline justify-between gap-2 text-xs text-zinc-500">
        <span className="tabular-nums">
          {svc.used.toLocaleString()} / {svc.limit.toLocaleString()}
        </span>
        <span className="text-zinc-400">/{svc.per}</span>
      </div>
      <p className="mt-1 text-xs text-zinc-400 leading-tight">{svc.multiplier}</p>
      {svc.notes && (
        <p className="mt-0.5 text-xs text-zinc-400 leading-tight italic">{svc.notes}</p>
      )}
    </div>
  );
}
