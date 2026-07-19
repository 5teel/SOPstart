---
phase: 32-visual-org-model-library-permissions
verified: 2026-07-18T00:00:00Z
status: human_needed
score: 6/6 must-haves verified (source/data layer); 6 runtime UI behaviors need human/browser confirmation
overrides_applied: 0
human_verification:
  - test: "Open /admin/team as an admin. Confirm the Node Chart (areas → departments → roles → people) renders by default with bezier connectors, vacancy chips render dashed (not styled as an error), role capacity shows filled/budgeted, and clicking the ⊞/▤ toggle switches to the Columns board without a page reload."
    expected: "Chart renders correctly on first load; toggle swaps to Columns showing one column per department with role cards and person/vacancy chips; AdminNav still shows exactly 5 tabs (SOPs/Governance/Blocks/Team/Settings)."
    why_human: "tests/phase32/org-chart-build.spec.ts's true browser-render assertion is a documented test.fixme (no chromium binary in this environment) — only source-contract (import/prop) checks ran automatically."
  - test: "Seed or use an org with ~15 departments × ~20 collections. Open /admin/sops?view=access. Confirm the WiringPatchBay renders grouped area/department jacks collapsed to single jacks with count badges, that NO wires are drawn until a search or click, and that focusing a unit lights only its own wires (others dim)."
    expected: "Groups collapse cleanly at scale; graph is quiet by default; focus draws only the relevant wires; no wire spaghetti or layout breakage."
    why_human: "tests/phase32/wiring-at-scale.spec.ts's scale/visual assertion is a documented test.fixme runtime smoke — not exercised by the automated suite."
  - test: "On /admin/sops?view=access, focus a department jack that has SOPs. Confirm an 'Open in library →' link appears in the selection banner, and clicking it navigates to /admin/sops?departments=<id> showing the correctly filtered SOP list with an accurate 'Open in library (N)' count."
    expected: "Click-through works end to end; N matches the number of SOPs actually shown."
    why_human: "tests/phase32/library-filter-deeplink.spec.ts's click-through scenario is a documented test.fixme runtime smoke; the automated suite only verified the server-side filter logic and the href-construction source contract."
  - test: "Publish a SOP, click its 'Wire up access' CTA, confirm it lands on /admin/sops?view=access&sop=<id> with the SOP pinned NEW·UNWIRED. Enter connect mode, toggle 2-3 org units on, confirm the SelectionStrip's people count updates live per toggle, then click '✓ Done' and confirm real access_grants rows were written (re-open the SOP's wiring and confirm the grants now show as existing, not NEW·UNWIRED)."
    expected: "Live wire toggling + accurate blast-radius count; Done persists real grants (this was CR-01, now fixed in code but never exercised through a live browser session)."
    why_human: "tests/phase32/wire-up-mode.spec.ts's two runtime assertions (connect-mode UI + PublishStage CTA link) are documented test.fixme — CR-01's fix is proven only by source-contract/unit-level checks plus live-Supabase RLS/write tests, not an end-to-end click-through of the actual wire-up UI."
  - test: "Trigger a state transition on SelectionStrip (idle → selection → wiring) in a real browser and confirm the strip's bounding box top position is pixel-identical across all three states (i.e., the page content below it never jumps)."
    expected: "getBoundingClientRect().top identical across idle/selection/wiring."
    why_human: "tests/phase32/banner-slot-stability.spec.ts's pixel-measurement assertion is a documented test.fixme runtime smoke; automated checks only confirmed there's no conditional mount/unmount in the source."
  - test: "Product decision: review `npx tsx scripts/assert-phase32-day-one-equivalence.ts --diff-materialization` output (1 of 15 live SOPs — 'Changing Plenum Chamber — IS Machine Forming Section' — would GAIN department 4587a6ed on next re-materialization of its collection) and decide whether collection-granularity department access is the accepted new model, or whether the seeded Step-C grant for that collection should be narrowed before any further grant CRUD touches it."
    expected: "A conscious accept/reject decision recorded, not a silent divergence discovered later by a worker gaining unexpected SOP visibility."
    why_human: "This is an explicit, tooled, but still-open product decision documented in 32-REVIEW-FIX.md (WR-02) — the mechanical detection tool was built and confirms the divergence still exists live; the judgment call itself cannot be made by a verifier."
---

# Phase 32: Visual Org Model & Library Permissions Verification Report

**Phase Goal:** A business (Visy first) draws its org structure visually — departments grouped into areas, roles inside departments, people in roles (named or held as role-descriptor vacancies) — and wires SOP-library access onto that model across every arity (1:N, N:1, N:M), with the visualization doubling as a library filter and as the surface where permissions are CREATED (wire-up mode for newly published SOPs).
**Verified:** 2026-07-18
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (SC-1..SC-6)

| # | Truth (Success Criterion) | Status | Evidence |
|---|---|---|---|
| SC-1 | Admin draws departments → roles → people on a node-chart canvas with a Columns alternative; vacancies are first-class with capacity counts | ✓ VERIFIED (data/component layer) — ? UNCERTAIN (visual render) | `src/lib/org-model/auto-layout.ts` (`layoutOrgTree`, unit-tested, deterministic), `OrgChartCanvas.tsx`/`OrgColumnsBoard.tsx`/`TeamViewShell.tsx` wired into `/admin/team/page.tsx` (`listOrgTree()` fetch confirmed via grep); AdminNav still 5 tabs. `org-chart-build.spec.ts` runtime browser-render assertion is `test.fixme` (no chromium in this environment) — real visual confirmation not exercised. |
| SC-2 | Library access assigned at org/area/department/person; effective-access model resolves union-up-the-chain with direct/inherited/personal vocabulary | ✓ VERIFIED | `src/lib/org-model/resolve-access.ts` `resolveEffectiveAccess()` is pure, exported, and covered by a real 6-case behavioral unit test (`__tests__/resolve-access.test.ts`) that passed live in this session. `src/actions/grants.ts` `materializeSopAccess`/`materializeCollectionAccess` call it and replace-write both `sop_departments` and `sop_access_people`. |
| SC-3 | The wiring view survives ~15×20 scale: grouped structure, expand-in-place, quiet-by-default, count badges | ✓ VERIFIED (component logic) — ? UNCERTAIN (rendered at real scale) | `WiringPatchBay.tsx` implements group-collapse (`leftEndpoint`), quiet-by-default (no wires drawn pre-interaction), count badges (grep-confirmed in 32-08-SUMMARY). `wiring-at-scale.spec.ts`'s actual 15×20 render/measure assertion is `test.fixme` — not run in a live browser this session. |
| SC-4 | Focusing any unit deep-links into the library as a filter with an "Open in library (N)" affordance | ✓ VERIFIED (server logic) — ? UNCERTAIN (click-through) | `src/app/(protected)/admin/sops/page.tsx` resolves `?departments=`/`?collection=` server-side through `sop_departments`/`sop_collections` and `.in('id', ids)`-filters the SOP query with an "Open in library (N)" header (confirmed present via grep and passing source-contract spec). The actual click-through from `WiringPatchBay`'s focus link to the filtered page is a documented `test.fixme` runtime smoke. |
| SC-5 | A newly published SOP can be wired up visually: connect mode, live grant wires, people blast-radius count before confirming | ✓ VERIFIED (logic + write path) — ? UNCERTAIN (live UI) | CR-01 (wire-up wrote a SOP id where a collection id was required, silently writing zero grants while reporting success) is fixed in code: `WiringPatchBay.tsx` `handleDone` now grants each pending subject × the SOP's real `collectionIds`, aborts and surfaces an error on any failure, and never falsely reports success (confirmed by reading the current source). CR-02 (no runtime path ever wrote `sop_collections` for new SOPs) is fixed via `ensureSopCollectionsForOrg`, wired into `performPublish()` Step 3c (grep-confirmed). Both are proven by source-contract + live-Supabase RLS tests, not a live click-through of the connect-mode UI — `wire-up-mode.spec.ts`'s two UI-runtime assertions remain `test.fixme`. |
| SC-6 | Contextual banners occupy a permanently-reserved fixed-height slot — the graph never moves on selection | ✓ VERIFIED (source) — ? UNCERTAIN (pixel measurement) | `SelectionStrip.tsx` renders one unconditional `h-[48px]` slot swapping only inner content + a state class (grep confirms no `? null :` conditional mount). The pixel-identical `getBoundingClientRect()` measurement across state transitions is a documented `test.fixme` runtime smoke. |

**Score:** 6/6 SCs verified at the data/logic/wiring layer with real evidence (unit tests, live-Supabase runtime tests, migrations applied and confirmed live, tsc/build clean). 6 of those same SCs also carry a genuine, explicitly-documented visual/click-through gap that only a human/browser session can close — none of these are silent; every one is a named `test.fixme` with a stated reason ("requires chromium + live app").

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `supabase/migrations/00046_org_model_schema.sql` | 7 new tables + area_id + enum + D-13 RLS arm | ✓ VERIFIED | Live on production DB — confirmed via `assert-phase32-day-one-equivalence.ts --verify` (11/11 PASS) run in this session. |
| `supabase/migrations/00047_org_model_data.sql` | Day-one equivalence seed | ✓ VERIFIED | `sop_departments` byte-identical pre/post (13 rows), confirmed live this session. |
| `supabase/migrations/00048_fix_sop_access_people_admin_read_org_scope.sql` (WR-01 fix) | Org-scope the admin read arm | ✓ VERIFIED LIVE | Confirmed via live `pg_policies` introspection this session — policy qual text matches the fixed (org-scoped) version, not the original 00046 hole. |
| `supabase/migrations/00049_access_grants_unique_subject_collection.sql` (WR-04 fix) | Unique index on access_grants | ✓ VERIFIED LIVE | Confirmed via live `pg_indexes` introspection this session — `uq_access_grants_subject_collection` exists. |
| `src/lib/org-model/resolve-access.ts` | Pure 5-level union resolver | ✓ VERIFIED | Exported, pure, unit-tested (6/6 passing this session). |
| `src/actions/org-model.ts` | areas/roles/role_members CRUD + listOrgTree | ✓ VERIFIED | `tsc` clean; `materializeOrgAccess` (CR-03 fix) imported and called from `assignRoleMembers`/`archiveRole`/`setDepartmentArea`/`archiveArea` (grep-confirmed 4 call sites). |
| `src/actions/grants.ts` | Grant CRUD + materialization fanout | ✓ VERIFIED | `createGrant`/`revokeGrant`/`materializeSopAccess`/`materializeCollectionAccess`/`materializeOrgAccess` all present; org self-enforcement confirmed by live cross-tenant rejection tests (passing this session). |
| `src/lib/org-model/sop-collections.ts` (CR-02 fix) | Runtime sop_collections write path | ✓ VERIFIED | `ensureSopCollectionsForOrg` exists, mirrors migration 00047 steps A/B, wired into `publish-core.ts` Step 3c. |
| `src/components/admin/org-model/{OrgChartCanvas,OrgColumnsBoard,ViewToggle,TeamViewShell}.tsx` | Node Chart + Columns UI | ✓ VERIFIED (exists, wired) — ? UNCERTAIN (visual) | All present, imported into `/admin/team/page.tsx`; CSS tokens confirmed declared (no undefined `var()` regression per the 2026-07-14 class of bug); actual render never confirmed in a live browser this session. |
| `src/components/admin/wiring/{WiringPatchBay,SelectionStrip,WiringPatchBayShell}.tsx` | D-hybrid wiring surface | ✓ VERIFIED (exists, wired) — ? UNCERTAIN (visual) | All present, imported into `/admin/sops/page.tsx` under `?view=access`; CR-01 fix confirmed in current source. |
| `src/app/(protected)/admin/team/page.tsx` | Org-model surface (D-08) | ✓ VERIFIED | Fetches `listOrgTree()`, mounts `TeamViewShell`, keeps `getSessionContext` admin/safety_manager guard and `AdminNav active="team"`. |
| `src/app/(protected)/admin/sops/page.tsx` | `?view=access` arm + deep-link filter | ✓ VERIFIED | `isAccessView`, `WiringPatchBayShell`, `?departments=`/`?collection=` server-filter all present (grep-confirmed). |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `WiringPatchBay` trace + blast radius | `resolveEffectiveAccess` | shared resolver import | ✓ WIRED | Confirmed by 32-08 code review pass and current source read. |
| `WiringPatchBay handleDone` | `createGrant` (per pending subject × SOP's real collectionIds) | grant write on confirm | ✓ WIRED (fixed) | CR-01 bug (was `collectionId: newSop.id`) confirmed fixed in current source — grants against `newSop.collectionIds`, aborts + surfaces error on failure, never silently reports success. |
| SOP publish | `sop_collections` | `ensureSopCollectionsForOrg` in `performPublish()` Step 3c | ✓ WIRED (fixed) | CR-02 fix confirmed present in `publish-core.ts`. |
| `assignRoleMembers`/`archiveRole`/`setDepartmentArea`/`archiveArea` | `materializeOrgAccess` | re-materialize on chain/membership mutation | ✓ WIRED (fixed) | CR-03 fix confirmed — 4 call sites in `org-model.ts`. |
| `journeys.ts` | `/admin/team`, `/admin/sops?view=access` | route mapping (D-10) | ✓ WIRED | `tests/phase30/governance-fold.spec.ts` "pathways coverage — 0 not-mapped" passed live this session. |

### Probe / Automated Test Execution (run live in this session)

| Check | Command | Result | Status |
|---|---|---|---|
| Day-one equivalence + object existence | `npx tsx scripts/assert-phase32-day-one-equivalence.ts --verify` | 11/11 PASS | ✓ PASS |
| Materialization divergence (WR-02) | `npx tsx scripts/assert-phase32-day-one-equivalence.ts --diff-materialization` | 1 of 15 SOPs diverges (documented, unresolved product decision) | ⚠ OPEN — see human_verification #6 |
| Migration 00048 live | `pg_policies` introspection via Management API | org-scoped qual text present | ✓ PASS |
| Migration 00049 live | `pg_indexes` introspection via Management API | `uq_access_grants_subject_collection` present | ✓ PASS |
| TypeScript | `npx tsc --noEmit` | clean, 0 errors | ✓ PASS |
| Production build | `npm run build` | clean; bundle gate `/sops/[sopId]/page` Δ+1KB within tolerance | ✓ PASS |
| phase32 + phase32-unit Playwright | `npx playwright test --project=phase32 --project=phase32-unit` | 60 passed, 7 skipped (documented fixme), 0 failed | ✓ PASS (matches claimed figures) |
| Pathways 0-not-mapped | `npx playwright test tests/phase30/governance-fold.spec.ts` | 7/7 passed | ✓ PASS |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `src/components/admin/wiring/WiringPatchBay.tsx` | 445 | `'coming soon'` for Matrix/Illuminate lenses | ℹ️ Info | Explicitly scoped as deferred in 32-08-PLAN ("Matrix/Illuminate may render minimal for v1 — Wiring is the shipping default") — not a gap against SC-1..SC-6. |
| `src/actions/departments.ts` (`assignSopDepartments`, still called from `WizardClient.tsx`/`PromptClient.tsx`/`VoiceDraftClient.tsx`) | n/a | Unreconciled dual-write on `sop_departments` | ⚠️ Warning | `assignSopDepartments` (Phase 25, unchanged) still writes `sop_departments` directly at SOP-creation time. Phase 32's `materializeSopAccess`/`materializeCollectionAccess` now treat `sop_departments` as fully DERIVED from `access_grants` and replace-write it whenever ANY grant CRUD touches a SOP's collection (e.g., wiring up a sibling SOP in the same collection). A department assigned via the still-live creation wizard has no corresponding `access_grants` row, so the next unrelated materialize on that collection can silently drop it. 32-05's own SUMMARY flagged this exact reconciliation gap ("out of this plan's scope... should be confirmed/addressed by whichever later Phase 32 plan builds the department-assignment UI") and no later plan (32-06..32-09) closed it; it is also absent from `32-REVIEW.md`'s findings because `departments.ts`/`WizardClient.tsx` were outside the phase's reviewed file list. Not a fabricated risk — traced live in this session (`assignSopDepartments` confirmed still called from all 3 SOP-creation entry points). |

### Requirements Coverage

Phase 32 has no REQUIREMENTS.md section (documented known gap, per task instructions). Verified against SC-1..SC-6 from ROADMAP.md instead — see Observable Truths table above. All 6 requirements IDs referenced in plan frontmatter (`requirements: [SC-1..SC-6]`) map to real, evidenced work; none are orphaned.

## Human Verification Required

The automated suite is thorough (60 passing tests, real live-Supabase RLS/cross-tenant tests, live migration/policy introspection, clean tsc/build) but 6 of the 8 stub specs created in Wave 0 have their **visual/click-through half** left as documented `test.fixme` runtime smokes (no chromium binary / no live app session available in this environment) — this is disclosed honestly in every plan SUMMARY, not hidden. Per CLAUDE.md's [2026-06-08]/[2026-07-13]/[2026-07-14] recurring lesson class ("a CSS/wiring bug is invisible to every gate the project has — only a human or a screenshot catches it"), these need a real browser pass before the phase can be called fully done:

### 1. Org chart renders and toggles correctly

**Test:** Open `/admin/team`, confirm Node Chart renders (bezier connectors, dashed vacancy chips, capacity counts), then click ⊞/▤ toggle to Columns.
**Expected:** Chart renders correctly; toggle swaps views without reload; AdminNav still has exactly 5 tabs.
**Why human:** `org-chart-build.spec.ts` browser-render assertion is `test.fixme` (no chromium available this session).

### 2. Wiring view survives real scale (~15×20)

**Test:** With an org at or near 15 departments × 20 collections, open `/admin/sops?view=access` and confirm grouped/quiet-by-default rendering.
**Expected:** No wire spaghetti; groups collapse with count badges; nothing draws until interaction.
**Why human:** `wiring-at-scale.spec.ts` visual assertion is `test.fixme`.

### 3. Library deep-link click-through

**Test:** Focus a department jack in the access view, click "Open in library →".
**Expected:** Navigates to `/admin/sops?departments=<id>` with an accurate "Open in library (N)" count.
**Why human:** `library-filter-deeplink.spec.ts` click-through scenario is `test.fixme`.

### 4. Wire-up mode end-to-end (the phase's flagship flow, and the one CR-01 broke)

**Test:** Publish a SOP, click "Wire up access", toggle grants in connect mode, watch the blast-radius count live-update, click "✓ Done".
**Expected:** Live wire toggling with an accurate people count; Done persists real `access_grants` rows (re-check by re-opening the SOP's wiring — it should no longer show NEW·UNWIRED).
**Why human:** `wire-up-mode.spec.ts`'s two runtime scenarios are `test.fixme`; the CR-01 fix is proven at the source/unit level only, never exercised through the actual UI end to end.

### 5. Banner slot never reflows

**Test:** Trigger idle → selection → wiring state transitions on the access view and check the page doesn't jump.
**Expected:** `getBoundingClientRect().top` pixel-identical across all 3 states.
**Why human:** `banner-slot-stability.spec.ts` pixel-measurement is `test.fixme`.

### 6. WR-02 product decision (materialization granularity)

**Test:** Review the live `--diff-materialization` output (1 of 15 SOPs currently diverges) and decide: accept collection-granularity access as the new model, or narrow the seeded grant before it's triggered by unrelated grant CRUD.
**Expected:** A recorded decision, not a silent surprise the next time an admin wires up an unrelated sibling SOP.
**Why human:** Explicitly flagged as an open product call in `32-REVIEW-FIX.md`; not something a verifier can resolve.

## Gaps Summary

No BLOCKER-level gaps. All 3 Critical + 5 Warning code-review findings (CR-01, CR-02, CR-03, WR-01..WR-05) are confirmed fixed and live in this session (source read + live migration/policy introspection), matching `32-REVIEW-FIX.md`'s claims exactly. The phase's data/logic/security layer (schema, RLS, resolver, grants, materialization) is real and independently re-verified, not merely SUMMARY-asserted.

The gap is that the **visual and interactive halves of SC-1, SC-3, SC-4, SC-5, and SC-6 have never been exercised in a live browser** — every one of the 6 corresponding runtime assertions is an honestly-labeled `test.fixme`, and this environment has no chromium binary / live app session to close them now. Additionally, one **unreconciled architectural gap** was found during this verification (not previously flagged in 32-REVIEW.md, since the conflicting files were outside that review's scope): the pre-existing `assignSopDepartments` direct-write path (still reachable from all 3 SOP-creation entry points) can have its department assignment silently overwritten the next time an unrelated grant action triggers `materializeCollectionAccess` on the same collection. And WR-02's product decision (collection-granularity access widening) remains explicitly open with a live divergence still present (1 of 15 SOPs).

None of these block calling the phase's **data/logic contract** achieved — they block calling the **end-user-visible flow** achieved, which is why this reports `human_needed` rather than `passed` or `gaps_found`.

---

_Verified: 2026-07-18_
_Verifier: Claude (gsd-verifier)_
