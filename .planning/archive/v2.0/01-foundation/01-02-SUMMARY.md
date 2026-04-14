---
phase: 01-foundation
plan: 02
subsystem: auth
tags: [auth, supabase, next.js, forms, rls, multi-tenant]
dependency_graph:
  requires: ["01-01"]
  provides: ["auth-flows", "protected-routes", "admin-team-management"]
  affects: ["all-subsequent-phases"]
tech_stack:
  added: ["react-hook-form", "zod", "@hookform/resolvers"]
  patterns: ["server-actions", "zod-validation", "protected-layout", "rls-enforced-updates"]
key_files:
  created:
    - src/lib/validators/auth.ts
    - src/actions/auth.ts
    - src/app/(auth)/layout.tsx
    - src/app/(auth)/sign-up/page.tsx
    - src/app/(auth)/login/page.tsx
    - src/app/(auth)/join/page.tsx
    - src/app/(auth)/invite/accept/page.tsx
    - src/app/(protected)/layout.tsx
    - src/app/(protected)/dashboard/page.tsx
    - src/app/(protected)/admin/team/page.tsx
    - src/components/auth/OrgSignUpForm.tsx
    - src/components/auth/LoginForm.tsx
    - src/components/auth/JoinByCodeForm.tsx
    - src/components/auth/InviteAcceptForm.tsx
    - src/components/admin/RoleAssignmentTable.tsx
  modified:
    - src/lib/supabase/server.ts
decisions:
  - "Server action redirect() throws an exception by design in Next.js — catch blocks in form submit handlers must swallow all throws to allow redirect to proceed"
  - "createServerClient from @supabase/ssr v0.6+ passes 3-generic SupabaseClient that breaks Schema inference in supabase-js v2.100 — fixed by adding explicit Promise<SupabaseClient<Database>> return type with as unknown as cast"
  - "InviteAcceptForm wrapped in Suspense because useSearchParams() requires Suspense boundary in Next.js App Router"
  - "RoleAssignmentTable fetches member emails via Supabase client — deferred to when user metadata is available; currently shows truncated user_id as fallback"
metrics:
  duration: "10m"
  completed_date: "2026-03-24"
  tasks_completed: 2
  files_created: 15
  files_modified: 1
---

# Phase 01 Plan 02: Authentication Flows Summary

**One-liner:** Full multi-tenant auth with Zod-validated server actions, React Hook Form pages, JWT-refreshing invite flows, and admin role management using service_role and RLS clients.

## What Was Built

### Task 1: Zod Validators and Server Actions

**src/lib/validators/auth.ts** — Six Zod schemas:
- `orgSignUpSchema` — org name + email + password with confirm-match refinement
- `loginSchema` — email + password
- `inviteCodeSchema` — auto-uppercases and trims the code
- `inviteWorkerSchema` — email for admin invite
- `acceptInviteSchema` — password + confirm + hidden token
- `updateRoleSchema` — UUID member ID + role enum

**src/actions/auth.ts** — Six server actions:
- `signUpOrganisation` — uses `createAdminClient()` to create org in `organisations`, create user with `email_confirm: true`, insert admin member. Rolls back on partial failure.
- `loginWithEmail` — uses `createClient()` (RLS) for `signInWithPassword`, redirects to `/dashboard`
- `joinWithInviteCode` — verifies user not already a member (one-org guard), looks up org by `invite_code`, inserts worker member, calls `refreshSession()` to update JWT
- `inviteWorker` — reads `organisation_id` from JWT claims, uses `createAdminClient()` for `inviteUserByEmail` with `organisation_id` and `invited_role` in user metadata
- `acceptInvite` — calls `verifyOtp({ type: 'invite' })` to exchange token for session, reads org from user metadata, inserts org membership, sets password via `updateUser`, calls `refreshSession()`
- `updateMemberRole` — uses `createClient()` (RLS enforced — admins-only per DB policy)

### Task 2: Auth Pages, Protected Layout, Admin UI

**Auth route group** (`src/app/(auth)/`):
- Dark steel-900 centered layout with brand-yellow PRODUCT_NAME header
- Pages: sign-up, login, join, invite/accept — all server components rendering client form components

**Form components** (all `'use client'`, react-hook-form + zodResolver):
- `OrgSignUpForm` — 4 fields, loading state, server error display, links to login and join
- `LoginForm` — 2 fields, links to sign-up and join
- `JoinByCodeForm` — uppercase invite code field, graceful "already a member" error message
- `InviteAcceptForm` — reads `token_hash`/`token` from URL search params, shows invalid-link state if missing

**Protected route group** (`src/app/(protected)/`):
- Layout uses `getUser()` server-side (not `getSession()`) — redirects unauthenticated to `/login`
- Dashboard shows role-differentiated content: admin action cards, worker/supervisor/safety_manager placeholders
- Admin team page: role-gated (non-admins redirected to dashboard), renders `RoleAssignmentTable`

**RoleAssignmentTable** (client component):
- Fetches org members from Supabase (RLS-enforced)
- Per-row role dropdown calling `updateMemberRole` server action
- "Invite Worker" email input calling `inviteWorker` server action
- Org `invite_code` display with copy-to-clipboard button
- 72px+ tap targets throughout

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] @supabase/ssr + supabase-js v2.100 Schema inference breaks**
- **Found during:** Task 1 TypeScript check
- **Issue:** `createServerClient<Database>()` from `@supabase/ssr` v0.6 returns `SupabaseClient<Database, SchemaName, SchemaObject>` (3-generic). In `@supabase/supabase-js` v2.100, the 3rd positional parameter is interpreted as `SchemaName` (string key), not the schema object — causing `Schema = never` and all `.from()` table calls resolving to `never`.
- **Fix:** Added explicit return type `Promise<SupabaseClient<Database>>` with `as unknown as SupabaseClient<Database>` cast to `src/lib/supabase/server.ts`. This anchors the inferred type to the correct 2-generic form.
- **Files modified:** `src/lib/supabase/server.ts`
- **Commit:** eb7d379

## Self-Check

- [x] src/lib/validators/auth.ts exists — FOUND
- [x] src/actions/auth.ts exists — FOUND
- [x] src/app/(auth)/layout.tsx exists — FOUND
- [x] src/app/(protected)/layout.tsx exists — FOUND
- [x] src/app/(protected)/dashboard/page.tsx exists — FOUND
- [x] src/components/admin/RoleAssignmentTable.tsx exists — FOUND
- [x] Commits eb7d379 and e3e1961 exist — FOUND
- [x] `npm run build` exits 0 — PASSED
- [x] `npx tsc --noEmit` exits 0 — PASSED

## Self-Check: PASSED
