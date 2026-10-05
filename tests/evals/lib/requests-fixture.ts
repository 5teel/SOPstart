/**
 * Phase 60 eval fixtures: a machine with no linked SOP (the agent-request case)
 * and a cleanup helper for the rows the requests eval creates. Service-role
 * client only; every write carries the eval-site org id and both helpers refuse
 * the real SOPstart org (T-60-03). The requests, notifications and objectives
 * tables arrive in 60-02, so this is code only until the 60-18 eval first runs it.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { REAL_SOPSTART_ORG_ID, PRESS_POLYGON } from './plant-fixture'
import { EVAL_SITE_DEPARTMENT } from './session'
import { newMachineCode } from '@/lib/site/scene'

export const EVAL_ZERO_SOP_MACHINE = 'EVAL Oven'

// Same shape as the Press polygon, shifted right so the two never overlap.
const OVEN_POLYGON = PRESS_POLYGON.map(([x, y]) => [x + 420, y])

function assertEvalOrg(orgId: string) {
  if (!orgId) throw new Error('refusing to run -- no organisation id')
  if (orgId === REAL_SOPSTART_ORG_ID) throw new Error('refusing to run -- organisation id equals the real SOPstart org')
}

/** A machine in the eval-site org with no sop_machines link, preferring "EVAL Oven"; created on the eval-site layout if none exists. */
export async function ensureZeroSopMachine(db: SupabaseClient, orgId: string): Promise<{ id: string; name: string }> {
  assertEvalOrg(orgId)
  const { data: machines, error } = await db.from('site_machines').select('id, name, site_layout_id').eq('organisation_id', orgId)
  if (error) throw new Error(`site_machines lookup failed: ${error.message}`)
  const { data: links, error: linkErr } = await db.from('sop_machines').select('machine_id').eq('organisation_id', orgId)
  if (linkErr) throw new Error(`sop_machines lookup failed: ${linkErr.message}`)
  const linked = new Set((links ?? []).map((l) => l.machine_id as string))
  const free = (machines ?? []).filter((m) => !linked.has(m.id as string))
  const pick = free.find((m) => m.name === EVAL_ZERO_SOP_MACHINE) ?? free[0]
  if (pick) return { id: pick.id as string, name: pick.name as string }

  const layoutId = machines?.[0]?.site_layout_id as string | undefined
  if (!layoutId) throw new Error('no eval-site layout with a machine -- run ensurePlantFixture first')
  const { data: dept, error: deptErr } = await db.from('departments').select('id').eq('organisation_id', orgId).eq('name', EVAL_SITE_DEPARTMENT).maybeSingle()
  if (deptErr || !dept) throw new Error(`"${EVAL_SITE_DEPARTMENT}" department not found -- run node scripts/eval-fixtures.mjs`)
  const { data: created, error: createErr } = await db
    .from('site_machines')
    .insert({
      site_layout_id: layoutId,
      organisation_id: orgId,
      name: EVAL_ZERO_SOP_MACHINE,
      department_id: dept.id,
      polygon: OVEN_POLYGON,
      code: newMachineCode(),
      sort: 1,
    })
    .select('id, name')
    .single()
  if (createErr || !created) throw new Error(`site_machines insert failed: ${createErr?.message}`)
  return { id: created.id as string, name: created.name as string }
}

/** Deletes every notifications, requests and objectives row of the eval-site org; returns the three counts. */
export async function deleteEvalRequestRows(
  db: SupabaseClient,
  orgId: string,
): Promise<{ notifications: number; requests: number; objectives: number }> {
  assertEvalOrg(orgId)
  const counts = { notifications: 0, requests: 0, objectives: 0 }
  // Notifications first: they point at requests and objectives by id, never the reverse.
  for (const table of ['notifications', 'requests', 'objectives'] as const) {
    const { data, error } = await db.from(table).delete().eq('organisation_id', orgId).select('id')
    if (error) throw new Error(`${table} delete failed: ${error.message}`)
    counts[table] = data?.length ?? 0
  }
  return counts
}
