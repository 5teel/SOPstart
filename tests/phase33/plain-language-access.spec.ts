/**
 * SC-5 — No jargon ("grants" / "wire up" / "UNWIRED") anywhere user-facing
 * in the wiring UI; a plain-language "Who can see this?" / "What can they
 * see?" answer panel replaces the jargon-laden copy.
 *
 * Contract (33-09-PLAN must_haves, RESEARCH Pattern 5):
 *   - `src/components/admin/wiring/AccessAnswerPanel.tsx` (NEW) — selecting
 *     a SOP/collection renders "Who can see this?" (people-first sentence,
 *     e.g. "Only 2 people can see this SOP — Dave Hohaia and Priya Sharma,
 *     chosen by name"); selecting a person/team flips to "What can they
 *     see?".
 *   - `WiringPatchBay.tsx` jargon sweep: "NEW · UNWIRED" / "N grants" /
 *     bay-hint line / saveError copy rewritten to plain language.
 *   - `SelectionStrip.tsx` copy rewritten (idle onboarding line, "via N
 *     grants" -> people-first sentence, "✓ Done wiring" -> "Save — done"
 *     class label) while the 48px fixed-slot STRUCTURE stays exactly as-is
 *     (Phase 32 SC-6 pixel-stability contract — repoint
 *     banner-slot-stability.spec.ts's copy pins in the same commit, keep
 *     its structural pins).
 *   - PublishStage's "Wire up access" CTA label rewritten.
 *   - Internal identifiers (`createGrant`, `pending`, testids) are OUT of
 *     scope — SC-5 is user-visible copy only.
 *
 * Flipped LIVE in: 33-09 (files_modified: tests/phase33/plain-language-access.spec.ts)
 * — this Wave-0 version is a placeholder test.fixme ONLY until 33-09 lands;
 * do not treat it as done once 33-09 ships without confirming the fixme was
 * removed.
 *
 * Registration: playwright.config.ts `phase33` project
 *   testDir: '.', testMatch: /tests\/phase33\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase33`
 */
import { test, expect } from '@playwright/test'

test.describe('SC-5 — plain-language access copy (Wave 0 stub — flips live in 33-09)', () => {
  test.fixme(
    'no grants/wire-up/UNWIRED jargon literals anywhere in the wiring UI source; AccessAnswerPanel renders people-first "Who can see this?"/"What can they see?" sentences',
    async ({ page }) => {
      /**
       * Real path constants this will assert against once built:
       *   - src/components/admin/wiring/AccessAnswerPanel.tsx (NEW)
       *   - src/components/admin/wiring/WiringPatchBay.tsx (jargon sweep)
       *   - src/components/admin/wiring/SelectionStrip.tsx (copy sweep,
       *     structure unchanged)
       *
       * Steps (once flipped live):
       * 1. Source-contract sweep: grep WiringPatchBay/SelectionStrip/
       *    PublishStage for "grant"/"wire up"/"UNWIRED" (case-insensitive,
       *    excluding internal identifiers createGrant/pending/testids) —
       *    expect zero matches in user-visible JSX text.
       * 2. Navigate to /admin/sops?view=access; select a SOP; confirm
       *    AccessAnswerPanel renders a "Who can see this?" sentence naming
       *    people, not grant counts.
       * 3. Select a person/team; confirm the panel flips to "What can they
       *    see?".
       * 4. Confirm SelectionStrip's 48px fixed slot still never mounts/
       *    unmounts (banner-slot-stability.spec.ts structural pins intact).
       */
      void page
      expect(true).toBe(true)
    },
  )
})
