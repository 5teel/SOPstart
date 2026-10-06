/**
 * Phase 26.5 — D-03/D-04/D-05/D-12/D-16: synthesis pipeline.
 * LIVE since Plan 26.5-04 (src/lib/agent-layer/synthesis.ts) via
 * source-contract assertions — runtime AI calls are mocked/deferred
 * (test.fixme below) since a real run requires live Voyage/Anthropic keys.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const REPO_ROOT = path.resolve(__dirname, '..', '..')
const SYNTHESIS_PATH = path.join(REPO_ROOT, 'src', 'lib', 'agent-layer', 'synthesis.ts')

function readSynthesisSource(): string {
  return fs.readFileSync(SYNTHESIS_PATH, 'utf-8')
}

test('D-03/D-16: synthesis.ts uses shared EMBED_MODEL/SYNTHESIS_MODEL constants, no hardcoded model literals', () => {
  if (!fs.existsSync(SYNTHESIS_PATH)) {
    test.skip(true, 'synthesis.ts not yet created — waiting for the synthesis plan')
    return
  }
  const src = readSynthesisSource()
  expect(src).toContain('model-constants')
  expect(src).toContain('EMBED_MODEL')
  expect(src).toContain('SYNTHESIS_MODEL')
  expect(src).toContain('getVoyageClient')
  expect(src).toContain('getAnthropic')
  expect(src).not.toContain("'voyage-3")
  expect(src).not.toContain("'claude-haiku")
})

test('ADR-0002: performPublish schedules synthesis with after(), never awaited, failures logged not thrown', () => {
  const core = fs.readFileSync(path.resolve(__dirname, '..', '..', 'src', 'lib', 'governance', 'publish-core.ts'), 'utf-8')
  expect(core).toContain("import { after } from 'next/server'")
  expect(core).toContain('after(() => synthesizeSop(sopId, organisationId))')
  expect(core).not.toMatch(/await\s+(after|synthesizeSop)\(/)
  const at = core.indexOf('after(() => synthesizeSop')
  expect(core.slice(at - 40, at + 260)).toMatch(/try \{[\s\S]*\} catch \(err\) \{\s*console\.error/)
})

test('D-12: synthesis.ts exposes deriveAssessment returning fresh|drifting|needs-review', () => {
  if (!fs.existsSync(SYNTHESIS_PATH)) {
    test.skip(true, 'synthesis.ts not yet created')
    return
  }
  const src = readSynthesisSource()
  expect(src).toContain('deriveAssessment')
  expect(src).toContain("'fresh'")
  expect(src).toContain("'drifting'")
  expect(src).toContain("'needs-review'")
})

test('Pitfall 5: synthesizeSop never throws — it returns { ok: false } and records the error on the row', () => {
  if (!fs.existsSync(SYNTHESIS_PATH)) {
    test.skip(true, 'synthesis.ts not yet created')
    return
  }
  const src = readSynthesisSource()
  const fnStart = src.indexOf('export async function synthesizeSop')
  expect(fnStart).toBeGreaterThan(-1)
  const fnBody = src.slice(fnStart)
  expect(fnBody).toContain('} catch (err) {')
  expect(fnBody).toContain("last_synthesis_status: 'error'")
  expect(fnBody).toContain('return { ok: false, error: message }')
  expect(src).not.toContain('triggerAgentSynthesis')
})

test('T-26.5-04-01: every DB write in synthesis.ts sets organisation_id; layout_data is never referenced', () => {
  if (!fs.existsSync(SYNTHESIS_PATH)) {
    test.skip(true, 'synthesis.ts not yet created')
    return
  }
  const src = readSynthesisSource()
  expect(src).not.toContain('layout_data')
  const writeCount = (src.match(/\.(insert|upsert)\(/g) ?? []).length
  const orgIdCount = (src.match(/organisation_id/g) ?? []).length
  expect(writeCount).toBeGreaterThan(0)
  expect(orgIdCount).toBeGreaterThanOrEqual(writeCount)
})

test('58-08: synthesis reads focus steps, not the old step or block tables', () => {
  const src = readSynthesisSource()
  expect(src).toContain("from('sop_focus_steps')")
  expect(src).toMatch(/\.eq\('organisation_id', organisationId\)\s*\.eq\('sop_id', sopId\)/)
  expect(src).not.toMatch(/sop_steps|sop_section_blocks|block_agent_metadata|embedBlocks/)
})

test.fixme('D-03: publish generates embedding via mocked Voyage client (injectable seam)', () => {
  // Behavioral test with fake embed/tag seams — deferred; would require
  // adding an injectable client seam to synthesis.ts (not required by
  // this plan's acceptance criteria).
})

test.fixme('D-04: draft saves never trigger synthesis (autosave path untouched)', () => {
  // Behavioral test — verified by code review that the autosave path never
  // imports synthesis.ts; triggerAgentSynthesis is only called from the
  // publish route (Plan 26.5-05).
})

test('null-clobber guard: failed steps are omitted from the upsert, not written as null/empty', () => {
  // 2026-07-05 incident: a backfill run without VOYAGE_API_KEY overwrote good
  // prod embeddings with null. Failed steps must be conditionally spread.
  const src = fs.readFileSync('src/lib/agent-layer/synthesis.ts', 'utf-8')
  expect(src).toMatch(/\.\.\.\(tagResult !== null &&/)
  expect(src).toMatch(/\.\.\.\(embedding !== null &&/)
  expect(src).toContain("'partial'")
  expect(src).not.toMatch(/embedding: embedding \? JSON\.stringify\(embedding\) : null/)
})
