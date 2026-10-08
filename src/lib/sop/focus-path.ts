/**
 * Phase 58 -- addresses of the SOP focus screen (D-26, T-58-from, T-58-redirect).
 *
 * Plain module, no directive, no Next imports (the proxy imports it).
 * `from` is never carried raw: it passes the home-state whitelist and is
 * re-encoded by homeFrom, so a hostile token can only ever become the
 * home. Redirect destinations are fixed templates over a UUID-tested id.
 */
import { formatHome, homeFrom, homeFromToken } from '@/lib/shell/home-state'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function focusHref(sopId: string, opts: { mode?: 'edit'; from?: string | null } = {}): string {
  if (!UUID.test(sopId)) throw new Error('focusHref: not a SOP id')
  const q: string[] = []
  if (opts.mode === 'edit') q.push('mode=edit')
  const from = homeFrom(homeFromToken(opts.from))
  if (from) q.push(`from=${encodeURIComponent(from)}`)
  return `/sops/${sopId}${q.length ? `?${q.join('&')}` : ''}`
}

/** Where Back goes: the exact home state the screen was opened from, or the home for anything unknown. */
export const backHref = (from: string | null | undefined): string => formatHome(homeFromToken(from))

/** Old tabbed / builder / versions addresses -> the focus screen. null = not a legacy address. */
export function legacyRedirectFor(pathname: string, search: string): string | null {
  const tabbed = /^\/sops\/([^/]+)$/.exec(pathname)
  if (tabbed && UUID.test(tabbed[1])) {
    const params = new URLSearchParams(search)
    const tab = params.get('tab')
    return tab === 'walk' || tab === 'read' ? focusHref(tabbed[1], { from: params.get('from') }) : null
  }
  const admin = /^\/admin\/sops\/(?:builder\/([^/]+)|([^/]+)\/(?:versions|assign))$/.exec(pathname)
  const id = admin?.[1] ?? admin?.[2]
  return id && UUID.test(id) ? focusHref(id, { mode: 'edit' }) : null
}
