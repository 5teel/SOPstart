# ADR-0006: Typography: Inter for reading, Saira for labels

- **Status:** Accepted (its caps-label rule superseded by ADR-0007)
- **Date:** 2026-10-09
- **Decided by:** Simon
- **Supersedes:** none. Refines ADR-0004 rule 8 (one design source in `blueprint-theme.css`); the faces and sizes live there.
- **Enforced by:** `tests/lint/typography.spec.ts`

## Context
The app named Inter and JetBrains Mono in CSS but loaded neither (only Saira, for the wordmark), so every
"mono" label fell back to whatever the device had. Mono labels were also 9 to 11 px, too small for
gloves, glare and tired eyes.

## Decision
Two typefaces, both loaded with `next/font` in `src/app/layout.tsx`:

1. **Inter** (`--font-inter`, token `--font-reading`): all reading. Titles, step instructions, body, buttons.
   Body sets `font-feature-settings: 'tnum'` (tabular digits).
2. **Saira Semi Condensed** (`--font-saira`, token `--font-label`, utility `font-label`): wordmark, section
   labels, step and kind tags, pills, short data lines (area, type, minutes, versions, dates, counts, "Step 3 of 8").
   It replaces JetBrains Mono everywhere. No JetBrains Mono remains.

Rules for Saira: short strings only; minimum 12 px; weight 500 or more. Labels and tags are caps, weight 700,
about +0.06em tracking. Data lines are sentence case, weight 500, 13 px, ink-600 or darker. Caps only for
labels and tags. Step instructions and any long text stay Inter.

Size tokens: `--text-micro` is 12 px and `--text-meta` is 13 px (were 10 and 11).

## Findings on the shipped fonts (checked 2026-10-09 on the woff2 files in `.next/static/media`)
- **Inter** from Google Fonts has `tnum` and `pnum` only. The safety glyphs `cv05` (l with tail), `cv08`
  (I with serif) and `zero` (slashed zero) are stripped from that build, so they are NOT enabled. Getting them needs a self-hosted
  full Inter file via `next/font/local`; do that in a new ADR if wanted.
- **Saira Semi Condensed** has no OpenType features and proportional digits, so no `tnum`. Numbers that must align in
  a column (tables, timestamps) use the `figures` class (Inter, tabular). Inline data lines stay Saira.

## Consequences
- `.mono` is kept as the class name for the label face (about 160 call sites); it now means Saira. `font-mono` call
  sites were renamed to `font-label`. `.mono` sits in `@layer components`, so utilities still override weight and tracking.
  `.mono.uppercase` gives the label style (700, +0.06em).
- Bigger labels can break fixed-width controls and row-height ceilings; check evals that measure them.

## How to comply
Use `font-label` / `.mono` for labels and data, never a font-family literal; nothing under 12 px; do not put Saira on
sentences. Need a tabular column of numbers: add `figures`.
