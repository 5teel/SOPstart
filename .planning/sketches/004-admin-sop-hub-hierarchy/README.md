---
sketch: 004
name: admin-sop-hub-hierarchy
question: "How do the /admin/sops control tiers collapse into ONE comprehensible hierarchy?"
winner: null
tags: [admin, information-architecture, governance, navigation]
---

# Sketch 004: Admin SOP Hub Hierarchy

## Design Question

The shipped /admin/sops stacks four independent control tiers that read as related
(page header + flag summary, AdminNav, status/view tabs, attention filter chips) —
"SOPs" appears at two tiers, "Needs attention" at two tiers, and flag counts render
twice. Which single hierarchy makes status, the governance queue, and Access all
reachable without any duplicated tier?

Shared premises across all variants (2026-07-30 header rework):
- The app header already carries Create New SOP · Team · Settings → AdminNav loses
  Team/Settings everywhere; most variants delete AdminNav entirely.
- Flag counts appear in exactly ONE place per variant.
- Plain language for flags: "No owner" / "Owner role gone" instead of unowned/stale-role.

## How to View

open .planning/sketches/004-admin-sop-hub-hierarchy/index.html

## Variants

- **A: One rail** — single tab row (All · Drafts · Published · Needs attention · Access + ⚙ Filter menu); the attention view is a grouped, worst-first queue with NO chip row.
- **B: Sidebar** — left rail with LIBRARY / NEEDS ATTENTION / ACCESS groups, one level deep; content pane has zero tabs.
- **C: Two pages** — /admin/sops keeps only status tabs + a red attention banner; the queue is its own page (/admin/attention) with its own h1.
- **D: Count cards** — five stat cards ARE the filters (click to filter, active card inked); no tabs, no chips, no duplicate counts.
- **E: One table** — status segmented control + "attention first" sort; problems are badges ON rows, flagged rows group under a red rule; no attention view at all.

## What to Look For

- Can you tell, at every moment, which ONE control changed the list you're looking at?
- Does "Needs attention" read as a place (A/B/C) or a property of rows (D/E)? Which matches how an admin thinks?
- Chrome height before the first SOP row — E is flattest, B trades width for it.
- Whether Access (the wiring map) feels findable in each variant.
- Plain-language flag labels ("No owner" / "Owner role gone") vs the shipped jargon (unowned / stale-role).
