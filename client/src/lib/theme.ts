import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'
const KEY = 'scamshield_theme'

function systemTheme(): Theme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function savedTheme(): Theme | null {
  try {
    const t = localStorage.getItem(KEY)
    return t === 'light' || t === 'dark' ? t : null
  } catch {
    return null
  }
}

const THEME_COLORS: Record<Theme, string> = { light: '#f6f5fb', dark: '#0c0b16' }

function apply(theme: Theme, explicit: boolean) {
  const root = document.documentElement
  if (explicit) root.dataset.theme = theme
  else delete root.dataset.theme // follow the system
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme])
}

/** Current theme plus a toggle. Follows the OS setting until the user picks one, then remembers it. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => savedTheme() ?? systemTheme())

  // While the user hasn't chosen, keep following OS changes.
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mq) return
    const onChange = () => {
      if (!savedTheme()) {
        const t = systemTheme()
        setTheme(t)
        apply(t, false)
      }
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark'
      try {
        localStorage.setItem(KEY, next)
      } catch {
        /* storage blocked: still switch for this visit */
      }
      apply(next, true)
      return next
    })
  }, [])

  return { theme, toggle }
}
