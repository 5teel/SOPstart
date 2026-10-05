/**
 * Phase 59 -- Office pane structure. Requirement OFF-01; decisions D-01, D-04, D-05, A-11.
 * Owners: 59-09 (pane, inbox row, inbox tab), 59-12 (mount seams) -- all live.
 * Registration: playwright.config.ts `phase59`.
 * Source contract, but every case pins WIRING (a handler calls the action, a branch renders
 * the panel), not that a string appears (CLAUDE.md 2026-06-05).
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf-8').replace(/\r\n/g, '\n')
// Whole-line comments out, so a comment can never satisfy or trip an assertion.
const strip = (src: string) =>
  src
    .split('\n')
    .map((l) => (/^\s*(\/\/|\/\*|\*\/|\*)/.test(l) ? '' : l))
    .join('\n')

const ROW = strip(read('src/components/office/InboxRow.tsx'))

test.describe('inbox row (59-09)', () => {
  test('every branch renders exactly one button element', () => {
    // One `button =` assignment per branch of the if / else chain, each carrying the one test id.
    const chain = ROW.slice(ROW.indexOf('let button'), ROW.indexOf('return (\n    <li'))
    const assignments = chain.match(/button = /g) ?? []
    expect(assignments.length).toBeGreaterThanOrEqual(6)
    // A branch yields a <button>, a <Link> or the picker trigger -- never two of them.
    const testIds = chain.match(/data-testid="office-row-action"|triggerTestId="office-row-action"/g) ?? []
    expect(testIds.length).toBe(assignments.length - 1) // the last branch is the "no button" null
    expect(chain).toContain('button = null')
    // The row element itself never holds a second action outside `{button}`.
    expect(ROW.match(/\{button\}/g)?.length).toBe(1)
  })

  test('the approve-me, unowned, stale-role, confirm precedence is kept (APR-03/04)', () => {
    const fnBody = ROW.slice(ROW.indexOf('function branchOf'), ROW.indexOf('const CHIP_WORD'))
    const approve = fnBody.indexOf("g.flags.includes('awaiting_approval') && g.isCallerNextApprover")
    const owner = fnBody.indexOf("g.flags.includes('unowned')")
    const stale = fnBody.indexOf("g.flags.includes('stale_role')")
    const confirm = fnBody.indexOf("return 'confirm'")
    expect(approve).toBeGreaterThan(-1)
    expect(approve).toBeLessThan(owner)
    expect(owner).toBeLessThan(stale)
    expect(stale).toBeLessThan(confirm)
    expect(ROW).toContain('isCallerNextApprover')
  })

  test('Mark reviewed is wired for governance rows and for the owner\'s own review rows', () => {
    expect(ROW).toContain('confirmSopCurrent(sopId)')
    expect(ROW).toMatch(/branch === 'confirm' && g\) \|\| \(branch === 'review' && item\.review\)/)
    expect(ROW).toMatch(/onClick=\{\(\) => void markReviewed\(id\)\}/)
    expect(ROW).toContain("receipt: 'Marked reviewed'")
  })

  test('Try again, Sign off, Approve and Assign owner each reach their action', () => {
    expect(ROW).toMatch(/onClick=\{\(\) => void tryAgain\(retry\)\}/)
    expect(ROW).toContain('requeueParse(retry.sopId, retry.isVideo)')
    expect(ROW).toMatch(/<SignOffPanel completionId=\{item\.signOff\.completionId\} onDone=\{onDone\} \/>/)
    expect(ROW).toMatch(/<ApprovePanel sopId=\{g\.id\} title=\{item\.title\} onDone=\{onDone\} \/>/)
    expect(ROW).toMatch(/<OwnerPicker[\s\S]*?onDone=\{\(r\) => onDone\(\{ receipt: 'Owner set', logged: r\.logged \}\)\}/)
    expect(ROW).toContain("focusHref(g.id, { mode: 'edit', from: 'office' })")
    expect(ROW).toContain('Open SOP')
    // Expansion is the only thing the Sign off / Approve opener does.
    expect(ROW).toMatch(/aria-expanded=\{expanded\}[\s\S]*?aria-controls=\{panelId\}[\s\S]*?onClick=\{onToggle\}/)
  })

  test('Esc collapses the row only when no modal layer is open, and never navigates', () => {
    expect(ROW).toContain("document.addEventListener('keydown', onKey, true)")
    expect(ROW).toContain("document.querySelector('[aria-modal=\"true\"]')")
    expect(ROW).toContain('e.defaultPrevented')
    expect(ROW).toContain('e.preventDefault()')
    expect(ROW).not.toMatch(/router\.|next\/navigation/)
  })

  test('a failure shows the server words under the row as an alert and a pending row dims', () => {
    expect(ROW).toMatch(/role="alert"/)
    expect(ROW).toContain("opacity-60")
    expect(ROW).toContain('Loader2')
  })
})

const PANE = strip(read('src/components/office/OfficePane.tsx'))
const TAB = strip(read('src/components/office/InboxTab.tsx'))

test.describe('office pane and inbox tab (59-09)', () => {
  test('the pane has a header, a tab bar, a receipt slot, chips and the empty-state sentence', () => {
    expect(PANE).toContain('role="tablist"')
    expect(PANE).toContain('data-testid="office-receipt"')
    expect(PANE).toContain('data-testid="office-pane"')
    expect(PANE).toContain('<InboxChips')
    expect(TAB).toContain("Nothing needs you. That&apos;s the goal.")
    expect(TAB).toContain('data-testid="office-empty"')
    expect(TAB).toContain('Nothing under this filter.')
    expect(TAB).toContain('Show all')
  })

  test('a tab click goes through the shell select(), never the address bar or the router', () => {
    expect(PANE).toMatch(/onClick=\{\(\) => select\(\{ kind: 'room', id: 'office', \.\.\.\(t === 'inbox' \? \{\} : \{ tab: t \}\) \}\)\}/)
    expect(PANE).not.toMatch(/replaceState|pushState|router\.|next\/navigation/)
    expect(PANE).toContain('tabsForRole(role)')
    // Manual activation: the arrow keys move focus and never select.
    expect(PANE).toMatch(/ArrowRight[\s\S]*?tabRefs\.current\[next\]\?\.focus\(\)/)
    expect(PANE).toContain('tabIndex={i === rove ? 0 : -1}')
  })

  test('a cleared row refetches the inbox and writes the shell cache; the shell query is never invalidated', () => {
    expect(TAB).toContain('invalidateQueries({ queryKey: OFFICE_INBOX_KEY })')
    expect(TAB).toContain('setQueryData<AdminShellData | { error: string }>(SHELL_KEY')
    expect(TAB).toContain('inboxCount: officePinCount(freshItems, fresh.requests), inboxChips: inboxCounts(freshItems)')
    expect(TAB).not.toMatch(/invalidateQueries\(\{ queryKey: SHELL_KEY/)
    expect(TAB).not.toMatch(/refetchQueries/)
    expect(TAB).toContain('getOfficeInbox(')
    // The patch happens after the refetch, for admins only (a supervisor's shell has no admin cache).
    const done = TAB.slice(TAB.indexOf('async function handleDone'))
    expect(done.indexOf('await queryClient.invalidateQueries')).toBeLessThan(done.indexOf('setQueryData'))
    expect(done).toContain("fresh.role !== 'supervisor'")
  })

  test('the ledger suffix is said only when the action says it was logged', () => {
    expect(PANE).toMatch(/r\.logged === true\) return \{ text: `\$\{r\.receipt\} · logged in the decision ledger`/)
    expect(PANE).toMatch(/r\.logged === false/)
    expect(PANE).toContain("didn't reach the decision ledger")
    // The suffix literal appears exactly once, inside the logged === true branch.
    expect(PANE.match(/logged in the decision ledger/g)?.length).toBe(1)
  })

  test('chips are hidden for a supervisor', () => {
    expect(TAB).toContain("data.role === 'supervisor'")
    const chips = TAB.slice(TAB.indexOf('export function InboxChips'), TAB.indexOf('type Ghost'))
    expect(chips).toContain('return null')
  })

  test('no effect selects a place or calls a router, and no pane file imports the router', () => {
    for (const [name, src] of [['OfficePane', PANE], ['InboxTab', TAB], ['InboxRow', ROW]] as const) {
      const effects = src.match(/useEffect\(\(\) => \{[\s\S]*?\n {2}\}(?:, \[[^\]]*\])?\)/g) ?? []
      for (const body of effects) {
        expect(body, `${name} effect`).not.toMatch(/select\(|router\.|redirect\(|location\./)
      }
      expect(src, name).not.toMatch(/next\/navigation|router\.refresh/)
    }
  })

  test('the pane is a module nothing imports statically (both shells mount it lazily)', () => {
    const importers: string[] = []
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name)
        if (e.isDirectory()) walk(p)
        else if (/\.(ts|tsx)$/.test(e.name) && /^import[^\n]*OfficePane/m.test(fs.readFileSync(p, 'utf-8'))) importers.push(p)
      }
    }
    walk(path.join(process.cwd(), 'src'))
    expect(importers).toEqual([])
  })

  test('the inbox query is the key the supervisor pin will read, and the rows live in the pane\'s own module', () => {
    expect(TAB).toContain('queryKey: OFFICE_INBOX_KEY')
    expect(TAB).toMatch(/<InboxRow[\s\S]*?onDone=\{\(r\) => void handleDone\(item, r\)\}/)
    expect(PANE).toContain('<InboxTab')
  })
})

test.describe('office pane mount seams (59-12)', () => {
  const ADMIN = strip(read('src/components/shell/AdminShell.tsx'))
  const WORKER = strip(read('src/components/shell/WorkerShell.tsx'))
  const DYNAMIC = /const OfficePane = dynamic\(\(\) => import\('@\/components\/office\/OfficePane'\)\.then\(\(m\) => m\.OfficePane\), \{\s*ssr: false/

  test('the pane is one lazy module imported by next/dynamic from both shells', () => {
    expect(ADMIN).toMatch(DYNAMIC)
    expect(WORKER).toMatch(DYNAMIC)
    expect(ADMIN).toContain('<OfficePane place={place} select={ctx.select} initialSop={initialSop} />')
    expect(WORKER).toMatch(/isSupervisor \? \(\s*<OfficePane place=\{place\} select=\{ctx\.select\} initialSop=\{initialSop\} \/>\s*\) : \(\s*<OfficeWorkerBody \/>/)
  })

  test('the old Office card body and the pending-count hook are gone', () => {
    const rooms = read('src/components/shell/AdminRoomBodies.tsx')
    expect(rooms).not.toContain('AdminOfficeBody')
    expect(rooms).not.toContain('CHIP_WORDS')
    expect(read('src/hooks/useCompletions.ts')).not.toContain('usePendingSignOffCount')
    expect(ADMIN).not.toContain('usePendingSignOffCount')
    expect(WORKER).not.toContain('usePendingSignOffCount')
  })

  test('worker and supervisor shell files carry no static pane or admin import', () => {
    for (const src of [ADMIN, WORKER]) expect(src).not.toMatch(/^import[^\n]*components\/office\//m)
    expect(WORKER).not.toMatch(/components\/admin/)
  })

  test('the bundle script has a forbidden marker for the pane and its literals live in the pane module', () => {
    const script = read('scripts/check-bundle-size.ts')
    expect(script).toContain("label: 'office pane (lazy, 59 A-11)'")
    for (const marker of ['Nothing needs you', 'Nothing here can be edited or deleted']) {
      expect(script).toContain(marker)
      const sources = ['InboxTab.tsx', 'DecisionsTab.tsx'].map((f) => read('src/components/office/' + f)).join('\n')
      expect(sources.replace(/&apos;/g, "'")).toContain(marker)
    }
    // Neither literal may appear in either shell or the worker room bodies.
    for (const src of [ADMIN, WORKER, strip(read('src/components/shell/RoomBodies.tsx'))]) {
      expect(src).not.toContain('Nothing needs you')
    }
    expect(read('tests/lint/no-static-admin-lens-import.spec.ts')).toContain('OfficePane: []')
  })

  test('the supervisor pin and card read the same inbox query the pane does', () => {
    expect(WORKER).toContain('queryKey: OFFICE_INBOX_KEY')
    expect(WORKER).toContain('count={pending}')
    expect(WORKER).toMatch(/office: pending,/)
    expect(strip(read('src/components/office/InboxTab.tsx'))).toContain('queryKey: OFFICE_INBOX_KEY')
  })
})
