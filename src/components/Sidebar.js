import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const navItems = [
  { icon: '🏠', label: 'Accueil', path: '/' },
  { icon: '👶', label: 'Enfants', path: '/enfants' },
  { icon: '👨‍👩‍👧', label: 'Assfam', path: '/assfam' },
  { icon: '📅', label: 'Agenda', path: '/agenda' },
  { icon: '📂', label: 'Docs', path: '/documents' },
  { icon: '📄', label: 'Rapports', path: '/rapports' },
  { icon: '🏛️', label: 'ASE', path: '/ase' },
]

export default function Sidebar({ profile }) {
  const navigate = useNavigate()
  const location = useLocation()

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  const initiales = profile
    ? (profile.prenom?.[0] || '') + (profile.nom?.[0] || '')
    : 'JP'

  function isActive(path) {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <aside className="sidebar" style={{
      background: 'linear-gradient(180deg, #0d2b5e 0%, #1a4b8f 55%, #2d7a1f 100%)'
    }}>
      {/* Pas de logo ici — il est dans la barre du haut */}
      <div style={{ height: 16 }} />

      <nav className="s-nav">
        {navItems.filter(item => {
          if (item.path === '/enfants' && profile?.role === 'encadrant') return false
          if (item.path === '/assfam' && profile?.role === 'referent') return false
          return true
        }).map(item => (
          <button
            key={item.path}
            className={`s-nav-btn ${isActive(item.path) ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <span className="icon">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      <div
        className="s-av"
        onClick={handleLogout}
        title="Déconnexion"
      >
        {initiales.toUpperCase()}
      </div>
    </aside>
  )
}
