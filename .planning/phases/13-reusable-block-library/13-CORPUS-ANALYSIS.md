# Phase 13: Reusable Block Library — Corpus Analysis

**Date:** 2026-05-06
**Source:** `C:\Development\SOPstart\SOPstart - Raw SOPs` (684 files: 666 .doc, 17 .docx, 1 pdf, 1 xls)
**Analyzed:** 666 files (.doc only — .docx/.pdf reserved for separate formal-SOP review)
**Step rows extracted:** 10146
**Hazard mentions clustered:** 5141

This document is the prerequisite for Phase 13 plans 13-02 (NZ global block seed) and 13-03
(picker matching). It derives the controlled category vocabulary and seed list from the
actual SOP corpus rather than inventing a top-down taxonomy.

> **Note on extraction**: 666 `.doc` files were converted via `antiword`. The Word
> checkbox FormFields in the canonical 42-hazard table came through empty (antiword
> limitation), so the analysis mines the **free-text "Sequence of Job Steps" table** instead.
> That column lists actual hazards per step in the safety analyst's own words — a stronger
> signal than checked boxes because it captures phrasing, severity, and step↔hazard
> co-occurrence.

---

## 1. Corpus Composition

### Top-level folders

| Folder | Files |
|---|---:|
| JSA 2010 | 602 |
| JSA-08 | 48 |
| Plant JSA's | 15 |
| JSA-2011 | 1 |

### Departments (sub-folders)

| Department | Files |
|---|---:|
| JOB CHANGE | 93 |
| QUALITY CONTROL | 92 |
| FACTORY MAINTENANCE | 77 |
| MOULD REPAIR | 65 |
| BATCH & FURNACE | 59 |
| ELECTRICAL | 50 |
| JSA-08 | 48 |
| FORMING AREA | 46 |
| FINISHED PRODUCTS | 43 |
| MACHINE REPAIR | 41 |
| PLANT SERVICES | 20 |
| Plant JSA's | 15 |
| JSA 2010 | 5 |
| ENGINEERING | 5 |
| CONTRACTOR | 4 |
| IT | 1 |
| Line | 1 |
| JSA-2011 | 1 |

### Risk category distribution

| Risk | Count |
|---|---:|
| Low | 250 |
| Medium | 176 |
| High | 89 |

### Significant-hazard flag (where "yes/no" was reliably extracted)

| Value | Count |
|---|---:|
| Yes | 468 |
| No | 36 |
| YES | 6 |
| NO | 3 |

---

## 2. Controlled Hazard Vocabulary (derived)

Frequency of distinct **hazard categories** across 5141 mentions in 10146 step rows.
This is the **proposed Phase 13 controlled vocab for hazard blocks**, ranked by recurrence.
The "other" bucket holds hazards that didn't match a heuristic cluster — these are candidates
for additional named clusters or for the free-text overlay (D-Tax-01).

| # | Category | Mentions | Coverage |
|---|---|---:|---:|
| 1 | `other` | 1511 | 29.4% |
| 2 | `crush-entrapment` | 729 | 14.2% |
| 3 | `manual-handling-strain` | 572 | 11.1% |
| 4 | `cuts-lacerations` | 422 | 8.2% |
| 5 | `burns-hot` | 334 | 6.5% |
| 6 | `spill-environmental` | 319 | 6.2% |
| 7 | `slips-trips` | 258 | 5.0% |
| 8 | `electrocution` | 170 | 3.3% |
| 9 | `moving-machinery` | 140 | 2.7% |
| 10 | `glass-breakage` | 112 | 2.2% |
| 11 | `falling-objects` | 87 | 1.7% |
| 12 | `pinch-points` | 85 | 1.7% |
| 13 | `forklift-vehicle` | 76 | 1.5% |
| 14 | `fire-explosion` | 64 | 1.2% |
| 15 | `dust-airborne` | 58 | 1.1% |
| 16 | `noise` | 51 | 1.0% |
| 17 | `chemical-exposure` | 49 | 1.0% |
| 18 | `flying-debris` | 33 | 0.6% |
| 19 | `pressurised-fluid` | 24 | 0.5% |
| 20 | `falls-from-height` | 20 | 0.4% |
| 21 | `hot-work` | 18 | 0.4% |
| 22 | `isolation-energy` | 6 | 0.1% |
| 23 | `fatigue-shift` | 2 | 0.0% |
| 24 | `confined-space` | 1 | 0.0% |

### Per-cluster exemplar phrasings

For each cluster, the top 5 most-frequent free-text phrasings the safety analysts
actually wrote. These are **candidate hazard block titles** for the global library.

**`other`** (1511 mentions)
- (45×) making section safe to
- (27×) reduce the risk of being
- (21×) points
- (20×) reduce the risk of being caught in the section
- (16×) reduce the risk of being caught in the section.

**`crush-entrapment`** (729 mentions)
- (132×) caught in section.
- (53×) entrapment
- (41×) prevent entrapment
- (32×) entrapment in section
- (22×) crushed hand.

**`manual-handling-strain`** (572 mentions)
- (74×) manual handling.
- (49×) manual handling
- (48×) burnt / back strain.
- (28×) back strain
- (23×) sprain / strain

**`cuts-lacerations`** (422 mentions)
- (132×) laceration
- (28×) broken glass
- (26×) laceration from broken glass
- (21×) lacerations
- (20×) cuts

**`burns-hot`** (334 mentions)
- (77×) burns
- (32×) burns.
- (23×) burn
- (16×) burning from heat reflected off ware
- (10×) burnt with hot gob.

**`spill-environmental`** (319 mentions)
- (269×) contamination.
- (3×) leaks
- (3×) spill
- (3×) leak in hose
- (3×) leak from valve

**`slips-trips`** (258 mentions)
- (14×) slip
- (13×) tripping
- (7×) trip
- (7×) trip hazard
- (6×) limited work area causing strains from spanner slipping. manual handling.

**`electrocution`** (170 mentions)
- (56×) electrocution
- (23×) electrocution.
- (21×) electric shock
- (4×) electrical shock
- (4×) shocks & electrocution

**`moving-machinery`** (140 mentions)
- (30×) moving machinery
- (9×) moving parts.
- (8×) moving parts
- (8×) moving machinery.
- (6×) moving machinery. noise/heat

**`glass-breakage`** (112 mentions)
- (18×) broken bottle causing
- (14×) glass
- (9×) broken bottles
- (6×) glass run out
- (6×) glass fragments being

**`falling-objects`** (87 mentions)
- (20×) falling objects
- (5×) hopper could drop from
- (4×) overhead hoist. heat / burns. falling objects.
- (4×) dropped loads.
- (4×) falling objects.

**`pinch-points`** (85 mentions)
- (10×) pinch points
- (4×) pinch points, slips & cuts
- (4×) moving parts and pinch points slips
- (4×) moving parts and pinch points
- (3×) situation pinch point

**`forklift-vehicle`** (76 mentions)
- (6×) vehicle collision
- (5×) crane hoist
- (5×) crane operations
- (4×) mobile hoist
- (4×) vehicle collision causing

**`fire-explosion`** (64 mentions)
- (6×) fire
- (6×) fire risk
- (3×) fire hazard
- (3×) sparks.
- (3×) spill oil fire hazard

**`dust-airborne`** (58 mentions)
- (7×) airborne contaminants
- (4×) dust inhalation.
- (4×) dust in the eyes.
- (4×) spraying of paint inhalation of fumes contamination in eyes
- (3×) dust

**`noise`** (51 mentions)
- (17×) noise
- (3×) noise / lacerations /
- (3×) noise / heat
- (3×) noise and broken bottles
- (2×) heat, noise, dust, back

**`chemical-exposure`** (49 mentions)
- (7×) gas leak
- (6×) chemicals
- (4×) exposure to chemicals.
- (3×) leaking gas , fire hazard
- (3×) chemical composition in ink die

**`flying-debris`** (33 mentions)
- (5×) personγçös eyesight in vicinity from small flying objects. dust inhalation. dama
- (5×) pedestrians. personγçös eyesight in vasinity from small flying objects. dust inh
- (3×) loose flying debris in eyes ingression of particles trough skin noise
- (2×) flying objects cuts
- (2×) flying objects, cuts


---

## 3. Department × Hazard Cluster Heatmap

Top 5 hazard clusters per department. Drives the **picker priority signal** (D-Pick-01):
when an admin opens "Pick from library" at a hazards step in a SOP tagged `forming-area`,
the picker should rank `crush-entrapment` and `burns-hot` blocks above generic ones.

| Department | Top hazard clusters (count) |
|---|---|
| JOB CHANGE | crush-entrapment (385), other (199), burns-hot (120), manual-handling-strain (101), spill-environmental (34) |
| QUALITY CONTROL | other (210), cuts-lacerations (177), manual-handling-strain (54), spill-environmental (49), glass-breakage (35) |
| FACTORY MAINTENANCE | other (147), manual-handling-strain (70), spill-environmental (57), electrocution (52), slips-trips (41) |
| BATCH & FURNACE | other (226), burns-hot (46), manual-handling-strain (39), spill-environmental (36), falling-objects (20) |
| MACHINE REPAIR | other (123), manual-handling-strain (82), cuts-lacerations (35), spill-environmental (30), crush-entrapment (24) |
| MOULD REPAIR | crush-entrapment (133), other (63), spill-environmental (46), slips-trips (38), electrocution (29) |
| FORMING AREA | other (89), manual-handling-strain (63), burns-hot (52), crush-entrapment (49), moving-machinery (47) |
| FINISHED PRODUCTS | other (187), cuts-lacerations (40), manual-handling-strain (34), forklift-vehicle (24), crush-entrapment (23) |
| ELECTRICAL | other (92), electrocution (46), moving-machinery (45), pinch-points (35), slips-trips (27) |
| JSA-08 | other (103), cuts-lacerations (102), manual-handling-strain (25), glass-breakage (16), slips-trips (15) |
| PLANT SERVICES | manual-handling-strain (32), other (25), spill-environmental (19), electrocution (13), slips-trips (11) |
| Plant JSA's | crush-entrapment (29), other (28), manual-handling-strain (21), moving-machinery (17), burns-hot (13) |

---

## 4. PPE Library Seed (free-text from "PPE Required:" field)

Distinct PPE specifications across 666 JSAs. `STANDARD` collapses
synonyms of "all standard PPE required" / "standard safety uniform". Specific
PPE callouts are candidates for **PPE block library entries**.

| PPE specification | Count |
|---|---:|
| STANDARD | 260 |
| Gloves, Safety Glasses, Ear Muffs, | 87 |
| Boots, gloves, uniform, safety | 75 |
| Safety Glasses | 22 |
| Safety Glasses / gloves if | 11 |
| within production area | 9 |
| Safety Glasses & Gloves | 8 |
| Safety Glasses, Gloves | 6 |
| Safety Glasses / disposable | 6 |
| Safety Glasses and gloves | 6 |
| Safety Glasses & Hearing | 5 |
| Boots, Uniform, Safety Glasses, | 5 |
| Hi Viz Clothing  / Gloves / | 4 |
| Hi Viz Clothing Gloves if | 4 |
| Face mask, Gloves | 4 |
| Safety Glasses / gloves / Dust | 3 |
| Safety glasses, Hearing | 3 |
| Safety Glasses / gloves if required | 3 |
| Safety Glasses and  gloves if | 3 |
| Safety Glasses , Gloves | 3 |
| Safety Specs / Ear protection | 3 |
| Safety Glasses / Ear protection | 3 |
| Safety Glasses / Gloves and back | 3 |
| Safety Glasses & Gloves if | 3 |
| Safety Glasses  / gloves if | 3 |

---

## 5. Action-Verb Taxonomy (Task Classification)

Top 20 task-name first-words across the corpus. These are the **action verbs** safety
analysts use to name jobs. Useful for SOP-level category inference (D-Tax-03) and for
suggesting category tags during the wizard's "blank page" flow.

| Verb | Tasks | Top departments |
|---|---:|---|
| job | 108 | FACTORY MAINTENANCE (35), MACHINE REPAIR (26), BATCH & FURNACE (17) |
| use | 47 | QUALITY CONTROL (31), JSA-08 (14), FINISHED PRODUCTS (2) |
| changing | 37 | FORMING AREA (21), JSA 2010 (3), MACHINE REPAIR (3) |
| using | 24 | QUALITY CONTROL (10), MOULD REPAIR (7), JSA-08 (6) |
| #21, | 23 | JOB CHANGE (23) |
| #23, | 21 | JOB CHANGE (21) |
| loading | 15 | FINISHED PRODUCTS (9), MOULD REPAIR (5), JSA-08 (1) |
| #21 | 15 | JOB CHANGE (15) |
| replacing | 14 | FACTORY MAINTENANCE (7), ELECTRICAL (4), FORMING AREA (2) |
| #34 | 12 | JOB CHANGE (12) |
| replace | 11 | FACTORY MAINTENANCE (7), ELECTRICAL (2), ENGINEERING (1) |
| removal | 9 | JOB CHANGE (3), FACTORY MAINTENANCE (2), MOULD REPAIR (2) |
| checking | 9 | FINISHED PRODUCTS (4), QUALITY CONTROL (2), JSA-08 (2) |
| resort | 9 | QUALITY CONTROL (6), JSA-08 (3) |
| cutting | 7 | QUALITY CONTROL (4), JSA-08 (2), FINISHED PRODUCTS (1) |
| iso | 7 | JOB CHANGE (7) |
| |hazard | 7 | Plant JSA's (7) |
| cleaning | 6 | FACTORY MAINTENANCE (2), BATCH & FURNACE (1), FORMING AREA (1) |
| clearing | 6 | FINISHED PRODUCTS (4), BATCH & FURNACE (1), JSA-08 (1) |
| operating | 6 | FINISHED PRODUCTS (2), BATCH & FURNACE (1), FORMING AREA (1) |

---

## 6. Recommended Controlled Vocab (D-Tax-02)

Combining the clustering + verb-prefix analysis, here is the **proposed 30-tag flat
controlled vocabulary** for Phase 13. Tags follow `<area>-<specific>` convention but
are stored as flat strings (D-Tax-01).

### Hazard-bearing tags (from clusters)

```
crush-entrapment           electrocution           burns-hot
manual-handling-strain     pinch-points            falls-from-height
cuts-lacerations           moving-machinery        forklift-vehicle
slips-trips                falling-objects         flying-debris
spill-environmental        pressurised-fluid       hot-work
glass-breakage             fire-explosion          confined-space
chemical-exposure          dust-airborne           noise
isolation-energy           eye-injury              biological-hygiene
```

### Department / area tags (from corpus folders)

```
area-forming               area-batch-furnace      area-mould-repair
area-machine-repair        area-finished-products  area-quality-control
area-electrical            area-factory-maintenance area-plant-services
area-job-change
```

That's 24 hazard-bearing + 10 area tags = **34 controlled tags total**, fitting the
~20-50 target range from the discuss-phase decision.

---

## 7. NZ Global Block Seed Candidates (D-Global-03 — auto-seed)

Per the **auto-seed-full-list** decision, every cluster's top-N phrasings ship as global
hazard blocks at launch, then Summit cleans up via the super-admin UI.

**Recommended seed counts** (top phrasings per cluster, weighted by mentions):

| Cluster | Seed count | Rationale |
|---|---:|---|
| `crush-entrapment` | 5 | 729 mentions in corpus |
| `manual-handling-strain` | 5 | 572 mentions in corpus |
| `cuts-lacerations` | 5 | 422 mentions in corpus |
| `burns-hot` | 5 | 334 mentions in corpus |
| `spill-environmental` | 5 | 319 mentions in corpus |
| `slips-trips` | 5 | 258 mentions in corpus |
| `electrocution` | 3 | 170 mentions in corpus |
| `moving-machinery` | 3 | 140 mentions in corpus |
| `glass-breakage` | 3 | 112 mentions in corpus |
| `falling-objects` | 3 | 87 mentions in corpus |
| `pinch-points` | 3 | 85 mentions in corpus |
| `forklift-vehicle` | 2 | 76 mentions in corpus |
| `fire-explosion` | 2 | 64 mentions in corpus |
| `dust-airborne` | 2 | 58 mentions in corpus |
| `noise` | 2 | 51 mentions in corpus |
| `chemical-exposure` | 2 | 49 mentions in corpus |
| `flying-debris` | 1 | 33 mentions in corpus |
| `pressurised-fluid` | 1 | 24 mentions in corpus |

**Total estimated global hazard blocks at launch:** approximately 57 hazard blocks. Plus ~5 generic
PPE blocks (Hard Hat, Gloves, Safety Glasses, Hearing Protection, Steel-toe Boots) and
~3 step-pattern blocks (Lock-out / Tag-out, Manual Handling Best Practice, Hot Work Permit).

---

## 8. Picker Priority Signals (D-Pick-01 input)

Computed from per-step (hazard, dept) co-occurrence. When an admin authors a SOP in
department X and clicks "Pick from library" at the hazards step, the picker query
should:

1. **Hard filter** to blocks tagged with `area-{department}` or any related area.
2. **Boost** blocks in the top 3 hazard clusters for that department (per § 3 above).
3. **Fall back** to all-of-kind on zero matches (D-Pick-03).

Example: an admin building a SOP tagged `area-forming` asks for hazards →
picker returns hazards tagged `area-forming` or untagged-global, sorted with
`other` / `manual-handling-strain` / `burns-hot` boosted to the top.

---

## 9. Org-vs-Global Split Heuristic

Frequency-driven: a hazard phrasing is a **global candidate** if it appears in 5+ JSAs
across 2+ departments; otherwise it stays **org-scoped** until promoted via the
"Suggest for global" path (D-Global-02).

Quick estimate:
- Phrases with corpus frequency ≥ 5 across ≥ 2 departments: global candidates
- Phrases below that bar: org-scoped (live in this single org's library by default)

For the auto-seed (D-Global-03), the per-cluster top-N approach produces ~50 global blocks.

---

## 10. Out-of-Cluster ("other") Tail

1511 hazard mentions (29.4% of corpus) didn't match any cluster heuristic. These are
**high-signal candidates for additional named categories** OR for the free-text overlay
(D-Tax-01). Top "other" phrasings:

- (45×) making section safe to
- (27×) reduce the risk of being
- (21×) points
- (20×) reduce the risk of being caught in the section
- (16×) reduce the risk of being caught in the section.
- (16×) caught in the section
- (14×) in machine.
- (10×) caught in the section.
- (9×) bottles falling off pallet,
- (9×) damage
- (9×) swinging basket splashes to face body
- (8×) shocks
- (8×) layer boards may fall off
- (8×) collapse
- (7×) fall
- (7×) rigging.
- (6×) heat & dehydration
- (6×) hot environment
- (6×) lift collapse
- (6×) light curtain
- (6×) pallet if not lifted correctly
- (6×) chain conveyors, bottles
- (6×) collision with
- (6×) and moulds
- (6×) fall from machine, manual

These are NOT included in the auto-seed — they need a manual review pass before being
elevated either to a new cluster or to the seed list. Defer this review to plan 13-02
work or a follow-up Summit curation cycle.

---

## 11. Inputs to Phase 13 Plans

This document feeds the following Phase 13 plans:

- **Plan 13-01** (Block CRUD): no direct dependency, but the controlled vocab list
  in § 6 informs the categories field schema for `blocks.category_tags` (text[] in PG).
- **Plan 13-02** (NZ global block seed): consumes § 7 directly. Generate a seed migration
  containing ~50 global hazard blocks + ~5 PPE + ~3 step-pattern blocks. Source phrasings
  taken from § 2 exemplar phrasings (top per cluster).
- **Plan 13-03** (Wizard picker): consumes § 3 (department × cluster heatmap) and § 8
  (picker priority signals) to drive the matching logic.
- **Plan 13-04** (Update badging): no dependency from this corpus pass.

---

## 12. Caveats and Known Limitations

1. **Single-org corpus**: All 666 JSAs come from one organisation (a NZ glass manufacturer
   per the project notes). The "global" seed list will be biased toward glass-manufacturing
   hazards (forming, mould repair, batch & furnace). Summit must add cross-industry hazards
   (e.g. construction, hospitality, food processing) before SafeStart launches outside this
   sector. Track as a Phase 13 plan-02 deliverable.

2. **Antiword cannot read Word checkboxes**: The canonical 42-hazard checklist embedded in
   each JSA was lost. The analysis derived hazards from the free-text steps table instead,
   which is rich enough for clustering but may miss hazards an analyst checked but didn't
   write into the steps. To recover this, a future pass could use Word COM with per-file
   timeouts (the prior failed run got 147 files done) or migrate to `docx2text` / pandoc.

3. **Cluster heuristics are regex-based**: ~29% of hazard mentions land in the "other"
   bucket. Adding semantic embeddings would push this lower but isn't on the Phase 13
   critical path (deferred per CONTEXT.md).

4. **Control-text contamination**: A small number of step rows have control-phrase text
   ("waste removal and tidy up", "making section safe to") in the hazard column,
   suggesting those JSAs were authored with non-standard column ordering. Filtered via
   `NON_HAZARD_TERMS` in the analyzer; track edge cases as data quality issues.

5. **17 native .docx + 1 .pdf not analysed here**: Those are formal SOPs (EN-FOR-* series),
   not JSAs. They follow a different structure (Purpose / Reference / Procedure / Document
   Classification). They are reserved for a separate review pass that informs the
   **Step block** seed list, not the hazard/PPE seed list.

---

*Generated by `corpus-pass/synthesize.mjs` from `docs.json` + `stats.json` + `hazard-corpus.json`.*
*Source data and intermediate outputs: `.planning/phases/13-reusable-block-library/corpus-pass/`*
