'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { AnalysisResult } from '@/lib/analyze';
import type { Classification } from '@/lib/classify';
import { HeroForm } from '@/components/HeroForm';
import { ResultsView } from '@/components/ResultsView';
import { GrainCanvas } from '@/components/GrainCanvas';
import DarkVeil from '@/components/DarkVeil';

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
  const menuRef = useRef<HTMLDivElement>(null);

  // close user menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [menuOpen]);

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

  // ── Analyzing / Results states use a simpler chrome ──
  if (stage === 'analyzing') {
    return (
      <div className="renji-body" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <BgDecor variant="dashboard" />
        <TopNav
          activePage="analyze"
          userEmail={userEmail}
          onReset={handleReset}
          onSignout={handleSignout}
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
          menuRef={menuRef}
          authed
        />
        <main style={{ position: 'relative', zIndex: 10, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28, padding: '6vh 24px' }}>
          <Spinner />
          <p className="font-serif-italic" style={{ fontSize: 28, color: 'var(--ink)', margin: 0 }}>
            Reading the signal…
          </p>
          <p style={{ fontSize: 13, color: 'var(--ink-mute)', maxWidth: 380, textAlign: 'center', margin: 0, lineHeight: 1.55 }}>
            We&apos;re pulling real posts from Hacker News, Reddit, GitHub, Stack Exchange and more.
            This usually takes 15–30 seconds.
          </p>
        </main>
      </div>
    );
  }

  if (stage === 'results' && result) {
    return (
      <div className="renji-body" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <BgDecor variant="dashboard" />
        <TopNav
          activePage="analyze"
          userEmail={userEmail}
          onReset={handleReset}
          onSignout={handleSignout}
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
          menuRef={menuRef}
          authed
        />
        <main style={{ position: 'relative', zIndex: 10, flex: 1 }}>
          <ResultsView
            idea={idea}
            result={result}
            onReanalyze={handleReanalyze}
            onReset={handleReset}
            reanalyzing={reanalyzing}
            reanalyzeError={errorMsg}
          />
        </main>
      </div>
    );
  }

  // ── Idle / Error: full landing layout with grainy gradient ──
  return (
    <>
      <BgDecor variant="landing" />

      <div className="r-page r-page--veil">
        <div className="r-hero-screen">
          <TopNav
            activePage="analyze"
            userEmail={userEmail}
            onReset={handleReset}
            onSignout={handleSignout}
            menuOpen={menuOpen}
            setMenuOpen={setMenuOpen}
            menuRef={menuRef}
            authed
            large
          />

          <main className="r-hero">
            <h1 className="r-headline">
              <span className="r-line">Validate your idea</span>
              <span className="r-line r-muted">before you build it.</span>
            </h1>

            <HeroForm
              onSubmit={handleSubmit}
              onAdvancedSubmit={handleAdvancedSubmit}
              loading={false}
              error={errorMsg}
            />
          </main>
        </div>

        <StatsStrip />
        <SourcesBlock />
        <SiteFooter />
      </div>
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function BgDecor({ variant }: { variant: 'landing' | 'dashboard' }) {
  if (variant === 'landing') {
    return (
      <>
        <div className="bg-darkveil-shell" aria-hidden="true">
          <div className="bg-darkveil-blur">
            {/* React Bits Dark Veil — keep shader noise off; GrainCanvas owns grain */}
            {/* YIQ hueRotate: +62 pulled the CPPN toward yellow–green; burgundy needs the other direction */}
            <DarkVeil
              hueShift={54}
              noiseIntensity={0}
              scanlineIntensity={0}
              speed={0.42}
              warpAmount={0.1}
              resolutionScale={1}
            />
          </div>
        </div>
        <GrainCanvas />
      </>
    );
  }
  return (
    <>
      <div className="bg-orb-dashboard" aria-hidden="true" />
      <div className="grain-quiet" aria-hidden="true" />
    </>
  );
}

interface TopNavProps {
  activePage: 'analyze' | 'dashboard';
  userEmail?: string;
  onReset?: () => void;
  onSignout?: () => void;
  menuOpen: boolean;
  setMenuOpen: (v: boolean) => void;
  menuRef: React.RefObject<HTMLDivElement | null>;
  authed: boolean;
  large?: boolean;
}

function TopNav({
  activePage,
  userEmail,
  onReset,
  onSignout,
  menuOpen,
  setMenuOpen,
  menuRef,
  authed,
  large,
}: TopNavProps) {
  return (
    <header className="r-nav">
      <button
        type="button"
        className={`r-brand ${large ? 'r-brand--lg' : 'r-brand--md'}`}
        onClick={onReset}
        style={{ background: 'transparent', border: 0, padding: 0, cursor: 'pointer' }}
        aria-label="Renji home"
      >
        <Image src="/typeface-logo.png" alt="Renji" width={large ? 256 : 152} height={large ? 64 : 38} priority />
      </button>

      <nav className="r-nav-pill" aria-label="Primary">
        <button
          type="button"
          className={activePage === 'analyze' ? 'active' : ''}
          onClick={onReset}
        >
          Analyze
        </button>
        <Link href="/dashboard" className={activePage === 'dashboard' ? 'active' : ''}>
          Dashboard
        </Link>
      </nav>

      {authed && userEmail ? (
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            type="button"
            className="r-user-pill"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <span className="r-avatar">{userEmail.charAt(0)}</span>
            <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {userEmail}
            </span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {menuOpen && (
            <div className="r-user-menu" role="menu">
              <Link href="/dashboard" role="menuitem" onClick={() => setMenuOpen(false)}>
                My dashboard
              </Link>
              <div className="r-divider" />
              <button type="button" role="menuitem" onClick={onSignout}>
                Sign out
              </button>
            </div>
          )}
        </div>
      ) : (
        <Link href="/auth/login" className="r-login-btn">
          Log in
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </Link>
      )}
    </header>
  );
}

function StatsStrip() {
  return (
    <section className="r-stats-strip" aria-label="By the numbers">
      <div className="r-strip-inner">
        <div className="r-strip-eyebrow">By the numbers</div>
        <div className="r-strip-grid">
          <StatCell value="2.4" suffix="M+" label="Posts indexed across 6 sources" />
          <StatCell value="30" suffix="sec" label="Median analysis time" />
          <StatCell value="12" suffix="k" label="Ideas validated this month" />
          <StatCell value="0" suffix="$" label="Free while in beta" />
        </div>
      </div>
    </section>
  );
}

function StatCell({ value, suffix, label }: { value: string; suffix: string; label: string }) {
  return (
    <div className="r-stat-cell">
      <div className="r-stat-num">
        <em>{value}</em>
        <span className="suffix">{suffix}</span>
      </div>
      <div className="r-stat-lbl">{label}</div>
    </div>
  );
}

function SourcesBlock() {
  const sources: Array<{ name: string; meta: string; color: string }> = [
    { name: 'Hacker News', meta: '820k posts', color: 'oklch(0.62 0.20 30)' },
    { name: 'Reddit', meta: '1.1m threads', color: 'oklch(0.62 0.18 25)' },
    { name: 'GitHub', meta: '340k repos', color: 'oklch(0.30 0.02 270)' },
    { name: 'Stack Exchange', meta: '96k questions', color: 'oklch(0.55 0.15 250)' },
    { name: 'Lobsters', meta: '38k posts', color: 'oklch(0.50 0.18 295)' },
    { name: 'Dev.to', meta: '14k articles', color: 'oklch(0.65 0.17 195)' },
  ];
  return (
    <section className="r-sources">
      <div className="r-sources-inner">
        <div>
          <div className="r-strip-eyebrow">Signal sources</div>
          <h2 className="r-sources-h">
            Real data <em>only</em>. No vibes, no guesses.
          </h2>
        </div>
        <ul className="r-source-list">
          {sources.map((s) => (
            <li key={s.name}>
              <span
                className="r-src-dot"
                style={{ ['--c' as string]: s.color } as React.CSSProperties}
              />
              {s.name}
              <span className="r-src-meta">{s.meta}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="r-footer">
      <div className="r-footer-inner">
        <div className="r-footer-brand">
          <Image src="/typeface-logo.png" alt="Renji" width={288} height={72} />
          <p className="r-tag-line">
            <em>Validate before you build.</em>
          </p>
          <p className="r-copy">© {new Date().getFullYear()} Renji · All rights reserved</p>
        </div>

        <nav className="r-footer-cols">
          <div>
            <div className="r-col-h">Product</div>
            <Link href="/">Analyze</Link>
            <Link href="/dashboard">Dashboard</Link>
            <a href="#">Pricing</a>
            <a href="#">Changelog</a>
          </div>
          <div>
            <div className="r-col-h">Resources</div>
            <a href="#">Documentation</a>
            <a href="#">Methodology</a>
            <a href="#">Data sources</a>
            <a href="#">API</a>
          </div>
          <div>
            <div className="r-col-h">Company</div>
            <a href="#">About</a>
            <a href="#">Blog</a>
            <a href="#">Contact</a>
            <a href="#">Twitter ↗</a>
          </div>
        </nav>
      </div>
      <div className="r-footer-baseline">
        <span>Renji · data-driven idea validation</span>
        <span className="r-status">
          <i className="r-status-dot" /> All systems operational
        </span>
      </div>
    </footer>
  );
}

function Spinner() {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--accent-2)' }}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" opacity="0.18" />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        style={{ transformOrigin: '12px 12px', animation: 'orbHue 1.2s linear infinite, drift 1.2s linear infinite' }}
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 12 12"
          to="360 12 12"
          dur="1s"
          repeatCount="indefinite"
        />
      </path>
    </svg>
  );
}
