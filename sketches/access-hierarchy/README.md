# Library access hierarchy + plain language (G2 + G3)

Throwaway design sketches. Open `index.html` directly in a browser; switch concepts with the yellow toggle at the top. All three are interactive: expand collections, select SOPs, toggle departments — people counts and summary sentences update live.

## The problem

Two UAT gaps on `/admin/sops?view=access` (`WiringPatchBay.tsx`), logged as G2/G3 in `32-HUMAN-UAT.md`:

1. **No SOP drill-down (G2)** — the library column shows collections only; an individual SOP appears only when pinned via `?sop=<id>`. A user landing organically cannot pick a SOP to set access on. SOPs must sit visibly *inside* collections with full expand/drill-down.
2. **"Wiring / grants" doesn't self-explain (G3)** — patch-bay jargon ("wire up", "grants", "UNWIRED") means nothing to a non-technical safety manager. The surface must speak in "Who can see this?" language.

Demo data mirrors the real org from the UAT session: departments **Forming** (14 people) and **General** (9); collections **Maintenance / Manufacturing / Safety and Environment**; SOP **"Replacing a Desktop Computer Keyboard at a Workstation"** as the freshly published item.

## Concepts

### A · Access map with SOP drill-down (keeps the patch-bay metaphor) ← winner (see Decisions below)
The shipped patch bay renamed "Access map" and given the missing hierarchy: collections are expandable groups, SOPs nest inside with tree lines, and clicking any SOP enters "choose who sees it" mode — the left column becomes on/off toggles, the fixed-height banner counts people live. All jargon replaced: lines mean *can see*, "Save — done" not "✓ Done wiring", "seen by Forming, General" not "2 grants". Crucially it stays honest about the collection-level model (D-13): toggling a SOP visibly toggles its collection, and the banner says so. Smallest change from shipped code that fixes both gaps.

### B · Library tree + "Who can see this?" panel (abandons the metaphor)
No lines. Left: the library as a file explorer — folders (collections) open to show documents (SOPs), a mental model nobody has to learn. Right: a panel that always answers one question about the selection: **"Who can see this?"** — department checkboxes with people counts and a green summary sentence ("**23 people** can see this SOP — everyone in **Forming** and **General**"). A SOP's panel explains it follows its collection and links to the one place that changes it, instead of offering per-SOP toggles that would secretly edit the collection.

### C · Access cards (middle ground)
A grid of collection cards, each with the answer printed on its face: "Seen by **Forming** and **General** — **23 people**." "Show SOPs" expands the card; "Change who sees these" flips the same card into a department checklist in place. Browse view and audit view are the same thing; no diagram, no second pane.

## Trade-offs

| | A · Access map | B · Who-can-see panel | C · Access cards |
|---|---|---|---|
| SOP drill-down (G2) | Expand collection → SOP rows → click to edit | File-explorer tree, SOPs are leaves | Card expands to SOP list |
| Self-explanatory to a safety manager (G3) | Better copy, but lines/ports still need decoding | Highest — the headline is the user's question | High — sentence on every card face |
| Whole-org overview at a glance | Yes — the map's core strength | No (one selection at a time) | Partial (per-collection sentences, no org side) |
| Honest about collection-level access | Banner explains the widening | Explicit "follows its collection" note + jump link | Editor is collection-level by construction |
| Person-level overrides (dashed wires today) | Native | Needs an extra "Individuals" section in the panel | Awkward |
| Scale (15 depts × 20 collections) | Solved by shipped group-collapse + focus | Tree scrolls fine; panel unaffected | ~20 cards, needs search; fine |
| Distance from shipped code | Small — extends WiringPatchBay | Medium — new right panel, reuses access model | Medium — new grid surface |

## Recommendation

**A as the evolution of the shipped surface, with B's panel as its selection detail.** Concretely: keep the map (it is the only concept that shows the whole org↔library picture, and the shipped scale/focus/banner work carries over), add the drill-down and plain-language copy from sketch A — and when a single SOP or collection is selected, render B's "Who can see this?" content *as* the banner/side detail instead of the current grants-speak strip. B standalone is the best pure answer to G3 but gives up the at-a-glance overview that the whole Phase-32 surface exists for; C is pleasant but can't show org structure or personal overrides. If a future simplified "lite" admin view is ever wanted for small orgs, C is the shape to reach for.

## Decisions (2026-07-19)

**Winner: A · Access map**, with a major extension, revised in place (`index.html`, concept A tab — B and C kept for reference; B's panel is adopted into A):

1. **Full hierarchy in the teams column.** Site → area → department → role → person as expandable, selectable tiers (mirroring `OrgTree` at `/admin/team` — see `src/types/org-model.ts`). Person rows are dashed, echoing the personal-access line style.
2. **Any level grantable down to a single SOP.** The sketch's resting state shows the required coexistence: the whole **Maintenance department** wired solid to the Maintenance collection, while **Pump Rebuild** inside it is seen by only two named people (Dave Hohaia, Priya Sharma — dashed lines). Choosing people by name for a SOP makes it stop following its collection, and the row pill + panel copy say so.
3. **B's "Who can see this?" panel is A's detail view.** Selecting anything renders a plain-language answer below the map ("Only 2 people can see this SOP — Dave Hohaia and Priya Sharma, chosen by name"); selecting a person/team flips it to "What can they see?".

### Data-model implications

Per-SOP choosing requires extending `access_grants`: today a grant's target is `collection_id` only (`AccessGrant` in `src/types/org-model.ts`), so "only Dave and Priya see Pump Rebuild" has nowhere to live. The subject side needs nothing new — the resolver already handles the full 5-level chain (org/area/department/role/person, `SubjectType` + `resolveEffectiveAccess`) — **target granularity is the new part**: a grant must be able to point at either a collection or a single SOP, and the resolver needs one extra rule (a SOP with any direct grants stops following its collection). That rule sits in tension with the additive-only grant model (D-11/D-13), because "chosen people only" is effectively a narrowing override, not an addition.

## Open questions

- Per-SOP exceptions: all three concepts stay collection-level (matching D-13 and UAT question 6). If "6: no, keep it narrow" is the answer, concept B's panel is the natural home for a per-SOP override affordance — the map would need a new wire style.
- Terminology to standardise product-wide: "seen by / can see" vs "has access to". The sketches use "see" everywhere — does that conflict with future edit-permissions (seeing ≠ editing)?
- Where do person-level overrides (Priya-style dashed wires) surface in plain language? "Plus 1 person: Priya Sharma" on the panel is sketched nowhere yet.
- Does the "New" pill on a just-published SOP persist until first access change, or until first view? (Shipped behaviour: pinned via URL; sketch A makes pinning unnecessary.)
- Roles layer: the org column shows site + departments only, matching the shipped tree. When roles land between departments and people, do they appear as toggles too, or only in the people count?
