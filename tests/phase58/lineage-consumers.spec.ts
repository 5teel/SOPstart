/**
 * Phase 58 -- SOP-04 (D-13, D-18): every worker list shows one row per SOP, the
 * latest published version, computed by lineage-current and never by the
 * superseded pointer. Registration: playwright.config.ts `phase58` project.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { latestPublished } from '../../src/lib/sop/lineage-current'

const FILES = ['src/hooks/useLibrary.ts', 'src/actions/observations.ts']

const strip = (s: string) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, ''))
    .join('\n')

test.describe('SOP-04 worker lists are one row per SOP', () => {
  for (const f of FILES) {
    test(`${f} filters published rows through latestPublished`, () => {
      const src = strip(fs.readFileSync(path.join(process.cwd(), f), 'utf8'))
      expect(src).toContain("from '@/lib/sop/lineage-current'")
      expect(src).toMatch(/latestPublished\(/)
      expect(src).not.toContain('superseded_by')
      expect(src).toMatch(/select\('[^']*parent_sop_id[^']*'\)/) // the lineage columns are read
    })
  }

  test('a lineage with v3 and v4 published yields only v4', () => {
    const rows = [
      { id: 'a', version: 3, parent_sop_id: 'root', status: 'published' },
      { id: 'b', version: 4, parent_sop_id: 'root', status: 'published' },
      { id: 'c', version: 5, parent_sop_id: 'root', status: 'draft' },
      { id: 'x', version: 1, parent_sop_id: null, status: 'published' },
    ]
    expect(latestPublished(rows).map((r) => r.id).sort()).toEqual(['b', 'x'])
  })
})
