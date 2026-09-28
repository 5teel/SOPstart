/**
 * Phase 53 -- the one guard for `?next=` (T-53-03).
 *
 * Plain module, carries no directive of its own -- middleware, a server
 * action and a server page all import it; a sync export inside a
 * server-action file breaks next build (CLAUDE.md 2026-06-27).
 */
const MAX_LEN = 512
const CONTROL_CHAR = /[\u0000-\u001f\u007f]/

export function safeNextPath(next: string | null | undefined): string | null {
  if (typeof next !== 'string') return null
  if (next.length === 0 || next.length > MAX_LEN) return null
  if (!next.startsWith('/')) return null
  if (next.startsWith('//')) return null
  if (next.includes('\\')) return null
  if (CONTROL_CHAR.test(next)) return null

  let url: URL
  try {
    url = new URL(next, 'https://next.invalid')
  } catch {
    return null
  }
  if (url.origin !== 'https://next.invalid') return null
  if (url.pathname === '/login' || url.pathname.startsWith('/login/') || url.pathname.startsWith('/api/')) {
    return null
  }
  return url.pathname + url.search + url.hash
}
