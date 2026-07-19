# Phase 33 — Validation Architecture

_Extracted from 33-RESEARCH.md § Validation Architecture (plan-checker gate artifact, Phase 32 precedent). Source of truth for the phase test map._


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
