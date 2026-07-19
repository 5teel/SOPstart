---
created: 2026-07-19
source: Phase 32 UAT (Simon) + sketch review decisions
suggested: next phase after 32 closes
---

# Phase seed: Per-SOP access granularity + Wayfinder builder header

Two build-outs decided during Phase 32 UAT sketch review (2026-07-19). Sketches with decided direction live in `sketches/builder-header-orientation/` (Wayfinder, light schema, single tools menu) and `sketches/access-hierarchy/` (Access map v2).

## 1. Per-SOP access + full-hierarchy teams column (major)

- Teams column of the access map shows org → area → department → **role** → **person** as expandable, selectable tiers (mirror `OrgTree` from `/admin/team`).
- Any tier can be granted access down to an **individual SOP**, not just a collection — e.g. two named people in Maintenance get "Pump Rebuild", the department gets the rest of the collection.
- **Data model**: `access_grants` is currently collection-only (`collection_id`). Needs SOP-level targets (nullable `sop_id` arm or target-type enum) + resolver/materialization extension. Role/person SUBJECTS already work (5-level resolver, D-13); target granularity is the new part.
- **Semantics warning (from sketch v2)**: "only 2 named people see this SOP" is a NARROWING override, not expressible in the current additive-only grant model (D-11) — a chosen-by-name SOP must STOP following its collection's grants. Sketch rule: "once people are chosen by name for a SOP, it stops following its collection." This changes resolver + materialization semantics; treat as a locked design decision to plan around.
- This supersedes UAT Q6's "accept collection granularity?" — the owner wants finer-than-collection control.
- Selection detail = plain-language "Who can see this?" panel (concept B content). No grants/wire-up jargon in UI copy.
- Also closes UAT gaps G2 (collection → SOP drill-down, no magic URL) and G3 (plain language).

## 2. Wayfinder builder header (smaller)

- Concept A, restyled to the light paper schema (no dark bar): one row with back / you-are-here / forward zones; lock reason inside the greyed "Send to workers" chip.
- Combine Actions / Edit flow / Flow into ONE self-describing tools menu (labels state what each does to the open SOP).
- Closes UAT gap G1 (interim fix `c75307f` / `d3fc9f5` already deployed).
