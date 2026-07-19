---
phase: 33-per-sop-access-granularity-wayfinder-builder-header
verified: 2026-07-19T04:33:57Z
status: gaps_found
score: 6/8 must-haves verified (6 roadmap SC truths pass; 2 code-review-identified gaps intersect the shipped surface and are unresolved)
overrides_applied: 0
gaps:
  - truth: "The new 'Tools for this SOP' menu (SC-6) is safe to expose — none of its actions can act cross-tenant"
    status: failed
    reason: "deleteSop (src/actions/sops.ts:340-355) is the ONLY caller of DeleteSopButton, and DeleteSopButton's only mount point in the codebase is BuilderStageShell's new Tools-for-this-SOP menu (33-04). deleteSop authenticates via requireAdminContext() but never checks sopRow.organisation_id === ctx.organisationId before six service-role deletes (sop_sections, parse_jobs, sop_assignments, video_generation_jobs, worker_notifications, sops), filtered only by sop_id. Any admin of any org can pass an arbitrary sopId and permanently destroy another organisation's SOP. Confirmed still present in the current tree (not a stale review finding) — same class as CLAUDE.md [2026-06-15]/[2026-06-26]."
    artifacts:
      - path: "src/actions/sops.ts"
        issue: "deleteSop has zero org-scope check before 6 admin-client (service-role, RLS-bypassing) deletes; reachable in production via the exact Tools menu this phase built and shipped"
    missing:
      - "Fetch the SOP row first (id, organisation_id) via the admin client, verify it matches ctx.organisationId, return an error otherwise — before any delete runs (fix given in 33-REVIEW.md CR-01)"
  - truth: "Resolver + materialization honor SOP-level targets with live runtime tests proving no stale visibility after revoke/override (SC-4)"
    status: partial
    reason: "materializeSopAccessForOrg (src/actions/grants.ts:511-517) only ever force-writes sops.all_departments=false when overridden=true; there is no corresponding restore-to-true branch when the override resolves away (last SOP-target grant revoked). For a pre-Phase-32 org-wide SOP (all_departments=true at creation, no collection-level access_grants row — the default state for any org that has never opened the Access map), one override+revoke round trip leaves all_departments=false AND an empty replace-written sop_departments/sop_access_people — the SOP becomes invisible to every worker, silently, with no error surfaced. The shipped live-runtime test (tests/phase33/sop-grant-materialization.spec.ts:218) exercises the override->revoke->re-follow path only against a SOP created with all_departments:false plus a real collection-level department grant, so this specific precondition is untested and the AccessAnswerPanel's own promise ('Remove all named people and this SOP follows its collection again') is false for this case."
    artifacts:
      - path: "src/actions/grants.ts"
        issue: "one-way all_departments ratchet in materializeSopAccessForOrg (lines 511-517) — no restore path on re-follow"
    missing:
      - "Snapshot/restore the pre-override all_departments value, or detect 'resolves to zero departments AND zero people' on re-follow and refuse/warn instead of silently writing empty visibility (fix direction given in 33-REVIEW.md WR-02)"
deferred: []
human_verification:
  - test: "On sopstart.com, open the SOP Access map (Admin > SOPs > Access) and expand a department all the way down: department -> role -> person. Confirm empty roles show a dashed, greyed-out chip for the vacancy that you cannot click."
    expected: "The teams column shows the full chain (site, area, department, role, person) opening one level at a time; a role with no one assigned shows a dashed placeholder that does nothing when clicked."
    why_human: "Visual rendering, hover/click feedback, and multi-level expand/collapse animation cannot be confirmed from source code alone — the automated check only proves the JSX/state exists, not that it looks and feels right in a real browser."
  - test: "On sopstart.com, click a collection in the Access map so it opens to show its SOPs, then click one individual SOP (not the whole collection). Choose one or two named people for that SOP only, and save."
    expected: "The collection opens to reveal its SOPs without needing a special link; clicking a SOP starts 'choose who sees this' for that SOP alone; after saving, that SOP shows a 'chosen by name' label instead of following the collection."
    why_human: "This is the core new capability of the phase (individual-SOP targeting) — needs a real click-through to confirm the drill-down opens smoothly and the save actually narrows access, not just that the code path exists."
  - test: "After granting a SOP to specific named people only, log in (or check) as a worker who is in the SOP's department but NOT one of the chosen people, and confirm the SOP no longer appears in their list. Then remove all the named people from that SOP and confirm it reappears for the whole department again."
    expected: "A department co-worker who isn't named loses access to that one SOP the moment it's narrowed; once all named people are cleared, the SOP is visible to the department again exactly as before."
    why_human: "This is the real-world trust promise of the feature ('only Dave and Priya see it') and touches worker-facing visibility, which needs a live end-to-end check, not just a database assertion. NOTE: per the WR-02 gap above, this check should specifically also be tried on a SOP that pre-dates the Access map (has never been touched there) — that is the exact case likely to fail silently."
    when_to_do: "before_next_phase"
  - test: "On sopstart.com, open the SOP builder for any SOP and read the header top to bottom, then open the 'Tools for this SOP' menu."
    expected: "The header reads as a plain light bar showing where you came from, what you're editing, and what's next (with a plain-English reason if it's locked). The Tools menu lists all actions (assign, versions, video, QR, flow diagram, delete) with plain labels and no duplicate buttons elsewhere on the page."
    why_human: "Visual styling (light vs dark bar, spacing, colour of the lock-reason chip) can only be judged by eye — the automated check only proves the right strings and CSS classes are present in the code."
  - test: "In the Access map, click on a SOP and read the panel that appears below. Click on a person or team instead and read what appears."
    expected: "Selecting a SOP or collection answers 'Who can see this?' in plain sentences (e.g. 'Only 2 people can see this SOP — Dave and Priya, chosen by name'). Selecting a person or team flips to 'What can they see?'. No mention of 'grants', 'wiring', or 'UNWIRED' anywhere on screen."
    why_human: "Copy tone/clarity and the panel's content-switching behaviour on real data are UX judgment calls that automated string-absence checks can't fully validate."
---

# Phase 33: Per-SOP Access Granularity + Wayfinder Builder Header Verification Report

**Phase Goal:** Any org tier (site / area / department / role / person) can be granted access down to an INDIVIDUAL SOP — "only Dave and Priya see Pump Rebuild while Maintenance department sees the rest of the collection" — on an access map whose teams column shows the full org ladder, with plain-language copy throughout; plus the builder header becomes the Wayfinder bar (light schema, one self-describing tools menu). Closes Phase 32 UAT gaps G1/G2/G3.
**Verified:** 2026-07-19T04:33:57Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria SC-1..SC-6)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC-1 | Access map teams column shows site → area → department → role → person as expandable, selectable tiers | ✓ VERIFIED | `expandedDepts`/`expandedRoles` state, dept/role twist-open rendering, dashed non-clickable `isVacancy` chips, `leftEndpoint` nearest-collapsed-ancestor walk all present in `src/components/admin/wiring/WiringPatchBay.tsx` (confirmed by direct grep, not just spec claim). 12/12 `tests/phase33/teams-ladder.spec.ts` source-contract cases pass; 1 browser-runtime case is `test.fixme` (no chromium in this environment — Railway-only UAT convention) |
| SC-2 | Collections expand in place to their SOPs; any SOP selectable for "choose who sees it" — no pinned `?sop=` URL required | ✓ VERIFIED | `expandedCollections` state + `sopsByCollection` (fetched via one `.in('collection_id', ids)` join in `page.tsx`) confirmed; `enterWireUp` generalized to take a `sopId` param (grep-confirmed, not just renamed); `?sop=` demoted to a deep-link pre-select only. 12/12 `tests/phase33/sop-drilldown.spec.ts` source-contract cases pass; 1 browser-runtime case `test.fixme` |
| SC-3 | A grant can target an individual SOP from any subject tier; a SOP with people chosen by name STOPS following its collection (narrowing override) | ✓ VERIFIED (see gap below for the revoke/re-follow edge case) | `createGrant` XOR `collectionId`/`sopId` + org-scope guard, `resolveSopAccess` override branch, `all_departments=false` force-write all confirmed in `src/actions/grants.ts` + `src/lib/org-model/resolve-sop-access.ts`. 8/8 unit cases in `resolve-sop-access.test.ts` pass (incl. org/area/dept-tier override + inheritance + last-grant-revoked re-follow for the tested precondition) |
| SC-4 | Resolver + materialization honor SOP-level targets with live runtime tests proving org isolation and no stale visibility after revoke/override | ⚠️ PARTIAL — see gap | Live ephemeral-org tests (`tests/phase33/sop-grant-materialization.spec.ts`, `sop-grant-schema.spec.ts`) pass 100% (override, sibling isolation, revoke re-follow, cross-org rejection, `assignSopDepartments` overridden-from-birth) for their tested preconditions. A real, code-confirmed gap exists for one untested precondition (pre-Phase-32 org-wide SOP, no collection grant) — see Gaps below (WR-02) |
| SC-5 | Plain-language "Who can see this?" / "What can they see?" panel — no "grants"/"wire-up" jargon in UI copy | ✓ VERIFIED | Grepped all rendered JSX text (not just prop/comment names) in `WiringPatchBay.tsx`, `SelectionStrip.tsx`, `AccessAnswerPanel.tsx`, `PublishStage.tsx` for grant/wire up/UNWIRED literals in visible strings — zero hits. `AccessAnswerPanel` fed live from `WiringPatchBay`'s existing `accessByUnit`/`grants`/`peopleIndex` memos (no new fetch, no hardcoded panel data). 9/9 `plain-language-access.spec.ts` cases pass |
| SC-6 | Builder header is the light-schema Wayfinder bar with ONE "Tools for this SOP" menu with self-describing labels | ✓ VERIFIED (menu itself) — see gap for a reachable pre-existing vulnerability | "Tools for this SOP" single menu confirmed via grep in `BuilderStageShell.tsx` (`aria-label`, visible text). All 4 referenced CSS tokens (`--ink-100`, `--paper-2`, `--accent-ok` declared; `--brand-yellow` used with an explicit fallback, per the 2026-07-14 learning) confirmed declared or safely-defaulted. `tests/lint/no-undefined-css-tokens.spec.ts` passes. 7/7 `wayfinder-header.spec.ts` cases pass |

**Score:** 6/6 roadmap SCs individually pass their own stated wording; 2 gaps found in the surface those SCs ship (see Gaps below) — reported as 6/8 must-haves.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/00050_access_grants_sop_target.sql` | nullable `sop_id` arm + XOR check + index swap | ✓ VERIFIED, live | Applied to live Supabase DB (33-03 checkpoint, human-approved); `tests/phase33/sop-grant-schema.spec.ts` live-pg-introspection cases confirm `access_grants_exactly_one_target`, `uq_access_grants_subject_target` present and `uq_access_grants_subject_collection` gone, on the real database (not schema-cache-dependent REST reads) |
| `src/lib/org-model/resolve-sop-access.ts` | pure override-rule helper | ✓ VERIFIED | Exists, unit-tested (8 cases), imported by `grants.ts`, NOT a `'use server'` export (avoids the 2026-06-27 sync-export trap) |
| `src/components/admin/wiring/AccessAnswerPanel.tsx` | plain-language "Who can see this?"/"What can they see?" panel | ✓ VERIFIED | Exists, wired into `WiringPatchBay` render tree (`<AccessAnswerPanel data={panelData} />`), fed by real memoized data (Level 4 trace confirmed — no hardcoded content) |
| `src/app/(protected)/admin/sops/builder/[sopId]/BuilderStageShell.tsx` | Wayfinder bar + Tools menu | ✓ VERIFIED | Component name kept (6 pinned specs stay green), header rebuilt, single menu confirmed |
| `src/actions/departments.ts` (`assignSopDepartments`) | rewired through SOP-target grants, no direct `sop_departments` insert | ✓ VERIFIED | `grep -rn "sop_departments" src/` shows the only remaining runtime insert is inside the grant materializer itself (per 33-REVIEW.md); wizard + ai-prompt route both funnel through `assignSopDepartments` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `createGrant` (sopId target) | `access_grants.sop_id` | XOR-validated insert, org-scope guard | ✓ WIRED | Live cross-tenant rejection test passes (`sop-grant-schema.spec.ts:147`, real insert attempt, zero rows written) |
| `materializeSopAccessForOrg` | `resolveEffectiveAccess` (unchanged) | called twice — collection-target + SOP-target grants | ✓ WIRED | `resolveEffectiveAccess` byte-unchanged (pinned by `teams-ladder.spec.ts:112`); sentinel-keyed second pass confirmed in `grants.ts` |
| `page.tsx` `sopsByCollection`/`deptMembers` | `WiringPatchBay` → `AccessAnswerPanel` | props, one dependent Promise.all read | ✓ WIRED | Level 4 trace: DB query → props → memo → panel render, no hardcoded fallback found |
| Tools menu "Delete this draft" | `deleteSop` server action | `DeleteSopButton` onClick | ⚠️ WIRED BUT UNSAFE | Wiring itself works (confirmed reachable, single call site); the destination function has no org-scope check — see Gaps |
| `enterWireUp(sopId)` (any SOP row) | `createGrant({ sopId, ... })` | `handleDone` | ✓ WIRED | Confirmed generalized away from the single pinned `newSop`; `sop-drilldown.spec.ts:88` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `AccessAnswerPanel` | `panelData` (`AccessAnswerPanelData`) | `useMemo` over `accessByUnit`/`sopAccessByUnit`/`grants`/`peopleIndex`/`sopsByCollection`, all sourced from `page.tsx` DB reads | Yes | ✓ FLOWING |
| `WiringPatchBay` teams column | `tree` (org ladder) | `listOrgTree()` server call in `page.tsx` | Yes | ✓ FLOWING |
| `WiringPatchBay` SOP rows | `sopsByCollection` | one `.in('collection_id', ids)` join read in `page.tsx` | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

Not run as live HTTP/CLI checks — this phase has no standalone runnable endpoint outside the full Next.js app; live-runtime Playwright suites against the real Supabase project (see below) serve this role instead.

### Probe Execution

No `scripts/*/tests/probe-*.sh` convention used by this project; the phase's equivalent is `scripts/assert-phase33-sop-target-schema.ts --capture/--verify`, which was already executed live in 33-03 (documented result: 10/10 pre-existing rows byte-identical, sop_id null) and is not re-run here since it targets a one-time migration event, not a recurring gate.

| Check | Command | Result | Status |
|-------|---------|--------|--------|
| `npx playwright test --list --project=phase33` | discoverability | 48 tests discovered across 6 spec files | PASS |
| `npx playwright test --project=phase33` | full phase33 run | 46 passed, 2 skipped (`test.fixme` browser-runtime halves, no chromium) | PASS |
| `npx playwright test --project=phase32 --project=phase30` | regression | 97 passed, 7 skipped (same browser-runtime class) | PASS |
| `npx playwright test --project=phase32-unit` | unit | 18 passed (incl. 8 `resolve-sop-access` cases) | PASS |
| `npx tsc --noEmit` | full typecheck | clean, zero output | PASS |
| `npm run build` | production build | clean; bundle-size/isolation postbuild checks all pass | PASS |
| `tests/phase30/governance-fold.spec.ts` "pathways coverage — 0 not-mapped" | route-coverage gate | passes | PASS |
| jargon grep across rendered JSX (`WiringPatchBay`, `SelectionStrip`, `AccessAnswerPanel`, `PublishStage`) | manual | zero hits for grant/wire up/UNWIRED in visible text | PASS |
| `tests/lint/no-undefined-css-tokens.spec.ts` | CSS token guard | passes | PASS |
| `deleteSop` org-scope check | manual read of `src/actions/sops.ts:340-355` | no `organisation_id` check present before 6 admin-client deletes | **FAIL — see Gaps** |
| `materializeSopAccessForOrg` restore-on-re-follow | manual read of `src/actions/grants.ts:511-517` | `all_departments` only ever force-set to `false`, never restored to `true` | **PARTIAL — see Gaps** |

### Requirements Coverage

`.planning/REQUIREMENTS.md` has no Phase 33 section — the phase declaration in ROADMAP.md explicitly states "Requirements: SC-1..SC-6 (the success criteria below serve as the requirement IDs; every plan's frontmatter references them)", so ROADMAP.md is the authoritative requirement source for this phase (no separate REQUIREMENTS.md cross-reference exists to check against).

| Requirement | Source Plan(s) | Description | Status | Evidence |
|--------------|----------------|--------------|--------|----------|
| SC-1 | 33-01, 33-06 | Full org ladder teams column | ✓ SATISFIED | See Observable Truths above |
| SC-2 | 33-01, 33-08 | Collection→SOP drill-down, organic choose-mode | ✓ SATISFIED | See Observable Truths above |
| SC-3 | 33-01, 33-02, 33-03, 33-05, 33-07 | SOP-target grants + narrowing override | ✓ SATISFIED | See Observable Truths above |
| SC-4 | 33-01, 33-02, 33-03, 33-05, 33-07 | Live-runtime resolver/materialization proof | ⚠️ PARTIAL | WR-02 edge case untested/broken |
| SC-5 | 33-01, 33-09 | Plain-language panel, jargon sweep | ✓ SATISFIED | See Observable Truths above |
| SC-6 | 33-01, 33-04 | Wayfinder header + single tools menu | ✓ SATISFIED (menu correctness); unsafe action reachable (CR-01) | See Observable Truths + Gaps |

No orphaned requirements found — every SC-1..SC-6 is claimed by at least one plan's `requirements:` frontmatter, and all 9 plans' declared requirement sets are a subset of SC-1..SC-6.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/actions/sops.ts` | 340-355 | `deleteSop` — no org-scope check before 6 service-role deletes | 🛑 Blocker | Any admin of any org can delete another org's SOP + all its data by guessing/enumerating a `sopId`; reachable from this phase's shipped Tools menu (only call site) |
| `src/actions/grants.ts` | 511-517 | One-way `all_departments` ratchet — never restored on re-follow | ⚠️ Warning | Pre-Phase-32 org-wide SOPs (no collection grant) become permanently, silently invisible to all workers after one override+revoke round trip |
| `src/actions/departments.ts` | 338-346 | `orgScopedDeptIds` swallows query errors — replace-write semantics turn a read failure into silent access narrowing (WR-04, review) | ⚠️ Warning | Not independently re-verified this session beyond the code-review finding; carried forward as still-present per 33-REVIEW.md (file not touched since review) |
| `src/app/api/sops/ai-prompt/route.ts` | 50-51 | Department fields bypass Zod validation, result of `assignSopDepartments` discarded (WR-05, review) | ⚠️ Warning | Carried forward per 33-REVIEW.md, not independently re-verified this session |
| `src/components/admin/wiring/WiringPatchBay.tsx` | 183-188 | `sopParentCollection` keeps one arbitrary parent for multi-collection SOPs (WR-10, review) | ⚠️ Warning | "Who can see this?" people-count can undercount for SOPs in 2+ collections; carried forward per 33-REVIEW.md |
| `src/lib/journeys/journeys.ts` | 304 | `machine-qr` journey assigned to non-existent group (WR-07, review) | ℹ️ Info | Pre-existing bug (introduced commit `6cb8290`, predates Phase 33) — confirmed via `git log -S` NOT touched by any Phase 33 commit; out of this phase's scope, not a Phase 33 regression |

No `TBD`/`FIXME`/`XXX` unreferenced debt markers found in any Phase 33 key-file (checked via the file lists in each SUMMARY.md's `key-files` section).

### Human Verification Required

See YAML frontmatter `human_verification` for the structured list. In summary, five items need a real click-through on sopstart.com (Railway-only UAT convention — no local dev instructions apply): the teams-column ladder rendering/vacancy chips, the collection→SOP drill-down and per-SOP choose-mode, an end-to-end worker-visibility check (explicitly including a pre-existing org-wide SOP, to directly probe the WR-02 gap), the Wayfinder header/Tools menu visual read, and the plain-language answer panel copy.

### Gaps Summary

Every literal SC-1..SC-6 wording in ROADMAP.md is satisfied by real, wired, tested code — this is not a stub/placeholder phase, and the 46/46 runnable phase33 tests plus the full phase32/phase30 regression suite, `tsc --noEmit`, and `next build` are all clean. However, two gaps intersect the exact surfaces this phase ships and were confirmed by direct code reading (not just carried from the review doc):

1. **`deleteSop` cross-tenant hole (CR-01, blocker):** the phase's new single "Tools for this SOP" menu (SC-6's own deliverable) is the only place `DeleteSopButton` mounts, and it calls a `deleteSop` action with zero organisation check before six service-role deletes. This was introduced before Phase 33 but ships live, unfixed, inside this phase's rebuilt header. This is the same class of bug logged three times already in this project's CLAUDE.md Learnings ([2026-06-15], [2026-06-26], [2026-07-05]) — recommend a same-day follow-up fix (the patch is a 4-line guard, given verbatim in 33-REVIEW.md CR-01) before/immediately after this phase closes, given Railway auto-deploys from master.
2. **Re-follow visibility gap (WR-02, warning):** the "no stale visibility after revoke/override" half of SC-4 is proven true for every precondition the shipped live tests exercise, but a real, common precondition (a SOP created before Phase 32 ever ran, `all_departments=true`, never wired into a collection grant) silently loses ALL visibility — the opposite direction of "stale" but still a genuine violation of the phase's own re-follow promise ("Remove all named people and this SOP follows its collection again" — AccessAnswerPanel copy). Recommend either a snapshot/restore of the pre-override `all_departments` value or a refuse-and-warn guard, per 33-REVIEW.md WR-02's suggested fix.

Both items are narrow, well-understood, and already have fixes drafted in `33-REVIEW.md` — this reads as "phase substantially done, two focused closure items outstanding" rather than a missed goal. Recommend a short closure plan (`/gsd-plan-phase --gaps`) rather than re-running phase 33 broadly.

---

_Verified: 2026-07-19T04:33:57Z_
_Verifier: Claude (gsd-verifier)_
