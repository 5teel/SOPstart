# Phase 5: Expanded File Intake - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-03
**Phase:** 05-expanded-file-intake
**Areas discussed:** Multi-page photo scanning, Table rendering in SOPs, Upload UX for new formats, Image quality gating

---

## Multi-Page Photo Scanning

### Q1: How should the multi-page capture flow work?

| Option | Description | Selected |
|--------|-------------|----------|
| Scanner-style flow | Dedicated scanning mode: capture → thumbnail → Add page → preview strip → reorder/delete → Done. Like CamScanner or Apple Notes. | ✓ |
| Queue-based approach | Use existing upload queue, admin takes multiple photos, selects 'Combine into one SOP'. Simpler but less polished. | |
| You decide | Claude picks best approach | |

**User's choice:** Scanner-style flow
**Notes:** None

### Q2: Should multi-page auto-detect page order or rely on capture sequence?

| Option | Description | Selected |
|--------|-------------|----------|
| Capture sequence only | Pages ordered by when photographed. Admin can manually reorder. Simpler. | |
| Auto-detect + manual override | Try OCR page numbers as suggested order, admin can override. More complex. | ✓ |
| You decide | Claude picks based on complexity vs value | |

**User's choice:** Auto-detect + manual override
**Notes:** None

### Q3: Maximum pages per SOP scan?

| Option | Description | Selected |
|--------|-------------|----------|
| 10 pages | Reasonable limit for most industrial SOPs | |
| 20 pages | Covers longer procedures | |
| No hard limit | Let admins scan as many as needed | ✓ |

**User's choice:** No hard limit
**Notes:** None

---

## Table Rendering in SOPs

### Q1: How should tables from Excel/PowerPoint appear in published SOPs?

| Option | Description | Selected |
|--------|-------------|----------|
| Markdown tables in content | Store as Markdown, render via existing renderer. Simple, works offline. | |
| Rich table component | Dedicated component with scrollable rows, sticky headers, zebra striping. Better for large tables. | ✓ |
| You decide | Claude picks for mobile readability | |

**User's choice:** Rich table component
**Notes:** None

### Q2: Should tables be editable by admins during review?

| Option | Description | Selected |
|--------|-------------|----------|
| Edit as text/markdown | Admin edits raw markdown in section editor. Simple but less visual. | |
| Visual table editor | Admin edits cells inline in spreadsheet-like UI. Better UX, significant effort. | |
| You decide | Claude picks based on effort vs value | ✓ |

**User's choice:** You decide
**Notes:** Claude's discretion on table editing approach

---

## Upload UX for New Formats

### Q1: How should expanded format support be presented?

| Option | Description | Selected |
|--------|-------------|----------|
| Single unified dropzone | Expand existing UploadDropzone to accept all formats. One area handles everything. | ✓ |
| Format picker first | Admin chooses source type first, then gets format-appropriate UI. More guided. | |
| You decide | Claude picks based on existing patterns | |

**User's choice:** Single unified dropzone
**Notes:** None

### Q2: Should 'Scan printed SOP' be a separate entry point?

| Option | Description | Selected |
|--------|-------------|----------|
| Separate 'Scan' button | Distinct entry alongside Upload and Take Photo. Opens scanner flow directly. | ✓ |
| Auto-detect from photo | Single photo upload, then offer 'Add more pages'. Less upfront choice. | |
| You decide | Claude picks clearest path | |

**User's choice:** Separate 'Scan' button
**Notes:** None

---

## Image Quality Gating

### Q1: When a photo fails quality checks, what happens?

| Option | Description | Selected |
|--------|-------------|----------|
| Warn but allow | Show warning overlay but let admin proceed. Respects admin judgment. | ✓ |
| Block until retaken | Reject photo, require new capture. Prevents garbage-in. | |
| You decide | Claude picks the right balance | |

**User's choice:** Warn but allow
**Notes:** None

### Q2: Where should quality checks run?

| Option | Description | Selected |
|--------|-------------|----------|
| Client-side only | Check blur/resolution in browser before upload. Instant feedback. | |
| Client + server | Client quick checks, server deeper analysis before OCR. More accurate. | ✓ |
| You decide | Claude picks based on speed vs accuracy | |

**User's choice:** Client + server
**Notes:** None

---

## Claude's Discretion

- Table editing UX in admin review (visual editor vs raw markdown)
- TUS library choice and integration pattern
- Format-specific prompt engineering
- Client-side quality check algorithm
- Server-side preprocessing library
- Office file parsing library choice
- Parse route routing logic extensions

## Deferred Ideas

None — discussion stayed within phase scope
