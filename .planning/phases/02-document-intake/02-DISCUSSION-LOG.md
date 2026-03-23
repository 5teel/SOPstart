# Phase 2: Document Intake - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-24
**Phase:** 02-document-intake
**Areas discussed:** Upload experience, AI parsing approach, Admin review UI, SOP structure model

---

## Upload Experience

### How should the admin upload SOPs?

| Option | Description | Selected |
|--------|-------------|----------|
| Drag-and-drop zone | Large drop area on the upload page | |
| Simple file picker | Standard 'Choose file' button | |
| Both | Drag-and-drop with fallback browse button | |

**User's choice:** Other — "Both drag and drop, browse and also a photo taking option of individual pages"
**Notes:** Three upload methods: drag-and-drop, file browser, AND camera capture for photographing individual pages of physical SOPs

### Can admins upload multiple SOPs at once?

| Option | Description | Selected |
|--------|-------------|----------|
| One at a time | Upload, review, publish, then next | |
| Batch upload | Upload multiple, queue for parsing, review each | ✓ |
| You decide | Claude picks simplest for v1 | |

**User's choice:** Batch upload

### What should the admin see during parsing?

| Option | Description | Selected |
|--------|-------------|----------|
| Progress indicator | Animated progress with status messages | |
| Background queue | Upload returns immediately, notification when ready | |
| You decide | Claude picks best UX | |

**User's choice:** Other — "Add a progress indicator and relaxed a message recommending the user have a hot drink or take a smoko while they are processed, notification will be sent through once complete"
**Notes:** Progress indicator + NZ-flavoured relaxed messaging + background notification on completion

### File size limits?

| Option | Description | Selected |
|--------|-------------|----------|
| 20MB limit | Handles most SOPs | |
| 50MB limit | Generous, covers image-heavy SOPs | ✓ |
| You decide | Claude sets sensible default | |

**User's choice:** 50MB limit

---

## AI Parsing Approach

### Should AI handle scanned/photo SOPs (OCR)?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, OCR too | Support scanned PDFs and photos with OCR | |
| Digital only v1 | Only text-extractable Word/PDF for v1 | |
| Best effort | Try OCR if text extraction fails, don't guarantee quality | ✓ |

**User's choice:** Best effort

### Which AI model for parsing?

| Option | Description | Selected |
|--------|-------------|----------|
| GPT-4o (Recommended) | Research-verified, 100% schema reliability | ✓ |
| Claude | Use Claude API instead | |
| You decide | Claude picks best model | |

**User's choice:** GPT-4o (Recommended)

### When AI isn't sure about a section?

| Option | Description | Selected |
|--------|-------------|----------|
| Flag for review | Low-confidence highlighted in review UI | |
| Always review all | Every section needs admin approval | ✓ |
| Auto-publish high | High-confidence auto-approved, flag low | |

**User's choice:** Always review all

### Which sections to extract?

| Option | Description | Selected |
|--------|-------------|----------|
| All sections | Extract every identifiable section | ✓ |
| Core set only | Focus on Hazards, PPE, Steps, Emergency | |
| Flexible | AI identifies whatever sections exist | |

**User's choice:** All sections

---

## Admin Review UI

### How should admin review parsed SOPs?

| Option | Description | Selected |
|--------|-------------|----------|
| Side-by-side | Original left, parsed right | ✓ |
| Tab switching | Toggle between Original and Parsed tabs | |
| Parsed only | Show only parsed with link to original | |

**User's choice:** Side-by-side

### How should admins edit parsed sections?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline editing | Click any section to edit in place | ✓ |
| Edit modal | Click Edit opens modal with editor | |
| You decide | Claude picks best pattern | |

**User's choice:** Inline editing

### What's the approval flow?

| Option | Description | Selected |
|--------|-------------|----------|
| Single approval | One 'Publish' button for whole SOP | |
| Section-by-section | Approve each section, then publish | ✓ |
| Review + publish | Review all, one publish button | |

**User's choice:** Section-by-section

### What if AI parsing is terrible?

| Option | Description | Selected |
|--------|-------------|----------|
| Reparse option | Click Re-parse to run AI again | |
| Delete and re-upload | Discard draft and start over | |
| Both | Reparse button plus delete/re-upload | ✓ |

**User's choice:** Both

---

## SOP Structure Model

### Fixed or flexible section types?

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed + custom | Core set plus custom section types | |
| Fully flexible | No fixed types, AI detects and labels | ✓ |
| Fixed only | Locked set of section types | |

**User's choice:** Fully flexible

### How should procedure steps be stored?

| Option | Description | Selected |
|--------|-------------|----------|
| Numbered steps | Simple ordered list with text, image, note | |
| Rich steps | Steps with text, images, warnings, tips, tools, time estimates | ✓ |
| You decide | Claude picks right model | |

**User's choice:** Rich steps

### How should images be handled?

| Option | Description | Selected |
|--------|-------------|----------|
| Extract + display | AI extracts, stores, displays inline | ✓ |
| Reference only | Store as attachments, link from steps | |
| Extract + annotate | Extract and allow captions/annotations | |

**User's choice:** Extract + display

### What metadata per SOP?

| Option | Description | Selected |
|--------|-------------|----------|
| Standard | Title, SOP number, revision date, author, category | |
| Extended | Standard + related SOPs, equipment, certifications | ✓ |
| You decide | Claude picks sensible fields | |

**User's choice:** Extended

---

## Claude's Discretion

- Zod schema structure for SOP parsing response
- Database schema for normalised SOP data model
- Async job queue implementation details
- Side-by-side UI layout details
- Inline editor component choice
- Notification mechanism for parse completion
- OCR library/service selection

## Deferred Ideas

None — discussion stayed within phase scope
