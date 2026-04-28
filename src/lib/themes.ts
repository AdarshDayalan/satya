export interface Theme {
  id: string
  name: string
  description: string
  // Background
  bg: string
  bgSecondary: string
  // Text
  textPrimary: string
  textSecondary: string
  textMuted: string
  // Borders
  border: string
  borderHover: string
  // Accent
  accent: string
  accentSoft: string
  // Node type colors
  nodeColors: {
    concept: string
    idea: string
    question: string
    evidence: string
    mechanism: string
    self: string
    raw: string
  }
  // Edge colors
  edgeDefault: string
  edgeHighlight: string
  // Graph
  graphBg: string
  graphGlow: string
  // Node style
  nodeStyle: 'dots' | 'circles' | 'squares' | 'diamonds'
}

export const THEMES: Record<string, Theme> = {
  midnight: {
    id: 'midnight',
    name: 'Midnight',
    description: 'Default dark minimal',
    bg: '#050505',
    bgSecondary: '#080808',
    textPrimary: 'rgba(255,255,255,0.85)',
    textSecondary: 'rgba(255,255,255,0.5)',
    textMuted: 'rgba(255,255,255,0.25)',
    border: 'rgba(255,255,255,0.04)',
    borderHover: 'rgba(255,255,255,0.1)',
    accent: '#a78bfa',
    accentSoft: 'rgba(167,139,250,0.15)',
    nodeColors: {
      concept: '#f472b6',
      idea: '#60a5fa',
      question: '#fbbf24',
      evidence: '#34d399',
      mechanism: '#fb923c',
      self: '#c4b5fd',
      raw: '#737373',
    },
    edgeDefault: 'rgba(255,255,255,0.03)',
    edgeHighlight: 'rgba(167,139,250,0.5)',
    graphBg: '#050505',
    graphGlow: 'rgba(120,100,200,0.04)',
    nodeStyle: 'dots',
  },

  aurora: {
    id: 'aurora',
    name: 'Aurora',
    description: 'Deep blue with northern lights',
    bg: '#0a0e1a',
    bgSecondary: '#0d1224',
    textPrimary: 'rgba(200,220,255,0.9)',
    textSecondary: 'rgba(150,180,220,0.6)',
    textMuted: 'rgba(100,130,180,0.3)',
    border: 'rgba(100,150,255,0.06)',
    borderHover: 'rgba(100,150,255,0.15)',
    accent: '#38bdf8',
    accentSoft: 'rgba(56,189,248,0.12)',
    nodeColors: {
      concept: '#c084fc',
      idea: '#38bdf8',
      question: '#fde68a',
      evidence: '#6ee7b7',
      mechanism: '#fdba74',
      self: '#a5b4fc',
      raw: '#64748b',
    },
    edgeDefault: 'rgba(100,150,255,0.04)',
    edgeHighlight: 'rgba(56,189,248,0.5)',
    graphBg: '#0a0e1a',
    graphGlow: 'rgba(56,189,248,0.05)',
    nodeStyle: 'circles',
  },

  ember: {
    id: 'ember',
    name: 'Ember',
    description: 'Warm dark with fire tones',
    bg: '#0f0908',
    bgSecondary: '#140c0a',
    textPrimary: 'rgba(255,230,210,0.9)',
    textSecondary: 'rgba(200,170,140,0.6)',
    textMuted: 'rgba(150,120,90,0.3)',
    border: 'rgba(200,100,50,0.06)',
    borderHover: 'rgba(200,100,50,0.15)',
    accent: '#f97316',
    accentSoft: 'rgba(249,115,22,0.12)',
    nodeColors: {
      concept: '#ef4444',
      idea: '#f97316',
      question: '#eab308',
      evidence: '#84cc16',
      mechanism: '#fb923c',
      self: '#fcd34d',
      raw: '#78716c',
    },
    edgeDefault: 'rgba(200,100,50,0.04)',
    edgeHighlight: 'rgba(249,115,22,0.5)',
    graphBg: '#0f0908',
    graphGlow: 'rgba(200,80,30,0.05)',
    nodeStyle: 'dots',
  },

  forest: {
    id: 'forest',
    name: 'Forest',
    description: 'Earth tones, natural green',
    bg: '#080c08',
    bgSecondary: '#0a100a',
    textPrimary: 'rgba(210,235,210,0.9)',
    textSecondary: 'rgba(160,190,160,0.6)',
    textMuted: 'rgba(110,140,110,0.3)',
    border: 'rgba(80,160,80,0.06)',
    borderHover: 'rgba(80,160,80,0.15)',
    accent: '#22c55e',
    accentSoft: 'rgba(34,197,94,0.12)',
    nodeColors: {
      concept: '#a3e635',
      idea: '#4ade80',
      question: '#fbbf24',
      evidence: '#2dd4bf',
      mechanism: '#86efac',
      self: '#d9f99d',
      raw: '#6b7280',
    },
    edgeDefault: 'rgba(80,160,80,0.04)',
    edgeHighlight: 'rgba(34,197,94,0.4)',
    graphBg: '#080c08',
    graphGlow: 'rgba(34,197,94,0.04)',
    nodeStyle: 'circles',
  },

  rose: {
    id: 'rose',
    name: 'Rosé',
    description: 'Soft pink, elegant',
    bg: '#0f0a0c',
    bgSecondary: '#140d10',
    textPrimary: 'rgba(255,220,230,0.9)',
    textSecondary: 'rgba(200,160,175,0.6)',
    textMuted: 'rgba(150,110,130,0.3)',
    border: 'rgba(200,100,140,0.06)',
    borderHover: 'rgba(200,100,140,0.15)',
    accent: '#f472b6',
    accentSoft: 'rgba(244,114,182,0.12)',
    nodeColors: {
      concept: '#fb7185',
      idea: '#f0abfc',
      question: '#fde68a',
      evidence: '#86efac',
      mechanism: '#fda4af',
      self: '#f9a8d4',
      raw: '#9ca3af',
    },
    edgeDefault: 'rgba(200,100,140,0.04)',
    edgeHighlight: 'rgba(244,114,182,0.5)',
    graphBg: '#0f0a0c',
    graphGlow: 'rgba(244,114,182,0.04)',
    nodeStyle: 'diamonds',
  },

  void: {
    id: 'void',
    name: 'Void',
    description: 'Pure black, high contrast',
    bg: '#000000',
    bgSecondary: '#050505',
    textPrimary: 'rgba(255,255,255,0.95)',
    textSecondary: 'rgba(255,255,255,0.5)',
    textMuted: 'rgba(255,255,255,0.2)',
    border: 'rgba(255,255,255,0.06)',
    borderHover: 'rgba(255,255,255,0.15)',
    accent: '#ffffff',
    accentSoft: 'rgba(255,255,255,0.08)',
    nodeColors: {
      concept: '#ffffff',
      idea: '#a1a1aa',
      question: '#d4d4d8',
      evidence: '#71717a',
      mechanism: '#a1a1aa',
      self: '#fafafa',
      raw: '#52525b',
    },
    edgeDefault: 'rgba(255,255,255,0.03)',
    edgeHighlight: 'rgba(255,255,255,0.3)',
    graphBg: '#000000',
    graphGlow: 'rgba(255,255,255,0.02)',
    nodeStyle: 'squares',
  },

  neon: {
    id: 'neon',
    name: 'Neon',
    description: 'Cyberpunk, vivid colors',
    bg: '#05050a',
    bgSecondary: '#08081a',
    textPrimary: 'rgba(220,220,255,0.9)',
    textSecondary: 'rgba(150,150,220,0.6)',
    textMuted: 'rgba(100,100,180,0.3)',
    border: 'rgba(130,80,255,0.08)',
    borderHover: 'rgba(130,80,255,0.2)',
    accent: '#8b5cf6',
    accentSoft: 'rgba(139,92,246,0.15)',
    nodeColors: {
      concept: '#f43f5e',
      idea: '#06b6d4',
      question: '#eab308',
      evidence: '#10b981',
      mechanism: '#8b5cf6',
      self: '#d946ef',
      raw: '#6366f1',
    },
    edgeDefault: 'rgba(130,80,255,0.05)',
    edgeHighlight: 'rgba(139,92,246,0.6)',
    graphBg: '#05050a',
    graphGlow: 'rgba(139,92,246,0.06)',
    nodeStyle: 'diamonds',
  },

  paper: {
    id: 'paper',
    name: 'Paper',
    description: 'Light, academic feel',
    bg: '#1a1a1a',
    bgSecondary: '#1f1f1f',
    textPrimary: 'rgba(230,225,215,0.9)',
    textSecondary: 'rgba(180,175,165,0.6)',
    textMuted: 'rgba(130,125,115,0.3)',
    border: 'rgba(200,190,170,0.08)',
    borderHover: 'rgba(200,190,170,0.15)',
    accent: '#d97706',
    accentSoft: 'rgba(217,119,6,0.12)',
    nodeColors: {
      concept: '#dc2626',
      idea: '#2563eb',
      question: '#d97706',
      evidence: '#059669',
      mechanism: '#7c3aed',
      self: '#a855f7',
      raw: '#6b7280',
    },
    edgeDefault: 'rgba(200,190,170,0.04)',
    edgeHighlight: 'rgba(217,119,6,0.4)',
    graphBg: '#1a1a1a',
    graphGlow: 'rgba(217,119,6,0.03)',
    nodeStyle: 'circles',
  },
}

export const DEFAULT_THEME = 'midnight'

export function getTheme(id: string): Theme {
  return THEMES[id] || THEMES[DEFAULT_THEME]
}
