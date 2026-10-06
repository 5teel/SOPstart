/**
 * Phase 60 -- Cron routes (60-08). Requirements: RQS-04, NTF-02. Decisions: A-08.
 * Registration: playwright.config.ts `phase60` project.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { isCronAuthorized } from '@/lib/cron/auth'

const ROOT = path.resolve(__dirname, '..', '..')
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf-8').replace(/\r\n/g, '\n')
const strip = (src: string) => src.split('\n').map((l) => (/^\s*(\/\/|\/\*|\*\/|\*)/.test(l) ? '' : l)).join('\n')

const AUTH = read('src/lib/cron/auth.ts')
const SHARED = strip(read('src/lib/cron/route.ts'))
const SWEEPS = strip(read('src/lib/cron/sweeps.ts'))
const MW = read('src/lib/supabase/middleware.ts')
const ROUTES = ['review-due', 'machines-without-sops'].map((n) => ({ n, src: strip(read(`src/app/api/cron/${n}/route.ts`)) }))

const req = (token?: string) => ({ headers: new Headers(token === undefined ? {} : { authorization: `Bearer ${token}` }) })

test.describe('Cron routes (60-08)', () => {
  test('isCronAuthorized is fail-closed when CRON_SECRET is unset', () => {
    const prev = process.env.CRON_SECRET
    delete process.env.CRON_SECRET
    try {
      expect(isCronAuthorized(req('anything'))).toBe(false)
      expect(isCronAuthorized(req(''))).toBe(false)
    } finally {
      if (prev !== undefined) process.env.CRON_SECRET = prev
    }
    expect(AUTH).toMatch(/if\s*\(!secret\)\s*return false/)
  })

  test('the bearer is compared exactly: right token passes, wrong or different length fails', () => {
    const prev = process.env.CRON_SECRET
    process.env.CRON_SECRET = 'correct-secret'
    try {
      expect(isCronAuthorized(req('correct-secret'))).toBe(true)
      expect(isCronAuthorized(req('correct-secreT'))).toBe(false)
      expect(isCronAuthorized(req('short'))).toBe(false)
      expect(isCronAuthorized(req())).toBe(false)
    } finally {
      if (prev === undefined) delete process.env.CRON_SECRET
      else process.env.CRON_SECRET = prev
    }
  })

  test('the bearer compare is timing-safe', () => {
    expect(AUTH).toContain('crypto.timingSafeEqual')
  })

  test('/api/cron/review-due and /api/cron/machines-without-sops are exempted by exact path in the proxy (CRON_PATHS)', () => {
    expect(MW).toContain("'/api/agent-layer/synthesis-sweep'")
    expect(MW).toContain("'/api/cron/review-due'")
    expect(MW).toContain("'/api/cron/machines-without-sops'")
    expect(MW).toMatch(/const isCronRoute = CRON_PATHS\.includes\(path\)/)
    expect(MW).not.toMatch(/path\.startsWith\('\/api\/cron/)
  })

  test('each route is POST only and goes through the shared bearer-first handler', () => {
    for (const { n, src } of ROUTES) {
      expect(src, n).toContain('export async function POST')
      expect(src, n).not.toMatch(/export (async )?(function|const) (GET|PUT|PATCH|DELETE)/)
      expect(src, n).toContain('handleCron(request')
    }
    // 401 first, body parsed only after, strict schema, no database import in the handler
    expect(SHARED.indexOf('isCronAuthorized(request)')).toBeGreaterThan(-1)
    expect(SHARED.indexOf('isCronAuthorized(request)')).toBeLessThan(SHARED.indexOf('request.text()'))
    expect(SHARED).toContain("status: 401")
    expect(SHARED).toContain('.strict()')
    expect(SHARED).not.toContain('createAdminClient')
  })

  test('the sweeps live in src/lib/cron/sweeps.ts, not in the route files', () => {
    for (const { n, src } of ROUTES) {
      expect(src, n).not.toContain('createAdminClient')
      expect(src, n).not.toContain('.from(')
    }
    expect(SWEEPS).toContain('export async function runReviewDueSweep')
    expect(SWEEPS).toContain('export async function runMachinesWithoutSopsSweep')
  })

  test('the sweeps scope every query by organisation, cap their work and never write the ledger', () => {
    expect(SWEEPS).toContain('MAX_ORGS_PER_SWEEP')
    expect(SWEEPS).toContain('MAX_ROWS_PER_ORG')
    expect((SWEEPS.match(/\.eq\('organisation_id', org\)/g) ?? []).length).toBeGreaterThanOrEqual(3)
    expect(SWEEPS).not.toContain('recordDecision')
  })

  test('the review sweep notifies per due date through the shared key', () => {
    expect(SWEEPS).toContain("kind: 'review_due'")
    expect(SWEEPS).toContain("dedupeKey({ kind: 'review_due'")
  })
})
