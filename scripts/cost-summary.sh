#!/bin/bash
# Cost Summary — rolls up API costs, dev time, and infra into a shareable report
# Usage: ./scripts/cost-summary.sh [month] (default: current month)
# Output: table format ready to paste into Google Sheets

MONTH="${1:-$(date +%Y-%m)}"
COSTS_DIR="$(git rev-parse --show-toplevel)/.planning/costs"
RATE=100

echo "============================================"
echo " SafeStart Cost Summary — $MONTH"
echo "============================================"
echo ""

# --- Claude API Sessions ---
echo "## Claude API Sessions"
if [ -f "$COSTS_DIR/sessions.jsonl" ]; then
  MONTH_SESSIONS=$(grep "\"date\":\"$MONTH" "$COSTS_DIR/sessions.jsonl" 2>/dev/null || true)
  if [ -n "$MONTH_SESSIONS" ]; then
    SESSION_COUNT=$(echo "$MONTH_SESSIONS" | wc -l | tr -d ' ')
    TOTAL_TOKENS=$(echo "$MONTH_SESSIONS" | grep -oP '"total_tokens":\K[0-9]+' | paste -sd+ | bc 2>/dev/null || echo 0)
    TOTAL_COST=$(echo "$MONTH_SESSIONS" | grep -oP '"estimated_cost_usd":\K[0-9.]+' | paste -sd+ | bc 2>/dev/null || echo 0)
    echo "  Sessions:     $SESSION_COUNT"
    echo "  Total tokens: $TOTAL_TOKENS"
    echo "  Est. cost:    \$${TOTAL_COST} USD"
  else
    echo "  No sessions logged for $MONTH"
  fi
else
  echo "  No session log found"
fi
echo ""

# --- Dev Time (from git) ---
echo "## Dev Time (git-derived)"
MONTH_START="${MONTH}-01"
# Get last day of month
MONTH_END=$(date -d "$MONTH_START + 1 month - 1 day" +%Y-%m-%d 2>/dev/null || echo "${MONTH}-31")

COMMITS=$(git log --format="%aI" --author="$(git config user.name)" --since="$MONTH_START" --until="$MONTH_END" --reverse 2>/dev/null)
if [ -n "$COMMITS" ]; then
  COMMIT_COUNT=$(echo "$COMMITS" | wc -l | tr -d ' ')

  TOTAL_MINUTES=0
  SESSION_COUNT=0
  PREV_TS=0

  while IFS= read -r iso_ts; do
    TS=$(date -d "$iso_ts" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%S" "${iso_ts%%+*}" +%s 2>/dev/null)
    if [ "$PREV_TS" -eq 0 ]; then
      SESSION_COUNT=$((SESSION_COUNT + 1))
      TOTAL_MINUTES=$((TOTAL_MINUTES + 15))
      PREV_TS=$TS
      continue
    fi
    GAP=$(( (TS - PREV_TS) / 60 ))
    if [ "$GAP" -gt 30 ]; then
      SESSION_COUNT=$((SESSION_COUNT + 1))
      TOTAL_MINUTES=$((TOTAL_MINUTES + 15))
    else
      TOTAL_MINUTES=$((TOTAL_MINUTES + GAP))
    fi
    PREV_TS=$TS
  done <<< "$COMMITS"

  TOTAL_HOURS=$(awk "BEGIN {printf \"%.1f\", $TOTAL_MINUTES / 60}")
  TOTAL_COST=$(awk "BEGIN {printf \"%.0f\", $TOTAL_MINUTES / 60 * $RATE}")

  echo "  Commits:    $COMMIT_COUNT"
  echo "  Sessions:   $SESSION_COUNT"
  echo "  Est. hours: ${TOTAL_HOURS}h"
  echo "  Est. cost:  \$${TOTAL_COST} NZD (@ \$${RATE}/hr)"
else
  echo "  No commits for $MONTH"
fi
echo ""

# --- Manual Expenses ---
echo "## Infrastructure & Services"
EXPENSES_FILE="$COSTS_DIR/expenses.csv"
if [ -f "$EXPENSES_FILE" ]; then
  echo "  Date,Category,Description,Amount,Currency,Paid By"
  grep "^$MONTH" "$EXPENSES_FILE" 2>/dev/null || echo "  No expenses logged for $MONTH"
else
  echo "  No expenses file. Create $COSTS_DIR/expenses.csv with:"
  echo "  date,category,description,amount,currency,paid_by"
  echo "  2026-04-08,infrastructure,Railway Pro,20.00,USD,Potenco"
fi
echo ""

echo "============================================"
echo " Paste into Google Sheet: Actuals tab"
echo "============================================"
