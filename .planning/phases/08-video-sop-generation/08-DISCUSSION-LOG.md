# Phase 8: Video SOP Generation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-04
**Phase:** 08-video-sop-generation
**Areas discussed:** Video format scope, Worker video player UX, TTS & pronunciation, Storage & retention

---

## Video Format Scope

### Format Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Narrated slideshow + screen-recording only | Two simpler formats. Defer full AI video (avatar). | ✓ |
| All 3 formats | Include avatar/animation format. Most complex and expensive. | |
| Narrated slideshow only | Single format. Fastest to ship. | |

**User's choice:** Narrated slideshow + screen-recording only
**Notes:** Full AI video (VGEN-03) deferred per research recommendation — validate demand first.

### Slide Granularity

| Option | Description | Selected |
|--------|-------------|----------|
| One slide per section | Hazards, PPE, Steps (with sub-bullets), Emergency. 5-15 slides. | ✓ |
| One slide per step | Each step gets own slide. Much longer videos. | |
| You decide | | |

**User's choice:** One slide per section

---

## Worker Video Player UX

### Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Tab on SOP detail page | "Video" tab alongside Hazards, PPE, Steps tabs. | ✓ |
| Floating button on walkthrough | FAB overlay on step-by-step view. | |
| Card on SOP library listing | Badge/icon on library card. | |

**User's choice:** Tab on SOP detail page

### Player Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Inline with full-screen option | Plays in tab area. Chapter list below. Native full-screen available. | ✓ |
| Always full-screen | Immediate full-screen on tap. | |
| You decide | | |

**User's choice:** Inline with full-screen option

---

## TTS & Pronunciation

### Admin Preview

| Option | Description | Selected |
|--------|-------------|----------|
| Mandatory audio preview | Must play through before publish enabled. | |
| Optional preview | Can preview but not required. Publish available immediately. | ✓ |
| You decide | | |

**User's choice:** Optional preview

### Pronunciation Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Global vocabulary only | Same NZ list from Phase 6. Re-generate as fallback. | ✓ |
| Per-org dictionary | Custom terms with SSML phoneme overrides. | |
| You decide | | |

**User's choice:** Global vocabulary only

---

## Storage & Retention

### Retention Policy

| Option | Description | Selected |
|--------|-------------|----------|
| 90-day TTL with re-generate | Auto-delete, admin re-generates as needed. | |
| Keep indefinitely | No auto-delete. Storage grows unbounded. | ✓ |
| 30-day TTL | Aggressive cleanup. Frequent re-generation needed. | |
| You decide | | |

**User's choice:** Keep indefinitely

### Outdated Warning Trigger

| Option | Description | Selected |
|--------|-------------|----------|
| When SOP is updated after video generation | Compare timestamps. Amber badge on both views. | ✓ |
| When SOP version increments | Only on formal re-upload. Fewer false alarms. | |
| You decide | | |

**User's choice:** When SOP updated_at > video generated_at

---

## Claude's Discretion

- Shotstack timeline structure, video resolution, slide design
- Chapter marker extraction from section boundaries
- Video "fully watched" detection threshold for completion tracking
- TTS voice selection, admin re-generate workflow

## Deferred Ideas

- Full AI video (avatar/animations) — VGEN-03
- Per-org pronunciation dictionary
- Auto-regenerate on SOP update
- Video retention TTL
- Mandatory admin preview
