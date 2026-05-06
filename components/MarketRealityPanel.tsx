'use client';

import type { MarketAssessment } from '@/lib/market';

const TYPE_BADGES: Record<string, { label: string; classes: string }> = {
  untapped:  { label: 'Untapped',   classes: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  emerging:  { label: 'Emerging',   classes: 'bg-emerald-50 text-emerald-600 ring-emerald-100' },
  niche:     { label: 'Niche',      classes: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
  mature:    { label: 'Mature',     classes: 'bg-zinc-50 text-zinc-700 ring-zinc-200' },
  commodity: { label: 'Commodity',  classes: 'bg-amber-50 text-amber-700 ring-amber-200' },
  saturated: { label: 'Saturated',  classes: 'bg-red-50 text-red-700 ring-red-200' },
};

interface DimensionConfig {
  key: keyof Pick<MarketAssessment, 'saturation' | 'commoditization' | 'buyer_urgency' | 'distribution_difficulty'>;
  label: string;
  description: string;
  /** When true, HIGH is BAD (e.g. saturation high = bad). */
  highIsBad: boolean;
}

const DIMENSIONS: DimensionConfig[] = [
  {
    key: 'saturation',
    label: 'Saturation',
    description: 'How many established players exist',
    highIsBad: true,
  },
  {
    key: 'commoditization',
    label: 'Commoditization',
    description: 'Race-to-bottom risk vs. differentiable',
    highIsBad: true,
  },
  {
    key: 'buyer_urgency',
    label: 'Buyer Urgency',
    description: 'Will users actually pay for this?',
    highIsBad: false,
  },
  {
    key: 'distribution_difficulty',
    label: 'Distribution',
    description: 'How hard to reach customers',
    highIsBad: true,
  },
];

export function MarketRealityPanel({ market }: { market: MarketAssessment }) {
  const badge = TYPE_BADGES[market.market_type] ?? TYPE_BADGES.mature;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Market Reality Check</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Beyond raw discussion volume — does this market actually have room?
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${badge.classes}`}
        >
          {badge.label} market
        </span>
      </div>

      {/* Dimensions grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-4">
        {DIMENSIONS.map((d) => (
          <Dimension
            key={d.key}
            label={d.label}
            description={d.description}
            value={market[d.key]}
            highIsBad={d.highIsBad}
          />
        ))}
      </div>

      {/* Reasoning */}
      <div className="rounded-xl bg-zinc-50 border border-zinc-100 px-4 py-3">
        <p className="text-xs font-medium text-zinc-400 mb-1 uppercase tracking-wider">
          Analyst Reasoning
        </p>
        <p className="text-sm text-zinc-700 leading-relaxed">{market.reasoning}</p>
      </div>
    </div>
  );
}

function Dimension({
  label,
  description,
  value,
  highIsBad,
}: {
  label: string;
  description: string;
  value: number;
  highIsBad: boolean;
}) {
  // Color by interpretation: high-is-bad fields (saturation) flip the gradient
  const score = highIsBad ? 100 - value : value;
  const color =
    score >= 65 ? { bar: 'bg-emerald-500', text: 'text-emerald-600' } :
    score >= 40 ? { bar: 'bg-amber-500',   text: 'text-amber-600' } :
                  { bar: 'bg-red-500',     text: 'text-red-500' };

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-xs font-medium text-zinc-700">{label}</span>
        <span className={`text-lg font-bold tabular-nums ${color.text}`}>{value}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color.bar}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs text-zinc-500 leading-snug">{description}</p>
    </div>
  );
}
