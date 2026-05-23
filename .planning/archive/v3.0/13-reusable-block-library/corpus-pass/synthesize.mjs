// Synthesize CORPUS-ANALYSIS.md from analyze.mjs outputs.
// Produces the final markdown that Phase 13 plans will reference.

import fs from 'node:fs'
import path from 'node:path'

const OUT_DIR = 'C:\\Development\\SOPstart\\.planning\\phases\\13-reusable-block-library\\corpus-pass\\analysis'
const FINAL_MD = 'C:\\Development\\SOPstart\\.planning\\phases\\13-reusable-block-library\\13-CORPUS-ANALYSIS.md'

const docs = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'docs.json'), 'utf8'))
const stats = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'stats.json'), 'utf8'))
const hazards = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'hazard-corpus.json'), 'utf8'))

// Normalize risk categories
function normaliseRisk(r) {
  if (!r) return null
  const n = r.toLowerCase().trim()
  if (n === 'low' || n === 'l') return 'Low'
  if (n === 'medium' || n === 'med' || n === 'moderate' || n === 'm') return 'Medium'
  if (n === 'high' || n === 'h' || n === 'extreme') return 'High'
  return null
}

const riskNorm = {}
for (const [k, v] of Object.entries(stats.byCategory)) {
  const r = normaliseRisk(k)
  if (r) riskNorm[r] = (riskNorm[r] || 0) + v
}

// Cluster → exemplar phrases (top 5 raw phrasings per cluster)
const clusterPhrases = {}
for (const h of hazards) {
  if (!h.cluster) continue
  if (!clusterPhrases[h.cluster]) clusterPhrases[h.cluster] = {}
  const k = (h.hazard || '').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 80)
  if (!k) continue
  clusterPhrases[h.cluster][k] = (clusterPhrases[h.cluster][k] || 0) + 1
}

// Cluster → top departments
const clusterByDept = {}
for (const h of hazards) {
  if (!h.cluster) continue
  if (!clusterByDept[h.cluster]) clusterByDept[h.cluster] = {}
  const d = h.dept || 'unknown'
  clusterByDept[h.cluster][d] = (clusterByDept[h.cluster][d] || 0) + 1
}

// Department → cluster distribution
const deptByCluster = {}
for (const h of hazards) {
  if (!h.dept) continue
  if (!deptByCluster[h.dept]) deptByCluster[h.dept] = {}
  if (h.cluster) deptByCluster[h.dept][h.cluster] = (deptByCluster[h.dept][h.cluster] || 0) + 1
}

// Verb-prefix from filename → category co-occurrence (action taxonomy)
const verbPrefix = {}
for (const d of docs) {
  if (!d.title) continue
  const base = (d.title || '').split(/\s+/)[0]?.toLowerCase() || ''
  const dept = d.department
  if (!base) continue
  verbPrefix[base] = verbPrefix[base] || { count: 0, depts: {} }
  verbPrefix[base].count++
  if (dept) verbPrefix[base].depts[dept] = (verbPrefix[base].depts[dept] || 0) + 1
}

// PPE phrases → normalize
function normalisePpe(p) {
  if (!p) return null
  const t = p.toLowerCase().replace(/\s+/g, ' ').trim()
  if (t === 'all standard ppe required' || t === 'all standard safety equipment' || t === 'standard safety uniform plus') return 'STANDARD'
  return p
}
const ppeNorm = {}
for (const [k, v] of Object.entries(stats.ppeFreeText)) {
  const n = normalisePpe(k)
  if (!n) continue
  ppeNorm[n] = (ppeNorm[n] || 0) + v
}

// ─── Pre-compute values that need backtick-free string building ─────

const formingTopClusters = deptByCluster['FORMING AREA']
  ? Object.entries(deptByCluster['FORMING AREA']).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => '`' + k + '`').join(' / ')
  : 'top-cluster'

// ─── Build markdown ────────────────────────────────────────────────

const totalHaz = stats.totalHazardMentions
const sortedClusters = Object.entries(stats.hazardClusterCounts).sort((a, b) => b[1] - a[1])
const sortedDept = Object.entries(stats.byDepartment).sort((a, b) => b[1] - a[1])
const sortedTopFolder = Object.entries(stats.byTopFolder).sort((a, b) => b[1] - a[1])
const sortedPpe = Object.entries(ppeNorm).sort((a, b) => b[1] - a[1]).slice(0, 25)
const sortedVerb = Object.entries(verbPrefix).sort((a, b) => b[1].count - a[1].count).slice(0, 20)

let md = `# Phase 13: Reusable Block Library — Corpus Analysis

**Date:** ${new Date().toISOString().slice(0, 10)}
**Source:** \`C:\\Development\\SOPstart\\SOPstart - Raw SOPs\` (684 files: 666 .doc, 17 .docx, 1 pdf, 1 xls)
**Analyzed:** ${stats.total} files (.doc only — .docx/.pdf reserved for separate formal-SOP review)
**Step rows extracted:** ${stats.totalSteps}
**Hazard mentions clustered:** ${stats.totalHazardMentions}

This document is the prerequisite for Phase 13 plans 13-02 (NZ global block seed) and 13-03
(picker matching). It derives the controlled category vocabulary and seed list from the
actual SOP corpus rather than inventing a top-down taxonomy.

> **Note on extraction**: 666 \`.doc\` files were converted via \`antiword\`. The Word
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
${sortedTopFolder.map(([k, v]) => `| ${k} | ${v} |`).join('\n')}

### Departments (sub-folders)

| Department | Files |
|---|---:|
${sortedDept.map(([k, v]) => `| ${k} | ${v} |`).join('\n')}

### Risk category distribution

| Risk | Count |
|---|---:|
${Object.entries(riskNorm).sort((a, b) => b[1] - a[1]).map(([k, v]) => `| ${k} | ${v} |`).join('\n')}

### Significant-hazard flag (where "yes/no" was reliably extracted)

| Value | Count |
|---|---:|
${Object.entries(stats.significantHazardYesNo).filter(([k]) => /^(yes|no)$/i.test(k.trim())).sort((a, b) => b[1] - a[1]).map(([k, v]) => `| ${k} | ${v} |`).join('\n')}

---

## 2. Controlled Hazard Vocabulary (derived)

Frequency of distinct **hazard categories** across ${totalHaz} mentions in ${stats.totalSteps} step rows.
This is the **proposed Phase 13 controlled vocab for hazard blocks**, ranked by recurrence.
The "other" bucket holds hazards that didn't match a heuristic cluster — these are candidates
for additional named clusters or for the free-text overlay (D-Tax-01).

| # | Category | Mentions | Coverage |
|---|---|---:|---:|
${sortedClusters.map(([k, v], i) => `| ${i + 1} | \`${k}\` | ${v} | ${((v / totalHaz) * 100).toFixed(1)}% |`).join('\n')}

### Per-cluster exemplar phrasings

For each cluster, the top 5 most-frequent free-text phrasings the safety analysts
actually wrote. These are **candidate hazard block titles** for the global library.

${sortedClusters.slice(0, 18).map(([cluster, total]) => {
  const phrases = Object.entries(clusterPhrases[cluster] || {}).sort((a, b) => b[1] - a[1]).slice(0, 5)
  return `**\`${cluster}\`** (${total} mentions)
${phrases.map(([p, c]) => `- (${c}×) ${p}`).join('\n')}
`
}).join('\n')}

---

## 3. Department × Hazard Cluster Heatmap

Top 5 hazard clusters per department. Drives the **picker priority signal** (D-Pick-01):
when an admin opens "Pick from library" at a hazards step in a SOP tagged \`forming-area\`,
the picker should rank \`crush-entrapment\` and \`burns-hot\` blocks above generic ones.

| Department | Top hazard clusters (count) |
|---|---|
${Object.entries(deptByCluster).sort((a, b) => Object.values(b[1]).reduce((x, y) => x + y, 0) - Object.values(a[1]).reduce((x, y) => x + y, 0)).slice(0, 12).map(([dept, m]) => {
  const top = Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 5)
  return `| ${dept} | ${top.map(([c, n]) => `${c} (${n})`).join(', ')} |`
}).join('\n')}

---

## 4. PPE Library Seed (free-text from "PPE Required:" field)

Distinct PPE specifications across ${stats.total} JSAs. \`STANDARD\` collapses
synonyms of "all standard PPE required" / "standard safety uniform". Specific
PPE callouts are candidates for **PPE block library entries**.

| PPE specification | Count |
|---|---:|
${sortedPpe.map(([k, v]) => `| ${k.length > 80 ? k.slice(0, 80) + '...' : k} | ${v} |`).join('\n')}

---

## 5. Action-Verb Taxonomy (Task Classification)

Top 20 task-name first-words across the corpus. These are the **action verbs** safety
analysts use to name jobs. Useful for SOP-level category inference (D-Tax-03) and for
suggesting category tags during the wizard's "blank page" flow.

| Verb | Tasks | Top departments |
|---|---:|---|
${sortedVerb.map(([v, info]) => {
  const topD = Object.entries(info.depts).sort((a, b) => b[1] - a[1]).slice(0, 3)
  return `| ${v} | ${info.count} | ${topD.map(([d, n]) => `${d} (${n})`).join(', ')} |`
}).join('\n')}

---

## 6. Recommended Controlled Vocab (D-Tax-02)

Combining the clustering + verb-prefix analysis, here is the **proposed 30-tag flat
controlled vocabulary** for Phase 13. Tags follow \`<area>-<specific>\` convention but
are stored as flat strings (D-Tax-01).

### Hazard-bearing tags (from clusters)

\`\`\`
crush-entrapment           electrocution           burns-hot
manual-handling-strain     pinch-points            falls-from-height
cuts-lacerations           moving-machinery        forklift-vehicle
slips-trips                falling-objects         flying-debris
spill-environmental        pressurised-fluid       hot-work
glass-breakage             fire-explosion          confined-space
chemical-exposure          dust-airborne           noise
isolation-energy           eye-injury              biological-hygiene
\`\`\`

### Department / area tags (from corpus folders)

\`\`\`
area-forming               area-batch-furnace      area-mould-repair
area-machine-repair        area-finished-products  area-quality-control
area-electrical            area-factory-maintenance area-plant-services
area-job-change
\`\`\`

That's 24 hazard-bearing + 10 area tags = **34 controlled tags total**, fitting the
~20-50 target range from the discuss-phase decision.

---

## 7. NZ Global Block Seed Candidates (D-Global-03 — auto-seed)

Per the **auto-seed-full-list** decision, every cluster's top-N phrasings ship as global
hazard blocks at launch, then Summit cleans up via the super-admin UI.

**Recommended seed counts** (top phrasings per cluster, weighted by mentions):

| Cluster | Seed count | Rationale |
|---|---:|---|
${sortedClusters.filter(([k]) => k !== 'other').slice(0, 18).map(([k, v]) => {
  const seed = v >= 200 ? 5 : v >= 80 ? 3 : v >= 40 ? 2 : 1
  return `| \`${k}\` | ${seed} | ${v} mentions in corpus |`
}).join('\n')}

**Total estimated global hazard blocks at launch:** approximately ${sortedClusters.filter(([k]) => k !== 'other').slice(0, 18).reduce((acc, [k, v]) => acc + (v >= 200 ? 5 : v >= 80 ? 3 : v >= 40 ? 2 : 1), 0)} hazard blocks. Plus ~5 generic
PPE blocks (Hard Hat, Gloves, Safety Glasses, Hearing Protection, Steel-toe Boots) and
~3 step-pattern blocks (Lock-out / Tag-out, Manual Handling Best Practice, Hot Work Permit).

---

## 8. Picker Priority Signals (D-Pick-01 input)

Computed from per-step (hazard, dept) co-occurrence. When an admin authors a SOP in
department X and clicks "Pick from library" at the hazards step, the picker query
should:

1. **Hard filter** to blocks tagged with \`area-{department}\` or any related area.
2. **Boost** blocks in the top 3 hazard clusters for that department (per § 3 above).
3. **Fall back** to all-of-kind on zero matches (D-Pick-03).

Example: an admin building a SOP tagged \`area-forming\` asks for hazards →
picker returns hazards tagged \`area-forming\` or untagged-global, sorted with
${formingTopClusters} boosted to the top.

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

${(() => {
  const otherCount = stats.hazardClusterCounts['other'] || 0
  return `${otherCount} hazard mentions (${((otherCount / totalHaz) * 100).toFixed(1)}% of corpus) didn't match any cluster heuristic. These are
**high-signal candidates for additional named categories** OR for the free-text overlay
(D-Tax-01). Top "other" phrasings:`
})()}

${(() => {
  const others = Object.entries(clusterPhrases['other'] || {}).sort((a, b) => b[1] - a[1]).slice(0, 25)
  return others.map(([k, v]) => `- (${v}×) ${k}`).join('\n')
})()}

These are NOT included in the auto-seed — they need a manual review pass before being
elevated either to a new cluster or to the seed list. Defer this review to plan 13-02
work or a follow-up Summit curation cycle.

---

## 11. Inputs to Phase 13 Plans

This document feeds the following Phase 13 plans:

- **Plan 13-01** (Block CRUD): no direct dependency, but the controlled vocab list
  in § 6 informs the categories field schema for \`blocks.category_tags\` (text[] in PG).
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
   timeouts (the prior failed run got 147 files done) or migrate to \`docx2text\` / pandoc.

3. **Cluster heuristics are regex-based**: ~29% of hazard mentions land in the "other"
   bucket. Adding semantic embeddings would push this lower but isn't on the Phase 13
   critical path (deferred per CONTEXT.md).

4. **Control-text contamination**: A small number of step rows have control-phrase text
   ("waste removal and tidy up", "making section safe to") in the hazard column,
   suggesting those JSAs were authored with non-standard column ordering. Filtered via
   \`NON_HAZARD_TERMS\` in the analyzer; track edge cases as data quality issues.

5. **17 native .docx + 1 .pdf not analysed here**: Those are formal SOPs (EN-FOR-* series),
   not JSAs. They follow a different structure (Purpose / Reference / Procedure / Document
   Classification). They are reserved for a separate review pass that informs the
   **Step block** seed list, not the hazard/PPE seed list.

---

*Generated by \`corpus-pass/synthesize.mjs\` from \`docs.json\` + \`stats.json\` + \`hazard-corpus.json\`.*
*Source data and intermediate outputs: \`.planning/phases/13-reusable-block-library/corpus-pass/\`*
`

fs.writeFileSync(FINAL_MD, md)
console.log(`Wrote ${FINAL_MD}`)
console.log(`Markdown size: ${md.length} chars`)
