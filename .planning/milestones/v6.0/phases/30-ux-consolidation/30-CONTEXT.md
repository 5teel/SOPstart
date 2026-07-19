---
phase: 30-ux-consolidation
status: decided
created: 2026-07-12
source: Full frontend structure audit (this session) + usability-lab SOP-0068A + Visy field research 2026-05-05
open_questions: []
---

# Phase 30 Context: UX Consolidation & Simplification

## Vision (user-decided direction)

SafeStart is a repository of an enormous amount of technical information. Users must find it
incredibly easy to navigate — they should never have to think about or learn the app. The unifying
principle: **every question a user has should have exactly ONE place that answers it** — one home
per role, one list per persona, one create entry, one place to control visibility, one vocabulary.
The app already has all the right capabilities; it currently offers most of them three times.

Simon's directive (2026-07-12): "fold analysis into phase 30 and plan and execute the change."

## Diagnosis (evidence-backed)

The worker path is nearly right (login → SOP → walkthrough in ~3 taps). The complexity is
admin-side accretion: 34 routes built phase-by-phase now carry 3 disagreeing admin menus, 5 list
styles, 3 governance surfaces showing the same data, 8 create entry points to 3 routes, and 4
places controlling "who sees this SOP." Second problem: vocabulary — the app speaks engineer
("parse", "block", "Hallucination", "Draft/Published") to low-literacy factory users
(usability-lab F-02, F-11, F-15; Visy: "some of them aren't the smartest tool, so it's simple").

### Duplicate inventory

| # | What | Where |
|---|---|---|
| 1 | Governance data (listGovernanceQueue, confirmSopCurrent) | /admin/governance queue · GovernanceWidget on /admin/sops · LibraryReviewCell on every library row |
| 2 | SOP creation | 4 buttons on /admin/sops + 3 dashboard tiles + "Create SOP" tab on worker /sops = 8 entries to 3 routes |
| 3 | "Who sees this SOP" | assign page (role/sub-trade/individual) · SopDepartmentEditor on list rows · team page dept column · worker self-add |
| 4 | Admin nav | dashboard tiles (6) · per-page sub-nav (copy-pasted 5× in 3 styling idioms) · account menu (4) — none a superset |
| 5 | PPE + equipment content | PPE renders in BOTH Tools and Hazards tabs (identical isPpeSection copy-pasted); equipment in Overview AND Tools |
| 6 | Approve/publish actions | Builder PublishStage + governance queue rows share approveStep/requestChanges — DELIBERATE (Phase 29 D29-05); preserve both |
| 7 | Auth guard block | copy-pasted verbatim in all 14 admin page files |

### Dead weight inventory

| Item | Evidence |
|---|---|
| Model tab (worker SOP detail) | permanent "3D viewer disabled" placeholder (ModelTab.tsx, 27 ln) |
| /admin/agent | orphan — zero nav links anywhere |
| Notifications bell (TopHeader) | aria-label "Notifications" but links to /sops; no notifications screen exists |
| /dashboard page | redirect shim for 3 roles; duplicate launcher for admin; header copy says "v3.0 / Closeout" |
| /sops/[sopId]/walkthrough route + layout | page.tsx is a pure redirect to ?tab=walkthrough; layout.tsx never renders |
| WalkthroughTab.tsx, BuilderWithSourceViewer.tsx | self-labelled legacy shims |
| /pathways + /uat in primary nav for all roles | internal design tooling in a factory worker's 5-item nav |
| Worker /sops department filter | client-side filter is a no-op returning true (TODO at sops/page.tsx:93-101) |

### Style inconsistency

- Inline style={{}} + hardcoded hex instead of CSS-var tokens: BuilderStageShell, PublishStage, /admin/agent, /admin/departments
- 5 list idioms, 4 filter idioms, 3 button idioms across admin pages
- Blueprint design system (paper/ink, semantic accents, JetBrains Mono) is validated but only partially adopted

## Locked decisions (requirements)

- **UX-01 One home per role.** Worker → /sops, supervisor + safety_manager → /activity, admin → /admin/sops. Delete the /dashboard page and remove "Dashboard" from all navs. Login redirect + middleware land each role on its home directly. PendingDashboard stub relocates (e.g. a minimal /pending or inline on /sops).
- **UX-02 One admin nav.** Single shared <AdminNav> component: SOPs · Governance · Blocks · Team · Settings. Departments folds under Team surface or Settings; AI Settings + approval-chain editor + agent layer live under Settings (or Settings groups them). Account menu → one "Admin" link to /admin/sops (admin/safety_manager only). Delete the 5 copy-pasted sub-navs.
- **UX-03 One governance surface.** Governance folds into /admin/sops as the "Needs attention" view with flag chips (Overdue / Due soon / Unowned / Stale role / Awaiting approval). GovernanceWidget and LibraryReviewCell removed as separate surfaces (their counts/actions live in the one list). Approval-chain config editor relocates to admin Settings. HARD CONSTRAINT: APR-03/APR-04 behaviour preserved — one-click Approve for the matching next approver from the queue rows AND from the builder PublishStage; awaiting-approval count + deep-link still exist (can live on /admin/sops header chips). Phase 28/29 server actions unchanged.
- **UX-04 One create entry.** Single "New SOP" button (on /admin/sops) → one method-picker screen: Upload a document (FIRST, per Visy "don't make create-from-scratch the headline") · Talk it through · Describe it · Start blank. Existing 3 intake routes can remain as destinations; all other create buttons/tiles/tabs removed (incl. worker /sops "Create SOP" tab → admins get to it via admin nav).
- **UX-05 Worker SOP detail 6 tabs → 3.** Read (Overview + Tools + Hazards merged into one scrollable brief; PPE + equipment render ONCE) · Walk it (walkthrough) · Flow (desktop-oriented). Delete Model tab entirely (until 3D ships). QR deep-links (?tab=…) must still land: old tab params map to the new tabs (tools/hazards → read, walkthrough → walk).
- **UX-06 Admin list rows one line.** Title · status chip · one flag chip · owner. Click → builder. The 5 icon-only actions (edit/assign/versions/video/qr) move into the builder as labelled actions (or a labelled action menu). SopDepartmentEditor + LibraryReviewCell leave the row. Fixes usability-lab F-09 (icon-only actions, WCAG).
- **UX-07 Plain-language pass.** Builder stages "Review / Builder / Publish" → "Check / Edit / Send to workers" (labels only; routes/state names unchanged). AI reviewer flag titles → plain outcomes (Made-up content / Missing content / Picture not linked to its step / Table may be scrambled / Wording changed) with human step names, never "block N" (usability-lab R-C1 table). Every icon action gets a visible label or persistent aria-label. Reversibility stated near publish ("You can unpublish or edit later"). Offline pill plain-languaged.
- **UX-08 Dead-weight sweep.** Delete: ModelTab + its tab entry, /sops/[sopId]/walkthrough route + layout (update any hrefs to ?tab=walkthrough), WalkthroughTab.tsx shim, BuilderWithSourceViewer.tsx, notifications bell (or point it somewhere real — deletion preferred), dashboard page (UX-01). Fix or remove the no-op department filter on worker /sops. Move /pathways + /uat links out of primary nav into the account menu (keep pages; they're team tooling).

## Constraints

- Zero regressions to: publish spine (parse → review → verify → publish), approval chains (APR-01..05), governance actions (confirmSopCurrent/setSopOwner), worker walkthrough + completions + offline, roster login.
- Bundle gate: /sops/[sopId] worker First Load JS ≤ +2 KB drift (tab merge should REDUCE it).
- journeys.ts MUST be updated in the same change for every rerouted/removed screen (CLAUDE.md pathways rule); /pathways "All screens" → 0 not-mapped.
- Existing phase28/phase29 Playwright suites must stay green (source-contract tests reference GovernanceWidget/LibraryReviewCell/queue files — those tests need repointing in the same plan that moves the code, per the 29-01 precedent).
- Grep for dead hrefs after every route removal (CLAUDE.md 2026-06-08 learning — dead Link/router.push = generic "This page couldn't load").
- Styling: new/touched components use CSS-var tokens (paper/ink + semantic accents), never hardcoded hex. Full §5 component consolidation (shared ListRow/FilterChips/Button across ALL pages) is OUT OF SCOPE for this phase — only pages already being touched get tokenised. Log the rest as backlog.

## Suggested wave shape (from the analysis; planner may adjust)

1. **Wave 1 (zero-risk):** UX-08 dead-weight sweep + UX-02 shared AdminNav + UX-04 single create entry.
2. **Wave 2:** UX-01 role homes + UX-07 plain language.
3. **Wave 3:** UX-05 worker 3-tab merge + UX-06 one-line list rows.
4. **Wave 4:** UX-03 governance merge + journeys.ts final sweep + merged-tree gate.

## Out of scope

- Full design-system component consolidation across untouched pages (backlog).
- Any new features (search improvements, voice, notifications system).
- Training records / AI maintenance schedule (now Phase 31).
- Site/plant multi-tenant tier, identity model changes.
