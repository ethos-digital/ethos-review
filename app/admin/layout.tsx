'use client'

import { useState, useEffect } from 'react'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const saved = localStorage.getItem('ethos-admin-auth')
    if (saved === process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
      setIsAuthenticated(true)
    }
    setLoading(false)
  }, [])

  function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (password === process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
      localStorage.setItem('ethos-admin-auth', password)
      setIsAuthenticated(true)
      setError('')
    } else {
      setError('Mot de passe incorrect')
    }
  }

  function handleLogout() {
    localStorage.removeItem('ethos-admin-auth')
    setIsAuthenticated(false)
    setPassword('')
  }

  if (loading) {
    return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-400">Chargement...</div>
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 w-full max-w-sm">
          <div className="flex justify-center mb-6">
            <img src="/logo-ed.svg" alt="Ethos Digital" className="h-12" />
          </div>
          <h1 className="text-xl font-semibold text-white text-center mb-6">Admin Ethos Review</h1>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mot de passe"
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-violet-500"
              autoFocus
            />
            {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
            <button
              type="submit"
              className="w-full mt-4 px-4 py-3 bg-violet-500 hover:bg-violet-600 rounded-lg font-medium text-white transition-colors"
            >
              Connexion
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="fixed top-4 right-4 z-50">
        <button onClick={handleLogout} className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-zinc-400 hover:text-white">
          Déconnexion
        </button>
      </div>
      {children}
    </div>
  )
}
