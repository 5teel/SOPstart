// ADR-0023: the clear version shows the source's hazard pictograms with its hazard section, and Jev puts each
// sign on the steps whose work exposes the worker to that hazard. The source never links signs to steps, so
// every placement is inferred: each one is listed for the document owner, and nothing reaches workers until
// an admin approves the clear version (ADR-0015).
import { jevAsk, jevPool, type JevAnswer, type JevQuestion, type JevUsage } from '@/lib/ai/jev'
import type { ClearVersion } from './enhance-sop'

export const SIGN_BAR = 0.9 // inferred, so stricter than the step checks
export interface Pictogram { label: string | null; path: string }

const noulOf = (a: JevAnswer | undefined) => (a?.type === 'noul' ? a.noul : 0)

/** Pictogram labels from the structured source text, by image index: «Hot Surface» [IMG 3]. */
export function pictogramLabels(sourceText: string): Map<number, string> {
  const out = new Map<number, string>()
  for (const m of sourceText.matchAll(/«([^»]{1,40})»\s*\[IMG (\d+)\]/g)) out.set(Number(m[2]), m[1].trim())
  return out
}

/** Puts the pictograms on the clear hazards section and the matching signs on its steps (mutates `clear`). */
export async function placeSigns(clear: ClearVersion, pictos: Pictogram[]): Promise<void> {
  if (!pictos.length || !clear.sections.length) return
  const home = clear.sections.find((s) => s.type === 'hazards') ?? clear.sections[0]
  home.image_paths = pictos.map((p) => p.path)

  const signs = pictos.filter((p): p is { label: string; path: string } => !!p.label)
  const steps = clear.sections
    .filter((s) => ['procedure', 'cleanup', 'emergency'].includes(s.type))
    .flatMap((s) => s.steps.map((st, i) => ({ section: s.title, n: i + 1, st })))
  if (!signs.length || !steps.length) return

  const hits = signs.map(() => [] as typeof steps)
  const usage: JevUsage = { inputTokens: 0, calls: 0 }
  try {
    await jevPool(steps, 8, async (x) => {
      const state = [`SECTION: ${x.section}`, `STEP: ${x.st.text}`, x.st.warning && `WARNING ON THIS STEP: ${x.st.warning}`, x.st.caution && `CAUTION ON THIS STEP: ${x.st.caution}`]
        .filter(Boolean)
        .join('\n')
      const questions = Object.fromEntries(
        signs.map((p, k) => [
          `h${k}`,
          { type: 'noul', instructions: `Hazard sign "${p.label}". While doing this STEP, is the worker directly exposed to the "${p.label}" hazard?`, criteria: { true: `Exposed to ${p.label} at this step`, false: `Not exposed to ${p.label} at this step` } },
        ]),
      ) as Record<string, JevQuestion>
      const a = await jevAsk(state, questions, usage)
      signs.forEach((_, k) => { if (noulOf(a[`h${k}`]) >= SIGN_BAR) hits[k].push(x) })
    })
  } catch (e) {
    clear.openItems.push(`Hazard signs were not placed on steps (${e instanceof Error ? e.message : String(e)}); they show with the hazards only.`)
    return
  }

  let placed = 0
  signs.forEach((p, k) => {
    // A sign that fits most steps is about the whole job: it stays with the hazards only.
    if (!hits[k].length || hits[k].length > steps.length / 2) return
    placed++
    for (const x of hits[k]) (x.st.signs ??= []).push(p)
    clear.openItems.push(`Hazard sign "${p.label}" was placed on ${hits[k].map((x) => `${x.section} step ${x.n}`).join(', ')} by the classifier. The source does not link signs to steps: confirm before approving.`)
  })
  if (!placed) clear.openItems.push(`Hazard signs: the source does not say which steps each sign applies to, and the classifier could not tell with confidence, so the ${signs.length} signs show with the hazards only. Site to confirm which signs apply at which steps.`)
}
