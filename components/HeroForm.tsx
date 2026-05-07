'use client';

import { useEffect, useRef, useState } from 'react';
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

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

const MicIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <path d="M12 19v3" />
  </svg>
);

export function HeroForm({ onSubmit, onAdvancedSubmit, loading, error }: HeroFormProps) {
  const [mode, setMode] = useState<'quick' | 'structured'>('quick');
  const [idea, setIdea] = useState('');
  const [advanced, setAdvanced] = useState(EMPTY_ADVANCED);
  const [animatedPlaceholder, setAnimatedPlaceholder] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const speechBaseRef = useRef('');
  const speechFinalRef = useRef('');

  useEffect(() => {
    return () => recognitionRef.current?.stop();
  }, []);

  useEffect(() => {
    if (mode !== 'quick' || idea.trim().length > 0) return;

    const lines = EXAMPLES.map((ex) => `${ex.text}`);
    let timeoutId: number | undefined;
    let lineIndex = 0;
    let charIndex = 0;
    let deleting = false;
    let paused = false;

    const tick = () => {
      const line = lines[lineIndex];
      if (!deleting) {
        charIndex += 1;
        setAnimatedPlaceholder(line.slice(0, charIndex));
        if (charIndex >= line.length) {
          deleting = true;
          paused = true;
        }
      } else {
        charIndex -= 1;
        setAnimatedPlaceholder(line.slice(0, Math.max(charIndex, 0)));
        if (charIndex <= 0) {
          deleting = false;
          paused = false;
          lineIndex = (lineIndex + 1) % lines.length;
        }
      }

      const delay = paused ? 1150 : deleting ? 18 : 34;
      if (paused) paused = false;
      timeoutId = window.setTimeout(tick, delay);
    };

    timeoutId = window.setTimeout(tick, 340);
    return () => window.clearTimeout(timeoutId);
  }, [mode, idea]);

  useEffect(() => {
    if (mode !== 'quick') return;
    const el = textareaRef.current;
    if (!el) return;
    const maxHeight = 172;
    el.style.height = '0px';
    const nextHeight = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [idea, mode]);

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

  const quickValid = idea.trim().length >= 10;
  const structuredValid = !!(advanced.audience && advanced.problem && advanced.solution);
  const quickPlaceholder = mode === 'quick' && idea.trim().length === 0 ? animatedPlaceholder : '';

  const startListening = () => {
    if (mode !== 'quick') return;
    const w = window as Window & {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const Recognition = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Recognition) return;

    if (!recognitionRef.current) {
      const recognition = new Recognition();
      recognition.lang = 'en-US';
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setSpeechError('');
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        let finalChunk = '';
        let interimChunk = '';
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const segment = event.results[i]?.[0]?.transcript ?? '';
          if (event.results[i].isFinal) finalChunk += `${segment} `;
          else interimChunk += `${segment} `;
        }
        if (finalChunk) speechFinalRef.current += finalChunk;

        const next = [speechBaseRef.current, speechFinalRef.current, interimChunk]
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        setIdea(next);
      };

      recognition.onerror = (event) => {
        const message = event.error === 'not-allowed'
          ? 'Microphone permission denied. Please allow microphone access and try again.'
          : `Speech recognition error: ${event.error}`;
        setSpeechError(message);
        setIsListening(false);
      };

      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
    }

    speechBaseRef.current = idea.trim();
    speechFinalRef.current = '';
    recognitionRef.current.start();
  };

  const toggleListening = () => {
    if (loading) return;
    const w = window as Window & {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    if (!w.SpeechRecognition && !w.webkitSpeechRecognition) {
      setSpeechError('Speech-to-text is not supported in this browser. Try Chrome or Edge.');
      return;
    }
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }
    startListening();
  };

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
            rows={1}
            placeholder={quickPlaceholder}
            disabled={loading}
          />
          <div className="r-prompt-action">
            <button
              type="button"
              className={`r-mic${isListening ? ' is-listening' : ''}`}
              aria-label={isListening ? 'Stop dictation' : 'Start dictation'}
              onClick={toggleListening}
              disabled={loading}
            >
              <MicIcon />
            </button>
            <button
              type="submit"
              className="r-send"
              aria-label="Analyze"
              disabled={!quickValid || loading}
            >
              <ArrowIcon />
            </button>
          </div>
          {error && <div className="r-prompt-error">{error}</div>}
          {speechError && <div className="r-prompt-error">{speechError}</div>}
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
            <div className="r-structured-keywords-row">
              <StructField
                label="Keywords"
                placeholder="invoicing, automation, freelancers, payments (separate keywords with commas)"
                value={advanced.keywords}
                onChange={(v) => setAdvanced((p) => ({ ...p, keywords: v }))}
              />
              <button
                type="submit"
                className="r-send"
                aria-label="Analyze"
                disabled={!structuredValid || loading}
              >
                <ArrowIcon />
              </button>
            </div>
          </div>
          {error && <div className="r-prompt-error">{error}</div>}
        </form>
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
