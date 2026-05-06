import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { UserDashboard } from '@/components/UserDashboard';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/auth/login?next=/dashboard');
  }

  // Fetch this user's analyses, newest first
  const { data: rawAnalyses } = await supabaseAdmin
    .from('analyses')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(200);

  const analyses = rawAnalyses ?? [];

  return (
    <UserDashboard
      userEmail={user.email ?? 'user'}
      memberSince={user.created_at}
      analyses={analyses}
    />
  );
}
