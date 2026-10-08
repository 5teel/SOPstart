'use client'

/**
 * Phase 63 (HOME-04) -- Sign-offs: every inbox item, the requests and, for an admin or
 * safety manager, the decision history. The pane is the Phase 59 body, unchanged; this file
 * only decides which tabs mount. Reached through next/dynamic from the home shell.
 */
import dynamic from 'next/dynamic'
import { tabsFor, type HomeTab } from '@/lib/shell/home-state'

const OfficePane = dynamic(() => import('@/components/office/OfficePane').then((m) => m.OfficePane), {
  ssr: false,
  loading: () => <p className="p-4 text-ui text-ink-500">Opening…</p>,
})

export function SignOffsSection({
  role,
  tab,
  onTab,
}: {
  role: string | null
  tab: HomeTab | null
  onTab(t: HomeTab): void
}) {
  return (
    <section data-testid="section-signoffs" className="flex flex-col">
      <div className="px-4 pt-4">
        <h2 className="text-xl font-semibold text-ink-900">Sign-offs</h2>
        <p className="text-ui text-ink-500">
          Completed SOPs, approvals and requests waiting on you. Each decision is logged in the decision ledger.
        </p>
      </div>
      <OfficePane tab={tab} tabs={tabsFor('signoffs', role)} onTab={onTab} />
    </section>
  )
}
