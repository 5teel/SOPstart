'use client'
/**
 * The ONE place a worker's per-SOP list is built (CLAUDE.md 2026-09-27 -- a
 * classification/derivation living in two modules is a future disagreement).
 * `/sops` (SopsSection) calls this hook so there is exactly one derivation
 * of a worker's badges. The classifier
 * that turns a WorkerSop into a label (topSignal / plantRelState) stays in
 * src/lib/sop/worker-signal.ts -- this hook only gathers and joins the raw
 * data (assignment lookup, library rows, lineage-rooted last completion,
 * refresher window, newer-version check).
 */
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { getUserSopAssignments } from '@/actions/assignments'
import {
  refresherDueDate,
  isRefresherDue as computeRefresherDue,
  isRefresherOverdue as computeRefresherOverdue,
} from '@/lib/competency/refresher'
import { categoryLabel } from '@/lib/sop-categories'
import type { WorkerSop, WorkerSopRow } from '@/lib/sop/worker-signal'

export function useWorkerSops(requestedIds?: ReadonlySet<string>) {
  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ['user-sop-assignments'],
    queryFn: getUserSopAssignments,
    staleTime: 1000 * 60 * 5,
  })

  // The whole published library. Used to be a second tab; it is a scope now, so
  // it loads alongside the assigned list rather than behind a tab switch.
  const { data: librarySops = [], isLoading: libraryLoading } = useQuery<WorkerSopRow[]>({
    queryKey: ['library-sops'],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('sops')
        .select('id, title, sop_number, category_slug, department, published_at')
        .eq('status', 'published')
        .order('title', { ascending: true }) as { data: WorkerSopRow[] | null }
      return data ?? []
    },
    staleTime: 1000 * 60 * 2,
  })

  // AFL-VER-04 / D-08: fetch the worker's most recent completion submitted_at per SOP.
  // Compares sops.published_at (on the cached SOP row) vs MAX(sop_completions.submitted_at).
  // Any newer published version triggers the "Updated" badge -- no material-change
  // classification (D-08). WR-02: RLS alone is NOT a self-scope here --
  // admins/safety managers read org-wide completions and supervisors read
  // their assigned workers', so without an explicit worker_id filter those
  // roles' refresher chips and "Updated" badges render from OTHER people's
  // training clocks. Filter to the current user explicitly.
  const { data: lastCompletionMap = {} } = useQuery<Record<string, string>>({
    queryKey: ['worker-last-completions'],
    queryFn: async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const { data } = await supabase
        .from('sop_completions')
        .select('sop_id, submitted_at')
        .eq('worker_id', user?.id ?? '')
        .order('submitted_at', { ascending: false }) as {
          data: Array<{ sop_id: string; submitted_at: string }> | null
        }
      // Build a map: sop_id → most recent submitted_at
      // (the query returns newest-first so first match per sop_id wins)
      const map: Record<string, string> = {}
      for (const row of data ?? []) {
        if (!map[row.sop_id]) map[row.sop_id] = row.submitted_at
      }
      return map
    },
    staleTime: 1000 * 60 * 2,
  })

  // Phase 36 REF-01 / D-08: per-SOP refresher interval + lineage root, read
  // from `sops` directly (RLS-scoped to what the worker can see via
  // org_members_can_view_sops -- superseded rows included). Still no server
  // action, no competency classifier call (T-36-08-01/03 accepted).
  const { data: sopMetaMap = {} } = useQuery<Record<string, { root: string; interval: number | null }>>({
    queryKey: ['sop-refresher-intervals'],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('sops')
        .select('id, parent_sop_id, refresher_interval_months') as {
          data: Array<{ id: string; parent_sop_id: string | null; refresher_interval_months: number | null }> | null
        }
      const map: Record<string, { root: string; interval: number | null }> = {}
      for (const row of data ?? []) {
        map[row.id] = { root: row.parent_sop_id ?? row.id, interval: row.refresher_interval_months }
      }
      return map
    },
    staleTime: 1000 * 60 * 5,
  })

  // WR-03: after a supersede, notifyAssignedWorkers repoints the assignment
  // to the NEW sop id while the worker's completions stay on the OLD id -- so
  // an exact-sop_id lookup silently reset the refresher clock (and killed the
  // "Updated" badge) the moment a SOP was republished. Key the completion
  // clock by lineage ROOT (parent_sop_id ?? id), mirroring the server-side
  // CMP-03 lineage widening. Lineage is flat, one level deep.
  const rootOf = (sopId: string): string => sopMetaMap[sopId]?.root ?? sopId
  const lastCompletionByRoot: Record<string, string> = {}
  for (const [sopId, submittedAt] of Object.entries(lastCompletionMap)) {
    const root = rootOf(sopId)
    if (!lastCompletionByRoot[root] || submittedAt > lastCompletionByRoot[root]) {
      lastCompletionByRoot[root] = submittedAt
    }
  }

  function getAssignmentInfo(sopId: string) {
    return assignments.find((a) => a.sop_id === sopId)
  }

  /**
   * Phase 36 REF-01 / D-08: derives the two informational refresher chip
   * booleans from the worker's last completion + this SOP's interval. A
   * missing interval or missing completion yields null due date → no chip
   * (D-02 zero-noise default). WR-04: "due" now has a real lead-in window
   * (REFRESHER_DUE_WINDOW_DAYS before the due date) so the "Refresher due"
   * label is reachable before it escalates to "Refresher overdue". `now` is
   * computed once per call, never hoisted to module scope (CLAUDE.md
   * 2026-06-08 hydration-mismatch class).
   */
  function refresherState(sopId: string): { isRefresherDue: boolean; isRefresherOverdue: boolean } {
    const now = new Date().toISOString()
    const due = refresherDueDate(lastCompletionByRoot[rootOf(sopId)] ?? null, sopMetaMap[sopId]?.interval ?? null)
    return { isRefresherDue: computeRefresherDue(due, now), isRefresherOverdue: computeRefresherOverdue(due, now) }
  }

  /**
   * AFL-VER-04 / D-08: Returns true if the SOP's published_at is newer than
   * the worker's last completion submitted_at for this SOP.
   * Triggers on ANY newer published version -- no material-change classification.
   */
  function hasNewerVersion(sopId: string, publishedAt: string | null): boolean {
    if (!publishedAt) return false
    const lastCompleted = lastCompletionByRoot[rootOf(sopId)]
    if (!lastCompleted) return false // never completed → no "updated" signal
    return new Date(publishedAt) > new Date(lastCompleted)
  }

  // Sketch 005 variant C: a worker row carries ONE signal and the training
  // clock moves to the detail pane. Everything is derived here -- the browser
  // renders what it is handed and owns no data logic.
  //
  // One list, two origins: what the worker has (their own assignments, joined
  // to the published library), then everything else that is published. No
  // department filter here -- that is view state owned by whichever caller
  // (SopsSection).
  const assignedIds = new Set(assignments.map((a) => a.sop_id))
  const toRow = (sop: WorkerSopRow, isAssigned: boolean): WorkerSop => ({
    id: sop.id,
    title: sop.title ?? 'Untitled SOP',
    categoryLabel: categoryLabel(sop.category_slug),
    lastCompletedAt: lastCompletionByRoot[rootOf(sop.id)] ?? null,
    ...refresherState(sop.id),
    hasNewerVersion: hasNewerVersion(sop.id, sop.published_at),
    isAssigned,
    isSelfAssigned: isAssigned ? (getAssignmentInfo(sop.id)?.isSelfAssigned ?? false) : false,
    removalRequested: isAssigned ? (requestedIds?.has(sop.id) ?? false) : false,
    raw: sop,
  })
  const workerSops: WorkerSop[] = [
    ...librarySops.filter((s) => assignedIds.has(s.id)).map((s) => toRow(s, true)),
    ...librarySops.filter((s) => !assignedIds.has(s.id)).map((s) => toRow(s, false)),
  ]

  return { workerSops, assignments, libraryLoading, assignmentsLoading }
}
