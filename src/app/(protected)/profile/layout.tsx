import { PaperThemeMount } from '@/app/_theme-mount'

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PaperThemeMount />
      {children}
    </>
  )
}
