import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { classifyIdea } from '@/lib/classify';
import { computeFlags, persistSuggestions } from '@/lib/flag';

const RequestSchema = z.object({
  idea: z.string().min(3).max(2000),
});

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
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
      { status: 400 }
    );
  }

  const { idea } = parsed.data;

  try {
    const { classification, retrieved } = await classifyIdea(idea);
    const flags = computeFlags(classification, retrieved);

    // Persist low-confidence fields as keyword suggestions (non-blocking)
    persistSuggestions(idea, classification, flags, retrieved).catch((err) =>
      console.error('persistSuggestions failed:', err)
    );

    return NextResponse.json({ classification, retrieved, flags });
  } catch (err) {
    console.error('classify error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
