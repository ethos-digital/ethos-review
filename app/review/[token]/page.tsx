'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase, Project, Screen, Comment, Client, Vote } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import Link from 'next/link'

type DeviceType = 'desktop' | 'mobile'

interface CommentWithReplies extends Comment {
  replies?: Comment[]
}

export default function ReviewPage() {
  const params = useParams()
  const token = params.token as string
  
  const [project, setProject] = useState<Project | null>(null)
  const [client, setClient] = useState<Client | null>(null)
  const [screens, setScreens] = useState<Screen[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [votes, setVotes] = useState<Vote[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  
  const [currentScreen, setCurrentScreen] = useState<Screen | null>(null)
  const [device, setDevice] = useState<DeviceType>('desktop')
  const [showComments, setShowComments] = useState(true)
  const [showVotesModal, setShowVotesModal] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  
  const [newComment, setNewComment] = useState<{ x: number; y: number } | null>(null)
  const [commentText, setCommentText] = useState('')
  const [authorName, setAuthorName] = useState('')
  const [tempAuthorName, setTempAuthorName] = useState('')
  const [nameConfirmed, setNameConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editingCommentText, setEditingCommentText] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  
  const [showNamePrompt, setShowNamePrompt] = useState(false)
  const [pendingVoteScreenId, setPendingVoteScreenId] = useState<string | null>(null)
  const [promptName, setPromptName] = useState('')
  
  const imageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadProject()
    const savedName = localStorage.getItem('ethos-review-author')
    if (savedName) {
      setAuthorName(savedName)
      setTempAuthorName(savedName)
      setNameConfirmed(true)
    }
  }, [token])

  useEffect(() => {
    if (currentScreen) {
      loadComments()
      if (currentScreen.desktop_image) setDevice('desktop')
      else if (currentScreen.mobile_image) setDevice('mobile')
    }
  }, [currentScreen])

  async function loadProject() {
    const { data: projectData, error } = await supabase.from('projects').select('*').eq('token', token).single()
    if (error || !projectData) { setNotFound(true); setLoading(false); return }
    setProject(projectData)
    if (projectData.client_id) {
      const { data: clientData } = await supabase.from('clients').select('*').eq('id', projectData.client_id).single()
      if (clientData) setClient(clientData)
    }
    const { data: screensData } = await supabase.from('screens').select('*').eq('project_id', projectData.id).order('sort_order')
    if (screensData && screensData.length > 0) {
      setScreens(screensData)
      setCurrentScreen(screensData[0])
      const screenIds = screensData.map(s => s.id)
      const { data: votesData } = await supabase.from('votes').select('*').in('screen_id', screenIds)
      if (votesData) setVotes(votesData)
    }
    setLoading(false)
  }

  async function loadComments() {
    if (!currentScreen) return
    const { data } = await supabase.from('comments').select('*').eq('screen_id', currentScreen.id).order('created_at', { ascending: true })
    if (data) setComments(data)
  }

  function getCurrentImage(): string | null {
    if (!currentScreen) return null
    if (device === 'desktop') return currentScreen.desktop_image || null
    if (device === 'mobile') return currentScreen.mobile_image || null
    return null
  }

  function getScreenComments(): CommentWithReplies[] {
    if (!currentScreen) return []
    const screenComments = comments.filter(c => c.device_type === device)
    const parentComments = screenComments.filter(c => !c.parent_id)
    return parentComments.map(parent => ({
      ...parent,
      replies: screenComments.filter(c => c.parent_id === parent.id)
    }))
  }

  function getScreenVotes(screenId: string): number {
    return votes.filter(v => v.screen_id === screenId).length
  }

  function getScreenVoters(screenId: string): string[] {
    return votes.filter(v => v.screen_id === screenId).map(v => v.voter_name)
  }

  function hasVoted(screenId: string): boolean {
    return votes.some(v => v.screen_id === screenId && v.voter_name === authorName)
  }

  function handleVoteClick(screenId: string) {
    if (!authorName) {
      setPendingVoteScreenId(screenId)
      setShowNamePrompt(true)
      return
    }
    toggleVote(screenId)
  }

  async function toggleVote(screenId: string) {
    const voterName = authorName || promptName
    if (!voterName) return
    
    localStorage.setItem('ethos-review-author', voterName)
    setAuthorName(voterName)
    setTempAuthorName(voterName)
    setNameConfirmed(true)
    
    if (hasVoted(screenId)) {
      await supabase.from('votes').delete().eq('screen_id', screenId).eq('voter_name', voterName)
      setVotes(votes.filter(v => !(v.screen_id === screenId && v.voter_name === voterName)))
    } else {
      const { data } = await supabase.from('votes').insert([{ screen_id: screenId, voter_name: voterName }]).select().single()
      if (data) setVotes([...votes, data])
    }
  }

  function confirmNameAndVote() {
    if (!promptName.trim() || !pendingVoteScreenId) return
    setAuthorName(promptName)
    setTempAuthorName(promptName)
    setNameConfirmed(true)
    localStorage.setItem('ethos-review-author', promptName)
    toggleVote(pendingVoteScreenId)
    setShowNamePrompt(false)
    setPendingVoteScreenId(null)
    setPromptName('')
  }

  function confirmAuthorName() {
    if (!tempAuthorName.trim()) return
    setAuthorName(tempAuthorName)
    setNameConfirmed(true)
    localStorage.setItem('ethos-review-author', tempAuthorName)
  }

  function hasDesktopImage(): boolean {
    return !!currentScreen?.desktop_image
  }

  function hasMobileImage(): boolean {
    return !!currentScreen?.mobile_image
  }

  function handleImageClick(e: React.MouseEvent) {
    if (!imageRef.current) return
    const rect = imageRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setNewComment({ x, y })
    setCommentText('')
    setTempAuthorName(authorName)
  }

  async function submitComment() {
    if (!commentText.trim() || !authorName.trim() || !newComment || !currentScreen) return
    setSubmitting(true)
    localStorage.setItem('ethos-review-author', authorName)
    const { data } = await supabase.from('comments').insert([{ screen_id: currentScreen.id, x_position: newComment.x, y_position: newComment.y, device_type: device, author_name: authorName, content: commentText }]).select().single()
    if (data) setComments([...comments, data])
    setNewComment(null)
    setCommentText('')
    setSubmitting(false)
  }

  async function submitReply(parentId: string) {
    if (!replyText.trim() || !authorName.trim() || !currentScreen) return
    const parent = comments.find(c => c.id === parentId)
    if (!parent) return
    const { data } = await supabase.from('comments').insert([{ screen_id: currentScreen.id, parent_id: parentId, x_position: parent.x_position, y_position: parent.y_position, device_type: parent.device_type, author_name: authorName, content: replyText }]).select().single()
    if (data) setComments([...comments, data])
    setReplyingTo(null)
    setReplyText('')
  }

  function cancelComment() { setNewComment(null); setCommentText(''); setTempAuthorName(authorName) }

  async function toggleResolved(commentId: string) {
    const comment = comments.find(c => c.id === commentId)
    if (!comment) return
    await supabase.from('comments').update({ is_resolved: !comment.is_resolved }).eq('id', commentId)
    setComments(comments.map(c => c.id === commentId ? { ...c, is_resolved: !c.is_resolved } : c))
  }

  function startEditingComment(comment: Comment) { setEditingCommentId(comment.id); setEditingCommentText(comment.content) }
  function cancelEditingComment() { setEditingCommentId(null); setEditingCommentText('') }

  async function saveEditedComment(commentId: string) {
    if (!editingCommentText.trim()) return
    await supabase.from('comments').update({ content: editingCommentText }).eq('id', commentId)
    setComments(comments.map(c => c.id === commentId ? { ...c, content: editingCommentText } : c))
    setEditingCommentId(null); setEditingCommentText('')
  }

  async function deleteComment(commentId: string) {
    if (!confirm('Supprimer ce commentaire ?')) return
    await supabase.from('comments').delete().eq('id', commentId)
    setComments(comments.filter(c => c.id !== commentId && c.parent_id !== commentId))
  }

  function getPopupPosition(x: number) {
    if (x > 60) return { right: '100%', left: 'auto', marginRight: '10px' }
    return { left: '0', right: 'auto', marginLeft: '0' }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-400">Chargement...</div>
  if (notFound || !project) return <div className="min-h-screen flex items-center justify-center bg-zinc-950"><div className="text-center"><div className="text-6xl mb-4">🔒</div><h1 className="text-2xl font-medium mb-2 text-white">Projet introuvable</h1><p className="text-zinc-400">Ce lien n est pas valide.</p></div></div>

  const currentImage = getCurrentImage()
  const screenComments = getScreenComments()
  const showDesktop = hasDesktopImage()
  const showMobile = hasMobileImage()
  const totalVotes = screens.reduce((sum, s) => sum + getScreenVotes(s.id), 0)

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Modal pour entrer le nom avant de voter */}
      {showNamePrompt && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-sm">
            <h2 className="text-lg font-semibold mb-4">Entrez votre nom pour voter</h2>
            <input type="text" value={promptName} onChange={(e) => setPromptName(e.target.value)} placeholder="Votre nom" className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:border-violet-500" autoFocus onKeyDown={(e) => e.key === 'Enter' && confirmNameAndVote()} />
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => { setShowNamePrompt(false); setPendingVoteScreenId(null); setPromptName('') }} className="px-4 py-2 text-zinc-400 hover:text-white">Annuler</button>
              <button onClick={confirmNameAndVote} disabled={!promptName.trim()} className="px-4 py-2 bg-violet-500 hover:bg-violet-600 disabled:opacity-50 rounded-lg font-medium">Voter</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Votes */}
      {showVotesModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Votes</h2>
              <button onClick={() => setShowVotesModal(false)} className="text-zinc-400 hover:text-white text-2xl">&times;</button>
            </div>
            <div className="space-y-3">
              {screens.map(screen => {
                const voteCount = getScreenVotes(screen.id)
                const voters = getScreenVoters(screen.id)
                const maxVotes = Math.max(...screens.map(s => getScreenVotes(s.id)), 1)
                const percentage = (voteCount / maxVotes) * 100
                const voted = hasVoted(screen.id)
                return (
                  <div key={screen.id} className="bg-zinc-800/50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-zinc-300 font-medium">{screen.name}</span>
                      <button onClick={() => handleVoteClick(screen.id)} className={`text-sm flex items-center gap-1 transition-colors ${voted ? 'text-rose-400' : 'text-zinc-500 hover:text-rose-400'}`}>
                        {voted ? '♥' : '♡'} {voteCount}
                      </button>
                    </div>
                    <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
                      <div className="h-full bg-rose-500 rounded-full transition-all" style={{ width: `${percentage}%` }}></div>
                    </div>
                    {voters.length > 0 && (
                      <p className="text-xs text-zinc-500 mt-1">{voters.join(', ')}</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <p className="text-sm text-zinc-400 mb-1">Conception Ethos Digital</p>
          <div className="flex items-center gap-2 text-xl font-bold">
            {client ? (
              <>
                <Link href={`/c/${client.token}`} className="text-white hover:text-violet-400 transition-colors">{client.name}</Link>
                <span className="text-zinc-600">&gt;</span>
                <span>{project.name}</span>
              </>
            ) : (
              <span>{project.name}</span>
            )}
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-73px)]">
        <aside className={`border-r border-zinc-800 bg-zinc-900/50 flex-shrink-0 transition-all duration-300 ${sidebarCollapsed ? 'w-12' : 'w-56'}`}>
          <div className="p-2 border-b border-zinc-800 flex items-center justify-between">
            {!sidebarCollapsed && <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider px-2">Écrans</h2>}
            <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white">
              {sidebarCollapsed ? '→' : '←'}
            </button>
          </div>
          <nav className="p-2 space-y-1 overflow-y-auto">
            {screens.map((screen, idx) => {
              const voteCount = getScreenVotes(screen.id)
              return (
                <button key={screen.id} onClick={() => { setCurrentScreen(screen); setNewComment(null) }}
                  className={`w-full text-left px-2 py-2 rounded-lg transition-all ${currentScreen?.id === screen.id ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30' : 'hover:bg-zinc-800 text-zinc-300'}`}
                  title={screen.name}>
                  {sidebarCollapsed ? (
                    <span className="block text-center text-sm font-medium">{idx + 1}</span>
                  ) : (
                    <>
                      <span className="block text-sm font-medium truncate">{screen.name}</span>
                      {voteCount > 0 && <span className="block text-xs text-rose-400">♥ {voteCount}</span>}
                    </>
                  )}
                </button>
              )
            })}
          </nav>
        </aside>

        <main className="flex-1 flex flex-col min-w-0">
          <div className="border-b border-zinc-800 bg-zinc-900/30 px-4 py-2 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-zinc-800 rounded-lg p-1">
                  {showDesktop && <button onClick={() => setDevice('desktop')} className={`px-3 py-1.5 rounded-md text-sm transition-all ${device === 'desktop' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}>Desktop</button>}
                  {showMobile && <button onClick={() => setDevice('mobile')} className={`px-3 py-1.5 rounded-md text-sm transition-all ${device === 'mobile' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}>Mobile</button>}
                </div>
                {currentScreen && (
                  <button onClick={() => handleVoteClick(currentScreen.id)} className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 transition-colors ${hasVoted(currentScreen.id) ? 'bg-rose-500/20 text-rose-400' : 'bg-zinc-800 text-zinc-400 hover:text-rose-400'}`}>
                    {hasVoted(currentScreen.id) ? '♥' : '♡'} Voter
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button onClick={() => setShowVotesModal(true)} className="px-3 py-1.5 rounded-lg text-sm transition-all bg-zinc-800 text-zinc-300 hover:bg-zinc-700">
                  Votes {totalVotes > 0 && <span className="ml-1 text-rose-400">({totalVotes})</span>}
                </button>
                <button onClick={() => setShowComments(!showComments)} className={`px-3 py-1.5 rounded-lg text-sm transition-all ${showComments ? 'bg-zinc-700 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}>Commentaires ({screenComments.length})</button>
              </div>
            </div>
          </div>

          <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 p-6 flex items-start justify-center overflow-auto">
              {!currentScreen ? (
                <div className="text-center py-12"><div className="text-6xl mb-4">🎨</div><h2 className="text-xl font-medium mb-2">Pas encore de maquettes</h2><p className="text-zinc-400">Les maquettes seront bientôt disponibles.</p></div>
              ) : !currentImage ? (
                <div className="text-center py-12"><div className="text-6xl mb-4">📱</div><h2 className="text-xl font-medium mb-2">Pas de vue {device}</h2><p className="text-zinc-400">Cet écran n a pas de maquette {device}.</p></div>
              ) : (
                <div className="relative">
                  <div ref={imageRef} className="relative cursor-crosshair" onClick={handleImageClick}>
                    <img src={currentImage} alt={currentScreen?.name} className="max-w-full h-auto rounded-xl shadow-2xl" style={{ maxWidth: '100%', width: 'auto' }} />
                    {showComments && screenComments.map((comment, idx) => (
                      <div key={comment.id} className={`absolute w-7 h-7 -ml-3.5 -mt-3.5 rounded-full flex items-center justify-center text-xs font-bold cursor-pointer transition-transform hover:scale-110 shadow-lg ${comment.is_resolved ? 'bg-green-500 text-white' : 'bg-violet-500 text-white'}`}
                        style={{ left: `${comment.x_position}%`, top: `${comment.y_position}%` }} title={comment.content}>{idx + 1}</div>
                    ))}
                    {newComment && (
                      <div className="absolute z-20" style={{ left: `${newComment.x}%`, top: `${newComment.y}%` }} onClick={(e) => e.stopPropagation()}>
                        <div className="w-7 h-7 -ml-3.5 -mt-3.5 rounded-full bg-fuchsia-500 text-white flex items-center justify-center text-sm font-bold animate-pulse shadow-lg">+</div>
                        <div className="absolute top-5 bg-zinc-900 rounded-xl shadow-2xl p-4 w-72 border border-zinc-700" style={getPopupPosition(newComment.x)}>
                          {!nameConfirmed ? (
                            <div className="mb-3">
                              <label className="block text-sm text-zinc-400 mb-2">Votre nom</label>
                              <div className="flex gap-2">
                                <input type="text" value={tempAuthorName} onChange={(e) => setTempAuthorName(e.target.value)} placeholder="Entrez votre nom" className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.key === 'Enter' && tempAuthorName.trim() && confirmAuthorName()} autoFocus />
                                <button onClick={(e) => { e.stopPropagation(); confirmAuthorName() }} disabled={!tempAuthorName.trim()} className="px-3 py-2 bg-violet-500 hover:bg-violet-600 disabled:opacity-50 rounded-lg text-sm font-medium">OK</button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between mb-3 text-sm">
                              <span className="text-zinc-400">En tant que <span className="text-white font-medium">{authorName}</span></span>
                              <button onClick={(e) => { e.stopPropagation(); setNameConfirmed(false); setTempAuthorName(authorName) }} className="text-violet-400 hover:text-violet-300">Changer</button>
                            </div>
                          )}
                          <textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Votre commentaire..." className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-sm resize-none focus:outline-none focus:border-violet-500" rows={3} onClick={(e) => e.stopPropagation()} disabled={!nameConfirmed} />
                          <div className="flex justify-end gap-2 mt-3">
                            <button onClick={(e) => { e.stopPropagation(); cancelComment() }} className="px-3 py-1.5 text-sm text-zinc-400 hover:text-white">Annuler</button>
                            <button onClick={(e) => { e.stopPropagation(); submitComment() }} disabled={submitting || !commentText.trim() || !nameConfirmed} className="px-4 py-1.5 bg-violet-500 hover:bg-violet-600 disabled:opacity-50 rounded-lg text-sm font-medium">{submitting ? '...' : 'Envoyer'}</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="text-center text-zinc-500 text-sm mt-4">Cliquez sur la maquette pour ajouter un commentaire</p>
                </div>
              )}
            </div>

            {showComments && currentImage && (
              <aside className="w-80 border-l border-zinc-800 bg-zinc-900/50 overflow-y-auto flex-shrink-0">
                <div className="p-4 border-b border-zinc-800">
                  <h3 className="font-medium">Commentaires</h3>
                  <p className="text-xs text-zinc-500 mt-1">{screenComments.filter(c => !c.is_resolved).length} ouvert(s), {screenComments.filter(c => c.is_resolved).length} résolu(s)</p>
                </div>
                <div className="p-4 space-y-3">
                  {screenComments.length === 0 ? (
                    <p className="text-zinc-500 text-sm text-center py-8">Aucun commentaire.<br/>Cliquez sur la maquette pour en ajouter.</p>
                  ) : (
                    screenComments.map((comment, idx) => (
                      <div key={comment.id} className={`p-3 rounded-lg border ${comment.is_resolved ? 'bg-zinc-800/50 border-zinc-700/50' : 'bg-zinc-800 border-zinc-700'}`}>
                        <div className="flex items-start gap-3">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${comment.is_resolved ? 'bg-green-500' : 'bg-violet-500'}`}>{idx + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className={`font-medium text-sm ${comment.is_resolved ? 'text-zinc-400' : ''}`}>{comment.author_name}</span>
                              <span className="text-xs text-zinc-500">{new Date(comment.created_at).toLocaleDateString('fr-CH')}</span>
                            </div>
                            {editingCommentId === comment.id ? (
                              <div className="mt-2">
                                <textarea value={editingCommentText} onChange={(e) => setEditingCommentText(e.target.value)} className="w-full bg-zinc-900 border border-zinc-600 rounded-lg p-2 text-sm resize-none focus:outline-none focus:border-violet-500" rows={2} autoFocus />
                                <div className="flex gap-2 mt-2">
                                  <button onClick={cancelEditingComment} className="text-xs text-zinc-400 hover:text-white">Annuler</button>
                                  <button onClick={() => saveEditedComment(comment.id)} className="text-xs text-violet-400 hover:text-violet-300">Sauvegarder</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <p className={`text-sm mt-1 ${comment.is_resolved ? 'text-zinc-500 line-through' : 'text-zinc-300'}`}>{comment.content}</p>
                                <div className="flex items-center gap-3 mt-2">
                                  <button onClick={() => toggleResolved(comment.id)} className="text-xs text-violet-400 hover:text-violet-300">{comment.is_resolved ? 'Réouvrir' : 'Résolu'}</button>
                                  <button onClick={() => setReplyingTo(comment.id)} className="text-xs text-zinc-500 hover:text-zinc-300">Répondre</button>
                                  <button onClick={() => startEditingComment(comment)} className="text-xs text-zinc-500 hover:text-zinc-300">Modifier</button>
                                  <button onClick={() => deleteComment(comment.id)} className="text-xs text-zinc-500 hover:text-red-400">Supprimer</button>
                                </div>
                              </>
                            )}
                            {comment.replies && comment.replies.length > 0 && (
                              <div className="mt-3 pl-3 border-l-2 border-zinc-700 space-y-2">
                                {comment.replies.map(reply => (
                                  <div key={reply.id} className="text-sm">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-zinc-300">{reply.author_name}</span>
                                      <span className="text-xs text-zinc-500">{new Date(reply.created_at).toLocaleDateString('fr-CH')}</span>
                                    </div>
                                    <p className="text-zinc-400 mt-0.5">{reply.content}</p>
                                    <button onClick={() => deleteComment(reply.id)} className="text-xs text-zinc-500 hover:text-red-400 mt-1">Supprimer</button>
                                  </div>
                                ))}
                              </div>
                            )}
                            {replyingTo === comment.id && (
                              <div className="mt-3 pl-3 border-l-2 border-violet-500">
                                {!nameConfirmed ? (
                                  <div className="mb-2">
                                    <div className="flex gap-2">
                                      <input type="text" value={tempAuthorName} onChange={(e) => setTempAuthorName(e.target.value)} placeholder="Votre nom" className="flex-1 bg-zinc-900 border border-zinc-600 rounded-lg p-2 text-sm focus:outline-none focus:border-violet-500" onKeyDown={(e) => e.key === 'Enter' && tempAuthorName.trim() && confirmAuthorName()} autoFocus />
                                      <button onClick={confirmAuthorName} disabled={!tempAuthorName.trim()} className="px-3 py-2 bg-violet-500 hover:bg-violet-600 disabled:opacity-50 rounded-lg text-xs font-medium">OK</button>
                                    </div>
                                  </div>
                                ) : null}
                                <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Votre réponse..." className="w-full bg-zinc-900 border border-zinc-600 rounded-lg p-2 text-sm resize-none focus:outline-none focus:border-violet-500" rows={2} autoFocus={nameConfirmed} disabled={!nameConfirmed} />
                                <div className="flex gap-2 mt-2">
                                  <button onClick={() => { setReplyingTo(null); setReplyText('') }} className="text-xs text-zinc-400 hover:text-white">Annuler</button>
                                  <button onClick={() => submitReply(comment.id)} disabled={!replyText.trim() || !nameConfirmed} className="text-xs text-violet-400 hover:text-violet-300 disabled:opacity-50">Envoyer</button>
                                </div>
                              </div>
                            )}
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
