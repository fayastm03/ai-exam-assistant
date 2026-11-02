import { NextRequest, NextResponse } from 'next/server';

/**
 * Validates request origin on state-changing operations (POST, PUT, PATCH, DELETE)
 * to prevent Cross-Site Request Forgery (CSRF).
 */
export function verifyCsrfOrigin(request: NextRequest): { ok: true } | { ok: false; response: NextResponse } {
  const method = request.method.toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return { ok: true };
  }

  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  const forwardedHost = request.headers.get('x-forwarded-host');

  // If origin is not provided (e.g. non-browser automated client / same-origin direct fetch), allow
  if (!origin) {
    return { ok: true };
  }

  try {
    const originUrl = new URL(origin);
    const expectedHost = forwardedHost || host;

    if (expectedHost && originUrl.host.toLowerCase() === expectedHost.toLowerCase()) {
      return { ok: true };
    }

    // Also compare against NEXT_PUBLIC_SITE_URL if configured
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (siteUrl) {
      const siteHost = new URL(siteUrl).host;
      if (originUrl.host.toLowerCase() === siteHost.toLowerCase()) {
        return { ok: true };
      }
    }

    // Localhost in dev mode
    if (originUrl.hostname === 'localhost' || originUrl.hostname === '127.0.0.1') {
      return { ok: true };
    }

    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Forbidden', message: 'CSRF Origin check failed: Cross-site request rejected' },
        { status: 403 }
      ),
    };
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Forbidden', message: 'Invalid Origin header' },
        { status: 403 }
      ),
    };
  }
}
