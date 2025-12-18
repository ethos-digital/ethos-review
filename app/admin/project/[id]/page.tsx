'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase, getImageUrl, Project, Screen, Client, Vote } from '@/lib/supabase'
import Link from 'next/link'
import { useParams } from 'next/navigation'

export default function ProjectPage() {
  const params = useParams()
  const projectId = params.id as string
  const [project, setProject] = useState<Project | null>(null)
  const [client, setClient] = useState<Client | null>(null)
  const [screens, setScreens] = useState<Screen[]>([])
  const [votes, setVotes] = useState<Vote[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewScreen, setShowNewScreen] = useState(false)
  const [newScreenName, setNewScreenName] = useState('')
  const [editingProjectName, setEditingProjectName] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [editingScreenId, setEditingScreenId] = useState<string | null>(null)
  const [editingScreenName, setEditingScreenName] = useState('')
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null)
  const [editingLabelType, setEditingLabelType] = useState<'desktop' | 'mobile' | null>(null)
  const [editingLabelText, setEditingLabelText] = useState('')
  const [uploading, setUploading] = useState<string | null>(null)
  const [showStats, setShowStats] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadTarget, setUploadTarget] = useState<{ screenId: string, device: 'desktop' | 'mobile' } | null>(null)

  useEffect(() => { loadProject() }, [projectId])

  async function loadProject() {
    const { data: projectData } = await supabase.from('projects').select('*').eq('id', projectId).single()
    if (projectData) {
      setProject(projectData)
      setProjectName(projectData.name)
      const { data: clientData } = await supabase.from('clients').select('*').eq('id', projectData.client_id).single()
      if (clientData) setClient(clientData)
    }
    const { data: screensData } = await supabase.from('screens').select('*').eq('project_id', projectId).order('sort_order')
    if (screensData) {
      setScreens(screensData)
      const screenIds = screensData.map(s => s.id)
      if (screenIds.length > 0) {
        const { data: votesData } = await supabase.from('votes').select('*').in('screen_id', screenIds)
        if (votesData) setVotes(votesData)
      }
    }
    setLoading(false)
  }

  async function updateProjectName() {
    if (!projectName.trim() || !project) return
    await supabase.from('projects').update({ name: projectName.trim() }).eq('id', project.id)
    setProject({ ...project, name: projectName.trim() })
    setEditingProjectName(false)
  }

  async function updateScreenName(screenId: string) {
    if (!editingScreenName.trim()) return
    await supabase.from('screens').update({ name: editingScreenName.trim() }).eq('id', screenId)
    setScreens(screens.map(s => s.id === screenId ? { ...s, name: editingScreenName.trim() } : s))
    setEditingScreenId(null)
    setEditingScreenName('')
  }

  async function updateLabel(screenId: string) {
    if (!editingLabelText.trim() || !editingLabelType) return
    const field = editingLabelType === 'desktop' ? 'desktop_label' : 'mobile_label'
    await supabase.from('screens').update({ [field]: editingLabelText.trim() }).eq('id', screenId)
    setScreens(screens.map(s => s.id === screenId ? { ...s, [field]: editingLabelText.trim() } : s))
    setEditingLabelId(null)
    setEditingLabelType(null)
    setEditingLabelText('')
  }

  async function createScreen() {
    if (!newScreenName) return
    const { data } = await supabase.from('screens').insert([{ project_id: projectId, name: newScreenName, sort_order: screens.length }]).select().single()
    if (data) { setScreens([...screens, data]); setNewScreenName(''); setShowNewScreen(false) }
  }

  async function deleteScreen(screenId: string) {
    if (!confirm('Supprimer cet écran ?')) return
    const screen = screens.find(s => s.id === screenId)
    if (screen) {
      const filesToDelete: string[] = []
      if (screen.desktop_image) {
        const p = screen.desktop_image.split('/mockups/')[1]
        if (p) filesToDelete.push(p)
      }
      if (screen.mobile_image) {
        const p = screen.mobile_image.split('/mockups/')[1]
        if (p) filesToDelete.push(p)
      }
      if (filesToDelete.length > 0) await supabase.storage.from('mockups').remove(filesToDelete)
    }
    await supabase.from('screens').delete().eq('id', screenId)
    setScreens(screens.filter(s => s.id !== screenId))
  }

  async function moveScreen(index: number, direction: 'up' | 'down') {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === screens.length - 1) return
    
    const newScreens = [...screens]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    const temp = newScreens[index]
    newScreens[index] = newScreens[targetIndex]
    newScreens[targetIndex] = temp
    
    await supabase.from('screens').update({ sort_order: targetIndex }).eq('id', temp.id)
    await supabase.from('screens').update({ sort_order: index }).eq('id', newScreens[index].id)
    
    setScreens(newScreens)
  }

  function triggerUpload(screenId: string, device: 'desktop' | 'mobile') {
    setUploadTarget({ screenId, device })
    fileInputRef.current?.click()
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !uploadTarget) return
    const { screenId, device } = uploadTarget
    setUploading(`${screenId}-${device}`)
    
    const ext = file.name.split('.').pop()
    const filePath = `${projectId}/${screenId}/${device}.${ext}`
    
    const { error: uploadError } = await supabase.storage.from('mockups').upload(filePath, file, { upsert: true })
    if (uploadError) { console.error(uploadError); setUploading(null); return }
    
    const imageUrl = getImageUrl(filePath)
    await supabase.from('screens').update({ [`${device}_image`]: imageUrl }).eq('id', screenId)
    
    setScreens(screens.map(s => s.id === screenId ? { ...s, [`${device}_image`]: imageUrl } : s))
    setUploading(null)
    setUploadTarget(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function deleteImage(screenId: string, device: 'desktop' | 'mobile') {
    if (!confirm(`Supprimer l'image ${device} ?`)) return
    const screen = screens.find(s => s.id === screenId)
    if (!screen) return
    
    const imageUrl = device === 'desktop' ? screen.desktop_image : screen.mobile_image
    if (imageUrl) {
      const p = imageUrl.split('/mockups/')[1]
      if (p) await supabase.storage.from('mockups').remove([p])
    }
    
    await supabase.from('screens').update({ [`${device}_image`]: null }).eq('id', screenId)
    setScreens(screens.map(s => s.id === screenId ? { ...s, [`${device}_image`]: undefined } : s))
  }

  function copyLink() {
    if (project) {
      navigator.clipboard.writeText(`${window.location.origin}/review/${project.token}`)
      alert('Lien copié !')
    }
  }

  function getScreenVotes(screenId: string): Vote[] {
    return votes.filter(v => v.screen_id === screenId)
  }

  function getTotalVotes(): number {
    return votes.length
  }

  function getUniqueVoters(): string[] {
    return [...new Set(votes.map(v => v.voter_name))]
  }

  if (loading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-400">Chargement...</div>
  if (!project) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white"><div className="text-center"><h1 className="text-xl mb-2">Projet introuvable</h1><Link href="/admin" className="text-violet-400">← Retour</Link></div></div>

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
      
      {/* Modal Stats */}
      {showStats && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Statistiques des votes</h2>
              <button onClick={() => setShowStats(false)} className="text-zinc-400 hover:text-white text-2xl">&times;</button>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-zinc-800 rounded-xl p-4">
                <div className="text-3xl font-bold text-violet-400">{getTotalVotes()}</div>
                <div className="text-sm text-zinc-400">Votes totaux</div>
              </div>
              <div className="bg-zinc-800 rounded-xl p-4">
                <div className="text-3xl font-bold text-rose-400">{getUniqueVoters().length}</div>
                <div className="text-sm text-zinc-400">Votants uniques</div>
              </div>
            </div>

            {getUniqueVoters().length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-zinc-400 mb-2">Participants</h3>
                <div className="flex flex-wrap gap-2">
                  {getUniqueVoters().map(voter => (
                    <span key={voter} className="px-3 py-1 bg-zinc-800 rounded-full text-sm">{voter}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4">
              {screens.map(screen => {
                const screenVotes = getScreenVotes(screen.id)
                if (screenVotes.length === 0) return null
                
                return (
                  <div key={screen.id} className="bg-zinc-800/50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium">{screen.name}</h3>
                      <span className="text-rose-400">{screenVotes.length} vote{screenVotes.length > 1 ? 's' : ''}</span>
                    </div>
                    <p className="text-xs text-zinc-500">{screenVotes.map(v => v.voter_name).join(', ')}</p>
                  </div>
                )
              })}
              
              {votes.length === 0 && (
                <div className="text-center py-8 text-zinc-500">
                  <div className="text-4xl mb-2">📊</div>
                  <p>Aucun vote pour le moment</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={client ? `/admin/client/${client.id}` : '/admin'} className="text-zinc-400 hover:text-white">← {client?.name || 'Retour'}</Link>
            <div>
              {editingProjectName ? (
                <div className="flex items-center gap-2">
                  <input type="text" value={projectName} onChange={(e) => setProjectName(e.target.value)} className="text-xl font-semibold bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 focus:outline-none focus:border-violet-500" autoFocus onKeyDown={(e) => e.key === 'Enter' && updateProjectName()} />
                  <button onClick={updateProjectName} className="text-violet-400 hover:text-violet-300 text-sm">OK</button>
                  <button onClick={() => { setEditingProjectName(false); setProjectName(project.name) }} className="text-zinc-400 hover:text-white text-sm">Annuler</button>
                </div>
              ) : (
                <h1 className="text-xl font-semibold flex items-center gap-2">
                  {project.name}
                  <button onClick={() => setEditingProjectName(true)} className="text-zinc-500 hover:text-white text-sm">✎</button>
                </h1>
              )}
              <p className="text-sm text-zinc-400">{screens.length} écran{screens.length > 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowStats(true)} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg flex items-center gap-2">
              Stats {votes.length > 0 && <span className="bg-rose-500 text-white text-xs px-2 py-0.5 rounded-full">{votes.length}</span>}
            </button>
            <button onClick={copyLink} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg">Copier lien</button>
            <Link href={`/review/${project.token}`} target="_blank" className="px-4 py-2 bg-violet-500 hover:bg-violet-600 rounded-lg font-medium">Voir</Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-medium">Écrans</h2>
          <button onClick={() => setShowNewScreen(true)} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg">+ Ajouter un écran</button>
        </div>

        {showNewScreen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md">
              <h2 className="text-xl font-semibold mb-4">Nouvel écran</h2>
              <input type="text" value={newScreenName} onChange={(e) => setNewScreenName(e.target.value)} placeholder="Page d'accueil..." className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:border-violet-500" autoFocus onKeyDown={(e) => e.key === 'Enter' && createScreen()} />
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => { setShowNewScreen(false); setNewScreenName('') }} className="px-4 py-2 text-zinc-400 hover:text-white">Annuler</button>
                <button onClick={createScreen} disabled={!newScreenName} className="px-4 py-2 bg-violet-500 hover:bg-violet-600 disabled:opacity-50 rounded-lg font-medium">Créer</button>
              </div>
            </div>
          </div>
        )}

        {screens.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-zinc-800 rounded-xl">
            <div className="text-4xl mb-3">🖼️</div>
            <h3 className="text-lg font-medium mb-2">Aucun écran</h3>
            <button onClick={() => setShowNewScreen(true)} className="px-4 py-2 bg-violet-500 hover:bg-violet-600 rounded-lg font-medium">+ Ajouter un écran</button>
          </div>
        ) : (
          <div className="space-y-4">
            {screens.map((screen, screenIndex) => {
              const screenVotes = getScreenVotes(screen.id)
              const desktopLabel = screen.desktop_label || 'Desktop'
              const mobileLabel = screen.mobile_label || 'Mobile'
              return (
                <div key={screen.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col gap-1">
                        <button onClick={() => moveScreen(screenIndex, 'up')} disabled={screenIndex === 0} className="text-zinc-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed text-xs">↑</button>
                        <button onClick={() => moveScreen(screenIndex, 'down')} disabled={screenIndex === screens.length - 1} className="text-zinc-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed text-xs">↓</button>
                      </div>
                      {editingScreenId === screen.id ? (
                        <div className="flex items-center gap-2">
                          <input type="text" value={editingScreenName} onChange={(e) => setEditingScreenName(e.target.value)} className="font-medium bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 focus:outline-none focus:border-violet-500" autoFocus onKeyDown={(e) => { if (e.key === 'Enter') updateScreenName(screen.id); if (e.key === 'Escape') { setEditingScreenId(null); setEditingScreenName('') } }} />
                          <button onClick={() => updateScreenName(screen.id)} className="text-violet-400 hover:text-violet-300 text-sm">OK</button>
                          <button onClick={() => { setEditingScreenId(null); setEditingScreenName('') }} className="text-zinc-400 hover:text-white text-sm">Annuler</button>
                        </div>
                      ) : (
                        <h3 className="font-medium flex items-center gap-2">
                          {screen.name}
                          <button onClick={() => { setEditingScreenId(screen.id); setEditingScreenName(screen.name) }} className="text-zinc-500 hover:text-white text-sm">✎</button>
                        </h3>
                      )}
                      {screenVotes.length > 0 && (
                        <span className="flex items-center gap-1 text-xs text-rose-400">♥ {screenVotes.length}</span>
                      )}
                    </div>
                    <button onClick={() => deleteScreen(screen.id)} className="text-zinc-500 hover:text-red-400 text-sm">Supprimer</button>
                  </div>
                  <div className="p-5">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        {editingLabelId === screen.id && editingLabelType === 'desktop' ? (
                          <div className="flex items-center gap-2">
                            <input type="text" value={editingLabelText} onChange={(e) => setEditingLabelText(e.target.value)} className="text-xs uppercase bg-zinc-800 border border-zinc-700 rounded px-2 py-1 focus:outline-none focus:border-violet-500" autoFocus onKeyDown={(e) => { if (e.key === 'Enter') updateLabel(screen.id); if (e.key === 'Escape') { setEditingLabelId(null); setEditingLabelType(null); setEditingLabelText('') } }} />
                            <button onClick={() => updateLabel(screen.id)} className="text-violet-400 hover:text-violet-300 text-xs">OK</button>
                          </div>
                        ) : (
                          <div className="text-xs text-zinc-500 uppercase flex items-center gap-1">
                            {desktopLabel}
                            <button onClick={() => { setEditingLabelId(screen.id); setEditingLabelType('desktop'); setEditingLabelText(desktopLabel) }} className="text-zinc-600 hover:text-white">✎</button>
                          </div>
                        )}
                        {screen.desktop_image ? (
                          <div className="relative group">
                            <img src={screen.desktop_image} alt={desktopLabel} className="w-full h-40 object-cover rounded-lg border border-zinc-700" />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 rounded-lg transition-opacity">
                              <button onClick={() => triggerUpload(screen.id, 'desktop')} className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm">Remplacer</button>
                              <button onClick={() => deleteImage(screen.id, 'desktop')} className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-lg text-sm">Supprimer</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => triggerUpload(screen.id, 'desktop')} disabled={uploading === `${screen.id}-desktop`} className="w-full h-40 border-2 border-dashed border-zinc-700 hover:border-violet-500 rounded-lg flex items-center justify-center text-zinc-500 hover:text-violet-400">
                            {uploading === `${screen.id}-desktop` ? 'Upload...' : '+ Ajouter'}
                          </button>
                        )}
                      </div>
                      <div className="space-y-2">
                        {editingLabelId === screen.id && editingLabelType === 'mobile' ? (
                          <div className="flex items-center gap-2">
                            <input type="text" value={editingLabelText} onChange={(e) => setEditingLabelText(e.target.value)} className="text-xs uppercase bg-zinc-800 border border-zinc-700 rounded px-2 py-1 focus:outline-none focus:border-violet-500" autoFocus onKeyDown={(e) => { if (e.key === 'Enter') updateLabel(screen.id); if (e.key === 'Escape') { setEditingLabelId(null); setEditingLabelType(null); setEditingLabelText('') } }} />
                            <button onClick={() => updateLabel(screen.id)} className="text-violet-400 hover:text-violet-300 text-xs">OK</button>
                          </div>
                        ) : (
                          <div className="text-xs text-zinc-500 uppercase flex items-center gap-1">
                            {mobileLabel}
                            <button onClick={() => { setEditingLabelId(screen.id); setEditingLabelType('mobile'); setEditingLabelText(mobileLabel) }} className="text-zinc-600 hover:text-white">✎</button>
                          </div>
                        )}
                        {screen.mobile_image ? (
                          <div className="relative group">
                            <img src={screen.mobile_image} alt={mobileLabel} className="w-full h-40 object-cover rounded-lg border border-zinc-700" />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 rounded-lg transition-opacity">
                              <button onClick={() => triggerUpload(screen.id, 'mobile')} className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm">Remplacer</button>
                              <button onClick={() => deleteImage(screen.id, 'mobile')} className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-lg text-sm">Supprimer</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => triggerUpload(screen.id, 'mobile')} disabled={uploading === `${screen.id}-mobile`} className="w-full h-40 border-2 border-dashed border-zinc-700 hover:border-violet-500 rounded-lg flex items-center justify-center text-zinc-500 hover:text-violet-400">
                            {uploading === `${screen.id}-mobile` ? 'Upload...' : '+ Ajouter'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
