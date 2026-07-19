---
phase: 33-per-sop-access-granularity-wayfinder-builder-header
verified: 2026-07-19T06:10:00Z
status: human_needed
score: 8/8 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 6/8
  gaps_closed:
    - "The new 'Tools for this SOP' menu (SC-6) is safe to expose — none of its actions can act cross-tenant (CR-01, deleteSop org-scope)"
    - "Resolver + materialization honor SOP-level targets with live runtime tests proving no stale visibility after revoke/override (SC-4, WR-02 all_departments restore)"
  gaps_remaining: []
  regressions: []
deferred: []
human_verification:
  - test: "On sopstart.com, open the SOP Access map (Admin > SOPs > Access) and expand a department all the way down: department -> role -> person. Confirm empty roles show a dashed, greyed-out chip for the vacancy that you cannot click."
    expected: "The teams column shows the full chain (site, area, department, role, person) opening one level at a time; a role with no one assigned shows a dashed placeholder that does nothing when clicked."
    why_human: "Visual rendering, hover/click feedback, and multi-level expand/collapse animation cannot be confirmed from source code alone — the automated check only proves the JSX/state exists, not that it looks and feels right in a real browser."
  - test: "On sopstart.com, click a collection in the Access map so it opens to show its SOPs, then click one individual SOP (not the whole collection). Choose one or two named people for that SOP only, and save."
    expected: "The collection opens to reveal its SOPs without needing a special link; clicking a SOP starts 'choose who sees this' for that SOP alone; after saving, that SOP shows a 'chosen by name' label instead of following the collection."
    why_human: "This is the core new capability of the phase (individual-SOP targeting) — needs a real click-through to confirm the drill-down opens smoothly and the save actually narrows access, not just that the code path exists."
  - test: "After granting a SOP to specific named people only, log in (or check) as a worker who is in the SOP's department but NOT one of the chosen people, and confirm the SOP no longer appears in their list. Then remove all the named people from that SOP and confirm it reappears for the whole department again."
    expected: "A department co-worker who isn't named loses access to that one SOP the moment it's narrowed; once all named people are cleared, the SOP is visible to the department again exactly as before — including for a SOP that pre-dates the Access map (had all_departments=true and no collection grant before the first override)."
    why_human: "This is the real-world trust promise of the feature ('only Dave and Priya see it') and touches worker-facing visibility, which needs a live end-to-end check, not just a database assertion. The WR-02 precondition is now covered by a passing live automated test, but a real click-through is still the highest-confidence check for worker-facing visibility."
    when_to_do: "before_next_phase"
  - test: "On sopstart.com, open the SOP builder for any SOP and read the header top to bottom, then open the 'Tools for this SOP' menu. Confirm 'Delete this draft' only appears for SOPs you own, and try deleting a SOP to confirm it actually removes it (test SOP only)."
    expected: "The header reads as a plain light bar showing where you came from, what you're editing, and what's next (with a plain-English reason if it's locked). The Tools menu lists all actions (assign, versions, video, QR, flow diagram, delete) with plain labels and no duplicate buttons elsewhere on the page. Delete works normally for your own org's SOPs."
    why_human: "Visual styling (light vs dark bar, spacing, colour of the lock-reason chip) can only be judged by eye — the automated check only proves the right strings, CSS classes, and org-scope guard are present in the code."
  - test: "In the Access map, click on a SOP and read the panel that appears below. Click on a person or team instead and read what appears."
    expected: "Selecting a SOP or collection answers 'Who can see this?' in plain sentences (e.g. 'Only 2 people can see this SOP — Dave and Priya, chosen by name'). Selecting a person or team flips to 'What can they see?'. No mention of 'grants', 'wiring', or 'UNWIRED' anywhere on screen."
    why_human: "Copy tone/clarity and the panel's content-switching behaviour on real data are UX judgment calls that automated string-absence checks can't fully validate."
---

# Phase 33: Per-SOP Access Granularity + Wayfinder Builder Header Verification Report

**Phase Goal:** Any org tier (site / area / department / role / person) can be granted access down to an INDIVIDUAL SOP — "only Dave and Priya see Pump Rebuild while Maintenance department sees the rest of the collection" — on an access map whose teams column shows the full org ladder, with plain-language copy throughout; plus the builder header becomes the Wayfinder bar (light schema, one self-describing tools menu). Closes Phase 32 UAT gaps G1/G2/G3.
**Verified:** 2026-07-19T06:10:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (plans 33-10, 33-11)

## Goal Achievement

**All code-level gaps from the prior verification (CR-01, WR-02) are confirmed closed by direct code reading this session.** Status is `human_needed` rather than `passed` strictly because the five human-verification items carried forward from the prior verification (visual/UX checks that source-reading cannot settle) remain unresolved — per the verification framework's own rule, "passed is ONLY valid when the human verification section is empty." This is not a new gap; it is the same standing UAT checklist from the initial verification, now updated to reflect that the underlying code bugs those checks would have surfaced (the delete hole, the visibility ratchet) are fixed.

### Observable Truths (ROADMAP Success Criteria SC-1..SC-6, plus the two review-identified gaps)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC-1 | Access map teams column shows site → area → department → role → person as expandable, selectable tiers | ✓ VERIFIED (spot-check, no code touched this session) | `WiringPatchBay.tsx` unchanged since prior verification; `teams-ladder.spec.ts` still registered and discoverable (12 source-contract + 1 runtime-fixme, same as before) |
| SC-2 | Collections expand in place to their SOPs; any SOP selectable for "choose who sees it" — no pinned `?sop=` URL required | ✓ VERIFIED (spot-check) | `sop-drilldown.spec.ts` unchanged, still registered |
| SC-3 | A grant can target an individual SOP from any subject tier; a SOP with people chosen by name STOPS following its collection (narrowing override) | ✓ VERIFIED (spot-check) | `resolve-sop-access.ts` confirmed byte-unchanged this session (per 33-11-SUMMARY.md, verified via empty `git diff`); unit tests still pass per executor run |
| SC-4 | Resolver + materialization honor SOP-level targets with live runtime tests proving org isolation and no stale visibility after revoke/override | ✓ VERIFIED — WR-02 gap closed | `materializeSopAccessForOrg` (`src/actions/grants.ts:446-534`) now reads `all_departments, all_departments_pre_override` at entry and implements a three-way write: (1) first override → snapshot `currentAllDepartments` into `all_departments_pre_override` and force `all_departments=false`; (2) subsequent override while already overridden → force `false` only, snapshot left untouched (`currentPreOverride === null` guard prevents clobbering); (3) re-follow (`!overridden && currentPreOverride !== null`) → restore `all_departments` from the snapshot and clear it to `null`. Confirmed by direct read of `grants.ts:521-534`, matching the WR-02 fix direction in `33-REVIEW.md` exactly. Migration `00051_sops_all_departments_pre_override.sql` adds the nullable snapshot column (additive, no backfill needed — no row was mid-override at migration time). New live test `tests/phase33/sop-grant-materialization.spec.ts:482` ("a pre-Phase-32 org-wide SOP (all_departments=true, no collection grant) regains visibility after override then revoke") exercises the EXACT precondition the original gap named — asserts `all_departments=false`/`pre_override=true` after override, then `all_departments=true`/`pre_override=null` after the last grant is revoked |
| SC-5 | Plain-language "Who can see this?" / "What can they see?" panel — no "grants"/"wire-up" jargon in UI copy | ✓ VERIFIED (spot-check) | `AccessAnswerPanel.tsx` unchanged this session |
| SC-6 | Builder header is the light-schema Wayfinder bar with ONE "Tools for this SOP" menu with self-describing labels, and every action in that menu is safe to expose | ✓ VERIFIED — CR-01 gap closed | `deleteSop` (`src/actions/sops.ts:340-369`) now fetches `{id, organisation_id}` for the target `sopId` via the admin client and returns `{ error: 'SOP not found' }` / `{ error: 'SOP belongs to another organisation' }` **before** any of the six service-role deletes (`sop_sections`, `parse_jobs`, `sop_assignments`, `video_generation_jobs`, `worker_notifications`, `sops`). Confirmed by direct read of `sops.ts:340-369` — guard is positioned first, right after `requireAdminContext()`/`ctx.organisationId` checks. `DeleteSopButton` confirmed still the only mount point (`BuilderStageShell.tsx:148`, grep-verified this session — no regression). New test `tests/phase33/delete-sop-org-scope.spec.ts` proves this two ways: (1) live cross-org attempt — ephemeral Org A admin tries to delete an ephemeral Org B SOP with a section + assignment row, gets rejected, and all three rows are confirmed to survive; (2) source-contract — asserts the guard's string-index precedes the first `sop_sections` delete call in the real function body (wiring-not-presence per the 2026-06-05 class), not just that the guard code exists somewhere in the file |

**Score:** 6/6 roadmap SCs verified; both previously-open gaps (CR-01 blocker, WR-02 warning) confirmed closed by direct code reading — reported as 8/8 must-haves (6 SCs + 2 gap-closure items). No open code-level gaps remain.

### Deferred Items

None.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/actions/sops.ts` (`deleteSop`) | org-ownership guard before all service-role deletes | ✓ VERIFIED | Guard reads `sops.organisation_id`, compares to `ctx.organisationId`, returns before any delete (lines 349-357) |
| `tests/phase33/delete-sop-org-scope.spec.ts` | live cross-org rejection + source-contract guard-ordering test | ✓ VERIFIED, discoverable | `npx playwright test --list --project=phase33` shows both cases (lines 107, 155); registered under the existing broad `phase33` testMatch, no config edit needed |
| `supabase/migrations/00051_sops_all_departments_pre_override.sql` | nullable snapshot column | ✓ VERIFIED, live-applied | File confirmed present, additive `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`; 33-11-PLAN.md Task 2 was a blocking human checkpoint requiring Management-API `information_schema` confirmation (bypasses PGRST205 schema-cache staleness per the 2026-06-15 learning) before Task 3/4 could proceed — 33-11-SUMMARY.md documents this as checkpoint-approved |
| `src/actions/grants.ts` (`materializeSopAccessForOrg`) | three-way snapshot/restore logic | ✓ VERIFIED | Lines 446-534: reads both flags, snapshots on first override, restores on re-follow, leaves snapshot untouched on repeat overrides |
| `tests/phase33/sop-grant-materialization.spec.ts` (new case) | live proof of the exact WR-02 precondition | ✓ VERIFIED, discoverable | Test at line 482, listed by `npx playwright test --list --project=phase33`; asserts the full override→revoke round trip on a legacy org-wide SOP |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| Tools menu "Delete this draft" | `deleteSop` server action | `DeleteSopButton` onClick | ✓ WIRED AND SAFE | Wiring confirmed unchanged (single call site); destination function now org-scoped — gap closed |
| `materializeSopAccessForOrg` | `sops.all_departments` / `all_departments_pre_override` | conditional `admin.from('sops').update(...)` | ✓ WIRED | Both the force-write and the restore-write are exercised by the live test; column read at function entry feeds the branch decision |
| (carried forward, unchanged) `createGrant` (sopId target) → `access_grants.sop_id` | XOR-validated insert, org-scope guard | ✓ WIRED | Not re-verified in depth this session (unchanged file); prior verification's evidence stands |
| (carried forward, unchanged) `enterWireUp(sopId)` → `createGrant({ sopId, ... })` | `handleDone` | ✓ WIRED | Not re-verified in depth this session (unchanged file); prior verification's evidence stands |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `deleteSop` guard | `sopRow.organisation_id` | live `admin.from('sops').select(...)` read, not cached/derived | Yes | ✓ FLOWING |
| `materializeSopAccessForOrg` restore branch | `currentPreOverride` | live `admin.from('sops').select('all_departments, all_departments_pre_override')` read at function entry | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

Not run as live HTTP/CLI checks — no standalone runnable endpoint outside the full Next.js app. Live-runtime Playwright suites against the real Supabase project serve this role; per task instructions, these were run by the gap-closure executors this session (green, evidence in 33-10-SUMMARY.md / 33-11-SUMMARY.md) and are not re-run by this verification pass.

### Probe Execution

No `scripts/*/tests/probe-*.sh` convention used by this project for Phase 33.

| Check | Command | Result | Status |
|-------|---------|--------|--------|
| `npx playwright test --list --project=phase33` | discoverability | 51 tests discovered across 7 spec files (was 48/6 at prior verification — 2 new tests in `delete-sop-org-scope.spec.ts` + 1 new case in `sop-grant-materialization.spec.ts`) | PASS |
| `npx tsc --noEmit` | full typecheck | clean, zero output | PASS |
| `deleteSop` org-scope check | manual read of `src/actions/sops.ts:340-369` | org-ownership guard present, positioned before all six deletes | **PASS — CR-01 closed** |
| `materializeSopAccessForOrg` restore-on-re-follow | manual read of `src/actions/grants.ts:446-534` | three-way snapshot/restore logic present, matches WR-02 fix direction | **PASS — WR-02 closed** |
| `DeleteSopButton` mount point | grep across `src/` | single mount point in `BuilderStageShell.tsx:148`, unchanged | PASS — no regression |
| `resolve-sop-access.ts` | git diff since prior verification | byte-unchanged (per 33-11-SUMMARY.md, independently spot-checked) | PASS — no regression |

### Requirements Coverage

`.planning/REQUIREMENTS.md` has no Phase 33 section — ROADMAP.md is the authoritative requirement source (SC-1..SC-6). No orphaned requirements.

| Requirement | Source Plan(s) | Description | Status | Evidence |
|--------------|----------------|--------------|--------|----------|
| SC-1 | 33-01, 33-06 | Full org ladder teams column | ✓ SATISFIED | Spot-checked, unchanged |
| SC-2 | 33-01, 33-08 | Collection→SOP drill-down, organic choose-mode | ✓ SATISFIED | Spot-checked, unchanged |
| SC-3 | 33-01, 33-02, 33-03, 33-05, 33-07 | SOP-target grants + narrowing override | ✓ SATISFIED | Spot-checked, unchanged |
| SC-4 | 33-01, 33-02, 33-03, 33-05, 33-07, 33-11 | Live-runtime resolver/materialization proof, no stale visibility | ✓ SATISFIED | WR-02 closed this session |
| SC-5 | 33-01, 33-09 | Plain-language panel, jargon sweep | ✓ SATISFIED | Spot-checked, unchanged |
| SC-6 | 33-01, 33-04, 33-10 | Wayfinder header + single tools menu, every action safe | ✓ SATISFIED | CR-01 closed this session |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/actions/sops.ts` | 340-369 | (RESOLVED) `deleteSop` now org-scoped | — | CR-01 closed |
| `src/actions/grants.ts` | 446-534 | (RESOLVED) `all_departments` snapshot/restore now two-way | — | WR-02 closed |
| `src/actions/departments.ts` | 338-346 | `orgScopedDeptIds` swallows query errors (WR-04, review) | ⚠️ Warning | Not touched by 33-10/33-11; carried forward per 33-REVIEW.md, out of this gap-closure's scope |
| `src/app/api/sops/ai-prompt/route.ts` | 50-51 | Department fields bypass Zod validation, result discarded (WR-05, review) | ⚠️ Warning | Not touched by 33-10/33-11; carried forward per 33-REVIEW.md, out of this gap-closure's scope |
| `src/components/admin/wiring/WiringPatchBay.tsx` | 183-188 | `sopParentCollection` keeps one arbitrary parent for multi-collection SOPs (WR-10, review) | ⚠️ Warning | Not touched by 33-10/33-11; carried forward per 33-REVIEW.md, out of this gap-closure's scope |
| `src/lib/journeys/journeys.ts` | 304 | `machine-qr` journey assigned to non-existent group (WR-07, review) | ℹ️ Info | Pre-existing, predates Phase 33, out of scope |

No `TBD`/`FIXME`/`XXX` unreferenced debt markers found in the two gap-closure key-files (`src/actions/sops.ts`, `src/actions/grants.ts`, `supabase/migrations/00051_sops_all_departments_pre_override.sql`, both new/modified test specs).

**Note on remaining WR-03/04/05/06/08/09/10 and IN-01..04 findings from 33-REVIEW.md:** these were explicitly out of scope for this gap-closure round (only CR-01 and WR-02 were named in the previous VERIFICATION.md's `gaps:` frontmatter and the gap-closure plans 33-10/33-11). They remain open lower-severity findings, not blockers to this phase's goal — carried forward as informational, consistent with the prior verification's classification (CR-01 blocker, WR-02 warning; the rest were warnings/info not gating phase completion).

### Human Verification Required

See YAML frontmatter `human_verification` for the structured list — unchanged in substance from the prior verification (visual/UX items that source-reading cannot settle), with the worker-visibility and Tools-menu items' wording updated to reflect that the underlying code-level gaps are now closed and the remaining work is a real-browser confidence check, not a known bug. This is the sole reason status is `human_needed` rather than `passed` — no code-level gap remains.

### Gaps Summary

Both gaps from the prior verification (commit `9b348db`, 6/8) are closed:

1. **CR-01 (deleteSop cross-tenant hole, blocker):** Closed in commits `8f93d2e` (guard) + `4d96728` (test). Direct code read confirms the org-ownership guard is fetched and compared before any of the six service-role deletes, exactly per the `33-REVIEW.md` fix. A live cross-org test proves an Org A admin cannot destroy an Org B SOP; a source-contract test proves the guard's position in the function body precedes the first delete call.
2. **WR-02 (all_departments one-way ratchet, warning):** Closed in commits `de78273` (migration), `736c37a` (fix), `6fcfc9c` (test). Direct code read of `materializeSopAccessForOrg` confirms the three-way snapshot/restore logic exactly matches the fix direction drafted in `33-REVIEW.md`. A new live test exercises the exact precondition the original finding named (pre-Phase-32 org-wide SOP, no collection grant) and proves visibility is restored, not left silently empty, after an override→revoke round trip.

All 6 roadmap Success Criteria (SC-1..SC-6) hold, both code-review-identified gaps intersecting the shipped surface are closed with real, tested, discoverable code (not just SUMMARY.md narrative — verified by direct reads of `src/actions/sops.ts`, `src/actions/grants.ts`, the new migration, and both test specs, plus `npx tsc --noEmit` clean and `npx playwright test --list --project=phase33` showing 51/51 tests including the 3 new ones). No regressions found in the unchanged surfaces spot-checked this session (DeleteSopButton mount point, resolve-sop-access.ts byte-identity). Phase goal is functionally achieved at the code level; status is `human_needed` (not `passed`) solely because the standing UAT checklist (5 items, unchanged in substance from the prior verification) has not yet been clicked through on sopstart.com. Remaining lower-severity review findings (WR-03/04/05/06/08/09/10, IN-01..04) are informational carry-forwards, not blockers, and were out of scope for this gap-closure round.

---

_Verified: 2026-07-19T06:10:00Z_
_Verifier: Claude (gsd-verifier)_
