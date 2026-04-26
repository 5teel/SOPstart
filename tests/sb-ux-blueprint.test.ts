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
