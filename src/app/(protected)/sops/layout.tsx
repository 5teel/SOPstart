import type { ReactNode } from 'react'
import { PaperThemeMount } from './_theme-mount'

export default function SopsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PaperThemeMount />
      {children}
    </>
  )
}
