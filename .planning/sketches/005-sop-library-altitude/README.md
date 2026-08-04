---
sketch: 005
name: sop-library-altitude
question: "How does /admin/sops funnel an admin from a high-level decision down to one SOP, instead of presenting every SOP and every attribute at one altitude?"
winner: "C"
tags: [admin, information-architecture, library, progressive-disclosure]
---

# Sketch 005: SOP Library Altitude

## Design Question

Sketch 004 asked which single control *hierarchy* the page should have, and variant A
(one rail) shipped. It solved duplication — but not altitude. Today the page presents
**every SOP and every attribute simultaneously**: 30 rows each carrying title, category,
department, flag, status, owner and age, under five tabs, a filter menu and a drafts
banner. Everything is at the same level of detail, so nothing is a starting point.

This sketch asks a different question: **what does the admin decide FIRST, and what can
stay hidden until that decision is made?**

## Real data shape (live, 2026-08-04)

| | |
|---|---|
| SOPs | 30 |
| Drafts | 23 |
| Published | 5 |
| Stuck mid-pipeline | 2 (one for 29 days) |
| With a department | 14 of 30 |
| With a category | 6 of 30 |
| Flagged for attention | 7 |
| Null title (falls back to filename) | 8 |

Two facts shaped the variants: **drafts dominate** (23 of 30 — the library is mostly a
review queue wearing a library's clothes), and **more than half have no department**,
so any facet-first approach must make the gap legible rather than hiding it.

## How to View

open .planning/sketches/005-sop-library-altitude/index.html

## Variants

- **A: Triage board** — the page opens on three decision decks (23 to review · 9 problems · 5 live). Choosing one yields a focused worklist where each row carries the single action that clears it. "Browse all 30" is a deliberate second step.
- **B: Drill-down** — pick a department, then a state, then a SOP. A breadcrumb is the only control; your position in the hierarchy *is* the filter state. The 16 department-less SOPs get a dashed tile so the gap is visible work.
- **C: Miller columns** ★ WINNER — shipped 2026-08-04 — scope | list | detail, three altitudes side by side. Nothing navigates away, so comparing two SOPs is two clicks rather than two page loads.
- **D: Quiet list** — least disruptive. Same list shape, but a row shows title + one status dot and reveals the rest on hover; five tabs collapse into one "Group by" control.
- **— Shipped** — today's page, included as the baseline to beat.

## What to Look For

- **Which one answers "what should I do now?" fastest** — and which answers "where is that SOP about the gluer?" fastest. They may not be the same variant, and that tension is the real decision.
- **A vs D on the same question:** A decides *for* you (queue that drains); D just quietens the presentation (table that accumulates). Does the library want opinion or restraint?
- **B's click cost** — three levels to reach a known SOP. Does the breadcrumb make that feel like structure or like distance?
- **C's middle column** at max-w-5xl — real titles are long ("Deflector Setup and Replacement for Proper Gob Loading — Glass Forming Machine"). Watch for truncation.
- **D's hover reveal has no touch equivalent.** Fine for a desk-bound admin, dead on a tablet — is that acceptable given the Visy finding that SOP *reading* is desktop-first?
- **Where "Access" (the wiring map) lives** in each — it survived sketch 004 as a tab and has no obvious home in A or B.
- Whether the drafts banner is still needed once the count is doing navigational work.

## Open Questions

- Does the triage framing hold when the library is healthy (0 problems, 2 drafts)? A's decks may read as an empty stage.
- If drafts stay dominant long-term, is "Manage SOPs" the wrong name for what is mostly a review queue?

## Outcome — shipped 2026-08-04

Variant C won and is live on `/admin/sops`.

**What shipped as sketched:** three columns (scope · list · detail), the scope
column replacing the tab rail, department counts alongside status counts, and
the detail pane rendering from data the list already carries.

**What changed during implementation:**

- **"No department" became a real scope.** The sketch made it a non-clickable
  finding, on the reasoning that filtering to it would let you tidy the symptom.
  That reasoning only held while nothing could be fixed in place — once the
  detail pane assigns a department inline, filtering to those 17 IS the fix, so
  it links to `?departments=none`.
- **The detail pane edits, it does not only display.** Category is a select
  backed by a new `setSopCategory` action; department is `DepartmentPicker` in
  `sop` mode with `localOnly` OFF, so writes land through `assignSopDepartments`
  (D-11's grant-backed path). Both `router.refresh()` after a write, so the
  scope counts and row chips stay honest — a SOP assigned a department leaves
  the "No department" scope immediately.
- **"Needs me" did NOT become a scope.** The existing attention view was kept
  instead: folding it into the list column would have cost the `OwnerPicker` and
  approve actions that live in `GovernanceQueueRow`.
- **Step counts were dropped from the detail pane.** They need a per-SOP
  aggregate query, and the whole point of client-side selection is that clicking
  costs nothing.

**The load-bearing split:** scope is server state (URL, Links — changing scope
SHOULD refetch); selection is client state (`useState` — a search-param push
would fire an RSC request through the service worker on every row click,
CLAUDE.md [2026-05-13]). A phase30 guard asserts the selection handler touches
no router, and that the browser holds no `fetch`/`createClient`.

**What the live data revealed that the sketch could not:** the department split
is `General 11 · Engineering 4 · Forming 3`, with 2 SOPs set to Everyone and 5
carrying no audience at all, over 23 SOPs. "General" holding 11 of 18 assigned
SOPs means the field is being used as a default rather than a classification, so
the by-department scope is weaker as a filter than the sketch assumed. That is a
data-shape problem, not a layout one — but it means the drill-down's value stays
partly unproven until departments are used deliberately.

> **Correction (same day).** The numbers first recorded here — 30 SOPs,
> `No department 17` — were wrong, and wrong in an instructive way: the library
> was showing SOPs from four organisations because of a cross-tenant RLS read
> hole on `public.sops` (closed in migration 00061). Seven of the 30 belonged to
> other tenants. **Every "live data shape" figure in this README's opening
> section was inflated by that leak** and should be read as ~23 SOPs in one org,
> not 30 across four. The design conclusions are unaffected — drafts still
> dominate, departments are still under-used — but the exact counts are not.
>
> Worth keeping as a methodology note: the leak surfaced only because an inline
> WRITE was added to this surface and its org guard fired. A read-only design
> exploration would have measured the wrong library and never known.
