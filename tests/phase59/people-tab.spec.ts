/**
 * Phase 59 -- people tab. Requirement OFF-05; decisions D-11, A-10.
 * Owner: 59-11. Source-contract guards over comment-stripped source (CLAUDE.md 2026-09-28).
 * Registration: playwright.config.ts `phase59`.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf-8').replace(/\r\n/g, '\n')
const strip = (src: string) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => l.replace(/^\s*\/\/.*$/, ''))
    .join('\n')

const TAB = strip(read('src/components/office/PeopleTab.tsx'))
const PANE = strip(read('src/components/office/OfficePane.tsx'))

test.describe('people tab', () => {
  test('two views of the same people (2026-10-11): a department board and a who-can-do-what grid; one person sheet edits', () => {
    expect(TAB).toContain('data-testid="people-board"')
    expect(TAB).toContain('data-testid="people-card"')
    expect(TAB).toContain('data-testid="people-grid"')
    expect(TAB).toContain('data-testid="people-row"')
    expect(TAB).toContain('data-testid="person-sheet"')
    expect(TAB).toContain('data-testid="people-role-select"')
    expect(TAB).toContain('data-testid="people-remove"')
    for (const w of ['Person', 'Role', 'Departments', 'Signs off work', 'Assigns SOPs', 'Approves SOPs']) expect(TAB).toContain(`>${w}<`)
    // The marks come from the one authority module, never a private copy of the role rules.
    expect(TAB).toContain("from '@/lib/members/authority'")
    expect(TAB).toContain('authorityOf(')
  })

  test('the role select calls the safe role writer, never the retired one', () => {
    expect(TAB).toContain('updateMemberRoleSafe({')
    expect(TAB).not.toContain('updateMemberRole(')
    expect(TAB).toContain('inviteWorker({')
    expect(TAB).toContain('removeMember(')
    expect(TAB).not.toContain('addMemberByEmail')
    // A safety manager sees the role select and the Invite button disabled, with the server's words.
    expect(TAB).toMatch(/disabled=\{!isAdmin \|\| pendingRole\}/)
    expect(TAB).toMatch(/data-testid="people-invite"[\s\S]{0,80}disabled=\{!isAdmin\}/)
    expect(TAB).toContain('Only an admin can invite people.')
    expect(TAB).toContain('Only an admin can change roles.')
  })

  test('a refused role change shows the server words and leaves the select on the old role', () => {
    expect(TAB).toMatch(/setRowError\(\{ id: m\.id, text: res\.error \}\)/)
    expect(TAB).toContain('value={m.role}')
  })

  test('Remove asks for confirmation in an aria-modal dialog with "Keep them"', () => {
    expect(TAB).toContain('aria-modal="true"')
    expect(TAB).toContain('Keep them')
    expect(TAB).toContain('They lose access to the site. Their past sign-offs stay on record.')
    expect(TAB).toContain('aria-label={`Remove ${label}`}')
    // Esc closes only the dialog.
    expect(TAB).toMatch(/e\.key !== 'Escape'[\s\S]{0,120}e\.stopPropagation\(\)/)
  })

  test('the department picker is the existing member_departments picker, unchanged', () => {
    expect(TAB).toContain("from '@/components/admin/departments/DepartmentPicker'")
    expect(TAB).toContain('<DepartmentPicker')
    expect(TAB).toContain('mode="member"')
    expect(TAB).toContain("receipt: 'Departments updated', logged: logged ?? null")
  })

  test('Invited shows as a status chip; the invite form takes an email and a role and says Don\'t invite', () => {
    expect(TAB).toContain('>Invited<')
    expect(TAB).toContain('Waiting to accept')
    expect(TAB).toContain('type="email"')
    expect(TAB).toContain('data-testid="people-invite-role"')
    expect(TAB).toContain('Send invite')
    expect(TAB).toContain('Don&apos;t invite')
    expect(TAB).toContain('Admins can change roles, invite people and publish SOPs.')
    expect(TAB).toContain('disabled={!emailValid || inviting}')
  })

  test('receipts carry the ledger flag from the server, the join code is admin-only, and nothing touches the router', () => {
    expect(TAB).toMatch(/'logged' in res \? \(res\.logged \?\? null\) : null/)
    expect(TAB).not.toMatch(/router\.refresh|useRouter|router\.push|router\.replace/)
    expect(TAB).toMatch(/isAdmin && shownCode/)
    expect(TAB).toContain('regenerateInviteCode()')
    expect(TAB).toContain('/admin/settings')
  })

  test('the pane renders the People arm with its receipt callback', () => {
    expect(PANE).toContain("tab === 'people' && <PeopleTab")
    expect(PANE).toContain('onReceipt={(r) => setReceipt({ ...r, tab })}')
  })

  test('review WR-03: every action call is wrapped, so a thrown action re-enables the control and says so', () => {
    const FAILED = `"That didn't work. Nothing was changed — try again."`
    for (const [file, calls, finals] of [
      ['src/components/office/PeopleTab.tsx', ['inviteWorker(', 'updateMemberRoleSafe(', 'removeMember(', 'regenerateInviteCode('], ['setInviting(false)', 'setPendingRole(null)', 'setRemovePending(false)', 'setCodeBusy(false)']],
      ['src/components/focus/admin/ThisSopBlock.tsx', ['confirmSopCurrent('], ['setMarking(false)']],
      ['src/components/admin/governance/OwnerPicker.tsx', ['getOrgMembers(', 'setSopOwner('], ['setLoading(false)', 'setSaving(false)']],
    ] as const) {
      const src = strip(read(file))
      expect(src, file).toContain(FAILED)
      for (const c of calls) {
        const at = src.indexOf(`await ${c}`)
        expect(at, `${file} ${c}`).toBeGreaterThan(-1)
        expect(src.lastIndexOf('try {', at), `${file} ${c} inside try`).toBeGreaterThan(src.lastIndexOf('async function', at))
      }
      for (const f of finals) expect(src, `${file} ${f}`).toMatch(new RegExp(`finally \\{\\s*${f.replace(/[()]/g, '\\$&')}`))
    }
  })
})
