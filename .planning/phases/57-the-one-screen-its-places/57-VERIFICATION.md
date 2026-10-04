---
phase: 57-the-one-screen-its-places
verified: 2026-10-05T00:00:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 1
overrides:
  - must_have: "An admin can drag each room's shape to a new place (SC5 clause) / admin can position each room's shape in the site editor (PLC-01 clause)"
    reason: "Owner decision D-01 (Simon, 2026-10-04): no room design or configuration this phase. The four rooms are fixed hit-areas with signposts in src/lib/site/rooms.ts. REQUIREMENTS.md out-of-scope row (image-generation credit) backs it."
    accepted_by: "Simon (57-CONTEXT D-01)"
    accepted_at: "2026-10-04"
gaps: []
deferred:
  - truth: "Admin positions each room's shape in the site editor"
    addressed_in: "Not scheduled (57-CONTEXT Deferred Ideas)"
    evidence: "Revisit when the scene is regenerated with rooms drawn in, or a real site asks. Not covered by a later roadmap phase, so it is carried as an override, not a deferral."
---

# Phase 57: The One Screen & Its Places Verification Report

**Phase Goal:** After signing in everyone lands on one screen (list, isometric site, detail panel), no header navigation, four signposted rooms, identical map/list selection, machines with SOP status badges, Noticeboard for site-wide SOPs, role-aware pins, search, a "next for you" card, admin edit mode from the map, departments only as zones, and the worker plant home / admin library table / dashboard / header navigation retired.
**Verified:** 2026-10-05 against HEAD 8dfa26a6
**Status:** passed (one owner-accepted descope, three warnings, listed below)
**Re-verification:** No, initial verification

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Sign in lands on one screen (list, site, detail); no header nav on it or on any page it opens | VERIFIED | `src/app/page.tsx` branches server-side on the session: signed-out gets `Landing`, no role goes to `/pending`, otherwise `<OneScreen>`. `roleHome()` returns `/` for all four roles (`src/lib/auth/role-home.ts`). `ShellFrame` renders list, `shell-stage`, `shell-detail`. `(protected)/layout.tsx` has no header; it renders only `BackToSite` (a single Back bar via `placeForPath`). `TopHeader` and `PlantHome` are deleted; the only grep hits are comments in `worker-signal.ts`. Remaining `<header>` elements are in-page title bars (SOP page, builder), not site navigation, and are Phase 58's focus-bar scope. Eval: "SHL-01 PLC-01 worker lands on three panes with four signposts and no header" passed. Screenshot `57-real-org-overview.png` read: three panes, no header. |
| 2 | Map click, room click and list-row click do the same thing (highlight, camera moves, detail fills); Esc returns to the full site view | VERIFIED | `ShellFrame.select()` is the only writer of place state and the address bar (`history.replaceState`, no router). Map `onMachineClick` and `onRoomClick`, list-row `onClick` and the close button all call it. A camera effect keyed on `placeKey` calls `stage.flyTo` or `fit`. Esc listener (skipped while typing or editing) calls `select(OVERVIEW)`. Eval passed: "map click equals list click, and Esc returns to the overview" and "second-iteration leak" (machine, Office, another machine shows no stale detail). |
| 3 | Four rooms signposted by name at every zoom; machine lists its SOPs with a status badge each (worker walks published; admin can also edit or start a new SOP for the machine); Noticeboard does the same for site-wide SOPs | VERIFIED | `ROOMS` in `src/lib/site/rooms.ts` has the four rooms. `PlantStage` renders `plant-room` hit-areas above the machines and `plant-room-sign` counter-scaled (`Math.min(2.4, 1/view.s)`) so the name shows at any zoom. Worker `MachineBody` and `SopRows` use `RelBadge`. `AdminMachineBody`/`AdminSopRows` give badge (NO OWNER, REVIEW DUE, OK, DRAFT), Walk (published only, `/sops/{id}?tab=walk`), Edit (builder), and "New SOP for this machine" (`/admin/sops/new/blank?machine=`). The blank wizard reads a UUID-checked `?machine=` and calls `setSopMachines`. Noticeboard: `NoticeboardWorkerBody` (`placement==='site'`) and `AdminNoticeboardBody` (via `getAdminShell().siteSopIds`). Evals passed: "PLC-02 PLC-03 worker walks a SOP from a machine and from the Noticeboard", "PLC-02 D-19 admin machine panel offers Walk, Edit and new SOP". |
| 4 | Worker: due counts per place and a "next for you" card (Walk it, Show me); admin: no-owner and overdue-review pins, counts on Office and Workshop, Office card with a button that opens it; search filters the list and lights shapes (machine names and titles of SOPs on them) | VERIFIED | Worker: `derivePlantPins` feeds machine pins, `noticeboardDue` the Noticeboard pin, and `NowCard` has `onShowMe` calling `select`. Supervisor gets `OfficeCard` with the sign-off count (D-06). Admin: `machineHealth` dots, `roomPins {office: inboxCount, workshop: drafts.length, noticeboard}`, `OfficeCard` `onOpen` selects the Office room. `inboxCount` is `loadInbox().items.length`, the same value `/governance` shows (D-16). Search: `askMatches(query, machines, links, sopsById)` plus `roomMatches` filter the list and set `highlighted` on stage shapes. Evals passed: "PLC-04 worker due pin", "PLC-04 admin health pin", "D-16 admin Office count equals the governance page open count", "SHL-04 search lights matching machine and room shapes", "SHL-05 Now card names the due SOP and opens it", "D-06 supervisor Office card". |
| 5 | Admin switches the site to edit mode from the map to add/rename/reshape/remove machines and departments; there is no departments screen | VERIFIED, with owner-accepted descope (room drag, see Overrides) | "Edit site" button on the stage (`shell-edit-site`) selects `{kind:'edit'}`, which mounts `SiteEditSurface`: `DepartmentsStrip` (create, rename, recolour, remove) plus the existing `SiteWorkspace` for machines. `/admin/departments`, `/admin/site` and `/dashboard` are server-side redirects in `next.config.ts` (to `/?place=edit` and `/`). `src/app/(protected)/admin/` has no departments or site dir. `archiveDepartment` refuses while machines, SOP rules, people or library blocks reference the department, and returns counts. Resolution of a non-admin `edit` place falls back to the overview (`resolvePlace`). Evals passed: "PLC-05 D-08 D-22 edit mode shows the workspace and departments strip", "Phase 51 site editor" and "a worker gets the overview, not the editor, at the edit-mode address". |

**Score:** 5/5 truths verified.

### Overrides

| Item | Status | Basis |
|------|--------|-------|
| SC5 "drag each room's shape to a new place" and PLC-01 "an admin can position each room's shape in the site editor" | PASSED (override) | 57-CONTEXT D-01 (owner, 2026-10-04): rooms are fixed hit-areas, no admin positioning UI, no room table. Not a gap. `rooms.ts` is the single tuning table; geometry was tuned against the real 2752x1536 scene in 57-10 (commit 5fe93d3) and the screenshot above shows Workshop, Noticeboard, Smoko room and Office on clear floor. Keep the override in the VERIFICATION frontmatter. |

### Required Artifacts (spot-checked at all four levels)

| Artifact | Status | Details |
|----------|--------|---------|
| `src/components/shell/ShellFrame.tsx` (391 lines) | VERIFIED | Substantive, imported by `WorkerShell` and `AdminShell`, fed by real queries. |
| `src/components/shell/WorkerShell.tsx`, `AdminShell.tsx`, `OneScreen.tsx` | VERIFIED | Worker is a static import; admin is `dynamic(..., {ssr:false})` only, so admin code stays out of the worker bundle. |
| `src/lib/site/rooms.ts`, `src/lib/shell/place.ts` | VERIFIED | Pure modules with spec coverage (`rooms`, `place`, `search`). |
| `src/actions/shell.ts` (`getAdminShell`) | VERIFIED | `requireAdminContext()` first, zero parameters, session client, one `loadInbox()`. Data flows: floor, governance, inbox count, drafts and site SOP ids come from real queries. |
| `src/actions/departments.ts`, `DepartmentsStrip.tsx` | VERIFIED | Refusal-checked archive with four junction counts, org-scoped. |
| `src/components/sop/plant/PlantStage.tsx` | VERIFIED | Room layer and signposts present; mount-fit effect keyed on scene size only (WR-04). |
| `src/app/(protected)/admin/access/page.tsx` | VERIFIED | Present; builder, Office and wiring link into it. |

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| Map shape click | place state, address bar, camera, detail | `onMachineClick`/`onRoomClick` to `select()` | WIRED |
| List row click | same | `onClick` to `select()` | WIRED |
| Office card button | Office room panel | `OfficeCard.onOpen` to `select({kind:'room',id:'office'})` | WIRED |
| Office pin and card | `/governance` "N open" | single `loadInbox()` shared by both | WIRED (eval asserts equal) |
| Machine panel "New SOP for this machine" | `setSopMachines` | `?machine=` to `WizardClient` | WIRED |
| Legacy `/sops`, `/governance?view=library`, `/dashboard`, `/admin/departments`, `/admin/site` | `/` or `/?place=edit` | proxy (`middleware.ts`) and `next.config.ts` redirects, server-side only | WIRED |
| Sign-in | `/` | `roleHome()` | WIRED |

### Requirements Coverage

Plan frontmatter declares requirements on 57-02 (SHL-01, SHL-02, SHL-04, PLC-01), 57-03 (PLC-04, PLC-05, SHL-05) and 57-10 (all nine). The other plans carry no `requirements:` line, but 57-10 and the ROADMAP list all nine IDs, and none of the nine is missing from REQUIREMENTS.md. SHL-03 (Phase 60), SHL-06 (Phase 59) and SHL-07 (Phase 62) are mapped elsewhere in the traceability table, so there is no orphan.

| Requirement | Status | Evidence |
|-------------|--------|----------|
| SHL-01 | SATISFIED | Truth 1 |
| SHL-02 | SATISFIED | Truth 2 |
| SHL-04 | SATISFIED | Truth 4 (search) |
| SHL-05 | SATISFIED | Truth 4 (Now card, Office card) |
| PLC-01 | SATISFIED (position clause by override) | Truth 3 plus Overrides |
| PLC-02 | SATISFIED | Truth 3 |
| PLC-03 | SATISFIED | Truth 3 (Noticeboard) |
| PLC-04 | SATISFIED | Truth 4 (pins and counts) |
| PLC-05 | SATISFIED | Truth 5 |

### Behavioral Spot-Checks and Probes

| Check | Command | Result | Status |
|-------|---------|--------|--------|
| Type check | `npx tsc --noEmit` | no output, clean | PASS |
| Phase 57 and lint guards | `npx playwright test --project=phase57 --project=phase15-stubs` | 197 passed, 5 skipped (live-DB specs gated on env) | PASS |
| Dead hrefs to `/dashboard`, `/admin/departments`, `/admin/site`, bare `/sops`, `?view=library` in `src` | grep | zero hits outside redirect rules | PASS |
| Deployed eval at 5fe93d3 (57-EVAL.md) | `npm run eval -- --phase 57` | 44/44 passed; screenshots read; real-org rooms fixed in 5fe93d3 and re-checked | PASS (recorded, not re-run) |
| Full suite | not re-run (shared OTP budget); 20 failures recorded in 57-10, all pre-existing or environmental | n/a | SKIP |
| Probes (Step 7c) | none declared | n/a | SKIP |

### Convention Checks (CLAUDE.md)

| Check | Status |
|-------|--------|
| `journeys.ts` covers `/` (lines 66, 98, 251) and `/admin/access` (line 378); `shell-structure.spec` "pathways map covers every page route, including /" passes | OK |
| CAPABILITY-MATRIX names `getAdminShell`, `/admin/access` and the departments actions (rows 47-62, note at line 73) | OK |
| Deletion guards assert absence of references (retirement-sweep spec greps `src` for the list address and deleted surfaces) | OK |
| Redirects are server-side (proxy and `next.config.ts`), never client `useEffect` plus `router.replace` | OK |
| Design tokens only; `phase15-stubs` lint specs green | OK |
| Debt markers (TODO, FIXME, XXX, TBD) in phase-touched shell, site, departments and layout files | none found |
| WR-06 baseline decision (`/page` 792 to 831 KB) is recorded in ROADMAP line 1895, with the reason: earlier values missed the lazy WorkerShell chunk, so 831 is the worker's real first download | OK, accepted deviation |
| Deliberate deviations (static WorkerShell import, lazy AdminShell seam, rooms geometry tuned in 57-10, `admin-rows.ts` surviving trimmed) | Assessed, no objection |

### Anti-Patterns Found

None blocking. The `Workshop` and `Office` worker bodies carry plain "arrives in a later update" lines for requests (D-03, deliberate, Phase 60 and 61 scope). They are not stubs hiding a missing deliverable for this phase.

### Warnings (non-blocking)

1. **Review fixes are not deployed-eval-verified.** Seven commits after the eval run (WR-01..05 plus docs) are unpushed (`git log origin/master..HEAD`). They touch `useCompletions`, `AdminShell`, `PlantStage` and `archiveDepartment`, all inside eval-covered flows (Office sign-off count, Smoko count, department refusal copy). Local phase57/phase52/54 specs and `tsc` are green. Action: after push, run `npm run eval -- --phase 57` once and read the Office and edit-mode screenshots.
2. **REQUIREMENTS.md checkboxes and traceability still read Pending** for SHL-01, 02, 04, 05 and PLC-01..05 (lines 982-996, 1090-1095). Tick them at phase close. Also record the PLC-01 positioning clause as deferred so the text matches D-01.
3. **Eval-site signposts prove rendering only.** The eval scene is placeholder boxes. Placement on the real scene was checked by screenshot only (above), and `rooms.ts` is the single tuning point if a scene changes.

### Human Verification Required

None. Deployed eval and screenshots cover UI behaviour; the remaining items are bookkeeping and a post-push eval re-run.

### Gaps Summary

No gaps. All five roadmap success criteria are met in the codebase at HEAD, all nine requirement IDs are accounted for, and the one clause that is not implemented (admin drag of room shapes) is an owner-accepted descope recorded as an override.

---

_Verified: 2026-10-05_
_Verifier: Claude (gsd-verifier)_
