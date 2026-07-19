---
phase: 30-ux-consolidation
plan: 05
subsystem: create-entry
tags: [method-picker, ux-04, create-entry, journeys, upload-first]
requires:
  - 30-01 (phase30 harness + create-entry.spec.ts stub)
  - 30-03 (AdminNav — the picker mounts it)
provides:
  - /admin/sops/new method picker — 4 tiles Upload-first (Upload a document · Talk it through ?mode=voice · Describe it · Start blank), admin guard verbatim, AdminNav active="sops"
  - /admin/sops reduced to ONE "New SOP" button → /admin/sops/new (4 header + 4 empty-state create-buttons deleted)
  - create-entry.spec.ts live: 4 live tests incl. src-wide stray-intake-href sweep
  - journeys.ts maps the picker into all 5 create journeys
affects:
  - 30-06 (worker /sops "Create SOP" tab removal — the remaining UX-04 slice; its fixme test flips there and marks UX-04 complete)
tech-stack:
  added: []
  patterns:
    - "Method picker tiles = the lifted DashTile blueprint-frame pattern (eyebrow + title + description Link)"
    - "Spec sweep test walks src/ for href=\"/admin/sops/(upload|new/ai|new/blank)\" with an explicit allowed-set (picker + 30-06 handoff file)"
key-files:
  created:
    - src/app/(protected)/admin/sops/new/page.tsx
  modified:
    - src/app/(protected)/admin/sops/page.tsx (8 create buttons → 1 New SOP button; empty-state copy repointed)
    - src/lib/journeys/journeys.ts (picker screen step added to document/video/ai/voice/blank create journeys)
    - tests/phase30/create-entry.spec.ts (flipped live — 4 live / 1 fixme)
decisions:
  - "Empty state carries NO link of its own ('Use the New SOP button above') — keeps the page at exactly one /admin/sops/new href per the must_have"
  - "Picker added to ALL 5 create journeys (incl. create-from-video, which previously started at /admin/sops/upload directly) — the picker is now the real first screen of every create flow"
  - "Sweep test allows WORKER_SOPS_PAGE explicitly — its /admin/sops/upload Create-SOP tab is 30-06 scope (shares sops/page.tsx); the fixme test documents the handoff"
  - "UX-04 NOT marked complete in REQUIREMENTS.md — the worker Create SOP tab removal is the remaining UX-04 slice, owned by 30-06 (same handoff pattern as 30-02/30-03)"
metrics:
  duration: ~8m
  completed: 2026-07-13
---

# Phase 30 Plan 05: One Create Entry (UX-04) Summary

**One-liner:** 8 scattered create entry points collapsed to one "New SOP" button → an Upload-first 4-tile method picker at /admin/sops/new (Upload a document · Talk it through ?mode=voice · Describe it · Start blank) with the 3 intake routes untouched as destinations and journeys mapped same-commit.

## What was built

### Task 1 — Method-picker page (commit `a05a730`)
- `src/app/(protected)/admin/sops/new/page.tsx`: server page, `['admin', 'safety_manager']` guard copied verbatim from `new/ai/page.tsx` (redirect('/dashboard') — the 30-02 shim forwards), `<AdminNav active="sops" />`, 4 tiles from a typed `METHODS` array using the lifted DashTile blueprint-frame markup (eyebrow + title + one-line description, focus-visible outline for keyboard use).
- Tile order per Visy (CONTEXT UX-04, Upload FIRST): `/admin/sops/upload` → `/admin/sops/new/ai?mode=voice` → `/admin/sops/new/ai` → `/admin/sops/new/blank`. The `?mode=voice` deep-link is honoured by AiDraftTabs (unchanged).

### Task 2 — One New SOP button + journeys + spec flip (commit `692bbbf`)
- `/admin/sops` header: the 4 create buttons (Upload / Blank / AI Draft / 🎤 Voice Draft) replaced by one primary "New SOP" button → `/admin/sops/new`. Empty state: the 4 repeated buttons deleted; copy now points at the header button (zero extra links).
- `journeys.ts` (same-commit rule): "New SOP method picker" screen step inserted into all 5 create journeys (create-from-document, create-from-video, create-with-ai, create-with-voice, create-blank) so /pathways covers the new route.
- `create-entry.spec.ts` flipped live — 4 live tests: (1) picker has all 4 hrefs Upload-first + guard string + AdminNav wiring, (2) /admin/sops has EXACTLY one `href="/admin/sops/new"` (regex count) and zero direct intake hrefs, (3) src-wide walk asserts no stray `href="/admin/sops/(upload|new/ai|new/blank)"` outside the picker (+ the 30-06 worker-page allowance), (4) journeys maps `/admin/sops/new`. Worker Create-SOP-tab test stays fixme for 30-06.

## Verification results

| Gate | Result |
|------|--------|
| `npx tsc --noEmit` | clean (both tasks) |
| `npx playwright test tests/phase30/create-entry.spec.ts --project=phase30` | 4 passed / 1 skipped / 0 failed |
| `npx playwright test --project=phase30` | 19 passed / 22 skipped / 0 failed |
| `npx playwright test --project=phase28 --project=phase29` | 122 passed / 3 skipped / 0 failed (admin/sops page edit regression-checked) |

## Deviations from Plan

None - plan executed exactly as written. (The empty-state "single New SOP button" was implemented as link-free copy pointing at the header button, satisfying the exactly-one-href acceptance criterion.)

## Requirements note

`requirements: [UX-04]` NOT marked complete in REQUIREMENTS.md per the plan's ownership note: the worker `/sops` "Create SOP" tab removal is also UX-04 and lives in 30-06 (shares `sops/page.tsx`). 30-06 flips the remaining fixme and marks UX-04.

## Known Stubs

None in production code. The single `test.fixme` in create-entry.spec.ts (worker Create SOP tab) is the deliberate 30-06 handoff, and the sweep test's WORKER_SOPS_PAGE allowance is removed by nothing — it simply becomes vacuous once 30-06 deletes that tab's href.

## Threat Flags

None — T-30-05-01 mitigated as planned: the picker copies the admin guard verbatim (spec-asserted) and its tiles are plain Links to already-guarded intake routes; no new server action or data path. No package installs (T-30-05-SC).

## Commits

| Commit | Description |
|--------|-------------|
| `a05a730` | feat(30-05): method-picker page at /admin/sops/new — 4 tiles, Upload first |
| `692bbbf` | feat(30-05): collapse /admin/sops create buttons to one New SOP button |

## Self-Check: PASSED

picker page + spec + journeys edits on disk; commits `a05a730` and `692bbbf` in git log; phase30 19/0, phase28+29 122/0, tsc clean.
