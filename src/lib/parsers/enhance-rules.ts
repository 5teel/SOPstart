// ADR-0015: the enhancement rules for the clear version of a SOP. Distilled by Claude Opus 5.5 from a
// page-image communication review of 10 Visy SOPs (2026-10-15, .autoresearch/golden/review-synthesis.json).
// Edit here, not in the prompt builder; re-run the golden eval after any change.

export const ENHANCE_RULES = `E1. One action per numbered step. Split compound steps into separate numbered steps in the same order as the clauses in the source. Each condition ("if equipped", "if ABL running") stays attached to the action it controls. Number steps continuously across the whole SOP; no unnumbered CAUTION/NOTE rows act as steps.
   Why: Workers tick steps off on a phone. Bundled steps hide protective actions such as the wait for the red light or inserting the revert lock.
   Example: "At the COM-SOC Box, press the P-Stop button to stop the section. After the red Stop light turns on, pull the P-Stop button and place the section in Manual mode." -> "1. At the COM-SOC box, press the P-Stop button.
2. Wait until the red Stop light is ON.
3. Pull the P-Stop button out.
4. Select Manual mode."
   Never: Never change the order of the source clauses when splitting, and never drop a wait, condition, number or qualifier. Each split step must be traceable to the source text.

E2. Put each hazard in a yellow-triangle warning on the first step where the worker is exposed to it, before the action text, and again at each later exposure point (e.g. every step that moves the arm under air). Also give a short "Hazards for this job" summary at the top that lists only the hazards the source marks or names. Drop unticked grid items.
   Why: Hazards in an unlinked grid are ignored. A warning at the moment of exposure is acted on.
   Example: "CAUTION: Do not place any part of your body (i.e. hands and fingers) inside the "pinch points"… (pre-start row, 9 pages before the arm moves)" -> "⚠ PINCH POINT: Hands and fingers out of the section and adjacent sections before you switch Baffle Down air or cycle the arm.
12. At the COM-SOC box, turn Baffle Down air ON."
   Never: Never invent a hazard the source doesn't name or tick. Never drop a ticked or named hazard: if it has no matching step, keep it in the summary and flag "[Site to add control]". Never soften the wording.

E3. Show emergency and stop-work responses (let go + E-STOP, leave the area during the cycle, stop and re-assess) as a warning at the start of every section where they apply and at the top of the SOP. Do not leave them as an ordinary mid-list step. State non-critical repeated text (technique rules, rotation examples, the same PPE line) only once.
   Why: The life-saving reflex was step 10 of one section in g04 and the last line in g23, while low-value text was repeated 3–17 times.
   Example: "10 If a swab gets caught in equipment, let go immediately and push the E-STOP button for the section." -> "⚠ IF THE SWAB GETS CAUGHT: LET GO immediately. Then push the section E-STOP. (shown at the top of Neckrings, Blanks, Baffles and Mould side)"
   Never: Removing duplicates must never remove the last copy of any fact. Never remove a warning from a section where the source places it. Never change the order inside an emergency response (let go BEFORE E-STOP).

E4. Give a named PPE list (blue circle) in "Before you start". It must combine every PPE item mentioned anywhere in the source (tick boxes, control text, headers). Repeat the relevant items on hot, glass-handling or lifting steps. Replace "all PPE", "standard PPE" and "Refer to MSDR…" with the named items. If the source names none, keep the reference and add "[Site to list PPE from <doc code>]".
   Why: PPE was absent, cross-referenced or contradictory in every document.
   Example: "PPE ticked: Gloves, Safety Glasses… Table: "Long Heat resistant gloves worn", "Positive seal safety glasses", "Wear penetration resistant safety shoes"" -> "Before you start – PPE: 🔵 Long heat-resistant gloves (check for holes, oil, damage first) 🔵 Heavy-duty cotton long sleeves and long trousers 🔵 Positive seal safety glasses 🔵 Hearing protection 🔵 Penetration resistant safety shoes"
   Never: Never drop an item from any source list. Never downgrade a specific item ("long heat-resistant gloves") to a generic one. Never add PPE as a requirement that the source doesn't state; PPE seen only in photos is flagged "[Site to confirm: gloves shown in photo]".

E5. Before any reach-in, add a CHECK step listing the safe-state conditions the source states (lights, barrier down, lock in, air released, arm stopped), with "Do not reach in until all are true." Machine responses written as sub-steps ("the blanks will remain open") become these check items or expected results, never actions to perform. Turn "Now it is safe" into such a check.
   Why: Workers ticked off machine behaviour as if it were an action, and nothing confirmed the safe state before hands went in.
   Example: "5.1 The Manual swab light will begin to blink, gob loading will stop… 5.2 If equipped, the blank side safety barrier will go down. 5.3 The blanks will remain open…" -> "B. CHECK before reaching in: ☐ Manual swab light blinking ☐ Gob loading stopped ☐ Blank side clear of glass ☐ Safety barrier down (if fitted) ☐ Blanks open, invert on blank side ☐ RUN light blinking ☐ Neckring arms in revert. Do not swab until all are true."
   Never: Use only conditions stated in the source (including its photos and captions). Never add a technical check the source doesn't support. Never move the check after the reach-in step.

E6. Pair every protective action with its undo step. For each lock, inhibit, blocking device, isolation, barrier, gob catcher or air-off in the source, make sure the enhanced SOP has a matching removal or restore step, and a clear check before any start or energise step. Where the source lacks these, insert them as visibly flagged placeholders: "[Site to add: remove T-bar lock, turn blank close air ON, restart check]". The items listed may come only from devices the source already names.
   Why: Nine of the ten documents had missing or misplaced restore or restart steps.
   Example: "Striker Plate On | Burns from hot blanks | M | Use all PPE to prevent burns. Ring arm 'T' bar lock (document ends)" -> "9. Fit the striker plate (ring arm T-bar lock still ON).
Return to production — [SITE TO COMPLETE]
10. [Site to confirm] Hands and tools clear.
11. [Site to confirm] Remove blank hinge lock and ring arm T-bar lock.
12. [Site to confirm] Turn blank close air back ON.
13. [Site to add restart check.]"
   Never: Never present an added restore or restart step as an approved fact. It must carry the site-confirm flag. Never remove or merge away a source restart step, and never put a restart before guards, devices or clear checks that the source lists anywhere.

E7. Replace internal pointers ("as explained in Section 3.3", "follow the steps in section 3.2", "repeat steps 9 through 15", "ignore step 5.2", "see PIC .5", "identified below") with the actual steps or content copied in place, or with a named link to a reusable sub-section. Loop-backs and skips must name the target step by its title. Keep external document codes (EN-FOR-03-012) as references.
   Why: Workers in gloves can't scroll back 15 pages, and several pointers were wrong.
   Example: "5.1 If the baffle arm does not have internal clamping bolts…, ignore step 5.2 and continue with step 6." -> "Does the baffle arm have internal clamping bolts? (Single gob and 4-1/4 inch double gob arms do NOT.)
• NO → skip this step, go to 'Tighten front clamping bolts'.
• YES → Tighten the two internal clamping bolts until the clamp halves touch."
   Never: Copied content must be complete: include the switch-on, safe-state check and switch-off, not just the middle. If a pointer's target is wrong or ambiguous (e.g. "repeat steps 9–15"), keep the intended steps and flag "[Owner to confirm which steps repeat]"; never guess silently.

E8. Show mutually exclusive alternatives (blank type, machine type, route) as one "Identify your X" step followed by a choice table or list. Each row keeps its own area, numbers, stroke direction and prohibitions. Show conditional branches as a yes/no question.
   Why: Variants written as sequential steps forced workers to read every option and seemed to contradict each other (upward vs downward strokes).
   Example: "Swab NNPB blanks only from the baffle parting line down… Swab "41" process blanks from the bottom using an upward motion." -> "Check the job history for blank type, then use ONE row:
| NNPB | Baffle parting line DOWN to load line | Pat or one downward sweep | Never upward |
| "41" process | From bottom UP | One upward pass | Never scrub |"
   Never: Never merge rows or drop a prohibition, number or diagram from a variant. Never turn a sequence into a choice; use this only where the source shows the options are exclusive.

E9. Replace open or vague terms with specifics taken from elsewhere in the source. "etc." becomes the full union of every item the source names in any list, plus "[Plant: add any other]". "If OK" becomes the quality criteria from page 1. "Supported correctly" becomes "as shown in the photo". Where the source gives no criterion, keep the source word and flag "[Site to define]".
   Why: Vague criteria made checks inconsistent and hid required safety devices.
   Example: "Step 12 If OK continue feeding." -> "12. Check the first board: ☐ No excessive glue ☐ Glue coverage correct ☐ No belt marks ☐ No bursting or breakage. All OK: continue feeding. Any fail: stop (see Step 13)."
   Never: Never invent a number, tolerance, count or criterion (e.g. don't turn "several cycles" into "5 cycles"). Never delete the vague source word without replacing it with source content or a flag.

E10. Use one name per thing throughout the SOP, including captions. At first use, show the source alias in brackets ("revert lock (T-bar)"). Expand an abbreviation only if the expansion appears in the source or is unambiguous (PPE, LOTO, E-STOP). Otherwise keep the term and add it to a glossary list flagged "[Site to define]".
   Why: Three names for one lock, cage/crate, and undefined abbreviations confuse workers reading in a second language.
   Example: "Insert revert lock / Safety T-bar… Remove revert safety lock." -> "2. Insert the revert lock (T-bar).
…12. Remove the revert lock (T-bar)."
   Never: Merge names only when the source makes clear they are the same device. If unsure (e.g. "swab barrier" vs "safety barrier"), keep both and flag. Never guess at plant-specific abbreviations (NNPB, ABL, COM-SOC).

E11. Write in plain language: short sentences, a verb at the start, everyday words, and broken English fixed ("Lose the screw" → "Loosen the screw") where the meaning is unambiguous. Keep the strength of each instruction exactly: must / do not / never / shall stay mandatory; should / recommended stay as recommendations.
   Why: Readers with mixed literacy and English as a second language, reading mid-task.
   Example: "5.1 Lose the screw of the bracket and push them in order to separate the deflector´s pins of the bracket." -> "5.1 Loosen the screw on the bracket.
5.2 Push the bracket away so it comes off the deflector's pins."
   Never: Never weaken a mandatory instruction or turn a prohibition into advice. Never upgrade a recommendation to a requirement either; flag "[Owner: should this be required?]" instead. If the meaning of garbled text is uncertain, keep the original next to it and flag.

E12. Keep every number exactly, in metric: °C (not "*c"), ° (not "*"), mm, min, s. Write directions in full (clockwise / anticlockwise). Lead with the trigger, limit or number, then the action, then the reason. Convert imperial measurements to the source's own metric value (1/16" → 1.58 mm, as the source gives it). Keep equipment designations that contain inches as names.
   Why: NZ plants use metric only. Numbers buried after reasons were missed, and cut-off directions (ACW) were lost.
   Example: "1.1 When uncoated blanks are changed, increase the swabbing frequency to every 10 minutes for an hour…" -> "New UNCOATED blanks fitted? → Swab every 10 minutes for 1 hour (builds a coating). New PRE-COATED blanks? → No extra swabbing."
   Never: Never round, recalculate or drop a value, tolerance or direction. If the source gives two inconsistent values (1.6 mm vs 1.58 mm), keep both in their contexts and flag them; never pick one silently.

E13. Move content that isn't an action out of the numbered steps. Background and machine facts go to an "About this machine" note. Management programmes (inspections, hearing tests, training statements) go to details. Rules that apply throughout go to a "Rules" box. Equipment, tools and training go to "Before you start". Risk ratings and "Responsible" columns go to details.
   Why: Workers ticked off statements they couldn't act on, which hid the real steps.
   Example: "This test is semi automated / The bath is on a timer & will switch itself on for approx 6 hours every day | Timer malfunctions causing fire… | Weekly electrical checks conducted" -> "About this machine: semi-automatic. The bath switches on by timer for about 6 hours every day. A timer fault can cause fire, damage or injury; electrical checks are done weekly."
   Never: Moving is not deleting: every fact must still appear in the enhanced SOP. Never move a rule that is safety-relevant at a particular step (e.g. "do not use the swab cycle switch to change equipment") away from that step without also showing it there.

E14. Remove boilerplate that doesn't help the worker: confidentiality footers, red template instructions, empty plant columns, approval tables, revision history, risk matrices and hierarchy-of-control boxes, risk scores, unticked grid items, empty forms, sign-off sheets, blank pages, decorative clip-art. Put document code, revision, author and dates in a single details block.
   Why: Boilerplate took up most of the pages and squeezed the steps into a third of the phone width.
   Example: "Plant Leader: refer to MSDR EN-FOR-07-001 … to insert global requirements, then add any additional plant requirements." -> "🔵 PPE: [Site to list PPE from MSDR EN-FOR-07-001 Forming Safety Equipment]"
   Never: Never remove a ticked hazard, a ticked permit requirement, a training prerequisite, or any template text that hides a real requirement. Template text that marks a missing requirement becomes a visible site placeholder, never silence.

E15. Attach every photo to the step it illustrates, with a short caption. Split multi-label photos so each step shows its own item, and fix reversed numbering. Copy any safety text that appears only in a photo label ("DOES NOT ISOLATE CONTROLS INSIDE", "DANGER 415 VOLTS") into the step text as a warning.
   Why: Photos were pages away from their steps or carried critical text that appeared nowhere else.
   Example: "(photo label only) DOES NOT ISOLATE CONTROLS INSIDE" -> "⚠ The main switch DOES NOT ISOLATE CONTROLS INSIDE the cabinet. 415 V. Authorised access only.
1. Switch off the main switch. [photo: LOCK OUT HERE]"
   Never: Never drop a photo or a good/bad comparison image. Never write a caption that claims more than the photo or the source shows.

E16. Group steps into stage sections that match the job: Before you start → Make safe → Remove → Fit → Restore and restart → Close out. Put tasks done at different times (start of shift, each cycle, daily, when worn) in their own sections labelled with when they apply. Put lockout or emergency procedures that interrupt the task (e.g. clearing jams) where they are needed, and link to them from the trigger step.
   Why: Mixed-timing lists and a lockout section placed at the end didn't match the moment of work.
   Example: "Step 13 If there are problems with glue deposit or nozzle, see supervisor or maintenance. … (LOTO after Step 17)" -> "Problem with glue deposit or nozzle?
1. Stop the machine.
2. ⚠ Nozzle and glue are hot. Do not touch.
3. Tell your supervisor or maintenance. Anyone reaching in must lock out first (see Lockout)."
   Never: Grouping must never break an order-locked sequence or separate a step from its warning or condition. Any added safety step (e.g. "stop the machine", "do not touch") must be supported by the source or flagged.

E17. Keep every order-locked sequence in source order unless the order-judgement procedure allows a move. A move is allowed only when the source's own words state the dependency ("before", "after the blanks are removed", "to remove … safely", "intent to restart"). Mark every move with "[Moved: source listed this after X]". Where the source order looks unsafe but its words don't state the dependency, keep the order and add a visible ⚠ "[Site to confirm order: …]" flag.
   Why: Several sources put protective steps after the actions they protect. Silently re-sequencing a procedure is itself a hazard.
   Example: "8 Remove the operating baffles. 8.1 If the machine is equipped with ABL and the ABL is running, disable the ABL… Turn the ABL on as soon as possible." -> "8. If ABL is running: disable the ABL on the adjacent section. [Moved: source listed this as 8.1 under removal]
⚠ Keep ABL-off time short; a long stop can jam the section.
9. Remove the operating baffles.
10. Turn the adjacent ABL back ON as soon as possible."
   Never: Never reorder a sequence without stated textual support, and never reorder without a visible marker. The faithful translation always keeps the source order.

E18. Never resolve contradictions and copy-paste errors silently. Show the stricter instruction as the headline, keep the narrower or looser statement's specifics, and add "[Source conflict: …, owner to confirm]". Correct an obvious copy-paste error (wrong surface named) only when the section context is unambiguous, and flag it.
   Why: Contradictions (oil rule, blank safety lock, waste risk, splash) left workers unsure which to follow.
   Example: "p16 "O-I does not recommend using oil on Base 10 and Base 26 coated deflectors…" / p27 "Do not use oil in the deflectors…"" -> "⚠ Do not put oil on the deflectors: risk of machine fire and glass defects. This applies especially to Base 10 and Base 26 coated deflectors. [Source conflict: p16 'does not recommend' for coated only; p27 'do not' for all. Owner to confirm.]"
   Never: Never pick the looser of two conflicting instructions. Never delete either source statement. A correction must never change a safety device, switch or condition beyond fixing the obvious error.

E19. Mark every gap with the same visible placeholder: "[Site to confirm/add/define: …]". This covers missing PPE, restore steps, criteria, definitions, unlock methods and roles for two-person jobs. Collect all placeholders in an "Open items for document owner" list at the end.
   Why: The enhanced version must make gaps visible to owners without presenting guesses as approved instructions.
   Example: "NOTE: Two people are required to perform this work." -> "⚠ Two people are required for this job. [Site to define: who operates the control panel, who reaches in, and how you signal each other.]"
   Never: A placeholder must never contain a specific value, tool, lubricant, time or method that isn't in the source, written as if it were fact.`

export const ORDER_JUDGEMENT = `Decide for each group of steps:
1. Explicit wording: if the source uses then / before / after / first / only when / once / until / now it is safe / "to do X safely", or numbers steps that depend on each other, treat it as LOCKED.
2. Protection vs exposure: any step that applies protection (stop, P-Stop, wait for light, lock, T-bar, blocking device, inhibit, barrier, gob catcher, air off or released, LOTO + test, PPE, permit, harness tie-off) is LOCKED before the first step that exposes the worker (reach in, go up, handle hot parts). Protection removal is LOCKED after the last exposure step. A hands/tools/people-clear check and guard replacement are LOCKED before any start, energise or air-on step.
3. Physical access: disassembly where one part blocks the next, and reassembly that mirrors it in reverse, is LOCKED.
4. Process preconditions: heat or wait times (glue ≥30 min, bath at 76/21 °C), set before run (reject count, guides from the FOC), first-off check before continuing, inspect before discard. All LOCKED.
5. Valve and pneumatic sequences with angles and directions are LOCKED exactly as written, including turn-back steps.
6. Emergency responses (let go, then E-STOP; LOTO switch-off → lock → test → only then work) are LOCKED.
7. FREE: mutually exclusive alternatives (show as a choice), independent checks of one item, PPE item order, reference lists, general rules that apply throughout, close-out housekeeping, either-side-first tasks (keep any "finish one before the other" condition).
8. When splitting a bundled step, keep the order of its clauses. When a sub-step is a protective precondition of its parent ("If ABL running, disable … to remove safely"), it goes before the parent, with a [Moved] marker.
9. If the source layout contradicts its own stated dependency, follow the words, reorder and mark [Moved]. If the source order looks unsafe but only by inference (lift before harness, adjacent restart before reach-in work, devices removed before alignment), keep the source order and add a ⚠ [Site to confirm order] flag.
10. If the relative order of two items is unspecified (valves vs revert lock before start-up), keep the source order, keep both before the locked final step, and flag.
11. When in doubt, treat as LOCKED and keep the source order.`

export const ENHANCE_RISKS = `- A safety fact deleted while removing duplicates or boilerplate (e.g. dropping all copies of the ring warning, or a ticked hazard removed along with the grid). Check that each source fact maps to at least one place in the enhanced text.
- Silent reordering that breaks a locked sequence, or that 'fixes' order on inference without a [Moved] or [Site to confirm] marker.
- Placeholder restore or restart steps written as approved instructions, or filled with invented specifics (lubricant, cycle counts, valve directions, glove type, LOTO steps).
- Instruction strength changed: 'do not' softened to 'avoid', 'should' raised to 'must', 'recommended' dropped, or conditions ('if equipped', 'unless otherwise programmed') lost when splitting.
- Numbers altered: rounded, converted wrongly, units dropped, CW/ACW reversed, a cut-off value (180° ACW) not restored from the source text, or one of two inconsistent values silently chosen.
- Contradictions resolved towards the looser instruction, or one of the two conflicting statements deleted.
- Wrong expansion of plant abbreviations (NNPB, ABL, COM-SOC, Take 5) presented as fact.
- Merging names for devices that are actually different (swab barrier vs safety barrier; blank side blocking device vs mould side inhibit).
- Inlining a cross-reference only partly (copying the swab action but not the switch-on, safe-state check and switch-off around it).
- Variant tables that drop a row-specific prohibition, area, diagram or the 'identify your type' step.
- Warnings placed after the step they protect, or the emergency response not repeated in the most dangerous section (mould side).
- Safety text that existed only in photos (labels, captions) lost when photos are re-attached or cropped.
- PPE lists that drop items found in the control text, or that add PPE seen only in photos as a requirement.
- Moving content to an 'About' or details section that removes a rule from the step where it matters.
- Over-long enhanced steps (warnings plus checks plus reasons) that no longer fit a phone screen; reasons should come after the action and be short.`
