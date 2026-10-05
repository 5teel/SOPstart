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
  test.fixme('the Requests tab shows for supervisor, admin and safety manager (tabsForRole)', () => {})
  test.fixme('RequestRow shows the asker, kind and note, and Accept and Decline', () => {})
  test.fixme('the Decisions tab shows an about-line for request rows', () => {})
  test.fixme('agent requests show with the agent chip', () => {})
})
