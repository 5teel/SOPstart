import { PaperThemeMount } from '@/app/_theme-mount'

export default function ActivityLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PaperThemeMount />
      {children}
    </>
  )
}
