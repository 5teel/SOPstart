/**
 * Phase 68 / ADR-0030: the Content-Security-Policy, built per request in src/proxy.ts with a fresh nonce.
 * Next reads the nonce from the request's CSP header and tags its own scripts with it.
 * The Supabase host comes from NEXT_PUBLIC_SUPABASE_URL (REST, Auth, Realtime, Storage signed URLs).
 */
export const CSP_HEADER = 'Content-Security-Policy-Report-Only'

export function buildCsp(nonce: string, supabaseUrl: string): string {
  const host = new URL(supabaseUrl).host
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    // Tailwind and next/font inject inline styles; style injection is the accepted residual (ADR-0030).
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: https://${host}`,
    "font-src 'self'",
    `connect-src 'self' https://${host} wss://${host}`,
    `media-src 'self' blob: https://${host}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
    'report-uri /api/csp-report',
  ].join('; ')
}
