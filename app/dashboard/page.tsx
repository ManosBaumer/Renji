import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { DashboardClient, type DashAnalysis } from '@/components/DashboardClient';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/auth/login?next=/dashboard');
  }

  // Pull this user's analyses, newest-first. We keep the column list explicit
  // so that future migrations can't accidentally leak server-only fields.
  const { data, error } = await supabaseAdmin
    .from('analyses')
    .select(
      [
        'id',
        'idea',
        'audience',
        'problem',
        'solution',
        'industry',
        'keywords',
        'demand',
        'competition',
        'opportunity',
        'saturation',
        'market_type',
        'trend_label',
        'trend_pct',
        'total_posts',
        'num_competitors',
        'insight_verdict',
        'source',
        'created_at',
      ].join(','),
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    console.error('dashboard analyses fetch error:', error.message);
  }

  const analyses = ((data ?? []) as unknown as DashAnalysis[]) ?? [];

  return <DashboardClient userEmail={user.email ?? 'user'} analyses={analyses} />;
}
