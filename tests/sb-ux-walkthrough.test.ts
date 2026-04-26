import { test, expect } from '@playwright/test'

test('SB-UX-03: at 390x852 the immersive step card is rendered', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 852 } })
  const page = await ctx.newPage()
  // Requires a seeded SOP + worker session — if fixture missing, fixme
  test.fixme(true, 'Flip to live when worker session fixture lands')
  await ctx.close()
})

test('SB-UX-03: at 1280x720 the ViewModeToggle is rendered and persists to localStorage', async ({
  page,
}) => {
  test.fixme(true, 'Flip to live when worker session fixture lands')
})
