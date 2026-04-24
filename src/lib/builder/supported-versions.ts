// Monotonic integer version pin (SPEC constraint). Any future schema
// change bumps this array; worker falls back to linear renderer when
// section.layout_version is not in the set.
export const SUPPORTED_LAYOUT_VERSIONS = [1] as const
export const CURRENT_LAYOUT_VERSION = 1 as const
