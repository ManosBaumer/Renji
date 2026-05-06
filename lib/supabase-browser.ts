'use client';

// Browser-side Supabase client. Used by client components for auth flows
// (signUp, signInWithPassword, signOut). Cookies are managed automatically
// in the browser by the @supabase/ssr SDK.

import { createBrowserClient } from '@supabase/ssr';

export const supabaseBrowser = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
