/**
 * Phase 64 / Plan 64-03 -- source contract for the People UI (Suspend, Has left, Reinstate, the
 * Suspended tag, Former staff) and for the removal being gone.
 * Requirements MEMB-05, MEMB-06. Decisions D-02, D-03, D-04, D-05.
 *
 * Source-only, comment-stripped with CRLF normalised. Registration: playwright.config.ts `phase64`.
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

const TAB = src('src/components/office/PeopleTab.tsx')
const CHART = src('src/components/office/OrgChart.tsx')

test.describe('people states: source contract', () => {
  test('the People tab carries the state controls, the tag and the Former staff fold', () => {
    for (const id of [
      'people-state-dialog',
      'people-state-confirm',
      'people-state-cancel',
      'people-suspend',
      'people-left',
      'people-reinstate',
      'people-status-tag',
      'people-former',
      'people-former-row',
    ]) {
      expect(TAB, id).toContain(`data-testid="${id}"`)
    }
    expect(TAB).toContain('<details')
    expect(TAB).toContain('data-status={m.status}')
  })

  test('the three actions come from members.ts and every call is wrapped in try / finally', () => {
    expect(TAB).toMatch(/import \{[^}]*suspendMember[^}]*\} from '@\/actions\/members'/)
    expect(TAB).toMatch(/import \{[^}]*markMemberLeft[^}]*\} from '@\/actions\/members'/)
    expect(TAB).toMatch(/import \{[^}]*reinstateMember[^}]*\} from '@\/actions\/members'/)
    expect(TAB).toMatch(/finally \{\s*setStatePending\(false\)/)
    expect(TAB).toMatch(/finally \{\s*setReinstating\(null\)/)
  })

  test('the dialog says what each choice does, in plain words', () => {
    expect(TAB).toContain('`Suspend ${name}?`')
    expect(TAB).toContain('`Mark ${name} as left?`')
    expect(TAB).toContain(
      'They are signed out everywhere and cannot open anything on this site until you reinstate them. Their records stay under their name.',
    )
    expect(TAB).toContain(
      'They are signed out everywhere and move to Former staff. Their completions, sign-offs and records stay under their name. Anything they looked after shows in Sign-offs under Needs a new owner.',
    )
    expect(TAB).toContain('Keep them')
  })

  test('self and (for a non-admin) admins get no state buttons', () => {
    expect(TAB).toMatch(/!mine && \(isAdmin \|\| m\.role !== 'admin'\)/)
  })

  test('removal is gone from the People tab', () => {
    for (const w of ['removeMember', 'RemoveDialog', 'people-remove', 'Trash2']) expect(TAB, w).not.toContain(w)
  })

  test('the chart tags a suspended person and counts seats from the people present', () => {
    expect(CHART).toContain('people-status-tag')
    expect(CHART).not.toContain('filledCount')
  })

  test('no removal path survives in src', () => {
    expect(fs.existsSync(path.join(process.cwd(), 'src/lib/members/remove.ts'))).toBe(false)
    const hits: string[] = []
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name)
        if (e.isDirectory()) walk(full)
        else if (/\.(ts|tsx)$/.test(e.name) && /removeMember|deleteOrgMember/.test(src(path.relative(process.cwd(), full)))) hits.push(full)
      }
    }
    walk(path.join(process.cwd(), 'src'))
    expect(hits).toEqual([])
  })
})
