/**
 * Phase 58 (58-09) -- what the walk actions and the Send branch both need: the
 * walk row as the client sees it, and the SOP's walk order read for one org.
 *
 * Plain module (no directive). The caller passes its own client: the walk actions
 * pass the session client (RLS), the Send branch passes the service client. Every
 * query here is filtered by the organisation the CALLER supplies, which is always
 * the session organisation, never a value read off a fetched row.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { walkOrder, type FocusKind, type WalkEntry } from '@/lib/sop/focus'

export interface WalkPhoto {
  localId: string
  stepId: string
  storagePath: string
  contentType: string
}

export interface WalkState {
  id: string
  sop_id: string
  sop_version: number
  /** stepId -> ISO time the hazard / PPE was acknowledged. */
  acks: Record<string, string>
  /** stepId -> ISO time the step was done. */
  done: Record<string, string>
  photos: WalkPhoto[]
  current_step_id: string | null
}

export const WALK_COLUMNS = 'id, sop_id, sop_version, acks, done, photos, current_step_id, status, organisation_id, worker_id'

export function toWalkState(row: {
  id: string
  sop_id: string
  sop_version: number
  acks: unknown
  done: unknown
  photos: unknown
  current_step_id: string | null
}): WalkState {
  return {
    id: row.id,
    sop_id: row.sop_id,
    sop_version: row.sop_version,
    acks: (row.acks ?? {}) as Record<string, string>,
    done: (row.done ?? {}) as Record<string, string>,
    photos: (Array.isArray(row.photos) ? row.photos : []) as WalkPhoto[],
    current_step_id: row.current_step_id,
  }
}

export interface WalkSop {
  allow_forward_jump: boolean
  order: WalkEntry[]
}

/** The SOP in `organisationId` as a walk order, or null when it is not in that org. */
export async function loadWalkSop(client: SupabaseClient, organisationId: string, sopId: string): Promise<WalkSop | null> {
  const { data: sop } = await client
    .from('sops')
    .select('id, allow_forward_jump')
    .eq('id', sopId)
    .eq('organisation_id', organisationId)
    .maybeSingle()
  if (!sop) return null

  const [secRes, stepRes] = await Promise.all([
    client.from('sop_sections').select('id, title, sort_order').eq('sop_id', sopId),
    client
      .from('sop_focus_steps')
      .select('id, section_id, kind, text, photo_required, sort_order')
      .eq('sop_id', sopId)
      .eq('organisation_id', organisationId),
  ])
  if (secRes.error || stepRes.error) throw new Error((secRes.error ?? stepRes.error)!.message)

  const steps = (stepRes.data ?? []) as Array<{
    id: string
    section_id: string
    kind: FocusKind
    text: string
    photo_required: boolean
    sort_order: number
  }>
  return {
    allow_forward_jump: !!(sop as { allow_forward_jump: boolean | null }).allow_forward_jump,
    order: walkOrder((secRes.data ?? []) as Array<{ id: string; title: string; sort_order: number }>, steps),
  }
}
