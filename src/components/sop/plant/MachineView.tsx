'use client'

/**
 * Phase 53 (D-04) -- the /m/[code] page's client half. Syncs the worker's
 * assignments into Dexie so a phone opening a plate for the very first time
 * still gets today's list (the 2026-09-29 first-visit sync learning), then
 * hands the resolved machine to the shared MachinePanel in its in-page
 * placement. No router, no sorting, no classification -- ordering and
 * badges come from worker-signal via useWorkerSops.
 */
import { useMemo } from 'react'
import { useAssignedSops } from '@/hooks/useAssignedSops'
import { useSopSync } from '@/hooks/useSopSync'
import { useWorkerSops } from '@/hooks/useWorkerSops'
import { machineSops, type WorkerSop } from '@/lib/sop/worker-signal'
import { MachinePanel } from '@/components/sop/plant/MachinePanel'

export function MachineView({
  machine,
  department,
  sopIds,
}: {
  machine: { id: string; name: string; spriteUrl: string | null }
  department: { name: string; colour: string } | null
  sopIds: string[]
}) {
  useSopSync()
  const { data: assignedSops = [], isLoading } = useAssignedSops()
  const { workerSops, libraryLoading } = useWorkerSops(assignedSops)

  const sops = useMemo(() => {
    const sopsById = new Map<string, WorkerSop>(workerSops.map((s) => [s.id, s]))
    const links = sopIds.map((sopId) => ({ sop_id: sopId, machine_id: machine.id }))
    return machineSops(machine.id, links, sopsById)
  }, [workerSops, sopIds, machine.id])

  if (isLoading || libraryLoading) {
    return (
      <div data-testid="machine-view-loading" className="flex flex-col gap-2">
        <div className="h-13 animate-pulse rounded-lg bg-[var(--paper-2)]" />
        <div className="h-13 animate-pulse rounded-lg bg-[var(--paper-2)]" />
      </div>
    )
  }

  return (
    <div data-testid="machine-view">
      <MachinePanel inline open machine={machine} department={department} sops={sops} />
    </div>
  )
}
