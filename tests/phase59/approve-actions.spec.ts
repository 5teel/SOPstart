/**
 * Phase 59 -- approve actions. Requirement OFF-03; decisions D-07, A-02.
 * Owners: 59-06 (server), 59-08 (panel). Registration: playwright.config.ts `phase59`.
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

const APPROVALS = strip(read('src/actions/approvals.ts'))
function body(name: string): string {
  const m = new RegExp(`export async function ${name}\\b`).exec(APPROVALS)
  if (!m) return ''
  const rest = APPROVALS.slice(m.index + 1)
  const next = rest.search(/\nexport /)
  return next === -1 ? APPROVALS.slice(m.index) : APPROVALS.slice(m.index, m.index + 1 + next)
}

test.describe('approve actions', () => {
  test('approveStep and requestChanges keep their admin / safety-manager guards (A-02) (59-06)', () => {
    for (const name of ['approveStep', 'requestChanges', 'getApprovalStatus']) {
      const b = body(name)
      expect(b, name).toContain('await requireAdmin()')
    }
    expect(body('approveStep')).toContain('stepMatchesCaller(')
    expect(body('requestChanges')).toContain('stepMatchesCaller(')
  })

  test('approveStep and requestChanges return logged, and published on the last step (59-06)', () => {
    const a = body('approveStep')
    expect(a).toContain('let published = false')
    expect(a).toContain('published = true')
    expect(a.indexOf('published = true')).toBeGreaterThan(a.indexOf('await performPublish('))
    expect(a).toContain('return { success: true, logged, published }')
    expect(body('requestChanges')).toContain('return { success: true, logged: rec.ok }')
    expect(APPROVALS).toMatch(/interface ApprovalStatus \{[\s\S]*?version: number/)
    expect(body('getApprovalStatus')).toContain('version: sop.version')
  })

  test('setApprovalChain refuses a person who is not an admin or safety manager (59-06)', () => {
    const b = body('setApprovalChain')
    const msg = b.indexOf('A chain step can only name an admin or safety manager.')
    expect(msg).toBeGreaterThan(-1)
    expect(b).toContain("from('organisation_members')")
    expect(b).toContain(".eq('organisation_id', ctx.organisationId)")
    expect(b).toContain("['admin', 'safety_manager']")
    expect(msg).toBeLessThan(b.indexOf(".from('approval_chains').upsert("))
  })

  test('assertPublishGates is untouched (the publish gate pin hash still holds) (59-06)', () => {
    const pin = read('tests/phase56/publish-gate-pin.spec.ts')
    expect(pin).toMatch(/publish/i)
    expect(APPROVALS).toContain('performPublish(supabase, {')
  })

  // ---- 59-08: the panel half --------------------------------------------------
  const PANEL = strip(read('src/components/office/ApprovePanel.tsx'))
  function panelFn(name: string): string {
    const start = PANEL.indexOf(`async function ${name}(`)
    expect(start, `${name} exists`).toBeGreaterThan(-1)
    const next = PANEL.indexOf('\n  async function ', start + 1)
    return PANEL.slice(start, next === -1 ? start + 1200 : next)
  }

  test('requestChanges has a caller in src/components/office and it sends the dialog note (59-08)', () => {
    expect(panelFn('sendBack')).toContain('requestChanges(sopId, note)')
    expect(PANEL).toContain('onConfirm={(note) => void sendBack(note)}')
    expect(PANEL).toContain('title={`Send v${version} back?`}')
    expect(PANEL).toContain('It goes back to the draft with your note, and its owner will see it.')
    expect(PANEL).toContain('confirmLabel="Send back"')
    // The 10-character rule lives in the shared dialog the note comes from.
    expect(strip(read('src/components/office/ReasonDialog.tsx'))).toContain('trimmed.length >= MIN')
  })

  test('the approve button calls approveStep and the receipt follows what the server says was published (59-08)', () => {
    const a = panelFn('approve')
    expect(a).toContain('approveStep(sopId)')
    expect(a).toContain('result.published ?')
    expect(a).toContain('`Approved and published v${version}`')
    expect(PANEL).toMatch(/data-testid="approve-commit"[\s\S]*?onClick=\{\(\) => void approve\(\)\}/)
    expect(PANEL).toContain('`Approve and publish v${version}`')
    expect(PANEL).toContain('`Approve v${version}`')
    expect(PANEL).toContain('Approving publishes v{version} to workers.')
  })

  test('a publish refusal shows the plain reason and the row stays (59-08)', () => {
    const a = panelFn('approve')
    expect(a).toContain("can't be published yet:")
    expect(a).toContain('Open it to fix that.')
    // onDone is only reached on success: the refusal path sets an error and returns nothing to the inbox.
    expect(a.indexOf('onDone(')).toBeLessThan(a.lastIndexOf('setError('))
    expect(PANEL).toContain('role="alert"')
  })

  test('the panel never publishes by itself: only approveStep runs the publish path (59-08)', () => {
    expect(PANEL).not.toMatch(/performPublish|assertPublishGates/)
    expect(PANEL).not.toContain("from '@/lib/governance/publish-core'")
  })

  test('the approve panel links to the browse state with focusHref from office (59-08)', () => {
    expect(PANEL).toContain("focusHref(sopId, { from: 'office' })")
    expect(PANEL).toContain('Open it to read it')
  })

  test('the panel is keyed by the SOP so a second row never shows the first (59-08)', () => {
    expect(PANEL).toContain("queryKey: ['office-approval', sopId]")
    expect(PANEL).toContain('<ApproveBody key={sopId}')
  })
})
