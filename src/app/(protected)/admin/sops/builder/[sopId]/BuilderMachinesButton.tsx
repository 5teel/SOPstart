'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { X } from 'lucide-react'
import { listSopMachines, setSopMachines } from '@/actions/site'
import type { SiteDepartment, SiteMachine } from '@/lib/validators/site'
import { placementLabel, placementSummary } from '@/lib/sop/placement'

/**
 * Phase 51 (51-06, D-12) — Tools-menu row + portaled modal for linking this
 * SOP to the site-map machines it belongs to. Writes through the exact same
 * setSopMachines() action the site edit mode uses (D-12), so the two
 * surfaces can never drift.
 *
 * Portaled modal shell: Escape closes, backdrop click closes,
 * createPortal to document.body.
 */

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export function BuilderMachinesButton({ sopId }: { sopId: string }) {
  const [open, setOpen] = useState(false)
  // ponytail: no separate `mounted` gate — `open` itself starts false and can
  // only flip true from a click (post-hydration), so the portal below never
  // evaluates document.body during SSR without one.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [machines, setMachines] = useState<SiteMachine[]>([])
  const [departments, setDepartments] = useState<SiteDepartment[]>([])
  const [linkedIds, setLinkedIds] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [saveState, setSaveState] = useState<SaveState>('idle')

  // Reset into "loading" the moment the modal opens, during render (not in an
  // effect) — mirrors PersonPanel.tsx's "adjusting state when a prop changes"
  // pattern (react-hooks/set-state-in-effect).
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setLoading(true)
      setLoadError(null)
    }
  }

  useEffect(() => {
    if (!open) return
    void listSopMachines(sopId).then((result) => {
      setLoading(false)
      if ('error' in result) {
        setLoadError(result.error)
        return
      }
      setMachines(result.machines)
      setDepartments(result.departments)
      setLinkedIds(result.linkedIds)
    })
  }, [open, sopId])

  // Named so the checkbox's onChange handler is traceable to the shared
  // setSopMachines() call (2026-06-05 — wiring, not just token presence).
  async function toggleMachine(machineId: string) {
    const previous = linkedIds
    const next = previous.includes(machineId)
      ? previous.filter((id) => id !== machineId)
      : [...previous, machineId]
    setLinkedIds(next)
    setSaveState('saving')
    const result = await setSopMachines({ sopId, machineIds: next })
    if ('error' in result) {
      setLinkedIds(previous)
      setSaveState('error')
      return
    }
    setLinkedIds(result.machineIds)
    setSaveState('saved')
  }

  // Same optimistic update + rollback as toggleMachine; empty list clears every link
  // and the sop_machines trigger flips sops.placement to 'site' (D-09).
  async function makeWholeSite() {
    const previous = linkedIds
    setLinkedIds([])
    setSaveState('saving')
    const result = await setSopMachines({ sopId, machineIds: [] })
    if ('error' in result) {
      setLinkedIds(previous)
      setSaveState('error')
      return
    }
    setLinkedIds(result.machineIds)
    setSaveState('saved')
  }

  const deptName = new Map(departments.map((d) => [d.id, d.name]))
  const placement = placementSummary(
    linkedIds.length ? 'machine' : 'site',
    machines
      .filter((m) => linkedIds.includes(m.id))
      .map((m) => ({ name: m.name, department: m.department_id ? (deptName.get(m.department_id) ?? null) : null })),
  )

  const query = search.trim().toLowerCase()
  const sortedDepartments = [...departments].sort((a, b) => a.name.localeCompare(b.name))
  const groups: { key: string; label: string; colour: string | null; machines: SiteMachine[] }[] = [
    ...sortedDepartments.map((d) => ({
      key: d.id,
      label: d.name,
      colour: d.colour,
      machines: machines
        .filter((m) => m.department_id === d.id)
        .filter((m) => m.name.toLowerCase().includes(query))
        .sort((a, b) => a.sort - b.sort),
    })),
    {
      key: 'none',
      label: 'No department',
      colour: null,
      machines: machines
        .filter((m) => m.department_id === null)
        .filter((m) => m.name.toLowerCase().includes(query))
        .sort((a, b) => a.sort - b.sort),
    },
  ].filter((g) => g.machines.length > 0)

  return (
    <>
      <button
        type="button"
        role="menuitem"
        onClick={() => setOpen(true)}
        className="flex w-full flex-col items-start gap-0.5 rounded px-3 py-2 text-left hover:bg-[var(--paper-2)] transition-colors"
      >
        <span className="text-ui text-[var(--ink-900)]">Pick machines for this SOP</span>
        <span className="text-micro text-[var(--ink-500)]">which machines on the site map this SOP belongs to</span>
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center sm:p-4"
            onClick={() => setOpen(false)}
          >
            <div
              data-testid="machines-picker"
              role="dialog"
              aria-label="Machines for this SOP"
              onClick={(e) => e.stopPropagation()}
              className="bg-[var(--paper)] w-full sm:max-w-2xl h-[88vh] sm:h-[75vh] sm:rounded-2xl overflow-hidden flex flex-col shadow-2xl"
            >
              <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--ink-100)] bg-white">
                <h2 className="text-base font-semibold text-[var(--ink-900)]">Machines for this SOP</h2>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="h-9 w-9 rounded-lg hover:bg-[var(--paper-2)] flex items-center justify-center text-[var(--ink-500)]"
                >
                  <X className="h-5 w-5" />
                </button>
              </header>

              {loading && <p className="p-4 text-meta text-[var(--ink-500)]">Loading machines…</p>}
              {loadError && <p className="p-4 text-meta text-[var(--accent-hazard)]">{loadError}</p>}

              {!loading && !loadError && machines.length === 0 && (
                <div className="p-4 flex flex-col gap-2">
                  <p className="text-meta text-[var(--ink-500)]">No machines on the site map yet.</p>
                  <Link href="/?place=edit" className="text-ui text-[var(--ink-900)] underline">
                    Open the site map
                  </Link>
                </div>
              )}

              {!loading && !loadError && machines.length > 0 && (
                <div className="flex-1 min-h-0 flex flex-col">
                  <div className="px-4 py-3 border-b border-[var(--ink-100)]">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <p data-testid="placement-line" className="text-ui text-[var(--ink-900)]">
                        Lives on: <span className="font-semibold">{placementLabel(placement)}</span>
                      </p>
                      {linkedIds.length > 0 && (
                        <button
                          type="button"
                          data-testid="placement-whole-site"
                          onClick={() => void makeWholeSite()}
                          className="min-h-tap rounded-lg border border-[var(--ink-300)] px-3 text-ui text-[var(--ink-900)] hover:bg-[var(--paper-2)]"
                        >
                          Whole site
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      aria-label="Find a machine"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Find a machine…"
                      className="min-h-tap w-full rounded-lg border border-[var(--ink-300)] bg-[var(--paper)] px-3 text-ui text-[var(--ink-900)]"
                    />
                    <span aria-live="polite" className="mt-1.5 block text-meta text-[var(--ink-500)]">
                      {saveState === 'saving' && 'Saving…'}
                      {saveState === 'saved' && 'Saved ✓'}
                      {saveState === 'error' && "Couldn't save — try again"}
                    </span>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 flex flex-col gap-4">
                    {groups.map((group) => (
                      <div key={group.key}>
                        <h3 className="flex items-center gap-1.5 text-meta font-medium text-[var(--ink-700)]">
                          {group.colour && (
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: group.colour }} />
                          )}
                          {group.label}
                        </h3>
                        <div className="mt-1.5 flex flex-col gap-1">
                          {group.machines.map((machine) => (
                            <label
                              key={machine.id}
                              className="flex min-h-tap items-center gap-2.5 rounded-lg px-2 hover:bg-[var(--paper-2)]"
                            >
                              <input
                                type="checkbox"
                                checked={linkedIds.includes(machine.id)}
                                onChange={() => void toggleMachine(machine.id)}
                                aria-label={machine.name}
                              />
                              <span className="text-ui text-[var(--ink-900)]">{machine.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
