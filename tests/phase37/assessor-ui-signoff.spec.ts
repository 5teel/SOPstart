/**
 * ASR-01 -- the completion sign-off surface applies the same assessor gate
 * as observations: signOffCompletion's role array must include 'admin'
 * (37-RESEARCH Pitfall 2 -- the existing array is supervisor/safety_manager
 * only), the approve control is blocked for a non-assessor supervisor,
 * reject stays ungated (a sibling of D-03: rejecting never needs assessor
 * status), and the override reason sheet appears for admin/safety_manager.
 *
 * Flipped LIVE in Plan 37-04 as source-contract assertions over
 * src/actions/completions.ts and the [completionId] page/client pair --
 * checks wiring POSITION (branch-before-gate) and CALLSITE (the affordance
 * actually reacts to the blocked/override state), not mere token presence
 * (2026-06-05 dead-feature blind spot).
 *
 * Registration: playwright.config.ts `phase37` project
 *   testDir: '.', testMatch: /tests\/phase37\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase37`
 */
import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const COMPLETIONS_ACTIONS = readFileSync(
  path.join(process.cwd(), 'src/actions/completions.ts'),
  'utf8'
).replace(/\r\n/g, '\n')

const PAGE = readFileSync(
  path.join(process.cwd(), 'src/app/(protected)/activity/[completionId]/page.tsx'),
  'utf8'
).replace(/\r\n/g, '\n')

const CLIENT = readFileSync(
  path.join(process.cwd(), 'src/app/(protected)/activity/[completionId]/CompletionDetailClient.tsx'),
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

test.describe('ASR-01 -- signOffCompletion role array + gate position (source-contract)', () => {
  test("the role array includes 'admin' and the error string names all three roles (37-RESEARCH Pitfall 2 regression guard)", () => {
    expect(COMPLETIONS_ACTIONS).toContain("'supervisor', 'safety_manager', 'admin'")
    expect(COMPLETIONS_ACTIONS).toContain('Only supervisors, safety managers and admins can sign off completions.')
  })

  test('isSignedOffAssessor is called exactly once, positioned AFTER both the approved-decision branch and the org-scope guard', () => {
    expect((COMPLETIONS_ACTIONS.match(/isSignedOffAssessor\(/g) ?? []).length).toBe(1)

    const decisionIdx = COMPLETIONS_ACTIONS.indexOf("decision === 'approved'")
    const orgGuardIdx = COMPLETIONS_ACTIONS.indexOf('completion.organisation_id !== organisationId')
    const callIdx = COMPLETIONS_ACTIONS.indexOf('isSignedOffAssessor(')

    expect(decisionIdx).toBeGreaterThan(-1)
    expect(orgGuardIdx).toBeGreaterThan(-1)
    expect(callIdx).toBeGreaterThan(-1)

    // Branch-before-gate: the gate call comes after the decision check.
    expect(callIdx).toBeGreaterThan(decisionIdx)
    // Org-scope guard runs first: the gate call comes after it too.
    expect(callIdx).toBeGreaterThan(orgGuardIdx)
  })

  test('the completion_sign_offs insert payload carries is_assessor_override and override_reason', () => {
    const insertIndex = COMPLETIONS_ACTIONS.indexOf("from('completion_sign_offs')\n    .insert(")
    expect(insertIndex).toBeGreaterThan(-1)
    const insertSlice = COMPLETIONS_ACTIONS.slice(insertIndex, insertIndex + 400)
    expect(insertSlice).toContain('is_assessor_override:')
    expect(insertSlice).toContain('override_reason:')
  })

  test("the supervisor_assignments check (if (role === 'supervisor')) is preserved, not replaced", () => {
    expect((COMPLETIONS_ACTIONS.match(/if \(role === 'supervisor'\)/g) ?? []).length).toBe(1)
  })

  test('both bare error codes appear, and ASSESSOR_OVERRIDE_REQUIRED is inside a branch referencing admin/safety_manager (D-06)', () => {
    expect(COMPLETIONS_ACTIONS).toContain('NOT_SIGNED_OFF_ASSESSOR')
    expect(COMPLETIONS_ACTIONS).toContain('ASSESSOR_OVERRIDE_REQUIRED')
    const overrideIndex = COMPLETIONS_ACTIONS.indexOf('ASSESSOR_OVERRIDE_REQUIRED')
    const nearby = COMPLETIONS_ACTIONS.slice(Math.max(0, overrideIndex - 300), overrideIndex)
    expect(nearby).toContain("'admin'")
    expect(nearby).toContain("'safety_manager'")
  })
})

test.describe('ASR-01 -- page.tsx server-computed assessor props', () => {
  test("isSupervisor widens to include 'admin' (D-06) and isSignedOffAssessor is called exactly once, server-side", () => {
    const isSupervisorLine = PAGE.split('\n').find((l) => l.includes('const isSupervisor ='))
    expect(isSupervisorLine).toBeTruthy()
    expect(isSupervisorLine).toContain("'admin'")
    expect((PAGE.match(/isSignedOffAssessor\(/g) ?? []).length).toBe(1)
  })

  test('isAssessor and canOverride are passed down to CompletionDetailClient', () => {
    const clientCallIdx = PAGE.indexOf('<CompletionDetailClient')
    expect(clientCallIdx).toBeGreaterThan(-1)
    const propsSlice = PAGE.slice(clientCallIdx, clientCallIdx + 700)
    expect(propsSlice).toContain('isAssessor={isAssessor}')
    expect(propsSlice).toContain('canOverride={canOverride}')
  })
})

test.describe('ASR-01 -- CompletionDetailClient blocked/override UI wiring (source-contract)', () => {
  test('contains the exact blocked-supervisor teaching copy and the override disclosure copy', () => {
    expect(CLIENT).toContain('You need to be signed off on this SOP yourself before you can assess others on it')
    expect(CLIENT).toContain('This will be recorded as an assessor override with your reason, visible in the audit trail.')
  })

  test('references requestAssessorReview and passes overrideReason to signOffCompletion on the override path', () => {
    expect(CLIENT).toContain("import { requestAssessorReview } from '@/actions/observations'")
    expect(CLIENT).toContain('requestAssessorReview(sopId)')
    const signOffCallIdx = CLIENT.indexOf('await signOffCompletion({')
    expect(signOffCallIdx).toBeGreaterThan(-1)
    const signOffCallSlice = CLIENT.slice(signOffCallIdx, signOffCallIdx + 200)
    expect(signOffCallSlice).toContain('overrideReason:')
  })

  test("the Reject control's own disabled prop does not reference blockedFromApproving or isAssessor -- rejection stays ungated", () => {
    // Inspect the Reject button's OWN disabled={...} expression specifically
    // (not a wide file window, which would bleed into the adjacent Approve
    // button's disabled expression in the same flex row).
    const onClickIdx = CLIENT.indexOf('setRejectSheetOpen(true)')
    expect(onClickIdx).toBeGreaterThan(-1)
    const disabledIdx = CLIENT.indexOf('disabled={', onClickIdx)
    const disabledEnd = CLIENT.indexOf('}', disabledIdx)
    const disabledExpr = CLIENT.slice(disabledIdx, disabledEnd)
    expect(disabledExpr).toContain('isApproving')
    expect(disabledExpr).not.toContain('blockedFromApproving')
    expect(disabledExpr).not.toContain('isAssessor')
  })

  test('the Approve control markup window DOES reference the blocked/override state -- proves the affordance is wired, not merely present elsewhere in the file', () => {
    // If handleApproveClick's disabled/onClick wiring were computed but never
    // attached to the button (the exact 2026-06-05 dead-AddMenu-button
    // class), this window would NOT contain blockedFromApproving even though
    // the token exists elsewhere in the file -- the whole-file toContain
    // checks above would still pass, which is why this scoped assertion is
    // required in addition to them.
    const window = sliceAroundOccurrences(CLIENT, 'handleApproveClick', 400)
    expect(window).toContain('blockedFromApproving')
  })
})
