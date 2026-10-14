# ADR-0014: The site map stays off the safety sign colours

- **Status:** Accepted
- **Date:** 2026-10-14
- **Decided by:** Simon (approved the map follow-up to ADR-0013: muted areas off the sign hues, yellow hazard markings, ink status marks, retire the department swatch)
- **Supersedes:** ADR-0007 rule 3's eight area hues (the rule stands; the hues change). Open decision "department colours" in the 2026-10-09 handoff (resolved: retire the swatch).
- **Enforced by:** `tests/lint/design-tokens.spec.ts` ("the site map stays off the sign colours"), `tests/phase57/departments.spec.ts`

## Context
ADR-0013 gave hazard steps the AS 1319 warning yellow and PPE the mandatory blue. The site map still used a blue, an ochre, a rose and a green area colour, painted hazard markings in the overdue amber, coloured "signed off" green and "updated" blue, and let an admin pick a department colour from eight saturated hexes (safety red and blue among them), although the map ignored that pick.

## Decision
1. **Area colours avoid the sign hues** (red ~25, yellow ~85, green ~150, blue ~255 in OKLCH) at a lower chroma (0.05, two neutrals at 0.02): steel, mauve, plum, teal, stone, slate, clay, olive.
2. **Hazard markings drawn on the map are warning yellow** (`--sign-warning`), as painted on the floor. Packaging is a neutral sand (`--map-card`).
3. **SOP status marks are ink shapes;** only "waiting for sign-off" keeps a colour (amber ◆). Signed off ■, updated ○, stopped ●. One table each: `DOT` in `SopRow.tsx`, `STATUS_GLYPH` in `src/lib/library/status.ts`.
4. **A department's colour is its map area colour** by tree order. The colour picker is gone and `updateDepartment` no longer takes a colour; the stored column is unused by the UI.

## Consequences
- On the map, blue and green appear only in pictures; yellow only where there is a real hazard.
- The site editor canvas resolves `var(--area-N)` at draw time.
- The `departments.colour` column and `DEPT_COLOURS` remain for inserts; drop them in a migration when next touching the table.

## How to comply
- Colour a department with `areaColourVar(i)` from `treeOrder` order, never `dept.colour`.
- Show a SOP status with `DOT[kind]` or `STATUS_GLYPH[kind]`, never a hand-picked colour.
