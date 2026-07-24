/**
 * Phase 35 Plan 02 -- auth/org-scope source-contract for src/actions/competency.ts.
 *
 * No live DB required. Pins the auth posture that closes the recurring
 * role-check-missing / cross-org / supervisor-empty bug classes (CLAUDE.md
 * 2026-06-15, 2026-06-26 x2, 2026-07-05, 2026-07-20) BEFORE any UI ships.
 *
 * Registration: playwright.config.ts `phase35` project
 *   testDir: '.', testMatch: /tests\/phase35\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase35`
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const ACTIONS_FILE = path.join(ROOT, 'src', 'actions', 'competency.ts')
const API_COMPETENCY_DIR = path.join(ROOT, 'src', 'app', 'api', 'competency')

const src = fs.readFileSync(ACTIONS_FILE, 'utf-8')

/** Slices out one function's body (up to the next named marker or EOF) so
 * assertions are scoped per-function, not whole-file (2026-07-20 learning:
 * one probe/assertion per branch, not a blanket file-level grep). */
function extractFunction(name: string, nextMarker: string | null): string {
  const startIdx = src.indexOf(`export async function ${name}(`)
  expect(startIdx, `function ${name} not found in ${ACTIONS_FILE}`).toBeGreaterThan(-1)
  const endIdx = nextMarker ? src.indexOf(nextMarker, startIdx + 1) : src.length
  expect(endIdx === -1 ? src.length : endIdx).toBeGreaterThan(startIdx)
  return src.slice(startIdx, endIdx === -1 ? src.length : endIdx)
}

const getTrainingMatrixSrc = extractFunction('getTrainingMatrix', 'export async function getTrainingRecordForPerson(')
const getTrainingRecordForPersonSrc = extractFunction('getTrainingRecordForPerson', 'export async function getMyCompetencyStates(')
const getMyCompetencyStatesSrc = extractFunction('getMyCompetencyStates', 'export async function exportTrainingCsv(')
const exportTrainingCsvSrc = extractFunction('exportTrainingCsv', null)

test.describe('src/actions/competency.ts -- file-level contract', () => {
  test("is a 'use server' module", () => {
    expect(src).toContain("'use server'")
  })

  test("defines RECORDER_ROLES including 'supervisor'", () => {
    expect(src).toMatch(/RECORDER_ROLES\s*=\s*\[[^\]]*'supervisor'[^\]]*\]/)
  })

  test("imports buildMatrix, classifyCompetency, generateTrainingCsv from '@/lib/competency/*'", () => {
    expect(src).toMatch(/from ['"]@\/lib\/competency\/classify['"]/)
    expect(src).toMatch(/from ['"]@\/lib\/competency\/matrix['"]/)
    expect(src).toMatch(/from ['"]@\/lib\/competency\/csv['"]/)
    expect(src).toContain('classifyCompetency')
    expect(src).toContain('buildMatrix')
    expect(src).toContain('generateTrainingCsv')
  })

  test('no cookie-less /api/competency route exists -- CSV export stays a role-gated server action (T-35-02-04)', () => {
    expect(fs.existsSync(API_COMPETENCY_DIR)).toBe(false)
  })
})

test.describe('getTrainingMatrix -- RECORDER_ROLES gate + admin-client org-self-enforce', () => {
  test('checks RECORDER_ROLES.includes(role) before any read', () => {
    expect(getTrainingMatrixSrc).toMatch(/RECORDER_ROLES\.includes\(role\)/)
  })

  test('uses createAdminClient + callerOrgId (never the JWT claim alone)', () => {
    expect(getTrainingMatrixSrc).toContain('createAdminClient()')
    expect(getTrainingMatrixSrc).toContain('callerOrgId(')
  })

  test("applies .eq('organisation_id' on sop_completions and sop_observations reads", () => {
    expect(getTrainingMatrixSrc).toMatch(/from\('sop_completions'\)[\s\S]{0,200}\.eq\('organisation_id'/)
    expect(getTrainingMatrixSrc).toMatch(/from\('sop_observations'\)[\s\S]{0,200}\.eq\('organisation_id'/)
  })

  test('reads sop_access_people via the admin client (supervisor RLS branch excludes supervisor, migration 00046)', () => {
    expect(getTrainingMatrixSrc).toContain("admin.from('sop_access_people')")
  })
})

test.describe('getTrainingRecordForPerson -- RECORDER_ROLES gate + admin-client org-self-enforce', () => {
  test('checks RECORDER_ROLES.includes(role) before any read', () => {
    expect(getTrainingRecordForPersonSrc).toMatch(/RECORDER_ROLES\.includes\(role\)/)
  })

  test('uses createAdminClient + callerOrgId', () => {
    expect(getTrainingRecordForPersonSrc).toContain('createAdminClient()')
    expect(getTrainingRecordForPersonSrc).toContain('callerOrgId(')
  })

  test("applies .eq('organisation_id' on sop_completions and sop_observations reads", () => {
    expect(getTrainingRecordForPersonSrc).toMatch(/from\('sop_completions'\)[\s\S]{0,200}\.eq\('organisation_id'/)
    expect(getTrainingRecordForPersonSrc).toMatch(/from\('sop_observations'\)[\s\S]{0,200}\.eq\('organisation_id'/)
  })

  test('reads sop_access_people via the admin client', () => {
    expect(getTrainingRecordForPersonSrc).toContain("admin.from('sop_access_people')")
  })
})

test.describe('exportTrainingCsv -- RECORDER_ROLES gate + admin-client org-self-enforce', () => {
  test('checks RECORDER_ROLES.includes(role) before any read', () => {
    expect(exportTrainingCsvSrc).toMatch(/RECORDER_ROLES\.includes\(role\)/)
  })

  test('uses createAdminClient + callerOrgId', () => {
    expect(exportTrainingCsvSrc).toContain('createAdminClient()')
    expect(exportTrainingCsvSrc).toContain('callerOrgId(')
  })

  test("applies .eq('organisation_id' on the sop_completions read", () => {
    expect(exportTrainingCsvSrc).toMatch(/from\('sop_completions'\)[\s\S]{0,200}\.eq\('organisation_id'/)
  })
})

test.describe('getMyCompetencyStates -- self-scoped, the over-share guard (CMP-04-adjacent, D-04)', () => {
  test('does NOT call createAdminClient', () => {
    expect(getMyCompetencyStatesSrc).not.toContain('createAdminClient(')
  })

  test('does NOT check RECORDER_ROLES', () => {
    expect(getMyCompetencyStatesSrc).not.toContain('RECORDER_ROLES')
  })

  test('reads via the session client (supabase), filtered to the caller (userId)', () => {
    expect(getMyCompetencyStatesSrc).toContain('supabase')
    expect(getMyCompetencyStatesSrc).toMatch(/eq\('member_id',\s*userId\)|eq\('worker_id',\s*userId\)|eq\('observed_worker_id',\s*userId\)/)
  })
})
