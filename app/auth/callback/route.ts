import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { EmailOtpType } from '@supabase/supabase-js';

/**
 * Resolves the canonical external origin (respecting Vercel x-forwarded-host / NEXT_PUBLIC_SITE_URL).
 */
function resolveOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl && !siteUrl.includes('localhost')) {
    return siteUrl.replace(/\/$/, '');
  }
  return request.nextUrl.origin;
}

/**
 * GET /auth/callback
 * Completes email confirmation, PKCE session exchange, or password recovery.
 * Redirects the user to their appropriate destination with session cookies attached.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const tokenHash =
    requestUrl.searchParams.get('token_hash') ||
    requestUrl.searchParams.get('token');
  const type = (requestUrl.searchParams.get('type') || 'signup') as EmailOtpType;
  const next = requestUrl.searchParams.get('next');
  const errorParam = requestUrl.searchParams.get('error');
  const errorDescription = requestUrl.searchParams.get('error_description');

  const origin = resolveOrigin(request);

  // If Supabase returned an explicit error in the query parameters
  if (errorParam) {
    console.error('[Auth Callback] Supabase redirect error:', {
      error: errorParam,
      description: errorDescription,
    });
    return NextResponse.redirect(
      new URL('/login?error=confirmation_failed', origin)
    );
  }

  // Accumulate all cookies that Supabase sets so they can be explicitly attached to the redirect response
  interface CookiePayload {
    name: string;
    value: string;
    options: Parameters<typeof cookieStore.set>[2];
  }
  const cookieStore = await cookies();
  const cookiesToSetList: CookiePayload[] = [];

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
        cookiesToSet.forEach(({ name, value, options }) => {
          try {
            cookieStore.set(name, value, options);
          } catch {
            // In case headers are already closed in some runtimes
          }
          cookiesToSetList.push({ name, value, options });
        });
      },
    },
  });

  /**
   * Helper that creates a redirect response with all newly established session cookies attached.
   */
  function createRedirect(targetPath: string) {
    const targetUrl = new URL(targetPath, origin);
    const response = NextResponse.redirect(targetUrl);
    cookiesToSetList.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options);
    });
    return response;
  }

  let userId: string | null = null;

  // 1. Exchange PKCE code if provided
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data?.user) {
      userId = data.user.id;
    } else if (error) {
      console.warn('[Auth Callback] exchangeCodeForSession failed:', error.message);
    }
  }

  // 2. Verify OTP token hash if provided (e.g. signup, recovery, email_change)
  if (!userId && tokenHash) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (!error && data?.user) {
      userId = data.user.id;
    } else if (error) {
      console.warn('[Auth Callback] verifyOtp failed:', error.message);
    }
  }

  // 3. Fallback: check if session is already established on the client
  if (!userId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      userId = user.id;
    }
  }

  // 4. Handle recovery / reset-password destination
  if (next && next.startsWith('/') && !next.startsWith('//')) {
    if (userId) {
      return createRedirect(next);
    }
    // If code exchange failed for reset password, redirect to login with confirmation_failed error
    return createRedirect('/login?error=confirmation_failed');
  }

  // 5. Handle authenticated user redirect (e.g. signup email confirmation)
  if (userId) {
    const serviceRole = createServiceRoleClient();
    const { data: profile } = await serviceRole
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (profile?.role === 'teacher') {
      return createRedirect('/teacher/exams');
    }
    return createRedirect('/exams');
  }

  // 6. Failed to confirm or exchange session
  return createRedirect('/login?error=confirmation_failed');
}
