import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

// ─── Auth ─────────────────────────────────────────────────────────────────────

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false; // require secret to be set
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// ─── GET /api/admin/suggestions ───────────────────────────────────────────────
// Query params: status (pending|approved|rejected, default: pending)
//               limit (default: 50), offset (default: 0)

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized();

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') ?? 'pending';
  const limit  = Math.min(parseInt(searchParams.get('limit')  ?? '50', 10), 100);
  const offset = parseInt(searchParams.get('offset') ?? '0', 10);

  const { data, error, count } = await supabaseAdmin
    .from('keyword_suggestions')
    .select(
      `id, suggested_keyword, field, type, idea, similarity, status, created_at,
       closest_match ( id, name, type )`,
      { count: 'exact' }
    )
    .eq('status', status)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ suggestions: data, total: count, limit, offset });
}

// ─── PATCH /api/admin/suggestions/:id ─────────────────────────────────────────
// Body: { action: 'reject' }
//       { action: 'approve' }                      → creates new canonical keyword
//       { action: 'merge', keyword_id: '<uuid>' }  → adds as alias to existing keyword

const ActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('reject') }),
  z.object({ action: z.literal('approve') }),
  z.object({ action: z.literal('merge'), keyword_id: z.string().uuid() }),
]);

export async function PATCH(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized();

  // Extract id from URL
  const id = request.nextUrl.pathname.split('/').at(-1);
  if (!id) {
    return NextResponse.json({ error: 'Missing suggestion id in URL' }, { status: 400 });
  }

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  const parsed = ActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid action', issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Fetch the suggestion
  const { data: suggestion, error: fetchErr } = await supabaseAdmin
    .from('keyword_suggestions')
    .select('id, suggested_keyword, type, status')
    .eq('id', id)
    .single();

  if (fetchErr || !suggestion) {
    return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 });
  }
  if (suggestion.status !== 'pending') {
    return NextResponse.json(
      { error: `Suggestion is already ${suggestion.status}` },
      { status: 409 }
    );
  }

  const { action } = parsed.data;

  // ── reject ──
  if (action === 'reject') {
    const { error } = await supabaseAdmin
      .from('keyword_suggestions')
      .update({ status: 'rejected' })
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, action: 'rejected' });
  }

  // ── approve → create new canonical keyword ──
  if (action === 'approve') {
    const { data: kw, error: insertErr } = await supabaseAdmin
      .from('keywords')
      .insert({ name: suggestion.suggested_keyword, type: suggestion.type ?? 'keyword' })
      .select('id')
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    await supabaseAdmin
      .from('keyword_suggestions')
      .update({ status: 'approved' })
      .eq('id', id);

    return NextResponse.json({ ok: true, action: 'approved', keyword_id: kw.id });
  }

  // ── merge → add as alias to existing keyword ──
  if (action === 'merge') {
    const { keyword_id } = parsed.data;

    const { error: aliasErr } = await supabaseAdmin
      .from('aliases')
      .upsert(
        { keyword_id, alias: suggestion.suggested_keyword },
        { onConflict: 'keyword_id,alias', ignoreDuplicates: true }
      );

    if (aliasErr) {
      return NextResponse.json({ error: aliasErr.message }, { status: 500 });
    }

    await supabaseAdmin
      .from('keyword_suggestions')
      .update({ status: 'approved' })
      .eq('id', id);

    return NextResponse.json({ ok: true, action: 'merged', keyword_id });
  }
}
