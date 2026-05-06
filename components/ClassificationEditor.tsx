'use client';

import { useState } from 'react';
import type { Classification } from '@/lib/classify';
import type { Flags } from '@/lib/flag';

interface ClassificationEditorProps {
  classification: Classification;
  flags: Flags;
  /** When true, the user typed these fields directly (advanced mode) — skip flag/confidence UI */
  userProvided: boolean;
  onReanalyze: (c: Classification) => void;
  reanalyzing: boolean;
  error: string;
}

const FIELDS = [
  { key: 'audience' as const, label: 'Audience', hint: 'Who is this for?' },
  { key: 'problem' as const, label: 'Problem', hint: 'What pain does it solve?' },
  { key: 'solution' as const, label: 'Solution', hint: 'How does it solve it?' },
  { key: 'industry' as const, label: 'Industry', hint: 'Which sector?' },
];

const FLAG_COLORS: Record<string, string> = {
  auto: 'text-emerald-600 bg-emerald-50 ring-emerald-100',
  flagged: 'text-amber-600 bg-amber-50 ring-amber-200',
  suggestion: 'text-red-600 bg-red-50 ring-red-200',
};
const FLAG_LABELS: Record<string, string> = {
  auto: 'High confidence',
  flagged: 'Low confidence',
  suggestion: 'Novel term',
};

export function ClassificationEditor({
  classification,
  flags,
  userProvided,
  onReanalyze,
  reanalyzing,
  error,
}: ClassificationEditorProps) {
  const [draft, setDraft] = useState<Classification>({ ...classification });
  const [keywordsRaw, setKeywordsRaw] = useState(classification.keywords.join(', '));

  const update = (key: keyof Omit<Classification, 'keywords' | 'confidence'>, value: string) => {
    setDraft((d) => ({ ...d, [key]: value.toLowerCase() }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const keywords = keywordsRaw
      .split(',')
      .map((k) => k.trim().toLowerCase())
      .filter((k) => k.length > 0);

    if (keywords.length === 0) return;

    const finalClassification: Classification = {
      ...draft,
      keywords,
      // Reset confidence to neutral since user has edited
      confidence: {
        audience: 0.8,
        problem: 0.8,
        solution: 0.8,
        industry: 0.8,
        keywords: 0.8,
      },
    };
    onReanalyze(finalClassification);
  };

  return (
    <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">
            {userProvided ? 'Your Classification' : 'AI Classification'}
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            {userProvided
              ? 'These fields came from your structured search. Edit and re-run if you want to refine.'
              : 'Edit any field below, then re-run analysis with your corrected classification.'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          {FIELDS.map(({ key, label, hint }) => {
            const flagLevel = flags[key]?.status;
            const conf = classification.confidence[key];
            return (
              <div key={key}>
                <div className="mb-1 flex items-center gap-2">
                  <label className="text-xs font-medium text-zinc-700">{label}</label>
                  {!userProvided && flagLevel && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${FLAG_COLORS[flagLevel] ?? ''}`}
                    >
                      {FLAG_LABELS[flagLevel]}
                    </span>
                  )}
                  {!userProvided && (
                    <span className="ml-auto text-xs text-zinc-400">{Math.round(conf * 100)}%</span>
                  )}
                </div>
                <input
                  type="text"
                  value={draft[key]}
                  onChange={(e) => update(key, e.target.value)}
                  placeholder={hint}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                />
              </div>
            );
          })}
        </div>

        {/* Keywords */}
        <div>
          <div className="mb-1 flex items-center gap-2">
            <label className="text-xs font-medium text-zinc-700">Keywords</label>
            <span className="text-xs text-zinc-400">comma-separated</span>
          </div>
          <input
            type="text"
            value={keywordsRaw}
            onChange={(e) => setKeywordsRaw(e.target.value)}
            placeholder="e.g. focus, productivity, students, ai"
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
          />
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={reanalyzing}
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {reanalyzing ? 'Re-analyzing…' : 'Re-analyze with these fields →'}
        </button>
      </form>
    </div>
  );
}
