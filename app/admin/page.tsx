import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { AdminDashboard } from '@/components/AdminDashboard';

export const dynamic = 'force-dynamic';

async function checkAuth(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_token')?.value;
  const secret = process.env.ADMIN_SECRET;

  if (!secret || secret === 'change-me' || token !== secret) {
    redirect('/admin/login');
  }
}

export default async function AdminPage() {
  await checkAuth();

  // Fetch initial data server-side for instant render
  const [analysesResult, suggestionsResult] = await Promise.all([
    supabaseAdmin
      .from('analyses')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50),
    supabaseAdmin
      .from('keyword_suggestions')
      .select(
        `id, suggested_keyword, field, type, idea, similarity, status, created_at,
         closest_match ( id, name, type )`
      )
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  // Supabase returns joined relations as arrays; normalize closest_match to object | null
  const suggestions = (suggestionsResult.data ?? []).map((s) => ({
    ...s,
    closest_match: Array.isArray(s.closest_match)
      ? (s.closest_match[0] ?? null)
      : s.closest_match,
  }));

  // Resolve user_id → email for each analysis. Hit auth.admin once and build a map.
  const analyses = analysesResult.data ?? [];
  const userIds = [...new Set(analyses.map((a) => a.user_id).filter(Boolean))] as string[];

  const userEmailById = new Map<string, string>();
  if (userIds.length > 0) {
    // listUsers paginates 50 per page — fine for an MVP admin view
    const { data: usersList } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    for (const u of usersList?.users ?? []) {
      if (userIds.includes(u.id) && u.email) userEmailById.set(u.id, u.email);
    }
  }

  const analysesWithEmail = analyses.map((a) => ({
    ...a,
    user_email: a.user_id ? userEmailById.get(a.user_id) ?? null : null,
  }));

  return (
    <AdminDashboard
      initialAnalyses={analysesWithEmail}
      initialSuggestions={suggestions}
    />
  );
}
