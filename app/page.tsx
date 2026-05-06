import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/supabase-server';
import { HomePageClient } from '@/components/HomePageClient';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/auth/login?next=/');
  }

  return <HomePageClient userEmail={user.email ?? 'user'} />;
}
