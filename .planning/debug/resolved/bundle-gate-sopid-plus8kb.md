---
status: resolved
trigger: "SB-LINE-06 bundle gate: /sops/[sopId]/page = 1056 KB (baseline 1048 KB, +8 KB, tolerance 2 KB) since e4e5c19 (Phase 53-03 /m/[code] route)"
created: 2026-09-29
updated: 2026-09-29
---

## Current Focus

reasoning_checkpoint:
  hypothesis: "/m/[code] adds a 5th consumer of the dexie/zustand 94 KB vendors module; the next/dynamic runtime (~10.5 KB unminified) no longer shares that module chunk-set key, is under the 20 KB minSize as a shared group, and falls into per-route defaultVendors (minChunks 1) candidates, which then cross 20 KB and split: 7978 for /sops/[sopId] (dynamic runtime + icons moved OUT of the uncounted page chunk) and 4528 for /sops (dynamic runtime duplicated again)"
  confirming_evidence:
    - "stats-375: dynamic runtime lives only in vendors chunk 136 (schema|sopId|sopsPage|builder); stats-head: it is in 3052, 3653, 4528, 5047, 7978 (one copy per route)"
    - "2780 (the 94 KB module) now serves schema|sopId|sopsPage|builder|m/[code] - m/[code] joined its key"
    - "sopId page chunk 66085 -> 60462 bytes; gate never counts it (manifest path is %5BsopId%5D, existsSync fails), so the 5.6 KB moved into counted 7978 reads as growth"
  falsification_test: "pin the dynamic runtime to one enforced cacheGroup; if 7978/4528 still form or gate stays > +2 KB, hypothesis is wrong"
  fix_rationale: "restores the single shared copy of the dynamic runtime regardless of which routes join the dexie module key, so per-route vendors candidates drop back under minSize - removes the duplication that caused the reshape rather than hiding bytes"
  blind_spots: "exact minified size of the new named chunk; whether other routes reshape"

next_action: add splitChunks cacheGroup for next lazy-dynamic runtime in next.config.ts; npm run build

## Symptoms

expected: npm run build postbuild gate green (both routes within +-2 KB of .bundle-baseline.json)
actual: /sops/[sopId]/page = 1056 KB (baseline 1048, +8 KB); /sops/page within tolerance
errors: check-bundle-size: /sops/[sopId]/page ... tolerance +-2 KB
reproduction: npm run build at HEAD e4a51e5
started: e4e5c19 (bisected; 375a642 passes at -1 KB)

## Eliminated

- hypothesis: MachineView being statically imported from the /m/[code] server page drives the reshape
  evidence: orchestrator loaded it through next/dynamic({ssr:false}) — still +8 KB
  timestamp: 2026-09-29

## Evidence

- timestamp: 2026-09-29
  checked: .planning/phases/53-phone-scan-or-ask/deferred-items.md bisection
  found: PASS at 375a642, FAIL at e4e5c19; 98 KB chunk 5501 replaced by four chunks (~117 KB)
  implication: chunk-graph reshape from new route sharing modules with the lazy plant cluster

- timestamp: 2026-09-29
  checked: chunk-group membership in webpack stats at 375a642 vs HEAD
  found: dynamic runtime single-copy in shared vendors 136 before; five per-route copies after (3052, 3653, 4528, 5047, 7978). Real browser bytes for /sops/[sopId] only +0.4 KB; gate delta +10.2 KB bytes is accounting (uncounted %5B page chunk + counted sibling /sops chunks)
  implication: fix the duplication, not the baseline

## Resolution

root_cause: /m/[code] joined the offline-db vendors chunk route set; next/dynamic runtime lost its shared placement (under 20 KB minSize) and was copied into per-route vendors chunks; on /sops/[sopId] that moved icons out of the uncounted %5B page chunk into counted chunk 7978
fix: enforced splitChunks cacheGroup nextDynamic in next.config.ts (one shared next-dynamic chunk)
verification: npm run build green, gate /sops/[sopId]/page 1048 (Δ0), /sops/page 940 (Δ0); baseline unchanged vs 736f44a; tsc clean; playwright phase53/52/26/15-stubs 381 passed 11 skipped
files_changed: [next.config.ts]
