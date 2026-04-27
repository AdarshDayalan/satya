'use client'

interface Attachment {
  id: string
  kind: 'link' | 'image' | 'video' | 'file'
  url: string
  title: string | null
  description: string | null
  thumbnail_url: string | null
}

export default function AttachmentCard({
  attachment,
  onDelete,
}: {
  attachment: Attachment
  onDelete?: (id: string) => void
}) {
  const { kind, url, title, description, thumbnail_url } = attachment

  if (kind === 'image') {
    return (
      <div className="group relative rounded-lg overflow-hidden border border-white/[0.06]">
        <img src={url} alt={title || ''} className="w-full h-32 object-cover bg-white/[0.02]" loading="lazy" />
        {onDelete && (
          <button
            onClick={() => onDelete(attachment.id)}
            className="absolute top-1 right-1 p-1 rounded bg-black/60 text-neutral-400 hover:text-red-400 opacity-0 group-hover:opacity-100 text-[10px]"
          >✕</button>
        )}
      </div>
    )
  }

  if (kind === 'video') {
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/)
    if (ytMatch) {
      return (
        <div className="group relative">
          <div className="rounded-lg overflow-hidden border border-white/[0.06] bg-white/[0.02]">
            <div className="relative aspect-video">
              <img
                src={`https://img.youtube.com/vi/${ytMatch[1]}/mqdefault.jpg`}
                alt={title || ''}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/20 transition-colors"
              >
                <span className="text-white/90 text-2xl">▶</span>
              </a>
            </div>
            {title && <p className="px-2.5 py-1.5 text-[11px] text-white/60 truncate">{title}</p>}
          </div>
          {onDelete && (
            <button
              onClick={() => onDelete(attachment.id)}
              className="absolute top-1 right-1 p-1 rounded bg-black/60 text-neutral-400 hover:text-red-400 opacity-0 group-hover:opacity-100 text-[10px]"
            >✕</button>
          )}
        </div>
      )
    }
    // Generic video
    return (
      <div className="group relative">
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="block rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 hover:bg-white/[0.04]">
          <p className="text-[11px] text-white/60">{title || url}</p>
        </a>
        {onDelete && (
          <button onClick={() => onDelete(attachment.id)}
            className="absolute top-1 right-1 p-1 rounded bg-black/60 text-neutral-400 hover:text-red-400 opacity-0 group-hover:opacity-100 text-[10px]">✕</button>
        )}
      </div>
    )
  }

  // Link card
  return (
    <div className="group relative">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] overflow-hidden hover:bg-white/[0.04] transition-colors"
      >
        {thumbnail_url && (
          <img src={thumbnail_url} alt="" className="w-16 h-16 object-cover shrink-0 bg-white/[0.02]" loading="lazy" />
        )}
        <div className="py-2 pr-2.5 min-w-0 flex-1">
          <p className="text-[12px] text-white/70 font-medium truncate">{title || url}</p>
          {description && (
            <p className="text-[11px] text-neutral-600 line-clamp-2 mt-0.5 leading-snug">{description}</p>
          )}
          <p className="text-[10px] text-neutral-700 mt-1 truncate">{new URL(url).hostname}</p>
        </div>
      </a>
      {onDelete && (
        <button
          onClick={(e) => { e.preventDefault(); onDelete(attachment.id) }}
          className="absolute top-1 right-1 p-1 rounded bg-black/60 text-neutral-400 hover:text-red-400 opacity-0 group-hover:opacity-100 text-[10px]"
        >✕</button>
      )}
    </div>
  )
}
