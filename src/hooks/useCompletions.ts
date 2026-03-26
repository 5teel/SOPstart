'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { CompletionStatus } from '@/types/sop'

// ---------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------

export interface CompletionPhoto {
  id: string
  step_id: string
  storage_path: string
  content_type: string
}

export interface CompletionSignOff {
  id: string
  supervisor_id: string
  decision: string
  reason: string | null
  created_at: string
}

export interface WorkerCompletion {
  id: string
  sop_id: string
  sop_version: number
  status: CompletionStatus
  submitted_at: string
  content_hash: string
  step_data: Record<string, number>
  sop_title: string | null
  photo_count: number
  sign_off: CompletionSignOff | null
}

export interface SupervisorCompletion {
  id: string
  sop_id: string
  worker_id: string
  sop_version: number
  status: CompletionStatus
  submitted_at: string
  sop_title: string | null
  photo_count: number
  sign_off: CompletionSignOff | null
}

export interface CompletionDetail {
  id: string
  sop_id: string
  worker_id: string
  sop_version: number
  status: CompletionStatus
  submitted_at: string
  step_data: Record<string, number>
  sop_title: string | null
  photos: CompletionPhoto[]
  sign_off: CompletionSignOff | null
}

export type FilterState =
  | { type: 'all' }
  | { type: 'by_sop'; value: string }
  | { type: 'by_worker'; value: string }

// Raw row shape returned by Supabase select with joins
interface RawCompletionRow {
  id: string
  sop_id: string
  worker_id?: string
  sop_version: number
  status: string
  submitted_at: string
  content_hash?: string
  step_data?: unknown
  sops: { title: string | null } | { title: string | null }[] | null
  completion_photos: { id: string }[] | null
  completion_sign_offs: CompletionSignOff[] | null
}

interface RawDetailRow extends RawCompletionRow {
  worker_id: string
  completion_photos: CompletionPhoto[] | null
}

function extractSopTitle(sops: RawCompletionRow['sops']): string | null {
  if (!sops) return null
  if (Array.isArray(sops)) return sops[0]?.title ?? null
  return sops.title ?? null
}

function extractFirstSignOff(signOffs: CompletionSignOff[] | null): CompletionSignOff | null {
  if (!signOffs || signOffs.length === 0) return null
  return signOffs[0]
}

// ---------------------------------------------------------------
// useWorkerCompletions
//
// Fetches the current worker's own completion history.
// RLS automatically scopes to the authenticated user's completions.
// ---------------------------------------------------------------
export function useWorkerCompletions() {
  return useQuery<WorkerCompletion[]>({
    queryKey: ['completions', 'worker'],
    queryFn: async () => {
      const supabase = createClient()

      const { data, error } = await supabase
        .from('sop_completions')
        .select(`
          id,
          sop_id,
          sop_version,
          status,
          submitted_at,
          content_hash,
          step_data,
          sops ( title ),
          completion_photos ( id ),
          completion_sign_offs ( id, supervisor_id, decision, reason, created_at )
        `)
        .order('submitted_at', { ascending: false })
        .limit(50)

      if (error) {
        console.error('useWorkerCompletions error:', error)
        return []
      }

      const rows = (data ?? []) as unknown as RawCompletionRow[]

      return rows.map((row) => ({
        id: row.id,
        sop_id: row.sop_id,
        sop_version: row.sop_version,
        status: row.status as CompletionStatus,
        submitted_at: row.submitted_at,
        content_hash: row.content_hash ?? '',
        step_data: (row.step_data ?? {}) as Record<string, number>,
        sop_title: extractSopTitle(row.sops),
        photo_count: row.completion_photos?.length ?? 0,
        sign_off: extractFirstSignOff(row.completion_sign_offs),
      }))
    },
    networkMode: 'offlineFirst',
    refetchOnWindowFocus: true,
  })
}

// ---------------------------------------------------------------
// useSupervisorCompletions
//
// Fetches completions for workers supervised by the current user.
// RLS handles scoping — supervisors see their assigned workers,
// safety_managers see all org completions.
// ---------------------------------------------------------------
export function useSupervisorCompletions(filter: FilterState) {
  return useQuery<SupervisorCompletion[]>({
    queryKey: ['completions', 'supervisor', filter.type, 'value' in filter ? filter.value : undefined],
    queryFn: async () => {
      const supabase = createClient()

      let query = supabase
        .from('sop_completions')
        .select(`
          id,
          sop_id,
          worker_id,
          sop_version,
          status,
          submitted_at,
          sops ( title ),
          completion_photos ( id ),
          completion_sign_offs ( id, supervisor_id, decision, reason, created_at )
        `)
        .order('submitted_at', { ascending: false })
        .limit(100)

      if (filter.type === 'by_sop' && 'value' in filter && filter.value) {
        query = query.eq('sop_id', filter.value)
      }
      if (filter.type === 'by_worker' && 'value' in filter && filter.value) {
        query = query.eq('worker_id', filter.value)
      }

      const { data, error } = await query

      if (error) {
        console.error('useSupervisorCompletions error:', error)
        return []
      }

      const rows = (data ?? []) as unknown as RawCompletionRow[]

      return rows.map((row) => ({
        id: row.id,
        sop_id: row.sop_id,
        worker_id: row.worker_id ?? '',
        sop_version: row.sop_version,
        status: row.status as CompletionStatus,
        submitted_at: row.submitted_at,
        sop_title: extractSopTitle(row.sops),
        photo_count: row.completion_photos?.length ?? 0,
        sign_off: extractFirstSignOff(row.completion_sign_offs),
      }))
    },
    networkMode: 'offlineFirst',
    refetchOnWindowFocus: true,
  })
}

// ---------------------------------------------------------------
// useCompletionDetail
//
// Fetches a single completion with full step, photo, and sign-off data.
// ---------------------------------------------------------------
export function useCompletionDetail(completionId: string) {
  return useQuery<CompletionDetail | null>({
    queryKey: ['completions', 'detail', completionId],
    queryFn: async () => {
      const supabase = createClient()

      const { data, error } = await supabase
        .from('sop_completions')
        .select(`
          id,
          sop_id,
          worker_id,
          sop_version,
          status,
          submitted_at,
          step_data,
          sops ( title ),
          completion_photos ( id, step_id, storage_path, content_type ),
          completion_sign_offs ( id, supervisor_id, decision, reason, created_at )
        `)
        .eq('id', completionId)
        .single()

      if (error) {
        console.error('useCompletionDetail error:', error)
        return null
      }
      if (!data) return null

      const row = data as unknown as RawDetailRow

      const photos: CompletionPhoto[] = (row.completion_photos ?? []).map((p) => ({
        id: p.id,
        step_id: p.step_id,
        storage_path: p.storage_path,
        content_type: p.content_type,
      }))

      return {
        id: row.id,
        sop_id: row.sop_id,
        worker_id: row.worker_id,
        sop_version: row.sop_version,
        status: row.status as CompletionStatus,
        submitted_at: row.submitted_at,
        step_data: (row.step_data ?? {}) as Record<string, number>,
        sop_title: extractSopTitle(row.sops),
        photos,
        sign_off: extractFirstSignOff(row.completion_sign_offs),
      }
    },
    enabled: Boolean(completionId),
    networkMode: 'offlineFirst',
  })
}
