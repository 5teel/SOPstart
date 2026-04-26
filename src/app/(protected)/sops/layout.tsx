import type { ReactNode } from 'react'
import { PaperThemeMount } from './_theme-mount'
import { CmdKProvider } from './CmdKProvider'

export default function SopsLayout({ children }: { children: ReactNode }) {
  return (
    <CmdKProvider>
      <PaperThemeMount />
      {children}
    </CmdKProvider>
  )
}
