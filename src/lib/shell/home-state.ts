/**
 * Phase 63 -- the one whitelisted address of the home (HOME-05, T-63-04/05).
 *
 * Plain module, no directive, no Next imports (the proxy imports it).
 * Query: s (section, default sops, omitted) | sop | area (sops only) | tab
 * (signoffs, people only) | pin (people + access only) | view=site (manage only).
 * Every value is whitelisted and the raw token is never carried into the
 * result: a hostile string can only ever become the default home. Legacy place
 * tokens (old links, stored notification places, focus `from` tokens) resolve
 * through legacyToHome.
 */
import { isSafePlace } from '@/lib/notifications/places'

export const SECTIONS = ['sops', 'record', 'training', 'signoffs', 'people', 'manage'] as const
export type Section = (typeof SECTIONS)[number]

const TABS = ['inbox', 'requests', 'decisions', 'people', 'access'] as const
export type HomeTab = (typeof TABS)[number]

export interface HomeState {
  s: Section
  sop: string | null
  area: string | null
  /** null = the section's first tab (inbox for signoffs, people for people). */
  tab: HomeTab | null
  pin: string | null
  view: 'site' | null
}

export const HOME: HomeState = { s: 'sops', sop: null, area: null, tab: null, pin: null, view: null }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const uuid = (v: string | null | undefined): string | null => (v && UUID.test(v) ? v.toLowerCase() : null)
const isAdminish = (role: string | null) => role === 'admin' || role === 'safety_manager'

export function sectionsForRole(role: string | null): ReadonlyArray<Section> {
  if (isAdminish(role)) return SECTIONS
  if (role === 'supervisor') return ['sops', 'record', 'signoffs']
  if (role === 'worker') return ['sops', 'record']
  return ['sops']
}

export function tabsFor(section: Section, role: string | null): ReadonlyArray<HomeTab> {
  if (section === 'signoffs') {
    if (isAdminish(role)) return ['inbox', 'requests', 'decisions']
    if (role === 'supervisor') return ['inbox', 'requests']
  }
  if (section === 'people' && isAdminish(role)) return ['people', 'access']
  return []
}

/** Role-free structure: which fields a section can carry; defaults collapse to null. */
function norm(x: { s: Section; sop?: string | null; area?: string | null; tab?: string | null; pin?: string | null; view?: string | null }): HomeState {
  const s = x.s
  const area = x.area === 'site-wide' ? x.area : uuid(x.area)
  let tab: HomeTab | null = null
  if (s === 'signoffs' && (x.tab === 'requests' || x.tab === 'decisions')) tab = x.tab
  if (s === 'people' && x.tab === 'access') tab = 'access'
  return {
    s,
    sop: s === 'sops' ? uuid(x.sop) : null,
    area: s === 'sops' ? area : null,
    tab,
    pin: s === 'people' && tab === 'access' ? uuid(x.pin) : null,
    view: s === 'manage' && x.view === 'site' ? 'site' : null,
  }
}

export function parseHome(search: string | URLSearchParams | null | undefined): HomeState {
  const q = typeof search === 'string' ? new URLSearchParams(search.replace(/^\?/, '')) : (search ?? new URLSearchParams())
  const s = SECTIONS.find((x) => x === q.get('s')) ?? 'sops'
  return norm({ s, sop: q.get('sop'), area: q.get('area'), tab: q.get('tab'), pin: q.get('pin'), view: q.get('view') })
}

/** Inverse of parseHome for every canonical state; HOME is '/'. */
export function formatHome(state: HomeState): string {
  const s = norm(state)
  const q: string[] = []
  if (s.s !== 'sops') q.push(`s=${s.s}`)
  if (s.sop) q.push(`sop=${s.sop}`)
  if (s.area) q.push(`area=${s.area}`)
  if (s.tab) q.push(`tab=${s.tab}`)
  if (s.pin) q.push(`pin=${s.pin}`)
  if (s.view) q.push(`view=${s.view}`)
  return q.length ? `/?${q.join('&')}` : '/'
}

/** A section the role cannot open is the home; a tab it cannot see is the first tab. Data stays gated server-side regardless. */
export function resolveHome(state: HomeState, role: string | null): HomeState {
  if (!sectionsForRole(role).includes(state.s)) return HOME
  const tab = state.tab && tabsFor(state.s, role).includes(state.tab) ? state.tab : null
  return norm({ ...state, tab })
}

/** Old `?place=` tokens (and their tab / sop) -> the home. Anything unknown is the home. */
export function legacyToHome(place: string | null | undefined, tab?: string | null, sop?: string | null): HomeState {
  switch (place) {
    case 'office':
      if (tab === 'people' || tab === 'access') return norm({ s: 'people', tab, pin: sop })
      return norm({ s: 'signoffs', tab })
    case 'smoko':
      return { ...HOME, s: 'record' }
    case 'workshop':
      return { ...HOME, s: 'manage' }
    case 'edit':
      return { ...HOME, s: 'manage', view: 'site' }
    case 'noticeboard':
      return HOME
  }
  if (place?.startsWith('dept:')) return norm({ s: 'sops', area: place.slice(5) })
  return HOME
}

/**
 * A stored or typed address. null = not a home address (a focus-screen path);
 * anything isSafePlace refuses is the home.
 */
export function homeFromAddress(address: unknown): HomeState | null {
  if (!isSafePlace(address)) return HOME
  if (address.startsWith('/sops/')) return null
  const q = new URLSearchParams(address.slice(address.indexOf('?') + 1 || address.length))
  return q.has('place') ? legacyToHome(q.get('place'), q.get('tab'), q.get('sop')) : parseHome(q)
}

/** The focus `from` token: the home query itself ('' for the home). */
export const homeFrom = (state: HomeState): string => formatHome(state).replace(/^\/\??/, '')

/** A token containing '=' is a home query; otherwise a legacy place token. Never returned as text. */
export function homeFromToken(token: string | null | undefined): HomeState {
  if (!token) return HOME
  return token.includes('=') ? parseHome(token) : legacyToHome(token)
}

const at = (s: Section) => formatHome({ ...HOME, s })

// ponytail: lives in its own module so the protected layout's Back bar does not pull this one into a shared chunk (bundle gate, 63-13).
export { backForPath } from '@/lib/shell/back-path'

/**
 * The old governance, team and access addresses (and the old list views that led
 * to them). Fixed templates; the sop value is appended as pin only when it is a
 * UUID and nothing else from the query is carried (T-59-47, T-63-36). null = not legacy.
 */
export function legacyPathRedirect(pathname: string, search: string): string | null {
  const params = new URLSearchParams(search)
  const view = params.get('view')
  const access = formatHome(norm({ s: 'people', tab: 'access', pin: params.get('sop') }))
  if (pathname === '/governance') return view === 'library' ? '/' : at('signoffs')
  if (pathname === '/admin/team') return at('people')
  if (pathname === '/admin/access') return access
  if (pathname === '/sops') return view === 'attention' ? at('signoffs') : view === 'access' ? access : '/'
  return null
}
