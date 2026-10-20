'use client'

import { useEffect } from 'react'

/** Marks each `[data-reveal]` section `data-in` the first time it scrolls into view, which starts its CSS animations. */
export function Reveal() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (!e.isIntersecting) return
        e.target.setAttribute('data-in', '')
        io.unobserve(e.target)
      }),
      { threshold: 0.25 },
    )
    document.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])
  return null
}
