/**
 * Phase 52 -- HOM-03. Now card stub for NowCard.
 * Activated by Plan 52-03.
 *
 * Registration: playwright.config.ts `phase52` project
 *   testDir: '.', testMatch: /tests\/phase52\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase52`
 */
import { test } from '@playwright/test'

test.describe('NowCard', () => {
  test.fixme('the Walk it control links to /sops/<id>?tab=walk for the top queue item', () => {})
  test.fixme('the Show me control calls onShowMe with the top item\'s machine id', () => {})
  test.fixme('up to two more queue items render under "Then:"', () => {})
  test.fixme('an empty queue shows "Nothing due — browse your machines" instead of the card contents', () => {})
  test.fixme('the component does not sort or filter — it renders the NowItem[] it is handed, in order', () => {})
})
