/**
 * UX-03 — One governance surface (flipped live in 30-08; repointed in 41-06
 * when /admin/sops became a redirect shim and the fold moved onto /sops).
 *
 * Contract (30-RESEARCH § Test Map + orchestrator decisions #1/#4):
 *   - Governance folds into /sops?view=attention ("Needs attention" scope)
 *     rendering the EXISTING GovernanceQueueRow (moved VERBATIM — reuse,
 *     not rewrite, preserves the HARD constraint). As of 41-05/41-06 this
 *     lives in AdminAttentionLens.tsx, mounted from AdminSopSurface.tsx.
 *   - /admin/governance is a redirect() shim mapping legacy ?filter=X
 *     deep-links onto /sops?view=attention's filter param (GQ-04
 *     preserved), with the admin guard IN FRONT of the redirect.
 *   - APR-03/APR-04 preserved: approveStep( wired in GovernanceQueueRow AND
 *     builder PublishStage; awaiting-approval count + deep-link live on
 *     the attention lens (server-rendered — Pitfall 10).
 *   - GovernanceWidget + LibraryReviewCell removed as separate surfaces.
 *   - The old STATUS_TABS "Needs attention" (value=failed) renamed to
 *     "Parse issues" (decision #4 — no naming collision).
 *   - Phase 28/29 server actions (governance.ts / approvals.ts) UNCHANGED.
 *   - /pathways coverage: every route in the App Router tree is mapped by a
 *     journeys.ts step (0 not-mapped — CLAUDE.md pathways rule).
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const ADMIN_SOP_SURFACE = path.join(
  ROOT, 'src', 'components', 'sop', 'AdminSopSurface.tsx',
)
const ATTENTION_LENS = path.join(
  ROOT, 'src', 'components', 'sop', 'lenses', 'AdminAttentionLens.tsx',
)
const QUEUE_ROW = path.join(
  ROOT, 'src', 'components', 'admin', 'governance', 'GovernanceQueueRow.tsx',
)
const FLAG_DISPLAY = path.join(
  ROOT, 'src', 'lib', 'governance', 'flag-display.ts',
)
const PUBLISH_STAGE = path.join(
  ROOT, 'src', 'app', '(protected)', 'admin', 'sops', 'builder', '[sopId]', 'PublishStage.tsx',
)
const GOVERNANCE_SHIM = path.join(
  ROOT, 'src', 'app', '(protected)', 'admin', 'governance', 'page.tsx',
)
const JOURNEYS = path.join(ROOT, 'src', 'lib', 'journeys', 'journeys.ts')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

test.describe('UX-03 — governance folds into /sops', () => {
  test('/sops renders the needs-attention view (QueueRow, grouped worst-first) behind ?view=attention', () => {
    // Deep-link resolution: view=attention -> admin-attention scope.
    const surface = read(ADMIN_SOP_SURFACE)
    expect(surface).toContain("view === 'attention'")
    expect(surface).toContain("scope: 'admin-attention'")
    expect(surface).toContain('<AdminAttentionLens')
    // The lens itself renders the grouped queue, unmodified GovernanceQueueRow.
    const lens = read(ATTENTION_LENS)
    expect(lens).toContain('<GovernanceQueueRow')
    expect(lens).toContain('attentionGroups.map')
    expect(lens).toContain('listGovernanceQueue')
  })

  test('/admin/governance is a redirect shim mapping legacy ?filter= deep-links, guard first', () => {
    const src = read(GOVERNANCE_SHIM)
    expect(src).toContain('redirect(')
    expect(src).toContain('/sops?view=attention')
    expect(src).toContain("qp.set('filter', params.filter)") // 41-REVIEW WR-01: encoded via URLSearchParams, never interpolated
    expect(src).toContain("view: 'attention'")
    // Guard stays in front of the redirect (T-30-08-03).
    // 2026-07-13: member.role → role (shared getSessionContext auth refactor)
    expect(src).toContain("['admin', 'safety_manager'].includes(role)")
    // No governance surface renders here anymore.
    expect(src).not.toContain('GovernanceQueueRow')
    expect(src).not.toContain('ApprovalChainEditor')
  })

  test('approveStep stays wired in GovernanceQueueRow AND PublishStage (APR-03/04 hard constraint)', () => {
    const row = read(QUEUE_ROW)
    // Verbatim move: the gate AND the wired call site survive (2026-06-05:
    // assert handler wiring, not token presence).
    expect(row).toContain("row.flags.includes('awaiting_approval') && row.isCallerNextApprover")
    expect(row).toContain('await approveStep(row.id)')
    expect(row).toContain('onClick={handleApprove}')
    expect(read(PUBLISH_STAGE)).toContain('approveStep')
  })

  test('awaiting-approval survives as an always-visible attention group', () => {
    // Priority ordering lives in the shared flag-display.ts (41-04); the
    // lens imports it rather than redefining it.
    expect(read(FLAG_DISPLAY)).toContain(
      "'overdue', 'due_soon', 'awaiting_approval', 'unowned', 'stale_role'",
    )
    const lens = read(ATTENTION_LENS)
    expect(lens).toContain('FLAG_PRIORITY')
    expect(lens).toContain('attentionGroups.map')
  })

  test('GovernanceWidget and LibraryReviewCell no longer exist as separate surfaces', () => {
    expect(
      fs.existsSync(path.join(ROOT, 'src', 'components', 'admin', 'governance', 'GovernanceWidget.tsx')),
    ).toBe(false)
    expect(
      fs.existsSync(path.join(ROOT, 'src', 'components', 'admin', 'sops', 'LibraryReviewCell.tsx')),
    ).toBe(false)
    expect(
      fs.existsSync(path.join(ROOT, 'src', 'components', 'admin', 'LibraryReviewCell.tsx')),
    ).toBe(false)
  })

  test('in-flight SOPs and the attention view are both reachable from the scope column (sketch 005 variant C)', () => {
    // Phase 41: the tab rail / Miller scope column moved into
    // AdminSopSurface.tsx as ADMIN_SCOPES, each an in-frame applyScope()
    // click (history.replaceState), not a navigable href.
    const surface = read(ADMIN_SOP_SURFACE)
    expect(surface).toContain("{ key: 'admin-failed', label: 'Still working' }")
    expect(surface).toContain("{ key: 'admin-attention', label: 'Needs attention' }")
    expect(surface).toContain("{ key: 'admin-access', label: 'Access' }")
    expect(surface).toContain("applyScope(sc.key)")
    // Both full-width takeover lenses offer a way back to the worker scope.
    expect(surface).toContain('Back to your SOPs')
  })
})

test.describe('pathways coverage — 0 not-mapped (CLAUDE.md pathways rule)', () => {
  test('every App Router page route is mapped by a journeys.ts step', () => {
    // Mirrors src/lib/journeys/routes.ts listAppRoutes() — the same walk the
    // /pathways "All screens" panel derives its inventory from.
    const appDir = path.join(ROOT, 'src', 'app')
    const found: string[] = []
    const walk = (dir: string, segs: string[]) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue
        const name = entry.name
        if (name === 'api' || name.startsWith('@') || name.startsWith('_')) continue
        const isGroup = name.startsWith('(') && name.endsWith(')')
        const nextSegs = isGroup ? segs : [...segs, name]
        const full = path.join(dir, name)
        if (fs.existsSync(path.join(full, 'page.tsx'))) found.push('/' + nextSegs.join('/'))
        walk(full, nextSegs)
      }
    }
    walk(appDir, [])
    const journeys = read(JOURNEYS)
    const unmapped = found.filter((r) => !journeys.includes(`route: '${r}'`))
    expect(unmapped).toEqual([])
  })
})
