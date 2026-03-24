---
phase: 2
slug: document-intake
status: draft
shadcn_initialized: false
preset: none
created: 2026-03-24
---

# Phase 2 — UI Design Contract

> Visual and interaction contract for Phase 2: Document Intake. Covers the upload page, admin review page, and SOP library (admin view). Generated prior to implementation planning.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (custom Tailwind v4 components) |
| Preset | not applicable |
| Component library | none (hand-rolled, shadcn not initialised) |
| Icon library | lucide-react |
| Font | System font stack (inherited from Phase 1 shell) |

---

## Spacing Scale

Declared values (must be multiples of 4):

| Token | Value | Tailwind class | Usage |
|-------|-------|----------------|-------|
| xs | 4px | `p-1` / `gap-1` | Icon gaps, badge padding |
| sm | 8px | `p-2` / `gap-2` | Compact element spacing, tag lists |
| md | 16px | `p-4` / `gap-4` | Default element spacing, card padding |
| lg | 24px | `p-6` / `gap-6` | Section padding, card gaps |
| xl | 32px | `p-8` / `gap-8` | Layout column gaps |
| 2xl | 48px | `p-12` / `gap-12` | Major section breaks |
| 3xl | 64px | `p-16` / `gap-16` | Page-level vertical rhythm |

Exceptions:
- Tap targets: minimum `h-[72px]` (`--min-tap-target: 72px` per globals.css) on all interactive controls used in the review flow and upload queue. Upload zone itself uses `min-h-[200px]`.
- Side-by-side panes: each occupies exactly `w-1/2` with `gap-6` between on `lg:` breakpoint and above. Below `lg:` panes stack with `gap-4`.

---

## Typography

| Role | Size | Weight | Line Height | Tailwind class |
|------|------|--------|-------------|----------------|
| Page heading (h1) | 24px | 700 | 1.25 | `text-2xl font-bold` |
| Section heading (h2) | 18px | 600 | 1.35 | `text-lg font-semibold` |
| Card heading (h3) | 16px | 600 | 1.4 | `text-base font-semibold` |
| Body / step text | 16px | 400 | 1.6 | `text-base font-normal` |
| Label / metadata | 14px | 500 | 1.4 | `text-sm font-medium` |
| Caption / helper | 12px | 400 | 1.5 | `text-xs font-normal` |
| Status badge | 12px | 600 | 1 | `text-xs font-semibold` |

---

## Color

Palette sourced from `src/app/globals.css` `@theme` block. Dark mode is the default; no light mode variant is required in Phase 2.

| Role | Token / Hex | Tailwind class | Usage |
|------|-------------|----------------|-------|
| Dominant (60%) | `--color-steel-900` #111827 | `bg-steel-900` | Page backgrounds, main surface |
| Secondary (30%) | `--color-steel-800` #1f2937 | `bg-steel-800` | Cards, sidebars, panel backgrounds |
| Elevated surface | `--color-steel-700` #374151 | `bg-steel-700` | Hover states on cards, input backgrounds, dividers |
| Muted text | `--color-steel-400` #9ca3af | `text-steel-400` | Helper text, placeholders, metadata |
| Light text | `--color-steel-100` #f3f4f6 | `text-steel-100` | Primary body text on dark backgrounds |
| Accent — primary | `--color-brand-yellow` #f59e0b | `text-brand-yellow` / `border-brand-yellow` | Upload zone active border, "Approve" button background, active step indicators |
| Accent — warning | `--color-brand-orange` #ea580c | `text-brand-orange` / `bg-brand-orange` | Warning/caution labels inside steps, re-parse button, OCR low-confidence flag |
| Status — draft | #f59e0b (brand-yellow) | `bg-brand-yellow/20 text-brand-yellow` | Draft SOP badge |
| Status — published | #22c55e (Tailwind green-500) | `bg-green-500/20 text-green-400` | Published SOP badge |
| Status — parsing | #3b82f6 (Tailwind blue-500) | `bg-blue-500/20 text-blue-400` | Parsing-in-progress badge, spinner ring |
| Status — failed | #ef4444 (Tailwind red-500) | `bg-red-500/20 text-red-400` | Failed parse badge, error callout border |
| Status — approved section | #22c55e | `border-l-4 border-green-500` | Left border on an approved section card in review |
| Status — pending section | `--color-steel-700` | `border-l-4 border-steel-700` | Left border on an unapproved section card |
| Destructive action | #ef4444 | `text-red-400 hover:text-red-300` | "Delete draft" button, discard action |

Accent reserved for: upload zone active state border, "Approve section" button, overall "Publish SOP" button, and active pagination/step indicators. Never applied to generic links, body text, or decorative backgrounds.

---

## Page Structures

### Page 1 — Upload Page (`/admin/sops/upload`)

**Purpose:** Admin uploads one or more SOP files to kick off the async parsing pipeline.

**Layout:**

```
┌─────────────────────────────────────────────┐
│  Page header: "Upload SOPs"  [h1]           │
│  Helper text                                │
├─────────────────────────────────────────────┤
│                                             │
│        Upload Zone (drag-drop target)       │
│                                             │
├─────────────────────────────────────────────┤
│  Upload Queue (appears once files selected) │
│  ┌──────────────────────────────────────┐   │
│  │ File row: icon | name | size | status│   │
│  │ File row: icon | name | size | status│   │
│  └──────────────────────────────────────┘   │
│  [Upload All] button                        │
└─────────────────────────────────────────────┘
```

- Page padding: `px-4 py-8` (mobile), `px-8 py-12` (lg:)
- Max content width: `max-w-2xl mx-auto`
- Upload zone sits above the queue; queue is hidden until at least one file is selected

---

### Page 2 — Review Page (`/admin/sops/[sopId]/review`)

**Purpose:** Admin reviews AI-parsed output alongside the original document, edits sections inline, approves section-by-section, and publishes.

**Layout (lg+ — side-by-side):**

```
┌──────────────────────────────────────────────────────────────────────┐
│ Review header: SOP title | [Draft] badge | [Re-parse] [Delete] [Publish SOP] │
├────────────────────────────────┬─────────────────────────────────────┤
│  LEFT PANE (w-1/2)             │  RIGHT PANE (w-1/2)                 │
│  Original Document             │  Parsed Output                      │
│  ─────────────────             │  ─────────────────                  │
│  iframe / image viewer         │  Section cards (scrollable)         │
│  of uploaded source file       │  ┌─────────────────────────┐       │
│  (scrolls independently)       │  │ Section: Hazards  [✓]   │       │
│                                │  │ [editable content area] │       │
│                                │  │ [Approve] button        │       │
│                                │  └─────────────────────────┘       │
│                                │  ┌─────────────────────────┐       │
│                                │  │ Section: PPE      [✓]   │       │
│                                │  └─────────────────────────┘       │
└────────────────────────────────┴─────────────────────────────────────┘
```

**Layout (below lg — stacked):**

Original pane collapses to a collapsed accordion ("View original document ▸") above the parsed sections. Sections render full-width below.

- Pane wrapper: `flex flex-col lg:flex-row gap-6`
- Each pane: `w-full lg:w-1/2`
- Both panes: `overflow-y-auto` with `max-h-[calc(100vh-theme(spacing.32))]` so they scroll independently within a fixed viewport height
- Review header: `sticky top-0 z-10 bg-steel-900 border-b border-steel-700 px-6 py-4`

---

### Page 3 — SOP Library, Admin View (`/admin/sops`)

**Purpose:** Admins see all SOPs (drafts and published) with status indicators, and can navigate to upload or review.

**Layout:**

```
┌─────────────────────────────────────────────────────┐
│  "SOP Library"  [h1]          [+ Upload SOP] button │
├─────────────────────────────────────────────────────┤
│  Filter row: All | Drafts | Published | Failed      │
├─────────────────────────────────────────────────────┤
│  SOP row ─────────────────────────────────────────  │
│  icon | Title | SOP No. | [Draft] | Modified date   │
│  SOP row ─────────────────────────────────────────  │
│  icon | Title | SOP No. | [Published] | Pub date    │
│  SOP row ─────────────────────────────────────────  │
│  icon | Title | SOP No. | [Parsing...] | Uploaded   │
└─────────────────────────────────────────────────────┘
```

- Page padding: `px-4 py-8` (mobile), `px-8 py-10` (lg:)
- Max content width: `max-w-4xl mx-auto`
- Each SOP row: `flex items-center gap-4 p-4 bg-steel-800 rounded-lg hover:bg-steel-700 cursor-pointer min-h-[72px]`
- Filter tabs: `flex gap-2 border-b border-steel-700 mb-6` with active tab `border-b-2 border-brand-yellow text-brand-yellow`

---

## Components

### C-01: Upload Zone

**File:** `src/components/admin/UploadDropzone.tsx`

**States:** idle → drag-over → has-files

**Idle:**
```
border-2 border-dashed border-steel-700 rounded-xl
bg-steel-800
min-h-[200px]
flex flex-col items-center justify-center gap-4
p-8
text-center
```
- Upload icon (lucide `Upload`, `size={40}`, `text-steel-400`)
- Heading: "Drop your SOPs here" (`text-lg font-semibold text-steel-100`)
- Sub-copy: "Accepts Word (.docx), PDF, or photos of pages — up to 50MB each" (`text-sm text-steel-400`)
- Button row (all `min-h-[72px]`):
  - `[Browse files]` — `bg-brand-yellow text-steel-900 font-semibold px-6 h-[72px] rounded-lg hover:bg-amber-400`
  - `[Take a photo]` — `bg-steel-700 text-steel-100 font-semibold px-6 h-[72px] rounded-lg hover:bg-steel-600` (renders `<input type="file" capture="environment" accept="image/*">`)

**Drag-over:**
```
border-brand-yellow bg-brand-yellow/10
```
- Heading changes to: "Drop it — we'll handle the rest"

**Has-files (queue visible below zone, zone shrinks):**
- Zone contracts to `min-h-[120px]` with a "＋ Add more files" label

**Camera input:** Hidden `<input type="file" accept="image/*,.docx,.pdf" multiple capture="environment">`. The "Take a photo" button triggers this input programmatically.

---

### C-02: Upload Queue Row

**File:** Part of `src/components/admin/UploadDropzone.tsx`

Each queued file renders as:
```
flex items-center gap-3 p-3 bg-steel-800 rounded-lg min-h-[72px]
```

Left: file type icon (lucide `FileText` for .docx, `FileType` for .pdf, `Image` for image files) — `size={24} text-steel-400`

Middle:
- File name: `text-sm font-medium text-steel-100 truncate max-w-[200px]`
- File size: `text-xs text-steel-400`

Right: status chip or remove button
- Queued: `[✕]` remove button (`text-steel-400 hover:text-red-400`, `size={20}`)
- Uploading: spinner + "Uploading…" (`text-xs text-blue-400`)
- Uploaded: lucide `Check` (`text-green-400`)
- Error: lucide `AlertTriangle` + "Too large" or "Invalid type" (`text-red-400 text-xs`)

**Upload All button:**
```
w-full h-[72px] bg-brand-yellow text-steel-900 font-bold text-lg rounded-lg
hover:bg-amber-400 active:bg-amber-500 transition-colors
mt-4
```
Copy: "Upload [N] file" / "Upload [N] files" (pluralised). Disabled and greyed when any file has an error.

---

### C-03: Parse Job Status Card

**File:** `src/components/admin/ParseJobStatus.tsx`

Shown in the SOP library row and/or as a floating notification. Uses Supabase Realtime to update in place.

**Parsing state:**
```
bg-steel-800 border border-steel-700 rounded-lg p-4 flex items-start gap-3
```
- Animated spinner (CSS `animate-spin`, `border-2 border-blue-500/30 border-t-blue-400 rounded-full w-5 h-5`)
- Heading: "Crunching your SOP…" (`text-sm font-semibold text-steel-100`)
- Body: "Grab a hot drink or take a smoko — we'll let you know when it's ready." (`text-xs text-steel-400`)

**Completed state:**
- lucide `CheckCircle` (`text-green-400 size={20}`)
- Heading: "Parsed and ready to review" (`text-sm font-semibold text-steel-100`)
- CTA link: "Review now →" (`text-brand-yellow text-sm font-medium hover:text-amber-400`)

**Failed state:**
- lucide `AlertTriangle` (`text-brand-orange size={20}`)
- Heading: "Couldn't parse that one" (`text-sm font-semibold text-steel-100`)
- Body: surfaced error message, max 2 lines (`text-xs text-steel-400`)
- Buttons: `[Try again]` (`text-brand-orange text-sm`) | `[Delete]` (`text-red-400 text-sm`)

**OCR low-confidence flag (orange banner above review pane right):**
```
bg-brand-orange/20 border border-brand-orange/50 text-brand-orange
rounded-lg px-4 py-3 text-sm flex gap-2 items-start mb-4
```
Copy: "Heads up — this document was scanned or photographed, so some text might be off. Check it carefully before publishing."

---

### C-04: SOP Library Row

**File:** Part of `src/app/(protected)/admin/sops/page.tsx`

```
flex items-center gap-4 px-4 py-3 bg-steel-800 rounded-lg
hover:bg-steel-700 transition-colors cursor-pointer min-h-[72px]
border border-transparent hover:border-steel-600
```

- Icon: lucide `FileText` (`size={24} text-steel-400 flex-shrink-0`)
- Title block (flex-1):
  - SOP title: `text-base font-semibold text-steel-100`
  - SOP number + category: `text-xs text-steel-400`
- Status badge (see C-06)
- Date: `text-xs text-steel-400 tabular-nums` — shows "Modified {date}" or "Parsing…" or "Uploaded {date}"
- Chevron: lucide `ChevronRight` (`size={16} text-steel-400`)

---

### C-05: Section Card (Review Page)

**File:** `src/components/admin/SectionEditor.tsx`

Base:
```
bg-steel-800 rounded-lg border-l-4 border-steel-700 mb-4
overflow-hidden transition-colors
```

Approved variant: `border-l-4 border-green-500`

**Card header:**
```
flex items-center justify-between px-4 py-3 border-b border-steel-700
```
- Section type label: `text-sm font-semibold text-steel-100 uppercase tracking-wide` (e.g. "HAZARDS", "PPE REQUIRED", "STEPS")
- Right side: approved tick (lucide `CheckCircle2`, `text-green-400 size={18}`) when approved; nothing when pending

**Card body:**
```
px-4 py-4
```
- Displays section content in read mode. Text renders as `text-base text-steel-100 leading-relaxed`.
- Steps render as an ordered list: `ol` with `list-decimal list-inside space-y-3`. Each step uses `text-base text-steel-100`.
- Inline images: `rounded-md max-w-full object-contain max-h-48 my-2`
- Warning/caution chips inside steps: `inline-flex items-center gap-1 px-2 py-0.5 bg-brand-orange/20 text-brand-orange text-xs font-semibold rounded uppercase`

**Card footer:**
```
flex items-center gap-3 px-4 py-3 border-t border-steel-700 bg-steel-900/50
```
- `[Edit section]` button (pending only): `h-[72px] px-5 bg-steel-700 text-steel-100 font-semibold rounded-lg hover:bg-steel-600 text-sm`
- `[Approve section]` button (pending only): `h-[72px] px-5 bg-brand-yellow text-steel-900 font-bold rounded-lg hover:bg-amber-400 text-sm`
- `[Approved ✓]` static label (approved state): `text-green-400 text-sm font-semibold flex items-center gap-1` — replaces both buttons
- `[Undo approval]` link (approved state, right-aligned): `text-xs text-steel-400 hover:text-steel-100 underline`

---

### C-06: Status Badge

Reusable inline component. Renders as:
```
inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold
```

| Status | Classes |
|--------|---------|
| `draft` | `bg-brand-yellow/20 text-brand-yellow` |
| `published` | `bg-green-500/20 text-green-400` |
| `parsing` | `bg-blue-500/20 text-blue-400` (with `animate-pulse`) |
| `failed` | `bg-red-500/20 text-red-400` |
| `approved` (section) | `bg-green-500/20 text-green-400` |
| `pending` (section) | `bg-steel-700 text-steel-400` |

---

### C-07: Inline Section Editor

**File:** `src/components/admin/SectionEditor.tsx` (edit mode)

Activated by clicking `[Edit section]`. No modal — card body switches in place.

**Edit mode body:**
```
px-4 py-4
```
- Prose sections (Hazards, PPE, Emergency): `<textarea>` with:
  ```
  w-full bg-steel-900 border border-brand-yellow/50 rounded-lg
  text-base text-steel-100 leading-relaxed p-3 resize-y
  focus:outline-none focus:ring-2 focus:ring-brand-yellow/50
  min-h-[120px]
  ```
- Steps sections: each step rendered individually as an editable row:
  - Step number `text-sm font-mono text-steel-400 w-6 flex-shrink-0`
  - `<textarea>` per step (same styles as above, `min-h-[72px]`)
  - `[+ Add step]` button: `text-brand-yellow text-sm hover:text-amber-400 mt-2`
  - `[✕]` remove step button: `text-steel-400 hover:text-red-400`

**Edit mode footer (replaces normal footer):**
```
flex items-center gap-3 px-4 py-3 border-t border-steel-700 bg-steel-900/50
```
- `[Save changes]` — `h-[72px] px-5 bg-brand-yellow text-steel-900 font-bold rounded-lg hover:bg-amber-400 text-sm`
- `[Cancel]` — `h-[72px] px-5 bg-steel-700 text-steel-100 font-semibold rounded-lg hover:bg-steel-600 text-sm`

---

### C-08: Review Page Header Bar

**File:** Part of `src/app/(protected)/admin/sops/[sopId]/review/page.tsx`

```
sticky top-0 z-10 bg-steel-900 border-b border-steel-700
px-6 py-4 flex items-center gap-4 flex-wrap
```

Left cluster:
- Back link: lucide `ArrowLeft` + "All SOPs" (`text-sm text-steel-400 hover:text-steel-100 flex items-center gap-1`)
- Divider: `w-px h-5 bg-steel-700`
- SOP title: `text-base font-semibold text-steel-100 truncate`
- Status badge (C-06)

Right cluster (`ml-auto flex items-center gap-2 flex-wrap`):
- `[Re-parse]` — `h-[48px] px-4 bg-steel-700 text-brand-orange border border-brand-orange/40 font-semibold text-sm rounded-lg hover:bg-steel-600` (48px — desktop secondary action, not a primary glove-touch target)
- `[Delete draft]` — `h-[48px] px-4 text-red-400 border border-red-500/40 font-semibold text-sm rounded-lg hover:bg-red-500/10`
- `[Publish SOP]` — `h-[56px] px-6 bg-brand-yellow text-steel-900 font-bold text-sm rounded-lg hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed` — disabled until all sections are approved

Publish button tooltip (when disabled): "Approve all sections before publishing"

---

### C-09: Original Document Viewer (Left Pane)

**File:** `src/components/admin/OriginalDocViewer.tsx`

For PDF uploads:
```html
<iframe
  src={presignedUrl}
  className="w-full h-full border-0 rounded-lg bg-steel-900"
  title="Original SOP document"
/>
```
Wrapped in: `relative w-full lg:w-1/2 overflow-hidden rounded-lg border border-steel-700 bg-steel-900`

For image uploads (photographed pages): renders a scrollable `<div>` with `<img>` tags for each page image:
```
flex flex-col gap-3 overflow-y-auto p-4 bg-steel-900 rounded-lg border border-steel-700
```
Images: `rounded-md shadow-sm max-w-full border border-steel-700`

For .docx uploads: renders a static notice (iframe cannot display .docx inline):
```
flex flex-col items-center justify-center gap-3 p-8 bg-steel-900 rounded-lg border border-steel-700
text-center
```
- lucide `FileText` `size={40} text-steel-400`
- Copy: "Word document — preview not available" (`text-sm text-steel-400`)
- `[Download original]` link: `text-brand-yellow text-sm hover:text-amber-400 underline`

**Pane label:**
```
text-xs font-semibold text-steel-400 uppercase tracking-wide mb-2
```
Copy: "ORIGINAL DOCUMENT"

---

## Interactions

### I-01: Drag and Drop

1. User drags files over the page — `dragover` event fires → upload zone gains `border-brand-yellow bg-brand-yellow/10` regardless of where on the page the drag occurs (entire page is a drop target, not just the zone, to accommodate large screens)
2. Files dropped → zone reverts to idle border styling → files appear in queue below
3. Invalid file type dropped → zone flashes `border-red-500 bg-red-500/10` for 800ms → error toast: "That file type isn't supported. Try a Word doc, PDF, or photo."
4. File too large → same flash → error toast: "That file is over 50MB. Try compressing it first, or upload individual pages as photos."

Toast styles: `fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-3 bg-steel-800 border border-steel-700 rounded-lg shadow-xl text-sm text-steel-100 max-w-sm`

---

### I-02: Upload Progress

1. Admin clicks "Upload [N] files"
2. Each row's status chip transitions: queued → uploading (spinner) → uploaded (checkmark)
3. Uploads are sequential per file with visual per-file progress (no overall progress bar)
4. After all files uploaded, a success banner appears above the queue:
   ```
   bg-green-500/20 border border-green-500/40 text-green-400 rounded-lg px-4 py-3 text-sm
   ```
   Copy: "[N] file(s) uploaded — now parsing. We'll let you know when they're ready."
5. User is NOT automatically redirected. The parse job status cards update in the SOP library via Realtime. Admin can navigate there or stay on the upload page to upload more.

---

### I-03: Parse Job Status via Realtime

1. After upload, admin navigates to SOP library (`/admin/sops`)
2. Parsing SOPs show C-03 status card with animated spinner and smoko copy in the row expansion
3. Supabase Realtime subscription on `parse_jobs` table fires on `status` column update
4. On `completed`: spinner → green checkmark, copy changes to "Parsed and ready to review", "Review now →" CTA appears. No page refresh needed.
5. On `failed`: orange/red error card replaces spinner. `[Try again]` and `[Delete]` buttons appear.
6. If Realtime channel fails to connect within 5s, fall back to `useQuery` with `refetchInterval: 5000` until job resolves.

---

### I-04: Inline Edit Activation

1. In read mode, section card body has a subtle hover overlay: `hover:bg-steel-700/20 cursor-text` to hint editability
2. Admin clicks `[Edit section]` button in the card footer (or double-clicks the card body text)
3. Card body transitions from static text to textarea(s) — no layout shift; the card height expands naturally
4. Focus is placed on the first textarea automatically (`autoFocus`)
5. `[Save changes]` fires a PATCH to `/api/sops/[sopId]/sections/[sectionId]` with the updated content
6. On success: card returns to read mode, approval status is reset to "pending" (any edit requires re-approval), a brief `✓ Saved` flash appears in the footer for 2s
7. On error: textarea border turns `border-red-500`, error message appears below: "Couldn't save — try again"
8. `[Cancel]` discards changes and returns to read mode with no API call

---

### I-05: Section Approval Flow

1. Admin reads a section in the right pane, cross-references with the original on the left
2. Admin clicks `[Approve section]` — button shows a brief loading spinner (the PATCH fires to mark `approved: true`)
3. On success: footer replaces the two buttons with `[Approved ✓]` label + `[Undo approval]` link; card gets `border-l-4 border-green-500`
4. Progress indicator in the review header updates: "3 of 5 sections approved"
5. When all sections are approved, `[Publish SOP]` button becomes active (removes `disabled` attribute and `opacity-40`)
6. Admin clicks `[Publish SOP]` — confirmation inline below the button (no modal):
   ```
   text-sm text-steel-400 mt-2
   ```
   Copy: "This will make the SOP visible to workers. Sure?" with `[Yes, publish]` (`text-brand-yellow font-semibold`) and `[Cancel]` (`text-steel-400`) inline links
7. On confirm: POST to `/api/sops/[sopId]/publish` → status badge changes from `draft` to `published`, success banner:
   ```
   bg-green-500/20 border border-green-500/40 text-green-400 rounded-lg px-4 py-3 text-sm
   ```
   Copy: "SOP published. Workers can now access it in the library."

---

### I-06: Re-parse

1. Admin clicks `[Re-parse]` in review header
2. Inline confirmation below the button (no modal):
   Copy: "This will discard your edits and run the AI again. Sure?" with `[Yes, re-parse]` (`text-brand-orange font-semibold`) and `[Cancel]` inline links
3. On confirm: POST to `/api/sops/[sopId]/parse` → new parse job created, page shows "Parsing…" state replacing all section cards, smoko messaging visible in the right pane

---

### I-07: Delete Draft

1. Admin clicks `[Delete draft]`
2. Inline confirmation: Copy: "This will permanently delete this draft. Can't be undone." with `[Yes, delete]` (`text-red-400 font-semibold`) and `[Cancel]` inline links
3. On confirm: DELETE to `/api/sops/[sopId]` → redirect to `/admin/sops` with toast: "Draft deleted."

---

## Copywriting Contract

### Upload Page

| Element | Copy |
|---------|------|
| Page heading | "Upload SOPs" |
| Page subheading | "Upload your SOP documents and we'll parse them into a structured format ready for review." |
| Upload zone heading (idle) | "Drop your SOPs here" |
| Upload zone body (idle) | "Accepts Word (.docx), PDF, or photos of pages — up to 50MB each" |
| Upload zone heading (drag-over) | "Drop it — we'll handle the rest" |
| Browse files button | "Browse files" |
| Camera button | "Take a photo" |
| Upload queue CTA | "Upload [N] file" / "Upload [N] files" |
| Post-upload banner | "[N] file(s) uploaded — now parsing. We'll let you know when they're ready." |
| Invalid file type error | "That file type isn't supported. Try a Word doc, PDF, or photo." |
| File too large error | "That file is over 50MB. Try compressing it first, or upload individual pages as photos." |

### Parse Status

| Element | Copy |
|---------|------|
| Parsing heading | "Crunching your SOP…" |
| Parsing body | "Grab a hot drink or take a smoko — we'll let you know when it's ready." |
| Completed heading | "Parsed and ready to review" |
| Completed CTA | "Review now →" |
| Failed heading | "Couldn't parse that one" |
| Failed body | "[surfaced error], e.g. 'The file appears to be empty or corrupted.'" |
| Re-parse CTA | "Try again" |
| OCR low-confidence banner | "Heads up — this document was scanned or photographed, so some text might be off. Check it carefully before publishing." |

### Review Page

| Element | Copy |
|---------|------|
| Left pane label | "ORIGINAL DOCUMENT" |
| Right pane label | "PARSED OUTPUT" |
| Section approval progress | "[N] of [N] sections approved" |
| Publish button (enabled) | "Publish SOP" |
| Publish button tooltip (disabled) | "Approve all sections before publishing" |
| Publish confirmation | "This will make the SOP visible to workers. Sure?" |
| Publish confirm action | "Yes, publish" |
| Published success banner | "SOP published. Workers can now access it in the library." |
| Re-parse confirmation | "This will discard your edits and run the AI again. Sure?" |
| Re-parse confirm action | "Yes, re-parse" |
| Delete confirmation | "This will permanently delete this draft. Can't be undone." |
| Delete confirm action | "Yes, delete" |
| Edit saved flash | "✓ Saved" |
| Edit error | "Couldn't save — try again" |
| Unsaved changes guard | "You've got unsaved edits in this section. Save or cancel them before approving." |
| Word doc preview notice | "Word document — preview not available" |
| Word doc download link | "Download original" |

### SOP Library (Admin)

| Element | Copy |
|---------|------|
| Page heading | "SOP Library" |
| Upload CTA | "Upload SOP" |
| Empty state heading | "No SOPs yet" |
| Empty state body | "Upload your first SOP document and we'll parse it into a structured format your team can follow." |
| Empty state CTA | "Upload your first SOP" |
| Filter: all | "All" |
| Filter: drafts | "Drafts" |
| Filter: published | "Published" |
| Filter: failed | "Needs attention" |

### Error States

| Element | Copy |
|---------|------|
| Network error on upload | "Upload failed — check your connection and try again." |
| Network error on save | "Couldn't save — check your connection and try again." |
| Network error on publish | "Publish failed — check your connection and try again." |
| Session expired | "Your session expired. Sign in again to continue." |
| No permission | "You need admin access to manage SOPs." |

---

## Responsive Breakpoints

| Breakpoint | Width | Behaviour |
|------------|-------|-----------|
| Default (mobile) | < 768px (`md:`) | Single column throughout. Review page: original doc collapses to accordion above sections. Upload page: single-column queue. Library: full-width rows. |
| Tablet | 768px–1023px (`md:` to `lg:`) | Upload page and library at `max-w-2xl`. Review page still stacked (side-by-side requires `lg:`). |
| Desktop | 1024px+ (`lg:`) | Review page activates side-by-side layout. Upload page and library cap at `max-w-4xl`. |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not required |
| lucide-react | Icons only (Upload, FileText, FileType, Image, Check, CheckCircle, CheckCircle2, AlertTriangle, ChevronRight, ArrowLeft) | not required — icon library only, no component primitives |

No third-party UI component registries are used in Phase 2. All interactive components are hand-rolled with Tailwind v4.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
