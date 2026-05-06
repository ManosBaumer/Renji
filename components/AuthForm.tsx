'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabase-browser';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);

    const supabase = supabaseBrowser();

    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
          },
        });
        if (error) throw error;

        // Two cases:
        //   1. Email confirmation enabled → user must check inbox first
        //   2. Email confirmation disabled → session is set immediately
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

  const isSignup = mode === 'signup';

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <Link href="/" className="block mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            renji<span className="text-indigo-600">.</span>pro
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {isSignup ? 'Create your account' : 'Welcome back'}
          </p>
        </Link>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4"
        >
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1.5">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              autoFocus
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1.5">Password</label>
            <input
              type="password"
              required
              minLength={isSignup ? 8 : 1}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isSignup ? 'At least 8 characters' : 'Your password'}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          {info && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-700">
              {info}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading
              ? isSignup ? 'Creating account…' : 'Signing in…'
              : isSignup ? 'Create account' : 'Sign in'}
          </button>
        </form>

        {/* Switch link */}
        <p className="mt-4 text-center text-xs text-zinc-500">
          {isSignup ? (
            <>
              Already have an account?{' '}
              <Link href={`/auth/login${redirectTo !== '/' ? `?next=${encodeURIComponent(redirectTo)}` : ''}`} className="font-medium text-indigo-600 hover:underline">
                Sign in
              </Link>
            </>
          ) : (
            <>
              No account yet?{' '}
              <Link href={`/auth/signup${redirectTo !== '/' ? `?next=${encodeURIComponent(redirectTo)}` : ''}`} className="font-medium text-indigo-600 hover:underline">
                Create one
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
