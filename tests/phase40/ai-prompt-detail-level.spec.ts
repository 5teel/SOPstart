import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { aiPromptSchema } from '@/lib/validators/sop'

/**
 * Regression guard for a Generate-draft button that did nothing.
 *
 * The detail-level control was a set of registered radios. A radio's value is
 * a STRING, and react-hook-form's `valueAsNumber` only applies to
 * `<input type="number">`, so the form held "2" where aiPromptSchema wanted 2.
 * zod rejected it, handleSubmit bailed before onSubmit, and because
 * detailLevel has no error UI of its own, absolutely nothing appeared on
 * screen — the button read as broken.
 *
 * Two things are pinned here: the schema really is this strict (so the failure
 * mode is real, not theoretical), and the component no longer routes
 * detailLevel through a string-valued input, and can no longer fail silently.
 */

const ROOT = process.cwd()
const PROMPT_CLIENT = path.join(
  ROOT, 'src', 'app', '(protected)', 'admin', 'sops', 'new', 'ai', 'PromptClient.tsx'
)

function read(): string {
  return fs.readFileSync(PROMPT_CLIENT, 'utf-8').replace(/\r\n/g, '\n')
}

const VALID_PROMPT = 'Replace the guillotine blade on the number two forming line safely'

test('aiPromptSchema rejects a string detailLevel — the failure the radios caused', () => {
  const asString = aiPromptSchema.safeParse({ promptText: VALID_PROMPT, detailLevel: '2' })
  expect(asString.success, 'a string detailLevel must fail — this is why the button died').toBe(false)

  const asNaN = aiPromptSchema.safeParse({ promptText: VALID_PROMPT, detailLevel: Number('') })
  expect(asNaN.success).toBe(false)

  const asNumber = aiPromptSchema.safeParse({ promptText: VALID_PROMPT, detailLevel: 2 })
  expect(asNumber.success, 'a real number must pass').toBe(true)

  // Every level the UI offers must survive the schema.
  for (const level of [1, 2, 3, 4, 5]) {
    expect(
      aiPromptSchema.safeParse({ promptText: VALID_PROMPT, detailLevel: level }).success,
      `level ${level} is offered by the UI so it must validate`
    ).toBe(true)
  }
})

test('detailLevel is set as a number, never registered as a string-valued input', () => {
  const src = read()
  expect(
    src,
    'detailLevel must not go through register() — a radio/text value is a string'
  ).not.toMatch(/register\(\s*'detailLevel'/)
  expect(src).toContain("setValue('detailLevel', level")
})

test('a blocked submit can never be silent', () => {
  const src = read()
  // handleSubmit's SECOND argument is the invalid handler. Without it, any
  // field failing validation leaves the user staring at an inert button.
  expect(
    src,
    'handleSubmit needs an onInvalid handler so a rejected submit says so'
  ).toMatch(/handleSubmit\(\s*onSubmit\s*,/)
  expect(src).toContain('setServerError(')
})
