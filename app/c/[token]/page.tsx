'use client'

import { useEffect, useState } from 'react'
import { supabase, Client, Project, Screen } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'

export default function ClientPortalPage() {
  const params = useParams()
  const token = params.token as string
  
  const [client, setClient] = useState<Client | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)

  useEffect(() => {
    loadClient()
  }, [token])

  async function loadClient() {
    const { data: clientData, error } = await supabase
      .from('clients')
      .select('*')
      .eq('token', token)
      .single()
    
    if (error || !clientData) {
      setNotFound(true)
      setLoading(false)
      return
    }
    
    setClient(clientData)
    
    const { data: projectsData } = await supabase
      .from('projects')
      .select('*')
      .eq('client_id', clientData.id)
      .order('created_at', { ascending: false })
    
    if (projectsData) {
      setProjects(projectsData)
    }
    
    setLoading(false)
  }

  async function downloadProjectZip(project: Project) {
    setDownloading(project.id)
    
    try {
      // Charger les écrans du projet
      const { data: screens } = await supabase
        .from('screens')
        .select('*')
        .eq('project_id', project.id)
        .order('sort_order')
      
      if (!screens || screens.length === 0) {
        alert('Aucun écran dans ce projet')
        setDownloading(null)
        return
      }

      const zip = new JSZip()
      const projectFolder = zip.folder(project.name.replace(/[^a-zA-Z0-9]/g, '_'))
      
      if (!projectFolder) {
        setDownloading(null)
        return
      }

      let hasImages = false

      for (const screen of screens) {
        const screenFolder = projectFolder.folder(screen.name.replace(/[^a-zA-Z0-9]/g, '_'))
        if (!screenFolder) continue

        const desktopLabel = (screen.desktop_label || 'desktop').replace(/[^a-zA-Z0-9]/g, '_')
        const mobileLabel = (screen.mobile_label || 'mobile').replace(/[^a-zA-Z0-9]/g, '_')

        // Desktop image
        if (screen.desktop_image) {
          try {
            const response = await fetch(screen.desktop_image)
            if (response.ok) {
              const blob = await response.blob()
              const ext = screen.desktop_image.split('.').pop() || 'jpg'
              screenFolder.file(`${desktopLabel}.${ext}`, blob)
              hasImages = true
            }
          } catch (e) {
            console.error('Erreur téléchargement desktop:', e)
          }
        }

        // Mobile image
        if (screen.mobile_image) {
          try {
            const response = await fetch(screen.mobile_image)
            if (response.ok) {
              const blob = await response.blob()
              const ext = screen.mobile_image.split('.').pop() || 'jpg'
              screenFolder.file(`${mobileLabel}.${ext}`, blob)
              hasImages = true
            }
          } catch (e) {
            console.error('Erreur téléchargement mobile:', e)
          }
        }
      }

      if (!hasImages) {
        alert('Aucune image trouvée dans ce projet')
        setDownloading(null)
        return
      }

      const content = await zip.generateAsync({ type: 'blob' })
      saveAs(content, `${project.name.replace(/[^a-zA-Z0-9]/g, '_')}.zip`)
    } catch (error) {
      console.error('Erreur ZIP:', error)
      alert('Erreur lors de la création du ZIP')
    }
    
    setDownloading(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-zinc-400">Chargement...</div>
      </div>
    )
  }

  if (notFound || !client) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-medium mb-2 text-white">Accès non autorisé</h1>
          <p className="text-zinc-400">Ce lien n est pas valide.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <p className="text-sm text-zinc-400 mb-1">Espace client</p>
          <h1 className="text-2xl font-bold">{client.name}</h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {projects.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📁</div>
            <h2 className="text-xl font-medium mb-2">Aucun projet</h2>
            <p className="text-zinc-400">Vos projets apparaîtront ici.</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {projects.map(project => (
              <div key={project.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-700 transition-colors">
                <div className="p-5">
                  <h3 className="text-lg font-semibold text-white hover:text-zinc-300 mb-2">{project.name}</h3>
                  <p className="text-sm text-zinc-500">{new Date(project.created_at).toLocaleDateString('fr-CH')}</p>
                  <div className="flex gap-2 mt-4">
                    <Link href={`/review/${project.token}`} className="flex-1 py-2 bg-violet-500 hover:bg-violet-600 rounded-lg font-medium text-center transition-colors">
                      Voir
                    </Link>
                    <button
                      onClick={() => downloadProjectZip(project)}
                      disabled={downloading === project.id}
                      className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 rounded-lg font-medium transition-colors"
                    >
                      {downloading === project.id ? '...' : 'ZIP'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-zinc-800 mt-16">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center text-zinc-500 text-sm">
          Conception par Ethos Digital
        </div>
      </footer>
    </div>
  )
}
