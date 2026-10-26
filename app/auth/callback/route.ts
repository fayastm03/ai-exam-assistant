import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { EmailOtpType } from '@supabase/supabase-js';

/**
 * GET /auth/callback
 * Completes email confirmation, PKCE session exchange, or password recovery.
 * Redirects the user to their appropriate dashboard by role (or custom ?next= path).
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const tokenHash = requestUrl.searchParams.get('token_hash');
  const type = requestUrl.searchParams.get('type') as EmailOtpType | null;
  const next = requestUrl.searchParams.get('next');
  const origin = requestUrl.origin;

  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Can happen in route handlers
        }
      },
    },
  });

  let userId: string | null = null;

  // 1. Exchange PKCE code if provided
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      userId = data.user.id;
    }
  } else if (tokenHash && type) {
    // 2. Verify OTP token hash if provided (e.g. signup, recovery, email_change)
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (!error && data.user) {
      userId = data.user.id;
    }
  }

  // 3. Fallback: Check if session is already established
  if (!userId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      userId = user.id;
    }
  }

  // If next is a valid relative redirect (e.g. /reset-password), prioritize it
  if (next && next.startsWith('/') && !next.startsWith('//')) {
    return NextResponse.redirect(new URL(next, origin));
  }

  if (userId) {
    // 4. Fetch authoritative role from profiles table
    const serviceRole = createServiceRoleClient();
    const { data: profile } = await serviceRole
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (profile?.role === 'teacher') {
      return NextResponse.redirect(new URL('/teacher/exams', origin));
    }
    return NextResponse.redirect(new URL('/exams', origin));
  }

  // Failed to confirm or exchange session
  return NextResponse.redirect(
    new URL('/login?error=confirmation_failed', origin)
  );
}
