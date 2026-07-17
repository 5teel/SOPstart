---
sketch: 002
name: permission-wiring
question: "How do SOP-library access connections read at a glance across one-to-many, many-to-one, and many-to-many?"
winner: null
tags: [permissions, library-access, departments, at-a-glance]
---

# Sketch 002: Permission Wiring

## Design Question
Library access must support every arity — one dept → many collections, many org units → one collection, full many-to-many, plus person-level overrides — and stay navigable at a glance. Which representation makes "who sees what, and why" legible without opening anything?

## How to View
open .planning/sketches/002-permission-wiring/index.html

## Variants
- **A: Patch Bay** — org units left, library collections right, access drawn as live wires; click either side to trace its connections (the most literal "wiring" — very blueprint)
- **B: Access Matrix** — org units × collections grid; solid dot = direct grant, dashed = inherited site-wide, click to toggle (densest many-to-many view)
- **C: Select & Illuminate** — pick any org unit or person, the library lights up with granted / inherited-via / off states; click a collection to grant or revoke for the selection

## What to Look For
All three encode the same seeded model — check each arity reads clearly:
- **1→N:** Forming feeds Forming/Hot End + Chemical Handling
- **N→1:** Chemical Handling is fed by Forming, Maintenance, AND Priya Sharma (personal grant, dashed)
- **Site-wide:** Whole site → Site Safety & Emergency (inheritance shown dashed downstream)
- **Person override on top of dept inheritance:** Priya = Quality inheritance + personal Chemical grant

Judge: which one would a safety manager trust for an audit ("show me everyone who can see Chemical Handling"), and which for setup speed? They may not be the same variant — a hybrid (C for editing, B for audit) is a legitimate outcome.
