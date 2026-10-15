'use client'

/**
 * Phase 63 (HOME-04) -- Sign-offs: every inbox item, the requests, your own record (Mine, the old
 * My record section, 2026-10-15) and, for an admin or safety manager, the decision history. A worker's
 * only tab is Mine, so they get My record alone, without the pane (its inbox read refuses them). The pane is the Phase 59 body, unchanged; this file
 * only decides which tabs mount. Reached through next/dynamic from the home shell.
 */
import dynamic from 'next/dynamic'
import { tabsFor, type HomeState, type HomeTab } from '@/lib/shell/home-state'
import { MyRecordSection } from '@/components/home/sections/MyRecordSection'

const OfficePane = dynamic(() => import('@/components/office/OfficePane').then((m) => m.OfficePane), {
  ssr: false,
  loading: () => <p className="p-4 text-ui text-ink-500">Opening…</p>,
})

export function SignOffsSection({
  role,
  tab,
  onTab,
  onHome,
}: {
  role: string | null
  tab: HomeTab | null
  onTab(t: HomeTab): void
  onHome(state: HomeState): void
}) {
  const tabs = tabsFor('signoffs', role)
  if (tabs.length === 1) {
    return (
      <section data-testid="section-signoffs" className="flex flex-col">
        <MyRecordSection role={role} onHome={onHome} whole />
      </section>
    )
  }
  return (
    <section data-testid="section-signoffs" className="flex flex-col">
      <div className="px-4 pt-4">
        <h2 className="text-xl font-semibold text-ink-900">Sign-offs</h2>
      </div>
      <OfficePane tab={tab} tabs={tabs} onTab={onTab} mine={<MyRecordSection role={role} onHome={onHome} />} />
    </section>
  )
}
