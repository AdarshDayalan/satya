'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { getTheme, DEFAULT_THEME, type Theme } from '@/lib/themes'

interface CustomSettings {
  backgroundImage: string | null  // URL or data URL
  backgroundOpacity: number       // 0-1
  nodeStyle: 'dots' | 'circles' | 'squares' | 'diamonds'
  profileName: string
  profileBio: string
  profileAvatar: string | null    // URL or data URL
}

const DEFAULT_CUSTOM: CustomSettings = {
  backgroundImage: null,
  backgroundOpacity: 0.15,
  nodeStyle: 'dots',
  profileName: '',
  profileBio: '',
  profileAvatar: null,
}

interface ThemeContextType {
  theme: Theme
  themeId: string
  setThemeId: (id: string) => void
  custom: CustomSettings
  setCustom: (updates: Partial<CustomSettings>) => void
  uploadImage: (file: File, key: 'backgroundImage' | 'profileAvatar') => Promise<void>
}

const ThemeContext = createContext<ThemeContextType>({
  theme: getTheme(DEFAULT_THEME),
  themeId: DEFAULT_THEME,
  setThemeId: () => {},
  custom: DEFAULT_CUSTOM,
  setCustom: () => {},
  uploadImage: async () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useState(DEFAULT_THEME)
  const [custom, setCustomState] = useState<CustomSettings>(DEFAULT_CUSTOM)

  // Load from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('satya-theme')
    if (savedTheme) setThemeId(savedTheme)
    const savedCustom = localStorage.getItem('satya-custom')
    if (savedCustom) {
      try { setCustomState({ ...DEFAULT_CUSTOM, ...JSON.parse(savedCustom) }) } catch { /* ignore */ }
    }
  }, [])

  function handleSetTheme(id: string) {
    setThemeId(id)
    localStorage.setItem('satya-theme', id)
  }

  const setCustom = useCallback((updates: Partial<CustomSettings>) => {
    setCustomState(prev => {
      const next = { ...prev, ...updates }
      localStorage.setItem('satya-custom', JSON.stringify(next))
      return next
    })
  }, [])

  const uploadImage = useCallback(async (file: File, key: 'backgroundImage' | 'profileAvatar') => {
    // Convert to data URL for localStorage persistence (small images)
    // For large images, could use Supabase Storage instead
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      setCustom({ [key]: dataUrl })
    }
    reader.readAsDataURL(file)
  }, [setCustom])

  const theme = getTheme(themeId)

  // Apply CSS variables
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
    document.body.style.backgroundColor = theme.bg
    // Background image
    if (custom.backgroundImage) {
      document.body.style.backgroundImage = `url(${custom.backgroundImage})`
      document.body.style.backgroundSize = 'cover'
      document.body.style.backgroundPosition = 'center'
      document.body.style.backgroundAttachment = 'fixed'
    } else {
      document.body.style.backgroundImage = ''
    }
  }, [theme, custom.backgroundImage])

  return (
    <ThemeContext.Provider value={{ theme, themeId, setThemeId: handleSetTheme, custom, setCustom, uploadImage }}>
      {children}
    </ThemeContext.Provider>
  )
}
