import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Sidebar from '../components/Sidebar'

export default function Dashboard({ profile, session }) {
  const [enfants, setEnfants] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => { fetchEnfants() }, [profile])

  async function fetchEnfants() {
    if (!profile) return
    let query = supabase.from('enfants').select(`
      *,
      af_principal:af_principal_id(nom, prenom, matricule),
      referent:referent_id(nom, prenom)
    `)
    if (profile.role === 'af') {
      query = query.eq('af_principal_id', profile.id)
    } else if (profile.role === 'referent') {
      query = query.eq('referent_id', profile.id)
    }
    const { data, error } = await query.order('created_at', { ascending: false })
    if (!error) setEnfants(data || [])
    setLoading(false)
  }

  const statutLabels = {
    en_accueil: '🏠 En accueil', en_relais: '🔄 En relais',
    en_famille: '👨‍👩‍👧 En famille', en_parrainage: '🤝 En parrainage',
    colonie_vacances: '🏕️ Colonie vacances', colonie_neige: '⛷️ Colonie neige',
    centre_departemental: '🏛️ Centre départemental', hospitalisation: '🏥 Hospitalisation',
    urgence_provisoire: '🚨 Urgence provisoire',
  }

  const statutColors = {
    en_accueil: { bg: '#e6f5eb', color: '#2e8b4a' },
    en_relais: { bg: '#e0f2fe', color: '#0891b2' },
    urgence_provisoire: { bg: '#fdf0ee', color: '#c0392b' },
  }

  const typePlacementLabels = {
    judiciaire: '⚖️ Judiciaire', administratif: '📋 Administratif',
    urgence: '🚨 Urgence', secret: '🔒 Secret',
  }

  return (
    <div className="app-layout">
      <Sidebar profile={profile} />
      <div className="main-content">

        <header className="page-header">
          <span style={{ fontSize:20 }}>🏠</span>
          <div>
            <div className="page-title">
              Bonjour {profile?.prenom} {profile?.nom}
              {profile?.matricule && <span style={{ fontSize:11, color:'#9aa3b8', fontWeight:400, marginLeft:8 }}>N° {profile.matricule}</span>}
            </div>
            <div className="page-subtitle">
              {profile?.territoire} · {profile?.role === 'af' ? 'Assistant(e) Familial(e)' :
                profile?.role === 'referent' ? 'Référent(e) ASE' :
                profile?.role === 'encadrant' ? 'Encadrant(e) Technique' :
                profile?.role === 'rtase' ? 'Responsable Territorial ASE' : profile?.role}
            </div>
          </div>
          <div className="header-actions">
            {profile?.role === 'af' && enfants.length > 0 && (
              <button className="btn btn-primary" onClick={() => navigate('/fiche-presence')}>
                📋 Fiche présence
              </button>
            )}
            {['referent','encadrant','rtase','admin'].includes(profile?.role) && (
              <button className="btn btn-danger" onClick={() => navigate('/urgence')}>
                🚨 Placement urgence
              </button>
            )}
          </div>
        </header>

        <div className="page-content">

          {/* Stats */}
          <div style={{ display:'grid', gridTemplateColumns: profile?.role === 'af' ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap:10, marginBottom:16 }}>
            <StatCard val={enfants.length} label="Enfants accueillis" color="#1a4b8f" onClick={() => navigate('/enfants')} />
            {profile?.role !== 'af' && (
              <>
                <StatCard val={47} label="AF actifs" color="#2e8b4a" />
                <StatCard val={8} label="Places disponibles" color="#d97706" sub="dont 3 urgences" />
                <StatCard val={3} label="Audiences TJ" color="#6d4c9e" sub="ce mois" />
              </>
            )}
            {profile?.role === 'af' && (
              <StatCard val={12} label="Jours solde congés" color="#2e8b4a" />
            )}
          </div>

          {/* Alertes dynamiques selon le rôle */}
          <div className="card">
            <div className="card-header" style={{ cursor:'default' }}><h3>⚠️ Alertes du jour</h3></div>
            <div className="card-body">

              {/* Alertes AF */}
              {profile?.role === 'af' && enfants.length > 0 && (
                <AlertItem
                  icon="📋"
                  title="Fiche de présence à envoyer"
                  sub={'Avril 2026 · ' + enfants.map(e => e.prenom).join(' & ') + ' · Échéance 30 avril'}
                  type="warn"
                  onClick={() => navigate('/fiche-presence')}
                />
              )}
              {profile?.role === 'af' && enfants.some(e => e.numero_dossier === 'CD81-2026-0089') && (
                <AlertItem
                  icon="💉"
                  title="Rappel vaccin ROR — Lou Pereira"
                  sub="Rappel prévu mars 2026 — À planifier"
                  type="info"
                  onClick={() => navigate('/enfant/' + (enfants.find(e => e.numero_dossier === 'CD81-2026-0089')?.id || ''))}
                />
              )}

              {/* Alertes ASE */}
              {['referent','encadrant','rtase','admin'].includes(profile?.role) && (
                <>
                  <AlertItem icon="🚨" title="Relais non trouvé — Martin René" sub="Congés 15-30 mai · Hugo M. · Sara L. · J-33" type="danger" onClick={() => {}} />
                  <AlertItem icon="⚠️" title="Agrément expirant — Martin René" sub="Expire le 15/04/2026 · Renouvellement urgent" type="warn" onClick={() => {}} />
                </>
              )}

              {/* Aucune alerte */}
              {profile?.role === 'af' && enfants.length === 0 && (
                <div style={{ textAlign:'center', color:'#9aa3b8', padding:16, fontSize:12 }}>Aucune alerte pour le moment</div>
              )}
            </div>
          </div>

          {/* Enfants */}
          <div className="card">
            <div className="card-header">
              <h3>👶 {profile?.role === 'af' ? 'Enfants accueillis' : 'Enfants de mon territoire'}</h3>
              <button className="btn btn-secondary" onClick={() => navigate('/enfants')}>Voir tous →</button>
            </div>
            <div className="card-body">
              {loading ? (
                <div className="loading-spinner">⏳ Chargement...</div>
              ) : enfants.length === 0 ? (
                <div style={{ textAlign:'center', color:'#9aa3b8', padding:20, fontSize:13 }}>
                  {profile?.role === 'af' ? 'Aucun enfant accueilli pour le moment' : 'Aucun enfant trouvé'}
                </div>
              ) : (
                enfants.map(enfant => {
                  const statut = statutLabels[enfant.statut] || enfant.statut
                  const sc = statutColors[enfant.statut] || { bg:'#eef1f8', color:'#5a6478' }
                  return (
                    <div key={enfant.id} onClick={() => navigate(`/enfant/${enfant.id}`)}
                      style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 13px', background:'#eef1f8', borderRadius:10, marginBottom:8, cursor:'pointer', border:'1px solid #dde3f0', transition:'all .15s' }}
                      onMouseOver={e => { e.currentTarget.style.borderColor='#1a4b8f'; e.currentTarget.style.background='#e8eef8' }}
                      onMouseOut={e => { e.currentTarget.style.borderColor='#dde3f0'; e.currentTarget.style.background='#eef1f8' }}
                    >
                      <div style={{ width:38, height:38, borderRadius:'50%', background:'linear-gradient(135deg,#1a4b8f,#2e8b4a)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'#fff', flexShrink:0 }}>
                        {enfant.prenom[0]}{enfant.nom[0]}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:600 }}>{enfant.prenom} {enfant.nom}</div>
                        <div style={{ fontSize:10, color:'#9aa3b8', marginTop:2 }}>
                          {enfant.numero_dossier && `N° ${enfant.numero_dossier} · `}
                          {enfant.type_placement && typePlacementLabels[enfant.type_placement]}
                        </div>
                      </div>
                      <span style={{ padding:'3px 9px', borderRadius:10, fontSize:10, fontWeight:600, background:sc.bg, color:sc.color }}>{statut}</span>
                      <span style={{ fontSize:16, color:'#9aa3b8' }}>›</span>
                    </div>
                  )
                })
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

function StatCard({ val, label, color, sub, onClick }) {
  return (
    <div onClick={onClick}
      style={{ background:'#fff', borderRadius:12, padding:14, textAlign:'center', boxShadow:'0 2px 10px rgba(26,75,143,.07)', border:'1px solid #dde3f0', cursor: onClick ? 'pointer' : 'default', transition:'all .15s' }}
      onMouseOver={e => onClick && (e.currentTarget.style.transform='translateY(-2px)')}
      onMouseOut={e => onClick && (e.currentTarget.style.transform='translateY(0)')}
    >
      <div style={{ fontSize:28, fontWeight:700, color }}>{val}</div>
      <div style={{ fontSize:10, color:'#9aa3b8', marginTop:3, textTransform:'uppercase', letterSpacing:'.3px' }}>{label}</div>
      {sub && <div style={{ fontSize:10, fontWeight:600, color, marginTop:2 }}>{sub}</div>}
    </div>
  )
}

function AlertItem({ icon, title, sub, type, onClick }) {
  const colors = {
    warn:   { bg:'#fef3e2', border:'#f5dca4', color:'#d97706' },
    info:   { bg:'#e8eef8', border:'#c4d4f5', color:'#1a4b8f' },
    danger: { bg:'#fdf0ee', border:'#f5c4c4', color:'#c0392b' },
    ok:     { bg:'#e6f5eb', border:'#c4e8cc', color:'#2e8b4a' },
  }
  const c = colors[type] || colors.info
  return (
    <div onClick={onClick}
      style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 13px', borderRadius:10, marginBottom:7, cursor:'pointer', border:`1px solid ${c.border}`, background:c.bg, transition:'all .15s' }}
    >
      <span style={{ fontSize:20 }}>{icon}</span>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:12, fontWeight:600 }}>{title}</div>
        <div style={{ fontSize:10, marginTop:2, opacity:.8 }}>{sub}</div>
      </div>
      <span style={{ fontSize:16, color:c.color }}>›</span>
    </div>
  )
}
