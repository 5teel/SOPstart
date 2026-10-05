'use client'

/**
 * Phase 57 -- the worker and supervisor one screen (SHL-01, SHL-02, SHL-05,
 * PLC-02, PLC-03, PLC-04). Feeds ShellFrame from the existing worker reads and
 * composes worker-signal.ts; it classifies nothing itself (CLAUDE.md 2026-09-27).
 * Admin-only modules are never imported here -- the admin view is the lazy
 * AdminShell seam in OneScreen.
 */
import { useQuery } from '@tanstack/react-query'
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
import { usePendingSignOffCount } from '@/hooks/useCompletions'
import { useWorkerSops } from '@/hooks/useWorkerSops'
import { zoneColour } from '@/lib/site/scene'
import type { Place } from '@/lib/shell/place'
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
}

const EMPTY_SITE: ShellSite = { layout: null, machines: [], links: [], departments: [] }

export function WorkerShell({ siteName, userEmail, initialPlace }: ShellProps) {
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
  const pending = usePendingSignOffCount(isSupervisor).data ?? 0

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
        return (
          <MachineBody
            machine={{ id: machine.id, name: machine.name, spriteUrl: machine.spriteUrl }}
            department={dept ? { name: dept.name, colour: colourByDept.get(dept.id) ?? 'var(--ink-500)' } : null}
            sops={narrowForAsk(ctx.query, machine.name, machineSops(machine.id, site.links, sopsById))}
          />
        )
      }
    }
    if (place.kind === 'room') {
      if (place.id === 'office') return <OfficeWorkerBody role={isSupervisor ? 'supervisor' : 'worker'} pending={pending} />
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
            ? `${pending} ${pending === 1 ? 'walk is' : 'walks are'} waiting for your sign-off.`
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
              label="waiting for your sign-off"
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
      account={<AccountControl email={userEmail} isAdmin={false} />}
    />
  )
}
