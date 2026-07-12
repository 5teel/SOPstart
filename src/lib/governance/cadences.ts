// ------------------------------------------------------------
// resolveCadenceMonths / computeReviewDueDate
// Pure helpers — cadence resolution + due-date math for the review lifecycle
// (REV-01/D28-03). No 'use server', no I/O — sync exports imported into
// src/actions/governance.ts (2026-06-27 learning).
// ------------------------------------------------------------

const DEFAULT_CADENCE_MONTHS = 12

export function resolveCadenceMonths(
  category: string | null,
  orgCadences: Record<string, number>,
  perSopOverrideMonths?: number | null
): number {
  if (typeof perSopOverrideMonths === 'number' && perSopOverrideMonths > 0) {
    return perSopOverrideMonths
  }
  const categoryMonths = orgCadences[category ?? '']
  if (typeof categoryMonths === 'number') return categoryMonths
  const defaultMonths = orgCadences['default']
  if (typeof defaultMonths === 'number') return defaultMonths
  return DEFAULT_CADENCE_MONTHS
}

export function computeReviewDueDate(baseIso: string, months: number, now?: Date): string {
  const base = new Date(baseIso)
  base.setMonth(base.getMonth() + months)
  return base.toISOString()
}
