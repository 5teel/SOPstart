---
phase: 10-video-version-management
verified: 2026-04-13T00:00:00Z
status: human_needed
score: 6/6 must-haves verified (automated) + 1 human confirmation needed
overrides_applied: 0
human_verification:
  - test: "Confirm migration 00018 is applied to the live Supabase database"
    expected: "video_generation_jobs table has columns version_number (int, NOT NULL, default 0), label (text, nullable), archived (boolean, NOT NULL, default false); UNIQUE constraint video_generation_jobs_sop_format_version_unique is dropped; partial unique index video_generation_jobs_one_published_per_sop exists WHERE published = true; CHECK constraint video_generation_jobs_label_length enforces char_length(label) <= 60"
    why_human: "10-04-SUMMARY.md says 'Schema push deferred to manual step — npx supabase db push requires interactive SUPABASE_ACCESS_TOKEN'. No automated way to confirm the production DB schema without executing a DB query. Circumstantial evidence (post-10-04 commits 799912f, ac5ce98, 353eedc touching generateNewVersion and rendering jobs) suggests the DB is live, but this must be confirmed directly."
  - test: "End-to-end admin walkthrough: generate, label, publish, archive, restore, permanent-delete"
    expected: "Navigate /admin/sops/[sopId]/video on a published SOP → format picker + Generate new version CTA visible → generate narrated slideshow → new v{N} row appears in list → click label → type 'Test label' → Enter saves → click Upload icon → confirm panel → Yes, publish → yellow left border appears and badge shows Published → generate another version → publish second one → first row loses yellow border → archive first one → confirm → moves to 'Show 1 archived versions' → expand → click Restore → moves back → click permanent-delete on another version → confirm → row disappears"
    why_human: "Full interactive UX flow requires running the dev server and real video generation against Shotstack. Cannot be verified by static code analysis."
  - test: "Worker video tab still shows only the published version"
    expected: "Navigate to the same SOP as a worker user → Video tab shows ONLY the currently published version → no other versions visible"
    why_human: "Requires live worker session and auth switch to verify rendered output."
  - test: "Phase 10 requirement IDs VVM-01..VVM-08 should be added to .planning/REQUIREMENTS.md"
    expected: "REQUIREMENTS.md contains a 'Video Version Management' section listing VVM-01 through VVM-08 with descriptions matching the roadmap Success Criteria, and the Traceability table maps each VVM-ID to Phase 10"
    why_human: "Documentation gap — requirements are referenced in plans and roadmap but not formally registered. Requires a human decision on whether to backfill REQUIREMENTS.md or accept the traceability drift."
---

# Phase 10: Video Version Management Verification Report

**Phase Goal:** Admins can generate multiple video versions from a single published SOP, label and manage each version, and control which version workers see — with edit, archive, and re-generate controls

**Verified:** 2026-04-13
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth (from ROADMAP Success Criteria) | Status | Evidence |
|---|----------------------------------------|--------|----------|
| 1 | Admin can generate multiple video versions per SOP; each generation creates a new version row with auto-incrementing version number | VERIFIED | `generateNewVersion` (src/actions/video.ts:112-177) computes `nextVersion = (maxRow?.version_number ?? 0) + 1` scoped to sop_id, inserts new row with `version_number: nextVersion`, and kicks off pipeline via `after()`. API route `src/app/api/sops/generate-video/route.ts:76-118` has the same logic. No reset/overwrite path remains; `regenerateVideo` function removed. |
| 2 | Version list shows all non-archived versions in descending order with v1/v2/v3 labels, format badges, and status badges | VERIFIED | `src/app/(protected)/admin/sops/[sopId]/video/page.tsx:54-59` queries `.eq('archived', false).order('version_number', { ascending: false })`. `VideoVersionRow.tsx:182-195` renders `v{version_number}`, format badge (`Narrated slideshow` / `Screen recording`) and a status badge (Generating / Published / Ready / Failed) with correct color classes. |
| 3 | Publishing a version auto-unpublishes all other versions for that SOP; workers see only the published version | VERIFIED | `publishVersionExclusive` (video.ts:185-214) runs `.update({ published: false }).eq('sop_id', sopId).eq('published', true)` before publishing the target. Defense-in-depth: migration 00018 creates partial unique index `video_generation_jobs_one_published_per_sop ON (sop_id) WHERE published = true`. Worker hook `src/hooks/useVideoGeneration.ts:15-22` is unchanged and still filters `.eq('published', true).eq('status', 'ready')`. |
| 4 | Admin can archive versions (soft delete to collapsible section) and permanently delete from archive | VERIFIED | `archiveVersion` (video.ts:248-265) sets `archived: true, published: false`. `unarchiveVersion` (video.ts:272-286) sets `archived: false`. `permanentDeleteVersion` (video.ts:294-342) fetches storage paths, removes audio+video files from `sop-generated-videos` bucket, then hard-deletes the row. `VideoVersionList.tsx:44-72` renders collapsible "Show N archived versions" with ChevronDown. `VideoVersionRow.tsx:294-315` shows `ArchiveRestore` and `Trash2` icons in archived rows. |
| 5 | Admin can edit an optional label on each version (max 60 chars) via inline editor | VERIFIED | `updateVersionLabel` (video.ts:353-372) validates `trimmed.length > 60`. `VideoVersionRow.tsx:205-228` implements inline editor with `maxLength={60}`, `autoFocus` via useRef, save on blur (line 211) + Enter (line 107-109), cancel on Escape (line 110-113). DB-level enforcement via CHECK constraint `video_generation_jobs_label_length` (migration 00018:30-32). |
| 6 | Active/generating versions show live progress stepper inline in the version list | VERIFIED | `VideoVersionRow.tsx:336-349` renders `<VideoGenerationStatus jobId={version.id} initialStatus={version.status} initialStage={version.current_stage} onComplete={onMutate} onFailed={onMutate} />` inline when `isActiveStatus(version.status)` is true. Caption "Generating your video — this usually takes 2-5 minutes." is present (line 346). Archive icon disabled on active rows with tooltip "Wait for generation to complete before archiving." (line 285). |

**Score:** 6/6 truths automatically verified.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/00018_video_version_management.sql` | DROP CONSTRAINT + 3 new columns + partial unique index + label CHECK | VERIFIED (file) | All 5 operations present: DROP `video_generation_jobs_sop_format_version_unique`; ADD `version_number`/`label`/`archived`; backfill UPDATE; partial unique index `WHERE published = true`; CHECK `char_length(label) <= 60`. See **human verification #1** — cannot confirm applied to live DB without a query. |
| `src/types/sop.ts` (VideoGenerationJob) | Extended with version_number, label, archived | VERIFIED | Lines 162-164. |
| `src/types/database.types.ts` | Row/Insert/Update shapes for video_generation_jobs include new fields | VERIFIED | Lines 739, 741, 762, 764, 785, 787. |
| `src/actions/video.ts` | 6 exported actions (generateNewVersion, publishVersionExclusive, archiveVersion, unarchiveVersion, permanentDeleteVersion, updateVersionLabel) all with requireAdmin() guard | VERIFIED | Lines 112, 185, 248, 272, 294, 353. Each begins with `const auth = await requireAdmin(); if (!auth.ok) return ...`. `regenerateVideo` removed (grep confirmed). `deleteVideoJob` retained as alias export (line 346). |
| `src/lib/validators/sop.ts` | updateVersionLabelSchema | VERIFIED | Lines 147-150. |
| `src/app/api/sops/generate-video/route.ts` | version_number assignment + no old existingJob idempotency | VERIFIED | Lines 76-118. Active-job guard + MAX+1 counter + `version_number: nextVersion` insert. No `existingJob` block. |
| `src/components/admin/VideoVersionRow.tsx` | Version row with inline actions, confirm panels, label editor, status stepper | VERIFIED | 381 lines. All plan acceptance criteria met (see Plan 10-03 detailed per-criterion table in 10-03-SUMMARY.md). Bonus: inline video player (Play/ChevronUp toggle), failed error_message display, autoPlay prop. |
| `src/components/admin/VideoVersionList.tsx` | Container with empty state + collapsible archived section | VERIFIED | 75 lines. Empty state copy exact match; `showArchived` toggle; ChevronDown with `rotate-180` transition; pluralization; renders VideoVersionRow with `isArchived` prop. |
| `src/components/admin/VideoGeneratePanel.tsx` | Rewritten multi-version layout with `VideoVersionList` and `generateNewVersion` | VERIFIED | Props `versions: VideoGenerationJob[]` + `archivedVersions: VideoGenerationJob[]`; "Generate new version" CTA with `bg-brand-orange`; `hasActiveGeneration` guard; calls `generateNewVersion` server action directly. |
| `src/app/(protected)/admin/sops/[sopId]/video/page.tsx` | Dual fetch: non-archived + archived versions, ordered by version_number desc | VERIFIED | Lines 54-67. Two separate queries filter on `archived=false` / `archived=true`, both ordered by `version_number` descending. Passes both arrays to `VideoGeneratePanel`. |
| `src/components/admin/VideoAdminPreview.tsx` | Imports updated to new action names | VERIFIED | Line 6: `publishVersionExclusive, unpublishVideo, generateNewVersion, permanentDeleteVersion` — no `regenerateVideo`, no `publishVideo`, no `deleteVideoJob`. |
| `tests/video-version-management.test.ts` | 8 test.fixme stubs VVM-01..VVM-08 | VERIFIED | All 8 stubs present; `npx playwright test --project=phase10-stubs --list` returns exactly 8 tests. |
| `playwright.config.ts` | phase10-stubs project matching /video-version-management/ | VERIFIED | Lines 41-44. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `admin/sops/[sopId]/video/page.tsx` | `VideoGeneratePanel.tsx` | passes `versions`, `archivedVersions`, `autoPlayJobId` | WIRED | Page queries both version sets, passes as typed props (lines 69-80). |
| `VideoGeneratePanel.tsx` | `VideoVersionList.tsx` | renders with version arrays + sopId + onMutate | WIRED | Lines 187-193. |
| `VideoGeneratePanel.tsx` | `src/actions/video.ts` | calls `generateNewVersion` on CTA click | WIRED | Line 46: `await generateNewVersion(sop.id, selectedFormat)`. |
| `VideoVersionList.tsx` | `VideoVersionRow.tsx` | renders a row per version, forwards onMutate | WIRED | Lines 39-41 (active) and 60-68 (archived, with `isArchived` flag). |
| `VideoVersionRow.tsx` | `src/actions/video.ts` | calls publish/unpublish/archive/unarchive/permanent-delete/update-label | WIRED | Imports lines 6-13; call sites at lines 66, 68, 70, 82, 92, 102. |
| `VideoVersionRow.tsx` | `VideoGenerationStatus.tsx` | renders inline stepper for active rows | WIRED | Lines 336-349. Callbacks invoke `onMutate()` on complete/fail. |
| `generateNewVersion` | `runVideoGenerationPipeline` | `after()` callback | WIRED | video.ts lines 172-174. |
| `generate-video` route | `runVideoGenerationPipeline` | `after()` callback | WIRED | route.ts lines 125-131. |
| `publishVersionExclusive` | DB partial unique index | defense-in-depth DB constraint | WIRED | Migration 00018 lines 25-27 creates `video_generation_jobs_one_published_per_sop` WHERE published=true. Verified in file. **Live DB application needs human confirmation.** |
| `useVideoGeneration` (worker) | `video_generation_jobs` | filters published=true, status=ready | WIRED | Unchanged; hook still returns single row — VVM-04 guarantees worker isolation. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `VideoVersionList` | `versions`, `archivedVersions` props | `video/page.tsx` queries `video_generation_jobs` via admin client | Yes (real DB query with filters and ordering) | FLOWING |
| `VideoVersionRow` | `version` prop | Forwarded from VideoVersionList → VideoGeneratePanel → page.tsx | Yes | FLOWING |
| `VideoGeneratePanel` | `versions`, `archivedVersions` | Server-side fetch in page.tsx, passed as props | Yes | FLOWING |
| `VideoGenerationStatus` | `jobId`, `initialStatus`, `initialStage` | From `version` row (real DB data) | Yes | FLOWING |
| Worker `useVideoGeneration` | single job or null | Supabase client query filtering published=true, status=ready | Yes (unchanged, pre-existing flow) | FLOWING |

No hollow props, no hardcoded empty arrays, no static returns. All data flows from the DB through typed props to rendered UI.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Playwright stubs discoverable | `npx playwright test --project=phase10-stubs --list` | `Total: 8 tests in 1 file` — all 8 VVM-01..VVM-08 listed | PASS |
| TypeScript type check passes | `npx tsc --noEmit` | No errors | PASS |
| Migration file parseable | file read | 33 lines, valid SQL, all 5 operations present | PASS |
| `regenerateVideo` removed from codebase | grep across src | Only appears as historical comment in video.ts:109 — no active export or import | PASS |
| `publishVideo` removed from codebase | grep across src | Only `unpublishVideo` remains (intentionally kept) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description (from stub tests) | Status | Evidence |
|-------------|-------------|-------------------------------|--------|----------|
| VVM-01 | 10-01, 10-02, 10-04 | Generate new version creates a new job row without resetting existing | SATISFIED | `generateNewVersion` MAX+1 pattern, API route same logic. No reset path exists. |
| VVM-02 | 10-01, 10-03, 10-04 | Version list shows all non-archived versions in desc order with v1/v2/v3 labels | SATISFIED | page.tsx orders by `version_number` desc; VideoVersionRow renders `v{version_number}`. |
| VVM-03 | 10-01, 10-02, 10-04 | Publishing version X unpublishes all other versions for that SOP | SATISFIED | `publishVersionExclusive` two-step + DB partial unique index. |
| VVM-04 | 10-01, 10-03, 10-04 | Worker video tab still shows only the published version | SATISFIED | `useVideoGeneration` unchanged; still filters `published=true`. |
| VVM-05 | 10-01, 10-02, 10-03, 10-04 | Archiving moves version to collapsible archived section | SATISFIED | `archiveVersion` + VideoVersionList collapsible section. |
| VVM-06 | 10-01, 10-02, 10-04 | Permanent delete from archived section removes job record | SATISFIED | `permanentDeleteVersion` hard-deletes row + removes storage files. |
| VVM-07 | 10-01, 10-02, 10-03, 10-04 | Label edit saves updated label text | SATISFIED | `updateVersionLabel` + inline editor in VideoVersionRow + DB CHECK constraint. |
| VVM-08 | 10-01, 10-03, 10-04 | Active generation in version list shows live progress stepper | SATISFIED | VideoVersionRow inline renders VideoGenerationStatus for active rows. |

**Orphaned Requirements Check:** `.planning/REQUIREMENTS.md` does **not** contain any formal definition for VVM-01..VVM-08 — the IDs are only referenced in ROADMAP.md Success Criteria, plan frontmatter, and the Playwright stub file. The REQUIREMENTS.md Traceability table has no Phase 10 entries. This is a **documentation gap** flagged for human resolution (human verification item #4). The implementation is complete; only the requirements registry is out of sync.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `tests/video-version-management.test.ts` | 3-31 | `test.fixme` stubs | Info | Intentional — scaffold for future phase implementation; documented in plans. |
| `src/components/admin/VideoGeneratePanel.tsx` | — | No `onSubmit={(e) => e.preventDefault()}` placeholders | — | Clean. |
| `src/actions/video.ts` | — | All mutations use real `admin.from(...)` calls with field-specific updates. No static returns. | — | Clean. |
| `src/app/(protected)/admin/sops/[sopId]/video/page.tsx` | — | Real Supabase queries with filters. No hardcoded empty arrays at the call site (only `?? []` fallback when the query returns null, which is appropriate). | — | Clean. |

No blocker or warning anti-patterns found. The `?? []` fallback on queries is an appropriate null-safety guard, not a stub.

### Human Verification Required

1. **Confirm migration 00018 is applied to the live Supabase database.**
   - **Test:** Run `npx supabase db pull` against production or execute `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'video_generation_jobs' AND column_name IN ('version_number', 'label', 'archived');` in the Supabase SQL editor.
   - **Expected:** Three rows returned (version_number integer, label text, archived boolean). Additionally verify `SELECT indexname FROM pg_indexes WHERE tablename = 'video_generation_jobs' AND indexname = 'video_generation_jobs_one_published_per_sop';` returns one row.
   - **Why human:** 10-04-SUMMARY.md explicitly deferred the schema push. However, post-execution commits (`799912f fix: add error logging to generateNewVersion for debugging`, `ac5ce98`, `353eedc`) strongly imply the admin was running the system live against real data — which would have failed if the columns didn't exist. Still, this requires a direct DB check to confirm.

2. **End-to-end admin walkthrough.**
   - **Test:** (a) Open `/admin/sops/[sopId]/video` on a published SOP. (b) Verify format picker and orange "Generate new version" CTA. (c) Generate a narrated slideshow version → verify new `v1` row appears in list with live stepper. (d) Wait for ready status → click label area → type "Test label" → Enter → verify label saves. (e) Click Upload icon → confirm panel → "Yes, publish" → verify yellow left border and "Published" badge. (f) Generate a second version → publish it → verify first row loses yellow border and new version has it. (g) Click Archive icon on any non-published version → confirm → verify it moves to "Show N archived versions". (h) Expand archived section → click Restore → verify moves back. (i) Archive then click Trash2 on an archived version → "Delete permanently" → verify row disappears and no longer returns on refresh.
   - **Expected:** All steps complete without errors; UI mirrors 10-UI-SPEC.md.
   - **Why human:** Requires live dev server, real Shotstack renders, interactive UX validation. Cannot be determined from code alone.

3. **Worker sees only the published version.**
   - **Test:** Open the same SOP as a worker user → navigate to Video tab → verify only the currently published version renders → unpublish from admin → reload worker view → verify video tab shows empty/unavailable state.
   - **Expected:** Worker view is identical to pre-Phase-10 behaviour — one published video or none.
   - **Why human:** Requires a second auth session as worker role.

4. **Register VVM-01..VVM-08 in REQUIREMENTS.md (documentation gap).**
   - **Test:** Add a `### Video Version Management` subsection to REQUIREMENTS.md v2.0 listing VVM-01 through VVM-08 using the stub-test descriptions as canonical wording. Add Phase 10 rows to the Traceability table.
   - **Expected:** REQUIREMENTS.md is internally consistent — every ID referenced in plans and ROADMAP has a matching definition.
   - **Why human:** This is a documentation decision, not a code fix. Choice of whether to backfill or accept drift belongs to the project owner.

### Gaps Summary

No code gaps. Every ROADMAP.md Success Criterion for Phase 10 is satisfied by the source files on disk, every plan acceptance criterion has been met, all 6 new server actions are wired into the UI, and the worker video experience remains unchanged (VVM-04 preserved by deliberate inaction).

Two non-code items require human attention:
1. **DB schema push confirmation** — 10-04 deferred the push; post-commit activity (`generateNewVersion` error-logging fix, recover-renders endpoint, Shotstack quality tuning) strongly suggests the push happened, but needs direct confirmation.
2. **REQUIREMENTS.md registration** — VVM-01..VVM-08 are referenced but not formally defined in REQUIREMENTS.md. Traceability table has no Phase 10 entries.

The out-of-wave execution (Plan 10-04 running before 10-03 and creating the components as a Rule 3 deviation, then 10-03 running as a verify-and-document pass) was handled correctly. Subsequent hotfix commits (`4b61817`, `799912f`, `7166b5d`, `ac5ce98`, `28e51b7`, `0781123`, `353eedc`, `db69bda`, `73f853b`, `b8c96b4`) refined real-world behaviour without regressing the plan acceptance criteria.

---

_Verified: 2026-04-13_
_Verifier: Claude (gsd-verifier)_
