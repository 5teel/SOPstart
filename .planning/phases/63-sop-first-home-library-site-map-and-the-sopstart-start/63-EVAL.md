# Phase 63 deployed eval (63-21 sign-off)

Target https://sopstart.com. Product under test: `07a9f65c` (served by `/api/version` before the run; the fix commit of this plan). One full `npm run eval -- --phase 63` run (97 cases), every screenshot read, then re-runs of only the failing file and the new case. `4ec54a1d` (eval-only changes) was pushed after the run; the product did not change between the two.

## Result

| Run | Sha served | Cases | Pass | Fail | Skipped |
|---|---|---|---|---|---|
| Full run (`npm run eval -- --phase 63`) | `07a9f65c` | 97 | 89 | 1 (`requests` 60-14, eval defect) | 7 (the rest of `requests`, serial describe) |
| Re-run `requests.eval.ts`, whole file, `--workers=1 --retries=0` | `07a9f65c` product | 11 | 11 | 0 | 0 |
| New case in `home.eval.ts` (`-g "Carry on is a tap target"`) | `07a9f65c` product | 1 | 1 | 0 | 0 |
| **Final** | | **98** | **98** | **0** | **0** |

One annotation, not a failure: `office.eval` people case, invite leg: **"not proven this run: the mailer rate limit answered"** (screen: "email rate limit exceeded", shot `59-people-invite-limited`). Environment limit (CLAUDE.md 2026-10-06 (4)), second run in a row (63-18, 63-21). See "Open".

### Per file (final)

| File | Cases | Result |
|---|---|---|
| `home.eval.ts` | 16 | 16 pass (15 in the full run, the 16th is new, below) |
| `home-addresses.eval.ts` | 5 | 5 pass |
| `start.eval.ts` | 5 | 5 pass |
| `office.eval.ts` | 19 | 19 pass (invite leg annotated, above) |
| `requests.eval.ts` | 11 | 11 pass (full run: 3 pass, 1 fail, 7 skipped; whole file re-run: 11 pass) |
| `sop-focus.eval.ts` | 18 | 18 pass |
| `cut-features.eval.ts` | 6 | 6 pass |
| `sop-ledger.eval.ts` | 6 | 6 pass |
| `dead-surface.eval.ts` | 3 | 3 pass |
| `site-templates.eval.ts` | 4 | 4 pass |
| `site-editor.eval.ts` | 2 | 2 pass |
| `welcome.eval.ts` | 3 | 3 pass |

## Phase 63 cases

### home.eval.ts (the SOP-first home)

| Case | Result | Screenshots read |
|---|---|---|
| HOME-01 worker sees My SOPs and My record only, no room words | pass | `63-home-worker-desktop` |
| HOME-01 sections per role and a forged section falls back | pass | `63-home-sections-admin` (+ supervisor / safety-manager asserted) |
| HOME-02 Recent, All SOPs by area and by type | pass | `63-home-list-area`, `63-home-list-type` |
| HOME-02 Most used with "done N×" | pass | `63-home-most-used` |
| HOME-02 search by title, by step text, a miss offers Ask (admin also Write it) | pass | `63-home-search-miss` |
| HOME-03 Read: chip, meta, steps with kinds, start; owner hidden for worker, shown for supervisor | pass | `63-home-read-worker`, `63-home-read-supervisor` |
| HOME-03 two SOPs in a row, no stale Read | pass | `63-home-two-reads` |
| HOME-03 admin Read offers Edit, which opens the editor | pass | `63-home-read-admin` |
| HOME-04 Sign-offs, People, Training, Manage SOPs and My record open their bodies | pass | `63-home-section-signoffs`, `-people`, `-training`, `-manage`, `-site`, `-record` |
| **HOME-04 Manage: Carry on is a tap target at 390 px; Site & departments keeps its canvas on screen at 900 px and its dots wear the map colours** (new, 63-21) | pass | `63-home-phone-manage`, `63-home-site-fold` |
| HOME-04 the bell dot opens My record with the Notifications heading focused | pass | `63-home-bell-record` |
| HOME-05 a SOP address opens Read on load; an address naming no SOP / a lacking section is the list | pass | (asserted; list shot) |
| MAP-03 area click zooms and filters, Esc returns, dimmed area switches, object opens Read | pass | `63-home-map-site`, `63-home-map-area` |
| MAP-04 phone: tab bar, List / Site map, numbered markers and key, Read with back link, no sideways scroll | pass | `63-home-phone-list`, `63-home-phone-map`, `63-home-phone-read` |
| EVAL-01 real org map and list, read-only | pass | `63-real-org-list`, `63-real-org-map`, `63-real-org-map-phone` |
| DOCS-01 pathways map reports zero unmapped screens | pass | (assertion) |

### home-addresses.eval.ts

| Case | Result | Screenshots read |
|---|---|---|
| legacy `?place=` addresses land on their section | pass | `63-addr-place-office`, `-office-people`, `-office-requests`, `-edit`, `-dept`, `-smoko`, `-workshop`, `-noticeboard` |
| `/activity`, `/admin/training`, `/admin/team`, `/governance`, `/admin/site` redirect to their sections | pass | `63-addr-redirect-activity`, `-training`, `-team`, `-governance`, `-site`, `-worker-activity` |
| a stored notification place opens the right section | pass | `63-addr-note-before`, `63-addr-note-after` |
| Back from a bridged page returns to its section | pass | `63-addr-completion-admin-away`, `63-addr-completion-worker` |
| signed-out `/` still shows the promo reel | pass | `63-addr-signed-out` |

### start.eval.ts (the Start)

| Case | Result | Screenshots read |
|---|---|---|
| FUSE-01 start plays the merge into the running SOP (slow-motion frames) | pass | `63-fuse-0-read` .. `63-fuse-8-running`, see frames |
| FUSE-01 the second start of the day is short; reduced motion cuts | pass | `63-fuse-reduced` |
| FUSE-02 start lands on the first step; Stop returns to Read; a second start works | pass | `63-fuse-landed`, `63-fuse-stopped-read` |
| FUSE-02 a stopped SOP picks up at step N; begin from step 1 asks first | pass | `63-fuse-resume-read`, `63-fuse-begin-again`, `63-fuse-kept-going` |
| FUSE-01 the merge on a phone (390 px, slow motion) | pass | `63-fuse-phone-1` .. `-5`, `63-fuse-phone-running` |

## Screenshots read (every PNG in `.planning/evals/latest/`, 205)

### The six `63-fuse-*` frames (slow motion x4, desktop) and the rest of the Start shots

| Shot | What it shows |
|---|---|
| `63-fuse-0-read` | Read of the walk fixture at rest: SOP chip, title, black `start`, five steps with kind chips |
| `63-fuse-1` | 166 ms: Read still whole, veil a few percent in, button barely paler |
| `63-fuse-2` | Read ~90% dissolved to paper; the button is pale grey with the word `start` turning from white to ink; the chip stays black; no skeleton or other page visible |
| `63-fuse-3` | Pure paper; the chip has begun to drop, `start` alone in ink where the button was |
| `63-fuse-4` | Chip and `start` in line, small, left of centre |
| `63-fuse-5` | Chip and `start` slid together, centred |
| `63-fuse-6` | Hazard tape (dashes) sliding in from the left under the mark |
| `63-fuse-7` | The mark has risen into the focus top bar (tape visible), step 1 header and the hazard card fading in; the continue button still dark grey |
| `63-fuse-8-running` | Running SOP: hazard step 1 of 5, rail with first row current and the rest locked, wordmark in the bar |
| `63-fuse-landed` | Same, after a normal start: hazard step, no browse page, no autostart placeholder |
| `63-fuse-reduced` | Reduced motion: the running hazard step, nothing left in the layer |
| `63-fuse-stopped-read` | Back on Read after Stop: "You stopped at step 1", "Picks up at step 1 of 5 · or begin from step 1", row in Recent |
| `63-fuse-resume-read` | Read of a SOP stopped at step 3: status line, one `start`, "Picks up at step 3 of 5 · or begin from step 1" |
| `63-fuse-begin-again` | Focus page with the discard dialog open over the browse document: "Start over?", red Start over, Keep going |
| `63-fuse-kept-going` | After Keep going: dialog gone, the resume card carries **one** `start` (fix 1: the sticky duplicate is gone), "Picks up at step 3 of 5", "or begin from step 1" |
| `63-fuse-phone-1` | 390 px Read: back link, chip, title, full-width `start`, steps; bottom tab bar SOPs / My record |
| `63-fuse-phone-2`, `-3`, `-4` | Phone merge: chip and word alone on paper, in line, then the tape under the mark |
| `63-fuse-phone-5`, `63-fuse-phone-running` | Mark in the bar with tape; hazard step; Steps / Stop; continue button dark; no sideways scroll |

### The real organisation (read-only)

| Shot | What it shows |
|---|---|
| `63-real-org-list` | List grouped by area: Engineering 1, Forming 2, General 1; four real SOPs; sidebar with all admin sections; the real names are not asserted |
| `63-real-org-map` | Three raised plates (Engineering cyan, Forming blue, General purple), one SOP object each (tank, machine row, sign), area signs with names and counts, nothing clipped or overlapping |
| `63-real-org-map-phone` | 390 px: three plates with numbered markers 1/2/3 and a two-column key (Engineering, Forming, General) with counts; six-tab admin bar fits |

### Home and section shots

| Shot(s) | What they show |
|---|---|
| `63-home-worker-desktop` | Wordmark with hazard tape in the menu; My SOPs, My record, no counts on the menu; Recent, All SOPs by area, isometric map with four labelled areas; no room word, no "walk" |
| `63-home-list-area`, `-list-type`, `-most-used`, `-map-site`, `-map-area` | Area and Type groupings; Most used "done 1x"; zoomed area with a breadcrumb, a filter chip and the other plates dimmed |
| `63-home-read-worker`, `-supervisor`, `-admin`, `-two-reads` | Read for each role: owner only for supervisor and up, Edit only for admin, no stale content on the second SOP |
| `63-home-search-miss` | "No SOP for ..." with Ask for one and Write it |
| `63-home-section-signoffs`, `-people`, `-training`, `-manage`, `-site`, `-record`, `-sections-admin`, `-bell-record` | Each section's body at 1440 x 900, headings fully visible (the first contact sheets overlapped them with their own labels; re-read at full size) |
| `63-home-phone-list`, `-phone-map`, `-phone-read`, `-phone-manage` | Phone list with List / Site map, tab bar; map with markers and key; Read with "‹ SOPs" back; Manage at 390 px: Carry on links on every draft row, nothing sideways |
| `63-home-site-fold` | Site & departments at 1440 x 900: three department cards side by side, whole canvas and machine list on screen; dots teal / blue / purple = the map's first three area colours |
| `63-addr-*` (19) | Every address lands on the right section with the right menu item lit; the note-after frame is a loading skeleton by design |

### Sibling evals (58, 59, 60, cut, ledger, templates, site editor, welcome)

All read at contact-sheet scale and the ones that mattered at full size. Nothing unexpected: the focus screen (browse, walk, review, sent, editor with AI findings, parse stages, superseded), the Sign-offs / Decisions / People / Access screens, Make a request and the Ask picker (the popover sits at full width, not a one-word column), the objective editor and meta rows, the four site templates with department dots now in the map's colours, the login / sign-up / not-found / profile screens, and the promo reel (desktop and phone, no "walk" or "Show me" on a scene card; the file name `...-5-walk` is a scene id).

Deliberate: the AI findings panel in the editor keeps a **Show me** button (`58-edit-ai-findings`). It scrolls to a finding and is allowlisted with its reason in `tests/lint/no-walk-words.spec.ts` (63-16): the banned phrase was the old start label.

## Defects found and what became of them

| # | Found by | Class | What | Fix / owner |
|---|---|---|---|---|
| 1 | 63-18 note, `58-resume`, `63-fuse-kept-going` | product | Resume screen showed two identical `start` buttons (resume card + sticky) | Fixed `07a9f65c`: the sticky one is hidden while the resume card is shown. Verified in `63-fuse-kept-going` |
| 2 | 63-18 note | product | Site & departments canvas half off-screen at 900 px | Fixed `07a9f65c`: departments in a 3-up grid, canvas 60vh. New eval assertion + `63-home-site-fold` |
| 3 | 63-18 note | product | Training opened on the first department (empty on the eval org) | Changed `07a9f65c`: opens on the department with the most people. **Still reads empty on the eval org** (no department there has any person); not provable without a populated org. Recorded, not a regression |
| 4 | 63-12 note | product | Department dots: one default blue vs the map's area colours | Fixed `07a9f65c`: `areaColourVar(i)` is the single colour assignment for the map and the strip (name order). Eval case compares the computed colours to `--area-N`. Side effect: see Open 2 |
| 5 | 63-12 note | product | "Carry on" had no tap target | Fixed `07a9f65c`: `min-h-tap`; case asserts >= 44 px and no sideways scroll at 390 px, `63-home-phone-manage` read |
| 6 | 63-18 note | environment | Office invite receipt unproven (mailer "email rate limit exceeded") | Re-run in the full run: still limited. Environment limit, not product. See Open 1 |
| 7 | 63-20 note | guard | `no-walk-words` comment stripper missed `//` comments in CRLF text | Fixed `07a9f65c`; mutation-proved both ways (green; the normalising line removed turns the self-test red) |
| 8 | full run, `requests` 60-14 (timed out twice at 4.0 min) | **eval defect** | The case clicked `focus-start-walking`, gone when a walk is open (the leftover walk from the previous run shows the resume card, whose start is now the only one). The serial describe then skipped 7 cases | Fixed `4ec54a1d`: `startWalking`, `cut-features` and 60-14 accept either start (`.or(walk-resume-button)`). Whole file re-run: 11 / 11. Root cause was my fix 1, found from `test-failed-1.png` |

## Open

1. **Invite email receipt (EVAL-01 leg).** The invite in `office.eval` people has not been proven in two consecutive runs (63-18, 63-21): the project's mailer is rate limited ("email rate limit exceeded"). Owner: Simon / the next quiet hour; run `EVAL_BASE_URL=https://sopstart.com npx playwright test --project=evals --workers=1 --retries=0 tests/evals/office.eval.ts -g "people: full width"` once with nothing else sending mail. Not a product failure: the screen reported the error truthfully.
2. **Department colour swatches are now inert on the home.** The strip's dot and the home map both use `--area-N`; the eight swatches under each department still set `departments.colour`, which only the site editor's machine zones, department chips and pickers read (`template-*` shots show the mismatch: a yellow swatch ringed beside a teal dot). A decision for Simon: retire the swatches, or feed them to the map. Out of scope for 63 (ADR-0005 rule 2 puts the map on `--area-*`).
3. **Training on an org with no department members still reads "No people with required SOPs in this cut."** Correct for the eval org; unproven against an org with data (needs the real org's admin session, not available to the evals).
4. `63-addr-note-after` is a loading skeleton (cosmetic, asserted by test id; recorded by 63-14).
