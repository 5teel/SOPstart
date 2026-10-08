'use client'

/**
 * Phase 60 (SHL-03, NTF-01, RQS-01, RQS-03, D-13, A-06) -- the site overview body: the detail pane
 * with nothing selected, under the counts card. Objectives, then Notifications, then My requests,
 * then the Office line. A lazy module (next/dynamic only) with no stylesheet import.
 *
 * Notifications are read, counted and marked read with the BROWSER Supabase client under RLS:
 * there is no server action on this path (CLAUDE.md 2026-09-29, the Next 16.2.1 action-queue
 * orphan). Opening one navigates only inside the click handler, never from an effect.
 */
import { ChevronRight } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { getOfficeInbox } from '@/actions/office'
import { MyRequestsPanel } from '@/components/home/panels/MyRequestsPanel'
import { NotificationsPanel } from '@/components/home/panels/NotificationsPanel'
import { ObjectiveLine, useObjectives } from '@/components/shell/ObjectiveLine'
import { ObjectiveSlot } from '@/components/shell/ObjectiveSlot'
import { placeTarget } from '@/lib/notifications/places'
import { canAnswerRequests } from '@/lib/requests/model'
import { requestOverviewSection } from '@/lib/shell/overview-focus'
import type { Place } from '@/lib/shell/place'
import { OFFICE_INBOX_KEY } from '@/lib/shell/query-keys'

const HEADING = 'mono px-4 pb-1 pt-4 text-meta uppercase tracking-wide text-ink-500'

export interface SiteOverviewProps {
  role: string | null
  select: (place: Place) => void
  machines: ReadonlyArray<{ id: string; name: string }>
  departments: ReadonlyArray<{ id: string; name: string }>
}

export function SiteOverview({ role, select, machines, departments }: SiteOverviewProps) {
  const isAdmin = role === 'admin' || role === 'safety_manager'

  const { find } = useObjectives()
  const siteObjective = find('site', null)
  const deptObjectives = departments.flatMap((d) => {
    const o = find('department', d.id)
    return o ? [{ d, o }] : []
  })

  // Office line: roles that answer requests.
  const canAnswer = canAnswerRequests(role)
  const inboxQ = useQuery({
    queryKey: OFFICE_INBOX_KEY,
    queryFn: () => getOfficeInbox(),
    enabled: canAnswer,
  })
  const officeCount = inboxQ.data && !('error' in inboxQ.data) ? inboxQ.data.requests.length : 0

  return (
    <div data-testid="overview-body" className="px-4 pb-8">
      {(isAdmin || siteObjective || deptObjectives.length > 0) && (
        <section data-testid="overview-objectives" className="-mx-4">
          <h2 className={HEADING}>OBJECTIVES</h2>
          <div className="flex flex-col gap-2 px-4">
            {isAdmin ? (
              <ObjectiveSlot
                subject={{ type: 'site', id: null }}
                current={siteObjective}
                prefix="Site"
                emptyLabel="Set a site objective"
                emptyStyle="dashed"
              />
            ) : (
              siteObjective && <ObjectiveLine view={siteObjective} prefix="Site" />
            )}
            {deptObjectives.map(({ d, o }) => (
              <ObjectiveLine key={d.id} view={o} prefix={d.name} />
            ))}
          </div>
        </section>
      )}

      <NotificationsPanel
        onOpenAddress={(a) => {
          const t = placeTarget(a)
          if (t.type !== 'select') return
          select(t.place)
          if (t.place.kind === 'overview') requestOverviewSection('requests')
        }}
      />

      <MyRequestsPanel role={role} about={{ machines: [...machines], site: true }} />

      {canAnswer && officeCount > 0 && (
        <button
          type="button"
          data-testid="overview-office-link"
          onClick={() => select({ kind: 'room', id: 'office', tab: 'requests' })}
          className="mt-4 flex min-h-tap w-full items-center justify-between rounded-lg border border-ink-300 bg-paper-1 px-3 text-ui font-semibold text-ink-900"
        >
          <span>Open requests in the Office · {officeCount}</span>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
