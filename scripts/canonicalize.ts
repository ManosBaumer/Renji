import { createClient } from '@supabase/supabase-js';

async function canonicalize() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Fetch all clustered keywords (cluster_id IS NOT NULL)
  console.log('Fetching clustered keywords...');
  const { data: clustered, error } = await supabase
    .from('keywords')
    .select('id, name, type, cluster_id, created_at')
    .not('cluster_id', 'is', null)
    .order('cluster_id')
    .order('created_at'); // oldest = canonical

  if (error) { console.error(error); return; }
  if (!clustered || clustered.length === 0) {
    console.log('No clustered keywords found. Run cluster_keywords.ts first.');
    return;
  }

  // Group by cluster_id
  const clusters = new Map<string, typeof clustered>();
  for (const kw of clustered) {
    const cid = kw.cluster_id as string;
    if (!clusters.has(cid)) clusters.set(cid, []);
    clusters.get(cid)!.push(kw);
  }

  console.log(`Processing ${clusters.size} clusters...`);

  let canonicalized = 0;
  let aliasesCreated = 0;

  for (const [, members] of clusters) {
    // Oldest keyword = canonical (first in ordered result)
    const canonical = members[0];
    const duplicates = members.slice(1);

    if (duplicates.length === 0) continue;

    // Mark duplicates as non-canonical: set canonical_id → canonical.id
    const dupIds = duplicates.map((d) => d.id);
    const { error: updateErr } = await supabase
      .from('keywords')
      .update({ canonical_id: canonical.id })
      .in('id', dupIds);

    if (updateErr) { console.error('Update canonical_id error:', updateErr); continue; }

    // Create alias records for each duplicate name
    const aliasRows = duplicates.map((d) => ({
      keyword_id: canonical.id,
      alias: d.name as string,
    }));

    const { error: aliasErr } = await supabase
      .from('aliases')
      .upsert(aliasRows, { onConflict: 'keyword_id,alias', ignoreDuplicates: true });

    if (aliasErr) console.error('Alias insert error:', aliasErr);

    canonicalized += dupIds.length;
    aliasesCreated += aliasRows.length;
  }

  console.log(`Done!`);
  console.log(`  Keywords marked as aliases: ${canonicalized}`);
  console.log(`  Alias records created:      ${aliasesCreated}`);
  console.log(`  Canonical keywords:         ${clustered.length - canonicalized}`);
}

canonicalize().catch(console.error);
