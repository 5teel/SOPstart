/**
 * Phase 60 -- Raise and ask surfaces (60-12).
 * Requirements: RQS-01, RQS-03. Decisions: D-06, A-04, A-07.
 * Source-contract over comment-stripped source; the live behaviour is the deployed eval.
 * Registration: playwright.config.ts `phase60` project.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const strip = (src: string) =>
  src
    .replace(/\r\n/g, '\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => l.replace(/(^|\s)\/\/.*$/, ''))
    .join('\n')
const read = (rel: string) => strip(fs.readFileSync(path.join(ROOT, rel), 'utf8'))

const SHELL = read('src/components/shell/WorkerShell.tsx')
const ADMIN_ROWS = read('src/components/admin/governance/AdminMachinePanel.tsx')
const THIS_SOP = read('src/components/focus/admin/ThisSopBlock.tsx')
const PANEL = read('src/components/sop/plant/MachinePanel.tsx')
const COMPOSER = read('src/components/requests/RequestComposer.tsx')
const PICKER = read('src/components/requests/AskPicker.tsx')
const SHELL_DIALOG = read('src/components/requests/DialogShell.tsx')
const REASON = read('src/components/office/ReasonDialog.tsx')
const BUNDLE = read('scripts/check-bundle-size.ts')
const JOURNEYS = read('src/lib/journeys/journeys.ts')

test.describe('Raise and ask surfaces (60-12)', () => {
  test('DialogShell, RequestComposer and AskPicker are lazy modules with a forbidden bundle marker on both gated routes', () => {
    for (const src of [COMPOSER, PICKER, SHELL_DIALOG]) expect(src).not.toMatch(/import\s+['"][^'"]*\.css['"]/)
    for (const route of ['/sops/[sopId]/page', "route: '/page'"]) expect(BUNDLE).toContain(route)
    expect(BUNDLE.split("'What do you need?', 'Find a person…'").length - 1).toBe(2)
    for (const src of [SHELL, ADMIN_ROWS, THIS_SOP]) {
      expect(src).not.toMatch(/^import\s[^;]*from\s+'@\/components\/requests\/(AskPicker|RequestComposer)'/m)
      expect(src).toMatch(/dynamic\(\s*\(\)\s*=>\s*import\('@\/components\/requests\/(AskPicker|RequestComposer)'\)/)
    }
    expect(COMPOSER).toContain('What do you need?')
    expect(PICKER).toContain('Find a person…')
    expect(SHELL_DIALOG).toContain('aria-modal="true"')
  })

  test('MachineBody takes rowAction and footer slots and imports neither module', () => {
    expect(PANEL).toContain('rowAction?:')
    expect(PANEL).toContain('footer?: ReactNode')
    expect(PANEL).toContain('{rowAction?.(sop)}')
    expect(PANEL).toContain('{footer}')
    expect(PANEL).not.toContain('components/requests')
  })

  test('"Ask" shows on admin and supervisor machine rows and nowhere for a worker', () => {
    expect(SHELL).toMatch(/isSupervisor\s*\?\s*\(sop\) => <AskTrigger[^>]*variant="row"[^>]*\/>\s*:\s*undefined/)
    expect(SHELL).toContain('<RequestComposerTrigger')
    expect(ADMIN_ROWS).toContain("sop.status === 'published' && <AskTrigger")
    // No composer on the admin panel: admins write SOPs directly.
    expect(ADMIN_ROWS).not.toContain('RequestComposer')
  })

  test('This SOP offers "Ask someone to do this" instead of the retired assign link', () => {
    expect(THIS_SOP).toContain('<AskTrigger')
    expect(THIS_SOP).toContain("sop.status === 'published'")
    expect(THIS_SOP).not.toContain('/assign')
    expect(PICKER).toContain('Ask someone to do this')
  })

  test('the ask journey is in journeys.ts', () => {
    expect(JOURNEYS).toContain("title: 'Ask someone to do a SOP'")
    expect(JOURNEYS).not.toContain('admin/sops/[sopId]/assign')
    expect(JOURNEYS).toContain("label: 'Make a request'")
  })

  test('the composer and the picker call the actions with strict payloads and reset on open', () => {
    expect(COMPOSER).toContain('raiseRequest({ kind, subject, note: trimmed })')
    expect(PICKER).toContain("askToDoSop({ sopId, target: 'role' in picked ? { role: picked.role } : { userId: picked.userId } })")
    expect(PICKER).toContain('listAskTargets({ sopId })')
    for (const src of [COMPOSER, PICKER]) expect(src).not.toMatch(/organisation_?id|organisationId|raised_?by|agent/i)
    // The dialog is mounted only while open, so a second request starts empty.
    expect(COMPOSER).toContain('{open && (')
    expect(COMPOSER).toContain("useState('')")
    // Choosing never sends: only the confirm button calls send.
    expect(PICKER.split('void send()').length - 1).toBe(1)
    expect(PICKER).toContain('onClick={() => setPicked(')
  })

  test('Esc is handled locally and ReasonDialog keeps its props and test ids', () => {
    expect(SHELL_DIALOG).toContain('e.stopPropagation()')
    expect(SHELL_DIALOG).toContain('e.preventDefault()')
    expect(PICKER).toContain("window.addEventListener('keydown', onKey, true)")
    expect(REASON).toContain('<DialogShell')
    expect(REASON).toContain('testId="reason-dialog"')
    for (const prop of ['title', 'body', 'label', 'confirmLabel', 'confirmTone', 'cancelLabel', 'pending', 'error', 'onConfirm', 'onCancel'])
      expect(REASON).toContain(prop)
  })
})
