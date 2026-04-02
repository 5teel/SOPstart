---
phase: 05
phase_name: Expanded File Intake
status: draft
created: 2026-03-29
design_system: manual (Tailwind v4 @theme tokens — no shadcn)
---

# UI-SPEC: Phase 05 — Expanded File Intake

## Design System

**Tool:** Manual — Tailwind v4 with custom `@theme` tokens in `src/app/globals.css`
**shadcn:** Not initialized. Project predates shadcn adoption; Tailwind v4 token system is established and all prior phases follow it consistently. Do not initialize shadcn for this phase.
**Icon library:** lucide-react (already installed; used throughout project)
**Registry:** Not applicable

---

## Existing Design Token Reference

Tokens from `src/app/globals.css` — use these, do not redeclare:

| Token | Value | Usage |
|-------|-------|-------|
| `--color-brand-yellow` | `#f59e0b` | Primary CTA background, active accent |
| `--color-brand-orange` | `#ea580c` | Warning states, OCR caution banners |
| `--color-steel-900` | `#111827` | Page background |
| `--color-steel-800` | `#1f2937` | Card / panel background |
| `--color-steel-700` | `#374151` | Borders, secondary surfaces |
| `--color-steel-600` | `#4b5563` | Secondary text elements |
| `--color-steel-400` | `#9ca3af` | Muted / helper text |
| `--color-steel-100` | `#f3f4f6` | Primary body text |
| `--min-tap-target` | `72px` | Minimum height for all interactive elements |

---

## Spacing

**Scale:** 8-point base. All spacing in multiples of 4px.

| Usage | Value | Tailwind Class |
|-------|-------|----------------|
| Inline icon gap | 8px | `gap-2` |
| Component padding (tight) | 12px | `p-3` |
| Component padding (standard) | 16px | `p-4` |
| Component padding (loose) | 20px | `p-5` |
| Component padding (generous) | 32px | `p-8` |
| Vertical stack between cards | 8px | `space-y-2` |
| Vertical stack between sections | 16px | `space-y-4` |
| Page padding (mobile) | 16px | `px-4` |
| Scanner strip thumbnail gap | 8px | `gap-2` |
| Table cell padding | 12px horizontal, 8px vertical | `px-3 py-2` |

**Non-standard values declared as explicit exceptions (both are multiples of 4 — within-scale, but not in the standard set {4, 8, 16, 24, 32, 48, 64}):**

| Value | Tailwind | Rationale |
|-------|----------|-----------|
| 12px (`p-3`, `px-3`) | `p-3` / `px-3` | Established prior-phase pattern in `UploadDropzone.tsx` and `SectionEditor.tsx` for tight component padding. Changing would break visual consistency with existing queue rows and table cells. |
| 20px (`p-5`) | `p-5` | Established prior-phase pattern in `UploadDropzone.tsx` for loose component padding. Retaining for visual continuity. |

**Touch target exception:** All buttons and interactive elements must meet `min-h-[72px]` or `h-[72px]` (established `--min-tap-target`). Exceptions: icon-only remove buttons in file queue use `p-1` with a minimum clickable area of 44px enforced via a wrapping click zone.

---

## Typography

**Source:** Inherited from global stylesheet (system sans-serif stack via Tailwind default).

### Sizes — exactly 4 in use

| Size | Tailwind | Usage |
|------|----------|-------|
| 12px | `text-xs` | Helper text, file size metadata, queue row sub-labels |
| 14px | `text-sm` | Body copy in cards, section labels, button labels, status messages |
| 16px | `text-base` | Primary body text in SOP content, step text, table cell content |
| 18px | `text-lg` | Upload button primary label |

### Weights — exactly 2

| Weight | Tailwind | Usage |
|--------|----------|-------|
| 400 (regular) | `font-normal` | Body text, step content, table cell values |
| 600 (semibold) | `font-semibold` | Button labels, card headings, section titles, table header cells, upload submit button, numeric step indicators |

### Line Height

| Context | Value | Tailwind |
|---------|-------|----------|
| Body / step text | 1.5 | `leading-relaxed` |
| Headings / labels | 1.2 | `leading-tight` |
| Table cells | 1.4 | `leading-snug` |

---

## Color Contract

**60% dominant surface:** `steel-900` (`#111827`) — page background
**30% secondary surface:** `steel-800` (`#1f2937`) — all cards, panels, queue items, table container, scanner modal background
**10% accent:** `brand-yellow` (`#f59e0b`) — reserved strictly for:
  - Primary CTA buttons ("Browse files", "Upload N files", "Scan document", "Done — submit")
  - Drag-over dropzone border and background tint
  - In-progress text links ("Review now →")

**Semantic colors — phase-specific usage:**

| Color | Usage | Tailwind |
|-------|-------|----------|
| `brand-orange` | Image quality warning overlay; OCR accuracy caution banner | `text-brand-orange`, `border-brand-orange/50`, `bg-brand-orange/20` |
| `red-400` | Parse failure state; macro-blocked file rejection error; image quality hard-fail (not warn-but-allow — only if image is technically unreadable) | `text-red-400`, `border-red-500/30`, `bg-red-500/10` |
| `green-400` | Upload success checkmark; parse completed | `text-green-400` |
| `blue-400` | Uploading spinner; Excel file icon tint | `text-blue-400` |
| `green-400` | Image/photo file icon tint (single photo uploads) | `text-green-400` |

**Accent reservation rule:** `brand-yellow` must not appear on purely informational elements, status text, or non-primary actions. Secondary buttons use `steel-700` background with `steel-100` text.

---

## Component Inventory

### Modified Components

#### `UploadDropzone.tsx` (extended)

**Changes from existing:**
- Expand `ACCEPTED_MIME_TYPES` to include: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (.xlsx), `application/vnd.openxmlformats-officedocument.presentationml.presentation` (.pptx), `text/plain` (.txt), `image/heic`, `image/heif`
- Update subtitle copy: "Word (.docx), PDF, Excel (.xlsx), PowerPoint (.pptx), plain text (.txt), or photos up to 50MB"
- Add "Scan document" button as a third button in the button row (secondary style: `steel-700` background) — visible always, not only when queue is empty
- "Scan document" button launches `PhotoScanner` modal (does not add to file queue directly)
- File icon: add `ScanLine` (lucide) for PPTX, `TableProperties` for XLSX, `FileType2` for TXT — follow existing `FileIcon` component pattern

**Button row layout (three buttons):**
```
[Browse files — brand-yellow] [Take a photo — steel-700] [Scan document — steel-700]
```
On narrow screens (<360px), stack vertically. On 360px+, wrap with `flex-wrap justify-center gap-3`.

#### `SectionEditor.tsx` (extended)

**Table editing UX (D-05 — Claude's Discretion):**
Use raw markdown textarea editing for table content. Rationale: tables in Excel/PPTX SOPs are calibration data or parameter tables — they appear infrequently and admins editing them are already familiar with the review UI's textarea pattern. A visual table editor would add significant implementation overhead for minimal gain in this phase.

**Detection rule:** If a section's `content` string contains a line starting with `|` and a separator line matching `/^\|[-| :]+\|$/`, render the content via `SopTable` component in read mode rather than plain `<p>`. In edit mode, present the raw markdown table string in the existing `<textarea>` — include a helper note: "Edit as markdown table (| Col1 | Col2 |)".

### New Components

#### `PhotoScanner.tsx` (new — client component)

**Trigger:** "Scan document" button in `UploadDropzone`
**Presentation:** Full-screen modal on mobile; centered dialog (max-width 640px) on desktop. Background: `steel-900` with `bg-opacity-95`.

**Scanner flow state machine:**
```
idle → capture → quality-check → (warn?) → page-strip → [repeat] → ordering → submit
```

**Layout — portrait mobile (primary target):**
```
[Header: "Scan document"    [X close]]
[────────────────────────────────────]
[                                    ]
[     Camera viewfinder area         ]
[     (live preview or last image)   ]
[     640×480 min on mobile          ]
[                                    ]
[────────────────────────────────────]
[Quality indicator bar — live        ]
[────────────────────────────────────]
[  Page thumbnail strip (scrollable) ]
[  [p1][p2][p3][+]                   ]
[────────────────────────────────────]
[  [Retake photo]   [Add page / Done]]
```

**Quality indicator:**
- Green bar + "Looking good" — blur score >= 100 and resolution >= 600px
- Orange bar + "Image may be hard to read — retake recommended" (warn, not block) — blur score < 100 OR resolution < 600px
- Uses `brand-orange` warning color; admin can proceed with "Add page" despite warning
- Quality overlay appears inline below viewfinder, not as a blocking modal

**Thumbnail strip:**
- Each thumbnail: 56×72px, rounded-lg, `steel-700` border
- Active/selected thumbnail: `brand-yellow` border (2px)
- Delete icon: `X` (lucide) in top-right corner of thumbnail, 24px touch target minimum
- Add-page placeholder (`+` icon): same 56×72px slot, `steel-700` dashed border
- Strip scrolls horizontally; max 6 thumbnails visible before scroll

**Page ordering:**
- Below strip: "Page order detected — drag to reorder" in `text-xs text-steel-400`
- Drag handles: `GripVertical` (lucide) on left edge of each thumbnail
- Reordering is drag-to-reorder within the strip only (horizontal drag)

**Action buttons:**
- "Retake photo" — `steel-700` bg, `steel-100` text, `h-[72px]`, left half
- "Add page" (when pages remain to capture) — `brand-yellow` bg, `steel-900` text, `h-[72px]`, right half
- "Done — submit N pages" (when at least 1 page captured) replaces "Add page" after reviewing strip — `brand-yellow` bg, `steel-900` text, `h-[72px]`

#### `SopTable.tsx` (new — client component, used in worker SOP view and admin review)

**Trigger:** Rendered when `SectionContent` or `SopStep.text` contains GitHub-flavored markdown table syntax.

**Visual spec (D-04):**
- Container: `overflow-x-auto` wrapper, `rounded-xl`, `border border-steel-700`
- `<table>`: `w-full text-sm text-steel-100 border-collapse`
- `<thead>`: sticky (`position: sticky; top: 0; z-index: 1`), `bg-steel-700` background, `font-semibold` text
- `<th>` cells: `px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-steel-400`
- `<tbody>` rows: alternating `bg-steel-800` / `bg-steel-900` (zebra striping)
- `<td>` cells: `px-3 py-2 text-base text-steel-100 leading-snug min-h-[44px]`
- Minimum row height: 44px (glove-usable tap target for scrollable rows)
- No row click/tap actions in v1 of this component

**Empty table fallback:** If markdown table parse fails (malformed), fall through to plain text rendering (no error state shown to user).

#### `ImageQualityOverlay.tsx` (new — inline component used within PhotoScanner)

Stateless display component. Renders below the camera preview.

States:
- `pass`: `text-green-400` + `CheckCircle` icon + "Looking good"
- `warn`: `text-brand-orange` + `AlertTriangle` icon + "Image may be hard to read — retake recommended"
- `checking`: `text-steel-400` + `Loader2` (spin) + "Checking image…"
- `idle`: renders nothing

#### `TusUploadProgress.tsx` (new — used within `UploadDropzone` queue item for large files)

**Trigger:** When upload method is TUS (files > 10MB or video MIME types in future phases).
**Presentation:** Inline within the existing queue `<li>` row — replaces the `Loader2` spin with a percentage and progress bar.

```
[FileIcon] [filename.xlsx               ] [45%     ]
           [██████████░░░░░░░░░░░░░░░░░░] [Loader2]
```

- Progress bar: `bg-steel-700` track, `bg-brand-yellow` fill, `h-1 rounded-full`
- Percentage text: `text-xs text-steel-400 tabular-nums`
- Pause/resume button: NOT in this phase (future enhancement)

---

## Interaction Contract

### Upload Dropzone Interactions

| Trigger | Response |
|---------|----------|
| Drag file over zone | Border changes to `brand-yellow` dashed, background tints `brand-yellow/10`, copy changes to "Drop it — we'll handle the rest" |
| Drop unsupported file type | Toast: "Filename.xlsm is not a supported format. Macro-enabled files are blocked for security." (4s auto-dismiss, bottom-right) |
| Drop macro-enabled file (.xlsm, .pptm etc.) | Same rejection toast as unsupported type — rejected before any preview |
| Drop file > 50MB | Toast: "Filename.xlsx is over 50MB and cannot be uploaded." |
| Click "Scan document" | Open `PhotoScanner` full-screen modal |
| Click "Browse files" | Open native file picker (multi-select enabled) |
| Click "Take a photo" | Open camera capture (single image, environment-facing) |
| File queued (any type) | Show queue row with file-type icon, filename, size, remove button |
| Upload in progress | Row icon changes to `Loader2` spin (blue) or `TusUploadProgress` bar for large files |
| Upload complete | Row icon changes to `CheckCircle` (green) |
| Upload error | Row icon changes to `X` (red), error text below filename |

### PhotoScanner Interactions

| Trigger | Response |
|---------|----------|
| Photo captured | Run client-side quality checks; show `ImageQualityOverlay` result within 300ms |
| Quality check: pass | Green indicator; "Add page" button activates |
| Quality check: warn | Orange indicator + warning copy; "Add page" button still active (warn-but-allow, D-08) |
| Tap "Add page" | Append thumbnail to strip; advance to next capture state |
| Tap "Retake photo" | Discard current capture, return camera to viewfinder |
| Tap thumbnail delete | Remove page from strip; renumber remaining pages |
| Drag thumbnail | Reorder strip; update page number suggestions |
| Tap "Done — submit N pages" | Dismiss modal; add virtual "Scanned document (N pages)" item to upload queue; proceed through normal upload flow |
| Tap X (close) | Confirm discard if pages > 0: "Discard N scanned pages?" [Cancel] [Discard] |

### Table Rendering Interactions

| Trigger | Response |
|---------|----------|
| Section content has markdown table | `SopTable` renders in place of plain text |
| Table wider than viewport | Horizontal scroll within container (no page-level scroll impact) |
| Admin in edit mode for table section | Raw markdown textarea shown; helper note visible below textarea |
| Admin saves table edits | Re-renders as `SopTable` on exit from edit mode |

---

## Copywriting Contract

### Primary CTA Labels

| Button | Copy | Context |
|--------|------|---------|
| File upload submit | `Upload {n} {file/files}` | `UploadDropzone` — count from queue |
| Scanner launch | `Scan document` | Third button in dropzone button row |
| Scanner add page | `Add page` | During active page capture |
| Scanner submit | `Done — submit {n} {page/pages}` | After at least 1 page added to strip |
| Scanner retake | `Retake photo` | During active page capture |

### Empty States

| Location | Copy |
|----------|------|
| `UploadDropzone` (no files yet) | "Drop your SOPs here" (headline) / "Word (.docx), PDF, Excel (.xlsx), PowerPoint (.pptx), plain text (.txt), or photos up to 50MB" (subtext) |
| `PhotoScanner` thumbnail strip (no pages yet) | Strip shows only the `+` placeholder thumbnail; no additional copy needed |
| `SopTable` (no rows extracted) | Do not render table component — fall through to plain text rendering |

### Error States

| Error | Copy | Color |
|-------|------|-------|
| Unsupported MIME type | `{filename} is not a supported format. Use Word, PDF, Excel (.xlsx), PowerPoint (.pptx), plain text (.txt), or a photo.` | Toast, `steel-100` |
| Macro-enabled file blocked | `{filename} is not supported — macro-enabled Office files are blocked for security. Save as .xlsx or .pptx and try again.` | Toast, `steel-100` |
| File over size limit | `{filename} is over 50MB and cannot be uploaded.` | Toast, `steel-100` |
| Upload network error | `Upload failed — check your connection and try again.` | Queue row, `text-red-400` |
| Parse failed | `Couldn't parse that one` (headline) + server error detail in `text-xs text-steel-400` | `ParseJobStatus` card — existing pattern |
| Image quality warning | `Image may be hard to read — retake recommended` | `ImageQualityOverlay`, `text-brand-orange` — warn, not block |
| Scanner discard confirmation | `Discard {n} scanned {page/pages}?` | Modal dialog, destructive action on "Discard" button |

### Informational / Status Copy

| State | Copy |
|-------|------|
| OCR accuracy banner (after parse of photo source) | `Heads up — this document was scanned or photographed, so some text might be off. Check it carefully before publishing.` — existing `OcrBanner` pattern in `ParseJobStatus` |
| Parsing in progress | `Crunching your SOP…` / `Grab a hot drink or take a smoko — we'll let you know when it's ready.` — existing pattern, reuse unchanged |
| TUS upload progress | `{percentage}%` + progress bar — no verbose copy |
| Page order detection | `Page order detected — drag to reorder` (`text-xs text-steel-400`) |

### Destructive Actions

| Action | Approach |
|--------|----------|
| Remove file from upload queue | Immediate (no confirmation) — tap `X` icon, file removed from list; reversible by re-adding |
| Delete scanned page from strip | Immediate (no confirmation per page) — low-stakes individual action |
| Close PhotoScanner with pages captured | Confirmation dialog: "Discard {n} scanned {page/pages}?" with explicit [Discard] button in `red-400` text and [Cancel] in `steel-400` text. No confirmation if scanner is empty. |
| Delete draft SOP (parse failed) | Existing "Delete" link in `ParseJobStatus` — no change to this flow |

---

## Layout Contracts

### UploadDropzone (modified layout)

**Button row — 3 buttons:**
- `flex flex-wrap justify-center gap-3`
- "Browse files": `bg-brand-yellow text-steel-900 font-semibold px-6 h-[72px] rounded-lg`
- "Take a photo": `bg-steel-700 text-steel-100 font-semibold px-6 h-[72px] rounded-lg`
- "Scan document": `bg-steel-700 text-steel-100 font-semibold px-6 h-[72px] rounded-lg` + `ScanLine` icon left of label

### PhotoScanner (new layout)

**Mobile (< 640px):** Full-screen fixed overlay (`fixed inset-0 z-50 flex flex-col bg-steel-900`)
**Desktop (>= 640px):** Centered dialog, `max-w-lg w-full`, `rounded-2xl`, `bg-steel-900`, backdrop: `bg-black/70`

Header bar: `flex items-center justify-between px-4 py-3 border-b border-steel-700`
- Left: "Scan document" label (`text-base font-semibold text-steel-100`)
- Right: `X` close button (`text-steel-400 hover:text-steel-100`, `h-[44px] w-[44px]`)

Viewfinder area: `flex-1 bg-black` (camera feed or last-captured image preview)

Quality bar: `px-4 py-2 border-b border-steel-700`

Thumbnail strip: `flex gap-2 overflow-x-auto px-4 py-3 border-b border-steel-700 min-h-[88px]`

Action bar: `flex gap-3 px-4 py-4`
- "Retake photo": `flex-1 h-[72px] bg-steel-700 text-steel-100 font-semibold rounded-xl`
- "Add page" / "Done": `flex-1 h-[72px] bg-brand-yellow text-steel-900 font-semibold rounded-xl`

### SopTable (new layout)

```
<div class="overflow-x-auto rounded-xl border border-steel-700 my-3">
  <table class="w-full text-sm border-collapse">
    <thead class="bg-steel-700 sticky top-0 z-10">
      <tr>
        <th class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-steel-400">...</th>
      </tr>
    </thead>
    <tbody>
      <tr class="bg-steel-800">  <!-- odd rows -->
        <td class="px-3 py-2 text-base text-steel-100 leading-snug">...</td>
      </tr>
      <tr class="bg-steel-900">  <!-- even rows (zebra) -->
        ...
      </tr>
    </tbody>
  </table>
</div>
```

---

## States Reference (all new UI elements)

### UploadDropzone states
All existing states preserved. New states:
- `macro-blocked`: Toast shown; file not added to queue; identical UX to unsupported MIME

### PhotoScanner states
| State | Description |
|-------|-------------|
| `idle` | No camera active; no pages captured |
| `capturing` | Camera viewfinder active; quality check running |
| `quality-pass` | Last capture passes checks; "Add page" enabled |
| `quality-warn` | Last capture has quality issues; warning shown; "Add page" still enabled |
| `reviewing-strip` | One or more pages in strip; "Done" button visible |
| `submitting` | Upload triggered; modal auto-dismisses after add to queue |
| `discard-confirm` | Confirmation dialog shown before close |

### TUS upload states (within queue row)
| State | Display |
|-------|---------|
| `tus-uploading` | Progress bar + percentage, `Loader2` spinner |
| `tus-paused` | Progress bar frozen (no pause UI in this phase) |
| `tus-error` | Same as existing `error` state: `X` icon, `text-red-400` error message |
| `tus-complete` | Same as existing `uploaded` state: `CheckCircle` green |

---

## Accessibility Contract

- All `<button>` elements have explicit `aria-label` when icon-only (e.g., thumbnail delete `aria-label="Remove page {n}"`, close button `aria-label="Close scanner"`)
- PhotoScanner modal: focus trap within modal while open; focus returns to "Scan document" button on close
- `PhotoScanner` live quality indicator: `role="status"` `aria-live="polite"` on quality result area
- `SopTable`: `<table>` has `role="table"` (native semantics); no additional ARIA required
- Drag-reorder in thumbnail strip: keyboard fallback via up/down arrow keys on focused thumbnail (reorder by 1 position per keypress)
- Camera input `<input type="file" capture="environment">` — no custom ARIA needed; native browser handles

---

## Registry Safety Gate

Not applicable — no shadcn initialized, no third-party component registries declared for this phase.

---

## Pre-Population Source Summary

| Field | Source |
|-------|--------|
| Design tokens (all colors, tap target) | `src/app/globals.css` — existing `@theme` block |
| Typography scale | Existing components (`UploadDropzone`, `SectionContent`, `ParseJobStatus`) |
| Button dimensions (72px) | `--min-tap-target` token + `WORK-09` requirement |
| Color usage rules | Existing `UploadDropzone.tsx`, `ParseJobStatus.tsx`, `SectionContent.tsx` |
| Scanner flow UX | CONTEXT.md D-01, D-02, D-03, D-07, D-08, D-09 |
| Unified dropzone | CONTEXT.md D-06 |
| Rich table spec | CONTEXT.md D-04; RESEARCH.md Pattern 6 |
| Table admin editing approach | Claude's Discretion (D-05) — raw markdown textarea |
| MIME types to accept | RESEARCH.md Standard Stack + REQUIREMENTS.md FILE-04, FILE-05, FILE-06 |
| Macro-file rejection UX | STATE.md Blockers/Concerns (Phase 5 note) |
| OCR warning banner copy | Existing `ParseJobStatus.tsx` `OcrBanner` component — reuse unchanged |
| TUS progress UI | RESEARCH.md Pattern 4; INFRA-01 |
| Copywriting tone | `ParseJobStatus.tsx` ("Grab a hot drink or take a smoko") — NZ locale, direct |

---

*Phase: 05-expanded-file-intake*
*UI-SPEC created: 2026-03-29*
*Status: draft — awaiting checker validation*
