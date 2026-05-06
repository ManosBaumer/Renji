'use client';

import type { Insight } from '@/lib/analyze';

export function InsightPanel({ insight }: { insight: Insight }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm space-y-5">
      <div className="flex items-center gap-2">
        <span className="text-lg">🤖</span>
        <h2 className="text-sm font-semibold text-zinc-900">AI Market Insight</h2>
      </div>

      {/* Verdict */}
      <div className="rounded-xl bg-zinc-50 border border-zinc-100 px-5 py-4">
        <p className="text-sm font-medium text-zinc-800 leading-relaxed">{insight.verdict}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <InsightBlock emoji="📊" label="Demand Signal" text={insight.demand_signal} />
        <InsightBlock emoji="⚔️" label="Competition Signal" text={insight.competition_signal} />
        <InsightBlock emoji="🎯" label="Opportunity" text={insight.opportunity} />
        <InsightBlock emoji="⚠️" label="Risks" text={insight.risks} />
      </div>

      {/* Next steps */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span>✅</span>
          <h3 className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">Next Steps This Week</h3>
        </div>
        <ol className="space-y-2">
          {insight.next_steps.map((step, i) => (
            <li key={i} className="flex gap-3 text-sm text-zinc-700 leading-relaxed">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function InsightBlock({ emoji, label, text }: { emoji: string; label: string; text: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-base">{emoji}</span>
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{label}</h3>
      </div>
      <p className="text-sm text-zinc-700 leading-relaxed">{text}</p>
    </div>
  );
}
