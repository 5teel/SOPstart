/**
 * Phase 60 -- where a notification opens (D-07, T-60-11).
 *
 * Plain module, no directive. A place is a PATH only, built from fixed
 * templates: a home section (Phase 63) or a UUID-gated SOP address. The client
 * re-checks with isSafePlace before it navigates, so a bad stored value can
 * only ever land on the overview.
 */
import { focusHref } from '@/lib/sop/focus-path'
import { parsePlace, type Place } from '@/lib/shell/place'
import { formatHome, HOME } from '@/lib/shell/home-state'
import type { NotificationKind } from '@/lib/notifications/kinds'

export function notificationPlace(kind: NotificationKind, subject: { sopId?: string | null } = {}): string {
  switch (kind) {
    case 'approve_next':
    case 'review_due':
    case 'signoff':
      return formatHome({ ...HOME, s: 'signoffs' })
    case 'request_answered':
      return formatHome({ ...HOME, s: 'record' })
    case 'new_version':
    case 'asked':
      return focusHref(subject.sopId ?? '') // throws on anything but a UUID
  }
}

const UUID_SRC = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const QUERY = '[\\w=&%.:-]*' // no slash, backslash, colon-slash or space: nothing that can leave the site
const SAFE = new RegExp(`^(?:/|/\\?${QUERY}|/sops/${UUID_SRC}(?:\\?${QUERY})?)$`, 'i')

export function isSafePlace(place: unknown): place is string {
  return typeof place === 'string' && place.length <= 300 && SAFE.test(place)
}

export type PlaceTarget = { type: 'select'; place: Place } | { type: 'href'; href: string }

/** How the shell opens a stored place: select() for the site, a link for a SOP; unsafe = the overview. */
export function placeTarget(place: unknown): PlaceTarget {
  if (!isSafePlace(place)) return { type: 'select', place: { kind: 'overview' } }
  if (place.startsWith('/sops/')) return { type: 'href', href: place }
  const q = new URLSearchParams(place.slice(place.indexOf('?') + 1 || place.length))
  return { type: 'select', place: parsePlace(q.get('place'), q.get('tab')) }
}
