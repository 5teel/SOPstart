// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = import('@supabase/supabase-js').SupabaseClient<any, any, any>
import { db } from '@/lib/offline/db'
import type { SopSection, SopStep, SopImage } from '@/types/sop'
import { submitCompletion, getPhotoUploadUrl } from '@/actions/completions'

interface SopManifestEntry {
  sop_id: string
  sops: {
    id: string
    version: number
    updated_at: string
  } | null
}

interface SopWithNested {
  id: string
  organisation_id: string
  title: string | null
  sop_number: string | null
  revision_date: string | null
  author: string | null
  category: string | null
  department: string | null
  related_sops: string[] | null
  applicable_equipment: string[] | null
  required_certifications: string[] | null
  status: 'uploading' | 'parsing' | 'draft' | 'published'
  version: number
  source_file_path: string
  source_file_type: 'docx' | 'pdf' | 'image'
  source_file_name: string
  overall_confidence: number | null
  parse_notes: string | null
  is_ocr: boolean
  uploaded_by: string
  published_at: string | null
  created_at: string
  updated_at: string
  sop_sections: (SopSection & {
    sop_steps: SopStep[]
    sop_images: SopImage[]
  })[]
}

export async function syncAssignedSops(
  supabase: AnySupabaseClient
): Promise<{ synced: number; errors: string[] }> {
  try {
    // 1. Fetch manifest of assigned SOPs for the current user
    const { data: assignments, error: assignError } = await supabase
      .from('sop_assignments')
      .select('sop_id, sops(id, version, updated_at)')

    if (assignError) {
      return { synced: 0, errors: [assignError.message] }
    }

    const manifest = (assignments as unknown as SopManifestEntry[] | null) ?? []
    const manifestSopIds = new Set(manifest.map((a) => a.sop_id))

    // 2. Get cached versions from Dexie
    const cached = await db.sops.toArray()
    const cachedVersionMap = new Map(cached.map((s) => [s.id, s.version]))

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
      return { synced: 0, errors: [] }
    }

    // 5. Fetch full SOP content for stale IDs
    const { data: sopsData, error: sopError } = await supabase
      .from('sops')
      .select('*, sop_sections(*, sop_steps(*), sop_images(*))')
      .in('id', staleIds)

    if (sopError) {
      return { synced: 0, errors: [sopError.message] }
    }

    const sops = (sopsData as SopWithNested[] | null) ?? []

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

    return { synced: staleIds.length, errors: [] }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { synced: 0, errors: [message] }
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
