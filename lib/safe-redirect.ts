/**
 * Safe redirect URL validation utility.
 * Prevents Open Redirect vulnerabilities by strictly permitting same-origin relative paths.
 */
export function getSafeRedirectUrl(
  targetUrl: string | null | undefined,
  fallbackUrl: string = '/exams'
): string {
  if (!targetUrl || typeof targetUrl !== 'string') {
    return fallbackUrl;
  }

  const trimmed = targetUrl.trim();

  // Must begin with a single slash, not protocol-relative '//', and not contain backslashes or carriage returns
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) {
    return fallbackUrl;
  }

  // Parse path with dummy origin to verify host/protocol cannot be spoofed
  try {
    const dummyOrigin = 'http://localhost';
    const parsed = new URL(trimmed, dummyOrigin);
    if (parsed.origin !== dummyOrigin) {
      return fallbackUrl;
    }

    // Must be a relative path
    const safePath = parsed.pathname + parsed.search + parsed.hash;
    return safePath;
  } catch {
    return fallbackUrl;
  }
}
