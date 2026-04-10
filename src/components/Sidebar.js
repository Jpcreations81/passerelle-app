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
    <aside className="sidebar" style={{
      background: 'linear-gradient(180deg, #0d2b5e 0%, #1a4b8f 55%, #2d7a1f 100%)'
    }}>
      {/* Logo Passerelle */}
      <div className="s-logo" style={{ marginBottom: 16, padding: '8px 0' }}>
        <img
          src="/logo_2.png"
          alt="Passerelle"
          style={{ width: 46, height: 46, objectFit: 'contain', filter: 'brightness(0) invert(1)' }}
          onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
        />
        {/* Fallback emoji si logo pas encore uploadé */}
        <span style={{ fontSize: 28, filter: 'brightness(0) invert(1)', display: 'none' }}>🌉</span>
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
