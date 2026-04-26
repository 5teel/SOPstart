import { test, expect } from '@playwright/test'

// Wave 1 stub — theme scope assertion lands in Task 2.
test.fixme('SB-UX-01: worker routes render body[data-theme="paper"]', async ({ page }) => {
  await page.goto('/')
  const theme = await page.evaluate(() => document.body.getAttribute('data-theme'))
  expect(theme).toBe('paper')
})
