/**
 * Phase 26 Plan 26-12 Task 3 — P8 publish-gate regression (behavioural, server KEEP).
 *
 * The bespoke canvas re-implements the per-block verify UI, but the AUTHORITATIVE
 * gate is the UNCHANGED server route `POST /api/sops/[sopId]/publish`. This harness
 * invokes the REAL route handler (createClient mocked) and proves the
 * two behaviours the UI depends on (CLAUDE.md 2026-06-05 — not a source grep):
 *   - no focus steps        → 400 { error: 'no_steps' }
 *   - one step unticked     → 400 { error: 'unverified_steps', count }
 *   - one finding open      → 400 { error: 'open_findings', count }
 *   - all ticked, none open → 200 { success: true }  (Phase 58 D-16: same for every SOP)
 *
 * The route file itself is untouched (acceptance: git diff empty). We mock only
 * its two collaborators so the real branch logic runs against controlled data.
 * CLI: npx tsx scripts/verify-gate-check.tsx
 */
/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
export {} // isolate module scope (sibling *-check.tsx harnesses share globals otherwise)

type Cfg = {
  orgId?: string
  totalSteps?: number
  unverifiedCount?: number
  openFindings?: number
  predecessor?: boolean
  publishError?: unknown
}

// Fake Supabase — a chainable, thenable query builder that resolves per table +
// whether a count/head or update was requested. Mirrors exactly the calls the
// real route makes (auth.getUser/getSession, sop_focus_steps, sop_ai_findings, sops).
function makeSupabase(cfg: Cfg) {
  function builder(table: string) {
    const state = { table, count: false, head: false, isUpdate: false, isNull: false, single: false }
    const resolve = () => {
      // update().eq('status','draft').select('id') — publish-core's Phase 29
      // zero-rows-updated guard 409s unless the update returns the row.
      if (state.table === 'sops' && state.isUpdate)
        return cfg.publishError
          ? { data: null, error: cfg.publishError }
          : { data: [{ id: 'sop-1' }], error: null }
      // performPublish's lineage read (a list, awaited directly): no predecessor.
      if (state.table === 'sops' && !state.single)
        return {
          data: cfg.predecessor
            ? [
                { id: 'sop-0', version: 1, parent_sop_id: null, status: 'published' },
                { id: 'sop-1', version: 2, parent_sop_id: 'sop-0', status: 'draft' },
              ]
            : [],
          error: null,
        }
      if (state.table === 'sops')
        // status: publish-core (Phase 29 extraction) verifies the SOP is a
        // draft before flipping it — without this the harness 409s.
        return { data: { status: 'draft', category_slug: null, parent_sop_id: null }, error: null }
      if (state.table === 'sop_focus_steps' && state.count)
        return { count: state.isNull ? (cfg.unverifiedCount ?? 0) : (cfg.totalSteps ?? 3), error: null }
      if (state.table === 'sop_ai_findings' && state.count) return { count: cfg.openFindings ?? 0, error: null }
      return { data: null, error: null }
    }
    const b: any = {
      select(_c: unknown, opts?: { count?: string; head?: boolean }) {
        if (opts?.count) state.count = true
        if (opts?.head) state.head = true
        return b
      },
      update() {
        state.isUpdate = true
        return b
      },
      eq() { return b },
      in() { return b },
      is() { state.isNull = true; return b },
      or() { return b },
      maybeSingle() { state.single = true; return Promise.resolve(resolve()) },
      then(onF: any, onR: any) { return Promise.resolve(resolve()).then(onF, onR) },
    }
    return b
  }
  const token = 'a.' + Buffer.from(JSON.stringify({ organisation_id: cfg.orgId ?? 'org1' })).toString('base64') + '.b'
  return {
    auth: {
      getUser: async () => ({ data: { user: { id: 'u1' } }, error: null }),
      getSession: async () => ({ data: { session: { access_token: token } }, error: null }),
    },
    from: (t: string) => builder(t),
  }
}

const notifyCalls: string[][] = []
let currentSupabase: any = makeSupabase({})
let currentOrgId = 'org1'

// Intercept the route's collaborators (substring-match handles both the
// '@/…' alias and any resolved path form under tsx).
const Module = require('module')
const origLoad = Module._load
Module._load = function (request: string, parent: unknown, isMain: boolean) {
  // Phase 56: publish-core now records a ledger decision. The ledger writer is
  // server-only (not loadable under tsx) and not what this harness proves.
  if (request.includes('lib/decisions/record')) {
    return { recordDecision: async () => ({ ok: true, id: 'decision-1' }) }
  }
  // Phase 58 D-18: performPublish notifies workers of a new version through a
  // session-scoped server action; the harness has no predecessor, so it is inert.
  if (request.includes('actions/versioning')) {
    return {
      notifyAssignedWorkers: async (...args: string[]) => {
        notifyCalls.push(args)
        return { success: true, notified: 0 }
      },
    }
  }
  if (request.includes('lib/supabase/server')) {
    return { createClient: async () => currentSupabase }
  }
  // 2026-07-13: the route resolves auth via getSessionContext() (local JWT
  // verify + member-role read) instead of getUser/getSession — mock it as a
  // collaborator, handing back the same fake supabase + org identity.
  if (request.includes('lib/auth/session-context')) {
    return {
      getSessionContext: async () => ({
        supabase: currentSupabase,
        userId: 'u1',
        userEmail: null,
        role: 'admin',
        organisationId: currentOrgId,
      }),
    }
  }
  return origLoad.apply(this, [request, parent, isMain])
}

const { POST } =
  require('../src/app/api/sops/[sopId]/publish/route') as typeof import('../src/app/api/sops/[sopId]/publish/route')

const failures: string[] = []
const check = (cond: boolean, msg: string) => {
  if (!cond) failures.push(msg)
}

async function callPublish(cfg: Cfg) {
  currentSupabase = makeSupabase(cfg)
  currentOrgId = cfg.orgId ?? 'org1'
  const res = await POST({} as any, { params: Promise.resolve({ sopId: 'sop-1' }) })
  const body = await res.json().catch(() => ({}))
  return { status: res.status, body }
}

async function main() {
  // ── Unticked step → 400 unverified_steps. ────────────────────────────────────
  {
    const { status, body } = await callPublish({ unverifiedCount: 2 })
    check(status === 400, `unticked publish should be 400, got ${status}`)
    check(body.error === 'unverified_steps', `expected error 'unverified_steps', got ${JSON.stringify(body)}`)
    check(body.count === 2, `expected count 2, got ${JSON.stringify(body.count)}`)
  }

  // ── Open AI finding → 400 open_findings. ─────────────────────────────────────
  {
    const { status, body } = await callPublish({ openFindings: 1 })
    check(status === 400, `open-finding publish should be 400, got ${status}`)
    check(body.error === 'open_findings', `expected error 'open_findings', got ${JSON.stringify(body)}`)
    check(body.count === 1, `expected count 1, got ${JSON.stringify(body.count)}`)
  }

  // ── No steps at all → 400 no_steps (nothing bypasses, whatever the source). ──
  {
    const { status, body } = await callPublish({ totalSteps: 0 })
    check(status === 400, `empty publish should be 400, got ${status}`)
    check(body.error === 'no_steps', `expected error 'no_steps', got ${JSON.stringify(body)}`)
  }

  // ── Every step ticked, nothing open → publish succeeds. ──────────────────────
  {
    const { status, body } = await callPublish({ unverifiedCount: 0, openFindings: 0 })
    check(status === 200, `all-ticked publish should be 200, got ${status} ${JSON.stringify(body)}`)
    check(body.success === true, `expected success:true, got ${JSON.stringify(body)}`)
  }

  // ── D-18: publishing a version with a published predecessor notifies once,
  //    old id first; a first version notifies nobody. ───────────────────────────
  {
    check(notifyCalls.length === 0, `no predecessor must not notify, got ${JSON.stringify(notifyCalls)}`)
    const { status } = await callPublish({ predecessor: true })
    check(status === 200, `lineage publish should be 200, got ${status}`)
    check(
      notifyCalls.length === 1 && notifyCalls[0][0] === 'sop-0' && notifyCalls[0][1] === 'sop-1',
      `expected one notify(sop-0, sop-1), got ${JSON.stringify(notifyCalls)}`,
    )
  }

  if (failures.length > 0) {
    console.error('VERIFY-GATE FAILED:')
    for (const f of failures) console.error('  -', f)
    process.exit(1)
  }
  console.log(
    'VERIFY-GATE OK — real route: no steps / unticked / open finding → 400 {error,count}; all ticked and clear → 200 success; one gate for every SOP (D-16).',
  )
}

void main()
