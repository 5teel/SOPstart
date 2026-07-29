---
phase: 40-shared-creation-foundation
verified: 2026-07-29T08:23:58Z
status: gaps_found
score: 3/5 must-haves verified
overrides_applied: 0
gaps:
  - truth: "DUP-01: One file-intake component owns accepted MIME types... and the accept lists no longer disagree"
    status: failed
    reason: "A .webp file is accepted by the shared client-side validator (validateIntakeFile / ACCEPTED_MIME_TYPES in src/lib/upload/file-intake.ts) but rejected by the server-side uploadFileSchema in src/lib/validators/sop.ts, which never had image/webp added to its ACCEPTED_TYPES list. This is the exact 'accept-then-fail' class DUP-01 exists to close, on the primary creation dropzone path (UploadDropzone -> createUploadSession). Independently confirmed by reading both files, not just trusting SUMMARY/REVIEW claims."
    artifacts:
      - path: "src/lib/validators/sop.ts"
        issue: "ACCEPTED_TYPES (line 49-61) omits 'image/webp', while src/lib/upload/file-intake.ts's ACCEPTED_MIME_TYPES and ACCEPT_ATTR both include it and getSourceFileType() (line 262) already handles it"
    missing:
      - "Add 'image/webp' to ACCEPTED_TYPES in src/lib/validators/sop.ts, or derive that list from ACCEPTED_MIME_TYPES in file-intake.ts so there is genuinely one list (per 40-REVIEW.md WR-01's own suggested fix)"
  - truth: "DUP-01 (security regression introduced within this phase's own plan 40-07): no new site ships the service-role key to the browser"
    status: failed
    reason: "uploadNewVersion's new video branch (src/actions/versioning.ts:136, authored by plan 40-07 as part of this phase's DUP-01 work) returns process.env.SUPABASE_SERVICE_ROLE_KEY to the client as a TUS access token -- a new instance of a known critical vulnerability class (CLAUDE.md 2026-06-15/2026-07-20 service-role-to-browser family). Two sibling sites (src/actions/sops.ts:184, :477) predate this phase (Phase 6), so the class itself is not phase-40-introduced, but plan 40-07 copied the vulnerable pattern into a brand-new site instead of closing it. Confirmed live in code, unpatched as of HEAD (fd0f223, the review-report commit with no follow-up fix commit)."
    artifacts:
      - path: "src/actions/versioning.ts"
        issue: "line 136: token: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '' -- returned to an authenticated admin/safety_manager's browser for any org"
    missing:
      - "Replace the service-role-key TUS token with createSignedUploadUrl on the sop-videos bucket (matching the existing document-upload branch), or the caller's own session access_token plus an org-scoped storage RLS policy, per 40-REVIEW.md CR-01's suggested fix. The two pre-existing sibling sites (sops.ts:184, :477) should be closed in the same pass per CLAUDE.md rule #5 ('fix the scope')."
  - truth: "DAT-01: A SOP's category resolves to a single column ... existing rows carrying the other column are backfilled"
    status: partial
    reason: "The one-time backfill is real and proven live (SC-5: category is not null = 0, category_tag is not null = 0, confirmed via verify-category-backfill.mjs against production, plus an idempotent no-op re-run). But the single-column guarantee does not hold going forward: cloneSopAsDraft (src/actions/versioning.ts:346) -- the shared implementation behind both 'Edit into new version' and restoreVersionAsNew ('Restore') -- neither selects nor writes category_slug, even though the sibling function uploadNewVersion (same file, same plan 40-07) was correctly given a category_slug carry-forward. Any SOP cloned or restored through these two flows silently loses its category, which cascades into: the cadence lookup falling back to the 12-month default, the approval-chain gate never matching (so a chain-gated category silently loses its approval requirement on the clone -- a governance hole, not just cosmetic data loss), and ensureSopCollectionsForOrg skipping the collection join. This directly contradicts 40-05-PLAN's own listed truths ('a per-category review cadence... still resolves', 'a per-category approval chain still diverts a publish to approval', 'Publishing a SOP still creates or joins the org-model Collection named after its category') for any SOP that goes through clone/restore after this phase. Confirmed directly in code: cloneSopAsDraft's select (line 360) and insert (lines 377-393) both omit category_slug; restoreVersionAsNew (line 618) delegates to cloneSopAsDraft unchanged."
    artifacts:
      - path: "src/actions/versioning.ts"
        issue: "cloneSopAsDraft's select (line 360) and insert (lines 377-393) omit category_slug -- the insert's own comment ('this insert is an explicit field list, so any future per-SOP column must be added here too') documents the exact discipline this instance violates"
    missing:
      - "Add category_slug to cloneSopAsDraft's select and insert (per 40-REVIEW.md CR-03's suggested fix), so 'Edit into new version' and 'Restore' preserve category the same way uploadNewVersion already does"
---

# Phase 40: Shared Creation Foundation Verification Report

**Phase Goal:** The four creation surfaces stop each carrying their own copy of the same thing — file intake (accept list, size limits, HEIC conversion), the department/metadata picker, job progress, and the page shell each become exactly one component — and a SOP's category resolves to one column backed by one vocabulary, with existing rows backfilled. Nothing about the user-visible flow changes yet; this is what makes Phase 41's nav change a one-line edit and Phase 42's convergence a rewiring job rather than a rewrite.

**Verified:** 2026-07-29T08:23:58Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | DUP-01 — one file-intake component owns accept list/size limits/HEIC conversion for every upload path, and the accept lists no longer disagree | FAILED | `src/lib/upload/file-intake.ts` is the single source (confirmed: `UploadDropzone.tsx`, `VideoFormatSelectionModal.tsx`, `versions/page.tsx` all import it, no local accept-list/size-limit/heic2any code remains — `dup01-file-intake.spec.ts` 20/22 live+passing). BUT `src/lib/validators/sop.ts`'s server-side `uploadFileSchema.ACCEPTED_TYPES` still omits `image/webp`, which the shared module accepts — a live accept-then-fail on the primary dropzone (WR-01, independently confirmed by reading both files). Also: plan 40-07's new video branch in `uploadNewVersion` ships `SUPABASE_SERVICE_ROLE_KEY` to the browser (CR-01), a new instance of a known critical vulnerability introduced by this phase's own work. |
| 2 | DUP-02 — one department/metadata picker used by every creation surface | VERIFIED | `src/components/admin/SopMetadataFields.tsx` exists (composite title+department+category), imported by `PromptClient.tsx`, `VoiceDraftClient.tsx`, `WizardClient.tsx`; zero local `<DepartmentPicker` JSX left in those three; department writes route through `assignSopDepartments(...)` (grep-confirmed no direct `sop_departments` insert); category options sourced from `SOP_CATEGORIES`; `admin/sops/upload/page.tsx` does NOT import it (D-12, confirmed). `dup02-metadata-picker.spec.ts` 4/4 passing. |
| 3 | DUP-03 — one parse/job progress component serves both parse flow and video pipeline; realtime+polling implemented once | VERIFIED | `src/lib/admin/job-stages.ts` (plain-language vocabulary, `STAGE_SETS` incl. `video_generation`, `derivePipelineStage`) created; `ParseJobStatus.tsx` extended with a discriminated `sopId`/`pipelineId` prop union and serves both modes; `PipelineStepper.tsx` deleted (confirmed absent, zero `src/` references); `PipelineProgressClient.tsx` contains zero realtime/polling wiring of its own (confirmed by spec + reading the file). `dup03-job-progress.spec.ts` 10/10 passing. |
| 4 | DUP-04 — all admin creation routes render the same page shell/nav; no route hand-rolls its own back-link | VERIFIED | `src/components/admin/AdminPageShell.tsx` created (AdminNav + title/description + optional per-record `backLink`); all 5 target routes (`upload`, `new/blank`, `new/ai`, `[sopId]/versions`, `pipeline/[pipelineId]`) import and render it; zero `Back to library` literals outside the pipeline fallback; a live route-stability sweep confirms every `admin/sops/*/page.tsx` still resolves in `journeys.ts` (no route added/removed/renamed). `dup04-page-shell.spec.ts` 9/9 passing. |
| 5 | DAT-01 — a SOP's category resolves to a single column backed by a single vocabulary; existing rows backfilled | PARTIAL / FAILED (forward-going) | Migration 00058 applied live; `src/lib/sop-categories.ts` (`SOP_CATEGORIES`, `categoryLabel`, `isValidCategorySlug`, `normaliseToCategorySlug`) is the one vocabulary; all governance/collections/display/filter readers repointed (`governance.ts`, `sop-collections.ts`, `useAssignedSops.ts`, library/read views); the one-time backfill is proven live (SC-5: `category is not null` = 0, `category_tag is not null` = 0, idempotent no-op re-run confirmed). BUT `cloneSopAsDraft`/`restoreVersionAsNew` (the "Edit into new version"/"Restore" paths) neither select nor write `category_slug` — confirmed directly in `src/actions/versioning.ts` lines 346-400 and 618-627 — so any SOP cloned or restored after this phase silently loses its category, breaking the cadence/approval-chain/collection guarantees this same phase established for every other write path (CR-03). |

**Score:** 3/5 truths verified (DUP-02, DUP-03, DUP-04 clean; DUP-01 and DAT-01 each carry a live, independently-confirmed gap)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/upload/file-intake.ts` | Single accept-list/size-limit/HEIC module | VERIFIED | Exists, exports match must_haves, consumed by 3 surfaces |
| `src/lib/validators/sop.ts` | Server-side gate agreeing with file-intake.ts | STUB (partial) | `ACCEPTED_TYPES` drifted from `ACCEPTED_MIME_TYPES` — missing `image/webp` (WR-01) |
| `src/lib/admin/job-stages.ts` | Plain-language stage vocabulary + stage sets | VERIFIED | Exports `STAGE_SETS`, `derivePipelineStage`, etc.; `video_generation` key present |
| `src/components/admin/ParseJobStatus.tsx` | Single realtime+polling engine for parse + pipeline | VERIFIED | Discriminated `sopId`/`pipelineId` props, `REALTIME_GRACE_MS`/`REALTIME_STALE_MS` present, sole owner |
| `src/components/admin/SopMetadataFields.tsx` | Composite title/department/category field group | VERIFIED | Exists, wired into all 3 creation clients |
| `src/components/admin/AdminPageShell.tsx` | Shared admin page shell | VERIFIED | Exists, wired into 5 routes, route-stability proven |
| `supabase/migrations/00058_sop_category_slug.sql` | category_slug column, index, backfill, retirement comments | VERIFIED | Applied live; clause-pinning spec (`dat01-migration.spec.ts`) 7/7 passing |
| `scripts/verify-category-backfill.mjs` | Live SC-5 proof (both retired columns = 0) | VERIFIED | Run live against production: `category is not null` = 0, `category_tag is not null` = 0, exit 0 |
| `src/actions/versioning.ts` (`cloneSopAsDraft`) | Category survives every version-creation path | STUB (partial) | `uploadNewVersion` carries `category_slug` forward correctly; `cloneSopAsDraft`/`restoreVersionAsNew` (sibling version-creation path) drop it entirely (CR-03) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `UploadDropzone.tsx` / `VideoFormatSelectionModal.tsx` / `versions/page.tsx` | `src/lib/upload/file-intake.ts` | import | WIRED | Confirmed via spec + grep, no local accept-list code remains |
| `src/actions/sops.ts` (`createUploadSession`) | `src/lib/validators/sop.ts` (`uploadFileSchema`) | server-side validation | WIRED but DIVERGENT | Wiring is correct; the schema it validates against disagrees with the shared client module on `image/webp` (WR-01) |
| `PromptClient.tsx` / `VoiceDraftClient.tsx` / `WizardClient.tsx` | `SopMetadataFields.tsx` | import + render | WIRED | Confirmed, zero local `<DepartmentPicker` remains |
| `SopMetadataFields.tsx` | `assignSopDepartments` | onChange -> submit payload | WIRED | Confirmed no direct `sop_departments` insert in either client route |
| `PipelineProgressClient.tsx` | `ParseJobStatus.tsx` | `<ParseJobStatus pipelineId .../>` | WIRED | Confirmed, `PipelineStepper.tsx` deleted |
| `src/lib/org-model/sop-collections.ts` | `src/lib/sop-categories.ts` (`categoryLabel`) | import | WIRED | Confirmed |
| `src/actions/versioning.ts` (`uploadNewVersion`) | `sops.category_slug` | select + insert | WIRED | Category carried forward correctly on this path |
| `src/actions/versioning.ts` (`cloneSopAsDraft` / `restoreVersionAsNew`) | `sops.category_slug` | select + insert | NOT WIRED | Neither the select (line 360) nor the insert (lines 377-393) references `category_slug` (CR-03) |
| `src/app/(protected)/admin/sops/*/page.tsx` (5 routes) | `AdminPageShell.tsx` | import + render | WIRED | Confirmed for all 5 target routes |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `sops.category_slug` (all display/filter surfaces) | `sop.category_slug` | live Postgres column, backfilled | Yes (SC-5 verified live: 15/24 rows categorised, 9 legitimately uncategorised) | FLOWING |
| `sops.category_slug` (post-clone/restore) | `sourceSop.category_slug` | never selected in `cloneSopAsDraft` | No — the value is discarded before it can reach the insert | DISCONNECTED (CR-03) |
| `ParseJobStatus` pipeline-mode stage label | `derivePipelineStage(snapshot).plainKey` | `job-stages.ts` mapping over live `parse_jobs`/`video_generation_jobs` rows | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| phase40 Playwright project discovers and runs every spec with no config edit | `npx playwright test --project=phase40 --reporter=line` | 48 passed, 1 skipped (deliberate fixme — `BuilderClient.tsx` category_tag sweep, documented cross-vocabulary gap) | PASS |
| `image/webp` accepted end-to-end through the real server validator | read `src/lib/validators/sop.ts` `ACCEPTED_TYPES` directly | `image/webp` absent | FAIL (confirms WR-01) |
| `category_slug` present on `cloneSopAsDraft`'s select/insert | read `src/actions/versioning.ts` lines 346-400 | absent on both | FAIL (confirms CR-03) |
| Service-role key absent from `uploadNewVersion`'s video branch | read `src/actions/versioning.ts` line 136 | `SUPABASE_SERVICE_ROLE_KEY` returned to client | FAIL (confirms CR-01) |
| Full test suite / typecheck / build | reported by executor, spot-checked `tsc --noEmit` directly | 1326 passed / 0 failed (reported); `npx tsc --noEmit` clean (independently re-run) | PASS |

### Probe Execution

No dedicated `scripts/*/tests/probe-*.sh` probes declared or discovered for this phase. `npx playwright test --project=phase40` (above) is the phase's own declared verification command and was run directly by the verifier, not taken from SUMMARY narration.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DUP-01 | 40-01, 40-02, 40-07 | Single file-intake component, agreeing accept lists | PARTIAL — BLOCKED by WR-01 (accept-list drift) and CR-01 (service-role key regression in the same plan's new surface) | See truths #1 above |
| DUP-02 | 40-01, 40-08 | Single department/metadata picker | SATISFIED | See truths #2 above |
| DUP-03 | 40-01, 40-03 | Single job/progress component | SATISFIED | See truths #3 above |
| DUP-04 | 40-01, 40-09 | Single admin page shell/nav | SATISFIED | See truths #4 above |
| DAT-01 | 40-01, 40-04, 40-05, 40-06 | Single category column, backfilled | PARTIAL — historical backfill proven live; forward-going guarantee BLOCKED by CR-03 (clone/restore drops category_slug) | See truths #5 above |

No orphaned requirements — REQUIREMENTS.md's v8.0 traceability table maps exactly these 5 IDs to Phase 40, and all 5 appear in at least one plan's `requirements:` frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/lib/validators/sop.ts` | 49-61 | Accept-list drift (`image/webp` missing) vs. the shared `file-intake.ts` module | Blocker | Accept-then-fail on the primary creation dropzone — the exact class DUP-01 exists to close (40-REVIEW.md WR-01) |
| `src/actions/versioning.ts` | 136 | `SUPABASE_SERVICE_ROLE_KEY` shipped to the browser as a TUS token, new site introduced by plan 40-07 | Blocker | Any admin/safety_manager of any tenant can read the full service-role key from DevTools — cross-tenant RLS-bypass credential disclosure (40-REVIEW.md CR-01) |
| `src/actions/versioning.ts` | 360, 377-393 | `cloneSopAsDraft` select/insert omit `category_slug` despite the insert's own comment mandating it be kept in sync | Blocker | "Edit into new version" / "Restore" silently drop category — breaks cadence default, bypasses approval-chain gate, drops collection join (40-REVIEW.md CR-03) |
| `src/app/api/sops/parse/route.ts`, `transcribe/route.ts`, `restructure/route.ts` | various | No auth/org/role check before admin-client destructive operations | Warning (pre-existing, Phase 2/6, outside this phase's introduced scope but touched for category_slug repoint) | Any authenticated user can wipe and re-parse any org's SOP (40-REVIEW.md CR-02) — not newly introduced by Phase 40, flagged for a dedicated follow-up |
| `src/components/admin/ParseJobStatus.tsx` | 242-265 | "Try again" on a failed AI-prompt draft calls `reparseSop`, which deletes sections before checking the source file exists | Warning (pre-existing since Phase 2/6 `handleReparse`, not introduced by this phase's 40-03 consolidation) | Destroys AI-prompt drafts, strands SOP in `parsing` (40-REVIEW.md CR-04/WR-02) |
| `src/actions/governance.ts` | 446 | `GovernanceRow.category_slug` field actually holds the resolved label, not a slug | Info | Type-lie held together by comments (40-REVIEW.md WR-04) — no observed consumer bug yet |
| `WizardClient.tsx` | 89-100 | Dead `sopCategoryOptions`/`categories` prop + unused `listBlockCategories()` fetch | Info | Cosmetic dead weight (40-REVIEW.md IN-01) |
| `ParseJobStatus.tsx` | 299-307 | Dead computed vars silenced via `void` | Info | Misleading comment claims they're wired; they are not (40-REVIEW.md IN-02) |

### Human Verification Required

None. All truths in this phase are code-observable (source-contract + live database queries); no visual/UX behavior needed device testing for this phase's scope.

### Gaps Summary

Three of the five requirement truths (DUP-02, DUP-03, DUP-04) are cleanly achieved: real components exist, are substantively implemented (not stubs), are wired into every consuming surface, and are covered by live (not merely fixme) specs that were independently re-run by this verifier (48 passed / 1 deliberate fixme).

The remaining two carry real, code-confirmed gaps rather than SUMMARY-only claims:

1. **DUP-01** is functionally complete for consolidation (one shared module, three surfaces wired) but fails its own stated exit bar — "the accept lists no longer disagree" — because the server-side Zod schema (`validators/sop.ts`) was never updated to include `image/webp`, which the shared client module accepts. This is an accept-then-fail bug on the primary creation dropzone, live in the codebase today. Compounding this, plan 40-07's new video branch on `uploadNewVersion` introduced a fresh instance of the service-role-key-to-browser vulnerability (two sibling instances predate this phase from Phase 6, but this is a new site created by this phase's own work).

2. **DAT-01**'s historical backfill is genuinely done and live-verified (SC-5 passed, idempotent). But the single-column guarantee this phase promises does not hold going forward: `cloneSopAsDraft`/`restoreVersionAsNew` — used by "Edit into new version" and "Restore," both everyday admin actions — silently drop `category_slug`, even though the sibling function `uploadNewVersion` (same file, same plan) was correctly patched to carry it forward. This is not a hypothetical edge case; it will fire on ordinary SOP-editing workflows the moment this ships, undoing categorisation and (more seriously) silently bypassing the approval-chain gate for chain-gated categories on any cloned draft.

Both gaps were found by reading the actual code referenced in 40-REVIEW.md (CR-01, CR-03, WR-01) rather than trusting SUMMARY.md narration, and both remain unpatched as of HEAD (`fd0f223`, the review-report commit — no follow-up fix commit exists in `git log`).

CR-02 (unauthenticated destructive parse/transcribe/restructure routes) and CR-04/WR-02 (AI-prompt "Try again" destroys the draft) are real findings from the same review but predate Phase 40 (Phase 2/6) — they are pre-existing debt this phase touched but was not scoped to fix, and are reported here as Warnings for the record, not as blockers to this phase's goal.

---

_Verified: 2026-07-29T08:23:58Z_
_Verifier: Claude (gsd-verifier)_
