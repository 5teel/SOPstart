# SOP Title Naming Conventions

Agent instructions for naming a parsed SOP. These conventions are injected into
the parse system prompt (sop-parser.ts) and into the fallback title generator
(sop-title.ts) — edit here, both consumers pick it up.

## The shape of a good title

`<Action in gerund form> + <specific equipment/part> + <machine/area qualifier when the source names one>`

- 4–10 words, maximum 80 characters, Title Case.
- Lead with the work being performed: "Changing", "Swabbing", "Inspecting",
  "Setting Up", "Isolating". A worker scanning a list must know the task from
  the first two words.
- Name the specific equipment or part exactly as the source does — "Baffle Arm",
  "Neck Rings", "Rondot Probe" — never a vaguer substitute.
- Keep the machine, line, or area qualifier when the source states one:
  "on IS Machine 21", "AK2 Furnace", "Forming Line 3".

## Never include

- Filler openers: "SOP for", "Procedure for", "Standard Operating Procedure",
  "Work Instruction", "How to", "Document".
- Document codes (EN-FOR-03-001, JSEA 211.09.06) — codes belong in the
  `sop_number` field, not the title.
- File-format noise: version suffixes, dates, "FINAL", "v2", underscores.
- Invented specifics: if the source never names the machine, do not add one.

## Placeholders are failures

Never output "Untitled SOP", "New SOP", "Safety Procedure", or the raw
filename. If the source is too thin to name confidently, name the observable
task anyway ("Drilling Blind Thermocouple Hole — AK2 Furnace" came from a
sparse JSEA form) and let parse_notes flag the uncertainty.

## Examples

| Source signal | Good title | Bad title |
|---|---|---|
| Doc "EN-FOR-03-031 Blank Side Hanger Change.docx" | Changing the Blank Side Hanger | EN-FOR-03-031 Blank Side Hanger Change |
| JSEA form for thermocouple drilling on AK2 | Drilling a Blind Thermocouple Hole on the AK2 Furnace | Untitled SOP |
| Tabular work instruction, manual swabbing | Manually Swabbing a Forming Machine Section | SOP for Swabbing Procedure v3 FINAL |
| Voice brief about forklift pre-starts in Hamilton | Forklift Pre-Start Checks — Hamilton Site | How to Check a Forklift |
