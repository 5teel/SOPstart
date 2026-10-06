/**
 * Phase 60 (A-06) -- ask the site overview to scroll to one of its sections.
 *
 * Plain module, no directive. The bell, the worker Office card and an answered-request row
 * call requestOverviewSection(); the overview takes it on mount and on the window event.
 * It only scrolls and focuses -- nothing here navigates.
 */
export type OverviewSection = 'notifications' | 'requests'

export const OVERVIEW_SECTION_EVENT = 'overview-section'

let pending: OverviewSection | null = null

export function requestOverviewSection(section: OverviewSection): void {
  pending = section
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(OVERVIEW_SECTION_EVENT))
}

/** Returns the pending section and clears it. */
export function takeOverviewSection(): OverviewSection | null {
  const s = pending
  pending = null
  return s
}
