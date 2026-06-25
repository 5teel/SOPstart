/**
 * Phase 23 — AI field layer barrel.
 *
 * Re-exports the unified registry + types for consumers.
 *
 * BACKEND/SERVER-ONLY: Do NOT import from client components.
 *
 * For field registrations (to populate the registry), import:
 *   import '@/lib/ai-fields/registrations'
 */
export {
  registerField,
  getField,
  getAllFields,
  type FieldDescriptor,
  type FieldContext,
  type StakeLevel,
  type WriteResult,
} from './registry'
