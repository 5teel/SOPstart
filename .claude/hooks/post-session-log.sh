#!/bin/bash
# Post-session hook: logs Claude session metadata to costs/sessions.jsonl
# Triggered at end of each Claude Code conversation

COSTS_DIR="$(git rev-parse --show-toplevel 2>/dev/null)/.planning/costs"
mkdir -p "$COSTS_DIR"

LOG_FILE="$COSTS_DIR/sessions.jsonl"

# Capture timestamp
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
DATE=$(date +"%Y-%m-%d")

# Append session entry (duration and tokens filled by the caller if available)
echo "{\"timestamp\":\"$TIMESTAMP\",\"date\":\"$DATE\",\"duration_mins\":${DURATION_MINS:-0},\"input_tokens\":${INPUT_TOKENS:-0},\"output_tokens\":${OUTPUT_TOKENS:-0},\"total_tokens\":${TOTAL_TOKENS:-0},\"estimated_cost_usd\":${ESTIMATED_COST:-0},\"notes\":\"${SESSION_NOTES:-}\"}" >> "$LOG_FILE"
