/**
 * Run helpers shared by the focus, start and requests evals. ADR-0012: a SOP is read and run in the
 * home view; start turns the step list into a checklist and each tick is written before it shows.
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

/** The row waiting for its tick, and its tick box. */
export const nextRow = (page: Page) => page.locator('[data-testid="step-row"][data-state="next"]')
export const nextTick = (page: Page) => nextRow(page).getByTestId('step-tick')
export const rowOfKind = (page: Page, kind: string) => page.locator(`[data-testid="step-row"][data-kind="${kind}"]`)

/** Tick the next step once its box is enabled; the row shows ticked only after the server answers. */
export async function press(page: Page) {
  await expect(nextTick(page)).toHaveCount(1, SHORT)
  await expect(nextTick(page)).toBeEnabled(SLOW)
  const id = await nextRow(page).getAttribute('data-step-id')
  await nextTick(page).click()
  await expect(page.locator(`[data-testid="step-row"][data-step-id="${id}"]`)).toHaveAttribute('data-state', 'done', SLOW)
}

/** The SOP view -> start (or resume) -> the checklist is running. */
export async function startWalking(page: Page) {
  const start = page.getByTestId('read-start')
  await expect(start).toHaveCount(1, SLOW)
  await expect(start).toBeEnabled(SLOW)
  await start.click()
  await expect(page.getByTestId('run-bar')).toBeVisible(SLOW)
  await expect(page.getByTestId('read-view')).toHaveAttribute('data-state', 'running')
}

/** Run the five-step fixture (hazard, PPE, step, photo step, check) through to Sent. */
export async function walkFixture(page: Page, shots: boolean) {
  await expect(rowOfKind(page, 'hazard')).toHaveAttribute('data-state', 'next', SLOW)
  await expect(page.getByTestId('run-progress')).toHaveText('0 of 5 ticked')
  await expect(nextTick(page)).toHaveAttribute('aria-label', 'I understand the hazard (step 1)')
  if (shots) {
    expect((await nextTick(page).boundingBox())!.height).toBeGreaterThanOrEqual(60)
    // Later steps wait their turn (D-08).
    await expect(page.locator('[data-testid="step-row"][data-state="waiting"]')).toHaveCount(4)
    await shot(page, '58-run-hazard')
  }
  await press(page)

  await expect(rowOfKind(page, 'ppe')).toHaveAttribute('data-state', 'next', SLOW)
  await expect(nextTick(page)).toHaveAttribute('aria-label', "I'm wearing it (step 2)")
  await press(page)

  await expect(rowOfKind(page, 'step').first()).toHaveAttribute('data-state', 'next', SLOW)
  await press(page)

  // The photo step: its tick waits for the photo.
  await expect(page.getByTestId('run-progress')).toHaveText('3 of 5 ticked', SLOW)
  await expect(nextTick(page)).toBeDisabled(SLOW)
  await expect(nextRow(page)).toContainText('Add the photo, then tick.')
  const photoBtn = nextRow(page).getByTestId('step-photo-button')
  await expect(photoBtn).toHaveCount(1, SHORT)
  if (shots) {
    expect((await photoBtn.boundingBox())!.height).toBeGreaterThanOrEqual(60)
    await expect(page.locator('[data-testid="step-row"][data-state="done"]')).toHaveCount(3)
    await shot(page, '58-run-photo-required')
  }
  await nextRow(page).getByTestId('step-photo-input').setInputFiles({ name: 'guard.png', mimeType: 'image/png', buffer: TINY_PNG })
  await expect(nextRow(page).getByTestId('step-photo')).toHaveCount(1, { timeout: 60_000 })
  await expect(nextTick(page)).toBeEnabled(SLOW)
  await press(page)

  await expect(rowOfKind(page, 'check')).toHaveAttribute('data-state', 'next', SLOW)
  await press(page)

  // Every step ticked: Send sits at the foot of the list.
  await expect(page.getByTestId('run-send')).toBeVisible(SLOW)
  await expect(page.getByTestId('run-send')).toContainText('All 5 steps ticked · 1 photo.')
  if (shots) await shot(page, '58-run-all-ticked')
  const send = page.getByTestId('run-send-button')
  await expect(send).toBeEnabled(SLOW)
  await send.click()
  await expect(page.getByTestId('run-sent')).toBeVisible({ timeout: 60_000 })
  if (shots) await shot(page, '58-run-sent')
}
