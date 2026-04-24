import { db } from '@/lib/offline/db'

/**
 * D-08: draftLayouts rows are kept as offline cache until the SOP is
 * published, at which point the authoritative copy lives in the existing
 * sopCache read path and the drafts are no longer needed. Idempotent.
 *
 * Phase 12 Plan 03 wires this helper into two call sites:
 *   1. src/hooks/useSopSync.ts — observes SOP cache writes during sync and
 *      calls this helper when a SOP transitions draft -> published
 *      (handles multi-tab / offline-first admin scenarios).
 *   2. src/app/(protected)/admin/sops/[sopId]/review/ReviewClient.tsx — called
 *      explicitly after the publish API responds 2xx (belt-and-braces: the
 *      publishing admin's own tab purges immediately, without waiting for a
 *      sync pass).
 *
 * Returns the number of rows deleted (0 if none / error). Failure is logged
 * but swallowed so it does not block the caller's redirect.
 */
export async function purgeDraftLayoutsOnPublish(sopId: string): Promise<number> {
  if (!sopId) return 0
  try {
    const deleted = await db.draftLayouts.where('sop_id').equals(sopId).delete()
    if (deleted > 0) {
      console.info(
        `[draftLayouts] purged ${deleted} row(s) for published SOP ${sopId}`
      )
    }
    return deleted
  } catch (err) {
    console.warn('[draftLayouts] purge failed', err)
    return 0
  }
}
