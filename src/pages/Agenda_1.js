import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Sidebar from '../components/Sidebar'

const CATEGORIES = {
  vm:        { label: 'VM', color: '#e05c5c', bg: '#fde8e8' },
  relais:    { label: 'Relais', color: '#0891b2', bg: '#e0f2fe' },
  conge:     { label: 'Congés', color: '#6d4c9e', bg: '#f0ebfb' },
  medical:   { label: 'Médical', color: '#2e8b4a', bg: '#e6f5eb' },
  ase:       { label: 'ASE', color: '#1a4b8f', bg: '#e8eef8' },
  scolaire:  { label: 'Scolaire', color: '#d97706', bg: '#fef3e2' },
  formation: { label: 'Formation', color: '#555', bg: '#eee' },
  personnel: { label: 'Personnel', color: '#9aa3b8', bg: '#eef1f8' },
  autre:     { label: 'Autre', color: '#5a6478', bg: '#eef1f8' },
}

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MOIS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

function getMonday(d) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(date.setDate(diff))
}

function addDays(d, n) {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

function weekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dn = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dn)
  const y1 = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil((((date - y1) / 86400000) + 1) / 7)
}

export default function Agenda({ profile }) {
  const navigate = useNavigate()
  const [vue, setVue] = useState('mois')
  const [currentDate, setCurrentDate] = useState(new Date(2026, 3, 6))
  const [evenements, setEvenements] = useState([])
  const [partages, setPartages] = useState([])
  const [filtres, setFiltres] = useState(['tous'])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showPartageModal, setShowPartageModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedEvt, setSelectedEvt] = useState(null)
  const [editMode, setEditMode] = useState(false)
  const [editEvt, setEditEvt] = useState({})
  const [selectedDate, setSelectedDate] = useState(null)
  const [collègues, setCollègues] = useState([])
  const [enfants, setEnfants] = useState([])
  const [couleursEnfants, setCouleursEnfants] = useState({})
  const [newEvt, setNewEvt] = useState({
    titre: '', categorie: 'vm', date_debut: '', heure_debut: '09:00',
    date_fin: '', heure_fin: '10:00', lieu: '', notes: '', enfants: []
  })

  useEffect(() => { fetchEvenements(); fetchPartages(); fetchCollegues(); fetchEnfants() }, [profile])

  const fetchEvenements = useCallback(async () => {
    const { data } = await supabase
      .from('evenements')
      .select('*, enfants_data:enfant_ids')
      .order('date_debut', { ascending: true })
    if (data) setEvenements(data)
    // Fetch enfants names separately for events
    const allEnfantIds = []
    if (data) data.forEach(e => { if (e.enfant_ids) e.enfant_ids.forEach(id => { if (!allEnfantIds.includes(id)) allEnfantIds.push(id) }) })
    if (allEnfantIds.length > 0) {
      const { data: enf } = await supabase.from('enfants').select('id, nom, prenom').in('id', allEnfantIds)
      if (enf) setEnfants(prev => {
        const merged = [...prev]
        enf.forEach(e => { if (!merged.find(x => x.id === e.id)) merged.push(e) })
        return merged
      })
    }
    setLoading(false)
  }, [])

  const fetchPartages = useCallback(async () => {
    const { data } = await supabase
      .from('agenda_partages')
      .select('*, demandeur:demandeur_id(nom,prenom), destinataire:destinataire_id(nom,prenom)')
    if (data) setPartages(data)
  }, [])

  const fetchCollegues = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, nom, prenom, role, matricule')
      .neq('id', profile?.id)
      .eq('territoire', profile?.territoire)
    if (data) setCollègues(data)
  }, [profile])

  const fetchEnfants = useCallback(async () => {
    if (!profile) return
    // Chercher les enfants principaux
    const { data: enfantsPrincipaux } = await supabase
      .from('enfants')
      .select('id, nom, prenom')
      .eq('af_principal_id', profile.id)

    // Chercher aussi les enfants via les événements relais
    const { data: evtsRelais } = await supabase
      .from('evenements')
      .select('enfant_ids')
      .eq('af_id', profile.id)
      .eq('categorie', 'relais')

    // Collecter tous les IDs enfants des événements relais
    const idsRelais = []
    if (evtsRelais) {
      evtsRelais.forEach(evt => {
        if (evt.enfant_ids) evt.enfant_ids.forEach(id => { if (!idsRelais.includes(id)) idsRelais.push(id) })
      })
    }

    // Chercher les enfants relais
    let enfantsRelais = []
    if (idsRelais.length > 0) {
      const { data } = await supabase.from('enfants').select('id, nom, prenom').in('id', idsRelais)
      if (data) enfantsRelais = data
    }

    // Fusionner sans doublons
    const tous = [...(enfantsPrincipaux || [])]
    enfantsRelais.forEach(e => { if (!tous.find(x => x.id === e.id)) tous.push(e) })

    setEnfants(tous)
    const couleurs = {}
    const defaultColors = ['#e05c5c','#2e8b4a','#d97706','#6d4c9e','#0891b2','#1a4b8f']
    tous.forEach((en, i) => { couleurs[en.id] = defaultColors[i % defaultColors.length] })
    setCouleursEnfants(couleurs)
  }, [profile])

  async function saveEdit() {
    if (!editEvt.titre) { showToast('⚠️ Titre requis'); return }
    const debut = new Date(`${editEvt.date_debut}T${editEvt.heure_debut}:00`)
    const fin = new Date(`${editEvt.date_fin}T${editEvt.heure_fin}:00`)

    // Si l'utilisateur est participant (pas propriétaire) → demande de validation
    if (selectedEvt.af_id !== profile?.id && selectedEvt.participants_ids?.includes(profile?.id)) {
      const { error } = await supabase.from('evenements_modifications').insert({
        evenement_id: selectedEvt.id,
        demandeur_id: profile.id,
        valideur_id: selectedEvt.af_id,
        anciennes_valeurs: {
          titre: selectedEvt.titre,
          date_debut: selectedEvt.date_debut,
          date_fin: selectedEvt.date_fin,
          lieu: selectedEvt.lieu,
          notes: selectedEvt.notes,
        },
        nouvelles_valeurs: {
          titre: editEvt.titre,
          date_debut: debut.toISOString(),
          date_fin: fin.toISOString(),
          lieu: editEvt.lieu,
          notes: editEvt.notes,
        },
        statut: 'en_attente',
        message: editEvt.message || ''
      })
      if (!error) {
        showToast('📤 Demande de modification envoyée — en attente de validation')
        setEditMode(false); setShowDetailModal(false); fetchEvenements()
      } else showToast('❌ Erreur')
    } else {
      // Propriétaire → modification directe
      const { error } = await supabase.from('evenements').update({
        titre: editEvt.titre,
        categorie: editEvt.categorie,
        date_debut: debut.toISOString(),
        date_fin: fin.toISOString(),
        lieu: editEvt.lieu,
        notes: editEvt.notes,
      }).eq('id', selectedEvt.id)
      if (!error) {
        showToast('✅ Événement modifié !')
        setEditMode(false); setShowDetailModal(false); fetchEvenements()
      } else showToast('❌ Erreur')
    }
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 2800) }

  function toggleFiltre(f) {
    if (f === 'tous') { setFiltres(['tous']); return }
    setFiltres(prev => {
      const without = prev.filter(x => x !== 'tous')
      if (prev.includes(f)) {
        const r = without.filter(x => x !== f)
        return r.length === 0 ? ['tous'] : r
      }
      return [...without, f]
    })
  }

  function evtsFiltres() {
    if (filtres.includes('tous')) return evenements
    return evenements.filter(e => filtres.includes(e.categorie))
  }

  function evtsDuJour(date) {
    const filtered = evtsFiltres().filter(e => {
      const d = new Date(e.date_debut)
      const f = e.date_fin ? new Date(e.date_fin) : d
      const dDate = new Date(date); dDate.setHours(0,0,0,0)
      const fDate = new Date(f); fDate.setHours(23,59,59,999)
      return dDate >= new Date(new Date(d).setHours(0,0,0,0)) && dDate <= fDate
    })
    const DEFCOLORS = ['#e05c5c','#2e8b4a','#d97706','#6d4c9e','#0891b2']
    const expanded = []
    filtered.forEach(evt => {
      const baseColor = (CATEGORIES[evt.categorie] || CATEGORIES.autre).color
      if (evt.enfant_ids && evt.enfant_ids.length > 0) {
        evt.enfant_ids.forEach((enfantId, idx) => {
          const enfant = enfants.find(e => e.id === enfantId)
          const couleur = couleursEnfants[enfantId] || DEFCOLORS[idx % DEFCOLORS.length]
          // Titre adapté selon le point de vue
          let titrePOV = evt.titre
          if (evt.categorie === 'relais') {
            if (evt.af_id === profile?.id) {
              // Je suis l'AF principal — chercher le nom du participant relais
              const afRelais = collègues.find(c => evt.participants_ids?.includes(c.id))
              if (afRelais) titrePOV = 'Relais famille ' + afRelais.nom
            } else if (evt.participants_ids?.includes(profile?.id)) {
              // Je suis l'AF relais — chercher le nom de l'AF principal
              const afPrincipal = collègues.find(c => c.id === evt.af_id)
              if (afPrincipal) titrePOV = 'Relais famille ' + afPrincipal.nom
              else titrePOV = 'Relais famille principale'
            }
          }
          expanded.push({
            ...evt,
            _enfantId: enfantId,
            _enfantNom: enfant ? enfant.prenom + ' ' + enfant.nom : '',
            _couleur: couleur,
            _titrePOV: titrePOV
          })
        })
      } else {
        expanded.push({ ...evt, _couleur: baseColor })
      }
    })
    return expanded
  }

  async function saveEvt() {
    if (!newEvt.titre || !newEvt.date_debut) { showToast('⚠️ Titre et date requis'); return }
    const debut = new Date(`${newEvt.date_debut}T${newEvt.heure_debut}:00`)
    const fin = new Date(`${(newEvt.date_fin || newEvt.date_debut)}T${newEvt.heure_fin}:00`)
    const { error } = await supabase.from('evenements').insert({
      titre: newEvt.titre, categorie: newEvt.categorie,
      date_debut: debut.toISOString(), date_fin: fin.toISOString(),
      lieu: newEvt.lieu, notes: newEvt.notes,
      af_id: profile.id, cree_par: profile.id,
      visible_ase: newEvt.categorie !== 'personnel',
      source: 'passerelle'
    })
    if (!error) { showToast('✅ Événement enregistré !'); setShowModal(false); fetchEvenements() }
    else showToast('❌ Erreur')
  }

  async function deleteEvt(id) {
    if (!window.confirm('Supprimer cet événement ?')) return
    await supabase.from('evenements').delete().eq('id', id)
    showToast('🗑 Supprimé'); setShowDetailModal(false); fetchEvenements()
  }

  async function demanderPartage(destinataireId) {
    const { error } = await supabase.from('agenda_partages').insert({
      demandeur_id: profile.id, destinataire_id: destinataireId, statut: 'en_attente'
    })
    if (!error) { showToast('📤 Demande envoyée !'); fetchPartages() }
  }

  async function accepterPartage(id) {
    await supabase.from('agenda_partages').update({ statut: 'accepte' }).eq('id', id)
    showToast('✅ Partage accepté !'); fetchPartages()
  }

  // Navigation
  function prev() {
    if (vue === 'mois') setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
    else if (vue === 'sem') setCurrentDate(d => addDays(d, -7))
    else if (vue === 'jour') setCurrentDate(d => addDays(d, -1))
  }
  function next() {
    if (vue === 'mois') setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))
    else if (vue === 'sem') setCurrentDate(d => addDays(d, 7))
    else if (vue === 'jour') setCurrentDate(d => addDays(d, 1))
  }

  function periodLabel() {
    if (vue === 'mois') return `${MOIS[currentDate.getMonth()]} ${currentDate.getFullYear()}`
    if (vue === 'sem') {
      const mon = getMonday(currentDate)
      const sun = addDays(mon, 6)
      return `Semaine ${weekNumber(mon)} · ${mon.getDate()} – ${sun.getDate()} ${MOIS[sun.getMonth()]} ${sun.getFullYear()}`
    }
    return currentDate.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' })
  }

  function openEvt(evt, e) {
    e?.stopPropagation()
    setSelectedEvt(evt)
    setShowDetailModal(true)
  }

  function openAdd(date) {
    setSelectedDate(date)
    setNewEvt(n => ({ ...n, date_debut: date ? date.toISOString().slice(0,10) : '', date_fin: date ? date.toISOString().slice(0,10) : '' }))
    setShowModal(true)
  }

  // RENDU VUE MOIS
  function renderMois() {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const first = new Date(year, month, 1)
    const startDay = first.getDay() === 0 ? 6 : first.getDay() - 1
    const start = addDays(first, -startDay)
    const today = new Date()
    const cells = []
    let prevWn = -1

    for (let i = 0; i < 42; i++) {
      const d = addDays(start, i)
      const wn = weekNumber(d)
      if (i % 7 === 0 && wn !== prevWn) {
        prevWn = wn
        cells.push(<div key={`wn-${i}`} style={{ background:'#f4f6fb', borderRight:'1px solid #dde3f0', borderBottom:'1px solid #dde3f0', display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'6px 2px', fontSize:9, color:'#9aa3b8', fontWeight:600 }}>{wn}</div>)
      }
      const isToday = sameDay(d, today)
      const isOther = d.getMonth() !== month
      const isWE = d.getDay() === 0 || d.getDay() === 6
      const evts = evtsDuJour(d)
      cells.push(
        <div key={`d-${i}`} onClick={() => openAdd(d)}
          style={{ minHeight:90, padding:3, borderRight:'1px solid #dde3f0', borderBottom:'1px solid #dde3f0', cursor:'pointer', background: isToday ? '#f0f4ff' : isWE ? '#fafafe' : isOther ? '#f8f9fb' : '#fff', transition:'background .1s' }}
          onMouseOver={e => e.currentTarget.style.background = '#f0f4ff'}
          onMouseOut={e => e.currentTarget.style.background = isToday ? '#f0f4ff' : isWE ? '#fafafe' : isOther ? '#f8f9fb' : '#fff'}
        >
          <div style={{ width:22, height:22, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'1px auto 3px', background: isToday ? '#1a4b8f' : 'none', color: isToday ? '#fff' : isOther ? '#9aa3b8' : '#1c2333', fontSize:11, fontWeight:500 }}>
            {d.getDate()}
          </div>
          {evts.slice(0, 3).map((ev, ei) => {
            const cat = CATEGORIES[ev.categorie] || CATEGORIES.autre
            const color = ev._couleur || cat.color
            const firstName = ev._enfantNom ? ev._enfantNom.split(' ')[0] : ''
            const label = firstName ? firstName + ' — ' + (ev._titrePOV || ev.titre) : (ev._titrePOV || ev.titre)
            return (
              <div key={ei} onClick={e => openEvt(ev, e)}
                style={{ fontSize:9, padding:'2px 5px', borderRadius:3, marginBottom:2, background:color, color:'#fff', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', cursor:'pointer', fontWeight:500 }}>
                {label}
              </div>
            )
          })}
          {evts.length > 3 && <div style={{ fontSize:9, color:'#1a4b8f', padding:'1px 3px', cursor:'pointer', fontWeight:600 }}>+{evts.length - 3}</div>}
        </div>
      )
    }

    return (
      <div style={{ background:'#fff', borderRadius:12, overflow:'hidden', boxShadow:'0 2px 12px rgba(26,75,143,.08)', border:'1px solid #dde3f0' }}>
        <div style={{ display:'grid', gridTemplateColumns:'32px repeat(7,1fr)', background:'#eef1f8', borderBottom:'1px solid #dde3f0' }}>
          <div style={{ borderRight:'1px solid #dde3f0', padding:'8px 2px', fontSize:9, color:'#9aa3b8', textAlign:'center', fontWeight:600 }}>S</div>
          {JOURS.map(j => <div key={j} style={{ padding:'8px 2px', textAlign:'center', fontSize:10, fontWeight:700, color:'#5a6478', textTransform:'uppercase', letterSpacing:'.3px' }}>{j}</div>)}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'32px repeat(7,1fr)' }}>
          {cells}
        </div>
      </div>
    )
  }

  // RENDU VUE SEMAINE
  function renderSemaine() {
    const mon = getMonday(currentDate)
    const days = Array.from({length:7}, (_, i) => addDays(mon, i))
    const today = new Date()
    const heures = Array.from({length:13}, (_, i) => i + 7)

    return (
      <div style={{ background:'#fff', borderRadius:12, overflow:'hidden', boxShadow:'0 2px 12px rgba(26,75,143,.08)', border:'1px solid #dde3f0' }}>
        <div style={{ display:'grid', gridTemplateColumns:'60px repeat(7,1fr)', borderBottom:'2px solid #dde3f0' }}>
          <div style={{ background:'#eef1f8', borderRight:'1px solid #dde3f0' }}></div>
          {days.map((d, i) => (
            <div key={i} style={{ padding:'10px 6px', textAlign:'center', borderRight: i < 6 ? '1px solid #dde3f0' : 'none', background:'#eef1f8' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#5a6478', textTransform:'uppercase' }}>{JOURS[i]}</div>
              <div style={{ fontSize:20, fontWeight:700, color: sameDay(d, today) ? '#1a4b8f' : '#1c2333', marginTop:2 }}>{d.getDate()}</div>
              {evtsDuJour(d).length > 0 && (
                <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginTop:4, justifyContent:'center' }}>
                  {evtsDuJour(d).map((ev, ei) => {
                    const cat = CATEGORIES[ev.categorie] || CATEGORIES.autre
                    const wColor = ev._couleur || cat.color
                    const wLabel = ev._enfantNom ? ev._enfantNom.split(' ')[0] + ' — ' + (ev._titrePOV || ev.titre).split(' ').slice(0,2).join(' ') : (ev._titrePOV || ev.titre)
                    return <div key={ei} onClick={e => openEvt(ev, e)} style={{ fontSize:9, padding:'2px 6px', borderRadius:3, background:wColor, color:'#fff', cursor:'pointer', fontWeight:500, maxWidth:90, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{wLabel}</div>
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
        <div style={{ padding:14, textAlign:'center', color:'#9aa3b8', fontSize:12 }}>
          Cliquez sur un événement pour voir les détails
        </div>
      </div>
    )
  }

  // RENDU VUE JOUR
  function renderJour() {
    const evts = evtsDuJour(currentDate)
    const heures = Array.from({length:14}, (_, i) => i + 7)
    return (
      <div style={{ background:'#fff', borderRadius:12, overflow:'hidden', boxShadow:'0 2px 12px rgba(26,75,143,.08)', border:'1px solid #dde3f0' }}>
        <div style={{ padding:'14px 16px', borderBottom:'1px solid #dde3f0', background:'#eef1f8', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:16, fontWeight:700 }}>{currentDate.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}</div>
            <div style={{ fontSize:12, color:'#9aa3b8', marginTop:2 }}>{evts.length} événement{evts.length > 1 ? 's' : ''}</div>
          </div>
          <button className="btn btn-primary" onClick={() => openAdd(currentDate)}>+ Ajouter</button>
        </div>
        {evts.length === 0 ? (
          <div style={{ padding:32, textAlign:'center', color:'#9aa3b8', fontSize:13 }}>Aucun événement ce jour</div>
        ) : (
          evts.map(ev => {
            const cat = CATEGORIES[ev.categorie] || CATEGORIES.autre
            const deb = new Date(ev.date_debut)
            const fin = ev.date_fin ? new Date(ev.date_fin) : null
            return (
              <div key={ev.id} onClick={e => openEvt(ev, e)}
                style={{ display:'flex', gap:12, padding:'12px 16px', borderBottom:'1px solid #dde3f0', cursor:'pointer', borderLeft:`4px solid ${cat.color}`, transition:'all .15s' }}
                onMouseOver={e => e.currentTarget.style.background = '#f4f6fb'}
                onMouseOut={e => e.currentTarget.style.background = '#fff'}
              >
                <div style={{ minWidth:55, fontSize:11, color:'#5a6478', fontWeight:500 }}>
                  {deb.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' })}
                  {fin && <><br />{fin.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' })}</>}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:600 }}>
                    {ev._enfantNom && <span style={{ fontSize:11, fontWeight:700, marginRight:6, padding:'1px 6px', borderRadius:8, background: ev._couleur || cat.color, color:'#fff' }}>{ev._enfantNom.split(' ')[0]}</span>}
                    {ev.titre}
                  </div>
                  <div style={{ fontSize:10, color:'#9aa3b8', marginTop:3 }}>
                    {ev.lieu && `📍 ${ev.lieu}`}
                    {ev.notes && ` · ${ev.notes.slice(0,60)}${ev.notes.length > 60 ? '...' : ''}`}
                  </div>
                  <span style={{ fontSize:10, padding:'2px 7px', borderRadius:10, background:cat.bg, color:cat.color, fontWeight:600, marginTop:5, display:'inline-block' }}>
                    {cat.label}
                  </span>
                </div>
                <span style={{ fontSize:16, color:'#9aa3b8' }}>›</span>
              </div>
            )
          })
        )}
      </div>
    )
  }

  const demandesRecues = partages.filter(p => p.destinataire_id === profile?.id && p.statut === 'en_attente')

  return (
    <div className="app-layout">
      <Sidebar profile={profile} />
      <div className="main-content">

        <header className="page-header">
          <span style={{ fontSize:20 }}>📅</span>
          <div>
            <div className="page-title">Agenda</div>
            <div className="page-subtitle">{profile?.prenom} {profile?.nom} · {profile?.territoire}</div>
          </div>
          <div className="header-actions">
            {demandesRecues.length > 0 && (
              <button className="btn btn-warning" onClick={() => setShowPartageModal(true)}>
                🔔 {demandesRecues.length} demande{demandesRecues.length > 1 ? 's' : ''} partage
              </button>
            )}
            <button className="btn btn-secondary" onClick={() => setShowPartageModal(true)}>🔗 Partage</button>
            <button className="btn btn-primary" onClick={() => openAdd(null)}>+ Ajouter</button>
          </div>
        </header>

        <div className="page-content">

          {/* Toolbar */}
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12, flexWrap:'wrap' }}>
            <div style={{ display:'flex', background:'#fff', border:'1px solid #dde3f0', borderRadius:9, overflow:'hidden', boxShadow:'0 2px 8px rgba(26,75,143,.07)' }}>
              {['jour','sem','mois'].map(v => (
                <button key={v} onClick={() => setVue(v)}
                  style={{ padding:'8px 13px', border:'none', background: vue === v ? '#1a4b8f' : 'none', color: vue === v ? '#fff' : '#5a6478', fontSize:11, fontWeight: vue === v ? 600 : 500, cursor:'pointer', fontFamily:'Sora,sans-serif', transition:'all .15s' }}>
                  {v === 'jour' ? 'Jour' : v === 'sem' ? 'Semaine' : 'Mois'}
                </button>
              ))}
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:4 }}>
              <button onClick={prev} style={{ width:30, height:30, borderRadius:7, border:'1px solid #dde3f0', background:'#fff', cursor:'pointer', fontSize:16, color:'#5a6478' }}>‹</button>
              <span style={{ fontSize:13, fontWeight:600, minWidth:200, textAlign:'center' }}>{periodLabel()}</span>
              <button onClick={next} style={{ width:30, height:30, borderRadius:7, border:'1px solid #dde3f0', background:'#fff', cursor:'pointer', fontSize:16, color:'#5a6478' }}>›</button>
            </div>
            <button onClick={() => setCurrentDate(new Date())}
              style={{ padding:'7px 11px', borderRadius:7, border:'1px solid #dde3f0', background:'#fff', fontSize:11, fontWeight:500, cursor:'pointer', fontFamily:'Sora,sans-serif', color:'#5a6478' }}>
              Aujourd'hui
            </button>
          </div>

          {/* Filtres */}
          <div style={{ display:'flex', gap:6, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
            <span style={{ fontSize:10, fontWeight:700, color:'#5a6478', textTransform:'uppercase', letterSpacing:'.4px' }}>Filtres :</span>
            {[['tous','Tous','#1a4b8f','#e8eef8'], ...Object.entries(CATEGORIES).map(([k,v]) => [k, v.label, v.color, v.bg])].map(([k, l, c, bg]) => (
              <button key={k} onClick={() => toggleFiltre(k)}
                style={{ padding:'5px 12px', borderRadius:20, border:`1.5px solid ${filtres.includes(k) || (k==='tous' && filtres.includes('tous')) ? c : '#dde3f0'}`, background: filtres.includes(k) || (k==='tous' && filtres.includes('tous')) ? bg : '#fff', fontSize:11, fontWeight: filtres.includes(k) ? 600 : 500, cursor:'pointer', color: filtres.includes(k) || (k==='tous' && filtres.includes('tous')) ? c : '#5a6478', fontFamily:'Sora,sans-serif', transition:'all .15s' }}>
                {l}
              </button>
            ))}
          </div>

          {/* Partages actifs */}
          {partages.filter(p => p.statut === 'accepte').length > 0 && (
            <div className="alert-info" style={{ marginBottom:12 }}>
              <span>🔗</span>
              <span>Agenda partagé avec : {partages.filter(p => p.statut === 'accepte').map(p => {
                const other = p.demandeur_id === profile?.id ? p.destinataire : p.demandeur
                return other ? `${other.prenom} ${other.nom}` : ''
              }).join(', ')}</span>
            </div>
          )}

          {/* Vue */}
          {loading ? <div className="loading-spinner">⏳ Chargement...</div> :
            vue === 'mois' ? renderMois() :
            vue === 'sem' ? renderSemaine() :
            renderJour()
          }

        </div>
      </div>

      {/* MODAL AJOUTER */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-title">+ Nouvel événement</div>
            <div className="form-grid-2">
              <div className="form-group col-span-2">
                <label className="form-label">Titre</label>
                <input className="form-control" value={newEvt.titre} onChange={e => setNewEvt(n => ({...n, titre: e.target.value}))} placeholder="Ex: VM Lou — Marssac/Tarn" />
              </div>
              <div className="form-group">
                <label className="form-label">Catégorie</label>
                <select className="form-control" value={newEvt.categorie} onChange={e => setNewEvt(n => ({...n, categorie: e.target.value}))}>
                  {Object.entries(CATEGORIES).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Lieu</label>
                <input className="form-control" value={newEvt.lieu} onChange={e => setNewEvt(n => ({...n, lieu: e.target.value}))} placeholder="Ex: Gaillac" />
              </div>
              <div className="form-group">
                <label className="form-label">Date début</label>
                <input className="form-control" type="date" value={newEvt.date_debut} onChange={e => setNewEvt(n => ({...n, date_debut: e.target.value, date_fin: e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Heure début</label>
                <input className="form-control" type="time" value={newEvt.heure_debut} onChange={e => setNewEvt(n => ({...n, heure_debut: e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Date fin</label>
                <input className="form-control" type="date" value={newEvt.date_fin} onChange={e => setNewEvt(n => ({...n, date_fin: e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Heure fin</label>
                <input className="form-control" type="time" value={newEvt.heure_fin} onChange={e => setNewEvt(n => ({...n, heure_fin: e.target.value}))} />
              </div>
              <div className="form-group col-span-2">
                <label className="form-label">Notes</label>
                <textarea className="form-control" rows={2} value={newEvt.notes} onChange={e => setNewEvt(n => ({...n, notes: e.target.value}))} placeholder="Observations..." style={{ resize:'vertical' }} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={saveEvt}>💾 Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETAIL / EDIT */}
      {showDetailModal && selectedEvt && (
        <div className="modal-overlay" onClick={() => { setShowDetailModal(false); setEditMode(false) }}>
          <div className="modal-box" style={{ maxWidth:520 }} onClick={e => e.stopPropagation()}>
            {!editMode ? (
              <>
                <div className="modal-title">{selectedEvt.titre}</div>
                {(() => {
                  const cat = CATEGORIES[selectedEvt.categorie] || CATEGORIES.autre
                  const deb = new Date(selectedEvt.date_debut)
                  const fin = selectedEvt.date_fin ? new Date(selectedEvt.date_fin) : null
                  const isParticipant = selectedEvt.participants_ids?.includes(profile?.id)
                  const isOwner = selectedEvt.af_id === profile?.id
                  return (
                    <div style={{ background:'#eef1f8', borderRadius:9, padding:14, marginBottom:14, lineHeight:2, fontSize:12 }}>
                      <div>📅 <strong>{deb.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}</strong></div>
                      <div>🕐 {deb.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' })}{fin ? ` → ${fin.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' })}` : ''}</div>
                      {fin && fin.toDateString() !== deb.toDateString() && (
                        <div>🏁 Fin : <strong>{fin.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' })}</strong> à {fin.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' })}</div>
                      )}
                      {selectedEvt.lieu && <div>📍 <strong>{selectedEvt.lieu}</strong></div>}
                      {selectedEvt.notes && <div>📝 {selectedEvt.notes}</div>}
                      <div style={{ marginTop:8, display:'flex', gap:8, flexWrap:'wrap' }}>
                        <span style={{ padding:'3px 9px', borderRadius:10, background:cat.bg, color:cat.color, fontSize:10, fontWeight:600 }}>{cat.label}</span>
                        {selectedEvt.source === 'ase_import' && <span style={{ padding:'3px 9px', borderRadius:10, background:'#e8eef8', color:'#1a4b8f', fontSize:10, fontWeight:600 }}>📥 Importé ASE</span>}
                        {isParticipant && !isOwner && <span style={{ padding:'3px 9px', borderRadius:10, background:'#fff8e1', color:'#d97706', fontSize:10, fontWeight:600 }}>🔗 Partagé avec vous</span>}
                      </div>
                    </div>
                  )
                })()}
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={() => { setShowDetailModal(false); setEditMode(false) }}>Fermer</button>
                  {selectedEvt.af_id === profile?.id && (
                    <button className="btn btn-danger" onClick={() => deleteEvt(selectedEvt.id)}>🗑 Supprimer</button>
                  )}
                  {(selectedEvt.af_id === profile?.id || selectedEvt.participants_ids?.includes(profile?.id)) && (
                    <button className="btn btn-primary" onClick={() => {
                      const deb = new Date(selectedEvt.date_debut)
                      const fin = selectedEvt.date_fin ? new Date(selectedEvt.date_fin) : deb
                      setEditEvt({
                        titre: selectedEvt.titre,
                        categorie: selectedEvt.categorie,
                        date_debut: selectedEvt.date_debut?.slice(0,10),
                        heure_debut: deb.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit', timeZone:'Europe/Paris' }),
                        date_fin: selectedEvt.date_fin?.slice(0,10),
                        heure_fin: fin.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit', timeZone:'Europe/Paris' }),
                        lieu: selectedEvt.lieu || '',
                        notes: selectedEvt.notes || '',
                        message: ''
                      })
                      setEditMode(true)
                    }}>✏️ Modifier</button>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="modal-title">✏️ Modifier — {selectedEvt.titre}</div>
                {selectedEvt.participants_ids?.includes(profile?.id) && selectedEvt.af_id !== profile?.id && (
                  <div className="alert-warn" style={{ marginBottom:12, fontSize:11 }}>
                    ⚠️ Vous êtes participant — votre modification sera soumise à validation par {selectedEvt.af_id === profile?.id ? 'vous' : 'l'AF principal(e)'}
                  </div>
                )}
                <div className="form-grid-2">
                  <div className="form-group col-span-2">
                    <label className="form-label">Titre</label>
                    <input className="form-control" value={editEvt.titre || ''} onChange={e => setEditEvt(n => ({...n, titre: e.target.value}))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Catégorie</label>
                    <select className="form-control" value={editEvt.categorie || 'autre'} onChange={e => setEditEvt(n => ({...n, categorie: e.target.value}))}>
                      {Object.entries(CATEGORIES).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Lieu</label>
                    <input className="form-control" value={editEvt.lieu || ''} onChange={e => setEditEvt(n => ({...n, lieu: e.target.value}))} placeholder="Ex: Gaillac" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Date début</label>
                    <input className="form-control" type="date" value={editEvt.date_debut || ''} onChange={e => setEditEvt(n => ({...n, date_debut: e.target.value}))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Heure début</label>
                    <input className="form-control" type="time" value={editEvt.heure_debut || ''} onChange={e => setEditEvt(n => ({...n, heure_debut: e.target.value}))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Date fin</label>
                    <input className="form-control" type="date" value={editEvt.date_fin || ''} onChange={e => setEditEvt(n => ({...n, date_fin: e.target.value}))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Heure fin</label>
                    <input className="form-control" type="time" value={editEvt.heure_fin || ''} onChange={e => setEditEvt(n => ({...n, heure_fin: e.target.value}))} />
                  </div>
                  <div className="form-group col-span-2">
                    <label className="form-label">Notes</label>
                    <textarea className="form-control" rows={2} value={editEvt.notes || ''} onChange={e => setEditEvt(n => ({...n, notes: e.target.value}))} style={{ resize:'vertical' }} />
                  </div>
                  {selectedEvt.participants_ids?.includes(profile?.id) && selectedEvt.af_id !== profile?.id && (
                    <div className="form-group col-span-2">
                      <label className="form-label">Message (optionnel)</label>
                      <input className="form-control" value={editEvt.message || ''} onChange={e => setEditEvt(n => ({...n, message: e.target.value}))} placeholder="Ex: Retard prévu, décalage horaire..." />
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={() => setEditMode(false)}>← Annuler</button>
                  <button className="btn btn-primary" onClick={saveEdit}>
                    {selectedEvt.participants_ids?.includes(profile?.id) && selectedEvt.af_id !== profile?.id
                      ? '📤 Envoyer la demande'
                      : '💾 Enregistrer'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

{/* MODAL PARTAGE */}
      {showPartageModal && (
        <div className="modal-overlay" onClick={() => setShowPartageModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-title">🔗 Partage d'agenda</div>

            {/* Demandes reçues */}
            {demandesRecues.length > 0 && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#d97706', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:8 }}>🔔 Demandes reçues</div>
                {demandesRecues.map(p => (
                  <div key={p.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 13px', background:'#fef3e2', borderRadius:9, marginBottom:6, border:'1px solid #f5dca4' }}>
                    <div style={{ flex:1, fontSize:12 }}><strong>{p.demandeur?.prenom} {p.demandeur?.nom}</strong> souhaite partager son agenda avec vous</div>
                    <button className="btn btn-success" style={{ padding:'5px 10px', fontSize:11 }} onClick={() => accepterPartage(p.id)}>✅ Accepter</button>
                  </div>
                ))}
              </div>
            )}

            {/* Partages actifs */}
            {partages.filter(p => p.statut === 'accepte').length > 0 && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#2e8b4a', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:8 }}>✅ Partages actifs</div>
                {partages.filter(p => p.statut === 'accepte').map(p => {
                  const other = p.demandeur_id === profile?.id ? p.destinataire : p.demandeur
                  return (
                    <div key={p.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 13px', background:'#e6f5eb', borderRadius:9, marginBottom:6, border:'1px solid #c4e8cc' }}>
                      <span style={{ fontSize:16 }}>👤</span>
                      <div style={{ flex:1, fontSize:12 }}><strong>{other?.prenom} {other?.nom}</strong></div>
                      <span style={{ fontSize:10, color:'#2e8b4a', fontWeight:600 }}>Actif</span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Partager avec */}
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'#5a6478', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:8 }}>Partager avec...</div>
              {collègues.filter(c => !partages.some(p => (p.demandeur_id === profile?.id && p.destinataire_id === c.id) || (p.destinataire_id === profile?.id && p.demandeur_id === c.id))).map(c => (
                <div key={c.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 13px', background:'#eef1f8', borderRadius:9, marginBottom:6, border:'1px solid #dde3f0' }}>
                  <div style={{ width:32, height:32, borderRadius:'50%', background:'#1a4b8f', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, flexShrink:0 }}>
                    {c.prenom?.[0]}{c.nom?.[0]}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12, fontWeight:600 }}>{c.prenom} {c.nom}</div>
                    <div style={{ fontSize:10, color:'#9aa3b8' }}>{c.role}{c.matricule ? ` · N° ${c.matricule}` : ''}</div>
                  </div>
                  <button className="btn btn-primary" style={{ padding:'5px 10px', fontSize:11 }} onClick={() => demanderPartage(c.id)}>📤 Demander</button>
                </div>
              ))}
              {collègues.length === 0 && <div style={{ fontSize:12, color:'#9aa3b8', textAlign:'center', padding:12 }}>Aucun collègue dans votre territoire</div>}
            </div>

            {/* Couleurs par enfant */}
            {enfants.length > 0 && (
              <div style={{ marginTop:14, borderTop:'1px solid #dde3f0', paddingTop:12 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#5a6478', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:8 }}>🎨 Couleurs des enfants dans l'agenda</div>
                {enfants.map(en => (
                  <div key={en.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', background:'#eef1f8', borderRadius:8, marginBottom:5 }}>
                    <div style={{ width:20, height:20, borderRadius:'50%', background: couleursEnfants[en.id] || '#1a4b8f', flexShrink:0 }}></div>
                    <span style={{ fontSize:12, flex:1 }}>{en.prenom} {en.nom}</span>
                    <input type="color" value={couleursEnfants[en.id] || '#1a4b8f'}
                      onChange={e => setCouleursEnfants(prev => ({ ...prev, [en.id]: e.target.value }))}
                      style={{ width:36, height:30, border:'1px solid #dde3f0', borderRadius:5, cursor:'pointer', padding:2 }} />
                  </div>
                ))}
              </div>
            )}
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowPartageModal(false)}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
