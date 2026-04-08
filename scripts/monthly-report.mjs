#!/usr/bin/env node
/**
 * Monthly Cost & Time Report — generates Google Sheets-ready output
 * Usage: node scripts/monthly-report.mjs [--month=2026-04]
 *
 * Outputs:
 * 1. Tab-separated data blocks for each Google Sheet tab
 * 2. Saves full report to .planning/costs/report-YYYY-MM.tsv
 * 3. Copies summary to clipboard (if pbcopy/clip available)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

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
} catch {}

// Parse args
const args = process.argv.slice(2)
const monthArg = args.find(a => a.startsWith('--month='))
const now = new Date()
const month = monthArg ? monthArg.split('=')[1] : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
const [year, mon] = month.split('-').map(Number)
const startDate = new Date(year, mon - 1, 1)
const endDate = new Date(year, mon, 0, 23, 59, 59)
const monthLabel = startDate.toLocaleDateString('en-NZ', { month: 'long', year: 'numeric' })

const RATE = 100 // NZD per hour
const lines = []
const log = (s = '') => { lines.push(s); console.log(s) }

// ── Helpers ──

function tsv(headers, rows) {
  log(headers.join('\t'))
  for (const row of rows) log(row.join('\t'))
}

async function fetchRailway() {
  const token = process.env.RAILWAY_API_TOKEN
  if (!token) return []

  try {
    const wsRes = await fetch('https://backboard.railway.app/graphql/v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        query: `{ me { workspaces { id name plan projects(first: 20) { edges { node { id name } } } } } }`
      })
    })
    if (!wsRes.ok) return []
    const wsData = await wsRes.json()
    if (wsData.errors) return []

    const results = []
    for (const ws of wsData.data?.me?.workspaces || []) {
      for (const { node: project } of ws.projects?.edges || []) {
        const measurements = ['CPU_USAGE', 'MEMORY_USAGE_GB', 'NETWORK_TX_GB', 'DISK_USAGE_GB']
        const aliases = measurements.map((m, i) =>
          `u${i}: estimatedUsage(projectId: "${project.id}", teamId: "${ws.id}", measurements: [${m}]) { estimatedValue measurement }`
        ).join(' ')

        const uRes = await fetch('https://backboard.railway.app/graphql/v2', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ query: `{ ${aliases} }` })
        })
        if (!uRes.ok) continue
        const uData = await uRes.json()
        if (uData.errors) continue

        let total = 0
        for (const items of Object.values(uData.data || {})) {
          for (const item of items) total += item.estimatedValue
        }
        results.push({ name: project.name, usd: +(total / 100).toFixed(2) })
      }
    }
    return results
  } catch { return [] }
}

function getGitTime() {
  try {
    const sinceDate = `${year}-${String(mon).padStart(2, '0')}-01`
    const untilDate = `${year}-${String(mon).padStart(2, '0')}-31`
    const author = execSync('git config user.name', { encoding: 'utf-8' }).trim()
    const raw = execSync(
      `git log --format="%aI" --author="${author}" --since="${sinceDate}" --until="${untilDate}" --reverse`,
      { encoding: 'utf-8' }
    ).trim()

    if (!raw) return { sessions: 0, commits: 0, minutes: 0 }

    const timestamps = raw.split('\n').map(ts => new Date(ts).getTime() / 1000)
    let totalMinutes = 0, sessions = 0, prev = 0

    for (const ts of timestamps) {
      if (prev === 0) {
        sessions++
        totalMinutes += 15
        prev = ts
        continue
      }
      const gap = (ts - prev) / 60
      if (gap > 30) {
        sessions++
        totalMinutes += 15
      } else {
        totalMinutes += gap
      }
      prev = ts
    }

    return { sessions, commits: timestamps.length, minutes: Math.round(totalMinutes) }
  } catch { return { sessions: 0, commits: 0, minutes: 0 } }
}

function getWeeklyBreakdown() {
  try {
    const sinceDate = `${year}-${String(mon).padStart(2, '0')}-01`
    const untilDate = `${year}-${String(mon).padStart(2, '0')}-31`
    const author = execSync('git config user.name', { encoding: 'utf-8' }).trim()
    const raw = execSync(
      `git log --format="%aI" --author="${author}" --since="${sinceDate}" --until="${untilDate}"`,
      { encoding: 'utf-8' }
    ).trim()

    if (!raw) return []

    // Group by week and day, estimate per-day hours
    const dayCommits = {}
    for (const ts of raw.split('\n')) {
      const day = ts.split('T')[0]
      dayCommits[day] = (dayCommits[day] || 0) + 1
    }

    // Group days into weeks
    const weeks = {}
    for (const [day, count] of Object.entries(dayCommits)) {
      const d = new Date(day)
      const weekStart = new Date(d)
      weekStart.setDate(d.getDate() - d.getDay() + 1) // Monday
      const weekKey = weekStart.toISOString().split('T')[0]
      if (!weeks[weekKey]) weeks[weekKey] = { days: 0, commits: 0 }
      weeks[weekKey].days++
      weeks[weekKey].commits += count
    }

    return Object.entries(weeks).sort().map(([weekStart, data]) => {
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)
      return {
        week: `${weekStart} — ${weekEnd.toISOString().split('T')[0]}`,
        activeDays: data.days,
        commits: data.commits,
      }
    })
  } catch { return [] }
}

function loadExpenses() {
  const file = resolve(ROOT, '.planning/costs/expenses.csv')
  if (!existsSync(file)) return []
  const lines = readFileSync(file, 'utf-8').trim().split('\n').slice(1) // skip header
  return lines.filter(l => l.startsWith(month)).map(l => {
    const [date, category, description, amount, currency, paid_by] = l.split(',')
    return { date, category, description, amount: parseFloat(amount) || 0, currency, paid_by }
  })
}

// ── Main ──

async function main() {
  log(`╔══════════════════════════════════════════════════════════════╗`)
  log(`║  SafeStart Monthly Report — ${monthLabel.padEnd(31)}║`)
  log(`╚══════════════════════════════════════════════════════════════╝`)
  log()

  // ── 1. Executive Summary ──
  log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  log(`  EXECUTIVE SUMMARY`)
  log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  log()

  const git = getGitTime()
  const hours = +(git.minutes / 60).toFixed(1)
  const devCost = Math.round(hours * RATE)
  const railway = await fetchRailway()
  const sopstartRailway = railway.find(r => r.name === 'SOPstart')?.usd || 0
  const expenses = loadExpenses()
  const expenseTotal = expenses.reduce((sum, e) => sum + (e.currency === 'USD' ? e.amount : 0), 0)

  const totalInfra = sopstartRailway + expenseTotal

  log(`  Dev Time:        ${hours}h across ${git.sessions} sessions (${git.commits} commits)`)
  log(`  Dev Cost:        $${devCost.toLocaleString()} NZD (@ $${RATE}/hr)`)
  log(`  Infrastructure:  $${totalInfra.toFixed(2)} USD`)
  log(`    Railway:       $${sopstartRailway.toFixed(2)} USD`)
  if (expenseTotal > 0) log(`    Other:         $${expenseTotal.toFixed(2)} USD`)
  log()

  // ── 2. Dev Time Detail (Google Sheets: Time Log tab) ──
  log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  log(`  DEV TIME — ${monthLabel}`)
  log(`  (paste into Google Sheets: Time Log tab)`)
  log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  log()

  const weeks = getWeeklyBreakdown()
  tsv(
    ['Week', 'Active Days', 'Commits', 'Person', 'Rate (NZD/hr)'],
    weeks.map(w => [w.week, w.activeDays, w.commits, 'Simon (Potenco)', RATE])
  )
  log()
  log(`Total\t${weeks.reduce((s, w) => s + w.activeDays, 0)} days\t${git.commits} commits\t${hours}h\t$${devCost} NZD`)
  log()

  // ── 3. Infrastructure (Google Sheets: Infrastructure tab) ──
  log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  log(`  INFRASTRUCTURE — ${monthLabel}`)
  log(`  (paste into Google Sheets: Infrastructure tab)`)
  log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  log()

  // Railway breakdown — show SOPstart prominently, others as context
  tsv(
    ['Service', 'Project', 'Monthly (USD)', 'Notes'],
    [
      ['Railway', 'SOPstart', sopstartRailway.toFixed(2), 'Hosting'],
      ...expenses.map(e => [e.category, e.description, e.amount.toFixed(2), `Paid by ${e.paid_by}`]),
      ['Supabase', 'SOPstart', '—', 'Check dashboard'],
      ['Shotstack', '—', '—', 'Check dashboard'],
      ['OpenAI', '—', '—', 'Check platform.openai.com/usage'],
      ['Deepgram', '—', '—', 'Check console.deepgram.com'],
    ]
  )
  log()

  // ── 4. All Railway Projects (context) ──
  if (railway.length > 0) {
    log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    log(`  ALL RAILWAY PROJECTS (for reference)`)
    log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    log()
    tsv(
      ['Project', 'Monthly (USD)', 'SOPstart?'],
      railway
        .sort((a, b) => b.usd - a.usd)
        .map(r => [r.name, r.usd.toFixed(2), r.name === 'SOPstart' ? '✓' : ''])
    )
    const railwayTotal = railway.reduce((s, r) => s + r.usd, 0)
    log()
    log(`Total Railway: $${railwayTotal.toFixed(2)} USD/mo (SOPstart: $${sopstartRailway.toFixed(2)})`)
    log()
  }

  // ── 5. Stakeholder Summary (Google Sheets: Summary tab) ──
  log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  log(`  STAKEHOLDER SUMMARY — ${monthLabel}`)
  log(`  (paste into Google Sheets: Summary tab)`)
  log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  log()

  tsv(
    ['Stakeholder', 'Entity', 'Role', 'Hours', 'Rate', 'Amount (NZD)', 'Status'],
    [
      ['Simon', 'Potenco Pty Ltd', 'Tech Lead / Developer', hours, `$${RATE}/hr`, `$${devCost.toLocaleString()}`, 'Active'],
      ['Bobby', 'TBD', 'TBD', '—', '—', '—', 'TBD'],
      ['Joe Rolleston', '—', 'Project Leader', '—', '—', '—', 'TBD'],
      ['Bryce', '—', 'TBD', '—', '—', '—', 'TBD'],
    ]
  )
  log()
  tsv(
    ['Category', 'Amount', 'Currency', 'Paid By'],
    [
      ['Dev Time (Simon)', `$${devCost.toLocaleString()}`, 'NZD', 'Potenco — pending agreement'],
      ['Railway Hosting', `$${sopstartRailway.toFixed(2)}`, 'USD', 'Potenco'],
      ['API Costs (OpenAI/Deepgram/Shotstack)', '—', 'USD', 'Potenco — see dashboards'],
      ['Supabase', '—', 'USD', 'Potenco — see dashboard'],
    ]
  )
  log()

  // ── Save ──
  const costsDir = resolve(ROOT, '.planning/costs')
  mkdirSync(costsDir, { recursive: true })
  const reportFile = resolve(costsDir, `report-${month}.txt`)
  writeFileSync(reportFile, lines.join('\n'))
  console.log(`\nReport saved to: .planning/costs/report-${month}.txt`)

  // Try to copy to clipboard
  try {
    execSync('clip', { input: lines.join('\n'), encoding: 'utf-8' })
    console.log('Copied to clipboard — paste directly into Google Sheets')
  } catch {
    try {
      execSync('pbcopy', { input: lines.join('\n'), encoding: 'utf-8' })
      console.log('Copied to clipboard')
    } catch {
      console.log('(clipboard copy not available — use the saved file)')
    }
  }
}

main().catch(console.error)
