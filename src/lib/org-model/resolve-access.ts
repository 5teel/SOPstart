import type { ChainLink, EffectiveAccess } from '@/types/org-model'

/**
 * Pure 5-level union resolver — org -> area -> department -> role -> person.
 *
 * Translates the reference algorithm from
 * .claude/skills/sketch-findings-SOPstart/references/permission-wiring-views.md
 * ("Inheritance resolution" JS block), extended to 5 chain levels (D-06) with
 * a `personal` bucket for person-level grants (D-13, the Priya scenario).
 *
 * This is the ONE resolver every view (chart badges, wiring trace,
 * blast-radius, library-filter counts) must call — never recompute
 * inheritance per-view (RESEARCH Pattern 2).
 *
 * `chain` is the target unit's ancestor chain, root first, the unit itself
 * last. `grantsByUnit` maps each unit id appearing in the chain to the
 * collection ids granted directly to it. Pure — no I/O; callers assemble
 * both inputs from an OrgTree read + an access_grants read.
 */
export function resolveEffectiveAccess(
  chain: ChainLink[],
  grantsByUnit: Record<string, Iterable<string>>,
): EffectiveAccess {
  const direct = new Set<string>()
  const personal = new Set<string>()
  const inherited: Record<string, string> = {}

  if (chain.length === 0) return { direct, inherited, personal }

  const leaf = chain[chain.length - 1]
  const leafGrants = new Set(grantsByUnit[leaf.unitId] ?? [])

  // Additive-only (D-11): a unit's own grant is 'direct', except at person
  // level where it's 'personal' — a person-level grant never widens the
  // department's own effective access (the Priya scenario).
  if (leaf.subjectType === 'person') {
    leafGrants.forEach(g => personal.add(g))
  } else {
    leafGrants.forEach(g => direct.add(g))
  }

  // Ancestors walked root -> nearest so a nearer ancestor's source overwrites
  // a farther one for the same collection — "resolves once, source = nearest
  // ancestor". direct/personal are excluded so direct beats inherited.
  for (const ancestor of chain.slice(0, -1)) {
    const ancestorGrants = grantsByUnit[ancestor.unitId] ?? []
    for (const g of ancestorGrants) {
      if (!direct.has(g) && !personal.has(g)) {
        inherited[g] = ancestor.unitId
      }
    }
  }

  return { direct, inherited, personal }
}
