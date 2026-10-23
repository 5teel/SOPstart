/**
 * Phase 64 / Plan 64-02 -- source contract for the membership state change: the state module,
 * the three server actions, and every auth path made state-aware.
 * Requirements MEMB-02, MEMB-03, MEMB-04, MEMB-07, MEMB-08, MEMB-10, MEMB-12. Decisions D-03, D-05..D-08, D-12.
 *
 * Source-only, comment-stripped with CRLF normalised (CLAUDE.md: guards strip comments after normalising CRLF).
 * Registration: playwright.config.ts `phase64`.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const norm = (s: string) => s.replace(/\r\n/g, '\n')
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

const STATE = 'src/lib/members/state.ts'
const ACTIONS = 'src/actions/members.ts'

test.describe('state module (changeMemberState)', () => {
  test('is a plain service-role module scoped by id, organisation and expected status', () => {
    const s = src(STATE)
    expect(s).not.toMatch(/['"]use server['"]/)
    expect(s).toContain('createAdminClient')
    expect(s).toContain('export async function changeMemberState')
    const b = body(s, 'changeMemberState')
    expect(b).toContain(".from('organisation_members')")
    expect(b).toContain('.update(')
    expect(b).toMatch(/status:\s*to/)
    expect(b).toContain('status_changed_at')
    expect(b).toContain('status_changed_by')
    expect(b).toContain(".eq('id', memberId)")
    expect(b).toContain(".eq('organisation_id', organisationId)")
    expect(b).toContain(".in('status', from)")
    expect(b).toMatch(/\.select\('user_id, role'\)/)
    expect(b).toContain('ok: false')
  })

  test('revokes sessions only for suspended or left, after the update; a revoke error is not a rollback', () => {
    const b = body(src(STATE), 'changeMemberState')
    expect(b.indexOf('.update(')).toBeGreaterThan(-1)
    expect(b.indexOf("rpc('revoke_user_sessions'")).toBeGreaterThan(b.indexOf('.update('))
    expect(b).toMatch(/to\s*!==\s*'active'/)
    expect(b).toContain('signedOut')
    expect(b).toContain('[changeMemberState]')
  })
})

test.describe('actions (members.ts)', () => {
  test('exports exactly the three actions, all async functions', () => {
    const s = src(ACTIONS)
    expect(s.trimStart().startsWith("'use server'")).toBe(true)
    expect((s.match(/^export /gm) ?? []).length).toBe(3)
    expect((s.match(/^export async function /gm) ?? []).length).toBe(3)
    for (const n of ['suspendMember', 'markMemberLeft', 'reinstateMember']) {
      expect(s).toContain(`export async function ${n}(memberId: string)`)
    }
  })

  test('applyMemberState carries the authority rules', () => {
    const s = src(ACTIONS)
    expect(s.indexOf('async function applyMemberState')).toBeGreaterThan(-1)
    expect(s.indexOf('async function applyMemberState')).toBeLessThan(s.indexOf('export async function suspendMember'))
    const b = body(s, 'applyMemberState')
    for (const copy of [
      'Not authenticated',
      'Admin access required',
      'No organisation',
      'Member not found',
      'You cannot change your own access.',
      'Only an admin can change an admin.',
      'That has already changed. Refresh and try again.',
      'There has to be at least one admin.',
      "That didn't work. Nothing was changed — try again.",
    ]) {
      expect(b, copy).toContain(copy)
    }
    expect(b).toContain('z.string().uuid()')
    expect(b).toContain('user_id, role, status')
    expect(b).toContain(".eq('organisation_id', organisationId)")
    expect(b).toContain(".eq('role', 'admin')")
    expect(b).toContain(".eq('status', 'active')")
    expect(b).toContain('from: [seen]')
  })

  test('allowed transitions', () => {
    const s = src(ACTIONS)
    expect(s).toMatch(/suspended:\s*\['active'\]/)
    expect(s).toMatch(/left:\s*\['active',\s*'suspended'\]/)
    expect(s).toMatch(/active:\s*\['suspended',\s*'left'\]/)
  })

  test('changes the state before the ledger row, with no email in the details', () => {
    const b = body(src(ACTIONS), 'applyMemberState')
    expect(b.indexOf('changeMemberState(')).toBeGreaterThan(-1)
    expect(b.indexOf('recordDecision(')).toBeGreaterThan(b.indexOf('changeMemberState('))
    for (const k of ['member_suspended', 'member_left', 'member_reinstated']) expect(b + src(ACTIONS)).toContain(k)
    expect(b).toContain("kind: 'member'")
    for (const w of ['Suspended a person', 'Marked a person as left', 'Reinstated a person']) expect(src(ACTIONS)).toContain(w)
    expect(b).toContain('signed_out')
    expect(b).not.toMatch(/email/i)
    expect(b).toContain('success: true')
  })
})

test.describe('auth paths honour the state (auth.ts, session-context, sites)', () => {
  const auth = () => src('src/actions/auth.ts')

  test('switchSite and setSiteHidden need an active row', () => {
    expect(body(auth(), 'switchSite')).toContain(".eq('status', 'active')")
    expect(body(auth(), 'setSiteHidden')).toContain(".eq('status', 'active')")
  })

  test('joinWithInviteCode refuses a non-active row and never inserts over it', () => {
    const b = body(auth(), 'joinWithInviteCode')
    expect(b).toContain('.select(\'id, status\')')
    expect(b).toContain('has been paused. Talk to your supervisor.')
    expect(b.indexOf('has been paused')).toBeLessThan(b.indexOf('.insert('))
  })

  test('inviteWorker reactivates a left person, refuses a suspended one', () => {
    const b = body(auth(), 'inviteWorker')
    expect(b).toContain('.select(\'id, status\')')
    expect(b).toContain("from: ['left']")
    expect(b).toContain('role: newRole')
    expect(b.indexOf('changeMemberState(')).toBeGreaterThan(-1)
    expect(b.indexOf("kind: 'member_reinstated'")).toBeGreaterThan(b.indexOf('changeMemberState('))
    expect(b).toContain("via: 'invite'")
    expect(b).toContain("success: 'Reinstated'")
    expect(b).toContain('They are suspended. Open them in People and choose Reinstate.')
  })

  test('acceptInvite sends a non-active duplicate to /pending', () => {
    const b = body(auth(), 'acceptInvite')
    expect(b).toContain('23505')
    expect(b).toContain("redirect('/pending')")
  })

  test('the People list carries the state', () => {
    const s = auth()
    expect(s).toContain('status: MemberStatus')
    expect(s).toContain('status_changed_at: string | null')
    expect(body(s, 'getTeamMembersWithEmails')).toContain('id, user_id, role, status, status_changed_at, created_at')
  })

  test('updateMemberRoleSafe refuses a non-active target and counts active admins only', () => {
    const b = body(auth(), 'updateMemberRoleSafe')
    expect(b).toContain('Reinstate them before changing their role.')
    expect(b).toContain(".eq('status', 'active')")
  })

  test('session context and the site picker read active rows only', () => {
    expect(src('src/lib/auth/session-context.ts')).toContain(".eq('status', 'active')")
    expect(src('src/lib/auth/sites.ts')).toContain(".eq('status', 'active')")
  })
})

test.describe('paused page', () => {
  test('pausedMemberships is a plain service-role read of the session user', () => {
    const s = src('src/lib/auth/paused.ts')
    expect(s).not.toMatch(/['"]use server['"]/)
    expect(s).toContain('createAdminClient')
    expect(s).toContain(".eq('user_id', userId)")
    expect(s).toContain(".neq('status', 'active')")
    expect(s).toContain('export async function pausedMemberships')
  })

  test('/pending shows the paused copy only in the approved branch', () => {
    const s = src('src/app/(protected)/pending/page.tsx')
    expect(s.match(/pausedMemberships\(/g)?.length).toBe(1)
    expect(s).toContain("status === 'approved'")
    expect(s).toContain('has been paused. Talk to your supervisor.')
    expect(s).toContain('data-status')
    expect(s).toContain('Access paused')
  })

  test('the pathways map mentions it', () => {
    expect(src('src/lib/journeys/journeys.ts')).toContain('has been paused. Talk to your supervisor.')
  })
})
