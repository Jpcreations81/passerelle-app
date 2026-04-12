import React from 'react'

/**
 * PageHeader — barre du haut avec logo Passerelle + titre + actions
 * Usage :
 *   <PageHeader icon="📅" title="Agenda" subtitle="Marie Laurent · Gaillac-Graulhet">
 *     <button>+ Ajouter</button>
 *   </PageHeader>
 */
export default function PageHeader({ icon, title, subtitle, children }) {
  return (
    <header className="page-header">
      {/* Logo Passerelle en dégradé */}
      <img
        src="/logo_2.png"
        alt="Passerelle"
        className="header-logo"
        style={{
          height: 32,
          width: 'auto',
          objectFit: 'contain',
          filter: 'none',
          flexShrink: 0,
        }}
        onError={e => { e.target.style.display = 'none' }}
      />

      {/* Séparateur */}
      <div className="header-sep" />

      {/* Icône de page + titre */}
      {icon && <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="page-title">{title}</div>
        {subtitle && <div className="page-subtitle">{subtitle}</div>}
      </div>

      {/* Actions (boutons) */}
      {children && (
        <div className="header-actions">
          {children}
        </div>
      )}
    </header>
  )
}
