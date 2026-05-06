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
  { label: 'AI focus tool for students', text: 'An AI tool that helps students stay focused during online lectures' },
  { label: 'UI kit marketplace', text: 'A marketplace for freelance designers to sell UI kits' },
  { label: 'Indie hacker MRR tracker', text: 'Subscription app for indie hackers to track MRR and churn' },
  { label: 'Invoice reconciliation SaaS', text: 'B2B SaaS that automates invoice reconciliation for accountants' },
];

const EMPTY_ADVANCED = {
  audience: '',
  problem: '',
  solution: '',
  industry: '',
  keywords: '',
};

const ArrowIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export function HeroForm({ onSubmit, onAdvancedSubmit, loading, error }: HeroFormProps) {
  const [mode, setMode] = useState<'quick' | 'structured'>('quick');
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

  // ── Structured submit ──
  const handleStructuredSubmit = (e: React.FormEvent) => {
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

  const handleExample = (text: string) => {
    setIdea(text);
    setMode('quick');
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const quickValid = idea.trim().length >= 10;
  const structuredValid = !!(advanced.audience && advanced.problem && advanced.solution);

  return (
    <div className="r-prompt-wrap">
      <div className="r-mode-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'quick'}
          className={mode === 'quick' ? 'active' : ''}
          onClick={() => setMode('quick')}
        >
          Quick analyze
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'structured'}
          className={mode === 'structured' ? 'active' : ''}
          onClick={() => setMode('structured')}
        >
          Structured search
        </button>
      </div>

      {mode === 'quick' && (
        <form className="r-prompt" onSubmit={handleQuickSubmit}>
          <textarea
            ref={textareaRef}
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            rows={3}
            placeholder="Describe your startup idea — e.g. an AI tool that helps remote teams run async standups…"
            disabled={loading}
          />
          {error && <div className="r-prompt-error">{error}</div>}
          <div className="r-prompt-foot">
            <div className="r-foot-left">
              <span className="r-chip" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
                Idea
              </span>
              <span className="r-foot-divider">·</span>
              <span>Powered by 6 data sources</span>
            </div>
            <button
              type="submit"
              className="r-send"
              aria-label="Analyze"
              disabled={!quickValid || loading}
            >
              <ArrowIcon />
            </button>
          </div>
        </form>
      )}

      {mode === 'structured' && (
        <form className="r-prompt" onSubmit={handleStructuredSubmit}>
          <div className="r-structured">
            <StructField
              label="Audience"
              required
              placeholder="freelance designers"
              value={advanced.audience}
              onChange={(v) => setAdvanced((p) => ({ ...p, audience: v }))}
            />
            <StructField
              label="Problem"
              required
              placeholder="invoice tracking is manual"
              value={advanced.problem}
              onChange={(v) => setAdvanced((p) => ({ ...p, problem: v }))}
            />
            <StructField
              label="Solution"
              required
              placeholder="automated reconciliation"
              value={advanced.solution}
              onChange={(v) => setAdvanced((p) => ({ ...p, solution: v }))}
            />
            <StructField
              label="Industry"
              placeholder="fintech · devtools · edtech"
              value={advanced.industry}
              onChange={(v) => setAdvanced((p) => ({ ...p, industry: v }))}
            />
            <StructField
              full
              label="Keywords"
              placeholder="invoicing, automation, freelancers, payments"
              value={advanced.keywords}
              onChange={(v) => setAdvanced((p) => ({ ...p, keywords: v }))}
            />
          </div>
          {error && <div className="r-prompt-error">{error}</div>}
          <div className="r-prompt-foot">
            <div className="r-foot-left">
              <span style={{ color: 'rgba(255,255,255,.45)' }}>3 fields required</span>
              <span className="r-foot-divider">·</span>
              <span>Skips classification — uses your inputs verbatim</span>
            </div>
            <button
              type="submit"
              className="r-send"
              aria-label="Analyze"
              disabled={!structuredValid || loading}
            >
              <ArrowIcon />
            </button>
          </div>
        </form>
      )}

      {mode === 'quick' && (
        <div className="r-examples">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.label}
              type="button"
              className="r-ex-chip"
              onClick={() => handleExample(ex.text)}
            >
              {ex.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StructField({
  label,
  placeholder,
  value,
  onChange,
  required,
  full,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  full?: boolean;
}) {
  return (
    <div className={`r-field${full ? ' r-field--full' : ''}`}>
      <label>
        {label}
        {required && <span className="req">*</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
