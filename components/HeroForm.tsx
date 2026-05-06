'use client';

import { useState, useRef } from 'react';
import type { Classification } from '@/lib/classify';

interface HeroFormProps {
  onSubmit: (idea: string) => void;
  onAdvancedSubmit: (classification: Classification) => void;
  loading: boolean;
  error?: string;
}

const EXAMPLES = [
  'AI tool that helps students stay focused during online lectures',
  'A marketplace for freelance designers to sell UI kits',
  'Subscription app for indie hackers to track MRR and churn',
  'B2B SaaS that automates invoice reconciliation for accountants',
];

const EMPTY_ADVANCED = {
  audience: '',
  problem: '',
  solution: '',
  industry: '',
  keywords: '',
};

// ─── Main Component ───────────────────────────────────────────────────────────

export function HeroForm({ onSubmit, onAdvancedSubmit, loading, error }: HeroFormProps) {
  const [mode, setMode] = useState<'quick' | 'advanced'>('quick');
  const [idea, setIdea] = useState('');
  const [advanced, setAdvanced] = useState(EMPTY_ADVANCED);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Quick submit ──
  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = idea.trim();
    if (trimmed.length < 10) return;
    onSubmit(trimmed);
  };

  // ── Advanced submit ──
  const handleAdvancedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const keywords = advanced.keywords
      .split(',')
      .map((k) => k.trim().toLowerCase())
      .filter((k) => k.length > 0);

    if (!advanced.audience || !advanced.problem || !advanced.solution) return;

    const classification: Classification = {
      audience: advanced.audience.trim().toLowerCase(),
      problem: advanced.problem.trim().toLowerCase(),
      solution: advanced.solution.trim().toLowerCase(),
      industry: advanced.industry.trim().toLowerCase() || 'general',
      keywords: keywords.length > 0 ? keywords : [advanced.problem.trim().toLowerCase()],
      confidence: {
        audience: 0.9,
        problem: 0.9,
        solution: 0.9,
        industry: advanced.industry ? 0.9 : 0.5,
        keywords: keywords.length > 0 ? 0.9 : 0.5,
      },
    };
    onAdvancedSubmit(classification);
  };

  const handleExample = (example: string) => {
    setIdea(example);
    setMode('quick');
    textareaRef.current?.focus();
  };

  const tooShort = idea.trim().length > 0 && idea.trim().length < 10;
  const advancedValid = advanced.audience && advanced.problem && advanced.solution;

  return (
    <section className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      {/* Hero text */}
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl">
          Validate your startup idea
          <br />
          <span className="text-indigo-600">in under 30 seconds</span>
        </h1>
        <p className="mt-4 max-w-lg text-zinc-500 text-base mx-auto">
          Describe your idea and we&apos;ll search real Hacker News discussions to score demand,
          competition, and opportunity — then generate actionable insights.
        </p>
      </div>

      {/* Mode toggle */}
      <div className="mb-5 flex gap-1 rounded-xl bg-zinc-100 p-1">
        <ModeTab active={mode === 'quick'} onClick={() => setMode('quick')}>
          Quick Analyze
        </ModeTab>
        <ModeTab active={mode === 'advanced'} onClick={() => setMode('advanced')}>
          Structured Search
        </ModeTab>
      </div>

      {/* ── Quick mode ── */}
      {mode === 'quick' && (
        <form onSubmit={handleQuickSubmit} className="w-full max-w-2xl space-y-4">
          <div>
            <textarea
              ref={textareaRef}
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="Describe your startup idea… e.g. 'An AI tool that helps remote teams run async standups'"
              rows={4}
              className="w-full resize-none rounded-2xl border border-zinc-200 bg-white px-5 py-4 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
            />
            {tooShort && (
              <p className="mt-1 text-xs text-amber-600">
                Please describe your idea in more detail (at least 10 characters)
              </p>
            )}
          </div>

          {error && <ErrorBox message={error} />}

          <button
            type="submit"
            disabled={loading || idea.trim().length < 10}
            className="w-full rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Analyzing…' : 'Analyze Idea →'}
          </button>
        </form>
      )}

      {/* ── Advanced mode ── */}
      {mode === 'advanced' && (
        <form onSubmit={handleAdvancedSubmit} className="w-full max-w-2xl space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm space-y-4">
            <p className="text-xs text-zinc-500">
              Fill in the fields directly — we&apos;ll skip the AI classification step and go straight
              to market analysis with your exact inputs.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <AdvancedField
                label="Audience"
                required
                placeholder="e.g. freelance designers"
                value={advanced.audience}
                onChange={(v) => setAdvanced((p) => ({ ...p, audience: v }))}
                hint="Who is this product for?"
              />
              <AdvancedField
                label="Problem"
                required
                placeholder="e.g. client invoice tracking is manual"
                value={advanced.problem}
                onChange={(v) => setAdvanced((p) => ({ ...p, problem: v }))}
                hint="What pain does it solve?"
              />
              <AdvancedField
                label="Solution"
                required
                placeholder="e.g. automated invoice reconciliation"
                value={advanced.solution}
                onChange={(v) => setAdvanced((p) => ({ ...p, solution: v }))}
                hint="How does your product solve it?"
              />
              <AdvancedField
                label="Industry"
                placeholder="e.g. fintech, edtech, devtools"
                value={advanced.industry}
                onChange={(v) => setAdvanced((p) => ({ ...p, industry: v }))}
                hint="Optional — which sector?"
              />
            </div>

            <AdvancedField
              label="Keywords"
              placeholder="e.g. invoicing, automation, freelancers, payments"
              value={advanced.keywords}
              onChange={(v) => setAdvanced((p) => ({ ...p, keywords: v }))}
              hint="Optional — comma-separated search terms to include"
            />
          </div>

          {error && <ErrorBox message={error} />}

          <button
            type="submit"
            disabled={loading || !advancedValid}
            className="w-full rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Analyzing…' : 'Analyze with These Fields →'}
          </button>
        </form>
      )}

      {/* Examples (quick mode only) */}
      {mode === 'quick' && (
        <div className="mt-8 w-full max-w-2xl">
          <p className="mb-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
            Try an example
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => handleExample(ex)}
                className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left text-xs text-zinc-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 transition-colors shadow-sm"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function ModeTab({
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
      type="button"
      onClick={onClick}
      className={`rounded-lg px-5 py-2 text-sm font-medium transition-colors ${
        active ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
      }`}
    >
      {children}
    </button>
  );
}

function AdvancedField({
  label,
  placeholder,
  value,
  onChange,
  hint,
  required,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  hint: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-700 mb-1">
        {label}
        {required && <span className="ml-0.5 text-indigo-500">*</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
      />
      <p className="mt-0.5 text-xs text-zinc-400">{hint}</p>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
      {message}
    </div>
  );
}
