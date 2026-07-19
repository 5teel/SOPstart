/**
 * SC-4 — resolveSopEffectiveAccess: pure override-rule helper for SOP-target
 * grants (narrowing override).
 *
 * Contract (33-05-PLAN must_haves, RESEARCH Pattern 2 + Pitfall 4):
 *   - `src/lib/org-model/resolve-sop-access.ts` (NEW, not yet built — flips
 *     live in 33-05) exports a PURE function that, given a SOP's collection
 *     memberships + the full set of SOP-target grants for that SOP, decides
 *     whether the SOP is overridden (any direct SOP-target grant on any
 *     subject tier exists) and — if so — what it resolves to instead of its
 *     collection.
 *   - Lives in `src/lib/org-model/` as a plain module, NOT an export of
 *     `src/actions/grants.ts` — a pure/sync helper inside a `'use server'`
 *     file passes `tsc` but breaks `next build` (CLAUDE.md 2026-06-27
 *     learning; RESEARCH Pitfall 4).
 *   - Reuses the existing `resolveEffectiveAccess` 5-level union resolver
 *     for org/area/department/role/person chain inheritance of SOP-target
 *     grants (RESEARCH "Calling the unchanged resolver for SOP targets" code
 *     example) — this helper applies the override RULE on top, it does not
 *     reimplement inheritance.
 *
 * Override cases this test proves once flipped live (per 33-01-PLAN Task 2):
 *   1. Trigger on ANY direct SOP-target grant (any subject tier — org, area,
 *      department, role, or person) — the SOP is overridden the instant one
 *      exists, regardless of which tier granted it.
 *   2. Last-person-removed re-follow — revoking the LAST SOP-target grant on
 *      an overridden SOP causes it to re-follow its collection again
 *      (emergent from the absence of grant rows, no stored `overridden`
 *      boolean per RESEARCH Anti-Patterns).
 *   3. Org/area SOP-target inheritance — a SOP-target grant made at the org
 *      or area tier still overrides the SOP for every descendant person in
 *      that chain, exactly like collection-target grants inherit today.
 *
 * Flipped LIVE in: 33-05 (files_modified: src/lib/org-model/__tests__/resolve-sop-access.test.ts)
 * — this Wave-0 version is a placeholder test.fixme ONLY until 33-05 lands
 * and src/lib/org-model/resolve-sop-access.ts exists; do not statically
 * import a module that doesn't exist yet (a missing-module resolution error
 * would break `--list` discovery for the whole phase32-unit project).
 *
 * Registration: auto-registered by playwright.config.ts's existing
 *   `phase32-unit` project (testDir: './src/lib/org-model/__tests__',
 *   testMatch: /.*\.test\.ts$/) — NO config edit required for this file.
 * Verify: `npx playwright test --list --project=phase32-unit`
 */
import { test, expect } from '@playwright/test'

test.describe('resolveSopEffectiveAccess — narrowing override rule (Wave 0 stub — flips live in 33-05)', () => {
  test.fixme(
    'a direct SOP-target grant on any subject tier overrides the collection; revoking the last one re-follows; org/area SOP-target grants still inherit down the chain',
    () => {
      /**
       * Real path constant this will assert against once built:
       *   - src/lib/org-model/resolve-sop-access.ts
       *     (exports resolveSopEffectiveAccess, pure, no DB/network access)
       *
       * Cases (once flipped live, mirrors resolve-access.test.ts's static
       * @/ import + ChainLink fixture style):
       * 1. A SOP has a collection-derived department; add a person-subject
       *    SOP-target grant -> the SOP resolves overridden, the collection
       *    tier is no longer consulted for this SOP.
       * 2. Revoke that grant (zero SOP-target grants remain) -> the SOP
       *    resolves back to following its collection (no stored flag).
       * 3. A SOP-target grant at the org tier (or area tier) still resolves
       *    as "overridden" for every person under that org/area in the
       *    chain, exactly like collection grants inherit today via
       *    resolveEffectiveAccess.
       */
      expect(true).toBe(true)
    },
  )
})
