// DossierEnfant.js — v2026-06-16b — AF relais voit identité (lecture), AF principal peut éditer
import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Sidebar from '../components/Sidebar'
import PageHeader from '../components/PageHeader'

// ── Composants utilitaires ────────────────────────────────────────────────────

function SectionCard({ icon, title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ background:'#fff', border:'1px solid #dde3f0', borderRadius:12, boxShadow:'0 2px 12px rgba(26,75,143,.08)', marginBottom:16, overflow:'hidden' }}>
      <div onClick={() => setOpen(o => !o)}
        style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 20px', borderBottom: open ? '1px solid #dde3f0' : 'none', cursor:'pointer', userSelect:'none' }}>
        <h3 style={{ display:'flex', alignItems:'center', gap:10, fontSize:14, fontWeight:600, margin:0 }}>
          <span style={{ fontSize:18 }}>{icon}</span>{title}
        </h3>
        <span style={{ color:'#9aa3b8', fontSize:16, transition:'transform .2s', transform: open ? 'none' : 'rotate(-90deg)' }}>▾</span>
      </div>
      {open && <div style={{ padding:20 }}>{children}</div>}
    </div>
  )
}

function FormGrid({ cols = 3, children }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:`repeat(${cols}, 1fr)`, gap:16 }}>
      {children}
    </div>
  )
}

function fmtDateLocal(iso) {
  if (!iso) return ''
  const datePart = iso.split('T')[0]
  const [y, m, d] = datePart.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

function Field({ label, value, onChange, type = 'text', options, span, placeholder, readOnly }) {
  const style = span ? { gridColumn: `span ${span}` } : {}
  const displayValue = readOnly && type === 'date' ? fmtDateLocal(value) : value
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:5, ...style }}>
      <label style={{ fontSize:11, fontWeight:600, color:'#5a6478', letterSpacing:'.4px', textTransform:'uppercase' }}>{label}</label>
      {readOnly ? (
        <div style={{ padding:'10px 12px', background:'#eef1f8', borderRadius:8, fontSize:13, color:'#1c2333' }}>
          {displayValue || <span style={{ color:'#9aa3b8', fontStyle:'italic' }}>—</span>}
        </div>
      ) : options ? (
        <select value={value || ''} onChange={e => onChange(e.target.value)}
          style={{ padding:'10px 12px', border:'1.5px solid #dde3f0', borderRadius:8, fontFamily:'Sora,sans-serif', fontSize:13, background:'#f4f6fb', color:'#1c2333', outline:'none' }}>
          <option value="">—</option>
          {options.map(o => <option key={o.value || o} value={o.value || o}>{o.label || o}</option>)}
        </select>
      ) : type === 'textarea' ? (
        <textarea value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          style={{ padding:'10px 12px', border:'1.5px solid #dde3f0', borderRadius:8, fontFamily:'Sora,sans-serif', fontSize:13, background:'#f4f6fb', color:'#1c2333', outline:'none', minHeight:80, resize:'vertical' }} />
      ) : (
        <input type={type} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          style={{ padding:'10px 12px', border:'1.5px solid #dde3f0', borderRadius:8, fontFamily:'Sora,sans-serif', fontSize:13, background:'#f4f6fb', color:'#1c2333', outline:'none' }} />
      )}
    </div>
  )
}

function ContactCard({ icon, role, nom, prenom, tel, email, onEdit, bg }) {
  return (
    <div style={{ background:'#fff', border:'1px solid #dde3f0', borderRadius:10, padding:14, display:'flex', flexDirection:'column', gap:8 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ width:36, height:36, borderRadius:8, background: bg || '#e8eef8', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>{icon}</div>
        <div>
          <div style={{ fontSize:11, color:'#9aa3b8', fontWeight:600, textTransform:'uppercase', letterSpacing:'.3px' }}>{role}</div>
          <div style={{ fontSize:13, fontWeight:600 }}>{nom} {prenom}</div>
        </div>
      </div>
      {tel && <div style={{ fontSize:12, color:'#5a6478' }}>📞 <a href={`tel:${tel}`} style={{ color:'#1a4b8f' }}>{tel}</a></div>}
      {email && <div style={{ fontSize:12, color:'#5a6478' }}>✉️ <a href={`mailto:${email}`} style={{ color:'#1a4b8f' }}>{email}</a></div>}
      <div style={{ display:'flex', gap:6, marginTop:2 }}>
        {tel && <button onClick={() => window.open(`tel:${tel}`)} style={{ padding:'4px 8px', borderRadius:6, border:'1px solid #dde3f0', background:'#fff', fontSize:11, cursor:'pointer' }}>📞</button>}
        {email && <button onClick={() => window.open(`mailto:${email}`)} style={{ padding:'4px 8px', borderRadius:6, border:'1px solid #dde3f0', background:'#fff', fontSize:11, cursor:'pointer' }}>✉️</button>}
        {onEdit && <button onClick={onEdit} style={{ padding:'4px 8px', borderRadius:6, border:'1px solid #dde3f0', background:'#fff', fontSize:11, cursor:'pointer' }}>✏️</button>}
      </div>
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────

export default function DossierEnfant({ profile }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [enfant, setEnfant] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const searchParams = new URLSearchParams(location.search)
  const [onglet, setOnglet] = useState(searchParams.get('onglet') || 'identite')
  const [editMode, setEditMode] = useState(false)
  const [form, setForm] = useState({})
  const [collegues, setCollegues] = useState([])
  const [toast, setToast] = useState('')
  const [journalNotes, setJournalNotes] = useState([])
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [newNote, setNewNote] = useState({ date: new Date().toISOString().slice(0,10), heure:'', humeur:'😊', texte:'', tags:'', type_note:'principal', relais_debut:'', relais_fin:'' })
  const [noteLoading, setNoteLoading] = useState(false)
  const [editNoteId, setEditNoteId] = useState(null)
  const [showRapportModal, setShowRapportModal] = useState(false)
  const [rapportPeriode, setRapportPeriode] = useState({ debut: '', fin: '' })
  const [rapportTexte, setRapportTexte] = useState('')
  const [rapportLoading, setRapportLoading] = useState(false)
  const [documents, setDocuments] = useState([])
  const [docsEnfant, setDocsEnfant] = useState([])
  const [dossiersEnfant, setDossiersEnfant] = useState([])
  const [dossierActifEnfant, setDossierActifEnfant] = useState(null)
  const [cheminEnfant, setCheminEnfant] = useState([]) // fil d'ariane
  const [sousDossiersEnfant, setSousDossiersEnfant] = useState([])
  const [uploadingDocEnfant, setUploadingDocEnfant] = useState(null)
  const [uploadingDoc, setUploadingDoc] = useState(null)
  const [photoUrl, setPhotoUrl] = useState(null)
  const [showFratrieModal, setShowFratrieModal] = useState(false)
  const [pere, setPere] = useState(null)
  const [mere, setMere] = useState(null)
  const [showParentModal, setShowParentModal] = useState(false)
  const [parentType, setParentType] = useState(null) // 'pere' ou 'mere'
  const [editParent, setEditParent] = useState({})
  const [savingParent, setSavingParent] = useState(false)
  const [docsParent, setDocsParent] = useState([])
  const [maisonsDept, setMaisonsDept] = useState([])
  const [uploadingDocParent, setUploadingDocParent] = useState(false)
  const [fratrieSearch, setFratrieSearch] = useState('')
  const [fratrieSearchResults, setFratrieSearchResults] = useState([])
  const [fratrieMode, setFratrieMode] = useState('question') // 'question', 'search', 'create', 'parents'
  const [newFratrie, setNewFratrie] = useState({ prenom:'', nom:'', ddn:'', sexe:'M', meme_af:false, type_placement:'non_place', lieu_type:'', lieu_nom:'', memes_parents: null })

  const [isAfRelaisActif, setIsAfRelaisActif] = useState(false)
  const [relaisInfo, setRelaisInfo] = useState(null) // { date_debut, date_fin } du relais en cours

  const [showProfModal, setShowProfModal] = useState(false)
  const [newProf, setNewProf] = useState({ nom:'', specialite:'', adresse:'', telephone:'', email:'', notes:'' })
  const [editProfIdx, setEditProfIdx] = useState(null)

  const nonPlace = enfant?.type_placement === 'non_place' || !enfant?.type_placement
  const isReferent = ['referent','gestionnaire','encadrant','rtase','admin'].includes(profile?.role)
  const isAF = profile?.role === 'af'
  const isAfPrincipalEnfant = isAF && enfant?.af_principal_id === profile?.id
  const canEdit = isReferent || isAfPrincipalEnfant

  // ── Vérifier si l'AF connecté est AF relais actif pour cet enfant (fenêtre J-2/J+2) ──
  const fetchRelaisActif = useCallback(async () => {
    if (!isAF || !id || !profile?.id) return
    const now = new Date()
    const jMoins2 = new Date(now); jMoins2.setDate(jMoins2.getDate() - 2); jMoins2.setHours(0,0,0,0)
    const jPlus2 = new Date(now); jPlus2.setDate(jPlus2.getDate() + 2); jPlus2.setHours(23,59,59,999)

    const { data } = await supabase
      .from('evenements')
      .select('id, date_debut, date_fin, participants_ids, enfant_ids')
      .eq('categorie', 'relais')
      .contains('enfant_ids', [id])
      .gte('date_fin', jMoins2.toISOString())
      .lte('date_debut', jPlus2.toISOString())

    if (data) {
      const relais = data.find(e => e.participants_ids?.includes(profile.id))
      if (relais) {
        setIsAfRelaisActif(true)
        setRelaisInfo({ date_debut: relais.date_debut, date_fin: relais.date_fin })
      }
    }
  }, [isAF, id, profile?.id])

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 2800) }

  // ── Chargement ──────────────────────────────────────────────────────────────
  const fetchPhoto = useCallback(async () => {
    const { data } = await supabase.storage.from('documents-enfants').list(`enfants/${id}/photos`)
    if (data && data.length > 0) {
      const { data: url } = await supabase.storage.from('documents-enfants').createSignedUrl(`enfants/${id}/photos/${data[0].name}`, 3600)
      if (url?.signedUrl) setPhotoUrl(url.signedUrl)
    }
  }, [id])

  const fetchEnfant = useCallback(async () => {
    if (!id) return
    const { data, error } = await supabase
      .from('enfants')
      .select(`*, 
        af_principal:af_principal_id(id, nom, prenom, telephone, email, territoire), 
        referent:referent_id(id, nom, prenom, telephone, email),
        pere:pere_id(*),
        mere:mere_id(*)
      `)
      .eq('id', id)
      .single()
    if (!error && data) {
      const parseArr = (val) => {
        if (!val) return []
        if (Array.isArray(val)) return val.filter(Boolean)
        if (typeof val === 'string') {
          try { const p = JSON.parse(val); return Array.isArray(p) ? p.filter(Boolean) : [] }
          catch { return [] }
        }
        return []
      }
      const safeData = {
        ...data,
        conditions_sante: parseArr(data.conditions_sante),
        preconisations: parseArr(data.preconisations),
        fratrie: parseArr(data.fratrie),
        professionnels_sante: parseArr(data.professionnels_sante),
      }
      setEnfant(safeData)
      setForm(safeData)
      if (data.pere) setPere(data.pere)
      if (data.mere) setMere(data.mere)
    }
    setLoading(false)
  }, [id])

  const fetchCollegues = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('id, nom, prenom, role, territoire, telephone, email, ville').in('role', ['af','referent','encadrant','rtase','admin'])
    if (data) setCollegues(data)
  }, [profile])

  // Charger les documents d'un parent
  async function fetchDocsParent(parentId) {
    if (!parentId) return
    const { data } = await supabase
      .from('documents_parent')
      .select('*')
      .eq('parent_id', parentId)
      .order('created_at', { ascending: false })
    if (data) {
      setDocsParent(data)
      // Mettre à jour aussi les docs de la fiche
      if (enfant?.pere_id === parentId) setDocsPereFiche(data)
      if (enfant?.mere_id === parentId) setDocsMereFiche(data)
    }
  }

  // Uploader un document parent
  async function uploadDocParent(file, parentId) {
    if (!file || !parentId) return
    setUploadingDocParent(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `parents/${parentId}/${Date.now()}.${ext}`
      const { error: storageError } = await supabase.storage
        .from('documents-enfants')
        .upload(path, file, { contentType: file.type })
      if (storageError) { showToast('❌ ' + storageError.message); return }
      await supabase.from('documents_parent').insert({
        parent_id: parentId,
        nom: file.name,
        storage_path: path,
        taille: file.size,
        mime_type: file.type,
        uploaded_by: profile.id,
      })
      showToast('✅ Document uploadé !')
      fetchDocsParent(parentId)
    } catch(e) {
      showToast('❌ ' + e.message)
    } finally {
      setUploadingDocParent(false)
    }
  }

  async function deleteDocParent(docId, path, parentId) {
    if (!window.confirm('Supprimer ce document ?')) return
    await supabase.storage.from('documents-enfants').remove([path])
    await supabase.from('documents_parent').delete().eq('id', docId)
    showToast('🗑 Supprimé')
    fetchDocsParent(parentId)
  }

  // Ouvrir le modal parent (création ou modification)
  function openParentModal(type) {
    setParentType(type)
    const parentActuel = type === 'pere' ? pere : mere
    if (parentActuel) {
      setEditParent({ ...parentActuel })
      fetchDocsParent(parentActuel.id)
    } else {
      setDocsParent([])
      setEditParent({ nom:'', prenom:'', date_naissance:'', numero_secu:'', telephone:'', telephone2:'', email:'', adresse:'', code_postal:'', ville:'', situation_pro:'', droits_parentaux:'', droit_visite:'', notes:'' })
    }
    setShowParentModal(true)
  }

  // Sauvegarder un parent
  async function saveParent() {
    if (!editParent.nom) { showToast('⚠️ Nom requis'); return }
    setSavingParent(true)
    const parentActuel = parentType === 'pere' ? pere : mere

    try {
      let parentId
      // Nettoyer les dates vides avant envoi
      const parentData = Object.fromEntries(
        Object.entries(editParent).map(([k, v]) => {
          if (v === '' && k.includes('date') || v === '' && k.includes('naissance')) return [k, null]
          return [k, v]
        })
      )
      if (parentActuel?.id) {
        // Mise à jour
        const { error } = await supabase.from('parents').update({
          ...parentData,
          updated_at: new Date().toISOString()
        }).eq('id', parentActuel.id)
        if (error) throw error
        parentId = parentActuel.id
        if (parentType === 'pere') setPere({ ...editParent, id: parentId })
        else setMere({ ...editParent, id: parentId })
      } else {
        // Création
        const { data, error } = await supabase.from('parents').insert({
          ...parentData,
          created_by: profile.id
        }).select().single()
        if (error) throw error
        parentId = data.id
        if (parentType === 'pere') setPere(data)
        else setMere(data)
      }

      // Lier à l'enfant
      const updateField = parentType === 'pere' ? { pere_id: parentId } : { mere_id: parentId }
      await supabase.from('enfants').update(updateField).eq('id', id)
      setForm(f => ({ ...f, ...updateField }))

      showToast(`✅ ${parentType === 'pere' ? 'Père' : 'Mère'} enregistré(e) !`)
      setShowParentModal(false)
    } catch(e) {
      showToast('❌ Erreur : ' + e.message)
    }
    setSavingParent(false)
  }

  // Masquer un parent
  async function masquerParent(type) {
    const field = type === 'pere' ? 'pere_masque' : 'mere_masque'
    const valActuelle = form[field]
    await supabase.from('enfants').update({ [field]: !valActuelle }).eq('id', id)
    setForm(f => ({ ...f, [field]: !valActuelle }))
  }

  async function searchEnfantsBase(query) {
    if (query.length < 2) { setFratrieSearchResults([]); return }
    const { data } = await supabase
      .from('enfants')
      .select('id, prenom, nom, date_naissance, sexe, af_principal_id')
      .or(`prenom.ilike.%${query}%,nom.ilike.%${query}%`)
      .neq('id', id)
      .limit(10)
    if (data) setFratrieSearchResults(data)
  }

  async function addFratrieFromBase(enfant) {
    const already = (form.fratrie || []).find(f => f.enfant_id === enfant.id)
    if (already) { showToast('⚠️ Déjà dans la fratrie'); return }

    const newMembre = {
      enfant_id: enfant.id,
      prenom: enfant.prenom,
      nom: enfant.nom,
      ddn: enfant.date_naissance,
      sexe: enfant.sexe === 'Féminin' ? 'F' : 'M',
      meme_af: enfant.af_principal_id === form.af_principal_id
    }
    const newFratrieList = [...(form.fratrie || []), newMembre]

    // Sauvegarder pour l'enfant courant
    await supabase.from('enfants').update({ fratrie: newFratrieList }).eq('id', id)
    setForm(f => ({ ...f, fratrie: newFratrieList }))

    // Moi comme membre
    const moiMembre = {
      enfant_id: id,
      prenom: form.prenom,
      nom: form.nom,
      ddn: form.date_naissance,
      sexe: form.sexe === 'Féminin' ? 'F' : 'M',
      meme_af: enfant.af_principal_id === form.af_principal_id
    }

    // Collecter TOUS les enfants de la fratrie étendue (moi + existants + nouveau)
    const tousLesIds = [
      { id, membre: moiMembre },
      { id: enfant.id, membre: newMembre },
      ...(form.fratrie || []).filter(f => f.enfant_id).map(f => ({ id: f.enfant_id, membre: f }))
    ]

    // Pour chaque membre, ajouter tous les autres qui lui manquent
    for (const cible of tousLesIds) {
      const autresMembres = tousLesIds.filter(x => x.id !== cible.id).map(x => x.membre)
      const { data: cibleData } = await supabase.from('enfants').select('fratrie').eq('id', cible.id).single()
      if (!cibleData) continue
      const fratrieActuelle = cibleData.fratrie || []
      const membresAjouter = autresMembres.filter(m => !fratrieActuelle.find(f => f.enfant_id === m.enfant_id))
      if (membresAjouter.length > 0) {
        await supabase.from('enfants').update({ fratrie: [...fratrieActuelle, ...membresAjouter] }).eq('id', cible.id)
      }
    }

    setShowFratrieModal(false)
    setFratrieMode('question')
    setFratrieSearch('')
    showToast('✅ Fratrie synchronisée !')
  }

  async function syncFratrieMiroir(enfantCibleId, membreAAjouter) {
    const { data } = await supabase.from('enfants').select('fratrie').eq('id', enfantCibleId).single()
    if (!data) return
    const fratrieActuelle = data.fratrie || []
    if (fratrieActuelle.find(f => f.enfant_id === membreAAjouter.enfant_id)) return
    await supabase.from('enfants').update({ fratrie: [...fratrieActuelle, membreAAjouter] }).eq('id', enfantCibleId)
  }


  async function addFratrieNew(parentCommun) {
    if (!newFratrie.prenom || !newFratrie.nom) { showToast('⚠️ Prénom et nom requis'); return }

    const af_id = newFratrie.lieu_type === 'af' && newFratrie.meme_af
      ? form.af_principal_id : null

    // Copier les IDs des parents selon le choix
    const dataParents = {}
    if (parentCommun === 'les_deux' || parentCommun === true) {
      if (form.pere_id) dataParents.pere_id = form.pere_id
      if (form.mere_id) dataParents.mere_id = form.mere_id
    } else if (parentCommun === 'pere') {
      if (form.pere_id) dataParents.pere_id = form.pere_id
    } else if (parentCommun === 'mere') {
      if (form.mere_id) dataParents.mere_id = form.mere_id
    }

    const { data: nouveauDossier, error } = await supabase.from('enfants').insert({
      prenom: newFratrie.prenom,
      nom: newFratrie.nom,
      date_naissance: newFratrie.ddn || null,
      sexe: newFratrie.sexe === 'M' ? 'Masculin' : 'Féminin',
      type_placement: newFratrie.type_placement || 'non_place',
      lieu_accueil: newFratrie.lieu_type || null,
      af_principal_id: af_id,
      referent_id: form.referent_id || profile?.id || null,
      territoire: form.territoire || profile?.territoire || null,
      ...dataParents
    }).select().single()

    if (error) { showToast('❌ Erreur : ' + error.message); return }

    const newMembre = {
      enfant_id: nouveauDossier.id,
      prenom: newFratrie.prenom,
      nom: newFratrie.nom,
      ddn: newFratrie.ddn,
      sexe: newFratrie.sexe,
      meme_af: newFratrie.lieu_type === 'af' && newFratrie.meme_af,
    }
    const newFratrieList = [...(form.fratrie || []), newMembre]

    await supabase.from('enfants').update({ fratrie: newFratrieList }).eq('id', id)
    setForm(f => ({ ...f, fratrie: newFratrieList }))

    const moiMembre = {
      enfant_id: id, prenom: form.prenom, nom: form.nom,
      ddn: form.date_naissance, sexe: form.sexe === 'Féminin' ? 'F' : 'M', meme_af: false
    }
    const fratrieExistante = (form.fratrie || []).filter(f => f.enfant_id).map(f => ({
      enfant_id: f.enfant_id, prenom: f.prenom, nom: f.nom, ddn: f.ddn, sexe: f.sexe, meme_af: f.meme_af
    }))
    await supabase.from('enfants').update({ fratrie: [...fratrieExistante, moiMembre] }).eq('id', nouveauDossier.id)

    for (const membre of (form.fratrie || [])) {
      if (membre.enfant_id) {
        await syncFratrieMiroir(membre.enfant_id, newMembre)
        await syncFratrieMiroir(nouveauDossier.id, membre)
      }
    }

    setShowFratrieModal(false)
    setFratrieMode('question')
    setNewFratrie({ prenom:'', nom:'', ddn:'', sexe:'M', meme_af:false, type_placement:'non_place', lieu_type:'', lieu_nom:'', memes_parents: null })

    const msgs = { 'les_deux': '✅ Dossier créé — parents liés !', 'pere': '✅ Dossier créé — père lié !', 'mere': '✅ Dossier créé — mère liée !' }
    showToast(msgs[parentCommun] || '✅ Dossier créé !')
  }

  const fetchMaisonsDept = useCallback(async () => {
    const { data } = await supabase.from('maisons_departement').select('*').order('ville', { ascending: true })
    if (data) setMaisonsDept(data)
  }, [])

  const fetchDocuments = useCallback(async () => {
    if (!id) return
    const { data } = await supabase
      .from('documents_enfant')
      .select('*')
      .eq('enfant_id', id)
      .order('created_at', { ascending: false })
    if (data) setDocuments(data)
  }, [id])

  async function uploadDocument(file, typeDoc) {
    if (!file) return
    setUploadingDoc(typeDoc)
    try {
      // Chemin dans le bucket
      const ext = file.name.split('.').pop()
      const path = `${id}/${typeDoc}_${Date.now()}.${ext}`

      // Upload dans Supabase Storage
      const { error: storageError } = await supabase.storage
        .from('documents-enfants')
        .upload(path, file, { contentType: file.type, upsert: false })

      if (storageError) { showToast('❌ Erreur upload : ' + storageError.message); return }

      // Enregistrer la référence en base
      const { error: dbError } = await supabase.from('documents_enfant').insert({
        enfant_id: id,
        type_doc: typeDoc,
        nom: file.name,
        storage_path: path,
        taille: file.size,
        mime_type: file.type,
        uploaded_by: profile.id,
      })

      if (dbError) { showToast('❌ Erreur base : ' + dbError.message); return }

      showToast('✅ Document uploadé !')
      fetchDocuments()
    } catch(e) {
      showToast('❌ Erreur : ' + e.message)
    } finally {
      setUploadingDoc(null)
    }
  }

  async function viewDocument(path) {
    const { data } = await supabase.storage
      .from('documents-enfants')
      .createSignedUrl(path, 3600) // URL valide 1h
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
    else showToast("❌ Impossible d'ouvrir le document")
  }

  async function downloadDocument(path, nom) {
    const { data } = await supabase.storage
      .from('documents-enfants')
      .createSignedUrl(path, 60)
    if (data?.signedUrl) {
      // Forcer le téléchargement via fetch + blob
      const resp = await fetch(data.signedUrl)
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = nom
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  }

  async function deleteDocument(docId, path) {
    if (!window.confirm('Supprimer ce document ?')) return
    await supabase.storage.from('documents-enfants').remove([path])
    await supabase.from('documents_enfant').delete().eq('id', docId)
    showToast('🗑 Document supprimé')
    fetchDocuments()
  }

  const DOSSIERS_ENFANT_DEFAUT = [
    { nom: '🏥 Médical', enfants: ['Ordonnances', 'Comptes-rendus', 'Vaccinations'] },
    { nom: '🏫 Scolaire', enfants: ['Bulletins', 'Correspondance école', 'Inscriptions'] },
  ]

  const fetchDossiersEnfant = useCallback(async () => {
    // Charger les dossiers de l'enfant
    const { data } = await supabase.from('documents_dossiers')
      .select('*').is('parent_id', null)
      .eq('territoire', id) // on utilise territoire = enfant_id pour isoler
      .order('nom')
    if (data) {
      if (data.length === 0) {
        // Créer les dossiers par défaut
        for (const d of DOSSIERS_ENFANT_DEFAUT) {
          const { data: parent } = await supabase.from('documents_dossiers').insert({
            nom: d.nom, parent_id: null, territoire: id, created_by: profile?.id
          }).select().single()
          if (parent) {
            for (const enfant of d.enfants) {
              await supabase.from('documents_dossiers').insert({
                nom: enfant, parent_id: parent.id, territoire: id, created_by: profile?.id
              })
            }
          }
        }
        const { data: recharged } = await supabase.from('documents_dossiers')
          .select('*').is('parent_id', null).eq('territoire', id).order('nom')
        setDossiersEnfant(recharged || [])
      } else {
        setDossiersEnfant(data)
      }
    }
  }, [id, profile])

  const fetchSousDossiersEnfant = useCallback(async (parentId) => {
    const { data } = await supabase.from('documents_dossiers')
      .select('*').eq('parent_id', parentId).order('nom')
    setSousDossiersEnfant(data || [])
  }, [])

  const fetchDocsEnfantDossier = useCallback(async (dossierId) => {
    if (!dossierId) { setDocsEnfant([]); return }
    const { data } = await supabase.from('documents_generaux')
      .select('*').eq('dossier_id', dossierId).order('created_at', { ascending: false })
    if (data) setDocsEnfant(data)
  }, [])

  const fetchJournal = useCallback(async () => {
    if (!id) return
    const { data } = await supabase
      .from('journal_enfant')
      .select('*')
      .eq('enfant_id', id)
      .order('date', { ascending: false })
    if (data) setJournalNotes(data)
  }, [id])

  // Charger les docs des parents au chargement
  useEffect(() => {
    fetchEnfant(); fetchPhoto()
    fetchCollegues()
    fetchJournal()
    fetchDocuments()
    fetchMaisonsDept()
    fetchDossiersEnfant()
    fetchRelaisActif()
  }, [fetchEnfant, fetchCollegues, fetchJournal, fetchDocuments, fetchMaisonsDept, fetchRelaisActif])

  // Charger docs parents quand pere/mere chargés
  const [docsPereFiche, setDocsPereFiche] = useState([])
  const [docsMereFiche, setDocsMereFiche] = useState([])

  useEffect(() => {
    async function loadDocsParents() {
      if (enfant?.pere_id) {
        const { data } = await supabase.from('documents_parent').select('*').eq('parent_id', enfant.pere_id)
        if (data) setDocsPereFiche(data)
      }
      if (enfant?.mere_id) {
        const { data } = await supabase.from('documents_parent').select('*').eq('parent_id', enfant.mere_id)
        if (data) setDocsMereFiche(data)
      }
    }
    if (enfant) loadDocsParents()
  }, [enfant])

  // ── Sauvegarde ──────────────────────────────────────────────────────────────
  async function saveForm() {
    setSaving(true)
    // Exclure TOUTES les relations et champs non-colonnes
    const champsExclus = ['af_principal', 'referent', 'pere', 'mere', 'id', 'created_at', 'updated_at']
    const formData = Object.fromEntries(
      Object.entries(form).filter(([k, v]) => {
        if (champsExclus.includes(k)) return false
        if (v !== null && typeof v === 'object' && !Array.isArray(v)) return false
        return true
      }).map(([k, v]) => {
        // Convertir les chaînes vides en null pour les champs date
        if (v === '' && (k.includes('date') || k.includes('naissance') || k.includes('exp') || k.includes('debut') || k.includes('fin'))) {
          return [k, null]
        }
        return [k, v]
      })
    )
    const { error } = await supabase.from('enfants').update(formData).eq('id', id)
    if (!error) {
      showToast('✅ Dossier enregistré !')
      setEnfant(form)
      setEditMode(false)
    } else showToast('❌ Erreur : ' + error.message)
    setSaving(false)
  }

  // Sauvegarde directe des champs santé (sans passer par editMode)
  async function saveSanteField(champ, valeur) {
    let payload = {}
    if (champ === 'conditions_sante') {
      payload = { conditions_sante: valeur }
      setForm(f => ({ ...f, conditions_sante: valeur }))
    } else if (champ === 'notes_sante') {
      payload = { notes_sante: valeur }
    } else if (champ === 'preconisations') {
      payload = { preconisations: valeur }
      setForm(f => ({ ...f, preconisations: valeur }))
    } else if (champ === 'notes_preconisations') {
      payload = { notes_preconisations: valeur }
    } else if (champ === 'professionnels_sante') {
      payload = { professionnels_sante: valeur }
      setForm(f => ({ ...f, professionnels_sante: valeur }))
    } else if (champ === 'medecin_groupe') {
      payload = valeur
    }
    const { error } = await supabase.from('enfants').update(payload).eq('id', id)
    if (!error) showToast('✅ Enregistré !')
    else showToast('❌ Erreur : ' + error.message)
  }

  const DATE_KEYS = ['pere_ddn','mere_ddn','date_naissance','date_placement','date_fin_placement','tj_date_audience','date_jugement','date_revision','date_debut','date_fin','date_naissance_pere','date_naissance_mere','date_agrement','date_expiration_agrement','date_debut_contrat','vehicule_assurance_exp','vehicule_ct_exp','deaf_date']
  function F(key) {
    return (val) => {
      const cleaned = DATE_KEYS.includes(key) && val === '' ? null : val
      setForm(f => ({ ...f, [key]: cleaned }))
    }
  }
  const ARRAY_KEYS = ['conditions_sante', 'preconisations', 'fratrie', 'professionnels_sante']
  function v(key) {
    if (ARRAY_KEYS.includes(key)) return form[key] || []
    return form[key] || ''
  }

  // ── Calcul âge ──────────────────────────────────────────────────────────────
  // Formater une date ISO (YYYY-MM-DD ou YYYY-MM-DDTHH:MM:SS) en DD/MM/YYYY
  function fmtDate(iso) {
    if (!iso) return ''
    const datePart = iso.split('T')[0]
    const [y, m, d] = datePart.split('-')
    if (!y || !m || !d) return iso
    return `${d}/${m}/${y}`
  }

  function calcAge(ddn) {
    if (!ddn) return ''
    const d = new Date(ddn), now = new Date()
    let age = now.getFullYear() - d.getFullYear()
    if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--
    return `${age} ans`
  }

  // ── Journal ─────────────────────────────────────────────────────────────────


  async function generateRapport() {
    if (!rapportPeriode.debut || !rapportPeriode.fin) { showToast('⚠️ Choisissez une période'); return }
    setRapportLoading(true)

    // Filtrer les notes de la période
    const notesPeriode = journalNotes.filter(n => n.date >= rapportPeriode.debut && n.date <= rapportPeriode.fin)
    if (notesPeriode.length === 0) { showToast('⚠️ Aucune note sur cette période'); setRapportLoading(false); return }

    // Construire le contexte pour Claude
    const notesTexte = notesPeriode.map(n => {
      const d = fmtDate(n.date)
      const type = n.type_note === 'relais' ? 'AF Relais' : 'AF Principal'
      const humeur = n.humeur || ''
      const tags = n.tags?.length ? `[${n.tags.join(', ')}]` : ''
      return `${d} (${type}) ${humeur} ${tags}\n${n.texte}`
    }).join('\n\n---\n\n')

    const prompt = `Rédige un rapport de synthèse professionnel pour l'ASE (Aide Sociale à l'Enfance) du Tarn, en tant qu'outil Passerelle.

Voici les notes du journal de l'enfant ${enfant.prenom} ${enfant.nom} (${calcAge(enfant.date_naissance)}) 
pour la période du ${fmtDate(rapportPeriode.debut)} au ${fmtDate(rapportPeriode.fin)} :

${notesTexte}

Rédige une synthèse professionnelle structurée en paragraphes thématiques (comportement général, scolarité, santé, relations familiales, points d'attention...). 
Utilise un style professionnel adapté aux rapports ASE. 
Sois factuel, bienveillant et objectif. 
Sois factuel, bienveillant et objectif. Ne génère AUCUN titre, AUCUN en-tête, AUCUN hashtag (#), AUCUNE ligne de séparation. Commence directement par le premier paragraphe.`
    try {
      const resp = await fetch('/api/generate-rapport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      })
      const data = await resp.json()
      if (data.texte) setRapportTexte(data.texte)
      else showToast('❌ Erreur : ' + (data.error || 'Réponse vide'))
    } catch(e) {
      showToast('❌ Erreur génération : ' + e.message)
    }
    setRapportLoading(false)
  }

  async function deleteNote(noteId) {
    if (!window.confirm('Supprimer cette note ?')) return
    await supabase.from('journal_enfant').delete().eq('id', noteId)
    fetchJournal()
  }

  function openEditNote(note) {
    setEditNoteId(note.id)
    setNewNote({
      date: note.date,
      heure: note.heure || '',
      humeur: note.humeur || '😊',
      texte: note.texte,
      tags: (note.tags || []).join(', '),
      type_note: note.type_note || 'principal',
      relais_debut: note.relais_debut || '',
      relais_fin: note.relais_fin || '',
    })
    setShowNoteModal(true)
  }

  async function saveNote() {
    if (!newNote.texte) { showToast('⚠️ Texte requis'); return }
    setNoteLoading(true)
    const tags = newNote.tags ? newNote.tags.split(',').map(t => t.trim()).filter(Boolean) : []
    const payload = {
      date: newNote.date,
      heure: newNote.heure || null,
      humeur: newNote.humeur,
      texte: newNote.texte,
      tags,
      type_note: newNote.type_note || 'principal',
      relais_debut: newNote.type_note === 'relais' ? newNote.relais_debut || null : null,
      relais_fin: newNote.type_note === 'relais' ? newNote.relais_fin || null : null,
    }

    let error
    if (editNoteId) {
      // Modification
      const res = await supabase.from('journal_enfant').update(payload).eq('id', editNoteId)
      error = res.error
    } else {
      // Création
      const res = await supabase.from('journal_enfant').insert({ ...payload, enfant_id: id, auteur_id: profile.id })
      error = res.error
    }

    if (!error) {
      showToast(editNoteId ? '✅ Note modifiée !' : '✅ Note ajoutée !')
      setShowNoteModal(false)
      setEditNoteId(null)
      setNewNote({ date: new Date().toISOString().slice(0,10), heure:'', humeur:'😊', texte:'', tags:'', type_note:'principal', relais_debut:'', relais_fin:'' })
      fetchJournal()
    } else showToast('❌ Erreur')
    setNoteLoading(false)
  }

  if (loading) return (
    <div className="app-layout">
      <Sidebar profile={profile} />
      <div className="main-content" style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
        <div style={{ textAlign:'center', color:'#9aa3b8' }}>
          <div style={{ fontSize:36, marginBottom:12 }}>👶</div>
          <div>Chargement du dossier...</div>
        </div>
      </div>
    </div>
  )

  if (!enfant) return (
    <div className="app-layout">
      <Sidebar profile={profile} />
      <div className="main-content" style={{ padding:32 }}>
        <div style={{ color:'#c0392b' }}>❌ Dossier introuvable</div>
        <button onClick={() => navigate('/enfants')} style={{ marginTop:12 }} className="btn btn-secondary">← Retour</button>
      </div>
    </div>
  )

  const initiales = `${enfant.prenom?.[0] || ''}${enfant.nom?.[0] || ''}`
  const age = calcAge(enfant.date_naissance)
  const isAfPrincipal = isAF && enfant.af_principal_id === profile?.id
  const canEditSante = canEdit || isAfPrincipal

  const ONGLETS = [
    { id:'identite',  icon:'🪪',  label:'Identité',         hidden: nonPlace },
    { id:'famille',   icon:'👨‍👩‍👧', label:'Famille',          hidden: nonPlace || isAfRelaisActif },
    { id:'placement', icon:'🏠',  label:'Placement',         hidden: nonPlace || isAfRelaisActif },
    { id:'judiciaire',icon:'⚖️',  label:'Judiciaire',        restricted: isAF, hidden: nonPlace || isAfRelaisActif },
    { id:'quotidien', icon:'🌱',  label:'Vie quotidienne',   hidden: nonPlace },
    { id:'docs',      icon:'📂',  label:'Docs',              hidden: nonPlace || isAfRelaisActif },
    { id:'journal',   icon:'📝',  label:'Journal',           hidden: nonPlace, badge: journalNotes.length > 0 ? journalNotes.filter(n => {
      const d = new Date(n.date); const now = new Date(); return (now - d) < 7 * 24 * 3600 * 1000
    }).length : 0 },
  ].filter(o => !o.hidden)


  // Encarts visuels personnalisés par type de document
  function renderDocVisuel(docKey, fields, vFn) {
    if (docKey === 'vitale') return (
      <div style={{ background:'linear-gradient(135deg,#1a8c3c 60%,#f5c800 100%)', borderRadius:10, padding:'12px 14px', marginBottom:10, position:'relative', minHeight:70 }}>
        <div style={{ color:'#fff', fontSize:16, fontWeight:800, letterSpacing:1, marginBottom:4 }}>Vitale</div>
        <div style={{ background:'rgba(255,255,255,0.2)', borderRadius:4, width:28, height:20, marginBottom:6, display:'inline-block' }} />
        <div style={{ background:'rgba(255,255,255,0.85)', borderRadius:5, padding:'4px 8px', display:'inline-block', fontSize:11, fontWeight:600, color:'#1a8c3c', letterSpacing:1 }}>
          {vFn('vitale_numero') || '— — — — — — — —'}
        </div>
        <div style={{ fontSize:10, color:'rgba(255,255,255,0.8)', marginTop:4 }}>{vFn('mutuelle') || 'Mutuelle —'}</div>
      </div>
    )
    if (docKey === 'cni') return (
      <div style={{ background:'linear-gradient(135deg,#1a3c8c 70%,#3a6fd8 100%)', borderRadius:10, padding:'12px 14px', marginBottom:10, minHeight:70 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div>
            <div style={{ color:'rgba(255,255,255,0.7)', fontSize:9, letterSpacing:1, marginBottom:2 }}>CARTE NATIONALE D'IDENTITÉ</div>
            <div style={{ color:'#fff', fontSize:11, fontWeight:700, letterSpacing:.5 }}>RÉPUBLIQUE FRANÇAISE</div>
          </div>
          <div style={{ width:28, height:28, borderRadius:'50%', background:'rgba(255,255,255,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>🇫🇷</div>
        </div>
        <div style={{ background:'rgba(255,255,255,0.15)', borderRadius:5, padding:'4px 8px', marginTop:6, display:'inline-block', fontSize:11, color:'#fff', letterSpacing:1 }}>
          {vFn('cni_numero') || 'N° — — — — — —'}
        </div>
        {vFn('cni_expiration') && <div style={{ fontSize:9, color:'rgba(255,255,255,0.7)', marginTop:3 }}>Exp. {new Date(vFn('cni_expiration')).toLocaleDateString('fr-FR')}</div>}
      </div>
    )
    if (docKey === 'passeport') return (
      <div style={{ background:'linear-gradient(135deg,#1a3c5c 70%,#2d7abf 100%)', borderRadius:10, padding:'12px 14px', marginBottom:10, minHeight:70 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div>
            <div style={{ color:'rgba(255,255,255,0.7)', fontSize:9, letterSpacing:1, marginBottom:2 }}>PASSEPORT</div>
            <div style={{ color:'#fff', fontSize:11, fontWeight:700 }}>FRANCE</div>
          </div>
          <div style={{ fontSize:22 }}>📘</div>
        </div>
        <div style={{ background:'rgba(255,255,255,0.15)', borderRadius:5, padding:'4px 8px', marginTop:6, display:'inline-block', fontSize:11, color:'#fff', letterSpacing:1 }}>
          {vFn('passeport_numero') || 'N° — — — — — —'}
        </div>
        {vFn('passeport_expiration') && <div style={{ fontSize:9, color:'rgba(255,255,255,0.7)', marginTop:3 }}>Exp. {new Date(vFn('passeport_expiration')).toLocaleDateString('fr-FR')}</div>}
      </div>
    )
    if (docKey === 'livret_famille') return (
      <div style={{ background:'linear-gradient(135deg,#7c3aed 70%,#a78bfa 100%)', borderRadius:10, padding:'12px 14px', marginBottom:10, minHeight:70 }}>
        <div style={{ color:'rgba(255,255,255,0.8)', fontSize:9, letterSpacing:1, marginBottom:2 }}>LIVRET DE FAMILLE</div>
        <div style={{ fontSize:28, marginBottom:2 }}>👨‍👩‍👧</div>
        <div style={{ color:'rgba(255,255,255,0.9)', fontSize:10 }}>RÉPUBLIQUE FRANÇAISE</div>
      </div>
    )
    if (docKey === 'carnet_sante') return (
      <div style={{ background:'linear-gradient(135deg,#166534 70%,#4ade80 100%)', borderRadius:10, padding:'12px 14px', marginBottom:10, minHeight:70 }}>
        <div style={{ color:'rgba(255,255,255,0.8)', fontSize:9, letterSpacing:1, marginBottom:4 }}>CARNET DE SANTÉ</div>
        <div style={{ fontSize:28 }}>📗</div>
        <div style={{ color:'rgba(255,255,255,0.8)', fontSize:10, marginTop:2 }}>Suivi médical</div>
      </div>
    )
    if (docKey === 'carnet_vaccination') return (
      <div style={{ background:'linear-gradient(135deg,#b45309 70%,#fbbf24 100%)', borderRadius:10, padding:'12px 14px', marginBottom:10, minHeight:70 }}>
        <div style={{ color:'rgba(255,255,255,0.8)', fontSize:9, letterSpacing:1, marginBottom:4 }}>CARNET DE VACCINATION</div>
        <div style={{ fontSize:28 }}>💉</div>
        <div style={{ color:'rgba(255,255,255,0.8)', fontSize:10, marginTop:2 }}>Vaccinations</div>
      </div>
    )
    return null
  }

  return (
    <div className="app-layout">
      <Sidebar profile={profile} />
      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
        .dossier-content { animation: fadeIn .2s ease; }
      `}</style>
      <div className="main-content">

        {/* ── Header ── */}
        <header className="page-header">
          <img src="/logo_transparent.png" alt="P" className="header-logo" onError={e => e.target.style.display='none'} />
          <div className="header-sep" />
          <button onClick={() => navigate('/enfants')}
            style={{ display:'flex', alignItems:'center', gap:6, color:'#1a4b8f', fontSize:13, fontWeight:500, cursor:'pointer', background:'none', border:'none', fontFamily:'Sora,sans-serif', padding:'6px 10px', borderRadius:8 }}
            onMouseOver={e => e.currentTarget.style.background='#e8eef8'}
            onMouseOut={e => e.currentTarget.style.background='none'}>
            ← Enfants
          </button>
          <div className="header-sep" />

          {/* Avatar + nom enfant */}
          <div style={{ display:'flex', alignItems:'center', gap:12, flex:1 }}>
            <div style={{ width:40, height:40, borderRadius:'50%', overflow:'hidden', flexShrink:0, background:'linear-gradient(135deg,#1a4b8f,#2e8b4a)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              {photoUrl ? <img src={photoUrl} alt="photo" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <span style={{ fontSize:14, fontWeight:700, color:'#fff' }}>{initiales}</span>}
            </div>
            <div>
              <div className="page-title">{enfant.nom} {enfant.prenom}</div>
              <div className="page-subtitle">
                {age}{enfant.date_naissance && ` · Né(e) le ${fmtDate(enfant.date_naissance)}`}
                {enfant.numero_dossier && ` · ${enfant.numero_dossier}`}
                {enfant.type_placement === 'secret' && <span style={{ marginLeft:8, background:'#fdf0f0', border:'1px solid #f5c4c4', color:'#8b1a1a', padding:'1px 8px', borderRadius:10, fontSize:10, fontWeight:700 }}>🔒 Secret</span>}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="header-actions">
            {editMode ? (
              <>
                <button onClick={() => { setForm(enfant); setEditMode(false) }} className="btn btn-danger">✕ Annuler</button>
                <button onClick={saveForm} disabled={saving} className="btn btn-primary">
                  {saving ? '⏳ Enregistrement...' : '💾 Enregistrer'}
                </button>
              </>
            ) : (
              <>
                {canEdit && <button onClick={() => setEditMode(true)} className="btn btn-secondary">✏️ Modifier</button>}
              </>
            )}
          </div>
        </header>

        {/* ── Contenu ── */}
        <div style={{ padding:24 }}>

          {/* Onglets */}
          <div style={{ display:'flex', gap:4, background:'#fff', border:'1px solid #dde3f0', borderRadius:12, padding:6, marginBottom:24, boxShadow:'0 2px 12px rgba(26,75,143,.08)', flexWrap:'wrap' }}>
            {ONGLETS.map(o => (
              <button key={o.id}
                onClick={() => !o.restricted && setOnglet(o.id)}
                style={{
                  display:'flex', alignItems:'center', gap:7, padding:'9px 16px', borderRadius:8,
                  fontSize:13, fontWeight:500, cursor: o.restricted ? 'not-allowed' : 'pointer',
                  border:'none', fontFamily:'Sora,sans-serif', transition:'all .15s', whiteSpace:'nowrap',
                  background: onglet === o.id ? '#1a4b8f' : 'none',
                  color: o.restricted ? '#9aa3b8' : onglet === o.id ? '#fff' : '#5a6478',
                  opacity: o.restricted ? .5 : 1
                }}>
                <span style={{ fontSize:15 }}>{o.icon}</span>
                {o.label}
                {o.badge > 0 && <span style={{ background:'#c0392b', color:'#fff', fontSize:9, padding:'1px 5px', borderRadius:10, fontWeight:700 }}>{o.badge}</span>}
              </button>
            ))}
          </div>

          <div className="dossier-content">

            {/* ══════════════════════════════════════════════════════════════
                ONGLET IDENTITÉ
            ══════════════════════════════════════════════════════════════ */}
            {onglet === 'identite' && (
              <>
                <SectionCard icon="👤" title="État civil">
                  <div style={{ display:'grid', gridTemplateColumns:'120px 1fr', gap:20, marginBottom:20 }}>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
                      <div style={{ width:100, height:120, borderRadius:10, overflow:'hidden', background:'#eef1f8', border:'2px solid #dde3f0', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        {photoUrl ? <img src={photoUrl} alt="photo enfant" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <div style={{ textAlign:'center', color:'#9aa3b8' }}><div style={{ fontSize:32 }}>👶</div><div style={{ fontSize:10 }}>Photo</div></div>}
                      </div>
                      {editMode && (
                        <label style={{ padding:'4px 10px', border:'1px dashed #c4d4f5', borderRadius:7, background:'#e8eef8', color:'#1a4b8f', fontSize:11, cursor:'pointer', textAlign:'center' }}>
                          {uploadingDoc === 'photo_enfant' ? '⏳...' : '📷 Changer'}
                          <input type="file" accept="image/*" style={{ display:'none' }} onChange={async e => {
                            if (!e.target.files[0]) return
                            const file = e.target.files[0], ext = file.name.split('.').pop()
                            const path = `enfants/${id}/photos/photo.${ext}`
                            setUploadingDoc('photo_enfant')
                            await supabase.storage.from('documents-enfants').upload(path, file, { contentType: file.type, upsert: true })
                            const { data: url } = await supabase.storage.from('documents-enfants').createSignedUrl(path, 3600)
                            if (url?.signedUrl) setPhotoUrl(url.signedUrl)
                            setUploadingDoc(null)
                          }} />
                        </label>
                      )}
                    </div>
                    <FormGrid cols={3}>
                    <Field label="Nom de famille" value={v('nom')} onChange={F('nom')} readOnly={!editMode} />
                    <Field label="Prénom" value={v('prenom')} onChange={F('prenom')} readOnly={!editMode} />
                    <Field label="Date de naissance" type="date" value={v('date_naissance')} onChange={F('date_naissance')} readOnly={!editMode} />
                    <Field label="Lieu de naissance" value={v('lieu_naissance')} onChange={F('lieu_naissance')} readOnly={!editMode} placeholder="Ville (dép.)" />
                    <Field label="Nationalité" value={v('nationalite')} onChange={F('nationalite')} readOnly={!editMode} placeholder="Française" />
                    <Field label="Sexe" value={v('sexe')} onChange={F('sexe')} readOnly={!editMode}
                      options={['Féminin','Masculin','Autre']} />
                    <div style={{ display:'flex', flexDirection:'column', gap:5, gridColumn:'span 2' }}>
                      <label style={{ fontSize:11, fontWeight:600, color:'#5a6478', letterSpacing:'.4px', textTransform:'uppercase' }}>N° de sécurité sociale</label>
                      {!editMode ? (
                        <div style={{ padding:'10px 12px', background:'#eef1f8', borderRadius:8, fontSize:13, color:'#1c2333', fontFamily:'Sora,sans-serif', letterSpacing:'1px' }}>
                          {v('numero_secu') || <span style={{ color:'#9aa3b8', fontStyle:'italic', fontFamily:'Sora,sans-serif' }}>—</span>}
                        </div>
                      ) : (
                        <input
                          value={v('numero_secu')}
                          onChange={e => {
                            // Formater automatiquement : 1 85 06 75 113 001 42
                            const raw = e.target.value.replace(/\s/g, '').slice(0, 15)
                            let formatted = raw
                            if (raw.length > 1) formatted = raw.slice(0,1) + ' ' + raw.slice(1)
                            if (raw.length > 3) formatted = raw.slice(0,1) + ' ' + raw.slice(1,3) + ' ' + raw.slice(3)
                            if (raw.length > 5) formatted = raw.slice(0,1) + ' ' + raw.slice(1,3) + ' ' + raw.slice(3,5) + ' ' + raw.slice(5)
                            if (raw.length > 7) formatted = raw.slice(0,1) + ' ' + raw.slice(1,3) + ' ' + raw.slice(3,5) + ' ' + raw.slice(5,7) + ' ' + raw.slice(7)
                            if (raw.length > 10) formatted = raw.slice(0,1) + ' ' + raw.slice(1,3) + ' ' + raw.slice(3,5) + ' ' + raw.slice(5,7) + ' ' + raw.slice(7,10) + ' ' + raw.slice(10)
                            if (raw.length > 13) formatted = raw.slice(0,1) + ' ' + raw.slice(1,3) + ' ' + raw.slice(3,5) + ' ' + raw.slice(5,7) + ' ' + raw.slice(7,10) + ' ' + raw.slice(10,13) + ' ' + raw.slice(13)
                            F('numero_secu')(formatted)
                          }}
                          placeholder="1 85 06 75 113 001 42"
                          style={{ padding:'10px 12px', border:'1.5px solid #dde3f0', borderRadius:8, fontFamily:'Sora,sans-serif', fontSize:13, background:'#f4f6fb', color:'#1c2333', outline:'none', letterSpacing:'1px' }}
                        />
                      )}
                    </div>
                    <Field label="Caisse d'affiliation" value={v('caisse_affiliation')} onChange={F('caisse_affiliation')} readOnly={!editMode} placeholder="CPAM..." />
                    <Field label="N° dossier CD81" value={v('numero_dossier')} onChange={F('numero_dossier')} readOnly={!editMode} span={2} />
                    <Field label="Groupe sanguin" value={v('groupe_sanguin')} onChange={F('groupe_sanguin')} readOnly={!editMode}
                      options={['A+','A-','B+','B-','AB+','AB-','O+','O-']} />
                    </FormGrid>
                  </div>
                </SectionCard>

                <SectionCard icon="📄" title="Documents d'identité">
                  {(() => {
                    const DOCS = [
                      { key:'cni', icon:'🪪', label:"Carte Nationale d'Identité", fields:[{key:'cni_numero',label:'N° CNI'},{key:'cni_expiration',label:"Date d'expiration",type:'date'}] },
                      { key:'vitale', icon:'💳', label:'Carte Vitale', fields:[{key:'vitale_numero',label:'N° carte vitale'},{key:'mutuelle',label:'Mutuelle'}] },
                      { key:'passeport', icon:'📘', label:'Passeport', fields:[{key:'passeport_numero',label:'N° passeport'},{key:'passeport_expiration',label:"Date d'expiration",type:'date'}] },
                      { key:'livret_famille', icon:'📋', label:'Livret de famille', statusKey:'livret_famille_statut', options:['Disponible','Non disponible','En cours'] },
                      { key:'carnet_sante', icon:'📗', label:'Carnet de santé', statusKey:'carnet_sante_statut', options:['Disponible','Non disponible'] },
                      { key:'carnet_vaccination', icon:'💉', label:'Carnet de vaccination', statusKey:'vaccination_statut', options:['À jour','Non à jour','Inconnu'] },
                      { key:'extrait_naissance', icon:'📜', label:'Extrait de naissance', statusKey:'extrait_naissance_statut', options:['Disponible','Non disponible','En cours'] },
                    ]
                    const docsAvecScan = DOCS.filter(d => documents.some(doc => doc.type_doc === d.key))
                    const docsSansScan = DOCS.filter(d => !documents.some(doc => doc.type_doc === d.key))
                    return (
                      <>
                        {docsAvecScan.length > 0 && (
                          <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:16, marginBottom:16 }}>
                            {docsAvecScan.map(doc => {
                              const docsType = documents.filter(d => d.type_doc === doc.key)
                              return (
                                <div key={doc.key} style={{ background:'#f4f6fb', borderRadius:10, padding:14, border:'1px solid #dde3f0' }}>
                                  {renderDocVisuel(doc.key, doc.fields, v) || (
                                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                                      <span style={{ fontSize:22 }}>{doc.icon}</span>
                                      <span style={{ fontSize:12, fontWeight:600 }}>{doc.label}</span>
                                    </div>
                                  )}
                                  {/* Champs éditables en mode édition, ou si pas de visuel */}
                                  {(editMode || !renderDocVisuel(doc.key, doc.fields, v)) && doc.fields && doc.fields.map(f => (
                                    <div key={f.key} style={{ marginBottom:6 }}>
                                      <label style={{ fontSize:10, fontWeight:600, color:'#5a6478', textTransform:'uppercase', letterSpacing:'.3px', display:'block', marginBottom:2 }}>{f.label}</label>
                                      {editMode ? (
                                        <input type={f.type||'text'} value={v(f.key)} onChange={e => F(f.key)(e.target.value)}
                                          style={{ width:'100%', padding:'6px 10px', border:'1.5px solid #dde3f0', borderRadius:7, fontFamily:'Sora,sans-serif', fontSize:12, background:'#fff', outline:'none' }} />
                                      ) : (
                                        <div style={{ padding:'6px 10px', background:'#fff', borderRadius:7, fontSize:12, color: v(f.key) ? '#1c2333' : '#9aa3b8', border:'1px solid #dde3f0' }}>
                                          {f.type==='date' && v(f.key) ? fmtDate(v(f.key)) : v(f.key) || '—'}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                  {docsType.map(d => (
                                    <div key={d.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', background:'#fff', borderRadius:7, border:'1px solid #dde3f0', marginTop:6 }}>
                                      <span style={{ fontSize:16 }}>{d.mime_type?.includes('pdf') ? '📄' : '🖼️'}</span>
                                      <div style={{ flex:1, minWidth:0 }}>
                                        <div style={{ fontSize:11, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.nom}</div>
                                        <div style={{ fontSize:10, color:'#9aa3b8' }}>{d.taille ? `${Math.round(d.taille/1024)} Ko` : ''} · {new Date(d.created_at).toLocaleDateString('fr-FR')}</div>
                                      </div>
                                      <button onClick={() => viewDocument(d.storage_path)} style={{ padding:'3px 7px', borderRadius:5, border:'1px solid #dde3f0', background:'#fff', fontSize:11, cursor:'pointer' }}>👁</button>
                                      <button onClick={() => downloadDocument(d.storage_path, d.nom)} style={{ padding:'3px 7px', borderRadius:5, border:'1px solid #dde3f0', background:'#fff', fontSize:11, cursor:'pointer' }}>⬇</button>
                                      {isReferent && <button onClick={() => deleteDocument(d.id, d.storage_path)} style={{ padding:'3px 7px', borderRadius:5, border:'1px solid #fde8e8', background:'#fdf0ee', color:'#c0392b', fontSize:11, cursor:'pointer' }}>🗑</button>}
                                    </div>
                                  ))}
                                  <label style={{ display:'block', width:'100%', marginTop:6, padding:'5px', border:'1px dashed #c4d4f5', borderRadius:7, background:'#e8eef8', color:'#1a4b8f', fontSize:11, cursor:'pointer', textAlign:'center', fontFamily:'Sora,sans-serif' }}>
                                    {uploadingDoc === doc.key ? '⏳ Upload...' : '📎 Ajouter'}
                                    <input type="file" accept="image/*,application/pdf" style={{ display:'none' }}
                                      onChange={e => { if (e.target.files[0]) uploadDocument(e.target.files[0], doc.key) }} />
                                  </label>
                                </div>
                              )
                            })}
                          </div>
                        )}
                        {docsSansScan.length > 0 && (
                          <div style={{ background:'#fef3e2', border:'1px solid #f5dca4', borderRadius:10, padding:14 }}>
                            <div style={{ fontSize:12, fontWeight:700, color:'#d97706', marginBottom:10 }}>
                              ⚠️ Documents manquants ({docsSansScan.length})
                            </div>
                            <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                              {docsSansScan.map(doc => (
                                <label key={doc.key} style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:20, background:'#fff', border:'1px solid #f5dca4', fontSize:12, cursor:'pointer', fontFamily:'Sora,sans-serif' }}>
                                  <span>{doc.icon}</span>
                                  <span style={{ color:'#1c2333' }}>{doc.label}</span>
                                  <span style={{ color:'#1a4b8f', fontWeight:600, fontSize:11 }}>+ Scan</span>
                                  {uploadingDoc === doc.key && <span>⏳</span>}
                                  <input type="file" accept="image/*,application/pdf" style={{ display:'none' }}
                                    onChange={e => { if (e.target.files[0]) uploadDocument(e.target.files[0], doc.key) }} />
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )
                  })()}
                </SectionCard>
              </>
            )}

            {/* ══════════════════════════════════════════════════════════════
                ONGLET FAMILLE
            ══════════════════════════════════════════════════════════════ */}
            {onglet === 'famille' && (
              <>
                {[
                  { type:'pere', icon:'👨', label:'Père', data: pere },
                  { type:'mere', icon:'👩', label:'Mère', data: mere },
                ].map(({ type, icon, label, data }) => {
                  const masque = form[`${type}_masque`]
                  return (
                    <SectionCard key={type} icon={icon} title={
                      <div style={{ display:'flex', alignItems:'center', gap:10, width:'100%' }}>
                        <span>{label}</span>
                        {masque && <span style={{ padding:'2px 8px', borderRadius:10, background:'#fef3e2', color:'#d97706', fontSize:11, fontWeight:600 }}>Masqué</span>}
                        <div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
                          {isReferent && editMode && (
                            <button onClick={() => masquerParent(type)}
                              style={{ padding:'3px 10px', borderRadius:8, border:'1px solid #dde3f0', background: masque ? '#e6f5eb' : '#fdf0ee', color: masque ? '#2e8b4a' : '#c0392b', fontSize:11, cursor:'pointer' }}>
                              {masque ? '👁 Afficher' : '🙈 Masquer'}
                            </button>
                          )}
                        </div>
                      </div>
                    }>
                      {masque ? (
                        <div style={{ color:'#9aa3b8', fontStyle:'italic', fontSize:13 }}>
                          {label} masqué (famille monoparentale ou pupille de l'état)
                        </div>
                      ) : !data ? (
                        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                          <div style={{ color:'#9aa3b8', fontStyle:'italic', fontSize:13 }}>
                            Aucune information renseignée
                          </div>
                          {(editMode || isReferent || isAfPrincipal) && (
                            <button onClick={() => openParentModal(type)} className="btn btn-primary" style={{ fontSize:11 }}>
                              + Renseigner {label.toLowerCase() === 'père' ? 'le père' : 'la mère'}
                            </button>
                          )}
                        </div>
                      ) : (
                        <>
                        {(editMode || isReferent || isAfPrincipal) && (
                          <div style={{ marginBottom:12 }}>
                            <button onClick={() => openParentModal(type)} className="btn btn-secondary" style={{ fontSize:11 }}>
                              ✏️ Modifier les infos {label.toLowerCase()}
                            </button>
                          </div>
                        )}
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:16 }}>
                          {[
                            { label:'Nom', v: data.nom },
                            { label:'Prénom', v: data.prenom },
                            { label:'Date de naissance', v: fmtDate(data.date_naissance) },
                            { label:'N° Sécu', v: data.numero_secu },
                            { label:'Téléphone', v: data.telephone, href: data.telephone ? `tel:${data.telephone}` : null },
                            { label:'Téléphone 2', v: data.telephone2, href: data.telephone2 ? `tel:${data.telephone2}` : null },
                            { label:'Email', v: data.email, href: data.email ? `mailto:${data.email}` : null, span: 1 },
                            { label:'Adresse', v: [data.adresse, data.code_postal, data.ville].filter(Boolean).join(' '), span: 3 },
                            { label:'Situation professionnelle', v: data.situation_pro },
                            { label:'Droits parentaux', v: data.droits_parentaux },
                            { label:'Droit de visite', v: data.droit_visite },
                            { label:'Notes', v: data.notes, span: 3 },
                          ].filter(f => f.v).map((f, i) => (
                            <div key={i} style={{ gridColumn: f.span ? `span ${f.span}` : 'span 1' }}>
                              <div style={{ fontSize:10, fontWeight:600, color:'#5a6478', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:3 }}>{f.label}</div>
                              <div style={{ padding:'8px 12px', background:'#f4f6fb', borderRadius:8, fontSize:13, color:'#1c2333', border:'1px solid #dde3f0' }}>
                                {f.href ? <a href={f.href} style={{ color:'#1a4b8f' }}>{f.v}</a> : f.v}
                              </div>
                            </div>
                          ))}
                        </div>
                        </>
                      )}

                      {/* Documents du parent */}
                      {(() => {
                        const docsType = type === 'pere' ? docsPereFiche : docsMereFiche
                        return (
                          <div style={{ marginTop:14, borderTop:'1px solid #eef1f8', paddingTop:12 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                              <span style={{ fontSize:12, fontWeight:700, color:'#1a4b8f' }}>📎 Documents</span>
                              <span style={{ fontSize:10, color:'#9aa3b8' }}>({docsType.length})</span>
                              <button onClick={() => openParentModal(type)}
                                style={{ marginLeft:'auto', padding:'3px 8px', borderRadius:6, border:'1px solid #c4d4f5', background:'#e8eef8', color:'#1a4b8f', fontSize:11, cursor:'pointer' }}>
                                + Ajouter
                              </button>
                            </div>
                            {docsType.length === 0 ? (
                              <div style={{ fontSize:12, color:'#9aa3b8', fontStyle:'italic' }}>Aucun document</div>
                            ) : (
                              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                                {docsType.map(d => (
                                  <div key={d.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 10px', background:'#f4f6fb', borderRadius:7, border:'1px solid #dde3f0' }}>
                                    <span>{d.mime_type?.includes('pdf') ? '📄' : '🖼️'}</span>
                                    <span style={{ fontSize:11, flex:1 }}>{d.nom}</span>
                                    <button onClick={async () => {
                                      const { data: url } = await supabase.storage.from('documents-enfants').createSignedUrl(d.storage_path, 3600)
                                      if (url?.signedUrl) window.open(url.signedUrl, '_blank')
                                    }} style={{ padding:'3px 7px', borderRadius:5, border:'1px solid #dde3f0', background:'#fff', fontSize:11, cursor:'pointer' }}>👁</button>
                                    <button onClick={async () => {
                                      const { data: url } = await supabase.storage.from('documents-enfants').createSignedUrl(d.storage_path, 60)
                                      if (url?.signedUrl) {
                                        const resp = await fetch(url.signedUrl)
                                        const blob = await resp.blob()
                                        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = d.nom
                                        document.body.appendChild(a); a.click(); document.body.removeChild(a)
                                      }
                                    }} style={{ padding:'3px 7px', borderRadius:5, border:'1px solid #dde3f0', background:'#fff', fontSize:11, cursor:'pointer' }}>⬇</button>
                                    {isReferent && <button onClick={() => deleteDocParent(d.id, d.storage_path, type === 'pere' ? enfant?.pere_id : enfant?.mere_id)}
                                      style={{ padding:'3px 7px', borderRadius:5, border:'1px solid #fde8e8', background:'#fdf0ee', color:'#c0392b', fontSize:11, cursor:'pointer' }}>🗑</button>}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })()}
                    </SectionCard>
                  )
                })}

                <SectionCard icon="👧👦" title="Fratrie">
                  {(form.fratrie || []).map((f, i) => (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', background:'#f4f6fb', borderRadius:8, marginBottom:8, border:'1px solid #dde3f0' }}>
                      <div style={{ width:36, height:36, borderRadius:'50%', background:'#e8eef8', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>
                        {f.sexe === 'F' ? '👧' : '👦'}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:600 }}>{f.prenom} {f.nom}</div>
                        <div style={{ fontSize:11, color:'#9aa3b8' }}>
                          {f.ddn && `${calcAge(f.ddn)} · Né(e) le ${fmtDate(f.ddn)}`}
                        </div>
                      </div>
                      <span style={{ padding:'3px 10px', borderRadius:10, fontSize:11, fontWeight:600,
                        background: f.meme_af ? '#e6f5eb' : '#fef3e2',
                        color: f.meme_af ? '#2e8b4a' : '#d97706' }}>
                        {f.meme_af ? "Même famille d'accueil" : "Autre famille d'accueil"}
                      </span>
                      {f.enfant_id && (
                        <button onClick={() => navigate(`/enfants/${f.enfant_id}`)}
                          style={{ padding:'4px 10px', borderRadius:6, border:'1px solid #c4d4f5', background:'#e8eef8', color:'#1a4b8f', fontSize:11, cursor:'pointer', fontWeight:600 }}>
                          👁 Fiche
                        </button>
                      )}
                      {editMode && (
                        <button onClick={() => setForm(prev => ({ ...prev, fratrie: prev.fratrie.filter((_,j) => j !== i) }))}
                          style={{ padding:'4px 8px', borderRadius:6, border:'1px solid #dde3f0', background:'#fff', color:'#c0392b', fontSize:11, cursor:'pointer' }}>✕</button>
                      )}
                    </div>
                  ))}
                  {editMode && (
                    <button onClick={() => { setShowFratrieModal(true); setFratrieMode('question') }}
                      className="btn btn-secondary" style={{ marginTop:8 }}>
                      + Ajouter un membre de la fratrie
                    </button>
                  )}
                  {(!form.fratrie || form.fratrie.length === 0) && !editMode && (
                    <div style={{ color:'#9aa3b8', fontStyle:'italic', fontSize:13 }}>Aucun membre de la fratrie renseigné</div>
                  )}
                </SectionCard>
              </>
            )}

            {onglet === 'placement' && (
              <>
                {/* ── TYPE DE PLACEMENT ── */}
                <SectionCard icon="🏠" title="Type de placement">
                  {(() => {
                    const placements = [
                      { v:'judiciaire',    icon:'⚖️',  label:'Judiciaire',    desc:'Décision du juge' },
                      { v:'administratif', icon:'📋',  label:'Administratif', desc:'Accord parental' },
                      { v:'urgence',       icon:'🚨',  label:'Urgence',       desc:'Placement immédiat' },
                      { v:'aemo',          icon:'👁',  label:'AEMO',          desc:'Action éducative' },
                      { v:'aemo_r',        icon:'👁',  label:'AEMO-R',        desc:'Renforcé' },
                      { v:'secret',        icon:'🔒',  label:'Secret',        desc:'Adresse masquée', secret:true },
                    ]
                    const selected = placements.find(p => p.v === form.type_placement)
                    return editMode ? (
                      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
                        {placements.map(p => (
                          <div key={p.v}
                            style={{ flex:1, minWidth:90, padding:'12px 8px', borderRadius:12, textAlign:'center',
                              border:`2px solid ${form.type_placement === p.v ? (p.secret ? '#8b1a1a' : '#1a4b8f') : '#dde3f0'}`,
                              background: form.type_placement === p.v ? (p.secret ? '#fdf0f0' : '#e8eef8') : '#f4f6fb', opacity: form.type_placement === p.v ? 1 : 0.4 }}>
                            <div style={{ fontSize:22, marginBottom:4 }}>{p.icon}</div>
                            <div style={{ fontSize:11, fontWeight:700, color: form.type_placement === p.v ? (p.secret ? '#8b1a1a' : '#1a4b8f') : '#1c2333' }}>{p.label}</div>
                          </div>
                        ))}
                      </div>
                    ) : selected ? (
                      <div style={{ display:'inline-flex', alignItems:'center', gap:12, padding:'12px 20px', borderRadius:12,
                        border:`2px solid ${selected.secret ? '#8b1a1a' : '#1a4b8f'}`,
                        background: selected.secret ? '#fdf0f0' : '#e8eef8', marginBottom:16 }}>
                        <span style={{ fontSize:28 }}>{selected.icon}</span>
                        <div>
                          <div style={{ fontSize:15, fontWeight:700, color: selected.secret ? '#8b1a1a' : '#1a4b8f' }}>{selected.label}</div>
                          <div style={{ fontSize:12, color:'#9aa3b8' }}>{selected.desc}</div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ color:'#9aa3b8', fontStyle:'italic', fontSize:13, marginBottom:16 }}>Type de placement non renseigné</div>
                    )
                  })()}

                  {form.type_placement === 'secret' && (
                    <div style={{ background:'#fdf0f0', border:'1px solid #f5c4c4', borderRadius:10, padding:'12px 16px', marginBottom:12, fontSize:13, color:'#8b1a1a', display:'flex', gap:10 }}>
                      <span style={{ fontSize:18 }}>🔒</span>
                      <div><strong>Placement secret</strong> — Adresse AF, téléphone, ville et école masqués sur les documents destinés aux parents.</div>
                    </div>
                  )}

                  <FormGrid cols={3}>
                    <Field label="Date de placement" type="date" value={v('date_placement')} onChange={F('date_placement')} readOnly={true} />
                    <Field label="Date de fin prévue" type="date" value={v('date_fin_placement')} onChange={F('date_fin_placement')} readOnly={true} />
                    <Field label="Durée" readOnly value={
                      form.date_placement && form.date_fin_placement ? (() => {
                        const d1 = new Date(form.date_placement), d2 = new Date(form.date_fin_placement)
                        const mois = Math.round((d2-d1)/(1000*60*60*24*30))
                        return mois >= 12 ? `${Math.round(mois/12)} an(s)` : `${mois} mois`
                      })() : '—'
                    } />
                  </FormGrid>
                  <div style={{ fontSize:11, color:'#9aa3b8', fontStyle:'italic', marginTop:8 }}>
                    📌 Les dates sont modifiables dans l'onglet ⚖️ Judiciaire
                  </div>
                </SectionCard>

                {/* ── MAISON DU DÉPARTEMENT ── */}
                <SectionCard icon="🏛️" title="Maison du Département">
                  {editMode ? (
                    <div style={{ marginBottom:16 }}>
                      <label style={{ fontSize:11, fontWeight:600, color:'#5a6478', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:6 }}>Sélectionner la MD</label>
                      <select className="form-control" style={{ maxWidth:400 }}
                        value={v('md_id') || ''}
                        onChange={e => {
                          const md = maisonsDept.find(m => m.id === e.target.value)
                          if (md) {
                            F('md_id')(md.id)
                            F('md_nom')(md.nom)
                            F('md_adresse')(`${md.adresse}, ${md.code_postal} ${md.ville}`)
                            F('md_tel')(md.telephone)
                            F('md_email')(md.email)
                            F('territoire')(md.territoire)
                          }
                        }}>
                        <option value="">— Sélectionner une MD —</option>
                        {maisonsDept.map(md => (
                          <option key={md.id} value={md.id}>{md.nom} — {md.ville}</option>
                        ))}
                      </select>
                    </div>
                  ) : null}

                  {v('md_nom') && (
                    <div style={{ background:'#f4f6fb', borderRadius:10, padding:16, border:'1px solid #dde3f0', marginBottom:16 }}>
                      <div style={{ fontSize:14, fontWeight:700, color:'#1a4b8f', marginBottom:6 }}>🏛️ {v('md_nom')}</div>
                      {v('md_adresse') && <div style={{ fontSize:13, color:'#5a6478' }}>📍 {v('md_adresse')}</div>}
                      {v('md_tel') && <div style={{ fontSize:13, color:'#5a6478', marginTop:4 }}>📞 <a href={`tel:${v('md_tel')}`} style={{ color:'#1a4b8f' }}>{v('md_tel')}</a></div>}
                      {v('md_email') && <div style={{ fontSize:13, color:'#5a6478', marginTop:4 }}>✉️ <a href={`mailto:${v('md_email')}`} style={{ color:'#1a4b8f' }}>{v('md_email')}</a></div>}
                    </div>
                  )}

                  {/* Contacts ASE */}
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:12, marginTop:12 }}>
                    {/* AF, Référent et Gestionnaire — sélecteurs profils */}
                    {[
                      { role:'referent',     icon:'👩‍💼', label:'Référent(e) Enfant',   bg:'#e8eef8', idKey:'referent_id',     data: enfant.referent },
                      { role:'af',           icon:'👨‍👩‍👧', label:'AF Principal',         bg:'#e6f5eb', idKey:'af_principal_id', data: enfant.af_principal },
                      { role:'gestionnaire', icon:'👨‍💼', label:'Gestionnaire Enfant',   bg:'#fef3e2', idKey:'gestionnaire_id', data: null },
                    ].map(({ role, icon, label, bg, idKey, data }) => {
                      const profil = collegues.find(c => c.id === v(idKey)) || data
                      return (
                        <div key={role} style={{ background: bg, borderRadius:10, padding:14, border:'1px solid #dde3f0' }}>
                          <div style={{ fontSize:11, fontWeight:600, color:'#5a6478', textTransform:'uppercase', letterSpacing:'.3px', marginBottom:8 }}>
                            {icon} {label}
                          </div>
                          {editMode ? (
                            <select className="form-control" value={v(idKey) || ''} onChange={e => F(idKey)(e.target.value)} style={{ fontSize:12 }}>
                              <option value="">— Sélectionner —</option>
                              {collegues.filter(c => role === 'af' ? c.role === 'af' : ['referent','encadrant','rtase','admin'].includes(c.role)).map(c => (
                                <option key={c.id} value={c.id}>{c.nom} {c.prenom}</option>
                              ))}
                            </select>
                          ) : profil ? (
                            <div>
                              <div style={{ fontSize:13, fontWeight:600 }}>{profil.nom} {profil.prenom}</div>
                              {profil.telephone && <div style={{ fontSize:11, color:'#5a6478', marginTop:3 }}>📞 <a href={`tel:${profil.telephone}`} style={{ color:'#1a4b8f' }}>{profil.telephone}</a></div>}
                              {profil.email && <div style={{ fontSize:11, color:'#5a6478', marginTop:2 }}>✉️ <a href={`mailto:${profil.email}`} style={{ color:'#1a4b8f' }}>{profil.email}</a></div>}
                            </div>
                          ) : (
                            <div style={{ fontSize:12, color:'#9aa3b8', fontStyle:'italic' }}>Non renseigné</div>
                          )}
                        </div>
                      )
                    })}

                    {/* Santé, Gestionnaire, RTASE — champs texte libres */}
                    {[
                      { icon:'👩‍⚕️', label:'Référent(e) Santé',          bg:'#f0ebfb', nomKey:'ref_sante_nom',        telKey:'ref_sante_tel',        emailKey:'ref_sante_email' },

                      { icon:'🎖️', label:'Responsable Territorial ASE',  bg:'#e6f5eb', nomKey:'rt_ase_nom',            telKey:'rt_ase_tel',            emailKey:'rt_ase_email' },
                    ].map(({ icon, label, bg, nomKey, telKey, emailKey }) => (
                      <div key={nomKey} style={{ background: bg, borderRadius:10, padding:14, border:'1px solid #dde3f0' }}>
                        <div style={{ fontSize:11, fontWeight:600, color:'#5a6478', textTransform:'uppercase', letterSpacing:'.3px', marginBottom:8 }}>
                          {icon} {label}
                        </div>
                        {editMode ? (
                          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                            <input className="form-control" style={{ fontSize:12 }} value={v(nomKey)||''} onChange={e=>F(nomKey)(e.target.value)} placeholder="Nom Prénom" />
                            <input className="form-control" style={{ fontSize:12 }} value={v(telKey)||''} onChange={e=>F(telKey)(e.target.value)} placeholder="📞 Téléphone" />
                            <input className="form-control" style={{ fontSize:12 }} value={v(emailKey)||''} onChange={e=>F(emailKey)(e.target.value)} placeholder="✉️ Email" />
                          </div>
                        ) : v(nomKey) ? (
                          <div>
                            <div style={{ fontSize:13, fontWeight:600, marginBottom:4 }}>{v(nomKey)}</div>
                            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                              {v(telKey)&&<a href={`tel:${v(telKey)}`} style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 8px', borderRadius:6, background:'#e8eef8', color:'#1a4b8f', fontSize:11, textDecoration:'none' }}>📞 {v(telKey)}</a>}
                              {v(emailKey)&&<a href={`mailto:${v(emailKey)}`} style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 8px', borderRadius:6, background:'#e6f5eb', color:'#2e8b4a', fontSize:11, textDecoration:'none' }}>✉️ {v(emailKey)}</a>}
                            </div>
                          </div>
                        ) : (
                          <div style={{ fontSize:12, color:'#9aa3b8', fontStyle:'italic' }}>Non renseigné — cliquez sur Modifier</div>
                        )}
                      </div>
                    ))}
                  </div>
                </SectionCard>

                {/* ── DOCUMENTS PLACEMENT ── */}
                <SectionCard icon="📄" title="Documents placement">
                  {(() => {
                    const DOCS_PLACEMENT = [
                      { key:'contrat_accueil',   icon:'📋', label:"Contrat d'accueil" },
                      { key:'projet_accueil',    icon:'📝', label:"Projet pour l'enfant (PPE)" },
                      { key:'autre_placement',   icon:'📎', label:'Autre document' },
                    ]
                    const docsPlacement = documents.filter(d => ['contrat_accueil','projet_accueil','rapport_situation','autre_placement'].includes(d.type_doc))
                    const docsSansUpload = DOCS_PLACEMENT.filter(d => !docsPlacement.some(doc => doc.type_doc === d.key))

                    return (
                      <>
                        {/* Documents uploadés */}
                        {docsPlacement.length > 0 && (
                          <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:12 }}>
                            {docsPlacement.map(d => (
                              <div key={d.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', background:'#f4f6fb', borderRadius:8, border:'1px solid #dde3f0' }}>
                                <span style={{ fontSize:18 }}>{d.mime_type?.includes('pdf') ? '📄' : '🖼️'}</span>
                                <div style={{ flex:1, minWidth:0 }}>
                                  <div style={{ fontSize:12, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.nom}</div>
                                  <div style={{ fontSize:10, color:'#9aa3b8' }}>{d.taille ? `${Math.round(d.taille/1024)} Ko` : ''} · {fmtDate(d.created_at?.slice(0,10))}</div>
                                </div>
                                <button onClick={async () => { const { data: url } = await supabase.storage.from('documents-enfants').createSignedUrl(d.storage_path, 3600); if (url?.signedUrl) window.open(url.signedUrl, '_blank') }}
                                  style={{ padding:'3px 7px', borderRadius:5, border:'1px solid #dde3f0', background:'#fff', fontSize:11, cursor:'pointer' }}>👁</button>
                                <button onClick={async () => { const { data: url } = await supabase.storage.from('documents-enfants').createSignedUrl(d.storage_path, 60); if (url?.signedUrl) { const resp = await fetch(url.signedUrl); const blob = await resp.blob(); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = d.nom; document.body.appendChild(a); a.click(); document.body.removeChild(a) } }}
                                  style={{ padding:'3px 7px', borderRadius:5, border:'1px solid #dde3f0', background:'#fff', fontSize:11, cursor:'pointer' }}>⬇</button>
                                {isReferent && <button onClick={() => deleteDocument(d.id, d.storage_path)}
                                  style={{ padding:'3px 7px', borderRadius:5, border:'1px solid #fde8e8', background:'#fdf0ee', color:'#c0392b', fontSize:11, cursor:'pointer' }}>🗑</button>}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Documents manquants */}
                        {docsSansUpload.length > 0 && (
                          <div style={{ background:'#fef3e2', border:'1px solid #f5dca4', borderRadius:10, padding:12 }}>
                            <div style={{ fontSize:12, fontWeight:700, color:'#d97706', marginBottom:8 }}>
                              ⚠️ Documents manquants ({docsSansUpload.length})
                            </div>
                            <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                              {docsSansUpload.map(doc => (
                                <label key={doc.key} style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:20, background:'#fff', border:'1px solid #f5dca4', fontSize:12, cursor:'pointer', fontFamily:'Sora,sans-serif' }}>
                                  <span>{doc.icon}</span>
                                  <span style={{ color:'#1c2333' }}>{doc.label}</span>
                                  <span style={{ color:'#1a4b8f', fontWeight:600, fontSize:11 }}>+ Ajouter</span>
                                  {uploadingDoc === doc.key && <span>⏳</span>}
                                  <input type="file" accept="image/*,application/pdf" style={{ display:'none' }}
                                    onChange={e => { if (e.target.files[0]) uploadDocument(e.target.files[0], doc.key) }} />
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )
                  })()}
                </SectionCard>
              </>
            )}

            {/* ══════════════════════════════════════════════════════════════
                ONGLET JUDICIAIRE (restreint aux non-AF)
            ══════════════════════════════════════════════════════════════ */}
            {onglet === 'judiciaire' && !isAF && (
              <>
                <div style={{ background:'#fdf0ee', border:'1px solid #f5c4c4', borderRadius:10, padding:'12px 16px', display:'flex', alignItems:'center', gap:10, marginBottom:16, fontSize:13, color:'#c0392b' }}>
                  <span style={{ fontSize:18 }}>🔒</span>
                  <div><strong>Accès restreint</strong> — Visible uniquement par les référents, encadrants et gestionnaires.</div>
                </div>

                {/* Type de placement — modifiable ici */}
                <SectionCard icon="🏠" title="Type de placement">
                  <div style={{ display:'flex', gap:10, marginBottom:8, flexWrap:'wrap' }}>
                    {[
                      { v:'judiciaire',    icon:'⚖️',  label:'Judiciaire',    desc:'Décision du juge' },
                      { v:'administratif', icon:'📋',  label:'Administratif', desc:'Accord parental' },
                      { v:'urgence',       icon:'🚨',  label:'Urgence',       desc:'Placement immédiat' },
                      { v:'aemo',          icon:'👁',  label:'AEMO',          desc:'Action éducative' },
                      { v:'aemo_r',        icon:'👁',  label:'AEMO-R',        desc:'Renforcé' },
                      { v:'secret',        icon:'🔒',  label:'Secret',        desc:'Adresse masquée', secret:true },
                    ].map(p => (
                      <div key={p.v} onClick={() => editMode && F('type_placement')(p.v)}
                        style={{ flex:1, minWidth:90, padding:'12px 8px', borderRadius:12, textAlign:'center', cursor: editMode ? 'pointer' : 'default',
                          border:`2px solid ${form.type_placement === p.v ? (p.secret ? '#8b1a1a' : '#1a4b8f') : '#dde3f0'}`,
                          background: form.type_placement === p.v ? (p.secret ? '#fdf0f0' : '#e8eef8') : '#f4f6fb',
                          opacity: form.type_placement === p.v ? 1 : (editMode ? 1 : 0.4), transition:'all .15s' }}>
                        <div style={{ fontSize:22, marginBottom:4 }}>{p.icon}</div>
                        <div style={{ fontSize:11, fontWeight:700, color: form.type_placement === p.v ? (p.secret ? '#8b1a1a' : '#1a4b8f') : '#1c2333' }}>{p.label}</div>
                        <div style={{ fontSize:10, color:'#9aa3b8', marginTop:1 }}>{p.desc}</div>
                      </div>
                    ))}
                  </div>
                  <FormGrid cols={3}>
                    <Field label="Date de placement" type="date" value={v('date_placement')} onChange={F('date_placement')} readOnly={!editMode} />
                    <Field label="Date de fin prévue" type="date" value={v('date_fin_placement')} onChange={F('date_fin_placement')} readOnly={!editMode} />
                    <Field label="Durée" readOnly value={
                      form.date_placement && form.date_fin_placement ? (() => {
                        const d1 = new Date(form.date_placement), d2 = new Date(form.date_fin_placement)
                        const mois = Math.round((d2-d1)/(1000*60*60*24*30))
                        return mois >= 12 ? `${Math.round(mois/12)} an(s)` : `${mois} mois`
                      })() : '—'
                    } />
                  </FormGrid>
                </SectionCard>

                {/* Droits parentaux — modifiables ici */}
                <SectionCard icon="👨‍👩‍👧" title="Droits parentaux & Droits de visite">
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                    {[
                      { icon:'👨', label:'Père', idKey:'pere_id', parent: pere },
                      { icon:'👩', label:'Mère', idKey:'mere_id', parent: mere },
                    ].map(({ icon, label, idKey, parent: p }) => p && (
                      <div key={idKey} style={{ background:'#f4f6fb', borderRadius:10, padding:14, border:'1px solid #dde3f0' }}>
                        <div style={{ fontSize:13, fontWeight:700, marginBottom:12 }}>{icon} {label} — {p.prenom} {p.nom}</div>
                        <div style={{ marginBottom:10 }}>
                          <label style={{ fontSize:10, fontWeight:600, color:'#5a6478', textTransform:'uppercase', display:'block', marginBottom:4 }}>Droits parentaux</label>
                          {editMode ? (
                            <select value={p.droits_parentaux || ''} onChange={async e => {
                              await supabase.from('parents').update({ droits_parentaux: e.target.value }).eq('id', p.id)
                              if (idKey === 'pere_id') setPere(prev => ({ ...prev, droits_parentaux: e.target.value }))
                              else setMere(prev => ({ ...prev, droits_parentaux: e.target.value }))
                            }} style={{ width:'100%', padding:'8px 10px', border:'1.5px solid #dde3f0', borderRadius:7, fontFamily:'Sora,sans-serif', fontSize:12, background:'#fff', outline:'none' }}>
                              <option value="">—</option>
                              <option>Autorité parentale complète</option>
                              <option>Autorité parentale partielle</option>
                              <option>Déchéance partielle</option>
                              <option>Déchéance totale</option>
                            </select>
                          ) : (
                            <div style={{ padding:'7px 10px', background:'#fff', borderRadius:7, fontSize:12, color: p.droits_parentaux ? '#1c2333' : '#9aa3b8', border:'1px solid #dde3f0' }}>
                              {p.droits_parentaux || '—'}
                            </div>
                          )}
                        </div>
                        <div>
                          <label style={{ fontSize:10, fontWeight:600, color:'#5a6478', textTransform:'uppercase', display:'block', marginBottom:4 }}>Droit de visite</label>
                          {editMode ? (
                            <select value={p.droit_visite || ''} onChange={async e => {
                              await supabase.from('parents').update({ droit_visite: e.target.value }).eq('id', p.id)
                              if (idKey === 'pere_id') setPere(prev => ({ ...prev, droit_visite: e.target.value }))
                              else setMere(prev => ({ ...prev, droit_visite: e.target.value }))
                            }} style={{ width:'100%', padding:'8px 10px', border:'1.5px solid #dde3f0', borderRadius:7, fontFamily:'Sora,sans-serif', fontSize:12, background:'#fff', outline:'none' }}>
                              <option value="">—</option>
                              <option>Visite médiatisée</option>
                              <option>Visite libre</option>
                              <option>Mixte (médiatisé + temps libre)</option>
                              <option>Aucun droit</option>
                              <option>Suspendu</option>
                            </select>
                          ) : (
                            <div style={{ padding:'7px 10px', background:'#fff', borderRadius:7, fontSize:12, color: p.droit_visite ? '#1c2333' : '#9aa3b8', border:'1px solid #dde3f0' }}>
                              {p.droit_visite || '—'}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </SectionCard>

                <SectionCard icon="⚖️" title="Décisions judiciaires">
                  <FormGrid cols={3}>
                    <Field label="N° dossier tribunal" value={v('tj_numero')} onChange={F('tj_numero')} readOnly={!editMode} />
                    <Field label="Juge des enfants" value={v('tj_juge')} onChange={F('tj_juge')} readOnly={!editMode} />
                    <Field label="Date audience" type="date" value={v('tj_date_audience')} onChange={F('tj_date_audience')} readOnly={!editMode} />
                    <Field label="Prochain rendez-vous" type="date" value={v('tj_prochain_rdv')} onChange={F('tj_prochain_rdv')} readOnly={!editMode} />
                    <Field label="Avocat de l'enfant" value={v('tj_avocat')} onChange={F('tj_avocat')} readOnly={!editMode} />
                    <Field label="Mesure" value={v('tj_mesure')} onChange={F('tj_mesure')} readOnly={!editMode}
                      options={['OPP','Placement judiciaire','AEMO','AESF','Tutelle ASE']} />
                  </FormGrid>
                  {/* Documents judiciaires */}
                  <div style={{ marginTop:16 }}>
                    {documents.filter(d => d.type_doc === 'judiciaire').map(d => (
                      <div key={d.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 12px', background:'#f4f6fb', borderRadius:8, border:'1px solid #dde3f0', marginBottom:6 }}>
                        <span>{d.mime_type?.includes('pdf') ? '📄' : '🖼️'}</span>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:11, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.nom}</div>
                          <div style={{ fontSize:10, color:'#9aa3b8' }}>{d.taille ? `${Math.round(d.taille/1024)} Ko` : ''}</div>
                        </div>
                        <button onClick={async () => { const { data: url } = await supabase.storage.from('documents-enfants').createSignedUrl(d.storage_path, 3600); if (url?.signedUrl) window.open(url.signedUrl, '_blank') }}
                          style={{ padding:'3px 7px', borderRadius:5, border:'1px solid #dde3f0', background:'#fff', fontSize:11, cursor:'pointer' }}>👁</button>
                        <button onClick={async () => { const { data: url } = await supabase.storage.from('documents-enfants').createSignedUrl(d.storage_path, 60); if (url?.signedUrl) { const resp = await fetch(url.signedUrl); const blob = await resp.blob(); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = d.nom; document.body.appendChild(a); a.click(); document.body.removeChild(a) } }}
                          style={{ padding:'3px 7px', borderRadius:5, border:'1px solid #dde3f0', background:'#fff', fontSize:11, cursor:'pointer' }}>⬇</button>
                        {isReferent && <button onClick={() => deleteDocument(d.id, d.storage_path)}
                          style={{ padding:'3px 7px', borderRadius:5, border:'1px solid #fde8e8', background:'#fdf0ee', color:'#c0392b', fontSize:11, cursor:'pointer' }}>🗑</button>}
                      </div>
                    ))}
                    <label style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', border:'1px dashed #c4d4f5', borderRadius:8, background:'#f0f9ff', color:'#1a4b8f', fontSize:12, cursor:'pointer', fontFamily:'Sora,sans-serif', marginTop:4 }}>
                      {uploadingDoc === 'judiciaire' ? '⏳ Upload...' : '📎 Ajouter jugement, ordonnance, OPP...'}
                      <input type="file" accept="image/*,application/pdf" style={{ display:'none' }}
                        onChange={e => { if (e.target.files[0]) uploadDocument(e.target.files[0], 'judiciaire') }} />
                    </label>
                  </div>
                </SectionCard>

                <SectionCard icon="👨‍👩‍👧" title="Autorité parentale">
                  <FormGrid cols={3}>
                    <Field label="Titulaire autorité parentale" value={v('autorite_parentale')} onChange={F('autorite_parentale')} readOnly={!editMode}
                      options={['Les deux parents','Mère uniquement','Père uniquement','ASE','Aucun']} />
                    <Field label="Représentant légal" value={v('representant_legal')} onChange={F('representant_legal')} readOnly={!editMode} />
                    <Field label="Avocat enfant" value={v('avocat_enfant')} onChange={F('avocat_enfant')} readOnly={!editMode} />
                  </FormGrid>
                </SectionCard>

                {form.type_placement === 'secret' && (
                  <SectionCard icon="🔒" title="Placement secret — Règles de confidentialité">
                    <div style={{ background:'#fdf0f0', border:'1px solid #f5c4c4', borderRadius:10, padding:16, fontSize:13, color:'#8b1a1a' }}>
                      <h4 style={{ marginBottom:8 }}>⚠️ Informations masquées sur tous documents destinés aux parents</h4>
                      <ul style={{ paddingLeft:20, lineHeight:1.8 }}>
                        <li>Nom et prénom de l'assistant(e) familial(e)</li>
                        <li>Adresse du domicile d'accueil</li>
                        <li>Numéro de téléphone</li>
                        <li>Ville et département d'accueil</li>
                        <li>Établissement scolaire fréquenté</li>
                      </ul>
                    </div>
                  </SectionCard>
                )}
              </>
            )}

            {/* ══════════════════════════════════════════════════════════════
                ONGLET VIE QUOTIDIENNE
            ══════════════════════════════════════════════════════════════ */}
            {onglet === 'quotidien' && (
              <>
                {/* Bandeau AF relais */}
                {isAfRelaisActif && (
                  <div style={{ background:'#e0f2fe', border:'1px solid #7dd3fc', borderRadius:10, padding:'12px 16px', display:'flex', alignItems:'center', gap:10, marginBottom:16, fontSize:13, color:'#0369a1' }}>
                    <span style={{ fontSize:18 }}>🔄</span>
                    <div>
                      <strong>Accès relais</strong> — Vous consultez les informations nécessaires à l'accueil de cet enfant.
                      {relaisInfo && <span style={{ marginLeft:6, fontSize:11, color:'#0891b2' }}>
                        Relais du {fmtDate(relaisInfo.date_debut?.slice(0,10))} au {fmtDate(relaisInfo.date_fin?.slice(0,10))}
                      </span>}
                    </div>
                  </div>
                )}
                <SectionCard icon="🏥" title="Santé">
                  <FormGrid cols={3}>
                    <Field label="Groupe sanguin" value={v('groupe_sanguin')} onChange={F('groupe_sanguin')} readOnly={!canEditSante && !editMode}
                      options={['A+','A-','B+','B-','AB+','AB-','O+','O-']} />
                  </FormGrid>
                  {canEditSante && !editMode && (
                    <div style={{ marginTop:8 }}>
                      <button onClick={() => saveSanteField('medecin_groupe', { groupe_sanguin: form.groupe_sanguin })}
                        className="btn btn-primary" style={{ fontSize:11 }}>
                        💾 Enregistrer
                      </button>
                    </div>
                  )}

                  {/* ── Professionnels de santé ── */}
                  <div style={{ marginTop:16, borderTop:'1px solid #eef1f8', paddingTop:14 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#5a6478', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:10 }}>
                      👩‍⚕️ Professionnels de santé
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))', gap:10, marginBottom:10 }}>
                      {(form.professionnels_sante || []).map((p, i) => (
                        <div key={i} style={{ background:'#f4f6fb', borderRadius:10, padding:14, border:'1px solid #dde3f0', position:'relative' }}>
                          <div style={{ fontSize:10, fontWeight:700, color:'#0891b2', textTransform:'uppercase', letterSpacing:'.3px', marginBottom:4 }}>{p.specialite}</div>
                          <div style={{ fontSize:13, fontWeight:700, marginBottom:4 }}>{p.nom}</div>
                          {p.adresse && <div style={{ fontSize:11, color:'#9aa3b8' }}>📍 {p.adresse}</div>}
                          {p.telephone && <div style={{ fontSize:11, color:'#9aa3b8', marginTop:2 }}>📞 <a href={`tel:${p.telephone}`} style={{ color:'#1a4b8f' }}>{p.telephone}</a></div>}
                          {p.notes && <div style={{ fontSize:11, color:'#9aa3b8', fontStyle:'italic', marginTop:2 }}>{p.notes}</div>}
                          {canEditSante && (
                            <div style={{ display:'flex', gap:4, marginTop:8 }}>
                              <button onClick={() => { setEditProfIdx(i); setNewProf({ ...p }); setShowProfModal(true) }}
                                style={{ padding:'3px 7px', borderRadius:6, border:'1px solid #dde3f0', background:'#fff', fontSize:11, cursor:'pointer' }}>✏️</button>
                              <button onClick={() => {
                                const updated = (form.professionnels_sante || []).filter((_,j) => j !== i)
                                saveSanteField('professionnels_sante', updated)
                              }} style={{ padding:'3px 7px', borderRadius:6, border:'1px solid #fde8e8', background:'#fdf0ee', color:'#c0392b', fontSize:11, cursor:'pointer' }}>🗑</button>
                            </div>
                          )}
                        </div>
                      ))}
                      {canEditSante && (
                        <div onClick={() => { setEditProfIdx(null); setNewProf({ nom:'', specialite:'Médecin traitant', adresse:'', telephone:'', email:'', notes:'' }); setShowProfModal(true) }}
                          style={{ background:'#fff', borderRadius:10, padding:14, border:'2px dashed #dde3f0', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#9aa3b8', fontSize:12, minHeight:80 }}
                          onMouseOver={e => e.currentTarget.style.borderColor='#1a4b8f'}
                          onMouseOut={e => e.currentTarget.style.borderColor='#dde3f0'}>
                          + Ajouter
                        </div>
                      )}
                    </div>
                    {(!form.professionnels_sante || form.professionnels_sante.length === 0) && !canEditSante && (
                      <div style={{ fontSize:12, color:'#9aa3b8', fontStyle:'italic' }}>Aucun professionnel renseigné</div>
                    )}
                  </div>

                  {/* Allergies & Conditions */}
                  <div style={{ marginTop:16 }}>
                    <label style={{ fontSize:11, fontWeight:600, color:'#5a6478', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:8 }}>Allergies & Conditions</label>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
                      {(form.conditions_sante || []).map((c, i) => (
                        <span key={i} style={{ padding:'5px 12px', borderRadius:15, fontSize:12, fontWeight:600, background:'#fef3e2', color:'#d97706', border:'1px solid #f5dca4', display:'flex', alignItems:'center', gap:4 }}>
                          {c}
                          {canEditSante && <span onClick={() => saveSanteField('conditions_sante', (form.conditions_sante || []).filter((_,j) => j !== i))} style={{ cursor:'pointer', color:'#c0392b', marginLeft:3, fontSize:14 }}>×</span>}
                        </span>
                      ))}
                      {canEditSante && (
                        <button onClick={() => {
                          const c = prompt('Allergie ou condition (ex: ⚠️ Allergie arachides, 💊 Ritaline 10mg/matin, 🧠 TDA/H, 🍽️ Sans gluten)')
                          if (c) saveSanteField('conditions_sante', [...(form.conditions_sante || []), c])
                        }} style={{ padding:'5px 12px', borderRadius:15, fontSize:12, border:'1px dashed #c4d4f5', background:'#e8eef8', color:'#1a4b8f', cursor:'pointer', fontWeight:600 }}>
                          + Ajouter
                        </button>
                      )}
                    </div>
                    {(!form.conditions_sante || form.conditions_sante.length === 0) && !canEditSante && (
                      <div style={{ fontSize:12, color:'#9aa3b8', fontStyle:'italic' }}>Aucune allergie ou condition renseignée</div>
                    )}
                  </div>

                  {/* Notes santé */}
                  <div style={{ marginTop:14 }}>
                    <label style={{ fontSize:11, fontWeight:600, color:'#5a6478', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:6 }}>
                      📋 Notes santé importantes
                      <span style={{ fontSize:10, color:'#9aa3b8', fontWeight:400, marginLeft:6 }}>visibles par AF relais</span>
                    </label>
                    {canEditSante ? (
                      <div>
                        <textarea className="form-control" rows={3} value={v('notes_sante')} onChange={e => F('notes_sante')(e.target.value)}
                          placeholder="Traitements, comportements, précautions importantes..."
                          style={{ resize:'vertical', width:'100%', boxSizing:'border-box' }} />
                        <button onClick={() => saveSanteField('notes_sante', form.notes_sante)}
                          className="btn btn-primary" style={{ marginTop:6, fontSize:11 }}>
                          💾 Enregistrer
                        </button>
                      </div>
                    ) : (
                      <div style={{ padding:'10px 14px', background: v('notes_sante') ? '#fff9e6' : '#f4f6fb', borderRadius:8, border:`1px solid ${v('notes_sante') ? '#f5dca4' : '#dde3f0'}`, fontSize:13, color: v('notes_sante') ? '#1c2333' : '#9aa3b8', fontStyle: v('notes_sante') ? 'normal' : 'italic', minHeight:48 }}>
                        {v('notes_sante') || 'Aucune note renseignée'}
                      </div>
                    )}
                  </div>
                </SectionCard>

                {/* ── PRÉCONISATIONS PARTICULIÈRES ── */}
                <SectionCard icon="🟡" title="Préconisations particulières">
                  <div style={{ fontSize:11, color:'#9aa3b8', fontStyle:'italic', marginBottom:10 }}>
                    Visibles par l'AF relais
                  </div>

                  {/* Tags préconisations */}
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
                    {(form.preconisations || []).map((p, i) => (
                      <span key={i} style={{ padding:'5px 12px', borderRadius:15, fontSize:12, fontWeight:600, background:'#fef9e7', color:'#d97706', border:'1px solid #f5dca4', display:'flex', alignItems:'center', gap:4 }}>
                        {p}
                        {canEditSante && <span onClick={() => saveSanteField('preconisations', (form.preconisations || []).filter((_,j) => j !== i))} style={{ cursor:'pointer', color:'#c0392b', marginLeft:3, fontSize:14 }}>×</span>}
                      </span>
                    ))}
                    {canEditSante && (
                      <button onClick={() => {
                        const p = prompt('Préconisation (ex: 🛏️ Rituel du coucher important, 🚿 Douche obligatoire le soir, 📵 Pas d\'écrans après 20h)')
                        if (p) saveSanteField('preconisations', [...(form.preconisations || []), p])
                      }} style={{ padding:'5px 12px', borderRadius:15, fontSize:12, border:'1px dashed #f5dca4', background:'#fef9e7', color:'#d97706', cursor:'pointer', fontWeight:600 }}>
                        + Ajouter
                      </button>
                    )}
                    {(!form.preconisations || form.preconisations.length === 0) && !canEditSante && (
                      <div style={{ fontSize:12, color:'#9aa3b8', fontStyle:'italic' }}>Aucune préconisation renseignée</div>
                    )}
                  </div>

                  {/* Résumé rédigé par l'AF principal */}
                  <div style={{ marginTop:10 }}>
                    <label style={{ fontSize:11, fontWeight:600, color:'#5a6478', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:6 }}>
                      Résumé <span style={{ fontSize:10, color:'#9aa3b8', fontWeight:400 }}>(rédigé par l'AF principal)</span>
                    </label>
                    {canEditSante ? (
                      <div>
                        <textarea className="form-control" rows={3} value={v('notes_preconisations')} onChange={e => F('notes_preconisations')(e.target.value)}
                          placeholder="Décrivez les habitudes, rituels, besoins particuliers de l'enfant..."
                          style={{ resize:'vertical', width:'100%', boxSizing:'border-box' }} />
                        <button onClick={() => saveSanteField('notes_preconisations', form.notes_preconisations)}
                          className="btn btn-primary" style={{ marginTop:6, fontSize:11 }}>
                          💾 Enregistrer
                        </button>
                      </div>
                    ) : (
                      <div style={{ padding:'10px 14px', background: v('notes_preconisations') ? '#fffbeb' : '#f4f6fb', borderRadius:8, border:`1px solid ${v('notes_preconisations') ? '#f5dca4' : '#dde3f0'}`, fontSize:13, color: v('notes_preconisations') ? '#1c2333' : '#9aa3b8', fontStyle: v('notes_preconisations') ? 'normal' : 'italic', minHeight:48, lineHeight:1.7 }}>
                        {v('notes_preconisations') || 'Aucune note renseignée'}
                      </div>
                    )}
                  </div>
                </SectionCard>

                <SectionCard icon="💊" title="Ordonnances en cours">
                  <div>
                    {documents.filter(d => d.type_doc === 'ordonnance').map(d => {
                      const dateExpir = d.date_expiration ? new Date(d.date_expiration) : null
                      const joursRestants = dateExpir ? Math.ceil((dateExpir - new Date()) / (1000*60*60*24)) : null
                      const alerte = joursRestants !== null && joursRestants <= 30
                      return (
                        <div key={d.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background: alerte ? '#fef3e2' : '#f4f6fb', borderRadius:8, border:`1px solid ${alerte ? '#f5dca4' : '#dde3f0'}`, marginBottom:8 }}>
                          <span style={{ fontSize:20 }}>💊</span>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:12, fontWeight:600 }}>{d.nom}</div>
                            <div style={{ fontSize:10, color:'#9aa3b8' }}>
                              {d.taille ? `${Math.round(d.taille/1024)} Ko` : ''} · {fmtDate(d.created_at?.slice(0,10))}
                              {alerte && joursRestants > 0 && <span style={{ color:'#d97706', fontWeight:600, marginLeft:6 }}>⚠️ À renouveler dans {joursRestants}j</span>}
                              {alerte && joursRestants <= 0 && <span style={{ color:'#c0392b', fontWeight:600, marginLeft:6 }}>🚨 Ordonnance expirée !</span>}
                            </div>
                          </div>
                          <button onClick={async () => { const { data: url } = await supabase.storage.from('documents-enfants').createSignedUrl(d.storage_path, 3600); if (url?.signedUrl) window.open(url.signedUrl, '_blank') }}
                            style={{ padding:'3px 7px', borderRadius:5, border:'1px solid #dde3f0', background:'#fff', fontSize:11, cursor:'pointer' }}>👁</button>
                          <button onClick={async () => { const { data: url } = await supabase.storage.from('documents-enfants').createSignedUrl(d.storage_path, 60); if (url?.signedUrl) { const resp = await fetch(url.signedUrl); const blob = await resp.blob(); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = d.nom; document.body.appendChild(a); a.click(); document.body.removeChild(a) } }}
                            style={{ padding:'3px 7px', borderRadius:5, border:'1px solid #dde3f0', background:'#fff', fontSize:11, cursor:'pointer' }}>⬇</button>
                          {isReferent && <button onClick={() => deleteDocument(d.id, d.storage_path)}
                            style={{ padding:'3px 7px', borderRadius:5, border:'1px solid #fde8e8', background:'#fdf0ee', color:'#c0392b', fontSize:11, cursor:'pointer' }}>🗑</button>}
                        </div>
                      )
                    })}
                    <label style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', border:'1px dashed #c4d4f5', borderRadius:8, background:'#f0f9ff', color:'#1a4b8f', fontSize:12, cursor:'pointer', fontFamily:'Sora,sans-serif', marginTop:4 }}>
                      {uploadingDoc === 'ordonnance' ? '⏳ Upload...' : '📎 Ajouter une ordonnance'}
                      <input type="file" accept="image/*,application/pdf" style={{ display:'none' }}
                        onChange={e => { if (e.target.files[0]) uploadDocument(e.target.files[0], 'ordonnance') }} />
                    </label>
                  </div>
                </SectionCard>

                <SectionCard icon="👕" title="Vêture & Argent de poche" defaultOpen={!isAfRelaisActif}>
                  {isAfRelaisActif ? (
                    <div style={{ color:'#9aa3b8', fontStyle:'italic', fontSize:13 }}>Section non accessible en mode relais.</div>
                  ) : (
                    <FormGrid cols={3}>
                      <Field label="Taille vêtements" value={v('taille_vetements')} onChange={F('taille_vetements')} readOnly={!editMode} placeholder="8 ans / 128 cm" />
                      <Field label="Pointure chaussures" value={v('pointure')} onChange={F('pointure')} readOnly={!editMode} />
                      <Field label="Allocation vêture mensuelle" value={v('allocation_veture')} onChange={F('allocation_veture')} readOnly={!editMode} placeholder="80 €" />
                      <Field label="Argent de poche hebdo" value={v('argent_poche')} onChange={F('argent_poche')} readOnly={!editMode} placeholder="5 €" />
                      <Field label="Solde actuel" value={v('solde_argent')} onChange={F('solde_argent')} readOnly={!editMode} />
                    </FormGrid>
                  )}
                </SectionCard>

                {!isAfRelaisActif && (
                <SectionCard icon="🏫" title="Scolarité">
                  <FormGrid cols={3}>
                    <Field label="École / Établissement" value={v('ecole_nom')} onChange={F('ecole_nom')} readOnly={!editMode} />
                    <Field label="Classe" value={v('ecole_classe')} onChange={F('ecole_classe')} readOnly={!editMode} placeholder="CE2, 6ème..." />
                    <Field label="Enseignant(e) / Prof principal" value={v('ecole_enseignant')} onChange={F('ecole_enseignant')} readOnly={!editMode} />
                    <Field label="Téléphone école" type="tel" value={v('ecole_tel')} onChange={F('ecole_tel')} readOnly={!editMode} />
                    <Field label="Adresse école" value={v('ecole_adresse')} onChange={F('ecole_adresse')} readOnly={!editMode} span={2} />
                  </FormGrid>
                  <div style={{ marginTop:12, display:'flex', gap:8 }}>
                    <button onClick={() => showToast('📝 Formulaire inscription...')} className="btn btn-secondary">📝 Inscription scolaire</button>
                    <button onClick={() => showToast('🏊 Centre de loisirs...')} className="btn btn-secondary">🏊 Centre de loisirs</button>
                  </div>
                </SectionCard>
                )}
              </>
            )}

            {/* ══════════════════════════════════════════════════════════════
                ONGLET DOCS ENFANT
            ══════════════════════════════════════════════════════════════ */}
            {onglet === 'docs' && (
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:60,gap:16}}>
                <div style={{fontSize:48}}>📂</div>
                <div style={{fontSize:16,fontWeight:600,color:'#1c2333'}}>Documents · {enfant.nom} {enfant.prenom}</div>
                <div style={{fontSize:13,color:'#9aa3b8'}}>Accédez à la gestion complète des documents</div>
                <button onClick={()=>navigate(`/enfants/${id}/docs`)} className="btn btn-primary" style={{fontSize:14,padding:'12px 24px'}}>
                  📂 Ouvrir les documents
                </button>
              </div>
            )}

                        {/* ══════════════════════════════════════════════════════════════
                ONGLET JOURNAL
            ══════════════════════════════════════════════════════════════ */}
            {onglet === 'journal' && (
              <>
                {/* Barre actions */}
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16, flexWrap:'wrap' }}>
                  <button onClick={() => {
                    // AF relais → forcer type_note = 'relais' et préremplir les dates
                    if (isAfRelaisActif && relaisInfo) {
                      setNewNote(n => ({
                        ...n,
                        type_note: 'relais',
                        relais_debut: relaisInfo.date_debut?.slice(0,10) || '',
                        relais_fin: relaisInfo.date_fin?.slice(0,10) || '',
                      }))
                    }
                    setShowNoteModal(true)
                  }} className="btn btn-primary">+ Nouvelle note</button>
                  <div style={{ display:'flex', gap:4 }}>
                    {['😊','😐','😢','⚠️'].map(m => (
                      <button key={m} style={{ fontSize:16, padding:'5px 9px', borderRadius:8, border:'1px solid #dde3f0', background:'#fff', cursor:'pointer' }}>{m}</button>
                    ))}
                  </div>
                  {!isAfRelaisActif && (
                    <button onClick={() => { setRapportTexte(''); setShowRapportModal(true) }}
                      style={{ marginLeft:'auto', padding:'8px 14px', borderRadius:8, border:'none', background:'#2e8b4a', color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'Sora,sans-serif' }}>
                      📄 Rapport synthétique ASE
                    </button>
                  )}
                </div>

                {/* Légende */}
                <div style={{ display:'flex', gap:16, marginBottom:16, fontSize:11, color:'#9aa3b8' }}>
                  <span style={{ display:'flex', alignItems:'center', gap:5 }}>
                    <span style={{ width:12, height:12, borderRadius:3, background:'#fff', border:'1px solid #dde3f0', display:'inline-block' }}></span>
                    Notes AF Principal (privées)
                  </span>
                  <span style={{ display:'flex', alignItems:'center', gap:5 }}>
                    <span style={{ width:12, height:12, borderRadius:3, background:'#e8f5e9', border:'1px solid #a5d6a7', display:'inline-block' }}></span>
                    Notes relais (visibles par tous)
                  </span>
                </div>

                {journalNotes.length === 0 ? (
                  <div style={{ textAlign:'center', padding:60, color:'#9aa3b8' }}>
                    <div style={{ fontSize:36, marginBottom:12 }}>📝</div>
                    <div style={{ fontSize:14 }}>Aucune note dans le journal</div>
                    <div style={{ fontSize:12, marginTop:4 }}>Ajoutez des observations quotidiennes sur l'enfant</div>
                  </div>
                ) : journalNotes.map(note => {
                  const isRelais = note.type_note === 'relais'
                  const isOwner = profile?.id === note.auteur_id
                  // AF relais : voit uniquement les notes relais (les siennes + celles des autres relais)
                  // AF principal : voit ses notes + notes relais (lecture seule)
                  // Référent : voit tout
                  const canSee = isReferent
                    || (isAfRelaisActif && isRelais)
                    || (!isAfRelaisActif && (isRelais || isOwner))
                  // AF relais peut modifier uniquement ses propres notes
                  const canEditNote = isReferent || (isOwner && (!isAfRelaisActif || isRelais))
                  if (!canSee) return null
                  return (
                    <div key={note.id} style={{
                      background: isRelais ? '#f0faf0' : '#fff',
                      border: `1px solid ${isRelais ? '#a5d6a7' : '#dde3f0'}`,
                      borderRadius:12, padding:16, marginBottom:12,
                      boxShadow:'0 2px 8px rgba(26,75,143,.06)'
                    }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10, flexWrap:'wrap' }}>
                        <span style={{ fontSize:12, color:'#5a6478', fontWeight:500 }}>
                          {(() => { const [y,m,d] = note.date.split('-'); return new Date(+y,+m-1,+d).toLocaleDateString('fr-FR', { weekday:'short', day:'numeric', month:'long', year:'numeric' }) })()}
                          {note.heure && ` · ${note.heure}`}
                        </span>
                        <span style={{ padding:'2px 8px', borderRadius:10, fontSize:10, fontWeight:700,
                          background: isRelais ? '#c8e6c9' : '#e8eef8',
                          color: isRelais ? '#2e7d32' : '#1a4b8f' }}>
                          {isRelais ? '🔄 AF Relais' : '🏠 AF Principal'}
                        </span>
                        <span style={{ fontSize:18, marginLeft:'auto' }}>{note.humeur}</span>
                        {canEditNote && (
                          <>
                            <button onClick={() => openEditNote(note)}
                              style={{ padding:'3px 8px', borderRadius:6, border:'1px solid #dde3f0', background:'#fff', fontSize:11, cursor:'pointer' }}>✏️</button>
                            <button onClick={() => deleteNote(note.id)}
                              style={{ padding:'3px 8px', borderRadius:6, border:'1px solid #dde3f0', background:'#fdf0ee', color:'#c0392b', fontSize:11, cursor:'pointer' }}>🗑</button>
                          </>
                        )}
                      </div>
                      {isRelais && note.relais_debut && note.relais_fin && (
                        <div style={{ background:'#c8e6c9', borderRadius:8, padding:'6px 12px', marginBottom:10, fontSize:12, color:'#2e7d32', fontWeight:600 }}>
                          🔄 Rapport de relais — Du {fmtDate(note.relais_debut)} au {fmtDate(note.relais_fin)}
                          {(() => { const d1 = new Date(note.relais_debut), d2 = new Date(note.relais_fin); const j = Math.ceil((d2-d1)/(1000*60*60*24))+1; return ` (${j} jour${j>1?'s':''})` })()}
                        </div>
                      )}
                      <div style={{ fontSize:13, lineHeight:1.8, color:'#1c2333', whiteSpace:'pre-wrap' }}>{note.texte}</div>
                      {note.tags && note.tags.length > 0 && (
                        <div style={{ display:'flex', gap:5, marginTop:10, flexWrap:'wrap' }}>
                          {note.tags.map((t, i) => (
                            <span key={i} style={{ padding:'2px 8px', borderRadius:10,
                              background: isRelais ? '#e8f5e9' : '#f4f6fb',
                              border: `1px solid ${isRelais ? '#a5d6a7' : '#dde3f0'}`,
                              fontSize:11, color:'#5a6478' }}>{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </>
            )}

          </div>
        </div>
      </div>

      {/* ── Modal nouvelle note ── */}
      {showNoteModal && (
        <div className="modal-overlay" onClick={() => setShowNoteModal(false)}>
          <div className="modal-box" style={{ maxWidth:520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">{editNoteId ? '✏️ Modifier la note' : '📝 Nouvelle note journal'}</div>

            {/* Type de note */}
            {!isAfRelaisActif && (
            <div className="form-group" style={{ marginBottom:14 }}>
              <label className="form-label">Type de note</label>
              <div style={{ display:'flex', gap:8 }}>
                {[
                  { v:'principal', icon:'🏠', l:'AF Principal', desc:'Visible AF + ASE uniquement', bg:'#e8eef8', color:'#1a4b8f' },
                  { v:'relais',    icon:'🔄', l:'AF Relais',    desc:'Visible par tous',            bg:'#e8f5e9', color:'#2e7d32' },
                ].map(t => (
                  <button key={t.v} type="button" onClick={() => setNewNote(n => ({...n, type_note: t.v}))}
                    style={{ flex:1, padding:'10px', borderRadius:10, border:`2px solid ${newNote.type_note === t.v ? t.color : '#dde3f0'}`, background: newNote.type_note === t.v ? t.bg : '#fff', cursor:'pointer', textAlign:'left', fontFamily:'Sora,sans-serif' }}>
                    <div style={{ fontSize:13, fontWeight:700, color: newNote.type_note === t.v ? t.color : '#1c2333' }}>{t.icon} {t.l}</div>
                    <div style={{ fontSize:10, color:'#9aa3b8', marginTop:2 }}>{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>
            )}
            {isAfRelaisActif && (
              <div style={{ background:'#e8f5e9', border:'1px solid #a5d6a7', borderRadius:8, padding:'8px 14px', marginBottom:14, fontSize:12, color:'#2e7d32', fontWeight:600 }}>
                🔄 Note de rapport relais — visible par l'AF principal et l'ASE
              </div>
            )}

            {/* Dates relais si type relais */}
            {newNote.type_note === 'relais' && (
              <div className="form-grid-2" style={{ marginBottom:14 }}>
                <div className="form-group">
                  <label className="form-label">Début relais</label>
                  <input type="date" className="form-control" value={newNote.relais_debut || ''} onChange={e => setNewNote(n => ({...n, relais_debut: e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Fin relais</label>
                  <input type="date" className="form-control" value={newNote.relais_fin || ''} onChange={e => setNewNote(n => ({...n, relais_fin: e.target.value}))} />
                </div>
              </div>
            )}

            <div className="form-grid-2" style={{ marginBottom:12 }}>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input type="date" className="form-control" value={newNote.date} onChange={e => setNewNote(n => ({...n, date: e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Heure</label>
                <input type="time" className="form-control" value={newNote.heure || ''} onChange={e => setNewNote(n => ({...n, heure: e.target.value}))} />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom:12 }}>
              <label className="form-label">Humeur</label>
              <div style={{ display:'flex', gap:8, marginTop:4 }}>
                {['😊','😐','😢','⚠️'].map(m => (
                  <button key={m} onClick={() => setNewNote(n => ({...n, humeur: m}))}
                    style={{ fontSize:22, padding:'6px 10px', borderRadius:8, border:`2px solid ${newNote.humeur === m ? '#1a4b8f' : '#dde3f0'}`, background: newNote.humeur === m ? '#e8eef8' : '#fff', cursor:'pointer' }}>
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group" style={{ marginBottom:12 }}>
              <label className="form-label">Observation</label>
              <textarea className="form-control" rows={4} value={newNote.texte}
                onChange={e => setNewNote(n => ({...n, texte: e.target.value}))}
                placeholder="Décrivez la journée, le comportement, les événements notables..."
                style={{ resize:'vertical' }} />
            </div>

            <div className="form-group" style={{ marginBottom:12 }}>
              <label className="form-label">Tags <span style={{ fontSize:10, color:'#9aa3b8', fontWeight:400 }}>(séparés par des virgules)</span></label>
              <input className="form-control" value={newNote.tags}
                onChange={e => setNewNote(n => ({...n, tags: e.target.value}))}
                placeholder="École, Comportement, Sommeil, Post-visite..." />
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setShowNoteModal(false); setEditNoteId(null); setNewNote({ date: new Date().toISOString().slice(0,10), heure:'', humeur:'😊', texte:'', tags:'', type_note:'principal', relais_debut:'', relais_fin:'' }) }}>Annuler</button>
              <button className="btn btn-primary" onClick={saveNote} disabled={noteLoading}>
                {noteLoading ? '⏳...' : '💾 Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal parent ── */}
      {showParentModal && (
        <div className="modal-overlay" onClick={() => setShowParentModal(false)}>
          <div className="modal-box" style={{ maxWidth:560 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">{parentType === 'pere' ? '👨 Père' : '👩 Mère'}</div>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Nom *</label>
                <input className="form-control" value={editParent.nom || ''} autoFocus
                  onChange={e => setEditParent(p => ({...p, nom: e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Prénom</label>
                <input className="form-control" value={editParent.prenom || ''}
                  onChange={e => setEditParent(p => ({...p, prenom: e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Date de naissance</label>
                <input type="date" className="form-control" value={editParent.date_naissance || ''}
                  onChange={e => setEditParent(p => ({...p, date_naissance: e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">N° Sécurité Sociale</label>
                <input className="form-control" value={editParent.numero_secu || ''}
                  placeholder="1 85 06 75 113 001 42"
                  onChange={e => {
                    const raw = e.target.value.replace(/\s/g, '').slice(0, 15)
                    let fmt = raw
                    if (raw.length > 1) fmt = raw.slice(0,1)+' '+raw.slice(1)
                    if (raw.length > 3) fmt = raw.slice(0,1)+' '+raw.slice(1,3)+' '+raw.slice(3)
                    if (raw.length > 5) fmt = raw.slice(0,1)+' '+raw.slice(1,3)+' '+raw.slice(3,5)+' '+raw.slice(5)
                    if (raw.length > 7) fmt = raw.slice(0,1)+' '+raw.slice(1,3)+' '+raw.slice(3,5)+' '+raw.slice(5,7)+' '+raw.slice(7)
                    if (raw.length > 10) fmt = raw.slice(0,1)+' '+raw.slice(1,3)+' '+raw.slice(3,5)+' '+raw.slice(5,7)+' '+raw.slice(7,10)+' '+raw.slice(10)
                    if (raw.length > 13) fmt = raw.slice(0,1)+' '+raw.slice(1,3)+' '+raw.slice(3,5)+' '+raw.slice(5,7)+' '+raw.slice(7,10)+' '+raw.slice(10,13)+' '+raw.slice(13)
                    setEditParent(p => ({...p, numero_secu: fmt}))
                  }} />
              </div>
              <div className="form-group">
                <label className="form-label">Profession</label>
                <input className="form-control" value={editParent.situation_pro || ''}
                  onChange={e => setEditParent(p => ({...p, situation_pro: e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Téléphone</label>
                <input type="tel" className="form-control" value={editParent.telephone || ''}
                  onChange={e => setEditParent(p => ({...p, telephone: e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Téléphone 2</label>
                <input type="tel" className="form-control" value={editParent.telephone2 || ''}
                  onChange={e => setEditParent(p => ({...p, telephone2: e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input type="email" className="form-control" value={editParent.email || ''}
                  onChange={e => setEditParent(p => ({...p, email: e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Code postal</label>
                <input className="form-control" value={editParent.code_postal || ''}
                  onChange={e => setEditParent(p => ({...p, code_postal: e.target.value}))} />
              </div>
              <div className="form-group col-span-2">
                <label className="form-label">Adresse</label>
                <input className="form-control" value={editParent.adresse || ''}
                  onChange={e => setEditParent(p => ({...p, adresse: e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Ville</label>
                <input className="form-control" value={editParent.ville || ''}
                  onChange={e => setEditParent(p => ({...p, ville: e.target.value}))} />
              </div>
              <div className="form-group col-span-2">
                <div style={{ padding:'10px 14px', background:'#f0f9ff', border:'1px solid #c4d4f5', borderRadius:8, fontSize:12, color:'#1a4b8f' }}>
                  📌 Les droits parentaux et droits de visite sont à renseigner dans l'onglet ⚖️ Judiciaire
                </div>
              </div>
              <div className="form-group col-span-2">
                <label className="form-label">Notes</label>
                <textarea className="form-control" rows={2} value={editParent.notes || ''}
                  onChange={e => setEditParent(p => ({...p, notes: e.target.value}))}
                  style={{ resize:'vertical' }} />
              </div>
            </div>
            {/* Documents du parent */}
            {(pere?.id || mere?.id) && editParent?.id && (
              <div style={{ marginTop:16, borderTop:'1px solid #dde3f0', paddingTop:16 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'#1a4b8f', marginBottom:10 }}>
                  📎 Documents
                </div>
                {/* Documents existants */}
                {docsParent.map(d => (
                  <div key={d.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', background:'#f4f6fb', borderRadius:7, border:'1px solid #dde3f0', marginBottom:6 }}>
                    <span>{d.mime_type?.includes('pdf') ? '📄' : '🖼️'}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:11, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.nom}</div>
                      <div style={{ fontSize:10, color:'#9aa3b8' }}>{d.taille ? `${Math.round(d.taille/1024)} Ko` : ''} · {fmtDate(d.created_at?.slice(0,10))}</div>
                    </div>
                    <button onClick={async () => {
                      const { data } = await supabase.storage.from('documents-enfants').createSignedUrl(d.storage_path, 3600)
                      if (data?.signedUrl) window.open(data.signedUrl, '_blank')
                    }} style={{ padding:'3px 7px', borderRadius:5, border:'1px solid #dde3f0', background:'#fff', fontSize:11, cursor:'pointer' }}>👁</button>
                    {isReferent && <button onClick={() => deleteDocParent(d.id, d.storage_path, editParent.id)}
                      style={{ padding:'3px 7px', borderRadius:5, border:'1px solid #fde8e8', background:'#fdf0ee', color:'#c0392b', fontSize:11, cursor:'pointer' }}>🗑</button>}
                  </div>
                ))}
                {/* Upload nouveau document */}
                <label style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', border:'1px dashed #c4d4f5', borderRadius:8, background:'#f0f9ff', color:'#1a4b8f', fontSize:12, cursor:'pointer', fontFamily:'Sora,sans-serif' }}>
                  {uploadingDocParent ? '⏳ Upload...' : '📎 Ajouter CNI, jugement, ordonnance...'}
                  <input type="file" accept="image/*,application/pdf" style={{ display:'none' }}
                    onChange={e => { if (e.target.files[0]) uploadDocParent(e.target.files[0], editParent.id) }} />
                </label>
              </div>
            )}

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowParentModal(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={saveParent} disabled={savingParent}>
                {savingParent ? '⏳...' : '💾 Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal fratrie ── */}
      {showFratrieModal && (
        <div className="modal-overlay" onClick={() => setShowFratrieModal(false)}>
          <div className="modal-box" style={{ maxWidth:480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">👧👦 Ajouter un membre de la fratrie</div>

            {/* Étape 1 : question */}
            {fratrieMode === 'question' && (
              <div style={{ textAlign:'center', padding:'20px 0' }}>
                <div style={{ fontSize:32, marginBottom:16 }}>🔍</div>
                <p style={{ fontSize:14, color:'#5a6478', marginBottom:24 }}>
                  Cet enfant est-il déjà enregistré dans Passerelle ?
                </p>
                <div style={{ display:'flex', gap:12, justifyContent:'center' }}>
                  <button className="btn btn-primary" onClick={() => setFratrieMode('search')}>
                    ✅ Oui — Rechercher
                  </button>
                  <button className="btn btn-secondary" onClick={() => setFratrieMode('create')}>
                    ➕ Non — Créer le profil
                  </button>
                </div>
              </div>
            )}

            {/* Étape 2a : recherche dans la base */}
            {fratrieMode === 'search' && (
              <div>
                <div style={{ marginBottom:16 }}>
                  <label className="form-label">Rechercher par prénom ou nom</label>
                  <input className="form-control"
                    value={fratrieSearch}
                    onChange={e => { setFratrieSearch(e.target.value); searchEnfantsBase(e.target.value) }}
                    placeholder="Tapez au moins 2 caractères..."
                    autoFocus />
                </div>
                {fratrieSearchResults.length > 0 && (
                  <div style={{ maxHeight:240, overflowY:'auto', border:'1px solid #dde3f0', borderRadius:8 }}>
                    {fratrieSearchResults.map(e => (
                      <div key={e.id} onClick={() => addFratrieFromBase(e)}
                        style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', cursor:'pointer', borderBottom:'1px solid #f0f0f0' }}
                        onMouseOver={ev => ev.currentTarget.style.background='#f4f6fb'}
                        onMouseOut={ev => ev.currentTarget.style.background='#fff'}>
                        <div style={{ width:32, height:32, borderRadius:'50%', background:'linear-gradient(135deg,#1a4b8f,#2e8b4a)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'#fff' }}>
                          {e.prenom?.[0]}{e.nom?.[0]}
                        </div>
                        <div>
                          <div style={{ fontSize:13, fontWeight:600 }}>{e.nom} {e.prenom}</div>
                          <div style={{ fontSize:11, color:'#9aa3b8' }}>{e.date_naissance ? calcAge(e.date_naissance) : ''}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {fratrieSearch.length >= 2 && fratrieSearchResults.length === 0 && (
                  <div style={{ textAlign:'center', padding:20, color:'#9aa3b8', fontSize:13 }}>
                    Aucun enfant trouvé
                    <br />
                    <button onClick={() => setFratrieMode('create')} className="btn btn-secondary" style={{ marginTop:10 }}>
                      ➕ Créer le profil
                    </button>
                  </div>
                )}
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={() => setFratrieMode('question')}>← Retour</button>
                </div>
              </div>
            )}

            {/* Étape 3 : parents en commun */}
            {fratrieMode === 'parents' && (
              <div style={{ padding:'8px 0' }}>
                <div style={{ textAlign:'center', marginBottom:16 }}>
                  <div style={{ fontSize:28, marginBottom:8 }}>👨‍👩‍👧</div>
                  <p style={{ fontSize:14, color:'#1c2333', fontWeight:600, marginBottom:4 }}>
                    Quel(s) parent(s) <strong>{newFratrie.prenom}</strong> partage-t-il/elle avec <strong>{form.prenom}</strong> ?
                  </p>
                  <p style={{ fontSize:12, color:'#9aa3b8' }}>
                    Frère/sœur = au moins un parent en commun
                  </p>
                </div>

                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {/* Même père ET même mère */}
                  {(form.pere_nom || form.pere_prenom || form.mere_nom || form.mere_prenom) && (
                    <button onClick={() => addFratrieNew('les_deux')}
                      style={{ padding:'12px 16px', borderRadius:10, border:'1.5px solid #1a4b8f', background:'#e8eef8', cursor:'pointer', textAlign:'left', fontFamily:'Sora,sans-serif' }}>
                      <div style={{ fontSize:13, fontWeight:700, color:'#1a4b8f', marginBottom:4 }}>👨‍👩 Même père ET même mère</div>
                      <div style={{ fontSize:11, color:'#5a6478' }}>
                        {form.pere_prenom && <span>👨 {form.pere_prenom} {form.pere_nom}</span>}
                        {form.pere_prenom && form.mere_prenom && <span> · </span>}
                        {form.mere_prenom && <span>👩 {form.mere_prenom} {form.mere_nom}</span>}
                      </div>
                    </button>
                  )}

                  {/* Même père seulement */}
                  {(form.pere_nom || form.pere_prenom) && (
                    <button onClick={() => addFratrieNew('pere')}
                      style={{ padding:'12px 16px', borderRadius:10, border:'1.5px solid #dde3f0', background:'#f4f6fb', cursor:'pointer', textAlign:'left', fontFamily:'Sora,sans-serif' }}>
                      <div style={{ fontSize:13, fontWeight:700, color:'#1c2333', marginBottom:4 }}>👨 Même père seulement</div>
                      <div style={{ fontSize:11, color:'#5a6478' }}>Demi-frère/sœur côté paternel · 👨 {form.pere_prenom} {form.pere_nom}</div>
                    </button>
                  )}

                  {/* Même mère seulement */}
                  {(form.mere_nom || form.mere_prenom) && (
                    <button onClick={() => addFratrieNew('mere')}
                      style={{ padding:'12px 16px', borderRadius:10, border:'1.5px solid #dde3f0', background:'#f4f6fb', cursor:'pointer', textAlign:'left', fontFamily:'Sora,sans-serif' }}>
                      <div style={{ fontSize:13, fontWeight:700, color:'#1c2333', marginBottom:4 }}>👩 Même mère seulement</div>
                      <div style={{ fontSize:11, color:'#5a6478' }}>Demi-frère/sœur côté maternel · 👩 {form.mere_prenom} {form.mere_nom}</div>
                    </button>
                  )}

                  {/* Si aucun parent renseigné */}
                  {!form.pere_nom && !form.pere_prenom && !form.mere_nom && !form.mere_prenom && (
                    <div style={{ background:'#fef3e2', border:'1px solid #f5dca4', borderRadius:10, padding:14, fontSize:13, color:'#d97706' }}>
                      ⚠️ Les parents de <strong>{form.prenom}</strong> ne sont pas encore renseignés.<br/>
                      Le dossier sera créé sans parents — pensez à les renseigner.
                      <div style={{ marginTop:12, display:'flex', gap:8, justifyContent:'flex-end' }}>
                        <button className="btn btn-secondary" onClick={() => setFratrieMode('create')}>← Retour</button>
                        <button className="btn btn-primary" onClick={() => addFratrieNew(null)}>Créer quand même</button>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ marginTop:12 }}>
                  <button className="btn btn-secondary" onClick={() => setFratrieMode('create')}>← Retour</button>
                </div>
              </div>
            )}

            {/* Étape 2b : création nouveau profil */}
            {fratrieMode === 'create' && (
              <div>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Prénom *</label>
                    <input className="form-control" value={newFratrie.prenom}
                      onChange={e => setNewFratrie(n => ({...n, prenom: e.target.value}))} autoFocus />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Nom *</label>
                    <input className="form-control" value={newFratrie.nom}
                      onChange={e => setNewFratrie(n => ({...n, nom: e.target.value}))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Date de naissance</label>
                    <input type="date" className="form-control" value={newFratrie.ddn}
                      onChange={e => setNewFratrie(n => ({...n, ddn: e.target.value}))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Sexe</label>
                    <select className="form-control" value={newFratrie.sexe}
                      onChange={e => setNewFratrie(n => ({...n, sexe: e.target.value}))}>
                      <option value="M">👦 Masculin</option>
                      <option value="F">👧 Féminin</option>
                    </select>
                  </div>
                  <div className="form-group col-span-2">
                    <label className="form-label">Type de placement</label>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {[
                        { v:'non_place', l:'🏠 Non placé' },
                        { v:'judiciaire', l:'⚖️ Judiciaire' },
                        { v:'administratif', l:'📋 Administratif' },
                        { v:'urgence', l:'🚨 Urgence' },
                        { v:'aemo', l:'👁 AEMO' },
                        { v:'aemo_r', l:'👁 AEMO-R' },
                        { v:'secret', l:'🔒 Secret' },
                      ].map(opt => (
                        <button key={opt.v} type="button"
                          onClick={() => setNewFratrie(n => ({...n, type_placement: opt.v}))}
                          style={{ padding:'5px 10px', borderRadius:20, border:`1.5px solid ${newFratrie.type_placement === opt.v ? '#1a4b8f' : '#dde3f0'}`, background: newFratrie.type_placement === opt.v ? '#e8eef8' : '#fff', color: newFratrie.type_placement === opt.v ? '#1a4b8f' : '#5a6478', fontSize:11, fontWeight: newFratrie.type_placement === opt.v ? 700 : 500, cursor:'pointer' }}>
                          {opt.l}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="form-group col-span-2">
                    <label className="form-label">Lieu d'accueil</label>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom: newFratrie.lieu_type === 'af' ? 8 : 0 }}>
                      {[
                        { v:'af', l:'👨‍👩‍👧 AF Principal' },
                        { v:'foyer', l:'🏛️ Foyer' },
                        { v:'lva', l:'🏠 LVA' },
                        { v:'autre', l:'📋 Autre structure' },
                        { v:'domicile', l:'🏡 Domicile parental' },
                      ].map(opt => (
                        <button key={opt.v} type="button"
                          onClick={() => setNewFratrie(n => ({...n, lieu_type: opt.v, meme_af: opt.v === 'af'}))}
                          style={{ padding:'5px 10px', borderRadius:20, border:`1.5px solid ${newFratrie.lieu_type === opt.v ? '#0891b2' : '#dde3f0'}`, background: newFratrie.lieu_type === opt.v ? '#e0f2fe' : '#fff', color: newFratrie.lieu_type === opt.v ? '#0891b2' : '#5a6478', fontSize:11, fontWeight: newFratrie.lieu_type === opt.v ? 700 : 500, cursor:'pointer' }}>
                          {opt.l}
                        </button>
                      ))}
                    </div>
                    {/* Si AF → préciser même AF ou autre */}
                    {newFratrie.lieu_type === 'af' && (
                      <div style={{ display:'flex', gap:8, marginTop:8 }}>
                        {[{v:true,l:"Même famille d'accueil"},{v:false,l:"Autre famille d'accueil"}].map(opt => (
                          <button key={String(opt.v)} type="button"
                            onClick={() => setNewFratrie(n => ({...n, meme_af: opt.v}))}
                            style={{ flex:1, padding:'7px', borderRadius:8, border:`1.5px solid ${newFratrie.meme_af === opt.v ? '#1a4b8f' : '#dde3f0'}`, background: newFratrie.meme_af === opt.v ? '#e8eef8' : '#fff', color: newFratrie.meme_af === opt.v ? '#1a4b8f' : '#5a6478', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                            {opt.l}
                          </button>
                        ))}
                      </div>
                    )}
                    {/* Si autre structure → champ texte */}
                    {['foyer','lva','autre'].includes(newFratrie.lieu_type) && (
                      <input className="form-control" style={{ marginTop:8 }}
                        placeholder="Nom de la structure..."
                        value={newFratrie.lieu_nom || ''}
                        onChange={e => setNewFratrie(n => ({...n, lieu_nom: e.target.value}))} />
                    )}
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={() => setFratrieMode('question')}>← Retour</button>
                  <button className="btn btn-primary"
                    onClick={() => {
                      if (!newFratrie.prenom || !newFratrie.nom) { return }
                      // Vérifier si les parents sont renseignés
                      const parentsRenseignes = form.pere_nom || form.mere_nom
                      if (parentsRenseignes) {
                        setFratrieMode('parents')
                      } else {
                        addFratrieNew(null)
                      }
                    }}>
                    Suivant →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal Rapport synthétique ── */}
      {showRapportModal && (
        <div className="modal-overlay" onClick={() => setShowRapportModal(false)}>
          <div className="modal-box" style={{ maxWidth:680 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">📄 Rapport synthétique ASE — {enfant.nom} {enfant.prenom}</div>

            {/* Période */}
            <div className="form-grid-2" style={{ marginBottom:16 }}>
              <div className="form-group">
                <label className="form-label">📅 Période — Du</label>
                <input type="date" className="form-control" value={rapportPeriode.debut}
                  onChange={e => setRapportPeriode(p => ({...p, debut: e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">📅 Au</label>
                <input type="date" className="form-control" value={rapportPeriode.fin}
                  onChange={e => setRapportPeriode(p => ({...p, fin: e.target.value}))} />
              </div>
            </div>

            <button onClick={generateRapport} disabled={rapportLoading}
              className="btn btn-primary" style={{ marginBottom:16 }}>
              {rapportLoading ? '⏳ Génération en cours...' : '✨ Générer la synthèse'}
            </button>

            {/* Zone texte modifiable */}
            {rapportTexte && (
              <>
                <div style={{ fontSize:11, color:'#9aa3b8', marginBottom:6 }}>
                  ✏️ Le texte est modifiable avant impression
                </div>
                <textarea
                  value={rapportTexte}
                  onChange={e => setRapportTexte(e.target.value)}
                  style={{ width:'100%', minHeight:320, padding:'14px', border:'1.5px solid #dde3f0', borderRadius:8, fontFamily:'Sora,sans-serif', fontSize:13, lineHeight:1.8, resize:'vertical', outline:'none', background:'#fafbff' }}
                />
                <div className="modal-footer" style={{ marginTop:12 }}>
                  <button className="btn btn-secondary" onClick={() => setShowRapportModal(false)}>Fermer</button>
                  <button className="btn btn-secondary" onClick={() => {
                    navigator.clipboard.writeText(rapportTexte)
                    showToast('📋 Copié !')
                  }}>📋 Copier</button>
                  <button className="btn btn-secondary" onClick={async () => {
                    try {
                      const titre = 'Rapport ' + enfant.prenom + ' ' + enfant.nom + ' — ' + fmtDate(rapportPeriode.debut) + ' au ' + fmtDate(rapportPeriode.fin)
                      const { error } = await supabase.from('rapports').insert({
                        enfant_id: id,
                        auteur_id: profile.id,
                        titre,
                        contenu: rapportTexte,
                        periode_debut: rapportPeriode.debut,
                        periode_fin: rapportPeriode.fin,
                      })
                      if (error) { showToast('❌ ' + error.message); return }
                      showToast('✅ Rapport enregistré !')
                    } catch(e) { showToast('❌ ' + e.message) }
                  }}>💾 Enregistrer</button>
                  <button className="btn btn-primary" onClick={() => {
                    const w = window.open('', '_blank')
                    const enteteHtml = '<h2 style="font-size:14px;color:#1a4b8f;margin-top:20px;margin-bottom:8px;border-bottom:1px solid #eee;padding-bottom:4px;">Identite de l enfant</h2>' +
                      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 20px;margin-bottom:16px;font-size:12px;">' +
                      '<div><div style="color:#666;font-size:11px;">Nom et prenom</div><div>' + enfant.prenom + ' ' + enfant.nom + '</div></div>' +
                      '<div><div style="color:#666;font-size:11px;">Date de naissance</div><div>' + fmtDate(enfant.date_naissance) + ' (' + calcAge(enfant.date_naissance) + ')</div></div>' +
                      '<div><div style="color:#666;font-size:11px;">N dossier CD81</div><div>' + (enfant.numero_dossier || '—') + '</div></div>' +
                      '</div>' +
                      '<h2 style="font-size:14px;color:#1a4b8f;margin-top:20px;margin-bottom:8px;border-bottom:1px solid #eee;padding-bottom:4px;">Situation de placement</h2>' +
                      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 20px;margin-bottom:16px;font-size:12px;">' +
                      '<div><div style="color:#666;font-size:11px;">Type de placement</div><div>' + (enfant.type_placement || '—') + '</div></div>' +
                      '<div><div style="color:#666;font-size:11px;">Date de placement</div><div>' + (fmtDate(enfant.date_placement) || '—') + '</div></div>' +
                      '<div><div style="color:#666;font-size:11px;">Maison du Departement</div><div>' + (enfant.md_nom || '—') + '</div></div>' +
                      '<div><div style="color:#666;font-size:11px;">Referente</div><div>' + (enfant.referent ? enfant.referent.prenom + ' ' + enfant.referent.nom : '—') + '</div></div>' +
                      '<div><div style="color:#666;font-size:11px;">AF Principal</div><div>' + (enfant.af_principal ? enfant.af_principal.prenom + ' ' + enfant.af_principal.nom : '—') + '</div></div>' +
                      '</div>' +
                      '<h2 style="font-size:14px;color:#1a4b8f;margin-top:20px;margin-bottom:8px;border-bottom:1px solid #eee;padding-bottom:4px;">Observations de la periode</h2>'
                    w.document.write('<html><head><title>Rapport - ' + enfant.prenom + ' ' + enfant.nom + '</title>' +
                      '<style>body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;line-height:1.8;font-size:13px;}' +
                      '.header{display:flex;justify-content:space-between;margin-bottom:24px;font-size:11px;color:#666;border-bottom:1px solid #ddd;padding-bottom:8px;}' +
                      'h1{font-size:18px;border-bottom:2px solid #1a4b8f;padding-bottom:8px;color:#1a4b8f;margin-top:0;}' +
                      '@media print{body{margin:20px;}}</style></head><body>' +
                      '<div class="header"><span>Passerelle — Departement du Tarn (81)</span>' +
                      '<span>Genere le ' + new Date().toLocaleDateString('fr-FR') + ' · Periode : ' + fmtDate(rapportPeriode.debut) + ' au ' + fmtDate(rapportPeriode.fin) + '</span></div>' +
                      '<h1>Rapport de synthese — ' + enfant.prenom + ' ' + enfant.nom + '</h1>' +
                      enteteHtml +
                      '<div style="line-height:1.9;">' + rapportTexte.split('\n').map(function(l){return l ? '<p>' + l + '</p>' : '<br/>'}).join('') + '</div>' +
                      '</body></html>')
                    w.document.close()
                    w.print()
                  }}>🖨️ Imprimer</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Modal professionnel de santé ── */}
      {showProfModal && (
        <div className="modal-overlay" onClick={() => setShowProfModal(false)}>
          <div className="modal-box" style={{ maxWidth:480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">{editProfIdx !== null ? '✏️ Modifier le professionnel' : '👩‍⚕️ Nouveau professionnel de santé'}</div>
            <div className="form-grid-2">
              <div className="form-group col-span-2">
                <label className="form-label">Nom *</label>
                <input className="form-control" value={newProf.nom} autoFocus
                  onChange={e => setNewProf(p => ({...p, nom: e.target.value}))} placeholder="Dr. Dupont, Cabinet Brun..." />
              </div>
              <div className="form-group col-span-2">
                <label className="form-label">Spécialité</label>
                <input className="form-control" value={newProf.specialite}
                  onChange={e => setNewProf(p => ({...p, specialite: e.target.value}))}
                  placeholder="Médecin traitant, Orthophoniste, Pédopsychiatre..." />
              </div>
              <div className="form-group col-span-2">
                <label className="form-label">Adresse</label>
                <input className="form-control" value={newProf.adresse}
                  onChange={e => setNewProf(p => ({...p, adresse: e.target.value}))}
                  placeholder="1 bis place du foirail 81500 Lavaur" />
              </div>
              <div className="form-group">
                <label className="form-label">Téléphone</label>
                <input type="tel" className="form-control" value={newProf.telephone}
                  onChange={e => setNewProf(p => ({...p, telephone: e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input type="email" className="form-control" value={newProf.email}
                  onChange={e => setNewProf(p => ({...p, email: e.target.value}))} />
              </div>
              <div className="form-group col-span-2">
                <label className="form-label">Notes</label>
                <textarea className="form-control" rows={2} value={newProf.notes}
                  onChange={e => setNewProf(p => ({...p, notes: e.target.value}))}
                  placeholder="Fréquence des rendez-vous, informations utiles..." style={{ resize:'vertical' }} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowProfModal(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={() => {
                if (!newProf.nom) { showToast('⚠️ Nom requis'); return }
                const liste = [...(form.professionnels_sante || [])]
                if (editProfIdx !== null) liste[editProfIdx] = newProf
                else liste.push(newProf)
                saveSanteField('professionnels_sante', liste)
                setShowProfModal(false)
              }}>💾 Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
