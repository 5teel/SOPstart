/**
 * Phase 58 / 58-17 -- FOC-02 (D-03, optional wave): annotation on step photos.
 *
 * Source-contract, comment-stripped (CLAUDE.md 2026-09-28). Pins the three promises:
 * Konva is reachable only through StepCard's nested lazy import, the save action is
 * guarded / draft-only / prefix-rebuilt / org-filtered, and removing a marked photo asks
 * first. The bundle itself is proved by `npm run build` (the konva marker group on both
 * gated routes) and the live save by the deployed eval.
 *
 * Registration: playwright.config.ts `phase58` project.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
const read = (rel: string) => strip(fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n'))

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`
    if (e.isDirectory()) walk(rel, out)
    else if (/\.tsx?$/.test(e.name)) out.push(rel)
  }
  return out
}

const ANNOTATE = 'src/components/focus/admin/annotate'
const card = read('src/components/focus/admin/StepCard.tsx')
const actions = read('src/actions/focus-steps.ts')

/** Source of one exported function: its declaration to the next top-level export (or end). */
function body(src: string, name: string): string {
  const start = src.indexOf(`export async function ${name}(`)
  expect(start, `${name} exists`).toBeGreaterThan(-1)
  const next = src.indexOf('\nexport ', start + 1)
  return src.slice(start, next === -1 ? undefined : next)
}

test.describe('annotation (58-17, D-03)', () => {
  test('annotate/ is imported only by StepCard, through dynamic() with ssr: false', () => {
    const importers = walk('src').filter((f) => !f.startsWith(`${ANNOTATE}/`) && /annotate\/(AnnotationEditor|annotation-tools)/.test(read(f)))
    expect(importers).toEqual(['src/components/focus/admin/StepCard.tsx'])
    expect(card).toMatch(/dynamic\(\(\) => import\('\.\/annotate\/AnnotationEditor'\), \{ ssr: false \}\)/)
    expect(card).not.toMatch(/^import .* from '\.\/annotate\//m)
  })

  test('react-konva and konva are imported nowhere but annotate/ and the site editor', () => {
    const leaks = walk('src').filter(
      (f) =>
        !f.startsWith(`${ANNOTATE}/`) &&
        !f.startsWith('src/components/admin/site/') &&
        /from '(react-konva|konva)'/.test(read(f))
    )
    expect(leaks).toEqual([])
    expect(read(`${ANNOTATE}/AnnotationEditor.tsx`)).toContain("from 'react-konva'")
  })

  test('the tool is a full-screen dark overlay that registers for Esc and Save bakes then saves', () => {
    const ed = read(`${ANNOTATE}/AnnotationEditor.tsx`)
    expect(ed).toContain('fixed inset-0 z-50')
    expect(ed).toContain('bg-steel-900')
    expect(ed).toContain('useRegisterOverlay(true, props.onClose)')
    expect(ed.indexOf('stage.toBlob(')).toBeGreaterThan(-1)
    expect(ed.indexOf('getStepImageUploadUrl(')).toBeGreaterThan(ed.indexOf('stage.toBlob('))
    expect(ed.indexOf('saveAnnotatedStepImage(')).toBeGreaterThan(ed.indexOf('getStepImageUploadUrl('))
    // the photo is kept out of the scene and Close never saves
    expect(ed).toMatch(/onClick=\{onClose\}/)
  })

  test('the tools file is pure and carries no hex colour', () => {
    const tools = read(`${ANNOTATE}/annotation-tools.ts`)
    expect(tools).not.toMatch(/from 'react|from 'konva|from 'react-konva/)
    expect(tools).not.toMatch(/#[0-9a-fA-F]{3,6}\b/)
    expect(tools).toContain('--brand-yellow')
    expect(read('src/styles/blueprint-theme.css')).toMatch(/--brand-yellow:\s/)
  })

  test('saveAnnotatedStepImage: guarded, draft only, prefix rebuilt, scene capped, org-filtered writes', () => {
    const b = body(actions, 'saveAnnotatedStepImage')
    expect(b).toContain('requireSopEditAccess({ stepId })')
    expect(b).toContain('editableSop(ctx.organisationId, ctx.sopId)')
    expect(b.indexOf('requireSopEditAccess(')).toBeLessThan(b.indexOf('createAdminClient()'))
    // the baked path is the exact prefix rebuilt from the session org + resolved SOP + step
    expect(b).toContain('`${ctx.organisationId}/${ctx.sopId}/steps/${stepId}`')
    expect(b).toContain('bakedPath.startsWith(`${dir}/`)')
    expect(b).toContain('IMAGE_FILE.test(file)')
    // the original must already be an image of THIS sop, and on this step
    expect(b).toContain(".eq('sop_id', ctx.sopId).eq('storage_path', originalPath)")
    expect(b).toContain('image_paths.includes(current)')
    // every annotation write carries the session org, never the fetched row's
    for (const m of b.matchAll(/\.from\('sop_image_annotations'\)/g)) {
      const chain = b.slice(m.index!).split(/\n\s*\n|\n\s*if \(/)[0]
      expect(chain).toContain("organisation_id")
      expect(chain).toMatch(/\.eq\('organisation_id', ctx\.organisationId\)|organisation_id: ctx\.organisationId/)
    }
    // the swap: a changed photo goes through the step's image_paths, where the tick trigger sees it
    expect(b).toMatch(/image_paths: image_paths\.map\(\(p\) => \(p === current \? bakedPath : p\)\)/)
  })

  test('the scene is validated with an element-count and size cap and takes no trust field', () => {
    expect(actions).toMatch(/\.max\(200\)/)
    expect(actions).toContain('SCENE_MAX_BYTES')
    expect(body(actions, 'saveAnnotatedStepImage')).toContain('scene: sceneSchema')
    expect(actions).toMatch(/discriminatedUnion\('type'/)
  })

  test('removing a marked photo asks first; a plain photo still goes at once', () => {
    expect(card).toContain('Remove this photo?')
    expect(card).toContain('Its marks are lost too.')
    expect(card).toContain('Remove photo')
    expect(card).toContain('Keep it')
    const ask = card.slice(card.indexOf('async function askRemove('), card.indexOf('async function openAnnotate('))
    expect(ask).toContain('getStepAnnotation(')
    expect(ask).toContain('setConfirmRemove(path)')
    expect(ask.indexOf('setConfirmRemove(path)')).toBeLessThan(ask.lastIndexOf('removePhoto(path)'))
    // the X goes through the ask, never straight to the delete
    expect(card).toContain('onClick={() => void askRemove(img.path)}')
    // removeStepImage takes the marks (and an editor-uploaded original) with the baked photo
    const rm = body(actions, 'removeStepImage')
    expect(rm).toContain(".from('sop_image_annotations')")
    expect(rm).toContain("baked_storage_path', storagePath")
  })

  test('annotation is un-dropped: no entry left in the dropped list, no LIVE_FEATURES name', () => {
    expect(fs.readFileSync(path.join(ROOT, 'scripts/dropped-features.json'), 'utf8')).not.toContain('"annotation"')
    expect(fs.readFileSync(path.join(ROOT, 'tests/phase55/deletion-sweep.spec.ts'), 'utf8')).not.toContain("'annotation'")
  })
})
