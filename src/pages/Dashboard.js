import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Sidebar from '../components/Sidebar'
import PageHeader from '../components/PageHeader'

export default function Dashboard({ profile, session }) {
  const [enfants, setEnfants] = useState([])
  const [loading, setLoading] = useState(true)
  const [demandesModif, setDemandesModif] = useState([])      // modifs à valider (je suis valideur)
  const [mesRetours, setMesRetours] = useState([])            // réponses reçues sur mes demandes
  const [mesEnAttente, setMesEnAttente] = useState([])        // mes demandes envoyées, en attente
  const [relaisInconnus, setRelaisInconnus] = useState([])    // événements relais avec famille inconnue
  const [alertesAgrement, setAlertesAgrement] = useState([])  // AF avec agrément expiré ou expirant
  const navigate = useNavigate()

  useEffect(() => {
    if (!profile) return
    fetchEnfants()
    fetchDemandesModif()
    fetchMesRetours()
    fetchMesEnAttente()
    fetchRelaisInconnus()
    fetchAlertesAgrement()
  }, [profile])

  async function fetchAlertesAgrement() {
    if (!profile || profile.role === 'af') return
    const { data } = await supabase.from('profiles')
      .select('id, nom, prenom, date_expiration_agrement')
      .eq('role', 'af')
      .not('date_expiration_agrement', 'is', null)
    if (data) {
      const alertes = data.filter(af => {
        const jours = Math.ceil((new Date(af.date_expiration_agrement) - new Date()) / (1000*60*60*24))
        return jours <= 90
      }).sort((a, b) => new Date(a.date_expiration_agrement) - new Date(b.date_expiration_agrement))
      setAlertesAgrement(alertes)
    }
  }

  async function fetchEnfants() {
    if (!profile) return
    let query = supabase.from('enfants').select(`
      *,
      af_principal:af_principal_id(nom, prenom, matricule),
      referent:referent_id(nom, prenom)
    `)
    if (profile.role === 'af') {
      query = query.eq('af_principal_id', profile.id).neq('type_placement', 'non_place')
    } else if (profile.role === 'referent') {
      query = query.eq('referent_id', profile.id).neq('type_placement', 'non_place')
    }
    const { data, error } = await query.order('created_at', { ascending: false })
    if (!error) setEnfants(data || [])
    setLoading(false)
  }

  // Demandes reçues à valider (je suis valideur_id)
  async function fetchDemandesModif() {
    if (!profile) return
    const { data } = await supabase
      .from('evenements_modifications')
      .select('id, demandeur:demandeur_id(nom,prenom), evenement:evenement_id(titre)')
      .eq('valideur_id', profile.id)
      .eq('statut', 'en_attente')
    if (data) setDemandesModif(data)
  }

  // Mes demandes envoyées en attente de validation (je suis demandeur)
  async function fetchMesEnAttente() {
    if (!profile) return
    const { data } = await supabase
      .from('evenements_modifications')
      .select('id, evenement:evenement_id(titre), valideur:valideur_id(nom,prenom)')
      .eq('demandeur_id', profile.id)
      .eq('statut', 'en_attente')
      .order('created_at', { ascending: false })
    if (data) setMesEnAttente(data)
  }

  // Événements relais avec famille inconnue à lier
  async function fetchRelaisInconnus() {
    if (!profile) return
    const { data } = await supabase
      .from('evenements')
      .select('id, titre, date_debut, enfant_ids, notes, af_id')
      .eq('categorie', 'relais')
      .ilike('notes', '%inconnu%')
      .order('date_debut', { ascending: true })
    if (data) {
      // Filtrer selon le rôle
      if (profile.role === 'af') {
        setRelaisInconnus(data.filter(e => e.af_id === profile.id))
      } else {
        setRelaisInconnus(data)
      }
    }
  }

  // Retours sur mes demandes (accepté/refusé, non encore vus)
  async function fetchMesRetours() {
    if (!profile) return
    const { data } = await supabase
      .from('evenements_modifications')
      .select('id, statut, evenement:evenement_id(titre), valideur:valideur_id(nom,prenom)')
      .eq('demandeur_id', profile.id)
      .in('statut', ['accepte', 'refuse', 'acceptee', 'refusee'])
      .order('created_at', { ascending: false })
    if (data) {
      // Filtrer les IDs déjà vus (synchronisé avec l'agenda via sessionStorage)
      const vus = JSON.parse(sessionStorage.getItem('modifs_vues') || '[]')
      setMesRetours(data.filter(d => !vus.includes(d.id)))
    }
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

  // Résumé des demandeurs pour l'alerte
  const nomsDemandeurs = [...new Set(demandesModif.map(d => d.demandeur?.prenom).filter(Boolean))].join(', ')
  const nbAccepte = mesRetours.filter(d => ['accepte','acceptee'].includes(d.statut)).length
  const nbRefuse = mesRetours.filter(d => ['refuse','refusee'].includes(d.statut)).length

  return (
    <div className="app-layout">
      <Sidebar profile={profile} />
      <div className="main-content">

        <PageHeader
          icon="🏠"
          title={`Bonjour ${profile?.prenom || ''} ${profile?.nom || ''}${profile?.matricule ? ` · N° ${profile.matricule}` : ''}`}
          subtitle={`${profile?.territoire || ''} · ${
            profile?.role === 'af' ? 'Assistant(e) Familial(e)' :
            profile?.role === 'referent' ? (profile?.fonction || 'Référent(e) ASE') :
            profile?.role === 'encadrant' ? 'Encadrant(e) Technique' :
            profile?.role === 'rtase' ? 'Responsable Territorial ASE' : profile?.role
          }`}
        >
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
        </PageHeader>

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

          {/* Alertes du jour */}
          <div className="card">
            <div className="card-header" style={{ cursor:'default' }}><h3>⚠️ Alertes du jour</h3></div>
            <div className="card-body">

              {/* ── Alerte : relais avec famille inconnue ── */}
              {relaisInconnus.length > 0 && (
                <AlertItem
                  icon="⚠️"
                  title={`${relaisInconnus.length} relais avec famille d'accueil non référencée`}
                  sub={`${relaisInconnus.length} événement${relaisInconnus.length > 1 ? 's' : ''} · Famille relais à identifier et lier dans l'agenda`}
                  type="danger"
                  onClick={() => navigate('/agenda')}
                />
              )}

              {/* ── Alerte : MES demandes envoyées en attente (Bernard) ── */}
              {mesEnAttente.length > 0 && (
                <AlertItem
                  icon="📤"
                  title={`${mesEnAttente.length} demande${mesEnAttente.length > 1 ? 's' : ''} de modification en attente`}
                  sub={mesEnAttente.map(d => `"${d.evenement?.titre}" → ${d.valideur?.prenom} ${d.valideur?.nom}`).join(' · ')}
                  type="info"
                  onClick={() => navigate('/agenda')}
                />
              )}

              {/* ── Alerte : demandes de modif agenda à valider (Laurent) ── */}
              {demandesModif.length > 0 && (
                <AlertItem
                  icon="✏️"
                  title={`${demandesModif.length} demande${demandesModif.length > 1 ? 's' : ''} de modification agenda`}
                  sub={`De : ${nomsDemandeurs} · En attente de votre validation`}
                  type="warn"
                  onClick={() => navigate('/agenda')}
                />
              )}

              {/* ── Alerte : réponses à mes demandes de modif ── */}
              {mesRetours.length > 0 && (
                <AlertItem
                  icon={nbRefuse > 0 ? '❌' : '✅'}
                  title={`Réponse${mesRetours.length > 1 ? 's' : ''} à vos demandes de modification`}
                  sub={[
                    nbAccepte > 0 && `${nbAccepte} acceptée${nbAccepte > 1 ? 's' : ''}`,
                    nbRefuse > 0 && `${nbRefuse} refusée${nbRefuse > 1 ? 's' : ''}`,
                  ].filter(Boolean).join(' · ') + ' · Voir dans l\'agenda'}
                  type={nbRefuse > 0 ? 'danger' : 'ok'}
                  onClick={() => navigate('/agenda')}
                />
              )}

              {/* ── Alertes AF existantes ── */}
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

              {/* ── Alertes ASE ── */}
              {['referent','encadrant','rtase','admin'].includes(profile?.role) && (
                <>
                  <AlertItem icon="🚨" title="Relais non trouvé — Martin René" sub="Congés 15-30 mai · Hugo M. · Sara L. · J-33" type="danger" onClick={() => {}} />
                  {alertesAgrement.map(af => {
                    const jours = Math.ceil((new Date(af.date_expiration_agrement) - new Date()) / (1000*60*60*24))
                    const expire = jours <= 0
                    return (
                      <AlertItem key={af.id}
                        icon={expire ? '🔴' : '⚠️'}
                        title={`${expire ? 'Agrément EXPIRÉ' : 'Agrément expirant'} — ${af.nom} ${af.prenom}`}
                        sub={expire ? `Expiré le ${af.date_expiration_agrement?.slice(0,10).split('-').reverse().join('/')} · Renouvellement urgent` : `Expire dans ${jours} jours · ${af.date_expiration_agrement?.slice(0,10).split('-').reverse().join('/')}`}
                        type={expire ? 'error' : 'warn'}
                        onClick={() => navigate('/assfam/' + af.id)} />
                    )
                  })}
                </>
              )}

              {/* ── Aucune alerte ── */}
              {profile?.role === 'af' && enfants.length === 0 && demandesModif.length === 0 && mesRetours.length === 0 && mesEnAttente.length === 0 && relaisInconnus.length === 0 && (
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
