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
      {/* Logo — P stylisé */}
      <div className="s-logo" style={{ marginBottom: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: 'rgba(255,255,255,0.15)',
          border: '1px solid rgba(255,255,255,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer'
        }} onClick={() => navigate('/')}>
          <span style={{
            fontSize: 22, fontWeight: 800, color: '#fff',
            fontFamily: 'Sora, sans-serif', letterSpacing: '-1px',
            lineHeight: 1
          }}>P</span>
        </div>
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
