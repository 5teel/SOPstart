/**
 * Phase 63 -- Recent and Most used as pure merges (ADR-0002: no table, no job).
 * The device list lives in localStorage and is untrusted input. Plain module.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CAP = 10
const SHOWN = 4

export interface RecentEntry {
  root: string
  /** epoch ms */
  t: number
}

export const recentKey = (userId: string) => `sopstart-recent:${userId}`

/** Never throws: anything malformed is dropped. */
export function parseRecent(raw: string | null | undefined): RecentEntry[] {
  let data: unknown
  try {
    data = JSON.parse(raw ?? '')
  } catch {
    return []
  }
  if (!Array.isArray(data)) return []
  const out: RecentEntry[] = []
  for (const e of data) {
    if (e && typeof e === 'object' && typeof (e as RecentEntry).root === 'string' && UUID.test((e as RecentEntry).root)) {
      const t = (e as RecentEntry).t
      if (typeof t === 'number' && Number.isFinite(t)) out.push({ root: (e as RecentEntry).root.toLowerCase(), t })
    }
    if (out.length === CAP) break
  }
  return out
}

/** The opened root goes to the front; an existing entry for it is replaced. */
export function pushRecent(list: readonly RecentEntry[], root: string, now: number = Date.now()): RecentEntry[] {
  if (!UUID.test(root)) return [...list]
  const id = root.toLowerCase()
  return [{ root: id, t: now }, ...list.filter((e) => e.root !== id)].slice(0, CAP)
}

type Timed = { root: string; at: string }

/** Latest time per lineage root across the device list, own walks and own completions; newest first, top 4 roots. */
export function mergeRecent(device: readonly RecentEntry[], walks: readonly Timed[], completions: readonly Timed[]): string[] {
  const latest = new Map<string, number>()
  const see = (root: string, t: number) => {
    if (Number.isFinite(t) && t > (latest.get(root) ?? -Infinity)) latest.set(root, t)
  }
  for (const e of device) see(e.root, e.t)
  for (const e of [...walks, ...completions]) see(e.root, Date.parse(e.at))
  return [...latest.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, SHOWN)
    .map(([root]) => root)
}

/** Own non-rejected completions per lineage root, top 3 ("done N times"); ties by title. */
export function mostUsed(
  completions: readonly { root: string; status: string; title: string }[],
): { root: string; title: string; count: number }[] {
  const counts = new Map<string, { title: string; count: number }>()
  for (const c of completions) {
    if (c.status === 'rejected') continue
    const cur = counts.get(c.root)
    if (cur) cur.count += 1
    else counts.set(c.root, { title: c.title, count: 1 })
  }
  return [...counts.entries()]
    .map(([root, v]) => ({ root, ...v }))
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title, 'en', { sensitivity: 'base' }))
    .slice(0, 3)
}
