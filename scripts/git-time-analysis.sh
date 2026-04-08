#!/bin/bash
# Git Time Analysis — estimates dev hours from commit history
# Usage: ./scripts/git-time-analysis.sh [--since=2026-04-01] [--until=2026-04-30]
#
# Logic: commits within 30 minutes of each other = same session
# First commit in a cluster gets a 15-minute lead-in (setup/reading time)
# Gap > 30 min = new session

SINCE="${1:---since=2026-03-01}"
UNTIL="${2:---until=$(date +%Y-%m-%d)}"
RATE=100  # NZD per hour

echo "============================================"
echo " SafeStart Dev Time Analysis"
echo " $SINCE  $UNTIL"
echo " Rate: \$${RATE}/hr"
echo "============================================"
echo ""

# Get all commit timestamps sorted ascending
COMMITS=$(git log --format="%aI" --author="$(git config user.name)" $SINCE $UNTIL --reverse 2>/dev/null)

if [ -z "$COMMITS" ]; then
  echo "No commits found in range."
  exit 0
fi

TOTAL_MINUTES=0
SESSION_COUNT=0
PREV_TS=0

while IFS= read -r iso_ts; do
  # Convert ISO timestamp to epoch seconds
  TS=$(date -d "$iso_ts" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%S" "${iso_ts%%+*}" +%s 2>/dev/null)

  if [ "$PREV_TS" -eq 0 ]; then
    # First commit — start new session with 15 min lead-in
    SESSION_COUNT=$((SESSION_COUNT + 1))
    TOTAL_MINUTES=$((TOTAL_MINUTES + 15))
    PREV_TS=$TS
    continue
  fi

  GAP=$(( (TS - PREV_TS) / 60 ))

  if [ "$GAP" -gt 30 ]; then
    # New session — close previous, start new with 15 min lead-in
    SESSION_COUNT=$((SESSION_COUNT + 1))
    TOTAL_MINUTES=$((TOTAL_MINUTES + 15))
  else
    # Same session — add the gap time
    TOTAL_MINUTES=$((TOTAL_MINUTES + GAP))
  fi

  PREV_TS=$TS
done <<< "$COMMITS"

TOTAL_HOURS=$(awk "BEGIN {printf \"%.1f\", $TOTAL_MINUTES / 60}")
TOTAL_COST=$(awk "BEGIN {printf \"%.0f\", $TOTAL_MINUTES / 60 * $RATE}")
COMMIT_COUNT=$(echo "$COMMITS" | wc -l | tr -d ' ')

echo "Sessions:    $SESSION_COUNT"
echo "Commits:     $COMMIT_COUNT"
echo "Est. hours:  ${TOTAL_HOURS}h"
echo "Est. cost:   \$${TOTAL_COST} NZD (@ \$${RATE}/hr)"
echo ""

# Weekly breakdown
echo "--- Weekly Breakdown ---"
git log --format="%aI" --author="$(git config user.name)" $SINCE $UNTIL | while IFS= read -r ts; do
  date -d "$ts" +%Y-W%V 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%S" "${ts%%+*}" +%Y-W%V 2>/dev/null
done | sort | uniq -c | while read count week; do
  echo "  $week: $count commits"
done

echo ""
echo "--- Daily Breakdown (last 14 days) ---"
git log --format="%aI" --author="$(git config user.name)" --since="14 days ago" | while IFS= read -r ts; do
  date -d "$ts" +%Y-%m-%d 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%S" "${ts%%+*}" +%Y-%m-%d 2>/dev/null
done | sort | uniq -c | while read count day; do
  echo "  $day: $count commits"
done
