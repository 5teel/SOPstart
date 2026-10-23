/**
 * Phase 64 review fixes (64-REVIEW.md) -- source contract on supabase/migrations/00083_member_hardening.sql
 * and the app paths it pairs with. The live behaviour (refused session insert, the last-admin race,
 * cross-org junction reads) is asserted by scripts/apply-phase64b-migration.mjs against the project.
 * Registration: playwright.config.ts `phase64`. Sources are read with CRLF normalised and comments
 * stripped, so a comment can never satisfy an assertion; banned patterns are described in words.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const norm = (s: string) => s.replace(/\r\n/g, '\n')
const sql = (): string =>
  norm(fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/00083_member_hardening.sql'), 'utf8'))
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('--'))
    .join('\n')
const src = (rel: string): string =>
  norm(fs.readFileSync(path.join(process.cwd(), rel), 'utf8'))
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\/\*|\*\/|\*)/.test(l))
    .join('\n')

/** Text of `function <name>` from its declaration to the next top-level declaration. */
function body(s: string, name: string): string {
  const start = s.search(new RegExp(`(?:^|\\n)(?:export )?(?:async )?function ${name}\\b`))
  expect(start, `function ${name} exists`).toBeGreaterThanOrEqual(0)
  const rest = s.slice(start + 1)
  const next = rest.search(/\n(?:export )?(?:async )?function \w+|\nexport (?:interface|const|type) /)
  return next < 0 ? rest : rest.slice(0, next)
}

test.describe('HI-01 / LO-03: membership inserts are service-role-only', () => {
  test('00083 drops the admin INSERT policy and revokes INSERT and DELETE from session roles', () => {
    const s = sql()
    expect(s).toMatch(/drop\s+policy\s+if\s+exists\s+"admins_can_insert_members"\s+on\s+public\.organisation_members\s*;/i)
    expect(s).toMatch(/revoke\s+insert\s*,\s*delete\s+on\s+public\.organisation_members\s+from\s+anon\s*,\s*authenticated\s*;/i)
    expect(s).not.toMatch(/create\s+policy\s+"admins_can_insert_members"/i)
    expect(s).not.toMatch(/grant\s+(insert|delete|all)[^;]*on\s+public\.organisation_members/i)
  })

  test('00083 copies a never-signed-in invitee\'s invite into app_metadata', () => {
    const s = sql().replace(/\s+/g, ' ')
    expect(s).toMatch(/update auth\.users u set raw_app_meta_data = /i)
    expect(s).toContain("'invite_org_id'")
    expect(s).toContain("'invite_role'")
    expect(s).toMatch(/u\.last_sign_in_at is null/i)
  })

  test('inviteWorker records the invite in app_metadata with the service role', () => {
    const b = body(src('src/actions/auth.ts'), 'inviteWorker')
    expect(b).toContain('admin.auth.admin.updateUserById(')
    expect(b).toMatch(/app_metadata:\s*\{\s*invite_org_id:\s*organisationId,\s*invite_role:\s*newRole\s*\}/)
  })

  test('acceptInvite reads app_metadata only, checks status first, then inserts with the service role', () => {
    const b = body(src('src/actions/auth.ts'), 'acceptInvite')
    expect(b).toContain('user.app_metadata')
    expect(b).not.toContain('user_metadata')
    expect(b).toContain("invite['invite_org_id']")
    expect(b).toContain('updateRoleSchema.shape.role.safeParse(')
    // the paused-page branch runs before any insert, so it is reachable (LO-03)
    const read = b.indexOf(".select('status')")
    const paused = b.indexOf("redirect('/pending')")
    const insert = b.indexOf('.insert(')
    expect(read).toBeGreaterThan(-1)
    expect(paused).toBeGreaterThan(read)
    expect(insert).toBeGreaterThan(paused)
    expect(b).toContain('const admin = createAdminClient()')
    expect(b).toContain("admin.from('organisation_members').insert(")
    expect(b).not.toContain("supabase.from('organisation_members')")
  })
})

test.describe('ME-01: the last active admin is kept by the database', () => {
  test('00083 trigger locks the organisation row, recounts other active admins and refuses', () => {
    const s = sql()
    const at = s.search(/create\s+or\s+replace\s+function\s+public\.keep_one_active_admin\(\)/i)
    expect(at).toBeGreaterThanOrEqual(0)
    const fn = s.slice(at)
    const b = fn.slice(0, fn.indexOf('$$', fn.indexOf('$$') + 2)).replace(/\s+/g, ' ')
    expect(b).toMatch(/returns trigger/i)
    expect(b).toMatch(/security definer/i)
    expect(b).toMatch(/set search_path = ''/i)
    expect(b).toMatch(/old\.role = 'admin' and old\.status = 'active' and \(new\.role <> 'admin' or new\.status <> 'active'\)/i)
    expect(b).toMatch(/from public\.organisations where id = old\.organisation_id for no key update/i)
    expect(b).toMatch(/id <> old\.id and role = 'admin' and status = 'active'/i)
    expect(b).toMatch(/raise exception 'last active admin'/i)
    expect(s.replace(/\s+/g, ' ')).toMatch(
      /create trigger organisation_members_keep_admin before update on public\.organisation_members for each row execute function public\.keep_one_active_admin\(\)/i,
    )
  })

  test('changeMemberState filters on the role the caller saw and reports the trigger refusal', () => {
    const s = src('src/lib/members/state.ts')
    const b = body(s, 'changeMemberState')
    expect(b).toContain("if (seenRole) query = query.eq('role', seenRole)")
    expect(b).toContain('lastAdmin: isLastAdminError(error)')
    expect(s).toContain("error?.message?.includes('last active admin')")
  })

  test('the member actions pass the seen role and word the refusal; the role change words it too', () => {
    const m = body(src('src/actions/members.ts'), 'applyMemberState')
    expect(m).toContain('seenRole: target.role as AppRole')
    expect(m).toContain("changed.lastAdmin ? 'There has to be at least one admin.'")
    const r = body(src('src/actions/auth.ts'), 'updateMemberRoleSafe')
    expect(r).toContain("isLastAdminError(error) ? 'There has to be at least one admin.'")
  })
})

test.describe('LO-04: the observation reference check takes no organisation id', () => {
  test('00083 defines the 2-argument helper on current_organisation_id(), repoints the policy, drops the 3-argument one', () => {
    const s = sql()
    const at = s.search(/create\s+or\s+replace\s+function\s+public\.sop_observation_refs_in_org\s*\(\s*p_sop_id\s+uuid\s*,\s*p_worker_id\s+uuid\s*\)/i)
    expect(at).toBeGreaterThanOrEqual(0)
    const rest = s.slice(at)
    const b = rest.slice(0, rest.indexOf('$$', rest.indexOf('$$') + 2))
    expect(b).toMatch(/security\s+definer/i)
    expect(b).toMatch(/set\s+search_path\s*=\s*''/i)
    expect([...b.matchAll(/public\.current_organisation_id\(\)/gi)].length).toBe(2)
    expect(b).toMatch(/m\.status\s*=\s*'active'/i)
    expect(b).not.toMatch(/p_org_id/i)

    const pol = s.slice(s.search(/create\s+policy\s+sop_observations_insert_recorder/i)).split(';')[0].replace(/\s+/g, ' ')
    expect(pol).toContain('organisation_id = public.current_organisation_id()')
    expect(pol).toContain('observed_by = auth.uid()')
    expect(pol).toContain('public.sop_observation_refs_in_org(sop_id, observed_worker_id)')
    expect(pol).toContain("(not is_assessor_override or public.current_user_role() in ('admin', 'safety_manager'))")
    expect(s).toMatch(/drop\s+function\s+if\s+exists\s+public\.sop_observation_refs_in_org\s*\(\s*uuid\s*,\s*uuid\s*,\s*uuid\s*\)\s*;/i)
    expect(s.indexOf('drop function if exists public.sop_observation_refs_in_org')).toBeGreaterThan(s.search(/create\s+policy\s+sop_observations_insert_recorder/i))
  })
})
