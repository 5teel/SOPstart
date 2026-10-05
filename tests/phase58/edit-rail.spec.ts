/**
 * Phase 58 -- FOC-02 (D-06, D-08, D-14, D-24, D-25, D-28): the edit frame's rail,
 * its "This SOP" block, the bottom bar and the publish dialog.
 * Filled by: 58-12 (editor core), 58-13 (editor wiring).
 * Registration: playwright.config.ts `phase58` project.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n')
const ADMIN = 'src/components/focus/admin'

test.describe('FOC-02 edit rail', () => {
  const block = read(`${ADMIN}/ThisSopBlock.tsx`)

  test('This SOP has rows for version, machine, objective, standards, jump-ahead switch (D-08), Assign, Delete draft, Category and Open original document (D-24), each wired to its action', () => {
    expect(block).toContain('setSopObjective(')
    expect(block).toContain('setAllowForwardJump(')
    expect(block).toContain('useFocusLineage(')
    expect(block).toContain('<MachinesButton')
    expect(block).toContain('<StandardsButton')
    expect(block).toContain('<CategoryButton')
    expect(block).toContain('<DeleteSopButton')
    expect(block).toContain('label="Delete draft"')
    expect(block).toContain('/admin/sops/${sopId}/assign')
    expect(block).toContain('/api/sops/${sopId}/download-url')
    expect(block).toContain('Assign this SOP')
    expect(block).toContain('Open original document')
    expect(block).toContain('Add an objective')
    expect(block).toContain('Whole site')
    expect(block).toContain('+ Standard')
    // The handlers are what the controls call, not just functions in the file.
    expect(block).toContain('onChange={(e) => void toggleJump(e.target.checked)}')
    expect(block).toContain('onCommit={(v) => void saveObjective(v)}')
    expect(block).toContain('onClick={() => void openOriginal()}')
  })

  test('the jump-ahead switch carries the UI-SPEC hint and is admin-only, off by default', () => {
    expect(block).toContain('Let workers jump ahead')
    expect(block).toContain('Off: workers go back only, in order. On: they can open any step, but every hazard, PPE and photo is still needed before sending.')
    const at = block.indexOf('Let workers jump ahead')
    expect(block.slice(block.lastIndexOf('{isAdmin &&', at), at)).toContain('{isAdmin &&')
  })

  test('Delete draft and the draft-only edits are for drafts', () => {
    expect(block).toContain('isAdmin && isDraft')
    expect(block).toContain("const isDraft = sop.status === 'draft'")
  })

  test('earlier versions are listed and open browse-only through focusHref (D-14)', () => {
    expect(block).toContain('{earlier.length} earlier')
    expect(block).toContain('focusHref(v.id, { from })')
    // Browse only: the link carries no mode.
    expect(block).not.toMatch(/focusHref\(v\.id, \{[^}]*mode/)
    expect(block).toContain('v.version < sop.version')
  })

  test('the block collapses to a one-line summary', () => {
    expect(block).toContain('aria-expanded={open}')
    expect(block).toContain("'standard' : 'standards'")
  })

  test('no import of the old builder', () => {
    expect(block).not.toMatch(/admin\/sops\/builder|builder-v2/)
  })

  test.fixme('Walk and Edit switch shows for admins only (D-06) (58-13)', () => {})
  test.fixme('Walk and Edit switch is hidden on superseded versions (D-28) (58-13)', () => {})
})

test.describe('FOC-02 bottom bar and publish dialog (D-16, D-25)', () => {
  const bar = read(`${ADMIN}/PublishBar.tsx`)
  const dialog = read(`${ADMIN}/PublishDialog.tsx`)

  test('the bar reads the same counts as the server gate and says Checked n of N steps', () => {
    expect(bar).toContain('getPublishGateStatus(')
    expect(bar).toContain('Checked {checked} of {total} steps')
    expect(bar).toContain('gate.data.reasons.join')
    expect(bar).toContain("queryKey: ['focus-gate', sopId]")
  })

  test('Publish is enabled only on ready', () => {
    expect(bar).toContain('aria-disabled={!ready}')
    expect(bar).toContain('if (ready) setDialogOpen(true)')
    expect(bar).toContain("ready ? 'bg-accent-signoff text-white' : 'bg-ink-300 text-ink-500'")
    expect(bar).toContain('const ready = gate.data?.ready === true')
  })

  test('the label is Publish v{n}, or Publish SOP on a first publish', () => {
    expect(bar).toContain('`Publish v${focus.sop.version}`')
    expect(bar).toContain("'Publish SOP'")
  })

  test('a pending approval shows the approver sentence and no Publish button', () => {
    expect(bar).toContain('for approval — it publishes when they approve.')
    expect(bar).toContain('getApprovalStatus(')
    expect(bar).toContain('{isAdmin && !pending && (')
    expect(bar).toContain('approval.data.steps[approval.data.nextStepIndex]?.label')
  })

  test('only a draft shows the bar, and non-admin editors get the count without the button', () => {
    expect(bar).toContain("if (focus.sop.status !== 'draft') return null")
    expect(bar).toContain('{isAdmin && !pending')
  })

  test('the dialog posts the publish route and handles pendingApproval without a redirect', () => {
    expect(dialog).toContain('/api/sops/${sopId}/publish')
    expect(dialog).toContain("method: 'POST'")
    expect(dialog).toContain('body.pendingApproval === true')
    expect(dialog).toContain('onPendingApproval()')
    expect(dialog).toContain('onPublished()')
    expect(dialog).not.toMatch(/router\.(push|replace)|window\.location/)
  })

  test('the dialog carries the UI-SPEC copy and the gate refusals', () => {
    expect(dialog).toContain('Publish {name}?')
    expect(dialog).toContain('stays on record.')
    expect(dialog).toContain('the next time they open this SOP.')
    expect(dialog).toContain('Not yet')
    expect(dialog).toContain('bg-accent-signoff')
    expect(dialog).toContain('bg-ink-900/40')
    expect(dialog).toContain('unverified_steps')
    expect(dialog).toContain('open_findings')
    expect(dialog).toContain('no_steps')
  })

  test('the dialog registers with the frame overlay registry so Esc closes it first', () => {
    expect(dialog).toContain('useRegisterOverlay(open, onClose)')
  })

  test('the dialog re-reads the SOP, the gate, the approval line and the versions after a publish', () => {
    for (const key of ['focus-sop', 'focus-gate', 'focus-approval', 'focus-lineage']) {
      expect(dialog).toContain(`'${key}'`)
    }
  })
})
