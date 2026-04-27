'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface QueueItem {
  id: string
  status: string
  source_type: string
  raw_content: string
  created_at: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'queued', color: 'text-neutral-500' },
  processing: { label: 'extracting...', color: 'text-amber-400/70' },
  processed: { label: 'done', color: 'text-green-400/60' },
  failed: { label: 'failed', color: 'text-red-400/60' },
}

export default function ProcessingQueue() {
  const [items, setItems] = useState<QueueItem[]>([])
  const router = useRouter()
  const [supabase] = useState(() => createClient())

  // Fetch once on mount
  useEffect(() => {
    supabase
      .from('inputs')
      .select('id, status, source_type, raw_content, created_at')
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => setItems(data ?? []))
  }, [supabase])

  // Realtime subscription — no polling
  useEffect(() => {
    const channel = supabase
      .channel('processing-queue')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'inputs' },
        (payload) => {
          const inserted = payload.new as QueueItem
          if (inserted.status === 'pending' || inserted.status === 'processing') {
            setItems(prev => [inserted, ...prev])
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'inputs' },
        (payload) => {
          const updated = payload.new as QueueItem
          if (updated.status === 'processed' || updated.status === 'failed') {
            setItems(prev => prev.filter(i => i.id !== updated.id))
            router.refresh()
          } else {
            setItems(prev =>
              prev.map(i => i.id === updated.id ? { ...i, status: updated.status } : i)
            )
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase, router])

  if (items.length === 0) return null

  return (
    <div className="space-y-2 pb-4 border-b border-white/[0.04]">
      <h3 className="text-[10px] font-medium text-neutral-600 uppercase tracking-widest px-3">
        Processing
      </h3>
      {items.map((item) => {
        const config = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending
        const preview = item.raw_content.slice(0, 40) + (item.raw_content.length > 40 ? '…' : '')

        return (
          <Link
            key={item.id}
            href={`/inputs/${item.id}`}
            className="block px-3 py-2 rounded-lg hover:bg-white/[0.03] transition-colors"
          >
            <p className="text-[12px] text-white/50 line-clamp-1">{preview}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-[10px] ${config.color}`}>
                {item.status === 'processing' ? (
                  <span className="animate-pulse-soft">{config.label}</span>
                ) : (
                  config.label
                )}
              </span>
              {item.status === 'processing' && (
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400/60 animate-pulse-soft" />
              )}
            </div>
          </Link>
        )
      })}
    </div>
  )
}
