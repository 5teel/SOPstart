---
phase: 40-shared-creation-foundation
plan: 11
subsystem: database
tags: [supabase, category_slug, versioning, source-contract-test, governance]

# Dependency graph
requires:
  - phase: 40-shared-creation-foundation
    provides: "sops.category_slug column + uploadNewVersion carry-forward (plans 40-04/40-05/40-07)"
provides:
  - "cloneSopAsDraft (and restoreVersionAsNew, which delegates to it) carries category_slug through 'Edit into new version' and 'Restore'"
  - "A data-keyed census test (tests/phase40/dat01-category-column.spec.ts) that fails on any new/unclassified sops-table write missing category_slug"
affects: [40-verification, 40-review, governance, versioning]

# Tech tracking
tech-stack:
  added: []
  patterns: ["table-write census keyed on .from('sops').insert/update/upsert payload fingerprints, not on a planner-enumerated function list"]

key-files:
  created: []
  modified:
    - src/actions/versioning.ts
    - tests/phase40/dat01-category-column.spec.ts

key-decisions:
  - "restoreVersionAsNew needed no edit — it delegates entirely to cloneSopAsDraft with no sops insert of its own, confirmed by reading the function body"
  - "Census fingerprint = sorted top-level payload keys extracted via balanced-paren parsing (tighter than the sibling dat01-migration.spec.ts's fixed-length-lookahead chainRe), to avoid false-positive/false-empty matches on single-line object literals"
  - "28 unique CATEGORY_EXEMPT entries cover the 36 non-category-carrying write sites (out of 45 total); each entry keyed on (file, keys) so repeated identical-fingerprint call sites in the same file share one reason"

requirements-completed: [DAT-01]

# Metrics
duration: ~35min
completed: 2026-07-29
---

# Phase 40 Plan 11: Category survives clone/restore + write-census guard Summary

**cloneSopAsDraft now carries `category_slug` through "Edit into new version" and "Restore," closed by a data-keyed sops-table write census (45 write sites, 28 justified exemptions) that fails on any future write that drops the column.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `cloneSopAsDraft`'s source select now includes `category_slug`, and its clone insert writes `category_slug: sourceSop.category_slug ?? null` — mirroring `uploadNewVersion`'s existing carry-forward exactly
- `restoreVersionAsNew` needed no edit: it delegates entirely to `cloneSopAsDraft` (confirmed by reading the function body — no separate `sops` insert), so the fix covers both "Edit into new version" and "Restore" from one change
- Added a new census test to `tests/phase40/dat01-category-column.spec.ts` that walks every `.from('sops').insert(|.update(|.upsert(` under `src/`, fingerprints each payload's top-level keys, and requires every non-category-carrying write to have a justified `CATEGORY_EXEMPT` entry
- Pinned the total write-site count (45) so a future write path (added or removed) forces the census to be reviewed, not silently pass
- Ran the required mutation proof: temporarily removed the `category_slug` line from `cloneSopAsDraft` — census went RED naming `src/actions/versioning.ts`; restored it — suite went GREEN (50 passed, 1 fixme)

### The cascade this closes
Per 40-VERIFICATION.md GAP 3: before this fix, every SOP put through "Edit into new version" or "Restore" (both routed through `cloneSopAsDraft`) silently lost its category. Downstream: `resolveCadenceMonths` fell back to the 12-month default cadence (wrong review clock), `ensureSopCollectionsForOrg` skipped the Collection join (SOP silently dropped from the grant system with no audit signal), and the publish route's `approval_chains` lookup never matched — a chain-gated category silently lost its approval requirement on the clone (an elevation-of-privilege hole per the threat register's T-40-11-01).

## Task Commits

1. **Task 1: Carry category_slug through cloneSopAsDraft** - `cbd5b77` (fix)
2. **Task 2: Add a sops-table write census** - `25f4948` (test)

## Files Created/Modified
- `src/actions/versioning.ts` - `cloneSopAsDraft`'s select and insert now carry `category_slug`, mirroring `uploadNewVersion`
- `tests/phase40/dat01-category-column.spec.ts` - added the sops-table write census (`CATEGORY_EXEMPT` table, `findSopsWrites`/`extractBalancedParens` helpers, pinned write-site count)

## Decisions Made
- Kept the org-scope guard (`sourceSop.organisation_id !== organisationId`), `computeNextVersionLineage` call, `status: 'uploading' as const` sentinel, and index-matched `sectionIdMap` construction verbatim, as pinned in the plan's acceptance criteria
- Used a balanced-parenthesis extraction for the census's payload capture rather than reusing `dat01-migration.spec.ts`'s fixed-length-lookahead `chainRe` verbatim — the fixed-length version reliably found `category:`/`category_tag:` absence (its narrow job) but produced empty/garbled fingerprints for the census's broader "extract every key" job on single-line object literals; the shape (walk → strip comments → match `.from('sops')...insert/update/upsert(`) is the same, the extraction internals are tighter
- Exempt entries are keyed on `(file, keys)` rather than one entry per physical call site, since several call sites share an identical fingerprint and reason (e.g. the four `source_file_path`-only finalize writes across the upload-session creators)

## Deviations from Plan

None — plan executed exactly as written. `restoreVersionAsNew` was confirmed (per the plan's own instruction) to require no edit since it delegates to `cloneSopAsDraft`.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 40-VERIFICATION.md GAP 3 closed; 40-REVIEW.md CR-03 closed
- SC-5's forward-going half now holds: no code path under `src/` can add a categoryless `sops` write without failing `npx playwright test --project=phase40`
- No blockers for remaining gap-closure plans (40-10, 40-12..40-14)

---
*Phase: 40-shared-creation-foundation*
*Completed: 2026-07-29*
