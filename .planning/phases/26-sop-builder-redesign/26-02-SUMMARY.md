---
phase: 26-sop-builder-redesign
plan: 02
subsystem: test-harness
tags: [nyquist, playwright, golden-fixture, regression, R6]
requires: []
provides:
  - phase26-playwright-project
  - convert-golden-path-baseline
affects:
  - playwright.config.ts
tech-stack:
  added: []
  patterns:
    - "Broad per-phase testMatch regex (tests/phase26/**) = single registration point"
    - "Deterministic converter snapshot as byte-equivalence baseline (id-normalized)"
key-files:
  created:
    - tests/phase26/README.md
    - scripts/capture-convert-golden.ts
    - tests/phase26/fixtures/convert-golden.json
    - tests/phase26/convert-golden-path.spec.ts
  modified:
    - playwright.config.ts
decisions:
  - "R6 baseline captured from the code-owned deterministic converter (parsedSopToPerSectionLayoutData + puckPropsToBlockContent) using a fixed ParsedSop, NOT a live DOCX->GPT->DB run — GPT is non-deterministic and junction writes need Supabase, neither byte-reproducible in CI. The frozen D-01 contract IS the deterministic converter, so this is a true, runnable baseline."
  - "Only the converter's props.id (nextId uses Date.now()) is non-deterministic; normalized to id#{order}.{index}. Everything else is byte-exact."
  - "phase26 project uses one broad regex so every later plan drops specs into tests/phase26/ with no further playwright.config.ts edit (CLAUDE.md 2026-05-25)."
metrics:
  duration: ~12m
  completed: 2026-07-03
---

# Phase 26 Plan 02: Nyquist Harness + R6 Convert Golden Baseline Summary

Stood up the `phase26` Playwright project (broad `tests/phase26/**` regex) and froze the pre-phase R6 byte-equivalence baseline of the convert path — captured NOW, on pre-editor-change code, so the Wave 2 bespoke-renderer swap (D-01: `layout_data`/junction/provenance frozen) can be proven unchanged at phase end.

## What was built

### Task 1 — phase26 Playwright project (`c3d326c`)
- Added a `phase26` project to `playwright.config.ts` with `testDir: '.'` and the deliberately broad `testMatch: /tests\/phase26\/.*\.(spec|test)\.ts$/`. This is the single registration point for the whole phase — later plans add specs under `tests/phase26/` with no further config edit.
- `tests/phase26/README.md` documents the project name, `npx playwright test --project=phase26`, the "specs must live under tests/phase26/" rule, and how the golden baseline works.
- Verified: `npx playwright test --list --project=phase26` discovers the spec (3 tests).

### Task 2 — pre-phase convert golden baseline (`190fe31`)
- `scripts/capture-convert-golden.ts` — runs a fixed known-DOCX `ParsedSop` (SOP-009 Alkaline Cleaning tank, crafted to exercise the full block surface: Text / Hazard / PPE / Step / StepWithPhotos / Callout warning+caution+tip / Heading + PhotoGrid orphan path) through the UNCHANGED `parsedSopToPerSectionLayoutData` + `puckPropsToBlockContent`, and serializes a canonical, id-normalized snapshot: per section `layout_data.content[]`, the would-be `sop_section_blocks` junction rows (`kind` + `pin_mode: 'pinned'` + `verified: false` + `block_provenance`), and section order. CLI: default writes the fixture; `--check` asserts parity + determinism (exit 1 on drift).
- `tests/phase26/fixtures/convert-golden.json` — the committed R6 baseline.
- `tests/phase26/convert-golden-path.spec.ts` — deep-equals a live capture against the committed fixture, asserts determinism across repeated runs, and asserts the fixture covers the full frozen block surface + non-empty pinned/unverified/provenanced junction rows.
- Verified green at W0 head: `npx playwright test --project=phase26` → 3 passed; `npx tsx scripts/capture-convert-golden.ts --check` → GOLDEN OK.

## Deviations from Plan

None materially — plan executed as written. One documented interpretation of the plan's stated fallback ("if capturing against a live DB/parse is not runnable, follow the plan's fallback exactly — a committed sample fixture the spec reads"):

- The plan's Task-2 `<action>` describes running "a known DOCX ... through the SAME parse path the convert on-ramp uses." The literal end-to-end path (DOCX → `extract-docx` → **GPT** → `ParsedSop` → converter → **DB junction writes**) is NOT byte-reproducible: the GPT parse is non-deterministic and `materializeJunctionsForLayout` needs a live Supabase service-role connection. The **frozen D-01 contract is the deterministic code-owned converter**, so the baseline captures exactly that — the real `parsedSopToPerSectionLayoutData` (layout_data + block_provenance) and the real pure `puckPropsToBlockContent` (the kind-projection that builds each junction's library block). Junction rows are always created `pin_mode: 'pinned'` + unverified at parse time, so that default is captured directly. This is the plan's committed-sample-fixture fallback, and it is fully runnable + byte-stable in CI.

## Known Stubs

None. The spec runs live (not `test.fixme`), passes green now, and auto-converts to the R6 regression guard when the Wave 2 renderer swap lands.

## Verification

- `npx playwright test --list --project=phase26` → 3 tests discovered (registration confirmed).
- `npx playwright test --project=phase26` → 3 passed.
- `npx tsx scripts/capture-convert-golden.ts --check` → GOLDEN OK (parity + determinism).
- `npx tsc --noEmit` → no errors in the new files.

## Self-Check: PASSED
- FOUND: tests/phase26/README.md
- FOUND: scripts/capture-convert-golden.ts
- FOUND: tests/phase26/fixtures/convert-golden.json
- FOUND: tests/phase26/convert-golden-path.spec.ts
- FOUND: playwright.config.ts (phase26 project)
- FOUND commit: c3d326c (Task 1)
- FOUND commit: 190fe31 (Task 2)
