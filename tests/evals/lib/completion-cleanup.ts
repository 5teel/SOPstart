/**
 * Phase 55 eval cleanup: removes the completions (and their photos / sign-offs)
 * an eval created against its walk fixture SOP, so the shared eval-site data is
 * left as it was found. Service-role client only; refuses the real SOPstart org.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { REAL_SOPSTART_ORG_ID } from './plant-fixture'

const PHOTO_BUCKET = 'completion-photos'

export async function deleteEvalCompletions(db: SupabaseClient, sopId: string): Promise<number> {
  const { data: sop, error: sopErr } = await db.from('sops').select('organisation_id').eq('id', sopId).maybeSingle()
  if (sopErr || !sop) throw new Error(`sop lookup failed: ${sopErr?.message ?? 'not found'}`)
  const orgId = sop.organisation_id as string
  if (orgId === REAL_SOPSTART_ORG_ID) throw new Error('refusing to delete completions in the real SOPstart org')

  // Phase 58: a walk (in progress, abandoned or submitted) is its own row; clear them with the completions.
  const walks = await db.from('sop_walks').delete().eq('sop_id', sopId).eq('organisation_id', orgId)
  if (walks.error) throw new Error(`sop_walks delete failed: ${walks.error.message}`)

  const { data: rows, error: rowsErr } = await db.from('sop_completions').select('id').eq('sop_id', sopId)
  if (rowsErr) throw new Error(`completions lookup failed: ${rowsErr.message}`)
  const ids = (rows ?? []).map((r) => r.id as string)
  if (ids.length === 0) return 0

  for (const id of ids) {
    const folder = `${orgId}/completions/${id}`
    const { data: objs } = await db.storage.from(PHOTO_BUCKET).list(folder)
    if (objs && objs.length > 0) await db.storage.from(PHOTO_BUCKET).remove(objs.map((o) => `${folder}/${o.name}`))
  }

  const photos = await db.from('completion_photos').delete().in('completion_id', ids)
  if (photos.error) throw new Error(`completion_photos delete failed: ${photos.error.message}`)
  // Phase 58: recordSignature writes a counter-signature row per walk; it blocks the completion delete (58-18).
  const sigs = await db.from('sop_completion_signatures').delete().in('completion_id', ids)
  if (sigs.error) throw new Error(`sop_completion_signatures delete failed: ${sigs.error.message}`)
  // Sign-offs may not exist on every environment; a missing table is not an error here.
  await db.from('completion_sign_offs').delete().in('completion_id', ids)
  const done = await db.from('sop_completions').delete().in('id', ids)
  if (done.error) throw new Error(`sop_completions delete failed: ${done.error.message}`)
  return ids.length
}
