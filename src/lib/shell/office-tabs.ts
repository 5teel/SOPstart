/**
 * Phase 59 -- the Office tabs and who sees which (D-01, D-03, A-04).
 *
 * Plain module, no directive.
 */

export const OFFICE_TABS = ['inbox', 'requests', 'decisions', 'people', 'access'] as const
export type OfficeTab = (typeof OFFICE_TABS)[number]

/** Admin and safety manager see every tab; a supervisor the Inbox and Requests (A-04, D-03); everyone else none. */
export function tabsForRole(role: string | null): ReadonlyArray<OfficeTab> {
  if (role === 'admin' || role === 'safety_manager') return OFFICE_TABS
  if (role === 'supervisor') return ['inbox', 'requests']
  return []
}
