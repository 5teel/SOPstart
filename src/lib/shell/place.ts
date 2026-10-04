/**
 * Phase 57 -- the `?place=` address of the one screen (D-11, D-15a).
 *
 * Plain module, no directive. parsePlace is a whitelist: a room name, a UUID
 * (machine) or `dept:<UUID>`; every other token is the overview, and the raw
 * token is never carried into the result (T-57-01).
 */
import { ROOM_IDS, type RoomId } from '@/lib/site/rooms'

export type Place =
  | { kind: 'overview' }
  | { kind: 'edit' }
  | { kind: 'room'; id: RoomId }
  | { kind: 'machine'; id: string }
  | { kind: 'dept'; id: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function parsePlace(token: string | null | undefined): Place {
  if (!token) return { kind: 'overview' }
  if (token === 'edit') return { kind: 'edit' }
  const room = ROOM_IDS.find((r) => r === token)
  if (room) return { kind: 'room', id: room }
  if (token.startsWith('dept:') && UUID.test(token.slice(5))) return { kind: 'dept', id: token.slice(5) }
  if (UUID.test(token)) return { kind: 'machine', id: token }
  return { kind: 'overview' }
}

export function formatPlace(place: Place): string {
  switch (place.kind) {
    case 'overview':
      return '/'
    case 'edit':
      return '/?place=edit'
    case 'room':
    case 'machine':
      return `/?place=${place.id}`
    case 'dept':
      return `/?place=dept:${place.id}`
  }
}

/**
 * Where a bridged page's "Back to the site" goes (D-15a). null = no Back bar
 * (a role-less user on /pending has no site to go back to).
 */
export function placeForPath(pathname: string): string | null {
  if (pathname === '/pending') return null
  if (['/governance', '/admin/team', '/admin/access', '/admin/settings'].includes(pathname)) return '/?place=office'
  if (pathname === '/activity' || pathname.startsWith('/activity/')) return '/?place=smoko'
  if (pathname === '/admin/sops/new' || pathname.startsWith('/admin/sops/new/') || pathname === '/admin/sops/upload') {
    return '/?place=workshop'
  }
  return '/'
}
