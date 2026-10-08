/**
 * Phase 59 -- sign-off panel. Requirement OFF-02; decisions A-08, A-12.
 * Owner: 59-08. Registration: playwright.config.ts `phase59`.
 * Source contract, but every case pins WIRING (a handler calls the action, a listener is
 * registered with the right flag), not just that a string appears (CLAUDE.md 2026-06-05).
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

const PANEL = strip(read('src/components/office/SignOffPanel.tsx'))
const DIALOG = strip(read('src/components/office/ReasonDialog.tsx'))

function fn(src: string, name: string): string {
  const start = src.indexOf(`async function ${name}(`)
  expect(start, `${name} exists`).toBeGreaterThan(-1)
  const next = src.indexOf('\n  async function ', start + 1)
  return src.slice(start, next === -1 ? start + 1500 : next)
}

test.describe('signoff panel', () => {
  test('the assessor teaching copy is shown to a non-assessor supervisor, Request assessment is wired, Sign off is blocked, Reject is not (A-08)', () => {
    expect(PANEL).toContain('You need to be signed off on this SOP yourself before you can assess others on it.')
    expect(PANEL).toContain('const teaching = !review.isAssessor && !review.canOverride')
    expect(PANEL).toMatch(/onClick=\{\(\) => void requestAssessment\(\)\}/)
    expect(fn(PANEL, 'requestAssessment')).toContain('requestAssessorReview(sopId)')
    for (const w of ['Sending…', 'Requested', 'Request assessment']) expect(PANEL).toContain(w)
    expect(PANEL).toContain('const signOffBlocked = fatal || teaching ||')
    // Reject only stops for a pending action or a recorded-but-failed sign-off, never for the teaching state.
    expect(PANEL).toMatch(/data-testid="signoff-reject"\s+disabled=\{busy \|\| fatal\}/)
  })

  test('an admin gets the override field, Sign off waits for 10 characters and sends overrideReason', () => {
    expect(PANEL).toContain('id="signoff-override-reason"')
    expect(PANEL).toContain('data-testid="signoff-override-reason"')
    expect(PANEL).toContain('This will be recorded as an assessor override with your reason, visible in the audit trail.')
    expect(PANEL).toContain('showOverride && !overrideOk')
    const approve = fn(PANEL, 'approve')
    expect(approve).toContain("signOffCompletion({")
    expect(approve).toContain("decision: 'approved'")
    expect(approve).toContain('overrideReason: showOverride ? overrideReason.trim() : undefined')
    expect(PANEL).toMatch(/onClick=\{\(\) => void approve\(\)\}/)
  })

  test('Reject opens the reason dialog and sends decision rejected with the reason', () => {
    expect(PANEL).toMatch(/data-testid="signoff-reject"[\s\S]*?onClick=\{\(\) => setRejectOpen\(true\)\}/)
    expect(PANEL).toContain('title="Reject this completion?"')
    expect(PANEL).toContain('need to do it again.')
    expect(PANEL).toContain('confirmLabel="Reject"')
    const reject = fn(PANEL, 'reject')
    expect(reject).toContain("signOffCompletion({ completionId, decision: 'rejected', reason })")
    expect(PANEL).toContain('onConfirm={(reason) => void reject(reason)}')
  })

  test('ReasonDialog is modal, gates on 10 characters and closes only itself on Escape', () => {
    // 60-12: scrim, panel and Esc live in the shared DialogShell the reason dialog renders through.
    const shell = strip(read('src/components/requests/DialogShell.tsx'))
    expect(DIALOG).toContain('<DialogShell')
    expect(shell).toContain('aria-modal="true"')
    expect(shell).toContain('role="dialog"')
    expect(DIALOG).toContain('const MIN = 10')
    expect(DIALOG).toContain('trimmed.length >= MIN')
    expect(DIALOG).toMatch(/disabled=\{!valid \|\| pending\}/)
    expect(DIALOG).toContain('onClick={() => onConfirm(trimmed)}')
    const esc = shell.slice(shell.indexOf('function onKeyDown'))
    expect(esc).toContain("e.key !== 'Escape'")
    expect(esc).toContain('e.preventDefault()')
    expect(esc).toContain('e.stopPropagation()')
  })

  test('the raw gate codes are mapped to plain words and never rendered as codes', () => {
    expect(PANEL).toContain("if (code === 'NOT_SIGNED_OFF_ASSESSOR') return NOT_ASSESSOR_COPY")
    expect(PANEL).toContain("if (code === 'ASSESSOR_OVERRIDE_REQUIRED') return OVERRIDE_REQUIRED_COPY")
    expect(PANEL).toContain('An override reason (10+ characters) is required to approve without assessor status.')
    // Both gate-bearing handlers route every server error through mapError.
    for (const h of ['approve', 'reject']) expect(fn(PANEL, h)).not.toMatch(/setError\(result\.error\)/)
    // A server demand for an override opens the field and focuses it, even when the panel thought the caller was an assessor.
    expect(fn(PANEL, 'approve')).toContain('setForceOverride(true)')
    expect(PANEL).toContain('overrideRef.current?.focus()')
  })

  test('a recorded-but-failed sign-off is final: both buttons stay disabled (Pitfall 11)', () => {
    expect(PANEL).toContain("const STATUS_FAILED = 'Sign-off recorded but status update failed.'")
    expect(fn(PANEL, 'approve')).toContain('if (result.error === STATUS_FAILED) setFatal(true)')
    expect(PANEL).toMatch(/data-testid="signoff-approve"\s+disabled=\{busy \|\| signOffBlocked\}/)
  })

  test('photos are a thumbnail strip that opens a lightbox with a step caption', () => {
    expect(PANEL).toContain('data-testid="signoff-photo"')
    expect(PANEL).toContain('size-18')
    expect(PANEL).toMatch(/aria-label=\{`Photo \$\{i \+ 1\} of \$\{photos\.length\}/)
    expect(PANEL).toContain('onClick={() => {\n                    openerIndex.current = i\n                    setLightboxIndex(i)')
    expect(PANEL).toContain('<PhotoLightbox')
    expect(PANEL).toContain('title: `${i + 1} of ${photos.length}`')
    expect(PANEL).toContain('description: p.stepNumber ?')
  })

  test('the lightbox library is only ever loaded through dynamic()', () => {
    const imports = PANEL.split('\n').filter((l) => /from 'yet-another-react-lightbox/.test(l))
    // Stylesheets and a type are static; the component is not.
    for (const l of imports) expect(l).toMatch(/\.css'|import type /)
    expect(PANEL).toMatch(/dynamic<LightboxExternalProps>\(\s*async \(\) => \{/)
    expect(PANEL).toContain("import('yet-another-react-lightbox')")
  })

  test('while the lightbox is open a capture-phase Escape listener closes it and stops the key (A-12)', () => {
    const start = PANEL.indexOf('const lightboxOpen = lightboxIndex !== null')
    expect(start).toBeGreaterThan(-1)
    const block = PANEL.slice(start, PANEL.indexOf('const done = steps.filter'))
    expect(block).toContain('if (!lightboxOpen) return')
    expect(block).toContain("window.addEventListener('keydown', onKey, { capture: true })")
    expect(block).toContain("window.removeEventListener('keydown', onKey, { capture: true })")
    const handler = block.slice(block.indexOf('const onKey'), block.indexOf("window.addEventListener"))
    expect(handler).toContain("e.key !== 'Escape'")
    expect(handler).toContain('e.preventDefault()')
    expect(handler).toContain('e.stopPropagation()')
    expect(handler).toContain('closeLightbox()')
    // Closing returns focus to the thumbnail that opened it.
    expect(PANEL).toContain('thumbRefs.current[openerIndex.current]?.focus()')
  })

  test('a second completion never shows the first one\'s data (CLAUDE.md 2026-10-03)', () => {
    expect(PANEL).toContain("queryKey: ['office-review', completionId]")
    expect(PANEL).toContain('getCompletionForReview(completionId)')
    expect(PANEL).toContain('<SignOffBody key={data.completionId}')
  })

  test('the panel is admin-chunk only: nothing in the worker shell or the root page imports it', () => {
    for (const rel of ['src/components/shell/WorkerShell.tsx', 'src/app/page.tsx']) {
      const f = path.join(process.cwd(), rel)
      if (!fs.existsSync(f)) continue
      expect(strip(fs.readFileSync(f, 'utf-8'))).not.toMatch(/from '@\/components\/office\/(SignOffPanel|ApprovePanel|ReasonDialog)'/)
    }
  })
})
