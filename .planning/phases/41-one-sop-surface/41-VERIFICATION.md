---
phase: 41-one-sop-surface
verified: 2026-09-15T11:45:17Z
status: passed
score: 6/6 must-haves verified (gap closed same-session — stale spec pins repointed in d6b139e; phase28/phase30/phase41 projects green)
overrides_applied: 0
gaps:
  - truth: "The full Playwright suite is green (ROADMAP cross-cutting constraint; 41-08 must-have: 'The full Playwright suite is green')"
    status: resolved (d6b139e)
    reason: >
      The 181f291 review-fix commit (WR-01) changed the /admin/governance
      redirect shim from raw template-literal interpolation to
      URLSearchParams-based encoding, and updated the two legacy
      source-contract specs that pin that shim's source — but only added
      new assertions, without removing the now-false literal-string
      assertions the old interpolation style satisfied. 41-REVIEW.md
      explicitly claims "phase28/phase30 pins repointed in the same
      commit" for WR-01; this claim is false for one assertion in each
      file. Confirmed by running the specs directly at HEAD (2058178) —
      both fail, and the underlying source genuinely no longer contains
      the literal substring either assertion checks for (the redirect is
      now built as `` `/sops?${qp.toString()}` ``, never as the literal
      string `/sops?view=attention`). This is a stale-guard regression
      (CLAUDE.md 2026-07-13 class), not a functional break — the
      deployed-site eval (41-EVAL.md, run at the same commit 2058178)
      confirms the redirect itself works correctly in production (test D:
      "legacy admin URLs redirect onto /sops, Governance deep-links the
      attention lens" — PASS).
    artifacts:
      - path: "tests/phase28/governance-queue.spec.ts"
        issue: "Line ~114: `expect(src).toContain(\"'/sops?view=attention'\")` — this quoted literal never appears in src/app/(protected)/admin/governance/page.tsx after the WR-01 URLSearchParams rewrite."
      - path: "tests/phase30/governance-fold.spec.ts"
        issue: "Line 69: `expect(src).toContain('/sops?view=attention')` — same stale literal-substring assertion, same file rewrite."
    missing:
      - "Remove (or repoint to a structural check, e.g. `toContain(\"qp.toString()\")` / `toContain('redirect(`/sops?')`)` the two stale literal-string assertions in tests/phase28/governance-queue.spec.ts and tests/phase30/governance-fold.spec.ts so the full suite is genuinely green, matching what 41-REVIEW.md already claims was done."
---

# Phase 41: One SOP Surface Verification Report

**Phase Goal:** There is one place SOPs are listed. What a person sees and can do there is decided by their permissions, not by which URL they typed. The admin-only views that lived at `/admin/sops` (draft/published status, the governance queue `?view=attention`, the access/wiring patch bay `?view=access`) become lenses on that one surface, loaded only for the people entitled to them. The second "SOPs" door closes, and an admin has one route chain from a SOP to its builder.

**Verified:** 2026-09-15T11:45:17Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria SC-1..SC-5)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC-1 | Worker/supervisor/admin reach the SOP list at the same URL; worker behaviour preserved verbatim (assigned-first, offline Dexie, self-add/remove, dept filter, search, refresher due dates) | ✓ VERIFIED | `src/app/(protected)/sops/page.tsx` retains `useAssignedSops`, `useSopSync`, unmodified `SopWorkerBrowser` dynamic import; `merged-surface.spec.ts` "SUR-01: worker data layer is untouched" passes; deployed-site eval test C ("worker behaviours survive for an admin") + F1/F2 (worker sees no admin group, desktop+mobile) both pass on sopstart.com at HEAD commit 2058178 |
| SC-2 | Draft/published/governance queue/access patch bay render as lenses; `?departments=`, `?collection=`, `?sop=` deep links still resolve | ✓ VERIFIED | `AdminStatusLens`/`AdminAttentionLens`/`AdminAccessLens` exist, code-split via `next/dynamic({ssr:false})` from `AdminSopSurface.tsx`; `merged-surface.spec.ts` deep-link resolution tests (view=attention/access, status=draft\|published\|failed, owner=me, departments/collection) all pass; eval test B confirms lens takeover + return without reload |
| SC-3 | Exactly one top-level "SOPs" nav entry; no "Manage SOPs"; Governance deep-links the lens; "Library" never a destination/nav label | ✓ VERIFIED | `TopHeader.tsx` `BASE_LINKS` has one `{label:'SOPs', href:'/sops'}`; `ADMIN_LINKS` has `Governance → /sops?view=attention`, no "Manage SOPs"; `reference-sweep.spec.ts` SUR-06 assertion passes; eval test D confirms single nav entry in the deployed UI |
| SC-4 | One route chain from a SOP to its builder; no second chain | ✓ VERIFIED | `status-attention-lenses.spec.ts` SUR-04 tests confirm only `SopMillerBrowser` contains a builder href; no lens/`SopWorkerBrowser`/`sops/page.tsx` contains a second builder link |
| SC-5 | `SB-LINE-06` bundle gate green: worker route within 2 KB of Wave-0 baseline, no admin-lens code in worker chunks | ✓ VERIFIED | Ran `npm run build` directly (not trusting SUMMARY): `/sops/[sopId]/page` = 1050 KB (baseline 1048, Δ+2KB); `/sops/page` = 941 KB (baseline 940, Δ+1KB); both within ±2KB tolerance. `.bundle-baseline.json` confirmed byte-identical to commit `e59d057` via `git diff e59d057 -- .bundle-baseline.json` (empty diff). Forbidden-marker gate green (no `SopMillerBrowser`/`GovernanceQueueRow`/`WiringPatchBay` string literals leaked into `/sops/page`'s own chunk); marker self-validation green. The 41-05 "deviation fix" (moving admin logic into `AdminSopSurface.tsx`, a separately-lazy-loaded module) is real and present in the code, not just claimed in the SUMMARY. |

**Score:** 5/5 roadmap Success Criteria verified. 1 additional cross-cutting constraint ("the full Playwright suite is green") FAILED — see Gaps below.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/(protected)/admin/sops/page.tsx` | Redirect shim to `/sops`, guard before redirect, ≤60 lines | ✓ VERIFIED | 46 lines; guard (`userId`/role check) precedes `redirect()`; builds query via `URLSearchParams` |
| `src/app/(protected)/admin/governance/page.tsx` | Redirect shim to `/sops?view=attention`, guard before redirect | ✓ VERIFIED (functionally) | Guard precedes redirect; `URLSearchParams`-encoded (WR-01 fix applied) — but see Gaps: 2 stale test assertions against this file's old raw-interpolation form still fail |
| `src/components/sop/AdminSopSurface.tsx` | Admin scope logic + 3 lens `dynamic()` bindings, code-split from `page.tsx` | ✓ VERIFIED | Exists, 12.7KB; `page.tsx` loads it via one `dynamic({ssr:false})` call; contains `AdminScope`, `resolveAdminScope`, 3 lens bindings, Admin Miller-row JSX |
| `src/components/admin/wiring/WiringPatchBayShell.tsx` (unmodified, wrapped) | Wrapped by `AdminAccessLens`, not modified | ✓ VERIFIED | `access-lens.spec.ts` confirms `AdminAccessLens` imports it, wraps unchanged |
| `.bundle-baseline.json` | Byte-identical to Wave-0 capture (`e59d057`) — never re-captured | ✓ VERIFIED | `git diff e59d057 -- .bundle-baseline.json` → empty |
| `.planning/codebase/CAPABILITY-MATRIX.md` | Records admin-lens access channel, route-is-not-a-boundary note | ✓ VERIFIED | Row present naming `listAdminSopRows`/`listAdminAccessData` + `requireAdminContext()`; explicit note that `useIsAdmin()` is UX-only, not an access gate |
| `src/lib/journeys/journeys.ts` | Reflects merged surface + both shims | ✓ VERIFIED | Contains `/sops`, `/sops?view=attention`, `/sops?view=access`, `legacy-admin-sops` and `legacy` (governance) shim entries; eval test E confirms 0 not-mapped screens on the deployed `/pathways` page |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `src/app/(protected)/sops/page.tsx` | `AdminSopSurface.tsx` | `dynamic({ssr:false})` gated on `useIsAdmin()` | ✓ WIRED | Confirmed via grep + `merged-surface.spec.ts` "page.tsx does not reference any admin lens module at all (moved to AdminSopSurface.tsx)" |
| `AdminSopSurface.tsx` | `AdminStatusLens`/`AdminAttentionLens`/`AdminAccessLens` | `dynamic()` inside `AdminSopSurface.tsx` | ✓ WIRED | "AdminSopSurface.tsx has exactly 3 next/dynamic({ssr:false}) bindings" passes; "each admin lens module is imported ONLY inside a dynamic(...) call" passes |
| `AdminStatusLens`/`AdminAttentionLens`/`AdminAccessLens` | `listAdminSopRows`/`listGovernanceQueue`/`listAdminAccessData` server actions | `useQuery` queryFn | ✓ WIRED | Confirmed by `status-attention-lenses.spec.ts` and `access-lens.spec.ts` |
| `TopHeader.tsx` ADMIN_LINKS | `/sops?view=attention` | static href | ✓ WIRED | Confirmed by grep and `nav-and-shim.spec.ts` |
| `src/app/(protected)/admin/sops/page.tsx` | `/sops` | `redirect()` after guard | ✓ WIRED | Confirmed by direct read + `nav-and-shim.spec.ts` |
| `src/app/(protected)/admin/governance/page.tsx` | `/sops?view=attention[&filter=]` | `redirect()` after guard | ⚠️ WIRED functionally, test guard broken | Runtime behaviour verified correct via deployed-site eval; two source-contract test assertions pinning the OLD raw-interpolation string are stale and fail |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `AdminStatusLens` | `listAdminSopRows` result | `src/actions/admin-sop-list.ts` — real Supabase `.from('sops')` query chain, `requireAdminContext()` guard first | Yes | ✓ FLOWING |
| `AdminAttentionLens` | `listGovernanceQueue` result | `src/actions/governance.ts` (pre-existing, unmodified) | Yes | ✓ FLOWING |
| `AdminAccessLens` | `listAdminAccessData` result | `src/actions/admin-access-view.ts` — org tree/grants/collections queries, `requireAdminContext()` first | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

Not run as separate curl/CLI probes — the phase's own deployed-site eval (41-EVAL.md) is the equivalent runnable evidence and was independently re-examined (not merely trusted): 7/7 passing at HEAD commit `2058178`, covering admin scope rendering, lens takeover/return, worker-behaviour preservation, single nav entry + legacy redirect resolution, pathways coverage, and worker desktop/mobile isolation from admin scopes.

### Probe Execution

No `scripts/*/tests/probe-*.sh` probes declared or found for this phase. `npm run build` was run directly by this verifier (not taken from SUMMARY claims) as the closest equivalent — see SC-5 evidence above; exits 0, bundle gate green.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|----------------|--------------|--------|----------|
| SUR-01 | 41-01,02,05,06,07,08,09 | One route lists SOPs for every role | ✓ SATISFIED | `/sops` merged surface, `useIsAdmin()` gate, redirect shims |
| SUR-02 | 41-01,02,03,04,05,08,09 | Admin capabilities are lenses, not separate destinations | ✓ SATISFIED | 3 lenses code-split via `AdminSopSurface.tsx` |
| SUR-03 | 41-01,06,07,09 | One top-level "SOPs" entry, no duplicate nav path | ✓ SATISFIED | `TopHeader.tsx` BASE_LINKS/ADMIN_LINKS verified |
| SUR-04 | 41-01,04,06,07,08,09 | One path from SOP to builder | ✓ SATISFIED | SUR-04 tests confirm single builder href |
| SUR-05 | 41-01,02,03,04,05,09 | Mobile worker bundle unaffected, SB-LINE-06 stays green | ✓ SATISFIED | Real `npm run build` run — green, within tolerance, baseline unmodified from Wave-0 |
| SUR-06 | 41-01,05,06,07,09 | "Library" survives only as a filter label | ✓ SATISFIED | grep + `merged-surface.spec.ts`/`reference-sweep.spec.ts` SUR-06 assertions |

No orphaned requirements — REQUIREMENTS.md maps SUR-01..06 exclusively to Phase 41 and all 6 appear across the 9 plans' frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `tests/phase28/governance-queue.spec.ts` | ~114 | Stale source-contract assertion pinning code that no longer exists (guard-stopped-guarding class, CLAUDE.md 2026-07-13) | 🛑 Blocker (fails "full suite green" cross-cutting constraint) | Test suite is red at HEAD; 41-REVIEW.md's claim that this was "repointed in the same commit" is inaccurate |
| `tests/phase30/governance-fold.spec.ts` | 69 | Same pattern, same root cause (181f291 WR-01 fix) | 🛑 Blocker (same constraint) | Same |

No TBD/FIXME/XXX debt markers found in files modified by this phase. No stub returns, no hardcoded empty-data patterns, no placeholder copy found in the reviewed lens/shim/surface files.

### Human Verification Required

None. Per the task's explicit direction, `41-EVAL.md` (deployed-site eval, 7/7 pass on sopstart.com at HEAD commit `2058178`) replaces plan 41-09's human-verify checkpoint and is treated as the UAT artefact. This verifier independently re-read `41-EVAL.md` rather than trusting a SUMMARY's characterization of it, confirmed its commit hash matches current HEAD, and found no item in it that leaves a gap the eval doesn't cover.

### Gaps Summary

The phase substantively achieves its goal: one merged `/sops` surface exists, is code-split correctly, preserves worker behaviour, gates admin lenses on `useIsAdmin()` while enforcing real access control in the server actions (`requireAdminContext()`), closes the second "SOPs" door to a thin guarded redirect shim, and passes a real, freshly-run `npm run build` bundle gate with the baseline untouched since Wave 0 — all independently confirmed against the codebase at HEAD (`181f291`/`2058178`), not taken on SUMMARY's word.

One gap remains: the phase's own explicit cross-cutting constraint ("the full Playwright suite is green") is not met. Running the full suite at HEAD produces 21 failures; 19 are pre-existing and match the documented accepted floor (`deferred-items.md`: Puck-era phase3/11/12.5-stubs rot, phase25 wizard-sop-dept, phase36 worker-library-chip, phase46 live-Supabase rate-limit/network flakes). The remaining 2 (`tests/phase28/governance-queue.spec.ts:108`, `tests/phase30/governance-fold.spec.ts:66`) are a genuine regression introduced by the final review-fix commit (`181f291`, WR-01): the governance shim's redirect construction was correctly hardened from raw string interpolation to `URLSearchParams` encoding, but the two legacy specs pinning that shim's source text were only partially updated — new correct assertions were added, but a stale assertion checking for the now-nonexistent literal string `/sops?view=attention` was left in each file. `41-REVIEW.md` states this repoint was completed "in the same commit"; it was not, for these two assertions. The underlying redirect behaviour itself is correct and independently confirmed working in production via the same-commit deployed-site eval — this is a test-suite hygiene gap, not a functional regression, but it is a concrete, currently-red, must-have failure that should be closed (a one-line fix in each of the two files) before the phase is considered fully clean.

---

*Verified: 2026-09-15T11:45:17Z*
*Verifier: Claude (gsd-verifier)*


## Gap closure (same session, 2026-09-15)

The two stale literal assertions (`tests/phase28/governance-queue.spec.ts:115`, `tests/phase30/governance-fold.spec.ts:69`) were repointed to the `URLSearchParams`-built redirect in commit `d6b139e`. phase28 + phase30 + phase41 projects re-run green; the deployed-site eval (41-EVAL.md) is 7/7 at `2058178`. Status → passed.
