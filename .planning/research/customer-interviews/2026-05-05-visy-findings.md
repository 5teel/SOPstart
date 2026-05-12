# SafeStart Field Research Report — Visy Packaging Partner Call (2026-05-05)

Source: `transcripts/2026-05-05_partner-call.md` (59 min, partner = Speaker 1, works at Visy Packaging; Simon = Speaker 0)

---

## 1. Domain & operational context

| Item | Detail |
|---|---|
| Company | **Visy Packaging** (Pratt family, Australian-owned) |
| Scale | **~100 sites across AU + NZ** |
| Products | Aluminium cans, glass bottles, cardboard boxes — packaging for beer, wine, FMCG. "If you buy a box of beer or case of wine, they've touched it 3 or 4 times" [00:00:38] |
| Decision contact | **Bryce — Engineering Manager** — can sign off a trial [00:02:43] |
| Hierarchy | Corporate (Pratt family) → **Global Forming Discipline Leader** (cross-plant SOP approver) → Site Engineering Manager → Health & Safety Manager → H&S Officer → H&S Reps → **Operators / Fitters / Sparkies** |
| Regulator (NZ) | **WorkSafe** [00:44:07] |
| Regulator (AU) | "WHS" / OHS [00:44:14] |
| Funding angle | **ACC (NZ)** — partner pursuing meeting with Minister of ACC; pitch is "minimise accidents" [00:50:28] |
| Vocab to handle | SOP, **forming**, **blank hanger** (consumable changed every shift), **swabbing / mopping** (every ~30 min on glass-forming machines), **IS glass forming machine**, **commissioning**, fitter, sparky, operator, **Success Factors** (HRIS), **revision** |
| Example SOP | `ENF4-03-031 Blank Side Hanger` — revision 14/01/2021, not reviewed since [00:08:11, 00:27:21] |

## 2. How SOPs are actually used — the honest reality

| Observation | Timestamp |
|---|---|
| **Nobody owns SOPs.** "I can't give you one person that's in charge of SOPs… there isn't anybody." | [00:52:23] |
| Current storage is **basic folder structures and files** — no system. | [00:06:08] |
| Operators **take shortcuts** or think they know because they've gotten away with it. | [00:22:09] |
| **Minor injuries are not reported** — "they probably wouldn't even tell anybody." | [00:12:54] |
| SOPs only get **pulled out after a major incident.** | [00:13:09] |
| Site-specific overlays are layered on top of manufacturer guidelines (hazards differ per site). | [00:13:51, 00:14:38] |
| Swab/mop every 30 min — referenced at a shared **desktop computer**, not phone. | [00:31:39, 00:24:39] |
| **Templates are inconsistent.** "Two different templates, probably more than two." | [00:21:23] |
| Example SOP not reviewed since 2021. | [00:27:52] |

## 3. Pain points

| # | Pain | Severity | Type |
|---|---|---|---|
| 1 | Nobody owns SOPs — passed down until someone has to act | HIGH | Governance |
| 2 | Operators take shortcuts; assume knowledge; get caught out | HIGH | Compliance |
| 3 | Templates are inconsistent across SOPs | HIGH | Standardisation |
| 4 | SOPs are inaccessible — locked in folders | HIGH | Accessibility |
| 5 | Stale revisions — no review reminders | MEDIUM | Version control |
| 6 | Language barriers + literacy gaps in workforce | MEDIUM | Training |
| 7 | Equipment variation (same model, different sub-versions — "7 Toyota Corollas") | HIGH | Knowledge transfer |
| 8 | **Fraudulent sign-offs** — shared logins; people sign for each other | HIGH | Audit / identity |
| 9 | Liability exposure — "millions… they can end up in jail" | HIGH | Compliance |
| 10 | Minor incidents go unreported → SOPs never get patched | MEDIUM | Continuous improvement |
| 11 | Operators "aren't the smartest tool" — UI must assume low literacy | MEDIUM | UX |

## 4. Direct feature requests / "I wish I had X"

| Request | Status vs roadmap | Notes |
|---|---|---|
| Standardise inconsistent templates | Covered (P12 builder + P15 NZ templates) | 100+ sites with multiple formats |
| Review-due notifications + grey-out stale SOPs | **GAP** | Suggest small phase: lifecycle reminder system |
| Sign-off with timestamp for users AND administration | Partial (P12.5 SignOff block) — admin workflow incomplete | |
| Multi-step approval chain (3-4 managers + Discipline Leader) | **GAP** | New capability |
| **Desktop-first reading UX** | **ANTI-PATTERN — flag** | Simon's mobile-first assumption challenged at [00:59:07] |
| **Voice Q&A over an SOP** ("press mic, tell me how to change the blank side hanger") | Partial (VoiceNote exists) — voice-RAG is **GAP** | High perceived value |
| Video + voiceover capture of tasks | Partial (video upload) — structured walkthrough is **GAP** | Reserve for safety-critical |
| **Training record** — completion = "trained on this procedure" | **GAP** | Integration with **Success Factors** HRIS |
| Simple identity (PIN/badge, not full login) | ANTI-PATTERN — flag | Cameras mitigate, but rethink shared-terminal identity |
| **Site-specific overlays** below org level | Partial (P13 org-vs-global) — site sub-tier is **GAP** | Multi-tenant model needs site layer |

## 5. Compliance, audit & regulator

| Signal | Detail |
|---|---|
| SOPs are **legislatively required** in AU + NZ |
| Regulators: **WorkSafe NZ**, **WHS Australia** |
| Liability stakes: **millions + jail time** for owners |
| Primary commercial pitch: "remove the liability on the owner" [00:42:39] |
| **ACC engagement** — accident-minimisation co-funding angle |
| Cameras everywhere — useful for sign-off disputes |
| Cross-site approvers exist ("Global Forming Discipline Leader") |
| **Implication**: Audit trail must be tamper-evident, exportable, satisfy regulator review |

## 6. Roles, permissions, workflow

Current SafeStart roles: Worker, Supervisor, SOP Admin, Safety Manager.

| Role surfaced | Current fit? |
|---|---|
| Operator | = Worker |
| Fitter | Worker + sub-trade tag |
| Sparky / Electrician | Worker + sub-trade tag |
| Health & Safety Rep | Not modelled |
| Health & Safety Officer | ≈ Safety Manager |
| Engineering Manager (Bryce) | SOP Admin? — needs broader scope |
| **Global Forming Discipline Leader** | **GAP — no cross-site discipline owner role** |
| Plant Manager | Not modelled |
| Corporate Safety | Not modelled |

- **3-4 managers** before approval [00:09:01] → configurable n-step approval needed
- **Site sub-tier**: Visy is 1 org with ~100 sites with own overlays. Strong signal for site/plant layer below organisation.

## 7. Devices, environments, physical constraints

| Constraint | Detail |
|---|---|
| **Desktop terminal** is the primary device for reading SOPs |
| Shared terminal — multiple operators per shift |
| Environment: noisy, hot (glass-forming line) |
| Workflow: read at desktop → walk to machine → do job → no per-step verification |
| Cameras everywhere |
| PPE permanent — no need to remind in SOP |
| Frequency: every 30 min (swab/mop), at least daily (blank hanger) |

**Major implication**: SafeStart's mobile-first design is partially mis-aimed for Visy. Desktop reading + voice Q&A maps better.

## 8. Training, onboarding, competency

- SafeStart could **become a training record** — completion = training evidence [00:32:34]
- Integration target: **Success Factors** (SAP HRIS) [00:34:02]
- Language barriers + literacy → **voice and video** are the answer, not text [00:36:40]
- "Like getting dressed for school" analogy → **enforced sequential walkthrough** preferred [00:32:57]
- "It's all about reading through the whole thing" — **no skipping** [00:24:25]

## 9. Things SafeStart should NOT try to do

| Don't | Why |
|---|---|
| Don't try to fix unreported minor incidents culturally | Organisational problem; software won't change it |
| Don't pitch as "throwing workers under the bus" | "I don't want to sell the worker out" [00:43:57] |
| Don't replace site judgment with rigid global SOPs | Sites legitimately vary |
| Don't over-engineer auth for first trial | Shared terminals + forgotten passwords = friction |
| Don't make "create SOP from scratch" the headline | "I wouldn't worry about trying to start from scratch" [00:19:59] |
| Don't force video on every SOP | Reserve for safety-critical steps |

## 10. Memorable quotes

1. **[00:52:23]** "I can't give you one person that's in charge of SOPs. There isn't anybody."
2. **[00:22:09]** "People start taking shortcuts… and all of a sudden, they get caught out."
3. **[00:13:09]** "Somebody goes to do something and there's an accident. They want to see the SOP."
4. **[00:20:28]** "They're not accessible to anybody."
5. **[00:24:52]** "Some of them aren't the smartest, you know, tool. So it's simple."
6. **[00:43:17]** "Oh, millions. Well, they can end up in jail."
7. **[00:35:52]** "People can't remember their login, so somebody else logs in for them."
8. **[00:32:34]** "This SOP thing will form a sort of training record for new employees."

## 11. Top 5 act-on-this items

### 1. Re-evaluate mobile-first; add desktop/kiosk mode (PHASE-SIZED, NEW PHASE)
Operators read at shared desktop next to machine. Phone-only assumption is mis-aimed for manufacturing-line use. Fit: new phase before P15.

### 2. SOP Lifecycle & Governance (PHASE-SIZED, NEW PHASE)
Review-due flagging + grey-out stale SOPs + multi-step approval chain + cross-site Discipline Leader role. Multiple HIGH pain points cluster here.

### 3. Site/plant tier in multi-tenant model (MEDIUM, EXTEND P13)
Visy = 1 org, ~100 sites, site-specific overlays. Without this, can't model how Visy actually works.

### 4. Voice Q&A over a single SOP (MEDIUM, NEW PHASE OR EXTEND P14)
"Press mic, ask question, get answer grounded in this SOP." Solves literacy + language + shortcut temptation. Infrastructure mostly already shipped.

### 5. Training-record + Success Factors integration (MEDIUM, NEW PHASE)
Completion = competency evidence. Export to SAP Success Factors. Moat play.

---

## Flagged contradictions Simon should resolve

1. **Mobile-first vs desktop-first** — entire UX thesis vs reality. Is Visy the customer or a customer?
2. **AI-drafted SOPs (Phase 14)** likely over-indexed — conversion + standardisation is the headline value, not generation
3. **Identity model** — per-user Supabase Auth vs shared-terminal reality. Consider PIN-on-shift or NFC badge
4. **Free-skip vs enforced sequence** — partner wants linear reading; confirm walkthrough behaviour matches
