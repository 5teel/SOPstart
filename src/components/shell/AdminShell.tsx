'use client'

/**
 * Phase 57 -- the admin one screen (SHL-05, PLC-02..05). Reached only through the
 * next/dynamic import in OneScreen, so none of this rides in the worker bundle
 * (CLAUDE.md 2026-09-13). One read -- getAdminShell() -- feeds the machine
 * health, the room pins, the Office card and the Workshop list, so the pin and the
 * card can never disagree (D-16). Every badge and count comes from admin-health
 * and the action payload; this file only composes them.
 */
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getAdminShell } from '@/actions/shell'
import { listSiteForOrg } from '@/actions/site'
import { AdminMachineBody } from '@/components/admin/governance/AdminMachinePanel'
import { DepartmentsStrip } from '@/components/admin/site/DepartmentsStrip'
import { SiteEmptyState } from '@/components/admin/site/SiteEmptyState'
import { SiteWorkspace } from '@/components/admin/site/SiteWorkspace'
import { AccountControl } from '@/components/shell/AccountControl'
import { AdminNoticeboardBody, AdminWorkshopBody } from '@/components/shell/AdminRoomBodies'
import { NotificationBell } from '@/components/shell/NotificationBell'
import { OfficeCard } from '@/components/shell/OfficeCard'
import { useObjectives } from '@/components/shell/ObjectiveLine'
import { ObjectiveSlot } from '@/components/shell/ObjectiveSlot'
import { ShellFrame, type ShellSite } from '@/components/shell/ShellFrame'
import { SmokoBody } from '@/components/shell/RoomBodies'
import { SiteSummary } from '@/components/shell/SiteSummary'
import type { ShellProps } from '@/components/shell/WorkerShell'
import { healthPinCount, machineHealth, machinePanelSops, noticeboardSops } from '@/lib/sop/admin-health'
import type { Place } from '@/lib/shell/place'
import { tabsForRole } from '@/lib/shell/office-tabs'
import { SHELL_KEY } from '@/lib/shell/query-keys'
import { requestOverviewSection } from '@/lib/shell/overview-focus'
import { useRole } from '@/components/providers/RoleProvider'
import { zoneColour } from '@/lib/site/scene'

// The Office pane is its own chunk, reached only here and in WorkerShell (59 A-11).
const SiteOverview = dynamic(() => import('@/components/shell/SiteOverview').then((m) => m.SiteOverview), {
  ssr: false,
  loading: () => null,
})
const OfficePane = dynamic(() => import('@/components/office/OfficePane').then((m) => m.OfficePane), {
  ssr: false,
  loading: () => (
    <div data-testid="office-loading" className="p-4 text-ui text-ink-500">
      Opening the Office…
    </div>
  ),
})

const EMPTY_SITE: ShellSite = { layout: null, machines: [], links: [], departments: [] }
const SITE_KEY = ['site-org']

/** Edit mode: the departments strip over the site editor (or the empty state). */
function SiteEditSurface({ exit }: { exit(): void }) {
  const qc = useQueryClient()
  const { data: site } = useQuery({ queryKey: SITE_KEY, queryFn: () => listSiteForOrg() })
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: SHELL_KEY })
    void qc.invalidateQueries({ queryKey: SITE_KEY })
  }

  return (
    <div className="flex flex-col">
      <div className="flex min-h-tap items-center justify-between border-b border-ink-200 px-4">
        <p className="text-ui font-semibold text-ink-900">Editing the site</p>
        <button
          type="button"
          data-testid="site-edit-done"
          onClick={() => {
            refresh()
            exit()
          }}
          className="min-h-tap rounded-lg bg-ink-900 px-4 text-ui font-semibold text-white"
        >
          Done
        </button>
      </div>
      {!site ? (
        <p className="p-4 text-ui text-ink-500">Loading the site editor…</p>
      ) : 'error' in site ? (
        <p role="alert" className="p-4 text-ui text-accent-escalate">
          {site.error}
        </p>
      ) : (
        <>
          <DepartmentsStrip departments={site.departments} onChanged={refresh} />
          {site.layout ? (
            <SiteWorkspace
              key={site.layout.id}
              layout={site.layout}
              machines={site.machines}
              links={site.links}
              departments={site.departments}
              sops={site.sops}
              onDepartmentsChanged={refresh}
            />
          ) : (
            <SiteEmptyState canGenerate={site.canGenerate} onDone={() => void qc.invalidateQueries({ queryKey: SITE_KEY })} />
          )}
        </>
      )}
    </div>
  )
}

export function AdminShell({ siteName, userEmail, initialPlace, initialTab, initialSop }: ShellProps) {
  const role = useRole()
  // Same staleTime as the worker's site read: the signed scene URL rotates on
  // every refetch and must not swap on a window-focus refetch every minute.
  // Edits invalidate SHELL_KEY explicitly (SiteEditSurface.refresh).
  const { data: shell, isLoading, isError } = useQuery({
    queryKey: SHELL_KEY,
    queryFn: () => getAdminShell(),
    staleTime: 30 * 60 * 1000,
  })

  const objectives = useObjectives()

  const data = shell && !('error' in shell) ? shell : null
  const loadError = isError
    ? 'Could not load the site.'
    : shell && 'error' in shell
      ? shell.error
      : (data?.floorError ?? null)

  const site: ShellSite = data?.floor ?? EMPTY_SITE
  const rowsById = new Map((data?.governance ?? []).map((g) => [g.id, g]))
  const flagsBySop = new Map((data?.governance ?? []).map((g) => [g.id, g.flags]))
  const health = machineHealth(site.machines, site.links, flagsBySop)
  const siteSops = noticeboardSops(data?.siteSopIds ?? [], rowsById)
  const drafts = data?.drafts ?? []
  const inboxCount = data?.inboxCount ?? 0
  const published = (data?.governance ?? []).filter((g) => g.status === 'published').length
  const colourByDept = new Map(site.departments.map((d, i) => [d.id, zoneColour(d, i)]))
  const sopsById = new Map((data?.governance ?? []).map((g) => [g.id, { title: g.title ?? 'Untitled SOP' }]))

  function renderDetail(place: Place, ctx: { select: (p: Place) => void; query: string }) {
    if (place.kind === 'machine') {
      const machine = site.machines.find((m) => m.id === place.id)
      if (machine) {
        const dept = site.departments.find((d) => d.id === machine.department_id)
        return (
          <AdminMachineBody
            objective={
              <ObjectiveSlot
                subject={{ type: 'machine', id: machine.id }}
                current={objectives.find('machine', machine.id)}
                emptyLabel="Set an objective"
                emptyStyle="dashed"
              />
            }
            machine={{ id: machine.id, name: machine.name, spriteUrl: machine.spriteUrl }}
            department={dept ? { name: dept.name, colour: colourByDept.get(dept.id) ?? 'var(--ink-500)' } : null}
            sops={machinePanelSops(machine.id, site.links, rowsById)}
          />
        )
      }
    }
    if (place.kind === 'room') {
      if (place.id === 'office') {
        return <OfficePane place={place} select={ctx.select} initialSop={initialSop} />
      }
      if (place.id === 'smoko') {
        return (
          <SmokoBody>
            <Link
              href="/admin/training"
              className="flex min-h-tap items-center justify-center rounded-lg border border-ink-300 bg-white px-4 text-ui font-semibold text-ink-900"
            >
              Training matrix
            </Link>
          </SmokoBody>
        )
      }
      if (place.id === 'workshop') return <AdminWorkshopBody drafts={drafts} />
      const q = ctx.query.trim().toLowerCase()
      return <AdminNoticeboardBody sops={q ? siteSops.filter((s) => s.title.toLowerCase().includes(q)) : siteSops} />
    }
    return (
      <>
        <SiteSummary
          siteName={siteName}
          machines={site.machines.length}
          published={published}
          drafts={drafts.length}
          roleLine={`${data?.inboxChips.owner ?? 0} no owner · ${data?.inboxChips.overdue ?? 0} review overdue · ${data?.inboxChips.signoff ?? 0} waiting for sign-off`}
        />
        <SiteOverview
          role={role}
          select={ctx.select}
          machines={site.machines.map((m) => ({ id: m.id, name: m.name }))}
          departments={site.departments.map((d) => ({ id: d.id, name: d.name }))}
        />
      </>
    )
  }

  return (
    <ShellFrame
      site={site}
      // A failed read is not an undrawn site: hold the stage blank instead of
      // offering "Draw the site" over a site that exists (57 review WR-03).
      loading={isLoading || loadError !== null}
      initialPlace={initialPlace}
      initialTab={initialTab}
      officeTabs={tabsForRole(role)}
      canEdit
      sopsById={sopsById}
      siteSopTitles={siteSops.map((s) => s.title)}
      machineHealth={health}
      roomPins={{ office: inboxCount, workshop: drafts.length, noticeboard: healthPinCount(siteSops) }}
      renderCard={(select) =>
        loadError ? (
          <p role="alert" data-testid="shell-admin-error" className="m-3 text-ui text-accent-escalate">
            {loadError}
          </p>
        ) : (
          <OfficeCard
            count={inboxCount}
            label="to sort out in the Office"
            onOpen={() => select({ kind: 'room', id: 'office' })}
          />
        )
      }
      renderDetail={renderDetail}
      deptMeta={(id) => (
        <ObjectiveSlot
          subject={{ type: 'department', id }}
          current={objectives.find('department', id)}
          emptyLabel="Set an objective"
          emptyStyle="dashed"
        />
      )}
      renderBell={(select) => (
        <NotificationBell
          onOpen={() => {
            select({ kind: 'overview' })
            requestOverviewSection('notifications')
          }}
        />
      )}
      renderEdit={(exit) => <SiteEditSurface exit={exit} />}
      account={<AccountControl email={userEmail} isAdmin />}
    />
  )
}
