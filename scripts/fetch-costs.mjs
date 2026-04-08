#!/usr/bin/env node
/**
 * Unified cost fetcher — pulls usage data from all project APIs
 * Usage: node scripts/fetch-costs.mjs [--month=2026-04]
 *
 * Requires env vars (from .env.local):
 *   SHOTSTACK_API_KEY, DEEPGRAM_API_KEY, OPENAI_API_KEY
 *
 * Optional:
 *   RAILWAY_API_TOKEN (personal token from railway.app/account/tokens)
 *   SUPABASE_ACCESS_TOKEN (from supabase.com/dashboard/account/tokens)
 *   SUPABASE_PROJECT_REF (project ID from dashboard URL)
 */

import { readFileSync, appendFileSync, mkdirSync } from 'fs'
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

  const baseUrl = process.env.SHOTSTACK_API_URL || 'https://api.shotstack.io/edit/v1'

  try {
    // Shotstack doesn't have a direct billing API, but we can count renders
    // and estimate from the render list
    // Shotstack Serve API for render history
    const serveUrl = baseUrl.replace('/edit/', '/serve/')
    const res = await fetch(`${baseUrl}/renders`, {
      headers: { 'x-api-key': key }
    })

    if (!res.ok) {
      console.log(`  [Shotstack] API error: ${res.status}`)
      return
    }

    const data = await res.json()
    const renders = data?.response?.data || []

    // Filter to month
    const monthRenders = renders.filter(r => {
      const created = new Date(r.created)
      return created >= startDate && created <= endDate
    })

    const completed = monthRenders.filter(r => r.status === 'done').length
    const failed = monthRenders.filter(r => r.status === 'failed').length

    console.log(`  [Shotstack] Renders: ${completed} done, ${failed} failed (${monthRenders.length} total)`)
    console.log(`  [Shotstack] Note: check dashboard.shotstack.io for exact credit usage`)

    results.push({
      service: 'Shotstack',
      renders_completed: completed,
      renders_failed: failed,
      note: 'Credit usage from Shotstack dashboard — API does not expose cost directly'
    })
  } catch (err) {
    console.log(`  [Shotstack] Error: ${err.message}`)
  }
}

// --- Deepgram ---
async function fetchDeepgram() {
  const key = process.env.DEEPGRAM_API_KEY
  if (!key) { console.log('  [Deepgram] DEEPGRAM_API_KEY not set — skipping'); return }

  try {
    const start = startDate.toISOString().split('T')[0]
    const end = endDate.toISOString().split('T')[0]

    const res = await fetch(
      `https://api.deepgram.com/v1/projects?include_usage=true`,
      { headers: { 'Authorization': `Token ${key}` } }
    )

    if (!res.ok) {
      // Try the usage endpoint directly
      const usageRes = await fetch(
        `https://api.deepgram.com/v1/usage?start=${start}&end=${end}`,
        { headers: { 'Authorization': `Token ${key}` } }
      )

      if (!usageRes.ok) {
        console.log(`  [Deepgram] API error: ${usageRes.status}`)
        return
      }

      const usageData = await usageRes.json()
      console.log(`  [Deepgram] Usage data:`, JSON.stringify(usageData).slice(0, 200))
      results.push({ service: 'Deepgram', raw: usageData })
      return
    }

    const data = await res.json()
    const projects = data?.projects || []

    if (projects.length === 0) {
      console.log(`  [Deepgram] No projects found`)
      return
    }

    // Get usage for first project
    const projectId = projects[0].project_id
    const usageRes = await fetch(
      `https://api.deepgram.com/v1/projects/${projectId}/usage?start=${startDate.toISOString()}&end=${endDate.toISOString()}`,
      { headers: { 'Authorization': `Token ${key}` } }
    )

    if (!usageRes.ok) {
      console.log(`  [Deepgram] Usage API error: ${usageRes.status}`)
      return
    }

    const usage = await usageRes.json()
    const totalHours = (usage?.results?.[0]?.hours || 0)
    const totalRequests = (usage?.results?.[0]?.requests || 0)

    console.log(`  [Deepgram] Requests: ${totalRequests}, Audio hours: ${totalHours.toFixed(2)}`)
    console.log(`  [Deepgram] Pricing: ~$0.0043/min (Nova-2) = ~$${(totalHours * 60 * 0.0043).toFixed(2)} USD est.`)

    results.push({
      service: 'Deepgram',
      requests: totalRequests,
      audio_hours: totalHours,
      estimated_cost_usd: +(totalHours * 60 * 0.0043).toFixed(2)
    })
  } catch (err) {
    console.log(`  [Deepgram] Error: ${err.message}`)
  }
}

// --- OpenAI ---
async function fetchOpenAI() {
  const key = process.env.OPENAI_API_KEY
  if (!key) { console.log('  [OpenAI] OPENAI_API_KEY not set — skipping'); return }

  try {
    // OpenAI usage API requires org-level admin key — project keys may not work
    const start = Math.floor(startDate.getTime() / 1000)
    const end = Math.floor(endDate.getTime() / 1000)

    const res = await fetch(
      `https://api.openai.com/v1/organization/usage/completions?start_time=${start}&end_time=${end}&limit=1`,
      { headers: { 'Authorization': `Bearer ${key}` } }
    )

    if (res.status === 403 || res.status === 401) {
      console.log(`  [OpenAI] Usage API requires admin key — check platform.openai.com/usage for costs`)
      results.push({ service: 'OpenAI', note: 'Check platform.openai.com/usage — API key lacks admin access' })
      return
    }

    if (!res.ok) {
      console.log(`  [OpenAI] API error: ${res.status}`)
      return
    }

    const data = await res.json()
    console.log(`  [OpenAI] Usage:`, JSON.stringify(data).slice(0, 300))
    results.push({ service: 'OpenAI', raw: data })
  } catch (err) {
    console.log(`  [OpenAI] Error: ${err.message}`)
  }
}

// --- Railway ---
async function fetchRailway() {
  const token = process.env.RAILWAY_API_TOKEN
  if (!token) {
    console.log(`  [Railway] RAILWAY_API_TOKEN not set — get one from railway.app/account/tokens`)
    console.log(`  [Railway] Add to .env.local: RAILWAY_API_TOKEN=your_token`)
    return
  }

  try {
    const res = await fetch('https://backboard.railway.app/graphql/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: `{
          me {
            projects(first: 5) {
              edges {
                node {
                  id
                  name
                  estimatedUsage {
                    estimatedValue
                    currentUsage
                  }
                }
              }
            }
          }
        }`
      })
    })

    if (!res.ok) {
      console.log(`  [Railway] API error: ${res.status}`)
      return
    }

    const data = await res.json()
    const projects = data?.data?.me?.projects?.edges || []

    for (const { node } of projects) {
      const usage = node.estimatedUsage
      if (usage) {
        console.log(`  [Railway] ${node.name}: $${(usage.currentUsage / 100).toFixed(2)} current / $${(usage.estimatedValue / 100).toFixed(2)} estimated`)
        results.push({
          service: 'Railway',
          project: node.name,
          current_usd: +(usage.currentUsage / 100).toFixed(2),
          estimated_usd: +(usage.estimatedValue / 100).toFixed(2)
        })
      } else {
        console.log(`  [Railway] ${node.name}: no usage data`)
      }
    }
  } catch (err) {
    console.log(`  [Railway] Error: ${err.message}`)
  }
}

// --- Supabase ---
async function fetchSupabase() {
  const token = process.env.SUPABASE_ACCESS_TOKEN
  const ref = process.env.SUPABASE_PROJECT_REF || process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/(\w+)\./)?.[1]

  if (!token) {
    console.log(`  [Supabase] SUPABASE_ACCESS_TOKEN not set — get from supabase.com/dashboard/account/tokens`)
    return
  }
  if (!ref) {
    console.log(`  [Supabase] Could not determine project ref`)
    return
  }

  try {
    const res = await fetch(
      `https://api.supabase.com/v1/projects/${ref}/usage`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    )

    if (!res.ok) {
      // Try org-level billing
      const orgRes = await fetch(
        `https://api.supabase.com/v1/organizations`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      )
      if (orgRes.ok) {
        const orgs = await orgRes.json()
        if (orgs.length > 0) {
          const billingRes = await fetch(
            `https://api.supabase.com/v1/organizations/${orgs[0].id}/billing/invoices`,
            { headers: { 'Authorization': `Bearer ${token}` } }
          )
          if (billingRes.ok) {
            const invoices = await billingRes.json()
            const current = invoices?.[0]
            if (current) {
              console.log(`  [Supabase] Latest invoice: $${(current.amount_due / 100).toFixed(2)} (${current.status})`)
              results.push({ service: 'Supabase', invoice_usd: +(current.amount_due / 100).toFixed(2), status: current.status })
              return
            }
          }
        }
      }
      console.log(`  [Supabase] Usage API returned ${res.status} — check dashboard for billing`)
      return
    }

    const usage = await res.json()
    console.log(`  [Supabase] DB size: ${usage?.db_size || 'unknown'}, Bandwidth: ${usage?.db_egress || 'unknown'}`)
    results.push({ service: 'Supabase', raw: usage })
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
  const output = {
    month,
    fetched_at: new Date().toISOString(),
    services: results
  }

  appendFileSync(outFile, JSON.stringify(output, null, 2))
  console.log(`Results saved to: .planning/costs/api-costs-${month}.json`)

  // Print totals
  let totalUsd = 0
  for (const r of results) {
    if (r.estimated_cost_usd) totalUsd += r.estimated_cost_usd
    if (r.current_usd) totalUsd += r.current_usd
    if (r.invoice_usd) totalUsd += r.invoice_usd
  }

  if (totalUsd > 0) {
    console.log(`\nTotal API/infra costs captured: $${totalUsd.toFixed(2)} USD`)
    console.log(`(Some services require dashboard access — see notes above)`)
  }
}

main().catch(console.error)
