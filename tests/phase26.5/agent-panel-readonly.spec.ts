/**
 * Phase 26.5 Plan 07 — D-09/D-10: builder agent panel is read-only (LIVE).
 *
 * Asserts NO edit affordance exists on machine metadata (tags/entities/
 * embeddings render as display-only — hand edits would be clobbered on the
 * next publish, D-10) and that AgentBlockMeta keys rows by junctionId (D-02).
 * Per CLAUDE.md 2026-06-05: assert ABSENCE of a handler behaviourally (real
 * react-dom/server render via a tsx subprocess), not just a source-contract
 * grep — the grep check below is kept as a cheap first line of defence, the
 * harness proves the rendered markup itself.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const REPO_ROOT = path.resolve(__dirname, '..', '..')
const HARNESS = path.join('scripts', 'agent-panel-check.tsx')
const AGENT_DIR = path.join(REPO_ROOT, 'src', 'components', 'admin', 'builder-v2', 'agent')
const BUILDER_CLIENT = path.join(
  REPO_ROOT,
  'src',
  'app',
  '(protected)',
  'admin',
  'sops',
  'builder',
  '[sopId]',
  'BuilderClient.tsx'
)

test.describe('D-09/D-10 — agent panel is read-only, keyed by junction id, and the toggle is wired', () => {
  test('D-10: AgentPanel/AgentBlockMeta/AgentBanner render machine metadata with NO edit affordance (behavioural)', () => {
    let out = ''
    try {
      out = execFileSync('npx', ['tsx', HARNESS], { cwd: REPO_ROOT, encoding: 'utf8', shell: true })
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string }
      throw new Error(`agent-panel harness failed:\n${e.stdout ?? ''}\n${e.stderr ?? ''}`)
    }
    expect(out).toContain('AGENT-PANEL-CHECK OK')
  })

  test('D-10: source contract — no <input>/<textarea>/contentEditable literal in any Agent*.tsx file', () => {
    const files = fs
      .readdirSync(AGENT_DIR)
      .filter((f) => /^Agent(Panel|BlockMeta|Banner)\.tsx$/.test(f))
    expect(files.length).toBe(3)
    for (const f of files) {
      const src = fs.readFileSync(path.join(AGENT_DIR, f), 'utf-8')
      expect(src).not.toContain('<input')
      expect(src).not.toContain('<textarea')
      expect(src).not.toContain('contentEditable')
      expect(src).not.toMatch(/onChange=/)
    }
  })

  test('D-02: AgentBlockMeta keys its rows by junctionId, not block_id or sort_order', () => {
    const src = fs.readFileSync(path.join(AGENT_DIR, 'AgentBlockMeta.tsx'), 'utf-8')
    expect(src).toContain('junctionId')
    expect(src).toMatch(/key=\{row\.junctionId\}/)
  })

  test('D-09: BuilderClient agentview toggle is wired to the state setter (not an empty handler)', () => {
    const src = fs.readFileSync(BUILDER_CLIENT, 'utf-8')
    expect(src).toContain('useState(false)')
    expect(src).toMatch(/onClick=\{\(\)\s*=>\s*setAgentview/)
    expect(src).toContain('agent-layer-root')
    expect(src).toContain('AgentPanel')
    expect(src).toContain('AgentBlockMeta')
    expect(src).toContain('AgentBanner')
  })
})
