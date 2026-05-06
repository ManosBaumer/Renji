// User-scoped CRUD for a single analysis. Currently exposes DELETE only.
// Ownership is verified server-side: a user can only delete their own rows.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  // Ownership check + delete in one query: only deletes when the row also
  // belongs to this user. Returns deleted rows so we can detect 404 vs 403.
  const { data, error } = await supabaseAdmin
    .from('analyses')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data || data.length === 0) {
    return NextResponse.json(
      { error: 'Not found, or you don’t own this analysis.' },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true });
}
