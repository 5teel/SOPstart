# Phase 33: Per-SOP Access Granularity + Wayfinder Builder Header - Research

**Researched:** 2026-07-19
**Domain:** Brownfield extension of Phase 32 (access_grants schema + resolver/materialization + WiringPatchBay UI) and Phase 21.5/30 builder header. Almost entirely codebase analysis — no new libraries, no web research needed.
**Confidence:** HIGH (every claim below verified by reading current source/migrations/tests in this session unless tagged otherwise)

## Summary

Phase 33 has two independent workstreams. **(1) Per-SOP access:** `access_grants` today targets collections only (`collection_id uuid not null`, 00046 §8). The subject side (org/area/department/role/person) is complete and needs nothing. The recommended target extension is the **nullable-arm** shape: make `collection_id` nullable, add a nullable `sop_id` FK, add an XOR CHECK — keeping real FK integrity on both arms and leaving every existing `.eq('collection_id', …)` read naturally blind to SOP-target rows. The locked narrowing-override rule ("a SOP with people chosen by name stops following its collection") is implemented **entirely in materialization**: `materializeSopAccessForOrg` reads the SOP's direct grants first; if any exist, collection-derived access is ignored for that SOP. Critically, **zero RLS changes are needed** — SOP-target grants materialize into the same `sop_departments` / `sop_access_people` junctions the shipped 00035/00046 policy arms already read. `resolveEffectiveAccess` needs **zero code changes**: it unions opaque target ids, so callers run it twice (once with collection grants, once with SOP grants) and apply the override rule outside the pure function.

**(2) Wayfinder header:** the builder's dark 4-zone header (`BuilderStageShell.tsx` header block + `BuilderStageStepper` + Tools cluster) becomes the light-schema Wayfinder bar (back / you-are-here / forward zones, lock reason inside the greyed forward chip) with ONE "Tools for this SOP ▾" menu absorbing `SopActionsMenu` + `BuilderFlowButton` + `BuilderFlowEditButton` + `DeleteSopButton`. This is a restyle/consolidation of one file cluster — but **at least 8 spec files pin exact strings in these files**, and Phase 32's own specs pin ~40 literals in `WiringPatchBay`/`SelectionStrip`/`grants.ts`. The single biggest execution risk in this phase is the [2026-07-13] stale-source-contract class: every plan that edits a pinned file MUST repoint its specs in the same commit. The full pinned-string inventory is in "Source-Contract Repoint Inventory" below.

**Primary recommendation:** one additive migration (00050: nullable-arm + XOR check + replaced unique index), extend `grants.ts` materialization with the override rule, extend `WiringPatchBay` in place (teams ladder + collection→SOP drill-down + plain-language strip/panel), rebuild only the header JSX inside `BuilderStageShell` (keep the component name and its handlers — 6+ specs pin them), and register a `phase33` Playwright project mirroring `phase32`'s broad-testMatch pattern.

<user_constraints>
## User Constraints (locked decisions — no 33-CONTEXT.md exists yet; these come from ROADMAP Phase 33 entry, the phase seed, and the two sketch-README "Decisions (2026-07-19)" sections, all user-decided during Phase 32 UAT review)

### Locked Decisions
- **Narrowing override (2026-07-19):** "once people are chosen by name for a SOP, it stops following its collection." A chosen-by-name SOP must STOP following its collection's grants. This is the first override in the additive D-11 model — treat as locked design, plan around it. (Seed §1; sketch access-hierarchy README §Decisions 2; ROADMAP SC-3.)
- **Access map winner: A (Access map) + B's panel absorbed.** Keep the map/patch-bay surface as the evolution of shipped `WiringPatchBay`; selection detail becomes B's plain-language "Who can see this?" / "What can they see?" content. (README §Decisions.)
- **Full org ladder in the teams column:** site → area → department → role → person as expandable, selectable tiers, mirroring `OrgTree` from /admin/team. Person rows dashed. (README §Decisions 1; ROADMAP SC-1.)
- **Any tier grantable down to a single SOP** — e.g. whole Maintenance department wired to the Maintenance collection while "Pump Rebuild" inside it is seen by only two named people. (README §Decisions 2; ROADMAP SC-3.)
- **No jargon in UI copy (SC-5):** no "grants" / "wire up" / "UNWIRED" language anywhere user-facing. Plain-language "Who can see this?" panel.
- **Collections expand in place to their SOPs; any SOP selectable organically — no pinned `?sop=` URL required** (ROADMAP SC-2, closes G2).
- **Wayfinder winner: A, restyled light.** No dark bar — white bar on the paper/hairline schema, `--ink-100` zone dividers, `--paper-2` tools row; amber "YOU'RE EDITING" tick on a `--brand-yellow` rule and the green ready-chip are the only colour. (builder-header README §Decisions 1.)
- **ONE "Tools for this SOP ▾" menu** with exactly these self-describing items (labels locked): Assign this SOP to workers (→ `/assign`) / See earlier versions (→ `/versions`) / Make a training video (→ `/video`) / Print a QR code (→ `/qr`) / See the flow diagram (BuilderFlowButton modal) / Edit the flow diagram (BuilderFlowEditButton modal) / Delete this draft (drafts only). (README §Decisions 2.)
- **Lock reason lives inline on the forward chip** — e.g. "Locked — 29 steps below still need checking". (ROADMAP SC-6.)
- **Supersedes UAT Q6** ("accept collection granularity?") — the owner wants finer-than-collection control (seed §1). The WR-02 divergence decision is answered by this phase's mechanism, not by narrowing the seeded grant by hand.

### Claude's Discretion (explicitly delegated by the pre-plan gates)
- (a) `access_grants` SOP-target schema shape — nullable `sop_id` arm vs target-type enum (recommendation below).
- (b) Exact narrowing-override semantics in resolve/materialize, including last-named-person-removed behaviour (recommendation below).
- (c) Wire-density strategy for chosen-SOP person-lines at 15×20 scale (recommendation below: extend Phase-32 focus/group-collapse to SOP rows).

### Deferred Ideas (OUT OF SCOPE — from 32-CONTEXT, still deferred unless this phase's gates pull them in)
- Exclude/negative grants ("carve a unit out of a broadcast") — the narrowing override is NOT a negative grant; do not build an exclusion row type.
- Bus-routing audit/wall-display mode; sub-trade ↔ dept/role semantics; org empty states/first-run onboarding.
- Multi-collection UX subtleties beyond `collectionIds[0]` pinning (shipped behaviour).
</user_constraints>

<phase_requirements>
## Phase Requirements

Phase 33 has no REQUIREMENTS.md IDs yet ("Requirements: TBD — formalize at plan time"). The 6 ROADMAP success criteria act as requirement IDs:

| ID | Description | Research Support |
|----|-------------|------------------|
| SC-1 | Teams column shows site → area → department → role → person as expandable, selectable tiers (mirrors OrgTree) | OrgTree already carries roles+people (`OrgTreeDepartment.roles[].people[]`, types/org-model.ts). WiringPatchBay renders org/area/dept + person-grant-subject jacks only; Pattern 3 below maps the extension (expandedDepts/expandedRoles sets, chains for role/person, peopleIndex role arm). |
| SC-2 | Collections expand in place to SOPs; any SOP selectable, no `?sop=` pin needed | Right column currently flat collections + one pinned SOP nest (d3fc9f5). Pattern 4: `expandedCollections` + per-collection SOP rows fetched server-side; `enterWireUp` generalizes to any selected SOP. |
| SC-3 | Grant can target an individual SOP from any subject tier; chosen-by-name SOP stops following its collection | Pattern 1 (nullable-arm schema) + Pattern 2 (override semantics in materializeSopAccessForOrg). |
| SC-4 | Resolver + materialization honor SOP targets; live runtime tests prove org isolation + no stale visibility after revoke/override | Zero RLS changes needed (materializes into existing junctions). Runtime-test pattern documented from tests/phase32/grants-org-isolation.spec.ts (ephemeral orgs) — see Validation Architecture. |
| SC-5 | Plain-language "Who can see this?" / "What can they see?" panel; no grants/wire-up jargon | Pattern 5: keep the 48px SelectionStrip slot (SC-6 of Phase 32 preserved), add an answer panel below the bay; full pinned-copy repoint list below. |
| SC-6 | Wayfinder bar: back/here/forward zones, inline lock reason, ONE self-describing tools menu | Pattern 6: consolidation map of BuilderStageShell header + Stepper + SopActionsMenu + Flow buttons + DeleteSopButton, with spec-repoint inventory. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| SOP-target grant schema (00050) | Database (Postgres/Supabase migration) | — | FK integrity + XOR check + unique index live in the DB |
| Grant CRUD + org self-enforcement | Backend (server actions, `src/actions/grants.ts`) | — | access_grants has NO authenticated write policy; admin client + caller-side org checks (2026-06-15 rule) |
| Override resolution + materialization | Backend (grants.ts internal fanout) | Pure lib (`resolve-access.ts`, unchanged) | Materialized `sop_departments`/`sop_access_people` rows ARE enforcement; RLS untouched |
| Worker visibility enforcement | Database (existing 00035/00046 RLS arms + junctions) | Worker UI query filters | No new policies — SOP-target grants ride the shipped arms |
| Access map teams ladder + SOP drill-down | Frontend client (`WiringPatchBay.tsx`) | Server page (`admin/sops/page.tsx` data assembly) | Page must now ship per-collection SOP lists + full-tree data |
| Plain-language answer panel | Frontend client (SelectionStrip + new panel component) | — | Pure presentational; copy is the deliverable |
| Wayfinder bar + tools menu | Frontend client (`BuilderStageShell.tsx` + siblings) | — | Restyle/consolidation; stage state machine + publish/approval handlers unchanged |

## Standard Stack

**No new packages.** Everything is built with the already-installed stack: Next.js 16 / React 19 / TypeScript 5, Supabase (postgres migrations via `npx supabase db push`), Zod (grant input schema), Playwright (@playwright/test), Lucide icons. `[VERIFIED: package.json + current imports in grants.ts/WiringPatchBay.tsx]`

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Nullable-arm target on access_grants | `target_type` enum + polymorphic `target_id` | Enum loses per-arm FK integrity (one uuid column can't FK two tables), forces a rewrite of every existing read, and buys nothing at 2 target kinds. Rejected. |
| Materialization-level override | New restrictive RLS policy for overridden SOPs | Violates D-02/D-13 ("shipped policies stay byte-untouched"); also useless — `org_members_can_view_sops` (00003) OR-composes an org-wide read anyway (see Pitfall 6). Rejected. |

## Package Legitimacy Audit

**No external packages are installed by this phase** — slopcheck run not applicable. Packages removed due to slopcheck [SLOP] verdict: none. Packages flagged [SUS]: none.

## Architecture Patterns

### System Architecture Diagram (grant → worker visibility, with the new SOP arm)

```
Admin UI (access map / tools)                    Worker read path (UNCHANGED)
        │                                                ▲
        ▼                                                │
createGrant / revokeGrant  ──────┐            sops SELECT policies (00003 base OR
  (Zod XOR: collectionId ⊕ sopId)│            00035 dept arm OR 00046 person arm)
        │ admin client,          │                       ▲
        │ org self-enforced      │                       │ reads
        ▼                        ▼               ┌───────┴────────┐
   access_grants  ──────► materializeSopAccessForOrg ──► sop_departments
   (source of truth)      1. read SOP-target grants ──► sop_access_people
                          2. any? → OVERRIDE: ignore     (materialized rows =
                             collection-derived access    the enforcement layer)
                          3. none? → existing collection
                             path (resolveEffectiveAccess ×2:
                             collection grants, then SOP grants)
```

### Recommended structure (all existing files unless marked NEW)
```
supabase/migrations/00050_access_grants_sop_target.sql   # NEW — nullable-arm + XOR + index swap
src/actions/grants.ts                                     # createGrant/revokeGrant/materialize* extended
src/actions/departments.ts                                # assignSopDepartments rewired (dual-write closure)
src/lib/org-model/resolve-access.ts                       # UNCHANGED (pure; called twice)
src/lib/org-model/resolve-sop-access.ts                   # NEW (optional) — pure override-rule helper, unit-testable
src/types/org-model.ts                                    # AccessGrant gains sopId; new tree-row types if needed
src/components/admin/wiring/WiringPatchBay.tsx            # teams ladder + SOP drill-down + plain copy
src/components/admin/wiring/SelectionStrip.tsx            # plain-language copy (SC-5)
src/components/admin/wiring/AccessAnswerPanel.tsx         # NEW — B's "Who can see this?" detail below the bay
src/app/(protected)/admin/sops/page.tsx                   # access-view data assembly: SOPs-per-collection + tree
src/app/(protected)/admin/sops/builder/[sopId]/BuilderStageShell.tsx  # header → Wayfinder (KEEP component name)
src/app/(protected)/admin/sops/builder/[sopId]/BuilderStageStepper.tsx # becomes here/forward-zone renderer (keep file+labels)
tests/phase33/*.spec.ts                                   # NEW — register phase33 Playwright project
src/lib/org-model/__tests__/resolve-sop-access.test.ts    # NEW — auto-covered by phase32-unit testDir regex
```

### Pattern 1 — Pre-plan gate (a): nullable-arm schema (RECOMMENDED)

**What:** Migration 00050, pure-additive to rows, one column relaxation:

```sql
-- Source: derived from live 00046 §8 + 00049; verified against current schema
begin;
alter table public.access_grants alter column collection_id drop not null;
alter table public.access_grants
  add column if not exists sop_id uuid references public.sops(id) on delete cascade;
alter table public.access_grants
  add constraint access_grants_exactly_one_target
  check ((collection_id is null) <> (sop_id is null));
create index if not exists idx_access_grants_sop on public.access_grants (sop_id);

-- Replace 00049's unique index (it omits sop_id; PG treats NULLs as distinct,
-- so duplicate SOP-target grants would slip through it). Same coalesce-to-orgId
-- sentinel trick 00049 already established.
drop index if exists public.uq_access_grants_subject_collection;
create unique index uq_access_grants_subject_target
  on public.access_grants (organisation_id, subject_type,
    coalesce(subject_id, organisation_id),
    coalesce(collection_id, organisation_id),
    coalesce(sop_id, organisation_id));
commit;
```

**Why this arm and not the enum:** each target column keeps a real FK with `on delete cascade` (SOP deletion auto-cleans its grants); every existing read (`grantsByUnit` build in grants.ts L441-445 and WiringPatchBay L184-192, `materializeCollectionAccessForOrg`'s `.eq('collection_id', …)`) keys off `collection_id`/`subject_id` and **naturally ignores rows where collection_id is null** — old code paths degrade safely rather than mis-including SOP grants. The enum/polymorphic shape forces all of those to grow a discriminator branch on day one and loses FK integrity. `[VERIFIED: grants.ts, WiringPatchBay.tsx current source]`

**Do NOT model a SOP grant as (collection_id + sop_id both set):** a SOP can be in multiple collections (`sop_collections` m2m) and can move; storing a collection alongside denormalizes and goes stale. XOR is the honest shape.

**createGrant Zod change:** extend `CreateGrantInput` with `collectionId: z.string().uuid().nullable()` + `sopId: z.string().uuid().nullable()` + a second `.refine` XOR. Target guard: keep the existing `collRow` guard for collection targets (its literal is spec-pinned — see repoint inventory) and add a mirrored `sopRow` guard (`from('sops').select('id').eq('id', sopId).eq('organisation_id', orgId)`) for SOP targets. `createGrant`'s 23505 idempotent-re-read must add `.is('sop_id', null)`/`.eq('sop_id', …)` matching. `revokeGrant` must branch its re-materialization: collection-target → `materializeCollectionAccessForOrg` (existing), SOP-target → `materializeSopAccessForOrg` directly.

**PostgREST after DDL:** assertion scripts run immediately after `db push` can hit the PGRST205 stale-schema-cache window — treat PGRST205 as distinct from 42P01, or verify via `to_regclass()` through the Management API ([2026-06-15] learning).

### Pattern 2 — Pre-plan gate (b): narrowing-override semantics (RECOMMENDED)

**Override trigger:** existence of **any direct SOP-target grant on that SOP, from any subject tier** — the sketch README's own data-model note says exactly this ("the resolver needs one extra rule (a SOP with any direct grants stops following its collection)"). Not just person-subject grants: if a department is granted a single SOP by name, the admin also "chose who sees it" and expects that choice to be the whole answer.

**Where the rule lives:** `materializeSopAccessForOrg` (grants.ts L401-502) only. `resolveEffectiveAccess` stays byte-identical — it unions opaque ids, so run it twice per unit chain: once with `grantsByUnit` (collection targets, existing) and once with `sopGrantsByUnit` (SOP targets, new). The override is then one branch:

```ts
// Inside materializeSopAccessForOrg, after reading grants:
const sopTargetGrants = grants.filter(g => g.sop_id === sopId)
const overridden = sopTargetGrants.length > 0
// deptSet: intersect against sopCollectionIds ONLY when !overridden;
// when overridden, a dept qualifies iff resolveEffectiveAccess(chain, sopGrantsByUnit)
// reaches sopId (direct or inherited from org/area).
// personSet: role-subject SOP grants fan to role_members; person-subject SOP
// grants → sop_access_people ONLY (the Priya rule carries over verbatim).
```

**Edge cases (all must be planned as explicit tasks):**

1. **Last named person removed → SOP re-follows its collection.** This is *emergent* from the trigger rule: revoke the last SOP-target grant → `sopTargetGrants.length === 0` on the next materialize → collection path resumes. No stored "overridden" flag, no cleanup job. Requires `revokeGrant`'s SOP-target branch to re-materialize that SOP (above). The AccessAnswerPanel should state it plainly: "Remove all named people and this SOP follows its collection again."
2. **Org/area/dept-level grants vs the override:** collection-target grants at ANY subject level are ignored while overridden (that's the point). But org/area-subject **SOP-target** grants inherit down normally through the second resolver pass — "everyone on site sees this one SOP" is legal and additive among SOP-target grants (D-11 survives *within* the SOP-target tier; the override only severs the collection tier).
3. **`sops.all_departments` bypass:** 00035's `sops_visible_by_department` arm passes when `all_departments = true` regardless of junction rows — an override on such a SOP would be cosmetic. When the first SOP-target grant is created (or materialization detects override), **set `all_departments = false`** for that SOP. `[VERIFIED: 00035 §7 policy text]`
4. **CR-02 guard update (grants.ts L406-414):** currently "no collection ⇒ skip materialization, preserve legacy rows". New condition: skip only if **no collection AND no SOP-target grants**. A collection-less SOP with SOP-target grants IS inside the grant system now — this is also what lets drafts/uncategorized SOPs be wired by name without `ensureSopCollections` (kills the "This SOP has no collection — set its category first" dead-end in `handleDone`).
5. **`materializeOrgAccess` (CR-03 callers):** it currently filters to collection-bearing SOPs (L332-341). Must also include SOPs bearing SOP-target grants, or role-membership changes won't propagate revocation to overridden SOPs — exactly the retained-access-after-revocation class CR-03 fixed. One extra `.select('sop_id').not('sop_id','is',null)` read on access_grants.
6. **WR-02 divergence SOP** ("Changing Plenum Chamber", 1 of 15 live SOPs would GAIN a department on next re-materialization — still open per 32-VERIFICATION human-item 6): this phase's mechanism IS the answer. Once shipped, express that SOP's narrow intent as SOP-target grants (an admin action on the new UI, or a tiny one-off script) — it then stops following the collection and the divergence is pinned deliberately. Plan should include a UAT step for this instead of leaving Q6 dangling.
7. **Phase-25 dual-write closure (flagged in 32-VERIFICATION Anti-Patterns):** `assignSopDepartments` (departments.ts L484, called from `SopDepartmentEditor` on /admin/sops rows and `DepartmentPicker` sop-mode) and `createSopFromWizard` (sops.ts ~L546, direct `sop_departments` insert; ai-prompt route similar) still write `sop_departments` directly with NO access_grants row — the next unrelated materialize on that collection silently drops them. **Recommended closure:** rewire `assignSopDepartments` to write **SOP-target department grants** (replace-semantics: delete that SOP's dept-subject SOP-target grants, insert the new set) then call `materializeSopAccess` — `sop_departments` becomes 100% derived on every path. Create-time paths call the same helper. Consequence (surface honestly in discuss/plan): a SOP whose departments were hand-picked is *overridden from birth* and won't follow its collection until the picks are cleared — which is semantically truthful ("you chose who sees this") and stable against sibling wiring, but changes the default for wizard-created SOPs. The alternative (seed collection-level grants at publish) reintroduces the WR-02 widening class. See Open Questions #1.

### Pattern 3 — Teams-column ladder (SC-1)

`OrgTree` already carries the whole ladder (`areas[].departments[].roles[].people[]` incl. vacancies) — the access page already fetches it via `listOrgTree()`. `WiringPatchBay` renders only org/area/dept jacks plus person jacks for *existing person-grant subjects* (L575-589). Extension, mirroring the existing area machinery exactly:

- Add `expandedDepts: Set<string>` and `expandedRoles: Set<string>` beside `expandedAreas`; dept rows get a twist (▸/▾) revealing role rows, role rows reveal person rows. Vacancy chips (`p.isVacancy`) render dashed and are **not** clickable (no `id` to grant).
- `chains` memo grows role chains (`org→area?→dept→role`) and person chains (`…→role→person`) — person chains through their role, replacing the current flat `org→person` chain for tree people (keep the flat chain for legacy person-grant subjects not in any role).
- `peopleIndex` grows role→members entries (from `role.people`); `leftEndpoint` generalizes from "area collapsed ⇒ anchor at area" to "nearest collapsed ancestor" via a parent-chain lookup (dept collapsed ⇒ role/person wires anchor at dept, etc.).
- `handleLeftClick(id, 'role' | 'person')` already flows into `pending` with the right `subjectType` — connect-mode needs no new mechanics, only the new rows.

### Pattern 4 — Collection→SOP drill-down + wire density (SC-2, pre-plan gate c)

- Server page: the access-view assembly (page.tsx L193-222) already counts `sop_collections` rows; extend to fetch `id, title, status` per collection (one `.in('collection_id', ids)` join read) and pass `sopsByCollection` down. The pinned-`?sop=` path stays as a deep-link nicety but is no longer required (SC-2).
- Right column: `expandedCollections: Set<string>`; SOP rows render nested (reuse the shipped pinned-SOP nesting JSX from d3fc9f5 — it's already the child-row pattern). Clicking any SOP row enters choose-mode (generalize `enterWireUp` from "the one pinned newSop" to "the selected SOP" — `WiringNewSop` becomes a derived selection, with `ensureSopCollections` invoked lazily server-action-side only when needed for collection display, not as a wiring precondition per Pattern 2 #4).
- **Wire density at 15×20:** mirror `leftEndpoint` with a `rightEndpoint`: a SOP-target wire anchors at the SOP row when its collection is expanded, else at the collection jack (aggregated `count` badge on the wire — `WireAgg.count` already exists). Combined with the shipped quiet-by-default rule (zero wires until focus/connect) and focus-only drawing, worst case remains bounded by one unit's wire set. Search (`matchIds`) extends to SOP titles and auto-expands their collections (same effect the area auto-expand already implements at L447-454).
- Overridden SOPs get a row pill ("chosen by name") — the state is derivable client-side from `grants` (any grant with `sopId === row.id`).

### Pattern 5 — Plain language (SC-5)

- Keep the `SelectionStrip` 48px fixed slot **exactly as-is structurally** (Phase 32 SC-6 pixel-stability contract) and rewrite only copy: "✓ Done wiring" → "Save — done"-class label, "via N grants" → people-first sentences, idle onboarding line rewritten. Every copy literal is pinned by `banner-slot-stability.spec.ts` — repoint in the same commit (inventory below).
- The absorbed B panel is a **new component below the bay** (`AccessAnswerPanel`), not a taller strip — selecting a SOP/collection renders "Who can see this?" ("Only 2 people can see this SOP — Dave Hohaia and Priya Sharma, chosen by name"), selecting a person/team flips to "What can they see?". Data: the same `accessByUnit` / `grants` / `peopleIndex` memos the bay already computes — no new fetches, lift the memos or pass results down.
- Jargon sweep scope: `WiringPatchBay` ("NEW · UNWIRED", "N grants", bay-hint line, `saveError` copy "Wiring failed — … pending grants are kept"), `SelectionStrip`, PublishStage's "Wire up access" CTA label. Keep internal identifiers (`createGrant`, `pending`, testids) — SC-5 is user-visible copy only; renaming internals would churn dozens of pinned spec strings for zero user value.

### Pattern 6 — Wayfinder header (SC-6)

Consolidation map (all files in `src/app/(protected)/admin/sops/builder/[sopId]/` unless noted):

| Today | Wayfinder |
|---|---|
| Dark 48px header in `BuilderStageShell` (inline styles, `#0a0a0b`) | Light bar: white bg, `--ink-100` hairline zone dividers. **Back zone:** "Back to · SOP library" (`← Library` link, kept href). **Here zone:** amber "YOU'RE EDITING" tick over `--brand-yellow` rule + title (ellipsized) + `v{n}`. **Forward zone:** single chip = next stage, carrying the lock reason as a sentence when gated. |
| `BuilderStageStepper` (3 chips + 🔒 "N of M steps left to verify" subline) | Becomes the here/forward-zone renderer. **Keep the file, the `BuilderStage` union, the stage keys, and the display labels 'Edit' / 'Check' / 'Send to workers'** — all pinned by `tests/phase30/plain-language.spec.ts` and `tests/builder/builder-review-flow.spec.ts`. Lock copy becomes "Locked — {remaining} steps below still need checking". Shell's `activeStage` state machine, `handleStageSelect` guards, and the WR-01 demote effect are untouched. |
| Tools cluster: `SopActionsMenu` (4 links + DeleteSopButton) + `BuilderFlowEditButton` + `BuilderFlowButton` | ONE "Tools for this SOP ▾" menu in a `--paper-2` tools row under the bar. Menu = the 4 links with the new locked labels + two items invoking the flow modals + Delete this draft. Laziest wiring for the flow items: lift the two flow components' modal state up or restyle their trigger buttons as menu rows — both components already portal their modals and take `sop`/`sopId` props, so they can render inside the menu popover unchanged. `DeleteSopButton` keeps its `<DeleteSopButton sopId={sopId}` shape (regex-pinned). |
| `OrientationStrip` (interim c75307f, review stage only) | **No test pins it** (verified by grep) — free to keep, restyle, or fold. Recommend: keep it as the Check-stage banner (it answers a different question — review progress) but dedupe the lock-reason sentence so it isn't stated twice. |

**Keep the `BuilderStageShell` component name and its `handlePublish` / approval handlers / `hasSourceDoc = showPane` derivations verbatim** — they're pinned by 6 spec files (`builder-review-flow`, `publish-stage-approval`, `sb-auth-builder`, `sb-builder-infrastructure`, `scp-source-viewer`, `scp-parse-pipeline`). Rebuilding only the header JSX inside the existing component keeps all of them green with zero repoints.

**CSS tokens:** the new bar must use declared tokens only (`--ink-100`, `--paper-2`, `--brand-yellow`, `--accent-ok` — all declared as of the 2026-07-14 sweep) and `tests/lint/no-undefined-css-tokens.spec.ts` fails CI on any fallback-less `var(--x)` no stylesheet declares. Grep `-- "--token:" src/` before referencing anything new.

### Anti-Patterns to Avoid
- **Per-view inheritance recompute:** every access display must route through `resolveEffectiveAccess` (Phase 32 "ONE resolver" rule; `wiring-at-scale.spec` pins the import + call).
- **In-place inherited revoke in the bay:** D-11 still bans it for collection grants; revocation happens at source. The override is not an exception affordance — it's a different target tier.
- **A stored `overridden` boolean on sops:** derive it from grant rows (emergent re-follow, no sync bug class).
- **Renaming user-facing jargon by renaming code identifiers:** churns ~40 pinned literals for no user value.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Inheritance/union resolution for SOP targets | A second resolver | `resolveEffectiveAccess` called with `sopGrantsByUnit` | Pure fn is target-agnostic; unit-tested 6 ways already |
| SOP→collection companion write | New junction writer | `ensureSopCollectionsForOrg` (sop-collections.ts) | Handles 23505 races, org guard, category-less SOPs |
| Ephemeral live-DB test fixtures | New harness | Copy helpers from `tests/phase32/grants-org-isolation.spec.ts` (`createEphemeralOrg/Admin`, `mintAccessToken`, `managementSql`, cascade cleanup) | Proven against prod Supabase; org-delete cascades all fixtures |
| Wire drawing/collapse for SOP rows | New SVG layer | Existing `drawWires`/`WireAgg`/`leftEndpoint` machinery | `rightEndpoint` is a ~10-line mirror |
| Admin-gated server actions | New auth idiom | `requireAdminContext()` + `callerOrgId` + `createAdminClient()` (grants.ts local pattern) | The exact pattern the security specs pin |

## Runtime State Inventory

(This phase alters a live schema + live materialized state — rename/migration discipline applies.)

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Live prod `access_grants` (seeded by 00047 + any UAT wiring), materialized `sop_departments` (13+ rows, day-one-equivalent) and `sop_access_people`; 15 live SOPs, 1 divergent (WR-02) | Migration 00050 is pure-additive to rows (column relax + new nullable column) — existing rows untouched. WR-02 SOP handled post-ship via the new mechanism (Pattern 2 #6), not by data migration. |
| Live service config | Supabase prod DB (no staging); migrations applied via `npx supabase db push` from dev machine | Apply 00050 in-wave with a live-verification script (pg introspection via Management API, mirroring `assert-phase32-day-one-equivalence.ts`); expect PGRST205 stale-cache window. |
| OS-registered state | None — verified: no schedulers/services reference these tables | None |
| Secrets/env vars | `.env.local` on dev machine: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (NOT `_ANON_KEY` — [2026-05-08]), `SUPABASE_ACCESS_TOKEN` (Management API) | No changes; phase33 runtime specs read the same vars via the `loadEnv()` idiom |
| Build artifacts | 00049's `uq_access_grants_subject_collection` index is DROPPED and replaced by 00050 | Repoint the comment/spec references; `createGrant`'s 23505 handling keeps working (new index still raises 23505 on dupes) |

## Source-Contract Repoint Inventory (planner: schedule these edits IN THE SAME COMMIT as the source change)

The [2026-07-13] stale-guard class is this phase's #1 execution risk. Verified pins, by file being changed:

**`src/actions/grants.ts` changes (SOP-target arm):** `tests/phase32/grants-org-isolation.spec.ts` extracts function bodies with `/export async function createGrant\(([\s\S]*?)\n\}/`-style regexes and pins: `verifySubjectInOrg` + `from('collections')` guard indices strictly BEFORE `from('access_grants')\n    .insert(` (exact indentation!); literals `'Subject not found in this organisation'`, `'Collection not found in this organisation'`, `'Grant belongs to another organisation'`; `materializeCollectionAccessForOrg(` in both create/revoke bodies (revoke's SOP branch must keep this call reachable or the pin repointed); `createAdminClient()`; `.from('sop_departments')` / `.from('sop_access_people')` in `materializeSopAccessForOrg`. Keep literals + ordering, or repoint.

**`WiringPatchBay.tsx` changes:** `tests/phase32/wiring-at-scale.spec.ts` pins ~15 exact source lines (`toggleArea`, `expandedAreas`, `leftEndpoint` body line, `resolveEffectiveAccess(chain, grantsByUnit)`, the personal-edge push line, stroke/dasharray attribute lines, `{c.sopCount} SOPs`, `{deptPeopleIds(dept).length}p`, absence of `revokeGrant`, presence of `D-11`). `tests/phase32/wire-up-mode.spec.ts` pins `NEW · UNWIRED`, `enterWireUp`/`handleDone` body lines, `blastRadiusPeople` lines, SelectionStrip prop lines, `not.toContain('collectionId: newSop.id')`. `tests/phase32/library-filter-deeplink.spec.ts` pins the `openInLibraryHref` construction + `WiringPatchBayShell` mount.

**`SelectionStrip.tsx` copy (SC-5):** `tests/phase32/banner-slot-stability.spec.ts` pins `h-[48px] overflow-hidden`, the full `className={\`strip-slot h-[48px] overflow-hidden ${state}\`}` line, idle copy both halves, `Visible to <b>{peopleCount}</b>`, `via {grantCount} grant`, `✓ Done wiring`, `onClick={onDone}`. Keep the structural pins; repoint every copy pin.

**Builder header files:** `tests/phase30/list-rows.spec.ts` pins the four OLD menu labels (`Assign to team`, `Version history`, `Generate video`, `Print QR code`) — MUST repoint to the locked new labels — plus href regexes (`/admin/sops/${sopId}/assign|versions|video|qr` — keep), `<DeleteSopButton\s+sopId=\{sopId\}` + `isDraft={initialSop.status === 'draft'}` + `{isDraft && (` (keep shapes), `aria-haspopup="menu"` / `aria-expanded={open}` (keep). `tests/phase30/plain-language.spec.ts` pins Stepper labels `'Edit'/'Check'/'Send to workers'` + stage keys + absence of old labels (keep by keeping the file/labels). `tests/builder/builder-review-flow.spec.ts` pins shell imports (incl. `BuilderStageStepper`), `handlePublish`/`onPublish`/publish URL regex, `hasSourceDoc = showPane`, no direct `data-testid="publish-button"`. `tests/phase29/publish-stage-approval.spec.ts` pins `approveStep(`/`requestChanges(` handlers + `<BuilderStageShell` mount regex. `tests/lint/no-preview-pill.spec.ts` reads `BuilderFlowButton.tsx` (file must keep its path). `tests/sb-auth-builder.test.ts`, `tests/sb-builder-infrastructure.test.ts`, `tests/integration/scp-source-viewer.test.ts`, `tests/integration/scp-parse-pipeline.test.ts` pin `BuilderStageShell` existence/mount — all survive if the component name/path is kept.

## Common Pitfalls

### Pitfall 1 — Service-role writes without per-path org self-enforcement (recurred 3×: [2026-06-15], [2026-06-26], Phase 26.5)
The new `sopId` target arm adds a fresh admin-client write path. `createGrant` must verify the SOP row's `organisation_id === orgId` BEFORE insert (mirror the existing `collRow` guard); `materializeSopAccess`'s public wrapper already does. Every new path, not just the happy one.

### Pitfall 2 — SECURITY DEFINER posture ([2026-07-05])
No new SECURITY DEFINER function should be needed (reuse `sop_in_user_person_grants`). If one is added anyway: self-scope via `auth.uid()` or `REVOKE EXECUTE … GRANT TO service_role`; never a caller-supplied org/subject parameter. Also [2026-05-08]: SQL function bodies reference tables by NAME — no renames without recompile.

### Pitfall 3 — RLS recursion ([2026-05-13] / 00030/00031 trap)
Zero new policies is the recommended path. If any junction policy is touched: never reference `sops`/`departments`/`roles`/`collections` from a junction's own SELECT policy (42P17 breaks unrelated queries org-wide).

### Pitfall 4 — `'use server'` sync exports ([2026-06-27])
Any pure helper for the override rule (e.g. `resolveSopEffectiveAccess`) must live in `src/lib/org-model/`, NOT as an export of `grants.ts` — `tsc` won't catch it, only `npm run build` will. Run a real `next build` as the phase gate.

### Pitfall 5 — Undefined CSS tokens ([2026-07-14])
The Wayfinder restyle swaps hardcoded hex for tokens. Every bare `var(--x)` must be declared (`grep -rn -- "--x:" src/`) or carry a fallback; the lint spec enforces fallback-less usage, but **a wrong-but-declared token still renders wrong silently** — screenshot the deployed header after ship. Green tests prove nothing about visibility.

### Pitfall 6 — Believing RLS hides overridden SOPs from same-org workers (subtle, verified live in 32-05)
`org_members_can_view_sops` (00003) OR-composes an org-wide SELECT with the dept/person arms — **any authenticated same-org member can raw-SELECT any SOP row**; this is shipped, deliberate, and out of scope to change (per the design note in `tests/phase32/person-grant-rls.spec.ts`, confirmed live). The narrowing override's real enforcement surface is the **materialized junction rows** (`sop_departments` / `sop_access_people`) and the read paths that consult them (worker library dept filter reads `sop_departments`; the D-13 RPC reads `sop_access_people`). SC-4's runtime tests must therefore assert junction-row truth + `sop_in_user_person_grants()` outcomes — asserting raw `.select()` denial for a non-chosen same-org worker would assert something false. Do not "fix" this by touching shipped policies (D-02 lock).

### Pitfall 7 — Editing the pinned-string surface without repointing (the [2026-07-13] class, twice observed)
See the Repoint Inventory. A persistently-red guard on the publish/grant path is a triage-now event, not a flaky test.

### Pitfall 8 — Spec drift on 00049's replaced index
`grants-org-isolation` and scripts reference `uq_access_grants_subject_collection` in comments only (no live pin found), but `scripts/assert-phase32-day-one-equivalence.ts` may introspect it — check and update the live-verification script alongside 00050.

## Code Examples

### Calling the unchanged resolver for SOP targets
```ts
// Source: src/lib/org-model/resolve-access.ts (current) — values are opaque ids
const collectionAccess = resolveEffectiveAccess(chain, grantsByUnit)      // existing
const sopAccess        = resolveEffectiveAccess(chain, sopGrantsByUnit)   // NEW input, same fn
// Override rule applied by the CALLER (materialization / bay display):
const overridden = directSopGrantIds.has(sopId) /* any subject tier */
```

### Ephemeral-org runtime test skeleton (SC-4)
```ts
// Source: tests/phase32/grants-org-isolation.spec.ts (verbatim helpers)
const admin = serviceClient()
const orgA = await createEphemeralOrg(admin, 'P33 Org A')
const { email } = await createEphemeralAdmin(admin, orgA)
// … seed dept + collection + 2 SOPs + collection grant → materialize →
// assert both SOPs' sop_departments; add person-subject SOP-target grant on SOP-1 →
// re-materialize → assert SOP-1 sop_departments EMPTY + sop_access_people = {person}
// (override), SOP-2 unchanged (still follows collection); revoke → re-follows.
// Cleanup: org delete cascades everything (afterAll pattern).
```

## State of the Art

| Old Approach (Phase 32) | Current Approach (Phase 33) | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Grants target collections only (D-13 "per-SOP is a later refinement") | Nullable-arm SOP targets + narrowing override | Decided 2026-07-19 (UAT sketch review) | Supersedes UAT Q6; answers WR-02 |
| Additive-only, no overrides (D-11) | Additive-only *within* a target tier; SOP-target existence severs the collection tier | 2026-07-19 | First override; no negative-grant rows |
| `?sop=` pin required to wire a SOP | Organic drill-down, collections expand to SOPs | 2026-07-19 | G2 closed |
| Patch-bay jargon ("grants", "wire up", "UNWIRED") | Plain-language "Who can see this?" | 2026-07-19 | G3 closed; large copy-pin repoint |
| Dark 4-zone builder header (interim c75307f/d3fc9f5 fixes) | Light Wayfinder bar + one tools menu | 2026-07-19 | G1 closed |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Supabase project is on PG15+ (relevant only if a `NULLS NOT DISTINCT` index is preferred over the coalesce-sentinel form) | Pattern 1 | Low — the recommended coalesce index works on any supported PG version, mirroring 00049 |
| A2 | The wizard/creation dual-write closure (rewire `assignSopDepartments` through SOP-target grants) is acceptable product behaviour (hand-picked SOPs are overridden from birth) | Pattern 2 #7 | Medium — needs Simon's confirmation at discuss/plan; fallback options listed in Open Questions #1 |
| A3 | `scripts/assert-phase32-day-one-equivalence.ts` does not hard-pin the 00049 index name in an assertion (comments only) | Pitfall 8 | Low — one-line check before the migration wave |

## Open Questions (RESOLVED 2026-07-19 — all four adopted at plan time)

_OQ1 → option (i) adopted (ROADMAP entry + 33-07: dual-write closure via SOP-target grants, overridden-from-birth). OQ2 → "check"-verb in new copy only (33-04/33-09). OQ3 → approval-chain state on the forward chip (33-04). OQ4 → vacancies shown dashed-inert (33-06)._

1. **Dual-write closure default (A2):** when an admin hand-picks departments at SOP creation, does the SOP (i) become chosen-by-name/overridden (recommended — truthful, stable, matches the new model), (ii) get collection-level grants seeded at publish (WR-02 widening class), or (iii) keep the legacy direct-write until first touched in the access map (leaves the silent-drop hole open)? Recommendation: (i). Needs a locked decision before the grants.ts wave.
2. **"Check" vs "Verify" product-wide verb** (carried from the sketch README) — the Wayfinder lock sentence reads "…still need checking" while the checklist says "verify". Recommend: adopt "check" in the new copy only; a product-wide verb sweep is out of scope.
3. **Approval-chain state on the Wayfinder** (Phase 29 pending-approval): where does the forward chip show it? Recommend: a third chip state (amber "Waiting for approval — {approver}") mirroring `PublishStage`'s existing `approvalStatus` prop; confirm at plan time.
4. **Vacancy rows in the ladder:** not grantable (no user id). Show greyed for org-shape honesty, or hide in the access map? Recommend: show, dashed, non-interactive.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Live Supabase env (`.env.local` incl. `SUPABASE_ACCESS_TOKEN`) | Runtime specs + migration verify | ✓ (phase-32 specs ran live 2026-07-18) | — | Specs `test.skip` gracefully when absent |
| `npx supabase db push` | Applying 00050 | ✓ (optionalDependencies CLI, used for 00046-00049) | — | Management API SQL |
| Playwright + chromium | Source-contract + unit + live-DB specs | ✓ (Node runner; no chromium needed for these spec classes) | — | Browser UAT is Railway-only (sopstart.com post-deploy) per project convention |
| `npx tsc --noEmit` + `npm run build` | Phase gates | ✓ | TS 5 / Next 16 | — |

**Missing with no fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright (@playwright/test), config `playwright.config.ts` |
| Config file | `playwright.config.ts` — **Wave 0: register `phase33` project** (`testDir: '.'`, `testMatch: /tests\/phase33\/.*\.(spec|test)\.ts$/`, mirroring the phase32 broad-registration comment block; verify `npx playwright test --list --project=phase33` — zero discovered = FAIL, [2026-05-25]) |
| Quick run command | `npx playwright test --project=phase33` (add `--project=phase32 --project=phase32-unit` when touching pinned files) |
| Full suite command | `npx playwright test --project=phase32 --project=phase32-unit --project=phase33; npx tsc --noEmit; npm run build` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SC-1 | Ladder tiers render/expand/select in bay source | source-contract | `npx playwright test tests/phase33/teams-ladder.spec.ts --project=phase33` | ❌ Wave 0 |
| SC-2 | Collections expand to SOP rows; organic select enters choose-mode | source-contract (+ runtime `test.fixme` for browser half) | `npx playwright test tests/phase33/sop-drilldown.spec.ts --project=phase33` | ❌ Wave 0 |
| SC-3 | Schema XOR + createGrant sopId arm + override trigger | source-contract + live pg introspection | `npx playwright test tests/phase33/sop-grant-schema.spec.ts --project=phase33` | ❌ Wave 0 |
| SC-4 | Override/org-isolation/revoke-propagation against LIVE junctions (ephemeral orgs — flip live, NO test.fixme, per the [2026-06-15] mandate the 32-05 specs honored) | live runtime | `npx playwright test tests/phase33/sop-grant-materialization.spec.ts --project=phase33` | ❌ Wave 0 |
| SC-4 | Pure override-rule unit cases (incl. last-person-removed re-follow) | unit | `npx playwright test --project=phase32-unit` (new `.test.ts` in `src/lib/org-model/__tests__/` auto-registers — testDir regex covers it, no config edit) | ❌ Wave 0 |
| SC-5 | No jargon literals in wiring UI copy; answer-panel sentences present | source-contract/lint | `npx playwright test tests/phase33/plain-language-access.spec.ts --project=phase33` | ❌ Wave 0 |
| SC-6 | Wayfinder zones + single tools menu + locked labels + lock-reason chip | source-contract | `npx playwright test tests/phase33/wayfinder-header.spec.ts --project=phase33` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** the owning phase33 spec + any phase30/32/builder spec whose pins the task touched (per Repoint Inventory)
- **Per wave merge:** full phase32 + phase32-unit + phase33 + `npx tsc --noEmit` ([2026-06-02]: full tsc, not just next build's scope)
- **Phase gate:** full suite + `npm run build` clean ([2026-06-27]) + journeys.ts 0-not-mapped check (`tests/phase30/governance-fold.spec.ts` — routes don't change this phase, but flow descriptions may; uat/tests.ts should gain phase-33 UAT entries) + human UAT on sopstart.com post-deploy (Railway-only convention)

### Wave 0 Gaps
- [ ] `playwright.config.ts` — `phase33` project registration
- [ ] 6 stub specs above in `tests/phase33/` (source-contract halves real from day one; browser halves honest `test.fixme` with reasons, per phase-32 precedent)
- [ ] `src/lib/org-model/__tests__/resolve-sop-access.test.ts` (or extend `resolve-access.test.ts`) — behavioral unit stub

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (unchanged) | `getSessionContext()` / `requireAdminContext()` idiom |
| V3 Session Management | no (unchanged) | — |
| V4 Access Control | **yes — the phase's core** | admin-client writes with per-path org self-enforcement (grants.ts pattern); NO authenticated write policy on `access_grants`/junctions (live-verified pg_policies posture — keep); zero new RLS policies (SOP targets ride 00035/00046 arms) |
| V5 Input Validation | yes | Zod `CreateGrantInput` extension: `z.enum` subject types (never free strings), uuid + XOR refine on collectionId/sopId |
| V6 Cryptography | no | — |

### Known Threat Patterns for this change
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-tenant SOP-target grant (org A admin, org B sop_id) | Elevation | `sops.organisation_id === orgId` guard before insert + live ephemeral-org rejection test (mirror of the 32-05 collection test) |
| Retained access after revoke/override (the dangerous direction) | Elevation | revokeGrant SOP branch re-materializes; materializeOrgAccess includes SOP-target-bearing SOPs (Pattern 2 #5); live test asserts junction rows gone |
| Override bypass via `all_departments` | Elevation | Force `all_departments = false` on override (Pattern 2 #3) + test |
| Duplicate grants defeating revoke (WR-04 class) | Tampering | Replaced unique index covers sop_id (Pattern 1) |
| Grant disclosure across tenants | Info disclosure | `access_grants_org_read` org-scoped SELECT unchanged; new UI reads ride it |

## Sources

### Primary (HIGH confidence — read in full this session)
- `supabase/migrations/00046`–`00049` — current schema, RLS posture, unique-index precedent
- `src/actions/grants.ts`, `src/lib/org-model/resolve-access.ts`, `src/lib/org-model/sop-collections.ts`, `src/actions/org-model.ts` (CR-03 call sites), `src/actions/departments.ts` (`assignSopDepartments`), `src/actions/sops.ts` (wizard direct write), `src/types/org-model.ts`
- `src/components/admin/wiring/{WiringPatchBay,SelectionStrip,WiringPatchBayShell}.tsx`, `src/app/(protected)/admin/sops/page.tsx` (access-view assembly)
- Builder cluster: `BuilderStageShell.tsx` (incl. `SopActionsMenu`), `BuilderStageStepper.tsx`, `OrientationStrip.tsx`, `BuilderFlowButton.tsx`
- `tests/phase32/*` (all 8 specs — pins + live-runtime patterns + the 00003 OR-compose design note), `tests/phase30/{list-rows,plain-language}.spec.ts`, `tests/builder/builder-review-flow.spec.ts`, `tests/phase29/publish-stage-approval.spec.ts`, `tests/lint/no-preview-pill.spec.ts`, `playwright.config.ts`
- `.planning/ROADMAP.md` Phase 33 entry; `.planning/todos/pending/phase-seed-per-sop-access-and-wayfinder.md`; `sketches/access-hierarchy/README.md`; `sketches/builder-header-orientation/README.md`; `.planning/phases/32-*/32-{CONTEXT,VERIFICATION,HUMAN-UAT}.md`; `CLAUDE.md` §Learnings

### Secondary / Tertiary
- None needed — no web research performed; no claims rest on training data alone (see Assumptions Log for the 3 tagged items).

## Project Constraints (from CLAUDE.md)
- Railway-only testing: no localhost UAT instructions; browser verification happens on sopstart.com post-deploy. `git push` is part of the commit workflow **during execution** (not for this research commit, per task instruction).
- journeys.ts / uat tests.ts updated in the same change as any flow change; `/pathways` 0-not-mapped is a verify gate.
- Learnings cited inline above: [2026-06-15] admin-client org-scope, [2026-07-05] SECURITY DEFINER, [2026-05-13] RLS recursion, [2026-06-27] 'use server' sync exports + real `next build` gate, [2026-06-02] full `tsc --noEmit` post-merge, [2026-05-25] unregistered-spec, [2026-06-05]/[2026-07-13] source-contract wiring/staleness, [2026-07-14] CSS tokens, [2026-05-08] anon-key var name + SQL-function-body renames, [2026-06-15] PGRST205.
- Worktree waves: cross-wave-dependent plans run sequentially on the main tree ([2026-06-02] worktree base-pinning).

## Metadata

**Confidence breakdown:**
- Grant schema + override semantics: HIGH — every relevant line of the current implementation read; recommendation is the minimal-diff extension of shipped patterns
- UI extension (bay + Wayfinder): HIGH for what-exists/what-extends; MEDIUM for exact visual execution (sketch index.html files are the look-and-feel contract — build to them)
- Test surface: HIGH — pins enumerated from the spec sources directly
- Product-behaviour edge (dual-write closure default): MEDIUM — flagged as A2/Open Question 1 for user confirmation

**Research date:** 2026-07-19
**Valid until:** ~2026-08-19 (internal codebase research; invalidated earlier by any commit touching grants.ts/WiringPatchBay/builder header)
