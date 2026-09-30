/**
 * Phase 43 / Plan 43-01 -- Wave-0 scaffold for D-02, D-04, D-05: the
 * scan-document dead end, the WiringPatchBay unimplemented lens toggle,
 * and the two confirmed dead-state findings. Four fixme tests flip live
 * in plan 43-03; the eslint-disable carve-out pin is LIVE now (it is
 * already true and must stay true).
 *
 * Pattern: tests/phase54/deletion-sweep.spec.ts (read/stripComments/
 * walkTsFiles idiom).
 *
 * Registration: playwright.config.ts `phase43` project
 *   testDir: '.', testMatch: /tests\/phase43\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase43`
 *
 * All file reads happen INSIDE test bodies.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()

function read(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf-8').replace(/\r\n/g, '\n')
}

// Strips full-line comments (//, /*, */, and JSDoc * continuation lines).
function stripComments(src: string): string {
  return src
    .split('\n')
    .map((line) => (/^\s*(\/\/|\/\*|\*\/|\*)/.test(line) ? '' : line))
    .join('\n')
}

function walkTsFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__' || entry.name === '.next') continue
      walkTsFiles(full, out)
    } else if (
      entry.isFile() &&
      /\.(ts|tsx)$/.test(entry.name) &&
      !/\.(test|d)\.tsx?$/.test(entry.name)
    ) {
      out.push(full)
    }
  }
  return out
}

test.describe('Dead controls: scan-document, wiring lens, dead state (D-02/D-04/D-05, activates 43-03)', () => {
  test(
    'UploadDropzone mounts the shipped PhotoScanner and queues scanned pages through validateAndAddFiles (D-04)',
    () => {
      const src = read('src/components/admin/UploadDropzone.tsx')
      expect(src).toContain("import { PhotoScanner } from './PhotoScanner'")
      expect(src).toContain('<PhotoScanner')
      expect(src).toMatch(/onSubmit=\{\(files\)\s*=>\s*\{[\s\S]{0,160}validateAndAddFiles\(files\)/)

      let importers = 0
      for (const file of walkTsFiles(path.join(ROOT, 'src'))) {
        const rel = path.relative(ROOT, file)
        const stripped = stripComments(read(rel))
        if (
          stripped.includes("from './PhotoScanner'") ||
          stripped.includes("from '@/components/admin/PhotoScanner'")
        ) {
          importers++
        }
      }
      expect(importers).toBe(1)
    }
  )

  test.fixme('no comment-stripped src/ file ships a coming-soon placeholder (D-04, D-05)', () => {
    const offenders: string[] = []
    for (const file of walkTsFiles(path.join(ROOT, 'src'))) {
      const rel = path.relative(ROOT, file)
      const stripped = stripComments(read(rel))
      if (/coming soon/i.test(stripped)) offenders.push(rel)
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })

  test.fixme('WiringPatchBay renders the Wiring view only — no lens toggle (D-05)', () => {
    const stripped = stripComments(read('src/components/admin/wiring/WiringPatchBay.tsx'))
    for (const forbidden of ['LENS_OPTIONS', 'LensView', 'setLens', "'matrix'", "'illuminate'", '<ViewToggle']) {
      expect(stripped, `must not contain ${forbidden}`).not.toContain(forbidden)
    }
  })

  test.fixme('dead state removed from the creation and version surfaces (D-02)', () => {
    const wizardSrc = read('src/app/(protected)/admin/sops/new/blank/WizardClient.tsx')
    expect(wizardSrc).not.toContain('sopCategoryOptions')

    const blankPageSrc = read('src/app/(protected)/admin/sops/new/blank/page.tsx')
    expect(blankPageSrc).not.toContain('listBlockCategories')
    expect(blankPageSrc).toContain('<WizardClient departments={departments} />')

    const versionsSrc = read('src/app/(protected)/admin/sops/[sopId]/versions/page.tsx')
    expect(versionsSrc).not.toContain('selectedForCompare')
    expect(versionsSrc).not.toContain('setSelectedForCompare')
  })

  test('no eslint-disable carve-out for no-unused-vars anywhere in src/ (D-02)', () => {
    const offenders: string[] = []
    for (const file of walkTsFiles(path.join(ROOT, 'src'))) {
      const rel = path.relative(ROOT, file)
      // RAW scan (not comment-stripped) -- the eslint-disable directive IS a
      // comment; stripping comments would hide the exact thing we're checking.
      const raw = read(rel)
      if (/eslint-disable[^\n]*no-unused-vars/.test(raw)) offenders.push(rel)
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })
})
