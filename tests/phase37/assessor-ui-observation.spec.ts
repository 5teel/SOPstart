/**
 * ASR-01 -- observation-recording UI surfaces the assessor gate: the
 * advancing verdict button is disabled when the recorder is blocked (D-08),
 * needs_support stays enabled in the same modal (D-09), blocked copy teaches
 * the rule, the override disclosure names the audit trail, a "Request
 * assessment" CTA exists, and the assessment-requests panel renders subject
 * + SOP + an assess action.
 *
 * Flipped LIVE in Plan 37-05 as source-contract assertions over
 * VerdictButtons.tsx, RecordObservationModal.tsx, AssessmentRequestsPanel.tsx
 * and admin/team/page.tsx -- checks wiring (a control's own markup window
 * actually references the state/handler), not mere token presence
 * (2026-06-05 dead-feature blind spot; tests/phase37/assessor-ui-signoff.spec.ts
 * idiom).
 *
 * Registration: playwright.config.ts `phase37` project
 *   testDir: '.', testMatch: /tests\/phase37\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase37`
 */
import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const VERDICT_BUTTONS = readFileSync(
  path.join(process.cwd(), 'src/components/observations/VerdictButtons.tsx'),
  'utf8'
).replace(/\r\n/g, '\n')

const MODAL = readFileSync(
  path.join(process.cwd(), 'src/components/observations/RecordObservationModal.tsx'),
  'utf8'
).replace(/\r\n/g, '\n')

const PANEL = readFileSync(
  path.join(process.cwd(), 'src/components/observations/AssessmentRequestsPanel.tsx'),
  'utf8'
).replace(/\r\n/g, '\n')

const TEAM_PAGE = readFileSync(
  path.join(process.cwd(), 'src/app/(protected)/admin/team/page.tsx'),
  'utf8'
).replace(/\r\n/g, '\n')

/** Slice `content` to a window around every occurrence of `label` -- scopes
 * an assertion to a specific control's own markup instead of the whole file
 * (tests/phase36/no-refresher-gate.spec.ts idiom). */
function sliceAroundOccurrences(content: string, label: string, radius = 400): string {
  const slices: string[] = []
  let idx = content.indexOf(label)
  while (idx !== -1) {
    slices.push(content.slice(Math.max(0, idx - radius), idx + label.length + radius))
    idx = content.indexOf(label, idx + label.length)
  }
  return slices.join('\n---\n')
}

test.describe('ASR-01 -- VerdictButtons blockedVerdict wiring (D-08/D-09)', () => {
  test('the disabled prop is keyed off blockedVerdict, not an unconditional disable', () => {
    expect((VERDICT_BUTTONS.match(/blockedVerdict/g) ?? []).length).toBeGreaterThanOrEqual(2)
    const disabledLine = VERDICT_BUTTONS.split('\n').find((l) => l.trim().startsWith('disabled={'))
    expect(disabledLine).toBeTruthy()
    expect(disabledLine).toContain('isBlocked')
  })

  test('isBlocked is derived from blockedVerdict === verdict, scoping the disable to a single verdict', () => {
    expect(VERDICT_BUTTONS).toContain('const isBlocked = blockedVerdict === verdict')
  })
})

test.describe('ASR-01 -- RecordObservationModal blocked/override wiring (source-contract)', () => {
  test('contains the exact blocked-recorder teaching copy and the override disclosure copy', () => {
    expect(MODAL).toContain('You need to be signed off on this SOP yourself before you can assess others on it')
    expect(MODAL).toContain('This will be recorded as an assessor override with your reason, visible in the audit trail.')
  })

  test('getAssessorStatusForSop and requestAssessorReview are each called exactly once', () => {
    expect((MODAL.match(/getAssessorStatusForSop\(/g) ?? []).length).toBe(1)
    expect((MODAL.match(/requestAssessorReview\(/g) ?? []).length).toBe(1)
  })

  test("blockedVerdict is only ever passed the literal 'performed_to_sop' -- never 'needs_support' (D-09)", () => {
    expect(MODAL).toContain('blockedVerdict={blockedVerdict}')
    expect(MODAL).not.toMatch(/blockedVerdict=(["']|\{['"])needs_support/)
    const derivationLine = MODAL.split('\n').find((l) => l.includes('const blockedVerdict'))
    expect(derivationLine).toBeTruthy()
    expect(derivationLine).toContain("'performed_to_sop'")
  })

  test('the overrideReason argument to recordObservation is conditioned on performed_to_sop -- a coaching save never carries a reason', () => {
    const callIdx = MODAL.indexOf('await recordObservation({')
    expect(callIdx).toBeGreaterThan(-1)
    const callSlice = MODAL.slice(callIdx, callIdx + 400)
    expect(callSlice).toContain('overrideReason:')
    expect(callSlice).toContain("verdict === 'performed_to_sop'")
  })

  test('the override reason textarea markup window references overrideOpen -- proves the reveal is wired, not merely present elsewhere in the file', () => {
    const window = sliceAroundOccurrences(MODAL, 'Reason for override (min. 10 characters)', 500)
    expect(window).toContain('overrideOpen')
    expect(window).toContain('setOverrideReason')
  })

  test('the "Request assessment" control\'s onClick window references handleRequestAssessment, which itself calls requestAssessorReview', () => {
    const window = sliceAroundOccurrences(MODAL, 'Request assessment', 300)
    expect(window).toContain('handleRequestAssessment')
    const handlerIdx = MODAL.indexOf('async function handleRequestAssessment')
    expect(handlerIdx).toBeGreaterThan(-1)
    const handlerSlice = MODAL.slice(handlerIdx, handlerIdx + 400)
    expect(handlerSlice).toContain('requestAssessorReview(sopId)')
  })
})

test.describe('ASR-01 -- AssessmentRequestsPanel content + wiring (Pitfall 1 actionability)', () => {
  test('renders subjectName, sopTitle, presetSopId, and marks requests read via the existing markNotificationRead action', () => {
    expect(PANEL).toContain('req.subjectName')
    expect(PANEL).toContain('req.sopTitle')
    expect(PANEL).toContain('presetSopId={modalRequest?.sopId}')
    expect(PANEL).toContain("import { markNotificationRead } from '@/actions/versioning'")
    expect((PANEL.match(/markNotificationRead\(/g) ?? []).length).toBeGreaterThanOrEqual(1)
  })

  test('mounts RecordObservationModal (import + render) exactly as PersonPanel does', () => {
    expect((PANEL.match(/RecordObservationModal/g) ?? []).length).toBeGreaterThanOrEqual(2)
    expect(PANEL).toContain('<RecordObservationModal')
  })

  test('renders null while loading (requests === null) and when the list is empty', () => {
    expect(PANEL).toContain('if (requests === null) return null')
    expect(PANEL).toContain('if (requests.length === 0) return null')
  })
})

test.describe('ASR-01 -- AssessmentRequestsPanel mounted on exactly one page, above TeamViewShell', () => {
  test('admin/team/page.tsx imports and renders AssessmentRequestsPanel before TeamViewShell', () => {
    expect(TEAM_PAGE).toContain(
      "import { AssessmentRequestsPanel } from '@/components/observations/AssessmentRequestsPanel'"
    )
    const panelIdx = TEAM_PAGE.indexOf('<AssessmentRequestsPanel')
    const shellIdx = TEAM_PAGE.indexOf('<TeamViewShell')
    expect(panelIdx).toBeGreaterThan(-1)
    expect(shellIdx).toBeGreaterThan(-1)
    expect(panelIdx).toBeLessThan(shellIdx)
  })
})
