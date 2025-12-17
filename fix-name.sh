#!/bin/bash

# Fix pour permettre de changer le nom d'auteur

echo "📝 Correction du formulaire de commentaire..."

cat > 'app/review/[token]/page.tsx' << 'EOF'
'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase, Project, Screen, Version, Comment } from '@/lib/supabase'
import { useParams } from 'next/navigation'

type DeviceType = 'desktop' | 'mobile'

interface ScreenWithVersions extends Screen {
  versions: Version[]
}

export default function ReviewPage() {
  const params = useParams()
  const token = params.token as string
  
  const [project, setProject] = useState<Project | null>(null)
  const [screens, setScreens] = useState<ScreenWithVersions[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  
  const [currentScreen, setCurrentScreen] = useState<ScreenWithVersions | null>(null)
  const [currentVersionIndex, setCurrentVersionIndex] = useState(0)
  const [device, setDevice] = useState<DeviceType>('desktop')
  const [showComments, setShowComments] = useState(true)
  const [compareMode, setCompareMode] = useState(false)
  const [comparePosition, setComparePosition] = useState(50)
  
  const [newComment, setNewComment] = useState<{ x: number; y: number } | null>(null)
  const [commentText, setCommentText] = useState('')
  const [authorName, setAuthorName] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  
  const imageRef = useRef<HTMLDivElement>(null)
  const compareRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadProject()
    const savedName = localStorage.getItem('ethos-review-author')
    if (savedName) setAuthorName(savedName)
  }, [token])

  useEffect(() => {
    if (currentScreen) {
      loadComments()
      setCurrentVersionIndex(currentScreen.versions.length - 1)
    }
  }, [currentScreen])

  async function loadProject() {
    const { data: projectData, error } = await supabase
      .from('projects')
      .select('*')
      .eq('token', token)
      .single()
    
    if (error || !projectData) {
      setNotFound(true)
      setLoading(false)
      return
    }
    
    setProject(projectData)

    const { data: screensData } = await supabase
      .from('screens')
      .select('*, versions(*)')
      .eq('project_id', projectData.id)
      .order('sort_order')
    
    if (screensData && screensData.length > 0) {
      const sorted = screensData.map(screen => ({
        ...screen,
        versions: (screen.versions || []).sort((a: Version, b: Version) => a.version_number - b.version_number)
      }))
      setScreens(sorted)
      setCurrentScreen(sorted[0])
    }
    
    setLoading(false)
  }

  async function loadComments() {
    if (!currentScreen) return
    
    const versionIds = currentScreen.versions.map(v => v.id)
    
    const { data } = await supabase
      .from('comments')
      .select('*')
      .in('version_id', versionIds)
      .order('created_at', { ascending: true })
    
    if (data) setComments(data)
  }

  function getCurrentVersion(): Version | null {
    if (!currentScreen || currentScreen.versions.length === 0) return null
    return currentScreen.versions[currentVersionIndex]
  }

  function getPreviousVersion(): Version | null {
    if (!currentScreen || currentVersionIndex === 0) return null
    return currentScreen.versions[currentVersionIndex - 1]
  }

  function getCurrentImage(): string | null {
    const version = getCurrentVersion()
    if (!version) return null
    if (device === 'desktop') return version.desktop_image || null
    if (device === 'mobile') return version.mobile_image || null
    return null
  }

  function getPreviousImage(): string | null {
    const version = getPreviousVersion()
    if (!version) return null
    if (device === 'desktop') return version.desktop_image || null
    if (device === 'mobile') return version.mobile_image || null
    return null
  }

  function getVersionComments(): Comment[] {
    const version = getCurrentVersion()
    if (!version) return []
    return comments.filter(c => c.version_id === version.id && c.device_type === device)
  }

  function handleImageClick(e: React.MouseEvent) {
    if (compareMode || !imageRef.current) return
    const rect = imageRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setNewComment({ x, y })
    setCommentText('')
    setEditingName(!authorName)
  }

  async function submitComment() {
    if (!commentText.trim() || !authorName.trim() || !newComment) return
    const version = getCurrentVersion()
    if (!version) return
    
    setSubmitting(true)
    localStorage.setItem('ethos-review-author', authorName)
    
    const { data, error } = await supabase
      .from('comments')
      .insert([{
        version_id: version.id,
        x_position: newComment.x,
        y_position: newComment.y,
        device_type: device,
        author_name: authorName,
        content: commentText
      }])
      .select()
      .single()
    
    if (data) setComments([...comments, data])
    setNewComment(null)
    setCommentText('')
    setEditingName(false)
    setSubmitting(false)
  }

  function cancelComment() {
    setNewComment(null)
    setCommentText('')
    setEditingName(false)
  }

  async function toggleResolved(commentId: string) {
    const comment = comments.find(c => c.id === commentId)
    if (!comment) return
    
    const { error } = await supabase
      .from('comments')
      .update({ is_resolved: !comment.is_resolved })
      .eq('id', commentId)
    
    if (!error) {
      setComments(comments.map(c => 
        c.id === commentId ? { ...c, is_resolved: !c.is_resolved } : c
      ))
    }
  }

  function handleCompareMove(e: React.MouseEvent) {
    if (!compareRef.current) return
    const rect = compareRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    setComparePosition(Math.max(5, Math.min(95, x)))
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="text-zinc-400">Chargement...</div>
      </div>
    )
  }

  if (notFound || !project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-medium mb-2">Projet introuvable</h1>
          <p className="text-zinc-400">Ce lien n est pas valide ou le projet a été supprimé.</p>
        </div>
      </div>
    )
  }

  const currentVersion = getCurrentVersion()
  const currentImage = getCurrentImage()
  const previousImage = getPreviousImage()
  const versionComments = getVersionComments()

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-lg flex items-center justify-center font-bold text-sm">ED</div>
              <div>
                <h1 className="font-semibold">{project.name}</h1>
                <p className="text-sm text-zinc-400">{project.client_name}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-57px)]">
        <aside className="w-56 border-r border-zinc-800 bg-zinc-900/50 p-4 overflow-y-auto flex-shrink-0">
          <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">Écrans</h2>
          <nav className="space-y-1">
            {screens.map(screen => (
              <button
                key={screen.id}
                onClick={() => { setCurrentScreen(screen); setCompareMode(false); setNewComment(null) }}
                className={`w-full text-left px-3 py-2 rounded-lg transition-all ${
                  currentScreen?.id === screen.id 
                    ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30' 
                    : 'hover:bg-zinc-800 text-zinc-300'
                }`}
              >
                <span className="block text-sm font-medium">{screen.name}</span>
                <span className="block text-xs text-zinc-500 mt-0.5">{screen.versions.length} version{screen.versions.length > 1 ? 's' : ''}</span>
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 flex flex-col min-w-0">
          <div className="border-b border-zinc-800 bg-zinc-900/30 px-4 py-2 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 bg-zinc-800 rounded-lg p-1">
                <button onClick={() => { setDevice('desktop'); setCompareMode(false) }} className={`px-3 py-1.5 rounded-md text-sm transition-all ${device === 'desktop' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}>Desktop</button>
                <button onClick={() => { setDevice('mobile'); setCompareMode(false) }} className={`px-3 py-1.5 rounded-md text-sm transition-all ${device === 'mobile' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}>Mobile</button>
              </div>

              {currentScreen && currentScreen.versions.length > 0 && (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-zinc-400">Version:</span>
                  <div className="flex items-center gap-1">
                    {currentScreen.versions.map((v, idx) => (
                      <button key={v.id} onClick={() => { setCurrentVersionIndex(idx); setCompareMode(false); setNewComment(null) }}
                        className={`w-8 h-8 rounded-full text-sm font-medium transition-all ${currentVersionIndex === idx ? 'bg-violet-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                      >{v.version_number}</button>
                    ))}
                  </div>
                  {currentVersion && <span className="text-xs text-zinc-500 ml-2">{new Date(currentVersion.created_at).toLocaleDateString('fr-CH')}</span>}
                </div>
              )}

              <div className="flex items-center gap-2">
                {previousImage && currentImage && (
                  <button onClick={() => setCompareMode(!compareMode)} className={`px-3 py-1.5 rounded-lg text-sm transition-all ${compareMode ? 'bg-violet-500 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}>Comparer</button>
                )}
                <button onClick={() => setShowComments(!showComments)} className={`px-3 py-1.5 rounded-lg text-sm transition-all ${showComments ? 'bg-zinc-700 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}>Commentaires ({versionComments.length})</button>
              </div>
            </div>
          </div>

          <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 p-6 flex items-start justify-center overflow-auto">
              {!currentScreen || currentScreen.versions.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🎨</div>
                  <h2 className="text-xl font-medium mb-2">Pas encore de maquettes</h2>
                  <p className="text-zinc-400">Les maquettes seront bientôt disponibles.</p>
                </div>
              ) : !currentImage ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📱</div>
                  <h2 className="text-xl font-medium mb-2">Pas de vue {device}</h2>
                  <p className="text-zinc-400">Cette version n a pas de maquette {device}.</p>
                </div>
              ) : compareMode && previousImage ? (
                <div ref={compareRef} className={`relative ${device === 'mobile' ? 'max-w-sm' : 'w-full'} cursor-ew-resize select-none`} onMouseMove={handleCompareMove}>
                  <img src={previousImage} alt="Version précédente" className="w-full rounded-xl shadow-2xl" draggable={false} />
                  <div className="absolute inset-0 overflow-hidden rounded-xl" style={{ clipPath: `inset(0 ${100 - comparePosition}% 0 0)` }}>
                    <img src={currentImage} alt="Version actuelle" className="w-full" draggable={false} />
                  </div>
                  <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg pointer-events-none" style={{ left: `${comparePosition}%` }}>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center text-zinc-900 font-bold">⟺</div>
                  </div>
                  <div className="absolute bottom-4 left-4 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-lg text-sm">V{getPreviousVersion()?.version_number}</div>
                  <div className="absolute bottom-4 right-4 bg-violet-500/90 backdrop-blur-sm px-3 py-1.5 rounded-lg text-sm font-medium">V{currentVersion?.version_number}</div>
                </div>
              ) : (
                <div className={`relative ${device === 'mobile' ? 'max-w-sm' : 'w-full'}`}>
                  <div ref={imageRef} className="relative cursor-crosshair" onClick={handleImageClick}>
                    <img src={currentImage} alt={currentScreen?.name} className="w-full rounded-xl shadow-2xl" />
                    
                    {showComments && versionComments.map((comment, idx) => (
                      <div key={comment.id}
                        className={`absolute w-7 h-7 -ml-3.5 -mt-3.5 rounded-full flex items-center justify-center text-xs font-bold cursor-pointer transition-transform hover:scale-110 shadow-lg ${comment.is_resolved ? 'bg-green-500 text-white' : 'bg-violet-500 text-white'}`}
                        style={{ left: `${comment.x_position}%`, top: `${comment.y_position}%` }}
                        title={comment.content}
                      >{idx + 1}</div>
                    ))}

                    {newComment && (
                      <div 
                        className="absolute z-20" 
                        style={{ left: `${newComment.x}%`, top: `${newComment.y}%` }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="w-7 h-7 -ml-3.5 -mt-3.5 rounded-full bg-fuchsia-500 text-white flex items-center justify-center text-sm font-bold animate-pulse shadow-lg">+</div>
                        <div className="absolute top-5 left-0 bg-zinc-900 rounded-xl shadow-2xl p-4 w-72 border border-zinc-700">
                          {editingName ? (
                            <input 
                              type="text" 
                              value={authorName} 
                              onChange={(e) => setAuthorName(e.target.value)} 
                              placeholder="Votre nom"
                              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:border-violet-500"
                              onClick={(e) => e.stopPropagation()}
                              onBlur={() => { if (authorName) setEditingName(false) }}
                              autoFocus
                            />
                          ) : (
                            <div className="flex items-center justify-between mb-3 text-sm">
                              <span className="text-zinc-400">En tant que <span className="text-white font-medium">{authorName}</span></span>
                              <button 
                                onClick={(e) => { e.stopPropagation(); setEditingName(true) }}
                                className="text-violet-400 hover:text-violet-300"
                              >
                                Changer
                              </button>
                            </div>
                          )}
                          <textarea 
                            value={commentText} 
                            onChange={(e) => setCommentText(e.target.value)} 
                            placeholder="Votre commentaire..."
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-sm resize-none focus:outline-none focus:border-violet-500" 
                            rows={3}
                            onClick={(e) => e.stopPropagation()}
                            autoFocus={!editingName}
                          />
                          <div className="flex justify-end gap-2 mt-3">
                            <button 
                              onClick={(e) => { e.stopPropagation(); cancelComment(); }} 
                              className="px-3 py-1.5 text-sm text-zinc-400 hover:text-white"
                            >
                              Annuler
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); submitComment(); }}
                              disabled={submitting || !commentText.trim() || !authorName.trim()}
                              className="px-4 py-1.5 bg-violet-500 hover:bg-violet-600 disabled:opacity-50 rounded-lg text-sm font-medium"
                            >
                              {submitting ? '...' : 'Envoyer'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="text-center text-zinc-500 text-sm mt-4">Cliquez sur la maquette pour ajouter un commentaire</p>
                </div>
              )}
            </div>

            {showComments && !compareMode && currentImage && (
              <aside className="w-80 border-l border-zinc-800 bg-zinc-900/50 overflow-y-auto flex-shrink-0">
                <div className="p-4 border-b border-zinc-800">
                  <h3 className="font-medium">Commentaires</h3>
                  <p className="text-xs text-zinc-500 mt-1">{versionComments.filter(c => !c.is_resolved).length} ouvert(s), {versionComments.filter(c => c.is_resolved).length} résolu(s)</p>
                </div>
                <div className="p-4 space-y-3">
                  {versionComments.length === 0 ? (
                    <p className="text-zinc-500 text-sm text-center py-8">Aucun commentaire sur cette version.<br/>Cliquez sur la maquette pour en ajouter.</p>
                  ) : (
                    versionComments.map((comment, idx) => (
                      <div key={comment.id} className={`p-3 rounded-lg border ${comment.is_resolved ? 'bg-zinc-800/50 border-zinc-700/50' : 'bg-zinc-800 border-zinc-700'}`}>
                        <div className="flex items-start gap-3">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${comment.is_resolved ? 'bg-green-500' : 'bg-violet-500'}`}>{idx + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className={`font-medium text-sm ${comment.is_resolved ? 'text-zinc-400' : ''}`}>{comment.author_name}</span>
                              <span className="text-xs text-zinc-500">{new Date(comment.created_at).toLocaleDateString('fr-CH')}</span>
                            </div>
                            <p className={`text-sm mt-1 ${comment.is_resolved ? 'text-zinc-500 line-through' : 'text-zinc-300'}`}>{comment.content}</p>
                            <button onClick={() => toggleResolved(comment.id)} className="text-xs text-violet-400 hover:text-violet-300 mt-2">
                              {comment.is_resolved ? 'Réouvrir' : 'Marquer résolu'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </aside>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
EOF

echo "✅ Correction appliquée !"
echo "Tu peux maintenant cliquer sur 'Changer' pour modifier ton nom."
