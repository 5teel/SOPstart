# ADR-0016: Lists are framed rows, and long lists are stepped into

- **Status:** Accepted
- **Date:** 2026-10-15
- **Decided by:** Simon ("make the different options within lists more clearly delineated … minimise the visual clutter … collapse states, separate windows or selection flows with a linear progression")
- **Amends:** sketch 009 variant A's SOP list (Recent and Most used stacked, every SOP open under its area or type heading)
- **Enforced by:** `tests/phase63/sop-list.spec.ts`, `tests/evals/home.eval.ts` HOME-02

## Context
The home list showed Recent, Most used and every SOP under every area heading at once. Rows had no edges, so one SOP ran into the next, and a site with 200 SOPs was one long scroll.

## Decision
1. **A list is a framed group** (`.list` in `blueprint-theme.css`): a white card with a hairline between rows. A row (`.list-row`) that opens something ends in a chevron (`.list-chev`); the selected row is a grey band. No coloured edges (ADR-0007).
2. **Long lists are stepped into.** All SOPs lists areas (top level) or types, each with its count; picking one shows its SOPs with a back key. An area with sub-areas lists them first ("Areas inside").
3. **One shelf for Recent and Most used**, switched by a quiet segment, at most five rows.
4. New list surfaces use `.list` / `.list-row` rather than their own borders.

## Consequences
- A SOP is one more tap away when not in Recent or found by search; search and the map still go straight to it.
- The inbox and requests lists wear the same frame.

## How to comply
- Restyle lists by changing `.list*` in `blueprint-theme.css`, not at call sites.
- Do not reintroduce every-SOP-under-every-heading on the home.
