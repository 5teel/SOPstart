# SOPstart — UI review through the `ui-taste` (Uizze) lens

Scope: 18 live screenshots from `.planning/evals/latest/` (desktop 1440 and phone 390), plus the code behind them. Read-only. No Uizze MCP lookups. Playbooks applied: `audit.md`, `polish.md`, `distill.md`, `operate.md`, and the "Detect habitual design" section of `craft.md`, which holds the skill's anti-slop rules.

## 1. Lens

The skill values product UI that "disappears into the task". Hierarchy should come from scale, weight, alignment and grouping before any container, border or colour is added, and every treatment has to carry information. Its anti-slop rule names the habitual defaults (icon-title-text cards, nested panels, decorative charts, glass, gradient headlines and "indiscriminate pill shapes") and keeps one only "when it serves the chosen direction or real task".

## 2. Verdict

The bones are good: there is one primary action per screen, the worker screens are quiet and the map and wordmark are specific to the product. The surface layer is assembled almost entirely from default Tailwind and shadcn parts:
- the stock Tailwind 500/600 hex palette as every accent
- a 4 px coloured left stripe on nearly every row and card
- a tinted pill on every status
- a violet "AI" panel with sparkles
- the icon-in-a-grey-circle empty state

Several of these sit on top of each other, which is the "too Claude" look the owner can sense.

## 3. Top AI-slop cues

| # | Cue | Where | Why it reads as generic (skill rule) |
|---|-----|-------|--------------------------------------|
| 1 | **A coloured left stripe on almost every row and card**: SOP list rows, walk hazard/PPE cards, browse step cards, editor step cards and the current rail item all carry a 4 px accent edge. | `63-home-worker-desktop`, `63-home-phone-list`, `58-walk-hazard`, `58-edit-admin` · `home/SopRow.tsx:39`, `focus/WalkStep.tsx:122`, `focus/BrowseDocument.tsx:126`, `focus/admin/StepCard.tsx:213-214`, `focus/FocusRail.tsx:75`, `focus/KindChip.tsx:12-15` | This is the most recognisable AI-generated card idiom. craft: "Use scale, weight, alignment and grouping before adding more containers". operate: "Use spacing and alignment for grouping before adding borders". In the list the stripe repeats the area dot that already sits above each group, so it adds no information. |
| 2 | **The stock Tailwind palette used as the brand accents**: `#2563eb`, `#d97706`, `#dc2626`, `#16a34a`, `#7c3aed`, `#0891b2`, `#3b82f6`, `#8b5cf6`, and the same values again as `--area-1..8`. | Every screen; most visible in the site map (`63-home-map-site`, `63-home-phone-map`) and the kind chips (`63-home-read-worker`) · `styles/blueprint-theme.css:103-121`, `:132`, `:200-207` | craft says to "carry the selected visual language" and to avoid "the first familiar template". Untouched blue-600 / violet-600 / cyan-600 is the default palette every generated UI ships with, so nothing in the colour says "industrial safety". It also reads as 8+ hues fighting for attention on one screen. |
| 3 | **The violet "AI check" panel with a sparkles icon and cards nested inside it**: a lavender tinted box holds white bordered finding cards, and each card holds bordered buttons. | `58-edit-ai-findings`, `58-edit-publish-dialog` · `focus/admin/AiCheckBanner.tsx:143-147` (tint + `Sparkles`), `:96` (nested card), `:80` (sparkles on the button) | craft names "nested panels" outright. Purple plus sparkles is the stereotypical "AI feature" decoration. The panel is also the largest element above the actual steps, which inverts the hierarchy on a screen whose task is checking the steps. |
| 4 | **Triple-coded status**: a coloured dot, a tinted caps pill (STUCK / NO OWNER / SIGN-OFF) and an explanatory grey sentence on every inbox row. People shows a green ACTIVE pill on every row. | `59-inbox`, `59-signoff-open`, `63-home-phone-signoffs`, `59-people` · `office/InboxRow.tsx:269,279`, `office/PeopleTab.tsx:44,52` | "Indiscriminate pill shapes" is the craft rule. distill: "Remove repeated copy, duplicate actions, decorative noise". A pill that is identical on every row ("ACTIVE" ×7) carries zero information. |
| 5 | **Two control vocabularies stacked**: a segmented control in a grey tray (Inbox / Requests / Decisions) sits directly over a row of rounded-full filter pills with counts. | `59-inbox`, `63-home-sections-admin`, `63-home-phone-signoffs` · `office/OfficePane.tsx:102` (tray), `office/InboxTab.tsx:60` and `office/DecisionsTab.tsx:92` (`h-9 rounded-full` chips) | operate: "Keep one component vocabulary across the surface". The chips are also `h-9` (36 px), under the 44 px `tap` floor in ADR-0004 §10, so this is a target-size defect as well as a slop cue. |
| 6 | **The template empty state**: an icon in a grey circle, a bold title, a muted line and a black pill-ish CTA, all centred. | `63-home-phone-record` · `home/sections/CompletionList.tsx:27-42` | This is the shadcn "Empty" pattern verbatim, an icon-title-text block the craft rule lists. It also bypasses the token system (`text-[var(--ink-700)]`, `w-16 h-16`, `transition-opacity`). |
| 7 | **Explanatory subtitle under every page title**: "Completed SOPs, approvals and requests waiting on you. Each decision is logged in the decision ledger." / "Who is in the organisation, their roles…" / "A record to look up, not a to-do list." | `59-inbox`, `59-people`, `63-home-section-training`, `63-home-phone-record` · `home/sections/SignOffsSection.tsx:29-30` (same pattern in the other sections) | distill: "prefer plain language over explanatory copy". A heading plus a grey self-describing sentence is a generated-app reflex. The last sentence quoted above defends a design decision to the user rather than helping them. |
| 8 | **Em-dash compound labels on buttons and status**: "I understand — continue", "I'm wearing it — continue", "Done — next step", "Draft — not published yet" (shown three times on one editor screen: banner, rail, DRAFT chip). | `58-walk-hazard`, `58-walk-ppe`, `58-walk-photo-required`, `58-edit-admin` · `lib/sop/focus.ts:120-121`, `focus/admin/EditDocument.tsx:64` | craft: "labels describe actions". The em-dash construction is a strong LLM-copy tell, and the triple draft state breaks distill's "remove repeated copy". |
| 9 | **Tracked caps micro-labels on every block**: RECENT, MOST USED, ALL SOPS · 10, WHAT YOU'LL DO, BEFORE YOU START, PROCEDURE, VERSION, OWNER, REVIEW, MACHINE, OBJECTIVE, STANDARDS, PHOTOS, NOTIFICATIONS. | `63-home-read-worker`, `58-walk-ppe`, `58-edit-admin`, `59-signoff-open` · `home/SopList.tsx:24`, `home/ReadView.tsx:182`, `focus/WalkStep.tsx:114` | When every group gets an eyebrow, the eyebrows stop ranking anything: "supporting information is visibly subordinate" fails because everything is equally labelled. This is a common generated-dashboard texture. **Conflicts with ADR-0006** (caps Saira labels are mandated), so the fix below changes how many labels there are, not their style. |
| 10 | **A one-off green button**: Publish is the only green filled button in the app; every other primary is ink-900. | `58-edit-publish-dialog` · `focus/admin/PublishDialog.tsx:90`, `PublishBar.tsx:92` | operate: "one component vocabulary". The green borrows the sign-off *status* hue for an *action*, which mixes semantic roles (craft: "semantic roles stay consistent"). |

Also observed (a defect, not slop): the editor rail's step list is clipped mid-row at about y=148 ("Fil…") above the THIS SOP block (`58-edit-admin`). Fix it in the same pass.

## 4. Recommendations (ranked by impact ÷ effort)

1. **Delete the left stripe from list rows; keep it only on the hazard card.**
   - Remove the `<i … w-1 rounded-full style={{background: row.colourVar}}>` in `home/SopRow.tsx:39`. The area dot on the group header already says where the SOP lives.
   - In `KindChip.tsx:12-15` / `BrowseDocument.tsx:126` / `StepCard.tsx:213` drop `border-l-4 ${KIND_EDGE[...]}`. The kind chip already names the kind.
   - `FocusRail.tsx:75`: show the current item with `font-semibold` + `bg-paper-1` only.
   - Effort **S**. Consistent with ADR-0004 §8 ("colour is never decorative").
2. **Retune the accent tokens off the stock Tailwind values.**
   - In `blueprint-theme.css:103-121,200-207`, replace the 500/600 hexes with a smaller, desaturated, signage-derived set: hazard red, PPE/caution amber, instruction blue, checked green, and one neutral.
   - Collapse `--accent-inspect`, `--accent-zone`, `--accent-voice` and `--ai` onto existing roles or ink.
   - Area colours should be 4-6 muted tones that sit below the semantic accents in saturation.
   - Effort **M** (token-only, so every component follows). No conflict: ADR-0004 §8 governs where colours live, not their values. The open "signage colours" item in HANDOFF is the natural home for this.
3. **Flatten the AI check.**
   - `AiCheckBanner.tsx:143-147`: drop the `--tint-ai-bg` box and the `Sparkles` icon (`:80`, `:147`). Render findings as a plain `divide-y` list under a one-line "2 things to look at" header in `text-ui text-ink-700`.
   - `:96`: remove the per-finding `rounded-lg border` card.
   - Better still, attach each finding inline to its step card (the "Go to it" target) and keep only the count in `PublishBar`.
   - Effort **S/M**. No ADR conflict (ADR-0004 §7: the editor "shows what still blocks Publish", and the bar already does).
4. **One status signal per row.**
   - `InboxRow.tsx:269`: drop the severity dot and keep the chip.
   - Delete the `Active` chip in `PeopleTab.tsx:52`; show only non-active states (Invited, Removed).
   - Shorten the grey sentence where it repeats the chip ("Stopped while reading the document" can stay as the only text; then drop the STUCK chip instead).
   - Effort **S**.
5. **Replace the filter pills with the same segmented control, or with plain text links, at tap height.**
   - In `InboxTab.tsx:60` / `DecisionsTab.tsx:92`, replace `h-9 rounded-full border` with `min-h-tap rounded-lg` inside the existing tray style, or use underline text tabs.
   - Remove the tray chrome (`OfficePane.tsx:102`: `border bg-paper-2 p-1`) so the top tabs read as page tabs.
   - Effort **S**. This also *fixes* an ADR-0004 §10 violation (36 px targets).
6. **Rewrite the empty state as one left-aligned line plus a text link.** In `CompletionList.tsx:27-42`, change it to `<p class="text-reading text-ink-700">No SOPs finished yet. <Link>Open My SOPs</Link></p>`. Drop the circle icon and the centring. Effort **S**.
7. **Cut the page subtitles.** Delete the `<p className="text-ui text-ink-500">…</p>` under each section `h2` (`SignOffsSection.tsx:29-30` and its siblings in `PeopleSection`, `TrainingSection`, `MyRecordSection`). If one fact matters ("logged in the decision ledger"), say it at the moment of the decision, as `AiCheckBanner.tsx:161` already does. Effort **S**.
8. **Plain action labels.**
   - In `lib/sop/focus.ts:120-121`, use "I understand" / "I'm wearing it", and use "Next step" for the step button. The button's position already says "continue".
   - Show draft state once: keep the `DRAFT` chip in the top bar and drop the banner at `EditDocument.tsx:64` plus the VERSION line in the rail.
   - Effort **S**. The worker verbs list in ADR-0004 §3 includes "Next" and "Done", so this is consistent.
9. **Fewer eyebrows, not different eyebrows.**
   - Remove labels that restate the obvious: "WHAT YOU'LL DO" above a numbered list (`ReadView.tsx:182`), "BEFORE YOU START" repeated above the hazard card when the rail already shows it (`WalkStep.tsx:114`), and the `Step 1 of 5` text under the progress bar when the phone top bar already says "1 of 5".
   - Keep the Saira caps style where a label survives.
   - Effort **S**. Partially conflicts with ADR-0006, which mandates the label style. Removing instances is compatible; restyling them is not.
10. **Make Publish an ink-900 primary.** In `PublishDialog.tsx:90` / `PublishBar.tsx:92`, use `bg-ink-900 text-paper`, and keep green for the "Published" confirmation state only. Effort **S**.

## 5. What already works

- **One clear primary per screen at glove size.** The black full-width `start` / "I understand" bars, the hazard text at 2xl, and a walk screen with nothing else on it all follow "the primary task reads first" and ADR-0004 §6.
- **Product-specific identity carries the brand.** The hazard-tape wordmark and the isometric site map (`63-home-map-site`) are things no template would produce. They should stay the only expressive elements.
- **Standard controls stay standard.** Native selects, checkboxes and date inputs in People, Training and the editor follow operate's "prefer standard navigation, forms, tables… over novel replacements".

## 6. Skill fit

The skill is a good fit for SOPstart's worker and office screens, because its core playbooks (operate, distill, audit) favour familiarity, one component vocabulary and stripping decoration, which suits a safety tool used with gloves on. Its anti-slop list is written mainly with marketing and landing pages in mind, and it is silent on hazard signalling. A strong colour band on the hazard card is a genuine safety convention (ISO 3864 / AS 1319), not slop, so this lens should be overruled wherever it would mute safety colour.
