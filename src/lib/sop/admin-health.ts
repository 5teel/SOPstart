/**
 * The ONE place an admin's view of SOP health is classified (CLAUDE.md
 * 2026-09-27) -- floor pins, machine-panel badges, library checks and table
 * status all read from here; it READS the governance flags
 * `classifyGovernanceRow` produced and never re-derives unowned/overdue; no
 * I/O, no module-scope clock.
 *
 * Plain module, no directive -- importable from both client and server code.
 * Only `import type` for the shapes owned elsewhere (GovernanceFlag,
 * SopMachineLink).
 */
import type { GovernanceFlag } from '@/lib/governance/classify'
import type { SopMachineLink } from '@/lib/validators/site'

// ---------------------------------------------------------------------------
// Floor pins (D-04)
// ---------------------------------------------------------------------------

export type MachineHealth = 'bad' | 'due' | 'ok'

/** Worst-of across a machine's linked SOPs: unowned beats overdue beats ok.
 *  A machine with no (resolvable) linked SOPs is absent from the map. */
export function machineHealth(
  machines: ReadonlyArray<{ id: string }>,
  links: ReadonlyArray<SopMachineLink>,
  flagsBySop: ReadonlyMap<string, ReadonlyArray<GovernanceFlag>>
): Map<string, MachineHealth> {
  const health = new Map<string, MachineHealth>()
  for (const m of machines) {
    const sopFlags = links
      .filter((l) => l.machine_id === m.id)
      .map((l) => flagsBySop.get(l.sop_id))
      .filter((f): f is ReadonlyArray<GovernanceFlag> => f !== undefined)
    if (sopFlags.length === 0) continue
    if (sopFlags.some((f) => f.includes('unowned'))) health.set(m.id, 'bad')
    else if (sopFlags.some((f) => f.includes('overdue'))) health.set(m.id, 'due')
    else health.set(m.id, 'ok')
  }
  return health
}

/** Machines with zero linked SOPs, in input order. */
export function machinesWithoutSops<M extends { id: string }>(
  machines: ReadonlyArray<M>,
  links: ReadonlyArray<SopMachineLink>
): M[] {
  const linkedIds = new Set(links.map((l) => l.machine_id))
  return machines.filter((m) => !linkedIds.has(m.id))
}

// ---------------------------------------------------------------------------
// Machine panel (D-05)
// ---------------------------------------------------------------------------

export type AdminSopBadge = 'NO OWNER' | 'REVIEW DUE' | 'DRAFT' | 'OK'

export function adminSopBadge(row: { flags: ReadonlyArray<GovernanceFlag>; status: string }): AdminSopBadge {
  if (row.flags.includes('unowned')) return 'NO OWNER'
  if (row.flags.includes('overdue')) return 'REVIEW DUE'
  if (row.status !== 'published') return 'DRAFT'
  return 'OK'
}

/** GovernanceRow satisfies this structurally. */
export interface HealthRow {
  id: string
  title: string | null
  status: string
  flags: ReadonlyArray<GovernanceFlag>
  ownerLabel: string
  reviewDueAt: string | null
}

export interface AdminPanelSop {
  id: string
  title: string
  badge: AdminSopBadge
  status: string
  ownerLabel: string | null
  reviewDueAt: string | null
}

const BADGE_RANK: Record<AdminSopBadge, number> = { 'NO OWNER': 0, 'REVIEW DUE': 1, DRAFT: 2, OK: 3 }

function toPanelSop(r: HealthRow): AdminPanelSop {
  return {
    id: r.id,
    title: r.title ?? 'Untitled SOP',
    badge: adminSopBadge(r),
    status: r.status,
    ownerLabel: r.flags.includes('unowned') ? null : r.ownerLabel,
    reviewDueAt: r.reviewDueAt,
  }
}

function byBadgeThenTitle(a: AdminPanelSop, b: AdminPanelSop): number {
  return BADGE_RANK[a.badge] - BADGE_RANK[b.badge] || a.title.localeCompare(b.title)
}

/** That machine's linked SOPs, NO OWNER -> REVIEW DUE -> DRAFT -> OK, then title. */
export function machinePanelSops(
  machineId: string,
  links: ReadonlyArray<SopMachineLink>,
  rowsById: ReadonlyMap<string, HealthRow>
): AdminPanelSop[] {
  return links
    .filter((l) => l.machine_id === machineId)
    .map((l) => rowsById.get(l.sop_id))
    .filter((r): r is HealthRow => r !== undefined)
    .map(toPanelSop)
    .sort(byBadgeThenTitle)
}

/** The Noticeboard (D-20): site-wide SOPs, published first, the drafts as a tail;
 *  each group in machinePanelSops order. */
export function noticeboardSops(
  siteSopIds: ReadonlyArray<string>,
  rowsById: ReadonlyMap<string, HealthRow>
): AdminPanelSop[] {
  const all = siteSopIds
    .map((id) => rowsById.get(id))
    .filter((r): r is HealthRow => r !== undefined)
    .map(toPanelSop)
    .sort(byBadgeThenTitle)
  return [...all.filter((s) => s.status === 'published'), ...all.filter((s) => s.status !== 'published')]
}

/** The Noticeboard pin: rows that need an admin (no owner, review due). */
export function healthPinCount(sops: ReadonlyArray<AdminPanelSop>): number {
  return sops.filter((s) => s.badge === 'NO OWNER' || s.badge === 'REVIEW DUE').length
}

// ---------------------------------------------------------------------------
// Library table checks (D-07)
// ---------------------------------------------------------------------------

export type CheckKey = 'owner' | 'review' | 'approved' | 'assigned' | 'converted'
export type CheckState = 'ok' | 'warn' | 'bad'

export const CHECK_ORDER: readonly CheckKey[] = ['owner', 'review', 'approved', 'assigned', 'converted']

export interface CheckInput {
  flags: ReadonlyArray<GovernanceFlag>
  status: string
  lastReviewedAt: string | null
  chainRequired: boolean
  allDepartments: boolean
  departments: ReadonlyArray<string>
  hasPersonGrant: boolean
  stuck: boolean
  parseFailed: boolean
}

/** More than a calendar year before `now` (13 months -> stale, 11 -> not). */
function isReviewStale(lastReviewedAt: string | null, now: Date): boolean {
  if (!lastReviewedAt) return true
  const cut = new Date(now)
  cut.setUTCFullYear(cut.getUTCFullYear() - 1)
  return new Date(lastReviewedAt) < cut
}

export function deriveChecks(sop: CheckInput, now: Date = new Date()): Record<CheckKey, CheckState> {
  const owner: CheckState = sop.flags.includes('unowned') ? 'bad' : 'ok'

  let review: CheckState
  if (sop.flags.includes('overdue') || isReviewStale(sop.lastReviewedAt, now)) review = 'bad'
  else if (sop.flags.includes('due_soon')) review = 'warn'
  else review = 'ok'

  let approved: CheckState
  if (sop.status === 'published') approved = 'ok'
  else if (sop.flags.includes('awaiting_approval')) approved = 'warn'
  else if (!sop.chainRequired) approved = 'ok'
  else approved = 'bad'

  const assigned: CheckState =
    sop.allDepartments || sop.departments.length > 0 || sop.hasPersonGrant ? 'ok' : 'bad'

  let converted: CheckState
  if (sop.stuck || sop.parseFailed) converted = 'bad'
  else if (sop.status === 'uploading' || sop.status === 'parsing') converted = 'warn'
  else converted = 'ok'

  return { owner, review, approved, assigned, converted }
}

export type TableStatus = 'LIVE' | 'DRAFT' | 'STUCK'

export function tableStatus(sop: { status: string; stuck: boolean; parseFailed: boolean }): TableStatus {
  if (sop.stuck || sop.parseFailed) return 'STUCK'
  if (sop.status === 'published') return 'LIVE'
  return 'DRAFT'
}
