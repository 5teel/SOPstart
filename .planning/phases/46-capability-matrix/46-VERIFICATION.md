---
phase: 46-capability-matrix
verified: 2026-08-25T00:00:00Z
status: passed
score: 8/8 must-haves verified (gap closed same-session)
overrides_applied: 0
gaps:
  - truth: "The Capability Matrix document accurately reflects the current RLS/guard state (its own stated promise: 'this file changes in the same commit' as any RLS/guard change)"
    status: partial
    reason: "Migrations 00064 (CR-02 fix) and 00065 (WR-04 fix) landed AFTER .planning/codebase/CAPABILITY-MATRIX.md was written by plan 46-02, and the doc was never updated in the review-fix commits (ecbff27, 600cfb3, 549a759). Two places are now stale: (1) the 'Edit SOP content' row's 'Enforced at' column names only admins_can_manage_sections/_steps/_images — it omits the sop_section_blocks (ssb_admin_manage_own_org, migration 00064) backstop that now also carries the owner-OR-role arm. (2) 'Findings — shipped-but-unenforced' item 3 states 'the app-level guard ... is the only enforcement for block-junction writes; RLS provides no backstop here' — this is now FALSE; migration 00064 added exactly that backstop, and the live junction probes in sop-edit-owner-access.spec.ts prove it (RLS returns zero rows to a non-owner even if the app guard were bypassed)."
    artifacts:
      - path: ".planning/codebase/CAPABILITY-MATRIX.md"
        issue: "Line ~41 'Edit SOP content' Enforced-at cell and Finding #3 (line ~104) do not reflect migration 00064's RLS extension to sop_section_blocks"
    missing:
      - "Update the 'Edit SOP content' row's Enforced-at column to also name ssb_admin_manage_own_org (migration 00064) alongside the three 00063 policies"
      - "Correct or retire Finding #3 to state that RLS now DOES back up the app guard on sop_section_blocks as of migration 00064, or reframe it as a closed finding with the fix migration cited"
---

# Phase 46: Capability Matrix Verification Report

**Phase Goal:** One written role × capability matrix is the single reference for who can see and do what, and sign-off authority carries edit rights in code, not just in the document.
**Verified:** 2026-08-25
**Status:** passed (gap closed same-session, doc gate re-run green)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | `.planning/codebase/CAPABILITY-MATRIX.md` exists, covers all roles × all 22 capabilities, both access/obligation channels, legend | ✓ VERIFIED | File read in full — 22 capability rows, 4 org roles + `platform_admin` footnote + dept-role footnote, both channels defined, 3 legend markers, Findings section, Planned capabilities table with 5 forward phase markers |
| 2 | CLAUDE.md points to the matrix as the authority with a maintenance trigger | ✓ VERIFIED | `CLAUDE.md:102-109` `## Capability Matrix` section names the doc path, states the access/obligation split, 3-bullet maintenance trigger mirroring the Pathways Map convention |
| 3 | The matrix document is itself accurate/current against the shipped code (its own promise: updates in the same commit as any RLS/guard change) | ✗ FAILED (partial) | Migrations 00064/00065 (CR-02/WR-04 review fixes) postdate the doc; Finding #3 and the "Edit SOP content" Enforced-at cell are now stale re: `sop_section_blocks` RLS backstop — see gap above |
| 4 | `requireSopEditAccess` exists, derives org from the SESSION (never the fetched row), resolves sopId/sectionId/junctionId | ✓ VERIFIED | `src/lib/auth/guards.ts:63-120` — `.eq('organisation_id', organisationId)` uses session value; `grep -n "sop.organisation_id"` finds nothing |
| 5 | The guard is CALLED (not just present) at all 9 enumerated content-write paths, and does NOT leak into verify/publish-adjacent functions | ✓ VERIFIED | `tests/phase46/sop-edit-guard-wiring.spec.ts` slices function bodies (not file-level grep) — all 9 positive + 4 negative assertions pass live (`npx playwright test --project=phase46` → 30/30 green) |
| 6 | The `serviceRole` wire-reachable bypass (CR-01) is gone; parser routes through a non-server core module | ✓ VERIFIED | `AddBlockToSectionInput` has no `serviceRole` field; `src/lib/builder/section-blocks-core.ts` has no `'use server'` directive; `src/lib/parsers/parsed-sop-to-layout-data.ts:43` imports `addBlockToSectionAsService`; guard-wiring spec pins this structurally |
| 7 | Migrations 00063/00064/00065 exist, owner arm nested INSIDE org-scope AND (not a sibling policy), junction policy restates the full predicate in both USING and WITH CHECK, applier includes all three in order with structural (not token-presence) assertions | ✓ VERIFIED | All 3 migration files read in full and match the review's claimed shapes exactly; `scripts/apply-phase46-migration.mjs` `MIGRATION_FILES` array lists 00063→00064→00065 in order, `NESTED_OWNER_ARM` regex asserts structural nesting (not token presence — the WR-01 fix), `withCheck: 'equals-qual'` branch pins byte-identical USING/WITH CHECK for the junction policy |
| 8 | Live RLS probes cover positive AND negative per role across sections/steps/images/junction (2026-07-20 rule), registered and executable | ✓ VERIFIED | `npx playwright test --list --project=phase46` lists 30 tests across 3 files; `npx playwright test --project=phase46` run live against the real Supabase project — **all 30 passed**, including all 12 live-RLS probes (not skipped — 445ms-1.2s durations confirm real network round-trips, not `test.skip`) |

**Score:** 7/8 truths fully verified (1 partial — documentation drift, not a functional gap)

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `.planning/codebase/CAPABILITY-MATRIX.md` | Role × capability authority doc | ✓ VERIFIED (content stale in 1 place) | 121 lines, all required sections present |
| `CLAUDE.md` § Capability Matrix | Pointer + maintenance trigger | ✓ VERIFIED | Present, correctly placed before Pathways Map Maintenance |
| `src/lib/auth/guards.ts` → `requireSopEditAccess` | Object-level edit guard | ✓ VERIFIED | Exists, correct resolution/org-scope/role logic |
| `src/actions/sections.ts` (4 fns) | Guard wired | ✓ VERIFIED | All 4 call `requireSopEditAccess(` inside their own body |
| `src/actions/sop-section-blocks.ts` (4 fns) | Guard wired, serviceRole bypass removed | ✓ VERIFIED | All 4 call the guard; `serviceRole` field gone from schema |
| `src/app/api/sops/[sopId]/sections/[sectionId]/route.ts` | Guard wired (previously zero app-level guard) | ✓ VERIFIED | `requireSopEditAccess({ sopId })` is the first statement in `PATCH`, before body parsing |
| `src/lib/builder/section-blocks-core.ts` | Non-server core + service entry point | ✓ VERIFIED | No `'use server'` directive; `addBlockToSectionAsService` exported and imported by the parser |
| `supabase/migrations/00063/00064/00065` | Owner-OR-role RLS extension + row-count RPC fix | ✓ VERIFIED | All three read and match claimed shapes |
| `scripts/apply-phase46-migration.mjs` | Live applier + structural pg_policies assertions | ✓ VERIFIED | `MIGRATION_FILES` in order; structural nesting regex (not substring) |
| `tests/phase46/*.spec.ts` (3 files, 30 tests) | Doc gate + wiring gate + live probes | ✓ VERIFIED | Registered (`--list` confirms), all green live |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `playwright.config.ts` | `tests/phase46/*.spec.ts` | `phase46` project testMatch | ✓ WIRED | `--list` returns 30 tests across 3 files |
| `src/actions/sections.ts` | `src/lib/auth/guards.ts` | `requireSopEditAccess(` in every content-write fn | ✓ WIRED | Confirmed by function-body-slice source-contract spec, live-green |
| `src/actions/sop-section-blocks.ts` | `src/lib/auth/guards.ts` | `requireSopEditAccess(` in 4 user-triggered fns | ✓ WIRED | Same |
| `src/lib/parsers/parsed-sop-to-layout-data.ts` | `src/lib/builder/section-blocks-core.ts` | `addBlockToSectionAsService` import | ✓ WIRED | Confirmed by grep + guard-wiring spec assertion |
| `supabase/migrations/00063-65` | live database | `scripts/apply-phase46-migration.mjs` | ✓ WIRED | Not just claimed — the live probe suite (12 real-RLS tests) exercises the deployed policies end-to-end and all pass |
| `.planning/codebase/CAPABILITY-MATRIX.md` | `src/lib/auth/guards.ts`, migrations | "Enforced at" column | ⚠ PARTIAL | Correct for sections/steps/images; incomplete for the block-junction row (see gap) |

### Data-Flow Trace (Level 4)

Not applicable — this phase is authorization/RLS logic, not a UI data-rendering surface. The equivalent "does the enforcement actually apply to real data" check is the live RLS probe suite (Behavioral Spot-Checks below), which is the strongest form of Level 4 verification available for this domain: real ephemeral orgs, real JWTs, real Postgres RLS evaluation, re-read via a service client that bypasses caching/optimistic-response tricks.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| All phase46 specs registered | `npx playwright test --list --project=phase46` | 30 tests, 3 files | ✓ PASS |
| Guard wiring + doc gate + live RLS probes all green | `npx playwright test --project=phase46` | 30/30 passed, 15.5s, 0 skipped | ✓ PASS |
| Owner can edit sections/steps/images/junctions on own SOP; non-owner cannot; admin unaffected; cross-org denied; publish denied to owner | Live RLS probes (12 of the 30 tests, real Supabase) | All 12 passed against the live deployed database | ✓ PASS |
| RLS lint guards (org-scope, sops-select-policy) still green after migrations 00063-65 | `npx playwright test tests/lint/rls-org-scope.spec.ts tests/lint/sops-select-policies-org-scoped.spec.ts` | 5/5 passed | ✓ PASS |
| Type-checking clean | `npx tsc --noEmit` | No output (clean) | ✓ PASS |
| Production build clean (mandatory gate whenever `src/actions/*` changes) | `npm run build` | Build succeeded, bundle-size checks passed | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` shell probes exist for this phase — verification is via the Playwright `phase46` project (live Supabase probes), executed above under Behavioral Spot-Checks. This satisfies the intent of Step 7c (probes actually run by the verifier, not narrated from a summary).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| CAP-01 | 46-01, 46-02 | One written role × capability matrix is the single reference | ✓ SATISFIED (with a noted drift) | Doc exists, comprehensive, CLAUDE.md points to it, gate is live and mutation-proven — but the doc itself has drifted from the current tree on one point (see gap) |
| CAP-02 | 46-01, 46-03 | Sign-off authority (`owner_user_id`) carries edit rights in code | ✓ SATISFIED | `requireSopEditAccess` + migrations 00063/00064/00065 verified live; all 9 write paths wired; 12 live RLS probes prove positive/negative/regression/cross-org/scope-containment |

Both requirement IDs from the PLAN frontmatter (`[CAP-01, CAP-02]` across 46-01/46-02/46-03) are accounted for against `.planning/REQUIREMENTS.md` §v9.0 (lines 849-852, 891). No orphaned requirements found for this phase.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `.planning/codebase/CAPABILITY-MATRIX.md` | ~41, ~104 | Doc drift — Finding #3 and one Enforced-at cell no longer match shipped RLS | ⚠ Warning | Misleads a future reader into believing block-junction writes have no RLS backstop, when migration 00064 added one; low functional risk (the code is correct and tested), but undermines the doc's stated single-source-of-truth guarantee |
| `src/actions/sections.ts:103` | 103 | Stale comment: "(defence-in-depth with the explicit admin role check below)" — the check is now `requireSopEditAccess`, not admin-only | ℹ Info | Same class as REVIEW.md IN-01 (already identified, explicitly deferred by the review-fix pass as info-level; not re-raised as a new blocker here) |
| `src/app/api/sops/[sopId]/sections/[sectionId]/route.ts` | 35 | All guard failures (including "Not authenticated") map to HTTP 403; 401 would be more correct for the unauthenticated case | ℹ Info | Same as REVIEW.md IN-02, already identified and explicitly deferred (low impact, functionally covered) |

No TBD/FIXME/XXX debt markers found in any file modified by this phase.

### Human Verification Required

None. Every truth in this phase is mechanically verifiable (source-contract wiring, live RLS behavior, doc content) and was verified directly against the live database and the current tree — no UI/visual/real-time surface exists in this phase (CONTEXT.md explicitly notes "no route work").

### Gaps Summary

Phase 46 fully achieves its functional goal: `requireSopEditAccess` is wired at all 9 content-write paths, migrations 00063/00064/00065 are live on the real database, and 30/30 Playwright tests pass against real RLS (12 of them live probes covering positive/negative/regression/cross-org/scope-containment). The two CR-level and four WR-level findings from `46-REVIEW.md` are all confirmed fixed in the current tree — `serviceRole` bypass removed, block-junction RLS extended (migration 00064), structural (not token-presence) applier assertions, PATCH route step-containment + validation, and zero-row writes now error instead of lying `{ success: true }`.

The one gap found is documentation drift: `.planning/codebase/CAPABILITY-MATRIX.md` was written by plan 46-02 before the review-fix pass added migration 00064, and was never updated to reflect it — even though the matrix's own stated rule (and CLAUDE.md's mirrored maintenance trigger) says an RLS change updates the matrix "in the same commit." Finding #3 in the matrix now asserts something the code no longer does (no RLS backstop on block junctions), and the "Edit SOP content" row's Enforced-at column is missing the block-junction policy. This is a small, precisely-scoped documentation fix (no code or migration change needed) — recommended before closing the phase, since accuracy is CAP-01's entire reason to exist.

---

_Verified: 2026-08-25_
_Verifier: Claude (gsd-verifier)_


## Gap Closure (2026-08-25, same session)

The single gap (CAPABILITY-MATRIX.md drift re: migration 00064) was closed by the orchestrator immediately after verification:
- "Edit SOP content" Enforced-at cell now names `ssb_admin_manage_own_org` (00064, full predicate in USING and WITH CHECK) alongside the three 00063 policies
- Finding #3 rewritten as CLOSED — records that the original "no RLS backstop on block junctions" claim was true when written and is no longer true
- `npx playwright test tests/phase46/capability-matrix-doc.spec.ts --project=phase46` re-run: 9/9 passed

Status flipped gaps_found → passed accordingly. All 8 must-haves now verified.


## A1 Resolution (2026-08-25)

Simon resolved CAP-02 assumption A1: **sign-off authority = approval-chain approvers** (Phase 29 `approval_chains`/`sop_approvals`), NOT `sops.owner_user_id`. The predicate was flipped everywhere it lived, in the same session. Accepted consequence (chosen knowingly): a SOP whose category has no configured chain has zero people with sign-off-derived edit rights — only admin/safety_manager can edit it.

**Changes and commits:**

| Item | Commit |
|---|---|
| `requireSopEditAccess` grants via `approval_chains` step match (`stepMatchesCaller`, keyed on session org + `sops.category_slug`); wiring spec repointed same commit | `62247bb` |
| Migration `00066_sign_off_approver_edit.sql` — `is_sop_sign_off_approver()` (SECURITY DEFINER, self-scoping via `auth.uid()`/`current_organisation_id()`/`current_user_role()`) replaces the owner arm in all four content policies (nested inside the org AND; junction policy restates full predicate in USING + WITH CHECK); applier appends 00066 + repoints structural assertions + pins every helper security clause | `89ebb3b` |
| Live probes re-fixtured to the approver model (userId-step + role-step positives, owner-now-denied flip probe, non-approver/no-chain denies, admin regression, publish containment, cross-org probe sharpened: org B's chain naming an org-A user still denies) | `7a7f8c3` |
| `CAPABILITY-MATRIX.md` — column renamed to "Chain approver (any role)", A1 RESOLVED mapping with zero-approver consequence, Enforced-at names `is_sop_sign_off_approver()` + 00066; doc gate repointed same commit | `93b7494` |

**Live applier run:** `node scripts/apply-phase46-migration.mjs` — 00066 applied via `supabase db push`; ALL post-apply assertions PASSED (4× nested-approver-arm structural quals with owner arm confirmed GONE, 3× `with_check IS NULL`, 1× `with_check === qual`, reorder RPC clauses, and the new `is_sop_sign_off_approver` pin: securityDefiner / search_path=public / org conjunct / both step arms / category join / authenticated-yes+anon-no execute — all true).

**Gates:** `npx playwright test --project=phase46` 31/31 passed (14 live RLS probes); `npx tsc --noEmit` clean; `npm run build` clean (bundle checks OK); `tests/lint/rls-org-scope.spec.ts` + `tests/lint/sops-select-policies-org-scoped.spec.ts` 5/5 passed.
