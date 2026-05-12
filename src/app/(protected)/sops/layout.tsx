import type { ReactNode } from 'react'
import { CmdKProvider } from './CmdKProvider'

export default function SopsLayout({ children }: { children: ReactNode }) {
  return <CmdKProvider>{children}</CmdKProvider>
}
