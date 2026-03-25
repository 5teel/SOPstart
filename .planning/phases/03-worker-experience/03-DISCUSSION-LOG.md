# Phase 3: Worker Experience - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-25
**Phase:** 03-worker-experience
**Areas discussed:** Walkthrough UX, Search & library, Assignment & versioning
**Skipped:** Offline behaviour (deferred to Claude's discretion)

---

## Walkthrough UX

### How should workers move through SOP steps?

| Option | Description | Selected |
|--------|-------------|----------|
| Swipe cards | Full-screen cards, swipe left/right | |
| Scroll list | All steps in scrolling list, tap to mark complete | ✓ |
| Tap to advance | One step at a time, big Next button | |

**User's choice:** Scroll list

### Where should Hazards/PPE/Emergency info appear?

| Option | Description | Selected |
|--------|-------------|----------|
| Before steps | Mandatory safety cards, worker must acknowledge | |
| Sticky header | Collapsed safety summary always visible | |
| Tab access | Safety accessible via tab, doesn't block | |

**User's choice:** Other — "Safety is a primary function of the app - lay out the info in a way that is best in class for incentivising safety"
**Notes:** User wants best-in-class safety presentation — not just one of the options but a combination that makes safety impossible to miss.

### How should step images display?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline + zoom | Image below step text, tap to zoom | ✓ |
| Full-width hero | Image takes full width above text | |
| You decide | Claude picks best display | |

**User's choice:** Inline + zoom

### Progress indication

| Option | Description | Selected |
|--------|-------------|----------|
| Step counter | Step 3 of 12 with progress bar | ✓ |
| Checklist | Scrollable checklist with checkmarks | |
| Minimal | Just current step number | |

**User's choice:** Step counter

---

## Search & Library

### SOP list layout

| Option | Description | Selected |
|--------|-------------|----------|
| Card grid | SOP cards in grid | |
| Simple list | Compact list rows | |
| You decide | Claude picks best | ✓ |

**User's choice:** You decide

### Search approach

| Option | Description | Selected |
|--------|-------------|----------|
| Top search bar | Persistent search bar, filters as you type | |
| Search icon | Tap magnifying glass to open search | ✓ |
| You decide | Claude picks best | |

**User's choice:** Search icon

### Category browsing

| Option | Description | Selected |
|--------|-------------|----------|
| Filter chips | Horizontal scrollable chips | |
| Dropdown | Category dropdown menu | |
| Sidebar | Collapsible sidebar / bottom sheet | ✓ |

**User's choice:** Sidebar (desktop) / bottom sheet (mobile)

### Quick reference mode

| Option | Description | Selected |
|--------|-------------|----------|
| Toggle on SOP | Button to switch modes | |
| Tabs on SOP | Tab bar at top always visible | ✓ |
| You decide | Claude picks | |

**User's choice:** Tabs on SOP

---

## Assignment & Versioning

### How admins assign SOPs

| Option | Description | Selected |
|--------|-------------|----------|
| By role/trade | Assign to roles only | |
| Individual + role | Both role and individual assignment | ✓ |
| You decide | Claude picks | |

**User's choice:** Individual + role

### Version update notification

| Option | Description | Selected |
|--------|-------------|----------|
| Force notification | Banner requiring acknowledgement | |
| Soft notification | Badge on SOP card | |
| Auto-update | Silent replacement | ✓ |

**User's choice:** Auto-update (silent)

### Mid-walkthrough version update

| Option | Description | Selected |
|--------|-------------|----------|
| Finish current | Let them finish on old version | |
| Interrupt | Show banner mid-walkthrough | |
| You decide | Claude picks safest | ✓ |

**User's choice:** You decide (safest approach)

---

## Claude's Discretion

- SOP list layout (cards vs list)
- Search UI behaviour details
- Category sidebar/bottom sheet design
- All offline behaviour (caching, sync, indicators)
- Mid-walkthrough version update handling
- Safety acknowledgement interaction design
- Quick reference tab bar styling

## Deferred Ideas

None — discussion stayed within phase scope
