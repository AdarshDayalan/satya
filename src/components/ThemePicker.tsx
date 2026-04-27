'use client'

import { useTheme } from './ThemeContext'
import { THEMES } from '@/lib/themes'

export default function ThemePicker() {
  const { themeId, setThemeId, theme } = useTheme()

  return (
    <div className="space-y-3">
      <label className="text-[10px] uppercase tracking-widest font-medium" style={{ color: theme.textSecondary }}>Theme</label>
      <div className="grid grid-cols-4 gap-2">
        {Object.values(THEMES).map((t) => {
          const isActive = t.id === themeId
          return (
            <button
              key={t.id}
              onClick={() => setThemeId(t.id)}
              className="text-left rounded-lg p-2 border transition-all"
              style={{
                backgroundColor: isActive ? t.accentSoft : t.bg,
                borderColor: isActive ? t.accent : t.border,
              }}
            >
              {/* Color preview dots */}
              <div className="flex gap-1 mb-1.5">
                {Object.values(t.nodeColors).slice(0, 4).map((color, i) => (
                  <div key={i} className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                ))}
              </div>
              <p className="text-[10px] font-medium" style={{ color: t.textPrimary }}>{t.name}</p>
              <p className="text-[9px]" style={{ color: t.textMuted }}>{t.description}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
