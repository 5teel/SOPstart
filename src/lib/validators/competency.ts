/**
 * Canonical Zod schemas for competency matrix / CSV export filter inputs
 * (Phase 35, MTX-03 + D-16 date-range semantics).
 *
 * Mirrors the src/lib/validators/observations.ts precedent: server actions
 * import these as their single source of truth, never re-validating inline.
 */
import { z } from 'zod'

export const MatrixFiltersSchema = z.object({
  // D-06: department-first default cut — every matrix read is scoped to one
  // department; whole-org-at-once is not the default.
  departmentId: z.string().uuid(),
  workerId: z.string().uuid().optional(),
  sopId: z.string().uuid().optional(),
})
export type MatrixFiltersInput = z.infer<typeof MatrixFiltersSchema>

export const CsvExportFiltersSchema = z.object({
  departmentId: z.string().uuid().optional(),
  workerId: z.string().uuid().optional(),
  sopId: z.string().uuid().optional(),
  // D-16: date-range filters on completion date (ISO date/datetime strings).
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
})
export type CsvExportFiltersInput = z.infer<typeof CsvExportFiltersSchema>
