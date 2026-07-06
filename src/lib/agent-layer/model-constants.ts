/**
 * Legacy shim — model IDs now live in the AI model registry
 * (src/lib/ai/registry.ts, single source of truth for every AI model in the
 * app). These re-exports keep existing import sites working; new code should
 * call `aiModel('<key>')` directly.
 */
import { aiModel } from '@/lib/ai/registry'

export const EMBED_MODEL = aiModel('embed')
export const SYNTHESIS_MODEL = aiModel('synthesis')
export const PARSE_TRIAGE_MODEL = aiModel('parse-triage')
export const PARSE_SIMPLE_MODEL = aiModel('parse-simple')
export const PARSE_COMPLEX_MODEL = aiModel('parse-complex')
