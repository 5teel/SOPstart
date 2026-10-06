'use client'

/**
 * Phase 60 (D-11) -- the worker half of the objective line, as its own lazy chunk. The static
 * line plus its read cost the home download ~4 KB, past the bundle gate, so WorkerShell
 * reaches this through next/dynamic and the line arrives with the machine or department panel.
 */
import { ObjectiveLine, useObjectives } from '@/components/shell/ObjectiveLine'
import type { ObjectiveSubject } from '@/lib/objectives/model'

export function WorkerObjective({ type, id }: { type: ObjectiveSubject; id: string }) {
  const o = useObjectives().find(type, id)
  return o ? <ObjectiveLine view={o} /> : null
}
