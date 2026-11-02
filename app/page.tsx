import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { connection } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createServiceRoleClient } from '@/lib/supabase/server';

export const instant = false;

export default async function HomePage() {
  await connection();
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

  const client = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
    },
  });

  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const serviceRole = createServiceRoleClient();
  const { data: profile } = await serviceRole
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role === 'teacher') {
    redirect('/teacher/exams');
  } else {
    redirect('/exams');
  }
}
