/**
 * Build-time enforcement of the three-place block contract
 * (see src/lib/builder/puck-config.tsx:399-418).
 *
 * For each block type, the following MUST be true:
 *   1. It is a key of puckConfig.components
 *   2. It is a key of BLOCK_REGISTRY in src/actions/introspection.ts
 *   3. Its 'kind' literal appears in BlockContentSchema discriminatedUnion
 *      in src/lib/validators/blocks.ts
 *
 * Exceptions:
 *   - UnsupportedBlockPlaceholder is a Puck-internal fallback; not
 *     registered in BLOCK_REGISTRY or BlockContentSchema.
 *   - ModelBlock is registered in puckConfig + BLOCK_REGISTRY but NOT in
 *     BlockContentSchema — it only lives in layout_data, never in
 *     sop_section_blocks.
 *
 * On success: exits 0 with a brief OK summary.
 * On mismatch: exits 1 with the three sets and the delta printed.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const PUCK_CONFIG = path.join(ROOT, 'src/lib/builder/puck-config.tsx')
const INTROSPECTION = path.join(ROOT, 'src/actions/introspection.ts')
const VALIDATORS = path.join(ROOT, 'src/lib/validators/blocks.ts')

// Blocks excluded from BLOCK_REGISTRY check (Puck-internal fallbacks)
const EXCLUDED_FROM_REGISTRY = new Set(['UnsupportedBlockPlaceholder'])

// Blocks excluded from BlockContentSchema check.
// Either layout_data-only (ModelBlock, UnsupportedBlockPlaceholder) or
// legacy Phase 12 blocks that pre-date the discriminated union and live
// only in Puck layout_data (TextBlock, HeadingBlock, PhotoBlock, CalloutBlock).
// New blocks added in Phase 12.5+ MUST have a kind entry in BlockContentSchema.
const EXCLUDED_FROM_VALIDATORS = new Set([
  'UnsupportedBlockPlaceholder',
  'ModelBlock',
  // Phase 12 legacy layout-only blocks (not stored in sop_section_blocks):
  'TextBlock',
  'HeadingBlock',
  'PhotoBlock',
  'CalloutBlock',
])

/**
 * Map from PascalCase block name → kebab-case kind literal.
 * Phase 12 convention: lowercase-hyphenated, e.g. VoiceNoteBlock → 'voice-note'.
 */
function nameToKind(name: string): string {
  const stripped = name.endsWith('Block') ? name.slice(0, -'Block'.length) : name
  // Special cases per Phase 12 convention
  const map: Record<string, string> = {
    HazardCard: 'hazard',    // Phase 12 chose 'hazard' not 'hazardcard'
    PPECard: 'ppe',          // Phase 12 chose 'ppe' not 'ppecard'
    VoiceNote: 'voice-note',
    SignOff: 'signoff',
  }
  if (map[stripped]) return map[stripped]
  // Default: lowercase the PascalCase stripped name
  return stripped.toLowerCase()
}

/**
 * Extract the body string of a named object literal (the content between the
 * outermost braces after the keyword that identifies the object).
 * Returns the content inside the first `{...}` found after `startPattern`.
 */
function extractObjectBody(src: string, startPattern: RegExp): string {
  const match = startPattern.exec(src)
  if (!match) return ''
  let i = src.indexOf('{', match.index + match[0].length - 1)
  if (i < 0) return ''
  let depth = 0
  const bodyStart = i + 1
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') {
      depth--
      if (depth === 0) break
    }
  }
  return src.slice(bodyStart, i)
}

/**
 * Extract top-level PascalCase keys from an object body string.
 * Splits by lines (handles CRLF and LF), detects the indent of the
 * first PascalCase key line (spaces only), and collects all lines at
 * that exact indent level.
 */
function extractTopLevelPascalKeys(body: string): string[] {
  const keys = new Set<string>()
  const lines = body.split(/\r?\n/)
  // Detect indent from first PascalCase key line
  let targetIndent: string | null = null
  for (const line of lines) {
    const m = /^( +)([A-Z][A-Za-z0-9]*)\s*:/.exec(line)
    if (m) {
      if (targetIndent === null) targetIndent = m[1]
      if (m[1] === targetIndent) keys.add(m[2])
    }
  }
  return [...keys]
}

function extractPuckComponentKeys(src: string): string[] {
  // Find `components: {` inside puckConfig object
  const body = extractObjectBody(src, /components\s*:\s*\{/)
  return extractTopLevelPascalKeys(body)
}

function extractRegistryKeys(src: string): string[] {
  // BLOCK_REGISTRY has a type annotation: `const BLOCK_REGISTRY: Record<...> = {`
  // Use a pattern that matches past the type annotation
  const body = extractObjectBody(src, /BLOCK_REGISTRY[^=]+=\s*\{/)
  return extractTopLevelPascalKeys(body)
}

function extractValidatorKinds(src: string): string[] {
  // Extract schema names listed inside the discriminatedUnion([...]) call,
  // then look up each schema's kind: z.literal('...') value.
  // This correctly detects when a schema exists but is NOT in the union array.

  // Step 1: find the discriminatedUnion array body
  const duMatch = /discriminatedUnion\s*\(\s*['"]kind['"]\s*,\s*\[/.exec(src)
  if (!duMatch) return []
  const arrStart = src.indexOf('[', duMatch.index + duMatch[0].length - 1)
  let depth = 0
  let i = arrStart
  for (; i < src.length; i++) {
    if (src[i] === '[') depth++
    else if (src[i] === ']') { depth--; if (depth === 0) break }
  }
  const arrBody = src.slice(arrStart + 1, i)

  // Step 2: extract schema variable names from the array (PascalCase identifiers)
  const schemaNames: string[] = []
  for (const m of arrBody.matchAll(/([A-Z][A-Za-z0-9]*Schema)\b/g)) {
    schemaNames.push(m[1])
  }

  // Step 3: for each schema name, find its `kind: z.literal('...')` definition
  const kinds = new Set<string>()
  for (const schemaName of schemaNames) {
    // Match: `const SchemaName = z.object({ kind: z.literal('value'), ...`
    // or just find the first z.literal near the schema declaration
    const schemaDefMatch = new RegExp(
      `(?:const|export const)\\s+${schemaName}\\s*=`
    ).exec(src)
    if (!schemaDefMatch) continue
    // Search for kind literal in the next 500 chars after this schema starts
    const snippet = src.slice(schemaDefMatch.index, schemaDefMatch.index + 500)
    const kindMatch = /kind\s*:\s*z\.literal\(['"]([a-z][a-z0-9-]*)['"]\)/.exec(snippet)
    if (kindMatch) kinds.add(kindMatch[1])
  }
  return [...kinds]
}

function main(): void {
  const puckSrc = fs.readFileSync(PUCK_CONFIG, 'utf8')
  const introSrc = fs.readFileSync(INTROSPECTION, 'utf8')
  const valSrc = fs.readFileSync(VALIDATORS, 'utf8')

  const puckKeys = new Set(extractPuckComponentKeys(puckSrc))
  const regKeys = new Set(extractRegistryKeys(introSrc))
  const valKinds = new Set(extractValidatorKinds(valSrc))

  const errors: string[] = []

  // Every key in puckKeys (minus EXCLUDED) must exist in regKeys
  for (const k of puckKeys) {
    if (EXCLUDED_FROM_REGISTRY.has(k)) continue
    if (!regKeys.has(k)) {
      errors.push(
        `[1→2] Block "${k}" is in puckConfig.components but NOT in BLOCK_REGISTRY`
      )
    }
  }
  // Every key in regKeys must exist in puckKeys
  for (const k of regKeys) {
    if (!puckKeys.has(k)) {
      errors.push(
        `[2→1] Block "${k}" is in BLOCK_REGISTRY but NOT in puckConfig.components`
      )
    }
  }
  // Every key in puckKeys (minus EXCLUDED) must have a kind in valKinds
  for (const k of puckKeys) {
    if (EXCLUDED_FROM_VALIDATORS.has(k)) continue
    const expectedKind = nameToKind(k)
    if (!valKinds.has(expectedKind)) {
      errors.push(
        `[1→3] Block "${k}" (expected kind "${expectedKind}") is in puckConfig.components but NOT in BlockContentSchema discriminated union`
      )
    }
  }

  if (errors.length > 0) {
    console.error('THREE-PLACE CONTRACT BROKEN:')
    for (const e of errors) console.error('  -', e)
    console.error(
      '\npuckConfig.components:',
      [...puckKeys].sort().join(', ')
    )
    console.error('BLOCK_REGISTRY:       ', [...regKeys].sort().join(', '))
    console.error('BlockContentSchema:   ', [...valKinds].sort().join(', '))
    process.exit(1)
  }

  console.log('OK. Three-place contract intact.')
  console.log(`  puckConfig.components: ${puckKeys.size} blocks`)
  console.log(`  BLOCK_REGISTRY:        ${regKeys.size} blocks`)
  console.log(`  BlockContentSchema:    ${valKinds.size} kinds`)
}

main()
