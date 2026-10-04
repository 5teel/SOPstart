/**
 * Phase 56 / Plan 56-08 -- live proof that every DecisionKind, built the way its
 * hook builds it, lands in the decisions table and passes the database CHECKs.
 *
 * recordDecision is fail-soft, so a kind the database refuses would log and
 * vanish. This writes one row per kind (longest realistic summaries) so that
 * cannot be true for any kind.
 *
 * Rows written here are permanent by design (append-only ledger) and live in the
 * eval-site org. Run once per change to a hook's summary or subject, never in a
 * loop. Service key only: no session is minted, so no OTP budget is spent.
 *
 * Gated by PHASE56_LIVE=1. Registration: playwright.config.ts `phase56` project.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  DECISION_KINDS,
  AGENT_NAMES,
  buildDecisionRow,
  type DecisionKind,
  type DecisionInput,
} from '@/lib/decisions/shape'
import { EVAL_SITE_ORG_NAME } from '../evals/lib/session'
import { REAL_SOPSTART_ORG_ID } from '../evals/lib/plant-fixture'

function loadEnv(): void {
  try {
    const envText = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8')
    for (const line of envText.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
    }
  } catch {
    // env already populated by the shell
  }
}
loadEnv()
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const LIVE = process.env.PHASE56_LIVE === '1' && !!SERVICE_KEY && !!SUPABASE_URL

// Longest realistic values, same templates as the hooks (see each hook's summary line).
const LONGEST_CATEGORY = 'Training & Induction'
const LONGEST_AI_FIELD_LABEL = 'Section Title'

function samples(sopId: string): Record<DecisionKind, DecisionInput> {
  const probe = { probe: 'decision-kinds-live' }
  const sop = { kind: 'sop', id: sopId }
  const completion = { kind: 'completion', id: randomUUID() }
  return {
    approve: { kind: 'approve', subject: sop, sopId, summary: 'Approved step 100 of the approval chain', details: probe },
    reject: { kind: 'reject', subject: sop, sopId, summary: 'Sent back for changes', details: probe },
    sign_off: { kind: 'sign_off', subject: completion, sopId, summary: 'Signed off a completion', details: probe },
    countersign: { kind: 'countersign', subject: completion, sopId: null, summary: 'Counter-signed a completion', details: probe },
    assign: {
      kind: 'assign',
      subject: { kind: 'assignment', id: randomUUID() },
      sopId,
      summary: 'Assigned the SOP to the safety_manager role',
      details: probe,
    },
    unassign: { kind: 'unassign', subject: { kind: 'assignment', id: randomUUID() }, sopId, summary: 'Removed an assignment', details: probe },
    publish: { kind: 'publish', subject: sop, sopId, summary: 'Published the SOP after its approval chain', details: probe },
    owner_change: { kind: 'owner_change', subject: sop, sopId, summary: 'Changed the SOP owner', details: probe },
    review: { kind: 'review', subject: sop, sopId, summary: 'Confirmed the SOP is current', details: probe },
    observation: {
      kind: 'observation',
      subject: { kind: 'worker', id: randomUUID() },
      sopId,
      summary: 'Recorded an observation: performed to SOP',
      details: probe,
    },
    verify: {
      kind: 'verify',
      subject: { kind: 'section_block', id: randomUUID() },
      sopId,
      summary: 'Checked a section before publishing',
      details: probe,
    },
    verify_withdrawn: {
      kind: 'verify_withdrawn',
      subject: { kind: 'section_block', id: randomUUID() },
      sopId,
      summary: 'Un-checked a section',
      details: probe,
    },
    ai_finding_cleared: {
      kind: 'ai_finding_cleared',
      subject: { kind: 'section_block', id: randomUUID() },
      sopId,
      summary: 'Checked a section and cleared 12 AI findings',
      details: probe,
    },
    cadence_change: {
      kind: 'cadence_change',
      subject: { kind: 'category', id: null },
      sopId: null,
      summary: `Set the review cadence for ${LONGEST_CATEGORY} to 120 months`,
      details: probe,
    },
    ai_field_write: {
      kind: 'ai_field_write',
      agent: 'SOPstart assistant',
      subject: { kind: 'field', id: randomUUID() },
      sopId,
      summary: `Changed ${LONGEST_AI_FIELD_LABEL}`,
      details: probe,
    },
  }
}

// Comment-stripped DECISION_KINDS declaration from shape.ts.
function kindsDeclaration(): string {
  const src = fs
    .readFileSync(path.join(process.cwd(), 'src/lib/decisions/shape.ts'), 'utf8')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\/\*|\*\/|\*)/.test(l))
    .join('\n')
  const m = /export const DECISION_KINDS = \[([\s\S]*?)\] as const/.exec(src)
  if (!m) throw new Error('DECISION_KINDS declaration not found in shape.ts')
  return m[1]
}

test.describe('decision kinds -- live ledger', () => {
  test.skip(!LIVE, 'PHASE56_LIVE=1 and the service key are required')

  let db: SupabaseClient
  let siteOrgId: string
  let adminId: string
  let adminEmail: string
  let sopId: string

  test.beforeAll(async () => {
    db = createClient(SUPABASE_URL!, SERVICE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data: org, error: orgErr } = await db.from('organisations').select('id').eq('name', EVAL_SITE_ORG_NAME).maybeSingle()
    if (orgErr || !org) throw new Error(`"${EVAL_SITE_ORG_NAME}" org not found: ${orgErr?.message ?? 'run node scripts/eval-fixtures.mjs'}`)
    siteOrgId = org.id
    if (siteOrgId === REAL_SOPSTART_ORG_ID) throw new Error('refusing to run: resolved org is the real SOPstart org')

    const { data: member, error: memErr } = await db
      .from('organisation_members')
      .select('user_id')
      .eq('organisation_id', siteOrgId)
      .eq('role', 'admin')
      .limit(1)
      .maybeSingle()
    if (memErr || !member) throw new Error(`no admin member in the eval-site org: ${memErr?.message ?? ''}`)
    adminId = member.user_id
    const { data: u, error: uErr } = await db.auth.admin.getUserById(adminId)
    if (uErr || !u.user) throw new Error(`admin user lookup failed: ${uErr?.message}`)
    adminEmail = u.user.email ?? ''

    const { data: sop, error: sopErr } = await db.from('sops').select('id').eq('organisation_id', siteOrgId).limit(1).maybeSingle()
    if (sopErr || !sop) throw new Error(`no SOP in the eval-site org: ${sopErr?.message ?? ''}`)
    sopId = sop.id
  })

  test('the samples cover the union', () => {
    const keys = Object.keys(samples('00000000-0000-4000-8000-000000000000')).sort()
    expect(keys).toEqual([...DECISION_KINDS].sort())
    const decl = kindsDeclaration()
    for (const k of keys) expect(decl, `shape.ts DECISION_KINDS lacks '${k}'`).toContain(`'${k}'`)
    for (const k of DECISION_KINDS) expect(keys, `no sample for ${k}`).toContain(k)
  })

  test('every kind lands', async () => {
    const all = samples(sopId)
    const ids: string[] = []
    for (const kind of DECISION_KINDS) {
      const built = buildDecisionRow({ userId: adminId, userEmail: adminEmail, organisationId: siteOrgId }, all[kind])
      expect(built.ok, `${kind}: ${built.ok ? '' : built.error}`).toBe(true)
      if (!built.ok) continue
      const { data, error } = await db
        .from('decisions')
        .insert(built.row)
        .select('id, kind, actor_kind, actor_id, actor_name, summary, organisation_id')
        .single()
      expect(error, `${kind} insert: ${error?.message}`).toBeNull()
      if (!data) continue
      ids.push(data.id)
      expect(data.kind).toBe(kind)
      expect(data.organisation_id).toBe(siteOrgId)
      expect(data.summary.length).toBeLessThanOrEqual(200)
      if (kind === 'ai_field_write') {
        expect(data.actor_kind).toBe('agent')
        expect(data.actor_name).toBe('SOPstart assistant')
      } else {
        expect(data.actor_kind).toBe('person')
        expect(data.actor_id).toBe(adminId)
      }
    }
    const { data: again, error } = await db.from('decisions').select('id').in('id', ids)
    expect(error).toBeNull()
    expect(again?.length).toBe(DECISION_KINDS.length)
  })

  test('an unnamed agent is refused twice', async () => {
    const session = { userId: adminId, userEmail: adminEmail, organisationId: siteOrgId }
    const base = samples(sopId).ai_field_write
    // agent undefined means "a person decided" by design, so it can never yield an agent row with no name.
    const asPerson = buildDecisionRow(session, { ...base, agent: undefined } as DecisionInput)
    expect(asPerson.ok && asPerson.row.actor_kind).toBe('person')
    // Any agent value that is set but not on the allowlist is refused (null, empty, invented).
    for (const agent of [null, '', '  ', 'Some other bot']) {
      expect(buildDecisionRow(session, { ...base, agent } as unknown as DecisionInput).ok, `agent ${JSON.stringify(agent)}`).toBe(false)
    }
    expect(AGENT_NAMES).toContain('SOPstart assistant')

    for (const actor_name of [null, '  ']) {
      const { error } = await db.from('decisions').insert({
        organisation_id: siteOrgId,
        kind: 'ai_field_write',
        actor_kind: 'agent',
        actor_name,
        subject_kind: 'field',
        summary: 'probe unnamed agent',
      })
      expect(error?.code, `actor_name ${JSON.stringify(actor_name)}`).toBe('23514')
    }
  })

  test('a person row without an actor is refused', async () => {
    const { error } = await db.from('decisions').insert({
      organisation_id: siteOrgId,
      kind: 'review',
      actor_kind: 'person',
      actor_id: null,
      subject_kind: 'sop',
      summary: 'probe person without actor',
      source: 'live',
    })
    expect(error?.code).toBe('23514')
  })
})
