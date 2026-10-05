/**
 * Phase 59 -- the Office tabs and who sees which (D-01, D-03, A-04).
 *
 * Plain module, no directive. Imports only the Place type so place.ts can
 * import the tab list without a cycle.
 */
import type { Place } from '@/lib/shell/place'

export const OFFICE_TABS = ['inbox', 'decisions', 'people', 'access'] as const
export type OfficeTab = (typeof OFFICE_TABS)[number]

/** Table tabs that need the wide detail pane (D-02). */
export const WIDE_TABS: ReadonlyArray<OfficeTab> = ['decisions', 'people', 'access']

/** Admin and safety manager see every tab; a supervisor the Inbox alone (A-04); everyone else none. */
export function tabsForRole(role: string | null): ReadonlyArray<OfficeTab> {
  if (role === 'admin' || role === 'safety_manager') return OFFICE_TABS
  if (role === 'supervisor') return ['inbox']
  return []
}

export function isWidePlace(place: Place): boolean {
  return place.kind === 'room' && place.id === 'office' && place.tab !== undefined && WIDE_TABS.includes(place.tab)
}
