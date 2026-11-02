import { NextRequest, NextResponse } from 'next/server';

export const DEFAULT_MAX_JSON_BYTES = 256 * 1024; // 256 KB
export const DEFAULT_MAX_UPLOAD_BYTES = 4.5 * 1024 * 1024; // 4.5 MB Vercel Serverless payload limit

/**
 * Checks request payload Content-Length against a maximum byte ceiling.
 */
export function checkBodySizeLimit(
  request: NextRequest,
  maxBytes: number = DEFAULT_MAX_JSON_BYTES
): { ok: true } | { ok: false; response: NextResponse } {
  const contentLength = request.headers.get('content-length');
  if (contentLength) {
    const bytes = parseInt(contentLength, 10);
    if (!isNaN(bytes) && bytes > maxBytes) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            error: 'Payload Too Large',
            message: `Request payload exceeds the ${Math.round(maxBytes / 1024)}KB limit.`,
          },
          { status: 413 }
        ),
      };
    }
  }
  return { ok: true };
}
