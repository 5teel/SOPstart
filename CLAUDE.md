# SafeStart — SOP Assistant PWA

**Ownership:** SOPstart (sopstart.com) belongs to **Potenco Pty Ltd**. It has nothing to do with Summit Insights (Simon's day job); any super-admin / curator concept here is Potenco's.

## What it is

Multi-tenant SaaS PWA for New Zealand industrial sites (glass, packaging, machine shops; 50-500 SOPs). Admins upload Word/PDF SOPs, AI parses them into structured procedures, workers follow them on phone or desktop with photo capture, completion records and supervisor sign-off. Current shape: one SOP-first home (`/`) plus the SOP focus screen; see `.planning/HANDOFF.md` for where work stopped.

## Stack

- Next.js 16.2 (App Router), React 19, TypeScript 5, Tailwind CSS 4
- Supabase: Postgres + Auth + Storage + RLS (anon key env name: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`)
- TanStack React Query (server state); Zustand only in `useFocusAutosave`
- AI parsing: OpenAI (GPT); reviewer/verifier: Anthropic. File parsing in `src/lib/parsers/` (mammoth, unpdf, tesseract.js, pptx/xlsx/video-audio extractors)
- React Hook Form + Zod; Lucide icons; Playwright for all tests
- **Online-only since Phase 55**: `public/sw.js` is a kill-switch that unregisters old service workers. Do not reintroduce Serwist / Dexie / idb-keyval.
- Dev port 4200. Deploy: push `master` → Railway (healthcheck `/api/version`).

## Map

- `src/app/` — `/` home, `welcome/`, `(auth)/` (login, sign-up, invite, join), `(protected)/` (`sops/[sopId]` focus screen with Browse / Walk / `?mode=edit`; `activity/[completionId]`; `admin/` sops new + upload, settings, ai-settings, agent; `pathways`, `uat`, `profile`, `pending`), `api/sops/` (parse, ai-prompt, restructure, transcribe, `[sopId]`)
- `src/components/` — `home/` (HomeShell, SectionMenu, TabBar, SopList, ReadView, SiteMap), `focus/` (frame, browse, walk, lazy `admin/` editor), `sop/`, `brand/Wordmark.tsx`, `activity/`, `office/`, `requests/`
- `src/actions/` — server actions (every export is a public POST endpoint)
- `src/lib/` — `library/` (areas, isometric layout), `parsers/`, `supabase/` (client, server, admin, middleware), `auth/` (`getSessionContext`, `guards.ts`), `decisions/record.ts`, `validators/`
- `src/hooks/` — `useWalk`, `useStepPhotos`, `useFocusSop`, `useReadSop`, `useLibrary`, `useCompletions`, `useFocusAutosave` …
- For anything deeper: `graphify-out/GRAPH_REPORT.md`, `.planning/codebase/`.

## Data model essentials

- `sops` → `sop_sections` → steps; `sop_focus_steps` (hazard / ppe / step / check rows) are written only by `scripts/convert-sops-to-steps.ts`, re-runnable by `(section_id, source_key)`. SOP lifecycle `uploading → parsing → draft → published`.
- `standards` + `standard_attachments`; `sops.placement` is trigger-maintained from `sop_machines`, never written by the UI.
- `decisions` is an append-only ledger: write only via `recordDecision()` (org and actor from the session). Every data-changing action logs a row (ADR-0008; autosaves coalesce).
- Walk photos: signed-URL upload tagged to the active completion id; `submitCompletion` (`src/actions/completions.ts`) validates `{org}/completions/{localId}/{photoId}.{jpg|png}` and is retry-safe.
- Roles: worker, supervisor, admin, safety_manager. Who can do what: `.planning/codebase/CAPABILITY-MATRIX.md` (access only; obligation is the Phase 44a record).

## Conventions

- **Design tokens live only in `src/styles/blueprint-theme.css`** (colour, type, spacing, radius, tap targets). No raw Tailwind palette classes, bare hex, or arbitrary `h-[56px]` in components; radius is `rounded` / `rounded-lg` / `rounded-2xl` / `rounded-full`. Enforced by `tests/lint/design-tokens.spec.ts`.
- **Design base (ADR-0007, sketch `011-design-base`)**: colour is for safety (red hazard, amber PPE/overdue, everything else ink); no coloured left bars; sentence-case `.section-heading`, caps only for HAZARD/PPE; shared controls `.seg` `.chip` `.tag` `.signal` live in `blueprint-theme.css`. New design passes change those classes, not call sites.
- Paper theme app-wide; brand yellow belongs to the wordmark.
- Glove-friendly tap targets; RLS for all data access; `admin.ts` client only for elevated work, scoped to the session org.
- Mutations in `src/actions/`; complex file/AI work in API routes; Zod schemas in `src/lib/validators/`; migrations numbered in `supabase/migrations/`.
- Plain words in the UI: no "block", no "walk", no "rooms" (guards in `tests/lint/`).

## Binding docs (read before planning or building)

- **ADRs** — `docs/adr/README.md`. Accepted ADRs are binding; a plan that contradicts one stops and asks Simon. Structural choices get a new ADR in the same commit (plus a `tests/lint/` guard if checkable). Supersede, never edit. Key ones: 0002 no scheduled jobs · 0004 design principles · 0005 library map replaces rooms · 0006 typography (Inter + Saira Semi Condensed, nothing under 12 px) · 0007 design base · 0008 every action logged to the ledger.
- **Design** — `Skill("sketch-findings-SOPstart")` before any worker-facing UI, home, authoring flow or org/permission surface. For the home: sketches `009-sop-first-home` and `010-wordmark` plus ADR-0004/0005 govern.
- **Customer research** — `.planning/research/customer-interviews/` before locking contentious UX decisions.

## Same-commit maintenance rules

A change is not done until these match it, in the same commit:

1. **Routes / flows** → `src/lib/journeys/journeys.ts` (`/pathways` "All screens" must show 0 not-mapped). Worth team review → also `src/lib/uat/tests.ts`.
2. **RLS policy, `require*` guard or role check** → `.planning/codebase/CAPABILITY-MATRIX.md`.
3. **Structural decision** → new ADR.
4. GSD plan-phase adds these as explicit tasks; code-review / verify-work confirm them.

## Commands

```bash
npm run dev                    # port 4200
npm run build                  # production build (required gate, tsc alone is not enough)
npx tsc --noEmit               # full typecheck (covers tests; next build does not)
npm run test                   # Playwright, all projects
npm run eval -- --phase <N>    # deployed evals against sopstart.com
```

## Deployed evals (no manual UAT)

Every phase touching a user-facing surface ships `tests/evals/<area>.eval.ts` and runs `npm run eval -- --phase <N>` after pushing (waits for Railway to serve HEAD). Fixtures: `eval-admin@sopstart.com`, `eval-worker@sopstart.com` (`node scripts/eval-fixtures.mjs`); sessions minted by `tests/evals/lib/session.ts`. Output in `.planning/evals/latest/` and `<N>-EVAL.md`. **Read the screenshots before declaring a pass.** Escalate to Simon only with a specific failing screenshot.

## Learnings

Distilled rules below. **Full dated log with the stories: `docs/LEARNINGS.md` — append new entries there**, and add a one-line rule here only if it is new.

**Security / RLS**
- Service-role writes enforce org from the **session**, never from a fetched row or a client param, and filter the write with `.eq('organisation_id', …)`.
- Permissive policies OR together: a narrowing arm must be ANDed with the org predicate. A `WITH CHECK` replaces `USING`, so restate the org predicate. A command with no policy silently matches zero rows: session `.update()`/`.delete()` end in `.select('id')` and treat empty as failure; dropping a table's last policy for a command is a full deny.
- `SECURITY DEFINER` functions taking an org id parameter are `service_role` only.
- Every `'use server'` export is a public endpoint and must be async; the first client import of an action is a trigger to re-audit its parameters. Deleting a feature's UI means dropping the server params only it supplied.
- CSV exports neutralise leading `= + - @`.

**Build / deploy**
- Never rewrite a bundle baseline to pass. When the gate moves, diff the summed chunk list against a parent build first. Layouts import tiny pure modules only.
- Header-authed routes need a middleware exemption. Windows-only or binary-postinstall deps go in `optionalDependencies`.
- Redirects belong in the proxy or a server component, never a client effect + `router.replace` (Next 16.2.1 orphans in-flight server actions).
- Never derive first render from `navigator` / `window` / `Date.now()`.

**UI**
- Undefined CSS tokens, unloaded fonts and inert `@theme` blocks fail silently: look at deployed screenshots, check `document.fonts` (first family only), grep compiled CSS.
- One classifier per question in one module; `step_number` is section-scoped.
- After a new lazy module or layout import, run `npm run build` and record the gate number.

**Tests / evals**
- Guards grep comments too: describe banned patterns in words; guards strip comments after normalising CRLF.
- New `tests/lint/*.spec.ts` must be in a Playwright project regex (check with `--list`).
- Deletion guards assert no references, not just no file; when moving code or removing a control, grep `tests/` for its literals and test ids.
- Live probes share one Supabase OTP budget: run the full suite once per gate, never loop it.
- A hanging click = empty locator: assert `toHaveCount(1)` before raising timeouts. Assert rendered content, not HTTP status, for `notFound()`.
- Fixtures key on their own markers; shared eval orgs mean no "exactly N" assertions; author and run each eval case against the deploy as plans land.

**Data / infra**
- Fail-open pipelines omit failed steps from upserts; all jobs erroring at $0 cost is an outage, not "no findings". Keep model IDs current.
- `PGRST205 … schema cache` is a stale cache, not a missing table. Table renames do not rewrite SQL function bodies. Check `supabase migration list` before `db push`.
- Before `git worktree remove`, delete any `node_modules` junction with `cmd /c rmdir`. Worktrees branch from the session-start commit, so cross-wave plans run on the main tree.

## graphify

Knowledge graph in `graphify-out/`. Read `GRAPH_REPORT.md` (or `wiki/index.md`) before architecture questions; prefer `graphify query|path|explain` over grep for cross-module questions; run `graphify update .` after code changes.
