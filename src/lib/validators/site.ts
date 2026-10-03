/**
 * Phase 51 -- site model validators (D-01, D-02, D-05, T-51-03, T-51-04).
 *
 * Plain module, no directive -- importable from both client and server code.
 * House style: `z.string().uuid()`, not `z.uuid()`.
 */
import { z } from 'zod'

// -- Storage constants (D-05) --------------------------------------------
export const SCENE_MAX_BYTES = 15 * 1024 * 1024
export const SCENE_MIME_TYPES = ['image/jpeg', 'image/png'] as const

export const sceneExtSchema = z.enum(['jpg', 'png'])

// -- Polygon (Pitfall 3: shape only, no convexity/self-intersection check) --
export const pointSchema = z.tuple([
  z.number().finite().min(0),
  z.number().finite().min(0),
])

export const polygonSchema = z.array(pointSchema).min(3).max(200)

export const machineNameSchema = z.string().trim().min(1).max(80)

// -- Site machine ----------------------------------------------------------
export const upsertSiteMachineSchema = z.object({
  id: z.string().uuid().optional(),
  siteLayoutId: z.string().uuid(),
  name: machineNameSchema,
  departmentId: z.string().uuid().nullable(),
  polygon: polygonSchema,
  sort: z.number().int().min(0).max(10000).optional(),
})

// -- Site layout -------------------------------------------------------------
export const upsertSiteLayoutSchema = z.object({
  id: z.string().uuid(),
  ext: sceneExtSchema,
  name: z.string().trim().min(1).max(80).optional(),
})

// -- SOP <-> machine junction ------------------------------------------------
export const setSopMachinesSchema = z.object({
  sopId: z.string().uuid(),
  machineIds: z.array(z.string().uuid()).max(200),
})

// -- Scene generation (T-51-04: cap prompt cost before any paid call) -------
export const generateSceneSchema = z.object({
  description: z.string().trim().min(20).max(1200),
})

// -- Types -------------------------------------------------------------------
export type Point = z.infer<typeof pointSchema>
export type Polygon = z.infer<typeof polygonSchema>

// All timestamps are ISO strings (serialisation boundary -- CLAUDE.md rule 3).
export interface SiteLayout {
  id: string
  organisation_id: string
  name: string
  scene_path: string | null
  scene_width: number | null
  scene_height: number | null
  created_at: string
  updated_at: string
}

export interface SiteMachine {
  id: string
  site_layout_id: string
  organisation_id: string
  name: string
  department_id: string | null
  polygon: Point[]
  sprite_path: string | null
  code: string
  sort: number
  created_at: string
  updated_at: string
}

export interface SopMachineLink {
  sop_id: string
  machine_id: string
}

export interface SiteDepartment {
  id: string
  name: string
  colour: string
}

export interface SiteSopOption {
  id: string
  title: string
}

export interface SiteData {
  layout: (SiteLayout & { sceneUrl: string }) | null
  machines: SiteMachine[]
  links: SopMachineLink[]
  departments: SiteDepartment[]
  sops: SiteSopOption[]
  canGenerate: boolean
}

// -- Worker-readable subset (Phase 52, D-03) ---------------------------------
// Plain, serialisable fields only -- no sprite_path/scene_path (those are
// signed into URLs before this crosses the server/client boundary).
export interface WorkerSiteLayout {
  id: string
  sceneUrl: string
  sceneWidth: number
  sceneHeight: number
}

export interface WorkerSiteMachine {
  id: string
  name: string
  department_id: string | null
  polygon: Point[]
  spriteUrl: string | null
  code: string
}

export interface WorkerSiteData {
  layout: WorkerSiteLayout | null
  machines: WorkerSiteMachine[]
  links: SopMachineLink[]
  departments: SiteDepartment[]
}

// -- Admin floor read (Phase 54, D-04) ---------------------------------------
// Same render shape as the worker floor — but `links` are NOT narrowed to
// published SOPs (library health covers drafts too).
export type AdminSiteFloor = WorkerSiteData
