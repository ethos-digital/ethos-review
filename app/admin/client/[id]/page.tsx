'use client'

import { useEffect, useState } from 'react'
import { supabase, Client, Project } from '@/lib/supabase'
import Link from 'next/link'
import { useParams } from 'next/navigation'

export default function ClientProjectsPage() {
  const params = useParams()
  const clientId = params.id as string
  const [client, setClient] = useState<Client | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewProject, setShowNewProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => { loadData() }, [clientId])

  async function loadData() {
    const { data: clientData } = await supabase.from('clients').select('*').eq('id', clientId).single()
    if (clientData) setClient(clientData)
    const { data: projectsData } = await supabase.from('projects').select('*').eq('client_id', clientId).order('created_at', { ascending: false })
    if (projectsData) setProjects(projectsData)
    setLoading(false)
  }

  async function createProject() {
    if (!newProjectName.trim()) return
    setCreating(true)
    const { data } = await supabase.from('projects').insert([{ client_id: clientId, name: newProjectName.trim() }]).select().single()
    if (data) {
      setProjects([data, ...projects])
      setNewProjectName('')
      setShowNewProject(false)
    }
    setCreating(false)
  }

  async function deleteProject(id: string, name: string) {
    if (!confirm(`Supprimer le projet "${name}" ?`)) return
    await supabase.from('projects').delete().eq('id', id)
    setProjects(projects.filter(p => p.id !== id))
  }

  function copyLink(token: string) {
    navigator.clipboard.writeText(`${window.location.origin}/review/${token}`)
    alert('Lien copié !')
  }

  function copyClientLink() {
    if (!client) return
    navigator.clipboard.writeText(`${window.location.origin}/c/${client.token}`)
    alert('Lien client copié !')
  }

  if (loading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-400">Chargement...</div>
  if (!client) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center"><div className="text-center"><h1 className="text-xl font-medium mb-2 text-white">Client introuvable</h1><Link href="/admin" className="text-violet-400">← Retour</Link></div></div>

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-zinc-400 hover:text-white">← Retour</Link>
            <div>
              <h1 className="text-xl font-semibold">{client.name}</h1>
              <p className="text-sm text-zinc-400">{projects.length} projet{projects.length > 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={copyClientLink} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg">Copier lien client</button>
            <button onClick={() => setShowNewProject(true)} className="px-4 py-2 bg-violet-500 hover:bg-violet-600 rounded-lg font-medium">+ Nouveau projet</button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {showNewProject && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md">
              <h2 className="text-xl font-semibold mb-4">Nouveau projet</h2>
              <input type="text" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} placeholder="Nom du projet" className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:border-violet-500" autoFocus onKeyDown={(e) => e.key === 'Enter' && createProject()} />
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => { setShowNewProject(false); setNewProjectName('') }} className="px-4 py-2 text-zinc-400 hover:text-white">Annuler</button>
                <button onClick={createProject} disabled={creating || !newProjectName.trim()} className="px-4 py-2 bg-violet-500 hover:bg-violet-600 disabled:opacity-50 rounded-lg font-medium">{creating ? 'Création...' : 'Créer'}</button>
              </div>
            </div>
          </div>
        )}

        {projects.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl">📁</div>
            <h2 className="text-xl font-medium mb-2">Aucun projet</h2>
            <p className="text-zinc-400 mb-4">Créez votre premier projet pour ce client</p>
            <button onClick={() => setShowNewProject(true)} className="px-4 py-2 bg-violet-500 hover:bg-violet-600 rounded-lg font-medium">+ Nouveau projet</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <div key={project.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700">
                <Link href={`/admin/project/${project.id}`} className="block font-medium text-lg hover:text-violet-400 mb-1">{project.name}</Link>
                <p className="text-sm text-zinc-500 mb-4">{new Date(project.created_at).toLocaleDateString('fr-CH')}</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => copyLink(project.token)} className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm">Lien</button>
                  <Link href={`/admin/project/${project.id}`} className="px-3 py-1.5 bg-violet-500 hover:bg-violet-600 rounded-lg text-sm font-medium">Gérer</Link>
                  <button onClick={() => deleteProject(project.id, project.name)} className="px-3 py-1.5 bg-zinc-800 hover:bg-red-500/20 hover:text-red-400 rounded-lg text-sm">Supprimer</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
