/**
 * SOP title naming (server-only).
 *
 * Conventions live in ./prompts/sop-title-conventions.md — the single agent
 * instruction file for naming. Two consumers:
 *   1. sop-parser.ts injects TITLE_CONVENTIONS into the parse system prompt so
 *      the main parse names the SOP correctly in the first place.
 *   2. ensureSopTitle() is the guard: when a parse still returns a missing or
 *      placeholder title (seen on GLM 5.2's first prod run), it makes one
 *      dedicated LLM naming call, falling back to a cleaned filename.
 */
import fs from 'node:fs'
import path from 'node:path'
import { llmText } from '@/lib/ai/llm'

function loadConventions(): string {
  try {
    return fs.readFileSync(
      path.join(process.cwd(), 'src/lib/parsers/prompts/sop-title-conventions.md'),
      'utf8',
    )
  } catch (err) {
    // Fail open — a missing conventions file must never break parsing.
    console.warn('[sop-title] conventions file missing, titles will use model defaults', err)
    return ''
  }
}

export const TITLE_CONVENTIONS = loadConventions()

const PLACEHOLDER_TITLES = /^(untitled( sop)?|new sop|sop|standard operating procedure|safety procedure|work instruction|document)$/i

/** True when a parse produced no usable title and the fallback should run. */
export function isPlaceholderTitle(title: string | null | undefined): boolean {
  const t = (title ?? '').trim()
  return t.length < 4 || PLACEHOLDER_TITLES.test(t)
}

/** Last-resort title from the source filename: strip extension/codes/noise. */
export function titleFromFileName(fileName: string | null | undefined): string | null {
  if (!fileName) return null
  const cleaned = fileName
    .replace(/\.[a-z0-9]+$/i, '') // extension
    .replace(/^[A-Z]{2,}(-[A-Z0-9]+)+\s*/i, '') // leading doc codes (EN-FOR-03-001)
    .replace(/[_-]+/g, ' ')
    .replace(/\b(final|draft|copy|v\d+|\d{4}-\d{2}-\d{2})\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
  return cleaned.length >= 4 ? cleaned.slice(0, 80) : null
}

/**
 * Guarantee a convention-compliant title on a parsed SOP.
 * Returns the existing title untouched when it's already usable.
 */
export async function ensureSopTitle(opts: {
  title: string | null | undefined
  extractedText: string
  fileName?: string | null
  /** Model for the naming call — pass the org-resolved parse model. */
  model: string
}): Promise<string> {
  const existing = (opts.title ?? '').trim()
  if (!isPlaceholderTitle(existing)) return existing

  try {
    const generated = await llmText({
      model: opts.model,
      maxTokens: 60,
      system:
        'You name Standard Operating Procedures. Reply with ONLY the title — no quotes, no preamble, no trailing punctuation.\n\n' +
        TITLE_CONVENTIONS,
      messages: [
        {
          role: 'user',
          content:
            `Name this SOP.${opts.fileName ? ` Source file: ${opts.fileName}.` : ''}\n\n` +
            `Document text (excerpt):\n${opts.extractedText.slice(0, 3000)}`,
        },
      ],
    })
    const title = generated.trim().replace(/^["'`]+|["'`.]+$/g, '').slice(0, 80)
    if (!isPlaceholderTitle(title)) return title
  } catch (err) {
    console.warn('[sop-title] naming call failed, falling back to filename', err)
  }

  return titleFromFileName(opts.fileName) ?? 'Untitled SOP'
}
