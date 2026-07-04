/**
 * Phase 26.5 — D-09/D-10: builder agent panel is read-only (Wave-0 stub, Plan 26.5-01).
 *
 * Goes LIVE when AgentPanel/AgentBlockMeta ship: asserts NO edit affordance
 * exists on machine metadata (tags/entities/embeddings render as display-only —
 * hand edits would be clobbered on next publish, D-10). Per CLAUDE.md
 * 2026-06-05: assert absence of handlers/inputs, not just a CSS class string.
 * Skips cleanly until the components exist.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const REPO_ROOT = path.resolve(__dirname, '..', '..')

function findAgentComponents(): string[] {
  const results: string[] = []
  const stack = [path.join(REPO_ROOT, 'src', 'components', 'admin')]
  while (stack.length) {
    const dir = stack.pop()!
    if (!fs.existsSync(dir)) continue
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name)
      if (entry.isDirectory()) stack.push(p)
      else if (/^Agent(Panel|BlockMeta)\.tsx$/.test(entry.name)) results.push(p)
    }
  }
  return results
}

test('D-10: AgentPanel/AgentBlockMeta render machine metadata with NO edit affordance (no input/onChange on tags/entities)', () => {
  const files = findAgentComponents()
  if (files.length === 0) {
    test.skip(true, 'agent panel components not yet created — waiting for the panel plan')
    return
  }
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf-8')
    expect(src).not.toContain('<input')
    expect(src).not.toContain('<textarea')
    expect(src).not.toContain('contentEditable')
  }
})

test.fixme('D-09: builder toggle shows/hides the agent panel; workers never see it (behavioral render)', () => {
  // Real component render (tsx subprocess harness per Phase 26 convention) — panel plan.
})

test.fixme('D-10: only proposal approve/decline actions are interactive (behavioral render)', () => {
  // Behavioral assertion that the ONLY handlers present are proposal actions — panel plan.
})
