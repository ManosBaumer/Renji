'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { GrainCanvas } from '@/components/GrainCanvas';

interface AuthFormProps {
  mode: 'signup' | 'login';
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get('next') ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState('');

  const isSignup = mode === 'signup';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);

    const supabase = supabaseBrowser();

    try {
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
          },
        });
        if (error) throw error;
        if (data.session) {
          router.push(redirectTo);
          router.refresh();
        } else {
          setInfo('Check your email to confirm your address, then sign in.');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        router.push(redirectTo);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Auth failed');
    } finally {
      setLoading(false);
    }
  };

  const switchHref = isSignup
    ? `/auth/login${redirectTo !== '/' ? `?next=${encodeURIComponent(redirectTo)}` : ''}`
    : `/auth/signup${redirectTo !== '/' ? `?next=${encodeURIComponent(redirectTo)}` : ''}`;

  return (
    <>
      <div className="bg-orb-auth-halo" aria-hidden />
      <div className="bg-orb-auth" aria-hidden />
      <GrainCanvas />

      <div className="r-auth-page">
        <aside className="r-auth-left">
          <Link href="/" className="r-auth-brand r-auth-brand--hero r-auth-brand--above-pitch">
            <Image
              src="/typeface-logo.png"
              alt="Renji"
              width={560}
              height={140}
              priority
              sizes="(max-width: 860px) 52vw, 28vw"
            />
          </Link>
          <div className={`r-pitch r-pitch--below${isSignup ? '' : ' r-pitch--login-head'}`}>
            <h2>
              {isSignup ? (
                <>Stop guessing. Start with data.</>
              ) : (
                <>Validate before you build.</>
              )}
            </h2>
            <p>
              {isSignup
                ? "Renji turns your idea into a structured analysis backed by real conversations from across the web. Your saved analyses live forever."
                : 'Real signals from Hacker News, Reddit, GitHub and more — quietly scored into demand, competition and opportunity.'}
            </p>
          </div>
        </aside>

        {/* RIGHT — form */}
        <main className="r-auth-right">
          <div className="r-form-wrap">
            <div className="r-form-eyebrow">
              Account · {isSignup ? 'Create' : 'Sign in'}
            </div>
            <h1 className="r-form-title">{isSignup ? 'Start validating.' : 'Welcome back.'}</h1>
            <p className="r-form-lede">
              {isSignup
                ? 'Free while in beta — no credit card, no team seats, just your ideas and the data.'
                : 'Pick up where you left off — your saved analyses are waiting.'}
            </p>

            <form className="r-form" onSubmit={handleSubmit}>
              <div className="r-form-field">
                <label htmlFor="auth-email">Email</label>
                <input
                  id="auth-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  autoFocus
                />
              </div>

              <div className="r-form-field">
                <label htmlFor="auth-password">Password</label>
                <input
                  id="auth-password"
                  type="password"
                  required
                  minLength={isSignup ? 8 : 1}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isSignup ? 'At least 8 characters' : 'Your password'}
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                />
              </div>

              {isSignup && (
                <p className="r-form-fineprint">
                  By creating an account you agree to Renji&apos;s terms and privacy policy.
                </p>
              )}

              {error && <div className="r-form-error">{error}</div>}
              {info && <div className="r-form-info">{info}</div>}

              <button
                type="submit"
                className="r-form-submit"
                disabled={loading || !email || !password}
              >
                {loading
                  ? isSignup
                    ? 'Creating account…'
                    : 'Signing in…'
                  : isSignup
                    ? 'Create account'
                    : 'Sign in'}
                {!loading && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                )}
              </button>
            </form>

            <p className="r-form-switch">
              {isSignup ? (
                <>
                  Already have an account?{' '}
                  <Link href={switchHref}>Sign in →</Link>
                </>
              ) : (
                <>
                  No account yet?{' '}
                  <Link href={switchHref}>Create one →</Link>
                </>
              )}
            </p>
          </div>
        </main>
      </div>
    </>
  );
}
