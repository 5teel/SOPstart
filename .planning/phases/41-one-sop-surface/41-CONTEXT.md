# Phase 41: One SOP Surface - Context

**Gathered:** 2026-09-13
**Status:** Ready for planning
**Source:** Orchestrator-compiled from prior locked decisions (v8.0 roadmap scope correction 2026-07-28, v9.0 D2 2026-08-06, /sops Miller rebuild 2026-08-04..08, prod org merge 2026-09-12). No discuss-phase question round was run — Simon asked to proceed directly.

<domain>
## Phase Boundary

One route lists SOPs for every role. What a person sees and can do on it is decided by permissions, not by URL. The admin-only views at `/admin/sops` today (draft/published status, governance queue `?view=attention`, access/wiring patch bay `?view=access`) become permission-gated, code-split lenses on the worker surface. The second top-level "SOPs" door closes. An admin reaches a SOP's builder by one route chain.

**In scope:** the LIST surfaces only (`/sops` and `/admin/sops`), their nav entries, deep-link compatibility, the builder route chain from the list, the bundle gate, `journeys.ts`.

**Out of scope (anti-goals from ROADMAP):** merging the SOP *detail* route with the admin builder (D-A9); creation-flow convergence (Phase 42); dead-surface/route-truth sweep (Phase 43); any new block types; parse quality.
</domain>

<decisions>
## Implementation Decisions

### Surviving route and shape
- D-01: The surviving URL is **`/sops`** (the worker route). `/admin/sops` survives only as a redirect shim to `/sops` (preserving `?view=`, `?departments=`, `?collection=`, `?sop=` query strings), never as a destination.
- D-02: The desktop layout is the **sketch 005 variant C Miller frame already shipped on `/sops`** (commits `cbce023`, `82fec78`: one bordered scope | list | detail grid, sticky mono column headers, flush hairline rows, ink-fill selection). Admin lenses are additional *scopes* in the first Miller column (e.g. "Needs attention", "Drafts", "Access"), rendered only for roles entitled to them — not a separate tab strip. Mobile keeps the existing stacked worker list.
- D-03: **Rendering model must be decided and stated in the first plan before any surface work** (ROADMAP hard requirement). Prior: `/sops` is a client component (`useAssignedSops`, `useSopSync`, Dexie offline, self-add/remove, refresher dates, search — 644 lines) and `/admin/sops` is a server component (`listGovernanceQueue`, `listOrgTree`, `listGrants`, `WiringPatchBayShell` — 700 lines). Either "server shell hosting lazily-loaded client lenses" or "client list with code-split admin lenses" is acceptable. Whichever is chosen, every worker behaviour is preserved verbatim and the admin lens code never enters a worker-session bundle.

### Navigation
- D-04: `TopHeader` keeps exactly one "SOPs" entry (`/sops`). `AdminNav` drops its "Manage SOPs" item; Governance/Content/Team/Settings survive; the governance link deep-links `/sops?view=attention`. "Create New SOP" stays where it is (Phase 42 moves it).
- D-05: The word "Library" survives only as a *filter/scope label* ("Your SOPs" vs "Everything"), never a nav label or a destination.

### Builder route chain
- D-06: From the merged list an admin reaches the builder (`/admin/sops/builder/[sopId]`) by **one** chain. Today the admin list links there directly; the worker list links to `/sops/[sopId]` (read/walk). Keep both *destinations* (detail for everyone, builder for editors) but ensure only one path from list → builder exists after the merge; do not introduce a third.

### Deep links (must keep resolving)
- D-07: `?departments=` and `?collection=` (Phase 33 filters), `?sop=` (post-publish wire-up link into the access patch bay), `?view=attention`, `?view=access` — all resolve to the same views they resolve to today, on `/sops`.

### Bundle gate
- D-08: `SB-LINE-06` today gates `/sops/[sopId]/page` (see `scripts/check-bundle-size.ts`, `.bundle-baseline.json`). This phase must **add the `/sops` list route to the same gate** (capture a baseline BEFORE surface work in Wave 0, then assert ≤ 2 KB drift) and assert by manifest inspection that governance-queue / org-tree / wiring-patch-bay modules are absent from the worker route's client chunks. A regression is a phase-failing condition.

### Data reality
- D-09: Prod is now a single working org "SOPstart" (id `bd2c2b88…`) with ~33 SOPs, 4 published, plus Jacks House. Both Simon and Joe are admins there. Any "live data shape" figure older than 2026-09-12 counted multiple orgs.

### Verification style
- D-10: UAT happens on sopstart.com after Railway deploy only — never local Playwright instructions to Simon. Human-verify steps are written as plain click-paths + yes/no questions. After any UI change, LOOK at the deployed page (CSS-token and sizing bugs are invisible to every automated gate — CLAUDE.md 2026-07-14).

### Claude's Discretion
- Exact component split, lens loading mechanism (`next/dynamic` vs React.lazy), scope-column ordering, skeleton/loading states, how the redirect shim preserves the query string, source-contract test shapes.
- Whether `SopWorkerBrowser` absorbs the admin lenses or a thin wrapper composes them.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design contract
- `.claude/skills/sketch-findings-SOPstart/SKILL.md` — validated tokens, Miller layout primitives, interaction patterns
- `.claude/skills/sketch-findings-SOPstart/references/layout-primitives.md` — Miller frame dimensions/rules

### Surfaces being merged
- `src/app/(protected)/sops/page.tsx` — worker list (client)
- `src/components/sop/SopWorkerBrowser.tsx` — Miller browser shipped 2026-08
- `src/app/(protected)/admin/sops/page.tsx` — admin list (server) with `?view=attention|access`
- `src/components/layout/TopHeader.tsx`, `src/components/admin/AdminNav.tsx` — nav entries

### Gates and maps
- `scripts/check-bundle-size.ts`, `.bundle-baseline.json` — SB-LINE-06 gate
- `src/lib/journeys/journeys.ts` — pathways map; must reflect the merged surface + shim in the same commit
- `.planning/codebase/CAPABILITY-MATRIX.md` — who may see each lens (access channel)
- `tests/phase30/dead-weight.spec.ts` — reference-sweep pattern for deleted routes (pair `existsSync` with a `src/` href sweep)

### Learnings that bite this phase (CLAUDE.md)
- 2026-08-04 dead `/walkthrough` href — deletion guards must assert absence of REFERENCES
- 2026-06-08 deleted-route dead links — grep every `/admin/sops` href and repoint
- 2026-05-13 URL state on hot paths — `history.replaceState`, not `router.push`, for scope/filter changes
- 2026-07-14 undefined CSS tokens — `var(--x, fallback)`; `tests/lint/no-undefined-css-tokens.spec.ts`
- 2026-05-25 new `tests/lint/*.spec.ts` must be registered in a Playwright project regex
</canonical_refs>

<specifics>
## Specific Ideas

- Simon's 2026-08-04 request: apply the same Miller layout to the worker library "for design consistency" — that is now shipped; this phase brings the admin lenses INTO that frame rather than restyling the admin page.
- Worker-facing copy stays glove-friendly / large tap targets; admin lens density may be higher on desktop only.
</specifics>

<deferred>
## Deferred Ideas

- Merging SOP detail + builder into one URL (D-A9) — architecturally larger, not this milestone.
- Moving "Create New SOP" onto the merged surface — Phase 42.
- Phase 45 "view as role" — waits for this phase to settle the surface.
</deferred>

---

*Phase: 41-one-sop-surface*
*Context compiled: 2026-09-13*
