---
phase: 63-sop-first-home-library-site-map-and-the-sopstart-start
plan: 12
subsystem: testing
tags: [deployed-eval, home, site-map, playwright, screenshots]
requires: [63-11]
provides:
  - tests/evals/home.eval.ts (twelve deployed cases, no test.fixme)
affects: [63-13, 63-14, 63-15, 63-18, 63-21]
key-files:
  modified:
    - tests/evals/home.eval.ts
    - src/components/home/SopList.tsx
key-decisions:
  - "Sessions are minted once per role per file and replayed as cookies (loginAs cache): ~9 mints for 12 cases instead of ~20"
  - "Read cases use the Packing fixture SOP, not the walk fixture: its owner is the org admin by construction, so 'owner shown for a supervisor' cannot be an empty owner"
  - "The My record Notifications panel renders nothing when the person has none (by design), so it is proved by the bell case, which seeds one unread notification and removes it in afterAll"
requirements-completed: [HOME-01, MAP-04]
duration: 3h
completed: 2026-10-08
---

# Phase 63 Plan 12: Home deployed eval and first run Summary

**The new home is proven case by case on https://sopstart.com for worker, supervisor, safety manager and admin, at 1440 x 900 and 390 x 844, and on the real organisation's map (read-only): 12 of 12 cases green, every screenshot read, one product defect found and fixed.**

## Deployed sha tested

- Round 1 (cases 1-6, and the first pass of 7+): `678b9589` (63-11, the home as pushed).
- Rounds 2-3 (everything that was not green first time, plus the fix): `fffeb5f9` (this plan's fix and eval changes; `/api/version` confirmed serving it before the run; Railway status `success`).

## Results (last run of each case)

| # | Case | Result | Run / sha | Screenshots read (one-line reading) |
|---|---|---|---|---|
| 1 | HOME-01 worker: My SOPs + My record only, no room words | pass | 1 / 678b9589 | `63-home-worker-desktop`: menu has two entries and the account foot; list with Recent, All SOPs (10), four area groups; map pane with four plates and signs; no Smoko / Workshop / Noticeboard / Office / Walk wording in the chrome |
| 2 | HOME-01 sections per role, forged `?s=people` falls back | pass | 1 / 678b9589 | `63-home-sections-admin`: admin menu has six sections with Manage SOPs last, quiet, under a hairline; Sign-offs body shows Inbox / Requests / Decisions tabs and filter chips |
| 3 | HOME-02 area groups, Type groups, Recent order | pass | 1 / 678b9589 | `63-home-list-area`: four area headers by name with counts, rows name `Area · Type · ~min`; `63-home-list-type`: Machine 1, Process 7, Inspection 1, Emergency 1 groups with the fixture titles |
| 4 | HOME-02 Most used "done N×" | pass | 1 / 678b9589 | `63-home-most-used`: Recent holds walk fixture ("Signed off 8 Oct") and plant fixture ("You stopped at step 1"); Most used holds the walk fixture with "done 1×" |
| 5 | HOME-02 search: title, step word, miss with Ask for one (+ Write it for admin only) | pass | 3 / fffeb5f9 | `63-home-search-miss`: "No SOP for "zzqxwv"." with two evenly padded buttons, Ask for one and Write it (admin) |
| 6 | HOME-03 Read: chip, meta, steps with kinds, start; owner hidden for worker, shown for supervisor | pass | 1 / 678b9589 | `63-home-read-worker`: wordmark chip, title, `EVAL Area Packing · Process · v1 · ~8 min`, black `start` button, "4 steps", Make a request, four steps with HAZARD / PPE / STEP / CHECK chips, no owner; `63-home-read-supervisor`: same plus `owner eval-site-admin@sopstart.com` and Ask someone to do this |
| 7 | HOME-04 each section opens its body (Sign-offs, People, Training, Manage SOPs, Site & departments, My record) | pass | 3 / fffeb5f9 | `63-home-section-signoffs`, `-people` (six people, role selects, Invite someone), `-training` (filters, "No people with required SOPs in this cut" for the first department), `-manage` (New SOP, Site & departments, eight draft rows), `-site` (departments strip, machines list), `-record` ("0 completed procedures" for the admin) |
| 8 | HOME-04 bell dot opens My record with the Notifications heading focused | pass | 2 / 678b9589 | `63-home-bell-record`: NOTIFICATIONS heading with the seeded "63 eval bell dot" row (blue unread dot) under My record |
| 9 | MAP-03 zoom, filter, Esc, dimmed switch, object opens Read, keyboard Enter | pass | 2b / 678b9589 | `63-home-map-site`: whole site, four plates, signs with counts; `63-home-map-area`: Packing zoomed, breadcrumb "SOPstart Eval Site › EVAL Area Packing", filter chip "In EVAL Area Packing", one row, object title label "EVAL area Packing pallet wr…", other plates dimmed |
| 10 | MAP-04 phone: tab bar, List / Site map, numbered markers + key, Read full width, no sideways scroll | pass | 2b / 678b9589 | `63-home-phone-list` (wordmark, List / Site map toggle, search + bell, rows, tab bar SOPs / My record), `63-home-phone-map` (markers 1-4 on the plates, two-column key with counts), `63-home-phone-read` (‹ Site map, full-width `start`, steps with chip); `scrollWidth <= 390` asserted at every state |
| 11 | EVAL-01 real org map and list, read-only | pass | 2b / 678b9589 | `63-real-org-list`: 4 SOPs in Engineering / Forming / General, three plates; `63-real-org-map`: Machine objects on Forming and Engineering, a sign on General; `63-real-org-map-phone`: markers 1-3, key, six-tab bar for the admin, nothing clipped |
| 12 | DOCS-01 pathways reports `0 not mapped yet` | pass | 2b / 678b9589 | none (text assertion) |

Every PNG this file produced was read. `63-home-section-signoffs`, `-manage`, `-site` and `-record` were read from round 2 and re-shot unchanged in round 3; `63-home-people` and `-training` were read again after the fix because round 2 had caught them mid-load.

## Fixes

| Kind | Finding | Fix | Commit |
|---|---|---|---|
| Product (shell/list files) | **"Ask for one" button had no side padding**: the composer trigger's button has none and its wrapper shrinks to the text, so the label touched the border next to Write it (only visible in `63-home-search-miss.png`) | wrapper `[&_button]:px-4` in `SopList.tsx`; build green, gate Δ 0 (802 / 831 unchanged), design-token lint and phase63 specs green | `08cd8946` |
| Eval defect | Notifications panel assertion on an admin with none (panel renders nothing by design) | dropped; the bell case seeds one | `fffeb5f9` |
| Eval defect | A click on `plate.locator('polygon').first()` never resolved (an object glyph sits on the polygon's centre, so Playwright retried "intercepted" for the whole 5 minute test timeout) | `plate.click({ timeout: 10_000 })`: the hit target is a descendant of the plate group, as for a real user; objects use a real click with a dispatch fallback that did not fire | `fffeb5f9` |
| Eval defect | People and Training were shot while their bodies still said "Loading people…" / "Loading matrix…" and the assertions did not notice | wait for `people-loading` / "Loading matrix…" to go, then assert a `people-row` / a table or the empty line | `fffeb5f9` |
| Process slip | One run (the second) was spent on an unchanged file because the first edit was attempted with `python3`, which is not on this machine; the run re-minted sessions for nothing | use the Edit tool or `node` for scripted edits | n/a |

No red was an environment (OTP rate-limit) failure. Runs: 1 full file, 3 partial re-runs (one of them wasted as above, one a 5-minute hang), plus one throwaway probe spec (deleted, not committed) to prove My record counts a seeded completion.

## For the owning plans (not fixed here)

| Finding | Screenshot | Owner |
|---|---|---|
| My record's empty state button says "Back to the site" and links to `/`, which is the page the person is already on; "the site" is the old room language | `63-home-section-record` | 63-16 (word sweep) |
| Site & departments shows every department with the same default blue swatch while the map and list colour areas by index (teal, blue, purple, ...); picking a department colour there does not change the map | `63-home-section-site`, `63-home-map-site` | 63-08 / 63-10 (decide whether the department colour should drive the area colour) |
| Manage SOPs draft rows: status and "Carry on" are `text-meta` mono text with no tap target; fine with a mouse, not checked at 390 | `63-home-section-manage` | 63-08 |
| Training defaults to the first department by name (`EVAL Area Lab`), so a fixture admin opens an empty matrix | `63-home-section-training` | 63-09 (cosmetic; real orgs have people) |

## Deviations from Plan

1. **[Eval scope] Read cases use the Packing fixture SOP, not the walk fixture** (rationale in key-decisions). The "done N×" case does use the walk fixture, with one seeded `signed_off` completion removed in `afterAll`.
2. **[Eval scope] Extra screenshots** beyond the plan's list (`63-home-list-area`, `-list-type`, `-most-used`, `-section-*`, `-bell-record`) so every HOME-04 body is seen, not only asserted.
3. **[Eval scope] Cases 3 and 4 and the bell case were split out** of the plan's numbered list (twelve test titles instead of ten) so a red names one thing.
4. **Real-org plate count is a soft assertion** (`expect.soft`, recorded as 3): the real organisation is not ours to pin, and the screenshot is the proof.
5. `.bundle-baseline.json` untouched; the fix moved neither gate number.

## Requirements

- Ticked: **HOME-01** (63-11 + 63-12 both complete and proven on the deploy for every role), **MAP-04** (63-10, 63-11, 63-12 complete and proven at 390 px).
- Not ticked: HOME-02 (tool-name search and the live status line are not proven here), HOME-04 (63-14 still to retire `/activity` and `/admin/training`), MAP-03 (reduced-motion half not proven on the deploy), EVAL-01 (63-14 / 15 / 18 / 21 still owe addresses, the Start and the full run).

## Known Stubs

None.

## Threat Flags

None. T-63-34: the real-org case clicks only view state (tab, zoom) and never Start, Ask or a form; every write (completion, notification, lab step text) is in the eval-site org and the file refuses the real org id. T-63-35: one full run, then only failing cases (three partial re-runs; no OTP rate-limit string seen).

## Self-Check: PASSED

Commits present: `9c15988b` (cases), `08cd8946` (SopList fix), `fffeb5f9` (eval follow-up), all on origin/master at `fffeb5f9`. `tests/evals/home.eval.ts` has no `test.fixme`. `npx tsc --noEmit` and `npm run build` exit 0 (gate: detail 802 / 802, home 831 / 831).
