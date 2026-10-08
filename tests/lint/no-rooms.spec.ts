/**
 * ADR-0005 guard: the app has no rooms.
 *
 * The home is plain sections chosen by role plus a library map drawn from the library
 * (ADR-0004, ADR-0005). The earlier room metaphor, its position tables, its two shells and
 * the machine-coverage prompt are gone and must not come back. This fails if:
 *   (a) a deleted room module or shell file reappears,
 *   (b) a room table, resolver or machine-coverage producer identifier is named in src,
 *   (c) a capitalised room word is written in any source file,
 *   (d) an old place address is spelled in src outside the legacy reader,
 *   (e) ADR-0005 is missing or ADR-0003 is not marked superseded.
 *
 * Comments are stripped before matching, and this file describes the banned words in parts,
 * so documenting the retired concept never trips the guard (CLAUDE.md 2026-09-28). The
 * matchers prove themselves on an inline fixture, so a finder that finds nothing cannot pass
 * vacuously (CLAUDE.md 2026-05-25).
 *
 * Registration: playwright.config.ts `phase15-stubs` project testMatch alternation.
 * Verify: `npx playwright test --list --project=phase15-stubs | grep no-rooms`.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const join = (...parts: string[]) => parts.join('')

export function stripComments(src: string): string {
  return src
    .replace(/\r\n/g, '\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => l.replace(/(^|[^:'"`\\])\/\/.*$/, '$1'))
    .join('\n')
}

// (b) identifiers
const IDENTIFIERS = new RegExp(
  `\\b(?:${[
    join('PRESET', '_ROOMS'),
    join('rooms', 'For'),
    join('ROOM', '_IDS'),
    join('reconcile', 'MachineRequests'),
    join('machines', 'WithoutSops'),
  ].join('|')})\\b`,
)
// (c) capitalised room words, as a person would read them on a screen
const ROOM_WORDS = new RegExp(
  `\\b(?:${[join('Smo', 'ko'), join('Work', 'shop'), join('Notice', 'board'), join('the ', 'Office')].join('|')})\\b`,
)
// (d) the old place address, in a string or a query
const PLACE_ADDRESS = new RegExp(join('pla', 'ce='))

const ROOM_WORD_HOME = 'src/lib/shell/home-state.ts' // the legacy reader spells the old address on purpose

/** Returns each hit as `kind: text`; the same matchers run over src and over the fixture. */
export function scanRooms(raw: string, file = ''): string[] {
  const src = stripComments(raw)
  const hits: string[] = []
  const id = src.match(IDENTIFIERS)
  if (id) hits.push(`identifier: ${id[0]}`)
  const word = src.match(ROOM_WORDS)
  if (word) hits.push(`room word: ${word[0]}`)
  if (file !== ROOM_WORD_HOME) {
    const addr = src.match(PLACE_ADDRESS)
    if (addr) hits.push(`place address: ${addr[0]}`)
  }
  return hits
}

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p)
  }
  return out
}
const rel = (p: string) => path.relative(ROOT, p).split(path.sep).join('/')

test.describe('No rooms (ADR-0005)', () => {
  test('the deleted room modules and shells do not exist', () => {
    const gone = [
      'src/lib/site/rooms.ts',
      'src/lib/shell/place.ts',
      ...['ShellFrame', 'WorkerShell', 'AdminShell', 'RoomBodies', 'AdminRoomBodies', 'SiteSummary', 'OfficeCard', 'SiteOverview', 'OneScreen'].map(
        (n) => `src/components/shell/${n}.tsx`,
      ),
      'src/components/sop/plant/PlantStage.tsx',
      'src/components/sop/plant/NowCard.tsx',
      'src/lib/requests/machine-requests.ts',
    ]
    expect(gone.filter((f) => fs.existsSync(path.join(ROOT, f)))).toEqual([])
  })

  test('src names no room table, resolver or machine-coverage producer, no capitalised room word and no old place address', () => {
    const hits: string[] = []
    for (const f of walk(path.join(ROOT, 'src'))) {
      for (const h of scanRooms(fs.readFileSync(f, 'utf-8'), rel(f))) hits.push(`${rel(f)} -> ${h}`)
    }
    expect(hits).toEqual([])
  })

  test('the matchers catch a room sentence, a room table and an old place address, and ignore comments', () => {
    const word = join('Smo', 'ko')
    const table = join('PRESET', '_ROOMS')
    const addr = join('pla', 'ce=') + 'office'
    expect(scanRooms(`<p>Go to the ${word} room</p>`)).toEqual([`room word: ${word}`])
    expect(scanRooms(`const r = ${table}.bottling`)).toEqual([`identifier: ${table}`])
    expect(scanRooms(`href="/?${addr}"`)).toEqual([`place address: ${addr.slice(0, 6)}`])
    expect(scanRooms(`href="/?${addr}"`, ROOM_WORD_HOME)).toEqual([])
    expect(scanRooms(`// the ${word} was a room\n/* ${table} */ const ok = 1`)).toEqual([])
  })

  test('ADR-0005 supersedes ADR-0003 and the index says so', () => {
    const adr = fs.readFileSync(path.join(ROOT, 'docs/adr/0005-library-map-replaces-rooms.md'), 'utf-8')
    expect(adr).toMatch(/\*\*Supersedes:\*\*\s*ADR-0003/)
    expect(adr).toContain('tests/lint/no-rooms.spec.ts')
    const old = fs.readFileSync(path.join(ROOT, 'docs/adr/0003-site-templates.md'), 'utf-8')
    expect(old).toMatch(/\*\*Status:\*\*\s*Superseded by ADR-0005/)
    const index = fs.readFileSync(path.join(ROOT, 'docs/adr/README.md'), 'utf-8')
    expect(index).toMatch(/\[0003\][^\n]*Superseded by ADR-0005/)
    expect(index).toMatch(/\[0005\][^\n]*no-rooms\.spec\.ts/)
  })
})
