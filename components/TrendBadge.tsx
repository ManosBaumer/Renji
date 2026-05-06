'use client';

import type { Trend } from '@/lib/score';

const CONFIG: Record<
  string,
  { label: string; classes: string; arrow: string }
> = {
  strong_growth: {
    label: 'Strong Growth',
    classes: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    arrow: '↑↑',
  },
  growing: {
    label: 'Growing',
    classes: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
    arrow: '↑',
  },
  steady: {
    label: 'Steady',
    classes: 'bg-zinc-50 text-zinc-600 ring-zinc-200',
    arrow: '→',
  },
  declining: {
    label: 'Declining',
    classes: 'bg-amber-50 text-amber-700 ring-amber-200',
    arrow: '↓',
  },
  falling: {
    label: 'Falling',
    classes: 'bg-red-50 text-red-600 ring-red-200',
    arrow: '↓↓',
  },
  insufficient_data: {
    label: 'Insufficient Data',
    classes: 'bg-zinc-50 text-zinc-400 ring-zinc-200',
    arrow: '–',
  },
};

export function TrendBadge({ trend }: { trend: Trend }) {
  const cfg = CONFIG[trend.label] ?? CONFIG.insufficient_data;
  const pct = trend.pct_change !== 0 ? ` (${trend.pct_change > 0 ? '+' : ''}${trend.pct_change}%)` : '';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${cfg.classes}`}
    >
      <span>{cfg.arrow}</span>
      <span>
        {cfg.label}
        {pct}
      </span>
    </span>
  );
}
