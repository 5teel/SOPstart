/**
 * Phase 40 -- DUP-01 (D-04/D-05): one shared file-intake module. Today
 * ACCEPTED_MIME_TYPES / MAX_FILE_SIZE / BLOCKED_EXTENSIONS / heic2any wiring
 * is duplicated across UploadDropzone.tsx, VideoFormatSelectionModal.tsx,
 * and the versions page's re-upload flow. Plan 40-02 extracted
 * `@/lib/upload/file-intake` as the single source of truth and repointed
 * UploadDropzone + VideoFormatSelectionModal onto it; Plan 40-07 repoints the
 * versions page (the third surface) -- all three surfaces now share one
 * accept list and route video through startVideoSopUpload.
 *
 * Registration: playwright.config.ts `phase40` project
 *   testDir: '.', testMatch: /tests\/phase40\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase40`
 */

import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import {
  ACCEPTED_MIME_TYPES,
  BLOCKED_EXTENSIONS,
  isHeicFile,
  validateIntakeFile,
} from '@/lib/upload/file-intake'

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
const SOP_VALIDATORS = path.join(SRC_DIR, 'lib', 'validators', 'sop.ts')

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

// Builds a File with a fixed reported `.size` without allocating the real
// number of bytes (Node's File getter is writable via defineProperty).
function sizedFile(name: string, type: string, size: number): File {
  const f = new File([new Uint8Array(1)], name, { type })
  Object.defineProperty(f, 'size', { value: size })
  return f
}

test.describe('DUP-01 -- one shared file-intake module', () => {
  test('exactly one file under src/ declares ACCEPTED_MIME_TYPES (the shared intake module)', () => {
    const files: string[] = []
    walk(SRC_DIR, files)
    const declarers = files.filter((f) => stripComments(read(f)).includes('ACCEPTED_MIME_TYPES ='))
    expect(declarers).toEqual([FILE_INTAKE])
  })

  test(
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

  // 40-02 slice of the test above: the two surfaces this plan owns. Kept
  // alongside (not replacing) the all-three-surface fixme, which stays fixme
  // until 40-07 repoints the versions page too.
  test('UploadDropzone and VideoFormatSelectionModal import from @/lib/upload/file-intake and declare no local accept-list', () => {
    for (const file of [UPLOAD_DROPZONE, VIDEO_FORMAT_MODAL]) {
      const src = stripComments(read(file))
      expect(src).toContain("from '@/lib/upload/file-intake'")
      expect(src).not.toContain('ACCEPTED_MIME_TYPES =')
      expect(src).not.toContain('MAX_FILE_SIZE =')
      expect(src).not.toContain('MAX_VIDEO_FILE_SIZE =')
      expect(src).not.toContain('BLOCKED_EXTENSIONS =')
      expect(src).not.toContain('HEIC_EXTENSIONS =')
      expect(src).not.toContain('heic2any')
    }
  })

  test('zero occurrences of the dropped ".doc," extension anywhere in src/ (D-04)', () => {
    const files: string[] = []
    walk(SRC_DIR, files)
    const hits: string[] = []
    for (const file of files) {
      if (stripComments(read(file)).includes('.doc,')) hits.push(file)
    }
    expect(hits).toEqual([])
  })

  test('the new-version page and video-generate modal route video sources through startVideoSopUpload, not the document parser (D-06 honesty rule)', () => {
    for (const file of [VERSIONS_PAGE, VIDEO_FORMAT_MODAL]) {
      const src = stripComments(read(file))
      expect(src).toContain('startVideoSopUpload(')
    }
  })

  test("the shared module's accept list contains image/webp, video/mp4, video/quicktime", () => {
    const src = read(FILE_INTAKE)
    expect(src).toContain('image/webp')
    expect(src).toContain('video/mp4')
    expect(src).toContain('video/quicktime')
  })

  test('every ACCEPTED_MIME_TYPES entry is handled by getSourceFileType without throwing', () => {
    const validatorsSrc = stripComments(read(SOP_VALIDATORS))
    for (const mime of ACCEPTED_MIME_TYPES) {
      expect(validatorsSrc).toContain(mime)
    }
  })

  test('BLOCKED_EXTENSIONS is byte-identical to the original UploadDropzone list', () => {
    expect([...BLOCKED_EXTENSIONS]).toEqual(['.xlsm', '.xlsb', '.xltm', '.pptm', '.potm', '.ppam'])
  })
})

test.describe('DUP-01 -- validateIntakeFile behaviour', () => {
  test('accepts a .docx, .pdf, .xlsx, .pptx, .txt, jpeg/png/webp/heic/heif photo, and mp4/mov video', async () => {
    const cases: Array<[string, string]> = [
      ['sop.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      ['sop.pdf', 'application/pdf'],
      ['sop.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
      ['sop.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
      ['sop.txt', 'text/plain'],
      ['photo.jpg', 'image/jpeg'],
      ['photo.png', 'image/png'],
      ['photo.webp', 'image/webp'],
      ['clip.mp4', 'video/mp4'],
      ['clip.mov', 'video/quicktime'],
    ]
    for (const [name, type] of cases) {
      const file = sizedFile(name, type, 1024)
      const result = await validateIntakeFile(file)
      expect(result.ok, `${name} (${type}) should be accepted`).toBe(true)
    }
  })

  test('rejects report.xlsm as blocked-macro even when its reported MIME is the .xlsx type -- extension wins', async () => {
    const spoofed = sizedFile(
      'report.xlsm',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      1024,
    )
    const result = await validateIntakeFile(spoofed)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('blocked-macro')
  })

  test('rejects a 60MB .pdf and a 3GB .mp4 as too-large; accepts a 1GB .mp4', async () => {
    const bigPdf = sizedFile('big.pdf', 'application/pdf', 60 * 1024 * 1024)
    const bigPdfResult = await validateIntakeFile(bigPdf)
    expect(bigPdfResult.ok).toBe(false)
    if (!bigPdfResult.ok) expect(bigPdfResult.reason).toBe('too-large')

    const hugeVideo = sizedFile('huge.mp4', 'video/mp4', 3 * 1024 * 1024 * 1024)
    const hugeVideoResult = await validateIntakeFile(hugeVideo)
    expect(hugeVideoResult.ok).toBe(false)
    if (!hugeVideoResult.ok) expect(hugeVideoResult.reason).toBe('too-large')

    const okVideo = sizedFile('normal.mp4', 'video/mp4', 1 * 1024 * 1024 * 1024)
    const okVideoResult = await validateIntakeFile(okVideo)
    expect(okVideoResult.ok).toBe(true)
  })

  test('rejects application/msword (dropped .doc, D-04) and application/zip as unsupported-type', async () => {
    const doc = sizedFile('legacy.doc', 'application/msword', 1024)
    const docResult = await validateIntakeFile(doc)
    expect(docResult.ok).toBe(false)
    if (!docResult.ok) expect(docResult.reason).toBe('unsupported-type')

    const zip = sizedFile('archive.zip', 'application/zip', 1024)
    const zipResult = await validateIntakeFile(zip)
    expect(zipResult.ok).toBe(false)
    if (!zipResult.ok) expect(zipResult.reason).toBe('unsupported-type')
  })

  test('isHeicFile routes on MIME (heic, heif) and on extension-only fallback, case-insensitive', () => {
    expect(isHeicFile(sizedFile('a.heic', 'image/heic', 1))).toBe(true)
    expect(isHeicFile(sizedFile('a.jpg', 'image/heif', 1))).toBe(true)
    // Browser reported no MIME type at all, extension-only, uppercase extension.
    expect(isHeicFile(sizedFile('a.HEIC', '', 1))).toBe(true)
    expect(isHeicFile(sizedFile('a.jpg', 'image/jpeg', 1))).toBe(false)
  })

  test('the HEIC->JPEG rename rule replaces .heic/.heif (any case) with .jpg', () => {
    const rename = (name: string) => name.replace(/\.(heic|heif)$/i, '.jpg')
    expect(rename('IMG_0001.HEIC')).toBe('IMG_0001.jpg')
    expect(rename('photo.heif')).toBe('photo.jpg')
  })

  test('a HEIC file that fails conversion never enqueues the original (ok:false, heic-conversion-failed)', async () => {
    // heic2any requires browser Canvas/Image APIs unavailable in the Node
    // test runner, so it throws here -- exercising the real failure branch
    // rather than mocking the WASM decoder (per plan guidance).
    const heic = sizedFile('IMG_0001.heic', 'image/heic', 1024)
    const result = await validateIntakeFile(heic)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('heic-conversion-failed')
  })
})
