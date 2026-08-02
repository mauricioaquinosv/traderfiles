'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'dark' | 'light'

// Paleta portada 1:1 del mockup HTML (ACCENT_PALETTE)
const ACCENT_PALETTE = [
  { value: '#4A47A3', name: 'Indigo profundo' },
  { value: '#5B3E96', name: 'Violeta oscuro' },
  { value: '#6B4384', name: 'Ciruela' },
  { value: '#8A5A1F', name: 'Bronce oscuro' },
  { value: '#8A4A2E', name: 'Sienna quemado' },
  { value: '#1F6B5C', name: 'Teal oscuro' },
  { value: '#4A5568', name: 'Gris pizarra' },
  { value: '#8A3B5C', name: 'Vino rosado' },
  { value: '#6B5B35', name: 'Oliva dorado' },
  { value: '#7A4A2A', name: 'Cobre oscuro' },
  { value: '#3A4A6B', name: 'Grafito azulado' },
  { value: '#2E5C3E', name: 'Verde bosque oscuro' },
  { value: '#6B1F3A', name: 'Borgoña' },
  { value: '#1F4F5C', name: 'Azul petróleo' },
  { value: '#8A5A2E', name: 'Ámbar quemado' },
  { value: '#5A3E6B', name: 'Púrpura ahumado' },
  { value: '#4A5C2E', name: 'Verde oliva profundo' },
  { value: '#7A2E2E', name: 'Rojo ladrillo oscuro' },
  { value: '#1E2A5C', name: 'Azul medianoche' },
  { value: '#4A3324', name: 'Marrón café' },
]

// ---- Helpers de color (portados del mockup) ----
function hexToRgbObj(hex: string) {
  let h = hex.trim().replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  return { r: parseInt(h.substring(0, 2), 16), g: parseInt(h.substring(2, 4), 16), b: parseInt(h.substring(4, 6), 16) }
}
function rgbToHex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
}
function shadeColor(hex: string, percent: number) {
  const { r, g, b } = hexToRgbObj(hex)
  const t = percent < 0 ? 0 : 255
  const p = Math.abs(percent)
  return rgbToHex(r + (t - r) * p, g + (t - g) * p, b + (t - b) * p)
}
function hexToRgba(hex: string, alpha: number) {
  const { r, g, b } = hexToRgbObj(hex)
  return `rgba(${r},${g},${b},${alpha})`
}

type ThemeContextType = {
  theme: Theme
  setTheme: (t: Theme) => void
  accent: string
  setAccent: (color: string) => void
  accentOptions: typeof ACCENT_PALETTE
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark')
  const [accent, setAccentState] = useState(ACCENT_PALETTE[0].value)

  useEffect(() => {
    const storedTheme = localStorage.getItem('theme') as Theme | null
    const storedAccent = localStorage.getItem('accent')
    if (storedTheme) document.documentElement.setAttribute('data-theme', storedTheme)
    if (storedTheme) setThemeState(storedTheme)
    applyAccent(storedAccent || ACCENT_PALETTE[0].value, storedTheme || 'dark')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Aplica el color de acento (y deriva hover / accent-bg / blob-1) según el tema activo
  const applyAccent = (color: string, activeTheme: Theme) => {
    const isLight = activeTheme === 'light'
    const hover = shadeColor(color, isLight ? -0.18 : 0.22)
    const root = document.documentElement
    root.style.setProperty('--color-accent', color)
    root.style.setProperty('--color-accent-hover', hover)
    root.style.setProperty('--color-accent-bg', hexToRgba(color, isLight ? 0.12 : 0.16))
    root.style.setProperty('--color-blob-1', hexToRgba(color, isLight ? 0.18 : 0.30))
    setAccentState(color)
  }

  const setTheme = (t: Theme) => {
    document.documentElement.setAttribute('data-theme', t)
    setThemeState(t)
    localStorage.setItem('theme', t)
    // Recalcula hover/blob porque cambian según el tema (isLight)
    applyAccent(accent, t)
  }

  const setAccent = (color: string) => {
    applyAccent(color, theme)
    localStorage.setItem('accent', color)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, accent, setAccent, accentOptions: ACCENT_PALETTE }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme debe usarse dentro de ThemeProvider')
  return ctx
}