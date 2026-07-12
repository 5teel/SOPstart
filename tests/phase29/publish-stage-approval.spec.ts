import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Phase 29 Plan 04 — builder Publish stage approval surface (APR-03/APR-04).
 *
 * Verifies (source-contract, no live DB required):
 *   PublishStage renders <ApprovalChainPanel gated on
 *     approvalStatus?.state === 'pending' (no-chain SOPs get NO panel).
 *   ApprovalChainPanel's Approve button onClick references onApprove, and
 *     Request-changes onClick references onRequestChanges with a non-empty
 *     comment guard (disabled when comment is empty) — real wiring, not
 *     bare prop-name presence (CLAUDE.md 2026-06-05 dead-feature learning).
 *   BuilderStageShell's handlers call approveStep(/requestChanges( and
 *     thread approvalStatus + the handlers down to PublishStage.
 *   page.tsx calls getApprovalStatus( and passes it to BuilderStageShell.
 *   handlePublish's success branch references pendingApproval.
 *
 * Registration: playwright.config.ts `phase29` project
 *   testDir: '.', testMatch: /tests\/phase29\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase29`
 */

const ROOT = process.cwd()
const BUILDER_DIR = path.join(ROOT, 'src', 'app', '(protected)', 'admin', 'sops', 'builder', '[sopId]')
const PANEL = path.join(ROOT, 'src', 'components', 'admin', 'governance', 'ApprovalChainPanel.tsx')
const PUBLISH_STAGE = path.join(BUILDER_DIR, 'PublishStage.tsx')
const SHELL = path.join(BUILDER_DIR, 'BuilderStageShell.tsx')
const PAGE = path.join(BUILDER_DIR, 'page.tsx')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

test.describe('ApprovalChainPanel mount — PublishStage gates on approvalStatus.state===pending', () => {
  const src = read(PUBLISH_STAGE)

  test('imports ApprovalChainPanel', () => {
    expect(src).toContain("import { ApprovalChainPanel")
  })

  test('mounts <ApprovalChainPanel only inside an approvalStatus?.state === \'pending\' gate', () => {
    const gateIdx = src.indexOf("approvalStatus?.state === 'pending'")
    const mountIdx = src.indexOf('<ApprovalChainPanel')
    expect(gateIdx).toBeGreaterThan(-1)
    expect(mountIdx).toBeGreaterThan(-1)
    expect(gateIdx).toBeLessThan(mountIdx)
  })

  test('no-chain publish button (Publish SOP) is unconditional — untouched by approvalStatus', () => {
    expect(src).toContain('Publish SOP')
    const publishBtnMatch = src.match(/data-testid="publish-button"[\s\S]{0,400}/)
    expect(publishBtnMatch).not.toBeNull()
    expect(publishBtnMatch![0]).not.toContain('approvalStatus')
  })
})

test.describe('approve wired — ApprovalChainPanel Approve button calls onApprove', () => {
  const src = read(PANEL)

  test('Approve button onClick references the onApprove callback prop', () => {
    const btnMatch = src.match(/data-testid="approve-button"[\s\S]{0,200}/)
    expect(btnMatch).not.toBeNull()
    expect(btnMatch![0]).toContain('onClick={() => onApprove(')
  })

  test('Approve/Request-changes controls render only when canAct', () => {
    const canActIdx = src.indexOf('{canAct && (')
    const approveIdx = src.indexOf('data-testid="approve-button"')
    expect(canActIdx).toBeGreaterThan(-1)
    expect(approveIdx).toBeGreaterThan(canActIdx)
  })
})

test.describe('request changes wired — comment-guarded onRequestChanges', () => {
  const src = read(PANEL)

  test('Request-changes button onClick references onRequestChanges with the comment', () => {
    const btnMatch = src.match(/data-testid="request-changes-button"[\s\S]{0,300}/)
    expect(btnMatch).not.toBeNull()
    expect(btnMatch![0]).toContain('onClick={() => onRequestChanges(comment.trim())}')
  })

  test('Request-changes is disabled until the comment is non-empty', () => {
    const btnMatch = src.match(/data-testid="request-changes-button"[\s\S]{0,300}/)
    expect(btnMatch).not.toBeNull()
    expect(btnMatch![0]).toContain('comment.trim().length === 0')
  })
})

test.describe('BuilderStageShell — handlers call approveStep/requestChanges, thread approvalStatus', () => {
  const src = read(SHELL)

  test('imports approveStep and requestChanges from src/actions/approvals', () => {
    expect(src).toContain("import { approveStep, requestChanges } from '@/actions/approvals'")
  })

  test('handleApproveStep calls approveStep(', () => {
    const fnMatch = src.match(/const handleApproveStep = useCallback\(([\s\S]*?)\n  \)/)
    expect(fnMatch).not.toBeNull()
    expect(fnMatch![0]).toContain('approveStep(sopId, comment)')
  })

  test('handleRequestChanges calls requestChanges(', () => {
    const fnMatch = src.match(/const handleRequestChanges = useCallback\(([\s\S]*?)\n  \)/)
    expect(fnMatch).not.toBeNull()
    expect(fnMatch![0]).toContain('requestChanges(sopId, comment)')
  })

  test('threads approvalStatus + onApproveStep/onRequestChanges down to <PublishStage', () => {
    const mountMatch = src.match(/<PublishStage[\s\S]*?\/>/)
    expect(mountMatch).not.toBeNull()
    expect(mountMatch![0]).toContain('approvalStatus={approvalStatus}')
    expect(mountMatch![0]).toContain('onApproveStep={handleApproveStep}')
    expect(mountMatch![0]).toContain('onRequestChanges={handleRequestChanges}')
  })

  test('handlePublish success branch references pendingApproval', () => {
    const fnMatch = src.match(/const handlePublish = useCallback\(([\s\S]*?)\n  \}, \[sopId, router\]\)/)
    expect(fnMatch).not.toBeNull()
    expect(fnMatch![0]).toContain('pendingApproval')
  })
})

test.describe('page.tsx — computes getApprovalStatus and passes it to the shell', () => {
  const src = read(PAGE)

  test('imports and calls getApprovalStatus(', () => {
    expect(src).toContain("import { getApprovalStatus } from '@/actions/approvals'")
    expect(src).toContain('getApprovalStatus(sopId)')
  })

  test('passes approvalStatus prop to <BuilderStageShell', () => {
    const mountMatch = src.match(/<BuilderStageShell[\s\S]*?\/>/)
    expect(mountMatch).not.toBeNull()
    expect(mountMatch![0]).toContain('approvalStatus={approvalStatus}')
  })
})
