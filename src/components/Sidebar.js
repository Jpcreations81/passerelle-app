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
      {/* Logo — icône seule centrée */}
      <div className="s-logo" style={{ marginBottom: 12 }} onClick={() => navigate('/')}
        title="Passerelle — Accueil">
        <img
          src="/logo_2.png"
          alt="P"
          style={{
            width: 40, height: 40,
            objectFit: 'contain',
            filter: 'brightness(0) invert(1)',
            cursor: 'pointer',
            // On affiche uniquement la partie icône gauche du logo (les 2 personnages)
            // en clippant l'image à sa moitié gauche
            clipPath: 'inset(0 50% 0 0)',
            transform: 'scale(1.8) translateX(8px)',
          }}
        />
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
