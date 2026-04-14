---
phase: 3
slug: worker-experience
status: draft
shadcn_initialized: false
preset: none
created: 2026-03-25
---

# Phase 3 — UI Design Contract

> Visual and interaction contract for Phase 3: Worker Experience. Covers the worker SOP library, step-by-step walkthrough, safety acknowledgement, quick reference mode, admin assignment UI, and SOP version management. Generated prior to implementation planning.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (custom Tailwind v4 components) |
| Preset | not applicable |
| Component library | none (hand-rolled, shadcn not initialised) |
| Icon library | lucide-react |
| Font | System font stack (inherited from Phase 1 shell) |
| New packages | `yet-another-react-lightbox` (image zoom), `dexie` (offline store), `idb-keyval` (query persister) |

---

## Spacing Scale

Declared values (must be multiples of 4):

| Token | Value | Tailwind class | Usage |
|-------|-------|----------------|-------|
| xs | 4px | `p-1` / `gap-1` | Icon gaps, badge padding, step number column |
| sm | 8px | `p-2` / `gap-2` | Compact element spacing, tag chips, tab padding |
| md | 16px | `p-4` / `gap-4` | Default element spacing, card padding, list item padding |
| lg | 24px | `p-6` / `gap-6` | Section padding, card gaps, walkthrough vertical rhythm |
| xl | 32px | `p-8` / `gap-8` | Layout column gaps, walkthrough bottom action area |
| 2xl | 48px | `p-12` / `gap-12` | Major section breaks, safety card internal padding |
| 3xl | 64px | `p-16` / `gap-16` | Page-level spacing (admin pages only) |

Exceptions:
- Tap targets: minimum `h-[72px]` (`--min-tap-target: 72px` per globals.css) on ALL interactive controls in walkthrough, safety acknowledgement, and SOP library. This is a hard constraint from WORK-09. No tap target in the walkthrough flow falls below 72px.
- Progress bar: fixed `h-2` (8px) — decorative, not interactive.
- Quick reference tab bar: minimum `h-[52px]` — tabs are secondary navigation, not primary glove actions. This is the one location where `h-[52px]` is acceptable because tabs require finger pressure not glove operation and are supplementary to the library entry point.
- Bottom action bar in walkthrough: `h-[96px]` including `pb-safe` padding for iOS home indicator safe area.
- Safety acknowledgement button: `h-[80px]` — elevated above standard 72px to signal criticality.
- SOP search input (expanded): `h-[56px]` — desktop-adjacent context, opened intentionally.
- Admin tables: row height `h-[56px]` — admin pages are desktop/tablet-primary.

---

## Typography

| Role | Size | Weight | Line Height | Tailwind class |
|------|------|--------|-------------|----------------|
| Page heading (h1) | 24px | 700 | 1.25 | `text-2xl font-bold` |
| Section heading (h2) | 18px | 600 | 1.35 | `text-lg font-semibold` |
| Card / SOP title (h3) | 16px | 600 | 1.4 | `text-base font-semibold` |
| Step text (body) | 18px | 400 | 1.65 | `text-lg font-normal leading-relaxed` |
| Step number | 13px | 700 | 1 | `text-[13px] font-bold tabular-nums` |
| Safety heading | 20px | 700 | 1.3 | `text-xl font-bold` |
| Safety body | 16px | 400 | 1.6 | `text-base font-normal` |
| Counter ("Step 3 of 12") | 14px | 600 | 1 | `text-sm font-semibold tabular-nums` |
| Label / metadata | 14px | 500 | 1.4 | `text-sm font-medium` |
| Caption / helper | 12px | 400 | 1.5 | `text-xs font-normal` |
| Tab label | 13px | 600 | 1 | `text-[13px] font-semibold` |
| Status badge | 12px | 600 | 1 | `text-xs font-semibold` |
| Warning annotation | 12px | 700 | 1 | `text-xs font-bold uppercase tracking-wide` |

Step text uses `text-lg` (18px) rather than `text-base` — workers in gloves reading at arm's length on a phone in bright outdoor light need larger body text than the admin review UI.

---

## Color

Palette sourced from `src/app/globals.css` `@theme` block. Dark mode is the default and only mode for Phase 3.

| Role | Token / Hex | Tailwind class | Usage |
|------|-------------|----------------|-------|
| Dominant (60%) | `--color-steel-900` #111827 | `bg-steel-900` | Page backgrounds, walkthrough background, main surface |
| Secondary (30%) | `--color-steel-800` #1f2937 | `bg-steel-800` | Cards, SOP list items, section panels, admin table rows |
| Elevated surface | `--color-steel-700` #374151 | `bg-steel-700` | Hover states, active tab underline, input backgrounds, dividers |
| Muted text | `--color-steel-400` #9ca3af | `text-steel-400` | Metadata, captions, step number label, tab labels (inactive) |
| Light text | `--color-steel-100` #f3f4f6 | `text-steel-100` | Primary body text, step text, SOP titles |
| Accent — brand | `--color-brand-yellow` #f59e0b | `text-brand-yellow` / `bg-brand-yellow` | Active tab indicator, primary CTA buttons, progress bar fill, assigned SOP badge, "Start walkthrough" button |
| Accent — safety | `--color-brand-orange` #ea580c | `text-brand-orange` / `bg-brand-orange` | Safety acknowledgement button, hazard section heading, warning annotations, PPE callout border, safety card border |
| Safety — hazard | #ef4444 (red-500) | `bg-red-500/20 text-red-400 border-red-500/50` | Hazard section cards and tab, emergency section cards and tab, hazard item bullets |
| Safety — PPE | #3b82f6 (blue-500) | `bg-blue-500/20 text-blue-400 border-blue-500/50` | PPE section cards and tab, PPE item chips |
| Safety — caution | `--color-brand-orange` #ea580c | `bg-brand-orange/20 text-brand-orange border-brand-orange/50` | Caution-level warnings within individual steps |
| Safety — emergency | #ef4444 (red-500) | `bg-red-500/20 text-red-400 border-red-500/50` | Emergency procedures section, same as hazard |
| Status — assigned | `--color-brand-yellow` #f59e0b | `bg-brand-yellow/20 text-brand-yellow` | "Assigned" badge on SOP library cards |
| Status — cached | #22c55e (green-500) | `bg-green-500/20 text-green-400` | Cache-ready indicator dot on SOP cards |
| Status — not cached | `--color-steel-700` #374151 | `bg-steel-700 text-steel-400` | Not-yet-cached indicator on SOP cards |
| Status — updated | #3b82f6 (blue-500) | `bg-blue-500/20 text-blue-400` | "Updated" badge when SOP has a newer version |
| Step — complete | #22c55e (green-500) | `bg-green-500/20 text-green-400 border-green-500/40` | Completed step rows in walkthrough list |
| Step — active | `--color-brand-yellow` #f59e0b | `border-l-4 border-brand-yellow` | Current/next step left accent |
| Destructive | #ef4444 | `text-red-400 hover:text-red-300` | Remove assignment, destructive admin actions |

Safety color semantics are fixed:
- Red — hazard / emergency / danger
- Orange — caution / warning within steps
- Blue — PPE / protective information
- Yellow — brand accent / progress / completion

Accent (brand-yellow) reserved for: "Start Walkthrough" primary CTA, progress bar fill, active tab underline, assigned badge, step complete checkmark fill, "Assign SOP" admin button. Never on generic links or decorative backgrounds.

---

## Page Structures

### Page 1 — Worker SOP Library (`/sops`)

**Purpose:** Worker's home screen for SOPs. Shows all assigned SOPs with search and category filter. Assigned SOPs are the complete visible library for workers (D-10).

**Layout (mobile — default):**

```
┌─────────────────────────────────────────┐
│  [≡ SOP Assistant]     [🔍 search icon] │  ← sticky header, h-[56px]
├─────────────────────────────────────────┤
│  "Your SOPs"  h1                        │
│  "12 procedures assigned to your role" │  ← metadata line
├─────────────────────────────────────────┤
│  [Category filter]  ← opens bottom sheet│
│  "All categories ▾"  h-[44px] pill btn │
├─────────────────────────────────────────┤
│  SOP Card                               │  ← min-h-[88px]
│  SOP Card                               │
│  SOP Card                               │
│  ...                                    │
├─────────────────────────────────────────┤
│  BottomTabBar (from Phase 1)            │  ← h-[56px] + safe area
└─────────────────────────────────────────┘
```

**Layout (desktop lg+):**

```
┌──────────────┬──────────────────────────┐
│  CATEGORIES  │  "Your SOPs"  [🔍]       │
│  sidebar     │  ──────────────────────  │
│  w-[240px]   │  SOP Card                │
│  sticky      │  SOP Card                │
│              │  SOP Card                │
└──────────────┴──────────────────────────┘
```

- Page wrapper: `flex flex-col min-h-screen bg-steel-900`
- Content area: `px-4 py-6 pb-[80px]` (mobile, accounts for BottomTabBar)
- Max content width: `max-w-2xl mx-auto` (mobile/tablet), sidebar + `flex-1 max-w-4xl` (lg+)
- SOP list: `flex flex-col gap-3`
- Header bar: `sticky top-0 z-20 bg-steel-900 border-b border-steel-700 px-4 flex items-center justify-between h-[56px]`
- Page heading: `text-2xl font-bold text-steel-100 mb-1`
- Metadata line: `text-sm text-steel-400 mb-4`

---

### Page 2 — SOP Detail / Quick Reference (`/sops/[sopId]`)

**Purpose:** Tab bar at top giving instant access to every SOP section. Default tab is Steps. This is the entry point before starting a walkthrough.

**Layout:**

```
┌──────────────────────────────────────────┐
│  [← Back]  "SOP Title"  [⬇ cache icon] │  ← sticky header
├──────────────────────────────────────────┤
│  [Hazards][PPE][Steps][Emergency][Info]  │  ← sticky tab bar, h-[52px]
├──────────────────────────────────────────┤
│                                          │
│  Section content (scrollable)            │
│                                          │
│                                          │
├──────────────────────────────────────────┤
│  [  Start Walkthrough  ]  h-[72px]       │  ← sticky bottom bar (Steps tab only)
│  BottomTabBar                            │
└──────────────────────────────────────────┘
```

- Page wrapper: `flex flex-col h-screen bg-steel-900 overflow-hidden`
- Header: `sticky top-0 z-20 bg-steel-900 border-b border-steel-700 px-4 flex items-center gap-3 h-[56px]`
- Tab bar: `sticky top-[56px] z-10 bg-steel-900 border-b border-steel-700`
- Scroll area: `flex-1 overflow-y-auto px-4 py-6 pb-[80px]`
- Bottom action bar: `sticky bottom-[56px] bg-steel-900 border-t border-steel-700 px-4 py-3` (sits above BottomTabBar; hidden on non-Steps tabs)

---

### Page 3 — SOP Walkthrough (`/sops/[sopId]/walkthrough`)

**Purpose:** Full-screen, glove-friendly step-by-step walkthrough. No BottomTabBar — it would obscure step actions. Dedicated layout with own `layout.tsx` that omits BottomTabBar (D-05, WORK-10).

**Layout:**

```
┌──────────────────────────────────────────┐
│  [✕ Exit]  SOP Title (truncated)         │  ← fixed top bar, h-[56px]
├──────────────────────────────────────────┤
│  ████████░░░░░░░░░░░░  progress bar h-2  │
│  "Step 3 of 12"         counter          │
├──────────────────────────────────────────┤
│                                          │
│  Safety summary banner (collapsible)     │  ← always accessible
│                                          │
├──────────────────────────────────────────┤
│                                          │
│  Step 1  ✓  [completed]                  │
│  Step 2  ✓  [completed]                  │
│  Step 3  ←  [active — current]           │
│  Step 4     [upcoming]                   │
│  Step 5     [upcoming]                   │
│  ...                                     │
│                                          │
├──────────────────────────────────────────┤
│  [  Mark Step 3 Complete  ]  h-[80px]   │  ← fixed bottom action
│  [← Previous step]  [Skip →]            │  ← secondary row h-[44px]
└──────────────────────────────────────────┘
```

- Root layout: `flex flex-col h-screen bg-steel-900 overflow-hidden` — no BottomTabBar rendered
- Top bar: `fixed top-0 left-0 right-0 z-30 bg-steel-900 border-b border-steel-700 px-4 flex items-center gap-3 h-[56px]`
- Progress + counter strip: `bg-steel-900 px-4 pt-2 pb-3` (sits below fixed top bar via `pt-[56px]`)
- Scrollable step list: `flex-1 overflow-y-auto px-4 pb-[160px]` (bottom padding for fixed actions)
- Fixed bottom action area: `fixed bottom-0 left-0 right-0 z-30 bg-steel-900 border-t border-steel-700 px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))]`

**Safety Acknowledgement Gate:** Renders INSTEAD of the step list on first open per session. Replaced by step list once acknowledged. See C-05.

---

### Page 4 — Admin SOP Assignment (`/admin/sops/[sopId]/assign`)

**Purpose:** Admin assigns an SOP to one or more roles and/or individual workers.

**Layout:**

```
┌──────────────────────────────────────────────────────┐
│  [← Back to SOP]  "Assign SOP"  "SOP Title"          │  ← header
├──────────────────────────────────────────────────────┤
│  ASSIGN BY ROLE                                       │
│  ┌──────────────────────────────────────────────┐    │
│  │ Role: Machine Operator     [Assigned ✓]       │    │
│  │ Role: Supervisor           [+ Assign]         │    │
│  │ Role: Safety Manager       [+ Assign]         │    │
│  └──────────────────────────────────────────────┘    │
├──────────────────────────────────────────────────────┤
│  ASSIGN TO INDIVIDUAL WORKERS                        │
│  [Search workers...]  h-[56px] input                 │
│  ┌──────────────────────────────────────────────┐    │
│  │ Avatar | Name | Role       [Assigned ✓]       │    │
│  │ Avatar | Name | Role       [+ Assign]         │    │
│  └──────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
```

- Page padding: `px-4 py-8` (mobile), `px-8 py-10` (lg:)
- Max content width: `max-w-3xl mx-auto`
- Section heading: `text-xs font-semibold text-steel-400 uppercase tracking-widest mb-3`
- Role/worker rows: `flex items-center gap-4 p-4 bg-steel-800 rounded-lg min-h-[56px] border border-transparent`

---

### Page 5 — SOP Version Management (`/admin/sops/[sopId]/versions`)

**Purpose:** Admin views version history, uploads a new version. Workers auto-receive the new version on next sync.

**Layout:**

```
┌──────────────────────────────────────────────────────┐
│  [← Back]  "Version History"  "SOP Title"            │
├──────────────────────────────────────────────────────┤
│  [+ Upload New Version]  h-[56px] button             │
├──────────────────────────────────────────────────────┤
│  Version history table                               │
│  ┌──────────┬───────────┬──────────┬──────────────┐  │
│  │ Version  │ Uploaded  │ By       │ Status        │  │
│  ├──────────┼───────────┼──────────┼──────────────┤  │
│  │ v3 (cur) │ 25 Mar 26 │ S. Parks │ [Current]     │  │
│  │ v2       │ 12 Jan 26 │ S. Parks │ [Superseded]  │  │
│  │ v1       │ 3 Nov 25  │ Admin    │ [Superseded]  │  │
│  └──────────┴───────────┴──────────┴──────────────┘  │
└──────────────────────────────────────────────────────┘
```

- Page padding: `px-4 py-8` (mobile), `px-8 py-10` (lg:)
- Max content width: `max-w-3xl mx-auto`
- Table: `w-full` with `bg-steel-800 rounded-lg overflow-hidden border border-steel-700`
- Table header row: `bg-steel-900/60 text-xs font-semibold text-steel-400 uppercase tracking-wide`
- Table data rows: `border-t border-steel-700 text-sm text-steel-100 min-h-[56px]`

---

## Components

### C-01: SOP Library Card

**File:** `src/components/sop/SopLibraryCard.tsx`

**Purpose:** Represents one SOP in the library list. Shows title, category, cache status, and assigned badge.

**Base:**
```
flex items-start gap-4 p-4 bg-steel-800 rounded-xl
hover:bg-steel-700 active:bg-steel-600
transition-colors cursor-pointer min-h-[88px]
border border-transparent hover:border-steel-600
```

**Left column (icon area, `flex-shrink-0`):**
- SOP icon: lucide `FileText` `size={28} text-steel-400`
- Below icon: cache readiness dot (C-13)

**Middle column (`flex-1 min-w-0`):**
- SOP title: `text-base font-semibold text-steel-100 leading-snug`
- Category + department: `text-xs text-steel-400 mt-0.5`
- SOP number (if present): `text-xs text-steel-400 font-mono`
- Badge row: `flex items-center gap-2 mt-2 flex-wrap`
  - "Assigned" badge (if directly assigned): `inline-flex items-center gap-1 px-2 py-0.5 bg-brand-yellow/20 text-brand-yellow text-xs font-semibold rounded`
  - Role badge (if role-assigned): `inline-flex items-center px-2 py-0.5 bg-steel-700 text-steel-100 text-xs font-medium rounded` showing role name (e.g. "Machine Operator")
  - "Updated" badge (if newer version available): `inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs font-semibold rounded` with lucide `RefreshCw` `size={10}` + "Updated"

**Right column (`flex-shrink-0 flex flex-col items-end justify-between self-stretch`):**
- lucide `ChevronRight` `size={18} text-steel-400`
- Section count: `text-xs text-steel-400 mt-auto` (e.g. "12 steps")

---

### C-02: SOP Section Tab Bar

**File:** `src/components/sop/SopSectionTabs.tsx`

**Purpose:** Horizontal scrollable tab bar showing each section type of the SOP. Always visible when viewing an SOP (D-09). Active tab has bottom accent in section colour.

**Container:**
```
flex overflow-x-auto scrollbar-none bg-steel-900 border-b border-steel-700
-mx-0 px-4 gap-0
```

**Each tab button:**
```
flex-shrink-0 flex flex-col items-center justify-end
px-4 h-[52px] gap-1
relative whitespace-nowrap
text-[13px] font-semibold
transition-colors
```

**Active state:** bottom `border-b-2` in section colour. Text colour matches section accent.

**Inactive state:** `text-steel-400 hover:text-steel-100`

**Tab colour semantics:**

| Section type | Active text | Active border |
|-------------|-------------|---------------|
| Hazards | `text-red-400` | `border-red-400` |
| PPE | `text-blue-400` | `border-blue-400` |
| Steps | `text-brand-yellow` | `border-brand-yellow` |
| Emergency | `text-red-400` | `border-red-400` |
| Info / Other | `text-steel-100` | `border-steel-100` |

Tab labels use the `sop_sections.section_type` field mapped to display names:
- `hazards` → "Hazards"
- `ppe` → "PPE"
- `steps` → "Steps"
- `emergency` → "Emergency"
- `overview` → "Overview"
- `notes` → "Notes"
- Any other → title-cased section_type value

Tab with lucide icon prefix (16px, matching text colour):
- Hazards: `AlertTriangle`
- PPE: `ShieldCheck`
- Steps: `ListChecks`
- Emergency: `Siren`

---

### C-03: Step Item Row

**File:** `src/components/sop/StepItem.tsx`

**Purpose:** A single step in the scrolling walkthrough list. Tapable to mark complete (WORK-01, WORK-02). Minimum 72px height (WORK-09).

**States:** upcoming | active | completed

**Base container:**
```
flex items-start gap-4 px-4 py-5
border-l-4 border-transparent
transition-all duration-150
min-h-[72px]
```

**Active (current):**
```
border-l-4 border-brand-yellow
bg-steel-800/60
```

**Completed:**
```
border-l-4 border-green-500/40
bg-green-500/5
```

**Upcoming:**
```
border-l-4 border-transparent
opacity-80
```

**Left: step number column (`flex-shrink-0 w-8 pt-0.5`):**
- Upcoming/active: `text-[13px] font-bold tabular-nums text-steel-400`
- Completed: lucide `CheckCircle2` `size={20} text-green-400` (replaces number)

**Centre: content column (`flex-1 min-w-0`):**
- Step text: `text-lg font-normal text-steel-100 leading-relaxed`
- Warning annotations (inline after step text, on new line):
  ```
  inline-flex items-center gap-1 px-2 py-1
  bg-brand-orange/20 text-brand-orange
  text-xs font-bold uppercase tracking-wide rounded
  border border-brand-orange/30
  mt-2
  ```
  Prefix with lucide `AlertTriangle` `size={12}`
- Caution annotations: same styles as warning (brand-orange)
- Hazard/danger annotations:
  ```
  bg-red-500/20 text-red-400 border-red-500/30
  ```
  Prefix with lucide `AlertOctagon` `size={12}`
- Inline images (C-11) render below step text, `mt-3`

**Right: tap target (`flex-shrink-0`):**
- Upcoming/active: lucide `Circle` `size={28} text-steel-600 hover:text-brand-yellow` — this entire right zone is `min-w-[44px] min-h-[72px] flex items-center justify-center cursor-pointer`
- Completed: lucide `CheckCircle2` `size={28} text-green-400` (tapping again undoes completion)

Tapping anywhere on the row (not just the right icon) marks the step complete — the entire row is a button when in active/upcoming state.

---

### C-04: Step Progress Header

**File:** `src/components/sop/StepProgress.tsx`

**Purpose:** Shows progress bar and "Step N of N" counter at the top of the walkthrough (D-04).

**Container:**
```
px-4 pt-3 pb-4 bg-steel-900
```

**Progress bar:**
```
h-2 bg-steel-700 rounded-full overflow-hidden mb-2
```
Fill: `h-full bg-brand-yellow rounded-full transition-all duration-300` with width as inline style `{ width: '${(completedCount / totalSteps) * 100}%' }`

**Counter row:**
```
flex items-center justify-between
```
- Left: `"Step {current} of {total}"` — `text-sm font-semibold text-steel-100 tabular-nums`
- Right: percentage — `text-sm text-steel-400 tabular-nums` (e.g. "25% done")

---

### C-05: Safety Acknowledgement Card

**File:** `src/components/sop/SafetyAcknowledgement.tsx`

**Purpose:** Full-screen gate shown before walkthrough steps. Worker must explicitly acknowledge hazards and PPE before proceeding. Mandatory per D-02 and WORK-05. Uses a prominent tap button — NOT a checkbox (checkboxes are glove-hostile per research Pattern 4).

**Full-screen overlay:**
```
fixed inset-0 z-40 bg-steel-900 flex flex-col overflow-y-auto
```

**Inner container:**
```
flex flex-col gap-6 px-4 py-8 pb-[120px] max-w-2xl mx-auto w-full
```

**Header:**
```
flex flex-col gap-2
```
- Icon: lucide `ShieldAlert` `size={40} text-brand-orange`
- Heading: `"Before you start"` — `text-2xl font-bold text-steel-100`
- Subheading: `"Review the hazards and required PPE for this procedure."` — `text-base text-steel-400`

**Hazards card (if hazards section present):**
```
bg-red-500/10 border border-red-500/40 rounded-xl p-5
```
- Header row: lucide `AlertTriangle` `size={18} text-red-400` + `"HAZARDS"` `text-xs font-bold uppercase tracking-widest text-red-400`
- Divider: `border-t border-red-500/20 my-3`
- Content: `text-base text-steel-100 leading-relaxed` — rendered as bullet list if multiple items: `ul list-none space-y-2` with each item prefixed by `•` in `text-red-400`

**PPE card (if PPE section present):**
```
bg-blue-500/10 border border-blue-500/40 rounded-xl p-5
```
- Header row: lucide `ShieldCheck` `size={18} text-blue-400` + `"PPE REQUIRED"` `text-xs font-bold uppercase tracking-widest text-blue-400`
- Divider: `border-t border-blue-500/20 my-3`
- Content: `text-base text-steel-100 leading-relaxed`
- PPE items as chips: `inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/15 text-blue-300 text-sm font-medium rounded-lg border border-blue-500/30`

**Emergency card (if emergency section present, shown collapsed by default):**
```
bg-red-500/10 border border-red-500/40 rounded-xl overflow-hidden
```
- Collapsed header (button): `flex items-center justify-between p-4 min-h-[56px]`
  - Left: lucide `Siren` `size={18} text-red-400` + `"EMERGENCY PROCEDURES"` `text-xs font-bold uppercase tracking-widest text-red-400`
  - Right: lucide `ChevronDown` `size={16} text-steel-400` (rotates on expand: `transition-transform`)
- Expanded content: `px-5 pb-5 text-base text-steel-100`

**Fixed bottom acknowledgement bar:**
```
fixed bottom-0 left-0 right-0 z-50
bg-steel-900 border-t border-steel-700
px-4 pt-4 pb-[calc(16px+env(safe-area-inset-bottom,0px))]
```
- Button: `"I've read and understood the hazards — Start Procedure"` or short form `"Understood — Start Procedure"` on small screens
  ```
  w-full h-[80px] bg-brand-orange text-white
  font-bold text-lg rounded-xl
  hover:bg-orange-500 active:bg-orange-700
  transition-colors
  ```
  Leading icon: lucide `ShieldCheck` `size={22} mr-2`

**Re-access during walkthrough (collapsed safety summary strip):**

After acknowledgement, a collapsible strip persists at the top of the walkthrough scroll area:
```
flex items-center gap-3 px-4 py-3
bg-brand-orange/10 border border-brand-orange/30 rounded-xl
mb-4 cursor-pointer
```
- Left: lucide `ShieldAlert` `size={18} text-brand-orange`
- Text: `"Safety summary"` `text-sm font-semibold text-brand-orange` + `"Tap to review"` `text-xs text-steel-400 ml-1`
- Right: lucide `ChevronDown` `size={16} text-steel-400`
- Expanded: renders the same hazards + PPE cards inline (not full-screen), with `"Close"` at bottom

---

### C-06: Walkthrough Bottom Action Bar

**File:** Part of `src/app/(protected)/sops/[sopId]/walkthrough/page.tsx`

**Purpose:** Primary action area for step progression. Fixed to bottom of screen, above iOS safe area.

**Container:**
```
fixed bottom-0 left-0 right-0 z-30
bg-steel-900 border-t border-steel-700
px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))]
flex flex-col gap-2
```

**Primary button — "Mark Complete":**
```
w-full h-[72px] rounded-xl font-bold text-lg
transition-all
```
- Upcoming/active step: `bg-brand-yellow text-steel-900 hover:bg-amber-400 active:bg-amber-500`
- Copy: `"Mark step {N} complete"` — uses current step number
- Already-completed step (tapped back to it): `bg-green-500/20 text-green-400 border border-green-500/40 hover:bg-green-500/30`
- Copy: `"Undo — step {N} complete"`
- All steps done (last step): `bg-green-500 text-white hover:bg-green-400` — Copy: `"Finish SOP — all steps done"`

**Secondary row:**
```
flex items-center justify-between h-[44px]
```
- `[← Previous]` link-style button: `flex items-center gap-1.5 px-4 h-[44px] text-sm font-medium text-steel-400 hover:text-steel-100 rounded-lg hover:bg-steel-800 transition-colors`
  - Disabled (on first step): `opacity-30 pointer-events-none`
  - lucide `ArrowLeft` `size={16}`
- `[Skip this step →]` link-style button: `flex items-center gap-1.5 px-4 h-[44px] text-sm font-medium text-steel-400 hover:text-steel-100 rounded-lg hover:bg-steel-800 transition-colors`
  - lucide `ArrowRight` `size={16}`

---

### C-07: Search Overlay

**File:** `src/components/sop/SopSearchInput.tsx`

**Purpose:** Hidden by default — search icon tap reveals a full-width search field with instant-filter results overlaid on the SOP list (D-07).

**Trigger (in header bar):**
- lucide `Search` `size={22} text-steel-400 hover:text-steel-100 cursor-pointer` — tap opens search overlay

**Search overlay (full-screen):**
```
fixed inset-0 z-40 bg-steel-900 flex flex-col
```

**Search input bar:**
```
flex items-center gap-3 px-4 py-3 border-b border-steel-700
```
- lucide `Search` `size={20} text-steel-400 flex-shrink-0`
- `<input>` — `flex-1 bg-transparent text-base text-steel-100 placeholder:text-steel-400 outline-none h-[40px]`
  - `placeholder="Search SOPs…"` — auto-focused on open
- `[Cancel]` button: `text-sm font-medium text-brand-yellow hover:text-amber-400 flex-shrink-0 px-2` — closes overlay

**Results list:**
```
flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2
```
- Instant-filter on input (no submit, no debounce needed for <500 items via Dexie in-memory)
- Results render as SOP Library Cards (C-01) in a flat list
- No results: C-14 (empty state)

**Behaviour:**
1. Search icon tapped → overlay slides in from top (`translate-y-0` from `translate-y-[-100%]` with `transition-transform duration-200`)
2. Input auto-focused
3. User types → results filter in real time
4. Tap a result → navigate to SOP detail, overlay closes
5. `[Cancel]` or `Escape` → overlay closes, original list restored

---

### C-08: Category Bottom Sheet (Mobile) / Sidebar (Desktop)

**File:** `src/components/sop/CategoryBottomSheet.tsx`

**Purpose:** Browse/filter SOPs by category or department (D-08, MGMT-04).

**Mobile — Bottom Sheet:**

Triggered by the "All categories ▾" pill button in the library header.

**Overlay backdrop:**
```
fixed inset-0 z-30 bg-black/60 backdrop-blur-sm
```
(tap to dismiss)

**Sheet panel:**
```
fixed bottom-0 left-0 right-0 z-40
bg-steel-800 rounded-t-2xl
shadow-2xl
max-h-[70vh] overflow-hidden flex flex-col
```

**Sheet handle:**
```
mx-auto mt-3 mb-0 w-10 h-1 bg-steel-600 rounded-full flex-shrink-0
```

**Sheet header:**
```
px-4 py-4 border-b border-steel-700 flex items-center justify-between flex-shrink-0
```
- Heading: `"Filter by category"` `text-base font-semibold text-steel-100`
- `[Clear]` link (if filter active): `text-sm text-brand-yellow hover:text-amber-400`

**Category list:**
```
flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-1
```
Each category row:
```
flex items-center justify-between px-4 h-[56px]
rounded-xl transition-colors cursor-pointer
```
- Default: `hover:bg-steel-700`
- Active: `bg-brand-yellow/15 border border-brand-yellow/30`
- Category name: `text-base font-medium text-steel-100`
- Count chip: `text-xs text-steel-400 tabular-nums` (e.g. "8 SOPs")
- Active: leading lucide `Check` `size={16} text-brand-yellow`

**Desktop — Sidebar:**
```
w-[240px] flex-shrink-0 sticky top-0 h-screen
overflow-y-auto py-6 px-3
border-r border-steel-700 bg-steel-900
```
- Heading: `"Categories"` `text-xs font-semibold text-steel-400 uppercase tracking-widest px-3 mb-3`
- Same row styles as mobile sheet rows but `h-[44px]`

---

### C-09: Walkthrough Header Bar

**File:** Part of `src/app/(protected)/sops/[sopId]/walkthrough/layout.tsx`

**Purpose:** Fixed top bar during walkthrough. Shows SOP title and exit button. No BottomTabBar rendered in this layout.

```
fixed top-0 left-0 right-0 z-30
bg-steel-900/95 backdrop-blur-sm
border-b border-steel-700
px-4 flex items-center gap-3 h-[56px]
```

- Exit button: `[✕]` — lucide `X` `size={20} text-steel-400 hover:text-steel-100 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-steel-800`
- SOP title: `text-sm font-semibold text-steel-100 flex-1 truncate`
- Step indicator (compact): `text-xs text-steel-400 tabular-nums flex-shrink-0` — e.g. "3/12"

---

### C-10: SOP Detail Header Bar

**File:** Part of `src/app/(protected)/sops/[sopId]/page.tsx`

```
sticky top-0 z-20
bg-steel-900 border-b border-steel-700
px-4 flex items-center gap-3 h-[56px]
```

- Back button: lucide `ArrowLeft` `size={20} text-steel-400 hover:text-steel-100 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-steel-800`
- SOP title: `text-base font-semibold text-steel-100 flex-1 truncate`
- Cache/download button (C-13 trigger): lucide `Download` (not cached) or `CheckCircle` (cached) `size={20}` `min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-steel-800 flex-shrink-0`

---

### C-11: Inline Step Image

**File:** `src/components/sop/SopImageInline.tsx`

**Purpose:** Image displayed inline below step text. Tap opens full-screen zoom via `yet-another-react-lightbox` (D-03, WORK-06).

**Inline container:**
```
relative mt-3 rounded-xl overflow-hidden
bg-steel-700 cursor-zoom-in
max-h-[240px]
border border-steel-600
```

Image element:
```
w-full object-contain max-h-[240px]
```

Zoom hint overlay (fades in on hover, visible on mobile as persistent semi-transparent badge):
```
absolute bottom-2 right-2
flex items-center gap-1 px-2 py-1
bg-steel-900/80 rounded-lg
text-xs font-medium text-steel-100
```
- lucide `ZoomIn` `size={12}` + `"Tap to zoom"`

**Lightbox (yet-another-react-lightbox):**
- Import: `import Lightbox from 'yet-another-react-lightbox'` + `import Zoom from 'yet-another-react-lightbox/plugins/zoom'`
- Dynamic import with `next/dynamic` (no SSR) to avoid bundle size impact
- Opens as full-screen overlay on tap
- Slides: single slide with the full-res Supabase Storage URL (presigned)
- Zoom plugin active: pinch-to-zoom on mobile, scroll-to-zoom on desktop
- Background: `rgba(0, 0, 0, 0.95)` — near-opaque for focus

---

### C-12: Quick Reference Section Content

**File:** `src/components/sop/SectionContent.tsx`

**Purpose:** Renders section content within the quick reference tab view. Section type determines card colour and icon.

**Hazards and Emergency sections:**
```
bg-red-500/10 border border-red-500/30 rounded-xl p-5 mb-4
```
- Header: lucide `AlertTriangle` `size={18} text-red-400` + section title `text-sm font-bold uppercase tracking-widest text-red-400 ml-2`
- Content: `text-base text-steel-100 leading-relaxed mt-3`
- List items: `flex items-start gap-3` with `•` in `text-red-400 mt-1.5 flex-shrink-0`

**PPE section:**
```
bg-blue-500/10 border border-blue-500/30 rounded-xl p-5 mb-4
```
- Header: lucide `ShieldCheck` `size={18} text-blue-400` + title in `text-blue-400`
- PPE item chips: `inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/15 text-blue-300 text-sm font-medium rounded-lg border border-blue-500/30 m-1`

**Steps section (in quick reference — read-only numbered list):**
```
flex flex-col gap-3
```
Each step:
```
flex items-start gap-4 p-4 bg-steel-800 rounded-xl border border-steel-700
```
- Step number: `text-[13px] font-bold text-steel-400 w-6 flex-shrink-0 pt-0.5 tabular-nums`
- Step text: `text-base text-steel-100 leading-relaxed flex-1`

**Info/Other sections:**
```
bg-steel-800 border border-steel-700 rounded-xl p-5 mb-4
```
- No colour accent — neutral surface

---

### C-13: Cache Readiness Indicator

**File:** Part of `src/components/sop/SopLibraryCard.tsx` and `src/components/sop/SopDetailHeader.tsx`

**Purpose:** Shows whether the SOP is available offline. iOS Safari evicts IndexedDB after ~7 days inactivity — explicit per-SOP download UI is required (per STATE.md blockers).

**In library card (small dot below file icon):**
- Cached: `w-2.5 h-2.5 rounded-full bg-green-500` with `title="Available offline"`
- Not cached: `w-2.5 h-2.5 rounded-full bg-steel-600`
- Syncing: `w-2.5 h-2.5 rounded-full bg-brand-yellow animate-pulse`

**In SOP detail header (icon button):**
- Cached: lucide `CheckCircle` `size={20} text-green-400` — tap shows "Downloaded. Available offline." tooltip
- Not cached: lucide `Download` `size={20} text-steel-400` — tap triggers manual SOP cache
- Downloading: lucide `Loader` `size={20} text-brand-yellow animate-spin`

**Manual cache confirmation toast:**
```
fixed bottom-[72px] left-4 right-4 z-50
bg-steel-800 border border-steel-700 rounded-xl
px-4 py-3 text-sm text-steel-100 shadow-xl
flex items-center gap-3
```
- Cached successfully: `"Saved offline. You're all good even without signal."` + lucide `CheckCircle` `text-green-400`
- Cache failed: `"Couldn't save offline — check your storage space."` + lucide `AlertTriangle` `text-red-400`

---

### C-14: Empty States

**File:** Inline in respective page components.

**SOP Library — no assigned SOPs:**
```
flex flex-col items-center justify-center gap-4
py-24 px-8 text-center
```
- lucide `ClipboardList` `size={48} text-steel-600`
- Heading: `"No SOPs assigned yet"` `text-xl font-semibold text-steel-100`
- Body: `"Your admin hasn't assigned any SOPs to you yet. Give them a nudge."` `text-sm text-steel-400 max-w-xs`

**SOP Library — search no results:**
- lucide `SearchX` `size={40} text-steel-600`
- Heading: `"Nothing matched"` `text-lg font-semibold text-steel-100`
- Body: `"Try a different search term or check your spelling."` `text-sm text-steel-400`

**Admin Assignment — no workers in org:**
- lucide `Users` `size={40} text-steel-600`
- Heading: `"No workers yet"` `text-lg font-semibold text-steel-100`
- Body: `"Invite workers to your organisation first, then assign SOPs to them."` `text-sm text-steel-400`

**Version History — only one version:**
- No empty state needed — the current version always shows.

---

### C-15: SOP Assignment Row

**File:** `src/components/admin/AssignmentRow.tsx`

**Purpose:** Role or individual worker row in the assignment admin UI.

**Base:**
```
flex items-center gap-4 px-4 py-3
bg-steel-800 rounded-xl border border-steel-700
min-h-[56px]
```

**Role row:**
- lucide `Users` `size={20} text-steel-400 flex-shrink-0`
- Role name: `text-base font-medium text-steel-100 flex-1`
- Worker count: `text-sm text-steel-400` (e.g. "4 workers")
- Action button (right): see below

**Individual worker row:**
- Avatar initials: `w-9 h-9 rounded-full bg-steel-700 flex items-center justify-center text-sm font-bold text-steel-100 flex-shrink-0`
- Name + role: `flex flex-col flex-1` — name `text-base font-medium text-steel-100`, role `text-xs text-steel-400`
- Action button (right): see below

**Action button states:**

| State | Button | Classes |
|-------|--------|---------|
| Not assigned | `[+ Assign]` | `h-[44px] px-4 bg-brand-yellow text-steel-900 font-semibold text-sm rounded-lg hover:bg-amber-400` |
| Assigned | `[Assigned ✓]` (static) + `[Remove]` on hover | `h-[44px] px-4 bg-green-500/20 text-green-400 border border-green-500/40 font-semibold text-sm rounded-lg` |
| Loading | spinner replacing icon | `opacity-70 pointer-events-none` |

---

### C-16: Version History Table Row

**File:** Part of `src/app/(protected)/admin/sops/[sopId]/versions/page.tsx`

```
flex items-center gap-4 px-4 py-3
border-t border-steel-700 min-h-[56px]
```

- Version number: `text-sm font-mono font-semibold text-steel-100 w-[80px] flex-shrink-0` — e.g. `v3`
- `[Current]` badge (latest version only): `inline-flex items-center gap-1 px-2 py-0.5 bg-brand-yellow/20 text-brand-yellow text-xs font-semibold rounded`
- `[Superseded]` badge (old versions): `inline-flex items-center px-2 py-0.5 bg-steel-700 text-steel-400 text-xs font-medium rounded`
- Upload date: `text-sm text-steel-400 flex-1 tabular-nums`
- Uploaded by: `text-sm text-steel-400`
- Review link (admin only, current version): `text-brand-yellow text-sm hover:text-amber-400` — "Review →"

---

## Interactions

### I-01: Opening a Walkthrough

1. Worker taps an SOP card in library → navigates to `/sops/[sopId]` (SOP detail page)
2. Steps tab is active by default
3. If SOP is cached, "Start Walkthrough" button is active
4. If SOP is not cached and offline, button is disabled with copy: `"Download this SOP first to walk through it offline"` and a manual cache trigger button renders instead
5. Worker taps `"Start Walkthrough"` → navigates to `/sops/[sopId]/walkthrough`
6. Safety Acknowledgement (C-05) renders full-screen gate — step list is hidden behind it
7. Worker reads hazards + PPE cards, taps `"Understood — Start Procedure"` (80px orange button)
8. Gate dismisses with `translate-y-[-100%] opacity-0 transition-all duration-300`
9. Step list scrolls into view at step 1

**Mid-session acknowledgement expiry:** Safety acknowledgement state (Zustand `walkthrough.ts`) is keyed by `sopId` and resets when the app restarts. Workers who close and re-open the app must re-acknowledge. This is the safest default for safety-critical procedures.

---

### I-02: Step Completion Tap

1. Worker taps anywhere on a step row (or taps the circle icon on the right)
2. Step transitions: upcoming → completed
   - Row background fades to `bg-green-500/5`
   - Left border changes from `border-brand-yellow` to `border-green-500/40`
   - Step number icon swaps from number text to lucide `CheckCircle2` `text-green-400` with `scale-110 → scale-100` spring animation
   - Haptic feedback: `navigator.vibrate(30)` (Android; no-op on iOS)
3. Progress bar fill width updates smoothly (`transition-all duration-300`)
4. Counter increments: `"Step 3 of 12"` → `"Step 4 of 12"`
5. Bottom action button text updates: `"Mark step 4 complete"`
6. List does NOT auto-scroll to next step — workers control their own position (one-handed scrolling)

**Un-completing a step (WORK-02):**
1. Worker taps a completed step row
2. Confirmation is NOT shown — tap immediately reverts to upcoming state
3. Progress bar decrements

**Completing all steps:**
1. Last step marked complete → bottom button changes to `bg-green-500` `"Finish SOP — all steps done"` with lucide `PartyPopper` `size={20} mr-2`
2. Worker taps "Finish SOP" → navigates to completion confirmation (Phase 4 scope — for now, shows a brief success screen before returning to library)

---

### I-03: Safety Acknowledgement

1. Worker opens walkthrough for an SOP not acknowledged this session
2. Full-screen safety card renders (C-05) — step list is not yet visible
3. Worker can expand/collapse emergency procedures card via tap on its header
4. `"Understood — Start Procedure"` button is always visible in fixed bottom bar — no scrolling required to reach it (critical for glove usability)
5. Worker taps button → Zustand store records `{ sopId, acknowledgedAt: Date.now() }`
6. Gate slides up and off screen, step list reveals

**No checkbox. No "I confirm I have read…" legal language.** The act of tapping the orange button is the acknowledgement. Keep it direct.

---

### I-04: Quick Reference Tab Switching

1. Worker is on SOP detail page (`/sops/[sopId]`)
2. Tabs render for all section types present in the SOP (dynamically generated — if an SOP has no Emergency section, that tab doesn't render)
3. Worker taps a tab → active indicator (coloured bottom border) slides to the new tab with `transition-all duration-150`
4. Content area scrolls to top (or re-renders) showing the new section
5. Tabs are horizontally scrollable — if many sections exist, user can scroll the tab bar
6. "Start Walkthrough" bottom bar only shows on the Steps tab; all other tabs show no bottom bar

---

### I-05: Search

1. Worker taps magnifying glass icon in library header
2. Search overlay slides down from top (`transition-transform duration-200 ease-out`)
3. Input auto-focused — keyboard appears
4. Worker types → results update in real time (Dexie in-memory full-text filter — no network needed)
5. Search matches against: SOP title, SOP number, category, department, section content text
6. Results are SOP Library Cards (C-01) in a flat list
7. Tapping a result navigates to `/sops/[sopId]`, overlay closes
8. Tapping `[Cancel]` closes overlay, keyboard dismisses, library list is unchanged
9. Empty state (C-14) shows if no results match

---

### I-06: Category Filter

**Mobile:**
1. Worker taps `"All categories ▾"` pill button
2. Bottom sheet slides up from bottom (`translate-y-0` from `translate-y-full` `transition-transform duration-250 ease-out`)
3. Backdrop fades in
4. Worker taps a category → sheet closes, library list filters to that category
5. Pill button updates to `"[Category name] ▾"` with `text-brand-yellow`
6. `[Clear]` appears in sheet header when a filter is active
7. Tapping backdrop dismisses sheet with no filter change

**Desktop:**
- Categories are always visible in left sidebar
- Active category row has `bg-brand-yellow/15 border-brand-yellow/30`
- Clicking a row filters the library to the right

---

### I-07: SOP Assignment (Admin)

1. Admin navigates to `/admin/sops/[sopId]/assign`
2. Page shows two sections: roles (always shown) and individual workers (shown with search)
3. Admin taps `[+ Assign]` on a role row → button shows spinner → transitions to `[Assigned ✓]`
   - Server action: `POST /api/sops/[sopId]/assignments` `{ assignment_type: 'role', role: 'machine_operator' }`
   - On success: row updates optimistically (Zustand local state updated immediately, confirmed by server response)
   - On error: button reverts, error toast: `"Couldn't assign — try again"`
4. Admin hovers/focuses an `[Assigned ✓]` row → `[Remove]` button replaces `[Assigned ✓]`
5. Tapping `[Remove]` → inline confirmation: `"Remove assignment for Machine Operator?"` with `[Remove]` (`text-red-400`) and `[Cancel]` inline — no modal
6. On confirm: DELETE fires, row updates to `[+ Assign]`

---

### I-08: Uploading a New SOP Version (Admin)

1. Admin navigates to `/admin/sops/[sopId]/versions`
2. Admin taps `[+ Upload New Version]`
3. Same upload flow as Phase 2 upload page — file picker opens, file is uploaded and parses
4. Inline inline confirmation before upload:
   ```
   bg-brand-orange/10 border border-brand-orange/30 rounded-xl px-4 py-4 mb-4 text-sm text-steel-100
   ```
   Copy: `"Uploading a new version will replace what workers see — the old version stays linked to any historical completions."` + `[Got it, proceed]` (`text-brand-orange font-semibold`) and `[Cancel]` inline

5. After upload + parse completes → new version appears at top of version history table as `[Current]`
6. Previous version's badge changes to `[Superseded]`
7. Version number auto-increments (integer, server-assigned)
8. **No notification sent to workers** — version update is silent (D-14). Workers see the new version next time the sync engine runs.
9. Workers mid-walkthrough on the old version complete on that version — new version shows on next entry (D-15)

---

### I-09: Offline Behaviour

1. `OnlineStatusBanner` (from Phase 1) already handles the offline indicator strip
2. SOP library loads from Dexie when offline — no visible difference if SOPs are cached
3. If a worker tries to open an uncached SOP while offline:
   ```
   bg-steel-800 border border-steel-700 rounded-xl p-6 text-center
   ```
   - lucide `WifiOff` `size={40} text-steel-600`
   - Copy: `"You're offline and this SOP isn't downloaded yet."` `text-base text-steel-100`
   - Sub-copy: `"Come back online to access it, or download it while you've got signal."` `text-sm text-steel-400`
4. Walkthrough works fully offline for cached SOPs — no degradation
5. Step completion state is stored in Zustand (in-memory) and Dexie (persisted) — survives app background
6. Sync triggers automatically on `navigator.onLine` event and on app foreground via `useSopSync` hook

---

## Copywriting Contract

### SOP Library

| Element | Copy |
|---------|------|
| Page heading | "Your SOPs" |
| Metadata subline (assigned) | "[N] procedure assigned to your role" / "[N] procedures assigned to your role" |
| Category filter pill (all) | "All categories ▾" |
| Category filter pill (active) | "[Category name] ▾" |
| Search placeholder | "Search SOPs…" |
| Search cancel | "Cancel" |
| Empty state heading (no SOPs) | "No SOPs assigned yet" |
| Empty state body (no SOPs) | "Your admin hasn't assigned any SOPs to you yet. Give them a nudge." |
| Empty state heading (no results) | "Nothing matched" |
| Empty state body (no results) | "Try a different search term or check your spelling." |
| Cache download button tooltip | "Download for offline use" |
| Cache success toast | "Saved offline. You're all good even without signal." |
| Cache failed toast | "Couldn't save offline — check your storage space." |
| SOP offline unavailable heading | "You're offline and this SOP isn't downloaded yet." |
| SOP offline unavailable body | "Come back online to access it, or download it while you've got signal." |
| Updated badge | "Updated" |
| Assigned badge | "Assigned" |

### Safety Acknowledgement

| Element | Copy |
|---------|------|
| Gate heading | "Before you start" |
| Gate subheading | "Review the hazards and required PPE for this procedure." |
| Hazards section label | "HAZARDS" |
| PPE section label | "PPE REQUIRED" |
| Emergency section label | "EMERGENCY PROCEDURES" |
| Emergency collapsed | "Tap to view emergency procedures" |
| Acknowledge button (full) | "I've read and understood the hazards — Start Procedure" |
| Acknowledge button (small screens) | "Understood — Start Procedure" |
| Collapsed safety strip | "Safety summary · Tap to review" |

### Walkthrough

| Element | Copy |
|---------|------|
| Counter | "Step [N] of [N]" |
| Progress percentage | "[N]% done" |
| Mark complete button | "Mark step [N] complete" |
| Undo complete button | "Undo — step [N] complete" |
| Finish SOP button | "Finish SOP — all steps done" |
| Previous step button | "Previous" |
| Skip step button | "Skip this step" |
| Exit walkthrough button | "×" (visually only, aria-label: "Exit walkthrough") |
| Start Walkthrough CTA | "Start Walkthrough" |
| Offline start warning | "Download this SOP first to walk through it offline" |
| All steps complete prompt | "All [N] steps done. Tap to finish." |

### Quick Reference

| Element | Copy |
|---------|------|
| Hazards tab | "Hazards" |
| PPE tab | "PPE" |
| Steps tab | "Steps" |
| Emergency tab | "Emergency" |
| Overview tab | "Overview" |
| Notes tab | "Notes" |
| No section content | "No content for this section yet." |

### Admin Assignment

| Element | Copy |
|---------|------|
| Page heading | "Assign SOP" |
| Roles section label | "ASSIGN BY ROLE" |
| Workers section label | "ASSIGN TO INDIVIDUAL WORKERS" |
| Worker search placeholder | "Search workers…" |
| Assign button | "+ Assign" |
| Assigned state label | "Assigned ✓" |
| Remove button | "Remove" |
| Remove confirm | "Remove assignment for [Role/Name]?" |
| Remove confirm action | "Remove" |
| Remove cancel | "Cancel" |
| Assign success toast | "[Role/Name] assigned." |
| Assign error toast | "Couldn't assign — try again" |
| Remove success toast | "Assignment removed." |
| No workers empty state heading | "No workers yet" |
| No workers empty state body | "Invite workers to your organisation first, then assign SOPs to them." |

### Version Management

| Element | Copy |
|---------|------|
| Page heading | "Version History" |
| Upload new version button | "+ Upload New Version" |
| Upload confirmation | "Uploading a new version will replace what workers see — the old version stays linked to any historical completions." |
| Upload confirm action | "Got it, proceed" |
| Current version badge | "Current" |
| Superseded version badge | "Superseded" |
| Version label prefix | "v[N]" |
| Upload date column header | "Uploaded" |
| Uploaded by column header | "By" |
| Version column header | "Version" |
| Status column header | "Status" |
| Review link | "Review →" |

### Error States

| Element | Copy |
|---------|------|
| Network error loading library | "Couldn't load your SOPs — check your connection." |
| Network error loading walkthrough | "Couldn't load this SOP. Try again or use your cached version." |
| Assignment save error | "Couldn't assign — try again" |
| Version upload error | "Upload failed — check your connection and try again." |
| Session expired | "Your session expired. Sign in again to continue." |
| No permission (worker accessing admin) | "You need admin access to do this." |

---

## Layout Decisions

### Walkthrough Layout — No BottomTabBar

The walkthrough uses a dedicated layout file at `src/app/(protected)/sops/[sopId]/walkthrough/layout.tsx` that does NOT render `BottomTabBar`. Rationale: the bottom action bar (C-06) occupies the bottom of screen with 72px+ primary buttons — a BottomTabBar would compete for that space and make the interface unusable with gloves. This is a hard layout constraint from WORK-10 and research recommendation.

**Route layout hierarchy:**
```
app/
  (protected)/
    layout.tsx          ← renders BottomTabBar
    sops/
      page.tsx          ← library (has BottomTabBar)
      [sopId]/
        page.tsx        ← quick reference (has BottomTabBar)
        walkthrough/
          layout.tsx    ← NO BottomTabBar — own layout
          page.tsx      ← walkthrough (custom bottom actions)
```

### Page vs Full-screen

- SOP Library: standard page layout with BottomTabBar — `min-h-screen bg-steel-900 pb-[80px]`
- SOP Detail: standard page layout with sticky tab bar — `h-screen overflow-hidden` with internal scroll
- Walkthrough: full-screen, `h-screen` with `overflow-hidden`, all scrolling within step list only
- Safety Acknowledgement: `fixed inset-0 z-40` overlay on top of walkthrough page

### Responsive Breakpoints

| Breakpoint | Width | Behaviour |
|------------|-------|-----------|
| Default (mobile) | < 768px | Single-column library. No sidebar — category filter as bottom sheet. Full-screen walkthrough. Bottom tab bar visible on library/detail. |
| Tablet | 768px–1023px | Library at `max-w-2xl`. Walkthrough unchanged (still full-screen). Bottom sheet still used for categories. |
| Desktop | 1024px+ (`lg:`) | Category sidebar replaces bottom sheet (`w-[240px]` sticky). Library content at `max-w-4xl`. Walkthrough unchanged (still full-screen, optimised for portrait). Admin assignment + version pages at `max-w-3xl`. |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not required |
| lucide-react | `Search`, `SearchX`, `X`, `ArrowLeft`, `ChevronDown`, `ChevronRight`, `Check`, `CheckCircle`, `CheckCircle2`, `Circle`, `AlertTriangle`, `AlertOctagon`, `ShieldCheck`, `ShieldAlert`, `Siren`, `ListChecks`, `FileText`, `ClipboardList`, `Download`, `Loader`, `WifiOff`, `ZoomIn`, `Users`, `RefreshCw`, `ArrowRight`, `PartyPopper` | not required — icon library only |
| `yet-another-react-lightbox` | `Lightbox` (default), `Zoom` plugin | shadcn view + diff required before use |

`yet-another-react-lightbox` is a third-party package. Before importing, the implementing agent must:
1. Run `npm view yet-another-react-lightbox` to confirm installed version matches `~3.25.x`
2. Review the component source for any unexpected network calls or data exfiltration
3. Import only the `Lightbox` default export and `Zoom` plugin — no other subpath imports

No other third-party UI component registries are used. All interactive components are hand-rolled with Tailwind v4.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
