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

// ---------------------------------------------------------------
// v4 types: builder draft layout cache (Phase 12 SB-LAYOUT-04)
// ---------------------------------------------------------------

export interface DraftLayout {
  section_id: string                     // primary key — matches Supabase row
  sop_id: string                         // indexed for per-SOP bulk queries
  layout_data: unknown                   // opaque Puck Data JSON — validated by LayoutDataSchema at read time
  layout_version: number                 // monotonic integer version pin; Phase 12 writes 1
  updated_at: number                     // epoch ms (client-side LWW source of truth)
  syncState: 'dirty' | 'synced'          // 'dirty' → needs flush; 'synced' → matches server
  _cachedAt: number                      // when the row was last read/written locally
}

// ---------------------------------------------------------------
// v5 types: voice notes queue + walkthrough progress (Phase 12.5)
// ---------------------------------------------------------------

export interface QueuedVoiceNote {
  id: string                    // client-generated UUID
  sop_id: string
  section_id?: string
  step_id?: string
  completion_id?: string
  block_type: 'measurement' | 'note'
  transcript?: string           // optional: may be transcribed offline or on flush
  audio_blob: Blob
  audio_mime: string            // e.g. 'audio/webm;codecs=opus' — from pickRecorderFormat()
  audio_ext: 'webm' | 'mp4' | 'ogg'
  language: 'en-NZ' | 'en-AU' | 'en-US'
  confidence?: number
  syncState: 'dirty' | 'synced'
  _createdAt: number            // epoch ms
}

export interface WalkthroughProgressRow {
  sop_id: string
  user_id: string               // stored for sync reconciliation; Dexie keys on sop_id only (single-worker-per-device)
  step_id: string | null
  completed_at: number | null   // epoch ms
  updated_at: number            // epoch ms
}

type SopAssistantDB = Dexie & {
  sops: EntityTable<CachedSop, 'id'>
  sections: EntityTable<SopSection, 'id'>
  steps: EntityTable<SopStep, 'id'>
  images: EntityTable<SopImage, 'id'>
  syncMeta: EntityTable<{ key: string; value: string }, 'key'>
  completions: EntityTable<LocalCompletion, 'localId'>
  photoQueue: EntityTable<QueuedPhoto, 'localId'>
  draftLayouts: EntityTable<DraftLayout, 'section_id'>
  voiceNotesQueue: EntityTable<QueuedVoiceNote, 'id'>
  walkthroughProgress: EntityTable<WalkthroughProgressRow, 'sop_id'>
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

// v4: adds draftLayouts table for builder auto-save (Phase 12 SB-LAYOUT-04).
// Repeats all v3 stores verbatim (Dexie declarative-cumulative requirement).
// draftLayouts is keyed by section_id (1:1 with Supabase sop_sections row),
// indexes sop_id (bulk queries per SOP), syncState (dirty-row sweep), _cachedAt.
db.version(4).stores({
  sops: 'id, organisation_id, status, version, category, department, _cachedAt',
  sections: 'id, sop_id, section_type, section_kind_id, sort_order',
  steps: 'id, section_id, step_number',
  images: 'id, sop_id, section_id, step_id',
  syncMeta: 'key',
  completions: 'localId, sopId, status',
  photoQueue: 'localId, completionLocalId, stepId, uploaded',
  draftLayouts: 'section_id, sop_id, syncState, _cachedAt',
})

// v5: adds voiceNotesQueue + walkthroughProgress for Phase 12.5 blueprint redesign.
// All v4 stores re-declared verbatim (Dexie cumulative-additive requirement).
// voiceNotesQueue: keyed by id (client UUID); indexes sop_id, syncState, _createdAt.
// walkthroughProgress: keyed by sop_id (single-worker-per-device assumption);
//   indexes step_id + updated_at for flush sweep.
db.version(5).stores({
  // v4 stores — re-declared verbatim per cumulative-bump pattern
  sops: 'id, organisation_id, status, version, category, department, _cachedAt',
  sections: 'id, sop_id, section_type, section_kind_id, sort_order',
  steps: 'id, section_id, step_number',
  images: 'id, sop_id, section_id, step_id',
  syncMeta: 'key',
  completions: 'localId, sopId, status',
  photoQueue: 'localId, completionLocalId, stepId, uploaded',
  draftLayouts: 'section_id, sop_id, syncState, _cachedAt',

  // v5 additions — Phase 12.5
  voiceNotesQueue:     'id, sop_id, syncState, _createdAt',
  walkthroughProgress: 'sop_id, step_id, updated_at',
})

export { db }
