'use client'

/**
 * Phase 60 (A-07) -- the editor seam for admin surfaces. The editor chunk loads on demand
 * and is never statically imported; until it arrives the plain line shows alone. Only the
 * admin shell and the People tab import this file, so the worker download never sees it.
 */
import { lazy, Suspense, type ComponentProps } from 'react'
import { ObjectiveLine } from '@/components/shell/ObjectiveLine'

const ObjectiveEditor = lazy(() => import('@/components/requests/ObjectiveEditor').then((m) => ({ default: m.ObjectiveEditor })))

export function ObjectiveSlot(props: ComponentProps<typeof ObjectiveEditor>) {
  return (
    <Suspense fallback={props.current ? <ObjectiveLine view={props.current} prefix={props.prefix} /> : null}>
      <ObjectiveEditor {...props} />
    </Suspense>
  )
}
