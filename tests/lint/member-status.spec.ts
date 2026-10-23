/**
 * Phase 64 / Plan 64-04 -- membership state guard (MEMB-06, MEMB-11, ADR-0024).
 *
 * "A row exists in the members table" no longer means "is a member": a suspended or departed
 * person keeps their row. This guard scans the comment-stripped src/ tree and fails when
 *   1. a call on the members table is followed in its chain by a delete call, or the removed
 *      Remove path (its helper file, or the two function names) comes back;
 *   2. a call on the members table neither mentions status in its chain (a status filter, or
 *      status in the select or update) nor sits in a function listed in ALLOW with a reason;
 *   3. the table name is quoted anywhere else (a table lookup held in a variable) outside ALLOW;
 *   4. an ALLOW entry no longer matches a site that needs it.
 * The chain scan follows one method chain; a query built across statements is not followed,
 * so such a read must carry its status test inside the chain (or be listed here).
 * Comments are stripped after CRLF normalisation; this comment describes the patterns in words.
 *
 * Registration: playwright.config.ts `lint` project. Verify:
 * `npx playwright test --list tests/lint/member-status.spec.ts`
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const TABLE = 'organisation_members'

/** file#function -> why every status is correct there (or no status read is needed). */
const ALLOW: Record<string, string> = {
  'src/actions/departments.ts#listDepartments': 'owner role labels keep everyone: a departed owner still gets a role word (D-09)',
  'src/actions/competency.ts#getTrainingRecordForPerson': 'records of former staff stay readable to a recorder (D-09)',
  'src/actions/auth.ts#joinWithInviteCode': 'inserts a new row, which defaults to active; it reads status before inserting',
  'src/actions/auth.ts#inviteWorker': 'inserts a new row, which defaults to active; it reads status before inserting',
  'src/actions/auth.ts#acceptInvite': 'inserts a new row, which defaults to active; it reads status before inserting',
  'src/actions/auth.ts#updateMemberRoleSafe': 'role-only update; its target read refuses a non-active member',
  'src/actions/grants.ts#verifySubjectInOrg': 'table name held in a lookup map; person subjects add the status filter in code',
  'src/lib/objectives/core.ts#resolveSubject': 'an objective about a departed person stays readable and clearable (D-09)',
}

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8').replace(/\r\n/g, '\n')
}

function stripComments(src: string): string {
  return src
    .split('\n')
    .map((l) => (/^\s*(\/\/|\/\*|\*\/|\*)/.test(l) ? '' : l))
    .join('\n')
}

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === '__tests__' || e.name === 'node_modules') continue
      walk(full, out)
    } else if (/\.tsx?$/.test(e.name) && !/\.(test|spec)\.tsx?$/.test(e.name)) out.push(full)
  }
  return out
}

/** Chain after index `i`: method names and the text up to the end of the last call. */
function chainFrom(src: string, i: number): { names: string[]; text: string } {
  const names: string[] = []
  const start = i
  let end = i
  for (;;) {
    while (i < src.length) {
      if (/\s/.test(src[i])) i++
      else if (src[i] === '/' && src[i + 1] === '/') while (i < src.length && src[i] !== '\n') i++
      else break
    }
    const m = /^\??\.\s*(\w+)\s*\(/.exec(src.slice(i, i + 80))
    if (!m) return { names, text: src.slice(start, end) }
    names.push(m[1])
    i += m[0].length
    let depth = 1
    let quote = ''
    while (i < src.length && depth > 0) {
      const c = src[i]
      if (quote) {
        if (c === '\\') i++
        else if (c === quote) quote = ''
      } else if (c === "'" || c === '"' || c === '`') quote = c
      else if (c === '(') depth++
      else if (c === ')') depth--
      i++
    }
    end = i
  }
}

const DECL = /(?:^|\n)[ \t]*(?:export\s+)?(?:async\s+)?function\s+(\w+)|(?:^|\n)(?:export\s+)?const\s+(\w+)\s*(?::[^=\n]+)?=\s*async\s*\(/g
function declarations(src: string): Array<{ name: string; index: number }> {
  const out: Array<{ name: string; index: number }> = []
  for (let m = DECL.exec(src); m; m = DECL.exec(src)) out.push({ name: m[1] ?? m[2], index: m.index })
  return out
}
function enclosing(decls: Array<{ name: string; index: number }>, idx: number): string | null {
  let name: string | null = null
  for (const d of decls) if (d.index <= idx) name = d.name
  return name
}

interface Site { key: string; names: string[]; text: string }

const srcFiles = walk(path.join(ROOT, 'src')).map((f) => {
  const rel = path.relative(ROOT, f).replace(/\\/g, '/')
  return { rel, text: stripComments(read(rel)) }
})

const FROM = new RegExp(`\\.from\\(\\s*['"]${TABLE}['"]\\s*\\)`, 'g')
// The table name in quotes anywhere that is not a from-call or a generated-type parameter.
const QUOTED = new RegExp(`['"]${TABLE}['"]`, 'g')

const fromSites: Site[] = []
const quotedSites: Site[] = []
for (const { rel, text } of srcFiles) {
  const decls = declarations(text)
  const keyAt = (i: number) => `${rel}#${enclosing(decls, i) ?? '(top level)'}`
  for (let m = FROM.exec(text); m; m = FROM.exec(text)) {
    const c = chainFrom(text, m.index + m[0].length)
    fromSites.push({ key: keyAt(m.index), names: c.names, text: c.text })
  }
  for (let m = QUOTED.exec(text); m; m = QUOTED.exec(text)) {
    const before = text.slice(Math.max(0, m.index - 12), m.index)
    if (/\.from\(\s*$/.test(before) || /<\s*$/.test(before)) continue
    quotedSites.push({ key: keyAt(m.index), names: [], text: m[0] })
  }
}

const aware = (s: Site) => /\bstatus\b/.test(s.text)

test.describe('member status guard', () => {
  test('is not vacuous', () => {
    expect(fromSites.length).toBeGreaterThanOrEqual(15)
    expect(fromSites.filter(aware).length).toBeGreaterThanOrEqual(10)
    expect(fromSites.some((s) => s.key.startsWith('src/lib/auth/sites.ts'))).toBe(true)
    for (const [k, why] of Object.entries(ALLOW)) {
      expect(why.trim().length, `${k} needs a reason`).toBeGreaterThan(10)
      expect(fs.existsSync(path.join(ROOT, k.split('#')[0])), k).toBe(true)
    }
  })

  test('no membership is ever deleted, and the Remove path stays gone', () => {
    const deletes = fromSites.filter((s) => s.names.includes('delete')).map((s) => s.key)
    expect(deletes, `A membership delete is back:\n${deletes.join('\n')}`).toEqual([])
    expect(fs.existsSync(path.join(ROOT, 'src/lib/members/remove.ts'))).toBe(false)
    const back = srcFiles.filter((f) => /\b(removeMember|deleteOrgMember)\b/.test(f.text)).map((f) => f.rel)
    expect(back, `Removed Remove path referenced:\n${back.join('\n')}`).toEqual([])
  })

  test('every read of the members table is status-aware or on the reasoned list', () => {
    const bad = fromSites.filter((s) => !aware(s) && !(s.key in ALLOW)).map((s) => s.key)
    expect(
      [...new Set(bad)],
      `Members read that ignores status (a suspended or departed person would count):\n${[...new Set(bad)].join('\n')}\nAdd a status filter, or list it in ALLOW with a reason.`,
    ).toEqual([])
  })

  test('the table name is not quoted anywhere else without a reason', () => {
    const bad = [...new Set(quotedSites.filter((s) => !(s.key in ALLOW)).map((s) => s.key))]
    expect(bad, `Table name used outside a from-call (lookup by variable?):\n${bad.join('\n')}`).toEqual([])
  })

  test('no stale allowance: every ALLOW entry still matches a site that needs it', () => {
    const needed = new Set([...fromSites.filter((s) => !aware(s)).map((s) => s.key), ...quotedSites.map((s) => s.key)])
    const stale = Object.keys(ALLOW).filter((k) => !needed.has(k))
    expect(stale, `ALLOW entries with no site that needs them:\n${stale.join('\n')}`).toEqual([])
  })
})
