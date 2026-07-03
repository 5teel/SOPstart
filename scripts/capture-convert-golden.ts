/**
 * Phase 26 Plan 26-02 — R6 convert golden-path baseline capture.
 *
 * Freezes the pre-phase output of the deterministic convert path so the Wave 2
 * bespoke-renderer swap (D-01: layout_data / junction / provenance FROZEN) can
 * be proven byte-equivalent at phase end.
 *
 * Why a fixed ParsedSop and not a live DOCX -> GPT -> DB run:
 *   - The GPT parse is non-deterministic (temperature, model drift) -> not
 *     byte-reproducible.
 *   - The junction materialization (createBlock / addBlockToSection) needs a
 *     live Supabase service-role connection -> not runnable in CI.
 * The FROZEN D-01 contract is the code-owned deterministic converter itself, so
 * the baseline exercises exactly that: `parsedSopToPerSectionLayoutData` (the
 * real layout_data + block_provenance producer) and `puckPropsToBlockContent`
 * (the real, pure kind-projection that materializeJunctionsForLayout uses to
 * build each junction's library block). Junction rows are always created
 * `pin_mode: 'pinned'` and unverified (verified_by_admin_id: null) at parse
 * time, so that default is captured directly.
 *
 * The ONLY non-deterministic field the converter emits is each Puck item's
 * `props.id` (nextId uses Date.now()); it is normalized to a stable
 * `id#{order}.{index}` placeholder so the diff is meaningful and byte-stable.
 *
 * CLI:
 *   npx tsx scripts/capture-convert-golden.ts          # (re)write the fixture
 *   npx tsx scripts/capture-convert-golden.ts --check   # assert parity + determinism (exit 1 on drift)
 *
 * The spec (tests/phase26/convert-golden-path.spec.ts) imports
 * `buildGoldenSnapshot` and deep-equals it against the committed fixture.
 */
import fs from 'node:fs'
import path from 'node:path'
import {
  parsedSopToPerSectionLayoutData,
  puckPropsToBlockContent,
  PARSER_VERSION,
  type ProvenanceContext,
} from '../src/lib/parsers/parsed-sop-to-layout-data'
import type { ParsedSop } from '../src/lib/validators/sop'
import type { UploadedImage } from '../src/lib/parsers/image-uploader'

const FIXTURE_PATH = path.resolve(
  __dirname,
  '../tests/phase26/fixtures/convert-golden.json',
)

// ---------------------------------------------------------------------------
// Fixed input — the parsed form of a known corpus DOCX. Chosen to exercise the
// full block surface the frozen contract covers: narrative (TextBlock), hazards
// (HazardCardBlock per line), PPE (PPECardBlock), step-only (StepBlock),
// step-with-photos (StepWithPhotosBlock + CalloutBlock warning/caution/tip),
// and orphan images (HeadingBlock + PhotoGridBlock appended to section 0).
// ---------------------------------------------------------------------------
const KNOWN_DOCX =
  'SOP-009-Removing-parts-from-Alkaline-Cleaning-tank-Machine-Shop-(Tergo-Alakalox).docx'

const PARSED: ParsedSop = {
  title: 'Removing parts from Alkaline Cleaning tank',
  sop_number: 'SOP-009',
  revision_date: '2024-11-01',
  author: 'Machine Shop',
  category: 'cleaning',
  related_sops: ['SOP-027'],
  applicable_equipment: ['Tergo Alkalox tank'],
  required_certifications: ['Chemical handling'],
  overall_confidence: 0.92,
  parse_notes: null,
  sections: [
    {
      order: 0,
      type: 'overview',
      title: 'Overview',
      content:
        'This procedure covers safe removal of parts from the alkaline cleaning tank.',
      steps: null,
      confidence: 0.95,
    },
    {
      order: 1,
      type: 'hazards',
      title: 'Hazards',
      content:
        'Alkaline solution causes chemical burns.\nHot surfaces up to 80 degrees Celsius.',
      steps: null,
      confidence: 0.9,
    },
    {
      order: 2,
      type: 'ppe',
      title: 'PPE',
      content: 'Chemical-resistant gloves\nFace shield\nApron',
      steps: null,
      confidence: 0.93,
    },
    {
      order: 3,
      type: 'steps',
      title: 'Procedure',
      content: null,
      confidence: 0.9,
      steps: [
        {
          order: 1,
          text: 'Switch off the agitator and confirm zero energy.',
          warning: 'Do not proceed until lockout is verified.',
          caution: null,
          tip: null,
          required_tools: ['Lockout tag'],
          time_estimate_minutes: 2,
          has_image: false,
          image_indexes: [],
        },
        {
          order: 2,
          text: 'Lift the parts basket clear of the solution.',
          warning: null,
          caution: 'Basket is heavy when loaded.',
          tip: 'Use the overhead hoist.',
          required_tools: null,
          time_estimate_minutes: 3,
          has_image: true,
          image_indexes: [0],
        },
        {
          order: 3,
          text: 'Rinse parts at the wash station.',
          warning: null,
          caution: null,
          tip: null,
          required_tools: null,
          time_estimate_minutes: 5,
          has_image: true,
          image_indexes: [1, 2],
        },
      ],
    },
  ],
}

// index 3 is intentionally orphaned (referenced by no step) -> exercises the
// PhotoGridBlock "Unanchored figures" append path.
const UPLOADED: UploadedImage[] = [
  { index: 0, storagePath: 'org/sop/images/img_0.png', contentType: 'image/png' },
  { index: 1, storagePath: 'org/sop/images/img_1.png', contentType: 'image/png' },
  { index: 2, storagePath: 'org/sop/images/img_2.png', contentType: 'image/png' },
  { index: 3, storagePath: 'org/sop/images/img_3.png', contentType: 'image/png' },
]

// docx provenance with a fallbackRegion so EVERY block gets block_provenance
// (regionForBlock falls back when a block has no image-index anchor).
const PROVENANCE: ProvenanceContext = {
  sourceKind: 'docx',
  parser_run_id: 'golden-run',
  parser_version: PARSER_VERSION,
  paragraphOfImageIndex: new Map([
    [0, { paragraph_id: 'p-10', run_start: 0, run_end: 1 }],
    [1, { paragraph_id: 'p-14', run_start: 0, run_end: 1 }],
    [2, { paragraph_id: 'p-15', run_start: 0, run_end: 1 }],
    [3, { paragraph_id: 'p-20', run_start: 0, run_end: 1 }],
  ]),
  fallbackRegion: { kind: 'docx', paragraph_id: 'p-0', run_start: 0, run_end: 0 },
}

export interface GoldenBlock {
  type: string
  props: Record<string, unknown>
}
export interface GoldenJunction {
  kind: string
  pin_mode: 'pinned'
  verified: false
  block_provenance: unknown
}
export interface GoldenSection {
  order: number
  content: GoldenBlock[]
  junctions: GoldenJunction[]
}
export interface GoldenSnapshot {
  knownDocx: string
  parserVersion: string
  sections: GoldenSection[]
}

/** Deep-clone props and replace the non-deterministic `id` with a stable token. */
function normalizeProps(
  props: Record<string, unknown>,
  order: number,
  index: number,
): Record<string, unknown> {
  const clone = JSON.parse(JSON.stringify(props)) as Record<string, unknown>
  clone.id = `id#${order}.${index}`
  // The converter never stamps junctionId (materialize does, via DB); normalize
  // defensively so a future converter change that pre-stamps it stays stable.
  if ('junctionId' in clone) clone.junctionId = `jct#${order}.${index}`
  return clone
}

/**
 * Run the frozen convert path and project it into a byte-stable snapshot:
 * per section, the normalized layout_data.content[] plus the would-be
 * sop_section_blocks junction rows (kind + pinned + unverified + provenance).
 */
export function buildGoldenSnapshot(): GoldenSnapshot {
  const { layouts } = parsedSopToPerSectionLayoutData(PARSED, UPLOADED, {
    provenanceContext: PROVENANCE,
  })

  const orders = [...layouts.keys()].sort((a, b) => a - b)
  const sections: GoldenSection[] = orders.map((order) => {
    const layout = layouts.get(order)!
    const content: GoldenBlock[] = layout.content.map((item, i) => ({
      type: item.type,
      props: normalizeProps(item.props, order, i),
    }))
    const junctions: GoldenJunction[] = layout.content
      // Mirror materializeJunctionsForLayout: placeholders never become blocks.
      .filter((item) => item.type !== 'UnsupportedBlockPlaceholder')
      .map((item) => ({
        kind: puckPropsToBlockContent(item.type, item.props).kind,
        pin_mode: 'pinned',
        verified: false,
        block_provenance: item.props.block_provenance ?? null,
      }))
    return { order, content, junctions }
  })

  return { knownDocx: KNOWN_DOCX, parserVersion: PARSER_VERSION, sections }
}

function canonical(snap: GoldenSnapshot): string {
  return JSON.stringify(snap, null, 2) + '\n'
}

// CLI — only when invoked directly (never when the spec imports this module).
if (process.argv[1] && process.argv[1].includes('capture-convert-golden')) {
  const isCheck = process.argv.includes('--check')
  const serialized = canonical(buildGoldenSnapshot())

  if (isCheck) {
    const existing = fs.existsSync(FIXTURE_PATH)
      ? fs.readFileSync(FIXTURE_PATH, 'utf8')
      : ''
    if (existing !== serialized) {
      console.error(
        'GOLDEN DRIFT: capture output differs from committed fixture.\n' +
          `  fixture: ${FIXTURE_PATH}\n` +
          '  Regenerate with `npx tsx scripts/capture-convert-golden.ts` only if the\n' +
          '  D-01 frozen contract legitimately changed.',
      )
      process.exit(1)
    }
    // Determinism self-check: a second run must be byte-identical.
    if (canonical(buildGoldenSnapshot()) !== serialized) {
      console.error('NON-DETERMINISTIC: repeated capture produced different output.')
      process.exit(1)
    }
    console.log('GOLDEN OK — matches committed fixture and is deterministic.')
  } else {
    fs.mkdirSync(path.dirname(FIXTURE_PATH), { recursive: true })
    fs.writeFileSync(FIXTURE_PATH, serialized)
    console.log(`WROTE ${FIXTURE_PATH}`)
  }
}
