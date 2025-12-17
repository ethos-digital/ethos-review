'use client'

import { useEffect, useState } from 'react'
import { supabase, Client, Project } from '@/lib/supabase'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'

export default function ClientPublicPage() {
  const params = useParams()
  const token = params.token as string
  const [client, setClient] = useState<Client | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)

  useEffect(() => { loadData() }, [token])

  async function loadData() {
    const { data: clientData, error } = await supabase.from('clients').select('*').eq('token', token).single()
    if (error || !clientData) { setNotFound(true); setLoading(false); return }
    setClient(clientData)
    const { data: projectsData } = await supabase.from('projects').select('*').eq('client_id', clientData.id).order('created_at', { ascending: false })
    if (projectsData) setProjects(projectsData)
    setLoading(false)
  }

  async function downloadProjectImages(projectId: string, projectName: string) {
    setDownloading(projectId)
    try {
      const { data: screens } = await supabase.from('screens').select('*, versions(*)').eq('project_id', projectId)
      if (!screens) { setDownloading(null); return }

      const zip = new JSZip()
      let hasImages = false

      for (const screen of screens) {
        const versions = (screen.versions || []).sort((a: any, b: any) => a.version_number - b.version_number)
        for (const version of versions) {
          if (version.desktop_image) {
            try {
              const response = await fetch(version.desktop_image)
              const blob = await response.blob()
              const ext = version.desktop_image.split('.').pop()?.split('?')[0] || 'jpg'
              zip.file(`${screen.name}/v${version.version_number}-desktop.${ext}`, blob)
              hasImages = true
            } catch (e) { console.error('Error fetching desktop image:', e) }
          }
          if (version.mobile_image) {
            try {
              const response = await fetch(version.mobile_image)
              const blob = await response.blob()
              const ext = version.mobile_image.split('.').pop()?.split('?')[0] || 'jpg'
              zip.file(`${screen.name}/v${version.version_number}-mobile.${ext}`, blob)
              hasImages = true
            } catch (e) { console.error('Error fetching mobile image:', e) }
          }
        }
      }

      if (!hasImages) {
        alert('Aucune image à télécharger')
        setDownloading(null)
        return
      }

      const content = await zip.generateAsync({ type: 'blob' })
      const safeName = projectName.replace(/[^a-zA-Z0-9-_]/g, '_')
      saveAs(content, `${safeName}.zip`)
    } catch (err) {
      console.error('Download error:', err)
      alert('Erreur lors du téléchargement')
    }
    setDownloading(null)
  }

  if (loading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-400">Chargement...</div>
  if (notFound || !client) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-4">🔒</div>
        <h1 className="text-2xl font-medium text-white mb-2">Page introuvable</h1>
        <p className="text-zinc-400">Ce lien n'est pas valide.</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <p className="text-sm text-zinc-400 mb-1">Conception Ethos Digital</p>
          <h1 className="text-2xl font-bold">{client.name}</h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {projects.length === 0 ? (
          <div className="text-center py-12">
            <h2 className="text-xl font-medium text-zinc-400 mb-2">Aucun projet pour le moment</h2>
            <p className="text-zinc-500">Les projets seront bientôt disponibles.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <div key={project.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-colors">
                <Link href={`/review/${project.token}`} className="block">
                  <h3 className="text-lg font-semibold text-white hover:text-zinc-300 transition-colors">{project.name}</h3>
                  <p className="text-sm text-zinc-500 mt-1">{new Date(project.created_at).toLocaleDateString('fr-CH')}</p>
                </Link>
                <div className="flex gap-2 mt-4">
                  <Link href={`/review/${project.token}`} className="flex-1 px-3 py-2 bg-violet-500 hover:bg-violet-600 rounded-lg text-sm font-medium text-center transition-colors">Voir</Link>
                  <button 
                    onClick={() => downloadProjectImages(project.id, project.name)}
                    disabled={downloading === project.id}
                    className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors disabled:opacity-50"
                  >
                    {downloading === project.id ? 'Création...' : 'ZIP'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-zinc-800 py-4 mt-auto">
        <div className="max-w-6xl mx-auto px-4 text-center text-zinc-500 text-sm">© 2025 Ethos Digital</div>
      </footer>
    </div>
  )
}
