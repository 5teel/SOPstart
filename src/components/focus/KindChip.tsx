import { kindLabel, type FocusKind } from '@/lib/sop/focus'

/** One accent per kind (UI-SPEC Color): chip text + tint, and the card's left edge. */
const CHIP: Record<FocusKind, string> = {
  hazard: 'text-accent-hazard bg-accent-hazard/10',
  ppe: 'text-accent-decision bg-accent-decision/10',
  step: 'text-accent-step bg-accent-step/10',
  check: 'text-accent-measure bg-accent-measure/10',
}

export const KIND_EDGE: Record<FocusKind, string> = {
  hazard: 'border-l-accent-hazard',
  ppe: 'border-l-accent-decision',
  step: 'border-l-accent-step',
  check: 'border-l-accent-measure',
}

export const KIND_DOT: Record<FocusKind, string> = {
  hazard: 'bg-accent-hazard',
  ppe: 'bg-accent-decision',
  step: 'bg-accent-step',
  check: 'bg-accent-measure',
}

export function KindChip({ kind }: { kind: FocusKind }) {
  return (
    <span data-testid="focus-kind-chip" data-kind={kind} className={`mono rounded px-2 py-1 text-meta uppercase ${CHIP[kind]}`}>
      {kindLabel(kind)}
    </span>
  )
}
