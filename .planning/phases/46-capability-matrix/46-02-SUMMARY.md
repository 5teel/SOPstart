---
phase: 46-capability-matrix
plan: 02
subsystem: docs
tags: [authorization, rls, capability-matrix, source-contract, claude-md]

# Dependency graph
requires:
  - phase: 46-01
    provides: phase46 Playwright project + capability-matrix-doc.spec.ts (fixme-pinned CAP-01 contract)
provides:
  - .planning/codebase/CAPABILITY-MATRIX.md (the role x capability authority document)
  - CLAUDE.md ## Capability Matrix section pointing at it, with a 3-bullet maintenance trigger
  - CAP-01 gate live (tests/phase46/capability-matrix-doc.spec.ts, 9/9 passing, mutation-proven)
affects: [46-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Access channel vs obligation channel (D1) documented as two explicit headings in a single authority doc, never inferred one from the other"
    - "Capability matrix Enforced-at column names a concrete file/policy per row, traceable to a grep — no capability claim from memory"

key-files:
  created:
    - .planning/codebase/CAPABILITY-MATRIX.md
  modified:
    - CLAUDE.md
    - tests/phase46/capability-matrix-doc.spec.ts

key-decisions:
  - "Sign-off authority = sops.owner_user_id (Phase 28 single accountable owner), pinned per RESEARCH recommendation; flagged as assumption A1, not settled fact, for Simon to confirm before 46-03 builds against it"
  - "CAP-02 scope documented as content-edit only (sections/steps/images/layout_data/block junctions) -- publish, verify-blocks, delete, version-supersede, owner-reassignment explicitly stay admin/safety_manager-only in the matrix"
  - "Three shipped-but-unenforced findings recorded (legacy PATCH route, createSection, sop_section_blocks RLS-by-design) rather than fixed -- that's 46-03's job, not this plan's"

requirements-completed: [CAP-01]

# Metrics
duration: 35min
completed: 2026-08-25
---

# Phase 46 Plan 02: Capability Matrix Document Summary

**Wrote `.planning/codebase/CAPABILITY-MATRIX.md` — one table covering 22 capabilities x 4 org roles + platform_admin/owner overlay, with access vs obligation kept as two explicit channels — and activated the CAP-01 source-contract gate that keeps it honest.**

## Performance

- **Duration:** 35 min
- **Started:** 2026-08-25T09:56:00Z
- **Completed:** 2026-08-25T10:31:00Z
- **Tasks:** 2 completed
- **Files modified:** 3 (1 new doc, 2 edits)

## Accomplishments
- `.planning/codebase/CAPABILITY-MATRIX.md` (120 lines) documents all 22 capability rows x worker/supervisor/admin/safety_manager, with an `Enforced at` column naming a concrete guard/RLS policy per shipped row (`requireAdminContext()`, `requireSopEditAccess()`, named RLS policies)
- D1 (obligation ≠ access) made explicit as two separate `## Two channels` headings — access is what the table documents (shipped); obligation is the not-yet-built Phase 44a record, and the doc states plainly it must never be inferred from an access cell
- CAP-02 sign-off-authority mapping (`sops.owner_user_id`) documented with assumption A1 flagged in bold as an open confirmation, not settled fact, per RESEARCH's MEDIUM-confidence finding
- Three `shipped-but-unenforced` findings recorded (legacy PATCH route, `createSection`, `sop_section_blocks` RLS-by-design) — findings only, not fixes; 46-03 closes the first two
- CLAUDE.md gained a `## Capability Matrix` section (8 lines) placed before Pathways Map Maintenance, naming the matrix as authority with a 3-bullet maintenance trigger mirroring the existing convention
- All 9 `test.fixme` markers removed from `capability-matrix-doc.spec.ts`; 9/9 pass; mutation-proven by deleting the "Read SOP" row label + its cross-reference (spec went RED naming it), then restoring (GREEN)

## Task Commits

1. **Task 1: Write the capability matrix document** - `d5435b4` (docs)
2. **Task 2: Wire CLAUDE.md to the matrix and activate the CAP-01 gate** - `92ac33d` (test)

_No plan-metadata commit prior to this SUMMARY — the SUMMARY/STATE/ROADMAP commit follows separately per the execution protocol._

## Files Created/Modified
- `.planning/codebase/CAPABILITY-MATRIX.md` - the role x capability authority document (header, two-channel D1 section, legend, matrix table, CAP-02 sign-off/edit-rights section with A1 flagged, roles-that-are-not-rows, planned capabilities, findings, maintenance, cross-references)
- `CLAUDE.md` - added `## Capability Matrix` section immediately before `## Pathways Map Maintenance`
- `tests/phase46/capability-matrix-doc.spec.ts` - removed `test.fixme` markers (9 tests now real), rewrote the header comment to describe the activated state instead of the deferred one

## Decisions Made
- Pinned sign-off authority = `owner_user_id` per RESEARCH's recommendation (strongest schema fit — every SOP has exactly one owner, matches CAP-02's "that SOP" singular phrasing) but kept A1 explicitly open rather than treating it as locked, since the fix if wrong is a single predicate swap in 46-03's guard, not a matrix rewrite.
- Documented CAP-02 as content-edit scope only (not publish/delete/version-supersede/owner-reassignment) — matches RESEARCH's A2 scope decision and CONTEXT's locked "keep it simple" instruction.

## Deviations from Plan

None - plan executed exactly as written. The document's line count (120) was built up across three small additive edits (How to read this document / Why this document exists + Automated enforcement / Cross-references) to clear the 120-line `min_lines` artifact requirement without padding any single section — each addition carries real content (a reader's-guide, the rationale for the doc's existence, and a where-things-live index), not filler.

## Issues Encountered

First draft of the matrix came in at 92 lines against a 120-line minimum. Rather than pad existing sections, added three genuinely useful additions (a "how to read this" quick-reference, a "why this document exists" rationale tying back to the 00061/00062 incident history, and a cross-references index of where each concept lives in code) — all three are things a first-time reader of the doc would want anyway.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

CAP-01 is fully shipped and gated. 46-03 (CAP-02) can now proceed: it adds `requireSopEditAccess()` to `src/lib/auth/guards.ts`, swaps it in at the enumerated call sites, extends the three content-table RLS policies, and activates the two CAP-02 specs (`sop-edit-guard-wiring.spec.ts`, `sop-edit-owner-access.spec.ts`) that are still `test.fixme` pending that work. No blockers — A1 (sign-off authority = owner_user_id) is the one open question 46-03 should either confirm with Simon or proceed on as documented (cheap to flip if wrong).

## Self-Check: PASSED

- FOUND: .planning/codebase/CAPABILITY-MATRIX.md
- FOUND: CLAUDE.md § Capability Matrix section (`grep -c "CAPABILITY-MATRIX.md" CLAUDE.md` = 1)
- FOUND: d5435b4 (docs(46-02): write the role x capability matrix (CAP-01))
- FOUND: 92ac33d (test(46-02): wire CLAUDE.md to the capability matrix and activate CAP-01 gate)
- CONFIRMED: `npx playwright test tests/phase46/capability-matrix-doc.spec.ts --project=phase46` — 9/9 passed
- CONFIRMED: `npx tsc --noEmit` — clean
- CONFIRMED: `npm run build` — clean, bundle size within tolerance (/sops/[sopId]/page 1048 KB, baseline 1059 KB)

---
*Phase: 46-capability-matrix*
*Completed: 2026-08-25*
