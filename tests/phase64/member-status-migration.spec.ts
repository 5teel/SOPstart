/**
 * Phase 64 / Plan 64-01 -- source contract on supabase/migrations/00082_member_status.sql
 * and the decision-kind registries it is spec-locked to.
 * Requirements MEMB-01, MEMB-02, MEMB-03, MEMB-10. Decisions D-01, D-06, D-07, D-12, D-19.
 *
 * Source-only: the live behaviour (suspended probe, active probe, grants) is asserted by
 * scripts/apply-phase64-migration.mjs against the project. Registration: playwright.config.ts `phase64`.
 *
 * The migration is read with CRLF normalised and whole-line comments removed (CLAUDE.md
 * "guards strip comments after normalising CRLF"), so a comment can never satisfy or trip an
 * assertion. Banned patterns are described in words here, never written as literals.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { DECISION_KINDS } from '@/lib/decisions/shape'
import { KIND_GROUPS, KIND_WORDS } from '@/lib/decisions/read'

const FILE = path.join(process.cwd(), 'supabase/migrations/00082_member_status.sql')
const BASELINE = path.join(process.cwd(), '.planning/phases/64-leavers-and-suspended-members/64-BASELINE.md')

const norm = (s: string) => s.replace(/\r\n/g, '\n')
const sql = (): string =>
  norm(fs.readFileSync(FILE, 'utf8'))
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('--'))
    .join('\n')

/** Body of the first `create or replace function <name>` statement (to its closing dollar quote). */
function fn(src: string, name: string): string {
  const start = src.search(new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${name}\\b`, 'i'))
  expect(start, `function ${name} is (re)defined`).toBeGreaterThanOrEqual(0)
  const rest = src.slice(start)
  const first = rest.indexOf('$$')
  const second = rest.indexOf('$$', first + 2)
  expect(first).toBeGreaterThan(-1)
  expect(second).toBeGreaterThan(first)
  return rest.slice(0, second + 2)
}

/** Whole statement of `create policy "<name>" ...;` (paren-aware, to the next top-level semicolon). */
function policy(src: string, name: string): string {
  const m = new RegExp(`create\\s+policy\\s+"${name}"`, 'i').exec(src)
  expect(m, `policy ${name} is recreated`).not.toBeNull()
  let depth = 0
  let end = m!.index
  for (; end < src.length; end++) {
    const ch = src[end]
    if (ch === '(') depth++
    else if (ch === ')') depth--
    else if (ch === ';' && depth === 0) break
  }
  return src.slice(m!.index, end)
}

const RAW_CLAIM_POLICIES: Array<[string, string]> = [
  ['escalation_insert_own', 'public.escalation_reports'],
  ['escalation_select_scoped', 'public.escalation_reports'],
  ['escalation_update_supervisor', 'public.escalation_reports'],
  ['voice_notes_insert_own', 'public.sop_voice_notes'],
  ['voice_notes_select_org', 'public.sop_voice_notes'],
  ['uat_feedback_insert_own', 'public.uat_feedback'],
  ['uat_feedback_read_org', 'public.uat_feedback'],
  ['voice_bucket_insert_own', 'storage.objects'],
  ['voice_bucket_select_org', 'storage.objects'],
]

test.describe('00082 member status migration (source contract)', () => {
  test('MEMB-01: status columns, CHECK over exactly active / suspended / left, default active', () => {
    const s = sql()
    expect(s).toMatch(/alter\s+table\s+public\.organisation_members/i)
    expect(s).toMatch(/add\s+column\s+if\s+not\s+exists\s+status\s+text\s+not\s+null\s+default\s+'active'/i)
    expect(s).toMatch(/add\s+column\s+if\s+not\s+exists\s+status_changed_at\s+timestamptz/i)
    expect(s).toMatch(/add\s+column\s+if\s+not\s+exists\s+status_changed_by\s+uuid\s+references\s+auth\.users\s*\(\s*id\s*\)\s+on\s+delete\s+set\s+null/i)
    expect(s).toMatch(/drop\s+constraint\s+if\s+exists\s+organisation_members_status_check/i)
    const c = /add\s+constraint\s+organisation_members_status_check\s+check\s*\(\s*status\s+in\s*\(([^)]*)\)\s*\)/i.exec(s)
    expect(c).not.toBeNull()
    expect([...c![1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).sort()).toEqual(['active', 'left', 'suspended'])
  })

  test('MEMB-01: UPDATE lock -- table UPDATE revoked from anon and authenticated, role column only granted back', () => {
    const s = sql()
    expect(s).toMatch(/revoke\s+update\s+on\s+public\.organisation_members\s+from\s+anon\s*,\s*authenticated\s*;/i)
    expect(s).toMatch(/grant\s+update\s*\(\s*role\s*\)\s+on\s+public\.organisation_members\s+to\s+authenticated\s*;/i)
    // The grant list never widens past role.
    expect(s).not.toMatch(/grant\s+update\s*\([^)]*status/i)
    expect(s).not.toMatch(/grant\s+update\s+on\s+public\.organisation_members/i)
  })

  test('MEMB-02: both helpers are security definer, empty search_path, re-check an active membership row', () => {
    const s = sql()
    for (const name of ['current_organisation_id', 'current_user_role']) {
      const b = fn(s, name)
      expect(b, name).toMatch(/security\s+definer/i)
      expect(b, name).toMatch(/set\s+search_path\s*=\s*''/i)
      expect(b, name).toMatch(/from\s+public\.organisation_members\s+m/i)
      expect(b, name).toMatch(/m\.user_id\s*=\s*auth\.uid\(\)/i)
      // The token's organisation claim only SELECTS the row; the row decides (D-06).
      expect(b, name).toMatch(/m\.organisation_id\s*=\s*nullif\(\s*auth\.jwt\(\)\s*->>\s*'organisation_id'\s*,\s*'null'\s*\)::uuid/i)
      expect(b, name).toMatch(/m\.status\s*=\s*'active'/i)
    }
    expect(fn(s, 'current_organisation_id')).toMatch(/returns\s+uuid/i)
    expect(fn(s, 'current_user_role')).toMatch(/returns\s+public\.app_role/i)
    // The role comes from the row, never from the token.
    expect(fn(s, 'current_user_role')).toMatch(/select\s+m\.role\b/i)
    expect(fn(s, 'current_user_role').split('$$')[1]).not.toMatch(/user_role/i)
  })

  test('MEMB-02: the access-token hook skips non-active rows in both selects and keeps its grant', () => {
    const s = sql()
    const b = fn(s, 'custom_access_token_hook')
    expect([...b.matchAll(/from\s+public\.organisation_members/gi)].length).toBe(2)
    expect([...b.matchAll(/status\s*=\s*'active'/gi)].length).toBe(2)
    // approval gate (ADR-0018) is untouched
    expect(b).toMatch(/user_approvals/i)
    expect(b).toMatch(/'pending'/)
    expect(s).toMatch(/grant\s+execute\s+on\s+function\s+public\.custom_access_token_hook\s+to\s+supabase_auth_admin\s*;/i)
  })

  test('MEMB-03: revoke_user_sessions deletes one user\'s sessions and only service_role may run it', () => {
    const s = sql()
    const b = fn(s, 'revoke_user_sessions')
    expect(b).toMatch(/revoke_user_sessions\s*\(\s*p_user_id\s+uuid\s*\)/i)
    expect(b).toMatch(/returns\s+integer/i)
    expect(b).toMatch(/security\s+definer/i)
    expect(b).toMatch(/set\s+search_path\s*=\s*''/i)
    expect(b).toMatch(/delete\s+from\s+auth\.sessions\s+where\s+user_id\s*=\s*p_user_id/i)
    expect(s).toMatch(/revoke\s+all\s+on\s+function\s+public\.revoke_user_sessions\s*\(\s*uuid\s*\)\s+from\s+public\s*,\s*anon\s*,\s*authenticated\s*;/i)
    const grants = [...s.matchAll(/grant\s+execute\s+on\s+function\s+public\.revoke_user_sessions[^;]*;/gi)].map((m) => m[0])
    expect(grants.length).toBe(1)
    expect(grants[0]).toMatch(/to\s+service_role\s*;?$/i)
    expect(grants[0]).not.toMatch(/authenticated|anon|public\s*;/i)
  })

  test('MEMB-02: every raw-claim policy is recreated on the helpers with no direct token read, and the dead generated-videos one is dropped', () => {
    const s = sql()
    for (const [name, table] of RAW_CLAIM_POLICIES) {
      expect(s, `${name} dropped first`).toMatch(new RegExp(`drop\\s+policy\\s+if\\s+exists\\s+"${name}"\\s+on\\s+${table.replace('.', '\\.')}\\s*;`, 'i'))
      const p = policy(s, name)
      expect(p, name).toMatch(/to\s+authenticated/i)
      expect(p, name).toMatch(/public\.current_organisation_id\(\)/i)
      expect(p, name).not.toMatch(/auth\.jwt\(\)/i)
    }
    // role comparisons use the helper, not the claim
    expect(policy(s, 'escalation_select_scoped')).toMatch(/public\.current_user_role\(\)/i)
    expect(policy(s, 'escalation_update_supervisor')).toMatch(/public\.current_user_role\(\)/i)
    // generated-videos read policy reads app_metadata and matches nothing: dropped, not recreated
    expect(s).toMatch(/drop\s+policy\s+if\s+exists\s+"org members can read generated videos"\s+on\s+storage\.objects\s*;/i)
    expect(s).not.toMatch(/create\s+policy\s+"org members can read generated videos"/i)
    // Outside the function bodies (the helpers are the one place the claim is read), no
    // statement in the file reads either token claim directly.
    const outsideFunctions = s.replace(/\$\$[\s\S]*?\$\$/g, '')
    expect(outsideFunctions).not.toMatch(/auth\.jwt\(\)/i)
    // The update policy keeps its org predicate in USING and in WITH CHECK (00062 lesson).
    const upd = policy(s, 'escalation_update_supervisor')
    expect(upd).toMatch(/using\s*\([\s\S]*current_organisation_id/i)
    expect(upd).toMatch(/with\s+check\s*\([\s\S]*current_organisation_id/i)
  })

  test('MEMB-02: the observations own-row arm is ANDed with the org helper; refs helper needs an active row', () => {
    const s = sql()
    expect(s).toMatch(/drop\s+policy\s+if\s+exists\s+"sop_observations_read_org"\s+on\s+public\.sop_observations\s*;/i)
    const p = policy(s, 'sop_observations_read_org')
    expect(p).toMatch(/for\s+select\s+to\s+authenticated/i)
    // org predicate sits outside the role / own-row OR, so neither arm escapes it
    expect(p.replace(/\s+/g, ' ')).toMatch(/using\s*\(\s*organisation_id\s*=\s*public\.current_organisation_id\(\)\s+and\s*\(\s*public\.current_user_role\(\)\s+in\s*\(\s*'admin'\s*,\s*'safety_manager'\s*,\s*'supervisor'\s*\)\s+or\s+observed_worker_id\s*=\s*auth\.uid\(\)\s*\)\s*\)/i)

    const b = fn(s, 'sop_observation_refs_in_org')
    expect(b).toMatch(/sop_observation_refs_in_org\s*\(\s*p_sop_id\s+uuid\s*,\s*p_worker_id\s+uuid\s*,\s*p_org_id\s+uuid\s*\)/i)
    expect(b).toMatch(/security\s+definer/i)
    expect(b).toMatch(/m\.status\s*=\s*'active'/i)
    expect(b).toMatch(/from\s+public\.sops\s+s/i)
  })

  test('MEMB-10: the recreated decisions_kind_check equals DECISION_KINDS and adds the three member kinds', () => {
    const s = sql()
    expect(s).toMatch(/alter\s+table\s+public\.decisions\s+drop\s+constraint\s+if\s+exists\s+decisions_kind_check\s*;/i)
    const m = s.match(/check\s*\(\s*kind\s+in\s*\(([^)]*)\)/i)
    expect(m).not.toBeNull()
    const kinds = [...m![1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1])
    expect(new Set(kinds)).toEqual(new Set(DECISION_KINDS))
    expect(kinds.length).toBe(DECISION_KINDS.length)
    for (const k of ['member_suspended', 'member_left', 'member_reinstated', 'member_removed']) expect(kinds).toContain(k)
  })

  test('MEMB-10: the registries carry the three kinds with their words', () => {
    for (const k of ['member_suspended', 'member_left', 'member_reinstated'] as const) {
      expect(DECISION_KINDS).toContain(k)
      expect(KIND_GROUPS.people).toContain(k)
    }
    expect(KIND_WORDS.member_suspended).toBe('Suspended someone')
    expect(KIND_WORDS.member_left).toBe('Marked someone as left')
    expect(KIND_WORDS.member_reinstated).toBe('Reinstated someone')
    // history stays readable
    expect(DECISION_KINDS).toContain('member_removed')
    expect(KIND_WORDS.member_removed).toBe('Removed someone')
  })

  test('D-19: the sop-videos SELECT policy is scoped to the organisation folder (64-BASELINE decided "scope")', () => {
    const base = norm(fs.readFileSync(BASELINE, 'utf8'))
    const scoped = /D-19 decision:\s*\*{0,2}\s*scope/i.test(base)
    const s = sql()
    if (!scoped) {
      expect(base).toMatch(/D-19 decision:\s*\*{0,2}\s*residual/i)
      return
    }
    expect(s).toMatch(/drop\s+policy\s+if\s+exists\s+"Authenticated users can read from sop-videos"\s+on\s+storage\.objects\s*;/i)
    const p = policy(s, 'Authenticated users can read from sop-videos').replace(/\s+/g, ' ')
    expect(p).toMatch(/for\s+select\s+to\s+authenticated/i)
    expect(p).toMatch(/bucket_id\s*=\s*'sop-videos'/i)
    expect(p).toMatch(/\(storage\.foldername\(name\)\)\[1\]\s*=\s*public\.current_organisation_id\(\)::text/i)
    // the INSERT / UPDATE policies of the bucket are left alone
    expect(s).not.toMatch(/admins_can_upload_sop_videos/i)
  })
})
