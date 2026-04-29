import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Sidebar from '../components/Sidebar'

export default function InterfaceASE({ profile }) {
  const navigate = useNavigate()
  const [onglet, setOnglet] = useState('urgence')
  const [afs, setAfs] = useState([])
  const [enfants, setEnfants] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')

  // Urgence
  const [ageEnfant, setAgeEnfant] = useState('6-10')
  const [secteur, setSecteur] = useState('tous')
  const [typeAccueil, setTypeAccueil] = useState('urgence')
  const [afsDisponibles, setAfsDisponibles] = useState([])
  const [rechercheFaite, setRechercheFaite] = useState(false)
  const [showContratModal, setShowContratModal] = useState(false)
  const [afSelectionne, setAfSelectionne] = useState(null)
  const [enfantUrgence, setEnfantUrgence] = useState({ prenom:'', nom:'', age:'', sexe:'', situation:'' })
  const [creatingDossier, setCreatingDossier] = useState(false)

  // Filtres AF
  const [searchAF, setSearchAF] = useState('')
  const [filtreAF, setFiltreAF] = useState('tous')

  // Filtres enfants
  const [searchEnfant, setSearchEnfant] = useState('')
  const [filtreEnfant, setFiltreEnfant] = useState('tous')

  // Panel détail
  const [detailAF, setDetailAF] = useState(null)

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000) }
  function fmtDate(iso) { if (!iso) return ''; const [y,m,d] = iso.split('T')[0].split('-'); return `${d}/${m}/${y}` }
  function calcAge(ddn) {
    if (!ddn) return ''
    const d = new Date(ddn), now = new Date()
    let age = now.getFullYear() - d.getFullYear()
    if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--
    return age
  }

  const fetchAfs = useCallback(async () => {
    const { data } = await supabase.from('profiles')
      .select('*, enfants_accueillis:enfants!enfants_af_principal_id_fkey(id, prenom, nom, type_placement)')
      .eq('role', 'af')
      .order('nom')
    if (data) setAfs(data)
  }, [])

  const fetchEnfants = useCallback(async () => {
    const { data } = await supabase.from('enfants')
      .select(`*, af_principal:af_principal_id(nom, prenom, telephone), referent:referent_id(nom, prenom)`)
      .neq('type_placement', 'non_place')
      .order('nom')
    if (data) setEnfants(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAfs(); fetchEnfants()
  }, [fetchAfs, fetchEnfants])

  function rechercherAF() {
    let resultats = afs.filter(af => {
      const enfantsActifs = af.enfants_accueillis?.filter(e => e.type_placement !== 'non_place') || []
      const placesContrat = af.places_contrat_tarn || af.places_agreees || 3
      const placesLibres = placesContrat - enfantsActifs.length
      return placesLibres > 0 || af.accord_urgence
    })

    // Filtrer par secteur
    if (secteur !== 'tous') {
      resultats = resultats.filter(af => af.territoire?.toLowerCase().includes(secteur.toLowerCase()))
    }

    // Trier par priorité : accord urgence > secteur préféré > places libres
    resultats.sort((a, b) => {
      const aUrgence = a.accord_urgence ? 1 : 0
      const bUrgence = b.accord_urgence ? 1 : 0
      if (aUrgence !== bUrgence) return bUrgence - aUrgence

      const aPlaces = (a.places_contrat_tarn || a.places_agreees || 3) - (a.enfants_accueillis?.filter(e => e.type_placement !== 'non_place').length || 0)
      const bPlaces = (b.places_contrat_tarn || b.places_agreees || 3) - (b.enfants_accueillis?.filter(e => e.type_placement !== 'non_place').length || 0)
      return bPlaces - aPlaces
    })

    setAfsDisponibles(resultats)
    setRechercheFaite(true)
  }

  async function creerDossierUrgence(af) {
    if (!enfantUrgence.prenom) { showToast('⚠️ Au moins le prénom de l\'enfant est requis'); return }
    setCreatingDossier(true)
    try {
      const { data, error } = await supabase.from('enfants').insert({
        prenom: enfantUrgence.prenom,
        nom: enfantUrgence.nom || 'INCONNU',
        type_placement: 'urgence',
        af_principal_id: af.id,
        referent_id: profile?.id,
        territoire: af.territoire || profile?.territoire,
        date_placement: new Date().toISOString().slice(0, 10),
      }).select().single()

      if (error) throw error
      showToast('✅ Dossier urgence créé !')
      setShowContratModal(false)
      navigate(`/enfants/${data.id}`)
    } catch(e) {
      showToast('❌ ' + e.message)
    }
    setCreatingDossier(false)
  }

  // Stats
  const totalEnfants = enfants.length
  const urgences = enfants.filter(e => e.type_placement === 'urgence').length
  const placesTotal = afs.reduce((s, af) => s + (af.places_agreees || 3), 0)
  const placesOccupees = afs.reduce((s, af) => s + (af.enfants_accueillis?.length || 0), 0)
  const placesLibres = placesTotal - placesOccupees
  const agrementsAlerte = afs.filter(af => {
    if (!af.date_expiration_agrement) return false
    const j = Math.ceil((new Date(af.date_expiration_agrement) - new Date()) / (1000*60*60*24))
    return j <= 90
  }).length

  // Filtres AF
  const afsFiltres = afs.filter(af => {
    const search = searchAF.toLowerCase()
    const matchSearch = !search || `${af.nom} ${af.prenom}`.toLowerCase().includes(search) || (af.territoire || '').toLowerCase().includes(search)
    if (!matchSearch) return false
    if (filtreAF === 'disponible') return (af.places_agreees || 3) - (af.enfants_accueillis?.length || 0) > 0
    if (filtreAF === 'complet') return (af.places_agreees || 3) - (af.enfants_accueillis?.length || 0) <= 0
    if (filtreAF === 'urgence') return af.accord_urgence
    return true
  })

  // Filtres enfants
  const enfantsFiltres = enfants.filter(e => {
    const search = searchEnfant.toLowerCase()
    const matchSearch = !search || `${e.nom} ${e.prenom}`.toLowerCase().includes(search) || (e.af_principal ? `${e.af_principal.nom} ${e.af_principal.prenom}`.toLowerCase().includes(search) : false)
    if (!matchSearch) return false
    if (filtreEnfant === 'urgence') return e.type_placement === 'urgence'
    if (filtreEnfant === 'judiciaire') return e.type_placement === 'judiciaire'
    if (filtreEnfant === 'relais') return e.type_placement === 'relais'
    return true
  })

  const PLACEMENT_COLORS = {
    judiciaire: { bg:'#e8eef8', color:'#1a4b8f', label:'⚖️ Judiciaire' },
    administratif: { bg:'#e6f5eb', color:'#2e8b4a', label:'📋 Administratif' },
    urgence: { bg:'#fdf0ee', color:'#c0392b', label:'🚨 Urgence' },
    aemo: { bg:'#f0ebfb', color:'#6d4c9e', label:'👁 AEMO' },
    aemo_r: { bg:'#f0ebfb', color:'#6d4c9e', label:'👁 AEMO-R' },
    secret: { bg:'#fdf0f0', color:'#8b1a1a', label:'🔒 Secret' },
  }

  const ONGLETS = [
    { id:'urgence', icon:'🚨', label:'Urgence', bg:'#c0392b' },
    { id:'af', icon:'👨‍👩‍👧', label:'Assistants familiaux' },
    { id:'enfants', icon:'👶', label:'Enfants' },
    { id:'stats', icon:'📊', label:'Statistiques' },
  ]

  return (
    <div className="app-layout">
      <Sidebar profile={profile} />
      <div className="main-content">

        {/* Header */}
        <header className="page-header">
          <img src="/logo_transparent.png" alt="P" className="header-logo" onError={e => e.target.style.display='none'} />
          <div className="header-sep" />
          <div style={{ flex:1 }}>
            <div className="page-title">Interface ASE — {profile?.territoire || 'Tarn (81)'}</div>
            <div className="page-subtitle">{profile?.nom} {profile?.prenom} · {profile?.role}</div>
          </div>
          <div className="header-actions">
            <button onClick={() => { setOnglet('urgence') }}
              style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:8, border:'none', background:'#c0392b', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'Sora,sans-serif', boxShadow:'0 2px 8px rgba(192,57,43,.3)' }}>
              🚨 Placement urgence
            </button>
          </div>
        </header>

        {/* Stats bar */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:10, padding:'16px 24px 0' }}>
          {[
            { val: afs.length, lbl: 'AF actifs', color:'#1a4b8f', bg:'#e8eef8' },
            { val: totalEnfants, lbl: 'Enfants placés', color:'#2e8b4a', bg:'#e6f5eb' },
            { val: placesLibres, lbl: 'Places libres', color:'#d97706', bg:'#fef3e2' },
            { val: urgences, lbl: 'Urgences en cours', color:'#c0392b', bg:'#fdf0ee' },
            { val: agrementsAlerte, lbl: 'Agréments à renouveler', color:'#6d4c9e', bg:'#f0ebfb' },
          ].map((s, i) => (
            <div key={i} style={{ background: s.bg, borderRadius:12, padding:'14px 16px', textAlign:'center', cursor:'pointer' }}
              onClick={() => { if (i === 0) setOnglet('af'); if (i === 1 || i === 3) setOnglet('enfants') }}>
              <div style={{ fontSize:26, fontWeight:700, color: s.color }}>{s.val}</div>
              <div style={{ fontSize:10, color:'#5a6478', marginTop:2, textTransform:'uppercase', letterSpacing:'.3px' }}>{s.lbl}</div>
            </div>
          ))}
        </div>

        <div style={{ padding:'16px 24px 24px' }}>

          {/* Onglets */}
          <div style={{ display:'flex', gap:4, background:'#fff', border:'1px solid #dde3f0', borderRadius:12, padding:6, marginBottom:20, boxShadow:'0 2px 12px rgba(26,75,143,.08)', flexWrap:'wrap' }}>
            {ONGLETS.map(o => (
              <button key={o.id} onClick={() => setOnglet(o.id)}
                style={{ display:'flex', alignItems:'center', gap:7, padding:'9px 16px', borderRadius:8, fontSize:13, fontWeight: onglet === o.id ? 700 : 500, cursor:'pointer', border:'none', fontFamily:'Sora,sans-serif', transition:'all .15s', whiteSpace:'nowrap',
                  background: onglet === o.id ? (o.bg || '#1a4b8f') : 'none',
                  color: onglet === o.id ? '#fff' : '#5a6478' }}>
                <span style={{ fontSize:15 }}>{o.icon}</span>{o.label}
              </button>
            ))}
          </div>

          {/* ══ URGENCE ══ */}
          {onglet === 'urgence' && (
            <>
              {/* Header urgence */}
              <div style={{ background:'linear-gradient(135deg, #c0392b, #e05050)', borderRadius:12, padding:20, marginBottom:16, color:'#fff' }}>
                <div style={{ fontSize:20, fontWeight:700, marginBottom:4 }}>🚨 Module Placement d'Urgence</div>
                <div style={{ fontSize:12, opacity:.9 }}>Trouvez une famille d'accueil disponible en moins de 2 minutes · Tarn (81)</div>
              </div>

              {/* 3 étapes */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:12, marginBottom:20 }}>
                {/* Étape 1 */}
                <div style={{ background:'#fff', borderRadius:12, padding:16, border:'1px solid #dde3f0', boxShadow:'0 2px 8px rgba(26,75,143,.06)' }}>
                  <div style={{ width:28, height:28, borderRadius:'50%', background:'#1a4b8f', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, marginBottom:10 }}>1</div>
                  <div style={{ fontSize:13, fontWeight:700, marginBottom:4 }}>Définir le profil</div>
                  <div style={{ fontSize:11, color:'#9aa3b8', marginBottom:12 }}>Âge, secteur géographique, type d'accueil</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    <div>
                      <label style={{ fontSize:10, fontWeight:600, color:'#5a6478', textTransform:'uppercase', display:'block', marginBottom:4 }}>Âge de l'enfant</label>
                      <select className="form-control" value={ageEnfant} onChange={e => setAgeEnfant(e.target.value)} style={{ fontSize:12 }}>
                        <option value="0-3">0–3 ans</option>
                        <option value="3-6">3–6 ans</option>
                        <option value="6-10">6–10 ans</option>
                        <option value="10-15">10–15 ans</option>
                        <option value="15-18">15–18 ans</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize:10, fontWeight:600, color:'#5a6478', textTransform:'uppercase', display:'block', marginBottom:4 }}>Secteur préféré</label>
                      <select className="form-control" value={secteur} onChange={e => setSecteur(e.target.value)} style={{ fontSize:12 }}>
                        <option value="tous">Tout le Tarn</option>
                        <option value="Gaillac">MD Gaillac-Graulhet</option>
                        <option value="Albi">MD Albi</option>
                        <option value="Castres">MD Castres</option>
                        <option value="Lavaur">MD Lavaur</option>
                        <option value="Carmaux">MD Carmaux</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize:10, fontWeight:600, color:'#5a6478', textTransform:'uppercase', display:'block', marginBottom:4 }}>Type d'accueil</label>
                      <select className="form-control" value={typeAccueil} onChange={e => setTypeAccueil(e.target.value)} style={{ fontSize:12 }}>
                        <option value="urgence">Urgence</option>
                        <option value="court">Court terme</option>
                        <option value="relais">Relais</option>
                        <option value="permanent">Permanent</option>
                      </select>
                    </div>
                    <button onClick={rechercherAF}
                      style={{ padding:'10px', borderRadius:8, border:'none', background:'#c0392b', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'Sora,sans-serif', marginTop:4 }}>
                      🔍 Rechercher
                    </button>
                  </div>
                </div>

                {/* Étape 2 */}
                <div style={{ background:'#fff', borderRadius:12, padding:16, border:'1px solid #dde3f0', boxShadow:'0 2px 8px rgba(26,75,143,.06)' }}>
                  <div style={{ width:28, height:28, borderRadius:'50%', background:'#1a4b8f', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, marginBottom:10 }}>2</div>
                  <div style={{ fontSize:13, fontWeight:700, marginBottom:4 }}>Résultats classés</div>
                  <div style={{ fontSize:11, color:'#9aa3b8', marginBottom:12 }}>Classement automatique : accord urgence → secteur → places</div>
                  {rechercheFaite ? (
                    <div style={{ background: afsDisponibles.length > 0 ? '#e6f5eb' : '#fef3e2', border:`1px solid ${afsDisponibles.length > 0 ? '#c4e8cc' : '#f5dca4'}`, borderRadius:8, padding:12, fontSize:12, color: afsDisponibles.length > 0 ? '#2e8b4a' : '#d97706' }}>
                      <div style={{ fontWeight:700, marginBottom:4 }}>
                        {afsDisponibles.length > 0 ? `✅ ${afsDisponibles.length} AF disponible${afsDisponibles.length > 1 ? 's' : ''} trouvé${afsDisponibles.length > 1 ? 's' : ''}` : '⚠️ Aucun AF disponible'}
                      </div>
                      {afsDisponibles.length > 0 && (
                        <>
                          <div>{afsDisponibles.filter(af => af.accord_urgence).length} avec accord urgence</div>
                          <div>{afsDisponibles.filter(af => af.territoire?.includes(secteur !== 'tous' ? secteur : '')).length} dans le secteur demandé</div>
                        </>
                      )}
                    </div>
                  ) : (
                    <div style={{ background:'#f4f6fb', borderRadius:8, padding:12, fontSize:12, color:'#9aa3b8', fontStyle:'italic' }}>
                      Lancez une recherche pour voir les résultats
                    </div>
                  )}
                </div>

                {/* Étape 3 */}
                <div style={{ background:'#fff', borderRadius:12, padding:16, border:'1px solid #dde3f0', boxShadow:'0 2px 8px rgba(26,75,143,.06)' }}>
                  <div style={{ width:28, height:28, borderRadius:'50%', background:'#1a4b8f', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, marginBottom:10 }}>3</div>
                  <div style={{ fontSize:13, fontWeight:700, marginBottom:4 }}>Dossier express</div>
                  <div style={{ fontSize:11, color:'#9aa3b8', marginBottom:12 }}>Créez le dossier de l'enfant en quelques secondes avec le minimum d'infos disponibles</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    <input className="form-control" style={{ fontSize:12 }} placeholder="Prénom *" value={enfantUrgence.prenom} onChange={e => setEnfantUrgence(n => ({...n, prenom: e.target.value}))} />
                    <input className="form-control" style={{ fontSize:12 }} placeholder="Nom (INCONNU si non communiqué)" value={enfantUrgence.nom} onChange={e => setEnfantUrgence(n => ({...n, nom: e.target.value}))} />
                    <input className="form-control" style={{ fontSize:12 }} placeholder="Âge estimé" value={enfantUrgence.age} onChange={e => setEnfantUrgence(n => ({...n, age: e.target.value}))} />
                    <select className="form-control" style={{ fontSize:12 }} value={enfantUrgence.sexe} onChange={e => setEnfantUrgence(n => ({...n, sexe: e.target.value}))}>
                      <option value="">Sexe (si connu)</option>
                      <option value="Féminin">👧 Féminin</option>
                      <option value="Masculin">👦 Masculin</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Résultats AF */}
              {rechercheFaite && (
                <div style={{ background:'#fff', borderRadius:12, border:'1px solid #dde3f0', overflow:'hidden', boxShadow:'0 2px 8px rgba(26,75,143,.06)' }}>
                  <div style={{ padding:'12px 16px', background:'#fdf0ee', borderBottom:'1px solid #f5c4c4', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <span style={{ fontSize:14, fontWeight:700, color:'#c0392b' }}>🚨 AF disponibles — classés par priorité</span>
                    <span style={{ fontSize:11, color:'#9aa3b8' }}>Enfant : {ageEnfant} ans · {secteur === 'tous' ? 'Tout le Tarn' : secteur} · {typeAccueil}</span>
                  </div>

                  {afsDisponibles.length === 0 ? (
                    <div style={{ padding:40, textAlign:'center', color:'#9aa3b8' }}>
                      <div style={{ fontSize:32, marginBottom:8 }}>😔</div>
                      <div style={{ fontSize:14 }}>Aucun AF disponible pour ce profil</div>
                      <div style={{ fontSize:12, marginTop:4 }}>Essayez d'élargir le secteur ou le type d'accueil</div>
                    </div>
                  ) : afsDisponibles.map((af, idx) => {
                    const enfantsActifs = af.enfants_accueillis?.filter(e => e.type_placement !== 'non_place') || []
                    const placesContratTarn = af.places_contrat_tarn || af.places_agreees || 3
                    const placesLibresAF = placesContratTarn - enfantsActifs.length
                    const agrExp = af.date_expiration_agrement ? new Date(af.date_expiration_agrement) : null
                    const joursAgr = agrExp ? Math.ceil((agrExp - new Date()) / (1000*60*60*24)) : null
                    const agrOk = joursAgr === null || joursAgr > 30

                    return (
                      <div key={af.id}
                        style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 16px', borderBottom:'1px solid #f0f0f0', transition:'background .15s', cursor:'pointer', opacity: !agrOk ? .7 : 1 }}
                        onMouseOver={e => e.currentTarget.style.background='#f4f6fb'}
                        onMouseOut={e => e.currentTarget.style.background='#fff'}
                        onClick={() => setDetailAF(af)}>

                        {/* Numéro priorité */}
                        <div style={{ width:30, height:30, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'#fff', flexShrink:0,
                          background: idx === 0 ? '#c0392b' : idx === 1 ? '#e05c5c' : idx === 2 ? '#e07878' : '#9aa3b8' }}>
                          {idx + 1}
                        </div>

                        {/* Avatar */}
                        <div style={{ width:38, height:38, borderRadius:'50%', background:'linear-gradient(135deg,#1a4b8f,#2e8b4a)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'#fff', flexShrink:0 }}>
                          {af.prenom?.[0]}{af.nom?.[0]}
                        </div>

                        {/* Infos */}
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:14, fontWeight:700 }}>{af.nom} {af.prenom}</div>
                          <div style={{ fontSize:11, color:'#9aa3b8', marginTop:2 }}>
                            {[af.adresse, af.ville].filter(Boolean).join(', ')} · {af.territoire}
                            {af.telephone && ` · ${af.telephone}`}
                          </div>
                          <div style={{ display:'flex', gap:10, marginTop:5, flexWrap:'wrap' }}>
                            <span style={{ fontSize:11, fontWeight:700, color:'#2e8b4a' }}>{placesLibresAF} place{placesLibresAF > 1 ? 's' : ''} libre{placesLibresAF > 1 ? 's' : ''}</span>
                            {af.accord_urgence && <span style={{ fontSize:10, color:'#1a4b8f' }}>✅ Accord urgence</span>}
                            {af.deaf_obtenu === 'oui' && <span style={{ fontSize:10, color:'#1a4b8f' }}>✅ DEAF</span>}
                            {!agrOk && <span style={{ fontSize:10, color:'#c0392b' }}>⚠️ Agrément expirant</span>}
                            {af.enfants_accueillis?.length > 0 && (
                              <span style={{ fontSize:10, color:'#9aa3b8' }}>
                                {af.enfants_accueillis.map(e => `${e.prenom} ${e.nom[0]}.`).join(' · ')}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                          {af.telephone && (
                            <a href={`tel:${af.telephone}`}
                              style={{ padding:'7px 12px', borderRadius:8, background:'#2e8b4a', color:'#fff', fontSize:12, fontWeight:600, textDecoration:'none', fontFamily:'Sora,sans-serif', display:'inline-flex', alignItems:'center', gap:4 }}
                              onClick={e => e.stopPropagation()}>
                              📞 Appeler
                            </a>
                          )}
                          <button onClick={e => { e.stopPropagation(); setAfSelectionne(af); setShowContratModal(true) }}
                            style={{ padding:'7px 12px', borderRadius:8, border:'none', background: af.accord_urgence ? '#1a4b8f' : '#dde3f0', color: af.accord_urgence ? '#fff' : '#5a6478', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'Sora,sans-serif' }}>
                            📄 Dossier express
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {!rechercheFaite && (
                <div style={{ textAlign:'center', padding:40, color:'#9aa3b8', background:'#fff', borderRadius:12, border:'1px dashed #dde3f0' }}>
                  <div style={{ fontSize:32, marginBottom:8 }}>🔍</div>
                  <div style={{ fontSize:14 }}>Définissez le profil et lancez la recherche</div>
                  <div style={{ fontSize:12, marginTop:4 }}>Les AF disponibles s'afficheront ici classés par priorité</div>
                </div>
              )}
            </>
          )}

          {/* ══ AF ══ */}
          {onglet === 'af' && (
            <>
              <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
                <input className="form-control" value={searchAF} onChange={e => setSearchAF(e.target.value)}
                  placeholder="🔍 Rechercher un AF..." style={{ maxWidth:320 }} />
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {[
                    { v:'tous', l:'Tous' },
                    { v:'disponible', l:'✅ Places libres' },
                    { v:'complet', l:'🔴 Complet' },
                    { v:'urgence', l:'🚨 Accord urgence' },
                  ].map(f => (
                    <button key={f.v} onClick={() => setFiltreAF(f.v)}
                      style={{ padding:'5px 12px', borderRadius:20, border:`1.5px solid ${filtreAF === f.v ? '#1a4b8f' : '#dde3f0'}`, background: filtreAF === f.v ? '#e8eef8' : '#fff', color: filtreAF === f.v ? '#1a4b8f' : '#5a6478', fontSize:11, fontWeight: filtreAF === f.v ? 700 : 500, cursor:'pointer', fontFamily:'Sora,sans-serif' }}>
                      {f.l}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ background:'#fff', borderRadius:12, border:'1px solid #dde3f0', overflow:'hidden', boxShadow:'0 2px 8px rgba(26,75,143,.06)' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                  <thead>
                    <tr style={{ background:'#eef2ff', borderBottom:'2px solid #1a4b8f' }}>
                      {['N°','Assistant(e) familial(e)','MD / Secteur','Agrément','Places','Enfants accueillis','Actions'].map(h => (
                        <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:10, fontWeight:700, color:'#1a4b8f', textTransform:'uppercase', letterSpacing:'.4px', whiteSpace:'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:'#9aa3b8' }}>Chargement...</td></tr>
                    ) : afsFiltres.map(af => {
                      const placesOccup = af.enfants_accueillis?.length || 0
                      const placesLib = (af.places_agreees || 3) - placesOccup
                      const agrExp = af.date_expiration_agrement ? new Date(af.date_expiration_agrement) : null
                      const joursAgr = agrExp ? Math.ceil((agrExp - new Date()) / (1000*60*60*24)) : null

                      return (
                        <tr key={af.id} style={{ borderBottom:'1px solid #f0f0f0', cursor:'pointer' }}
                          onMouseOver={e => e.currentTarget.style.background='#f4f6fb'}
                          onMouseOut={e => e.currentTarget.style.background='#fff'}
                          onClick={() => navigate(`/assfam/${af.id}`)}>
                          <td style={{ padding:'10px 12px', color:'#9aa3b8', fontSize:10 }}>{af.matricule || '—'}</td>
                          <td style={{ padding:'10px 12px' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                              <div style={{ width:30, height:30, borderRadius:'50%', background:'linear-gradient(135deg,#1a4b8f,#2e8b4a)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#fff', flexShrink:0 }}>
                                {af.prenom?.[0]}{af.nom?.[0]}
                              </div>
                              <div>
                                <div style={{ fontWeight:600 }}>{af.nom} {af.prenom}</div>
                                <div style={{ fontSize:10, color:'#9aa3b8' }}>{af.ville}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding:'10px 12px', fontSize:11 }}>{af.territoire || '—'}</td>
                          <td style={{ padding:'10px 12px' }}>
                            <div style={{ fontSize:11 }}>{af.numero_agrement || '—'}</div>
                            {joursAgr !== null && (
                              <div style={{ fontSize:10, color: joursAgr <= 30 ? '#c0392b' : joursAgr <= 90 ? '#d97706' : '#2e8b4a' }}>
                                {joursAgr <= 30 ? '🔴' : joursAgr <= 90 ? '⚠️' : '✅'} {joursAgr <= 0 ? 'Expiré' : `Exp. ${fmtDate(af.date_expiration_agrement)}`}
                              </div>
                            )}
                          </td>
                          <td style={{ padding:'10px 12px' }}>
                            <div style={{ fontSize:12, fontWeight:700, color: placesLib === 0 ? '#c0392b' : '#2e8b4a' }}>{placesOccup}/{af.places_agreees || 3}</div>
                            <div style={{ height:5, background:'#eef1f8', borderRadius:4, width:60, marginTop:3 }}>
                              <div style={{ height:'100%', borderRadius:4, background: placesOccup >= (af.places_agreees || 3) ? '#c0392b' : placesOccup > 0 ? '#d97706' : '#2e8b4a', width:`${Math.min(100,(placesOccup/(af.places_agreees||3))*100)}%` }} />
                            </div>
                          </td>
                          <td style={{ padding:'10px 12px' }}>
                            <div style={{ fontSize:11 }}>{af.enfants_accueillis?.map(e => `${e.prenom} ${e.nom[0]}.`).join(' · ') || '—'}</div>
                            {placesLib > 0 && <div style={{ fontSize:10, color:'#2e8b4a' }}>{placesLib} place{placesLib > 1 ? 's' : ''} libre{placesLib > 1 ? 's' : ''}</div>}
                          </td>
                          <td style={{ padding:'10px 12px' }}>
                            <div style={{ display:'flex', gap:4 }}>
                              <button onClick={e => { e.stopPropagation(); navigate(`/assfam/${af.id}`) }}
                                style={{ padding:'4px 8px', borderRadius:6, border:'1px solid #dde3f0', background:'#fff', fontSize:10, cursor:'pointer' }}>👁 Voir</button>
                              {af.telephone && (
                                <a href={`tel:${af.telephone}`} onClick={e => e.stopPropagation()}
                                  style={{ padding:'4px 8px', borderRadius:6, border:'none', background:'#1a4b8f', color:'#fff', fontSize:10, cursor:'pointer', textDecoration:'none', fontFamily:'Sora,sans-serif' }}>📞</a>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <div style={{ padding:'10px 14px', fontSize:11, color:'#9aa3b8', textAlign:'right' }}>
                  {afsFiltres.length} AF affiché{afsFiltres.length > 1 ? 's' : ''} sur {afs.length}
                </div>
              </div>
            </>
          )}

          {/* ══ ENFANTS ══ */}
          {onglet === 'enfants' && (
            <>
              <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
                <input className="form-control" value={searchEnfant} onChange={e => setSearchEnfant(e.target.value)}
                  placeholder="🔍 Rechercher un enfant, AF, commune..." style={{ maxWidth:360 }} />
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {[
                    { v:'tous', l:'Tous' },
                    { v:'urgence', l:'🚨 Urgence' },
                    { v:'judiciaire', l:'⚖️ Judiciaire' },
                    { v:'relais', l:'🔄 Relais' },
                  ].map(f => (
                    <button key={f.v} onClick={() => setFiltreEnfant(f.v)}
                      style={{ padding:'5px 12px', borderRadius:20, border:`1.5px solid ${filtreEnfant === f.v ? '#1a4b8f' : '#dde3f0'}`, background: filtreEnfant === f.v ? '#e8eef8' : '#fff', color: filtreEnfant === f.v ? '#1a4b8f' : '#5a6478', fontSize:11, fontWeight: filtreEnfant === f.v ? 700 : 500, cursor:'pointer', fontFamily:'Sora,sans-serif' }}>
                      {f.l}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ background:'#fff', borderRadius:12, border:'1px solid #dde3f0', overflow:'hidden', boxShadow:'0 2px 8px rgba(26,75,143,.06)' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                  <thead>
                    <tr style={{ background:'#eef2ff', borderBottom:'2px solid #1a4b8f' }}>
                      {['Enfant','Âge','AF / Lieu','MD / Référent','Placement','Depuis','Statut','Actions'].map(h => (
                        <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:10, fontWeight:700, color:'#1a4b8f', textTransform:'uppercase', letterSpacing:'.4px', whiteSpace:'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={8} style={{ textAlign:'center', padding:40, color:'#9aa3b8' }}>Chargement...</td></tr>
                    ) : enfantsFiltres.map(e => {
                      const age = calcAge(e.date_naissance)
                      const pl = PLACEMENT_COLORS[e.type_placement] || PLACEMENT_COLORS.judiciaire
                      return (
                        <tr key={e.id} style={{ borderBottom:'1px solid #f0f0f0', cursor:'pointer' }}
                          onMouseOver={ev => ev.currentTarget.style.background='#f4f6fb'}
                          onMouseOut={ev => ev.currentTarget.style.background='#fff'}
                          onClick={() => navigate(`/enfants/${e.id}`)}>
                          <td style={{ padding:'10px 12px' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                              <div style={{ width:28, height:28, borderRadius:'50%', background:'linear-gradient(135deg,#1a4b8f,#2e8b4a)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#fff', flexShrink:0 }}>
                                {e.prenom?.[0]}{e.nom?.[0]}
                              </div>
                              <div>
                                <div style={{ fontWeight:600 }}>{e.nom} {e.prenom}</div>
                                <div style={{ fontSize:10, color:'#9aa3b8' }}>{e.numero_dossier}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding:'10px 12px', fontWeight:600 }}>{age !== '' ? `${age} ans` : '—'}</td>
                          <td style={{ padding:'10px 12px' }}>
                            {e.af_principal ? <div style={{ fontSize:11, fontWeight:500 }}>{e.af_principal.prenom} {e.af_principal.nom}</div> : <span style={{ color:'#9aa3b8', fontSize:11 }}>Non assigné</span>}
                          </td>
                          <td style={{ padding:'10px 12px' }}>
                            <div style={{ fontSize:11 }}>{e.md_nom || '—'}</div>
                            {e.referent && <div style={{ fontSize:10, color:'#1a4b8f' }}>{e.referent.prenom} {e.referent.nom}</div>}
                          </td>
                          <td style={{ padding:'10px 12px' }}>
                            <span style={{ padding:'3px 8px', borderRadius:10, fontSize:10, fontWeight:600, background: pl.bg, color: pl.color }}>{pl.label}</span>
                          </td>
                          <td style={{ padding:'10px 12px', fontSize:11, color:'#9aa3b8' }}>{fmtDate(e.date_placement)}</td>
                          <td style={{ padding:'10px 12px' }}>
                            {e.type_placement === 'urgence' ? <span style={{ padding:'3px 8px', borderRadius:10, fontSize:10, fontWeight:600, background:'#fdf0ee', color:'#c0392b' }}>🚨 En urgence</span>
                              : <span style={{ padding:'3px 8px', borderRadius:10, fontSize:10, fontWeight:600, background:'#e6f5eb', color:'#2e8b4a' }}>✅ En famille</span>}
                          </td>
                          <td style={{ padding:'10px 12px' }}>
                            <div style={{ display:'flex', gap:4 }}>
                              <button onClick={ev => { ev.stopPropagation(); navigate(`/enfants/${e.id}`) }}
                                style={{ padding:'4px 8px', borderRadius:6, border:'1px solid #dde3f0', background:'#fff', fontSize:10, cursor:'pointer' }}>👁</button>
                              <button onClick={ev => { ev.stopPropagation(); navigate(`/rapports?enfant=${e.id}`) }}
                                style={{ padding:'4px 8px', borderRadius:6, border:'none', background:'#1a4b8f', color:'#fff', fontSize:10, cursor:'pointer' }}>📄</button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <div style={{ padding:'10px 14px', fontSize:11, color:'#9aa3b8', textAlign:'right' }}>
                  {enfantsFiltres.length} enfant{enfantsFiltres.length > 1 ? 's' : ''} affiché{enfantsFiltres.length > 1 ? 's' : ''} sur {totalEnfants}
                </div>
              </div>
            </>
          )}

          {/* ══ STATS ══ */}
          {onglet === 'stats' && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
              <div style={{ background:'#fff', borderRadius:12, padding:18, border:'1px solid #dde3f0', boxShadow:'0 2px 8px rgba(26,75,143,.06)' }}>
                <div style={{ fontSize:12, fontWeight:700, color:'#5a6478', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:14 }}>📊 Répartition par MD</div>
                {Object.entries(
                  afs.reduce((acc, af) => {
                    const md = af.territoire || 'Non renseigné'
                    if (!acc[md]) acc[md] = { afs: 0, enfants: 0 }
                    acc[md].afs++
                    acc[md].enfants += af.enfants_accueillis?.length || 0
                    return acc
                  }, {})
                ).sort((a, b) => b[1].afs - a[1].afs).map(([md, data]) => (
                  <div key={md} style={{ marginBottom:10 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:3 }}>
                      <span>{md}</span>
                      <span style={{ fontWeight:600 }}>{data.afs} AF · {data.enfants} enfants</span>
                    </div>
                    <div style={{ height:6, background:'#eef1f8', borderRadius:4 }}>
                      <div style={{ height:'100%', borderRadius:4, background:'#1a4b8f', width:`${Math.min(100,(data.afs/afs.length)*100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ background:'#fff', borderRadius:12, padding:18, border:'1px solid #dde3f0', boxShadow:'0 2px 8px rgba(26,75,143,.06)' }}>
                <div style={{ fontSize:12, fontWeight:700, color:'#5a6478', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:14 }}>⚠️ Alertes & Échéances</div>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {urgences > 0 && (
                    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', background:'#fdf0ee', borderRadius:8, fontSize:11, color:'#c0392b' }}>
                      <span>🚨</span><div><div style={{ fontWeight:600 }}>{urgences} placement{urgences > 1 ? 's' : ''} d'urgence en cours</div></div>
                    </div>
                  )}
                  {afs.filter(af => {
                    if (!af.date_expiration_agrement) return false
                    const j = Math.ceil((new Date(af.date_expiration_agrement) - new Date()) / (1000*60*60*24))
                    return j <= 30
                  }).map(af => (
                    <div key={af.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', background:'#fdf0ee', borderRadius:8, fontSize:11, color:'#c0392b' }}>
                      <span>🔴</span><div><div style={{ fontWeight:600 }}>{af.nom} {af.prenom} — Agrément expirant</div><div>Expire le {fmtDate(af.date_expiration_agrement)}</div></div>
                    </div>
                  ))}
                  {afs.filter(af => {
                    if (!af.date_expiration_agrement) return false
                    const j = Math.ceil((new Date(af.date_expiration_agrement) - new Date()) / (1000*60*60*24))
                    return j > 30 && j <= 90
                  }).map(af => (
                    <div key={af.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', background:'#fef3e2', borderRadius:8, fontSize:11, color:'#d97706' }}>
                      <span>⚠️</span><div><div style={{ fontWeight:600 }}>{af.nom} {af.prenom} — Renouvellement à venir</div><div>Expire le {fmtDate(af.date_expiration_agrement)}</div></div>
                    </div>
                  ))}
                  {agrementsAlerte === 0 && urgences === 0 && (
                    <div style={{ textAlign:'center', padding:20, color:'#2e8b4a', fontSize:13 }}>✅ Aucune alerte en cours</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal dossier express */}
      {showContratModal && afSelectionne && (
        <div className="modal-overlay" onClick={() => setShowContratModal(false)}>
          <div className="modal-box" style={{ maxWidth:520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">🚨 Dossier express — Placement urgence</div>
            <div style={{ background:'#e8eef8', border:'1px solid #c4d4f5', borderRadius:10, padding:'12px 14px', marginBottom:16, fontSize:12, color:'#1a4b8f', lineHeight:1.6 }}>
              💡 Ce dossier sera créé avec le minimum d'informations. Vous pourrez le compléter ultérieurement.
            </div>
            <div style={{ background:'#e6f5eb', border:'1px solid #c4e8cc', borderRadius:10, padding:'12px 14px', marginBottom:16, fontSize:12 }}>
              <div style={{ fontWeight:700, color:'#2e8b4a', marginBottom:6 }}>👨‍👩‍👧 AF sélectionné</div>
              <div style={{ fontSize:13, fontWeight:600 }}>{afSelectionne.prenom} {afSelectionne.nom}</div>
              <div style={{ color:'#5a6478' }}>{afSelectionne.ville} · {afSelectionne.territoire}</div>
              {afSelectionne.telephone && <div style={{ color:'#1a4b8f', marginTop:4 }}>📞 {afSelectionne.telephone}</div>}
            </div>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Prénom *</label>
                <input className="form-control" value={enfantUrgence.prenom} onChange={e => setEnfantUrgence(n => ({...n, prenom: e.target.value}))} autoFocus placeholder="Prénom de l'enfant" />
              </div>
              <div className="form-group">
                <label className="form-label">Nom</label>
                <input className="form-control" value={enfantUrgence.nom} onChange={e => setEnfantUrgence(n => ({...n, nom: e.target.value}))} placeholder="INCONNU si non communiqué" />
              </div>
              <div className="form-group">
                <label className="form-label">Âge estimé</label>
                <input className="form-control" value={enfantUrgence.age} onChange={e => setEnfantUrgence(n => ({...n, age: e.target.value}))} placeholder="Ex: 8 ans" />
              </div>
              <div className="form-group">
                <label className="form-label">Sexe</label>
                <select className="form-control" value={enfantUrgence.sexe} onChange={e => setEnfantUrgence(n => ({...n, sexe: e.target.value}))}>
                  <option value="">Non communiqué</option>
                  <option value="Féminin">👧 Féminin</option>
                  <option value="Masculin">👦 Masculin</option>
                </select>
              </div>
              <div className="form-group col-span-2">
                <label className="form-label">Situation / motif urgence</label>
                <textarea className="form-control" rows={3} value={enfantUrgence.situation} onChange={e => setEnfantUrgence(n => ({...n, situation: e.target.value}))}
                  placeholder="Violence familiale, fugue, abandon..." style={{ resize:'vertical' }} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowContratModal(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={() => creerDossierUrgence(afSelectionne)} disabled={creatingDossier}
                style={{ background:'#c0392b', borderColor:'#c0392b' }}>
                {creatingDossier ? '⏳...' : '🚨 Créer le dossier urgence'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
