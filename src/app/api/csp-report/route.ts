/**
 * Phase 68 / ADR-0030: the CSP report-uri. Public and unauthenticated (exempted in src/lib/supabase/middleware.ts).
 * Logs only the blocked directive and the blocked URL without its query string; never the body or cookies.
 * The body is capped; anything larger or malformed is dropped. Always 204.
 */
const MAX_BYTES = 8 * 1024

async function readCapped(req: Request): Promise<string | null> {
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BYTES || !req.body) return null
  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_BYTES) { await reader.cancel(); return null }
    chunks.push(value)
  }
  return Buffer.concat(chunks).toString('utf8')
}

// No query string or fragment (signed URLs carry tokens), printable ASCII only, short.
function clean(v: unknown): string {
  return typeof v === 'string' ? v.split(/[?#]/)[0].replace(/[^\x20-\x7e]/g, '').slice(0, 200) : '-'
}

export async function POST(req: Request) {
  try {
    const text = await readCapped(req)
    const r = text ? (JSON.parse(text) as { 'csp-report'?: Record<string, unknown> })['csp-report'] : null
    if (r) console.warn('[csp]', clean(r['effective-directive'] ?? r['violated-directive']), clean(r['blocked-uri']))
  } catch { /* malformed report: drop it */ }
  return new Response(null, { status: 204 })
}
