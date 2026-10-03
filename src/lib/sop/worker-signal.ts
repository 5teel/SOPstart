/**
 * The ONE place a worker's SOP state is classified (CLAUDE.md 2026-09-27: "a
 * classification lives in ONE plain module imported by every surface that
 * asks the question" — a second copy is a future disagreement). `plantRelState`
 * (the plant home's pins, panel and Now card, D-06) is the sole classifier
 * now that the Phase 41 worker list/detail badge it used to share this file
 * with (`topSignal`, retired in 54-05 alongside SopWorkerBrowser) is gone.
 * Pins and the Now card are DERIVED from this module, never stored (D-05) —
 * no Supabase, no Dexie, no browser storage, no Date.now() in this file
 * (tests/phase52/plant-pins-no-storage.spec.ts pins this).
 *
 * Plain module, no directive -- importable from both client and server code.
 * Only `import type` for the shapes owned elsewhere (SopMachineLink).
 */
import type { SopMachineLink } from '@/lib/validators/site'

/** Phase 54 (D-10): moved here from `src/components/sop/sops-nav-types.ts`,
 *  which 54-05 deletes — a plain type export, no I/O, no new imports. */
export type WorkerScope = 'all' | 'refresher' | 'updated' | 'not-done' | 'library' | 'not-added'

/** The published library row a worker card reads. */
export type WorkerSopRow = {
  id: string
  title: string | null
  sop_number: string | null
  category_slug: string | null
  department: string | null
  published_at: string | null
}

export type WorkerSop = {
  id: string
  title: string
  /** Resolved in the page — this module must not pull the category module
   *  into the worker bundle (SB-LINE-06). */
  categoryLabel: string | null
  /** Worker's most recent completion for this SOP's lineage, ISO. */
  lastCompletedAt: string | null
  isRefresherDue: boolean
  isRefresherOverdue: boolean
  hasNewerVersion: boolean
  /** In the worker's own list, vs a library row they have not taken on. */
  isAssigned: boolean
  /** Self-added vs assigned by a manager — decides which removal path applies. */
  isSelfAssigned: boolean
  removalRequested: boolean
  /** The published library row, for the card renderer. */
  raw: WorkerSopRow
}

// ---------------------------------------------------------------------------
// Plant home (Phase 52, D-06): a coarser 4-state vocabulary for pins, the
// machine panel and the Now card. Unassigned SOPs never pin — pins are the
// viewer's own to-dos (D-06).
// ---------------------------------------------------------------------------
export type PlantRel = 'due' | 'never' | 'new' | 'done'

export function plantRelState(sop: WorkerSop): PlantRel | null {
  if (!sop.isAssigned) return null
  if (sop.isRefresherOverdue || sop.isRefresherDue) return 'due'
  if (sop.hasNewerVersion) return 'new'
  if (!sop.lastCompletedAt) return 'never'
  return 'done'
}

export const PLANT_REL_LABEL: Record<PlantRel, string> = {
  due: 'Due',
  new: 'Updated',
  never: 'Never done',
  done: 'Done',
}

// Ordering due -> never -> updated -> done -> unassigned (D-10).
const REL_RANK: Record<PlantRel | 'unassigned', number> = { due: 0, never: 1, new: 2, done: 3, unassigned: 4 }

function relRank(sop: WorkerSop): number {
  const rel = plantRelState(sop)
  return REL_RANK[rel ?? 'unassigned']
}

/** To-do first, then never/updated/done/unassigned; ties broken by title. */
export function compareToDoFirst(a: WorkerSop, b: WorkerSop): number {
  const diff = relRank(a) - relRank(b)
  if (diff !== 0) return diff
  return a.title.localeCompare(b.title)
}

/** Count of a machine's linked SOPs whose rel is due/never/new, for the viewer. */
export function derivePlantPins(
  machines: ReadonlyArray<{ id: string }>,
  links: ReadonlyArray<SopMachineLink>,
  sopsById: ReadonlyMap<string, WorkerSop>
): Map<string, number> {
  const pins = new Map<string, number>()
  for (const m of machines) {
    const sopIds = links.filter((l) => l.machine_id === m.id).map((l) => l.sop_id)
    const count = sopIds.filter((id) => {
      const sop = sopsById.get(id)
      if (!sop) return false
      const rel = plantRelState(sop)
      return rel === 'due' || rel === 'never' || rel === 'new'
    }).length
    if (count > 0) pins.set(m.id, count)
  }
  return pins
}

/** A machine's linked SOPs (present in sopsById only), to-do first. */
export function machineSops(
  machineId: string,
  links: ReadonlyArray<SopMachineLink>,
  sopsById: ReadonlyMap<string, WorkerSop>
): WorkerSop[] {
  return links
    .filter((l) => l.machine_id === machineId)
    .map((l) => sopsById.get(l.sop_id))
    .filter((s): s is WorkerSop => Boolean(s))
    .sort(compareToDoFirst)
}

// ---------------------------------------------------------------------------
// Now card
// ---------------------------------------------------------------------------
export interface NowItem {
  sop: WorkerSop
  rel: PlantRel
  machine: { id: string; name: string } | null
  departmentName: string | null
}

type NowMachine = { id: string; name: string; department_id: string | null }
type NowDepartment = { id: string; name: string }

/** The SOP's first linked machine, by machine name (alphabetical). */
function firstMachineFor(
  sopId: string,
  links: ReadonlyArray<SopMachineLink>,
  machines: ReadonlyArray<NowMachine>
): NowMachine | null {
  const machineIds = new Set(links.filter((l) => l.sop_id === sopId).map((l) => l.machine_id))
  const linked = machines.filter((m) => machineIds.has(m.id)).sort((a, b) => a.name.localeCompare(b.name))
  return linked[0] ?? null
}

/** Due -> never -> updated, excludes done/unassigned. A to-do SOP with no
 *  machine link is still included, with machine null — nothing the worker
 *  owes disappears just because an admin hasn't linked it yet. */
export function pickNowQueue(
  sops: ReadonlyArray<WorkerSop>,
  links: ReadonlyArray<SopMachineLink>,
  machines: ReadonlyArray<NowMachine>,
  departments: ReadonlyArray<NowDepartment>,
  limit = 3
): NowItem[] {
  const deptById = new Map(departments.map((d) => [d.id, d.name]))
  const todo = sops
    .filter((s) => {
      const rel = plantRelState(s)
      return rel === 'due' || rel === 'never' || rel === 'new'
    })
    .sort(compareToDoFirst)
    .slice(0, limit)

  return todo.map((sop) => {
    const machine = firstMachineFor(sop.id, links, machines)
    return {
      sop,
      rel: plantRelState(sop) as PlantRel,
      machine: machine ? { id: machine.id, name: machine.name } : null,
      departmentName: machine?.department_id ? (deptById.get(machine.department_id) ?? null) : null,
    }
  })
}

// ---------------------------------------------------------------------------
// Ask bar (D-13): the scene highlights matching machines, the open panel's
// list narrows — but never to nothing just because the machine itself matched.
// ---------------------------------------------------------------------------
type AskMachine = { id: string; name: string }

/** Machine ids whose name, or any linked SOP's title, matches the query. */
export function askMatches(
  query: string,
  machines: ReadonlyArray<AskMachine>,
  links: ReadonlyArray<SopMachineLink>,
  sopsById: ReadonlyMap<string, WorkerSop>
): Set<string> {
  const q = query.trim().toLowerCase()
  const matches = new Set<string>()
  if (!q) return matches
  for (const m of machines) {
    if (m.name.toLowerCase().includes(q)) {
      matches.add(m.id)
      continue
    }
    const linkedSopIds = links.filter((l) => l.machine_id === m.id).map((l) => l.sop_id)
    if (linkedSopIds.some((id) => sopsById.get(id)?.title.toLowerCase().includes(q))) {
      matches.add(m.id)
    }
  }
  return matches
}

/** An open panel's SOP list narrowed by the ask query — never to nothing
 *  just because the machine name itself matched (D-13). */
export function narrowForAsk(query: string, machineName: string, sops: ReadonlyArray<WorkerSop>): WorkerSop[] {
  const q = query.trim().toLowerCase()
  if (!q) return [...sops]
  if (machineName.toLowerCase().includes(q)) return [...sops]
  return sops.filter((s) => s.title.toLowerCase().includes(q))
}
