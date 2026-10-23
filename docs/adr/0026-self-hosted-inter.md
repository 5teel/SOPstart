# ADR-0026: Inter is self-hosted so the safety glyphs ship

- **Status:** Accepted
- **Date:** 2026-10-24
- **Decided by:** Simon
- **Supersedes:** none. Refines ADR-0006 (Inter stays the reading face; only its source changes).
- **Enforced by:** `tests/lint/typography.spec.ts`

## Context
ADR-0006 found that Google Fonts' Inter strips the character variants that keep look-alike glyphs apart:
`cv05` (l with a tail), `cv08` (I with serifs) and `zero` (slashed zero). On a SOP, "l", "I" and "1", and
"0" and "O", sit in torque values, part numbers and settings, where a misread is a safety problem.

## Decision
1. Inter 4.1 (rsms/inter, SIL OFL 1.1) is served from the app: `src/app/fonts/InterVariable.woff2`, loaded with
   `next/font/local` under the same `--font-inter` variable. Licence beside it (`Inter-LICENSE.txt`).
2. The file is a Latin + Latin Extended-A subset of the variable font (wght and opsz axes, all layout
   features kept), made with `fontTools.subset`: 118 KB, against 352 KB for the full file.
3. Body text turns on `font-feature-settings: 'tnum', 'cv05', 'cv08', 'zero'`.
4. Saira Semi Condensed stays on `next/font/google` (no glyph gap there).

## Consequences
- No request to Google for the reading face; the font is a static asset under the app's own cache headers.
- Upgrading Inter means re-running the subset command and keeping the four features (the lint checks the file
  exists and the features are on, not the glyph tables).
- Characters outside the subset (Cyrillic, Greek, Vietnamese) fall back to the system face. Add ranges if a
  site needs them.
