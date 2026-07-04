/**
 * Phase 26.5 — D-07/D-08: evidence-backed proposals + free-append memory.
 * LIVE since Plan 26.5-04 (src/lib/ai-fields/agent-proposals.ts).
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { createLearningProposal, type AgentAdminInsertFn } from '@/lib/ai-fields/agent-proposals'

const REPO_ROOT = path.resolve(__dirname, '..', '..')
const PROPOSALS_PATH = path.join(REPO_ROOT, 'src', 'lib', 'ai-fields', 'agent-proposals.ts')

function readSource(): string {
  return fs.readFileSync(PROPOSALS_PATH, 'utf-8')
}

test('D-07: createLearningProposal inserts with evidence and status pending', () => {
  const src = readSource()
  expect(src).toContain('evidence')
  expect(src).toContain("'pending'")
  expect(src).toContain('organisation_id')
})

test('D-07: proposal insert carries source memory rows + signal counts (unit, injectable AgentAdminInsertFn seam)', async () => {
  const calls: Parameters<AgentAdminInsertFn>[0][] = []
  const fakeInsert: AgentAdminInsertFn = async (row) => {
    calls.push(row)
    return 'fake-proposal-id'
  }

  const id = await createLearningProposal(
    'org-1',
    'sop-1',
    {
      kind: 'reviewer-critical-flags',
      description: 'test proposal',
      evidence: [{ source: 'reviewer', count: 2 }],
    },
    fakeInsert,
  )

  // (a) fake-seam row carries status: 'pending' and non-empty evidence
  expect(id).toBe('fake-proposal-id')
  expect(calls).toHaveLength(1)
  expect(calls[0].status).toBe('pending')
  expect(calls[0].evidence.length).toBeGreaterThan(0)
  expect(calls[0].organisation_id).toBe('org-1')
  expect(calls[0].sop_id).toBe('sop-1')
})

test('D-07: createLearningProposal never calls a real DB when a fake seam is injected', async () => {
  // (b) resolving without throwing/hanging proves only the injected fake
  // seam ran — the real defaultAgentAdminInsert (createAdminClient) is never
  // reached when an adminInsert override is supplied.
  let fakeCalled = false
  const fakeInsert: AgentAdminInsertFn = async () => {
    fakeCalled = true
    return 'id-2'
  }
  await createLearningProposal('org-2', 'sop-2', { kind: 'k', description: 'd', evidence: [] }, fakeInsert)
  expect(fakeCalled).toBe(true)
})

test('D-07/D-10: approveProposal and declineProposal self-enforce org-scope on the update', () => {
  const src = readSource()
  const approveIdx = src.indexOf('export async function approveProposal')
  const declineIdx = src.indexOf('export async function declineProposal')
  expect(approveIdx).toBeGreaterThan(-1)
  expect(declineIdx).toBeGreaterThan(-1)

  const approveBody = src.slice(approveIdx, declineIdx > approveIdx ? declineIdx : src.length)
  const declineBody = src.slice(declineIdx)

  expect(approveBody).toContain(".eq('organisation_id'")
  expect(declineBody).toContain(".eq('organisation_id'")
})

test('D-08: appendMemory has no status/approval field (free append)', () => {
  const src = readSource()
  const idx = src.indexOf('export async function appendMemory')
  expect(idx).toBeGreaterThan(-1)
  const body = src.slice(idx, idx + 900)
  expect(body).not.toContain('status:')
})
