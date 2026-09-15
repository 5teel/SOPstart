// Deployed-site eval runner.
//   npm run eval                 → wait for Railway to serve local HEAD, run tests/evals against https://sopstart.com
//   npm run eval -- --no-wait    → skip the deploy wait
//   npm run eval -- --phase 41   → also copy the report to .planning/phases/41-*/41-EVAL.md
//   EVAL_BASE_URL=https://... overrides the target.
import { spawnSync, execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const flag = (n) => args.includes(n)
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined }
const BASE = process.env.EVAL_BASE_URL || 'https://sopstart.com'
const OUT = path.join('.planning', 'evals', 'latest')
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true })

const head = execSync('git rev-parse HEAD').toString().trim()
if (!flag('--no-wait')) {
  process.stdout.write(`waiting for ${BASE} to serve ${head.slice(0, 7)} `)
  const deadline = Date.now() + 15 * 60_000
  let served = null
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${BASE}/api/version`, { cache: 'no-store' })
      if (r.ok) served = (await r.json()).sha
    } catch { /* deploying */ }
    if (served === head) break
    process.stdout.write('.')
    await new Promise((r) => setTimeout(r, 20_000))
  }
  console.log()
  if (served !== head) { console.error(`deploy not live: serving ${served?.slice(0, 7) ?? 'unknown'}, want ${head.slice(0, 7)}`); process.exit(2) }
  console.log('deploy is live')
}

const jsonOut = path.join(OUT, 'results.json')
const res = spawnSync('npx', ['playwright', 'test', '--project=evals', '--reporter=list,json'], {
  stdio: ['inherit', 'inherit', 'inherit'], shell: true,
  env: { ...process.env, EVAL_BASE_URL: BASE, PLAYWRIGHT_JSON_OUTPUT_NAME: jsonOut },
})

// Report
let rows = [], counts = { passed: 0, failed: 0, skipped: 0 }
try {
  const j = JSON.parse(fs.readFileSync(jsonOut, 'utf8'))
  const walk = (s, prefix = '') => {
    for (const sp of s.specs ?? []) for (const t of sp.tests ?? []) {
      const status = t.results?.at(-1)?.status ?? 'unknown'
      counts[status === 'passed' ? 'passed' : status === 'skipped' ? 'skipped' : 'failed']++
      const err = t.results?.at(-1)?.error?.message?.split('\n')[0] ?? ''
      rows.push(`| ${status === 'passed' ? '✅' : status === 'skipped' ? '⏭' : '❌'} | ${prefix}${sp.title} | ${err.replace(/\|/g, '/').slice(0, 160)} |`)
    }
    for (const c of s.suites ?? []) walk(c, `${c.title} › `)
  }
  for (const s of j.suites ?? []) walk(s)
} catch (e) { rows.push(`| ❌ | (no results.json — playwright exit ${res.status}) | ${e.message} |`) }
const shots = fs.existsSync(OUT) ? fs.readdirSync(OUT).filter((f) => f.endsWith('.png')) : []
const report = `# Deployed-site eval — ${new Date().toISOString()}

Target: ${BASE} · commit ${head.slice(0, 7)} · ${counts.passed} passed / ${counts.failed} failed / ${counts.skipped} skipped

| | Test | Failure |
|---|------|---------|
${rows.join('\n')}

Screenshots (inspect these — CSS/sizing bugs are invisible to assertions): ${shots.map((s) => `\`${path.join(OUT, s)}\``).join(', ') || 'none'}
`
fs.writeFileSync(path.join(OUT, 'EVAL-REPORT.md'), report)
console.log(report)
const phase = opt('--phase')
if (phase) {
  const dir = fs.readdirSync('.planning/phases').find((d) => d.startsWith(`${phase}-`))
  if (dir) { fs.writeFileSync(path.join('.planning/phases', dir, `${phase}-EVAL.md`), report); console.log(`report copied to .planning/phases/${dir}/${phase}-EVAL.md`) }
}
process.exit(counts.failed > 0 || res.status !== 0 ? 1 : 0)
