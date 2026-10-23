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
