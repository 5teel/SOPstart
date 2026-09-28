/**
 * Phase 51 -- SIT-03/SIT-04. Source-contract assertions for `src/actions/site.ts`
 * and `src/app/api/admin/site/generate/route.ts`.
 *
 * Wave-0 stub. Activated by Plan 51-03.
 *
 * Registration: playwright.config.ts `phase51` project
 *   testDir: '.', testMatch: /tests\/phase51\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase51`
 */
import { test } from '@playwright/test'

test.describe('actions', () => {
  // activated by plan 51-03
  test.fixme('every function in src/actions/site.ts opens with requireAdminContext()', () => {})

  // activated by plan 51-03
  test.fixme('setSopMachines org-filters both sopId and machineIds before writing (mirrors assignMemberDepartments, not assignSopDepartments)', () => {})

  // activated by plan 51-03
  test.fixme('createSiteMachine/updateSiteMachine/deleteSiteMachine use the session client (RLS-scoped), not the service-role client', () => {})
})

test.describe('generate route + empty state', () => {
  // activated by plan 51-03
  test.fixme('POST /api/admin/site/generate returns 503 (not a broken 200) when GEMINI_API_KEY is unset', () => {})

  // activated by plan 51-03
  test.fixme('the Generate control only renders when canGenerate (key present) is true; Upload always renders', () => {})

  // activated by plan 51-03
  test.fixme('GEMINI_API_KEY is never included in any response body sent to the client', () => {})

  // activated by plan 51-03
  test.fixme('generateSceneSchema rejects a description under 20 chars and over 1200 chars before any fetch call', () => {})
})
