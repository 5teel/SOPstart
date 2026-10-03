/**
 * Phase 55 / Plan 55-01 -- CUT-01 / CUT-02 deletion sweep.
 *
 * Reads scripts/dropped-features.json (the dropped list Phase 62 will turn
 * into a build guard) and, per feature, asserts the ABSENCE OF FILES and the
 * ABSENCE OF REFERENCES (CLAUDE.md 2026-08-04: a deletion guard that only
 * checks the folder is gone passes while a link to it still ships).
 *
 * Every feature block is fixme until the plan that deletes it appends the
 * feature key to LIVE_FEATURES. The packages block flips with PACKAGES_LIVE.
 * The survivors block and the not-vacuous block are live from this plan.
 *
 * Guards read comment-stripped source, so prose in a kept file cannot trip
 * them; this spec and the JSON are excluded from the scans because they
 * necessarily name the dropped things (CLAUDE.md 2026-09-28). Comments here
 * describe the forbidden patterns in words only.
 *
 * Registration: playwright.config.ts `phase55` project.
 * Verify: `npx playwright test --list --project=phase55`
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SELF = path.join('tests', 'phase55', 'deletion-sweep.spec.ts')
const TEST_SCAN_EXCLUDED_PREFIXES = [
  path.join('tests', 'phase55') + path.sep,
  path.join('tests', 'evals', 'cut-features.eval.ts'),
  // asserts the ask-bar microphone is absent, so it must name the test id
  path.join('tests', 'evals', 'plant-home.eval.ts'),
]

// Each deleting plan appends its feature key here when it flips the block live.
const LIVE_FEATURES: string[] = ['voice-capture']
// 55-13 flips this once the eight packages are uninstalled.
const PACKAGES_LIVE = false

const FEATURES = [
  'voice-capture', 'voice', 'phone-qr', 'shared-device', 'youtube', 'photo-scan', 'video-generation',
  'offline', 'flow-diagram', 'annotation', 'version-compare', 'library', 'org-signup',
]

interface Entry {
  feature: string
  phase: number
  kind: 'route-page' | 'route-api' | 'file' | 'dir' | 'symbol' | 'package' | 'ai-model-key' | 'job'
  path?: string
  dir?: string
  ref?: string
  pattern?: string
  name?: string
  key?: string
  env?: string[]
}
interface Allow { pattern: string; reason: string; files?: string[] }

function read(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf-8').replace(/\r\n/g, '\n')
}
function exists(relPath: string): boolean {
  return fs.existsSync(path.join(ROOT, relPath))
}

// Blanks full-line comments (line, block-start, block-end, JSDoc continuation).
function stripComments(src: string): string {
  return src
    .split('\n')
    .map((line) => (/^\s*(\/\/|\/\*|\*\/|\*)/.test(line) ? '' : line))
    .join('\n')
}

function walkTsFiles(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue
      walkTsFiles(full, out)
    } else if (entry.isFile() && /\.tsx?$/.test(entry.name)) {
      out.push(full)
    }
  }
  return out
}

const dropped = JSON.parse(read('scripts/dropped-features.json')) as { version: number; entries: Entry[]; allow: Allow[] }
const ALLOW = dropped.allow

function isAllowed(rel: string, line: string): boolean {
  return ALLOW.some((a) => (!a.files || a.files.includes(rel.replace(/\\/g, '/'))) && new RegExp(a.pattern).test(line))
}

/** Lines in the comment-stripped file that match `re` and are not allow-listed. */
function findMatches(relPath: string, re: RegExp): string[] {
  const hits: string[] = []
  stripComments(read(relPath)).split('\n').forEach((line, i) => {
    if (re.test(line) && !isAllowed(relPath, line)) hits.push(`${relPath}:${i + 1}  ${line.trim().slice(0, 120)}`)
  })
  return hits
}

function scan(root: 'src' | 'tests', res: RegExp[]): string[] {
  const offenders: string[] = []
  for (const file of walkTsFiles(path.join(ROOT, root))) {
    const rel = path.relative(ROOT, file)
    if (rel === SELF) continue
    if (root === 'tests' && TEST_SCAN_EXCLUDED_PREFIXES.some((p) => rel.startsWith(p) || rel === p)) continue
    for (const re of res) offenders.push(...findMatches(rel, re))
  }
  return offenders
}

function routeFilesUnder(dirRel: string): string[] {
  const out: string[] = []
  for (const f of walkTsFiles(path.join(ROOT, dirRel))) {
    if (/^(page|route)\.tsx?$/.test(path.basename(f))) out.push(path.relative(ROOT, f))
  }
  return out
}

const byFeature = (feature: string) => dropped.entries.filter((e) => e.feature === feature)

for (const feature of FEATURES) {
  const entries = byFeature(feature)
  test.describe(`${feature}`, () => {
    test.fixme(!LIVE_FEATURES.includes(feature), 'flips live in the plan that deletes it')

    test('files are gone', () => {
      const present: string[] = []
      for (const e of entries) {
        if ((e.kind === 'file' || e.kind === 'dir') && e.path && exists(e.path)) present.push(e.path)
        if ((e.kind === 'route-page' || e.kind === 'route-api') && e.dir) present.push(...routeFilesUnder(e.dir))
      }
      expect(present, `Still present:\n${present.join('\n')}`).toEqual([])
    })

    test('src/ has no reference', () => {
      const res: RegExp[] = []
      for (const e of entries) {
        if (e.kind === 'symbol' && e.pattern) res.push(new RegExp(e.pattern))
        if ((e.kind === 'route-page' || e.kind === 'route-api') && e.ref) res.push(new RegExp(e.ref))
        if (e.kind === 'job') for (const v of e.env ?? []) res.push(new RegExp(`\\b${v}\\b`))
      }
      const offenders = scan('src', res)
      expect(offenders, `References in src/:\n${offenders.join('\n')}`).toEqual([])
    })

    test('tests/ has no reference', () => {
      const res = entries.filter((e) => e.kind === 'symbol' && e.pattern).map((e) => new RegExp(e.pattern!))
      const offenders = scan('tests', res)
      expect(offenders, `References in tests/:\n${offenders.join('\n')}`).toEqual([])
    })

    test('AI model keys are gone', () => {
      const keys = entries.filter((e) => e.kind === 'ai-model-key').map((e) => e.key!)
      const left: string[] = []
      for (const f of ['src/lib/ai/registry.ts', 'src/lib/ai/model-options.ts']) {
        const src = stripComments(read(f))
        for (const k of keys) if (new RegExp(`['"]${k}['"]\\s*:`).test(src)) left.push(`${f}: ${k}`)
      }
      expect(left, `Model keys still registered:\n${left.join('\n')}`).toEqual([])
    })

    test('journeys name no deleted route', () => {
      const src = stripComments(read('src/lib/journeys/journeys.ts'))
      const left = entries
        .filter((e) => e.kind === 'route-page' && e.path)
        .filter((e) => src.includes(`route: '${e.path}'`) || src.includes(`route: "${e.path}"`))
        .map((e) => e.path)
      expect(left, `journeys.ts still names: ${left.join(', ')}`).toEqual([])
    })
  })
}

test.describe('packages', () => {
  test.fixme(!PACKAGES_LIVE, 'flips live in 55-13 (uninstall)')
  test('no dropped package remains in package.json', () => {
    const pkg = JSON.parse(read('package.json'))
    const declared = new Set([
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
      ...Object.keys(pkg.optionalDependencies ?? {}),
    ])
    const left = dropped.entries.filter((e) => e.kind === 'package' && declared.has(e.name!)).map((e) => e.name)
    expect(left, `Still installed: ${left.join(', ')}`).toEqual([])
  })
})

// LIVE now: the things this phase must NOT take with it (D-01..D-05 and the inert contracts).
test.describe('survivors', () => {
  const mustExist = [
    // D-05: the record-video on-ramp stays
    'src/components/admin/VideoRecorder.tsx',
    'src/components/admin/VideoPreviewPanel.tsx',
    'src/lib/upload/tus-upload.ts',
    'src/app/api/sops/transcribe/route.ts',
    'src/lib/parsers/transcribe-audio.ts',
    // D-02: the join page
    'src/app/(auth)/join/page.tsx',
    // D-03
    'src/app/manifest.ts',
    // D-04
    'src/lib/parsers/ocr-fallback.ts',
    // kept data plumbing
    'src/lib/blocks/create-block-core.ts',
    'src/lib/builder/section-blocks-core.ts',
    'src/lib/auth/next-redirect.ts',
  ]
  for (const f of mustExist) test(`${f} survives`, () => expect(exists(f), f).toBe(true))

  const mustContain: Array<[string, string]> = [
    ['src/actions/versioning.ts', 'export async function cloneSopAsDraft'], // D-01
    ['src/actions/auth.ts', 'joinWithInviteCode'], // D-02
    ['src/actions/auth.ts', 'inviteUserByEmail'], // D-02
    ['src/components/admin/site/SiteEditor.tsx', 'react-konva'],
    ['src/lib/builder/block-registry.tsx', 'VoiceNoteBlock'],
    ['src/actions/introspection.ts', 'VoiceNoteBlock'],
    ['src/lib/validators/blocks.ts', 'voice-note'],
    ['src/styles/blueprint-theme.css', '--accent-voice:'],
    ['src/lib/builder/sanitize-layout.ts', 'export function UnsupportedBlockPlaceholder'],
    ['src/components/admin/builder-v2/visual/media-adapter.ts', 'bakedSrc'],
    ['src/lib/site/scene.ts', 'export function newMachineCode'],
  ]
  for (const [f, needle] of mustContain) {
    test(`${f} still contains ${needle}`, () => expect(read(f)).toContain(needle))
  }

  test('tesseract.js stays installed (D-04)', () => {
    expect(JSON.parse(read('package.json')).dependencies['tesseract.js']).toBeTruthy()
  })
})

test.describe('dropped list is not vacuous', () => {
  test('has >= 100 entries, only known features, and every regex compiles', () => {
    expect(dropped.version).toBe(1)
    expect(dropped.entries.length).toBeGreaterThanOrEqual(100)
    for (const e of dropped.entries) {
      expect(e.phase).toBe(55)
      expect(FEATURES, `unknown feature ${e.feature}`).toContain(e.feature)
      for (const src of [e.ref, e.pattern]) if (src) expect(() => new RegExp(src), src).not.toThrow()
    }
    for (const f of FEATURES) expect(byFeature(f).length, `${f} has no entries`).toBeGreaterThan(0)
  })
})
