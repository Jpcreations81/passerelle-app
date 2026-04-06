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
    <aside className="sidebar">
      <div className="s-logo">
        <span style={{ fontSize: 28, filter: 'brightness(0) invert(1)' }}>🌉</span>
      </div>
      <nav className="s-nav">
        {navItems.map(item => (
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
