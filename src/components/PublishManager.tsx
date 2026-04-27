'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Profile {
  id: string
  slug: string
  display_name: string
  bio: string
}

interface Node {
  id: string
  content: string
  type: string
}

interface Folder {
  id: string
  name: string
  description: string | null
}

const typeColors: Record<string, string> = {
  idea: 'text-blue-400/60',
  question: 'text-amber-400/60',
  source: 'text-green-400/60',
  synthesis: 'text-purple-400/60',
  raw: 'text-neutral-500',
}

function generateSlug(email: string): string {
  return email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 39) || 'user'
}

export default function PublishManager({
  profile: initialProfile,
  userEmail,
  nodes,
  folders,
  publishedNodeIds: initialNodeIds,
  publishedFolderIds: initialFolderIds,
}: {
  profile: Profile | null
  userEmail: string
  nodes: Node[]
  folders: Folder[]
  publishedNodeIds: string[]
  publishedFolderIds: string[]
}) {
  const [slug, setSlug] = useState(initialProfile?.slug ?? generateSlug(userEmail))
  const [displayName, setDisplayName] = useState(initialProfile?.display_name ?? userEmail.split('@')[0])
  const [bio, setBio] = useState(initialProfile?.bio ?? '')
  const [saving, setSaving] = useState(false)
  const [profileSaved, setProfileSaved] = useState(!!initialProfile)
  const [publishedNodes, setPublishedNodes] = useState<Set<string>>(new Set(initialNodeIds))
  const [publishedFolders, setPublishedFolders] = useState<Set<string>>(new Set(initialFolderIds))
  const [copied, setCopied] = useState(false)
  const [saveError, setSaveError] = useState('')
  const router = useRouter()

  async function saveProfile() {
    setSaving(true)
    setSaveError('')
    const res = await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: slug.toLowerCase().trim(), display_name: displayName, bio }),
    })
    if (res.ok) {
      setProfileSaved(true)
      router.refresh()
    } else {
      const data = await res.json()
      setSaveError(data.error?.includes('slug') ? 'slug already taken — try another' : (data.error || 'failed to save'))
    }
    setSaving(false)
  }

  async function toggleNode(nodeId: string) {
    const isPublished = publishedNodes.has(nodeId)
    const action = isPublished ? 'unpublish' : 'publish'

    const next = new Set(publishedNodes)
    if (isPublished) next.delete(nodeId)
    else next.add(nodeId)
    setPublishedNodes(next)

    await fetch('/api/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, node_id: nodeId }),
    })
  }

  async function toggleFolder(folderId: string) {
    const isPublished = publishedFolders.has(folderId)
    const action = isPublished ? 'unpublish' : 'publish'

    const next = new Set(publishedFolders)
    if (isPublished) next.delete(folderId)
    else next.add(folderId)
    setPublishedFolders(next)

    await fetch('/api/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, folder_id: folderId }),
    })
  }

  function copyLink() {
    navigator.clipboard.writeText(`${window.location.origin}/s/${slug}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-10">
      {/* Profile setup */}
      <div className="space-y-4 animate-fade-up">
        <h2 className="text-[11px] font-medium text-neutral-600 uppercase tracking-widest">
          Your Public Profile
        </h2>

        <div className="space-y-3">
          <div>
            <label className="text-[11px] text-neutral-600 block mb-1">slug</label>
            <div className="flex items-center gap-0">
              <span className="text-[13px] text-neutral-700 px-3 py-2 bg-white/[0.02] border border-r-0 border-white/[0.06] rounded-l-lg">
                /s/
              </span>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="your-name"
                className="flex-1 px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-r-lg text-white/90 placeholder-neutral-600 focus:outline-none focus:border-white/[0.12] text-[13px]"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] text-neutral-600 block mb-1">display name</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your Name"
              className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg text-white/90 placeholder-neutral-600 focus:outline-none focus:border-white/[0.12] text-[13px]"
            />
          </div>

          <div>
            <label className="text-[11px] text-neutral-600 block mb-1">bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="what do you think about?"
              rows={2}
              className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg text-white/90 placeholder-neutral-600 resize-none focus:outline-none focus:border-white/[0.12] text-[13px] leading-relaxed"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={saveProfile}
              disabled={saving || !slug.trim() || !displayName.trim()}
              className="px-4 py-1.5 text-xs font-medium text-white/80 bg-white/[0.08] rounded-lg hover:bg-white/[0.12] border border-white/[0.08] transition-all disabled:opacity-30"
            >
              {saving ? 'saving...' : profileSaved ? 'update profile' : 'create profile'}
            </button>
            {profileSaved && slug && (
              <button
                onClick={copyLink}
                className="px-3 py-1.5 text-xs text-purple-400/60 hover:text-purple-400 transition-colors"
              >
                {copied ? 'copied!' : 'copy share link'}
              </button>
            )}
          </div>
          {saveError && (
            <p className="text-[12px] text-red-400/70">{saveError}</p>
          )}
        </div>
      </div>

      {/* Curate folders */}
      {profileSaved && folders.length > 0 && (
        <div className="space-y-3 animate-fade-up">
          <h2 className="text-[11px] font-medium text-neutral-600 uppercase tracking-widest">
            Themes — toggle to publish
          </h2>
          <div className="space-y-1.5">
            {folders.map((folder) => {
              const isPublished = publishedFolders.has(folder.id)
              return (
                <button
                  key={folder.id}
                  onClick={() => toggleFolder(folder.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                    isPublished
                      ? 'border-purple-400/20 bg-purple-400/[0.04]'
                      : 'border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-white/80 text-[14px] font-medium">{folder.name}</p>
                    <span className={`text-[10px] uppercase tracking-widest ${isPublished ? 'text-purple-400/60' : 'text-neutral-700'}`}>
                      {isPublished ? 'public' : 'private'}
                    </span>
                  </div>
                  {folder.description && (
                    <p className="text-neutral-600 text-[12px] mt-1">{folder.description}</p>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Curate individual nodes */}
      {profileSaved && nodes.length > 0 && (
        <div className="space-y-3 animate-fade-up">
          <h2 className="text-[11px] font-medium text-neutral-600 uppercase tracking-widest">
            Fragments — toggle to publish
          </h2>
          <div className="space-y-1">
            {nodes.map((node) => {
              const isPublished = publishedNodes.has(node.id)
              return (
                <button
                  key={node.id}
                  onClick={() => toggleNode(node.id)}
                  className={`w-full text-left px-4 py-2.5 rounded-xl border transition-all ${
                    isPublished
                      ? 'border-purple-400/20 bg-purple-400/[0.04]'
                      : 'border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-white/70 text-[13px] leading-snug truncate">{node.content}</p>
                      <span className={`text-[10px] ${typeColors[node.type] || 'text-neutral-600'}`}>
                        {node.type}
                      </span>
                    </div>
                    <span className={`text-[10px] uppercase tracking-widest shrink-0 ${isPublished ? 'text-purple-400/60' : 'text-neutral-700'}`}>
                      {isPublished ? 'public' : 'private'}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
