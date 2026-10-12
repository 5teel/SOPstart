# ADR-0011: Desktop home: the map in the centre, the list on the right, Read folds both away

- **Status:** Accepted
- **Date:** 2026-10-12
- **Decided by:** Simon ("shift the search and list panel to the right side of the screen and use the site map as the centre and have the site map switch to the actual SOP view and while the SOP view is active have the left and right panels collapse but be available for expansion at any time")
- **Supersedes:** the desktop pane order of sketch 009 A (menu · list · reader). ADR-0004 and ADR-0005 stand.
- **Enforced by:** `tests/evals/home.eval.ts` HOME-03 (pane order, header bands on one line, folding)

## Context
The desktop home put the list between the menu and the map. The wordmark, the search box and the
map header each sat at their own height, so the top of the screen had no common line, and the map
(the second view of the library, ADR-0004 rule 5) was pushed to the side.

## Decision
1. **Desktop order is menu · site map · list.** The site map holds the centre; search and the list
   are the right-hand column. The phone is unchanged (List | Site map tabs).
2. **One header line.** The menu's wordmark, the map header (or the reader's header) and the search
   row are each a 64 px band (`h-16`/`min-h-16`) with a rule beneath, so they end on one line.
3. **Read takes the centre and folds the side panels.** Opening a SOP replaces the map with Read and
   folds the menu and the list away. The reader's header carries back to the map and two panel keys
   (`.icon-key`) that unfold the menu or the list at any time; opening another SOP keeps what the
   reader unfolded. Start still takes the whole screen (ADR-0004 rule 6).

## Consequences
- Reading gets the full width on desktop; the list is one tap away instead of always on screen.
- Read's back link moves from inside Read to the reader's header band (`read-back`), phone and desktop.

## How to comply
- New home chrome on desktop lines up on the 64 px header band.
- Do not put the list back between the menu and the map without superseding this ADR.
