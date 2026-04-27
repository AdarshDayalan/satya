'use client'

import { useRef } from 'react'
import { useTheme } from './ThemeContext'
import { THEMES } from '@/lib/themes'

export default function ThemePicker() {
  const { themeId, setThemeId, theme, custom, setCustom, uploadImage } = useTheme()
  const bgInputRef = useRef<HTMLInputElement>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="space-y-5">
      {/* Theme grid */}
      <div className="space-y-2">
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
                <div className="flex gap-1 mb-1.5">
                  {Object.values(t.nodeColors).slice(0, 4).map((color, i) => (
                    <div key={i} className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                  ))}
                </div>
                <p className="text-[10px] font-medium" style={{ color: t.textPrimary }}>{t.name}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Node style */}
      <div className="space-y-2">
        <label className="text-[10px] uppercase tracking-widest font-medium" style={{ color: theme.textSecondary }}>Node Style</label>
        <div className="flex gap-2">
          {(['dots', 'circles', 'squares', 'diamonds'] as const).map((style) => (
            <button
              key={style}
              onClick={() => setCustom({ nodeStyle: style })}
              className={`px-3 py-1.5 text-[11px] rounded-lg border transition-all ${
                custom.nodeStyle === style
                  ? 'border-white/[0.15] text-white/70 bg-white/[0.06]'
                  : 'border-white/[0.06] text-neutral-600 hover:text-neutral-400'
              }`}
            >
              {style}
            </button>
          ))}
        </div>
      </div>

      {/* Background image */}
      <div className="space-y-2">
        <label className="text-[10px] uppercase tracking-widest font-medium" style={{ color: theme.textSecondary }}>Background</label>
        <div className="flex items-center gap-2">
          <button
            onClick={() => bgInputRef.current?.click()}
            className="px-3 py-1.5 text-[11px] text-neutral-500 border border-white/[0.06] rounded-lg hover:text-white/60"
          >
            {custom.backgroundImage ? 'change image' : 'upload image'}
          </button>
          {custom.backgroundImage && (
            <button
              onClick={() => setCustom({ backgroundImage: null })}
              className="px-3 py-1.5 text-[11px] text-neutral-600 hover:text-red-400/70"
            >
              remove
            </button>
          )}
          <input
            ref={bgInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) uploadImage(file, 'backgroundImage')
            }}
          />
        </div>
        {custom.backgroundImage && (
          <div className="space-y-1">
            <div className="w-full h-16 rounded-lg bg-cover bg-center border border-white/[0.06]" style={{ backgroundImage: `url(${custom.backgroundImage})` }} />
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-neutral-600">opacity</span>
              <input
                type="range"
                min="0.05"
                max="0.5"
                step="0.05"
                value={custom.backgroundOpacity}
                onChange={(e) => setCustom({ backgroundOpacity: parseFloat(e.target.value) })}
                className="flex-1 accent-purple-400"
              />
              <span className="text-[10px] text-neutral-600 w-6">{Math.round(custom.backgroundOpacity * 100)}%</span>
            </div>
          </div>
        )}
      </div>

      {/* Profile */}
      <div className="space-y-2">
        <label className="text-[10px] uppercase tracking-widest font-medium" style={{ color: theme.textSecondary }}>Profile</label>
        <div className="flex items-center gap-3">
          <button onClick={() => avatarInputRef.current?.click()} className="shrink-0">
            {custom.profileAvatar ? (
              <img src={custom.profileAvatar} alt="" className="w-10 h-10 rounded-full object-cover border border-white/[0.08]" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-[11px] text-neutral-600">+</div>
            )}
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) uploadImage(file, 'profileAvatar')
            }}
          />
          <div className="flex-1 space-y-1.5">
            <input
              value={custom.profileName}
              onChange={(e) => setCustom({ profileName: e.target.value })}
              placeholder="your name"
              className="w-full px-2 py-1 bg-white/[0.04] border border-white/[0.06] rounded text-white/80 text-[12px] focus:outline-none focus:border-white/[0.12] placeholder-neutral-600"
            />
            <input
              value={custom.profileBio}
              onChange={(e) => setCustom({ profileBio: e.target.value })}
              placeholder="what do you explore?"
              className="w-full px-2 py-1 bg-white/[0.04] border border-white/[0.06] rounded text-white/80 text-[11px] focus:outline-none focus:border-white/[0.12] placeholder-neutral-600"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
