/**
 * Phase 57 (D-16): the ONE inbox read. /governance renders it and the one
 * screen's Office pin + card count `items.length` from it, so the numbers
 * cannot disagree. Plain module (no server directive) -- each source below
 * runs its own admin guard; completions awaiting sign-off are NOT part of it.
 *
 * ponytail: listAdminSopRows recomputes the governance queue a second time
 * internally -- accepted, admin read, org-sized data.
 */
import { listGovernanceQueue, type GovernanceRow } from '@/actions/governance'
import { listAdminSopRows } from '@/actions/admin-sop-list'
import { listSiteHealthForOrg } from '@/actions/site'
import { deriveInbox, type InboxItem } from '@/lib/governance/inbox'
import type { MillerSop } from '@/lib/sop-list/admin-rows'
import type { AdminSiteFloor } from '@/lib/validators/site'

export interface LoadedInbox {
  governance: GovernanceRow[]
  library: MillerSop[]
  floor: AdminSiteFloor | { error: string }
  items: InboxItem[]
}

export async function loadInbox(): Promise<LoadedInbox | { error: string }> {
  const [gov, library, floor] = await Promise.all([
    listGovernanceQueue(),
    listAdminSopRows({}),
    listSiteHealthForOrg(),
  ])
  if ('error' in gov) return { error: gov.error }
  if ('error' in library) return { error: library.error }

  const floorOk = !('error' in floor)
  const items = deriveInbox({
    governance: gov.rows,
    library: library.sops,
    machines: floorOk ? floor.machines : [],
    links: floorOk ? floor.links : [],
  })
  return { governance: gov.rows, library: library.sops, floor, items }
}
