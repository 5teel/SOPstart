/**
 * Phase 56 / Plan 56-01 -- DEC-01 decision-writer sweep (data-keyed).
 *
 * Reads scripts/decision-writers.json and DISCOVERS every write site from the
 * comment-stripped src/ tree, rather than trusting a list someone remembered
 * (CLAUDE.md 2026-07-29). A write site is either
 *   (a) a call on one of the listed decision tables followed, in the same
 *       method chain, by an insert, update, upsert or delete call, or
 *   (b) a line holding one of the listed column tokens, in a function whose
 *       body also WRITES that column's table (a read that maps the column
 *       into an object is not a write).
 * Each site is keyed file#function. The discovered set must equal the union of
 * the JSON hook entries and reasoned allow entries: a site missing from the
 * JSON is a new unlogged decision writer; a JSON entry with no site is stale.
 *
 * Wiring checks (per writer, fixme until the owning plan adds the writer's
 * file#function to LIVE_WRITERS) assert the recordDecision call comes AFTER the
 * write and that the file imports it from the ledger module (CLAUDE.md
 * 2026-06-05: wiring, not token presence).
 *
 * Known ceilings: a chain split across a variable, or a table name held in a
 * variable, is not discovered. Guards read comment-stripped source and this
 * comment describes patterns in words only (CLAUDE.md 2026-09-28).
 *
 * Registration: playwright.config.ts `phase56` project.
 * Verify: `npx playwright test --list --project=phase56`
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()

// Each wiring plan (56-05, 56-08) appends the file#function keys it hooks.
const LIVE_WRITERS: string[] = [
  'src/actions/approvals.ts#approveStep',
  'src/actions/approvals.ts#requestChanges',
  'src/lib/governance/publish-core.ts#performPublish',
  'src/actions/governance.ts#setSopOwner',
  'src/actions/governance.ts#confirmSopCurrent',
  'src/actions/governance.ts#setReviewCadence',
  'src/actions/completions.ts#signOffCompletion',
  'src/actions/completions.ts#recordSignature',
  'src/actions/assignments.ts#assignSopToRole',
  'src/actions/assignments.ts#assignSopToUser',
  'src/actions/assignments.ts#removeAssignment',
  'src/actions/observations.ts#recordObservation',
  'src/actions/focus-steps.ts#tickFocusStep',
  'src/actions/focus-steps.ts#untickFocusStep',
  'src/actions/findings.ts#clearFinding',
  'src/actions/ai-fields.ts#acceptProposal',
  'src/actions/ai-fields.ts#rejectProposal',
  'src/actions/ai-fields.ts#applyAiWrite',
  'src/actions/auth.ts#inviteWorker',
  'src/actions/auth.ts#updateMemberRoleSafe',
  'src/actions/auth.ts#removeMember',
  'src/actions/requests.ts#answerRequest',
]
// performPublish is hooked outside the gate body (56-05).
const PUBLISH_GUARD_LIVE = true

interface Entry { file: string; function: string; key: string; kind: string; plan: number; status: 'hook' }
interface ExtraHook { file: string; function: string; anchor: string; kind: string; plan: number }
interface DelegatedHook { file: string; function: string; calls: string; after: string; kind: string; note: string }
interface Allow { file: string; function: string; key: string; reason: string }
interface Writers {
  version: number
  tables: string[]
  columnKeys: Array<{ table: string; token: string }>
  entries: Entry[]
  extraHooks: ExtraHook[]
  delegatedHooks: DelegatedHook[]
  allow: Allow[]
}

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8').replace(/\r\n/g, '\n')
}

// Blanks full-line comments (line, block-start, block-end, JSDoc continuation).
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

const W = JSON.parse(read('scripts/decision-writers.json')) as Writers
const WRITE_METHODS = new Set(['insert', 'update', 'upsert', 'delete'])

/** Method names chained after index `i` (skips balanced call arguments, whitespace, trailing // comments). */
function chainMethods(src: string, i: number): string[] {
  const names: string[] = []
  for (;;) {
    while (i < src.length) {
      if (/\s/.test(src[i])) i++
      else if (src[i] === '/' && src[i + 1] === '/') while (i < src.length && src[i] !== '\n') i++
      else break
    }
    const m = /^\??\.\s*(\w+)\s*\(/.exec(src.slice(i, i + 80))
    if (!m) return names
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
  }
}

/** Indexes of `.from('<table>')` whose chain ends in a write. */
function tableWriteIndexes(src: string, table: string): number[] {
  const re = new RegExp(`\\.from\\(\\s*['"]${table}['"]\\s*\\)`, 'g')
  const out: number[] = []
  for (let m = re.exec(src); m; m = re.exec(src)) {
    if (chainMethods(src, m.index + m[0].length).some((n) => WRITE_METHODS.has(n))) out.push(m.index)
  }
  return out
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

/** Declaration to the next top-level export / function, or end of file. */
function functionBody(src: string, name: string): string {
  const m = new RegExp(`(?:export\\s+)?(?:async\\s+)?function\\s+${name}\\b|const\\s+${name}\\b`).exec(src)
  if (!m) return ''
  const rest = src.slice(m.index + 1)
  const next = rest.search(/\n(?:export |async function |function )/)
  return next === -1 ? src.slice(m.index) : src.slice(m.index, m.index + 1 + next)
}

const srcFiles = walk(path.join(ROOT, 'src')).map((f) => ({ rel: path.relative(ROOT, f).replace(/\\/g, '/'), text: stripComments(read(path.relative(ROOT, f))) }))
const fileText = (rel: string) => srcFiles.find((f) => f.rel === rel)?.text ?? ''

function discover(): Map<string, string[]> {
  const found = new Map<string, string[]>()
  const add = (rel: string, fn: string | null, why: string) => {
    const key = `${rel}#${fn ?? '(top level)'}`
    found.set(key, [...(found.get(key) ?? []), why])
  }
  for (const { rel, text } of srcFiles) {
    const decls = declarations(text)
    for (const t of W.tables) for (const i of tableWriteIndexes(text, t)) add(rel, enclosing(decls, i), t)
    for (const ck of W.columnKeys) {
      let from = 0
      for (let i = text.indexOf(ck.token, from); i !== -1; i = text.indexOf(ck.token, from)) {
        from = i + ck.token.length
        const fn = enclosing(decls, i)
        if (fn && tableWriteIndexes(functionBody(text, fn), ck.table).length > 0) add(rel, fn, ck.token)
      }
    }
  }
  return found
}

const discovered = discover()
const listed = new Set([
  ...W.entries.map((e) => `${e.file}#${e.function}`),
  ...W.allow.map((a) => `${a.file}#${a.function}`),
])

test.describe('discovery (LIVE)', () => {
  test('every discovered decision write site is listed, and every listed one exists', () => {
    const unlisted = [...discovered.keys()].filter((k) => !listed.has(k))
    expect(unlisted, `New decision writer not listed in scripts/decision-writers.json:\n${unlisted.join('\n')}`).toEqual([])
    const stale = [...listed].filter((k) => !discovered.has(k))
    expect(stale, `Stale entry, no write site found:\n${stale.join('\n')}`).toEqual([])
  })

  test('is not vacuous', () => {
    expect(W.version).toBe(1)
    expect(discovered.size).toBeGreaterThanOrEqual(18)
    for (const e of [...W.entries, ...W.extraHooks, ...W.allow]) {
      expect(fs.existsSync(path.join(ROOT, e.file)), e.file).toBe(true)
    }
    for (const a of W.allow) expect(a.reason.trim().length, `${a.file}#${a.function} needs a reason`).toBeGreaterThan(10)
    for (const x of W.extraHooks) {
      expect(functionBody(fileText(x.file), x.function), `${x.file}#${x.function}`).toContain(x.anchor)
    }
  })
})

test.describe('recordDecision wiring', () => {
  for (const e of W.entries) {
    const key = `${e.file}#${e.function}`
    test(`${key} records a decision after its write`, () => {
      test.fixme(!LIVE_WRITERS.includes(key), `flips live in 56-0${e.plan}`)
      const text = fileText(e.file)
      expect(text).toMatch(/import\s*\{[^}]*\brecordDecision\b[^}]*\}\s*from\s*'@\/lib\/decisions\/record'/)
      const body = functionBody(text, e.function)
      const writes = W.tables.includes(e.key)
        ? tableWriteIndexes(body, e.key)
        : [body.indexOf(e.key)].filter((i) => i >= 0)
      expect(writes.length, `no write anchor for ${key}`).toBeGreaterThan(0)
      const call = body.lastIndexOf('await recordDecision(')
      expect(call, `${key} never awaits recordDecision`).toBeGreaterThan(-1)
      expect(call).toBeGreaterThan(Math.max(...writes))
    })
  }

  for (const x of W.extraHooks) {
    const key = `${x.file}#${x.function}`
    test(`${key} records the agent write`, () => {
      test.fixme(!LIVE_WRITERS.includes(key), `flips live in 56-0${x.plan}`)
      const text = fileText(x.file)
      expect(text).toMatch(/import\s*\{[^}]*\brecordDecision\b[^}]*\}\s*from\s*'@\/lib\/decisions\/record'/)
      const body = functionBody(text, x.function)
      expect(body.lastIndexOf('await recordDecision(')).toBeGreaterThan(body.indexOf(x.anchor))
    })
  }
})

// A writer whose ledger row is written by a registered callee (Phase 58, Send for sign-off).
test.describe('delegated hooks', () => {
  test('is not vacuous', () => expect(W.delegatedHooks.length).toBeGreaterThan(0))
  for (const d of W.delegatedHooks) {
    test(`${d.file}#${d.function} awaits ${d.calls} after ${d.after}`, () => {
      const body = functionBody(fileText(d.file), d.function)
      const anchor = body.indexOf(d.after)
      expect(anchor, `${d.after} not found`).toBeGreaterThan(-1)
      expect(body.indexOf(`await ${d.calls}`), `await ${d.calls} must come after ${d.after}`).toBeGreaterThan(anchor)
      const callee = d.calls.replace('(', '')
      expect(W.entries.map((e) => `${e.file}#${e.function}`), `${callee} must itself be a registered writer`).toContain(
        `${d.file}#${callee}`
      )
    })
  }
})

test.describe('every hook is live', () => {
  test('LIVE_WRITERS covers every entry and extra hook (nothing left fixme)', () => {
    const all = [...W.entries, ...W.extraHooks].map((e) => `${e.file}#${e.function}`)
    expect(all.filter((k) => !LIVE_WRITERS.includes(k))).toEqual([])
  })

  test('applyAiWrite names the agent on its decision', () => {
    const body = functionBody(fileText('src/actions/ai-fields.ts'), 'applyAiWrite')
    expect(body).toMatch(/await recordDecision\(\{[\s\S]*?agent:/)
    expect(body).toContain("outcome === 'applied'")
  })

  test('the AI write request validates agentName against AGENT_NAMES', () => {
    const v = fileText('src/lib/validators/ai-fields.ts')
    expect(v).toContain('AGENT_NAMES')
    expect(v).toMatch(/agentName:\s*z\.enum\(AGENT_NAMES\)\.optional\(\)/)
  })

  // 58-15: the per-block verify actions are replaced by the per-step tick; same rule --
  // the caller names only the step, never an organisation, user or agent.
  test('tickFocusStep / untickFocusStep take only stepId (SOP and org are resolved server-side)', () => {
    const t = fileText('src/actions/focus-steps.ts')
    expect(t).toContain('export async function tickFocusStep(input: { stepId: string })')
    expect(t).toContain('export async function untickFocusStep(input: { stepId: string })')
  })

  test('clearFinding takes only a finding id (58-16: the block verify pair is gone)', () => {
    const f = fileText('src/actions/findings.ts')
    expect(f).toContain('export async function clearFinding(input: { findingId: string })')
    expect(fileText('src/actions/focus-steps.ts')).not.toMatch(/organisationId\s*:\s*z\./)
  })
})

test.describe('publish gate stays clean', () => {
  test('assertPublishGates body contains no recordDecision', () => {
    test.fixme(!PUBLISH_GUARD_LIVE, 'flips live in 56-05')
    const src = read('src/lib/governance/publish-core.ts')
    const start = src.indexOf('export async function assertPublishGates(')
    const end = src.indexOf('\nexport ', start + 1)
    expect(src.slice(start, end)).not.toContain('recordDecision')
  })
})
