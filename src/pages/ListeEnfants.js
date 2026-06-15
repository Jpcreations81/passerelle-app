// ListeEnfants.js — v2026-06-15c — modal 2 étapes : choix AF existant/temporaire puis fiche enfant
import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Sidebar from '../components/Sidebar'
import PageHeader from '../components/PageHeader'

export default function ListeEnfants({ profile }) {
  const navigate = useNavigate()
  const location = useLocation()

  const [evenementEnAttente, setEvenementEnAttente] = useState(null)
  const [etapeModal, setEtapeModal] = useState(1) // 1=choix AF, 2=fiche enfant
  const [afChoix, setAfChoix] = useState('existant') // 'existant' ou 'temporaire'
  const [afTemp, setAfTemp] = useState({ prenom:'', nom:'', ville:'' })
  const [afTempId, setAfTempId] = useState(null) // UUID de l'AF temporaire créé
  const [afListe, setAfListe] = useState([]) // liste des AF existants
  const [enfants, setEnfants] = useState([])

  // Ouvrir automatiquement le modal si ?nouveau=1 dans l'URL
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('nouveau') === '1') {
      const evtAttente = location.state?.evenementEnAttente || null
      if (evtAttente) {
        setEvenementEnAttente(evtAttente)
        const nomDetecte = evtAttente._nomDetecte || ''
        const parts = nomDetecte.trim().split(' ')
        const prenom = parts[0] || ''
        const nom = parts.slice(1).join(' ') || ''
        setNewEnfant(n => ({ ...n, prenom, nom: nom.toUpperCase(), statut_profil: 'temporaire' }))
      }
      // Charger la liste des AF existants
      supabase.from('profiles').select('id, prenom, nom, ville').eq('role', 'af').order('nom')
        .then(({ data }) => setAfListe(data || []))
      setEtapeModal(1)
      setAfChoix('existant')
      setAfTemp({ prenom:'', nom:'', ville:'' })
      setAfTempId(null)
      setShowModal(true)
      navigate('/enfants', { replace: true, state: {} })
    }
  }, [location.search])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [newEnfant, setNewEnfant] = useState({ prenom:'', nom:'', date_naissance:'', sexe:'', numero_dossier:'', type_placement:'judiciaire', lieu_accueil:'af_principal', af_principal_id:'', referent_id:'', fratrie:[] })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [collegues, setCollegues] = useState([])
  const [search, setSearch] = useState('')
  const [fratrieModal, setFratrieModal] = useState(false)
  const [fratrieMode, setFratrieMode] = useState('question')
  const [fratrieSearch, setFratrieSearch] = useState('')
  const [fratrieResults, setFratrieResults] = useState([])
  const [newFratrieItem, setNewFratrieItem] = useState({ prenom:'', nom:'', ddn:'', sexe:'M', meme_af:true })

  const isReferent = ['referent','gestionnaire','encadrant','rtase','admin'].includes(profile?.role)
  const isAF = profile?.role === 'af'
  const [enfantsRelaisIds, setEnfantsRelaisIds] = useState([]) // IDs des enfants en relais actif chez cet AF

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 2800) }

  const fetchEnfants = useCallback(async () => {
    if (!profile) return
    let q = supabase.from('enfants').select(`
      id, prenom, nom, date_naissance, sexe, numero_dossier, type_placement, date_placement,
      af_principal:af_principal_id(nom, prenom),
      referent:referent_id(nom, prenom)
    `)
    if (profile.role === 'af') {
      // 1. Charger les enfants principaux
      const { data: enfantsPrincipaux } = await supabase.from('enfants').select(`
        id, prenom, nom, date_naissance, sexe, numero_dossier, type_placement, date_placement,
        af_principal:af_principal_id(nom, prenom),
        referent:referent_id(nom, prenom)
      `).eq('af_principal_id', profile.id).neq('type_placement', 'non_place')

      // 2. Chercher les enfants en relais actif (fenêtre J-2/J+2)
      const now = new Date()
      const jMoins2 = new Date(now); jMoins2.setDate(jMoins2.getDate() - 2); jMoins2.setHours(0,0,0,0)
      const jPlus2 = new Date(now); jPlus2.setDate(jPlus2.getDate() + 2); jPlus2.setHours(23,59,59,999)

      const { data: evtsRelais } = await supabase.from('evenements')
        .select('enfant_ids, participants_ids')
        .eq('categorie', 'relais')
        .gte('date_fin', jMoins2.toISOString())
        .lte('date_debut', jPlus2.toISOString())

      // Extraire les enfant_ids des relais où l'AF est participant
      const enfantIdsRelais = []
      if (evtsRelais) {
        evtsRelais.forEach(e => {
          if (e.participants_ids?.includes(profile.id) && e.enfant_ids) {
            e.enfant_ids.forEach(eid => {
              if (!enfantIdsRelais.includes(eid)) enfantIdsRelais.push(eid)
            })
          }
        })
      }

      // 3. Charger les enfants en relais non déjà dans la liste principale
      let enfantsRelais = []
      if (enfantIdsRelais.length > 0) {
        const idsPrincipaux = (enfantsPrincipaux || []).map(e => e.id)
        const idsACharger = enfantIdsRelais.filter(id => !idsPrincipaux.includes(id))
        if (idsACharger.length > 0) {
          const { data } = await supabase.from('enfants').select(`
            id, prenom, nom, date_naissance, sexe, numero_dossier, type_placement, date_placement,
            af_principal:af_principal_id(nom, prenom),
            referent:referent_id(nom, prenom)
          `).in('id', idsACharger)
          if (data) enfantsRelais = data
        }
      }

      // 4. Fusionner et trier
      const tous = [...(enfantsPrincipaux || []), ...enfantsRelais]
        .sort((a, b) => a.nom.localeCompare(b.nom))
      setEnfants(tous)
      setEnfantsRelaisIds(enfantsRelais.map(e => e.id))
      setLoading(false)
      return
    } else if (profile.role === 'referent') {
      q = q.eq('territoire', profile.territoire)
    } else if (profile.role === 'encadrant') {
      q = q.eq('territoire', profile.territoire)
    }
    const { data } = await q.order('nom', { ascending: true })
    if (data) setEnfants(data)
    setLoading(false)
  }, [profile])

  const fetchCollegues = useCallback(async () => {
    // Charger tous les AF + référents sans filtre territoire
    const { data } = await supabase.from('profiles').select('id, nom, prenom, role').in('role', ['af','referent','encadrant','rtase','admin'])
    if (data) setCollegues(data)
  }, [profile])

  useEffect(() => { fetchEnfants(); fetchCollegues() }, [fetchEnfants, fetchCollegues])

  function calcAge(ddn) {
    if (!ddn) return ''
    const d = new Date(ddn), now = new Date()
    let age = now.getFullYear() - d.getFullYear()
    if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--
    return `${age} ans`
  }

  async function searchFratrie(query) {
    if (query.length < 2) { setFratrieResults([]); return }
    const { data } = await supabase.from('enfants')
      .select('id, prenom, nom, date_naissance, sexe')
      .or(`prenom.ilike.%${query}%,nom.ilike.%${query}%`)
      .limit(10)
    if (data) setFratrieResults(data)
  }

  function addFratrieFromBase(enfant) {
    if (newEnfant.fratrie?.find(f => f.enfant_id === enfant.id)) { showToast('⚠️ Déjà ajouté'); return }
    setNewEnfant(n => ({ ...n, fratrie: [...(n.fratrie||[]), { enfant_id: enfant.id, prenom: enfant.prenom, nom: enfant.nom, ddn: enfant.date_naissance, sexe: enfant.sexe === 'Féminin' ? 'F' : 'M', meme_af: true }] }))
    setFratrieModal(false); setFratrieSearch(''); setFratrieMode('question')
    showToast('✅ Ajouté !')
  }

  function addFratrieNew() {
    if (!newFratrieItem.prenom || !newFratrieItem.nom) { showToast('⚠️ Prénom et nom requis'); return }
    setNewEnfant(n => ({ ...n, fratrie: [...(n.fratrie||[]), { ...newFratrieItem }] }))
    setFratrieModal(false); setNewFratrieItem({ prenom:'', nom:'', ddn:'', sexe:'M', meme_af:true }); setFratrieMode('question')
    showToast('✅ Ajouté !')
  }

  async function createEnfant() {
    if (!newEnfant.prenom || !newEnfant.nom) { showToast('⚠️ Prénom et nom requis'); return }
    setSaving(true)

    // Étape 0 : créer l'AF temporaire si nécessaire
    let afPrincipalId = newEnfant.af_principal_id || null
    if (evenementEnAttente && afChoix === 'temporaire') {
      if (!afTemp.prenom || !afTemp.nom) { showToast('⚠️ Prénom et nom de l'AF requis'); setSaving(false); return }
      const { data: newAf, error: errAf } = await supabase.from('profiles').insert({
        prenom: afTemp.prenom.trim(),
        nom: afTemp.nom.trim().toUpperCase(),
        ville: afTemp.ville.trim() || null,
        role: 'af',
        statut_profil: 'temporaire'
      }).select().single()
      if (errAf) { showToast('❌ Erreur AF : ' + errAf.message); setSaving(false); return }
      afPrincipalId = newAf.id
      setAfTempId(newAf.id)
    }

    const { data, error } = await supabase.from('enfants').insert({
      prenom: newEnfant.prenom,
      nom: newEnfant.nom,
      date_naissance: newEnfant.date_naissance || null,
      sexe: newEnfant.sexe || null,
      numero_dossier: newEnfant.numero_dossier || null,
      type_placement: newEnfant.type_placement || 'judiciaire',
      lieu_accueil: newEnfant.lieu_accueil || 'af_principal',
      af_principal_id: afPrincipalId,
      fratrie: newEnfant.fratrie?.length > 0 ? newEnfant.fratrie : null,
      referent_id: newEnfant.referent_id || null,
      territoire: profile.territoire,
      statut_profil: evenementEnAttente ? 'temporaire' : null,
    }).select().single()

    if (!error && data) {
      // Si un événement est en attente (venant de l'import PDF), le créer automatiquement
      if (evenementEnAttente) {
        const toParisISO = (isoStr) => {
          if (!isoStr) return isoStr
          if (!isoStr.includes('+') && !isoStr.endsWith('Z')) {
            const [datePart, timePart] = isoStr.split('T')
            const [y, m, d] = datePart.split('-').map(Number)
            const [h, min, s] = (timePart || '00:00:00').split(':').map(Number)
            const tempDate = new Date(Date.UTC(y, m-1, d, h, min, s || 0))
            const parisOffset = new Intl.DateTimeFormat('fr-FR', {
              timeZone: 'Europe/Paris', timeZoneName: 'shortOffset'
            }).formatToParts(tempDate).find(p => p.type === 'timeZoneName')?.value || '+02:00'
            const offsetHours = parisOffset.includes('+') ? -parseInt(parisOffset.split('+')[1]) : parseInt(parisOffset.split('-')[1])
            tempDate.setHours(tempDate.getHours() + offsetHours)
            return tempDate.toISOString()
          }
          return isoStr
        }
        const evt = evenementEnAttente
        await supabase.from('evenements').insert({
          titre: evt.titre || `${evt.categorie || 'Événement'} — ${data.prenom} ${data.nom}`,
          categorie: evt.categorie || 'vm',
          date_debut: toParisISO(evt.date_debut),
          date_fin: toParisISO(evt.date_fin),
          lieu: evt.lieu || '',
          notes: evt.notes || '',
          af_id: profile.id,
          cree_par: profile.id,
          visible_ase: true,
          source: 'pdf_import',
          enfant_ids: [data.id],
          ...(evt.participants_ids?.length > 0 ? { participants_ids: evt.participants_ids } : {}),
          ...(evt.vm_presents?.length > 0 ? { vm_presents: evt.vm_presents } : {})
        })
        setEvenementEnAttente(null)
        showToast('✅ Dossier et événement créés !')
        setShowModal(false)
        setNewEnfant({ prenom:'', nom:'', date_naissance:'', sexe:'', numero_dossier:'', type_placement:'judiciaire', lieu_accueil:'af_principal', af_principal_id:'', referent_id:'', fratrie:[] })
        navigate('/agenda')
      } else {
        showToast('✅ Dossier créé !')
        setShowModal(false)
        setNewEnfant({ prenom:'', nom:'', date_naissance:'', sexe:'', numero_dossier:'', type_placement:'judiciaire', lieu_accueil:'af_principal', af_principal_id:'', referent_id:'', fratrie:[] })
        navigate(`/enfants/${data.id}`)
      }
    } else showToast('❌ Erreur : ' + error?.message)
    setSaving(false)
  }

  const enfantsFiltres = enfants.filter(e =>
    `${e.prenom} ${e.nom}`.toLowerCase().includes(search.toLowerCase()) ||
    (e.numero_dossier || '').toLowerCase().includes(search.toLowerCase())
  )

  const PLACEMENT_COLORS = {
    judiciaire: { bg:'#e8eef8', color:'#1a4b8f', label:'⚖️ Judiciaire' },
    administratif: { bg:'#e6f5eb', color:'#2e8b4a', label:'📋 Administratif' },
    urgence: { bg:'#fdf0ee', color:'#c0392b', label:'🚨 Urgence' },
    secret: { bg:'#fdf0f0', color:'#8b1a1a', label:'🔒 Secret' },
    aemo: { bg:'#f0ebfb', color:'#6b21a8', label:'👁 AEMO' },
    aemo_r: { bg:'#f0ebfb', color:'#6b21a8', label:'👁 AEMO-R' },
    non_place: { bg:'#f4f6fb', color:'#9aa3b8', label:'🏠 Non placé' },
  }

  return (
    <div className="app-layout">
      <Sidebar profile={profile} />
      <div className="main-content">
        <PageHeader icon="👶" title="Enfants" subtitle={`${enfants.length} dossier${enfants.length > 1 ? 's' : ''} · ${profile?.territoire || ''}`}>
          {isReferent && (
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Nouveau dossier</button>
          )}
          {isAF && (
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Nouveau dossier enfant</button>
          )}
        </PageHeader>

        <div style={{ padding:24 }}>
          <div style={{ marginBottom:20 }}>
            {!isAF && (
              <input className="form-control" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="🔍 Rechercher par nom ou n° dossier..."
                style={{ maxWidth:380 }} />
            )}
          </div>

          {loading ? (
            <div style={{ textAlign:'center', padding:60, color:'#9aa3b8' }}>
              <div style={{ fontSize:36, marginBottom:12 }}>👶</div>
              <div>Chargement...</div>
            </div>
          ) : enfantsFiltres.length === 0 ? (
            <div style={{ textAlign:'center', padding:60, color:'#9aa3b8' }}>
              <div style={{ fontSize:36, marginBottom:12 }}>👶</div>
              <div style={{ fontSize:14 }}>{search ? 'Aucun résultat' : 'Aucun dossier enfant'}</div>
              {isReferent && !search && (
                <button onClick={() => setShowModal(true)} className="btn btn-primary" style={{ marginTop:16 }}>
                  + Créer le premier dossier
                </button>
              )}
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:16 }}>
              {enfantsFiltres.map(e => {
                const age = calcAge(e.date_naissance)
                const placement = PLACEMENT_COLORS[e.type_placement] || PLACEMENT_COLORS.judiciaire
                const initiales = `${e.nom?.[0] || ''}${e.prenom?.[0] || ''}`
                return (
                  <div key={e.id} onClick={() => navigate(`/enfants/${e.id}`)}
                    style={{ background:'#fff', border:'1px solid #dde3f0', borderRadius:14, padding:18, cursor:'pointer', boxShadow:'0 2px 12px rgba(26,75,143,.08)', transition:'all .15s' }}
                    onMouseOver={ev => { ev.currentTarget.style.boxShadow='0 4px 20px rgba(26,75,143,.15)'; ev.currentTarget.style.transform='translateY(-2px)' }}
                    onMouseOut={ev => { ev.currentTarget.style.boxShadow='0 2px 12px rgba(26,75,143,.08)'; ev.currentTarget.style.transform='none' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
                      <div style={{ width:44, height:44, borderRadius:'50%', background:'linear-gradient(135deg, #1a4b8f, #2e8b4a)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:700, color:'#fff', flexShrink:0 }}>
                        {initiales}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:15, fontWeight:700, display:'flex', alignItems:'center', gap:6 }}>
                          {e.nom} {e.prenom}
                          {e.statut_profil === 'temporaire' && <span style={{ fontSize:10, background:'#fef3c7', color:'#b45309', borderRadius:5, padding:'1px 6px', fontWeight:700 }}>⏳ TEMP</span>}
                        </div>
                        <div style={{ fontSize:12, color:'#9aa3b8' }}>
                          {age}{e.date_naissance && (() => { const [y,m,d] = e.date_naissance.split('-'); return ` · ${d}/${m}/${y}` })()}
                        </div>
                      </div>
                      {e.type_placement === 'secret' && <span style={{ fontSize:14 }}>🔒</span>}
                    </div>
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:10 }}>
                      {e.numero_dossier && (
                        <span style={{ padding:'2px 8px', borderRadius:10, background:'#e8eef8', color:'#1a4b8f', fontSize:10, fontWeight:600 }}>{e.numero_dossier}</span>
                      )}
                      {e.type_placement && (
                        <span style={{ padding:'2px 8px', borderRadius:10, background: placement.bg, color: placement.color, fontSize:10, fontWeight:600 }}>{placement.label}</span>
                      )}
                      {enfantsRelaisIds.includes(e.id) && (
                        <span style={{ padding:'2px 8px', borderRadius:10, background:'#e0f2fe', color:'#0891b2', fontSize:10, fontWeight:700 }}>🔄 Relais actif</span>
                      )}
                    </div>
                    <div style={{ borderTop:'1px solid #f0f0f0', paddingTop:10, display:'flex', justifyContent:'space-between', fontSize:11, color:'#9aa3b8' }}>
                      <span>👨‍👩‍👧 {e.af_principal ? `${e.af_principal.nom} ${e.af_principal.prenom}` : 'AF non assigné'}</span>
                      <span>👩‍💼 {e.referent ? `${e.referent.nom} ${e.referent.prenom}` : '—'}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Modal création dossier */}
        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal-box" style={{ maxWidth:560 }} onClick={e => e.stopPropagation()}>
              <div className="modal-title">
                {evenementEnAttente && etapeModal === 1 ? '👨‍👧 AF principal de l'enfant' : '👶 Nouveau dossier enfant'}
                {evenementEnAttente && <span style={{ fontSize:11, background:'#fef3c7', color:'#b45309', borderRadius:6, padding:'2px 8px', marginLeft:10, fontWeight:600 }}>⏳ Profil temporaire</span>}
              </div>

              {/* ÉTAPE 1 — Choix AF principal (uniquement si import PDF) */}
              {evenementEnAttente && etapeModal === 1 && (
                <div>
                  <p style={{ fontSize:13, color:'#5a6478', marginBottom:16 }}>
                    L'AF principal de cet enfant est-il déjà inscrit sur Passerelle ?
                  </p>
                  <div style={{ display:'flex', gap:10, marginBottom:20 }}>
                    <button
                      style={{ flex:1, padding:'10px', borderRadius:8, border:`2px solid ${afChoix==='existant' ? '#1a4b8f' : '#dde3f0'}`, background: afChoix==='existant' ? '#e8eef8' : '#fff', color: afChoix==='existant' ? '#1a4b8f' : '#5a6478', fontWeight:700, cursor:'pointer', fontSize:13 }}
                      onClick={() => setAfChoix('existant')}>
                      ✅ Oui — je le sélectionne
                    </button>
                    <button
                      style={{ flex:1, padding:'10px', borderRadius:8, border:`2px solid ${afChoix==='temporaire' ? '#f59e0b' : '#dde3f0'}`, background: afChoix==='temporaire' ? '#fef3c7' : '#fff', color: afChoix==='temporaire' ? '#b45309' : '#5a6478', fontWeight:700, cursor:'pointer', fontSize:13 }}
                      onClick={() => setAfChoix('temporaire')}>
                      ⏳ Non — créer un AF temporaire
                    </button>
                  </div>

                  {afChoix === 'existant' && (
                    <div className="form-group" style={{ marginBottom:16 }}>
                      <label className="form-label">Sélectionner l'AF principal</label>
                      <select className="form-control" value={newEnfant.af_principal_id}
                        onChange={e => setNewEnfant(n => ({...n, af_principal_id: e.target.value}))}>
                        <option value=''>— Choisir un AF —</option>
                        {afListe.map(af => (
                          <option key={af.id} value={af.id}>{af.nom} {af.prenom}{af.ville ? ` — ${af.ville}` : ''}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {afChoix === 'temporaire' && (
                    <div style={{ background:'#fffbeb', border:'1px solid #fcd34d', borderRadius:8, padding:14, marginBottom:16 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:'#b45309', marginBottom:10 }}>⏳ Créer un AF temporaire</div>
                      <div className="form-grid-2">
                        <div className="form-group">
                          <label className="form-label">Prénom *</label>
                          <input className="form-control" value={afTemp.prenom}
                            onChange={e => setAfTemp(a => ({...a, prenom: e.target.value}))} autoFocus />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Nom *</label>
                          <input className="form-control" value={afTemp.nom}
                            onChange={e => setAfTemp(a => ({...a, nom: e.target.value.toUpperCase()}))} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Ville</label>
                          <input className="form-control" value={afTemp.ville}
                            onChange={e => setAfTemp(a => ({...a, ville: e.target.value}))} />
                        </div>
                      </div>
                    </div>
                  )}

                  <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:8 }}>
                    <button className="btn btn-secondary" onClick={() => { setShowModal(false); setEvenementEnAttente(null) }}>Annuler</button>
                    <button className="btn btn-primary"
                      disabled={afChoix === 'existant' && !newEnfant.af_principal_id}
                      onClick={() => setEtapeModal(2)}>
                      Continuer → Fiche enfant
                    </button>
                  </div>
                </div>
              )}

              {/* ÉTAPE 2 — Fiche enfant (ou formulaire normal sans import PDF) */}
              {(!evenementEnAttente || etapeModal === 2) && (
                <div>
                  {evenementEnAttente && <div style={{ fontSize:11, color:'#888', marginBottom:12, cursor:'pointer' }} onClick={() => setEtapeModal(1)}>← Retour choix AF</div>}
                  <div style={{ fontSize:11, fontWeight:700, color:'#1a4b8f', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:8 }}>Identité</div>
              <div className="form-grid-2" style={{ marginBottom:16 }}>
                <div className="form-group">
                  <label className="form-label">Prénom *</label>
                  <input className="form-control" value={newEnfant.prenom} onChange={e => setNewEnfant(n => ({...n, prenom: e.target.value}))} autoFocus />
                </div>
                <div className="form-group">
                  <label className="form-label">Nom *</label>
                  <input className="form-control" value={newEnfant.nom} onChange={e => setNewEnfant(n => ({...n, nom: e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Date de naissance</label>
                  <input type="date" className="form-control" value={newEnfant.date_naissance} onChange={e => setNewEnfant(n => ({...n, date_naissance: e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Sexe</label>
                  <select className="form-control" value={newEnfant.sexe} onChange={e => setNewEnfant(n => ({...n, sexe: e.target.value}))}>
                    <option value="">—</option>
                    <option value="Féminin">👧 Féminin</option>
                    <option value="Masculin">👦 Masculin</option>
                  </select>
                </div>
                <div className="form-group col-span-2">
                  <label className="form-label">N° dossier CD81</label>
                  <input className="form-control" value={newEnfant.numero_dossier} onChange={e => setNewEnfant(n => ({...n, numero_dossier: e.target.value}))} placeholder="CD81-2026-XXXX" />
                </div>
              </div>
              <div style={{ fontSize:11, fontWeight:700, color:'#1a4b8f', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:8 }}>Type de placement</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:16 }}>
                {[
                  {v:'non_place', icon:'🏠', l:'Non placé'},
                  {v:'judiciaire', icon:'⚖️', l:'Judiciaire'},
                  {v:'administratif', icon:'📋', l:'Administratif'},
                  {v:'urgence', icon:'🚨', l:'Urgence'},
                  {v:'aemo', icon:'👁', l:'AEMO'},
                  {v:'aemo_r', icon:'👁', l:'AEMO-R'},
                  {v:'secret', icon:'🔒', l:'Secret'},
                ].map(p => (
                  <button key={p.v} type="button"
                    onClick={() => setNewEnfant(n => ({...n, type_placement: p.v}))}
                    style={{ padding:'6px 12px', borderRadius:20, border:`1.5px solid ${newEnfant.type_placement === p.v ? '#1a4b8f' : '#dde3f0'}`, background: newEnfant.type_placement === p.v ? '#1a4b8f' : '#fff', color: newEnfant.type_placement === p.v ? '#fff' : '#5a6478', fontSize:12, fontWeight: newEnfant.type_placement === p.v ? 700 : 500, cursor:'pointer' }}>
                    {p.icon} {p.l}
                  </button>
                ))}
              </div>
              <div style={{ fontSize:11, fontWeight:700, color:'#1a4b8f', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:8 }}>Lieu d'accueil</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:12 }}>
                {[
                  {v:'af_principal', icon:'👨‍👩‍👧', l:'AF Principal'},
                  {v:'foyer', icon:'🏛️', l:'Foyer'},
                  {v:'lva', icon:'🏠', l:'LVA'},
                  {v:'autre_structure', icon:'📋', l:'Autre structure'},
                  {v:'domicile_parental', icon:'🏡', l:'Domicile parental'},
                ].map(p => (
                  <button key={p.v} type="button"
                    onClick={() => setNewEnfant(n => ({...n, lieu_accueil: p.v}))}
                    style={{ padding:'6px 12px', borderRadius:20, border:`1.5px solid ${newEnfant.lieu_accueil === p.v ? '#2e8b4a' : '#dde3f0'}`, background: newEnfant.lieu_accueil === p.v ? '#2e8b4a' : '#fff', color: newEnfant.lieu_accueil === p.v ? '#fff' : '#5a6478', fontSize:12, fontWeight: newEnfant.lieu_accueil === p.v ? 700 : 500, cursor:'pointer' }}>
                    {p.icon} {p.l}
                  </button>
                ))}
              </div>
              {newEnfant.lieu_accueil === 'af_principal' && (
                <div className="form-group" style={{ marginBottom:16 }}>
                  <label className="form-label">AF Principal</label>
                  <select className="form-control" value={newEnfant.af_principal_id || ''} onChange={e => setNewEnfant(n => ({...n, af_principal_id: e.target.value}))}>
                    <option value="">— Sélectionner un AF —</option>
                    {collegues.filter(c => c.role === 'af').map(c => (
                      <option key={c.id} value={c.id}>{c.nom} {c.prenom}</option>
                    ))}
                  </select>
                  {newEnfant.af_principal_id && (() => {
                    const af = collegues.find(c => c.id === newEnfant.af_principal_id)
                    return af ? (
                      <div style={{marginTop:8,padding:'10px 14px',background:'#e6f5eb',borderRadius:8,border:'1px solid #c4e8cc',fontSize:12}}>
                        <div style={{fontWeight:700,marginBottom:4}}>👨‍👩‍👧 {af.nom} {af.prenom}</div>
                        {af.telephone&&<div>📞 {af.telephone}</div>}
                        {af.email&&<div>✉️ {af.email}</div>}
                        {af.ville&&<div>📍 {af.ville}</div>}
                      </div>
                    ) : null
                  })()}
                </div>
              )}
              <div className="form-group" style={{ marginBottom:16 }}>
                <label className="form-label">Référent(e) ASE</label>
                <select className="form-control" value={newEnfant.referent_id || ''} onChange={e => setNewEnfant(n => ({...n, referent_id: e.target.value}))}>
                  <option value="">— Sélectionner (optionnel) —</option>
                  {collegues.filter(c => c.role === 'referent').map(c => (
                    <option key={c.id} value={c.id}>{c.nom} {c.prenom}</option>
                  ))}
                </select>
                {newEnfant.referent_id && (() => {
                  const ref = collegues.find(c => c.id === newEnfant.referent_id)
                  return ref ? (
                    <div style={{marginTop:8,padding:'10px 14px',background:'#e8eef8',borderRadius:8,border:'1px solid #c4d4f5',fontSize:12}}>
                      <div style={{fontWeight:700,marginBottom:4}}>👩‍💼 {ref.nom} {ref.prenom}</div>
                      {ref.telephone&&<div>📞 {ref.telephone}</div>}
                      {ref.email&&<div>✉️ {ref.email}</div>}
                    </div>
                  ) : null
                })()}
              </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Annuler</button>
                  <button className="btn btn-primary" onClick={createEnfant} disabled={saving}>
                    {saving ? '⏳...' : evenementEnAttente ? '✅ Créer dossier + événement' : '👶 Créer le dossier'}
                  </button>
                </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal fratrie */}
        {fratrieModal && (
          <div className="modal-overlay" onClick={() => setFratrieModal(false)}>
            <div className="modal-box" style={{ maxWidth:460 }} onClick={e => e.stopPropagation()}>
              <div className="modal-title">👧👦 Ajouter un membre de la fratrie</div>
              {fratrieMode === 'question' && (
                <div style={{ textAlign:'center', padding:'20px 0' }}>
                  <div style={{ fontSize:32, marginBottom:16 }}>🔍</div>
                  <p style={{ fontSize:14, color:'#5a6478', marginBottom:24 }}>Cet enfant est-il déjà enregistré dans Passerelle ?</p>
                  <div style={{ display:'flex', gap:12, justifyContent:'center' }}>
                    <button className="btn btn-primary" onClick={() => setFratrieMode('search')}>✅ Oui — Rechercher</button>
                    <button className="btn btn-secondary" onClick={() => setFratrieMode('create')}>➕ Non — Créer</button>
                  </div>
                </div>
              )}
              {fratrieMode === 'search' && (
                <div>
                  <div className="form-group">
                    <label className="form-label">Rechercher</label>
                    <input className="form-control" value={fratrieSearch} autoFocus
                      onChange={e => { setFratrieSearch(e.target.value); searchFratrie(e.target.value) }}
                      placeholder="Prénom ou nom..." />
                  </div>
                  {fratrieResults.length > 0 && (
                    <div style={{ maxHeight:200, overflowY:'auto', border:'1px solid #dde3f0', borderRadius:8, marginTop:8 }}>
                      {fratrieResults.map(e => (
                        <div key={e.id} onClick={() => addFratrieFromBase(e)}
                          style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', cursor:'pointer', borderBottom:'1px solid #f0f0f0' }}
                          onMouseOver={ev => ev.currentTarget.style.background='#f4f6fb'}
                          onMouseOut={ev => ev.currentTarget.style.background='#fff'}>
                          <span style={{ fontSize:18 }}>{e.sexe === 'Féminin' ? '👧' : '👦'}</span>
                          <div>
                            <div style={{ fontSize:13, fontWeight:600 }}>{e.nom} {e.prenom}</div>
                            <div style={{ fontSize:11, color:'#9aa3b8' }}>{calcAge(e.date_naissance)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={() => setFratrieMode('question')}>← Retour</button>
                  </div>
                </div>
              )}
              {fratrieMode === 'create' && (
                <div>
                  <div className="form-grid-2">
                    <div className="form-group">
                      <label className="form-label">Prénom *</label>
                      <input className="form-control" value={newFratrieItem.prenom} autoFocus
                        onChange={e => setNewFratrieItem(n => ({...n, prenom: e.target.value}))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Nom *</label>
                      <input className="form-control" value={newFratrieItem.nom}
                        onChange={e => setNewFratrieItem(n => ({...n, nom: e.target.value}))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Date de naissance</label>
                      <input type="date" className="form-control" value={newFratrieItem.ddn}
                        onChange={e => setNewFratrieItem(n => ({...n, ddn: e.target.value}))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Sexe</label>
                      <select className="form-control" value={newFratrieItem.sexe}
                        onChange={e => setNewFratrieItem(n => ({...n, sexe: e.target.value}))}>
                        <option value="M">👦 Masculin</option>
                        <option value="F">👧 Féminin</option>
                      </select>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={() => setFratrieMode('question')}>← Retour</button>
                    <button className="btn btn-primary" onClick={addFratrieNew}>✅ Ajouter</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {toast && <div className="toast">{toast}</div>}
      </div>
    </div>
  )
}
