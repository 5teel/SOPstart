/**
 * Phase 40 -- DUP-01 (D-04/D-05): one shared file-intake module. Today
 * ACCEPTED_MIME_TYPES / MAX_FILE_SIZE / BLOCKED_EXTENSIONS / heic2any wiring
 * is duplicated across UploadDropzone.tsx, VideoFormatSelectionModal.tsx,
 * and the versions page's re-upload flow. Plan 40-02 extracts
 * `@/lib/upload/file-intake` as the single source of truth; Plan 40-07
 * rewires the three call sites onto it and un-fixmes this spec (delete the
 * `.fixme` on each test below -- the assertion bodies already run for real).
 *
 * `test.fixme` until 40-02/40-07 -- CLAUDE.md 2026-05-25 fixme-stub idiom
 * (listed + skipped, not failing CI, until the later plan activates it).
 *
 * Registration: playwright.config.ts `phase40` project
 *   testDir: '.', testMatch: /tests\/phase40\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase40`
 */

import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SRC_DIR = path.join(ROOT, 'src')

const UPLOAD_DROPZONE = path.join(SRC_DIR, 'components', 'admin', 'UploadDropzone.tsx')
const VIDEO_FORMAT_MODAL = path.join(SRC_DIR, 'components', 'admin', 'VideoFormatSelectionModal.tsx')
const VERSIONS_PAGE = path.join(
  SRC_DIR,
  'app',
  '(protected)',
  'admin',
  'sops',
  '[sopId]',
  'versions',
  'page.tsx',
)
const FILE_INTAKE = path.join(SRC_DIR, 'lib', 'upload', 'file-intake.ts')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8').replace(/\r\n/g, '\n')
}

function stripComments(src: string): string {
  return src
    .split('\n')
    .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*') && !l.trim().startsWith('/*'))
    .join('\n')
}

function walk(dir: string, out: string[]): void {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue
      walk(full, out)
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      out.push(full)
    }
  }
}

test.describe('DUP-01 -- one shared file-intake module', () => {
  test.fixme('exactly one file under src/ declares ACCEPTED_MIME_TYPES (the shared intake module)', () => {
    const files: string[] = []
    walk(SRC_DIR, files)
    const declarers = files.filter((f) => stripComments(read(f)).includes('ACCEPTED_MIME_TYPES ='))
    expect(declarers).toEqual([FILE_INTAKE])
  })

  test.fixme(
    'UploadDropzone, VideoFormatSelectionModal, and versions page import from @/lib/upload/file-intake and declare no local accept-list',
    () => {
      for (const file of [UPLOAD_DROPZONE, VIDEO_FORMAT_MODAL, VERSIONS_PAGE]) {
        const src = stripComments(read(file))
        expect(src).toContain("from '@/lib/upload/file-intake'")
        expect(src).not.toContain('ACCEPTED_MIME_TYPES =')
        expect(src).not.toContain('MAX_FILE_SIZE =')
        expect(src).not.toContain('BLOCKED_EXTENSIONS =')
        expect(src).not.toContain('heic2any')
      }
    },
  )

  test.fixme('zero occurrences of the dropped ".doc," extension anywhere in src/ (D-04)', () => {
    const files: string[] = []
    walk(SRC_DIR, files)
    const hits: string[] = []
    for (const file of files) {
      if (stripComments(read(file)).includes('.doc,')) hits.push(file)
    }
    expect(hits).toEqual([])
  })

  test.fixme("the shared module's accept list contains image/webp, video/mp4, video/quicktime", () => {
    const src = read(FILE_INTAKE)
    expect(src).toContain('image/webp')
    expect(src).toContain('video/mp4')
    expect(src).toContain('video/quicktime')
  })
})
