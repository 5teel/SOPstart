# Phase 1: Foundation - Research

**Researched:** 2026-03-23
**Domain:** Supabase multi-tenant auth + RLS + JWT custom claims, Next.js App Router PWA shell, Tailwind v4 dark mode
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Org Signup Flow**
- D-01: Self-service signup — anyone can register their org directly, no approval gate
- D-02: Minimal info at registration — company name and admin email only. Get them in fast.
- D-03: 14-day free trial with full access, then requires payment
- D-04: Per-user/month pricing model (billing implementation itself is a separate concern — Phase 1 needs the org/user model to support it later)

**User Onboarding**
- D-05: Workers join via admin email invite OR org invite code (both options available)
- D-06: Admin email invite: admin enters worker's email → worker gets invite link → sets up account
- D-07: Org invite code: org has a shareable code → worker signs up and enters code to join
- D-08: Worker first run: brief 3-4 screen quick tour showing how the app works, then lands on assigned SOP list
- D-09: Admin first run: overview dashboard with action cards (Upload SOPs, Invite Team, etc.)

**Role Permissions**
- D-10: Four roles: Worker, Supervisor, Admin, Safety Manager
- D-11: Worker — can only see and execute SOPs assigned to them. Cannot browse unassigned SOPs.
- D-12: Supervisor — reviews completions and signs off for explicitly assigned workers only (admin assigns workers to supervisors)
- D-13: Admin — manages SOPs, users, roles, assignments, and settings. Multiple admins per org allowed.
- D-14: Safety Manager — has org-wide visibility of ALL completion records and SOPs across the entire org. Does not need explicit worker assignments.
- D-15: Multiple admins per org supported — any admin can manage SOPs, users, and settings

**App Shell & Brand**
- D-16: Unified "SOP Assistant" brand (working title) — no white-labelling per org in v1
- D-17: Dark mode as default, with a light mode toggle available
- D-18: Industrial colour palette: yellows, oranges, and metallic grays — high visibility, safety-tool aesthetic
- D-19: Bottom tab bar navigation — fixed tabs (SOPs, Activity, Profile), thumb-reachable, glove-friendly
- D-20: Product name is a working title — will be decided later. Build with easy name-swap capability (use CSS custom property for product name references; keep brand strings in a single constants file)

### Claude's Discretion
- Tab bar icons and exact tab labels
- Exact shade selection within the yellow/orange/metallic gray palette
- Quick tour content and screen count (3-4 screens, Claude designs)
- Dashboard card layout and arrangement for admin first-run
- Specific form validation patterns and error messaging

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-01 | Organisation can register and create an account with company details | Supabase self-service signup flow + `organisations` table with `trial_ends_at` |
| AUTH-02 | User can sign up with email and password within an organisation | Supabase `auth.admin.inviteUserByEmail` (admin invite) + org invite code join flow |
| AUTH-03 | User session persists across browser refresh and app relaunch | `@supabase/ssr` cookie-based sessions + Next.js middleware token refresh |
| AUTH-04 | Admin can assign roles to users (Worker, Supervisor, Admin, Safety Manager) | `organisation_members` table with `role` column + Custom Access Token Hook injects role into JWT |
| AUTH-05 | Each organisation's data is fully isolated from other organisations | Supabase RLS policies reading `(auth.jwt() ->> 'organisation_id')::uuid` on every tenant-scoped table |
| AUTH-06 | Users only see data belonging to their organisation | Same RLS mechanism as AUTH-05; enforced at DB layer, not application layer |
| PLAT-01 | App is a Progressive Web App installable to home screen on iOS and Android | `app/manifest.ts` (Next.js built-in) + `@serwist/next` service worker for offline shell caching |
| PLAT-02 | App works across modern Android and iOS browsers | Tailwind v4 with class-based dark mode; no cutting-edge CSS; iOS Safari tested explicitly |
| PLAT-03 | App indicates online/offline status to the user | `navigator.onLine` + `online`/`offline` event listeners in a Zustand store; persistent status banner |
</phase_requirements>

---

## Summary

Phase 1 establishes the complete security and platform foundation the entire application depends on. There are three distinct technical concerns: (1) a multi-tenant Supabase schema where every data row is org-scoped and RLS policies enforce isolation automatically using JWT custom claims, (2) auth flows covering org registration, admin/worker sign-up paths, session persistence, and role management, and (3) a PWA shell that is installable on iOS and Android with an online/offline indicator and the base design system.

The most critical architectural decision for this phase — one that cannot be retrofitted — is the JWT custom claim injection. Supabase's Custom Access Token Hook (a Postgres function registered in the Auth dashboard) must inject `organisation_id` and `role` into every JWT at sign-in time. RLS policies then read `(auth.jwt() ->> 'organisation_id')::uuid` directly, eliminating per-row subquery joins to a membership table. This gives zero-overhead tenant isolation on every query, and it is the only pattern that scales.

For the PWA shell, Next.js 16 has built-in manifest support (`app/manifest.ts`), but it does NOT include a service worker. `@serwist/next` is still required for offline caching of the app shell. The official Next.js PWA docs explicitly recommend Serwist for offline support. These two tools complement each other and must both be used.

**Primary recommendation:** Build in this order — database schema + RLS first, then the Custom Access Token Hook, then Next.js middleware session refresh, then auth UI flows, then the PWA shell last. Everything downstream depends on the schema and JWT claims being correct.

---

## Standard Stack

### Core (Phase 1 subset)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.2.1 | App Router framework, manifest.ts, middleware, Server Actions | Built-in PWA manifest, middleware for session refresh, Server Actions for auth flows |
| TypeScript | 5.x | Type safety | Supabase-generated types + Zod schemas prevent runtime bugs in RLS-heavy code |
| Tailwind CSS | 4.2.2 | Utility CSS, dark mode, design tokens | CSS-native dark mode via `@custom-variant`, design tokens as CSS vars for industrial palette |
| Supabase JS client | 2.99.3 | Auth, DB queries | Official client; use with `@supabase/ssr` for cookie-based sessions |
| @supabase/ssr | 0.x | Cookie-based sessions in Next.js App Router | Required — replaces deprecated `@supabase/auth-helpers-nextjs`. Handles server/browser client separation |
| @serwist/next | 9.5.7 | Service worker for offline app shell caching | Required for installability + offline fallback page. Next.js built-in manifest does not include a SW |
| serwist | 9.5.7 | Workbox-based SW runtime (peer dep of @serwist/next) | Actively maintained Workbox fork; handles precache + runtime caching strategies |
| Zustand | 5.0.12 | Online/offline status store, UI state | Lightweight; online status needs to be globally reactive (PLAT-03) |
| React Hook Form | 7.72.0 | Auth forms (sign-up, login, invite, org registration) | Minimal re-renders; Zod resolver integration |
| Zod | 4.3.6 | Form validation + API input validation | Single source of truth for schema; resolvers v5 required for Zod v4 |
| @hookform/resolvers | 5.2.2 | Zod + RHF glue | Required; v5 adds Zod v4 support |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Supabase CLI | Local dev DB, migrations, type generation | Run `supabase gen types typescript --local > src/types/database.types.ts` after every migration |
| Playwright | Automated two-tenant isolation test, PWA install test | Required for cross-tenant boundary verification before phase sign-off |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@supabase/ssr` | `@supabase/auth-helpers-nextjs` | Auth helpers is deprecated — bug fixes stopped, will break on future Next.js versions |
| `@serwist/next` | `shadowwalker/next-pwa` | next-pwa is abandoned since 2022, multiple broken App Router issues; do not use |
| Tailwind v4 `@custom-variant` | `darkMode: "class"` config | v4 removed `tailwind.config.js`; class-based dark mode now configured in CSS only |
| Custom Access Token Hook | Application-layer role lookup per request | Hook injects role+org into JWT once; avoids DB round-trip on every authenticated request |

**Installation (Phase 1 packages only):**

```bash
# Scaffold
npx create-next-app@16 sop-assistant --typescript --tailwind --app --src-dir

# Auth + DB
npm install @supabase/supabase-js @supabase/ssr

# PWA
npm install @serwist/next serwist

# UI state
npm install zustand

# Forms + validation
npm install react-hook-form zod @hookform/resolvers

# Dev
npm install -D supabase @playwright/test eslint-config-next prettier prettier-plugin-tailwindcss
```

---

## Architecture Patterns

### Recommended Project Structure (Phase 1 scope)

```
src/
├── app/
│   ├── (auth)/                   # Unauthenticated routes
│   │   ├── sign-up/              # Org registration (AUTH-01)
│   │   ├── login/                # Email + password login (AUTH-02, AUTH-03)
│   │   ├── invite/               # Accept email invite link (AUTH-02)
│   │   └── join/                 # Enter org invite code (AUTH-02)
│   ├── (worker)/                 # Role-gated: Worker
│   │   └── onboarding/           # Quick tour (D-08)
│   ├── (admin)/                  # Role-gated: Admin
│   │   └── onboarding/           # First-run dashboard (D-09)
│   ├── layout.tsx                # Root layout: ThemeProvider, QueryProvider, SW registration
│   ├── manifest.ts               # PWA manifest (PLAT-01)
│   ├── sw.ts                     # Serwist service worker source (compiled to public/sw.js)
│   └── ~offline/                 # Offline fallback page (served by SW when network fails)
│       └── page.tsx
├── components/
│   ├── ui/                       # Design system: Button, Input, Card, Badge, Tabs
│   ├── layout/
│   │   ├── BottomTabBar.tsx      # Fixed bottom navigation (D-19)
│   │   └── OnlineStatusBanner.tsx # Online/offline indicator (PLAT-03)
│   └── auth/
│       ├── OrgSignUpForm.tsx
│       ├── LoginForm.tsx
│       └── InviteAcceptForm.tsx
├── lib/
│   ├── supabase/
│   │   ├── server.ts             # createServerClient (Server Components, Server Actions, Route Handlers)
│   │   ├── client.ts             # createBrowserClient (Client Components)
│   │   └── middleware.ts         # updateSession — refreshes tokens, sets cookies
│   └── constants.ts              # PRODUCT_NAME, BRAND colours — single source for name-swap (D-20)
├── stores/
│   └── network.ts                # Zustand store: isOnline, lastSyncedAt (PLAT-03)
├── hooks/
│   └── useOnlineStatus.ts        # Subscribes to navigator.onLine events
├── middleware.ts                  # Next.js middleware: session refresh + route protection
└── types/
    ├── database.types.ts         # Generated by `supabase gen types typescript`
    └── auth.ts                   # AppRole union type, OrgMember type, JWT claims shape
```

### Pattern 1: Supabase Multi-Tenant Schema

**What:** Every tenant-scoped table has `organisation_id uuid NOT NULL` as the first non-PK column. RLS is enabled on all tables. Policies read `organisation_id` directly from the JWT via `(auth.jwt() ->> 'organisation_id')::uuid` — no subquery to a membership table required.

**When to use:** Every table that contains org-specific data. No exceptions.

**Core schema:**

```sql
-- Source: Supabase multi-tenant RLS pattern (verified via official docs + makerkit.dev guide)

-- Organisations (root tenant entity)
create table public.organisations (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  invite_code     text not null unique default upper(substr(md5(random()::text), 1, 8)),
  trial_ends_at   timestamptz not null default (now() + interval '14 days'),
  created_at      timestamptz not null default now()
);

-- Organisation members (links auth.users → organisations with role)
create type public.app_role as enum ('worker', 'supervisor', 'admin', 'safety_manager');

create table public.organisation_members (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            public.app_role not null default 'worker',
  created_at      timestamptz not null default now(),
  unique (organisation_id, user_id)
);

-- Index: every RLS policy scans by organisation_id
create index on public.organisation_members (organisation_id);
create index on public.organisation_members (user_id);

-- Supervisor assignments (who supervises whom)
create table public.supervisor_assignments (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  supervisor_id   uuid not null references auth.users(id) on delete cascade,
  worker_id       uuid not null references auth.users(id) on delete cascade,
  created_at      timestamptz not null default now(),
  unique (organisation_id, supervisor_id, worker_id)
);

-- Enable RLS on all tables
alter table public.organisations        enable row level security;
alter table public.organisation_members enable row level security;
alter table public.supervisor_assignments enable row level security;
```

### Pattern 2: Custom Access Token Hook (JWT Claims Injection)

**What:** A Postgres function registered as Supabase's Custom Access Token Hook. It runs before every JWT is issued and injects `organisation_id` and `role` into the token. RLS policies then use `auth.jwt()` directly — no per-request DB lookup needed.

**When to use:** Required. Must be created in the first migration and registered in the Auth dashboard before any RLS policy is written.

**Hook registration:** Dashboard > Authentication > Hooks > Custom Access Token Hook

```sql
-- Source: Supabase Custom Access Token Hook docs
-- https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  claims         jsonb;
  member_record  record;
begin
  -- Look up this user's org membership
  select organisation_id, role
  into   member_record
  from   public.organisation_members
  where  user_id = (event->>'user_id')::uuid
  limit  1;

  claims := event->'claims';

  if member_record is not null then
    claims := jsonb_set(claims, '{organisation_id}', to_jsonb(member_record.organisation_id::text));
    claims := jsonb_set(claims, '{user_role}',       to_jsonb(member_record.role::text));
  else
    -- Freshly registered org admin (not yet in organisation_members)
    claims := jsonb_set(claims, '{organisation_id}', 'null');
    claims := jsonb_set(claims, '{user_role}',       '"pending"');
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;

-- Grant auth system permission to execute the hook
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;
```

**Reading claims in RLS policies:**

```sql
-- Helper function to extract org id safely (avoids repeated casting)
create or replace function public.current_organisation_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select nullif(auth.jwt() ->> 'organisation_id', 'null')::uuid
$$;

-- Helper function to extract role
create or replace function public.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select (auth.jwt() ->> 'user_role')::public.app_role
$$;

-- Example RLS policy on any tenant-scoped table:
-- "Members can read rows belonging to their organisation"
create policy "org_members_isolation"
  on public.organisation_members
  for all
  to authenticated
  using (organisation_id = public.current_organisation_id());
```

### Pattern 3: Supabase SSR Session Management in Next.js

**What:** `@supabase/ssr` provides cookie-based session management compatible with Next.js Server Components, Server Actions, Route Handlers, and Client Components. Middleware refreshes expired tokens on every request. Never use `getSession()` server-side — always use `getUser()`.

**When to use:** Every server-side data access and every protected route.

**File structure:**

```typescript
// src/lib/supabase/server.ts
// Source: https://supabase.com/docs/guides/auth/server-side/nextjs
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database.types'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {} // Silently ignore in Server Components (middleware handles refresh)
        },
      },
    }
  )
}
```

```typescript
// src/lib/supabase/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )
  // MUST call getUser() — not getSession() — to validate JWT server-side
  const { data: { user } } = await supabase.auth.getUser()

  // Redirect unauthenticated users from protected routes
  const path = request.nextUrl.pathname
  const isProtected = !path.startsWith('/(auth)') && path !== '/'
  if (isProtected && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}
```

```typescript
// src/middleware.ts
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|ico|svg|webmanifest)).*)'],
}
```

### Pattern 4: User Invitation Flows

**What:** Two paths for workers joining an org. Both result in the worker being added to `organisation_members` with `role = 'worker'`.

**Path A — Admin email invite (D-06):**
Uses `supabase.auth.admin.inviteUserByEmail()` from a Server Action (requires `service_role` key, server-side only). The invited user receives a magic link, clicks it, and is redirected to a password-set page. On completion, a database trigger inserts them into `organisation_members`.

```typescript
// Server Action — requires service_role key
import { createAdminClient } from '@/lib/supabase/admin' // uses service_role key

export async function inviteWorker(email: string, organisationId: string) {
  const supabase = createAdminClient()
  const { error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: {
      organisation_id: organisationId,
      invited_role: 'worker',
    },
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/invite/accept`,
  })
  if (error) throw error
}
```

**Path B — Org invite code (D-07):**
Worker self-registers with email + password, then enters the org's `invite_code`. A Server Action validates the code, finds the org, and inserts the worker into `organisation_members`.

```typescript
// Server Action
export async function joinWithInviteCode(code: string, userId: string) {
  const supabase = await createClient()
  const { data: org, error } = await supabase
    .from('organisations')
    .select('id')
    .eq('invite_code', code.toUpperCase())
    .single()
  if (error || !org) throw new Error('Invalid invite code')

  await supabase.from('organisation_members').insert({
    organisation_id: org.id,
    user_id: userId,
    role: 'worker',
  })
}
```

### Pattern 5: PWA Shell Setup (Next.js + Serwist)

**What:** Next.js 16 provides `app/manifest.ts` for the web app manifest (built-in, no plugin needed). `@serwist/next` wraps `next.config.ts` to compile `app/sw.ts` into `public/sw.js` — this is what provides offline caching of the app shell.

**Critical note:** The two are complementary, not alternatives. Next.js manifest handles installability; Serwist handles offline caching.

**Note on Turbopack:** Serwist currently requires webpack for service worker compilation. Use `next dev --webpack` during local development when testing PWA features. Production builds with `next build` work normally.

```typescript
// app/manifest.ts — Next.js built-in
// Source: https://nextjs.org/docs/app/guides/progressive-web-apps
import type { MetadataRoute } from 'next'
import { PRODUCT_NAME } from '@/lib/constants'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: PRODUCT_NAME,
    short_name: PRODUCT_NAME,
    description: 'Step-by-step SOP guidance for your team',
    start_url: '/',
    display: 'standalone',
    background_color: '#1a1a1a',   // dark background
    theme_color: '#f59e0b',        // amber-500 — industrial yellow
    orientation: 'portrait',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-192-any.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    ],
  }
}
```

```typescript
// app/sw.ts — Serwist service worker (compiled to public/sw.js)
// Source: https://serwist.pages.dev/docs/next/getting-started
import { defaultCache } from '@serwist/next/worker'
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import { Serwist } from 'serwist'

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,     // Activate new SW immediately on deploy
  clientsClaim: true,    // Take control of all open tabs
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [{ url: '/~offline', matcher({ request }) { return request.destination === 'document' } }],
  },
})

serwist.addEventListeners()
```

```typescript
// next.config.ts — wrap with Serwist
import withSerwistInit from '@serwist/next'

const withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development', // Disable SW in dev by default
})

export default withSerwist({
  // ... rest of Next.js config
})
```

### Pattern 6: Tailwind v4 Dark Mode + Industrial Design Tokens

**What:** Tailwind v4 removes `tailwind.config.js`. Dark mode is now configured via `@custom-variant` in CSS. Design tokens (colours, spacing) are CSS custom properties. The `dark` class on `<html>` activates dark mode — `next-themes` manages toggling.

```css
/* src/app/globals.css */
@import "tailwindcss";

/* Class-based dark mode — Source: https://tailwindcss.com/docs/dark-mode */
@custom-variant dark (&:where(.dark, .dark *));

/* Industrial palette design tokens */
@theme {
  --color-brand-yellow:    #f59e0b;   /* amber-500 — primary CTA */
  --color-brand-orange:    #ea580c;   /* orange-600 — warnings, highlights */
  --color-steel-900:       #111827;   /* near-black dark bg */
  --color-steel-800:       #1f2937;   /* card bg in dark mode */
  --color-steel-700:       #374151;   /* border/divider */
  --color-steel-400:       #9ca3af;   /* secondary text in dark */
  --color-steel-100:       #f3f4f6;   /* light mode bg */

  /* Touch target minimum — enforced project-wide */
  --min-tap-target:        72px;
}
```

**Theme toggling (root layout):**
```typescript
// app/layout.tsx — ThemeProvider from next-themes, default dark
import { ThemeProvider } from 'next-themes'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
```

### Pattern 7: Online/Offline Status (PLAT-03)

**What:** A Zustand store subscribes to `navigator.onLine` and window `online`/`offline` events. A persistent banner component reads this store and renders at the top of the app shell. The service worker's `reloadOnOnline` option triggers a soft refetch when connectivity returns.

```typescript
// src/stores/network.ts
import { create } from 'zustand'

interface NetworkStore {
  isOnline: boolean
  lastOnlineAt: Date | null
  setOnline: (online: boolean) => void
}

export const useNetworkStore = create<NetworkStore>((set) => ({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  lastOnlineAt: null,
  setOnline: (online) => set({ isOnline: online, lastOnlineAt: online ? new Date() : null }),
}))
```

```typescript
// src/hooks/useOnlineStatus.ts
'use client'
import { useEffect } from 'react'
import { useNetworkStore } from '@/stores/network'

export function useOnlineStatus() {
  const setOnline = useNetworkStore((s) => s.setOnline)
  useEffect(() => {
    const handleOnline  = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online',  handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online',  handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [setOnline])
}
```

### Anti-Patterns to Avoid

- **`auth.users.raw_user_meta_data` for role storage:** User metadata can be modified by the user themselves. Roles MUST be stored in `organisation_members` (controlled by admins) and injected via the Access Token Hook.
- **`getSession()` on the server:** `getSession()` trusts the stored session without re-validating the JWT. Always use `getUser()` server-side — it validates against the Supabase Auth server.
- **`@supabase/auth-helpers-nextjs`:** Deprecated. All bug fixes are being directed to `@supabase/ssr`. Do not use the auth helpers package.
- **Superuser DB connection in application code:** RLS is bypassed by superuser connections. Application code must always connect as the `authenticated` role, not `postgres`/service role, for queries that are meant to be RLS-enforced.
- **`shadowwalker/next-pwa`:** Abandoned since 2022. Broken with Next.js App Router. Use `@serwist/next` only.
- **Storing the JWT's `organisation_id` claim as the only isolation control:** JWT can be long-lived. Always enforce `organisation_id` in both the JWT (for performance) AND as a direct column on every tenant-scoped table (for defence-in-depth).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cookie-based auth sessions in Next.js App Router | Custom cookie read/write helpers | `@supabase/ssr` + `createServerClient` / `createBrowserClient` | Handles token refresh, cookie propagation between middleware and server/client components |
| Service worker with precaching | Manual `self.addEventListener('install', ...)` | `@serwist/next` + Serwist | Workbox precaching handles cache versioning, stale-while-revalidate, and the offline fallback page automatically |
| JWT decoding to extract custom claims | `jwtDecode()` on the client | `auth.jwt()` in Postgres RLS, `supabase.auth.getUser()` on server, `session.access_token` on client | Supabase session management propagates claims; manually decoding adds unnecessary client-side logic |
| Role-based route guards | Custom middleware role check logic | Read `(auth.jwt() ->> 'user_role')` in Supabase RLS + redirect in Next.js middleware | DB enforces isolation; middleware handles redirect — no application-layer guard needed |
| Dark mode persistence + SSR flicker prevention | `localStorage` + `useEffect` | `next-themes` with `suppressHydrationWarning` | Handles SSR flicker, system preference detection, and class toggling in one package |
| PWA web app manifest | Manual `<link rel="manifest">` | `app/manifest.ts` (Next.js built-in) | Next.js auto-links and validates the manifest; TypeScript types for `MetadataRoute.Manifest` |

**Key insight:** Supabase's Access Token Hook + `@supabase/ssr` + Next.js middleware together form a complete, tested auth pipeline. Any custom additions to this pipeline introduce session management bugs. Add no custom session handling.

---

## Common Pitfalls

### Pitfall 1: Custom Claims Stale After Role Change

**What goes wrong:** An admin changes a worker's role to Supervisor. The worker's current JWT still has `user_role: 'worker'` until it expires (default 1 hour in Supabase). The RLS policies deny them Supervisor access for up to an hour.

**Why it happens:** JWTs are stateless. The hook only runs at token issuance time, not on every request.

**How to avoid:** After a role change, force a token refresh by calling `supabase.auth.refreshSession()` from the admin UI after updating `organisation_members`. Show a "Role updated — user must log out and back in, or refresh their session" notice in the admin UI. For the Phase 1 implementation, a 1-hour delay is acceptable. Phase 4+ can implement forced session invalidation if needed.

**Warning signs:** No mention of token refresh after role updates in the admin user management UI.

### Pitfall 2: RLS Policy Bypassed by Service Role Key

**What goes wrong:** A Server Action or Route Handler inadvertently uses the service role key (intended for admin operations like `inviteUserByEmail`) for regular data queries. RLS is completely bypassed. Any tenant can read any data.

**Why it happens:** Both `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and the service role key are environment variables. A developer copies the wrong one.

**How to avoid:** Create two distinct Supabase client factories: `createClient()` (uses publishable key, RLS enforced) and `createAdminClient()` (uses service role key, no RLS, used ONLY for admin auth operations like `inviteUserByEmail`). Never use `createAdminClient()` for data queries. Code review gate.

**Warning signs:** A single `createClient()` function that takes a `useServiceRole: boolean` parameter.

### Pitfall 3: Invite Code Join Bypasses Org Membership Check

**What goes wrong:** A worker who already belongs to Org A enters Org B's invite code and joins Org B as well. The app now shows two orgs in their JWT claims (only the first is injected by the hook). Data leakage risk.

**Why it happens:** The join-by-code Server Action inserts into `organisation_members` without checking whether the user already belongs to a different org.

**How to avoid:** In the join-with-code Server Action, first check if the user already has a row in `organisation_members`. If yes, return an error: "You are already a member of an organisation. Contact support to transfer your account." Phase 1 enforces one-org-per-user.

**Warning signs:** `organisation_members` has no unique constraint on `user_id` alone (only on `(organisation_id, user_id)`).

### Pitfall 4: iOS "Add to Home Screen" Instruction Never Shown

**What goes wrong:** iOS Safari does not fire `beforeinstallprompt`. The Android install banner appears automatically, but iOS workers never know they can install the app. Adoption on iOS (common in NZ blue-collar workforces) stays low.

**Why it happens:** Developers test on Android Chrome and see the install prompt, assume it works everywhere.

**How to avoid:** Implement an `InstallPrompt` component that: (1) detects iOS via user agent, (2) detects if NOT already in standalone mode, and (3) shows a persistent banner with "Tap Share → Add to Home Screen" instructions. Surface this on first login and on the Profile tab. iOS 16.4+ supports installed PWA push notifications — the install banner should be prominent.

**Warning signs:** No iOS-specific install instruction in the app. Testing only done on Android or Chrome desktop.

### Pitfall 5: Serwist SW Not Disabled in Development

**What goes wrong:** Service worker caches responses aggressively in development. Code changes don't reflect in the browser. Developer thinks their changes aren't working. Hours of confusion.

**Why it happens:** Serwist is configured with `disable: false` (the default) in development builds.

**How to avoid:** Set `disable: process.env.NODE_ENV === 'development'` in the Serwist config. Use `next dev --webpack` (not `--turbopack`) when explicitly testing PWA/service worker behaviour. Document this in the project README.

**Warning signs:** `disable` not set in `withSerwistInit()` config.

### Pitfall 6: Missing Index on `organisation_members(user_id)`

**What goes wrong:** The Custom Access Token Hook runs a query `WHERE user_id = ?` on `organisation_members` on every sign-in. Without an index, this is a sequential scan. Slow at scale.

**Why it happens:** Developers index `organisation_id` (for RLS policy scans) but forget `user_id` (for the hook lookup).

**How to avoid:** Create both indexes in the initial migration: `CREATE INDEX ON public.organisation_members (organisation_id)` and `CREATE INDEX ON public.organisation_members (user_id)`.

---

## Code Examples

### Complete RLS Policy Set for `organisation_members`

```sql
-- Source: Supabase RLS docs + custom claims RBAC guide
-- https://supabase.com/docs/guides/database/postgres/row-level-security

-- Enable RLS
alter table public.organisation_members enable row level security;

-- Members can view their own org's members
create policy "org_members_can_view_own_org"
  on public.organisation_members for select
  to authenticated
  using (organisation_id = public.current_organisation_id());

-- Only admins and safety managers can manage members
create policy "admins_can_manage_members"
  on public.organisation_members for insert
  to authenticated
  with check (
    organisation_id = public.current_organisation_id()
    and public.current_user_role() in ('admin', 'safety_manager')
  );

create policy "admins_can_update_roles"
  on public.organisation_members for update
  to authenticated
  using (organisation_id = public.current_organisation_id())
  with check (public.current_user_role() = 'admin');
```

### Two-Tenant Isolation Playwright Test

```typescript
// tests/tenant-isolation.spec.ts
// Source: Pattern from PITFALLS.md — cross-tenant test required before phase sign-off
import { test, expect } from '@playwright/test'

test('tenant isolation: org A cannot read org B members', async ({ browser }) => {
  // Create two isolated browser contexts (separate sessions)
  const ctxA = await browser.newContext()
  const ctxB = await browser.newContext()

  const pageA = await ctxA.newPage()
  const pageB = await ctxB.newPage()

  // Sign in as admin of Org A
  await signInAs(pageA, process.env.TEST_ORG_A_ADMIN_EMAIL!, process.env.TEST_ORG_A_ADMIN_PASSWORD!)
  // Sign in as admin of Org B
  await signInAs(pageB, process.env.TEST_ORG_B_ADMIN_EMAIL!, process.env.TEST_ORG_B_ADMIN_PASSWORD!)

  // Org A admin tries to fetch Org B members via API
  const orgBId = process.env.TEST_ORG_B_ID!
  const response = await pageA.request.get(`/api/organisations/${orgBId}/members`)

  // Must return 403 or empty — never Org B's data
  expect([403, 404]).toContain(response.status())

  await ctxA.close()
  await ctxB.close()
})
```

### Online/Offline Banner Component

```typescript
// src/components/layout/OnlineStatusBanner.tsx
'use client'
import { useNetworkStore } from '@/stores/network'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

export function OnlineStatusBanner() {
  useOnlineStatus() // Registers event listeners
  const isOnline = useNetworkStore((s) => s.isOnline)

  if (isOnline) return null // No banner when online

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 inset-x-0 z-50 flex items-center justify-center gap-2
                 bg-amber-500 text-steel-900 text-sm font-medium py-2 px-4"
    >
      <span className="h-2 w-2 rounded-full bg-steel-900 animate-pulse" />
      Offline — changes saved locally
    </div>
  )
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2024 | Auth helpers deprecated; `@supabase/ssr` is the only maintained path |
| `darkMode: "class"` in `tailwind.config.js` | `@custom-variant dark` in CSS | Tailwind v4 (2025) | No config file; CSS-only configuration |
| `shadowwalker/next-pwa` | `@serwist/next` | 2023 | next-pwa abandoned; Serwist is the actively maintained successor |
| Roles in `auth.users.raw_user_meta_data` | Roles in a separate `organisation_members` table + JWT hook | Best practice established 2023-2024 | User metadata is user-writable; role must be admin-controlled |
| Application-layer tenant filtering only | RLS + JWT claims (defence in depth) | Industry standard 2024-2025 | Single missed WHERE clause causes cross-tenant leak |

**Deprecated/outdated:**
- `auth.users.raw_user_meta_data` for roles: user-writable, never use for authorization
- `supabase.auth.getSession()` server-side: does not re-validate JWT; use `getUser()`
- `@supabase/auth-helpers-nextjs`: deprecated, no new fixes
- `next-pwa` (shadowwalker): abandoned 2022, App Router broken

---

## Open Questions

1. **One org per user — is this enforced or advisory?**
   - What we know: The JWT hook injects a single `organisation_id`. Multiple org memberships would require a different JWT strategy.
   - What's unclear: Whether any future v1 requirements need a user to be in multiple orgs (e.g., a contractor).
   - Recommendation: Enforce one-org-per-user in the schema now (unique constraint on `user_id` in `organisation_members`). Document as a known limitation. Revisit only if a concrete v1 requirement demands it.

2. **Supabase Email Templates for invitations**
   - What we know: Supabase sends email invites via its SMTP. The template is customisable in the Dashboard.
   - What's unclear: Whether the invite email template needs to be customised to include the org name or a custom from-address for the NZ market.
   - Recommendation: Customise the invite email template in Supabase Dashboard before testing the invite flow. This is a configuration step, not a code step.

3. **iOS Safari camera permission re-prompts in installed PWA**
   - What we know: PITFALLS.md documents that iOS does not persist camera permissions reliably for PWAs. Phase 1 does not implement photo capture, but the permission model established in Phase 1 (auth, app shell) affects later phases.
   - What's unclear: Whether iOS 17+ has improved this.
   - Recommendation: Document the fallback pattern (`<input type="file" capture="environment">`) in code comments from Phase 1. This reduces Phase 3 implementation risk.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright (e2e for tenant isolation + PWA) |
| Config file | `playwright.config.ts` — Wave 0 creates this |
| Quick run command | `npx playwright test tests/auth/ --project=chromium` |
| Full suite command | `npx playwright test` |

Note: Unit/integration tests for Supabase RLS policies are SQL-level tests run via `supabase db test`. Playwright covers the end-to-end flows and the mandatory two-tenant isolation boundary test.

### Phase Requirements → Test Map

| Req ID | Behaviour | Test Type | Automated Command | File Exists? |
|--------|-----------|-----------|-------------------|-------------|
| AUTH-01 | Org registration form creates org + admin user in DB | e2e | `npx playwright test tests/auth/org-signup.spec.ts` | Wave 0 |
| AUTH-02 | Worker can sign up via email invite link | e2e | `npx playwright test tests/auth/invite-flow.spec.ts` | Wave 0 |
| AUTH-02 | Worker can join via org invite code | e2e | `npx playwright test tests/auth/invite-code.spec.ts` | Wave 0 |
| AUTH-03 | Session persists after browser refresh | e2e | `npx playwright test tests/auth/session-persistence.spec.ts` | Wave 0 |
| AUTH-04 | Admin can change a user's role; change reflected on next login | e2e | `npx playwright test tests/auth/role-assignment.spec.ts` | Wave 0 |
| AUTH-05 | Org A data not accessible to Org B authenticated user | e2e | `npx playwright test tests/tenant-isolation.spec.ts` | Wave 0 |
| AUTH-06 | Authenticated user only receives own org's data from API | e2e | `npx playwright test tests/tenant-isolation.spec.ts` | Wave 0 |
| PLAT-01 | App manifest present and valid; service worker registered | e2e | `npx playwright test tests/pwa/manifest.spec.ts` | Wave 0 |
| PLAT-02 | App renders on iOS Safari and Android Chrome | manual | Manual test on real devices before phase sign-off | manual-only |
| PLAT-03 | Online/offline banner appears when network toggled | e2e | `npx playwright test tests/pwa/offline-banner.spec.ts` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npx playwright test tests/auth/ --project=chromium` (auth smoke)
- **Per wave merge:** `npx playwright test` (full suite including tenant isolation)
- **Phase gate:** Full suite green + manual iOS/Android check before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `playwright.config.ts` — Playwright config, base URL, test credentials from env
- [ ] `tests/auth/org-signup.spec.ts` — covers AUTH-01
- [ ] `tests/auth/invite-flow.spec.ts` — covers AUTH-02 (email invite)
- [ ] `tests/auth/invite-code.spec.ts` — covers AUTH-02 (invite code)
- [ ] `tests/auth/session-persistence.spec.ts` — covers AUTH-03
- [ ] `tests/auth/role-assignment.spec.ts` — covers AUTH-04
- [ ] `tests/tenant-isolation.spec.ts` — covers AUTH-05, AUTH-06
- [ ] `tests/pwa/manifest.spec.ts` — covers PLAT-01
- [ ] `tests/pwa/offline-banner.spec.ts` — covers PLAT-03
- [ ] `.env.test` — `TEST_ORG_A_*`, `TEST_ORG_B_*` variables for isolation test

---

## Sources

### Primary (HIGH confidence)

- [Supabase Custom Access Token Hook docs](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook) — Hook function signature, registration, JWT injection pattern
- [Supabase RBAC with custom claims docs](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac) — Role table schema, authorize() helper function pattern
- [Supabase SSR Next.js setup docs](https://supabase.com/docs/guides/auth/server-side/nextjs) — `createServerClient`, `createBrowserClient`, middleware pattern, getUser() vs getSession() warning
- [Supabase Row Level Security docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — RLS policy syntax, auth.jwt() in policies
- [Supabase inviteUserByEmail reference](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail) — Admin invite API, service role key requirement
- [Next.js PWA guide (v16.2.1, updated 2026-02-11)](https://nextjs.org/docs/app/guides/progressive-web-apps) — manifest.ts, InstallPrompt pattern, Serwist recommendation for offline
- [Serwist Next.js getting started](https://serwist.pages.dev/docs/next/getting-started) — next.config.ts setup, app/sw.ts template, tsconfig requirements
- [Tailwind CSS v4 dark mode docs](https://tailwindcss.com/docs/dark-mode) — `@custom-variant dark` CSS directive, class-based strategy

### Secondary (MEDIUM confidence)

- [makerkit.dev Supabase RLS best practices](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices) — Production RLS patterns for multi-tenant apps, verified consistent with Supabase official docs
- [LogRocket: Build a Next.js 16 PWA with true offline support](https://blog.logrocket.com/nextjs-16-pwa-offline-support/) — Serwist + Next.js 16 integration walkthrough

### From Prior Research (HIGH confidence — STACK.md and ARCHITECTURE.md)

- STACK.md (2026-03-23) — Verified package versions, compatibility matrix, what NOT to use
- ARCHITECTURE.md (2026-03-23) — Multi-tenant request flow, withTenantContext pattern, build order

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all packages verified via official docs and STACK.md
- Architecture: HIGH — Supabase patterns verified against official docs; Serwist setup verified against official docs
- Pitfalls: HIGH — drawn from PITFALLS.md (verified sources) plus phase-specific additions verified against official Supabase docs
- Code examples: HIGH for patterns cited from official docs; MEDIUM for the invitation flow (limited official code examples available)

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (stable ecosystem; Supabase and Serwist APIs are stable; re-verify if either releases a major version)
