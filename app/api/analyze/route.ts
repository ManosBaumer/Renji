import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { analyzeIdea } from '@/lib/analyze';
import { persistSuggestions } from '@/lib/flag';
import { persistAnalysis } from '@/lib/persistence';
import { ClassificationSchema } from '@/lib/classify';
import { getCurrentUser } from '@/lib/supabase-server';

const RequestSchema = z.object({
  idea: z.string().min(3).max(2000),
  /** Optional: skip re-classification and use these fields directly. */
  classification: ClassificationSchema.optional(),
});

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  // ─── Auth gate ──────────────────────────────────────────────────────────────
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required. Please sign in to analyze ideas.' },
      { status: 401 },
    );
  }

  // ─── Body validation ────────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { idea, classification } = parsed.data;

  try {
    const result = await analyzeIdea(idea, classification);

    // Only flag novel terms when the system classified — user-provided
    // fields aren't unknown taxonomy (they're authoritative for that idea).
    if (!result.user_provided) {
      persistSuggestions(idea, result.classification, result.flags, result.retrieved).catch((err) =>
        console.error('persistSuggestions failed:', err),
      );
    }
    // Always record the analysis itself, tagged with the user_id
    await persistAnalysis(idea, result, user.id).catch((err) =>
      console.error('persistAnalysis failed:', err),
    );

    return NextResponse.json(result);
  } catch (err) {
    console.error('analyze error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
