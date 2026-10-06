'use client'

/**
 * Phase 57 -- the one screen's frame (SHL-01, SHL-02, SHL-04).
 *
 * Three panes -- list, isometric site, detail -- driven by ONE place state.
 * The map, the list and the detail close button all call `select()`, so a map
 * click and a list click give identical results by construction. Data-agnostic:
 * the worker and admin shells feed it rows and render the cards / detail bodies.
 *
 * The address bar follows the selection through the History API's replace call,
 * made only inside select() (a user event) -- no client-side navigation, and
 * never from an effect (CLAUDE.md 2026-05-13 and 2026-09-29). Below 1024px the
 * panes collapse by CSS alone; first render never branches on screen size (D-21).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Search, X } from 'lucide-react'
import { PlantStage, type PlantStageHandle } from '@/components/sop/plant/PlantStage'
import { ROOMS, ROOM_IDS, roomMatches, roomPolygon, type RoomId } from '@/lib/site/rooms'
import { zoneColour } from '@/lib/site/scene'
import { askMatches } from '@/lib/sop/worker-signal'
import { formatPlace, parsePlace, type Place } from '@/lib/shell/place'
import { isWidePlace, type OfficeTab } from '@/lib/shell/office-tabs'
import type { SiteDepartment, SopMachineLink, WorkerSiteLayout, WorkerSiteMachine } from '@/lib/validators/site'

export interface ShellSite {
  layout: WorkerSiteLayout | null
  machines: WorkerSiteMachine[]
  links: SopMachineLink[]
  departments: SiteDepartment[]
}

export interface ShellFrameProps {
  site: ShellSite
  loading: boolean
  initialPlace: string | null
  /** `?tab=` of the Office place; whitelisted by parsePlace. */
  initialTab?: string | null
  /** Tabs the signed-in role may open; any other tab renders as the Inbox. */
  officeTabs: ReadonlyArray<OfficeTab>
  canEdit: boolean
  sopsById: ReadonlyMap<string, { title: string }>
  /** Titles of site-wide SOPs -- a search hit on one lights the Noticeboard. */
  siteSopTitles: ReadonlyArray<string>
  machinePins?: ReadonlyMap<string, number>
  machineHealth?: ReadonlyMap<string, 'bad' | 'due' | 'ok'>
  roomPins: Partial<Record<RoomId, number>>
  renderCard(select: (p: Place) => void): ReactNode
  renderDetail(place: Place, ctx: { select: (p: Place) => void; query: string }): ReactNode
  renderEdit?(exit: () => void): ReactNode
  /** The department's objective line, directly under its name (60 D-11). */
  deptMeta?(deptId: string): ReactNode
  /** The notification bell beside search (60 D-09); not rendered while the site is drawn. */
  renderBell?(select: (p: Place) => void): ReactNode
  account: ReactNode
}

const OVERVIEW: Place = { kind: 'overview' }
const SECTION = 'mono px-3 pb-1 pt-3 text-micro uppercase tracking-wide text-ink-500'
const ROW =
  'flex min-h-tap w-full items-center gap-2 px-3 text-left text-ui text-ink-900 hover:bg-paper-2 aria-[current=true]:bg-paper-2 aria-[current=true]:font-semibold'

const HEALTH_DOT = {
  bad: 'bg-accent-escalate',
  due: 'bg-accent-decision',
  ok: 'bg-accent-ok',
} as const

/**
 * An unknown id, or edit without rights, is the overview (T-57-04/07); an Office
 * tab the role may not open is the Inbox (T-59-11). Pure -- never a redirect.
 */
function resolvePlace(
  place: Place,
  ctx: {
    canEdit: boolean
    loading: boolean
    machines: WorkerSiteMachine[]
    departments: SiteDepartment[]
    officeTabs: ReadonlyArray<OfficeTab>
  }
): Place {
  if (place.kind === 'edit') return ctx.canEdit ? place : OVERVIEW
  if (place.kind === 'room' && place.tab && !ctx.officeTabs.includes(place.tab)) return { kind: 'room', id: 'office' }
  if (ctx.loading) return place
  if (place.kind === 'machine') return ctx.machines.some((m) => m.id === place.id) ? place : OVERVIEW
  if (place.kind === 'dept') return ctx.departments.some((d) => d.id === place.id) ? place : OVERVIEW
  return place
}

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false
  return t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable
}

export function ShellFrame({
  site,
  loading,
  initialPlace,
  initialTab,
  officeTabs,
  canEdit,
  sopsById,
  siteSopTitles,
  machinePins,
  machineHealth,
  roomPins,
  renderCard,
  renderDetail,
  renderEdit,
  deptMeta,
  renderBell,
  account,
}: ShellFrameProps) {
  const [place, setPlace] = useState<Place>(() => parsePlace(initialPlace, initialTab))
  const [query, setQuery] = useState('')
  const stageRef = useRef<PlantStageHandle>(null)
  const { layout, machines, links, departments } = site

  // The place actually shown. An unknown id, or edit without rights, is the
  // overview -- resolved here in render, never by redirecting (T-57-04/07).
  const effective = resolvePlace(place, { canEdit, loading, machines, departments, officeTabs })
  const editing = effective.kind === 'edit' && renderEdit !== undefined
  const placeKey = formatPlace(effective)
  const wide = isWidePlace(effective)

  // The one writer of the place: state plus the address bar, from user events only.
  function select(p: Place) {
    setPlace(p)
    window.history.replaceState(null, '', formatPlace(p))
  }

  // Esc returns to the overview (not while typing, not in edit mode, and not when
  // a dialog, lightbox or other layer already took it -- A-12).
  const selectRef = useRef(select)
  useEffect(() => {
    selectRef.current = select
  })
  useEffect(() => {
    if (editing) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || isTypingTarget(e.target)) return
      if (e.defaultPrevented || document.querySelector('[aria-modal="true"]')) return
      selectRef.current(OVERVIEW)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing])

  // The camera follows the place. It never navigates.
  useEffect(() => {
    const stage = stageRef.current
    if (!stage || !layout || editing) return
    if (effective.kind === 'machine' || effective.kind === 'room') stage.flyTo(effective.id)
    else if (effective.kind === 'dept') {
      const deptId = effective.id
      stage.fitMachines(machines.filter((m) => m.department_id === deptId).map((m) => m.id))
    } else stage.fit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeKey, layout?.id, machines.length, editing])

  const machineHits = askMatches(query, machines, links, sopsById)
  const roomHits = roomMatches(query, siteSopTitles)
  const searching = query.trim() !== ''
  const colourByDept = new Map(departments.map((d, i) => [d.id, zoneColour(d, i)]))
  const shownDepartments = departments
    .filter((d) => machines.some((m) => m.department_id === d.id))
    .filter(
      (d) =>
        !searching ||
        d.name.toLowerCase().includes(query.trim().toLowerCase()) ||
        machines.some((m) => m.department_id === d.id && machineHits.has(m.id))
    )
  const shownMachines = searching ? machines.filter((m) => machineHits.has(m.id)) : machines
  const shownRooms = searching ? ROOMS.filter((r) => roomHits.has(r.id)) : ROOMS
  const nothing = searching && shownRooms.length === 0 && shownDepartments.length === 0 && shownMachines.length === 0

  const listPane = (
    <div className="flex w-full shrink-0 flex-col border-ink-200 lg:h-full lg:w-64 lg:border-r">
      <div className="flex-1 overflow-y-auto">
        <div className="flex items-center pr-2">
        <label className="relative flex min-h-tap min-w-0 flex-1 items-center px-3">
          <Search size={16} className="pointer-events-none absolute left-6 text-ink-500" aria-hidden="true" />
          <input
            type="search"
            data-testid="shell-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            aria-label="Search the site"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className="h-full w-full rounded-lg border border-ink-300 bg-white pl-9 pr-9 text-ui text-ink-900 placeholder:text-ink-500 focus:border-ink-900 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-4 flex h-8 w-8 items-center justify-center rounded text-ink-500 hover:text-ink-900"
            >
              <X size={14} />
            </button>
          )}
        </label>
        {!editing && renderBell?.(select)}
        </div>

        {renderCard(select)}

        {shownRooms.length > 0 && (
          <section>
            <h2 className={SECTION}>Rooms</h2>
            {shownRooms.map((r) => {
              const pin = roomPins[r.id] ?? 0
              return (
                <button
                  key={r.id}
                  type="button"
                  data-testid="shell-room-row"
                  data-room-id={r.id}
                  aria-current={effective.kind === 'room' && effective.id === r.id}
                  onClick={() => select({ kind: 'room', id: r.id })}
                  className={ROW}
                >
                  <span className="flex-1">{r.name}</span>
                  {pin > 0 && <span className="mono text-meta text-accent-decision">{pin}</span>}
                </button>
              )
            })}
          </section>
        )}

        {shownDepartments.length > 0 && (
          <section>
            <h2 className={SECTION}>Departments</h2>
            {shownDepartments.map((d) => (
              <button
                key={d.id}
                type="button"
                data-testid="shell-dept-row"
                data-dept-id={d.id}
                aria-current={effective.kind === 'dept' && effective.id === d.id}
                onClick={() => select({ kind: 'dept', id: d.id })}
                className={ROW}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded" style={{ background: colourByDept.get(d.id) }} />
                <span className="flex-1">{d.name}</span>
              </button>
            ))}
          </section>
        )}

        {shownMachines.length > 0 && (
          <section>
            <h2 className={SECTION}>Machines</h2>
            {shownMachines.map((m) => {
              const pin = machinePins?.get(m.id) ?? 0
              const health = machineHealth?.get(m.id)
              return (
                <button
                  key={m.id}
                  type="button"
                  data-testid="shell-machine-row"
                  data-machine-id={m.id}
                  aria-current={effective.kind === 'machine' && effective.id === m.id}
                  onClick={() => select({ kind: 'machine', id: m.id })}
                  className={ROW}
                >
                  <span className="flex-1">{m.name}</span>
                  {health ? (
                    <span className={`h-2 w-2 shrink-0 rounded-full ${HEALTH_DOT[health]}`} />
                  ) : (
                    pin > 0 && <span className="mono text-meta text-accent-decision">{pin}</span>
                  )}
                </button>
              )
            })}
          </section>
        )}

        {nothing && <p className="px-3 py-4 text-ui text-ink-500">Nothing matches</p>}
      </div>
      <div className="shrink-0">{account}</div>
    </div>
  )

  if (editing && renderEdit) {
    return (
      <div data-testid="shell" className="flex min-h-dvh flex-col bg-paper lg:h-dvh lg:flex-row">
        {listPane}
        <div className="min-w-0 flex-1 overflow-y-auto">{renderEdit(() => select(OVERVIEW))}</div>
      </div>
    )
  }

  const dept = effective.kind === 'dept' ? departments.find((d) => d.id === effective.id) : undefined

  return (
    <div data-testid="shell" className="flex min-h-dvh flex-col bg-paper lg:h-dvh lg:flex-row">
      {listPane}

      <div data-testid="shell-stage" className="relative hidden min-w-0 flex-1 lg:block">
        {layout ? (
          <PlantStage
            ref={stageRef}
            sceneUrl={layout.sceneUrl}
            sceneWidth={layout.sceneWidth}
            sceneHeight={layout.sceneHeight}
            flyInset={0}
            machines={machines.map((m) => ({
              id: m.id,
              name: m.name,
              polygon: m.polygon,
              pin: machinePins?.get(m.id) ?? 0,
              health: machineHealth?.get(m.id),
              highlighted: machineHits.has(m.id),
              selected: effective.kind === 'machine' && effective.id === m.id,
              zoned: effective.kind === 'dept' && m.department_id === effective.id,
              zoneColour: colourByDept.get(m.department_id ?? '') ?? 'var(--ink-500)',
            }))}
            rooms={ROOMS.map((r) => ({
              id: r.id,
              name: r.name,
              polygon: roomPolygon(r.id, layout.sceneWidth, layout.sceneHeight),
              pin: roomPins[r.id] ?? 0,
              highlighted: roomHits.has(r.id),
              selected: effective.kind === 'room' && effective.id === r.id,
            }))}
            onMachineClick={(id) => select({ kind: 'machine', id })}
            onRoomClick={(id) => {
              const room = ROOM_IDS.find((r) => r === id)
              if (room) select({ kind: 'room', id: room })
            }}
          />
        ) : loading ? (
          <div data-testid="shell-stage-loading" className="h-full" />
        ) : (
          <div data-testid="shell-no-site" className="grid h-full place-items-center p-6 text-center">
            <div className="flex flex-col items-center gap-3">
              <p className="text-ui text-ink-500">The site has not been drawn yet.</p>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => select({ kind: 'edit' })}
                  className="min-h-tap rounded-lg bg-ink-900 px-4 text-ui font-semibold text-white"
                >
                  Draw the site
                </button>
              )}
            </div>
          </div>
        )}
        {canEdit && layout && (
          <button
            type="button"
            data-testid="shell-edit-site"
            onClick={() => select({ kind: 'edit' })}
            className="absolute right-4 top-3.5 z-10 min-h-tap rounded-lg border border-ink-300 bg-white px-3 text-ui font-semibold text-ink-900 shadow"
          >
            Edit site
          </button>
        )}
        {layout && effective.kind === 'overview' && (
          <p className="mono pointer-events-none absolute bottom-4 right-4 text-meta text-ink-500">
            drag to pan · scroll to zoom · click a place
          </p>
        )}
      </div>

      <div
        data-testid="shell-detail"
        data-place={placeKey}
        data-wide={wide}
        className={`relative w-full shrink-0 overflow-y-auto border-ink-200 bg-paper lg:h-full lg:border-l ${
          wide ? 'lg:w-[58%] lg:min-w-140' : 'lg:w-100'
        }`}
      >
        {effective.kind !== 'overview' && (
          <button
            type="button"
            data-testid="shell-detail-close"
            onClick={() => select(OVERVIEW)}
            aria-label="Back to the site overview"
            className="absolute right-3 top-3 z-20 flex h-tap w-tap items-center justify-center rounded-lg text-ink-500 hover:text-ink-900"
          >
            <X size={18} />
          </button>
        )}
        <div key={placeKey}>
          {dept ? (
            <div className="p-4 pr-16">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-ink-900">
                <span className="h-2.5 w-2.5 rounded" style={{ background: colourByDept.get(dept.id) }} />
                {dept.name}
              </h2>
              {deptMeta && <div className="mt-1">{deptMeta(dept.id)}</div>}
              <div className="mt-3 flex flex-col">
                {machines
                  .filter((m) => m.department_id === dept.id)
                  .map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      data-testid="shell-dept-machine"
                      onClick={() => select({ kind: 'machine', id: m.id })}
                      className={ROW}
                    >
                      {m.name}
                    </button>
                  ))}
              </div>
            </div>
          ) : (
            renderDetail(effective, { select, query })
          )}
        </div>
      </div>
    </div>
  )
}
