/**
 * Phase 26.5 Plan 08 — D-09/D-10/D-11: org agent dashboard (LIVE).
 *
 * Was a Wave-0 stub (26.5-01) that skipped until /admin/agent/page.tsx
 * existed. Now source-contract: the SSR guard redirects non-admin/
 * safety_manager and fetches getAgentDashboardData; Approve/Decline are
 * wired to approveProposalAction/declineProposalAction (not empty handlers,
 * CLAUDE.md 2026-06-05) and remove the row from local state on success;
 * proposals render structured evidence; the activity feed is present; and
 * no cross-SOP graph visualisation ships this phase (D-11/D-13).
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const REPO_ROOT = path.resolve(__dirname, '..', '..')
const AGENT_DIR = path.join(REPO_ROOT, 'src', 'app', '(protected)', 'admin', 'agent')
const PAGE = path.join(AGENT_DIR, 'page.tsx')
const CLIENT = path.join(AGENT_DIR, 'AgentDashboardClient.tsx')

test.describe('D-09/D-10/D-11 — org agent dashboard (/admin/agent)', () => {
  test('page.tsx guards admin/safety_manager and fetches getAgentDashboardData', () => {
    const src = fs.readFileSync(PAGE, 'utf-8')
    expect(src).toMatch(/redirect\(['"]\/login['"]\)/)
    expect(src).toContain("redirect('/dashboard')")
    expect(src).toMatch(/\['admin',\s*'safety_manager'\]/)
    expect(src).toContain('getAgentDashboardData')
  })

  test('AgentDashboardClient wires Approve/Decline to approveProposalAction/declineProposalAction and removes the row on success', () => {
    const src = fs.readFileSync(CLIENT, 'utf-8')
    expect(src).toMatch(/approveProposalAction\(/)
    expect(src).toMatch(/declineProposalAction\(/)
    expect(src).toMatch(/onClick=\{\(\)\s*=>\s*handleApprove\(p\.id\)\}/)
    expect(src).toMatch(/onClick=\{\(\)\s*=>\s*handleDecline\(p\.id\)\}/)
    expect(src).toMatch(/setProposals\([\s\S]*?filter/)
  })

  test('proposals render structured evidence; activity feed is present', () => {
    const src = fs.readFileSync(CLIENT, 'utf-8')
    expect(src).toContain('data-testid="agent-proposals-queue"')
    expect(src).toContain('displayEvidence(p.evidence)')
    expect(src).toContain('data-testid="agent-activity-feed"')
    expect(src).toContain('recentMemory')
  })

  test('D-11/D-13: no cross-SOP graph visualisation ships on the dashboard', () => {
    const pageSrc = fs.readFileSync(PAGE, 'utf-8')
    const clientSrc = fs.readFileSync(CLIENT, 'utf-8')
    for (const src of [pageSrc, clientSrc]) {
      expect(src).not.toMatch(/react-konva|FlowGraphCanvas|Konva/i)
      expect(src.toLowerCase()).not.toContain('<canvas')
    }
  })
})
