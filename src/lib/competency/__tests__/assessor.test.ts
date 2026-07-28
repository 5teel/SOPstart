import { test, expect } from '@playwright/test'
import { isSignedOffAssessor } from '@/lib/competency/assessor'

// Chainable stub Supabase client. `.from(table)` returns a builder whose
// chain methods (.select/.eq/.in/.or/.order) are no-ops that return `this`;
// the builder itself is thenable so `await client.from(x)...` resolves to
// `{ data: fixtures[table] }` (array queries), and `.maybeSingle()` resolves
// to `{ data: fixtures[table][0] ?? null }` (single-row queries). Real
// `resolveLineage`/`classifyCompetency` run for real against this stub — the
// stub only stands in for Supabase; the composed modules are never faked.
type Fixtures = Record<string, unknown[]>

function makeStubClient(fixtures: Fixtures) {
  return {
    from(table: string) {
      const rows = fixtures[table] ?? []
      const builder = {
        select() {
          return builder
        },
        eq() {
          return builder
        },
        in() {
          return builder
        },
        or() {
          return builder
        },
        order() {
          return builder
        },
        maybeSingle() {
          return Promise.resolve({ data: rows[0] ?? null, error: null })
        },
        then(resolve: (v: { data: unknown[]; error: null }) => void, reject?: (e: unknown) => void) {
          return Promise.resolve({ data: rows, error: null }).then(resolve, reject)
        },
      }
      return builder
    },
  }
}

const targetSop = { id: 'sop-1', version: 1, parent_sop_id: null, refresher_interval_months: null, status: 'published' }

test.describe('isSignedOffAssessor', () => {
  test('D-01: approved sign-off on the SOP -> true', async () => {
    const client = makeStubClient({
      sops: [targetSop],
      sop_completions: [{ id: 'c1', sop_id: 'sop-1', submitted_at: '2026-01-01T00:00:00.000Z' }],
      completion_sign_offs: [{ completion_id: 'c1', decision: 'approved', created_at: '2026-01-02T00:00:00.000Z' }],
      sop_observations: [],
    })
    expect(await isSignedOffAssessor('p1', 'sop-1', client, 'org-1')).toBe(true)
  })

  test('D-01: completion only (no sign-off) -> false', async () => {
    const client = makeStubClient({
      sops: [targetSop],
      sop_completions: [{ id: 'c1', sop_id: 'sop-1', submitted_at: '2026-01-01T00:00:00.000Z' }],
      completion_sign_offs: [],
      sop_observations: [],
    })
    expect(await isSignedOffAssessor('p1', 'sop-1', client, 'org-1')).toBe(false)
  })

  test('D-01: performed_to_sop observation only -> false', async () => {
    const client = makeStubClient({
      sops: [targetSop],
      sop_completions: [],
      completion_sign_offs: [],
      sop_observations: [{ sop_id: 'sop-1', verdict: 'performed_to_sop', created_at: '2026-01-01T00:00:00.000Z' }],
    })
    expect(await isSignedOffAssessor('p1', 'sop-1', client, 'org-1')).toBe(false)
  })

  test('D-02: approved sign-off then a LATER needs_support observation -> false (reset suspends assess capability)', async () => {
    const client = makeStubClient({
      sops: [targetSop],
      sop_completions: [{ id: 'c1', sop_id: 'sop-1', submitted_at: '2026-01-01T00:00:00.000Z' }],
      completion_sign_offs: [{ completion_id: 'c1', decision: 'approved', created_at: '2026-01-02T00:00:00.000Z' }],
      sop_observations: [{ sop_id: 'sop-1', verdict: 'needs_support', created_at: '2026-01-03T00:00:00.000Z' }],
    })
    expect(await isSignedOffAssessor('p1', 'sop-1', client, 'org-1')).toBe(false)
  })

  test('D-02: approved sign-off with an EARLIER needs_support observation -> true (reset does not apply)', async () => {
    const client = makeStubClient({
      sops: [targetSop],
      sop_completions: [{ id: 'c1', sop_id: 'sop-1', submitted_at: '2026-01-01T00:00:00.000Z' }],
      completion_sign_offs: [{ completion_id: 'c1', decision: 'approved', created_at: '2026-01-05T00:00:00.000Z' }],
      sop_observations: [{ sop_id: 'sop-1', verdict: 'needs_support', created_at: '2026-01-01T00:00:00.000Z' }],
    })
    expect(await isSignedOffAssessor('p1', 'sop-1', client, 'org-1')).toBe(true)
  })

  test('CMP-03 lineage: sign-off recorded against a superseded lineage member -> true (assessorship survives supersede)', async () => {
    // Target sop-2 is the current published v2, whose parent_sop_id points at
    // the v1 root sop-1. The real resolveLineage call widens allSopIds to
    // cover both members; the sign-off lives against v1.
    const v2 = { id: 'sop-2', version: 2, parent_sop_id: 'sop-1', refresher_interval_months: null, status: 'published' }
    const v1 = { id: 'sop-1', version: 1, parent_sop_id: null, refresher_interval_months: null, status: 'published' }
    const client = makeStubClient({
      sops: [v2, v1],
      sop_completions: [{ id: 'c1', sop_id: 'sop-1', submitted_at: '2026-01-01T00:00:00.000Z' }],
      completion_sign_offs: [{ completion_id: 'c1', decision: 'approved', created_at: '2026-01-02T00:00:00.000Z' }],
      sop_observations: [],
    })
    expect(await isSignedOffAssessor('p1', 'sop-2', client, 'org-1')).toBe(true)
  })

  test('unknown/cross-org sopId -> false, no further queries', async () => {
    const client = makeStubClient({
      sops: [],
    })
    expect(await isSignedOffAssessor('p1', 'sop-missing', client, 'org-1')).toBe(false)
  })

  test('orgId null -> false without querying evidence', async () => {
    const client = makeStubClient({
      sops: [targetSop],
      sop_completions: [{ id: 'c1', sop_id: 'sop-1', submitted_at: '2026-01-01T00:00:00.000Z' }],
      completion_sign_offs: [{ completion_id: 'c1', decision: 'approved', created_at: '2026-01-02T00:00:00.000Z' }],
      sop_observations: [],
    })
    expect(await isSignedOffAssessor('p1', 'sop-1', client, null)).toBe(false)
  })
})
