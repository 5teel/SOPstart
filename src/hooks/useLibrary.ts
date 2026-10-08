'use client'
/**
 * Phase 63 (HOME-02) -- the ONE per-SOP list the home, the map and Read show.
 *
 * Browser Supabase client under RLS only: no server action may fire when the home
 * mounts or a SOP is opened (Next 16.2.1 action-queue hazard, CLAUDE.md 2026-09-29).
 * The `library-sops` cache key and its one query function live here.
 *
 * ponytail: minutes are summed client-side from steps with an estimate -- fine to a
 * few hundred SOPs; a summary view if an org outgrows it.
 */
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { buildAreas, SITE_WIDE, type AreaDepartment, type AreaInputs, type AreaMachine, type LibraryArea } from '@/lib/library/areas'
import { sopTypeOf, type SopType } from '@/lib/library/sop-type'
import { objectKindOf, type ObjectKind } from '@/lib/library/object-kind'
import { rowStatus, type RowStatus } from '@/lib/library/status'
import { walkOrder, type FocusKind, type WalkEntry } from '@/lib/sop/focus'
import { latestPublished, lineageRoot, type LineageRow } from '@/lib/sop/lineage-current'
import type { WorkerSopRow } from '@/lib/sop/worker-signal'

/** The `['library-sops']` query function: one row per SOP, latest published version. */
export async function libraryQueryFn(): Promise<WorkerSopRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('sops')
    .select('id, title, sop_number, category_slug, department, published_at, placement, version, parent_sop_id, status')
    .eq('status', 'published')
    .order('title', { ascending: true }) as {
      data: Array<WorkerSopRow & LineageRow> | null
      error: { message: string } | null
    }
  // A failed read must not look like an empty library.
  if (error) throw new Error(error.message)
  // One row per SOP: the latest published version (D-13, D-18), keeping the title order.
  const rows = data ?? []
  const keep = new Set(latestPublished(rows).map((r) => r.id))
  return rows.filter((r) => keep.has(r.id))
}

export interface LibraryRow {
  id: string
  /** Lineage root: parent_sop_id ?? id. Recent and Most used key on it. */
  rootId: string
  title: string
  version: number | null
  categorySlug: string | null
  areaId: string
  areaName: string
  colourVar: string
  type: SopType
  kind: ObjectKind
  minutes: number | null
  /** The person's own history with this SOP; information only. */
  status: RowStatus | null
  /** The person's own non-rejected completions of this lineage. */
  doneCount: number
  /** ISO time of the person's newest walk or completion of this lineage. */
  lastAt: string | null
}

type Fail = { message: string } | null
type Res<T> = { data: T[] | null; error: Fail }
const rows_ = <T,>(r: Res<T>): T[] => {
  if (r.error) throw new Error(r.error.message)
  return r.data ?? []
}

interface Completion { sop_id: string; status: string; submitted_at: string }
interface Walk { id: string; sop_id: string; done: Record<string, string> | null; acks: Record<string, string> | null; updated_at: string }
interface WalkSteps { steps: Array<{ id: string; sop_id: string; section_id: string; kind: FocusKind; text: string; photo_required: boolean; sort_order: number }>; sections: Array<{ id: string; sop_id: string; title: string; sort_order: number }> }
interface Areas { departments: AreaDepartment[]; machines: Array<AreaMachine & { id: string }>; sopMachines: Array<{ sop_id: string; machine_id: string }>; sopDepts: Array<{ sop_id: string; department_id: string }> }

export function useLibrary(userId: string) {
  const supabase = createClient()

  const sopsQ = useQuery({ queryKey: ['library-sops'], queryFn: libraryQueryFn, staleTime: 1000 * 60 * 2 })
  const sops = useMemo(() => (sopsQ.data ?? []) as Array<WorkerSopRow & Partial<LineageRow>>, [sopsQ.data])
  const ids = useMemo(() => sops.map((s) => s.id), [sops])
  const hasIds = ids.length > 0

  // Every visible row (superseded ones too) for lineage roots; RLS scopes it.
  const lineageQ = useQuery({
    queryKey: ['library-lineage'],
    queryFn: async () =>
      rows_(
        (await supabase.from('sops').select('id, parent_sop_id, version, status')) as Res<LineageRow>,
      ),
    staleTime: 1000 * 60 * 5,
  })

  // worker_id is explicit: supervisors read others' rows under RLS (T-63-12).
  const completionsQ = useQuery({
    queryKey: ['library-completions', userId],
    enabled: !!userId,
    queryFn: async () =>
      rows_(
        (await supabase
          .from('sop_completions')
          .select('sop_id, status, submitted_at')
          .eq('worker_id', userId)
          .neq('status', 'rejected')) as Res<Completion>,
      ),
    staleTime: 1000 * 60 * 2,
  })

  const walksQ = useQuery({
    queryKey: ['library-walks', userId],
    enabled: !!userId,
    queryFn: async () =>
      rows_(
        (await supabase
          .from('sop_walks')
          .select('id, sop_id, done, acks, updated_at')
          .eq('worker_id', userId)
          .eq('status', 'in_progress')) as Res<Walk>,
      ),
    staleTime: 1000 * 60,
  })

  // Every junction read is bounded by the visible ids (T-63-13); departments are
  // the caller's own org by policy.
  const areasQ = useQuery({
    queryKey: ['library-areas', ids],
    enabled: hasIds,
    queryFn: async (): Promise<Areas> => {
      const [d, m, sm, sd] = await Promise.all([
        supabase.from('departments').select('id, name, archived'),
        supabase.from('site_machines').select('id, name, sort, department_id'),
        supabase.from('sop_machines').select('sop_id, machine_id').in('sop_id', ids),
        supabase.from('sop_departments').select('sop_id, department_id').in('sop_id', ids),
      ])
      return {
        departments: rows_(d as Res<AreaDepartment>),
        machines: rows_(m as Res<AreaMachine & { id: string }>),
        sopMachines: rows_(sm as Res<{ sop_id: string; machine_id: string }>),
        sopDepts: rows_(sd as Res<{ sop_id: string; department_id: string }>),
      }
    },
    staleTime: 1000 * 60 * 5,
  })

  // PostgREST caps a response at 1000 rows; page so the minutes are never silently short.
  const minutesQ = useQuery({
    queryKey: ['library-minutes', ids],
    enabled: hasIds,
    queryFn: async () => {
      const out: Array<{ sop_id: string; time_estimate_minutes: number }> = []
      for (let from = 0; ; from += 1000) {
        const page = rows_(
          (await supabase
            .from('sop_focus_steps')
            .select('sop_id, time_estimate_minutes')
            .in('sop_id', ids)
            .not('time_estimate_minutes', 'is', null)
            .order('id')
            .range(from, from + 999)) as Res<{ sop_id: string; time_estimate_minutes: number }>,
        )
        out.push(...page)
        if (page.length < 1000) return out
      }
    },
    staleTime: 1000 * 60 * 5,
  })

  const walkSopIds = useMemo(() => [...new Set((walksQ.data ?? []).map((w) => w.sop_id))].sort(), [walksQ.data])
  const walkStepsQ = useQuery({
    queryKey: ['library-walk-steps', walkSopIds],
    enabled: walkSopIds.length > 0,
    queryFn: async (): Promise<WalkSteps> => {
      const [st, se] = await Promise.all([
        supabase.from('sop_focus_steps').select('id, section_id, kind, text, photo_required, sort_order, sop_id').in('sop_id', walkSopIds),
        supabase.from('sop_sections').select('id, title, sort_order, sop_id').in('sop_id', walkSopIds),
      ])
      return {
        steps: rows_(st as Res<WalkSteps['steps'][number]>),
        sections: rows_(se as Res<WalkSteps['sections'][number]>),
      }
    },
    staleTime: 1000 * 60,
  })

  const built = useMemo(() => {
    const lineage = lineageQ.data ?? []
    const rootBySop = new Map(lineage.map((r) => [r.id, lineageRoot(r)]))
    const rootOf = (id: string) => rootBySop.get(id) ?? id

    const a = areasQ.data
    const machinesBySop = new Map<string, string[]>()
    for (const l of a?.sopMachines ?? []) machinesBySop.set(l.sop_id, [...(machinesBySop.get(l.sop_id) ?? []), l.machine_id])
    const deptsBySop = new Map<string, string[]>()
    for (const l of a?.sopDepts ?? []) deptsBySop.set(l.sop_id, [...(deptsBySop.get(l.sop_id) ?? []), l.department_id])
    const machineById = new Map((a?.machines ?? []).map((m) => [m.id, m]))
    const inputs: AreaInputs = { machinesBySop, machineById, departments: a?.departments ?? [], deptsBySop }
    const areas: LibraryArea[] = buildAreas(ids, inputs)
    const areaOfSop = new Map<string, LibraryArea>()
    for (const ar of areas) for (const id of ar.sopIds) areaOfSop.set(id, ar)

    const minutesBySop = new Map<string, number>()
    for (const m of minutesQ.data ?? []) minutesBySop.set(m.sop_id, (minutesBySop.get(m.sop_id) ?? 0) + Number(m.time_estimate_minutes))

    // Own completions and walks, by lineage root.
    const completionsByRoot = new Map<string, Completion[]>()
    for (const c of completionsQ.data ?? []) {
      const r = rootOf(c.sop_id)
      completionsByRoot.set(r, [...(completionsByRoot.get(r) ?? []), c])
    }
    const walkByRoot = new Map<string, Walk>()
    for (const w of walksQ.data ?? []) {
      const r = rootOf(w.sop_id)
      const cur = walkByRoot.get(r)
      if (!cur || w.updated_at > cur.updated_at) walkByRoot.set(r, w)
    }
    const orderOf = (sopId: string): WalkEntry[] | null => {
      const ws = walkStepsQ.data
      if (!ws) return null
      return walkOrder(ws.sections.filter((s) => s.sop_id === sopId), ws.steps.filter((s) => s.sop_id === sopId))
    }

    const rows: LibraryRow[] = sops.map((s) => {
      const root = rootOf(s.id)
      const area = areaOfSop.get(s.id)
      const linked = (machinesBySop.get(s.id) ?? [])
        .map((id) => machineById.get(id))
        .filter((m): m is AreaMachine & { id: string } => !!m)
        .sort((x, y) => (x.sort ?? Number.MAX_SAFE_INTEGER) - (y.sort ?? Number.MAX_SAFE_INTEGER) || x.name.localeCompare(y.name, 'en', { sensitivity: 'base' }))
      const own = completionsByRoot.get(root) ?? []
      const latest = own.reduce<Completion | null>((best, c) => (!best || c.submitted_at > best.submitted_at ? c : best), null)
      const walk = walkByRoot.get(root) ?? null
      const order = walk ? orderOf(walk.sop_id) : null
      const hasNewerVersion = !!latest && !!s.published_at && new Date(s.published_at) > new Date(latest.submitted_at)
      const minutes = minutesBySop.get(s.id)
      const times = [latest?.submitted_at, walk?.updated_at].filter((t): t is string => !!t).sort()
      return {
        id: s.id,
        rootId: root,
        title: s.title ?? 'Untitled SOP',
        version: s.version ?? null,
        categorySlug: s.category_slug,
        areaId: area?.id ?? SITE_WIDE,
        areaName: area?.name ?? 'Site-wide',
        colourVar: area?.colourVar ?? 'var(--area-1)',
        type: sopTypeOf(s, linked.length > 0),
        kind: objectKindOf(linked[0]?.name ?? null),
        minutes: minutes ? Math.max(1, Math.round(minutes)) : null,
        // A walk whose steps have not landed yet shows no status rather than a wrong one.
        status:
          walk && !order
            ? null
            : rowStatus({
                walk: walk ? { done: Object.keys(walk.done ?? {}), acks: Object.keys(walk.acks ?? {}) } : null,
                order,
                latestCompletion: latest ? { sopId: latest.sop_id, status: latest.status, submittedAt: latest.submitted_at } : null,
                currentId: s.id,
                hasNewerVersion,
              }),
        doneCount: own.length,
        lastAt: times[times.length - 1] ?? null,
      }
    })
    return { rows, areas, byId: new Map(rows.map((r) => [r.id, r])) }
  }, [sops, ids, lineageQ.data, areasQ.data, minutesQ.data, completionsQ.data, walksQ.data, walkStepsQ.data])

  return {
    ...built,
    loading: sopsQ.isLoading || lineageQ.isLoading || (hasIds && areasQ.isLoading),
    error: sopsQ.error as Error | null,
    refetch: sopsQ.refetch,
  }
}
