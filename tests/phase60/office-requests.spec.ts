/**
 * Phase 60 -- Office Requests. Requirements: RQS-02, RQS-04. Decisions: D-03, D-05.
 * 60-05 owns the data and the pin (source-contract on wiring); 60-11 owns the tab cases (still fixme).
 * Registration: playwright.config.ts `phase60` project.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'

const read = (rel: string) => fs.readFileSync(rel, 'utf-8').replace(/\r\n/g, '\n')

test.describe('Office Requests data and pin (60-05)', () => {
  test('listOpenRequests reads under the session client and feeds loadInbox', () => {
    const src = read('src/lib/governance/load-inbox.ts')
    expect(src).toContain('export async function listOpenRequests()')
    expect(src).toMatch(/\.eq\('state', 'open'\)/)
    expect(src).toContain('RAISABLE_KINDS')
    expect(src).toContain('listOpenRequests(),')
    expect(src).toMatch(/items, requests \}/)
    expect(src).not.toContain('createAdminClient')
  })

  test('getOfficeInbox returns requests for admin, safety manager and supervisor; never the service role', () => {
    const src = read('src/actions/office.ts')
    expect(src).toContain('requests: inbox.requests')
    expect(src).toMatch(/listOpenRequests\(\),/)
    expect(src).toMatch(/items: deriveInbox\(\{ governance: \[\], library: \[\], signOffs, ownedReviews \}\),\s*requests,/)
    expect(src).toContain("'Office access required'")
    expect(src).not.toContain('createAdminClient')
  })

  test('the Office pin is officePinCount(items, requests) in getAdminShell, WorkerShell and InboxTab', () => {
    expect(read('src/actions/shell.ts')).toContain('inboxCount: officePinCount(inbox.items, inbox.requests)')
    expect(read('src/components/shell/WorkerShell.tsx')).toContain('officePinCount(inbox.items, inbox.requests)')
    const tab = read('src/components/office/InboxTab.tsx')
    expect(tab).toContain('officePinCount(freshItems, fresh.requests)')
    expect(tab).toMatch(/setQueryData<AdminShellData/)
    expect(read('src/actions/shell.ts')).not.toContain('createAdminClient')
  })

  test('nothing in the Office invalidates the shell cache (patched, never refetched)', () => {
    for (const f of fs.readdirSync('src/components/office')) {
      if (!/\.tsx?$/.test(f)) continue
      expect(read(`src/components/office/${f}`)).not.toMatch(/invalidateQueries\(\{ queryKey: SHELL_KEY/)
    }
  })
})

test.describe('Office Requests tab (60-11)', () => {
  test('the Requests tab is second, for supervisor, admin and safety manager, and nobody else (tabsForRole)', () => {
    const src = read('src/lib/shell/office-tabs.ts')
    expect(src).toContain("['inbox', 'requests', 'decisions', 'people', 'access']")
    expect(src).toContain("return ['inbox', 'requests']")
    expect(src).toContain("WIDE_TABS: ReadonlyArray<OfficeTab> = ['decisions', 'people', 'access']")
  })

  test('RequestRow shows the asker, kind and note, and Accept and Decline wired to answerRequest', () => {
    const src = read('src/components/office/RequestRow.tsx')
    for (const id of ['request-row', 'request-accept', 'request-decline']) expect(src).toContain(`data-testid="${id}"`)
    expect(src).toContain("from '@/actions/requests'")
    expect(src).toContain('answerRequest({ requestId: request.id, answer: which')
    expect(src).toContain('REQUEST_KIND_WORDS[request.kind]')
    expect(src).toContain('{request.note &&')
    // Accept has no dialog; Decline opens the reason dialog and carries the reason as the note.
    expect(src).toContain("onClick={() => void answer('accept')}")
    expect(src).toContain('onClick={() => setDeclining(true)}')
    expect(src).toContain('<ReasonDialog')
    expect(src).toContain("onConfirm={(reason) => void answer('decline', reason)}")
    expect(src).toContain('confirmTone="ink"')
    expect(src).toContain('cancelLabel="Keep it open"')
    expect(src).toContain('Decline this request?')
  })

  test('agent requests show the agent chip and a grey dot', () => {
    const src = read('src/components/office/RequestRow.tsx')
    expect(src).toContain('border border-ai/40 bg-ai/10 text-ai')
    expect(src).toContain("request.agent ? 'bg-ink-300' : 'bg-accent-measure'")
    expect(src).toContain('data-agent=')
  })

  test('a supervisor\'s change-a-SOP link is the browse address, never the editor (F-23)', () => {
    const src = read('src/components/office/RequestRow.tsx')
    expect(src).toMatch(/canEdit\s*\?\s*\{ href: focusHref\(sopId, \{ mode: 'edit', from: 'office' \}\)[^}]*\}\s*:\s*\{ href: focusHref\(sopId, \{ from: 'office' \}\)/)
    expect(src).toContain("role === 'admin' || role === 'safety_manager'")
    // The wizard link is for admin and safety manager only, and only when the ledger write succeeded.
    expect(src).toContain("request.kind === 'new_sop' && canEdit")
    expect(src).toContain('if (logged) {')
  })

  test('a receipt with a link holds; the pane shows the link; no router, no address writes', () => {
    const pane = read('src/components/office/OfficePane.tsx')
    expect(pane).toContain('if (!receipt || receipt.hold) return')
    expect(pane).toContain('data-testid="office-receipt-link"')
    expect(pane).toContain('{r.after ?')
    for (const f of ['RequestRow', 'RequestsTab']) {
      const src = read(`src/components/office/${f}.tsx`)
      expect(src).not.toMatch(/useRouter|router\.(push|replace)|history\.replaceState/)
    }
  })

  test('the tab patches the shell pin with officePinCount and never invalidates the shell cache', () => {
    const src = read('src/components/office/RequestsTab.tsx')
    expect(src).toContain('officePinCount(fresh.items, fresh.requests)')
    expect(src).toMatch(/setQueryData<AdminShellData/)
    expect(src).toContain('No requests waiting.')
    expect(src).toContain('data-testid="requests-empty"')
    expect(src).not.toMatch(/invalidateQueries\(\{ queryKey: SHELL_KEY/)
  })

  test('the Requests tab is imported only by the Office pane (lazy admin chunk), with its bundle marker', () => {
    expect(read('src/components/office/OfficePane.tsx')).toContain("from './RequestsTab'")
    expect(read('scripts/check-bundle-size.ts')).toContain("'No requests waiting.'")
  })

  test('the Decisions tab reads a request decision as "<asker>\'s request about <SOP or machine>"', () => {
    const src = read('src/actions/office.ts')
    expect(src).toContain("'request'")
    expect(src).toContain("request about")
  })
})
