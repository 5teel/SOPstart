# Phase 1: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-23
**Phase:** 01-foundation
**Areas discussed:** Org signup flow, User onboarding, Role permissions, App shell & brand

---

## Org Signup Flow

### How do organisations get into the system?

| Option | Description | Selected |
|--------|-------------|----------|
| Self-service signup | Anyone can register their org, add a free trial or freemium tier | ✓ |
| Invite/approval | Org requests access, you approve before they can use it | |
| Sales-led | You set up orgs manually after a sales conversation | |
| You decide | Claude picks the best approach for v1 | |

**User's choice:** Self-service signup
**Notes:** None

### What do you need to know about an org at signup?

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal | Just company name and admin email — get them in fast | ✓ |
| Standard | Company name, industry, size, admin email | |
| Detailed | Company name, NZ Business Number, industry, site locations, admin details | |

**User's choice:** Minimal
**Notes:** None

### Should there be a free trial period?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, 14-day trial | Full access for 14 days, then requires payment | ✓ |
| Yes, 30-day trial | Full access for 30 days | |
| No trial yet | Skip billing entirely for v1 — all accounts are full access | |

**User's choice:** Yes, 14-day trial
**Notes:** None

### How do you plan to charge?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-user/month | e.g. $5/user/month — scales with team size | ✓ |
| Per-org/month | Flat fee per organisation regardless of user count | |
| Skip for v1 | No billing in v1 — focus on product, add billing later | |

**User's choice:** Per-user/month
**Notes:** None

---

## User Onboarding

### How do workers join an organisation in the app?

| Option | Description | Selected |
|--------|-------------|----------|
| Admin invites by email | Admin enters worker's email, worker gets invite link to set up their account | |
| Org invite code | Org has a shareable code — workers sign up and enter the code to join | |
| Both options | Admin can invite by email OR share an org code for bulk onboarding | ✓ |

**User's choice:** Both options
**Notes:** None

### What should a worker see the first time they open the app?

| Option | Description | Selected |
|--------|-------------|----------|
| Assigned SOPs | Jump straight to their assigned SOP list — no tutorial, learn by doing | |
| Quick tour | Brief 3-4 screen walkthrough showing how to use the app, then SOP list | ✓ |
| You decide | Claude picks the simplest approach for v1 | |

**User's choice:** Quick tour
**Notes:** None

### What should an org admin see after creating their org?

| Option | Description | Selected |
|--------|-------------|----------|
| Upload prompt | Immediately prompt them to upload their first SOP — get to value fast | |
| Dashboard | Overview dashboard with action cards: Upload SOPs, Invite team, etc. | ✓ |
| You decide | Claude picks the best first-run for admins | |

**User's choice:** Dashboard
**Notes:** None

---

## Role Permissions

### How does Safety Manager differ from Supervisor?

| Option | Description | Selected |
|--------|-------------|----------|
| Org-wide view | Safety Manager sees ALL completion records and SOPs across the org — Supervisor only sees their direct team | ✓ |
| Reports focus | Safety Manager gets compliance reports/dashboards, Supervisor focuses on day-to-day sign-offs | |
| Same + compliance | Safety Manager has all Supervisor permissions PLUS compliance/audit capabilities | |
| You decide | Claude defines sensible permission boundaries | |

**User's choice:** Org-wide view
**Notes:** None

### Can there be multiple admins per org?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, multiple | Any admin can manage SOPs, users, and settings | ✓ |
| Owner + admins | One owner (billing/account), plus admins for day-to-day management | |
| Single admin | One admin per org for simplicity in v1 | |

**User's choice:** Yes, multiple
**Notes:** None

### Can workers see SOPs they're NOT assigned to?

| Option | Description | Selected |
|--------|-------------|----------|
| Browse all, execute assigned | Workers can search/view any published SOP, but only start walkthroughs on assigned ones | |
| Assigned only | Workers only see SOPs assigned to them — nothing else | ✓ |
| Full library | Workers see everything and can execute any SOP | |

**User's choice:** Assigned only
**Notes:** None

### Which workers does a Supervisor oversee?

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit assignment | Admin assigns specific workers to each supervisor | ✓ |
| Same role/trade | Supervisors see all workers in their assigned role/trade group | |
| All workers | Supervisors see all workers in the org | |

**User's choice:** Explicit assignment
**Notes:** None

---

## App Shell & Brand

### Should the app be white-labelled per organisation or a unified SOP Assistant brand?

| Option | Description | Selected |
|--------|-------------|----------|
| Unified brand | One SOP Assistant brand for all orgs — simpler, builds product recognition | ✓ |
| Org logo + colours | Each org can add their logo and brand colours to the app shell | |
| Unified for v1 | Single brand now, add white-labelling later as a premium feature | |

**User's choice:** Unified brand
**Notes:** None

### What colour direction for the app?

| Option | Description | Selected |
|--------|-------------|----------|
| Industrial/safety | High-visibility yellows, oranges — feels like a safety tool | |
| Clean professional | Blues and whites — trust, clarity, modern SaaS feel | |
| Dark mode first | Dark backgrounds — easier on eyes in dim factory environments | |
| You decide | Claude picks a palette that works for industrial + mobile | |

**User's choice:** Other (free text)
**Notes:** "Use a dark mode as the default setting but have a non dark mode setting. Use a palette with yellows and oranges and maybe metallic grays that works for industrial and mobile."

### How should the main app navigation work on mobile?

| Option | Description | Selected |
|--------|-------------|----------|
| Bottom tab bar | Fixed bottom tabs (SOPs, Activity, Profile) — standard mobile pattern, thumb-reachable | ✓ |
| Hamburger menu | Side menu accessible from top-left — maximises screen space | |
| You decide | Claude picks the best mobile navigation for glove-friendly use | |

**User's choice:** Bottom tab bar
**Notes:** None

### Is 'SOP Assistant' the actual product name, or a working title?

| Option | Description | Selected |
|--------|-------------|----------|
| Working title | Placeholder — I'll decide the real name later | ✓ |
| Final name | SOP Assistant is the product name | |
| Let me specify | I have a different name in mind | |

**User's choice:** Working title
**Notes:** None

---

## Claude's Discretion

- Tab bar icons and exact tab labels
- Exact shade selection within the yellow/orange/metallic gray palette
- Quick tour content and screen count
- Dashboard card layout for admin first-run
- Form validation patterns and error messaging

## Deferred Ideas

None — discussion stayed within phase scope
