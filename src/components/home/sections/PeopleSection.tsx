'use client'

/**
 * Phase 63 (HOME-04) -- People: People & roles and the access wiring screen, for an admin
 * or safety manager. The pane is the Phase 59 body, unchanged; `pin` pins Access to one SOP.
 * Reached through next/dynamic from the home shell.
 */
import dynamic from 'next/dynamic'
import { tabsFor, type HomeTab } from '@/lib/shell/home-state'

const OfficePane = dynamic(() => import('@/components/office/OfficePane').then((m) => m.OfficePane), {
  ssr: false,
  loading: () => <p className="p-4 text-ui text-ink-500">Opening…</p>,
})

export function PeopleSection({
  role,
  tab,
  pin,
  onTab,
}: {
  role: string | null
  tab: HomeTab | null
  pin: string | null
  onTab(t: HomeTab): void
}) {
  return (
    <section data-testid="section-people" className="flex flex-col">
      <div className="px-4 pt-4">
        <h2 className="text-xl font-semibold text-ink-900">People</h2>
        <p className="text-ui text-ink-500">Who is in the organisation, their roles, and who can open which SOPs.</p>
      </div>
      <OfficePane tab={tab} tabs={tabsFor('people', role)} onTab={onTab} initialSop={pin} />
    </section>
  )
}
