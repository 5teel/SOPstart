/**
 * Phase 59 -- people actions. Requirement OFF-05; decisions D-10, D-11, A-07, A-10.
 * Owner: 59-05. Source-contract guards over comment-stripped source (CLAUDE.md 2026-09-28).
 * Registration: playwright.config.ts `phase59`.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf-8').replace(/\r\n/g, '\n')
const strip = (src: string) =>
  src
    .split('\n')
    .map((l) => (/^\s*(\/\/|\/\*|\*\/|\*)/.test(l) ? '' : l))
    .join('\n')

const AUTH = strip(read('src/actions/auth.ts'))
function body(name: string): string {
  const m = new RegExp(`export async function ${name}\\b`).exec(AUTH)
  if (!m) return ''
  const rest = AUTH.slice(m.index + 1)
  const next = rest.search(/\nexport /)
  return next === -1 ? AUTH.slice(m.index) : AUTH.slice(m.index, m.index + 1 + next)
}

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(e.name)) out.push(full)
  }
  return out
}

test.describe('people actions', () => {
  test('inviteWorker requires an admin, validates the role with a zod enum, and only an admin may grant admin', () => {
    const b = body('inviteWorker')
    expect(b).toContain("role !== 'admin'")
    expect(b).toContain('Only an admin can invite people.')
    expect(b.indexOf('Only an admin can invite people.')).toBeLessThan(b.indexOf('listUsers('))
    expect(b.indexOf('Only an admin can invite people.')).toBeLessThan(b.indexOf('inviteUserByEmail('))
    expect(b).toContain('invited_role: newRole')
    expect(b).not.toContain("invited_role: 'worker'")
    const schema = read('src/lib/validators/auth.ts')
    expect(schema).toMatch(/inviteWorkerSchema[\s\S]*role: z\.enum\(\['worker', 'supervisor', 'admin', 'safety_manager'\]\)/)
  })

  test('inviteWorker also covers an existing account (absorbs the by-email add)', () => {
    const b = body('inviteWorker')
    expect(b).toContain('listUsers(')
    expect(b).toContain('This person is already a member of your organisation.')
    expect(b).toMatch(/from\('organisation_members'\)\.insert\(\{\s*organisation_id: organisationId/)
    expect(b.lastIndexOf('await recordDecision({')).toBeGreaterThan(b.indexOf('inviteUserByEmail('))
    expect(b).toContain("kind: 'member_invited'")
    expect(b).toContain('logged: rec.ok')
  })

  test('updateMemberRoleSafe is admin-only and a zero-row update reports failure, not success', () => {
    const b = body('updateMemberRoleSafe')
    expect(b).toContain('Only an admin can change roles.')
    expect(b).toContain('There has to be at least one admin.')
    expect(b).toMatch(/\.eq\('organisation_id', organisationId\)/)
    expect(b).toContain(".select('id')")
    expect(b).toMatch(/updated\.length === 0/)
    expect(b.lastIndexOf('await recordDecision({')).toBeGreaterThan(b.indexOf('.update('))
    expect(b).toContain("kind: 'role_change'")
    expect(b).toMatch(/details: \{ from: /)
  })

  test('the unsafe role writer and the by-email add are deleted', () => {
    const all = walk(path.join(ROOT, 'src')).map((f) => strip(fs.readFileSync(f, 'utf-8')))
    for (const t of all) {
      expect(t).not.toContain('addMemberByEmail')
      expect(t).not.toMatch(/export async function updateMemberRole\(/)
    }
  })

  test('removeMember captures the target user id before the row is deleted, then writes member_removed', () => {
    const b = body('removeMember')
    expect(b).not.toContain('.delete(')
    expect(b).toContain('z.string().uuid()')
    const read1 = b.indexOf("from('organisation_members')")
    const del = b.indexOf('deleteOrgMember(')
    expect(read1).toBeGreaterThan(-1)
    expect(del).toBeGreaterThan(read1)
    expect(b).toContain('target.user_id === userId')
    expect(b).toMatch(/target\.role === 'admin' && role !== 'admin'/)
    expect(b.lastIndexOf('await recordDecision({')).toBeGreaterThan(del)
    expect(b).toContain("kind: 'member_removed'")
    expect(b).toMatch(/subject: \{ kind: 'member', id: target\.user_id \}/)

    const helper = strip(read('src/lib/members/remove.ts'))
    expect(helper).not.toMatch(/['"]use server['"]/)
    expect(helper).not.toContain('server-only')
    expect(helper).toContain('export async function deleteOrgMember')
    expect(helper).toContain('createAdminClient()')
    expect(helper).toMatch(/\.eq\('id', memberId\)\s*\.eq\('organisation_id', organisationId\)\s*\.select\('id'\)/)
  })

  test('the three ledger writers (role_change, member_invited, member_removed) are registered in decision-writers.json', () => {
    const w = JSON.parse(read('scripts/decision-writers.json'))
    expect(w.tables).toContain('organisation_members')
    const kinds = new Map<string, string>(
      [...w.entries, ...w.extraHooks].map((e: { file: string; function: string; kind: string }) => [`${e.file}#${e.function}`, e.kind]),
    )
    expect(kinds.get('src/actions/auth.ts#inviteWorker')).toBe('member_invited')
    expect(kinds.get('src/actions/auth.ts#updateMemberRoleSafe')).toBe('role_change')
    expect(kinds.get('src/actions/auth.ts#removeMember')).toBe('member_removed')
  })

  test('ledger summaries are plain literals and details carry no email', () => {
    for (const name of ['inviteWorker', 'updateMemberRoleSafe', 'removeMember']) {
      const b = body(name)
      for (const m of b.matchAll(/summary:\s*([^\n]+)/g)) expect(m[1], `${name} summary`).toMatch(/^(?:'[^'$`]*'|"[^"$`]*"),?\s*$/)
      expect(b).not.toMatch(/details:[^\n]*email/)
    }
  })

  test('getTeamMembersWithEmails returns invited and inviteCode; invited = org metadata match, no membership row, never signed in (A-10)', () => {
    const b = body('getTeamMembersWithEmails')
    expect(b).toContain('invited')
    expect(b).toContain('inviteCode')
    expect(b).toContain("user_metadata?.['organisation_id'] === organisationId")
    expect(b).toContain('!memberIds.has(u.id)')
    expect(b).toContain('!u.last_sign_in_at')
    expect(b).toContain('u.invited_at')
    expect(b).toMatch(/role === 'admin'[\s\S]*invite_code/)
  })
})
