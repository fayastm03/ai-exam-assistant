import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

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
 * GET /api/auth/resend-confirmation?email=...
 * Checks whether an email address is already confirmed or needs confirmation.
 */
export async function GET(request: NextRequest) {
  try {
    const email = request.nextUrl.searchParams.get('email')?.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    const serviceRole = createServiceRoleClient();
    const { data: { users }, error } = await serviceRole.auth.admin.listUsers();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const user = users?.find((u) => u.email?.toLowerCase() === email);
    if (!user) {
      return NextResponse.json({ exists: false, confirmed: false });
    }

    const isConfirmed = Boolean(user.email_confirmed_at);
    return NextResponse.json({ exists: true, confirmed: isConfirmed });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error checking email status' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/auth/resend-confirmation
 * Resends the signup confirmation email or notifies the user if their email is already confirmed.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const next = typeof body.next === 'string' ? body.next : '';

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Valid email address is required.' },
        { status: 400 }
      );
    }

    const serviceRole = createServiceRoleClient();

    // 1. Check user status in Supabase Auth
    const {
      data: { users },
      error: listError,
    } = await serviceRole.auth.admin.listUsers();

    if (!listError && users) {
      const user = users.find((u) => u.email?.toLowerCase() === email);
      if (user && user.email_confirmed_at) {
        return NextResponse.json({
          status: 'already_confirmed',
          confirmed: true,
          message: 'Your email is already confirmed. You can sign in directly.',
        });
      }
    }

    // 2. If not confirmed, dispatch resend with correct canonical redirect URL
    const origin = resolveOrigin(request);
    const callbackUrl = next
      ? `${origin}/auth/callback?next=${encodeURIComponent(next)}`
      : `${origin}/auth/callback`;

    const { error: resendError } = await serviceRole.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: callbackUrl,
      },
    });

    if (resendError) {
      // Check for rate limit error
      if (
        resendError.message.toLowerCase().includes('rate limit') ||
        resendError.message.toLowerCase().includes('too many')
      ) {
        return NextResponse.json(
          {
            error:
              'Too many email requests were sent. Please wait a few minutes before trying again.',
          },
          { status: 429 }
        );
      }

      return NextResponse.json({ error: resendError.message }, { status: 400 });
    }

    return NextResponse.json({
      status: 'sent',
      confirmed: false,
      message: `Confirmation email resent to ${email}. Check your inbox and spam folder.`,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to resend confirmation email.' },
      { status: 500 }
    );
  }
}

