/**
 * Phase 26 Plan 26-12 Task 3 — P8 publish-gate regression (behavioural, server KEEP).
 *
 * The bespoke canvas re-implements the per-block verify UI, but the AUTHORITATIVE
 * gate is the UNCHANGED server route `POST /api/sops/[sopId]/publish`. This harness
 * invokes the REAL route handler (createClient + auto-queue mocked) and proves the
 * two behaviours the UI depends on (CLAUDE.md 2026-06-05 — not a source grep):
 *   - one block unverified → 400 { error: 'unverified_blocks', count }
 *   - all blocks verified   → 200 { success: true }
 *
 * The route file itself is untouched (acceptance: git diff empty). We mock only
 * its two collaborators so the real branch logic runs against controlled data.
 * CLI: npx tsx scripts/verify-gate-check.tsx
 */
/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
export {} // isolate module scope (sibling *-check.tsx harnesses share globals otherwise)

type Cfg = {
  orgId?: string
  unapprovedCount?: number
  sourceType?: string | null
  sourceFilePath?: string | null
  sectionIds?: string[]
  unverifiedCount?: number
  publishError?: unknown
}

// Fake Supabase — a chainable, thenable query builder that resolves per table +
// whether a count/head or update was requested. Mirrors exactly the calls the
// real route makes (auth.getUser/getSession, sop_sections, sops, sop_section_blocks).
function makeSupabase(cfg: Cfg) {
  function builder(table: string) {
    const state = { table, count: false, head: false, isUpdate: false }
    const resolve = () => {
      if (state.table === 'sops' && state.isUpdate) return { error: cfg.publishError ?? null }
      if (state.table === 'sops')
        return { data: { source_type: cfg.sourceType ?? 'pdf', source_file_path: cfg.sourceFilePath ?? 'x.pdf' }, error: null }
      if (state.table === 'sop_sections' && state.count) return { count: cfg.unapprovedCount ?? 0, error: null }
      if (state.table === 'sop_sections') return { data: (cfg.sectionIds ?? ['sec-1']).map((id) => ({ id })), error: null }
      if (state.table === 'sop_section_blocks' && state.count) return { count: cfg.unverifiedCount ?? 0, error: null }
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
      is() { return b },
      maybeSingle() { return Promise.resolve(resolve()) },
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

let currentSupabase: any = makeSupabase({})

// Intercept the route's two collaborators (substring-match handles both the
// '@/…' alias and any resolved path form under tsx).
const Module = require('module')
const origLoad = Module._load
Module._load = function (request: string, parent: unknown, isMain: boolean) {
  if (request.includes('lib/supabase/server')) {
    return { createClient: async () => currentSupabase }
  }
  if (request.includes('video-gen/auto-queue')) {
    return { enqueueVideoGenerationForPipeline: async () => ({}) }
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
  const res = await POST({} as any, { params: Promise.resolve({ sopId: 'sop-1' }) })
  const body = await res.json().catch(() => ({}))
  return { status: res.status, body }
}

async function main() {
  // ── Unverified block → 400 unverified_blocks. ────────────────────────────────
  {
    const { status, body } = await callPublish({ unverifiedCount: 2 })
    check(status === 400, `unverified publish should be 400, got ${status}`)
    check(body.error === 'unverified_blocks', `expected error 'unverified_blocks', got ${JSON.stringify(body)}`)
    check(body.count === 2, `expected count 2, got ${JSON.stringify(body.count)}`)
  }

  // ── All verified → publish succeeds. ─────────────────────────────────────────
  {
    const { status, body } = await callPublish({ unverifiedCount: 0 })
    check(status === 200, `all-verified publish should be 200, got ${status} ${JSON.stringify(body)}`)
    check(body.success === true, `expected success:true, got ${JSON.stringify(body)}`)
  }

  // ── Gate is real, not blanket: a still-unapproved section 400s BEFORE the
  //    verify branch (guards against a mock that always passes). ───────────────
  {
    const { status, body } = await callPublish({ unapprovedCount: 1, unverifiedCount: 0 })
    check(status === 400, `unapproved-section publish should be 400, got ${status}`)
    check(
      typeof body.error === 'string' && body.error.includes('approved'),
      `expected an approval error, got ${JSON.stringify(body)}`,
    )
  }

  if (failures.length > 0) {
    console.error('VERIFY-GATE FAILED:')
    for (const f of failures) console.error('  -', f)
    process.exit(1)
  }
  console.log(
    'VERIFY-GATE OK — real route: unverified → 400 unverified_blocks{count}; all-verified → 200 success; server gate authoritative + unchanged (P8).',
  )
}

void main()
