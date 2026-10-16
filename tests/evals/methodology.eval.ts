/**
 * "How SOPs are improved" (2026-10-17): an admin reaches it from Settings and reads the method in
 * plain words; a worker who types the address lands on the home instead.
 */
import { test, expect } from '@playwright/test'
import { EVAL_ENV_READY, signInAs } from './lib/session'
import { shot } from './lib/plant-fixture'

const SLOW = { timeout: 30_000 }

test.describe('methodology page', () => {
  test.skip(!EVAL_ENV_READY, 'eval env not configured')

  test('admin: Settings links to it, it reads in plain words, at desktop and phone width', async ({ page, context }) => {
    await signInAs(context, 'siteAdmin')
    await page.goto('/admin/settings')
    await page.getByRole('link', { name: /How SOPs are improved/ }).click()
    await expect(page).toHaveURL(/\/admin\/settings\/methodology$/, SLOW)
    const body = page.getByTestId('methodology')
    await expect(body.getByRole('heading', { name: 'How SOPstart improves a SOP' })).toBeVisible(SLOW)
    for (const h of ['The four stages', 'What comes first, in order', 'What the rewrite changes', 'What the rewrite never does', 'Gaps go to the document owner', 'The second check'])
      await expect(body.getByRole('heading', { name: h })).toBeVisible()
    await shot(page, 'methodology-desktop')
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
    await shot(page, 'methodology-phone')
  })

  test('worker: the address sends them home', async ({ page, context }) => {
    await signInAs(context, 'siteWorker')
    await page.goto('/admin/settings/methodology')
    await expect(page.getByTestId('methodology')).toHaveCount(0)
    await expect(page.getByTestId('home')).toBeVisible(SLOW)
  })
})
