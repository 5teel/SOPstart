// Corpus analysis pass for Phase 13 — antiword tabular output edition.
//
// Each JSA's antiword output looks like:
//   <Title>
//   HAZARD IDENTIFICATION
//   |...|...|...|         <- checkbox table (lost by antiword, not parseable)
//   |PPE Required: |...|JSA Reviewed by and date|
//   |Sequence of Job Steps|Potential / Actual Hazard|Level of Risk|Controls...|
//   |<step text>          |<hazard text>           |<risk>       |<controls> |
//   |                     |<continuation>          |             |<cont>     |
//
// We mine the Sequence-of-Job-Steps table for free-text hazards per step.
// That's a stronger signal than the lost checkbox table because it gives us:
//   - real-world phrasing of hazards
//   - hazard severity per step
//   - co-occurrence patterns
//
// Output: corpus-pass/analysis/{docs.json, stats.json, hazards-clustered.json}
//         and 13-CORPUS-ANALYSIS.md (written by a separate step)

import fs from 'node:fs'
import path from 'node:path'

const TXT_DIR = 'C:\\Development\\SOPstart\\.planning\\phases\\13-reusable-block-library\\corpus-pass\\text'
const OUT_DIR = 'C:\\Development\\SOPstart\\.planning\\phases\\13-reusable-block-library\\corpus-pass\\analysis'
fs.mkdirSync(OUT_DIR, { recursive: true })

// ─── Parsers ────────────────────────────────────────────────────────

function splitPipeRow(line) {
  // |a|b|c|d| -> ['a', 'b', 'c', 'd']
  const inner = line.replace(/^\|/, '').replace(/\|\s*$/, '')
  return inner.split('|').map((c) => c.trim())
}

function parseStepsTable(text) {
  // Find header row containing "Sequence of Job Steps"
  const lines = text.split(/\r?\n/)
  let headerIdx = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Sequence of Job Steps')) {
      headerIdx = i
      break
    }
  }
  if (headerIdx < 0) return []

  // Header may span 2 rows ("Sequence of Job Steps|Potential /|Level of|Controls..."
  // followed by "|Actual Hazard|Risk|"). Skip lines where col 0 is empty until
  // we hit a row with content in col 0.
  const steps = []
  let cur = null
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.startsWith('|')) {
      // Out of table.
      if (cur) steps.push(cur)
      break
    }
    const cells = splitPipeRow(line)
    if (cells.length < 3) continue
    const [step, hazard, risk, ...rest] = cells
    const controls = rest.join(' | ').trim()
    if (step && step !== '' && !step.toLowerCase().includes('actual hazard')) {
      // New step
      if (cur) steps.push(cur)
      cur = {
        step: step,
        hazard: hazard || '',
        risk: risk || '',
        controls: controls || '',
      }
    } else if (cur) {
      // Continuation of current step's columns
      if (hazard) cur.hazard = (cur.hazard + ' ' + hazard).trim()
      if (risk && !cur.risk) cur.risk = risk
      if (controls) cur.controls = (cur.controls + ' ' + controls).trim()
    }
  }
  if (cur) steps.push(cur)
  return steps
}

function extractTitle(text) {
  // Title is the first non-empty line.
  const lines = text.split(/\r?\n/)
  for (const l of lines) {
    const t = l.trim()
    if (t && t !== 'HAZARD IDENTIFICATION') return t.slice(0, 200)
  }
  return null
}

function extractLabelledValue(text, label) {
  // antiword renders labels and values on consecutive rows in the same column:
  //   |PPE Required:    |Significant Hazard|JSA Reviewed by...|
  //   |All standard...  |Yes               |                  |
  // Strategy: find row containing label, locate label's column, scan the
  // next ~5 rows in that column and return the first non-empty cell that
  // isn't another label.
  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const row = lines[i]
    if (!row.startsWith('|') || !row.includes(label)) continue
    const cells = splitPipeRow(row)
    const lblIdx = cells.findIndex((c) => c.includes(label))
    if (lblIdx < 0) continue
    for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
      const next = lines[j]
      if (!next.startsWith('|')) break
      const nextCells = splitPipeRow(next)
      const v = (nextCells[lblIdx] || '').trim()
      if (v && !v.includes(':') && !/^Significant Hazard|^Overall Category|^Control taken|^Risk Score|^Category$|^JSA Reviewed|^JSEA Reviewed|^Sequence of Job Steps|^Potential|^Actual Hazard|^Level of|^Controls to/i.test(v)) {
        return v
      }
    }
  }
  return null
}

function extractCategory(text) {
  return extractLabelledValue(text, 'Overall Category of task') || extractLabelledValue(text, 'Category')
}

function extractControlTaken(text) {
  return extractLabelledValue(text, 'Control taken')
}

function extractPpe(text) {
  return extractLabelledValue(text, 'PPE Required:')
}

function extractSignificantHazard(text) {
  return extractLabelledValue(text, 'Significant Hazard')
}

function extractDepartment(filename) {
  const parts = filename.replace(/\.txt$/, '').split('__')
  if (parts.length >= 2) return parts[parts.length - 2]
  return null
}

function extractTopFolder(filename) {
  const parts = filename.replace(/\.txt$/, '').split('__')
  return parts[0] || null
}

// ─── Hazard normalization ───────────────────────────────────────────

function normalizeHazard(s) {
  return s
    .toLowerCase()
    .replace(/[\.,;:!\?]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\bw\/\b/g, 'with ')
    .replace(/\b&\b/g, 'and')
    .replace(/&amp;/g, 'and')
    .trim()
}

// Heuristic clusters: bucket free-text hazards into canonical categories.
// Priority order matters — first match wins. Use stem matching (no \b at end of stems
// followed by suffix-letters) to catch English plurals/conjugations.
const CLUSTER_RULES = [
  { id: 'isolation-energy', match: /(stored energy|lockout|lock out|tag out|tagout|live circuit|inadequate isolation|residual energy)/i },
  { id: 'electrocution', match: /(electric(al)? shock|electrocut|live equip|live wire|live cable|electric current|400v|230v|high voltage|short circuit)/i },
  { id: 'pinch-points', match: /pinch point|nip point|caught between rollers/i },
  { id: 'crush-entrapment', match: /(entrap|crush|squeez|caught between|caught in section|caught in machine|caught in mould|trapped)/i },
  { id: 'falls-from-height', match: /(fall(ing)? from height|fall(ing)? from a height|work(ing)? at height|fall over the edge|drop from height|3 metres|three metres|harness)/i },
  { id: 'slips-trips', match: /(slip|trip|stumble|slipper|wet floor|oil on floor|tripping)/i },
  { id: 'manual-handling-strain', match: /(strain|sprain|manual handl|lifting|back injury|repetitive|awkward posture|over-?reach|heavy load|back pain)/i },
  { id: 'moving-machinery', match: /(moving (machinery|parts|equipment)|rotating part|automatic equip|moving belt|moving conveyor|fan blade|drive (shaft|chain))/i },
  { id: 'falling-objects', match: /(falling object|object falling|drop(ping)?|object fall|hit by|struck by|overhead load|tools? falling)/i },
  { id: 'burns-hot', match: /(burn(s|t)?|hot (surface|fluid|metal|equipment|glass|gob|mould)|excess(ively)? hot|scald|thermal|hot work surface|hot drag|molten|forehearth)/i },
  { id: 'burns-cold', match: /(cold burn|cryogenic|excess(ively)? cold)/i },
  { id: 'pressurised-fluid', match: /(pressuris(ed|ation)|under pressure|hydraulic|pneumatic|compressed air|water under pressure|air pressure)/i },
  { id: 'flying-debris', match: /(flying (object|debri|particle)|projectile|fb to|foreign body|swarf|chips? in eye)/i },
  { id: 'noise', match: /(nois|loud|sound exposure|hearing damage|hearing loss)/i },
  { id: 'dust-airborne', match: /(dust|airborne|particulate|fume|vapour|inhalation|silica)/i },
  { id: 'chemical-exposure', match: /(chemical|corrosive|caustic|acid(ic)?|alkali|toxic|hazardous substance|skin contact|alkaline|acetylene|oxygen|gas)/i },
  { id: 'fire-explosion', match: /(\bfire\b|explosion|combustib|flammab|ignition|spark|backfire)/i },
  { id: 'confined-space', match: /confined space|silo|tank entry|vessel entry/i },
  { id: 'forklift-vehicle', match: /(forklift|cherry picker|vehicle|mobile plant|hoist|crane|kerrick|pallet jack|mobile equipment)/i },
  { id: 'hot-work', match: /(hot work|welding|weld|grinding|cutting torch|braze|brazing|gas cutting)/i },
  { id: 'cuts-lacerations', match: /(cut(s|ting)?|laceration|sharp|knife|blade|broken glass|cullet|jagged|nick)/i },
  { id: 'eye-injury', match: /(eye injur|vision|splash to eye|chemical to eye|protect.*eye)/i },
  { id: 'glass-breakage', match: /(\bglass\b|cullet|broken bottle|breakage)/i },
  { id: 'spill-environmental', match: /(spill|leak(ing|age)?|drainage|stormwater|contamin|environmental)/i },
  { id: 'fatigue-shift', match: /(fatigue|tired|long shift|overtir)/i },
  { id: 'biological-hygiene', match: /(food contamination|hygiene|bacterial|mould growth)/i },
]

const NON_HAZARD_TERMS = new Set([
  'none', 'nil', 'na', 'n/a', 'as above', 'as per above', 'see above', 'tba',
  'damage to people property and environment', // generic boilerplate, not a real hazard
  'waste removal and tidy up',
  'waste removal and tidy',
  'up',
])

function clusterHazard(hazardText) {
  const norm = normalizeHazard(hazardText)
  if (!norm || NON_HAZARD_TERMS.has(norm)) return null
  if (norm.length < 3) return null
  for (const rule of CLUSTER_RULES) {
    if (rule.match.test(hazardText)) return rule.id
  }
  return 'other'
}

// ─── Main ───────────────────────────────────────────────────────────

const files = fs.readdirSync(TXT_DIR).filter((f) => f.endsWith('.txt'))
console.log(`Reading ${files.length} text files...`)

const docs = []
const stats = {
  total: files.length,
  byTopFolder: {},
  byDepartment: {},
  byCategory: {},
  byControlTaken: {},
  significantHazardYesNo: {},
  totalSteps: 0,
  totalHazardMentions: 0,
  hazardClusterCounts: {},
  hazardRawCounts: {}, // top free-text phrasings
  ppeFreeText: {}, // distinct PPE Required values
}

const hazardCorpus = [] // every (taskName, stepText, hazardText, risk) tuple for later mining

for (const file of files) {
  const fullPath = path.join(TXT_DIR, file)
  const raw = fs.readFileSync(fullPath, 'utf8')
  if (raw.length < 50) continue

  const title = extractTitle(raw)
  const dept = extractDepartment(file)
  const topFolder = extractTopFolder(file)
  const category = extractCategory(raw)
  const ctrlTaken = extractControlTaken(raw)
  const ppeReq = extractPpe(raw)
  const sigHaz = extractSignificantHazard(raw)
  const steps = parseStepsTable(raw)

  // Aggregate
  if (topFolder) stats.byTopFolder[topFolder] = (stats.byTopFolder[topFolder] || 0) + 1
  if (dept) stats.byDepartment[dept] = (stats.byDepartment[dept] || 0) + 1
  if (category) stats.byCategory[category] = (stats.byCategory[category] || 0) + 1
  if (ctrlTaken) stats.byControlTaken[ctrlTaken] = (stats.byControlTaken[ctrlTaken] || 0) + 1
  if (sigHaz) stats.significantHazardYesNo[sigHaz] = (stats.significantHazardYesNo[sigHaz] || 0) + 1
  if (ppeReq) stats.ppeFreeText[ppeReq] = (stats.ppeFreeText[ppeReq] || 0) + 1

  stats.totalSteps += steps.length
  for (const s of steps) {
    if (!s.hazard) continue
    const cluster = clusterHazard(s.hazard)
    if (cluster === null) continue // empty/nil/boilerplate filtered
    stats.totalHazardMentions++
    const norm = normalizeHazard(s.hazard)
    stats.hazardRawCounts[norm] = (stats.hazardRawCounts[norm] || 0) + 1
    stats.hazardClusterCounts[cluster] = (stats.hazardClusterCounts[cluster] || 0) + 1
    hazardCorpus.push({ task: title, dept, step: s.step, hazard: s.hazard, risk: s.risk, cluster })
  }

  docs.push({
    file,
    title,
    department: dept,
    topFolder,
    category,
    controlTaken: ctrlTaken,
    significantHazard: sigHaz,
    ppeRequired: ppeReq,
    stepCount: steps.length,
    steps,
  })
}

// Write outputs
fs.writeFileSync(path.join(OUT_DIR, 'docs.json'), JSON.stringify(docs, null, 2))
fs.writeFileSync(path.join(OUT_DIR, 'stats.json'), JSON.stringify(stats, null, 2))
fs.writeFileSync(path.join(OUT_DIR, 'hazard-corpus.json'), JSON.stringify(hazardCorpus, null, 2))

// Top-N reports
const sortedClusters = Object.entries(stats.hazardClusterCounts).sort((a, b) => b[1] - a[1])
const sortedRaw = Object.entries(stats.hazardRawCounts).sort((a, b) => b[1] - a[1])
const sortedDept = Object.entries(stats.byDepartment).sort((a, b) => b[1] - a[1])
const sortedTopFolder = Object.entries(stats.byTopFolder).sort((a, b) => b[1] - a[1])

console.log('\n=== STATS ===')
console.log('Total docs:', stats.total)
console.log('Total step rows:', stats.totalSteps)
console.log('Total hazard mentions:', stats.totalHazardMentions)
console.log('\nTop folders:')
for (const [f, c] of sortedTopFolder) console.log(`  ${c.toString().padStart(4)}  ${f}`)
console.log('\nTop departments (subfolder):')
for (const [d, c] of sortedDept.slice(0, 20)) console.log(`  ${c.toString().padStart(4)}  ${d}`)
console.log('\nRisk Categories:', stats.byCategory)
console.log('Control Taken:', stats.byControlTaken)
console.log('Significant Hazard:', stats.significantHazardYesNo)
console.log('\n=== HAZARD CLUSTERS (Top 30) ===')
for (const [k, v] of sortedClusters.slice(0, 30)) console.log(`  ${v.toString().padStart(5)}  ${k}`)
console.log('\n=== TOP RAW HAZARD PHRASINGS (Top 30) ===')
for (const [k, v] of sortedRaw.slice(0, 30)) console.log(`  ${v.toString().padStart(5)}  ${k.slice(0, 80)}`)
console.log('\n=== TOP PPE REQUIRED FREE-TEXT (Top 15) ===')
const sortedPpe = Object.entries(stats.ppeFreeText).sort((a, b) => b[1] - a[1]).slice(0, 15)
for (const [k, v] of sortedPpe) console.log(`  ${v.toString().padStart(5)}  ${k.slice(0, 80)}`)
