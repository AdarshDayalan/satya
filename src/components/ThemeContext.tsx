'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { getTheme, DEFAULT_THEME, type Theme } from '@/lib/themes'

interface ThemeContextType {
  theme: Theme
  themeId: string
  setThemeId: (id: string) => void
}

const ThemeContext = createContext<ThemeContextType>({
  theme: getTheme(DEFAULT_THEME),
  themeId: DEFAULT_THEME,
  setThemeId: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useState(DEFAULT_THEME)

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('satya-theme')
    if (saved) setThemeId(saved)
  }, [])

  // Save to localStorage on change
  function handleSetTheme(id: string) {
    setThemeId(id)
    localStorage.setItem('satya-theme', id)
  }

  const theme = getTheme(themeId)

  // Apply CSS variables to document
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--bg', theme.bg)
    root.style.setProperty('--bg-secondary', theme.bgSecondary)
    root.style.setProperty('--text-primary', theme.textPrimary)
    root.style.setProperty('--text-secondary', theme.textSecondary)
    root.style.setProperty('--text-muted', theme.textMuted)
    root.style.setProperty('--border', theme.border)
    root.style.setProperty('--border-hover', theme.borderHover)
    root.style.setProperty('--accent', theme.accent)
    root.style.setProperty('--accent-soft', theme.accentSoft)
    root.style.setProperty('--graph-bg', theme.graphBg)
    root.style.setProperty('--graph-glow', theme.graphGlow)
    // Set background color on body
    document.body.style.backgroundColor = theme.bg
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, themeId, setThemeId: handleSetTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
