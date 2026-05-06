'use client';

interface ScoreBarProps {
  value: number;
  color: 'indigo' | 'rose' | 'emerald' | 'amber';
  showLabel?: boolean;
}

const colorMap = {
  indigo: 'bg-indigo-500',
  rose: 'bg-rose-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
};

export function ScoreBar({ value, color, showLabel = true }: ScoreBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="space-y-1.5">
      {showLabel && (
        <div className="flex justify-between items-baseline">
          <span className="text-2xl font-bold tabular-nums text-zinc-900">{clamped}</span>
          <span className="text-xs text-zinc-400">/ 100</span>
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colorMap[color]}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
