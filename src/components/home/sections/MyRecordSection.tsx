'use client'

/**
 * Phase 63 (HOME-04) -- My record, for everyone (since 2026-10-15 the Sign-offs Mine tab; a worker's whole section): what the person has done and who signed it off,
 * their notifications and their requests. Objectives are not here (the map header shows them,
 * Manage edits them). A stored notification place becomes a home state through homeFromAddress.
 * Rendered by SignOffsSection.
 */
import { CompletionList } from '@/components/home/sections/CompletionList'
import { MyRequestsPanel } from '@/components/home/panels/MyRequestsPanel'
import { NotificationsPanel } from '@/components/home/panels/NotificationsPanel'
import { HOME, homeFromAddress, type HomeState } from '@/lib/shell/home-state'

/** `whole` when it is the whole section (a worker); as a tab the Sign-offs heading is enough. */
export function MyRecordSection({ role, onHome, whole = false }: { role: string | null; onHome(state: HomeState): void; whole?: boolean }) {
  return (
    <section data-testid="section-record" className={`flex flex-col gap-3 ${whole ? 'p-4' : 'pt-1'}`}>
      {whole && <h2 className="text-xl font-semibold text-ink-900">My record</h2>}
      <CompletionList onHome={onHome} />
      <NotificationsPanel onOpenAddress={(a) => onHome(homeFromAddress(a) ?? HOME)} />
      <MyRequestsPanel role={role} about={{ site: true }} />
    </section>
  )
}
