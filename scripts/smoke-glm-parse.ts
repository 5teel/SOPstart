/**
 * Smoke test: full parseSop pipeline on a NON-Anthropic provider (GLM 5.2 via
 * OpenRouter) — proves the AI Settings provider swap works end-to-end with no
 * Anthropic interaction. Run: npx tsx scripts/smoke-glm-parse.ts
 */
import fs from 'node:fs'

// Load env (server-style) BEFORE importing modules that read process.env.
for (const f of ['.env', '.env.local']) {
  if (!fs.existsSync(f)) continue
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const i = line.indexOf('=')
    if (i > 0 && !process.env[line.slice(0, i).trim()]) {
      process.env[line.slice(0, i).trim()] = line.slice(i + 1).trim()
    }
  }
}
// Prove no Anthropic involvement: poison the key so any Anthropic call fails loudly.
process.env.ANTHROPIC_API_KEY = 'sk-ant-POISONED-should-never-be-called'

async function main() {
  const { parseSop } = await import('../src/lib/parsers/sop-parser')
  const text = fs.readFileSync('.autoresearch/corpus/optimize/JSEA 211.09.06.txt', 'utf8')
  const glm = 'z-ai/glm-5.2'
  const t0 = Date.now()
  const parsed = await parseSop(text, {
    sourceMode: 'txt',
    models: { triage: glm, simple: glm, complex: glm },
  })
  const secs = ((Date.now() - t0) / 1000).toFixed(1)
  const steps = parsed.sections.reduce((n, s) => n + (s.steps?.length ?? 0), 0)
  console.log(`OK in ${secs}s — "${parsed.title}"`)
  console.log(`sections=${parsed.sections.length} steps=${steps} confidence=${parsed.overall_confidence}`)
  console.log(`parse_notes: ${(parsed.parse_notes ?? '').slice(0, 200)}`)
  if (!parsed.title || parsed.sections.length === 0) throw new Error('empty parse result')
}

main().catch((e) => {
  console.error('SMOKE FAILED:', e.message)
  process.exit(1)
})
