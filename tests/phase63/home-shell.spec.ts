/**
 * Phase 63 / Plan 63-11 -- the home shell (HOME-01, HOME-05, MAP-04, GATE-01). Source-contract
 * cases; the deployed home eval (63-12) proves the behaviour.
 * Registration: playwright.config.ts `phase63` project.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8').replace(/\r\n/g, '\n')
const strip = (s: string) => s.split('\n').filter((l) => !/^\s*(\/\/|\/\*|\*\/|\*)/.test(l)).join('\n')
const shell = () => strip(read('src/components/home/HomeShell.tsx'))

test.describe('home shell', () => {
  test('one state writer: a single replaceState, no router, no server action', () => {
    const s = shell()
    expect(s.match(/replaceState\(/g)?.length).toBe(1)
    expect(s).not.toMatch(/useRouter|router\.|next\/navigation|@\/actions/)
  })

  test('the map and every section body are lazy', () => {
    const s = shell()
    for (const m of ['SiteMap', 'MyRecordSection', 'TrainingSection', 'SignOffsSection', 'PeopleSection', 'ManageSection']) {
      expect(s, m).toMatch(new RegExp(`const ${m} = dynamic\\(\\(\\) => import\\('@/components/home/(?:map|sections)/${m}'\\)`))
      expect(s, m).not.toMatch(new RegExp(`import \\{[^}]*\\b${m}\\b[^}]*\\} from`))
    }
  })

  test('phone vs desktop is CSS, never the window', () => {
    for (const f of ['HomeShell', 'SectionMenu', 'TabBar']) {
      expect(strip(read(`src/components/home/${f}.tsx`)), f).not.toMatch(/matchMedia|innerWidth|localStorage|useViewport/)
    }
    expect(read('src/components/home/SectionMenu.tsx')).toContain('max-lg:hidden')
    expect(read('src/components/home/TabBar.tsx')).toContain('lg:hidden')
  })

  test('menu and tab bar take their sections from the role', () => {
    for (const f of ['SectionMenu', 'TabBar']) expect(read(`src/components/home/${f}.tsx`), f).toContain('sectionsForRole(')
  })

  test('no count is rendered next to a section label', () => {
    for (const f of ['SectionMenu', 'TabBar']) {
      const s = strip(read(`src/components/home/${f}.tsx`))
      expect(s, f).not.toMatch(/\{[^}]*(count|length|\.size)[^}]*\}\s*<\/(span|button)>/i)
      expect(s, f).not.toMatch(/SECTION_LABEL\[[a-z]+\]\}\s*\{/)
    }
  })

  test('Esc closes Read, then leaves the area, and ignores typing and dialogs', () => {
    const s = shell()
    expect(s).toContain("e.key !== 'Escape'")
    expect(s).toContain('[aria-modal="true"]')
    expect(s.indexOf('s.sop')).toBeLessThan(s.indexOf('s.area'))
  })

  test('the bell opens My record at Notifications', () => {
    const s = shell()
    expect(s).toContain("select({ ...HOME, s: 'record' })")
    expect(s).toContain("requestOverviewSection('notifications')")
  })

  test('Read and the focus screen speak the home address', () => {
    expect(shell()).toContain('from={homeFrom({ ...HOME, sop: openRow.id, area: state.area })}')
    const f = read('src/lib/sop/focus-path.ts')
    expect(f).toContain('homeFromToken(')
    expect(f).not.toContain('placeToken')
  })
})

test.describe('home route', () => {
  test('page.tsx mounts HomeShell, redirects legacy place addresses on the server, and OneScreen is gone', () => {
    const p = strip(read('src/app/page.tsx'))
    expect(p).toContain("from '@/components/home/HomeShell'")
    expect(p).toMatch(/redirect\(formatHome\(legacyToHome\(/)
    expect(p).toContain('parseHome(')
    expect(p).not.toContain('OneScreen')
    expect(p).toContain("redirect('/welcome')")
    expect(fs.existsSync(path.join(process.cwd(), 'src/components/shell/OneScreen.tsx'))).toBe(false)
  })

  test('the bundle gate watches the lazy seams on / and no longer names the machine body', () => {
    const g = read('scripts/check-bundle-size.ts')
    expect(g).not.toContain('No procedures for this machine yet.')
    const page = g.slice(g.indexOf("route: '/page'"))
    for (const m of ['Esc for the whole site', 'Every way in ends in the same editor.', 'A record to look up, not a to-do list.', 'and who signed it off.']) {
      expect(page, m).toContain(m)
    }
  })
})
