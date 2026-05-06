'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { AnalysisResult } from '@/lib/analyze';
import type { Classification } from '@/lib/classify';
import { HeroForm } from '@/components/HeroForm';
import { ResultsView } from '@/components/ResultsView';

type Stage = 'idle' | 'analyzing' | 'results' | 'error';

interface Props {
  userEmail: string;
}

export function HomePageClient({ userEmail }: Props) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('idle');
  const [idea, setIdea] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [reanalyzing, setReanalyzing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const runAnalysis = useCallback(
    async (ideaText: string, classificationOverride?: Classification) => {
      const isRerun = stage === 'results';
      if (isRerun) setReanalyzing(true);
      else setStage('analyzing');
      setErrorMsg('');

      try {
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idea: ideaText,
            ...(classificationOverride ? { classification: classificationOverride } : {}),
          }),
        });

        if (res.status === 401) {
          // Session expired — bounce to login
          router.push('/auth/login?next=/');
          return;
        }

        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(err.error ?? `Request failed (${res.status})`);
        }

        const data = (await res.json()) as AnalysisResult;
        setResult(data);
        setStage('results');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setErrorMsg(msg);
        setStage(isRerun ? 'results' : 'error');
      } finally {
        setReanalyzing(false);
      }
    },
    [stage, router],
  );

  const handleSubmit = (ideaText: string) => {
    setIdea(ideaText);
    runAnalysis(ideaText);
  };

  const handleAdvancedSubmit = (classification: Classification) => {
    const parts = [
      classification.audience && `Audience: ${classification.audience}`,
      classification.problem && `Problem: ${classification.problem}`,
      classification.solution && `Solution: ${classification.solution}`,
      classification.industry && classification.industry !== 'general' && `Industry: ${classification.industry}`,
    ].filter(Boolean);
    const synthesized = parts.join('. ') || 'Structured search';
    setIdea(synthesized);
    runAnalysis(synthesized, classification);
  };

  const handleReanalyze = (classification: Classification) => {
    runAnalysis(idea, classification);
  };

  const handleReset = () => {
    setStage('idle');
    setResult(null);
    setErrorMsg('');
  };

  const handleSignout = async () => {
    await fetch('/api/auth/signout', { method: 'POST' });
    router.push('/auth/login');
    router.refresh();
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* Nav */}
      <header className="border-b border-zinc-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <button
            onClick={handleReset}
            className="text-xl font-bold tracking-tight text-zinc-900 hover:opacity-70 transition-opacity"
          >
            renji<span className="text-indigo-600">.</span>pro
          </button>

          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs hover:bg-zinc-50 transition-colors"
            >
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700 uppercase">
                {userEmail.charAt(0)}
              </span>
              <span className="text-zinc-700 max-w-[180px] truncate">{userEmail}</span>
              <span className="text-zinc-400">▾</span>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-zinc-200 bg-white shadow-lg overflow-hidden z-10">
                <Link
                  href="/dashboard"
                  className="block px-4 py-2 text-xs text-zinc-700 hover:bg-zinc-50"
                >
                  My Dashboard
                </Link>
                <button
                  onClick={handleSignout}
                  className="block w-full px-4 py-2 text-left text-xs text-zinc-700 hover:bg-zinc-50 border-t border-zinc-100"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        {(stage === 'idle' || stage === 'error') && (
          <HeroForm
            onSubmit={handleSubmit}
            onAdvancedSubmit={handleAdvancedSubmit}
            loading={false}
            error={errorMsg}
          />
        )}

        {stage === 'analyzing' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24">
            <Spinner />
            <p className="text-zinc-500 text-sm">Fetching market data and running analysis…</p>
            <p className="text-zinc-400 text-xs max-w-xs text-center">
              This usually takes 15–30 seconds. We&apos;re pulling real posts from Hacker News, Reddit, GitHub, StackExchange and more.
            </p>
          </div>
        )}

        {stage === 'results' && result && (
          <ResultsView
            idea={idea}
            result={result}
            onReanalyze={handleReanalyze}
            onReset={handleReset}
            reanalyzing={reanalyzing}
            reanalyzeError={errorMsg}
          />
        )}
      </main>

      <footer className="border-t border-zinc-200 bg-white px-6 py-4 text-center text-xs text-zinc-400">
        Renji.pro — free startup idea validation powered by AI &amp; multi-source forum data
      </footer>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-10 w-10 animate-spin text-indigo-600" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
