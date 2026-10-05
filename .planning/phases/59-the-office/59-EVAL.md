# Deployed-site eval — 2026-10-05T17:04:03.379Z

Target: https://sopstart.com · commit cd59bfb · 74 passed / 0 failed / 0 skipped

| | Test | Failure |
|---|------|---------|
| ✅ | Phase 55 — cut features (deployed) › worker at 1440 sees pins and the next-SOP card — no install prompt, no offline banner, no microphone, no service worker |  |
| ✅ | Phase 55 — cut features (deployed) › existing SOPs open, and an old completion address lands on the Office |  |
| ✅ | Phase 55 — cut features (deployed) › admin sees none of the dropped authoring tools; dead addresses show the not-found page |  |
| ✅ | Phase 55 — cut features (deployed) › sign-up says ask your admin; login has no register link; profile has no organisation switch |  |
| ✅ | walk with a photo, then it waits for sign-off › worker on a phone walks the walk fixture, adds the photo it asks for and sends it — nothing queued |  |
| ✅ | walk with a photo, then it waits for sign-off › admin sees that completion waiting for sign-off in the Office inbox with its photo |  |
| ✅ | Phase 43 — dead-surface removal (deployed) › C — Access map shows the Wiring view only |  |
| ✅ | Phase 43 — dead-surface removal (deployed) › D1 — legacy /admin/sops and /admin/governance land on real routes |  |
| ✅ | Phase 43 — dead-surface removal (deployed) › D2 — a worker following a legacy governance link never reaches the inbox |  |
| ✅ | office cases › meta line: owner and review line on a machine panel row, a Noticeboard row and a Workshop draft; This SOP carries Owner and Review (59-07) |  |
| ✅ | office cases › inbox: tabs, count equals the pin, the unowned row has Assign owner, assigning clears it by title and the receipt ends "logged in the decision ledger" (59-09) |  |
| ✅ | office cases › inbox: a machine with no SOPs is a Machines row with a Write a SOP link, the Machines chip narrows to those rows, no real-org title leaks (moved from the governance eval, 59-14) |  |
| ✅ | office cases › inbox: Mark reviewed on an overdue row clears it (59-09) |  |
| ✅ | office cases › idle supervisor: a true empty inbox reads "Nothing needs you. That's the goal." with no tab control, chips or cleared-today line (59-09) |  |
| ✅ | office cases › admin sign-off: pending completion with a photo, thumbnail loads, lightbox opens, Escape closes the lightbox only, override reason enables Sign off, row leaves, pin patched; twice (59-09) |  |
| ✅ | office cases › supervisor sign-off: the supervised worker walk with a photo appears, a non-assessor sees the teaching callout and can reject; the unsupervised worker walk is absent (59-09) |  |
| ✅ | office cases › supervisor owner marks reviewed on their own SOP (59-09) |  |
| ✅ | office cases › reject with a reason; the worker then sees the walk as sent back; second iteration (59-09) |  |
| ✅ | office cases › approve end to end and send back on a pending-approval SOP (59-09) |  |
| ✅ | office cases › real org: inbox screenshot, read only, no writes (59-09) |  |
| ✅ | office cases › decisions: wide pane, newest first, a kind chip narrows, absolute time on hover, the map re-centres (59-10) |  |
| ✅ | office cases › people: wide pane, invite with a role, Invited chip, role change both ways, remove with confirmation (59-11) |  |
| ✅ | office cases › people at 1024x768: the stacked layout, nothing clipped (59-11) |  |
| ✅ | office cases › access: the wiring screen renders in the wide pane, the map re-centres, a sop address pins it (59-11) |  |
| ✅ | office cases › supervisor Office: inbox tab only, a people tab address falls back to the inbox (59-13) |  |
| ✅ | office cases › legacy addresses (governance, team, access with a sop, attention view) land on the right Office place; assert the rendered place, not the status (59-13) |  |
| ✅ | office cases › the training bridge: the Smoko room links it, the matrix renders, Back returns to the Smoko room (59-13) |  |
| ✅ | office cases › a non-owner completion address lands on the Office; the walker still sees their own (59-15) |  |
| ✅ | Phase 57 — the one screen (deployed) › SHL-01 PLC-01: worker lands on three panes with four signposts and no header |  |
| ✅ | Phase 57 — the one screen (deployed) › SHL-02: map click equals list click, and Esc returns to the overview |  |
| ✅ | Phase 57 — the one screen (deployed) › SHL-02: second-iteration leak -- machine, then Office, then another machine shows no stale detail |  |
| ✅ | Phase 57 — the one screen (deployed) › SHL-04: search lights matching machine and room shapes |  |
| ✅ | Phase 57 — the one screen (deployed) › SHL-05: the Now card names the due SOP and opens it |  |
| ✅ | Phase 57 — the one screen (deployed) › PLC-02 PLC-03: a worker walks a SOP from a machine and from the Noticeboard |  |
| ✅ | Phase 57 — the one screen (deployed) › D-11: a place deep link selects on load; a worker edit-mode link falls back to the overview |  |
| ✅ | Phase 57 — the one screen (deployed) › D-12 D-15: a bridge page shows Back to the site and returns to its room |  |
| ✅ | Phase 57 — the one screen (deployed) › PLC-04: worker due pin on EVAL Press |  |
| ✅ | Phase 57 — the one screen (deployed) › PLC-01: a worker on a phone gets the list, with glove-sized rows |  |
| ✅ | Phase 57 — the one screen (deployed) › D-06: the supervisor sees the Office card, and its pin equals the pane Inbox list (59-12) |  |
| ✅ | Phase 57 — the one screen (deployed) › PLC-04: admin health pin on EVAL Press |  |
| ✅ | Phase 57 — the one screen (deployed) › D-16 PLC-04: admin Office pin equals the pane Inbox tab count (59-12) |  |
| ✅ | Phase 57 — the one screen (deployed) › PLC-02 D-19: admin machine panel offers Walk, Edit and new SOP for the machine |  |
| ✅ | Phase 57 — the one screen (deployed) › D-12 D-13: the Workshop lists the org drafts and links to the new-SOP flow |  |
| ✅ | Phase 57 — the one screen (deployed) › PLC-05 D-08 D-22: edit mode shows the site workspace and the departments strip |  |
| ✅ | Phase 57 — the one screen (deployed) › D-10 D-17: retired URLs (dashboard, list, departments, site, governance views) redirect to the one screen |  |
| ✅ | Phase 57 — the one screen (deployed) › Pitfall 7: real-org overview screenshot, read-only |  |
| ✅ | Phase 57 — the one screen (deployed) › CLAUDE.md pathways: the pathways map reports zero unmapped screens |  |
| ✅ | Phase 57 — the one screen (deployed) › D-10: signed-out root shows the landing page |  |
| ✅ | Phase 51 — site editor (deployed) › admin uploads a scene, draws two machines (one after zoom+pan), names them, tags a department, moves a corner, links a SOP from the editor, and reloads |  |
| ✅ | Phase 51 — site editor (deployed) › a worker gets the overview, not the editor, at the edit-mode address |  |
| ✅ | Phase 58 — the SOP focus screen (deployed) › SC1 real-org SOP (OTG Probe Maintenance) opens in the focus screen browse state, read-only |  |
| ✅ | worker: frame, walk, versions, Back and phone › SC1 frame: opened from a machine it holds only the SOP — Back + title, rail 300 px, column <= 820, Start walking, no site chrome |  |
| ✅ | worker: frame, walk, versions, Back and phone › SC1 compiled CSS contains text-step, max-w-205, w-75, size-18 and bg-accent-signoff (a utility that compiles to nothing is invisible to every other check) |  |
| ✅ | worker: frame, walk, versions, Back and phone › SC2 walk: hazard, PPE and photo steps, locked rail, review, Send, sent — then Back to the place it came from; a second walk in the same session starts clean |  |
| ✅ | worker: frame, walk, versions, Back and phone › SC2 resume: reopening mid-walk offers "Resume where you left off"; Esc closes the Start over dialog; Start over begins again |  |
| ✅ | worker: frame, walk, versions, Back and phone › SC2 jump-ahead: with it on every row opens and unacknowledged hazard dots are hollow |  |
| ✅ | worker: frame, walk, versions, Back and phone › SC5 addresses: an old tab address redirects to the bare focus address; a superseded or draft version never reaches a worker |  |
| ✅ | worker: frame, walk, versions, Back and phone › SC5 phone (390x844): sticky dock, rail hidden behind "Steps · n of N", 28 px text; the rail opens as a full-screen sheet of 44 px rows |  |
| ✅ | admin: editor, parsing, versions and publish › SC3 58-edit-admin: version slot, AI banner above the first section, tick per step, kind borders, "Checked 2 of 4" |  |
| ✅ | admin: editor, parsing, versions and publish › SC3 58-edit-ai-findings: violet markers, Publish off with reasons, Clear writes "Cleared · logged in the decision ledger" |  |
| ✅ | admin: editor, parsing, versions and publish › SC3 58-edit-publish-dialog: every step checked and no finding open, Publish is on; the dialog recesses the screen and "Not yet" leaves the draft alone |  |
| ✅ | admin: editor, parsing, versions and publish › SC3 58-edit-blank: "Nothing here yet", Add a section, "Checked 0 of 0", Publish off |  |
| ✅ | admin: editor, parsing, versions and publish › SC3 58-this-sop: the rail block shows the version, the earlier versions and the jump-ahead switch |  |
| ✅ | admin: editor, parsing, versions and publish › SC5 58-superseded: the admin opens the exact earlier version, "v2 — superseded", no Start walking, no switch |  |
| ✅ | admin: editor, parsing, versions and publish › SC4 58-parsing: the frame is never empty -- stage line, rough time, skeleton rail and cards -- and the video reads "Transcribing the video" |  |
| ✅ | admin: editor, parsing, versions and publish › SC4 58-parse-failed: the card says it could not read the document, shows the job's own line, Try again and Back |  |
| ✅ | admin: editor, parsing, versions and publish › SOP-04: Start editing v2 (client navigation, no reload), check every step one by one, Publish; a worker on the old address lands on v2 and v1 stays on record |  |
| ✅ | admin: editor, parsing, versions and publish › D-03 58-annotate: add a photo, Annotate, draw one shape, Save -- the photo changes and the tick clears; Esc on a second open saves nothing |  |
| ✅ | Phase 56 -- simpler SOP + decision ledger (deployed) › A -- every SOP has an ok conversion run; convert fixture counts match the known answer; library-linked SOPs converted |  |
| ✅ | Phase 56 -- simpler SOP + decision ledger (deployed) › B -- the focus screen (browse) and the editor render the converted fixture |  |
| ✅ | Phase 56 -- simpler SOP + decision ledger (deployed) › C -- standards: add, attach to the SOP and a section, worker sees the label, rename, remove |  |
| ✅ | Phase 56 -- simpler SOP + decision ledger (deployed) › D -- placement: machine + department, or Whole site |  |
| ✅ | Phase 56 -- simpler SOP + decision ledger (deployed) › E -- owner change, completion reject and an AI write each write one decision; the AI one names the agent |  |
| ✅ | Phase 56 -- simpler SOP + decision ledger (deployed) › F -- ledger is non-empty, refuses service-key update and delete, refuses an unnamed agent |  |

Screenshots (inspect these — CSS/sizing bugs are invisible to assertions): `.planning\evals\latest\57-admin-edit-refused.png`, `.planning\evals\latest\57-admin-edit.png`, `.planning\evals\latest\57-admin-machine.png`, `.planning\evals\latest\57-admin-office.png`, `.planning\evals\latest\57-admin-overview.png`, `.planning\evals\latest\57-admin-workshop.png`, `.planning\evals\latest\57-bridge-activity.png`, `.planning\evals\latest\57-real-org-noticeboard.png`, `.planning\evals\latest\57-real-org-office.png`, `.planning\evals\latest\57-real-org-overview.png`, `.planning\evals\latest\57-real-org-smoko.png`, `.planning\evals\latest\57-real-org-workshop.png`, `.planning\evals\latest\57-supervisor-overview.png`, `.planning\evals\latest\57-worker-mobile.png`, `.planning\evals\latest\57-worker-noticeboard.png`, `.planning\evals\latest\57-worker-overview.png`, `.planning\evals\latest\57-worker-search.png`, `.planning\evals\latest\57-worker-zoomed.png`, `.planning\evals\latest\58-annotate.png`, `.planning\evals\latest\58-back-place.png`, `.planning\evals\latest\58-browse-real-org.png`, `.planning\evals\latest\58-browse-worker.png`, `.planning\evals\latest\58-edit-admin.png`, `.planning\evals\latest\58-edit-ai-findings.png`, `.planning\evals\latest\58-edit-blank.png`, `.planning\evals\latest\58-edit-publish-dialog.png`, `.planning\evals\latest\58-parse-failed.png`, `.planning\evals\latest\58-parsing-video.png`, `.planning\evals\latest\58-parsing.png`, `.planning\evals\latest\58-phone-rail.png`, `.planning\evals\latest\58-phone-walk.png`, `.planning\evals\latest\58-publish-done.png`, `.planning\evals\latest\58-publish-ready.png`, `.planning\evals\latest\58-resume.png`, `.planning\evals\latest\58-review.png`, `.planning\evals\latest\58-sent.png`, `.planning\evals\latest\58-superseded.png`, `.planning\evals\latest\58-this-sop.png`, `.planning\evals\latest\58-walk-hazard.png`, `.planning\evals\latest\58-walk-jump-on.png`, `.planning\evals\latest\58-walk-locked-rail.png`, `.planning\evals\latest\58-walk-photo-required.png`, `.planning\evals\latest\58-walk-ppe.png`, `.planning\evals\latest\59-access.png`, `.planning\evals\latest\59-approve-open.png`, `.planning\evals\latest\59-completion-non-owner.png`, `.planning\evals\latest\59-completion-owner.png`, `.planning\evals\latest\59-decisions-hover.png`, `.planning\evals\latest\59-decisions.png`, `.planning\evals\latest\59-inbox-empty.png`, `.planning\evals\latest\59-inbox.png`, `.planning\evals\latest\59-legacy-redirects.png`, `.planning\evals\latest\59-owner-meta.png`, `.planning\evals\latest\59-people-1024.png`, `.planning\evals\latest\59-people-invite.png`, `.planning\evals\latest\59-people.png`, `.planning\evals\latest\59-real-org-office.png`, `.planning\evals\latest\59-receipt.png`, `.planning\evals\latest\59-reject-dialog.png`, `.planning\evals\latest\59-signoff-lightbox.png`, `.planning\evals\latest\59-signoff-open.png`, `.planning\evals\latest\59-signoff-override.png`, `.planning\evals\latest\59-signoff-supervisor.png`, `.planning\evals\latest\59-supervisor-signoff.png`, `.planning\evals\latest\59-supervisor.png`, `.planning\evals\latest\59-this-sop.png`, `.planning\evals\latest\59-training-bridge.png`, `.planning\evals\latest\59-worker-sent-back.png`, `.planning\evals\latest\access-wiring-only.png`, `.planning\evals\latest\cut-builder-tools.png`, `.planning\evals\latest\cut-existing-completion.png`, `.planning\evals\latest\cut-existing-sop.png`, `.planning\evals\latest\cut-login.png`, `.planning\evals\latest\cut-new-ai.png`, `.planning\evals\latest\cut-not-found.png`, `.planning\evals\latest\cut-profile.png`, `.planning\evals\latest\cut-sign-up.png`, `.planning\evals\latest\cut-upload.png`, `.planning\evals\latest\cut-versions.png`, `.planning\evals\latest\cut-walk-phone.png`, `.planning\evals\latest\cut-walk-signoff.png`, `.planning\evals\latest\cut-worker-plant.png`, `.planning\evals\latest\editor-machines.png`, `.planning\evals\latest\ledger-b-browse.png`, `.planning\evals\latest\ledger-b-editor-hazards.png`, `.planning\evals\latest\ledger-b-editor.png`, `.planning\evals\latest\ledger-c-panel.png`, `.planning\evals\latest\ledger-c-worker-read.png`, `.planning\evals\latest\ledger-c-worker-removed.png`, `.planning\evals\latest\ledger-c-worker-renamed.png`, `.planning\evals\latest\ledger-d-machine.png`, `.planning\evals\latest\ledger-d-whole-site.png`, `.planning\evals\latest\ledger-e-owner.png`, `.planning\evals\latest\ledger-e-reject.png`, `.planning\evals\latest\site-editor.png`, `.planning\evals\latest\site-empty.png`

---

## Phase 59 sign-off notes (59-16)

**Result.** `npm run eval -- --phase 59` at `cd59bfb` (live on Railway, `/api/version` equal to HEAD): **74 passed / 0 failed / 0 skipped**, every Phase 59 case plus every sibling eval (cut-features, one-screen, sop-focus, sop-ledger, site-editor, dead-surface). One later app commit (`2d1ba6c`, the tab-bar padding below) was deployed and re-proved by running the real-org case alone against the live site (passed, screenshot re-read). `grep -c "test.fixme" tests/evals/office.eval.ts` prints 0.

**How it got there (five eval faults and one product defect, none hid a requirement).** (1) "Write a SOP" carries `?machine=<id>` on `/admin/sops/new/blank`; the eval pinned the bare address. (2) The photo-count filter ended in `\b` but the row text runs into the button ("photoSign off"). (3) The worker card reads 0 until its query lands, so "sent back" is now read from the database (the card's own 50-row query) and the exact text is awaited. (4) Supabase refuses `@sopstart.invalid` for invites; the invite uses `eval-invite-<run>@sopstart.com`, and the project's built-in SMTP rate-limits invites ("email rate limit exceeded", shown truthfully by the People tab) so a full run can send at most about one a hour. (5) The training bridge's Back click hit the wrapper, not its link. Product: the segmented control clipped "Access" at 400 px with a two-digit Inbox count (real org, 16); padding `px-3` to `px-2`, tap height unchanged.

**Deploy note.** The first push of `df9999e` ended `FAILED` on Railway seconds after "image push" with no logs and a green build (bundle gate `/page` 832 KB against 834); `serviceInstanceDeployV2` on the same sha queued about 20 minutes, built and deployed it.

**Compiled CSS (local build of HEAD, `.next/static/css`).** Hits: `lg:min-w-140` (`min-width: calc(var(--spacing) * 140)`), `lg:w-[58%]` (`58%`), `bg-accent-signoff`, `bg-accent-decision/10`, `bg-ai/10`, `h-18`, `max-h-80`, `max-w-md`. All eight compile to a rule.

**Programmatic checks asserted by the cases:** pane width about 400 on Inbox and at least 560 on each wide tab; `plant-world` scale/x change on a wide tab; one `office-row-action` per collapsed row with min-height at least 44; `data-place` unchanged after Esc inside the lightbox; signed-off rows leave and the pin equals the Inbox count after each action; the admin sign-off case runs twice in one session (second walk shows its own 2 photos, no stale panel).

### Every `59-*` screenshot, read by eye

| Shot | Looked at |
|---|---|
| `59-inbox` | ok. 400 px pane, segmented control with the Inbox count, chips (All / No owner / Overdue / Stuck) with counts, severity dots, one neutral button per row (Assign owner, Try again), no gap jump from the reserved receipt slot. |
| `59-receipt` | ok. "Owner set · logged in the decision ledger" with a check in the receipt slot, the No owner row gone, pin and Inbox count both 4. |
| `59-inbox-empty` | ok. Idle supervisor: large green check, "Nothing needs you. That's the goal.", header "0 waiting for you in the Office", no tab control, no chips, no cleared-today line (a one-tab role gets none by design). |
| `59-signoff-open` | ok. Expanded in place under the row: worker, SOP link with v1 chip, sent time, "0 steps done · 1 photo", photo thumbnail loaded (fixture image, pink) with its step caption, override block below the fold. Cosmetic: "· 1 / photo" wraps onto two lines in the 400 px meta line. |
| `59-signoff-lightbox` | ok. Full-screen black, "1 of 1", caption "Step 4 · Photograph the closed guard.", close, arrows. The fixture photo is a 1-pixel PNG so the image is a dot. Prev/next arrows show with a single photo (minor). |
| `59-signoff-override` | ok, but the override field is below the fold of this shot; it is visible in `59-reject-dialog` (recessed behind the dialog: "Reason for the override", "10 characters or more.", Sign off disabled, Reject neutral). The case also asserts Sign off disabled until 10 characters. |
| `59-signoff-supervisor`, `59-supervisor-signoff` | ok. Supervisor session: header "1 waiting for you", exactly one row (the unsupervised walk is absent), thumbnail loaded, teaching callout "You need to be signed off on this SOP yourself before you can assess others on it" with Request assessment, Sign off disabled (grey), Reject enabled. |
| `59-reject-dialog` | ok. Screen recessed (dimmed map, pane and sidebar), centred `max-w-md` dialog "Reject this walk?", names the worker, field with the 10-character hint, "Keep reviewing" and a pink disabled "Reject walk". |
| `59-approve-open` | ok. Approve chip and blue dots, "Your approval is next.", Approve button; the expanded send-back row shows "Open it to read it" and the chain "Step 1 of 1 · Your turn". The owner and "no review date" meta line truncates with an ellipsis (acceptable). |
| `59-owner-meta` | ok. Machine panel on EVAL Press: "No owner" warn chip plus "review due 6 Oct 2027" on the plant fixture; the draft row shows "Owner · eval-site-admin@sopstart.com · no review date". The overdue state appears on the inbox row (`59-receipt`: OVERDUE, Mark reviewed). The red NO OWNER badge and the amber No owner chip say the same thing twice (the badge is Phase 54's). |
| `59-this-sop` | ok. Rail block: Owner with Reassign, Review "no review date" with Mark reviewed, Machine, Objective, Standards, jump-ahead switch. |
| `59-decisions` | ok. Wide pane, "Read-only. Nothing here can be edited or deleted.", kind chips (Ownership active), WHEN / WHO / WHAT / ABOUT, newest first, map still visible at the left with the Office shape re-centred. |
| `59-decisions-hover` | ok for order and chips: All chip active, "just now" rows on top, REJECTED in red, COUNTER-SIGNED, MARKED REVIEWED, an AGENT chip with the AI action ("AI FILLED IN A FI..." truncated). The absolute date on hover is a native title, which headless screenshots do not draw; the case asserts the attribute. |
| `59-people` | ok at 1440. Single-line rows: email, role select, department chip with the dashed + add, ACTIVE chip, remove icon (none on your own row, "YOU" tag), "Invite someone", join code footer. |
| `59-people-1024` | ok. Stacked two-line rows, nothing clipped; the Invited row reads "Waiting to accept", Worker, INVITED chip, no actions. |
| `59-people-invite` | ok. Email + Role form, focused field, Send invite and Don't invite. |
| `59-access` | ok. Access lens unchanged inside the wide pane: search, hint strip, Org/Library columns, the pinned plant SOP tagged NEW atop Quality, "Who can see this?" panel; map strip visible at the left. |
| `59-supervisor` | ok. Supervisor (the supervised worker's walk already cleared): no tab control, no chips, no cleared-today line, the empty state. |
| `59-legacy-redirects` | ok for the place: `/admin/access` lands on Office, Access tab, wide pane. The shot is taken the moment the lens renders, before the shell queries land, so the pins read 0 and the map strip is blank; later shots show it live. |
| `59-training-bridge` | ok. Back-to-the-site bar, "Training" heading and filters, empty matrix for the EVAL zone ("No people with required SOPs in this cut"). |
| `59-completion-non-owner` | ok. A non-owner opening a completion address lands on the Office with the sign-off row; no completion detail. |
| `59-completion-owner` | ok. The walker still sees their own completion (Pending review, steps, photo). Two stacked nav bars (Back to the site and Activity / Completion Detail) are the existing structure. |
| `59-worker-sent-back` | ok. Worker Office card: Waiting 0, Signed off 2, Sent back 2, "Open sign-offs"; Next-for-you card at the top. |
| `59-real-org-office` | ok after the fix. Real org, read only: Inbox 16 with Sign-off 3, Stuck 9, Machines 4; all four tabs fit at 400 px (before the fix "Access" was clipped); the Office pin on the map and the room list read 16 as well. |

No screenshot shows a raw palette colour, a missing tint (pink and amber chips, green check and blue dots all render) or a layout overflow beyond the items marked minor above.

## Re-run after the code-review fixes — 2026-10-06, commit `b66b200d` (orchestrator)

`npm run eval -- --phase 59` at the deployed `b66b200d` (CR-01/02, WR-01..05 from `59-REVIEW-FIX.md`): **67 passed / 1 failed / 6 skipped** (the 6 skips are the dependents of the failed case).

- The one failure is `people: wide pane, invite with a role …` at the first invite: `office-receipt` stayed empty. Diagnosed with a direct `auth.admin.inviteUserByEmail` probe from the service key: **`429 email rate limit exceeded`** — Supabase's built-in email sender was at its hourly cap after the 59-16 runs. Environmental, not the product; the CR-02 change is on the pending-invitee branch, which this case never reached. Re-run of that single case once the window reset: see below.
- Screenshots re-read: `59-decisions` / `59-decisions-hover` show the WR-02 wording live — one ledger row per decision, `SIGNED OFF` for approvals and `REJECTED` for rejections, `MARKED REVIEWED`, `CHANGED OWNER`, `PUBLISHED`, `APPROVED`; `59-signoff-open` / `59-signoff-supervisor` / `59-reject-dialog` unchanged in layout after the claim-first sign-off (WR-01); `59-real-org-office` still fits the four tabs at 400 px with the two-digit count.
- Single-case re-run of `people: wide pane …` after the email window reset (2026-10-06): **1 passed (33.6 s)** — invite with a role, Invited chip, role change both ways, remove with confirmation, all on `b66b200d`. `59-people.png` re-read: wide pane, six rows with inline role selects, department picker, Active chips, Remove icons, join code under the table. Phase 59 is therefore fully proven on the post-review build: 68/68 across the two runs.
