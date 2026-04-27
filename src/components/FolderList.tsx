import Link from 'next/link'

interface Folder {
  id: string
  name: string
  description: string | null
  confidence: number
  created_at: string
}

export default function FolderList({ folders }: { folders: Folder[] }) {
  if (folders.length === 0) return null

  return (
    <div className="space-y-2">
      <h2 className="text-[11px] font-medium text-neutral-600 uppercase tracking-widest px-1 mb-3">
        Emerging Themes
      </h2>
      <div className="space-y-1.5 stagger-children">
        {folders.map((folder) => (
          <Link
            key={folder.id}
            href={`/folders/${folder.id}`}
            className="theme-card block border border-white/[0.04] rounded-xl px-4 py-3"
          >
            <p className="text-white/80 text-[14px] font-medium">{folder.name}</p>
            {folder.description && (
              <p className="text-neutral-600 text-[12px] mt-1 line-clamp-2 leading-relaxed">
                {folder.description}
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}
