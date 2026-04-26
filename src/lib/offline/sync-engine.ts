// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = import('@supabase/supabase-js').SupabaseClient<any, any, any>
import { db } from '@/lib/offline/db'
import type { Sop, SopSection, SopStep, SopImage } from '@/types/sop'
import { submitCompletion, getPhotoUploadUrl } from '@/actions/completions'
import { flushVoiceNoteQueue } from '@/lib/offline/voice-queue'

interface SopManifestEntry {
  sop_id: string
  sops: {
    id: string
    version: number
    updated_at: string
  } | null
}

// Nested shape returned by supabase select('*, sop_sections(*, ...)'). Inherits
// every Sop field (including Phase 12's required source_type) so Dexie writes
// stay in sync with the Sop interface without hand-maintained mirrors.
type SopWithNested = Sop & {
  sop_sections: (SopSection & {
    sop_steps: SopStep[]
    sop_images: SopImage[]
  })[]
}

export async function syncAssignedSops(
  supabase: AnySupabaseClient
): Promise<{ synced: number; errors: string[]; publishedTransitions: string[] }> {
  try {
    // 1. Fetch manifest of assigned SOPs for the current user
    const { data: assignments, error: assignError } = await supabase
      .from('sop_assignments')
      .select('sop_id, sops(id, version, updated_at)')

    if (assignError) {
      return { synced: 0, errors: [assignError.message], publishedTransitions: [] }
    }

    const manifest = (assignments as unknown as SopManifestEntry[] | null) ?? []
    const manifestSopIds = new Set(manifest.map((a) => a.sop_id))

    // 2. Get cached versions from Dexie (also snapshot statuses for D-08
    //    draft->published transition detection — used by useSopSync to fire
    //    purgeDraftLayoutsOnPublish).
    const cached = await db.sops.toArray()
    const cachedVersionMap = new Map(cached.map((s) => [s.id, s.version]))
    const cachedStatusMap = new Map(cached.map((s) => [s.id, s.status]))

    // 3. Compute stale IDs
    const staleIds = manifest
      .filter((a) => {
        const manifestVersion = a.sops?.version
        if (manifestVersion === undefined || manifestVersion === null) return false
        const cachedVersion = cachedVersionMap.get(a.sop_id)
        return cachedVersion === undefined || cachedVersion !== manifestVersion
      })
      .map((a) => a.sop_id)

    if (staleIds.length === 0) {
      // 7. Remove orphaned SOPs even if nothing is stale
      const orphanIds = cached
        .filter((s) => !manifestSopIds.has(s.id))
        .map((s) => s.id)
      if (orphanIds.length > 0) {
        await db.transaction('rw', [db.sops, db.sections, db.steps, db.images], async () => {
          await db.sops.bulkDelete(orphanIds)
          const orphanSections = await db.sections.where('sop_id').anyOf(orphanIds).toArray()
          const orphanSectionIds = orphanSections.map((s) => s.id)
          await db.sections.bulkDelete(orphanSectionIds)
          if (orphanSectionIds.length > 0) {
            const orphanSteps = await db.steps.where('section_id').anyOf(orphanSectionIds).toArray()
            await db.steps.bulkDelete(orphanSteps.map((s) => s.id))
          }
          await db.images.where('sop_id').anyOf(orphanIds).delete()
        })
      }
      return { synced: 0, errors: [], publishedTransitions: [] }
    }

    // 5. Fetch full SOP content for stale IDs
    const { data: sopsData, error: sopError } = await supabase
      .from('sops')
      .select('*, sop_sections(*, sop_steps(*), sop_images(*))')
      .in('id', staleIds)

    if (sopError) {
      return { synced: 0, errors: [sopError.message], publishedTransitions: [] }
    }

    const sops = (sopsData as SopWithNested[] | null) ?? []

    // D-08 transition detection: which incoming SOPs moved
    // non-published -> published during this sync pass?
    const publishedTransitions: string[] = []
    for (const incoming of sops) {
      const prevStatus = cachedStatusMap.get(incoming.id)
      if (prevStatus !== 'published' && incoming.status === 'published') {
        publishedTransitions.push(incoming.id)
      }
    }

    // 6. Write to Dexie in a single transaction
    await db.transaction('rw', [db.sops, db.sections, db.steps, db.images], async () => {
      for (const sop of sops) {
        const { sop_sections: sections, ...sopData } = sop
        await db.sops.put({ ...sopData, _cachedAt: Date.now() })

        for (const section of sections ?? []) {
          const { sop_steps: steps, sop_images: images, ...sectionData } = section
          await db.sections.put(sectionData)

          for (const step of steps ?? []) {
            await db.steps.put(step)
          }

          for (const image of images ?? []) {
            await db.images.put(image)
          }
        }
      }
    })

    // 7. Remove orphaned SOPs no longer assigned
    const allCachedIds = await db.sops.toCollection().primaryKeys() as string[]
    const orphanIds = allCachedIds.filter((id) => !manifestSopIds.has(id))
    if (orphanIds.length > 0) {
      await db.transaction('rw', [db.sops, db.sections, db.steps, db.images], async () => {
        await db.sops.bulkDelete(orphanIds)
        const orphanSections = await db.sections.where('sop_id').anyOf(orphanIds).toArray()
        const orphanSectionIds = orphanSections.map((s) => s.id)
        await db.sections.bulkDelete(orphanSectionIds)
        if (orphanSectionIds.length > 0) {
          const orphanSteps = await db.steps.where('section_id').anyOf(orphanSectionIds).toArray()
          await db.steps.bulkDelete(orphanSteps.map((s) => s.id))
        }
        await db.images.where('sop_id').anyOf(orphanIds).delete()
      })
    }

    // 8. Update syncMeta
    await db.syncMeta.put({ key: 'lastSync', value: new Date().toISOString() })

    return {
      synced: staleIds.length,
      errors: [],
      publishedTransitions,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { synced: 0, errors: [message], publishedTransitions: [] }
  }
}

// ---------------------------------------------------------------
// flushPhotoQueue
// Uploads any pending photos (uploaded === false) to Supabase Storage
// via server-action-generated presigned URLs.
// ---------------------------------------------------------------
export async function flushPhotoQueue(
  _supabase: AnySupabaseClient
): Promise<{ uploaded: number; errors: string[] }> {
  const errors: string[] = []
  let uploaded = 0

  try {
    // Dexie stores boolean false as 0 — query using numeric 0
    const pending = await db.photoQueue
      .where('uploaded')
      .equals(0)
      .toArray()

    for (const photo of pending) {
      try {
        // Get a presigned upload URL from the server action
        const urlResult = await getPhotoUploadUrl({
          localId: photo.localId,
          contentType: photo.contentType,
          // orgId is extracted by server action from JWT — pass a placeholder here;
          // the actual orgId extraction happens server-side
          orgId: '',
          completionLocalId: photo.completionLocalId,
        })

        if ('error' in urlResult) {
          errors.push(`Photo ${photo.localId}: ${urlResult.error}`)
          continue
        }

        // PUT blob to presigned URL
        const putResponse = await fetch(urlResult.url, {
          method: 'PUT',
          body: photo.blob,
          headers: { 'Content-Type': photo.contentType },
        })

        if (!putResponse.ok) {
          errors.push(`Photo ${photo.localId}: upload failed (${putResponse.status})`)
          continue
        }

        // Mark as uploaded with storage path
        await db.photoQueue.update(photo.localId, {
          uploaded: true,
          storagePath: urlResult.path,
        })

        uploaded++
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        errors.push(`Photo ${photo.localId}: ${message}`)
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    errors.push(message)
  }

  return { uploaded, errors }
}

// ---------------------------------------------------------------
// flushCompletions
// Pushes any 'submitted' (not 'in_progress') local completions to
// Postgres via the submitCompletion server action.
// On success (or idempotent conflict): removes from Dexie.
// On failure: leaves in Dexie for retry next time online.
// ---------------------------------------------------------------
export async function flushCompletions(
  _supabase: AnySupabaseClient
): Promise<{ flushed: number; errors: string[] }> {
  const errors: string[] = []
  let flushed = 0

  try {
    const submitted = await db.completions
      .where('status')
      .equals('submitted')
      .toArray()

    for (const completion of submitted) {
      try {
        // Collect uploaded photo records associated with this completion
        const photos = await db.photoQueue
          .where('completionLocalId')
          .equals(completion.localId)
          .and((p) => p.storagePath !== null)
          .toArray()

        const photoStoragePaths = photos
          .filter((p) => p.storagePath !== null)
          .map((p) => ({
            localId: p.localId,
            stepId: p.stepId,
            storagePath: p.storagePath as string,
            contentType: p.contentType,
          }))

        const result = await submitCompletion({
          localId: completion.localId,
          sopId: completion.sopId,
          sopVersion: completion.sopVersion,
          contentHash: completion.contentHash,
          stepData: completion.stepCompletions,
          photoStoragePaths,
        })

        if ('success' in result && result.success) {
          // Remove from Dexie on success
          await db.completions.delete(completion.localId)
          // Also clean up associated photo queue entries
          await db.photoQueue
            .where('completionLocalId')
            .equals(completion.localId)
            .delete()
          flushed++
        } else if ('error' in result) {
          errors.push(`Completion ${completion.localId}: ${result.error}`)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        errors.push(`Completion ${completion.localId}: ${message}`)
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    errors.push(message)
  }

  return { flushed, errors }
}

// ---------------------------------------------------------------
// flushVoiceQueue (Phase 12.5 SB-UX-06)
// Flushes offline-queued voice blobs: transcribes via Deepgram REST,
// uploads to Supabase Storage, inserts sop_voice_notes row.
// Called by reconnect handlers alongside flushPhotoQueue + flushCompletions.
// ---------------------------------------------------------------
export { flushVoiceNoteQueue }

// ---------------------------------------------------------------
// flushDraftLayouts (Phase 12 SB-LAYOUT-04)
// Flushes any draftLayouts rows with syncState === 'dirty' to Supabase
// via the updateSectionLayout server action. Implements D-07 LWW:
//   - If server row's updated_at is newer than the local row's, drop local.
//     BuilderClient surfaces a quiet toast "Updated by another admin"
//     referencing each affected section title.
//   - Otherwise push local → server and mark local row 'synced'.
// ---------------------------------------------------------------
export async function flushDraftLayouts(
  _supabase: AnySupabaseClient
): Promise<{ flushed: number; errors: string[]; overwrittenByServer: string[] }> {
  const errors: string[] = []
  const overwrittenByServer: string[] = []
  let flushed = 0

  try {
    const dirty = await db.draftLayouts
      .where('syncState')
      .equals('dirty')
      .toArray()

    for (const row of dirty) {
      try {
        // Late-import to avoid circular deps between actions/ and sync-engine
        const { updateSectionLayout } = await import('@/actions/sections')
        const result = await updateSectionLayout({
          sectionId: row.section_id,
          layoutData: row.layout_data,
          layoutVersion: row.layout_version,
          clientUpdatedAt: row.updated_at,
        })

        if ('error' in result) {
          // LWW: server newer -> drop local, mark synced, record the section_id
          // so the caller (BuilderClient) can surface a quiet toast per D-07.
          if (result.error === 'server_newer') {
            await db.draftLayouts.update(row.section_id, { syncState: 'synced' })
            overwrittenByServer.push(row.section_id)
            continue
          }
          errors.push(`Draft ${row.section_id}: ${result.error}`)
          continue
        }

        await db.draftLayouts.update(row.section_id, { syncState: 'synced' })
        flushed++
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        errors.push(`Draft ${row.section_id}: ${message}`)
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    errors.push(message)
  }

  return { flushed, errors, overwrittenByServer }
}
