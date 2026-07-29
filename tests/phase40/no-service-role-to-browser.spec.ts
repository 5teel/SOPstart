/**
 * Phase 40 gap closure (40-14) -- T-40-14-01/02. Encodes CLAUDE.md
 * [2026-06-15]/[2026-06-26] service-role class: three server actions
 * (uploadNewVersion, createVideoUploadSession, createVideoSopPipelineSession)
 * returned process.env.SUPABASE_SERVICE_ROLE_KEY as the video TUS upload
 * token, handing any admin/safety_manager browser session a key that
 * bypasses RLS entirely. This spec is keyed on the secret ITSELF, not on a
 * list of known-bad function names -- a fourth site anywhere under src/
 * fails immediately, and the file grep does not need updating when new
 * server actions are added.
 *
 * Registration: playwright.config.ts `phase40` project
 *   testDir: '.', testMatch: /tests\/phase40\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase40 | grep no-service-role-to-browser`
 */

import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SRC_DIR = path.join(ROOT, 'src')
const TUS_UPLOAD = path.join(SRC_DIR, 'lib', 'upload', 'tus-upload.ts')
const START_VIDEO_UPLOAD = path.join(SRC_DIR, 'lib', 'upload', 'start-video-sop-upload.ts')

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

test.describe('T-40-14-01/02 -- no service-role key ever reaches the browser', () => {
  test('SUPABASE_SERVICE_ROLE_KEY is referenced by exactly one file under src/: src/lib/supabase/admin.ts', () => {
    const files: string[] = []
    walk(SRC_DIR, files)
    const hits = files
      .filter((f) => read(f).includes('SUPABASE_SERVICE_ROLE_KEY'))
      .map((f) => path.relative(ROOT, f).replace(/\\/g, '/'))
      .sort()

    expect(hits).toEqual(['src/lib/supabase/admin.ts'])
  })

  test('tus-upload.ts takes accessToken from its caller (no hardcoded token) and start-video-sop-upload.ts supplies it from auth.getSession()', () => {
    const tusSrc = read(TUS_UPLOAD)
    expect(tusSrc).toContain('accessToken')
    expect(tusSrc).not.toContain('SUPABASE_SERVICE_ROLE_KEY')

    const startSrc = read(START_VIDEO_UPLOAD)
    expect(startSrc).toContain('auth.getSession()')
    expect(startSrc).toContain('access_token')
    // The session object no longer carries a server-supplied token field.
    expect(startSrc).not.toMatch(/StartVideoSopUploadSession[\s\S]{0,120}token:/)
  })

  test('no file under src/actions/ returns an object literal whose token value is a process.env expression', () => {
    const actionsDir = path.join(SRC_DIR, 'actions')
    const files: string[] = []
    walk(actionsDir, files)
    const violations: string[] = []
    for (const file of files) {
      const src = stripComments(read(file))
      if (/token\s*:\s*process\.env\./.test(src)) {
        violations.push(path.relative(ROOT, file).replace(/\\/g, '/'))
      }
    }
    expect(violations).toEqual([])
  })
})
