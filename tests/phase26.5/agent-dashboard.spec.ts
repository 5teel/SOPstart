/**
 * Phase 26.5 — D-11: org dashboard (proposals queue + activity feed)
 * (Wave-0 stub, Plan 26.5-01).
 *
 * Goes LIVE when /admin/agent/page.tsx ships: asserts the SSR page carries the
 * admin/safety_manager auth guard (departments/page.tsx analog) and renders
 * both the proposals queue and activity feed. Skips cleanly until then.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const PAGE_PATH = path.resolve(
  __dirname, '..', '..', 'src', 'app', '(protected)', 'admin', 'agent', 'page.tsx',
)

test('D-11: dashboard page guards to admin/safety_manager and redirects others', () => {
  if (!fs.existsSync(PAGE_PATH)) {
    test.skip(true, 'admin/agent page not yet created — waiting for the dashboard plan')
    return
  }
  const src = fs.readFileSync(PAGE_PATH, 'utf-8')
  expect(src).toContain('safety_manager')
  expect(src).toContain('redirect(')
})

test('D-11: dashboard renders proposals queue + activity feed', () => {
  if (!fs.existsSync(PAGE_PATH)) {
    test.skip(true, 'admin/agent page not yet created — waiting for the dashboard plan')
    return
  }
  const src = fs.readFileSync(PAGE_PATH, 'utf-8')
  expect(src).toMatch(/proposal/i)
  expect(src).toMatch(/activity|feed/i)
})

test.fixme('D-11: authenticated admin sees org-scoped proposals only (runtime, seeded orgs)', () => {
  // Live-route integration test — implemented in the dashboard plan.
})
