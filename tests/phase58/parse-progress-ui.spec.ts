/**
 * Phase 58 (58-13) -- WRK-03 / WRK-04 (D-02, D-17, D-19): the editor's parsing
 * view, the AI check banner and the lazy editor root. Source-contract guards that
 * pin WIRING (the handler reaches the action, the hook is the one engine), not just
 * the presence of a string (CLAUDE.md 2026-06-05).
 * Registration: playwright.config.ts `phase58` project.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n')
/** Comments out of the way, so a guard on a literal is not tripped by prose about it. */
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const ADMIN = 'src/components/focus/admin'

test.describe('parsing view (WRK-03, D-19)', () => {
  const progress = read(`${ADMIN}/ParseProgress.tsx`)
  const src = code(progress)

  test('reads the job through the one shared engine and words it from parseProgress()', () => {
    expect(src).toContain('parseProgress(')
    expect(src).toContain('useParseJob(')
    expect(src).toContain('PLAIN_STAGES')
  })

  test('never navigates: no address assignment, no router call, the job finishing only calls onDone', () => {
    expect(src).not.toContain('window.location')
    expect(src).not.toMatch(/router\.|useRouter/)
    expect(src).toContain('onCompleted: onDone')
  })

  test('carries the UI-SPEC copy for running, queued, failed, poll error and done', () => {
    expect(progress).toContain("You can go Back. We keep reading and it&apos;ll be waiting for you.")
    expect(progress).toContain('We couldn&apos;t read this document.')
    expect(progress).toContain('Can&apos;t check progress right now. Trying again.')
    expect(progress).toContain('Done reading.')
    expect(progress).toContain('aria-live="polite"')
    // "Waiting its turn…" comes from parseProgress for a queued job.
    expect(read('src/lib/sop/parse-progress.ts')).toContain('Waiting its turn…')
  })

  test('Try again re-queues through the existing action and Back is the frame Back; a prompt draft is not re-read', () => {
    expect(src).toContain('requeueParse(')
    expect(src).toContain('useFocusGoBack()')
    expect(src).toContain('onClick={goBack}')
    expect(src).toContain("inputType !== 'ai_prompt'")
    expect(src).toMatch(/canRetry && \(/)
    expect(read('src/hooks/useParseJob.ts')).toContain('reparseSop(sopId)')
  })

  test('the indeterminate bar stands still under reduced motion and uses tokens only', () => {
    expect(src).toContain('motion-reduce:animate-none')
    expect(src).toContain('bg-accent-step')
    expect(src).not.toMatch(/\[[0-9]+px\]|text-(red|amber|green|blue|violet)-[0-9]/)
  })
})

test.describe('editor root swaps in place (D-19)', () => {
  const root = code(read(`${ADMIN}/FocusEditor.tsx`))

  test('a SOP being read shows the progress card over the skeleton; done re-reads and renders the editor, no route change', () => {
    expect(root).toContain('<EditorSkeleton>')
    expect(root).toContain('<ParseProgress')
    expect(root).toContain('await invalidate()')
    expect(root).toContain('setParsed(true)')
    expect(root).toContain('const parsing = wasParsing && !parsed')
    expect(root).not.toMatch(/router\.|useRouter|window\.location/)
    for (const part of ['<EditRail', '<EditDocument', '<PublishBar', '<ThisSopBlock', '<AiCheckBanner']) expect(root, part).toContain(part)
  })

  test('the AI banner sits in the document banner slot and only for a draft', () => {
    expect(root).toContain('bannerSlot=')
    expect(root).toContain('{isDraft && <AiCheckBanner')
  })

  test('findings reach the step cards and the rail, and the done line counts the steps', () => {
    expect(root).toContain('findings={openFindings}')
    expect(root).toContain('flaggedStepIds={flagged}')
    expect(root).toContain('check each one.')
  })

  test('the save pill is portalled into the top bar slot and Back flushes the autosave', () => {
    expect(root).toContain('createPortal(')
    expect(root).toContain('bridge.saveSlot')
    expect(root).toContain('setBeforeBack?.(flush)')
    for (const copy of ["'Saving…'", "'Saved'", "'Not saved — retrying'"]) expect(root, copy).toContain(copy)
  })

  test('publishing re-reads the SOP and tells the document (the ledger line), without a redirect', () => {
    expect(root).toContain('setPublishedNote(true)')
    expect(root).toContain('void invalidate()')
  })
})

test.describe('AI check banner (WRK-04, D-02, D-17)', () => {
  const raw = read(`${ADMIN}/AiCheckBanner.tsx`)
  const banner = code(raw)

  test('is a plain section: no violet frame, no sparkle, never an arbitrary-value class (design base 2026-10-10)', () => {
    expect(banner).not.toContain('tint-ai')
    expect(banner).not.toContain('Sparkles')
    expect(banner).not.toContain('bg-[--')
    expect(banner).not.toContain('border-[--')
  })

  test('Clear goes through clearFinding (the ledger row) and re-reads; Go to it scrolls and focuses the step', () => {
    expect(banner).toContain('clearFinding({ findingId })')
    expect(banner).toContain('await api.refresh()')
    expect(banner).toContain('scrollToStep(f.step_id as string)')
    expect(banner).toContain('Clear finding')
    expect(banner).toContain('Go to it')
    expect(banner).toContain('Cleared · logged in the decision ledger')
  })

  test('has the five states with the UI-SPEC copy', () => {
    for (const copy of [
      'Run the AI check',
      'It reads every step and flags anything unclear or unsafe.',
      'AI is checking this SOP… about 20 seconds.',
      'to look at',
      'AI check: nothing left to look at.',
      'Run again',
      "The AI check didn&apos;t run.",
      'Try again',
    ]) {
      expect(raw, copy).toContain(copy)
    }
  })

  test('a SOP with no source says the check is wording and clarity only', () => {
    expect(banner).toContain('AI check — wording and clarity only; there is no source document to compare against.')
    expect(banner).toContain('!api.hasSource')
  })

  test('only admins and safety managers see Run and Clear; the finding label is walk-independent', () => {
    expect(banner.match(/canRun &&/g)?.length ?? 0).toBeGreaterThanOrEqual(3)
    expect(banner).toContain("'Whole SOP'")
    expect(read(`${ADMIN}/FocusEditor.tsx`)).toContain('railNumber(e)')
  })

  test('ticking a step never clears a finding: the tick path does not touch the findings', () => {
    expect(code(read(`${ADMIN}/StepCard.tsx`))).not.toMatch(/clearFinding|useFindings|sop_ai_findings/)
  })
})

test.describe('findings hook', () => {
  const hook = code(read('src/hooks/useFindings.ts'))

  test('reads GET, runs POST, maps the caps to plain lines and re-reads the publish gate', () => {
    expect(hook).toContain('/api/sops/${sopId}/ai-reviewer')
    expect(hook).toContain("method: 'POST'")
    expect(hook).toContain('per_day_cap')
    expect(hook).toContain('per_org_cap')
    expect(hook).toContain("'focus-gate'")
  })
})

test.describe('legacy parse status card', () => {
  test('still calls the shared hook and owns no timers of its own', () => {
    const card = code(read('src/components/admin/ParseJobStatus.tsx'))
    expect(card.match(/useParseJob\(/g)?.length ?? 0).toBe(1)
    expect(card).not.toContain('REALTIME_GRACE_MS')
  })
})
