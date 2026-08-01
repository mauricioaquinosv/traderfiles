'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'dark' | 'light'

const ACCENT_OPTIONS = [
  { name: 'Ámbar', value: '#E8A33D', hover: '#D6922E' },
  { name: 'Esmeralda', value: '#10B981', hover: '#059669' },
  { name: 'Azul', value: '#3B82F6', hover: '#2563EB' },
  { name: 'Violeta', value: '#8B5CF6', hover: '#7C3AED' },
  { name: 'Rosa', value: '#EC4899', hover: '#DB2777' },
]

type ThemeContextType = {
  theme: Theme
  setTheme: (t: Theme) => void
  accent: string
  setAccent: (color: string) => void
  accentOptions: typeof ACCENT_OPTIONS
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark')
  const [accent, setAccentState] = useState(ACCENT_OPTIONS[0].value)

  useEffect(() => {
    const storedTheme = localStorage.getItem('theme') as Theme | null
    const storedAccent = localStorage.getItem('accent')
    if (storedTheme) applyTheme(storedTheme)
    if (storedAccent) applyAccent(storedAccent)
  }, [])

  const applyTheme = (t: Theme) => {
    document.documentElement.setAttribute('data-theme', t)
    setThemeState(t)
  }

  const applyAccent = (color: string) => {
    const option = ACCENT_OPTIONS.find((o) => o.value === color) ?? ACCENT_OPTIONS[0]
    document.documentElement.style.setProperty('--color-accent', option.value)
    document.documentElement.style.setProperty('--color-accent-hover', option.hover)
    setAccentState(color)
  }

  const setTheme = (t: Theme) => {
    applyTheme(t)
    localStorage.setItem('theme', t)
  }

  const setAccent = (color: string) => {
    applyAccent(color)
    localStorage.setItem('accent', color)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, accent, setAccent, accentOptions: ACCENT_OPTIONS }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme debe usarse dentro de ThemeProvider')
  return ctx
}