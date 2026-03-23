---
phase: 01-foundation
plan: 01
subsystem: scaffold-and-database
tags: [next.js, supabase, rls, multi-tenant, jwt, typescript, tailwind]
dependency_graph:
  requires: ["01-00"]
  provides: ["next-scaffold", "supabase-schema", "rls-policies", "jwt-claims-hook", "supabase-clients", "database-types"]
  affects: ["all-subsequent-plans"]
tech_stack:
  added:
    - next@16.2.1
    - react@19.2.4
    - @supabase/supabase-js@2.x
    - "@supabase/ssr@0.x"
    - zustand@5.x
    - react-hook-form@7.x
    - zod@4.x
    - "@hookform/resolvers@5.x"
    - next-themes@0.4.x
    - tailwindcss@4.x
    - supabase-cli@2.x
    - prettier@3.x
    - prettier-plugin-tailwindcss
  patterns:
    - "Tailwind v4 CSS-based config with @theme block and @custom-variant dark"
    - "next-themes ThemeProvider wrapping layout with defaultTheme=dark"
    - "Supabase RLS + JWT custom claims for zero-overhead tenant isolation"
    - "Custom Access Token Hook injects organisation_id and user_role into every JWT"
    - "Next.js 16 proxy.ts (renamed from middleware.ts) for session management"
    - "Three Supabase clients: server (SSR), browser, admin (service role)"
key_files:
  created:
    - src/app/globals.css
    - src/app/layout.tsx
    - src/app/page.tsx
    - src/lib/constants.ts
    - src/types/auth.ts
    - src/types/database.types.ts
    - src/lib/supabase/server.ts
    - src/lib/supabase/client.ts
    - src/lib/supabase/admin.ts
    - src/lib/supabase/middleware.ts
    - src/proxy.ts
    - supabase/migrations/00001_foundation_schema.sql
    - supabase/migrations/00002_rls_policies.sql
    - supabase/seed.sql
    - supabase/config.toml
    - .env.local.example
    - .env.local
    - .gitignore
    - package.json
  modified:
    - package.json (merged scaffold deps with existing)
decisions:
  - "Next.js 16 uses proxy.ts (not middleware.ts) — exported function must be named proxy(), not middleware()"
  - "TypeScript strict mode requires explicit CookieOptions type annotation in Supabase SSR cookie callbacks"
  - "lightningcss-win32-x64-msvc and @tailwindcss/oxide-win32-x64-msvc native binaries must be explicitly installed on Windows due to npm optional deps bug"
  - "Supabase gen types outputs connection info to stderr — use 2>/dev/null redirect for clean file output"
  - "Custom Access Token Hook grants supabase_auth_admin execute permission and revokes from authenticated/anon/public"
  - "One-org-per-user enforced at DB level with unique(user_id) on organisation_members"
metrics:
  duration_minutes: 21
  tasks_completed: 2
  files_created: 18
  files_modified: 2
  completed_date: "2026-03-24"
---

# Phase 01 Plan 01: Next.js 16 Scaffold + Supabase Multi-Tenant Schema Summary

**One-liner:** Next.js 16 + Tailwind v4 scaffold with Supabase multi-tenant schema, JWT custom claims hook, RLS tenant isolation, and 6 automated SQL assertions proving cross-tenant data isolation.

## What Was Built

### Task 1: Next.js 16 Project Scaffold

Scaffolded a Next.js 16 project in the existing `SOP Assistant` directory (which already contained SOP sample documents and Playwright test stubs from plan 01-00). The existing files were temporarily relocated, the scaffold was applied, and files were merged back.

Key deliverables:
- `package.json` merged with all Phase 1 production and dev dependencies
- `src/app/globals.css` using Tailwind v4 `@import "tailwindcss"` with industrial palette design tokens (`--color-brand-yellow`, `--color-brand-orange`, `--color-steel-*`, `--min-tap-target: 72px`)
- `src/app/layout.tsx` with `ThemeProvider` from `next-themes`, `defaultTheme="dark"`, `enableSystem={false}`, `suppressHydrationWarning`
- `src/lib/constants.ts` as single source of truth for `PRODUCT_NAME` and `PRODUCT_DESCRIPTION`
- `src/types/auth.ts` with `AppRole`, `JWTClaims`, `OrgMember`, `Organisation` TypeScript interfaces
- `.env.local.example` with all required environment variable templates
- `.gitignore` updated with `.env.local`, `supabase/.temp`, `test-results/`, `playwright-report/`

### Task 2: Supabase Schema + RLS + JWT Hook

Complete multi-tenant database foundation:

**Schema** (`00001_foundation_schema.sql`):
- `public.organisations` — root tenant entity with `invite_code`, `trial_ends_at`
- `public.app_role` — enum: `worker | supervisor | admin | safety_manager`
- `public.organisation_members` — links auth.users to orgs with role; `unique(user_id)` enforces one-org-per-user
- `public.supervisor_assignments` — maps supervisors to workers within an org
- `public.current_organisation_id()` — helper extracting org_id from JWT
- `public.current_user_role()` — helper extracting role from JWT
- `public.custom_access_token_hook()` — injects `organisation_id` and `user_role` into every JWT at sign-in

**RLS Policies** (`00002_rls_policies.sql`):
- organisations: users see only their org
- organisation_members: users see only their org's members; admins can insert/update within their org
- supervisor_assignments: users see only their org's assignments; admins manage them

**Seed + Isolation Proof** (`seed.sql`):
- Two test orgs: "Org A - Glass Manufacturing Ltd" and "Org B - Steel Works NZ"
- Three test users: admin-a (Org A admin), worker-a (Org A worker), admin-b (Org B admin)
- One supervisor assignment in Org A
- 6 automated SQL assertions in a `DO $$` block that simulate JWT context via `set_config` and verify that each org's admin cannot see the other org's data — PASSES on every `supabase db reset`

**Supabase Clients**:
- `src/lib/supabase/server.ts` — cookie-based server client for Server Components, Server Actions, Route Handlers
- `src/lib/supabase/client.ts` — browser client for Client Components
- `src/lib/supabase/admin.ts` — service role client for privileged operations (org creation, invites)
- `src/lib/supabase/middleware.ts` — session refresh utility for the proxy
- `src/proxy.ts` — Next.js 16 proxy (formerly middleware) for session management and route protection

## Verification Results

| Check | Result |
|-------|--------|
| `npm run build` | PASS — TypeScript clean, no errors |
| `npx supabase db reset` | PASS — All 6 isolation assertions passed |
| Types contain `organisations` | PASS |
| RLS policies reference `current_organisation_id()` | PASS — 7 occurrences |
| Custom Access Token Hook in config.toml | PASS |
| Seed data has two orgs + assertions | PASS |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Windows native binary missing: lightningcss**
- **Found during:** Task 1 — first `npm run build`
- **Issue:** `lightningcss.win32-x64-msvc.node` not found — npm optional deps bug on Windows doesn't install platform-specific native binaries
- **Fix:** Explicitly installed `lightningcss-win32-x64-msvc` and `@tailwindcss/oxide-win32-x64-msvc`, then clean reinstall after removing `node_modules` and `package-lock.json`
- **Files modified:** `package.json` (lightningcss added as dependency), `package-lock.json`

**2. [Rule 1 - Bug] Next.js 16: middleware.ts deprecated, must be proxy.ts with proxy() export**
- **Found during:** Task 2 — build warning, then error
- **Issue:** Next.js 16 deprecated `src/middleware.ts` convention in favor of `src/proxy.ts`. The exported function must be named `proxy`, not `middleware`. Plan's code used the old convention.
- **Fix:** Renamed `src/middleware.ts` to `src/proxy.ts`, renamed `middleware()` export to `proxy()`
- **Files modified:** `src/proxy.ts` (new), `src/middleware.ts` (deleted)
- **Commit:** 78ec9e7

**3. [Rule 1 - Bug] TypeScript implicit any in Supabase SSR cookie setAll callbacks**
- **Found during:** Task 2 — TypeScript build check
- **Issue:** `setAll(cookiesToSet)` parameter lacks type annotation, TypeScript strict mode rejects implicit any
- **Fix:** Added explicit `{ name: string; value: string; options?: CookieOptions }[]` type to `setAll` parameter in both `server.ts` and `middleware.ts`
- **Files modified:** `src/lib/supabase/server.ts`, `src/lib/supabase/middleware.ts`
- **Commit:** 78ec9e7

**4. [Rule 3 - Blocking] Docker Desktop was not running when Supabase start was attempted**
- **Found during:** Task 2 — `npx supabase start` failed with Docker pipe error
- **Fix:** Started Docker Desktop programmatically via its executable path, waited for daemon, then continued with `supabase start`
- **Impact:** ~3 minute delay for Docker to start and container images to pull
- **Files modified:** None

**5. [Rule 1 - Bug] supabase gen types outputs connection info to stdout**
- **Found during:** Task 2 — generated `database.types.ts` had `Connecting to db 5432` as first line
- **Fix:** Redirected stderr with `2>/dev/null` on the gen types command
- **Files modified:** `src/types/database.types.ts` (regenerated clean)
- **Commit:** 78ec9e7

## Self-Check: PASSED

All 18 created/modified files exist on disk.
Commits b3fe7fe and 78ec9e7 verified in git log.
Build passes cleanly. Supabase db reset with all 6 isolation assertions passes.
