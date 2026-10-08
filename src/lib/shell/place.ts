/**
 * Phase 57 -- the `?place=` address of the one screen (D-11, D-15a).
 *
 * Plain module, no directive. parsePlace is a whitelist: a room name, a UUID
 * (machine) or `dept:<UUID>`; every other token is the overview, and the raw
 * token is never carried into the result (T-57-01).
 */
import { ROOM_IDS, type RoomId } from '@/lib/site/rooms'
import { OFFICE_TABS, type OfficeTab } from '@/lib/shell/office-tabs'

export type Place =
  | { kind: 'overview' }
  | { kind: 'edit' }
  | { kind: 'room'; id: RoomId; tab?: Exclude<OfficeTab, 'inbox'> }
  | { kind: 'machine'; id: string }
  | { kind: 'dept'; id: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The tab is whitelisted and only the office room carries one; the inbox is the default and never written. */
export function parsePlace(token: string | null | undefined, tab?: string | null): Place {
  if (!token) return { kind: 'overview' }
  if (token === 'edit') return { kind: 'edit' }
  const room = ROOM_IDS.find((r) => r === token)
  if (room) {
    const t = room === 'office' ? OFFICE_TABS.find((x) => x === tab) : undefined
    return t && t !== 'inbox' ? { kind: 'room', id: room, tab: t } : { kind: 'room', id: room }
  }
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
      return place.tab ? `/?place=${place.id}&tab=${place.tab}` : `/?place=${place.id}`
    case 'machine':
      return `/?place=${place.id}`
    case 'dept':
      return `/?place=dept:${place.id}`
  }
}

/** Inverse of parsePlace: the `?place=` token for a place (null = overview, no token). */
export function placeToken(place: Place): string | null {
  switch (place.kind) {
    case 'overview':
      return null
    case 'edit':
      return 'edit'
    case 'room':
    case 'machine':
      return place.id
    case 'dept':
      return `dept:${place.id}`
  }
}
