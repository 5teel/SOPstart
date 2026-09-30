/**
 * Phase 43 / Plan 43-01 -- Wave-0 scaffold for D-03 (/admin/blocks/new gets
 * a real, minimal create form, T-43-01). Every test here is `test.fixme`
 * and flips live in plan 43-02.
 *
 * Pattern: tests/phase54/deletion-sweep.spec.ts (read/stripComments/
 * walkTsFiles idiom) + tests/phase53/m-code-page.spec.ts (fixme scaffold
 * style, static @/ imports only -- CLAUDE.md 2026-06-24: a dynamic
 * `await import('@/...')` in a Playwright test fails outside a unit
 * project; none of the assertions below import the not-yet-existing
 * modules, they only grep source text).
 *
 * Registration: playwright.config.ts `phase43` project
 *   testDir: '.', testMatch: /tests\/phase43\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase43`
 *
 * All file reads happen INSIDE test bodies, never at describe/module scope
 * -- a describe-level read of a file 43-02 hasn't created yet would throw
 * at collection time and take down the whole project.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()

function read(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf-8').replace(/\r\n/g, '\n')
}

function exists(relPath: string): boolean {
  return fs.existsSync(path.join(ROOT, relPath))
}

// Strips full-line comments (//, /*, */, and JSDoc * continuation lines).
function stripComments(src: string): string {
  return src
    .split('\n')
    .map((line) => (/^\s*(\/\/|\/\*|\*\/|\*)/.test(line) ? '' : line))
    .join('\n')
}

/** Slice of `src` from the start of `function fromName(` to the start of
 * `function toName(` (or end of file if toName isn't found). */
function sliceBetweenFunctions(src: string, fromName: string, toName: string): string {
  const fromIdx = src.indexOf(fromName)
  if (fromIdx === -1) return ''
  const toIdx = src.indexOf(toName, fromIdx + fromName.length)
  return toIdx === -1 ? src.slice(fromIdx) : src.slice(fromIdx, toIdx)
}

test.describe('New block creation form (D-03, activates 43-02)', () => {
  test.fixme(
    'createBlock takes no wire-level trust override; the parser writes through createBlockAsService (D-03, T-43-01)',
    () => {
      const actionsSrc = read('src/actions/blocks.ts')
      expect(actionsSrc).not.toContain('serviceRole')
      expect(actionsSrc).not.toContain('createAdminClient')

      const stripped = stripComments(actionsSrc)
      const createSlice = sliceBetweenFunctions(
        stripped,
        'export async function createBlock(',
        'export async function updateBlock('
      )
      expect(createSlice).not.toBe('')
      const requireAdminIdx = createSlice.indexOf('await requireAdmin()')
      const insertIdx = createSlice.indexOf('insertBlockWithVersion(')
      expect(requireAdminIdx).toBeGreaterThan(-1)
      expect(insertIdx).toBeGreaterThan(-1)
      expect(requireAdminIdx).toBeLessThan(insertIdx)

      const coreSrc = read('src/lib/blocks/create-block-core.ts')
      expect(/^\s*['"]use server['"]/.test(coreSrc)).toBe(false)
      expect(coreSrc).toContain('export async function createBlockAsService')
      expect(coreSrc).toContain('export async function insertBlockWithVersion')

      const parserSrc = read('src/lib/parsers/parsed-sop-to-layout-data.ts')
      expect(parserSrc).toContain('createBlockAsService(')
      expect(parserSrc).not.toContain("from '@/actions/blocks'")
    }
  )

  test.fixme('/admin/blocks/new is a static route guarded like its siblings (D-03)', () => {
    const relPath = 'src/app/(protected)/admin/blocks/new/page.tsx'
    expect(exists(relPath)).toBe(true)
    const src = read(relPath)
    expect(src).toContain("redirect('/login')")
    expect(src).toContain("['admin', 'safety_manager'].includes(role)")
    expect(src).toContain("redirect('/dashboard')")
    expect(src).toContain('listBlockCategories()')
    expect(src).toContain('<NewBlockForm')

    const guardIdx = src.indexOf("redirect('/dashboard')")
    const formIdx = src.indexOf('<NewBlockForm')
    expect(guardIdx).toBeGreaterThan(-1)
    expect(formIdx).toBeGreaterThan(-1)
    expect(guardIdx).toBeLessThan(formIdx)
  })

  test.fixme(
    'NewBlockForm submits only through createBlock() and opens the created item (D-03, T-43-01)',
    () => {
      const relPath = 'src/app/(protected)/admin/blocks/new/NewBlockForm.tsx'
      expect(exists(relPath)).toBe(true)
      const src = read(relPath)
      expect(/^'use client'/.test(src)).toBe(true)
      expect(src).toContain("import { createBlock } from '@/actions/blocks'")
      expect(src).toContain('createBlock({')
      expect(src).toContain('seedBlockContent(')
      expect(src).toMatch(/router\.push\(`\/admin\/blocks\/\$\{res\.block\.id\}`\)/)

      const fromActionsMatches = src.match(/from '@\/actions\//g) ?? []
      expect(fromActionsMatches.length).toBe(1)
      expect(src).not.toMatch(/organisation/i)
    }
  )

  test.fixme('the Content Library filter and the create form share one kind list (D-03)', () => {
    const listSrc = read('src/app/(protected)/admin/blocks/page.tsx')
    expect(listSrc).toContain("from '@/lib/blocks/block-kinds'")
    expect(listSrc).toContain('BLOCK_KINDS')
    expect(listSrc).toContain('href="/admin/blocks/new"')

    const formSrc = read('src/app/(protected)/admin/blocks/new/NewBlockForm.tsx')
    expect(formSrc).toContain('BLOCK_KINDS')
  })

  test.fixme('journeys maps /admin/blocks/new (D-03)', () => {
    const src = read('src/lib/journeys/journeys.ts')
    expect(src).toContain("route: '/admin/blocks/new'")
  })
})
