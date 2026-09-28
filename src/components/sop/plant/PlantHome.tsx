'use client'

/**
 * The worker desktop home (D-01) -- loaded only via next/dynamic({ ssr:false })
 * from src/app/(protected)/sops/page.tsx. Composition only: every count and
 * ordering comes from worker-signal.ts, every camera move goes through
 * PlantStage's imperative handle (fit/flyTo/fitMachines). The heavy canvas
 * engine PlantStage already keeps out stays out here too -- this file adds
 * no rendering engine, no persistence, and no navigation side effects of
 * its own; state is plain useState (D-08/D-09).
 */
import { useMemo, useRef, useState } from 'react'
import { PlantStage, type PlantStageHandle, type PlantStageMachine } from '@/components/sop/plant/PlantStage'
import { MachinePanel } from '@/components/sop/plant/MachinePanel'
import { NowCard } from '@/components/sop/plant/NowCard'
import { PlantAskBar } from '@/components/sop/plant/PlantAskBar'
import {
  askMatches,
  derivePlantPins,
  machineSops,
  narrowForAsk,
  pickNowQueue,
  plantRelState,
  type WorkerSop,
} from '@/lib/sop/worker-signal'
import { zoneColour } from '@/lib/site/scene'
import type { WorkerSiteData } from '@/lib/validators/site'

export function PlantHome({
  site,
  sops,
  loading,
  query,
  onQueryChange,
}: {
  site: WorkerSiteData
  sops: WorkerSop[]
  loading: boolean
  query: string
  onQueryChange(q: string): void
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [zoneId, setZoneId] = useState<string | null>(null)
  const stageRef = useRef<PlantStageHandle>(null)

  const derived = useMemo(() => {
    const sopsById = new Map(sops.map((s) => [s.id, s]))
    const pins = derivePlantPins(site.machines, site.links, sopsById)
    const highlighted = askMatches(query, site.machines, site.links, sopsById)
    const colourByDept = new Map(site.departments.map((d, i) => [d.id, zoneColour(d, i)]))
    const chipDepartments = site.departments.filter((d) => site.machines.some((m) => m.department_id === d.id))

    const stageMachines: PlantStageMachine[] = site.machines.map((m) => ({
      id: m.id,
      name: m.name,
      polygon: m.polygon,
      pin: pins.get(m.id) ?? 0,
      highlighted: highlighted.has(m.id),
      selected: m.id === selectedId,
      zoned: zoneId !== null && m.department_id === zoneId,
      zoneColour: colourByDept.get(m.department_id ?? '') ?? 'var(--ink-500)',
    }))

    const nowItems = pickNowQueue(sops, site.links, site.machines, site.departments, 3)

    const selected = site.machines.find((m) => m.id === selectedId) ?? null
    const selectedDept = selected
      ? (site.departments.find((d) => d.id === selected.department_id) ?? null)
      : null
    const panelSops = selected
      ? narrowForAsk(query, selected.name, machineSops(selected.id, site.links, sopsById))
      : []

    let voiceSopId: string | null
    if (selected) {
      const msops = machineSops(selected.id, site.links, sopsById)
      const todo = msops.find((s) => {
        const rel = plantRelState(s)
        return rel === 'due' || rel === 'never' || rel === 'new'
      })
      voiceSopId = todo?.id ?? msops[0]?.id ?? null
    } else {
      voiceSopId = nowItems[0]?.sop.id ?? null
    }

    return { colourByDept, chipDepartments, stageMachines, nowItems, selected, selectedDept, panelSops, voiceSopId }
  }, [site, sops, query, selectedId, zoneId])

  const { colourByDept, chipDepartments, stageMachines, nowItems, selected, selectedDept, panelSops, voiceSopId } =
    derived

  if (!site.layout) return null
  const layout = site.layout

  function open(machineId: string) {
    setSelectedId(machineId)
    stageRef.current?.flyTo(machineId)
  }

  function close() {
    setSelectedId(null)
    stageRef.current?.fit()
  }

  function pickZone(deptId: string | null) {
    setZoneId(deptId)
    if (deptId === null) {
      stageRef.current?.fit()
    } else {
      const ids = site.machines.filter((m) => m.department_id === deptId).map((m) => m.id)
      stageRef.current?.fitMachines(ids)
    }
  }

  return (
    <div
      data-testid="plant-home"
      className="relative h-[calc(100vh-140px)] min-h-105 overflow-hidden rounded-lg border border-[var(--ink-300)] bg-[var(--paper-2)]"
    >
      <PlantStage
        ref={stageRef}
        sceneUrl={layout.sceneUrl}
        sceneWidth={layout.sceneWidth}
        sceneHeight={layout.sceneHeight}
        machines={stageMachines}
        onMachineClick={open}
      />

      <div className="pointer-events-none absolute inset-x-4 top-3.5 z-10 flex items-start gap-2.5">
        <div className="pointer-events-auto flex gap-1.5 rounded-lg border border-[var(--ink-300)] bg-white/96 p-1.5 shadow">
          <button
            type="button"
            data-testid="plant-zone-chip"
            data-zone-id=""
            aria-pressed={zoneId === null}
            onClick={() => pickZone(null)}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
              zoneId === null ? 'bg-[var(--ink-900)] text-white' : 'text-[var(--ink-600)]'
            }`}
          >
            Whole site
          </button>
          {chipDepartments.map((d) => (
            <button
              key={d.id}
              type="button"
              data-testid="plant-zone-chip"
              data-zone-id={d.id}
              aria-pressed={zoneId === d.id}
              onClick={() => pickZone(d.id)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                zoneId === d.id ? 'bg-[var(--ink-900)] text-white' : 'text-[var(--ink-600)]'
              }`}
            >
              <span className="h-2.25 w-2.25 rounded" style={{ background: colourByDept.get(d.id) }} />
              {d.name}
            </button>
          ))}
        </div>
        <PlantAskBar value={query} onChange={onQueryChange} voiceSopId={voiceSopId} />
      </div>

      {!loading && <NowCard items={nowItems} onShowMe={open} />}

      <MachinePanel
        open={selected !== null}
        machine={selected ? { id: selected.id, name: selected.name, spriteUrl: selected.spriteUrl } : null}
        department={
          selectedDept ? { name: selectedDept.name, colour: colourByDept.get(selectedDept.id) ?? 'var(--ink-500)' } : null
        }
        sops={panelSops}
        onClose={close}
      />

      {selected === null && (
        <p className="mono pointer-events-none absolute bottom-4 right-4 text-meta text-[var(--ink-500)]">
          drag to pan · scroll to zoom · click a machine
        </p>
      )}
    </div>
  )
}
