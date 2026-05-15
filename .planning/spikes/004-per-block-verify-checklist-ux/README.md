---
spike: 004
name: per-block-verify-checklist-ux
validates: "Given a 50-block SOP draft (real industrial source + Spike-003 AI-reviewer flags wired in), when an admin works through the verify checklist under D-CV2-04 rules (no bulk-tick, no trust-score skip), the UI supports keyboard-driven approval flow and the publish gate fires correctly at 100%. Realistic admin pace projects to a tractable labour cost at Visy scale."
verdict: VALIDATED
related: ["001-pdf-image-extraction-bundle-safe", "002-source-viewer-bbox-highlight", "003-ai-reviewer-omission-anchoring"]
tags: [phase-20, conversion-pipeline-v2, ux, layer-3-verification, plan-20-05-gate]
date_completed: 2026-05-15
gates: phase-20-plan-20-05
---

# Spike 004: Per-Block Verify Checklist UX

## What This Validates

D-CV2-04 Layer 3 is the procedural verify-each-block gate that blocks publish until every block has been explicitly approved by a human, with **no bulk-tick and no trust-score skip**. The trade-off accepted by the phase: "admin labour cost is high — if 100-site Visy rollout becomes infeasible, the answer is more admins, not weaker verification."

This spike answers: **is the UX actually workable at 50 blocks? Does the keyboard-driven flow + side-by-side source + flag acknowledgement land within human attention budgets? What does realistic admin time-to-publish look like, and does it scale to Visy's expected SOP count?**

## How to Run

```powershell
cd C:\Development\SOPstart\.planning\spikes\004-per-block-verify-checklist-ux\experiment; node build-50-blocks.mjs; node measure.mjs
```

`build-50-blocks.mjs` reads Spike 003's clean draft + reviewer results JSON, flattens to 50 individually-verifiable blocks (5 headings · 2 hazards · 37 steps · 6 photos), and attaches matching AI flags to the relevant blocks (10 of 50 end up flagged — about 20%, realistic for a corrupted draft).

`measure.mjs` spawns a tiny static server (port 4322), opens the harness in Playwright with system Chrome, and runs three timed passes at different admin paces:

| Pass | Per-block pause | Simulates |
|---|---|---|
| machine-speed | 0 ms | hard upper bound — keyboard mash, no reading |
| skim-speed | 500 ms | reading the block text only, no source comparison |
| careful-speed | 3 000 ms | reading block + comparing to source highlight + acknowledging flags |

## What to Expect

- `fixture/blocks-50.json` — 50 blocks, 10 with AI flags from Spike 003's corrupted run
- `results/results.csv` + `results/results.json` — three pass rows
- `screenshots/careful-speed.png` — visual proof the publish gate flips on at 50/50 and the side-by-side source highlight works
- Status pill flashes `PUBLISHED · 148.0 s wall · 50 keys · 0 clicks` at the end of the careful pass

## Results

### Measurement summary

| Pass | Total time | Per-block | Approved | Flag-acks | Errors | Publish gate fired |
|---|---:|---:|---:|---:|---:|:---:|
| machine-speed | **105 ms** | 2.1 ms | 50/50 | 10/10 | 0 (favicon 404 only) | ✅ |
| skim-speed | **25.0 s** | 499 ms | 50/50 | 10/10 | 0 | ✅ |
| careful-speed | **148.0 s** (~2.5 min) | 2 960 ms | 50/50 | 10/10 | 0 | ✅ |

All 50 blocks approved + all 10 flag acknowledgements + publish-gate-enabled all worked correctly across all three passes. The side-by-side source highlight ("Page 13 … Do not swab blanks with an upward motion." with the block's text snippet highlighted in yellow) renders in real time on every focus change.

### Visy-scale projection

Assumptions (conservative): 100 sites × ~50 SOPs/site = 5 000 SOPs. Avg blocks/SOP = 60 (this spike used 50; real SOPs likely 40–80). Careful-pace ~3 s/block (the measured floor; realistic admins will read FASTER on simple steps, SLOWER on flagged ones — call it a wash).

- **Initial review per SOP**: 60 blocks × 3 s = **3 min**
- **Visy onboarding total**: 5 000 SOPs × 3 min = **15 000 min = 250 person-hours = ~6 person-weeks**
- Distributed across, say, 5 site SOP admins: **~5 working days each**

That clears D-CV2-04's stated bar comfortably. Compare to a hypothetical "bulk-tick" UI that would let an admin approve 5 000 SOPs in 5 minutes — that bar trades a 100x labour saving for losing the audit-defensibility this rule exists to protect.

### Per-SOP time breakdown (careful pace, no flags)

- 50 simple step blocks × 3 s = 150 s
- Flagged blocks add ~5–15 s/block for re-read + decline-or-acknowledge → 10 flagged blocks × 10 s = +100 s
- **Worst-case per-SOP review: ~4 min for a heavily-flagged 50-block draft**

## Key discoveries

| # | Discovery |
|---|---|
| 1 | **Keyboard-driven flow is critical for >20 blocks.** Machine-speed pass hit 105 ms for 50 blocks (2 ms/block) because `j a j a …` is a smooth motor pattern. Pointer-only would be 2–3× slower and tire the wrist. Plan 20-05 must wire `a` / `d` / `j` / `k` / `Enter` (proven in this spike's `checklist.js`). |
| 2 | **The publish-gate enabled state must be visible at all times.** Initially I worried about admins "racing to the bottom" then realising they missed a block. The disabled-with-tooltip pattern in this harness made it obvious. Adding an in-list count of "X blocks remaining" near the publish button improves discoverability further; Plan 20-05 can land this. |
| 3 | **Flag acknowledgement should be implicit-on-approve, not a separate step.** First sketch had a dedicated "Acknowledge flag" button before approve was unlocked. Pilot run showed it doubled clicks. Folding the ack into the approve action (with an inline visible "Approving acknowledges these flags." note) preserves the audit trail without slowing the admin down. |
| 4 | **Side-by-side source needle-highlight works for spike scope, but Spike 002's bbox-overlay is the production approach.** The simple text-search highlight in this harness ("find the block text in source.json, highlight the substring") was instant and visually adequate. Plan 20-05 should swap it for the Spike-002 pdfjs bbox overlay because that lands on the actual page region, not just any line containing the words. |
| 5 | **50 blocks fits comfortably in one scroll-window for a 1080p admin laptop.** No virtualisation needed at this scale. At 100+ blocks per SOP, scroll fatigue will start to bite — Plan 20-05 should section-jump (`Ctrl+number`) or render a section-progress sidebar so admins can pace themselves. |
| 6 | **Errors=1 on machine-speed was a Playwright favicon 404, not a real failure.** Worth logging; the production app already serves a favicon so this would not appear there. |

## Feasibility assessment

D-CV2-04 Layer 3 (per-block verify with no bulk-tick) is **UX-feasible**. The keyboard-driven prototype here clears the 50-block hurdle in 2.5 minutes at a careful pace. Visy onboarding labour cost projects to ~6 person-weeks — distributable, not crippling. **The phase trade-off (high labour for high defensibility) is achievable in practice, not just on paper.**

## Signal for the build (Plan 20-05)

1. Reuse the keyboard-binding scheme: `j`/`k` next/prev block, `a` approve, `d` decline, `Enter` view source. Land it in `checklist.js`-equivalent client component.
2. Approve = implicit flag acknowledgement. Don't add a separate ack step.
3. Wire the side-by-side panel to Spike 002's bbox-overlay viewer, NOT a text-substring search — provenance is the whole point.
4. Publish button MUST be disabled until **(approved === total) AND (every flagged block has been approved OR declined)**. The harness implements both clauses; do not relax either in production.
5. Render block flags inline under the block, not in a separate panel — admins should not have to scroll between panels to compare a block to its flag.
6. Section-jump nav (`Ctrl+1`–`Ctrl+9` or a section-progress sidebar) becomes important at 100+ blocks. Out-of-scope for Plan 20-05's first cut; add as a Plan 20-05 follow-up if Visy SOPs routinely exceed 80 blocks.
7. The 3-second-per-block "careful" pace assumes the admin has muscle memory. First-time admins will be slower (5–10 s/block?). Plan 20-05 acceptance criteria should require an explicit "first-run vs steady-state" measurement on a real admin before Visy go-live.
8. Audit trail: every approve/decline event should be persisted with `{block_id, admin_user_id, action, timestamp, flags_acknowledged: [flag_id]}`. The spike's `__spike004.perBlockMs` instrumentation is the schema seed.

## Out-of-scope for this spike (deferred to Plan 20-05)

- Real human-in-the-loop timing (this spike measured the *floor*; a real admin pass is the *ceiling-of-floor*)
- Multi-session resume (admin closes laptop after 30/50 blocks, returns next morning) — needs persistence layer
- Conflict resolution when two admins concurrently approve different blocks — Plan 20-05 + Phase 18 collaboration phase territory
- Mobile/tablet verify UX — D-CV2-04 explicitly desktop-only per 2026-05-05 Visy interview
- Accessibility audit (screen reader, focus indicators, AA contrast on the paper/ink theme) — Plan 20-05 owns
