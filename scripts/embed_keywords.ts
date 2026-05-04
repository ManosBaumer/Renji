import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

const PAGE_SIZE = 200;
const RPM_LIMIT = 80;       // safety margin under the 100 RPM free-tier limit
const OUTPUT_DIM = 768;     // matches keywords.embedding VECTOR(768)
const MODEL = 'gemini-embedding-001';
const MAX_RETRIES = 5;

// Sliding-window rate limiter (timestamps of recent requests)
const requestTimes: number[] = [];

async function throttle() {
  const now = Date.now();
  while (requestTimes.length && now - requestTimes[0] > 60_000) {
    requestTimes.shift();
  }
  if (requestTimes.length >= RPM_LIMIT) {
    const waitMs = 60_000 - (now - requestTimes[0]) + 100;
    await new Promise((r) => setTimeout(r, waitMs));
    return throttle();
  }
  requestTimes.push(Date.now());
}

function parseRetryDelay(err: unknown): number {
  const msg = err instanceof Error ? err.message : String(err);
  const m = msg.match(/retry in ([\d.]+)s/i);
  if (m) return Math.ceil(parseFloat(m[1]) * 1000);
  return 60_000;
}

function isRateLimit(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const status = (err as any)?.status;
  return status === 429 || /429|RESOURCE_EXHAUSTED|quota/i.test(msg);
}

async function embedOne(ai: GoogleGenAI, text: string): Promise<number[]> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    await throttle();
    try {
      const result = await ai.models.embedContent({
        model: MODEL,
        contents: text,
        config: { outputDimensionality: OUTPUT_DIM },
      });
      const values = result.embeddings?.[0]?.values;
      if (!values) throw new Error('No embedding returned');
      return values;
    } catch (err) {
      if (isRateLimit(err) && attempt < MAX_RETRIES - 1) {
        const delay = parseRetryDelay(err);
        process.stdout.write(`\n  Rate-limited; sleeping ${Math.round(delay / 1000)}s...`);
        requestTimes.length = 0; // reset our local window
        await new Promise((r) => setTimeout(r, delay + 1000));
        continue;
      }
      throw err;
    }
  }
  throw new Error('Max retries exceeded');
}

async function embedKeywords() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { count } = await supabase
    .from('keywords')
    .select('*', { count: 'exact', head: true })
    .is('embedding', null);

  console.log(`Keywords without embeddings: ${count ?? 'unknown'}`);
  if (!count) { console.log('Nothing to embed.'); return; }

  const startTime = Date.now();
  let totalProcessed = 0;

  while (true) {
    const { data: keywords, error } = await supabase
      .from('keywords')
      .select('id, name')
      .is('embedding', null)
      .order('created_at')
      .limit(PAGE_SIZE);

    if (error) { console.error('\nFetch error:', error); break; }
    if (!keywords || keywords.length === 0) break;

    for (const kw of keywords) {
      try {
        const embedding = await embedOne(ai, kw.name as string);
        const { error: upErr } = await supabase
          .from('keywords')
          .update({ embedding })
          .eq('id', kw.id);

        if (upErr) {
          console.error(`\n  Update error for "${kw.name}":`, upErr.message);
          continue;
        }

        totalProcessed++;
        if (totalProcessed % 5 === 0) {
          const elapsed = (Date.now() - startTime) / 1000;
          const rate = totalProcessed / elapsed * 60;
          const remaining = (count - totalProcessed) / (rate / 60);
          process.stdout.write(
            `\r  Embedded ${totalProcessed}/${count}  (${rate.toFixed(0)}/min, ETA ${Math.round(remaining / 60)}m)   `
          );
        }
      } catch (err) {
        console.error(`\n  Failed for "${kw.name}":`, err instanceof Error ? err.message : err);
      }
    }
  }

  console.log(`\nDone! Total embedded this run: ${totalProcessed}`);
}

embedKeywords().catch(console.error);
