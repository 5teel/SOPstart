// ------------------------------------------------------------
// computeNextVersionLineage
// Pure helper — computes newVersion and newParentId from an existing SOP.
// Lives outside the 'use server' action module so it can be a SYNC export
// (Next.js requires every export of a 'use server' file to be an async
// function — see versioning.ts). Imported by versioning.ts and unit-tested
// directly without a DB (Plan 23-03 TDD task).
//
// All versions of the same SOP lineage share the same parent_sop_id (the
// first/root version's id). When oldSop has no parent_sop_id it IS the root.
// ------------------------------------------------------------
export function computeNextVersionLineage(oldSop: {
  id: string
  version: number
  parent_sop_id: string | null
}): { newVersion: number; newParentId: string } {
  return {
    newVersion: oldSop.version + 1,
    newParentId: (oldSop.parent_sop_id as string | null) ?? oldSop.id,
  }
}
