/**
 * SC-5 — Wire-up mode: connect mode + people blast-radius + createGrant on Done.
 *
 * Contract (32-08/32-09-PLAN must_haves):
 *   - A NEW·UNWIRED SOP enters connect mode in WiringPatchBay; each toggle
 *     draws/removes a live wire; a blast-radius banner counts PEOPLE
 *     (not units) affected.
 *   - ✓ Done writes grants via `src/actions/grants.ts` `createGrant` (D-12,
 *     permission CREATION — the surface's most important job).
 *   - Post-publish "Wire up access" CTA (PublishStage.tsx) lands on
 *     ?view=access&sop=<id> pinned NEW·UNWIRED.
 *
 * Flipped live in: 32-08 (files_modified: tests/phase32/wire-up-mode.spec.ts)
 * Registration: playwright.config.ts `phase32` project
 *   testDir: '.', testMatch: /tests\/phase32\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase32`
 */
import { test, expect } from '@playwright/test'

test.describe('SC-5 — wire-up mode (Wave 0 stub)', () => {
  test.fixme(
    'connect mode toggles live wires, blast-radius counts people, Done writes grants via createGrant',
    async ({ page }) => {
      /**
       * Real path constants this will assert against once built:
       *   - src/components/admin/wiring/WiringPatchBay.tsx (connect mode)
       *   - src/actions/grants.ts (exports createGrant)
       *   - src/app/(protected)/admin/sops/builder/[sopId]/PublishStage.tsx
       *     (post-publish "Wire up access" CTA)
       *
       * Steps (once flipped live):
       * 1. Publish a new SOP; confirm the PublishStage shows a
       *    "Wire up access" CTA linking to ?view=access&sop=<id>.
       * 2. Follow the CTA; confirm the SOP is pinned NEW·UNWIRED and the
       *    view enters connect mode.
       * 3. Toggle an org-unit; confirm a live wire draws/removes and the
       *    blast-radius banner updates its PEOPLE count (not unit count).
       * 4. Click ✓ Done; confirm createGrant was called for each toggled unit.
       */
      void page
      expect(true).toBe(true)
    },
  )
})
