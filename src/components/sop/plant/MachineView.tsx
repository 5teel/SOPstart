'use client'

/**
 * Phase 53 (D-04) -- the /m/[code] page's client half. Reads the worker's
 * list from the server (useWorkerSops), then hands the resolved machine to
 * the shared MachinePanel in its in-page placement. No router, no sorting, no classification -- ordering and
 * badges come from worker-signal via useWorkerSops.
 */
import { useMemo } from 'react'
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
  const { workerSops, libraryLoading, assignmentsLoading } = useWorkerSops()

  const sops = useMemo(() => {
    const sopsById = new Map<string, WorkerSop>(workerSops.map((s) => [s.id, s]))
    const links = sopIds.map((sopId) => ({ sop_id: sopId, machine_id: machine.id }))
    return machineSops(machine.id, links, sopsById)
  }, [workerSops, sopIds, machine.id])

  if (libraryLoading || assignmentsLoading) {
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
