'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

type NavItem = 'home' | 'graph' | 'files' | 'publish' | 'account'

interface AppSidebarProps {
  children: (activeNav: NavItem) => React.ReactNode
  onSignOut?: () => void
}

const NAV_ITEMS: Array<{ key: NavItem; label: string; href?: string; icon: React.ReactNode }> = [
  {
    key: 'home',
    label: 'Home',
    href: '/home',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3">
        <path d="M2 7l7-5 7 5v8a1 1 0 01-1 1H3a1 1 0 01-1-1V7z" />
        <path d="M6 16V9h6v7" />
      </svg>
    ),
  },
  {
    key: 'graph',
    label: 'Graph',
    href: '/graph',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3">
        <circle cx="9" cy="5" r="2" />
        <circle cx="4" cy="13" r="2" />
        <circle cx="14" cy="13" r="2" />
        <path d="M7.5 6.5L5.5 11.5M10.5 6.5L12.5 11.5M6 13h6" />
      </svg>
    ),
  },
  {
    key: 'files',
    label: 'Files',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3">
        <path d="M2 5V15H16V5H2Z" />
        <path d="M2 5L4.5 2H8L9.5 5" />
      </svg>
    ),
  },
  {
    key: 'publish',
    label: 'Published',
    href: '/publish',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3">
        <circle cx="9" cy="9" r="7" />
        <path d="M9 5v4l3 2" />
      </svg>
    ),
  },
]

export default function AppSidebar({ children }: AppSidebarProps) {
  const [activeNav, setActiveNav] = useState<NavItem>('home')
  const [filesPanelOpen, setFilesPanelOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  function handleNav(item: NavItem) {
    if (item === 'files') {
      setFilesPanelOpen(!filesPanelOpen)
      setActiveNav('files')
    } else {
      setFilesPanelOpen(false)
      setActiveNav(item)
      if (NAV_ITEMS.find(n => n.key === item)?.href) {
        router.push(NAV_ITEMS.find(n => n.key === item)!.href!)
      }
    }
  }

  const isActive = (key: NavItem) => {
    if (key === 'files') return activeNav === 'files'
    const item = NAV_ITEMS.find(n => n.key === key)
    return item?.href ? pathname === item.href : activeNav === key
  }

  return (
    <div className="flex h-full">
      {/* Icon rail */}
      <nav className="w-12 shrink-0 bg-[#0a0a0a] border-r border-white/[0.04] flex flex-col items-center justify-between py-3">
        <div className="space-y-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => handleNav(item.key)}
              className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all ${
                isActive(item.key)
                  ? 'bg-white/[0.08] text-white/80'
                  : 'text-neutral-600 hover:text-neutral-400 hover:bg-white/[0.04]'
              }`}
              title={item.label}
            >
              {item.icon}
            </button>
          ))}
        </div>

        {/* Bottom: Account + Sign out */}
        <div className="space-y-1">
          <Link
            href="/publish"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-neutral-600 hover:text-neutral-400 hover:bg-white/[0.04] transition-all"
            title="Settings"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3">
              <circle cx="9" cy="6" r="3" />
              <path d="M3 16c0-3.3 2.7-6 6-6s6 2.7 6 6" />
            </svg>
          </Link>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="w-9 h-9 flex items-center justify-center rounded-lg text-neutral-700 hover:text-red-400/60 hover:bg-red-400/5 transition-all"
              title="Sign out"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
                <path d="M6 2H3v12h3M11 5l3 3-3 3M7 8h7" />
              </svg>
            </button>
          </form>
        </div>
      </nav>

      {/* Files panel — slides open */}
      {filesPanelOpen && (
        <div className="w-60 shrink-0 border-r border-white/[0.04] bg-[#080808] overflow-y-auto animate-fade-up">
          {children('files')}
        </div>
      )}

      {/* Main content area — always rendered */}
      {!filesPanelOpen && (
        <div className="flex-1 overflow-y-auto">
          {children(activeNav)}
        </div>
      )}
      {filesPanelOpen && (
        <div className="flex-1 overflow-y-auto">
          {children('home')}
        </div>
      )}
    </div>
  )
}
