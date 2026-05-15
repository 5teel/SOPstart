// Build two structured drafts (clean + corrupted) from the source PDF content.
// Clean draft = a reasonable Phase-12-builder-style representation of the source.
// Corrupted draft = clean draft with TWO deliberate defects:
//   (B) drop a critical safety step (Job B = omission reverse-scan)
//   (C) swap one photo's step anchor (Job C = anchoring check)

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "fixture");
await mkdir(OUT, { recursive: true });

// Faithful structured draft of medium-forming-swabbing.pdf (hand-curated from source.json).
// Section IDs are stable so we can refer to them in the AI reviewer flags.
const cleanSections = [
  {
    id: "sec-safety",
    title: "Safety Requirements",
    kind: "hazards",
    steps: [
      { id: "step-safety-1", text: "Observe O-I standard safety requirements and procedures defined by the Global Environmental Health & Safety (EH&S) organization, as well as all applicable local, regional, and national requirements." },
      { id: "step-safety-2", text: "Identified hazards: Slip, Crush, Hand injury, Hot Surface, Bump, Inhalation, Steam." },
    ],
  },
  {
    id: "sec-prep",
    title: "Preparing Swab Brushes",
    kind: "steps",
    steps: [
      { id: "step-prep-1", text: "Begin each shift with new, clean swab brushes of the appropriate diameter and length per the job history. Replace them during the shift as needed." },
      { id: "step-prep-2", text: "Use one swab brush for the neckrings." },
      { id: "step-prep-3", text: "Use two swab brushes for the blanks, swabbing half of the sections with each brush." },
      { id: "step-prep-4", text: "Prepare a new swab brush by saturating it with a light oil so that the swab lubricant compound will penetrate into the swab fibers." },
      { id: "step-prep-5", text: "Inspect the swab brushes before each swab cycle. Replace a swab brush if it becomes hard or scorched, is losing fibers, forms a tail, or is no longer soft, fluffy and able to apply the proper coat of swabbing compound.",
        photos: [{ id: "photo-bad-brush", caption: "Bad Swab Brush — example of a brush that should be replaced." }] },
      { id: "step-prep-6", text: "When a swab is no longer useable, remove the head and place it into a designated container per regional or country specific environmental regulations." },
    ],
  },
  {
    id: "sec-swab-section",
    title: "Properly Swab a Section",
    kind: "steps",
    steps: [
      { id: "step-swab-1", text: "Review the established swabbing instructions for the job being produced." },
      { id: "step-swab-2", text: "Determine the minimum number of cycles to reject ware after swabbing based on the control document or a checklist." },
      { id: "step-swab-3", text: "Before swabbing a section, activate the “Swab Cycle” switch on the section control panel. The Manual swab light will begin to blink, gob loading will stop, and the section will clear glass from the blank side.",
        photos: [{ id: "photo-swab-cycle-switch", caption: "Swab Cycle Switch on the section control panel." }] },
      { id: "step-swab-4", text: "Begin swabbing when the “RUN” indicator light starts blinking, the blank side is clear of glass, and the neckring arms are in the revert position.",
        photos: [{ id: "photo-run-light", caption: "Run Indicator Light blinking — safe to begin swabbing." }] },
      // CRITICAL SAFETY STEP — the one Job B should flag if removed
      { id: "step-swab-5-safety", text: "Do not put your thumb or finger through the ring on the swab brush handle, if your plant uses swabs with a ring. Serious injuries to your thumb or fingers may result if the swab gets caught in the section.",
        photos: [{ id: "photo-thumb-warning", caption: "Do not place thumb or fingers in the ring!" }] },
      { id: "step-swab-6", text: "If a swab gets caught in equipment, let go immediately and push the E-STOP button for the section." },
      { id: "step-swab-7", text: "After swabbing a section and your hand is clear of the section, deactivate the swab cycle by cycling the button. The RUN light continues to blink until normal operations resume, then stays on continuously." },
    ],
  },
  {
    id: "sec-swab-neckrings",
    title: "Swab the Neckrings",
    kind: "steps",
    steps: [
      { id: "step-neck-1", text: "Recommended: swab neckrings before swabbing the blanks." },
      { id: "step-neck-2", text: "Apply a small amount of neckring swab compound on the swab and work it into the fibers of the swab. Wring out excess lubricant with a twisting motion, and shake the swab so that it loosens back out." },
      { id: "step-neck-3", text: "Bend the head of the swab at a 45-90 degree angle to prevent damage to the neckring from the metal tip. Do not bend the swab if it has a protective tip (such as those used in the Asia-Pacific region)." },
      { id: "step-neck-4", text: "Swab each neckring once with a downward dabbing or patting motion. A proper swab will leave an imprint of the neckring on the swab. Do not use a sliding or back-and-forth motion, or drag the swab across the rings." },
    ],
  },
  {
    id: "sec-swab-blanks",
    title: "Swab the Blanks",
    kind: "steps",
    steps: [
      { id: "step-blank-1", text: "Swab all blanks according to established swabbing instructions. When uncoated blanks are changed, increase the swabbing frequency to every 10 minutes for an hour. Pre-coated blanks do not require extra swabbing.",
        photos: [{ id: "photo-coated-uncoated", caption: "Pre-Coated vs Uncoated blanks." }] },
      { id: "step-blank-2", text: "Use the proper size swab for the blank cavity. The swab should not be more than 1.5 times the diameter of the blank at the load line." },
      { id: "step-blank-3", text: "Apply a small amount of blank swab compound to the swab and work it into the fibers. Squeeze out excess swab compound, and shake the swab to loosen the fibers.",
        photos: [{ id: "photo-shaken-not-shaken", caption: "Shaken vs Not Shaken brush comparison." }] },
      { id: "step-blank-4", text: "Always apply light pressure to the blanks, and hold the swab parallel to the blank. Rotate the swab brush after swabbing each blank." },
      { id: "step-blank-5", text: "Swab NNPB blanks only from the baffle parting line down to the load line, using a patting motion or one downward sweeping motion. Do not swab blanks with an upward motion." },
      { id: "step-blank-6", text: "Swab B&B blanks from the load line down to the neckring parting line, using a downward motion." },
    ],
  },
  {
    id: "sec-swab-baffles",
    title: "Swab the Baffles",
    kind: "steps",
    steps: [
      { id: "step-baffle-1", text: "Only swab baffles as necessary, and after the blanks have been swabbed for the section." },
      { id: "step-baffle-2", text: "Using the blank swab brush, swab the baffles with a patting motion. Punted baffles may require a special circular swab technique." },
      { id: "step-baffle-3", text: "Do not scrape or drag the swab over the baffles because it will leave a buildup of lubricant." },
    ],
  },
  {
    id: "sec-swab-mould",
    title: "Swab the Mould-Side Forming Equipment",
    kind: "steps",
    steps: [
      { id: "step-mould-1", text: "When swabbing both blank side and mould side, use the swab cycle button. For an O-I forming machine, push in the Mould Side Inhibit safety switch to disable Run Mould Side Inhibit functions from the INI file." },
      { id: "step-mould-2", text: "Wait until the moulds are fully open and the takeout arm has stopped over the deadplate before swabbing." },
      { id: "step-mould-3", text: "Swab the top of the moulds with a very dry swab. Place the swab on top of the inside mould and pat it lightly outward across the top of the moulds. Avoid swabbing over the cooling holes." },
      { id: "step-mould-4", text: "Swab the mould shoulders and body decorations using an upward motion. Swab all cavities on one side, then the other side." },
      { id: "step-mould-5", text: "Swab bottom plates with a semi-dry swab. Place the swab on the inside bottom plate, and lightly drag it outward using a sliding motion." },
    ],
  },
  {
    id: "sec-wrapup",
    title: "Upon Completion of Tasks",
    kind: "steps",
    steps: [
      { id: "step-wrap-1", text: "Perform basic housekeeping. Clean up the work space, tools and equipment, dispose of trash, put tools and equipment in assigned area." },
      { id: "step-wrap-2", text: "Record and report findings and results." },
      { id: "step-wrap-3", text: "Follow appropriate instructions for notification of findings and results relating to specifications, targets and/or reaction limits." },
    ],
  },
];

const cleanDraft = {
  title: "Manual Swabbing of a Forming Machine",
  sourcePdf: "medium-forming-swabbing.pdf",
  sections: cleanSections,
};

// --- Corrupted variant ---
function deepClone(o) { return JSON.parse(JSON.stringify(o)); }
const corrupted = deepClone(cleanDraft);

// (B) Drop the critical safety step "Do not put thumb through ring" from sec-swab-section
const swabSection = corrupted.sections.find((s) => s.id === "sec-swab-section");
const beforeLen = swabSection.steps.length;
swabSection.steps = swabSection.steps.filter((st) => st.id !== "step-swab-5-safety");
if (swabSection.steps.length !== beforeLen - 1) throw new Error("Corruption B failed");

// (C) Swap the Swab-Cycle-Switch photo from step-swab-3 (where it belongs) to step-mould-5 (bottom plates, totally unrelated)
const stepSwab3 = corrupted.sections.find((s) => s.id === "sec-swab-section").steps.find((st) => st.id === "step-swab-3");
const photoIdx = stepSwab3.photos.findIndex((p) => p.id === "photo-swab-cycle-switch");
if (photoIdx === -1) throw new Error("Corruption C failed: photo not on source step");
const movedPhoto = stepSwab3.photos.splice(photoIdx, 1)[0];
const targetStep = corrupted.sections.find((s) => s.id === "sec-swab-mould").steps.find((st) => st.id === "step-mould-5");
targetStep.photos = (targetStep.photos ?? []).concat(movedPhoto);

const expectedDefects = {
  omission: {
    expectedFlag: "draft is missing the critical safety warning 'do not put your thumb/finger through the ring on the swab brush handle' which appears in the source on pages 5, 7, 11, 15",
    sourceLocation: "appears verbatim on pages 5, 7, 11, 15 of source",
    droppedFrom: "sec-swab-section",
    droppedStepId: "step-swab-5-safety",
  },
  anchoring: {
    expectedFlag: "photo 'Swab Cycle Switch' is anchored to step-mould-5 ('Swab bottom plates with a semi-dry swab…') but its caption clearly describes the section control panel switch from sec-swab-section step 3",
    photoId: "photo-swab-cycle-switch",
    truthfulAnchor: { sectionId: "sec-swab-section", stepId: "step-swab-3" },
    wrongAnchor: { sectionId: "sec-swab-mould", stepId: "step-mould-5" },
  },
};

await writeFile(join(OUT, "draft.clean.json"), JSON.stringify(cleanDraft, null, 2));
await writeFile(join(OUT, "draft.corrupted.json"), JSON.stringify(corrupted, null, 2));
await writeFile(join(OUT, "expected-defects.json"), JSON.stringify(expectedDefects, null, 2));

console.log("Clean draft:");
console.log(`  sections: ${cleanDraft.sections.length}`);
console.log(`  steps: ${cleanDraft.sections.reduce((n, s) => n + s.steps.length, 0)}`);
console.log(`  photos: ${cleanDraft.sections.reduce((n, s) => n + s.steps.reduce((m, st) => m + (st.photos?.length ?? 0), 0), 0)}`);
console.log("\nCorrupted draft injected:");
console.log("  (B) dropped step:", expectedDefects.omission.droppedStepId, "from", expectedDefects.omission.droppedFrom);
console.log("  (C) moved photo:", expectedDefects.anchoring.photoId, "→", expectedDefects.anchoring.wrongAnchor.stepId);
