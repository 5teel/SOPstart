---
phase: 4
slug: completion-and-sign-off
status: draft
shadcn_initialized: false
preset: none
created: 2026-03-26
---

# Phase 4 — UI Design Contract

> Visual and interaction contract for Phase 4: Completion and Sign-off. Covers photo capture in the walkthrough, the Submit Completion flow, the worker's completion history (Activity tab), the supervisor activity feed with filters, completion detail view, and the approve/reject sign-off flow. Generated prior to implementation planning.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (custom Tailwind v4 components) |
| Preset | not applicable |
| Component library | none (hand-rolled, shadcn not initialised) |
| Icon library | lucide-react |
| Font | System font stack (inherited from Phase 1 shell) |
| New packages | `sharp` (server-side reference only — client uses Canvas API for compression) |

---

## Spacing Scale

Inherited from Phase 3. Declared values (must be multiples of 4):

| Token | Value | Tailwind class | Usage |
|-------|-------|----------------|-------|
| xs | 4px | `p-1` / `gap-1` | Icon gaps, badge padding |
| sm | 8px | `p-2` / `gap-2` | Compact element spacing, photo thumbnail gaps |
| md | 16px | `p-4` / `gap-4` | Default element spacing, card padding |
| lg | 24px | `p-6` / `gap-6` | Section padding, card gaps |
| xl | 32px | `p-8` / `gap-8` | Layout column gaps |
| 2xl | 48px | `p-12` / `gap-12` | Major section breaks |
| 3xl | 64px | `p-16` / `gap-16` | Page-level spacing (admin/supervisor pages only) |

Exceptions:
- Tap targets: minimum `h-[72px]` on ALL interactive controls in the walkthrough (camera button, submit button). Hard constraint from WORK-09.
- Photo thumbnail grid: thumbnails are `w-[72px] h-[72px]` — square, touch-safe, not decorative. The add-photo button in the grid matches this size.
- Submit Completion button: `h-[80px]` — elevated above standard 72px to signal finality. Same elevation as the safety acknowledgement button in Phase 3.
- Reject reason textarea: `min-h-[120px]` — enough space for a meaningful sentence on mobile.
- Activity feed filter pills: `h-[40px]` — secondary selection, desktop-adjacent context.
- Completion detail sign-off buttons (Approve / Reject): `h-[72px]` — primary supervisor action, glove-safe.

---

## Typography

Inherited from Phase 3. No new roles introduced.

| Role | Size | Weight | Line Height | Tailwind class |
|------|------|--------|-------------|----------------|
| Page heading (h1) | 24px | 700 | 1.25 | `text-2xl font-bold` |
| Section heading (h2) | 18px | 600 | 1.35 | `text-lg font-semibold` |
| Card title (h3) | 16px | 600 | 1.4 | `text-base font-semibold` |
| Step text (body) | 18px | 400 | 1.65 | `text-lg font-normal leading-relaxed` |
| Activity card metadata | 14px | 500 | 1.4 | `text-sm font-medium` |
| Caption / helper | 12px | 400 | 1.5 | `text-xs font-normal` |
| Status badge | 12px | 600 | 1 | `text-xs font-semibold` |
| Photo count label | 13px | 700 | 1 | `text-[13px] font-bold tabular-nums` |
| Reject reason label | 14px | 600 | 1.4 | `text-sm font-semibold` |

Step text retains `text-lg` (18px) — workers read at arm's length in industrial environments.

---

## Color

Palette sourced from `src/app/globals.css` `@theme` block. Dark mode is the only mode.

| Role | Token / Hex | Tailwind class | Usage |
|------|-------------|----------------|-------|
| Dominant (60%) | `--color-steel-900` #111827 | `bg-steel-900` | Page backgrounds, activity feed background |
| Secondary (30%) | `--color-steel-800` #1f2937 | `bg-steel-800` | Cards, completion history cards, supervisor feed cards |
| Elevated surface | `--color-steel-700` #374151 | `bg-steel-700` | Hover states, photo thumbnail border, filter pill background, textarea background |
| Muted text | `--color-steel-400` #9ca3af | `text-steel-400` | Metadata, timestamps, worker name on cards, reject reason placeholder |
| Light text | `--color-steel-100` #f3f4f6 | `text-steel-100` | Primary body text, SOP titles in activity feed |
| Accent — brand | `--color-brand-yellow` #f59e0b | `text-brand-yellow` / `bg-brand-yellow` | Submit Completion button, active filter pill border, "Approved" status badge |
| Accent — camera | `--color-brand-orange` #ea580c | `text-brand-orange` / `bg-brand-orange` | Camera capture button background, "photo required" step indicator, offline queue dot |
| Status — pending | #f59e0b (brand-yellow) | `bg-brand-yellow/20 text-brand-yellow` | "Pending" completion status badge |
| Status — approved | #22c55e (green-500) | `bg-green-500/20 text-green-400` | "Approved" completion status badge, approve button |
| Status — rejected | #ef4444 (red-500) | `bg-red-500/20 text-red-400` | "Rejected" completion status badge, reject button |
| Photo — queued offline | `--color-brand-orange` #ea580c | `border-brand-orange` | Orange border ring on thumbnails queued but not yet uploaded |
| Photo — uploaded | #22c55e (green-500) | `border-green-500/40` | Subtle green border ring on successfully uploaded thumbnails |
| Destructive | #ef4444 | `text-red-400 hover:text-red-300` | Reject action, remove photo button |

Completion status semantics:
- Yellow (brand-yellow) — pending sign-off (awaiting supervisor)
- Green — approved
- Red — rejected (worker must redo)

Accent (brand-yellow) reserved for: Submit Completion button, active filter pill, "Approved" status badge, offline sync indicator (when queue is clear). The camera button uses brand-orange (not brand-yellow) because it is a safety-evidence action, not a navigation action.

---

## Page Structures

### Page 1 — Walkthrough Page (extended) (`/sops/[sopId]/walkthrough`)

**Purpose:** Extends the Phase 3 walkthrough page. No layout changes. Photo capture UI is added inline within each step row (C-01). A new "Submit Completion" button replaces "Finish SOP — all steps done" as the final primary action when all steps are complete (C-06 extension).

**What changes from Phase 3:**
- `StepItem` receives a camera zone below its text content area (photo-required steps show an orange camera button; non-required steps show a muted camera icon)
- Photo thumbnails appear in the step row once photos are captured
- The walkthrough bottom action bar gains a "Submit Completion" primary button state when `allDone && !submitted`
- A "Photos syncing…" offline indicator appears in the top bar when photos are in the offline queue

**Layout (unchanged from Phase 3 — additions only):**

```
┌──────────────────────────────────────────────┐
│  [✕ Exit]  SOP Title       [⬆ syncing...]   │  ← top bar; sync indicator NEW
├──────────────────────────────────────────────┤
│  ████████████░░░░  progress bar h-2          │
│  "Step 8 of 12"    "66% done"                │
├──────────────────────────────────────────────┤
│  Step 1  ✓  [completed]                      │
│  Step 2  ✓  [completed]  [📷 2 photos]       │  ← photo thumbnail row NEW
│  Step 3  ←  [active]                         │
│    Step text here...                         │
│    ┌─────────────────────────────────────┐   │
│    │ 📷 PHOTO REQUIRED  [Take photo]     │   │  ← photo zone NEW
│    │ [thumb][thumb][+ Add photo]         │   │
│    └─────────────────────────────────────┘   │
│  Step 4     [upcoming]                       │
├──────────────────────────────────────────────┤
│  [  Mark Step 3 Complete  ]  h-[72px]        │  ← disabled if photo required but none taken
│  [← Previous]                [Skip →]       │
└──────────────────────────────────────────────┘
```

When all steps complete:

```
├──────────────────────────────────────────────┤
│  [  Submit Completion  ]  h-[80px]           │  ← replaces "Finish SOP" button
│  [← Previous]                [Skip →]       │
└──────────────────────────────────────────────┘
```

---

### Page 2 — Activity Tab: Worker View (`/activity`)

**Purpose:** Worker sees their own completion history across all SOPs. Newest completions first. Role-aware: workers see only their own completions; supervisors and safety managers see C-09 (Activity Feed). The `/activity` route renders the appropriate view based on the user's role.

**Layout (mobile — default):**

```
┌──────────────────────────────────────────────┐
│  [≡ SOP Assistant]                          │  ← sticky header h-[56px]
├──────────────────────────────────────────────┤
│  "My Completions"  h1                        │
│  "5 completed procedures"                   │  ← metadata
├──────────────────────────────────────────────┤
│  Completion Card (newest first)              │
│  Completion Card                             │
│  Completion Card                             │
│  ...                                         │
├──────────────────────────────────────────────┤
│  BottomTabBar (Activity tab active)          │
└──────────────────────────────────────────────┘
```

- Page wrapper: `flex flex-col min-h-screen bg-steel-900`
- Content area: `px-4 py-6 pb-[80px]` (accounts for BottomTabBar)
- Max content width: `max-w-2xl mx-auto`
- Card list: `flex flex-col gap-3`
- Page heading: `text-2xl font-bold text-steel-100 mb-1`
- Metadata line: `text-sm text-steel-400 mb-4`

---

### Page 3 — Activity Tab: Supervisor / Safety Manager View (`/activity`)

**Purpose:** Supervisor sees completions for all their directly-assigned workers (D-13). Safety Manager sees all completions org-wide (D-14). Newest first. Filter row for grouping by SOP or by worker (D-09).

**Layout (mobile — default):**

```
┌──────────────────────────────────────────────┐
│  [≡ SOP Assistant]                          │  ← sticky header h-[56px]
├──────────────────────────────────────────────┤
│  "Activity"  h1                              │
│  "14 completions awaiting review"            │  ← metadata, pending count
├──────────────────────────────────────────────┤
│  [All][By SOP][By Worker]  filter pills      │  ← h-[40px] pills
├──────────────────────────────────────────────┤
│  Completion Summary Card (C-08)             │
│  Completion Summary Card                    │
│  Completion Summary Card                    │
│  ...                                         │
├──────────────────────────────────────────────┤
│  BottomTabBar (Activity tab active)          │
└──────────────────────────────────────────────┘
```

**Layout (desktop lg+):**

```
┌──────────────────────────┬───────────────────┐
│  Filter sidebar          │  "Activity"        │
│  ─────────────           │  ─────────────     │
│  By SOP                  │  Completion Card   │
│  [SOP name filter]       │  Completion Card   │
│  ─────────────           │  Completion Card   │
│  By Worker               │  ...               │
│  [Worker name filter]    │                    │
└──────────────────────────┴───────────────────┘
```

- Page wrapper: `flex flex-col min-h-screen bg-steel-900`
- Content area: `px-4 py-6 pb-[80px]` (mobile), `flex gap-8 px-8 py-8` (lg:)
- Filter sidebar (lg+): `w-[220px] flex-shrink-0`
- Feed column (lg+): `flex-1 max-w-3xl flex flex-col gap-3`
- Max content width (mobile): `max-w-2xl mx-auto`
- Filter pill row: `flex items-center gap-2 mb-4 overflow-x-auto scrollbar-none`

---

### Page 4 — Completion Detail View (`/activity/[completionId]`)

**Purpose:** Full detail view of a single completion. Shows step-by-step what the worker did, their photos per step, timestamps, and the supervisor approve/reject action area. Used by supervisors (and safety managers) after tapping a summary card. Workers can also reach this page from their own history to see the outcome.

**Layout:**

```
┌──────────────────────────────────────────────┐
│  [← Activity]  "Completion Detail"           │  ← sticky header h-[56px]
├──────────────────────────────────────────────┤
│  Completion Summary Banner (C-10)            │  ← SOP title, worker, date, status
├──────────────────────────────────────────────┤
│  Step-by-step detail list (C-11)             │
│  ┌────────────────────────────────────────┐  │
│  │ Step 1  ✓  Completed 09:14             │  │
│  │ [📷 photo thumb] [📷 photo thumb]      │  │
│  └────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────┐  │
│  │ Step 2  ✓  Completed 09:17             │  │
│  └────────────────────────────────────────┘  │
│  ...                                         │
├──────────────────────────────────────────────┤
│  Sign-off area (supervisor only, C-12)       │
│  [  Approve  ]  [  Reject  ]  h-[72px] each │
└──────────────────────────────────────────────┘
```

- Page wrapper: `flex flex-col min-h-screen bg-steel-900`
- Sticky header: `sticky top-0 z-20 bg-steel-900 border-b border-steel-700 px-4 flex items-center gap-3 h-[56px]`
- Scrollable content: `flex-1 overflow-y-auto px-4 py-6 pb-[160px]` (bottom padding for fixed sign-off bar)
- Sign-off bar: `fixed bottom-0 left-0 right-0 z-30 bg-steel-900 border-t border-steel-700 px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))]`
- Max content width: `max-w-2xl mx-auto`

**Reject Reason Sheet (within same page — not a separate route):**

When supervisor taps "Reject", an inline sheet slides up from the bottom (no modal — same DOM):

```
┌──────────────────────────────────────────────┐
│  bg-steel-800 rounded-t-2xl pt-4 pb-safe     │
│  drag handle: w-10 h-1 bg-steel-600 mx-auto  │
│  "Reject completion"  text-lg font-semibold  │
│  "Worker will be notified to redo this SOP." │
│  ─────────────────────────────────────────── │
│  "Reason for rejection"  label               │
│  [textarea  min-h-[120px]]                   │
│  "Be specific — the worker will see this."   │
│  ─────────────────────────────────────────── │
│  [  Confirm Rejection  ]  h-[72px]           │
│  [Cancel]  text link                         │
└──────────────────────────────────────────────┘
```

Sheet appears as a fixed overlay over the page content: `fixed inset-x-0 bottom-0 z-50 bg-steel-800 rounded-t-2xl`

---

## Components

### C-01: StepItem Photo Zone (extends Phase 3 C-03)

**File:** `src/components/sop/StepItem.tsx` (extended)

**Purpose:** Adds photo capture capability to each step row. Conditionally rendered based on `step.photo_required` (boolean) and `photos.length`. Workers can attach multiple photos per step. Photos queue locally in IndexedDB and auto-upload on reconnect.

**Photo zone renders below the step text in the centre content column, `mt-3`:**

**State A — photo required, no photos taken:**
```
flex items-center gap-3 px-3 py-3
bg-brand-orange/10 border border-brand-orange/40
rounded-xl mt-3
```
- Left: lucide `Camera` `size={18} text-brand-orange`
- Text: `"Photo required"` `text-sm font-semibold text-brand-orange`
- Right: `[Take photo]` button:
  ```
  h-[72px] px-4 bg-brand-orange text-white font-semibold text-sm rounded-lg
  hover:bg-orange-500 active:bg-orange-700 flex items-center gap-2
  transition-colors ml-auto flex-shrink-0
  ```
  Icon: lucide `Camera` `size={16}` Leading

**State B — photo required, photos taken:**
```
mt-3 flex flex-col gap-2
```
- Label row: `flex items-center gap-2`
  - lucide `Camera` `size={14} text-brand-orange`
  - `"Photo required"` `text-xs font-semibold text-brand-orange`
  - `"· {N} attached"` `text-xs text-steel-400`
- Photo thumbnail grid: `flex items-center gap-2 flex-wrap`
  - Each thumbnail: `w-[72px] h-[72px] rounded-lg object-cover border-2`
    - Uploaded: `border-green-500/40`
    - Queued offline: `border-brand-orange` with orange dot overlay (C-02)
  - Add more button: `w-[72px] h-[72px] rounded-lg border-2 border-dashed border-steel-600 flex items-center justify-center bg-steel-800 hover:border-steel-500 hover:bg-steel-700 transition-colors`
    - lucide `Plus` `size={20} text-steel-400`

**State C — photo optional (photo_required = false), no photos:**
```
mt-3
```
- A single ghost button (no container card):
  ```
  flex items-center gap-2 text-xs text-steel-400 hover:text-steel-100
  transition-colors cursor-pointer h-[44px] -ml-1 px-1
  ```
  - lucide `Camera` `size={14}`
  - `"Add photo (optional)"`

**State D — photo optional, photos taken:**
- Same thumbnail grid as State B but without the orange "Photo required" label
- Label: lucide `Camera` `size={14} text-steel-400` + `"Photos"` `text-xs text-steel-400` + `"· {N} attached"` `text-xs text-steel-400`

**Camera input (hidden, triggered programmatically):**
```html
<input
  type="file"
  accept="image/*"
  capture="environment"
  multiple
  className="sr-only"
  ref={cameraInputRef}
  onChange={handlePhotoCapture}
/>
```

**"Mark Complete" button — disabled state when photo required but none taken:**
- The bottom action bar primary button gains `disabled` + `opacity-50 cursor-not-allowed` when the current active step has `photo_required = true` and zero photos attached
- Tooltip / sub-label below button: `"Take the required photo before marking complete"` `text-xs text-steel-400 text-center mt-1`

---

### C-02: Photo Upload Status Overlay

**File:** `src/components/sop/PhotoThumbnail.tsx`

**Purpose:** A small status indicator overlaid on each photo thumbnail showing its upload state.

**Container:**
```
relative w-[72px] h-[72px] flex-shrink-0
```

**Image:**
```
w-full h-full rounded-lg object-cover border-2
```

**Queued (offline) — orange dot overlay:**
```
absolute top-1 right-1
w-3 h-3 rounded-full bg-brand-orange
border border-steel-900
```

**Uploading — spinner overlay:**
```
absolute inset-0 rounded-lg bg-steel-900/60 flex items-center justify-center
```
- Spinner: `w-5 h-5 rounded-full border-2 border-steel-700 border-t-brand-yellow animate-spin`

**Uploaded — green dot:**
```
absolute top-1 right-1
w-3 h-3 rounded-full bg-green-500
border border-steel-900
```

**Remove button (tap-hold or tap on mobile):**
```
absolute top-1 left-1
w-5 h-5 rounded-full bg-steel-900/80 flex items-center justify-center
```
- lucide `X` `size={10} text-steel-100`

---

### C-03: Offline Photo Queue Indicator

**File:** Part of walkthrough top bar

**Purpose:** Visible in the walkthrough top bar when one or more photos are queued locally and not yet uploaded (D-07 / D-08). Disappears when queue is empty.

**Placement:** Right side of the walkthrough top bar, replacing the `{completedCount}/{totalSteps}` counter when offline queue is non-empty. The counter moves left and the sync indicator appears right.

**Appearance:**
```
flex items-center gap-1.5 px-2.5 py-1
bg-brand-orange/15 border border-brand-orange/40
rounded-full text-brand-orange text-xs font-semibold
```
- lucide `CloudUpload` `size={12}` (animated: `animate-pulse` when queue has items, static when syncing)
- `"{N} photo{s} queued"` — pluralised
- When actively uploading: `"Uploading…"` with spinner replacing the cloud icon

**Online + queue empty (all uploaded):**
```
flex items-center gap-1 text-green-400 text-xs font-semibold
```
- lucide `CheckCircle2` `size={12}`
- `"Synced"` — shown for 3 seconds then fades out

---

### C-04: Submit Completion Button State

**File:** Part of `src/app/(protected)/sops/[sopId]/walkthrough/page.tsx`

**Purpose:** Replaces the "Finish SOP — all steps done" button from Phase 3 when all steps are complete. This is the final action that creates the immutable completion record (D-01, COMP-01).

**Condition:** Renders when `allDone === true` and `isSubmitted === false`.

**Button:**
```
w-full h-[80px] rounded-xl font-bold text-lg
bg-brand-yellow text-steel-900
hover:bg-amber-400 active:bg-amber-500
transition-all flex items-center justify-center gap-3
```
- Leading icon: lucide `ClipboardCheck` `size={24}`
- Copy: `"Submit Completion"`

**Sub-label below button:**
```
text-xs text-steel-400 text-center mt-2
```
Copy: `"Records your sign-off with a timestamp and all photos"`

**Loading state (after tap, while server action runs):**
- Button: `bg-brand-yellow/60 cursor-not-allowed`
- Icon replaced with spinner: `w-5 h-5 rounded-full border-2 border-steel-900/30 border-t-steel-900 animate-spin`
- Copy: `"Submitting…"`

**Photos-still-uploading guard:** If offline photo queue is non-empty when worker taps Submit, a warning strip appears above the button:
```
flex items-center gap-2 px-3 py-2
bg-brand-orange/15 border border-brand-orange/40 rounded-lg
text-brand-orange text-xs font-semibold mb-2
```
- lucide `CloudUpload` `size={14}`
- Copy: `"Photos still uploading — you can submit now and they'll sync automatically."`
- Button remains enabled — worker can submit; photos sync independently

**Submitted state (success):**
Replaces the entire bottom action area with:
```
flex flex-col items-center gap-2 py-4 px-4
```
- lucide `CheckCircle2` `size={32} text-green-400`
- Heading: `"Completion submitted"` `text-lg font-bold text-steel-100`
- Sub-copy: `"Your supervisor has been notified."` `text-sm text-steel-400`
- Link: `"← Back to SOP"` `text-sm text-brand-yellow hover:text-amber-400 mt-1`

---

### C-05: Completion History Card (Worker View)

**File:** `src/components/activity/CompletionHistoryCard.tsx`

**Purpose:** Worker's view of one past completion in their Activity tab. Shows SOP, date, photo count, and outcome status.

**Base:**
```
flex items-start gap-4 p-4 bg-steel-800 rounded-xl
hover:bg-steel-700 active:bg-steel-600
transition-colors cursor-pointer min-h-[88px]
border border-transparent hover:border-steel-600
```

**Left column (`flex-shrink-0`):**
- Status icon with colour matching completion status:
  - Pending: lucide `Clock` `size={28}` in `text-brand-yellow` inside `w-10 h-10 rounded-full bg-brand-yellow/15 flex items-center justify-center`
  - Approved: lucide `CheckCircle2` `size={28}` in `text-green-400` inside `w-10 h-10 rounded-full bg-green-500/15 flex items-center justify-center`
  - Rejected: lucide `XCircle` `size={28}` in `text-red-400` inside `w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center`

**Centre column (`flex-1 min-w-0`):**
- SOP title: `text-base font-semibold text-steel-100 leading-snug truncate`
- Date + time: `text-xs text-steel-400 mt-0.5 tabular-nums`
  - Format: `"25 Mar 2026 · 09:14"` (NZ date format — day first, 24h time)
- Badge row: `flex items-center gap-2 mt-2 flex-wrap`
  - Status badge (C-13 extended)
  - Photo count chip (if photos exist): `inline-flex items-center gap-1 px-2 py-0.5 bg-steel-700 text-steel-400 text-xs font-medium rounded`
    - lucide `Camera` `size={10}`
    - `"{N} photo{s}"`
  - Rejection reason preview (rejected only): `text-xs text-red-400 mt-1 line-clamp-2` — shows supervisor's reason text

**Right column (`flex-shrink-0 self-center`):**
- lucide `ChevronRight` `size={18} text-steel-400`

---

### C-06: Activity Filter Pills (Supervisor View)

**File:** `src/components/activity/ActivityFilter.tsx`

**Purpose:** Mobile-first filter strip above the supervisor's activity feed. Three states: "All", "By SOP", "By Worker" (D-09). Tapping "By SOP" or "By Worker" reveals a secondary select for choosing a specific SOP or worker.

**Filter pill container:**
```
flex items-center gap-2 overflow-x-auto scrollbar-none mb-4
```

**Each filter pill (inactive):**
```
flex items-center gap-1.5 h-[40px] px-4
bg-steel-800 border border-steel-700
rounded-full text-sm font-medium text-steel-400
hover:border-steel-500 hover:text-steel-100
transition-colors cursor-pointer flex-shrink-0
```

**Active filter pill:**
```
bg-brand-yellow/15 border border-brand-yellow
text-brand-yellow
```

**Secondary filter row (shown when "By SOP" or "By Worker" is active):**
```
flex items-center gap-2 mt-2 mb-2
```
- Select element (or custom dropdown):
  ```
  h-[48px] px-4 bg-steel-800 border border-steel-700
  rounded-xl text-sm text-steel-100
  focus:outline-none focus:border-brand-yellow
  appearance-none w-full max-w-[280px]
  ```
  - "All SOPs" / "All workers" as the default option
  - Options populated from completions in the feed

**Desktop sidebar (lg+):**
```
w-[220px] flex-shrink-0 flex flex-col gap-4
```
- Section heading: `text-xs font-semibold text-steel-400 uppercase tracking-widest mb-2`
- Filter items render as vertical list instead of horizontal pills, each `h-[44px]`

---

### C-07: Completion Summary Card (Supervisor Feed)

**File:** `src/components/activity/CompletionSummaryCard.tsx`

**Purpose:** Supervisor view of one completion in the activity feed. More information than the worker card — shows worker name, SOP, date, photo count, and sign-off status. Tapping opens the completion detail page (D-10).

**Base:**
```
flex items-start gap-4 p-4 bg-steel-800 rounded-xl
hover:bg-steel-700 active:bg-steel-600
transition-colors cursor-pointer min-h-[100px]
border border-transparent hover:border-steel-600
```

**Pending sign-off variant** adds a left accent:
```
border-l-4 border-brand-yellow
```

**Left column (`flex-shrink-0`):**
- Worker avatar initials (two letters, derived from worker's display name):
  ```
  w-10 h-10 rounded-full bg-steel-700
  flex items-center justify-center
  text-sm font-bold text-steel-100 flex-shrink-0
  ```
  (No real avatar images in v1 — initials only)

**Centre column (`flex-1 min-w-0`):**
- Top row: `flex items-start justify-between gap-2`
  - Worker name: `text-sm font-semibold text-steel-100`
  - Status badge (C-13): right-aligned, `flex-shrink-0`
- SOP title: `text-base font-semibold text-steel-100 leading-snug truncate mt-0.5`
- Metadata row: `flex items-center gap-3 mt-1.5 flex-wrap`
  - Date + time: `text-xs text-steel-400 tabular-nums`
  - Divider: `text-steel-700 select-none`
  - Photo count: `inline-flex items-center gap-1 text-xs text-steel-400`
    - lucide `Camera` `size={10}`
    - `"{N} photo{s}"`
  - (If pending only) SOP version: `text-xs text-steel-400 font-mono` e.g. `"v3"`

**Right column (`flex-shrink-0 self-center`):**
- lucide `ChevronRight` `size={18} text-steel-400`

---

### C-08: Completion Summary Banner (Detail Page Header)

**File:** Part of `src/app/(protected)/activity/[completionId]/page.tsx`

**Purpose:** At the top of the detail view, summarises who completed what and when. Not sticky — scrolls with content.

**Container:**
```
bg-steel-800 rounded-xl p-5 mb-6 border border-steel-700
```

**Content:**
```
flex flex-col gap-3
```

Row 1 — SOP info:
- SOP title: `text-lg font-semibold text-steel-100`
- SOP version: `text-xs text-steel-400 font-mono ml-1` (e.g. `"v3"`)
- Status badge (C-13): right side of row — `flex items-center justify-between`

Row 2 — Worker + timing:
```
flex items-center gap-3 flex-wrap
```
- Worker avatar initials (same as C-07 `w-8 h-8`)
- Worker name: `text-sm font-medium text-steel-100`
- Date + time: `text-xs text-steel-400 tabular-nums`
- (If rejected) Rejection reason callout below:
  ```
  bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mt-1
  ```
  - Label: `text-xs font-semibold text-red-400 uppercase tracking-wide mb-1` — `"Rejected — reason:"`
  - Reason text: `text-sm text-steel-100 leading-relaxed`

Row 3 — Photo count summary (if any photos):
```
flex items-center gap-2 text-xs text-steel-400
```
- lucide `Camera` `size={12}`
- `"{total} photo{s} attached across {N} step{s}"`

---

### C-09: Step Detail Row (Completion Detail View)

**File:** `src/components/activity/CompletionStepRow.tsx`

**Purpose:** Read-only display of a single step in the completion detail view. Shows step text, completion timestamp, and any photos attached to that step. Not interactive — no tap targets, just evidence review.

**Container:**
```
flex flex-col gap-3 py-5 border-b border-steel-700 last:border-b-0
```

**Header row:**
```
flex items-start gap-3
```
- Step number: `w-6 h-6 rounded-full bg-steel-700 flex items-center justify-center text-[13px] font-bold tabular-nums text-steel-400 flex-shrink-0`
- Step completion state (always completed in a submitted record):
  - lucide `CheckCircle2` `size={20} text-green-400`
- Step timestamp: `text-xs text-steel-400 tabular-nums ml-auto flex-shrink-0` — `"09:14"` (24h time, relative to completion date)

**Step text:**
```
text-base text-steel-100 leading-relaxed ml-9
```
(Indented to align with step content, past the number column)

**Photos grid (if photos attached to this step):**
```
flex items-center gap-2 flex-wrap ml-9 mt-1
```
- Each photo thumbnail:
  ```
  w-[80px] h-[80px] rounded-lg object-cover border border-steel-700
  cursor-pointer hover:border-steel-500 transition-colors
  ```
  Tapping a thumbnail opens the photo full-screen via the existing lightbox pattern from Phase 3 (`yet-another-react-lightbox`)

**No photos attached to step:**
- Nothing rendered — only steps with actual photos show the grid. Steps without photos show step text + timestamp only.

---

### C-10: Sign-off Action Bar (Supervisor Only)

**File:** Part of `src/app/(protected)/activity/[completionId]/page.tsx`

**Purpose:** Fixed bottom bar on the detail page showing Approve and Reject buttons. Visible only to supervisors and safety managers. Hidden for workers viewing their own history. Hidden once a sign-off record exists (completion is already approved or rejected — app-enforced immutability D-15).

**Already signed off state:** Bottom bar is replaced with a read-only sign-off record strip:
```
flex items-center gap-3 px-4 py-4 bg-steel-800 border-t border-steel-700
```
- Approved: lucide `CheckCircle2` `size={20} text-green-400` + `"Approved by {supervisor name} · {date}"` `text-sm text-steel-400`
- Rejected: lucide `XCircle` `size={20} text-red-400` + `"Rejected by {supervisor name} · {date}"` `text-sm text-steel-400`

**Pending sign-off — action bar:**
```
fixed bottom-0 left-0 right-0 z-30
bg-steel-900 border-t border-steel-700
px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))]
flex items-center gap-3
```

**Approve button:**
```
flex-1 h-[72px] bg-green-500 text-white font-bold text-lg rounded-xl
hover:bg-green-400 active:bg-green-600 transition-colors
flex items-center justify-center gap-2
```
- Leading icon: lucide `Check` `size={22}`
- Copy: `"Approve"`

**Reject button:**
```
flex-1 h-[72px] bg-steel-800 text-red-400 font-bold text-lg rounded-xl
border border-red-500/40
hover:bg-red-500/10 active:bg-red-500/20 transition-colors
flex items-center justify-center gap-2
```
- Leading icon: lucide `X` `size={22}`
- Copy: `"Reject"`

---

### C-11: Reject Reason Sheet

**File:** `src/components/activity/RejectReasonSheet.tsx`

**Purpose:** Slides up from the bottom of the detail page when the supervisor taps "Reject". Mandatory reason entry before confirming (D-12). The sheet sits over the page content without routing to a new page.

**Backdrop:**
```
fixed inset-0 z-40 bg-steel-900/60 backdrop-blur-sm
```
Tapping the backdrop dismisses the sheet (same as Cancel).

**Sheet container:**
```
fixed inset-x-0 bottom-0 z-50
bg-steel-800 rounded-t-2xl
pt-4 pb-[calc(16px+env(safe-area-inset-bottom,0px))]
px-4
flex flex-col gap-4
```

**Drag handle:**
```
w-10 h-1 bg-steel-600 rounded-full mx-auto mb-2
```

**Sheet heading:** `"Reject completion"` — `text-lg font-semibold text-steel-100`

**Sub-copy:** `"The worker will be notified and asked to redo this SOP."` — `text-sm text-steel-400`

**Divider:** `border-t border-steel-700`

**Reason label:** `"Reason for rejection"` — `text-sm font-semibold text-steel-100`

**Reason helper:** `"Be specific — the worker will see this message."` — `text-xs text-steel-400 mt-0.5 mb-2`

**Textarea:**
```
w-full bg-steel-900 border border-steel-700
rounded-xl text-base text-steel-100 leading-relaxed p-3
resize-none min-h-[120px]
focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50
placeholder:text-steel-400
```
Placeholder: `"e.g. PPE photo shows gloves were not worn. Redo step 3 with correct PPE."`

**Character count (below textarea):**
```
text-xs text-steel-400 text-right
```
Format: `"{N} characters"` — helper copy, no hard limit enforced, but `[Confirm Rejection]` requires at least 10 characters

**Confirm Rejection button:**
```
w-full h-[72px] rounded-xl font-bold text-lg
bg-red-500 text-white
hover:bg-red-400 active:bg-red-600 transition-colors
flex items-center justify-center gap-2
```
- Leading icon: lucide `X` `size={22}`
- Copy: `"Confirm Rejection"`
- Disabled (`opacity-50 cursor-not-allowed`) when textarea has fewer than 10 characters

**Cancel:**
```
text-sm text-steel-400 hover:text-steel-100
text-center mt-1 py-2 cursor-pointer
```
Copy: `"Cancel"`

---

### C-12: Completion Status Badge (extended from Phase 2 C-06)

**File:** `src/components/admin/StatusBadge.tsx` (extended)

**Purpose:** Extends the existing `StatusBadge` to support completion-specific states: `pending_sign_off`, `approved`, `rejected`. The existing variant map is extended without breaking Phase 2 and Phase 3 usage.

**New variants added to `variantMap`:**

| Status key | Classes | Display label |
|------------|---------|---------------|
| `pending_sign_off` | `bg-brand-yellow/20 text-brand-yellow` | `"Pending review"` |
| `approved` | `bg-green-500/20 text-green-400` | `"Approved"` |
| `rejected` | `bg-red-500/20 text-red-400` | `"Rejected"` |

Prefix icon added for completion statuses (rendered inside the badge span):
- `pending_sign_off`: lucide `Clock` `size={10}` — `className="mr-0.5"`
- `approved`: lucide `Check` `size={10}` — `className="mr-0.5"`
- `rejected`: lucide `X` `size={10}` — `className="mr-0.5"`

Base badge styles unchanged from Phase 2: `inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold`

---

### C-13: Empty States

**Activity tab — worker (no completions yet):**
```
flex flex-col items-center justify-center py-16 px-4 text-center gap-4
```
- lucide `ClipboardList` `size={48} text-steel-600`
- Heading: `"No completions yet"` — `text-xl font-semibold text-steel-100`
- Body: `"Complete an SOP walkthrough and it'll appear here."` — `text-sm text-steel-400`
- CTA link to `/sops`: `"Browse SOPs"` — `text-brand-yellow text-sm font-medium hover:text-amber-400`

**Activity tab — supervisor (no completions in their team):**
```
(same container as above)
```
- lucide `Users` `size={48} text-steel-600`
- Heading: `"No completions yet"`
- Body: `"Completions from your team members will appear here once they complete an SOP."` — `text-sm text-steel-400`

**Activity tab — supervisor filter active, no results:**
- lucide `Filter` `size={40} text-steel-600`
- Heading: `"No completions match this filter"`
- Body: `"Try selecting a different SOP or worker."` — `text-sm text-steel-400`
- `[Clear filter]` link: `text-brand-yellow text-sm hover:text-amber-400`

---

## Interactions

### I-01: Photo Capture Flow

1. Worker arrives at a step with `photo_required = true`
2. Orange "Photo required" zone is visible below step text (C-01 State A)
3. Worker taps `[Take photo]` — this triggers the hidden `<input type="file" accept="image/*" capture="environment" multiple>` via `cameraInputRef.current?.click()`
4. iOS: native camera launches. Android: camera or gallery chooser appears
5. Worker captures/selects one or more photos
6. `onChange` fires — for each file:
   a. File is read into Canvas, resized to ~200KB target via `canvas.toBlob()` with quality reduction
   b. Compressed blob is written to Dexie `photoQueue` table with `{ stepId, completionId: null, localId, status: 'queued', blob }`
   c. Thumbnail URL created via `URL.createObjectURL(compressedBlob)` — shown immediately
   d. Status dot: orange (C-02 queued state)
7. Online: sync engine detects new queue entries, uploads to Supabase Storage via presigned URL, updates `photoQueue` record to `status: 'uploaded'` — thumbnail dot turns green
8. Offline: photos remain queued (orange dot), sync fires on reconnect

### I-02: Step Completion Block (photo required)

1. Worker taps `[Mark step N complete]` for a step with `photo_required = true` and zero photos
2. Button does nothing (disabled). The photo zone pulses once (`animate-pulse` for 800ms via class add/remove) to draw attention
3. Sub-label appears: `"Take the required photo before marking complete"`
4. Worker takes photo → button becomes enabled (orange dot acceptable — upload doesn't need to complete before marking the step)

### I-03: Submit Completion

1. All steps complete → "Submit Completion" button appears (C-04)
2. Worker optionally reviews the photos in the summary strip (future scroll back up shows thumbnails on each step)
3. Worker taps `[Submit Completion]`
4. If offline photo queue is non-empty: warning strip appears above button. Worker can still submit.
5. Button enters loading state: `"Submitting…"` with spinner
6. Server action fires:
   a. Creates `completions` record: `{ sop_id, sop_version_id, content_hash, worker_id, submitted_at: server timestamp, status: 'pending_sign_off' }`
   b. Dexie walkthrough state for this SOP is cleared (fresh state for next run)
   c. Pending photo queue entries have their `completionId` updated to the new completion ID
7. Success: bottom action area transitions to success state (C-04 submitted state)
8. Photos continue syncing in background if not yet uploaded
9. Error: toast: `"Submit failed — check your connection and try again."` Button re-enables

### I-04: Supervisor Approve

1. Supervisor taps `[Approve]` in the sign-off bar (C-10)
2. Button enters loading state (spinner)
3. Server action creates `completion_reviews` record: `{ completion_id, reviewer_id, action: 'approved', reviewed_at: server timestamp }`. Does NOT mutate the original `completions` row.
4. Success: sign-off bar replaces both buttons with the signed-off strip (`"Approved by {name} · {date}"`)
5. Status badge on the summary banner updates to `"Approved"` (green)
6. Worker's notification queue receives a record for this rejection — polled by `useNotifications`

### I-05: Supervisor Reject

1. Supervisor taps `[Reject]` in the sign-off bar (C-10)
2. Reject Reason Sheet slides up (C-11) — backdrop fades in
3. Supervisor types reason. `[Confirm Rejection]` enables after 10+ characters
4. Supervisor taps `[Confirm Rejection]`
5. Button enters loading state
6. Server action creates `completion_reviews` record: `{ completion_id, reviewer_id, action: 'rejected', reason: reasonText, reviewed_at: server timestamp }`
7. Sheet dismisses. Sign-off bar shows rejection strip: `"Rejected by {name} · {date}"`
8. Status badge updates to `"Rejected"` (red)
9. Rejection reason text appears in the summary banner (C-08) red callout
10. Worker receives notification — their Activity tab shows the rejection reason on the completion history card

### I-06: Worker Sees Rejection

1. Worker opens Activity tab — their completion card shows `"Rejected"` status badge
2. Rejection reason preview (line-clamp-2) visible on the card
3. Worker taps card → completion detail view
4. Summary banner shows the full rejection reason in red callout
5. No "redo" button — the worker re-runs the SOP normally by starting a new walkthrough from the SOP detail page. Each walkthrough creates a fresh completion record (D-03).

### I-07: Activity Feed Filtering

1. Supervisor taps `[By SOP]` filter pill
2. Pill activates (`border-brand-yellow text-brand-yellow` style)
3. Secondary row slides down with a `<select>` populated with all SOPs that have completions
4. Supervisor selects a SOP → feed filters to show only completions for that SOP, newest first
5. Supervisor taps `[All]` → secondary row disappears, feed shows all completions

### I-08: Photo Lightbox (Detail View)

1. Supervisor taps a photo thumbnail in the step detail row (C-09)
2. `yet-another-react-lightbox` opens (already a project dependency from Phase 3)
3. All photos for that step are loaded into the lightbox as a swipeable gallery
4. Supervisor can swipe between photos or close with `[✕]` or tap-outside
5. No download, no delete — read-only evidence review

---

## Copywriting Contract

### Walkthrough (Worker)

| Element | Copy |
|---------|------|
| Photo required zone heading | `"Photo required"` |
| Photo required CTA | `"Take photo"` |
| Photo optional CTA | `"Add photo (optional)"` |
| Photo attached label | `"{N} photo{s} attached"` |
| Photos queued offline | `"{N} photo{s} queued"` |
| Photos syncing | `"Uploading…"` |
| Photos synced (brief) | `"Synced"` |
| Mark complete blocked — photo required | `"Take the required photo before marking complete"` |
| Submit Completion button | `"Submit Completion"` |
| Submit sub-label | `"Records your sign-off with a timestamp and all photos"` |
| Submit loading | `"Submitting…"` |
| Photos still uploading (warning) | `"Photos still uploading — you can submit now and they'll sync automatically."` |
| Submitted heading | `"Completion submitted"` |
| Submitted sub-copy | `"Your supervisor has been notified."` |
| Submitted back link | `"← Back to SOP"` |

### Worker Activity Tab

| Element | Copy |
|---------|------|
| Page heading | `"My Completions"` |
| Metadata (with completions) | `"{N} completed procedure{s}"` |
| Rejection card label | `"Rejected — see reason"` |
| Empty state heading | `"No completions yet"` |
| Empty state body | `"Complete an SOP walkthrough and it'll appear here."` |
| Empty state CTA | `"Browse SOPs"` |

### Supervisor Activity Tab

| Element | Copy |
|---------|------|
| Page heading | `"Activity"` |
| Metadata (with pending) | `"{N} completion{s} awaiting review"` |
| Metadata (all reviewed) | `"{N} completion{s} this week"` |
| Filter: all | `"All"` |
| Filter: by SOP | `"By SOP"` |
| Filter: by worker | `"By Worker"` |
| SOP filter placeholder | `"All SOPs"` |
| Worker filter placeholder | `"All workers"` |
| Empty state heading | `"No completions yet"` |
| Empty state body (no team completions) | `"Completions from your team members will appear here once they complete an SOP."` |
| Empty state heading (filter active) | `"No completions match this filter"` |
| Empty state body (filter active) | `"Try selecting a different SOP or worker."` |
| Empty state CTA (filter active) | `"Clear filter"` |

### Completion Detail

| Element | Copy |
|---------|------|
| Page heading | `"Completion Detail"` |
| Back link | `"← Activity"` |
| Photo summary | `"{total} photo{s} attached across {N} step{s}"` |
| Signed off — approved | `"Approved by {name} · {date}"` |
| Signed off — rejected | `"Rejected by {name} · {date}"` |
| Approve button | `"Approve"` |
| Reject button | `"Reject"` |

### Reject Sheet

| Element | Copy |
|---------|------|
| Sheet heading | `"Reject completion"` |
| Sheet sub-copy | `"The worker will be notified and asked to redo this SOP."` |
| Reason label | `"Reason for rejection"` |
| Reason helper | `"Be specific — the worker will see this message."` |
| Reason placeholder | `"e.g. PPE photo shows gloves were not worn. Redo step 3 with correct PPE."` |
| Confirm button | `"Confirm Rejection"` |
| Cancel link | `"Cancel"` |

### Error States

| Element | Copy |
|---------|------|
| Submit failed | `"Submit failed — check your connection and try again."` |
| Approve failed | `"Couldn't approve — check your connection and try again."` |
| Reject failed | `"Couldn't submit rejection — check your connection and try again."` |
| Photo capture failed | `"Couldn't access the camera. Check app permissions and try again."` |
| Photo compress failed | `"Couldn't process that photo. Try a different one."` |
| Completion not found | `"This completion record wasn't found."` with back link `"← Back to Activity"` |

---

## Responsive Breakpoints

| Breakpoint | Width | Behaviour |
|------------|-------|-----------|
| Default (mobile) | < 768px | Single column. Activity feed: full-width cards. Filter pills: horizontal scroll. Detail view: stacked sections. Sign-off bar: full-width buttons. |
| Tablet | 768px–1023px (`md:`) | Activity feed caps at `max-w-2xl`. Detail view: same as mobile. Filter pills: no scroll needed (all visible). |
| Desktop | 1024px+ (`lg:`) | Activity feed switches to sidebar + feed layout. Filter sidebar replaces filter pills. Detail view: `max-w-2xl mx-auto` centred. |

---

## Route Map

| Route | Role access | Purpose |
|-------|-------------|---------|
| `/sops/[sopId]/walkthrough` | Worker | Walkthrough page (extended with photo capture + submit) |
| `/activity` | All roles | Role-aware: worker → completion history, supervisor / safety_manager → activity feed |
| `/activity/[completionId]` | All roles | Completion detail. Sign-off bar visible to supervisor / safety_manager only. |

---

## Component File Map

| Component | File |
|-----------|------|
| StepItem (extended) | `src/components/sop/StepItem.tsx` |
| PhotoThumbnail | `src/components/sop/PhotoThumbnail.tsx` |
| Offline queue indicator | Inline in `src/app/(protected)/sops/[sopId]/walkthrough/page.tsx` |
| Submit Completion button state | Inline in `src/app/(protected)/sops/[sopId]/walkthrough/page.tsx` |
| CompletionHistoryCard | `src/components/activity/CompletionHistoryCard.tsx` |
| ActivityFilter | `src/components/activity/ActivityFilter.tsx` |
| CompletionSummaryCard | `src/components/activity/CompletionSummaryCard.tsx` |
| CompletionSummaryBanner | Inline in `src/app/(protected)/activity/[completionId]/page.tsx` |
| CompletionStepRow | `src/components/activity/CompletionStepRow.tsx` |
| RejectReasonSheet | `src/components/activity/RejectReasonSheet.tsx` |
| StatusBadge (extended) | `src/components/admin/StatusBadge.tsx` |
| Activity page (worker view) | `src/app/(protected)/activity/page.tsx` |
| Activity page (supervisor view) | `src/app/(protected)/activity/page.tsx` (role-branched) |
| Completion detail page | `src/app/(protected)/activity/[completionId]/page.tsx` |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not required |
| lucide-react | Camera, CloudUpload, CheckCircle2, XCircle, Clock, ClipboardCheck, ClipboardList, Check, X, Plus, Users, Filter, ChevronRight, ArrowLeft, AlertTriangle | not required — icon library only |
| yet-another-react-lightbox | Lightbox component (already installed in Phase 3) | already reviewed in Phase 3 — no new gates required |

No new third-party UI component registries introduced in Phase 4. Canvas API used client-side for photo compression — no library required.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
