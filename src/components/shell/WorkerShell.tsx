'use client'

/**
 * Phase 57 -- the worker and supervisor one screen (SHL-01, SHL-02, SHL-05,
 * PLC-02, PLC-03, PLC-04). Feeds ShellFrame from the existing worker reads and
 * composes worker-signal.ts; it classifies nothing itself (CLAUDE.md 2026-09-27).
 * Admin-only modules are never imported here -- the admin view is the lazy
 * AdminShell seam in OneScreen.
 */
import dynamic from 'next/dynamic'
import { useQuery } from '@tanstack/react-query'
import { getOfficeInbox } from '@/actions/office'
import { listSiteForWorker } from '@/actions/site-worker'
import { AccountControl } from '@/components/shell/AccountControl'
import { OfficeCard } from '@/components/shell/OfficeCard'
import { ShellFrame, type ShellSite } from '@/components/shell/ShellFrame'
import {
  NoticeboardWorkerBody,
  OfficeWorkerBody,
  SmokoBody,
  WorkshopWorkerBody,
} from '@/components/shell/RoomBodies'
import { SiteSummary } from '@/components/shell/SiteSummary'
import { MachineBody } from '@/components/sop/plant/MachinePanel'
import { NowCard } from '@/components/sop/plant/NowCard'
import { useRole } from '@/components/providers/RoleProvider'
import { useWorkerSops } from '@/hooks/useWorkerSops'
import { zoneColour } from '@/lib/site/scene'
import type { Place } from '@/lib/shell/place'
import { tabsForRole } from '@/lib/shell/office-tabs'
import { officePinCount } from '@/lib/requests/model'
import { OFFICE_INBOX_KEY } from '@/lib/shell/query-keys'
import {
  compareToDoFirst,
  derivePlantPins,
  machineSops,
  narrowForAsk,
  pickNowQueue,
} from '@/lib/sop/worker-signal'

export interface ShellProps {
  siteName: string
  userEmail: string | null
  initialPlace: string | null
  initialTab: string | null
  /** UUID-gated `?sop=` (the Access tab pins one SOP); null when absent or not a UUID. */
  initialSop: string | null
}

// The supervisor's Office is the lazy pane; a worker never loads it (59 A-11).
const OfficePane = dynamic(() => import('@/components/office/OfficePane').then((m) => m.OfficePane), {
  ssr: false,
  loading: () => <p className="p-4 text-ui text-ink-500">Opening the Office…</p>,
})

// Raise and ask are lazy modules: neither rides in the home download (60 A-07).
const RequestComposerTrigger = dynamic(
  () => import('@/components/requests/RequestComposer').then((m) => m.RequestComposerTrigger),
  { ssr: false, loading: () => null },
)
const AskTrigger = dynamic(() => import('@/components/requests/AskPicker').then((m) => m.AskTrigger), {
  ssr: false,
  loading: () => null,
})

// The objective line is a lazy module: the static line cost the home download past its gate (60-13).
const WorkerObjective = dynamic(() => import('@/components/shell/WorkerObjective').then((m) => m.WorkerObjective), {
  ssr: false,
  loading: () => null,
})

const EMPTY_SITE: ShellSite = { layout: null, machines: [], links: [], departments: [] }

export function WorkerShell({ siteName, userEmail, initialPlace, initialTab, initialSop }: ShellProps) {
  const role = useRole()
  const isSupervisor = role === 'supervisor'

  // No persister: the signed scene URLs stay in memory only, and staleTime is
  // well under their 1hr TTL (T-52-02).
  const { data: siteResult, isLoading: siteLoading } = useQuery({
    queryKey: ['site-worker'],
    queryFn: () => listSiteForWorker(),
    staleTime: 30 * 60 * 1000,
  })
  const site: ShellSite = siteResult && !('error' in siteResult) ? siteResult : EMPTY_SITE

  const { workerSops, libraryLoading, assignmentsLoading, libraryError, refetchLibrary } = useWorkerSops()
  // The pane's own read (same key), so the pin always equals the Inbox list (A-11).
  const { data: inbox } = useQuery({
    queryKey: OFFICE_INBOX_KEY,
    queryFn: () => getOfficeInbox(),
    enabled: isSupervisor,
  })
  const inboxItems = inbox && !('error' in inbox) ? inbox.items : []
  const pending = inbox && !('error' in inbox) ? officePinCount(inbox.items, inbox.requests) : 0
  const signOffs = inboxItems.filter((i) => i.kind === 'signoff').length

  const sopsById = new Map(workerSops.map((s) => [s.id, s]))
  const machinePins = derivePlantPins(site.machines, site.links, sopsById)
  const siteSops = workerSops.filter((s) => s.raw.placement === 'site').sort(compareToDoFirst)
  const dueAt = (list: typeof workerSops) =>
    pickNowQueue(list, site.links, site.machines, site.departments, list.length).length
  const noticeboardDue = dueAt(siteSops)
  const dueTotal = dueAt(workerSops)
  const nowItems = pickNowQueue(workerSops, site.links, site.machines, site.departments, 3)
  const colourByDept = new Map(site.departments.map((d, i) => [d.id, zoneColour(d, i)]))

  const loading = siteLoading || libraryLoading || assignmentsLoading

  const loadError = (
    <div role="alert" data-testid="sops-load-error" className="flex flex-col items-start gap-3 p-4">
      <p className="text-reading text-accent-escalate">Could not load your SOPs. Check your connection and try again.</p>
      <button
        type="button"
        onClick={() => void refetchLibrary()}
        className="min-h-tap rounded-lg border border-ink-200 px-4 text-ui font-medium text-ink-900"
      >
        Try again
      </button>
    </div>
  )

  function renderDetail(place: Place, ctx: { select: (p: Place) => void; query: string }) {
    if (place.kind === 'machine') {
      if (libraryError) return loadError
      const machine = site.machines.find((m) => m.id === place.id)
      if (machine) {
        const dept = site.departments.find((d) => d.id === machine.department_id)
        const rows = machineSops(machine.id, site.links, sopsById)
        return (
          <MachineBody
            objective={<WorkerObjective type="machine" id={machine.id} />}
            machine={{ id: machine.id, name: machine.name, spriteUrl: machine.spriteUrl }}
            department={dept ? { name: dept.name, colour: colourByDept.get(dept.id) ?? 'var(--ink-500)' } : null}
            sops={narrowForAsk(ctx.query, machine.name, rows)}
            rowAction={
              isSupervisor
                ? (sop) => <AskTrigger sopId={sop.id} sopTitle={sop.title} variant="row" align="end" />
                : undefined
            }
            footer={
              <RequestComposerTrigger
                kinds={['change_sop', 'new_sop', 'observe_me']}
                about={{ sops: rows.map((s) => ({ id: s.id, title: s.title })), machines: [{ id: machine.id, name: machine.name }] }}
              />
            }
          />
        )
      }
    }
    if (place.kind === 'room') {
      if (place.id === 'office') {
        return isSupervisor ? (
          <OfficePane place={place} select={ctx.select} initialSop={initialSop} />
        ) : (
          <OfficeWorkerBody />
        )
      }
      if (place.id === 'smoko') return <SmokoBody />
      if (place.id === 'workshop') return <WorkshopWorkerBody />
      return libraryError ? loadError : <NoticeboardWorkerBody sops={siteSops} />
    }
    return (
      <SiteSummary
        siteName={siteName}
        machines={site.machines.length}
        published={workerSops.length}
        roleLine={
          isSupervisor
            ? `${signOffs} ${signOffs === 1 ? 'walk is' : 'walks are'} waiting for your sign-off.`
            : `${dueTotal} ${dueTotal === 1 ? 'SOP is' : 'SOPs are'} due for you.`
        }
      />
    )
  }

  return (
    <ShellFrame
      site={site}
      loading={siteLoading}
      initialPlace={initialPlace}
      initialTab={initialTab}
      officeTabs={tabsForRole(role)}
      canEdit={false}
      sopsById={sopsById}
      siteSopTitles={siteSops.map((s) => s.title)}
      machinePins={machinePins}
      roomPins={isSupervisor ? { office: pending, noticeboard: noticeboardDue } : { noticeboard: noticeboardDue }}
      renderCard={(select) => {
        if (isSupervisor) {
          return (
            <OfficeCard
              count={pending}
              label="waiting for you in the Office"
              onOpen={() => select({ kind: 'room', id: 'office' })}
            />
          )
        }
        if (loading) return null
        if (libraryError) return loadError
        return (
          <div className="m-3">
            <NowCard items={nowItems} />
          </div>
        )
      }}
      renderDetail={renderDetail}
      deptMeta={(id) => <WorkerObjective type="department" id={id} />}
      account={<AccountControl email={userEmail} isAdmin={false} />}
    />
  )
}
