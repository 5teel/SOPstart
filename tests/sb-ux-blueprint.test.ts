import { test, expect } from '@playwright/test'

test('SB-UX-01: public landing body has data-theme="paper"', async ({ page }) => {
  await page.goto('/')
  // Wait for client mount effect
  await page.waitForFunction(() => document.body.getAttribute('data-theme') === 'paper', { timeout: 5000 })
  const theme = await page.evaluate(() => document.body.getAttribute('data-theme'))
  expect(theme).toBe('paper')
})

test('SB-UX-01: admin route does NOT have data-theme="paper"', async ({ page }) => {
  // Unauthenticated → redirected to /login; /login IS paper-themed so we check
  // the direct route path with a stub. For the structural wave-1 check, just
  // confirm an admin-only string exists in the tree that is NOT paper.
  test.skip(true, 'Full admin-vs-worker contrast check lands in Wave 2 when tabs exist')
})

test('SB-UX-08: worker preview toggle clamps to 430px and persists', async ({ page }) => {
  // Seed a logged-in session via existing test fixtures OR use an unauthenticated
  // route that still mounts the toggle. Default Phase 12 test fixtures include
  // admin + worker seed helpers — use the worker seed.
  // (If no seed helper exists in this env yet, flip to test.fixme.)
  test.fixme(true, 'Requires authenticated worker fixture — Wave 3 will land fixture')
})

test('SB-UX-02: SOP detail is a 6-tab shell driven by ?tab=', async ({ page }) => {
  // Requires a seeded SOP + worker session. If fixtures are missing, keep test.fixme.
  test.fixme(true, 'Flip to live when worker session fixture lands')
})
