# Phase 57: The One Screen & Its Places - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-04
**Phase:** 57-the-one-screen-its-places
**Areas discussed:** Rooms on the drawing, Detail pane with nothing selected + Now card, Departments as zones only, Bridges + retired URLs

---

## Rooms on the drawing

Three questions were drafted (room shape: rectangle / free polygon / signpost only; first placement: scene corners / one edge / not shown until placed; worker access: all four reduced / Workshop closed / Noticeboard + Smoko only). Simon declined the question set before answering.

**User's choice:** free text — "Leave room design and config out of this build. We will use the existing design and allow you to decide the clickbox areas as you see fit."
**Notes:** Rooms become fixed hit-areas + signposts on the existing scene with no admin positioning UI (PLC-01's "admin can position each room's shape" clause deferred). Worker access resolved by Claude toward the contract table (all four rooms, reduced view).

---

## Detail pane with nothing selected + Now card

| Option | Description | Selected |
|--------|-------------|----------|
| Site summary | Site name, machine/SOP counts, role-aware due or health count, hint line; Phase 60 replaces | ✓ |
| Noticeboard content | Default to the site-wide SOP list | |
| Empty with hint only | Hint + Esc affordance | |

| Option | Description | Selected |
|--------|-------------|----------|
| Today's inbox rows | Exactly what the governance inbox counts; same number as the Office pin | ✓ |
| Only owner + review gaps | No owner + overdue review only | |
| Approvals + sign-offs only | Items needing a person's decision | |

| Option | Description | Selected |
|--------|-------------|----------|
| Admin-style Office card | Supervisor count = completions awaiting their sign-off | ✓ |
| Worker-style next-SOP card | Supervisors get the worker card | |
| Both stacked | Next SOP card + Office count line | |

**User's choice:** all three recommended options.

---

## Departments as zones only

| Option | Description | Selected |
|--------|-------------|----------|
| Still the hull of its machines | Name + colour, zone = tinted area of assigned machines; no new geometry | ✓ |
| Its own drawn polygon | Admin draws a zone; machines inside inherit it | |

| Option | Description | Selected |
|--------|-------------|----------|
| Inline in the site editor | Departments strip in edit mode (add/rename/colour/delete); machine form picks | ✓ |
| Only from the machine form | Type a name on the machine; rename/colour via the zone on the map | |

| Option | Description | Selected |
|--------|-------------|----------|
| Move to the team page unchanged | member_departments picker → /admin/team; Phase 59 re-homes it | ✓ |
| Keep it in the Office bridge | /admin/departments survives one more phase for member editing | |
| Drop member-department editing | No UI until Phase 59 | |

**User's choice:** all three recommended options.

---

## Bridges + retired URLs

| Option | Description | Selected |
|--------|-------------|----------|
| `/` is the screen; everything redirects | Sign-in lands on `/`; `/sops`, `/dashboard`, `/governance`, `/admin/departments`, `/admin/site` 307 → `/` (+`?place=`); each place gets `?place=` | ✓ |
| `/sops` stays the home | Keep today's worker address | |

| Option | Description | Selected |
|--------|-------------|----------|
| Office→governance, Smoko→activity, Workshop→new-SOP wizard | Each room panel summarises and opens its existing page; page loses header, gains "Back to the site" | ✓ |
| Bridges only for Office and Workshop | Smoko shows a "arrives in Phase 61" panel | |

| Option | Description | Selected |
|--------|-------------|----------|
| Workshop bridge lists drafts | Org's draft SOPs with open-in-builder — the Drafts tab Phase 61 formalises | ✓ |
| Search finds everything | Search matches unplaced drafts | |

**User's choice:** all three recommended options.
**Notes (Claude):** `/` today is the signed-out landing page; the decision is read as "signed-in `/` serves the one screen, signed-out `/` keeps the landing".

---

## Claude's Discretion

- Room hit-area coordinates/sizes and where they are stored (constants or JSON, no DB)
- SOP row badge vocabulary (reuse `RelBadge`; minimal admin additions)
- Composition of the three panes from existing `PlantHome` / `PlantStage` / `MachinePanel` / `AdminMachinePanel` / `NowCard` / `SiteEditor`; edit-mode entry from the map
- Pane-resize refit behaviour; Esc handling
- Dropped-list entry format (follow Phase 55's `scripts/dropped-features.json`)

## Deferred Ideas

- Admin positioning of room shapes (PLC-01 clause) — until the scene is regenerated with rooms or a real site asks
- Site overview content (SHL-03) — Phase 60
- Wide detail pane (SHL-06) — Phase 59
- Office tabs / inbox panel / ledger view — Phase 59
- Workshop on-ramps, Drafts tab, Standards mount, AI settings — Phase 61
- Smoko room content — Phase 61
- Focus rule / Back — Phase 58
- Ledger copy on governance actions — 59/60/61
- Department as its own polygon — declined
- Redirect certification + build guard — Phase 62
