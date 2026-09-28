'use client'

/**
 * The admin repaint of the Phase 52 floor (D-04/D-05/D-06) -- pins come from
 * machineHealth over the SAME governance rows the inbox shows, so the floor
 * and the inbox can never disagree. The scene renderer is lazy so it never
 * reaches a worker bundle: PlantStage is reached only through next/dynamic,
 * and its machine/prop shapes are matched structurally, never imported from
 * the plant directory (tests/phase52/plant-render-seam.spec.ts forbids any
 * static import, including `import type`, outside that directory).
 *
 * No camera fly, no router, no data fetching -- everything crosses as props
 * from the server /governance page.
 */
import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { machineHealth, machinePanelSops } from '@/lib/sop/admin-health'
import { zoneColour } from '@/lib/site/scene'
import { AdminMachinePanel } from './AdminMachinePanel'
import type { AdminSiteFloor } from '@/lib/validators/site'
import type { GovernanceRow } from '@/actions/governance'

const PlantStage = dynamic(() => import('@/components/sop/plant/PlantStage').then((m) => m.PlantStage), {
  ssr: false,
})

export function AdminFloorHealth({
  floor,
  governance,
}: {
  floor: AdminSiteFloor | { error: string }
  governance: GovernanceRow[]
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const ok = !('error' in floor)
  const hasSite = ok && floor.layout !== null && floor.machines.length > 0

  const derived = useMemo(() => {
    if (!hasSite) return null
    const site = floor as AdminSiteFloor
    const rowsById = new Map(governance.map((r) => [r.id, r]))
    const flagsBySop = new Map(governance.map((r) => [r.id, r.flags]))
    const health = machineHealth(site.machines, site.links, flagsBySop)
    const colourByDept = new Map(site.departments.map((d, i) => [d.id, zoneColour(d, i)]))
    const stageMachines = site.machines.map((m) => ({
      id: m.id,
      name: m.name,
      polygon: m.polygon,
      pin: 0,
      health: health.get(m.id),
      highlighted: false,
      selected: m.id === selectedId,
      zoned: false,
      zoneColour: colourByDept.get(m.department_id ?? '') ?? 'var(--ink-500)',
    }))
    const selected = site.machines.find((m) => m.id === selectedId) ?? null
    const selectedDept = selected
      ? (site.departments.find((d) => d.id === selected.department_id) ?? null)
      : null
    const panelSops = selected ? machinePanelSops(selected.id, site.links, rowsById) : []
    return { site, stageMachines, colourByDept, selected, selectedDept, panelSops }
  }, [hasSite, floor, governance, selectedId])

  if (!ok) {
    return (
      <div data-testid="floor-error" className="rounded-lg border border-[var(--ink-300)] bg-[var(--paper-1)] p-4 text-sm text-accent-escalate">
        {floor.error}
      </div>
    )
  }

  if (!hasSite || !derived) {
    return (
      <div data-testid="floor-no-site" className="rounded-lg border border-dashed border-[var(--ink-300)] bg-[var(--paper-1)] p-5">
        <p className="mono mb-1 text-meta uppercase tracking-widest text-[var(--ink-500)]">Floor health</p>
        <p className="mb-1.5 text-lg font-semibold text-[var(--ink-900)]">Draw your site</p>
        <p className="mb-3 text-ui text-[var(--ink-500)]">
          Draw your plant once and this shows which machines have procedures nobody looks after.
        </p>
        <Link href="/admin/site" className="evidence-btn !min-h-9 inline-flex text-sm">
          Open the site editor
        </Link>
      </div>
    )
  }

  const { stageMachines, colourByDept, selected, selectedDept, panelSops } = derived

  return (
    <section data-testid="floor-health" className="flex flex-col gap-2">
      <span className="mono text-meta uppercase tracking-widest text-[var(--ink-500)]">Floor health</span>
      <div className="relative h-80 overflow-hidden rounded-lg border border-[var(--ink-300)] bg-[var(--paper-2)]">
        <PlantStage
          sceneUrl={derived.site.layout!.sceneUrl}
          sceneWidth={derived.site.layout!.sceneWidth}
          sceneHeight={derived.site.layout!.sceneHeight}
          machines={stageMachines}
          onMachineClick={setSelectedId}
        />
      </div>
      <p className="text-meta text-[var(--ink-500)]">
        <span className="text-accent-escalate">!</span> no owner · <span className="text-accent-decision">↻</span> review overdue ·{' '}
        <span className="text-accent-ok">●</span> all fine
      </p>
      {selected && (
        <AdminMachinePanel
          machine={{ id: selected.id, name: selected.name, spriteUrl: selected.spriteUrl }}
          department={selectedDept ? { name: selectedDept.name, colour: colourByDept.get(selectedDept.id) ?? selectedDept.colour } : null}
          sops={panelSops}
          onClose={() => setSelectedId(null)}
        />
      )}
    </section>
  )
}
