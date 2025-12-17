'use client'

import { useEffect, useState } from 'react'
import { supabase, Client } from '@/lib/supabase'
import Link from 'next/link'
import Image from 'next/image'

export default function AdminPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewClient, setShowNewClient] = useState(false)
  const [newClientName, setNewClientName] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => { loadClients() }, [])

  async function loadClients() {
    const { data } = await supabase.from('clients').select('*').order('name')
    if (data) setClients(data)
    setLoading(false)
  }

  async function createClient() {
    if (!newClientName.trim()) return
    setCreating(true)
    const { data } = await supabase.from('clients').insert([{ name: newClientName.trim() }]).select().single()
    if (data) {
      setClients([...clients, data].sort((a, b) => a.name.localeCompare(b.name)))
      setNewClientName('')
      setShowNewClient(false)
    }
    setCreating(false)
  }

  async function deleteClient(id: string, name: string) {
    if (!confirm(`Supprimer le client "${name}" et tous ses projets ?`)) return
    await supabase.from('clients').delete().eq('id', id)
    setClients(clients.filter(c => c.id !== id))
  }

  function copyLink(token: string) {
    navigator.clipboard.writeText(`${window.location.origin}/c/${token}`)
    alert('Lien copié !')
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo-ed.svg" alt="Ethos Digital" className="h-10" />
          </div>
          <button onClick={() => setShowNewClient(true)} className="px-4 py-2 bg-violet-500 hover:bg-violet-600 rounded-lg font-medium transition-colors">+ Nouveau client</button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {showNewClient && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md">
              <h2 className="text-xl font-semibold mb-4">Nouveau client</h2>
              <input type="text" value={newClientName} onChange={(e) => setNewClientName(e.target.value)} placeholder="Nom du client" className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:border-violet-500" autoFocus onKeyDown={(e) => e.key === 'Enter' && createClient()} />
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => { setShowNewClient(false); setNewClientName('') }} className="px-4 py-2 text-zinc-400 hover:text-white">Annuler</button>
                <button onClick={createClient} disabled={creating || !newClientName.trim()} className="px-4 py-2 bg-violet-500 hover:bg-violet-600 disabled:opacity-50 rounded-lg font-medium">{creating ? 'Création...' : 'Créer'}</button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-zinc-400">Chargement...</div>
        ) : clients.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl">👥</div>
            <h2 className="text-xl font-medium mb-2">Aucun client</h2>
            <p className="text-zinc-400 mb-4">Créez votre premier client pour commencer</p>
            <button onClick={() => setShowNewClient(true)} className="px-4 py-2 bg-violet-500 hover:bg-violet-600 rounded-lg font-medium">+ Nouveau client</button>
          </div>
        ) : (
          <div className="grid gap-3">
            {clients.map((client) => (
              <div key={client.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors flex items-center justify-between">
                <Link href={`/admin/client/${client.id}`} className="flex-1 font-medium text-lg hover:text-violet-400 transition-colors">{client.name}</Link>
                <div className="flex items-center gap-2">
                  <button onClick={() => copyLink(client.token)} className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm">Lien</button>
                  <Link href={`/admin/client/${client.id}`} className="px-3 py-1.5 bg-violet-500 hover:bg-violet-600 rounded-lg text-sm font-medium">Projets</Link>
                  <button onClick={() => deleteClient(client.id, client.name)} className="px-3 py-1.5 bg-zinc-800 hover:bg-red-500/20 hover:text-red-400 rounded-lg text-sm">Supprimer</button>
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
