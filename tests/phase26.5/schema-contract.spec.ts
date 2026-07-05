/**
 * Phase 26.5 — D-01/D-02/D-03: agent-metadata schema contract (LIVE, Plan 26.5-02).
 *
 * Asserts the 5 org-scoped append-only tables + pgvector + HNSW + similarity RPC
 * exist in migration 00040, RLS uses current_organisation_id() directly, and NO
 * policy body cross-references public.sops (42P17 recursion risk, CLAUDE.md
 * 2026-05-13). Source-contract level — schema-contract.spec.ts asserts SHAPE;
 * apply-phase26.5-migration.mjs (Task 2) verifies the migration actually landed
 * on the live DB via Management API to_regclass.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const MIGRATIONS_DIR = path.resolve(__dirname, '..', '..', 'supabase', 'migrations')

function findMigration(): string | null {
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => /agent[_-]?metadata/i.test(f))
  return files.length ? path.join(MIGRATIONS_DIR, files[0]) : null
}

function readMigration(): string {
  const file = findMigration()
  if (!file) throw new Error('agent-metadata migration not found — expected 00040_agent_metadata_schema.sql')
  return fs.readFileSync(file, 'utf-8')
}

// Strip SQL comment lines before counting so header prose never
// self-invalidates a count (plan's own guard against comment-line false positives).
function stripComments(sql: string): string {
  return sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
}

const TABLES = [
  'sop_agent_metadata',
  'block_agent_metadata',
  'agent_memory',
  'agent_learning_proposals',
  'sop_voice_qa_log',
]

test('D-03: pgvector extension enabled', () => {
  const sql = readMigration()
  expect(sql).toContain('create extension if not exists vector')
})

test('D-01/D-05/D-07/D-08: all 5 agent-layer tables exist', () => {
  const sql = stripComments(readMigration())
  for (const table of TABLES) {
    expect(sql).toMatch(new RegExp(`create table[\\s\\S]*?public\\.${table}\\b`))
  }
})

test('D-01: each table has exactly one SELECT policy using current_organisation_id() directly', () => {
  const sql = stripComments(readMigration())
  for (const table of TABLES) {
    const policyMatches = sql.match(
      new RegExp(`create policy[^;]*?on public\\.${table}[\\s\\S]*?;`, 'g'),
    )
    expect(policyMatches, `expected exactly one policy on ${table}`).not.toBeNull()
    expect(policyMatches!.length).toBe(1)
    expect(policyMatches![0]).toContain('for select')
    expect(policyMatches![0]).toContain('current_organisation_id()')
  }
})

test('D-01/T-26.5-02-02: no policy body cross-references public.sops (42P17 recursion guard)', () => {
  const sql = stripComments(readMigration())
  // FK refs use `references public.sops(id)` — `from public.sops` only appears
  // in a policy subquery, which is the forbidden 42P17 recursion pattern.
  expect(sql).not.toMatch(/from\s+public\.sops/i)
})

test('D-01: no authenticated INSERT/UPDATE/DELETE policy on any agent table', () => {
  const sql = stripComments(readMigration())
  expect(sql).not.toMatch(/create policy[^;]*for insert/i)
  expect(sql).not.toMatch(/create policy[^;]*for update/i)
  expect(sql).not.toMatch(/create policy[^;]*for delete/i)
})

test('D-02: block_agent_metadata is keyed by the sop_section_blocks junction id', () => {
  const sql = readMigration()
  expect(sql).toMatch(/block_id\s+uuid not null references public\.sop_section_blocks\(id\)/)
})

test('D-03: HNSW cosine indexes exist on both embedding columns', () => {
  const sql = readMigration()
  const hnswMatches = sql.match(/using hnsw \(embedding vector_cosine_ops\)/g)
  expect(hnswMatches).not.toBeNull()
  expect(hnswMatches!.length).toBe(2)
})

test('D-03: match_sop_agent_metadata RPC wraps <=> and self-enforces org-scope in-body', () => {
  const sql = readMigration()
  expect(sql).toContain('match_sop_agent_metadata')
  expect(sql).toContain('embedding <=> query_embedding')
  expect(sql).toContain('organisation_id = p_organisation_id')
  expect(sql).toMatch(/security definer/i)
})

test('CR-01 (review fix): match_sop_agent_metadata EXECUTE revoked from client roles (00041)', () => {
  const file = fs.readdirSync(MIGRATIONS_DIR).find((f) => /match_rpc_lockdown/i.test(f))
  expect(file, 'expected 00041_match_rpc_lockdown.sql').toBeTruthy()
  const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file!), 'utf-8')
  expect(sql).toMatch(/revoke execute on function public\.match_sop_agent_metadata/i)
  expect(sql).toMatch(/from public, anon, authenticated/i)
  expect(sql).toMatch(/grant execute on function public\.match_sop_agent_metadata[\s\S]*?to service_role/i)
  // IN-01 folded in per the review: null-embedding rows never pad the result set
  expect(sql).toContain('and embedding is not null')
})

test.fixme('D-01: no authenticated INSERT/UPDATE/DELETE policy on agent tables (runtime RLS probe)', () => {
  // Live DB probe — implemented against seeded data in a later plan.
})
