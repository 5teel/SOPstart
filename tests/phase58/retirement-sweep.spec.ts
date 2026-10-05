/**
 * Phase 58 -- retirement sweep (stub; Wave 0 / 58-01).
 * Filled by: 58-11 (tab redirect), 58-14 (builder/versions redirect, converter),
 * 58-16 (deletions). Negative assertions that quote a retired literal live here
 * (the repoint inventory walk excludes this folder).
 * Registration: playwright.config.ts `phase58` project.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
// Helpers the owning plans use when they flip the fixme cases live.
export const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf-8').replace(/\r\n/g, '\n')

export function stripComments(src: string): string {
  return src
    .split('\n')
    .map((line) => (/^\s*(\/\/|\/\*|\*\/|\*)/.test(line) ? '' : line))
    .join('\n')
}

export function walkSrc(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walkSrc(full, out)
    else if (/\.tsx?$/.test(e.name)) out.push(full)
  }
  return out
}

test.describe('retire: the tabbed SOP page (58-11)', () => {
  test('the proxy redirects a SOP address carrying the tab query to the bare SOP address (UUID-gated, fixed destination, cookies copied)', () => {
    const MW = stripComments(read('src/lib/supabase/middleware.ts'))
    expect(MW).toContain("path.startsWith('/sops/')")
    expect(MW).toContain('legacyRedirectFor(path, request.nextUrl.search)')
    expect(MW).toContain('response.cookies.getAll().forEach((c) => redirect.cookies.set(c))')
  })

  test('no client effect redirects a tab address (no router.replace or push of it anywhere in src)', () => {
    const offenders: string[] = []
    for (const f of walkSrc(path.join(ROOT, 'src'))) {
      const code = stripComments(fs.readFileSync(f, 'utf-8'))
      if (/router\.(replace|push)\([^)]*[?&]tab=/.test(code)) offenders.push(path.relative(ROOT, f))
    }
    expect(offenders).toEqual([])
  })

  test('the SOP route no longer mounts the tabs or the old walkthrough', () => {
    const PAGE = stripComments(read('src/app/(protected)/sops/[sopId]/page.tsx'))
    for (const gone of ['SopTabNav', 'ReadTab', 'WalkthroughSwitcher', 'WorkerPreviewToggle', 'useActiveTab']) expect(PAGE, gone).not.toContain(gone)
  })

  // Moved here from the deleted phase30 tab-merge spec (58-16): the bundle baseline still covers the worker route.
  test('the bundle baseline covers the worker route (moved by hand with a history note, never recaptured)', () => {
    const baseline = JSON.parse(read('.bundle-baseline.json'))
    expect(typeof baseline.routes['/sops/[sopId]/page']).toBe('number')
    expect(baseline.routes['/sops/[sopId]/page']).toBeGreaterThan(0)
  })
})

test.describe('retire: builder and versions addresses (58-14)', () => {
  test('the proxy redirects the builder address and the versions address to the SOP edit address', () => {
    const MW = stripComments(read('src/lib/supabase/middleware.ts'))
    expect(MW).toContain("path.startsWith('/admin/sops/')")
    expect(MW).toContain('legacyRedirectFor(path, request.nextUrl.search)')
    const FP = stripComments(read('src/lib/sop/focus-path.ts'))
    expect(FP).toContain("focusHref(id, { mode: 'edit' })")
  })

  test('the review-route redirect in next.config targets the edit address', () => {
    const cfg = stripComments(read('next.config.ts'))
    expect(cfg).toContain("destination: '/sops/:sopId?mode=edit'")
    expect(cfg).not.toContain("destination: '/admin/sops/builder/:sopId'")
  })

  test('the converter refuses --apply and tells the caller it is retired', () => {
    const SRC = stripComments(read('scripts/convert-sops-to-steps.ts'))
    expect(SRC).toContain("args.includes('--apply')")
    expect(SRC).toContain('converter retired in Phase 58')
  })

  test('no src file links the old builder or versions address (references, not just files)', () => {
    const offenders: string[] = []
    // The two directories that are deleted in 58-16 may still link each other.
    const skip = ['/admin/sops/builder/', '/admin/sops/[sopId]/versions/']
    for (const f of walkSrc(path.join(ROOT, 'src'))) {
      if (skip.some((d) => f.split(path.sep).join('/').includes(d))) continue
      const code = stripComments(fs.readFileSync(f, 'utf-8'))
      if (/\/admin\/sops\/builder\/\$\{/.test(code) || /\/admin\/sops\/\$\{[^}]*\}\/versions/.test(code)) offenders.push(path.relative(ROOT, f))
    }
    expect(offenders).toEqual([])
  })
})

// Mirrors the 58-16 tokens in repoint-inventory.spec.ts (that file holds them as data for the test
// folders; this one checks src/). Identifiers match on word boundaries so a longer name is not a hit.
const IDENTIFIERS_58_16 = [
  'ReadTab', 'SopTabNav', 'WorkerPreviewToggle', 'MobileWalkthrough', 'DesktopWalkthrough',
  'ImmersiveStepCard', 'WalkthroughSwitcher', 'ViewModeToggle', 'SafetyAcknowledgement', 'StepProgress',
  'scopeSopToJob', 'procedureSections', 'useSopDetail', 'completionStore',
  'BuilderClient', 'BuilderStageShell', 'BuilderStageStepper', 'ReviewStation', 'OrientationStrip', 'NavRow',
  'SectionListSidebar', 'BuilderTreeRail', 'PublishStage', 'BlockEditShell', 'EditableDocument',
  'selection-bridge', 'SectionEditor', 'verify-checklist', 'useBuilderAutosave',
  'parsedSopToPerSectionLayoutData', 'verifyBlock', 'stepAckTrace', 'builder-v2',
]
const LITERALS_58_16 = ['admin/sops/builder', "'admin', 'sops', 'builder'", 'admin/sops/[sopId]/versions', "'admin', 'sops', '[sopId]', 'versions'"]

test.describe('retire: deleted components, routes and modules (58-16)', () => {
  test('no src file references any 58-16 token (references, not just files -- CLAUDE.md 2026-08-04)', () => {
    const offenders: string[] = []
    for (const f of walkSrc(path.join(ROOT, 'src'))) {
      const code = stripComments(fs.readFileSync(f, 'utf-8'))
      const rel = path.relative(ROOT, f).split(path.sep).join('/')
      for (const id of IDENTIFIERS_58_16) {
        const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        if (new RegExp(`(^|[^A-Za-z0-9_])${esc}($|[^A-Za-z0-9_])`).test(code)) offenders.push(`${rel}: ${id}`)
      }
      for (const lit of LITERALS_58_16) if (code.includes(lit)) offenders.push(`${rel}: ${lit}`)
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })

  test('the builder directory and the versions directory are gone', () => {
    for (const d of ['src/app/(protected)/admin/sops/builder', 'src/app/(protected)/admin/sops/[sopId]/versions', 'src/components/admin/builder-v2', 'src/components/admin/builder', 'src/components/admin/verify-checklist', 'src/components/sop/walkthrough', 'src/components/sop/tabs', 'src/components/sop/blocks']) {
      expect(fs.existsSync(path.join(ROOT, d)), d).toBe(false)
    }
    expect(fs.existsSync(path.join(ROOT, 'src/actions/sop-section-blocks.ts'))).toBe(false)
    expect(fs.existsSync(path.join(ROOT, 'src/app/api/sops/[sopId]/sections/[sectionId]'))).toBe(false)
  })

  test('submitCompletion takes no client-supplied step data and no ack trace parameter', () => {
    const src = stripComments(read('src/actions/completions.ts'))
    const start = src.indexOf('export async function submitCompletion')
    expect(start).toBeGreaterThan(-1)
    const next = src.indexOf('export async function', start + 10)
    const body = src.slice(start, next === -1 ? undefined : next)
    expect(body).toContain('z.object({ walkId: z.string().uuid() }).strict().safeParse(rawInput)')
    expect(body).not.toMatch(/parsed\.data\.(stepData|contentHash|photoStoragePaths|localId|sopId|sopVersion)/)
    expect(body).not.toMatch(/rawInput\s*[.[]/)
    expect(src).not.toContain('submitWalkCompletion')
    expect(read('src/lib/validators/completions.ts')).not.toContain('SubmitCompletionSchema')
  })

  test('requireSopEditAccess has no junction arm', () => {
    const g = stripComments(read('src/lib/auth/guards.ts'))
    expect(g).not.toContain('junctionId')
    expect(g).not.toContain('sop_section_blocks')
    expect(g).toContain('{ stepId: string }')
  })

  test('no server action or route still writes the block model', () => {
    const offenders: string[] = []
    for (const f of walkSrc(path.join(ROOT, 'src'))) {
      const code = stripComments(fs.readFileSync(f, 'utf-8'))
      if (/from\('sop_section_blocks'\)\s*\.(insert|update|delete|upsert)\(/.test(code)) offenders.push(path.relative(ROOT, f))
    }
    expect(offenders).toEqual([])
  })
})
