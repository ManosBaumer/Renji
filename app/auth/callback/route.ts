// Handles email-confirmation callback links from Supabase Auth.
// When a user clicks the confirmation email, they land here with a `code`
// query param; we exchange it for a session and redirect to `next` (or `/`).

import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Fall through on failure: send user to login with an error
  return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_failed`);
}
