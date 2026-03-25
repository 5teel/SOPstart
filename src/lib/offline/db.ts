import Dexie, { type EntityTable } from 'dexie'
import type { SopSection, SopStep, SopImage } from '@/types/sop'
import type { Sop } from '@/types/sop'

export interface CachedSop extends Sop {
  _cachedAt: number
}

type SopAssistantDB = Dexie & {
  sops: EntityTable<CachedSop, 'id'>
  sections: EntityTable<SopSection, 'id'>
  steps: EntityTable<SopStep, 'id'>
  images: EntityTable<SopImage, 'id'>
  syncMeta: EntityTable<{ key: string; value: string }, 'key'>
}

const db = new Dexie('SopAssistantDB') as SopAssistantDB

db.version(1).stores({
  sops: 'id, organisation_id, status, version, category, department, _cachedAt',
  sections: 'id, sop_id, section_type, sort_order',
  steps: 'id, section_id, step_number',
  images: 'id, sop_id, section_id, step_id',
  syncMeta: 'key',
})

export { db }
