// ------------------------------------------------------------
// resolveCadenceMonths / computeReviewDueDate
// Pure helpers — cadence resolution + due-date math for the review lifecycle
// (REV-01/D28-03). No server-action directive, no I/O — sync exports
// imported into src/actions/governance.ts (2026-06-27 learning).
// ------------------------------------------------------------

const DEFAULT_CADENCE_MONTHS = 12

/**
 * Phase 40 DAT-01: `categorySlug` is a `SOP_CATEGORIES` slug (previously a
 * free-text `sops.category` value). `sop_review_cadences.category` keeps its
 * column name/type — only the values stored in it are remapped by plan
 * 40-06's backfill, so the lookup below is unchanged (a text key against a
 * text-keyed map).
 */
export function resolveCadenceMonths(
  categorySlug: string | null,
  orgCadences: Record<string, number>,
  perSopOverrideMonths?: number | null
): number {
  if (typeof perSopOverrideMonths === 'number' && perSopOverrideMonths > 0) {
    return perSopOverrideMonths
  }
  const categoryMonths = orgCadences[categorySlug ?? '']
  if (typeof categoryMonths === 'number') return categoryMonths
  const defaultMonths = orgCadences['default']
  if (typeof defaultMonths === 'number') return defaultMonths
  return DEFAULT_CADENCE_MONTHS
}

export function computeReviewDueDate(baseIso: string, months: number): string {
  // UTC methods throughout — inputs are UTC ISO strings, so setMonth-drift
  // guarding must stay in UTC or the end-of-month clamp becomes TZ-dependent.
  const base = new Date(baseIso)
  const targetDay = base.getUTCDate()
  base.setUTCDate(1)
  base.setUTCMonth(base.getUTCMonth() + months)
  // Clamp to the last day of the target month when the source day overflows
  // (Jan 31 + 1mo -> Feb 28/29, not Mar 2/3).
  const lastDayOfTargetMonth = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate()
  base.setUTCDate(Math.min(targetDay, lastDayOfTargetMonth))
  return base.toISOString()
}
