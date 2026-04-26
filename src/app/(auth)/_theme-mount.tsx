'use client'
import { useEffect } from 'react'

export function PaperThemeMount() {
  useEffect(() => {
    const prev = document.body.getAttribute('data-theme')
    document.body.setAttribute('data-theme', 'paper')
    return () => {
      if (prev === null) document.body.removeAttribute('data-theme')
      else document.body.setAttribute('data-theme', prev)
    }
  }, [])
  return null
}
