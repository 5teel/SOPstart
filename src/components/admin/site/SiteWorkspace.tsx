'use client'

/**
 * Phase 51 / Plan 51-05 (D-09, D-10, D-12) — the stateful workspace around the
 * Konva site editor: toolbar (draw/delete/save status), the canvas via
 * SiteEditorLoader (never SiteEditor directly — the konva-worker-isolation
 * gate forbids it), and the right-hand machine panel (rename, department,
 * SOP link/unlink).
 *
 * Every mutation flows through src/actions/site.ts — this component owns no
 * data of its own beyond optimistic local copies of the server rows.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { SiteEditorLoader } from './SiteEditorLoader'
import { deleteSiteMachine, setSopMachines, upsertSiteMachine } from '@/actions/site'
import type { Point, SiteData, SiteDepartment, SiteMachine, SiteSopOption, SopMachineLink } from '@/lib/validators/site'
import type { SceneEditorMachine } from '@/lib/site/scene'

const RENAME_DEBOUNCE_MS = 600

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface SiteWorkspaceProps {
  layout: NonNullable<SiteData['layout']>
  machines: SiteMachine[]
  links: SopMachineLink[]
  departments: SiteDepartment[]
  sops: SiteSopOption[]
}

export function SiteWorkspace({ layout, machines: initialMachines, links: initialLinks, departments, sops }: SiteWorkspaceProps) {
  const [machines, setMachines] = useState<SiteMachine[]>(initialMachines)
  const [links, setLinks] = useState<SopMachineLink[]>(initialLinks)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drawing, setDrawing] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [openSopsFor, setOpenSopsFor] = useState<string | null>(null)
  const [linkQuery, setLinkQuery] = useState('')

  // Rename is debounced per machine; the debounced save must read the LATEST
  // row (department/polygon may have changed since the keystroke), so it
  // reads this ref rather than the state closure captured at keystroke time.
  const machinesRef = useRef(machines)
  useEffect(() => {
    machinesRef.current = machines
  }, [machines])

  const nameInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const renameTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const pendingFocusId = useRef<string | null>(null)

  // Focus the name field exactly once, right after a freshly-drawn machine
  // is selected (not on every row click — that would steal focus on browse).
  useEffect(() => {
    if (selectedId && pendingFocusId.current === selectedId) {
      nameInputRefs.current[selectedId]?.focus()
      pendingFocusId.current = null
    }
  }, [selectedId])

  async function save<T>(fn: () => Promise<T>): Promise<T> {
    setSaveState('saving')
    const result = await fn()
    setSaveState(result && typeof result === 'object' && 'error' in result ? 'error' : 'saved')
    return result
  }

  async function handleCreate(polygon: Point[]) {
    setDrawing(false)
    const nextSort = machines.reduce((max, m) => Math.max(max, m.sort), -1) + 1
    const result = await save(() =>
      upsertSiteMachine({
        siteLayoutId: layout.id,
        name: `Machine ${machines.length + 1}`,
        departmentId: null,
        polygon,
        sort: nextSort,
      })
    )
    if ('error' in result) return
    setMachines((prev) => [...prev, result.machine])
    pendingFocusId.current = result.machine.id
    setSelectedId(result.machine.id)
  }

  async function handlePolygonChange(id: string, polygon: Point[]) {
    setMachines((prev) => prev.map((m) => (m.id === id ? { ...m, polygon } : m)))
    const machine = machines.find((m) => m.id === id)
    if (!machine) return
    const result = await save(() =>
      upsertSiteMachine({
        id,
        siteLayoutId: layout.id,
        name: machine.name,
        departmentId: machine.department_id,
        polygon,
      })
    )
    if (!('error' in result)) setMachines((prev) => prev.map((m) => (m.id === id ? result.machine : m)))
  }

  function handleRenameChange(id: string, name: string) {
    setMachines((prev) => prev.map((m) => (m.id === id ? { ...m, name } : m)))
    if (renameTimers.current[id]) clearTimeout(renameTimers.current[id])
    renameTimers.current[id] = setTimeout(() => {
      const machine = machinesRef.current.find((m) => m.id === id)
      if (!machine) return
      void save(() =>
        upsertSiteMachine({
          id,
          siteLayoutId: layout.id,
          name: machine.name,
          departmentId: machine.department_id,
          polygon: machine.polygon,
        })
      ).then((result) => {
        if (!('error' in result)) setMachines((prev) => prev.map((m) => (m.id === id ? result.machine : m)))
      })
    }, RENAME_DEBOUNCE_MS)
  }

  async function handleDepartmentChange(id: string, departmentId: string | null) {
    setMachines((prev) => prev.map((m) => (m.id === id ? { ...m, department_id: departmentId } : m)))
    const machine = machines.find((m) => m.id === id)
    if (!machine) return
    const result = await save(() =>
      upsertSiteMachine({
        id,
        siteLayoutId: layout.id,
        name: machine.name,
        departmentId,
        polygon: machine.polygon,
      })
    )
    if (!('error' in result)) setMachines((prev) => prev.map((m) => (m.id === id ? result.machine : m)))
  }

  const deleteSelected = useCallback(() => {
    if (!selectedId) return
    const machine = machines.find((m) => m.id === selectedId)
    if (!machine) return
    const linkedCount = links.filter((l) => l.machine_id === selectedId).length
    if (linkedCount > 0 && !window.confirm(`Delete ${machine.name}? It is linked to ${linkedCount} SOP(s).`)) return
    const id = selectedId
    void (async () => {
      const result = await save(() => deleteSiteMachine(id))
      if ('error' in result) return
      setMachines((prev) => prev.filter((m) => m.id !== id))
      setLinks((prev) => prev.filter((l) => l.machine_id !== id))
      setSelectedId(null)
      setOpenSopsFor(null)
    })()
  }, [selectedId, machines, links])

  useEffect(() => {
    function isTypingTarget(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false
      const tag = target.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (drawing) setDrawing(false)
        else setSelectedId(null)
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && !isTypingTarget(e.target)) {
        deleteSelected()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [drawing, deleteSelected])

  async function linkSop(sopId: string) {
    const machineId = openSopsFor
    if (!machineId) return
    const currentIds = links.filter((l) => l.sop_id === sopId).map((l) => l.machine_id)
    const machineIds = Array.from(new Set([...currentIds, machineId]))
    const result = await save(() => setSopMachines({ sopId, machineIds }))
    if ('error' in result) return
    setLinks((prev) => [
      ...prev.filter((l) => l.sop_id !== sopId),
      ...result.machineIds.map((machine_id) => ({ sop_id: sopId, machine_id })),
    ])
    setLinkQuery('')
  }

  async function unlinkSop(sopId: string, machineId: string) {
    const currentIds = links.filter((l) => l.sop_id === sopId).map((l) => l.machine_id)
    const machineIds = currentIds.filter((mid) => mid !== machineId)
    const result = await save(() => setSopMachines({ sopId, machineIds }))
    if ('error' in result) return
    setLinks((prev) => [
      ...prev.filter((l) => l.sop_id !== sopId),
      ...result.machineIds.map((machine_id) => ({ sop_id: sopId, machine_id })),
    ])
  }

  const deptById = new Map(departments.map((d) => [d.id, d]))
  const sceneMachines: SceneEditorMachine[] = machines.map((m) => ({
    id: m.id,
    name: m.name,
    polygon: m.polygon,
    colour: m.department_id ? (deptById.get(m.department_id)?.colour ?? null) : null,
  }))

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-ink-200 bg-paper-1 p-3">
        <button
          type="button"
          data-testid="site-draw-machine"
          aria-pressed={drawing}
          onClick={() => setDrawing((d) => !d)}
          className={`min-h-tap rounded-lg px-4 text-ui font-medium text-paper ${drawing ? 'bg-[var(--accent-step)]' : 'bg-ink-900'}`}
        >
          {drawing ? 'Drawing…' : 'Draw machine'}
        </button>
        <button
          type="button"
          data-testid="site-delete-machine"
          disabled={!selectedId}
          onClick={deleteSelected}
          className="min-h-tap rounded-lg border border-ink-300 px-4 text-ui text-ink-900 disabled:opacity-40"
        >
          Delete machine
        </button>
        <p className="text-meta text-ink-500">
          {drawing
            ? 'Click each corner, then click the first corner to finish · Esc to cancel'
            : 'Drag to move around · scroll to zoom · click a machine to edit it'}
        </p>
        <span
          data-testid="site-save-status"
          aria-live="polite"
          className={`ml-auto text-meta ${saveState === 'error' ? 'text-accent-hazard' : 'text-ink-500'}`}
        >
          {saveState === 'saving' && 'Saving…'}
          {saveState === 'saved' && 'Saved ✓'}
          {saveState === 'error' && "Couldn't save — try again"}
        </span>
        <span className="font-mono text-micro text-ink-500">
          {layout.scene_width ?? 0} × {layout.scene_height ?? 0} px
        </span>
      </div>

      <div className="flex gap-3">
        <div className="h-[72vh] min-h-120 min-w-0 flex-1 overflow-hidden rounded-lg border border-ink-200 bg-paper">
          <SiteEditorLoader
            sceneUrl={layout.sceneUrl}
            sceneWidth={layout.scene_width ?? 0}
            sceneHeight={layout.scene_height ?? 0}
            machines={sceneMachines}
            selectedId={selectedId}
            drawing={drawing}
            onSelect={setSelectedId}
            onCreate={handleCreate}
            onPolygonChange={handlePolygonChange}
          />
        </div>

        <div className="w-95 shrink-0 overflow-y-auto rounded-lg border border-ink-200 bg-paper-1 p-3">
          <h2 className="text-ui font-medium text-ink-900">Machines · {machines.length}</h2>

          {machines.length === 0 ? (
            <p className="mt-3 text-meta text-ink-500">
              No machines yet — press Draw machine and click the corners of one on the scene.
            </p>
          ) : (
            <div className="mt-3 flex flex-col gap-2">
              {machines.map((machine) => {
                const dept = machine.department_id ? deptById.get(machine.department_id) : undefined
                const sopCount = links.filter((l) => l.machine_id === machine.id).length
                const isSelected = machine.id === selectedId
                const sopsOpen = openSopsFor === machine.id
                const linkedSops = links
                  .filter((l) => l.machine_id === machine.id)
                  .map((l) => sops.find((s) => s.id === l.sop_id))
                  .filter((s): s is SiteSopOption => Boolean(s))
                const query = linkQuery.trim().toLowerCase()
                const linkResults =
                  sopsOpen && query.length > 0
                    ? sops
                        .filter((s) => !links.some((l) => l.sop_id === s.id && l.machine_id === machine.id))
                        .filter((s) => s.title.toLowerCase().includes(query))
                        .slice(0, 8)
                    : []

                return (
                  <div
                    key={machine.id}
                    className={`rounded-lg border p-3 ${isSelected ? 'border-[var(--accent-step)] bg-paper' : 'border-ink-200'}`}
                  >
                    <button
                      type="button"
                      data-testid="site-machine-row"
                      onClick={() => setSelectedId(machine.id)}
                      className="flex w-full items-start justify-between gap-2 text-left"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-mono text-ui text-ink-900">{machine.name}</span>
                        <span className="mt-0.5 flex items-center gap-1.5 text-meta text-ink-500">
                          {dept && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: dept.colour }} />}
                          {dept ? dept.name : 'No department'}
                        </span>
                      </span>
                      <span className="shrink-0 text-meta text-ink-500">
                        {sopCount} SOP{sopCount === 1 ? '' : 's'}
                      </span>
                    </button>

                    {isSelected && (
                      <div className="mt-2 flex flex-col gap-2">
                        <input
                          ref={(el) => {
                            nameInputRefs.current[machine.id] = el
                          }}
                          data-testid="site-machine-name"
                          aria-label="Machine name"
                          value={machine.name}
                          maxLength={80}
                          onChange={(e) => handleRenameChange(machine.id, e.target.value)}
                          className="min-h-tap w-full rounded-lg border border-ink-300 bg-paper px-3 text-ui text-ink-900"
                        />
                        <select
                          data-testid="site-machine-department"
                          aria-label="Department"
                          value={machine.department_id ?? ''}
                          onChange={(e) => void handleDepartmentChange(machine.id, e.target.value || null)}
                          className="min-h-tap w-full rounded-lg border border-ink-300 bg-paper px-3 text-ui text-ink-900"
                        >
                          <option value="">No department</option>
                          {departments.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <button
                      type="button"
                      data-testid="site-machine-sops-toggle"
                      onClick={() => setOpenSopsFor(sopsOpen ? null : machine.id)}
                      className="mt-2 text-meta text-ink-500 underline"
                    >
                      {sopsOpen ? 'Hide SOPs' : 'Show SOPs'}
                    </button>

                    {sopsOpen && (
                      <div className="mt-2 flex flex-col gap-1.5 border-t border-ink-200 pt-2">
                        {linkedSops.length === 0 && <p className="text-meta text-ink-500">No SOPs linked yet.</p>}
                        {linkedSops.map((sop) => (
                          <div key={sop.id} className="flex items-center justify-between gap-2 text-meta text-ink-900">
                            <span className="truncate">{sop.title}</span>
                            <button
                              type="button"
                              onClick={() => void unlinkSop(sop.id, machine.id)}
                              className="shrink-0 text-micro text-ink-500 underline"
                            >
                              Unlink
                            </button>
                          </div>
                        ))}
                        <input
                          data-testid="site-link-sop-input"
                          aria-label="Find a SOP to link"
                          value={linkQuery}
                          onChange={(e) => setLinkQuery(e.target.value)}
                          placeholder="Find a SOP to link…"
                          className="mt-1 min-h-tap w-full rounded-lg border border-ink-300 bg-paper px-3 text-ui text-ink-900"
                        />
                        {linkResults.length > 0 && (
                          <div className="flex flex-col gap-1">
                            {linkResults.map((s) => (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => void linkSop(s.id)}
                                className="rounded px-2 py-1 text-left text-meta text-ink-900 hover:bg-[var(--paper-2)]"
                              >
                                {s.title}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
