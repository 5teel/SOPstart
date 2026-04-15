import Dexie, { type EntityTable } from 'dexie'
import type { SopSection, SopStep, SopImage } from '@/types/sop'
import type { Sop } from '@/types/sop'

export interface CachedSop extends Sop {
  _cachedAt: number
}

// ---------------------------------------------------------------
// v2 types: offline completion durability
// ---------------------------------------------------------------

export interface LocalCompletion {
  localId: string                        // client UUID — idempotency key
  sopId: string
  sopVersion: number
  contentHash: string                    // computed at submission time (may be empty while in_progress)
  stepCompletions: Record<string, number> // stepId -> completedAt (ms)
  status: 'in_progress' | 'submitted'
  startedAt: number
}

export interface QueuedPhoto {
  localId: string                        // UUID
  completionLocalId: string              // references LocalCompletion.localId
  stepId: string
  blob: Blob                             // NOT indexed — Dexie anti-pattern for binary data
  contentType: string                    // 'image/jpeg'
  capturedAt: number
  uploaded: boolean                      // false (0 in Dexie) until synced
  storagePath: string | null             // filled after upload
}

type SopAssistantDB = Dexie & {
  sops: EntityTable<CachedSop, 'id'>
  sections: EntityTable<SopSection, 'id'>
  steps: EntityTable<SopStep, 'id'>
  images: EntityTable<SopImage, 'id'>
  syncMeta: EntityTable<{ key: string; value: string }, 'key'>
  completions: EntityTable<LocalCompletion, 'localId'>
  photoQueue: EntityTable<QueuedPhoto, 'localId'>
}

const db = new Dexie('SopAssistantDB') as SopAssistantDB

db.version(1).stores({
  sops: 'id, organisation_id, status, version, category, department, _cachedAt',
  sections: 'id, sop_id, section_type, sort_order',
  steps: 'id, section_id, step_number',
  images: 'id, sop_id, section_id, step_id',
  syncMeta: 'key',
})

// v2: adds completions + photoQueue tables
// All v1 index strings are repeated (required by Dexie schema migration)
// blob is intentionally NOT listed — never index binary data in Dexie
db.version(2).stores({
  sops: 'id, organisation_id, status, version, category, department, _cachedAt',
  sections: 'id, sop_id, section_type, sort_order',
  steps: 'id, section_id, step_number',
  images: 'id, sop_id, section_id, step_id',
  syncMeta: 'key',
  completions: 'localId, sopId, status',
  photoQueue: 'localId, completionLocalId, stepId, uploaded',
})

// v3: adds section_kind_id index for the v3.0 section kinds catalog join.
// All v2 tables carried forward unchanged. Dexie tolerates extra row fields
// on upgrade — only the index string changes, so existing clients upgrade
// without losing cached SOPs. The joined `section_kind` object is
// denormalized onto each cached section by the sync layer; there is no
// separate section_kinds Dexie table.
db.version(3).stores({
  sops: 'id, organisation_id, status, version, category, department, _cachedAt',
  sections: 'id, sop_id, section_type, section_kind_id, sort_order',
  steps: 'id, section_id, step_number',
  images: 'id, sop_id, section_id, step_id',
  syncMeta: 'key',
  completions: 'localId, sopId, status',
  photoQueue: 'localId, completionLocalId, stepId, uploaded',
})

export { db }
