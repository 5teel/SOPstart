# SafeStart Cost Tracking

## Structure

- `sessions.jsonl` — Auto-logged Claude session metadata (appended per conversation)
- `expenses.csv` — Manual expense entries (infra, API bills, tools, travel)
- `README.md` — This file

## Scripts

- `scripts/git-time-analysis.sh` — Estimate dev hours from git commit history
- `scripts/cost-summary.sh [YYYY-MM]` — Monthly rollup of all cost categories
- `scripts/cost-report.js` — Generate Google Sheets-ready report (coming)

## Rate Card

| Person | Entity | Role | Rate (NZD/hr) |
|--------|--------|------|---------------|
| Simon | Potenco Pty Ltd | Tech lead / Developer | $100 |
| Bobby | TBD | TBD | TBD |
| Joe Rolleston | — | Project leader | TBD |
| Bryce | — | TBD | TBD |

## Expense Categories

- `api` — OpenAI, Anthropic, Shotstack, Whisper
- `infrastructure` — Railway, Supabase, domains, DNS
- `tools` — Software licenses, dev tools
- `research` — Interview costs, travel, user testing
- `other` — Miscellaneous

## Logging Expenses

Add a row to `expenses.csv`:
```
2026-04-08,infrastructure,Railway Pro April,20.00,USD,Potenco
```

## Google Sheet

Shared cost tracking sheet: [link TBD — create and paste URL here]

Tabs:
1. **Actuals** — all expenses, auto-populated from cost-summary.sh output
2. **Time Log** — weekly hours per person
3. **Monthly Summary** — pivot by category and stakeholder
4. **Forecast** — projected monthly burn
5. **Stakeholder Split** — cost-sharing formula (TBD)
