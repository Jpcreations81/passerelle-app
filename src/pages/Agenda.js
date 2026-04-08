import React, { useState, useEffect, useCallback, useMemo } from 'react'
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

const DEFCOLORS = ['#e05c5c','#2e8b4a','#d97706','#6d4c9e','#0891b2','#1a4b8f']
const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MOIS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

function getMonday(d) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(date.setDate(diff))
}
function addDays(d, n) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
function weekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dn = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dn)
  const y1 = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil((((date - y1) / 86400000) + 1) / 7)
}
function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric', timeZone:'Europe/Paris' })
}
function fmtHeure(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit', timeZone:'Europe/Paris' })
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
  const [showValidationModal, setShowValidationModal] = useState(false)
  const [selectedEvt, setSelectedEvt] = useState(null)
  const [editMode, setEditMode] = useState(false)
  const [editEvt, setEditEvt] = useState({})
  const [selectedDate, setSelectedDate] = useState(null)
  const [collegues, setCollegues] = useState([])
  const [afProfiles, setAfProfiles] = useState({})
  const [enfants, setEnfants] = useState([])
  const [couleursEnfants, setCouleursEnfants] = useState({})
  // Demandes de modif reçues (à valider) et retours sur mes demandes
  const [demandesModif, setDemandesModif] = useState([])
  const [mesRetours, setMesRetours] = useState([])
  const [refusMessages, setRefusMessages] = useState({}) // { [demande.id]: message }
  const [newEvt, setNewEvt] = useState({
    titre: '', categorie: 'vm', date_debut: '', heure_debut: '09:00',
    date_fin: '', heure_fin: '10:00', lieu: '', notes: '',
    enfantsSelectionnes: []
  })
  const [showImportModal, setShowImportModal] = useState(false)
  const [pdfFile, setPdfFile] = useState(null)
  const [pdfParsing, setPdfParsing] = useState(false)
  const [evtsImportes, setEvtsImportes] = useState([]) // événements détectés par Claude
  const [evtsImportesChecked, setEvtsImportesChecked] = useState({}) // { idx: bool }

  useEffect(() => {
    if (!profile) return
    Promise.all([
      fetchEvenements(),
      fetchPartages(),
      fetchCollegues(),
      fetchEnfants(),
      fetchDemandesModif(),
      fetchMesRetours(),
    ]).finally(() => setLoading(false))
  }, [profile])

  const fetchEvenements = useCallback(async () => {
    const { data } = await supabase
      .from('evenements').select('*').order('date_debut', { ascending: true })
    if (!data) return
    setEvenements(data)

    const allEnfantIds = []
    data.forEach(e => { if (e.enfant_ids) e.enfant_ids.forEach(id => { if (!allEnfantIds.includes(id)) allEnfantIds.push(id) }) })
    if (allEnfantIds.length > 0) {
      const { data: enf } = await supabase.from('enfants').select('id, nom, prenom').in('id', allEnfantIds)
      if (enf) {
        setEnfants(prev => {
          const merged = [...prev]
          enf.forEach(e => { if (!merged.find(x => x.id === e.id)) merged.push(e) })
          return merged
        })
        setCouleursEnfants(prev => {
          const updated = { ...prev }
          enf.forEach(en => { if (!updated[en.id]) updated[en.id] = DEFCOLORS[Object.keys(updated).length % DEFCOLORS.length] })
          return updated
        })
      }
    }

    const afIds = new Set()
    data.forEach(e => {
      if (e.categorie === 'relais') {
        if (e.af_id) afIds.add(e.af_id)
        if (e.participants_ids) e.participants_ids.forEach(id => afIds.add(id))
      }
    })
    if (afIds.size > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, nom, prenom').in('id', Array.from(afIds))
      if (profiles) {
        const profileMap = {}
        profiles.forEach(p => { profileMap[p.id] = p })
        setAfProfiles(profileMap)
      }
    }
  }, [])

  // Demandes reçues : je suis valideur_id, statut en_attente
  const fetchDemandesModif = useCallback(async () => {
    if (!profile) return
    const { data, error } = await supabase
      .from('evenements_modifications')
      .select('*, demandeur:demandeur_id(nom,prenom), evenement:evenement_id(titre,categorie,date_debut,date_fin,lieu)')
      .eq('valideur_id', profile.id)
      .eq('statut', 'en_attente')
      .order('created_at', { ascending: false })
    if (error) console.error('fetchDemandesModif error:', error)
    if (data) setDemandesModif(data)
    else setDemandesModif([])
  }, [profile])

  // Retours sur mes demandes envoyées (accepté ou refusé)
  // On cherche les 4 valeurs possibles selon la version du schéma
  const fetchMesRetours = useCallback(async () => {
    if (!profile) return
    const { data } = await supabase
      .from('evenements_modifications')
      .select('*, valideur:valideur_id(nom,prenom), evenement:evenement_id(titre)')
      .eq('demandeur_id', profile.id)
      .in('statut', ['accepte', 'refuse', 'acceptee', 'refusee'])
      .order('created_at', { ascending: false })
    if (data) {
      // Filtrer côté client les IDs déjà marqués comme lus (stockés en sessionStorage)
      const vus = JSON.parse(sessionStorage.getItem('modifs_vues') || '[]')
      setMesRetours(data.filter(d => !vus.includes(d.id)))
    }
  }, [profile])

  const fetchPartages = useCallback(async () => {
    const { data } = await supabase
      .from('agenda_partages')
      .select('*, demandeur:demandeur_id(nom,prenom), destinataire:destinataire_id(nom,prenom)')
    if (data) setPartages(data)
  }, [])

  const fetchCollegues = useCallback(async () => {
    if (!profile) return
    const { data } = await supabase
      .from('profiles').select('id, nom, prenom, role, matricule')
      .neq('id', profile.id).eq('territoire', profile.territoire)
    if (data) setCollegues(data)
  }, [profile])

  const fetchEnfants = useCallback(async () => {
    if (!profile) return
    const isASE = ['referent','encadrant','rtase','admin'].includes(profile.role)

    let tous = []

    if (isASE) {
      // Référent/encadrant/RTASE → charger TOUS les enfants du territoire avec leur AF
      const { data } = await supabase
        .from('enfants')
        .select('id, nom, prenom, af_principal_id, af_principal:af_principal_id(id, nom, prenom)')
        .eq('territoire_id', profile.territoire)
      if (data) tous = data
      // Fallback si pas de territoire_id : charger via les AFs du territoire
      if (!tous.length) {
        const { data: afs } = await supabase
          .from('profiles')
          .select('id')
          .eq('territoire', profile.territoire)
          .eq('role', 'af')
        if (afs && afs.length > 0) {
          const afIds = afs.map(a => a.id)
          const { data: enfs } = await supabase
            .from('enfants')
            .select('id, nom, prenom, af_principal_id, af_principal:af_principal_id(id, nom, prenom)')
            .in('af_principal_id', afIds)
          if (enfs) tous = enfs
        }
      }
    } else {
      // AF → ses enfants principaux + enfants relais
      const { data: enfantsPrincipaux } = await supabase
        .from('enfants')
        .select('id, nom, prenom, af_principal_id')
        .eq('af_principal_id', profile.id)

      const { data: evtsRelaisParticipant } = await supabase
        .from('evenements').select('enfant_ids').contains('participants_ids', [profile.id]).eq('categorie', 'relais')
      const { data: evtsRelaisProprio } = await supabase
        .from('evenements').select('enfant_ids').eq('af_id', profile.id).eq('categorie', 'relais')

      const idsRelais = []
      const ajouterIds = (evts) => {
        if (evts) evts.forEach(evt => {
          if (evt.enfant_ids) evt.enfant_ids.forEach(id => { if (!idsRelais.includes(id)) idsRelais.push(id) })
        })
      }
      ajouterIds(evtsRelaisParticipant)
      ajouterIds(evtsRelaisProprio)

      let enfantsRelais = []
      if (idsRelais.length > 0) {
        const { data } = await supabase
          .from('enfants')
          .select('id, nom, prenom, af_principal_id')
          .in('id', idsRelais)
        if (data) enfantsRelais = data
      }

      tous = [...(enfantsPrincipaux || [])]
      enfantsRelais.forEach(e => { if (!tous.find(x => x.id === e.id)) tous.push(e) })
    }

    setEnfants(tous)
    const couleurs = {}
    tous.forEach((en, i) => { couleurs[en.id] = DEFCOLORS[i % DEFCOLORS.length] })
    setCouleursEnfants(couleurs)
  }, [profile])

  // ── Accepter une demande ──────────────────────────────────────────────────
  async function accepterModif(demande) {
    const nv = demande.nouvelles_valeurs

    // 1. Mettre à jour l'événement avec les nouvelles valeurs
    const { error: errEvt } = await supabase.from('evenements').update({
      titre: nv.titre, date_debut: nv.date_debut, date_fin: nv.date_fin,
      lieu: nv.lieu, notes: nv.notes,
    }).eq('id', demande.evenement_id)
    if (errEvt) { showToast('❌ Erreur : ' + errEvt.message); return }

    // 2. Marquer la demande comme acceptée
    // Le schéma check autorise 'acceptee' — on essaie les deux valeurs pour compatibilité
    let { error: e1 } = await supabase.from('evenements_modifications')
      .update({ statut: 'acceptee' }).eq('id', demande.id)
    if (e1) {
      await supabase.from('evenements_modifications')
        .update({ statut: 'accepte' }).eq('id', demande.id)
    }

    // 3. Retirer immédiatement du state local sans attendre le refetch
    setDemandesModif(prev => prev.filter(d => d.id !== demande.id))
    showToast('✅ Modification acceptée !')
    fetchEvenements()
  }

  // ── Refuser une demande ───────────────────────────────────────────────────
  async function refuserModif(demande) {
    const motif = (refusMessages[demande.id] || '').trim()
    if (!motif) { showToast("⚠️ Merci d\'indiquer une raison de refus"); return }

    // Le schéma check autorise 'refusee' — on essaie les deux valeurs pour compatibilité
    let { error: e1 } = await supabase.from('evenements_modifications')
      .update({ statut: 'refusee', message_refus: motif }).eq('id', demande.id)
    if (e1) {
      await supabase.from('evenements_modifications')
        .update({ statut: 'refuse', message_refus: motif }).eq('id', demande.id)
    }

    // Retirer immédiatement du state local
    setDemandesModif(prev => prev.filter(d => d.id !== demande.id))
    setRefusMessages(prev => { const r = {...prev}; delete r[demande.id]; return r })
    showToast('❌ Modification refusée')
  }

  // ── Marquer mes retours comme lus ─────────────────────────────────────────
  function marquerLu(ids) {
    // Stocker les IDs vus en sessionStorage (pas de dépendance à la colonne Supabase)
    const vus = JSON.parse(sessionStorage.getItem('modifs_vues') || '[]')
    const nouveauxVus = [...new Set([...vus, ...ids])]
    sessionStorage.setItem('modifs_vues', JSON.stringify(nouveauxVus))
    // Vider immédiatement le state
    setMesRetours([])
    // Tentative silencieuse de màj Supabase (si la colonne existe)
    supabase.from('evenements_modifications')
      .update({ vu_par_demandeur: true }).in('id', ids).then(() => {})
  }

  async function saveEdit() {
    if (!editEvt.titre) { showToast('⚠️ Titre requis'); return }
    const hDeb = editEvt.heure_debut?.slice(0,5) || '00:00'
    const hFin = editEvt.heure_fin?.slice(0,5) || '00:00'
    const debut = new Date(`${editEvt.date_debut}T${hDeb}:00`)
    const fin = new Date(`${editEvt.date_fin}T${hFin}:00`)

    if (selectedEvt.af_id !== profile?.id && selectedEvt.participants_ids?.includes(profile?.id)) {
      const { error } = await supabase.from('evenements_modifications').insert({
        evenement_id: selectedEvt.id,
        demandeur_id: profile.id,
        valideur_id: selectedEvt.af_id,
        anciennes_valeurs: { titre: selectedEvt.titre, date_debut: selectedEvt.date_debut, date_fin: selectedEvt.date_fin, lieu: selectedEvt.lieu, notes: selectedEvt.notes },
        nouvelles_valeurs: { titre: editEvt.titre, date_debut: debut.toISOString(), date_fin: fin.toISOString(), lieu: editEvt.lieu, notes: editEvt.notes },
        statut: 'en_attente',
        message: editEvt.message || '',
        vu_par_demandeur: false,
      })
      if (!error) {
        showToast('📤 Demande envoyée — en attente de validation')
        setEditMode(false); setShowDetailModal(false); fetchEvenements()
      } else showToast('❌ Erreur')
    } else {
      const { error } = await supabase.from('evenements').update({
        titre: editEvt.titre, categorie: editEvt.categorie,
        date_debut: debut.toISOString(), date_fin: fin.toISOString(),
        lieu: editEvt.lieu, notes: editEvt.notes,
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
      if (prev.includes(f)) { const r = without.filter(x => x !== f); return r.length === 0 ? ['tous'] : r }
      return [...without, f]
    })
  }

  function evtsFiltres() {
    if (filtres.includes('tous')) return evenements
    return evenements.filter(e => filtres.includes(e.categorie))
  }

  const buildEvtsDuJour = useMemo(() => {
    return (date) => {
      const filtered = evtsFiltres().filter(e => {
        const d = new Date(e.date_debut), f = e.date_fin ? new Date(e.date_fin) : d
        const dDate = new Date(date); dDate.setHours(0,0,0,0)
        const fDate = new Date(f); fDate.setHours(23,59,59,999)
        return dDate >= new Date(new Date(d).setHours(0,0,0,0)) && dDate <= fDate
      })
      const expanded = []
      filtered.forEach(evt => {
        const baseColor = (CATEGORIES[evt.categorie] || CATEGORIES.autre).color
        if (evt.enfant_ids && evt.enfant_ids.length > 0) {
          evt.enfant_ids.forEach((enfantId, idx) => {
            const enfant = enfants.find(e => e.id === enfantId)
            const couleur = couleursEnfants[enfantId] || DEFCOLORS[idx % DEFCOLORS.length]
            const enfantPrenom = enfant ? enfant.prenom : ''
            let titrePOV = evt.titre
            if (evt.categorie === 'relais') {
              if (evt.af_id === profile?.id) {
                const afRelais = afProfiles[evt.participants_ids?.[0]]
                titrePOV = (enfantPrenom ? enfantPrenom + ' — ' : '') + (afRelais ? 'Relais fam. ' + afRelais.nom : evt.titre)
              } else if (evt.participants_ids?.includes(profile?.id)) {
                const afPrincipal = afProfiles[evt.af_id]
                titrePOV = (enfantPrenom ? enfantPrenom + ' — ' : '') + (afPrincipal ? 'Relais fam. ' + afPrincipal.nom : evt.titre)
              } else {
                titrePOV = (enfantPrenom ? enfantPrenom + ' — ' : '') + evt.titre
              }
            } else {
              titrePOV = enfantPrenom ? enfantPrenom + ' — ' + evt.titre : evt.titre
            }
            expanded.push({ ...evt, _enfantId: enfantId, _enfantNom: enfant ? enfant.prenom + ' ' + enfant.nom : '', _couleur: couleur, _titrePOV: titrePOV })
          })
        } else {
          let titrePOV = evt.titre
          if (evt.categorie === 'relais') {
            if (evt.af_id === profile?.id) {
              const afRelais = afProfiles[evt.participants_ids?.[0]]
              if (afRelais) titrePOV = 'Relais fam. ' + afRelais.nom
            } else if (evt.participants_ids?.includes(profile?.id)) {
              const afPrincipal = afProfiles[evt.af_id]
              if (afPrincipal) titrePOV = 'Relais fam. ' + afPrincipal.nom
            }
          }
          expanded.push({ ...evt, _couleur: baseColor, _titrePOV: titrePOV })
        }
      })
      return expanded
    }
  }, [evenements, enfants, couleursEnfants, afProfiles, filtres, profile])

  function evtsDuJour(date) { return buildEvtsDuJour(date) }

  async function saveEvt() {
    if (!newEvt.titre || !newEvt.date_debut) { showToast('⚠️ Titre et date requis'); return }
    const debut = new Date(`${newEvt.date_debut}T${newEvt.heure_debut}:00`)
    const fin = new Date(`${(newEvt.date_fin || newEvt.date_debut)}T${newEvt.heure_fin}:00`)
    const isPersonnel = newEvt.categorie === 'personnel'

    // Si personnel ou aucun enfant sélectionné → 1 seul événement sans enfant
    const enfantsACree = (!isPersonnel && newEvt.enfantsSelectionnes.length > 0)
      ? newEvt.enfantsSelectionnes
      : [null]

    const rows = enfantsACree.map(enfantId => ({
      titre: newEvt.titre,
      categorie: newEvt.categorie,
      date_debut: debut.toISOString(),
      date_fin: fin.toISOString(),
      lieu: newEvt.lieu,
      notes: newEvt.notes,
      af_id: profile.id,
      cree_par: profile.id,
      visible_ase: !isPersonnel,
      source: 'passerelle',
      ...(enfantId ? { enfant_ids: [enfantId] } : {})
    }))

    const { error } = await supabase.from('evenements').insert(rows)
    if (!error) {
      const nb = enfantsACree.filter(Boolean).length
      showToast(nb > 1 ? `✅ ${nb} événements créés (1 par enfant) !` : '✅ Événement enregistré !')
      setShowModal(false)
      setNewEvt({ titre:'', categorie:'vm', date_debut:'', heure_debut:'09:00', date_fin:'', heure_fin:'10:00', lieu:'', notes:'', enfantsSelectionnes:[] })
      fetchEvenements()
    } else showToast('❌ Erreur : ' + error.message)
  }

  // ── Import PDF : envoyer à la Vercel Function parse-pdf ─────────────────
  async function parsePDF(file) {
    setPdfParsing(true)
    try {
      const base64 = await new Promise((res, rej) => {
        const reader = new FileReader()
        reader.onload = () => res(reader.result.split(',')[1])
        reader.onerror = rej
        reader.readAsDataURL(file)
      })
      const resp = await fetch('/api/parse-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdf: base64, filename: file.name })
      })
      if (!resp.ok) throw new Error('Erreur serveur ' + resp.status)
      const data = await resp.json()
      if (data.evenements && data.evenements.length > 0) {
        // Mapper enfants_noms → enfant_ids puis dupliquer : 1 ligne par enfant
        const evtsExpanded = []
        for (const evt of data.evenements) {
          // Construire les notes avec infos TISF
          let notes = evt.notes || ''
          if (evt.tisf_debut && evt.tisf_fin) {
            notes = notes ? `${notes} · TISF : ${evt.tisf_debut} → ${evt.tisf_fin}` : `TISF : ${evt.tisf_debut} → ${evt.tisf_fin}`
          } else if (evt.tisf_debut || evt.tisf_fin) {
            notes = notes ? `${notes} · TISF présente` : 'TISF présente'
          }

          // Chercher la famille relais dans TOUS les profiles AF (tous territoires)
          let participantsIds = []
          let relaisLabel = null
          if (evt.relais_nom && evt.categorie === 'relais') {
            const relaisNomLower = evt.relais_nom.toLowerCase().trim()
            const relaisParts = relaisNomLower.split(' ').filter(p => p.length > 2)
            // Chercher dans afProfiles (chargés depuis Supabase pour tous les relais)
            const allProfiles = Object.values(afProfiles)
            const relaisProfile = allProfiles.find(c => {
              const cNomLower = c.nom.toLowerCase().trim()
              const cPrenomLower = c.prenom.toLowerCase().trim()
              return relaisParts.some(part =>
                cNomLower.includes(part) || part.includes(cNomLower) ||
                cPrenomLower.includes(part) || part.includes(cPrenomLower)
              )
            })
            if (relaisProfile) {
              participantsIds = [relaisProfile.id]
              relaisLabel = `${relaisProfile.prenom} ${relaisProfile.nom}`
            } else {
              // Non trouvé en mémoire → recherche Supabase sur tous les territoires
              const nomParts = relaisParts.filter(p => p.length > 2)
              if (nomParts.length > 0) {
                const { data: foundProfiles } = await supabase
                  .from('profiles')
                  .select('id, nom, prenom')
                  .eq('role', 'af')
                  .or(nomParts.map(p => `nom.ilike.%${p}%`).join(','))
                if (foundProfiles && foundProfiles.length > 0) {
                  participantsIds = [foundProfiles[0].id]
                  relaisLabel = `${foundProfiles[0].prenom} ${foundProfiles[0].nom}`
                } else {
                  // Vraiment introuvable → garder en note pour liaison manuelle
                  relaisLabel = evt.relais_nom
                  notes = notes ? `${notes} · ⚠️ Famille relais à lier : ${evt.relais_nom}` : `⚠️ Famille relais à lier : ${evt.relais_nom}`
                }
              }
            }
          }

          // Trouver les enfants correspondants — matching robuste
          const ids = []
          if (evt.enfants_noms && evt.enfants_noms.length > 0) {
            evt.enfants_noms.forEach(nom => {
              const nomLower = nom.toLowerCase().trim()
              const parts = nomLower.split(/\s+/) // ["lou", "pereira"]
              const enf = enfants.find(e => {
                const prenomLower = e.prenom.toLowerCase().trim()
                const nomFamilleLower = e.nom.toLowerCase().trim()
                const fullLower = `${prenomLower} ${nomFamilleLower}`
                const fullInverse = `${nomFamilleLower} ${prenomLower}`
                return (
                  fullLower === nomLower ||
                  fullInverse === nomLower ||
                  parts.includes(prenomLower) ||
                  nomLower.includes(prenomLower)
                )
              })
              if (enf && !ids.includes(enf.id)) ids.push(enf.id)
            })
          }

          // Dupliquer : 1 événement par enfant trouvé
          if (ids.length > 0) {
            ids.forEach(enfantId => {
              const enf = enfants.find(e => e.id === enfantId)
              // Si référent/ASE : af_id = AF principal de l'enfant
              // Si AF : af_id = profile.id (soi-même)
              const isASE = ['referent','encadrant','rtase','admin'].includes(profile?.role)
              const afId = isASE && enf?.af_principal_id ? enf.af_principal_id : profile.id
              const afLabel = isASE && enf?.af_principal
                ? `${enf.af_principal.prenom} ${enf.af_principal.nom}`
                : null
              evtsExpanded.push({
                ...evt,
                enfant_ids: [enfantId],
                participants_ids: participantsIds,
                _af_id: afId,
                notes,
                _enfantLabel: enf ? `${enf.prenom} ${enf.nom}` : '',
                _afLabel: afLabel,
                _relaisLabel: relaisLabel
              })
            })
          } else {
            // Enfant non reconnu — créer l'événement sans enfant
            evtsExpanded.push({
              ...evt,
              enfant_ids: [],
              participants_ids: participantsIds,
              _af_id: profile.id,
              notes,
              _enfantLabel: '',
              _afLabel: null,
              _relaisLabel: relaisLabel
            })
          }
        }

        setEvtsImportes(evtsExpanded)
        // Cocher tous par défaut
        const checked = {}
        evtsExpanded.forEach((_, i) => { checked[i] = true })
        setEvtsImportesChecked(checked)
      } else {
        showToast('⚠️ Aucun événement détecté dans ce PDF')
      }
    } catch(e) {
      showToast('❌ Erreur lors de la lecture du PDF : ' + e.message)
    } finally {
      setPdfParsing(false)
    }
  }

  // ── Valider les événements importés ─────────────────────────────────────
  async function saveEvtsImportes(pdfDocumentId) {
    const selectionnes = evtsImportes.filter((_, i) => evtsImportesChecked[i] !== false)
    if (selectionnes.length === 0) { showToast('⚠️ Aucun événement sélectionné'); return }

    // Créer 1 row par événement sélectionné
    // _af_id = AF principal de l'enfant (si référent) ou profile.id (si AF)
    const rows = selectionnes.map(evt => ({
      titre: evt.titre,
      categorie: evt.categorie || 'vm',
      date_debut: evt.date_debut,
      date_fin: evt.date_fin,
      lieu: evt.lieu || '',
      notes: evt.notes || '',
      af_id: evt._af_id || profile.id,
      cree_par: profile.id,
      visible_ase: true,
      source: 'pdf_import',
      ...(evt.enfant_ids && evt.enfant_ids.length > 0 ? { enfant_ids: evt.enfant_ids } : {}),
      ...(evt.participants_ids && evt.participants_ids.length > 0 ? { participants_ids: evt.participants_ids } : {})
    }))

    const { error } = await supabase.from('evenements').insert(rows)
    if (!error) {
      showToast(`✅ ${rows.length} événement${rows.length > 1 ? 's' : ''} importé${rows.length > 1 ? 's' : ''} !`)
      setShowImportModal(false)
      setEvtsImportes([])
      setEvtsImportesChecked({})
      setPdfFile(null)
      fetchEvenements()
    } else showToast('❌ Erreur : ' + error.message)
  }

  // ── Upload PDF dans Supabase Storage + lancer le parsing ────────────────
  async function handlePDFUpload(file) {
    if (!file || file.type !== 'application/pdf') { showToast('⚠️ Fichier PDF requis'); return }
    setPdfFile(file)
    setEvtsImportes([])
    await parsePDF(file)
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

  function prev() {
    if (vue === 'mois') setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
    else if (vue === 'sem') setCurrentDate(d => addDays(d, -7))
    else setCurrentDate(d => addDays(d, -1))
  }
  function next() {
    if (vue === 'mois') setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))
    else if (vue === 'sem') setCurrentDate(d => addDays(d, 7))
    else setCurrentDate(d => addDays(d, 1))
  }

  function periodLabel() {
    if (vue === 'mois') return `${MOIS[currentDate.getMonth()]} ${currentDate.getFullYear()}`
    if (vue === 'sem') {
      const mon = getMonday(currentDate), sun = addDays(mon, 6)
      return `Semaine ${weekNumber(mon)} · ${mon.getDate()} – ${sun.getDate()} ${MOIS[sun.getMonth()]} ${sun.getFullYear()}`
    }
    return currentDate.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' })
  }

  function openEvt(evt, e) { e?.stopPropagation(); setSelectedEvt(evt); setShowDetailModal(true) }
  function openAdd(date) {
    setSelectedDate(date)
    setNewEvt(n => ({ ...n, date_debut: date ? date.toISOString().slice(0,10) : '', date_fin: date ? date.toISOString().slice(0,10) : '' }))
    setShowModal(true)
  }

  // ── RENDU VUE MOIS ────────────────────────────────────────────────────────
  function renderMois() {
    const year = currentDate.getFullYear(), month = currentDate.getMonth()
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
      const isToday = sameDay(d, today), isOther = d.getMonth() !== month, isWE = d.getDay() === 0 || d.getDay() === 6
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
            return (
              <div key={ei} onClick={e => openEvt(ev, e)}
                style={{ fontSize:9, padding:'2px 5px', borderRadius:3, marginBottom:2, background: ev._couleur || cat.color, color:'#fff', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', cursor:'pointer', fontWeight:500 }}>
                {ev._titrePOV || ev.titre}
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
        <div style={{ display:'grid', gridTemplateColumns:'32px repeat(7,1fr)' }}>{cells}</div>
      </div>
    )
  }

  // ── RENDU VUE SEMAINE ─────────────────────────────────────────────────────
  function renderSemaine() {
    const mon = getMonday(currentDate)
    const days = Array.from({length:7}, (_, i) => addDays(mon, i))
    const today = new Date()
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
                    const wColor = ev._couleur || (CATEGORIES[ev.categorie] || CATEGORIES.autre).color
                    return <div key={ei} onClick={e => openEvt(ev, e)} style={{ fontSize:9, padding:'2px 6px', borderRadius:3, background:wColor, color:'#fff', cursor:'pointer', fontWeight:500, maxWidth:90, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ev._titrePOV || ev.titre}</div>
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
        <div style={{ padding:14, textAlign:'center', color:'#9aa3b8', fontSize:12 }}>Cliquez sur un événement pour voir les détails</div>
      </div>
    )
  }

  // ── RENDU VUE JOUR ────────────────────────────────────────────────────────
  function renderJour() {
    const evts = evtsDuJour(currentDate)
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
          evts.map((ev, idx) => {
            const cat = CATEGORIES[ev.categorie] || CATEGORIES.autre
            const deb = new Date(ev.date_debut)
            const fin = ev.date_fin ? new Date(ev.date_fin) : null
            return (
              <div key={`${ev.id}-${idx}`} onClick={e => openEvt(ev, e)}
                style={{ display:'flex', gap:12, padding:'12px 16px', borderBottom:'1px solid #dde3f0', cursor:'pointer', borderLeft:`4px solid ${ev._couleur || cat.color}`, transition:'all .15s' }}
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
                    {ev._titrePOV || ev.titre}
                  </div>
                  <div style={{ fontSize:10, color:'#9aa3b8', marginTop:3 }}>
                    {ev.lieu && `📍 ${ev.lieu}`}
                    {ev.notes && ` · ${ev.notes.slice(0,60)}${ev.notes.length > 60 ? '...' : ''}`}
                  </div>
                  <span style={{ fontSize:10, padding:'2px 7px', borderRadius:10, background:cat.bg, color:cat.color, fontWeight:600, marginTop:5, display:'inline-block' }}>{cat.label}</span>
                </div>
                <span style={{ fontSize:16, color:'#9aa3b8' }}>›</span>
              </div>
            )
          })
        )}
      </div>
    )
  }

  const demandesPartageRecues = partages.filter(p => p.destinataire_id === profile?.id && p.statut === 'en_attente')

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
            {/* Notif : demandes de modif à valider */}
            {demandesModif.length > 0 && (
              <button className="btn btn-warning" onClick={() => setShowValidationModal(true)}>
                ✏️ {demandesModif.length} modif{demandesModif.length > 1 ? 's' : ''} à valider
              </button>
            )}
            {/* Notif : retours sur mes demandes */}
            {mesRetours.length > 0 && (
              <button className="btn" style={{ background:'#e6f5eb', color:'#2e8b4a', border:'1px solid #c4e8cc' }}
                onClick={() => setShowValidationModal(true)}>
                🔔 {mesRetours.length} réponse{mesRetours.length > 1 ? 's' : ''}
              </button>
            )}
            {demandesPartageRecues.length > 0 && (
              <button className="btn btn-warning" onClick={() => setShowPartageModal(true)}>
                🔔 {demandesPartageRecues.length} demande{demandesPartageRecues.length > 1 ? 's' : ''} partage
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
                style={{ padding:'5px 12px', borderRadius:20, border:`1.5px solid ${filtres.includes(k) ? c : '#dde3f0'}`, background: filtres.includes(k) ? bg : '#fff', fontSize:11, fontWeight: filtres.includes(k) ? 600 : 500, cursor:'pointer', color: filtres.includes(k) ? c : '#5a6478', fontFamily:'Sora,sans-serif', transition:'all .15s' }}>
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

          {/* Vue calendrier */}
          {loading ? <div className="loading-spinner">⏳ Chargement...</div> :
            vue === 'mois' ? renderMois() :
            vue === 'sem' ? renderSemaine() :
            renderJour()
          }
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL VALIDATION MODIFICATIONS
      ══════════════════════════════════════════════════════════════════════ */}
      {showValidationModal && (
        <div className="modal-overlay" onClick={() => { setShowValidationModal(false); setRefusMessages({}) }}>
          <div className="modal-box" style={{ maxWidth:620 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">✏️ Modifications d'agenda</div>

            {/* ── À VALIDER ── */}
            {demandesModif.length > 0 && (
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#d97706', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:10 }}>
                  🔔 Demandes à valider ({demandesModif.length})
                </div>
                {demandesModif.map(d => {
                  const av = d.anciennes_valeurs || {}, nv = d.nouvelles_valeurs || {}
                  return (
                    <div key={d.id} style={{ background:'#fef3e2', border:'1px solid #f5dca4', borderRadius:10, padding:14, marginBottom:12 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                        <div style={{ width:34, height:34, borderRadius:'50%', background:'#d97706', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, flexShrink:0 }}>
                          {d.demandeur?.prenom?.[0]}{d.demandeur?.nom?.[0]}
                        </div>
                        <div>
                          <div style={{ fontSize:13, fontWeight:700 }}>{d.demandeur?.prenom} {d.demandeur?.nom}</div>
                          <div style={{ fontSize:11, color:'#9aa3b8' }}>demande à modifier · <em>{d.evenement?.titre}</em></div>
                        </div>
                      </div>

                      {/* Avant / Après */}
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
                        <div style={{ background:'#fff', borderRadius:8, padding:10, border:'1px solid #dde3f0' }}>
                          <div style={{ fontSize:10, fontWeight:700, color:'#e05c5c', marginBottom:6, textTransform:'uppercase', letterSpacing:'.3px' }}>Avant</div>
                          <div style={{ fontSize:11, lineHeight:1.8, color:'#5a6478' }}>
                            <div>📝 {av.titre || '—'}</div>
                            <div>📅 {av.date_debut ? fmtDate(av.date_debut) : '—'}</div>
                            <div>🕐 {av.date_debut ? fmtHeure(av.date_debut) : '—'}{av.date_fin ? ' → ' + fmtHeure(av.date_fin) : ''}</div>
                            {av.lieu && <div>📍 {av.lieu}</div>}
                          </div>
                        </div>
                        <div style={{ background:'#e6f5eb', borderRadius:8, padding:10, border:'1px solid #c4e8cc' }}>
                          <div style={{ fontSize:10, fontWeight:700, color:'#2e8b4a', marginBottom:6, textTransform:'uppercase', letterSpacing:'.3px' }}>Après</div>
                          <div style={{ fontSize:11, lineHeight:1.8 }}>
                            <div style={{ fontWeight: nv.titre !== av.titre ? 700 : 400, color: nv.titre !== av.titre ? '#1c2333' : '#5a6478' }}>📝 {nv.titre || '—'}</div>
                            <div style={{ fontWeight: nv.date_debut !== av.date_debut ? 700 : 400, color: nv.date_debut !== av.date_debut ? '#1c2333' : '#5a6478' }}>📅 {nv.date_debut ? fmtDate(nv.date_debut) : '—'}</div>
                            <div style={{ fontWeight: nv.date_debut !== av.date_debut ? 700 : 400, color: nv.date_debut !== av.date_debut ? '#1c2333' : '#5a6478' }}>🕐 {nv.date_debut ? fmtHeure(nv.date_debut) : '—'}{nv.date_fin ? ' → ' + fmtHeure(nv.date_fin) : ''}</div>
                            {nv.lieu && <div style={{ fontWeight: nv.lieu !== av.lieu ? 700 : 400, color: nv.lieu !== av.lieu ? '#1c2333' : '#5a6478' }}>📍 {nv.lieu}</div>}
                          </div>
                        </div>
                      </div>

                      {/* Message du demandeur */}
                      {d.message && (
                        <div style={{ background:'#fff8e1', borderRadius:7, padding:'8px 11px', fontSize:11, marginBottom:10, border:'1px solid #f5dca4', color:'#5a6478' }}>
                          💬 <em>"{d.message}"</em>
                        </div>
                      )}

                      {/* Champ motif de refus — 1 par demande */}
                      <input className="form-control" style={{ marginBottom:8, fontSize:11 }}
                        placeholder="Motif de refus (obligatoire si refus)..."
                        value={refusMessages[d.id] || ''}
                        onChange={e => setRefusMessages(prev => ({ ...prev, [d.id]: e.target.value }))}
                      />

                      <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                        <button className="btn btn-danger" style={{ fontSize:11, padding:'7px 14px' }} onClick={() => refuserModif(d)}>❌ Refuser</button>
                        <button className="btn btn-success" style={{ fontSize:11, padding:'7px 14px' }} onClick={() => accepterModif(d)}>✅ Accepter</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* ── RETOURS SUR MES DEMANDES ── */}
            {mesRetours.length > 0 && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#1a4b8f', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:10 }}>
                  📬 Réponses à mes demandes ({mesRetours.length})
                </div>
                {mesRetours.map(d => (
                  <div key={d.id} style={{
                    background: ['accepte','acceptee'].includes(d.statut) ? '#e6f5eb' : '#fdf0ee',
                    border: `1px solid ${['accepte','acceptee'].includes(d.statut) ? '#c4e8cc' : '#f5c4c4'}`,
                    borderRadius:10, padding:14, marginBottom:8
                  }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                      <span style={{ fontSize:22 }}>{['accepte','acceptee'].includes(d.statut) ? '✅' : '❌'}</span>
                      <div>
                        <div style={{ fontSize:13, fontWeight:700 }}>
                          {['accepte','acceptee'].includes(d.statut) ? 'Modification acceptée' : 'Modification refusée'}
                          {' '}— <em>{d.evenement?.titre}</em>
                        </div>
                        <div style={{ fontSize:11, color:'#9aa3b8' }}>par {d.valideur?.prenom} {d.valideur?.nom}</div>
                      </div>
                    </div>
                    {['refuse','refusee'].includes(d.statut) && d.message_refus && (
                      <div style={{ background:'#fff', borderRadius:7, padding:'7px 11px', fontSize:11, border:'1px solid #f5c4c4', color:'#5a6478' }}>
                        💬 <em>"{d.message_refus}"</em>
                      </div>
                    )}
                  </div>
                ))}
                <button className="btn btn-secondary" style={{ width:'100%', fontSize:11, marginTop:4 }}
                  onClick={() => marquerLu(mesRetours.map(d => d.id))}>
                  ✓ Marquer tout comme lu
                </button>
              </div>
            )}

            {demandesModif.length === 0 && mesRetours.length === 0 && (
              <div style={{ textAlign:'center', color:'#9aa3b8', padding:28, fontSize:13 }}>Aucune notification en cours</div>
            )}

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setShowValidationModal(false); setRefusMessages({}) }}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL AJOUTER — refonte avec sélection enfants + import PDF
      ══════════════════════════════════════════════════════════════════════ */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box" style={{ maxWidth:560 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">+ Nouvel événement</div>

            {/* Bouton import PDF */}
            {newEvt.categorie !== 'personnel' && (
              <div style={{ marginBottom:14, padding:'10px 14px', background:'#e8eef8', borderRadius:9, border:'1px solid #c4d4f5', display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:18 }}>📄</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:'#1a4b8f' }}>Importer depuis un PDF</div>
                  <div style={{ fontSize:10, color:'#5a6478' }}>Calendrier ASE, convocation TJ, courrier médical...</div>
                </div>
                <button className="btn btn-primary" style={{ fontSize:11, padding:'6px 12px' }}
                  onClick={() => { setShowModal(false); setShowImportModal(true) }}>
                  📥 Importer
                </button>
              </div>
            )}

            <div className="form-grid-2">
              <div className="form-group col-span-2">
                <label className="form-label">Titre</label>
                <input className="form-control" value={newEvt.titre} onChange={e => setNewEvt(n => ({...n, titre: e.target.value}))} placeholder="Ex: VM — Marssac/Tarn" />
              </div>
              <div className="form-group">
                <label className="form-label">Catégorie</label>
                <select className="form-control" value={newEvt.categorie} onChange={e => setNewEvt(n => ({...n, categorie: e.target.value, enfantsSelectionnes: e.target.value === 'personnel' ? [] : n.enfantsSelectionnes}))}>
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

              {/* Sélection enfants — masqué si personnel */}
              {newEvt.categorie !== 'personnel' && enfants.length > 0 && (
                <div className="form-group col-span-2">
                  <label className="form-label">Enfant(s) concerné(s)</label>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:4 }}>
                    {enfants.map(en => {
                      const checked = newEvt.enfantsSelectionnes.includes(en.id)
                      const couleur = couleursEnfants[en.id] || '#1a4b8f'
                      return (
                        <div key={en.id}
                          onClick={() => setNewEvt(n => ({
                            ...n,
                            enfantsSelectionnes: checked
                              ? n.enfantsSelectionnes.filter(id => id !== en.id)
                              : [...n.enfantsSelectionnes, en.id]
                          }))}
                          style={{ display:'flex', alignItems:'center', gap:7, padding:'6px 12px', borderRadius:20, cursor:'pointer', border:`2px solid ${checked ? couleur : '#dde3f0'}`, background: checked ? couleur : '#fff', color: checked ? '#fff' : '#5a6478', fontSize:12, fontWeight:600, transition:'all .15s', userSelect:'none' }}>
                          <span>{checked ? '✓' : '○'}</span>
                          {en.prenom} {en.nom}
                        </div>
                      )
                    })}
                  </div>
                  {newEvt.enfantsSelectionnes.length > 1 && (
                    <div style={{ fontSize:10, color:'#d97706', marginTop:6, fontWeight:600 }}>
                      ⚠️ {newEvt.enfantsSelectionnes.length} événements séparés seront créés (1 par enfant)
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={saveEvt}>
                💾 {newEvt.enfantsSelectionnes.length > 1 ? `Créer ${newEvt.enfantsSelectionnes.length} événements` : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL IMPORT PDF
      ══════════════════════════════════════════════════════════════════════ */}
      {showImportModal && (
        <div className="modal-overlay" onClick={() => { if (!pdfParsing) { setShowImportModal(false); setEvtsImportes([]); setPdfFile(null) } }}>
          <div className="modal-box" style={{ maxWidth:680 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">📄 Import PDF — Calendrier ASE</div>

            {/* Zone upload */}
            {!pdfFile && !pdfParsing && evtsImportes.length === 0 && (
              <div
                style={{ border:'2px dashed #c4d4f5', borderRadius:12, padding:32, textAlign:'center', cursor:'pointer', background:'#f4f6fb', marginBottom:14 }}
                onClick={() => document.getElementById('pdf-upload-input').click()}
                onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor='#1a4b8f' }}
                onDragLeave={e => { e.currentTarget.style.borderColor='#c4d4f5' }}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handlePDFUpload(f) }}
              >
                <div style={{ fontSize:36, marginBottom:8 }}>📄</div>
                <div style={{ fontSize:14, fontWeight:700, color:'#1a4b8f', marginBottom:4 }}>Glissez votre PDF ici</div>
                <div style={{ fontSize:12, color:'#9aa3b8', marginBottom:12 }}>ou cliquez pour sélectionner</div>
                <div style={{ fontSize:11, color:'#9aa3b8' }}>Calendrier de VM · Convocation TJ · Courrier médical · ...</div>
                <input id="pdf-upload-input" type="file" accept=".pdf" style={{ display:'none' }}
                  onChange={e => { if (e.target.files[0]) handlePDFUpload(e.target.files[0]) }} />
              </div>
            )}

            {/* Parsing en cours */}
            {pdfParsing && (
              <div style={{ textAlign:'center', padding:40 }}>
                <div style={{ fontSize:36, marginBottom:12 }}>🔍</div>
                <div style={{ fontSize:14, fontWeight:700, color:'#1a4b8f', marginBottom:6 }}>Analyse du PDF en cours...</div>
                <div style={{ fontSize:12, color:'#9aa3b8' }}>Claude lit le document et extrait les événements</div>
                <div className="loading-spinner" style={{ marginTop:16 }}>⏳</div>
              </div>
            )}

            {/* Aperçu des événements détectés */}
            {evtsImportes.length > 0 && !pdfParsing && (
              <>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'#2e8b4a' }}>
                    ✅ {evtsImportes.length} événement{evtsImportes.length > 1 ? 's' : ''} détecté{evtsImportes.length > 1 ? 's' : ''} — {pdfFile?.name}
                  </div>
                  <div style={{ display:'flex', gap:6 }}>
                    <button className="btn btn-secondary" style={{ fontSize:10, padding:'4px 8px' }}
                      onClick={() => { const all={}; evtsImportes.forEach((_,i)=>all[i]=true); setEvtsImportesChecked(all) }}>
                      Tout cocher
                    </button>
                    <button className="btn btn-secondary" style={{ fontSize:10, padding:'4px 8px' }}
                      onClick={() => setEvtsImportesChecked({})}>
                      Tout décocher
                    </button>
                  </div>
                </div>

                <div style={{ maxHeight:420, overflowY:'auto', marginBottom:14 }}>
                  {evtsImportes.map((evt, i) => {
                    const checked = evtsImportesChecked[i] !== false
                    const cat = CATEGORIES[evt.categorie] || CATEGORIES.vm
                    const deb = evt.date_debut ? new Date(evt.date_debut) : null
                    const fin = evt.date_fin ? new Date(evt.date_fin) : null
                    return (
                      <div key={i} style={{ display:'flex', gap:10, padding:'10px 12px', marginBottom:8, borderRadius:9, border:`2px solid ${checked ? cat.color : '#dde3f0'}`, background: checked ? cat.bg : '#f8f9fb', transition:'all .15s' }}>
                        {/* Checkbox */}
                        <div onClick={() => setEvtsImportesChecked(prev => ({...prev, [i]: !checked}))}
                          style={{ width:20, height:20, borderRadius:5, border:`2px solid ${checked ? cat.color : '#9aa3b8'}`, background: checked ? cat.color : '#fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0, marginTop:2 }}>
                          {checked && <span style={{ color:'#fff', fontSize:12, fontWeight:700 }}>✓</span>}
                        </div>

                        {/* Contenu éditable */}
                        <div style={{ flex:1 }}>
                          <div style={{ display:'flex', gap:6, marginBottom:6, flexWrap:'wrap' }}>
                            {/* Titre */}
                            <input
                              style={{ flex:1, minWidth:160, fontSize:12, fontWeight:600, border:'1px solid #dde3f0', borderRadius:6, padding:'3px 8px', background:'#fff' }}
                              value={evt.titre}
                              onChange={e => setEvtsImportes(prev => prev.map((ev,j) => j===i ? {...ev, titre: e.target.value} : ev))}
                            />
                            {/* Catégorie */}
                            <select
                              style={{ fontSize:11, border:'1px solid #dde3f0', borderRadius:6, padding:'3px 6px', background:'#fff' }}
                              value={evt.categorie || 'vm'}
                              onChange={e => setEvtsImportes(prev => prev.map((ev,j) => j===i ? {...ev, categorie: e.target.value} : ev))}>
                              {Object.entries(CATEGORIES).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                            </select>
                          </div>
                          <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
                            {/* Date début */}
                            <input type="date"
                              style={{ fontSize:11, border:'1px solid #dde3f0', borderRadius:6, padding:'3px 6px', background:'#fff' }}
                              value={evt.date_debut ? evt.date_debut.slice(0,10) : ''}
                              onChange={e => setEvtsImportes(prev => prev.map((ev,j) => j===i ? {...ev, date_debut: e.target.value + 'T' + (evt.date_debut?.slice(11) || '00:00:00')} : ev))}
                            />
                            {/* Heure début */}
                            <input type="time"
                              style={{ fontSize:11, border:'1px solid #dde3f0', borderRadius:6, padding:'3px 6px', background:'#fff' }}
                              value={evt.date_debut ? evt.date_debut.slice(11,16) : ''}
                              onChange={e => setEvtsImportes(prev => prev.map((ev,j) => j===i ? {...ev, date_debut: (evt.date_debut?.slice(0,10) || '') + 'T' + e.target.value + ':00'} : ev))}
                            />
                            <span style={{ fontSize:11, color:'#9aa3b8' }}>→</span>
                            {/* Heure fin */}
                            <input type="time"
                              style={{ fontSize:11, border:'1px solid #dde3f0', borderRadius:6, padding:'3px 6px', background:'#fff' }}
                              value={evt.date_fin ? evt.date_fin.slice(11,16) : ''}
                              onChange={e => setEvtsImportes(prev => prev.map((ev,j) => j===i ? {...ev, date_fin: (evt.date_fin?.slice(0,10) || evt.date_debut?.slice(0,10) || '') + 'T' + e.target.value + ':00'} : ev))}
                            />
                            {/* Lieu */}
                            <input
                              style={{ fontSize:11, border:'1px solid #dde3f0', borderRadius:6, padding:'3px 8px', background:'#fff', minWidth:100 }}
                              placeholder="Lieu"
                              value={evt.lieu || ''}
                              onChange={e => setEvtsImportes(prev => prev.map((ev,j) => j===i ? {...ev, lieu: e.target.value} : ev))}
                            />
                          </div>
                          {/* Notes / TISF */}
                          {evt.notes && (
                            <div style={{ marginTop:5, fontSize:10, color:'#5a6478', fontStyle:'italic' }}>📝 {evt.notes}</div>
                          )}
                          {/* Enfant + AF associé */}
                          <div style={{ marginTop:5, display:'flex', gap:4, alignItems:'center', flexWrap:'wrap' }}>
                            {evt._enfantLabel ? (
                              <span style={{ fontSize:10, padding:'2px 8px', borderRadius:10, background: evt.enfant_ids?.[0] ? (couleursEnfants[evt.enfant_ids[0]] || '#1a4b8f') : '#1a4b8f', color:'#fff', fontWeight:600 }}>
                                {evt._enfantLabel}
                              </span>
                            ) : (
                              <span style={{ fontSize:10, color:'#d97706', fontStyle:'italic' }}>⚠️ Enfant non reconnu</span>
                            )}
                            {evt._afLabel && (
                              <span style={{ fontSize:10, padding:'2px 8px', borderRadius:10, background:'#eef1f8', color:'#1a4b8f', fontWeight:600, border:'1px solid #c4d4f5' }}>
                                👤 {evt._afLabel}
                              </span>
                            )}
                            {evt._relaisLabel && (
                              <span style={{ fontSize:10, padding:'2px 8px', borderRadius:10, background:'#e0f2fe', color:'#0891b2', fontWeight:600, border:'1px solid #bae6fd' }}>
                                🔄 Relais : {evt._relaisLabel}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Résumé */}
                <div style={{ background:'#e6f5eb', borderRadius:8, padding:'8px 12px', marginBottom:12, fontSize:11, color:'#2e8b4a', fontWeight:600 }}>
                  ✅ {Object.values(evtsImportesChecked).filter(Boolean).length} événement{Object.values(evtsImportesChecked).filter(Boolean).length > 1 ? 's' : ''} sélectionné{Object.values(evtsImportesChecked).filter(Boolean).length > 1 ? 's' : ''}
                  {' '}· Le PDF sera sauvegardé dans Documents
                </div>
              </>
            )}

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setShowImportModal(false); setEvtsImportes([]); setPdfFile(null) }}>Annuler</button>
              {evtsImportes.length > 0 && !pdfParsing && (
                <button className="btn btn-primary" onClick={() => saveEvtsImportes(null)}>
                  💾 Importer {Object.values(evtsImportesChecked).filter(Boolean).length} événement{Object.values(evtsImportesChecked).filter(Boolean).length > 1 ? 's' : ''}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL DETAIL / EDIT
      ══════════════════════════════════════════════════════════════════════ */}
      {showDetailModal && selectedEvt && (
        <div className="modal-overlay" onClick={() => { setShowDetailModal(false); setEditMode(false) }}>
          <div className="modal-box" style={{ maxWidth:520 }} onClick={e => e.stopPropagation()}>
            {!editMode ? (
              <>
                <div className="modal-title">
                  {selectedEvt._titrePOV || selectedEvt.titre}
                  {selectedEvt._enfantNom && (
                    <span style={{ fontSize:12, fontWeight:500, marginLeft:10, padding:'3px 9px', borderRadius:10, background: selectedEvt._couleur || '#1a4b8f', color:'#fff' }}>
                      {selectedEvt._enfantNom}
                    </span>
                  )}
                </div>
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
                        titre: selectedEvt.titre, categorie: selectedEvt.categorie,
                        date_debut: deb.toLocaleDateString('fr-CA', { timeZone:'Europe/Paris' }),
                        heure_debut: deb.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit', timeZone:'Europe/Paris' }),
                        date_fin: fin.toLocaleDateString('fr-CA', { timeZone:'Europe/Paris' }),
                        heure_fin: fin.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit', timeZone:'Europe/Paris' }),
                        lieu: selectedEvt.lieu || '', notes: selectedEvt.notes || '', message: ''
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
                    ⚠️ Vous êtes participant — votre modification sera soumise à validation par l'AF principal(e)
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
                    <input className="form-control" value={editEvt.lieu || ''} onChange={e => setEditEvt(n => ({...n, lieu: e.target.value}))} />
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
                    {selectedEvt.participants_ids?.includes(profile?.id) && selectedEvt.af_id !== profile?.id ? '📤 Envoyer la demande' : '💾 Enregistrer'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL PARTAGE
      ══════════════════════════════════════════════════════════════════════ */}
      {showPartageModal && (
        <div className="modal-overlay" onClick={() => setShowPartageModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-title">🔗 Partage d'agenda</div>
            {demandesPartageRecues.length > 0 && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#d97706', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:8 }}>🔔 Demandes reçues</div>
                {demandesPartageRecues.map(p => (
                  <div key={p.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 13px', background:'#fef3e2', borderRadius:9, marginBottom:6, border:'1px solid #f5dca4' }}>
                    <div style={{ flex:1, fontSize:12 }}><strong>{p.demandeur?.prenom} {p.demandeur?.nom}</strong> souhaite partager son agenda avec vous</div>
                    <button className="btn btn-success" style={{ padding:'5px 10px', fontSize:11 }} onClick={() => accepterPartage(p.id)}>✅ Accepter</button>
                  </div>
                ))}
              </div>
            )}
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
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'#5a6478', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:8 }}>Partager avec...</div>
              {collegues.filter(c => !partages.some(p =>
                (p.demandeur_id === profile?.id && p.destinataire_id === c.id) ||
                (p.destinataire_id === profile?.id && p.demandeur_id === c.id)
              )).map(c => (
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
              {collegues.length === 0 && <div style={{ fontSize:12, color:'#9aa3b8', textAlign:'center', padding:12 }}>Aucun collègue dans votre territoire</div>}
            </div>
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
