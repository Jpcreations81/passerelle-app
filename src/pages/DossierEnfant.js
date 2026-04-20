import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
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

function Field({ label, value, onChange, type = 'text', options, span, placeholder, readOnly }) {
  const style = span ? { gridColumn: `span ${span}` } : {}
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:5, ...style }}>
      <label style={{ fontSize:11, fontWeight:600, color:'#5a6478', letterSpacing:'.4px', textTransform:'uppercase' }}>{label}</label>
      {readOnly ? (
        <div style={{ padding:'10px 12px', background:'#eef1f8', borderRadius:8, fontSize:13, color:'#1c2333' }}>
          {value || <span style={{ color:'#9aa3b8', fontStyle:'italic' }}>—</span>}
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
          <div style={{ fontSize:13, fontWeight:600 }}>{prenom} {nom}</div>
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
  const [enfant, setEnfant] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [onglet, setOnglet] = useState('identite')
  const [editMode, setEditMode] = useState(false)
  const [form, setForm] = useState({})
  const [collegues, setCollegues] = useState([])
  const [toast, setToast] = useState('')
  const [journalNotes, setJournalNotes] = useState([])
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [newNote, setNewNote] = useState({ date: new Date().toISOString().slice(0,10), humeur:'😊', texte:'', tags:'' })
  const [noteLoading, setNoteLoading] = useState(false)
  const [documents, setDocuments] = useState([])
  const [uploadingDoc, setUploadingDoc] = useState(null) // type_doc en cours d'upload

  const isReferent = ['referent','encadrant','rtase','admin'].includes(profile?.role)
  const isAF = profile?.role === 'af'

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 2800) }

  // ── Chargement ──────────────────────────────────────────────────────────────
  const fetchEnfant = useCallback(async () => {
    if (!id) return
    const { data, error } = await supabase
      .from('enfants')
      .select(`*, af_principal:af_principal_id(id, nom, prenom, telephone, email, territoire), referent:referent_id(id, nom, prenom, telephone, email)`)
      .eq('id', id)
      .single()
    if (!error && data) {
      setEnfant(data)
      setForm(data)
    }
    setLoading(false)
  }, [id])

  const fetchCollegues = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('id, nom, prenom, role, territoire').eq('territoire', profile?.territoire)
    if (data) setCollegues(data)
  }, [profile])

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

  const fetchJournal = useCallback(async () => {
    if (!id) return
    const { data } = await supabase
      .from('journal_enfant')
      .select('*')
      .eq('enfant_id', id)
      .order('date', { ascending: false })
    if (data) setJournalNotes(data)
  }, [id])

  useEffect(() => {
    fetchEnfant()
    fetchCollegues()
    fetchJournal()
    fetchDocuments()
  }, [fetchEnfant, fetchCollegues, fetchJournal, fetchDocuments])

  // ── Sauvegarde ──────────────────────────────────────────────────────────────
  async function saveForm() {
    setSaving(true)
    // Exclure TOUTES les relations et champs non-colonnes
    const champsExclus = ['af_principal', 'referent', 'id', 'created_at', 'updated_at']
    const formData = Object.fromEntries(
      Object.entries(form).filter(([k]) => !champsExclus.includes(k) && typeof form[k] !== 'object' || Array.isArray(form[k]) || form[k] === null)
    )
    const { error } = await supabase.from('enfants').update(formData).eq('id', id)
    if (!error) {
      showToast('✅ Dossier enregistré !')
      setEnfant(form)
      setEditMode(false)
    } else showToast('❌ Erreur : ' + error.message)
    setSaving(false)
  }

  function F(key) {
    return (val) => setForm(f => ({ ...f, [key]: val }))
  }
  function v(key) { return form[key] || '' }

  // ── Calcul âge ──────────────────────────────────────────────────────────────
  function calcAge(ddn) {
    if (!ddn) return ''
    const d = new Date(ddn), now = new Date()
    let age = now.getFullYear() - d.getFullYear()
    if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--
    return `${age} ans`
  }

  // ── Journal ─────────────────────────────────────────────────────────────────
  async function saveNote() {
    if (!newNote.texte) { showToast('⚠️ Texte requis'); return }
    setNoteLoading(true)
    const tags = newNote.tags ? newNote.tags.split(',').map(t => t.trim()).filter(Boolean) : []
    const { error } = await supabase.from('journal_enfant').insert({
      enfant_id: id,
      auteur_id: profile.id,
      date: newNote.date,
      humeur: newNote.humeur,
      texte: newNote.texte,
      tags,
    })
    if (!error) {
      showToast('✅ Note ajoutée !')
      setShowNoteModal(false)
      setNewNote({ date: new Date().toISOString().slice(0,10), humeur:'😊', texte:'', tags:'' })
      fetchJournal()
    } else showToast('❌ Erreur')
    setNoteLoading(false)
  }

  async function deleteNote(noteId) {
    if (!window.confirm('Supprimer cette note ?')) return
    await supabase.from('journal_enfant').delete().eq('id', noteId)
    fetchJournal()
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

  const ONGLETS = [
    { id:'identite', icon:'🪪', label:'Identité' },
    { id:'famille', icon:'👨‍👩‍👧', label:'Famille' },
    { id:'placement', icon:'🏠', label:'Placement' },
    { id:'judiciaire', icon:'⚖️', label:'Judiciaire', restricted: isAF },
    { id:'quotidien', icon:'🌱', label:'Vie quotidienne' },
    { id:'journal', icon:'📝', label:'Journal', badge: journalNotes.length > 0 ? journalNotes.filter(n => {
      const d = new Date(n.date); const now = new Date(); return (now - d) < 7 * 24 * 3600 * 1000
    }).length : 0 },
  ]

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
            <div style={{ width:36, height:36, borderRadius:'50%', background:'linear-gradient(135deg, #1a4b8f, #2e8b4a)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, color:'#fff', flexShrink:0 }}>
              {initiales}
            </div>
            <div>
              <div className="page-title">{enfant.prenom} {enfant.nom}</div>
              <div className="page-subtitle">
                {age}{enfant.date_naissance && ` · Né(e) le ${new Date(enfant.date_naissance).toLocaleDateString('fr-FR')}`}
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
                {isReferent && <button onClick={() => setEditMode(true)} className="btn btn-secondary">✏️ Modifier</button>}
                <button onClick={() => showToast('📄 Rapport en cours...')} className="btn btn-success" style={{ background:'#2e8b4a', color:'#fff' }}>📄 Rapport</button>
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
                        <div style={{ padding:'10px 12px', background:'#eef1f8', borderRadius:8, fontSize:13, color:'#1c2333', fontFamily:'monospace', letterSpacing:'1px' }}>
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
                          style={{ padding:'10px 12px', border:'1.5px solid #dde3f0', borderRadius:8, fontFamily:'monospace', fontSize:13, background:'#f4f6fb', color:'#1c2333', outline:'none', letterSpacing:'1px' }}
                        />
                      )}
                    </div>
                    <Field label="Caisse d'affiliation" value={v('caisse_affiliation')} onChange={F('caisse_affiliation')} readOnly={!editMode} placeholder="CPAM..." />
                    <Field label="N° dossier CD81" value={v('numero_dossier')} onChange={F('numero_dossier')} readOnly={!editMode} span={2} />
                    <Field label="Groupe sanguin" value={v('groupe_sanguin')} onChange={F('groupe_sanguin')} readOnly={!editMode}
                      options={['A+','A-','B+','B-','AB+','AB-','O+','O-']} />
                  </FormGrid>
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
                                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                                    <span style={{ fontSize:22 }}>{doc.icon}</span>
                                    <span style={{ fontSize:12, fontWeight:600 }}>{doc.label}</span>
                                  </div>
                                  {doc.fields && doc.fields.map(f => (
                                    <div key={f.key} style={{ marginBottom:6 }}>
                                      <label style={{ fontSize:10, fontWeight:600, color:'#5a6478', textTransform:'uppercase', letterSpacing:'.3px', display:'block', marginBottom:2 }}>{f.label}</label>
                                      {editMode ? (
                                        <input type={f.type||'text'} value={v(f.key)} onChange={e => F(f.key)(e.target.value)}
                                          style={{ width:'100%', padding:'6px 10px', border:'1.5px solid #dde3f0', borderRadius:7, fontFamily:'Sora,sans-serif', fontSize:12, background:'#fff', outline:'none' }} />
                                      ) : (
                                        <div style={{ padding:'6px 10px', background:'#fff', borderRadius:7, fontSize:12, color: v(f.key) ? '#1c2333' : '#9aa3b8', border:'1px solid #dde3f0' }}>
                                          {f.type==='date' && v(f.key) ? new Date(v(f.key)).toLocaleDateString('fr-FR') : v(f.key) || '—'}
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
                {['pere', 'mere'].map(parent => (
                  <SectionCard key={parent} icon={parent === 'pere' ? '👨' : '👩'} title={parent === 'pere' ? 'Père' : 'Mère'}>
                    <FormGrid cols={3}>
                      <Field label="Nom" value={v(`${parent}_nom`)} onChange={F(`${parent}_nom`)} readOnly={!editMode} />
                      <Field label="Prénom" value={v(`${parent}_prenom`)} onChange={F(`${parent}_prenom`)} readOnly={!editMode} />
                      <Field label="Date de naissance" type="date" value={v(`${parent}_ddn`)} onChange={F(`${parent}_ddn`)} readOnly={!editMode} />
                      <Field label="Téléphone" type="tel" value={v(`${parent}_tel`)} onChange={F(`${parent}_tel`)} readOnly={!editMode} />
                      <Field label="Adresse" value={v(`${parent}_adresse`)} onChange={F(`${parent}_adresse`)} readOnly={!editMode} span={2} />
                      <Field label="Situation professionnelle" value={v(`${parent}_situation`)} onChange={F(`${parent}_situation`)} readOnly={!editMode} />
                      <Field label="Droits parentaux" value={v(`${parent}_droits`)} onChange={F(`${parent}_droits`)} readOnly={!editMode}
                        options={['Autorité parentale complète','Autorité parentale partielle','Déchéance partielle','Déchéance totale']} />
                      <Field label="Droit de visite" value={v(`${parent}_droit_visite`)} onChange={F(`${parent}_droit_visite`)} readOnly={!editMode}
                        options={['Visite médiatisée','Visite libre','Aucun droit','Suspendu']} />
                    </FormGrid>
                  </SectionCard>
                ))}

                <SectionCard icon="👧👦" title="Fratrie">
                  {(form.fratrie || []).map((f, i) => (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', background:'#f4f6fb', borderRadius:8, marginBottom:8, border:'1px solid #dde3f0' }}>
                      <div style={{ width:36, height:36, borderRadius:'50%', background:'#e8eef8', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>
                        {f.sexe === 'F' ? '👧' : '👦'}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:600 }}>{f.prenom} {f.nom}</div>
                        <div style={{ fontSize:11, color:'#9aa3b8' }}>
                          {f.ddn && `${calcAge(f.ddn)} · Né(e) le ${new Date(f.ddn).toLocaleDateString('fr-FR')}`}
                        </div>
                      </div>
                      <span style={{ padding:'3px 10px', borderRadius:10, fontSize:11, fontWeight:600,
                        background: f.meme_af ? '#e6f5eb' : '#fef3e2',
                        color: f.meme_af ? '#2e8b4a' : '#d97706' }}>
                        {f.meme_af ? 'Même famille d\'accueil' : 'Autre famille d\'accueil'}
                      </span>
                      {editMode && (
                        <button onClick={() => setForm(f => ({ ...f, fratrie: f.fratrie.filter((_,j) => j !== i) }))}
                          style={{ padding:'4px 8px', borderRadius:6, border:'1px solid #dde3f0', background:'#fff', color:'#c0392b', fontSize:11, cursor:'pointer' }}>✕</button>
                      )}
                    </div>
                  ))}
                  {editMode && (
                    <button onClick={() => {
                      const prenom = prompt('Prénom :'); if (!prenom) return
                      const nom = prompt('Nom :') || ''
                      const ddn = prompt('Date de naissance (YYYY-MM-DD) :') || ''
                      const meme_af = window.confirm('Même famille d\'accueil ?')
                      setForm(f => ({ ...f, fratrie: [...(f.fratrie || []), { prenom, nom, ddn, meme_af, sexe:'M' }] }))
                    }} className="btn btn-secondary" style={{ marginTop:8 }}>
                      + Ajouter un membre de la fratrie
                    </button>
                  )}
                  {(!form.fratrie || form.fratrie.length === 0) && !editMode && (
                    <div style={{ color:'#9aa3b8', fontStyle:'italic', fontSize:13 }}>Aucun membre de la fratrie renseigné</div>
                  )}
                </SectionCard>
              </>
            )}

            {/* ══════════════════════════════════════════════════════════════
                ONGLET PLACEMENT
            ══════════════════════════════════════════════════════════════ */}
            {onglet === 'placement' && (
              <>
                <SectionCard icon="🏠" title="Type de placement">
                  <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap' }}>
                    {[
                      { v:'judiciaire', icon:'⚖️', label:'Judiciaire', desc:'Décision du juge' },
                      { v:'administratif', icon:'📋', label:'Administratif', desc:'Accord parental' },
                      { v:'urgence', icon:'🚨', label:'Urgence', desc:'Placement immédiat' },
                      { v:'secret', icon:'🔒', label:'Secret', desc:'Adresse masquée', secret:true },
                    ].map(p => (
                      <div key={p.v} onClick={() => editMode && F('type_placement')(p.v)}
                        style={{
                          flex:1, minWidth:120, padding:'16px 12px', borderRadius:12, textAlign:'center', cursor: editMode ? 'pointer' : 'default',
                          border: `2px solid ${form.type_placement === p.v ? (p.secret ? '#8b1a1a' : '#1a4b8f') : '#dde3f0'}`,
                          background: form.type_placement === p.v ? (p.secret ? '#fdf0f0' : '#e8eef8') : '#f4f6fb',
                          transition:'all .15s'
                        }}>
                        <div style={{ fontSize:28, marginBottom:6 }}>{p.icon}</div>
                        <div style={{ fontSize:13, fontWeight:700, color: form.type_placement === p.v ? (p.secret ? '#8b1a1a' : '#1a4b8f') : '#1c2333' }}>{p.label}</div>
                        <div style={{ fontSize:11, color:'#9aa3b8', marginTop:2 }}>{p.desc}</div>
                      </div>
                    ))}
                  </div>

                  {form.type_placement === 'secret' && (
                    <div style={{ background:'#fdf0f0', border:'1px solid #f5c4c4', borderRadius:10, padding:'12px 16px', marginBottom:16, fontSize:13, color:'#8b1a1a', display:'flex', gap:10, alignItems:'flex-start' }}>
                      <span style={{ fontSize:18 }}>🔒</span>
                      <div>
                        <strong>Placement secret</strong> — Les informations suivantes ne doivent pas apparaître sur les documents destinés aux parents :
                        nom/prénom AF, adresse domicile, téléphone, ville, établissement scolaire.
                      </div>
                    </div>
                  )}

                  <FormGrid cols={3}>
                    <Field label="Date de placement" type="date" value={v('date_placement')} onChange={F('date_placement')} readOnly={!editMode} />
                    <Field label="Date de fin prévue" type="date" value={v('date_fin_placement')} onChange={F('date_fin_placement')} readOnly={!editMode} />
                    <Field label="Durée" readOnly value={
                      form.date_placement && form.date_fin_placement
                        ? (() => {
                            const d1 = new Date(form.date_placement), d2 = new Date(form.date_fin_placement)
                            const mois = Math.round((d2 - d1) / (1000 * 60 * 60 * 24 * 30))
                            return mois >= 12 ? `${Math.round(mois/12)} an(s)` : `${mois} mois`
                          })()
                        : '—'
                    } />
                  </FormGrid>
                </SectionCard>

                <SectionCard icon="🏛️" title="Maison du Département">
                  <FormGrid cols={3}>
                    <Field label="Nom de la MD" value={v('md_nom')} onChange={F('md_nom')} readOnly={!editMode} placeholder="MD Gaillac-Graulhet" />
                    <Field label="Territoire" value={v('territoire')} onChange={F('territoire')} readOnly={!editMode} />
                    <Field label="Adresse" value={v('md_adresse')} onChange={F('md_adresse')} readOnly={!editMode} />
                  </FormGrid>

                  <div style={{ marginTop:20, display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:12 }}>
                    <ContactCard icon="👩‍💼" role="Référente Enfant"
                      nom={enfant.referent?.nom} prenom={enfant.referent?.prenom}
                      tel={enfant.referent?.telephone} email={enfant.referent?.email}
                      bg="#e8eef8" />
                    <ContactCard icon="👨‍💼" role="Assistant Familial Principal"
                      nom={enfant.af_principal?.nom} prenom={enfant.af_principal?.prenom}
                      tel={enfant.af_principal?.telephone} email={enfant.af_principal?.email}
                      bg="#e6f5eb" />
                    <ContactCard icon="👩‍⚕️" role="Référente Santé"
                      nom={v('ref_sante_nom')} prenom={v('ref_sante_prenom')}
                      tel={v('ref_sante_tel')} email={v('ref_sante_email')}
                      bg="#f0ebfb"
                      onEdit={editMode ? () => showToast('✏️ Modifier référente santé...') : null} />
                    <ContactCard icon="🎖️" role="Délégué ASE"
                      nom={v('delegue_nom')} prenom={v('delegue_prenom')}
                      tel={v('delegue_tel')} email={v('delegue_email')}
                      bg="#fef3e2"
                      onEdit={editMode ? () => showToast('✏️ Modifier délégué ASE...') : null} />
                  </div>

                  {editMode && (
                    <div style={{ marginTop:16, display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:16 }}>
                      <SectionCard icon="👩‍⚕️" title="Modifier référente santé" defaultOpen={false}>
                        <FormGrid cols={2}>
                          <Field label="Prénom" value={v('ref_sante_prenom')} onChange={F('ref_sante_prenom')} />
                          <Field label="Nom" value={v('ref_sante_nom')} onChange={F('ref_sante_nom')} />
                          <Field label="Téléphone" value={v('ref_sante_tel')} onChange={F('ref_sante_tel')} />
                          <Field label="Email" value={v('ref_sante_email')} onChange={F('ref_sante_email')} />
                        </FormGrid>
                      </SectionCard>
                      <SectionCard icon="🎖️" title="Modifier délégué ASE" defaultOpen={false}>
                        <FormGrid cols={2}>
                          <Field label="Prénom" value={v('delegue_prenom')} onChange={F('delegue_prenom')} />
                          <Field label="Nom" value={v('delegue_nom')} onChange={F('delegue_nom')} />
                          <Field label="Téléphone" value={v('delegue_tel')} onChange={F('delegue_tel')} />
                          <Field label="Email" value={v('delegue_email')} onChange={F('delegue_email')} />
                        </FormGrid>
                      </SectionCard>
                    </div>
                  )}

                  {/* AF assigné */}
                  {editMode && (
                    <div style={{ marginTop:16 }}>
                      <label style={{ fontSize:11, fontWeight:600, color:'#5a6478', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:6 }}>AF Principal assigné</label>
                      <select value={v('af_principal_id')} onChange={e => F('af_principal_id')(e.target.value)}
                        style={{ width:'100%', maxWidth:340, padding:'10px 12px', border:'1.5px solid #dde3f0', borderRadius:8, fontFamily:'Sora,sans-serif', fontSize:13, background:'#f4f6fb', outline:'none' }}>
                        <option value="">— Sélectionner un AF —</option>
                        {collegues.filter(c => c.role === 'af').map(c => (
                          <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
                        ))}
                      </select>
                    </div>
                  )}
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
                  <button onClick={() => showToast('📎 Ajouter document judiciaire...')} className="btn btn-secondary" style={{ marginTop:16 }}>
                    📎 Ajouter document
                  </button>
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
                <SectionCard icon="🏥" title="Santé & Conditions spécifiques">
                  <FormGrid cols={3}>
                    <Field label="Médecin traitant" value={v('medecin')} onChange={F('medecin')} readOnly={!editMode} />
                    <Field label="Pédopsychiatre / Spécialiste" value={v('specialiste')} onChange={F('specialiste')} readOnly={!editMode} />
                    <Field label="Groupe sanguin" value={v('groupe_sanguin')} onChange={F('groupe_sanguin')} readOnly={!editMode}
                      options={['A+','A-','B+','B-','AB+','AB-','O+','O-']} />
                  </FormGrid>

                  <div style={{ marginTop:16 }}>
                    <label style={{ fontSize:11, fontWeight:600, color:'#5a6478', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:8 }}>Allergies & Conditions</label>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
                      {(form.conditions_sante || []).map((c, i) => (
                        <span key={i} style={{ padding:'4px 12px', borderRadius:15, fontSize:12, fontWeight:600, background:'#fef3e2', color:'#d97706', border:'1px solid #f5dca4', display:'flex', alignItems:'center', gap:4 }}>
                          {c}
                          {editMode && <span onClick={() => setForm(f => ({ ...f, conditions_sante: f.conditions_sante.filter((_,j) => j !== i) }))} style={{ cursor:'pointer', color:'#c0392b', marginLeft:3 }}>×</span>}
                        </span>
                      ))}
                      {editMode && (
                        <button onClick={() => {
                          const c = prompt('Allergie ou condition (ex: ⚠️ Allergie arachides, 💊 Ritaline 10mg) :')
                          if (c) setForm(f => ({ ...f, conditions_sante: [...(f.conditions_sante || []), c] }))
                        }} style={{ padding:'4px 12px', borderRadius:15, fontSize:12, border:'1px dashed #dde3f0', background:'#f4f6fb', cursor:'pointer' }}>
                          + Ajouter
                        </button>
                      )}
                    </div>
                  </div>

                  <Field label="Notes santé importantes (visibles par AF relais)" type="textarea"
                    value={v('notes_sante')} onChange={F('notes_sante')} readOnly={!editMode}
                    placeholder="Traitement, comportements, précautions importantes..." />
                </SectionCard>

                <SectionCard icon="👕" title="Vêture & Argent de poche">
                  <FormGrid cols={3}>
                    <Field label="Taille vêtements" value={v('taille_vetements')} onChange={F('taille_vetements')} readOnly={!editMode} placeholder="8 ans / 128 cm" />
                    <Field label="Pointure chaussures" value={v('pointure')} onChange={F('pointure')} readOnly={!editMode} />
                    <Field label="Allocation vêture mensuelle" value={v('allocation_veture')} onChange={F('allocation_veture')} readOnly={!editMode} placeholder="80 €" />
                    <Field label="Argent de poche hebdo" value={v('argent_poche')} onChange={F('argent_poche')} readOnly={!editMode} placeholder="5 €" />
                    <Field label="Solde actuel" value={v('solde_argent')} onChange={F('solde_argent')} readOnly={!editMode} />
                  </FormGrid>
                </SectionCard>

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
              </>
            )}

            {/* ══════════════════════════════════════════════════════════════
                ONGLET JOURNAL
            ══════════════════════════════════════════════════════════════ */}
            {onglet === 'journal' && (
              <>
                <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
                  <button onClick={() => setShowNoteModal(true)} className="btn btn-primary">+ Nouvelle note</button>
                  <div style={{ display:'flex', gap:6 }}>
                    {['😊','😐','😢','⚠️'].map(m => (
                      <button key={m} style={{ fontSize:18, padding:'6px 10px', borderRadius:8, border:'1px solid #dde3f0', background:'#fff', cursor:'pointer' }}
                        onClick={() => showToast(`Filtrer par humeur ${m}...`)}>{m}</button>
                    ))}
                  </div>
                  <button onClick={() => showToast('📄 Rapport synthétique ASE...')} className="btn btn-success" style={{ marginLeft:'auto', background:'#2e8b4a', color:'#fff' }}>
                    📄 Rapport ASE
                  </button>
                </div>

                {journalNotes.length === 0 ? (
                  <div style={{ textAlign:'center', padding:60, color:'#9aa3b8' }}>
                    <div style={{ fontSize:36, marginBottom:12 }}>📝</div>
                    <div style={{ fontSize:14 }}>Aucune note dans le journal</div>
                    <div style={{ fontSize:12, marginTop:4 }}>Ajoutez des observations quotidiennes sur l'enfant</div>
                  </div>
                ) : journalNotes.map(note => (
                  <div key={note.id} style={{ background:'#fff', border:'1px solid #dde3f0', borderRadius:12, padding:16, marginBottom:12, boxShadow:'0 2px 8px rgba(26,75,143,.06)' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                      <span style={{ fontSize:12, color:'#9aa3b8' }}>
                        {new Date(note.date).toLocaleDateString('fr-FR', { weekday:'short', day:'numeric', month:'long', year:'numeric' })}
                      </span>
                      <span style={{ padding:'2px 8px', borderRadius:10, background:'#e8eef8', color:'#1a4b8f', fontSize:10, fontWeight:700 }}>AF Principal</span>
                      <span style={{ fontSize:18, marginLeft:'auto' }}>{note.humeur}</span>
                      {(profile?.id === note.auteur_id || isReferent) && (
                        <button onClick={() => deleteNote(note.id)}
                          style={{ padding:'3px 8px', borderRadius:6, border:'1px solid #dde3f0', background:'#fdf0ee', color:'#c0392b', fontSize:11, cursor:'pointer' }}>🗑</button>
                      )}
                    </div>
                    <div style={{ fontSize:13, lineHeight:1.7, color:'#1c2333' }}>{note.texte}</div>
                    {note.tags && note.tags.length > 0 && (
                      <div style={{ display:'flex', gap:6, marginTop:8, flexWrap:'wrap' }}>
                        {note.tags.map((t, i) => (
                          <span key={i} style={{ padding:'2px 8px', borderRadius:10, background:'#f4f6fb', border:'1px solid #dde3f0', fontSize:11, color:'#5a6478' }}>{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}

          </div>
        </div>
      </div>

      {/* ── Modal nouvelle note ── */}
      {showNoteModal && (
        <div className="modal-overlay" onClick={() => setShowNoteModal(false)}>
          <div className="modal-box" style={{ maxWidth:480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">📝 Nouvelle note journal</div>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Date</label>
                <input type="date" className="form-control" value={newNote.date} onChange={e => setNewNote(n => ({...n, date: e.target.value}))} />
              </div>
              <div className="form-group">
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
            </div>
            <div className="form-group" style={{ marginTop:12 }}>
              <label className="form-label">Observation</label>
              <textarea className="form-control" rows={4} value={newNote.texte}
                onChange={e => setNewNote(n => ({...n, texte: e.target.value}))}
                placeholder="Décrivez la journée, le comportement, les événements notables..."
                style={{ resize:'vertical' }} />
            </div>
            <div className="form-group" style={{ marginTop:10 }}>
              <label className="form-label">Tags <span style={{ fontSize:10, color:'#9aa3b8', fontWeight:400 }}>(séparés par des virgules)</span></label>
              <input className="form-control" value={newNote.tags}
                onChange={e => setNewNote(n => ({...n, tags: e.target.value}))}
                placeholder="école, comportement, sommeil, post-visite..." />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowNoteModal(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={saveNote} disabled={noteLoading}>
                {noteLoading ? '⏳...' : '💾 Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
