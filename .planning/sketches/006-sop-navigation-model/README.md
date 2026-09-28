---
sketch: 006
name: sop-navigation-model
question: "How does /sops answer 'which procedure do I need?' for a worker AND stay useful to an admin, without a scope column that mixes role, obligation, catalogue and facet into one look-alike list?"
winner: null
tags: [navigation, information-architecture, library, governance, worker, admin, phone]
---

# Sketch 006: SOP Navigation Model

## Design Question

Sketch 005 chose Miller columns (scope · list · detail) and shipped. Its scope column has
since grown four groups — **Admin** (lifecycle status + a governance queue + a tool +
an ownership flag), **Your SOPs** (personal obligation), **Library** (org catalogue) and
**By department** (a facet) — all rendered as identical rows. Simon's 2026-09-28
reading: *"Admin and Your SOPs and Library and By Department are all submenus? This
isn't clear at all."* Two same-day bugs (two lit rows at once; the attention lens
swallowing the frame) were symptoms of the same thing: the column has no single
meaning.

This sketch starts from the users, not the column:

| Person | The one question on this page |
|---|---|
| Operator / fitter / sparky (phone or shared desktop, low literacy) | Which procedure do I need for this machine or task, right now, and what am I due to do? |
| SOP admin / H&S / engineering manager (50–500 SOPs) | Is the library healthy — what's unowned, stale, unapproved, unconverted, unassigned? |

Those are two jobs, so the sketch proposes **two surfaces** (`/sops` and `/governance`)
and two shapes for the first.

## Real data shape (sopstart.com, 2026-09-28)

33 SOPs · 27 drafts · 4 published · 2 stuck converting · 10 untitled · departments:
General, Forming, Engineering. Titles and departments in the sketch are real. Worker
relationship (due / updated / never done), sub-areas under Forming, owners and review
dates are illustrative — a few drafts are shown as published so the worker view isn't
empty.

## How to View

open .planning/sketches/006-sop-navigation-model/index.html

Use **View as: Worker / Admin** (top right) on variants A and B — same page, two personas.

## Variants

- **A: Place tree** — one library for everyone. Left column is a single-select tree of *where* (department → machine/area), so it can only mean one thing. Mine/All is one toggle; what-you-owe is a badge on the row (Due, Updated, Never done); admin facets (Status, Owner) are toolbar dropdowns because facets combine and a column can't say AND.
- **B: Search-first** — the strongest form of "the column shouldn't exist". Search + Mine/All in the toolbar, department as a chip row, two columns (list · detail). Wider list, no browsable hierarchy.
- **Governance page** — companion to both: the admin's daily console as its own route. Five queues that drain (Nobody owns it · Review overdue · Waiting for approval · Couldn't convert · Unfinished), each row carrying the one action that clears it, plus "SOPs you look after" and a review calendar. Access moves to Team.
- **Phone** — companion to both: search, Mine/All, one "Where" picker opening a sheet with the same tree, glove-sized rows with the same badges.
- **Shipped today** — the baseline to beat.

## What to Look For

- **A vs B on "I don't know the SOP's name."** An operator who knows only the machine walks A's tree in two clicks; in B they scan chips. Does the tree earn its 176px?
- **A vs B on long glass-forming titles.** B's list is ~180px wider; watch truncation in A.
- **The Mine/All toggle carrying the whole "who am I" question.** Is one toggle enough, or does an admin need "assigned to me" separately from "everything"?
- **Badges instead of scopes.** "Refresher due / Updated / Never done" are now row badges + a To-do / Done grouping in Mine. Is the grouping enough, or is a filter still wanted?
- **Governance as a page.** The Visy finding is that nobody owns SOPs — does a page with "19 · Nobody owns it" as the first deck make that a job someone picks up? And is "Unfinished (27)" a governance queue or just the drafts list wearing a hat?
- **Where Drafts live.** Twice: `/sops` Status facet (admin) and `/governance` Unfinished. Same rows, different questions — acceptable, or confusing?
- **Access on Team, not here.** It's a map, not a queue. Does it belong with the org chart?
- **Phone: zero admin controls.** An admin on a phone is a worker. Is that right, or do supervisors need sign-off state on the list?

## Decision

_Pending Simon's pick. Build order if A or B wins: `/governance` route first (pure move,
unblocks deleting the Admin group), then the `/sops` reshape, then Access → Team._
