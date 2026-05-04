import { createClient } from '@supabase/supabase-js';

const SIMILARITY_THRESHOLD = 0.85; // cosine similarity > this → same cluster
const PAGE_SIZE = 1000;

// Union-Find for connected components
class UnionFind {
  private parent = new Map<string, string>();

  find(x: string): string {
    if (!this.parent.has(x)) this.parent.set(x, x);
    const p = this.parent.get(x)!;
    if (p !== x) {
      const root = this.find(p);
      this.parent.set(x, root);
      return root;
    }
    return x;
  }

  union(x: string, y: string) {
    const px = this.find(x);
    const py = this.find(y);
    if (px !== py) this.parent.set(px, py);
  }

  roots(): Set<string> {
    const all = new Set(this.parent.keys());
    const roots = new Set<string>();
    for (const k of all) roots.add(this.find(k));
    return roots;
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

async function clusterKeywords() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Fetch all embedded keywords
  console.log('Fetching keywords with embeddings...');
  const allKeywords: Array<{ id: string; name: string; embedding: number[] }> = [];
  let page = 0;

  while (true) {
    const { data, error } = await supabase
      .from('keywords')
      .select('id, name, embedding')
      .not('embedding', 'is', null)
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (error) { console.error('Fetch error:', error); break; }
    if (!data || data.length === 0) break;

    for (const row of data) {
      const embedding = typeof row.embedding === 'string'
        ? (JSON.parse(row.embedding) as number[])
        : (row.embedding as number[]);
      allKeywords.push({ id: row.id as string, name: row.name as string, embedding });
    }

    if (data.length < PAGE_SIZE) break;
    page++;
  }

  console.log(`Loaded ${allKeywords.length} keywords. Computing similarities...`);

  const uf = new UnionFind();

  // O(n²) pairwise similarity — acceptable for ≤10k keywords
  for (let i = 0; i < allKeywords.length; i++) {
    for (let j = i + 1; j < allKeywords.length; j++) {
      const sim = cosineSimilarity(allKeywords[i].embedding, allKeywords[j].embedding);
      if (sim >= SIMILARITY_THRESHOLD) {
        uf.union(allKeywords[i].id, allKeywords[j].id);
      }
    }
    if (i % 500 === 0) process.stdout.write(`\r  Processed ${i}/${allKeywords.length}...`);
  }
  console.log('\nClustering done. Writing cluster IDs...');

  // Group by root → assign cluster_id = root id
  const byClusters = new Map<string, string[]>();
  for (const kw of allKeywords) {
    const root = uf.find(kw.id);
    if (!byClusters.has(root)) byClusters.set(root, []);
    byClusters.get(root)!.push(kw.id);
  }

  const multiMemberClusters = [...byClusters.values()].filter((ids) => ids.length > 1);
  console.log(`Clusters with >1 member: ${multiMemberClusters.length}`);

  // Batch-update cluster_id for each cluster
  let updated = 0;
  for (const [root, ids] of byClusters) {
    if (ids.length === 1) continue; // singletons — skip
    const { error } = await supabase
      .from('keywords')
      .update({ cluster_id: root })
      .in('id', ids);

    if (error) console.error('Update error:', error);
    else updated += ids.length;
  }

  console.log(`Done! Updated ${updated} keywords across ${multiMemberClusters.length} clusters.`);
}

clusterKeywords().catch(console.error);
