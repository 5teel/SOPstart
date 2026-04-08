# SafeStart Cost Dashboard — Google Sheets Template

## Setup Instructions

1. Create a new Google Sheet: "SafeStart — Cost Dashboard"
2. Share with: Bobby, Joe, Bryce (view access), Simon (edit)
3. Create 5 tabs as described below
4. Paste the monthly report output into the relevant tabs each month
5. Save the sheet URL in this file below

**Sheet URL:** [paste here after creating]

---

## Tab 1: Dashboard (overview)

This is the landing tab everyone sees first. Build it from formulas referencing other tabs.

### Layout:

**Row 1-2:** Title bar
- A1: `SafeStart Cost Dashboard` (bold, 18pt, merge A1:F1)
- A2: `Updated: [date]` (10pt, grey)

**Row 4-5:** Summary Cards (use SUMIF from Actuals tab)
```
B4: "Dev Time"       C4: =SUMIF(Actuals!B:B,"{month}",Actuals!F:F)   D4: "NZD"
B5: "Infrastructure" C5: =SUMIF(Actuals!B:B,"{month}",Actuals!G:G)   D5: "USD"
```

**Row 7+:** Monthly trend chart
- Insert a chart from the Monthly tab data (line chart, months on X axis, stacked costs on Y)

**Row 20+:** Stakeholder table
- Pull from Stakeholders tab

### Conditional Formatting:
- Green (#22c55e) for cells < previous month
- Red (#ef4444) for cells > 120% of previous month
- Yellow (#eab308) for TBD/pending items

---

## Tab 2: Actuals

One row per expense. Paste monthly report "Infrastructure" section here.

| Column | Header | Format |
|--------|--------|--------|
| A | Date | YYYY-MM-DD |
| B | Month | YYYY-MM (for pivoting) |
| C | Category | Text: dev-time, railway, supabase, openai, deepgram, shotstack, other |
| D | Description | Text |
| E | Person/Entity | Text |
| F | Amount (NZD) | Number, 2 decimal |
| G | Amount (USD) | Number, 2 decimal |
| H | Receipt/Source | URL or "git-derived" / "api-fetched" / "dashboard" |

### Monthly data entry:
```
2026-04-08  2026-04  dev-time   Development (21.9h @ $100/hr)  Potenco  2190.00  —       git-derived
2026-04-08  2026-04  railway    SOPstart hosting               Potenco  —        33.87   api-fetched
2026-04-08  2026-04  openai     GPT-4o + TTS                   Potenco  —        [amt]   dashboard
2026-04-08  2026-04  deepgram   Audio transcription             Potenco  —        [amt]   dashboard
2026-04-08  2026-04  shotstack  Video rendering credits         Potenco  —        [amt]   dashboard
2026-04-08  2026-04  supabase   Database + storage + auth       Potenco  —        [amt]   dashboard
```

---

## Tab 3: Time Log

Weekly dev time breakdown. Paste from monthly report "Dev Time" section.

| Column | Header | Format |
|--------|--------|--------|
| A | Month | YYYY-MM |
| B | Week | Date range |
| C | Person | Name |
| D | Active Days | Number |
| E | Commits | Number |
| F | Est. Hours | Number, 1 decimal |
| G | Rate (NZD/hr) | Number |
| H | Amount (NZD) | =F*G |

### Footer formulas:
- `=SUMIF(A:A,"2026-04",F:F)` — total hours for month
- `=SUMPRODUCT((A:A="2026-04")*H:H)` — total cost for month

---

## Tab 4: Monthly

Running monthly totals for the trend chart. One row per month.

| Column | Header |
|--------|--------|
| A | Month |
| B | Dev Hours |
| C | Dev Cost (NZD) |
| D | Railway (USD) |
| E | OpenAI (USD) |
| F | Deepgram (USD) |
| G | Shotstack (USD) |
| H | Supabase (USD) |
| I | Total Infra (USD) |
| J | Notes |

Formula: `I2 = SUM(D2:H2)`

### Chart:
- Stacked bar chart: months on X, D:H stacked on Y (infra breakdown)
- Line overlay: C column (dev cost) on secondary Y axis

---

## Tab 5: Stakeholders

Static reference tab. Update when agreements change.

| Column | Header |
|--------|--------|
| A | Name |
| B | Entity |
| C | Role |
| D | Rate (NZD/hr) |
| E | Cost Share % |
| F | Status |
| G | Notes |

### Initial data:
```
Simon       Potenco Pty Ltd   Tech Lead / Developer  100  TBD  Active   99% of dev work
Bobby       TBD               TBD                    TBD  TBD  TBD
Joe Rolleston  —              Project Leader          TBD  TBD  TBD
Bryce       —                 TBD                    TBD  TBD  TBD
```

---

## Monthly Workflow

1. Run: `node scripts/monthly-report.mjs --month=YYYY-MM`
2. Report is auto-copied to clipboard
3. Paste the relevant sections into each tab
4. Fill in manual costs from dashboards (Shotstack, Supabase, OpenAI, Deepgram)
5. Update the Monthly tab with the row for this month
6. Dashboard tab auto-updates from formulas

Time: ~5 minutes per month.
