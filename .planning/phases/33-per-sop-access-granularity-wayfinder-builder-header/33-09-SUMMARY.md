---
phase: 33-per-sop-access-granularity-wayfinder-builder-header
plan: 09
subsystem: ui
tags: [react, wiring-patch-bay, org-model, access-grants, plain-language, playwright, next.js]

# Dependency graph
requires:
  - phase: 33-05
    provides: "createGrant/revokeGrant SOP-target arm, narrowing-override semantics (materializeSopAccessForOrg)"
  - phase: 33-08
    provides: "Collection->SOP drill-down (expandedCollections), organic choose-mode (enterWireUp(sopId)/activeSop), rightEndpoint, sopGrantsByUnit + second resolver pass"
provides:
  - "SelectionStrip copy rewritten to plain, people-first language (idle onboarding line, selection/wiring headlines, ✓ Save — done button) — the 48px fixed-slot STRUCTURE (className template, unconditional mount, onClick={onDone}) stays byte-identical (Phase 32 SC-6 pixel-stability contract)"
  - "AccessAnswerPanel (NEW component) — 'Who can see this?' for a selected SOP/collection (chosen-by-name sentence + re-follow note when overridden; 'follows its collection' sentence when not), 'What can they see?' for a selected person/team — rendered below the bay, entirely from WiringPatchBay's existing accessByUnit/sopAccessByUnit/grants/peopleIndex memos (zero new fetches, no second resolver call)"
  - "WiringPatchBay jargon sweep: SOP row pills are now NEW (default) / CHOSEN BY NAME (overridden) — no UNWIRED/WIRED; meta text is 'follows collection' / 'N chosen by name' — no 'N grants'; saveError and bay-hint copy rewritten to plain language"
  - "PublishStage 'Wire up access' CTA relabelled 'Choose who sees it' (href unchanged)"
  - "tests/phase33/plain-language-access.spec.ts flipped live from the Wave-0 test.fixme stub — source-contract sweep for jargon absence + AccessAnswerPanel wiring proof"
  - "journeys.ts wire-up-access journey + PublishStage detail updated to the drill-down/plain-language/answer-panel flow; uat/tests.ts gained two Phase-33 entries (drill-down+panel readability, WR-02 Plenum Chamber closure) and a copy refresh on the stale Phase-32 entry"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Presentational answer-panel component fed by a single discriminated-union prop (AccessAnswerPanelData) computed in one useMemo in the parent — panel component itself has zero data-fetching or resolver logic"
    - "Panel target = connecting ? activeSopId : focus — one code path answers 'Who can see this?' whether the SOP is being actively wired or just selected, reusing the same sopById/grants/peopleIndex lookups"

key-files:
  created:
    - src/components/admin/wiring/AccessAnswerPanel.tsx
  modified:
    - src/components/admin/wiring/SelectionStrip.tsx
    - src/components/admin/wiring/WiringPatchBay.tsx
    - src/app/(protected)/admin/sops/builder/[sopId]/PublishStage.tsx
    - tests/phase32/banner-slot-stability.spec.ts
    - tests/phase32/wire-up-mode.spec.ts
    - tests/phase33/plain-language-access.spec.ts
    - src/lib/journeys/journeys.ts
    - src/lib/uat/tests.ts

key-decisions:
  - "Override trigger for the SOP pill collapsed to two states only (NEW / CHOSEN BY NAME) rather than three (NEW/WIRED/NEW·UNWIRED) — 'WIRED' was itself patch-bay-adjacent jargon not explicitly required by the acceptance criteria's grep, but kept out per the acceptance criteria's literal ban on any 'wire' substring in user-facing copy"
  - "AccessAnswerPanel computes people/name lists directly from the `grants` prop (not from rawEdges/rawSopEdges) for SOP/collection detail — rawEdges are per-unit RESOLVED access (would over-include every downstream unit reached by an org/area-level grant), whereas the panel needs the actual grant SUBJECTS to name ('Dave Hohaia and Priya Sharma, chosen by name')"
  - "Internal identifiers (createGrant, pending, grantCount prop name, SelectionStripState 'wiring' literal, testids) left unchanged per the plan's explicit scope — SC-5 is user-visible copy only; renaming internals would churn ~40 pinned literals for zero user value"
  - "Stale Phase-32 UAT entry (p32-wiring-access-view) copy refreshed in place rather than left historical — its tryIt steps quote exact button/banner text that changed this plan, and a stale UAT step would send a real non-technical reviewer looking for text that no longer exists (Rule 1 fix, out of the plan's explicit file list but same file already in files_modified)"

requirements-completed: [SC-5]

# Metrics
duration: ~45min
completed: 2026-07-19
---

# Phase 33 Plan 09: Plain-language access copy + AccessAnswerPanel Summary

**Every "grant"/"wire up"/"UNWIRED" string in the wiring UI replaced with people-first plain language, and a new AccessAnswerPanel answers "Who can see this?"/"What can they see?" below the access map from data the bay already computes — phase gate (phase32/phase32-unit/phase33, tsc, next build, pathways) all green.**

## Performance

- **Duration:** ~45 min
- **Completed:** 2026-07-19
- **Tasks:** 2
- **Files modified:** 9 (1 created, 8 modified)

## Accomplishments
- `SelectionStrip.tsx`: idle/selection/wiring copy rewritten to plain, people-first language ("Click a team, role or person to see what they can see · click a collection or SOP to choose who sees it"; "N people can see this."; "Choosing who sees X — ... N people can see it now."; "✓ Save — done") — the 48px fixed-slot structure (className template, unconditional `<div data-state=` mount, `onClick={onDone}`) is byte-identical, verified by the repointed `banner-slot-stability.spec.ts` structural pins
- `AccessAnswerPanel.tsx` (NEW): a discriminated-union `AccessAnswerPanelData` (`empty | sop | collection | unit`) rendered by one pure component; SOP/collection selection answers "Who can see this?" (naming subjects when overridden, "follows its collection" otherwise, with the emergent re-follow note); person/team selection flips to "What can they see?" listing reachable collections/SOPs
- `WiringPatchBay.tsx`: `subjectLabel`/`collectionPeople`/`sopDirectPeopleCount` helpers + one `panelData` useMemo feed the panel entirely from the shipped `accessByUnit`/`sopAccessByUnit`/`grants`/`peopleIndex` memos — zero new fetches, exactly two `resolveEffectiveAccess()` call sites (unchanged from 33-08); `renderSopRow` pills collapsed to `NEW` (default) / `CHOSEN BY NAME` (overridden), row meta text changed from "N grants" to "follows collection" / "N chosen by name"; `saveError` and `bay-hint` copy rewritten plain
- `PublishStage.tsx`: "Wire up access →" CTA relabelled "Choose who sees it →" (href/testid unchanged)
- `tests/phase33/plain-language-access.spec.ts` flipped live: asserts the rendered JSX bodies (doc comments stripped) of SelectionStrip/WiringPatchBay/PublishStage contain no UNWIRED/"Wire up"/"N grant(s)" text, and that AccessAnswerPanel is wired from the bay's existing memos (not a second resolver)
- `tests/phase32/banner-slot-stability.spec.ts` + `tests/phase32/wire-up-mode.spec.ts` repointed to the new copy/pill literals in the same commit as the source change
- `journeys.ts`/`uat/tests.ts` updated: `wire-up-access` journey now describes the drill-down + answer-panel flow; two new Phase-33 UAT entries (drill-down + plain-language panel readability; the WR-02 "Changing Plenum Chamber" closure step); the pre-existing Phase-32 UAT entry's `tryIt` steps refreshed off stale button/banner text

## Task Commits

1. **Task 1: Plain-language copy + AccessAnswerPanel** - `7c31803` (feat)
2. **Task 2: Repoint copy pins, flip SC-5 spec, journeys/uat, phase gate** - `318f50c` (test)

**Plan metadata:** (this commit)

## Files Created/Modified
- `src/components/admin/wiring/AccessAnswerPanel.tsx` - NEW presentational answer panel, one prop (`AccessAnswerPanelData`), four render branches (empty/sop/collection/unit)
- `src/components/admin/wiring/SelectionStrip.tsx` - copy sweep only, structural pins untouched
- `src/components/admin/wiring/WiringPatchBay.tsx` - panel-data helpers + memo, renderSopRow pill/meta rewrite, saveError/bay-hint copy, `<AccessAnswerPanel data={panelData} />` mount
- `src/app/(protected)/admin/sops/builder/[sopId]/PublishStage.tsx` - CTA relabel
- `tests/phase32/banner-slot-stability.spec.ts` - copy pins repointed, structural pins untouched
- `tests/phase32/wire-up-mode.spec.ts` - NEW/CHOSEN BY NAME pill pins repointed, fixme runtime-smoke text refreshed
- `tests/phase33/plain-language-access.spec.ts` - flipped live from Wave-0 test.fixme stub
- `src/lib/journeys/journeys.ts` - `wire-up-access` journey + PublishStage step detail updated
- `src/lib/uat/tests.ts` - two new Phase-33 entries + stale Phase-32 entry copy refresh

## Decisions Made
See `key-decisions` in frontmatter. Most consequential: the AccessAnswerPanel reads grant SUBJECTS directly from the `grants` prop rather than the resolved `rawEdges`/`rawSopEdges` arrays, because the panel needs to name who was chosen (not every downstream unit an inherited grant happens to reach) — this keeps the "chosen by name" sentence honest without adding a second resolver call.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Stale Phase-32 UAT entry quoted exact button/banner text that no longer exists**
- **Found during:** Task 2 (journeys/uat update)
- **Issue:** `p32-wiring-access-view`'s `tryIt` steps and a `questions` entry quoted the pre-33-09 copy verbatim ("Wire up access →", "NEW · UNWIRED", "Visible to N people via M grants", "✓ Done wiring") — a real reviewer following those steps post-ship would find none of that text on screen.
- **Fix:** Refreshed the `tryIt` steps and the `blast-radius-trust` question to the new copy; added a background note pointing to the new Phase-33 entries for current details.
- **Files modified:** `src/lib/uat/tests.ts` (already in files_modified for this plan)
- **Commit:** `318f50c` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 Rule 1 - stale copy)
**Impact on plan:** Minor, in-scope (same file already being edited this task). No scope creep.

## Issues Encountered
None.

## User Setup Required
None — no external service configuration required. The WR-02 "Changing Plenum Chamber" closure (picking the correct narrow department/person set for that one SOP) is intentionally left as a UAT step for a human operator to perform live on sopstart.com via the new UI — not something this plan should decide or write to prod on Simon's behalf.

## Next Phase Readiness
- SC-5 shipped: no grants/wire-up/UNWIRED language anywhere user-facing in the wiring UI; the access map answers "Who can see this?"/"What can they see?" in plain language.
- Phase gate green: `phase32` + `phase32-unit` + `phase33` projects all pass; full `npm run test` shows only pre-existing, unrelated stub failures (phase3/11/12.5/15/20/21-unit/26/29 stubs — none touch this plan's files); `npx tsc --noEmit` clean; `npm run build` clean (bundle +1KB, within ±2KB tolerance); `/pathways` 0 not-mapped (governance-fold.spec.ts).
- This is the final plan of Phase 33 (wave 5, no dependents) — SC-1 through SC-6 are now all satisfied across the phase per the plan's success criteria.

## Self-Check

- FOUND: `src/components/admin/wiring/AccessAnswerPanel.tsx`
- FOUND: `src/components/admin/wiring/SelectionStrip.tsx`
- FOUND: `src/components/admin/wiring/WiringPatchBay.tsx`
- FOUND: `src/app/(protected)/admin/sops/builder/[sopId]/PublishStage.tsx`
- FOUND: `tests/phase32/banner-slot-stability.spec.ts`
- FOUND: `tests/phase32/wire-up-mode.spec.ts`
- FOUND: `tests/phase33/plain-language-access.spec.ts`
- FOUND: `src/lib/journeys/journeys.ts`
- FOUND: `src/lib/uat/tests.ts`
- FOUND commit: `7c31803`
- FOUND commit: `318f50c`

## Self-Check: PASSED

---
*Phase: 33-per-sop-access-granularity-wayfinder-builder-header*
*Completed: 2026-07-19*
