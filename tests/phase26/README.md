# Phase 26 — SOP Builder Redesign: Nyquist test harness

This directory is the single home for every Phase 26 test. It is registered in
`playwright.config.ts` as the **`phase26`** project with a deliberately broad
`testMatch` regex:

```
/tests\/phase26\/.*\.(spec|test)\.ts$/
```

## Rules

- **Any new Phase 26 spec MUST live under `tests/phase26/`.** Because the regex
  is broad, no further `playwright.config.ts` edit is needed — dropping a file
  here is enough for it to run. (CLAUDE.md 2026-05-25: a spec not matched by any
  project regex NEVER runs.)
- Run the suite: `npx playwright test --project=phase26`
- List discovered specs (registration sanity check):
  `npx playwright test --list --project=phase26`

## Contents

### `convert-golden-path.spec.ts` + `fixtures/convert-golden.json` (Plan 26-02)

The **R6 byte-equivalence baseline**. Before any editor/renderer change touches
the pipeline, `scripts/capture-convert-golden.ts` runs a fixed, known-DOCX
`ParsedSop` through the UNCHANGED deterministic convert path
(`parsedSopToPerSectionLayoutData` + `puckPropsToBlockContent`) and freezes the
resulting `layout_data.content[]`, the would-be `sop_section_blocks` junction
rows (kind + pin_mode + verified default + block_provenance), and section order
into `fixtures/convert-golden.json`.

- The spec re-runs the capture and deep-equals it against the committed fixture.
  It is **green now** (W0 head) and becomes the **R6 regression guard** the
  moment the Wave 2 bespoke renderer swap lands (D-01: `layout_data` / junction /
  provenance are frozen).
- Regenerate the fixture (only when the frozen contract legitimately changes):
  `npx tsx scripts/capture-convert-golden.ts`
- Verify parity + determinism without Playwright:
  `npx tsx scripts/capture-convert-golden.ts --check`

Why a fixed `ParsedSop` and not a live DOCX→GPT→DB run: the GPT parse is
non-deterministic and the junction writes need Supabase, neither of which is
byte-reproducible in CI. The frozen D-01 contract is the *deterministic
code-owned converter*, so the baseline exercises exactly that — a true,
runnable, byte-stable pre-phase snapshot.
