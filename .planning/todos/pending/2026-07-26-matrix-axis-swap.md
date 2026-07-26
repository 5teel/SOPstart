---
created: 2026-07-26
title: "Training matrix: axis-swap toggle (SOPs as rows, workers as columns)"
area: admin-team
source: Phase 35 UAT (Simon, Test 2) — sopstart.com live matrix review
suggested: small enhancement; fold into Phase 36+ or a quick task
files:
  - src/components/admin/matrix (matrix view components)
---

# Training matrix: axis-swap toggle

During Phase 35 UAT Simon asked for the ability to transpose the matrix —
workers heading the columns and SOPs as row entries — in addition to the
current SOPs-as-columns layout.

Useful when an org has few workers but many SOPs (current layout gets very
wide), or when reviewing one department's SOP coverage top-to-bottom.

Likely a single toggle in the matrix header that swaps the row/column
mapping before render; pill/rollup logic is symmetric so state derivation
is unchanged. Check compaction/ResizeObserver logic (D-07) handles the
transposed shape.
