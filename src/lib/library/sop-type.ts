/**
 * Phase 63 -- a SOP's type, derived with no schema change (R3). Plain module.
 * "Order of operations" is not derived: it waits for an authored sop_type field.
 */
export const SOP_TYPES = ['Machine', 'Process', 'Inspection', 'Emergency'] as const
export type SopType = (typeof SOP_TYPES)[number]

/** `machineLinked` = a sop_machines row exists or placement is 'machine'. Precedence: emergency, quality, machine, process. */
export function sopTypeOf(sop: { category_slug: string | null; placement?: string | null }, machineLinked: boolean): SopType {
  if (sop.category_slug === 'emergency') return 'Emergency'
  if (sop.category_slug === 'quality') return 'Inspection'
  if (machineLinked || sop.placement === 'machine') return 'Machine'
  return 'Process'
}
