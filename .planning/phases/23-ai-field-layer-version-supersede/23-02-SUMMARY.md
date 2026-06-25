---
phase: 23-ai-field-layer-version-supersede
plan: "02"
subsystem: ai-fields
tags: [registry, validators, api-route, tdd, afl-ai-01, afl-ai-03]
dependency_graph:
  requires: ["23-00", "23-01"]
  provides: ["23-03", "23-04"]
  affects: ["src/lib/ai-fields", "src/lib/validators", "src/app/api/ai-fields"]
tech_stack:
  added: []
  patterns:
    - "Module-level Map registry (no React dependency) for server-driven field lookups"
    - "Side-effect import barrel populates registry before first request (Pitfall 3)"
    - "Write descriptors call @/actions/ functions — never bypass Supabase directly"
key_files:
  created:
    - src/lib/validators/ai-fields.ts
    - src/lib/ai-fields/registry.ts (replaced stub)
    - src/lib/ai-fields/index.ts
    - src/lib/ai-fields/registrations/index.ts
    - src/app/api/ai-fields/read/route.ts
  modified:
    - src/lib/ai-fields/__tests__/registry.test.ts (un-fixme'd)
    - src/actions/sops.ts (added updateSopTitle)
    - src/actions/sections.ts (added updateSectionTitle)
decisions:
  - "FieldContext type re-exported from validators/ai-fields.ts into registry.ts — single source of truth per 23-PATTERNS.md"
  - "sop.title registered as low-stake; write() calls updateSopTitle (new action in sops.ts, session client + role guard)"
  - "sop.section.title registered as high-stake; write() calls updateSectionTitle (new action in sections.ts, admin client + org-scope self-enforcement per CLAUDE.md 2026-06-15)"
  - "read route takes organisationId from JWT only — never from client-supplied query param (T-23-02-01)"
  - "read route imports '@/lib/ai-fields/registrations' as side-effect — populates Map before first cold-start request (Pitfall 3)"
metrics:
  duration: "327s"
  completed: "2026-06-25"
  tasks_completed: 3
  files_changed: 8
---

# Phase 23 Plan 02: AI Field Registry + Validators + Read API Summary

**One-liner:** Unified typed field descriptor registry (module-level Map, no React) with Zod validators, two real field registrations wired to existing server actions, and a GET read API — the AFL-AI-01/03 backbone for v5.0 agent consumption.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Field registry module + validators + index barrels | 8d41765 | validators/ai-fields.ts, registry.ts, index.ts, registry.test.ts |
| 2 | Register ≥2 real fields + registration barrel | f9944ba | registrations/index.ts, sops.ts, sections.ts |
| 3 | GET /api/ai-fields/read route | 8ae68fa | src/app/api/ai-fields/read/route.ts |

## Verification Results

- `npx playwright test --project=phase23-unit` — 4/4 GREEN (round-trip, idempotent, read, getAllFields)
- `grep getField src/app/api/ai-fields/read/route.ts` — confirmed registry resolution
- `npx tsc --noEmit` — clean (no errors)
- Wave-0 `test.fixme` markers removed; all 4 AFL-AI-03 behavioral tests live and GREEN

## Deviations from Plan

### Auto-added Missing Critical Functionality

**1. [Rule 2 - Missing] Added updateSopTitle() to src/actions/sops.ts**
- **Found during:** Task 2
- **Issue:** Plan required `sop.title` write descriptor to "CALL an existing SOP-title server action", but no such action existed in sops.ts.
- **Fix:** Added `updateSopTitle(sopId, newTitle)` — validates non-empty string, admin role guard, session client with org-scoping via `.eq('organisation_id', organisationId)`. Low-stake pattern: uses session client (RLS applies).
- **Files modified:** src/actions/sops.ts
- **Commit:** f9944ba

**2. [Rule 2 - Missing] Added updateSectionTitle() to src/actions/sections.ts**
- **Found during:** Task 2
- **Issue:** Plan required a published-SOP content field (high-stake) wired to an existing action; no section title update action existed.
- **Fix:** Added `updateSectionTitle(sectionId, newTitle)` — admin role guard, admin client (for published/superseded SOPs per RESEARCH Pitfall 5), org-scope self-enforcement via two-step SOP ownership check (CLAUDE.md 2026-06-15 pattern).
- **Files modified:** src/actions/sections.ts
- **Commit:** f9944ba

## Threat Surface Scan

| Flag | File | Description |
|------|------|-------------|
| threat_flag: information_disclosure | src/app/api/ai-fields/read/route.ts | New authenticated GET endpoint. Mitigated: JWT-derived organisationId, RLS session client, allow-list via registry.getField(). |

No new endpoints beyond those planned. T-23-02-01 through T-23-02-04 all addressed per plan's threat register.

## Known Stubs

None — registry.ts is a complete implementation. registrations/index.ts registers 2 real fields with real read/write functions. The read API is fully wired. No placeholder data flows to any rendering surface.

## TDD Gate Compliance

- RED gate: test.fixme markers in 23-00-PLAN.md (Wave-0 scaffold) — ✓ confirmed (prior plan)
- GREEN gate: test.fixme removed in this plan (Task 1 commit 8d41765) — ✓ confirmed
- 4 behavioral tests pass (round-trip, idempotent, read, getAllFields)

## Self-Check: PASSED

All 6 created/modified files exist on disk. All 3 task commits verified in git log.

| Item | Status |
|------|--------|
| src/lib/validators/ai-fields.ts | FOUND |
| src/lib/ai-fields/registry.ts | FOUND |
| src/lib/ai-fields/index.ts | FOUND |
| src/lib/ai-fields/registrations/index.ts | FOUND |
| src/app/api/ai-fields/read/route.ts | FOUND |
| src/lib/ai-fields/__tests__/registry.test.ts | FOUND |
| Commit 8d41765 | FOUND |
| Commit f9944ba | FOUND |
| Commit 8ae68fa | FOUND |
