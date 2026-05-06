// Server-side Supabase client with cookie-based auth.
// Use this in:
//   - Server Components (page.tsx with no 'use client')
//   - Route Handlers (app/api/.../route.ts)
//   - Server Actions
//
// It reads the auth cookie set by the browser client and exposes
// `supabase.auth.getUser()` for identifying the request's user.

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function supabaseServer() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components can't write cookies — middleware refreshes them instead
          }
        },
      },
    },
  );
}

/**
 * Convenience helper — returns the current authenticated user, or null.
 * Use in API routes to gate access.
 */
export async function getCurrentUser() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
}
