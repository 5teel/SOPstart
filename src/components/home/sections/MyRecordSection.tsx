'use client'

/**
 * Phase 63 (HOME-04) -- My record, for everyone: what the person has done and who signed it off,
 * their notifications and their requests. Objectives are not here (the map header shows them,
 * Manage edits them). A stored notification place becomes a home state through homeFromAddress.
 * Reached through next/dynamic from the home shell.
 */
import { CompletionList } from '@/components/home/sections/CompletionList'
import { MyRequestsPanel } from '@/components/home/panels/MyRequestsPanel'
import { NotificationsPanel } from '@/components/home/panels/NotificationsPanel'
import { HOME, homeFromAddress, type HomeState } from '@/lib/shell/home-state'

export function MyRecordSection({ role, onHome }: { role: string | null; onHome(state: HomeState): void }) {
  return (
    <section data-testid="section-record" className="flex flex-col gap-3 p-4">
      <div>
        <h2 className="text-xl font-semibold text-ink-900">My record</h2>
        <p className="text-ui text-ink-500">What you&apos;ve done and who signed it off.</p>
      </div>
      <CompletionList />
      <NotificationsPanel onOpenAddress={(a) => onHome(homeFromAddress(a) ?? HOME)} />
      <MyRequestsPanel role={role} about={{ site: true }} />
    </section>
  )
}
