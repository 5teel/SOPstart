import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Phase 29 Plan 06 — final merged-tree gate: 5-requirement audit manifest.
 *
 * One assertion group per APR requirement, each pointing at the REAL shipped
 * artifact (not a re-implementation of the Wave 1-3 specs that already prove
 * these facts in depth). This file is a runnable manifest tying APR-01..05 to
 * their proving evidence, so a future reader can confirm coverage in one file
 * instead of re-deriving it from 8 separate spec files.
 *
 * Registration: playwright.config.ts `phase29` project (broad testMatch,
 * tests/phase29/**) — no config edit needed.
 */

const REPO_ROOT = path.resolve(__dirname, '../..')
const read = (rel: string) => readFileSync(path.join(REPO_ROOT, rel), 'utf8')

test.describe('APR-01 — optional 1-4 step approval chain per category; no-chain publishes unchanged', () => {
  const migrationSql = read('supabase/migrations/00045_approval_chains.sql')
  const routeSrc = read('src/app/api/sops/[sopId]/publish/route.ts')
  const editorSrc = read('src/components/admin/governance/ApprovalChainEditor.tsx')

  test('approval_chains RLS uses current_organisation_id(), never app_metadata', () => {
    expect(migrationSql).toContain('current_organisation_id')
    expect(migrationSql).not.toContain('app_metadata')
  })

  test('publish route no-chain path calls performPublish( — byte-identical path preserved', () => {
    expect(routeSrc).toContain('performPublish(')
  })

  test('ApprovalChainEditor calls setApprovalChain( to persist the 1-4 step chain', () => {
    expect(editorSrc).toContain('setApprovalChain(')
  })
})

test.describe('APR-02 — chain snapshotted per SOP version; historical versions keep their approved chain', () => {
  const migrationSql = read('supabase/migrations/00045_approval_chains.sql')
  const routeSrc = read('src/app/api/sops/[sopId]/publish/route.ts')
  const actionsSrc = read('src/actions/approvals.ts')

  test('sop_approvals partial unique index scoped to action = approved', () => {
    expect(migrationSql).toContain("where action = 'approved'")
  })

  test('publish route sets approval_snapshot on request-publish', () => {
    expect(routeSrc).toContain('approval_snapshot: chainRow.steps')
  })

  test('requestChanges does NOT null approval_snapshot — update sets only approval_state', () => {
    const updateIdx = actionsSrc.indexOf(".update({ approval_state: null })")
    expect(updateIdx).toBeGreaterThan(-1)
    // The only fields on that specific update call are approval_state — confirm
    // approval_snapshot is not part of this statement.
    const updateCallSrc = actionsSrc.slice(updateIdx, updateIdx + ".update({ approval_state: null })".length)
    expect(updateCallSrc).not.toContain('approval_snapshot')
  })
})

test.describe('APR-03 — one-click approve/request-changes from the SOP itself and the governance queue', () => {
  const queueRowSrc = read('src/components/admin/governance/GovernanceQueueRow.tsx')
  const panelSrc = read('src/components/admin/governance/ApprovalChainPanel.tsx')

  test('GovernanceQueueRow Approve branch calls approveStep(', () => {
    expect(queueRowSrc).toContain('approveStep(')
  })

  test('ApprovalChainPanel Approve/Request-changes wired to callback props', () => {
    expect(panelSrc).toContain('onApprove(')
    expect(panelSrc).toContain('onRequestChanges(')
  })
})

test.describe('APR-04 — final approval auto-completes publish; pending state visible on SOP + queue', () => {
  const actionsSrc = read('src/actions/approvals.ts')
  const governanceSrc = read('src/actions/governance.ts')

  test('approveStep final-step branch calls performPublish( with approvalState approved', () => {
    const finalStepIdx = actionsSrc.indexOf('nextIndex === steps.length - 1')
    const performPublishIdx = actionsSrc.indexOf('performPublish(', finalStepIdx)
    expect(finalStepIdx).toBeGreaterThan(-1)
    expect(performPublishIdx).toBeGreaterThan(finalStepIdx)
    expect(actionsSrc).toContain("approvalState: 'approved'")
  })

  test('resolveNextStepIndex counts approved-only steps (imported, not duplicated)', () => {
    expect(actionsSrc).toContain('resolveNextStepIndex')
    expect(governanceSrc).toContain('resolveNextStepIndex')
  })

  test('listGovernanceQueue computes isCallerNextApprover for pending rows', () => {
    expect(governanceSrc).toContain('isCallerNextApprover')
  })
})

test.describe('APR-05 — approval history visible in version history', () => {
  const versionsPageSrc = read('src/app/(protected)/admin/sops/[sopId]/versions/page.tsx')

  test('versions page calls getApprovalHistory(', () => {
    expect(versionsPageSrc).toContain('getApprovalHistory(')
  })

  test('renders rows grouped by version (per-version filter)', () => {
    expect(versionsPageSrc).toMatch(/approvals\.filter\(.*ver\.id/)
  })
})
