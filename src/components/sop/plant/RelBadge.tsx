/**
 * The shared DUE / UPDATED / NEVER DONE / DONE badge (D-11) — the machine
 * panel and the Now card both use this, so the four-state vocabulary from
 * `src/lib/sop/worker-signal.ts` never gets a second rendering. No hooks, no
 * directive — a plain leaf, tokens only (2026-07-14: never a bare hex or an
 * undefined custom property).
 */
import { PLANT_REL_LABEL, type PlantRel } from '@/lib/sop/worker-signal'

const TONE: Record<PlantRel, string> = {
  due: 'bg-accent-decision/16 text-accent-decision',
  new: 'bg-accent-measure/14 text-accent-measure',
  never: 'bg-accent-escalate/14 text-[var(--accent-hazard)]',
  done: 'border border-[var(--ink-300)] text-[var(--ink-500)]',
}

export function RelBadge({ rel }: { rel: PlantRel }) {
  return (
    <span
      data-testid="plant-rel-badge"
      data-rel={rel}
      className={`mono rounded px-1.5 py-0.5 text-micro font-semibold uppercase tracking-wide ${TONE[rel]}`}
    >
      {PLANT_REL_LABEL[rel]}
    </span>
  )
}
