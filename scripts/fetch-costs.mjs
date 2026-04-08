#!/usr/bin/env node
/**
 * Unified cost fetcher — pulls usage data from all project APIs
 * Usage: node scripts/fetch-costs.mjs [--month=2026-04]
 *
 * Requires env vars in .env.local:
 *   SHOTSTACK_API_KEY, DEEPGRAM_API_KEY, OPENAI_ADMIN_KEY (with api.usage.read scope),
 *   RAILWAY_API_TOKEN, SUPABASE_ACCESS_TOKEN
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// Load .env.local
try {
  const envFile = readFileSync(resolve(ROOT, '.env.local'), 'utf-8')
  for (const line of envFile.split('\n')) {
    const match = line.match(/^([A-Z_]+)=(.*)$/)
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '')
    }
  }
} catch { /* no .env.local */ }

// Parse args
const args = process.argv.slice(2)
const monthArg = args.find(a => a.startsWith('--month='))
const now = new Date()
const month = monthArg ? monthArg.split('=')[1] : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
const [year, mon] = month.split('-').map(Number)
const startDate = new Date(year, mon - 1, 1)
const endDate = new Date(year, mon, 0, 23, 59, 59)

console.log(`\n========================================`)
console.log(` SafeStart API Cost Fetch — ${month}`)
console.log(`========================================\n`)

const results = []

// --- Shotstack ---
async function fetchShotstack() {
  const key = process.env.SHOTSTACK_API_KEY
  if (!key) { console.log('  [Shotstack] SHOTSTACK_API_KEY not set — skipping'); return }

  // Shotstack has no billing API — can only count renders from the DB
  // Query our own video_generation_jobs table instead
  console.log('  [Shotstack] No billing API available')
  console.log('  [Shotstack] Check dashboard.shotstack.io for credit usage')
  console.log('  [Shotstack] Log the amount manually in .planning/costs/expenses.csv')
  results.push({ service: 'Shotstack', note: 'Manual — check dashboard.shotstack.io' })
}

// --- Deepgram ---
async function fetchDeepgram() {
  const key = process.env.DEEPGRAM_API_KEY
  if (!key) { console.log('  [Deepgram] DEEPGRAM_API_KEY not set — skipping'); return }

  try {
    // List projects
    const projRes = await fetch('https://api.deepgram.com/v1/projects', {
      headers: { 'Authorization': `Token ${key}` }
    })
    if (!projRes.ok) { console.log(`  [Deepgram] Projects API: ${projRes.status}`); return }

    const projData = await projRes.json()
    const projects = projData?.projects || []
    if (projects.length === 0) { console.log('  [Deepgram] No projects found'); return }

    const projectId = projects[0].project_id

    // Get usage — requires usage:read scope on the API key
    const usageRes = await fetch(
      `https://api.deepgram.com/v1/projects/${projectId}/usage?start=${startDate.toISOString()}&end=${endDate.toISOString()}`,
      { headers: { 'Authorization': `Token ${key}` } }
    )

    if (usageRes.status === 403) {
      console.log('  [Deepgram] API key lacks usage:read scope')
      console.log('  [Deepgram] Regenerate key at console.deepgram.com with "Usage" permission')
      console.log('  [Deepgram] Or check console.deepgram.com/usage for costs')
      results.push({ service: 'Deepgram', note: 'API key needs usage:read scope — check console.deepgram.com/usage' })
      return
    }

    if (!usageRes.ok) { console.log(`  [Deepgram] Usage API: ${usageRes.status}`); return }

    const usage = await usageRes.json()
    const totalHours = usage?.results?.[0]?.hours || 0
    const totalRequests = usage?.results?.[0]?.requests || 0
    const estCost = +(totalHours * 60 * 0.0043).toFixed(2)

    console.log(`  [Deepgram] Requests: ${totalRequests}, Audio: ${totalHours.toFixed(2)}h`)
    console.log(`  [Deepgram] Est. cost: $${estCost} USD (~$0.0043/min Nova-2)`)
    results.push({ service: 'Deepgram', requests: totalRequests, audio_hours: totalHours, estimated_cost_usd: estCost })
  } catch (err) {
    console.log(`  [Deepgram] Error: ${err.message}`)
  }
}

// --- OpenAI ---
async function fetchOpenAI() {
  const key = process.env.OPENAI_ADMIN_KEY || process.env.OPENAI_API_KEY
  if (!key) { console.log('  [OpenAI] No API key set — skipping'); return }

  try {
    const start = Math.floor(startDate.getTime() / 1000)
    const end = Math.floor(endDate.getTime() / 1000)
    const headers = { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }

    // Completions
    const compRes = await fetch(
      `https://api.openai.com/v1/organization/usage/completions?start_time=${start}&end_time=${end}&group_by=model`,
      { headers }
    )

    if (compRes.status === 403) {
      console.log('  [OpenAI] Admin key needs api.usage.read scope')
      console.log('  [OpenAI] Regenerate at platform.openai.com/api-keys with "Usage" permission')
      console.log('  [OpenAI] Or check platform.openai.com/usage for costs')
      results.push({ service: 'OpenAI', note: 'Key needs api.usage.read scope — check platform.openai.com/usage' })
      return
    }

    let completionCost = 0, completionTokens = 0
    if (compRes.ok) {
      const data = await compRes.json()
      for (const bucket of data?.data || []) {
        for (const r of bucket.results || []) {
          completionTokens += (r.input_tokens || 0) + (r.output_tokens || 0)
          completionCost += (r.input_cost || 0) + (r.output_cost || 0)
        }
      }
    }

    // Audio (TTS)
    let audioCost = 0
    const audioRes = await fetch(
      `https://api.openai.com/v1/organization/usage/audio_speeches?start_time=${start}&end_time=${end}`,
      { headers }
    )
    if (audioRes.ok) {
      const data = await audioRes.json()
      for (const bucket of data?.data || []) {
        for (const r of bucket.results || []) {
          audioCost += (r.cost || r.input_cost || 0)
        }
      }
    }

    const totalUsd = +((completionCost + audioCost) / 100).toFixed(2)
    console.log(`  [OpenAI] Completions: ${completionTokens.toLocaleString()} tokens ($${(completionCost / 100).toFixed(2)})`)
    if (audioCost > 0) console.log(`  [OpenAI] Audio/TTS: $${(audioCost / 100).toFixed(2)}`)
    console.log(`  [OpenAI] Total: $${totalUsd} USD`)

    results.push({
      service: 'OpenAI',
      completion_tokens: completionTokens,
      completion_cost_usd: +(completionCost / 100).toFixed(2),
      audio_cost_usd: +(audioCost / 100).toFixed(2),
      total_cost_usd: totalUsd
    })
  } catch (err) {
    console.log(`  [OpenAI] Error: ${err.message}`)
  }
}

// --- Railway ---
async function fetchRailway() {
  const token = process.env.RAILWAY_API_TOKEN
  if (!token) { console.log('  [Railway] RAILWAY_API_TOKEN not set — skipping'); return }

  try {
    // Get workspaces and projects
    const wsRes = await fetch('https://backboard.railway.app/graphql/v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        query: `{ me { workspaces { id name plan projects(first: 20) { edges { node { id name } } } } } }`
      })
    })

    if (!wsRes.ok) { console.log(`  [Railway] API error: ${wsRes.status}`); return }

    const wsData = await wsRes.json()
    if (wsData.errors) { console.log(`  [Railway] GraphQL error:`, wsData.errors[0]?.message); return }

    const workspaces = wsData.data?.me?.workspaces || []

    for (const ws of workspaces) {
      console.log(`  [Railway] Workspace: ${ws.name} (${ws.plan})`)
      const projects = ws.projects?.edges?.map(e => e.node) || []

      for (const project of projects) {
        // Get estimated usage per measurement
        const measurements = ['CPU_USAGE', 'MEMORY_USAGE_GB', 'NETWORK_TX_GB', 'DISK_USAGE_GB']
        const aliases = measurements.map((m, i) =>
          `u${i}: estimatedUsage(projectId: "${project.id}", teamId: "${ws.id}", measurements: [${m}]) { estimatedValue measurement }`
        ).join(' ')

        const usageRes = await fetch('https://backboard.railway.app/graphql/v2', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ query: `{ ${aliases} }` })
        })

        if (!usageRes.ok) continue
        const usageData = await usageRes.json()
        if (usageData.errors) continue

        let projectTotal = 0
        const breakdown = {}
        for (const items of Object.values(usageData.data || {})) {
          for (const item of items) {
            const usd = item.estimatedValue / 100
            breakdown[item.measurement] = +usd.toFixed(2)
            projectTotal += item.estimatedValue
          }
        }

        const totalUsd = +(projectTotal / 100).toFixed(2)
        console.log(`    ${project.name}: $${totalUsd}/mo (CPU: $${breakdown.CPU_USAGE || 0}, Mem: $${breakdown.MEMORY_USAGE_GB || 0})`)
        results.push({ service: 'Railway', project: project.name, estimated_monthly_usd: totalUsd, breakdown })
      }
    }
  } catch (err) {
    console.log(`  [Railway] Error: ${err.message}`)
  }
}

// --- Supabase ---
async function fetchSupabase() {
  const token = process.env.SUPABASE_ACCESS_TOKEN
  if (!token) { console.log('  [Supabase] SUPABASE_ACCESS_TOKEN not set — skipping'); return }

  try {
    // List projects
    const projRes = await fetch('https://api.supabase.com/v1/projects', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (!projRes.ok) { console.log(`  [Supabase] Projects API: ${projRes.status}`); return }

    const projects = await projRes.json()
    for (const p of projects) {
      console.log(`  [Supabase] ${p.name} (${p.id}) — org: ${p.organization_id}`)
    }

    // Supabase Management API doesn't expose billing/usage via REST
    // Billing is per-organization and only visible in the dashboard
    console.log('  [Supabase] Billing not available via API — check supabase.com/dashboard/org/*/billing')
    console.log('  [Supabase] Log the amount manually in .planning/costs/expenses.csv')
    results.push({ service: 'Supabase', note: 'Manual — check Supabase dashboard billing page' })
  } catch (err) {
    console.log(`  [Supabase] Error: ${err.message}`)
  }
}

// --- Run all ---
async function main() {
  await fetchShotstack()
  console.log('')
  await fetchDeepgram()
  console.log('')
  await fetchOpenAI()
  console.log('')
  await fetchRailway()
  console.log('')
  await fetchSupabase()

  console.log(`\n========================================`)
  console.log(` Summary`)
  console.log(`========================================\n`)

  // Save results
  const costsDir = resolve(ROOT, '.planning/costs')
  mkdirSync(costsDir, { recursive: true })

  const outFile = resolve(costsDir, `api-costs-${month}.json`)
  const output = { month, fetched_at: new Date().toISOString(), services: results }
  writeFileSync(outFile, JSON.stringify(output, null, 2))
  console.log(`Saved to: .planning/costs/api-costs-${month}.json\n`)

  // Print totals
  let autoTotal = 0
  const manual = []
  for (const r of results) {
    if (r.total_cost_usd) autoTotal += r.total_cost_usd
    else if (r.estimated_cost_usd) autoTotal += r.estimated_cost_usd
    else if (r.estimated_monthly_usd) autoTotal += r.estimated_monthly_usd
    else if (r.note) manual.push(r.service)
  }

  console.log(`  Auto-captured:  $${autoTotal.toFixed(2)} USD`)
  if (manual.length) console.log(`  Manual needed:  ${manual.join(', ')}`)
}

main().catch(console.error)
