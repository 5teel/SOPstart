/**
 * Walk helpers shared by the focus and requests evals (moved unchanged out of sop-focus.eval.ts in 60-16).
 */
import { expect, type Page } from '@playwright/test'
import { shot } from './plant-fixture'

const SLOW = { timeout: 30_000 }
const SHORT = { timeout: 10_000 }

// 1x1 PNG: compressPhoto redraws it to a JPEG, so this exercises the real compress -> signed PUT path.
export const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

export const primary = (page: Page) => page.getByTestId('walk-primary')
export const stepOfKind = (page: Page, kind: string) => page.locator(`[data-testid="walk-step"][data-kind="${kind}"]`)

/** Press the one primary button once it is there and enabled. */
export async function press(page: Page) {
  await expect(primary(page)).toHaveCount(1, SHORT)
  await expect(primary(page)).toBeEnabled(SLOW)
  await primary(page).click()
}

/** Browse -> Start walking (or the resume card) -> the first step is on screen. */
export async function startWalking(page: Page) {
  const start = page.getByTestId('focus-start-walking')
  await expect(start).toHaveCount(1, SLOW)
  await start.click()
  await expect(page.getByTestId('walk-step')).toHaveCount(1, SLOW)
}

/** Walk the five-step fixture (hazard, PPE, step, photo step, check) through to the sent screen. */
export async function walkFixture(page: Page, shots: boolean) {
  await expect(stepOfKind(page, 'hazard')).toHaveCount(1, SLOW)
  await expect(page.getByTestId('walk-progress')).toHaveText('Step 1 of 5')
  if (shots) {
    await expect(primary(page)).toHaveText('I understand — continue')
    const box = await primary(page).boundingBox()
    expect(box!.height).toBeGreaterThanOrEqual(60)
    const size = await page.getByTestId('walk-step-text').evaluate((el) => getComputedStyle(el).fontSize)
    expect(size).toBe('28px')
    await shot(page, '58-walk-hazard')
  }
  await press(page)

  await expect(stepOfKind(page, 'ppe')).toHaveCount(1, SLOW)
  await expect(primary(page)).toHaveText("I'm wearing it — continue")
  if (shots) await shot(page, '58-walk-ppe')
  await press(page)

  await expect(stepOfKind(page, 'step')).toHaveCount(1, SLOW)
  await expect(primary(page)).toHaveText('Done — next step')
  await press(page)

  // The photo step: the primary is disabled with its hint until the photo is uploaded.
  await expect(page.getByTestId('walk-progress')).toHaveText('Step 4 of 5', SLOW)
  await expect(primary(page)).toBeDisabled(SLOW)
  await expect(page.getByText('Add a photo to continue.')).toBeVisible()
  const photoBtn = page.getByTestId('step-photo-button')
  await expect(photoBtn).toHaveCount(1, SHORT)
  if (shots) {
    expect((await photoBtn.boundingBox())!.height).toBeGreaterThanOrEqual(60)
    // Done steps ticked, the current one marked, the one ahead locked (D-08).
    await expect(page.locator('[data-testid="focus-rail-row"][data-state="done"]')).toHaveCount(3)
    await expect(page.locator('[data-testid="focus-rail-row"][data-state="current"]')).toHaveCount(1)
    await expect(page.locator('[data-testid="focus-rail-row"][data-state="locked"]')).toHaveCount(1)
    await shot(page, '58-walk-photo-required')
    await shot(page, '58-walk-locked-rail')
  }
  const input = page.getByTestId('step-photo-input')
  await expect(input).toHaveCount(1, SHORT)
  await input.setInputFiles({ name: 'guard.png', mimeType: 'image/png', buffer: TINY_PNG })
  await expect(page.getByTestId('step-photo')).toHaveCount(1, { timeout: 60_000 })
  await expect(primary(page)).toBeEnabled(SLOW)
  await press(page)

  // Last step: its primary goes to the review.
  await expect(stepOfKind(page, 'check')).toHaveCount(1, SLOW)
  await expect(primary(page)).toHaveText('Done — review')
  await press(page)

  await expect(page.getByTestId('walk-review')).toBeVisible(SLOW)
  await expect(page.getByTestId('walk-review-summary')).toContainText('5 steps done · 1 photo')
  await expect(page.getByText('Acknowledged')).toHaveCount(2)
  if (shots) await shot(page, '58-review')
  const send = page.getByTestId('walk-send')
  await expect(send).toHaveCount(1, SHORT)
  await expect(send).toBeEnabled(SLOW)
  await send.click()
  await expect(page.getByTestId('walk-sent')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText('Sent for sign-off')).toBeVisible()
  if (shots) await shot(page, '58-sent')
}
