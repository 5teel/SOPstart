/**
 * Phase 41 bundle-regression fix: types shared between
 * `src/app/(protected)/sops/page.tsx` and the admin-only lazy chunk
 * `AdminSopSurface.tsx`. A pure type-only module — erased at compile time,
 * so importing it from either side costs nothing in either bundle and
 * creates no runtime circular-import risk (page.tsx `dynamic()`-imports
 * AdminSopSurface.tsx, so AdminSopSurface.tsx must never import page.tsx).
 */
import type { AdminScope } from './AdminSopSurface'

export type WorkerScope = 'all' | 'refresher' | 'updated' | 'not-done' | 'library' | 'not-added'

export type SopScope = WorkerScope | AdminScope

export interface SopNav {
  scope: SopScope
  ownerOnly: boolean
  departments?: string
  collection?: string
  sop?: string
}
