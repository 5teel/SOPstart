import { test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route('**/api/voice/token', (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({ access_token: 'test-token', expires_in: 30 }),
    })
  )
  await page.addInitScript(() => {
    class MockWS extends EventTarget {
      readyState = 1
      constructor(_url: string, _protocols?: string | string[]) {
        super()
        queueMicrotask(() => this.dispatchEvent(new Event('open')))
        setTimeout(() => {
          this.dispatchEvent(
            new MessageEvent('message', {
              data: JSON.stringify({
                type: 'Results',
                is_final: true,
                channel: {
                  alternatives: [{ transcript: 'twenty two point five', confidence: 0.95 }],
                },
              }),
            })
          )
        }, 500)
      }
      send() {}
      close() {}
    }
    ;(globalThis as unknown as { WebSocket: typeof WebSocket }).WebSocket =
      MockWS as unknown as typeof WebSocket
  })
})

test('SB-UX-06: measurement block captures transcript via stubbed Deepgram', async ({ page }) => {
  test.fixme(
    true,
    'Requires seeded SOP + MeasurementBlock rendered — flip when fixture lands'
  )
  void page
})

test('SB-UX-06: offline capture queues blob in Dexie', async ({ page }) => {
  test.fixme(
    true,
    'Requires navigator.onLine=false mock + Dexie assertion helper'
  )
  void page
})
