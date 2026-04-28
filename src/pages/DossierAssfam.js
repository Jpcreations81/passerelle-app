import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Sidebar from '../components/Sidebar'

function SectionCard({ icon, title, children }) {
  const [open, setOpen] = useState(true)
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

function Field({ label, value, onChange, type = 'text', options, readOnly, span }) {
  const style = span ? { gridColumn: `span ${span}` } : {}
  const fmtDate = iso => { if (!iso) return ''; const [y,m,d] = iso.split('T')[0].split('-'); return `${d}/${m}/${y}` }
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:5, ...style }}>
      <label style={{ fontSize:11, fontWeight:600, color:'#5a6478', letterSpacing:'.4px', textTransform:'uppercase' }}>{label}</label>
      {readOnly ? (
        <div style={{ padding:'10px 12px', background:'#eef1f8', borderRadius:8, fontSize:13, color:'#1c2333' }}>
          {(type === 'date' ? fmtDate(value) : value) || <span style={{ color:'#9aa3b8', fontStyle:'italic' }}>—</span>}
        </div>
      ) : options ? (
        <select value={value || ''} onChange={e => onChange(e.target.value)}
          style={{ padding:'10px 12px', border:'1.5px solid #dde3f0', borderRadius:8, fontFamily:'Sora,sans-serif', fontSize:13, background:'#f4f6fb', color:'#1c2333', outline:'none' }}>
          <option value="">—</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : type === 'textarea' ? (
        <textarea value={value || ''} onChange={e => onChange(e.target.value)}
          style={{ padding:'10px 12px', border:'1.5px solid #dde3f0', borderRadius:8, fontFamily:'Sora,sans-serif', fontSize:13, background:'#f4f6fb', color:'#1c2333', outline:'none', minHeight:80, resize:'vertical' }} />
      ) : (
        <input type={type} value={value || ''} onChange={e => onChange(e.target.value)}
          style={{ padding:'10px 12px', border:'1.5px solid #dde3f0', borderRadius:8, fontFamily:'Sora,sans-serif', fontSize:13, background:'#f4f6fb', color:'#1c2333', outline:'none' }} />
      )}
    </div>
  )
}

function FG({ cols = 3, children }) {
  return <div style={{ display:'grid', gridTemplateColumns:`repeat(${cols}, 1fr)`, gap:16 }}>{children}</div>
}

const BAREME_KM = {
  5:  [{ max: 2000, taux: 0.32 }, { max: 10000, taux: 0.40 }, { max: Infinity, taux: 0.23 }],
  6:  [{ max: 2000, taux: 0.38 }, { max: 10000, taux: 0.47 }, { max: Infinity, taux: 0.27 }],
  8:  [{ max: 2000, taux: 0.41 }, { max: 10000, taux: 0.52 }, { max: Infinity, taux: 0.30 }],
}

function calcTauxKm(cv, kmCumules) {
  const tranches = BAREME_KM[cv] || BAREME_KM[5]
  const tranche = tranches.find(t => kmCumules <= t.max)
  return tranche ? tranche.taux : tranches[tranches.length - 1].taux
}

export default function DossierAssfam({ profile }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [af, setAf] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [form, setForm] = useState({})
  const [onglet, setOnglet] = useState('identite')
  const [toast, setToast] = useState('')
  const [enfantsAccueillis, setEnfantsAccueillis] = useState([])
  const [conges, setConges] = useState([])
  const [formations, setFormations] = useState([])
  const [foyerEnfants, setFoyerEnfants] = useState([])
  const [documents, setDocuments] = useState([])
  const [uploadingDoc, setUploadingDoc] = useState(null)
  const [collegues, setCollegues] = useState([])

  // Frais déplacement
  const [frDep, setFrDep] = useState('')
  const [frArr, setFrArr] = useState('')
  const [frKm, setFrKm] = useState('')
  const [frType, setFrType] = useState('ar')
  const [frMotif, setFrMotif] = useState('Visite médiatisée (VM)')
  const [frResult, setFrResult] = useState(null)

  // Congés
  const [showCongeModal, setShowCongeModal] = useState(false)
  const [newConge, setNewConge] = useState({ date_debut:'', date_fin:'', notes:'' })

  // Formation
  const [showFormationModal, setShowFormationModal] = useState(false)
  const [newFormation, setNewFormation] = useState({ titre:'', organisme:'', date_debut:'', date_fin:'', duree_heures:'', statut:'planifiee' })

  // Foyer enfant
  const [showFoyerModal, setShowFoyerModal] = useState(false)
  const [newFoyerEnfant, setNewFoyerEnfant] = useState({ prenom:'', nom:'', date_naissance:'', sexe:'M' })

  const isReferent = ['referent','encadrant','rtase','admin'].includes(profile?.role)
  const isOwnProfile = profile?.id === id

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 2800) }
  function fmtDate(iso) { if (!iso) return ''; const [y,m,d] = iso.split('T')[0].split('-'); return `${d}/${m}/${y}` }
  function F(k) { return v => setForm(f => ({ ...f, [k]: v })) }
  function v(k) { return form[k] || '' }

  const fetchAf = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', id).single()
    if (data) { console.log('AF chargé:', data.accord_urgence, data.cap_urgence, data.cap_troubles_comportement); setAf(data); setForm(data) }
    setLoading(false)
  }, [id])

  const fetchEnfants = useCallback(async () => {
    const { data } = await supabase.from('enfants').select('id, prenom, nom, date_naissance, type_placement, date_placement')
      .eq('af_principal_id', id).neq('type_placement', 'non_place')
    if (data) setEnfantsAccueillis(data)
  }, [id])

  const fetchConges = useCallback(async () => {
    const { data } = await supabase.from('conges').select('*').eq('af_id', id).order('date_debut', { ascending: false })
    if (data) setConges(data)
  }, [id])

  const fetchFormations = useCallback(async () => {
    const { data } = await supabase.from('formations').select('*').eq('af_id', id).order('date_debut', { ascending: false })
    if (data) setFormations(data)
  }, [id])

  const fetchFoyerEnfants = useCallback(async () => {
    const { data } = await supabase.from('foyer_enfants').select('*').eq('af_id', id)
    if (data) setFoyerEnfants(data)
  }, [id])

  const fetchDocuments = useCallback(async () => {
    const { data } = await supabase.from('documents_parent').select('*').eq('parent_id', id).order('created_at', { ascending: false })
    if (data) setDocuments(data)
  }, [id])

  const fetchCollegues = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('id, nom, prenom, role').eq('territoire', profile?.territoire)
    if (data) setCollegues(data)
  }, [profile])

  useEffect(() => {
    fetchAf(); fetchEnfants(); fetchConges(); fetchFormations(); fetchFoyerEnfants(); fetchDocuments(); fetchCollegues()
  }, [fetchAf, fetchEnfants, fetchConges, fetchFormations, fetchFoyerEnfants, fetchDocuments, fetchCollegues])

  async function saveForm() {
    setSaving(true)
    // Colonnes explicites à sauvegarder
    const colonnes = [
      'nom','prenom','date_naissance','situation_familiale','telephone','telephone2',
      'email','numero_secu','adresse','code_postal','ville','territoire','matricule',
      'numero_agrement','date_agrement','date_expiration_agrement',
      'places_agreees','places_relais','places_contrat_tarn',
      'deaf_obtenu','deaf_date','deaf_centre',
      'accord_urgence',
      'vehicule_marque','vehicule_immat','vehicule_cv','vehicule_assurance_exp','vehicule_ct_exp',
      'conjoint_nom','conjoint_profession','conjoint_telephone',
      'km_cumules_annee',
      'profil_age','profil_sexe','profil_duree',
      'cap_troubles_comportement_legers','cap_troubles_comportement','cap_handicap','cap_fratrie','cap_urgence','cap_bas_age','cap_relais',
    ]
    const formData = Object.fromEntries(
      colonnes.filter(k => form[k] !== undefined).map(k => [k, form[k]])
    )
    const { error } = await supabase.from('profiles').update(formData).eq('id', id)
    if (!error) { showToast('✅ Enregistré !'); setAf({...af, ...formData}); setEditMode(false) }
    else { console.error('Erreur save:', error); showToast('❌ ' + error.message) }
    setSaving(false)
  }

  async function uploadDoc(file, typeDoc) {
    if (!file) return
    setUploadingDoc(typeDoc)
    const ext = file.name.split('.').pop()
    const path = `assfam/${id}/${typeDoc}_${Date.now()}.${ext}`
    const { error: sErr } = await supabase.storage.from('documents-enfants').upload(path, file, { contentType: file.type })
    if (sErr) { showToast('❌ ' + sErr.message); setUploadingDoc(null); return }
    await supabase.from('documents_parent').insert({ parent_id: id, type_doc: typeDoc, nom: file.name, storage_path: path, taille: file.size, mime_type: file.type, uploaded_by: profile.id })
    showToast('✅ Document uploadé !')
    fetchDocuments()
    setUploadingDoc(null)
  }

  function calcFrais() {
    const km = parseFloat(frKm)
    if (!km || km <= 0) { showToast('⚠️ Distance invalide'); return }
    const kmCumules = af?.km_cumules_annee || 0
    const cv = af?.vehicule_cv || 5
    const taux = calcTauxKm(cv, kmCumules)
    const distance = frType === 'ar' ? km * 2 : km
    const montant = distance * taux
    setFrResult({ km: distance, taux, montant, motif: frMotif, depart: frDep, arrivee: frArr })
  }

  async function saveConge() {
    if (!newConge.date_debut || !newConge.date_fin) { showToast('⚠️ Dates requises'); return }
    const d1 = new Date(newConge.date_debut), d2 = new Date(newConge.date_fin)
    const nb_jours = Math.ceil((d2 - d1) / (1000*60*60*24)) + 1
    const { error } = await supabase.from('conges').insert({ ...newConge, af_id: id, nb_jours, statut: 'en_attente' })
    if (!error) { showToast('✅ Demande envoyée !'); setShowCongeModal(false); setNewConge({ date_debut:'', date_fin:'', notes:'' }); fetchConges() }
    else showToast('❌ ' + error.message)
  }

  async function validerConge(congeId, statut) {
    await supabase.from('conges').update({ statut, valideur_id: profile.id }).eq('id', congeId)
    showToast(statut === 'valide' ? '✅ Congé validé !' : '❌ Congé refusé')
    fetchConges()
  }

  async function saveFormation() {
    if (!newFormation.titre) { showToast('⚠️ Titre requis'); return }
    const { error } = await supabase.from('formations').insert({ ...newFormation, af_id: id })
    if (!error) { showToast('✅ Formation ajoutée !'); setShowFormationModal(false); setNewFormation({ titre:'', organisme:'', date_debut:'', date_fin:'', duree_heures:'', statut:'planifiee' }); fetchFormations() }
    else showToast('❌ ' + error.message)
  }

  async function saveFoyerEnfant() {
    if (!newFoyerEnfant.prenom) { showToast('⚠️ Prénom requis'); return }
    const { error } = await supabase.from('foyer_enfants').insert({ ...newFoyerEnfant, af_id: id })
    if (!error) { showToast('✅ Ajouté !'); setShowFoyerModal(false); setNewFoyerEnfant({ prenom:'', nom:'', date_naissance:'', sexe:'M' }); fetchFoyerEnfants() }
    else showToast('❌ ' + error.message)
  }

  function calcAge(ddn) {
    if (!ddn) return ''
    const d = new Date(ddn), now = new Date()
    let age = now.getFullYear() - d.getFullYear()
    if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--
    return `${age} ans`
  }

  const placesOccupees = enfantsAccueillis.length
  const placesContratTarn = af?.places_contrat_tarn || af?.places_agreees || 3
  const placesTotal = af?.places_agreees || 3
  const placesDisponiblesTarn = Math.max(0, placesContratTarn - placesOccupees)
  const placesDisponibles = placesDisponiblesTarn
  const placesAutreEmployeur = Math.max(0, placesTotal - placesContratTarn)
  const congesPris = conges.filter(c => c.statut === 'valide').reduce((s, c) => s + (c.nb_jours || 0), 0)
  const congesTotal = 30
  const congesRestants = congesTotal - congesPris
  const kmCumules = af?.km_cumules_annee || 0

  const agrExp = af?.date_expiration_agrement ? new Date(af.date_expiration_agrement) : null
  const joursAgrExp = agrExp ? Math.ceil((agrExp - new Date()) / (1000*60*60*24)) : null
  const agrAlerte = joursAgrExp !== null && joursAgrExp <= 90

  const ONGLETS = [
    { id:'identite', icon:'🪪', label:'Identité' },
    { id:'agrement', icon:'📜', label:'Agrément' },
    { id:'foyer', icon:'🏠', label:'Foyer' },
    { id:'enfants', icon:'👶', label:'Enfants & Frais' },
    { id:'conges', icon:'🏖️', label:'Congés' },
    { id:'formations', icon:'🎓', label:'Formations' },
    { id:'md', icon:'🏛️', label:'MD & Contrat' },
  ]

  if (loading) return (
    <div className="app-layout">
      <Sidebar profile={profile} />
      <div className="main-content" style={{ display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ textAlign:'center', color:'#9aa3b8' }}><div style={{ fontSize:36 }}>👨‍👩‍👧</div><div>Chargement...</div></div>
      </div>
    </div>
  )

  if (!af) return (
    <div className="app-layout">
      <Sidebar profile={profile} />
      <div className="main-content" style={{ padding:32 }}><div style={{ color:'#c0392b' }}>❌ Profil introuvable</div></div>
    </div>
  )

  const initiales = `${af.prenom?.[0] || ''}${af.nom?.[0] || ''}`

  return (
    <div className="app-layout">
      <Sidebar profile={profile} />
      <div className="main-content">

        {/* Header */}
        <header className="page-header">
          <img src="/logo_transparent.png" alt="P" className="header-logo" onError={e => e.target.style.display='none'} />
          <div className="header-sep" />
          <button onClick={() => navigate('/assfam')}
            style={{ display:'flex', alignItems:'center', gap:6, color:'#1a4b8f', fontSize:13, fontWeight:500, cursor:'pointer', background:'none', border:'none', fontFamily:'Sora,sans-serif', padding:'6px 10px', borderRadius:8 }}
            onMouseOver={e => e.currentTarget.style.background='#e8eef8'}
            onMouseOut={e => e.currentTarget.style.background='none'}>
            ← Assfam
          </button>
          <div className="header-sep" />
          <div style={{ display:'flex', alignItems:'center', gap:12, flex:1 }}>
            <div style={{ width:36, height:36, borderRadius:'50%', background:'linear-gradient(135deg, #1a4b8f, #2e8b4a)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, color:'#fff', flexShrink:0 }}>
              {initiales}
            </div>
            <div>
              <div className="page-title">{af.prenom} {af.nom}</div>
              <div className="page-subtitle">
                Assistante familiale agréée · {af.territoire || ''}
                {af.numero_agrement && ` · ${af.numero_agrement}`}
                {agrAlerte && <span style={{ marginLeft:8, background:'#fef3e2', color:'#d97706', padding:'1px 8px', borderRadius:10, fontSize:10, fontWeight:700 }}>⚠️ Renouvellement dans {joursAgrExp}j</span>}
              </div>
            </div>
          </div>
          <div className="header-actions">
            {editMode ? (
              <>
                <button onClick={() => { setForm(af); setEditMode(false) }} className="btn btn-danger">✕ Annuler</button>
                <button onClick={saveForm} disabled={saving} className="btn btn-primary">{saving ? '⏳...' : '💾 Enregistrer'}</button>
              </>
            ) : (
              (isReferent || isOwnProfile) && <button onClick={() => setEditMode(true)} className="btn btn-secondary">✏️ Modifier</button>
            )}
          </div>
        </header>

        {/* Summary bar */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12, padding:'16px 24px 0' }}>
          {[
            { val: placesOccupees, lbl: 'Enfants accueillis', sub: enfantsAccueillis.map(e => `${e.prenom} ${e.nom[0]}.`).join(' · ') || '—', color:'#2e8b4a', bg:'#e6f5eb' },
            { val: placesDisponibles, lbl: `Place${placesDisponibles > 1 ? 's' : ''} disponible${placesDisponibles > 1 ? 's' : ''}`, sub: `Agrément ${placesTotal} places`, color:'#1a4b8f', bg:'#e8eef8' },
            { val: congesRestants, lbl: 'Jours de congés', sub: 'Solde restant ' + new Date().getFullYear(), color:'#d97706', bg:'#fef3e2' },
            { val: kmCumules.toLocaleString('fr-FR'), lbl: 'Km cumulés ' + new Date().getFullYear(), sub: `Tranche ${kmCumules <= 2000 ? '1 (≤2 000)' : kmCumules <= 10000 ? '2 (2 001–10 000)' : '3 (>10 000)'}`, color:'#6d4c9e', bg:'#f0ebfb' },
          ].map((s, i) => (
            <div key={i} style={{ background: s.bg, borderRadius:12, padding:'16px 18px', border:`1px solid ${s.bg}` }}>
              <div style={{ fontSize:26, fontWeight:700, color: s.color }}>{s.val}</div>
              <div style={{ fontSize:12, fontWeight:600, color:'#1c2333', marginTop:2 }}>{s.lbl}</div>
              <div style={{ fontSize:11, color:'#9aa3b8', marginTop:2 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        <div style={{ padding:'16px 24px 24px' }}>
          {/* Onglets */}
          <div style={{ display:'flex', gap:4, background:'#fff', border:'1px solid #dde3f0', borderRadius:12, padding:6, marginBottom:24, boxShadow:'0 2px 12px rgba(26,75,143,.08)', flexWrap:'wrap' }}>
            {ONGLETS.map(o => (
              <button key={o.id} onClick={() => setOnglet(o.id)}
                style={{ display:'flex', alignItems:'center', gap:7, padding:'9px 16px', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer', border:'none', fontFamily:'Sora,sans-serif', transition:'all .15s', whiteSpace:'nowrap',
                  background: onglet === o.id ? '#1a4b8f' : 'none', color: onglet === o.id ? '#fff' : '#5a6478' }}>
                <span style={{ fontSize:15 }}>{o.icon}</span>{o.label}
              </button>
            ))}
          </div>

          {/* ══ IDENTITÉ ══ */}
          {onglet === 'identite' && (
            <>
              <SectionCard icon="👤" title="État civil">
                <FG>
                  <Field label="Nom" value={v('nom')} onChange={F('nom')} readOnly={!editMode} />
                  <Field label="Prénom" value={v('prenom')} onChange={F('prenom')} readOnly={!editMode} />
                  <Field label="Date de naissance" type="date" value={v('date_naissance')} onChange={F('date_naissance')} readOnly={!editMode} />
                  <Field label="Situation familiale" value={v('situation_familiale')} onChange={F('situation_familiale')} readOnly={!editMode}
                    options={['Célibataire','Marié(e)','Pacsé(e)','Divorcé(e)','Veuf/Veuve']} />
                  <Field label="Téléphone" type="tel" value={v('telephone')} onChange={F('telephone')} readOnly={!editMode} />
                  <Field label="Téléphone 2" type="tel" value={v('telephone2')} onChange={F('telephone2')} readOnly={!editMode} />
                  <Field label="Email" type="email" value={v('email')} onChange={F('email')} readOnly={!editMode} span={2} />
                  <Field label="N° Sécurité Sociale" value={v('numero_secu')} onChange={F('numero_secu')} readOnly={!editMode} />
                </FG>
              </SectionCard>

              <SectionCard icon="📄" title="Documents personnels">
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:16 }}>
                  {[
                    { key:'cni_assfam', icon:'🪪', label:'CNI' },
                    { key:'passeport_assfam', icon:'📘', label:'Passeport' },
                    { key:'vitale_assfam', icon:'💳', label:'Carte Vitale' },
                    { key:'casier_assfam', icon:'📋', label:'Casier judiciaire B3' },
                    { key:'permis_assfam', icon:'🚗', label:'Permis de conduire' },
                    { key:'autre_assfam', icon:'📎', label:'Autre document' },
                  ].map(doc => {
                    const docsType = documents.filter(d => d.type_doc === doc.key)
                    return (
                      <div key={doc.key} style={{ background:'#f4f6fb', borderRadius:10, padding:14, border:'1px solid #dde3f0' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                          <span style={{ fontSize:20 }}>{doc.icon}</span>
                          <span style={{ fontSize:12, fontWeight:600 }}>{doc.label}</span>
                        </div>
                        {docsType.map(d => (
                          <div key={d.id} style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 8px', background:'#fff', borderRadius:7, border:'1px solid #dde3f0', marginBottom:6 }}>
                            <span style={{ fontSize:14 }}>{d.mime_type?.includes('pdf') ? '📄' : '🖼️'}</span>
                            <span style={{ fontSize:11, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.nom}</span>
                            <button onClick={async () => { const { data: url } = await supabase.storage.from('documents-enfants').createSignedUrl(d.storage_path, 3600); if (url?.signedUrl) window.open(url.signedUrl, '_blank') }}
                              style={{ padding:'2px 6px', borderRadius:4, border:'1px solid #dde3f0', background:'#fff', fontSize:11, cursor:'pointer' }}>👁</button>
                            <button onClick={async () => { const { data: url } = await supabase.storage.from('documents-enfants').createSignedUrl(d.storage_path, 60); if (url?.signedUrl) { const r = await fetch(url.signedUrl); const b = await r.blob(); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = d.nom; document.body.appendChild(a); a.click(); document.body.removeChild(a) } }}
                              style={{ padding:'2px 6px', borderRadius:4, border:'1px solid #dde3f0', background:'#fff', fontSize:11, cursor:'pointer' }}>⬇</button>
                          </div>
                        ))}
                        <label style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 8px', border:'1px dashed #c4d4f5', borderRadius:7, background:'#e8eef8', color:'#1a4b8f', fontSize:11, cursor:'pointer' }}>
                          {uploadingDoc === doc.key ? '⏳...' : '📎 Ajouter'}
                          <input type="file" accept="image/*,application/pdf" style={{ display:'none' }}
                            onChange={e => { if (e.target.files[0]) uploadDoc(e.target.files[0], doc.key) }} />
                        </label>
                      </div>
                    )
                  })}
                </div>
              </SectionCard>
            </>
          )}

          {/* ══ AGRÉMENT ══ */}
          {onglet === 'agrement' && (
            <>
              <SectionCard icon="📜" title="Agrément en cours">
                {agrAlerte && (
                  <div style={{ background:'#fef3e2', border:'1px solid #f5dca4', borderRadius:10, padding:'10px 14px', marginBottom:16, fontSize:12, color:'#d97706', display:'flex', alignItems:'center', gap:8 }}>
                    ⚠️ <strong>Renouvellement dans {joursAgrExp} jours</strong> — Expire le {fmtDate(af.date_expiration_agrement)}
                  </div>
                )}
                <FG cols={4}>
                  <Field label="N° Agrément" value={v('numero_agrement')} onChange={F('numero_agrement')} readOnly={!editMode} />
                  <Field label="Délivré par" value="Conseil Départemental du Tarn (81)" readOnly />
                  <Field label="Date de délivrance" type="date" value={v('date_agrement')} onChange={F('date_agrement')} readOnly={!editMode} />
                  <Field label="Date d'expiration" type="date" value={v('date_expiration_agrement')} onChange={F('date_expiration_agrement')} readOnly={!editMode} />
                </FG>
                <FG cols={3} style={{ marginTop:12 }}>
                  <div style={{ display:'flex', flexDirection:'column', gap:5 }}><label style={{ fontSize:11, fontWeight:600, color:'#5a6478', textTransform:'uppercase', letterSpacing:'.4px' }}>Places agréées (total)</label>{editMode ? (<input type='number' min='1' max='3' value={v('places_agreees') || ''} onChange={e => F('places_agreees')(Math.min(parseInt(e.target.value) || 1, 3))} style={{ padding:'10px 12px', border:'1.5px solid #dde3f0', borderRadius:8, fontFamily:'Sora,sans-serif', fontSize:13, background:'#f4f6fb', outline:'none' }} />) : (<div style={{ padding:'10px 12px', background:'#eef1f8', borderRadius:8, fontSize:13 }}>{v('places_agreees') || <span style={{ color:'#9aa3b8', fontStyle:'italic' }}>—</span>}</div>)}<div style={{ fontSize:10, color:'#9aa3b8', marginTop:2 }}>Max 3 places (agrément individuel)</div></div>
                  <Field label="Places contractées Tarn" type="number" value={v('places_contrat_tarn')} onChange={F('places_contrat_tarn')} readOnly={!editMode} />
                  <Field label="Dont places relais" type="number" value={v('places_relais')} onChange={F('places_relais')} readOnly={!editMode} />
                </FG>
                <div style={{ marginTop:14 }}>
                  <div style={{ fontSize:12, color:'#5a6478', marginBottom:4 }}>
                    <strong>Contrat Tarn :</strong> {placesOccupees}/{placesContratTarn} occupée{placesOccupees > 1 ? 's' : ''}
                    <span style={{ float:'right', fontWeight:600, color: placesDisponibles > 0 ? '#2e8b4a' : '#c0392b' }}>
                      {placesDisponibles > 0 ? `${placesDisponibles} dispo${placesDisponibles > 1 ? 's' : ''}` : 'Complet Tarn'}
                    </span>
                  </div>
                  <div style={{ height:8, background:'#eef1f8', borderRadius:10, overflow:'hidden', marginBottom:8 }}>
                    <div style={{ height:'100%', width:`${Math.min(100, (placesOccupees/Math.max(placesContratTarn,1))*100)}%`, background: placesOccupees >= placesContratTarn ? '#c0392b' : '#2e8b4a', borderRadius:10 }} />
                  </div>
                </div>
                <div style={{ marginTop:14 }}>
                  <label style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 12px', border:'1px dashed #c4d4f5', borderRadius:8, background:'#f0f9ff', color:'#1a4b8f', fontSize:12, cursor:'pointer', fontFamily:'Sora,sans-serif' }}>
                    {uploadingDoc === 'agrement' ? '⏳...' : '📎 Uploader document agrément'}
                    <input type="file" accept="image/*,application/pdf" style={{ display:'none' }} onChange={e => { if (e.target.files[0]) uploadDoc(e.target.files[0], 'agrement') }} />
                  </label>
                  {documents.filter(d => d.type_doc === 'agrement').map(d => (
                    <div key={d.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', background:'#f4f6fb', borderRadius:7, border:'1px solid #dde3f0', marginTop:6 }}>
                      <span>📄</span><span style={{ flex:1, fontSize:12 }}>{d.nom}</span>
                      <button onClick={async () => { const { data: u } = await supabase.storage.from('documents-enfants').createSignedUrl(d.storage_path, 3600); if (u?.signedUrl) window.open(u.signedUrl, '_blank') }} style={{ padding:'3px 7px', borderRadius:5, border:'1px solid #dde3f0', background:'#fff', fontSize:11, cursor:'pointer' }}>👁</button>
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard icon="🎓" title="DEAF — Diplôme d'État">
                <div style={{ background:'#f0f9ff', border:'1px solid #c4d4f5', borderRadius:10, padding:'10px 14px', marginBottom:14, fontSize:12, color:'#1a4b8f', lineHeight:1.6 }}>
                  💡 <strong>Rappel réglementaire :</strong> Le DEAF conditionne le renouvellement et l'extension de l'agrément.
                </div>
                <FG>
                  <Field label="DEAF obtenu" value={v('deaf_obtenu')} onChange={F('deaf_obtenu')} readOnly={!editMode}
                    options={['oui','non','en_cours']} />
                  <Field label="Date d'obtention" type="date" value={v('deaf_date')} onChange={F('deaf_date')} readOnly={!editMode} />
                  <Field label="Centre de formation" value={v('deaf_centre')} onChange={F('deaf_centre')} readOnly={!editMode} />
                </FG>
                <div style={{ marginTop:12 }}>
                  <label style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 12px', border:'1px dashed #c4d4f5', borderRadius:8, background:'#f0f9ff', color:'#1a4b8f', fontSize:12, cursor:'pointer', fontFamily:'Sora,sans-serif' }}>
                    {uploadingDoc === 'deaf' ? '⏳...' : '📎 Uploader diplôme DEAF'}
                    <input type="file" accept="image/*,application/pdf" style={{ display:'none' }} onChange={e => { if (e.target.files[0]) uploadDoc(e.target.files[0], 'deaf') }} />
                  </label>
                  {documents.filter(d => d.type_doc === 'deaf').map(d => (
                    <div key={d.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', background:'#f4f6fb', borderRadius:7, border:'1px solid #dde3f0', marginTop:6 }}>
                      <span>🎓</span><span style={{ flex:1, fontSize:12 }}>{d.nom}</span>
                      <button onClick={async () => { const { data: u } = await supabase.storage.from('documents-enfants').createSignedUrl(d.storage_path, 3600); if (u?.signedUrl) window.open(u.signedUrl, '_blank') }} style={{ padding:'3px 7px', borderRadius:5, border:'1px solid #dde3f0', background:'#fff', fontSize:11, cursor:'pointer' }}>👁</button>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </>
          )}

          {/* ══ FOYER ══ */}
          {onglet === 'foyer' && (
            <>
              <SectionCard icon="🏠" title="Domicile">
                <FG>
                  <Field label="Adresse" value={v('adresse')} onChange={F('adresse')} readOnly={!editMode} span={2} />
                  <Field label="Code postal" value={v('code_postal')} onChange={F('code_postal')} readOnly={!editMode} />
                  <Field label="Ville" value={v('ville')} onChange={F('ville')} readOnly={!editMode} />
                  <Field label="Téléphone domicile" type="tel" value={v('telephone')} onChange={F('telephone')} readOnly={!editMode} />
                </FG>
                {(v('adresse') || v('ville')) && (
                  <div style={{ marginTop:12 }}>
                    <a href={`https://maps.google.com/?q=${encodeURIComponent([v('adresse'), v('code_postal'), v('ville')].filter(Boolean).join(', '))}`}
                      target="_blank" rel="noreferrer"
                      style={{ padding:'6px 12px', borderRadius:8, border:'1px solid #c4d4f5', background:'#e8eef8', color:'#1a4b8f', fontSize:12, textDecoration:'none', fontFamily:'Sora,sans-serif' }}>
                      📍 Ouvrir dans Maps
                    </a>
                    <span style={{ fontSize:11, color:'#5a6478', marginLeft:10 }}>
                      Règle Tarn : <strong>Ville à Ville (Mairie à Mairie)</strong>
                    </span>
                  </div>
                )}
              </SectionCard>

              <SectionCard icon="🚗" title="Véhicule">
                <FG>
                  <Field label="Marque / Modèle" value={v('vehicule_marque')} onChange={F('vehicule_marque')} readOnly={!editMode} />
                  <Field label="Immatriculation" value={v('vehicule_immat')} onChange={F('vehicule_immat')} readOnly={!editMode} />
                  <Field label="Puissance fiscale (CV)" value={String(v('vehicule_cv') || '5')} onChange={val => F('vehicule_cv')(parseInt(val))} readOnly={!editMode}
                    options={['5','6','8']} />
                  <Field label="Expiration assurance" type="date" value={v('vehicule_assurance_exp')} onChange={F('vehicule_assurance_exp')} readOnly={!editMode} />
                  <Field label="Contrôle technique" type="date" value={v('vehicule_ct_exp')} onChange={F('vehicule_ct_exp')} readOnly={!editMode} />
                </FG>
                {(() => {
                  const cv = af?.vehicule_cv || 5
                  const tranches = BAREME_KM[cv] || BAREME_KM[5]
                  const taucActuel = calcTauxKm(cv, kmCumules)
                  return (
                    <div style={{ background:'#e8eef8', border:'1px solid #c4d4f5', borderRadius:9, padding:'10px 14px', marginTop:12, fontSize:12, color:'#1a4b8f' }}>
                      🚗 <strong>Barème {cv} CV</strong> · Taux actuel : <strong>{taucActuel.toFixed(2)} €/km</strong> · Km cumulés 2026 : <strong>{kmCumules.toLocaleString('fr-FR')}</strong>
                      <div style={{ marginTop:8, display:'flex', gap:8 }}>
                        {tranches.map((t, i) => (
                          <div key={i} style={{ flex:1, padding:'6px 8px', borderRadius:7, background: taucActuel === t.taux ? '#1a4b8f' : '#fff', color: taucActuel === t.taux ? '#fff' : '#1c2333', fontSize:11, textAlign:'center', border:'1px solid #dde3f0' }}>
                            <div style={{ fontWeight:700 }}>{t.taux.toFixed(2)} €/km</div>
                            <div style={{ fontSize:10, opacity:.8 }}>≤{t.max === Infinity ? '+10k' : t.max.toLocaleString()} km</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}
              </SectionCard>

              <SectionCard icon="👨‍👩‍👧" title="Composition du foyer">
                <FG>
                  <Field label="Conjoint(e) — Nom Prénom" value={v('conjoint_nom')} onChange={F('conjoint_nom')} readOnly={!editMode} />
                  <Field label="Profession" value={v('conjoint_profession')} onChange={F('conjoint_profession')} readOnly={!editMode} />
                  <Field label="Téléphone conjoint" type="tel" value={v('conjoint_telephone')} onChange={F('conjoint_telephone')} readOnly={!editMode} />
                </FG>
                <div style={{ marginTop:16 }}>
                  <div style={{ fontSize:11, fontWeight:600, color:'#5a6478', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:8 }}>Enfants propres du foyer</div>
                  {foyerEnfants.map(e => (
                    <div key={e.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 12px', background:'#f4f6fb', borderRadius:8, marginBottom:6, border:'1px solid #dde3f0' }}>
                      <span style={{ fontSize:18 }}>{e.sexe === 'F' ? '👧' : '👦'}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:600 }}>{e.prenom} {e.nom}</div>
                        <div style={{ fontSize:11, color:'#9aa3b8' }}>{e.date_naissance && calcAge(e.date_naissance)}</div>
                      </div>
                    </div>
                  ))}
                  {editMode && (
                    <button onClick={() => setShowFoyerModal(true)} className="btn btn-secondary" style={{ marginTop:8, fontSize:12 }}>+ Ajouter</button>
                  )}
                </div>
              </SectionCard>
            </>
          )}

          {/* ══ ENFANTS & FRAIS ══ */}
          {onglet === 'enfants' && (
            <>
              <SectionCard icon="👶" title="Enfants accueillis actuellement">
                {enfantsAccueillis.length === 0 ? (
                  <div style={{ color:'#9aa3b8', fontStyle:'italic', fontSize:13 }}>Aucun enfant accueilli actuellement</div>
                ) : enfantsAccueillis.map(e => (
                  <div key={e.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', background:'#f4f6fb', borderRadius:10, marginBottom:8, border:'1px solid #dde3f0' }}>
                    <div style={{ width:38, height:38, borderRadius:'50%', background:'linear-gradient(135deg,#1a4b8f,#2e8b4a)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'#fff' }}>
                      {e.prenom?.[0]}{e.nom?.[0]}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:700 }}>{e.prenom} {e.nom}</div>
                      <div style={{ fontSize:11, color:'#9aa3b8' }}>{calcAge(e.date_naissance)} · Depuis {fmtDate(e.date_placement)} · {e.type_placement}</div>
                    </div>
                    <span style={{ padding:'3px 10px', borderRadius:10, background:'#e8eef8', color:'#1a4b8f', fontSize:11, fontWeight:600 }}>Principal</span>
                    <button onClick={() => navigate(`/enfants/${e.id}`)}
                      style={{ padding:'5px 10px', borderRadius:7, border:'1px solid #c4d4f5', background:'#e8eef8', color:'#1a4b8f', fontSize:11, cursor:'pointer' }}>📁 Dossier</button>
                  </div>
                ))}
                {placesDisponibles > 0 && (
                  <div style={{ marginTop:8, padding:'10px 14px', background:'#e6f5eb', border:'1px solid #c4e8cc', borderRadius:8, fontSize:12, color:'#2e8b4a', display:'flex', gap:8 }}>
                    <span>✅</span><span><strong>{placesDisponibles} place{placesDisponibles > 1 ? 's' : ''} disponible{placesDisponibles > 1 ? 's' : ''}</strong> sur {placesTotal} agréées</span>
                  </div>
                )}
              </SectionCard>

              <SectionCard icon="👤" title="Profil d'accueil souhaité">
                {/* Ligne 1 : Age, Sexe, Durée */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:16, marginBottom:16 }}>

                  {/* Tranche d age */}
                  <div>
                    <label style={{ fontSize:11, fontWeight:600, color:'#5a6478', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:8 }}>Tranche d'âge souhaitée</label>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {['0-3 ans','3-6 ans','6-10 ans','10-15 ans','15-18 ans','Indifférent'].map(a => (
                        <button key={a} type="button" onClick={() => editMode && F('profil_age')(a)}
                          style={{ padding:'5px 10px', borderRadius:20, border:`1.5px solid ${v('profil_age')===a ? '#1a4b8f' : '#dde3f0'}`, background: v('profil_age')===a ? '#e8eef8' : '#fff', color: v('profil_age')===a ? '#1a4b8f' : '#5a6478', fontSize:11, fontWeight: v('profil_age')===a ? 700 : 500, cursor: editMode ? 'pointer' : 'default' }}>
                          {a}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Sexe */}
                  <div>
                    <label style={{ fontSize:11, fontWeight:600, color:'#5a6478', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:8 }}>Sexe préféré</label>
                    <div style={{ display:'flex', gap:6 }}>
                      {['Indifférent','Fille','Garçon'].map(s => (
                        <button key={s} type="button" onClick={() => editMode && F('profil_sexe')(s)}
                          style={{ flex:1, padding:'8px', borderRadius:8, border:`1.5px solid ${v('profil_sexe')===s ? '#1a4b8f' : '#dde3f0'}`, background: v('profil_sexe')===s ? '#e8eef8' : '#fff', color: v('profil_sexe')===s ? '#1a4b8f' : '#5a6478', fontSize:12, fontWeight: v('profil_sexe')===s ? 700 : 500, cursor: editMode ? 'pointer' : 'default' }}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Durée */}
                  <div>
                    <label style={{ fontSize:11, fontWeight:600, color:'#5a6478', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:8 }}>Durée accueil préférée</label>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {['Indifférent','Court terme','Long terme','Urgence'].map(d => (
                        <button key={d} type="button" onClick={() => editMode && F('profil_duree')(d)}
                          style={{ padding:'6px 10px', borderRadius:20, border:`1.5px solid ${v('profil_duree')===d ? '#1a4b8f' : '#dde3f0'}`, background: v('profil_duree')===d ? '#e8eef8' : '#fff', color: v('profil_duree')===d ? '#1a4b8f' : '#5a6478', fontSize:11, fontWeight: v('profil_duree')===d ? 700 : 500, cursor: editMode ? 'pointer' : 'default' }}>
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Capacités particulières */}
                <div>
                  <label style={{ fontSize:11, fontWeight:600, color:'#5a6478', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:10 }}>Capacités particulières</label>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                    {[
                      { key:'cap_troubles_comportement_legers', label:'Enfants avec troubles du comportement légers', icon:'🧠' },
                      { key:'cap_troubles_comportement', label:'Enfants avec troubles du comportement lourds', icon:'🧠' },
                      { key:'cap_handicap',              label:'Enfants porteurs de handicap',               icon:'♿' },
                      { key:'cap_fratrie',               label:'Fratries (accueil simultané)',               icon:'👧👦' },
                      { key:'cap_urgence',               label:"Accueil d'urgence (moins de 48h)",          icon:'🚨' },
                      { key:'cap_bas_age',               label:'Enfants en bas âge (0-3 ans)',               icon:'🍼' },
                      { key:'cap_relais',               label:'Accepte les relais',                         icon:'🔄' },
                    ].map(cap => (
                      <label key={cap.key}
                        style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background: v(cap.key) ? '#e8eef8' : '#f4f6fb', borderRadius:8, cursor: editMode ? 'pointer' : 'default', border:`1px solid ${v(cap.key) ? '#1a4b8f' : '#dde3f0'}`, transition:'all .15s' }}>
                        <input type="checkbox" checked={!!v(cap.key)} onChange={e => editMode && F(cap.key)(e.target.checked)}
                          style={{ width:16, height:16, cursor: editMode ? 'pointer' : 'default', accentColor:'#1a4b8f' }} />
                        <span style={{ fontSize:16 }}>{cap.icon}</span>
                        <span style={{ fontSize:12, color: v(cap.key) ? '#1a4b8f' : '#5a6478', fontWeight: v(cap.key) ? 600 : 400 }}>{cap.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </SectionCard>

              <SectionCard icon="🚗" title="Calcul frais de déplacement">
                <div style={{ background:'#fef3e2', border:'1px solid #f5dca4', borderRadius:9, padding:'10px 14px', fontSize:12, color:'#d97706', marginBottom:14 }}>
                  📍 Tarn (81) — Calcul <strong>Ville à Ville</strong> · Véhicule : {af?.vehicule_cv || 5} CV · Cumul 2026 : <strong>{kmCumules.toLocaleString()} km</strong>
                </div>
                <FG cols={2}>
                  <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                    <label style={{ fontSize:11, fontWeight:600, color:'#5a6478', textTransform:'uppercase' }}>Commune de départ</label>
                    <input className="form-control" value={frDep} onChange={e => setFrDep(e.target.value)} placeholder={af?.ville || 'Commune...'} />
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                    <label style={{ fontSize:11, fontWeight:600, color:'#5a6478', textTransform:'uppercase' }}>Commune d'arrivée</label>
                    <input className="form-control" value={frArr} onChange={e => setFrArr(e.target.value)} placeholder="Destination..." />
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                    <label style={{ fontSize:11, fontWeight:600, color:'#5a6478', textTransform:'uppercase' }}>Distance aller (km)</label>
                    <input type="number" className="form-control" value={frKm} onChange={e => setFrKm(e.target.value)} placeholder="Ex: 12" min="0" />
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                    <label style={{ fontSize:11, fontWeight:600, color:'#5a6478', textTransform:'uppercase' }}>Type de trajet</label>
                    <select className="form-control" value={frType} onChange={e => setFrType(e.target.value)}>
                      <option value="ar">Aller-retour</option>
                      <option value="a">Aller simple</option>
                    </select>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:5, gridColumn:'span 2' }}>
                    <label style={{ fontSize:11, fontWeight:600, color:'#5a6478', textTransform:'uppercase' }}>Motif</label>
                    <select className="form-control" value={frMotif} onChange={e => setFrMotif(e.target.value)}>
                      {['Visite médiatisée (VM)','Rendez-vous médical','Audience tribunal','Réunion ASE','École','Activité extrascolaire','Autre'].map(m => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                </FG>
                <div style={{ display:'flex', gap:10, marginTop:12 }}>
                  <button onClick={calcFrais} className="btn btn-primary">🧮 Calculer</button>
                  {frResult && (
                    <button onClick={() => {
                      const txt = `Frais déplacement — ${frResult.motif}\nDe ${frResult.depart} à ${frResult.arrivee}\n${frResult.km} km × ${frResult.taux.toFixed(2)} €/km = ${frResult.montant.toFixed(2)} €`
                      navigator.clipboard.writeText(txt); showToast('📋 Copié !')
                    }} className="btn btn-secondary">📋 Copier</button>
                  )}
                </div>
                {frResult && (
                  <div style={{ marginTop:14, background:'#e6f5eb', border:'1px solid #c4e8cc', borderRadius:10, padding:'14px 18px' }}>
                    <div style={{ fontSize:24, fontWeight:700, color:'#2e8b4a' }}>{frResult.montant.toFixed(2)} €</div>
                    <div style={{ fontSize:12, color:'#2e7d32', marginTop:4 }}>
                      {frResult.km} km × {frResult.taux.toFixed(2)} €/km · {frResult.motif}
                      {frResult.depart && frResult.arrivee && ` · De ${frResult.depart} à ${frResult.arrivee}`}
                    </div>
                  </div>
                )}
              </SectionCard>
            </>
          )}

          {/* ══ CONGÉS ══ */}
          {onglet === 'conges' && (
            <>
              <SectionCard icon="🏖️" title="Solde de congés">
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12, marginBottom:16 }}>
                  {[
                    { val: congesTotal, lbl: 'Jours acquis', color:'#2e8b4a', bg:'#e6f5eb' },
                    { val: congesPris, lbl: 'Jours pris', color:'#1a4b8f', bg:'#e8eef8' },
                    { val: congesRestants, lbl: 'Jours restants', color:'#d97706', bg:'#fef3e2' },
                    { val: conges.filter(c => c.statut === 'en_attente').reduce((s,c) => s+(c.nb_jours||0), 0), lbl: 'En attente', color:'#6d4c9e', bg:'#f0ebfb' },
                  ].map((s, i) => (
                    <div key={i} style={{ background: s.bg, borderRadius:10, padding:'14px', textAlign:'center' }}>
                      <div style={{ fontSize:24, fontWeight:700, color: s.color }}>{s.val}</div>
                      <div style={{ fontSize:11, color:'#5a6478', marginTop:2 }}>{s.lbl}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginBottom:4, fontSize:12, color:'#5a6478' }}>
                  Consommation {congesPris}/{congesTotal} jours ({Math.round((congesPris/congesTotal)*100)}%)
                </div>
                <div style={{ height:8, background:'#eef1f8', borderRadius:10, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${Math.min(100,(congesPris/congesTotal)*100)}%`, background: congesPris > 20 ? '#c0392b' : '#2e8b4a', borderRadius:10, transition:'width .3s' }} />
                </div>
              </SectionCard>

              <SectionCard icon="📅" title="Demande de congés">
                <div style={{ background:'#e8eef8', border:'1px solid #c4d4f5', borderRadius:9, padding:'10px 14px', fontSize:12, color:'#1a4b8f', marginBottom:14, lineHeight:1.6 }}>
                  💡 La demande sera transmise à votre encadrant technique. Elle inclura automatiquement les relais pour chaque enfant accueilli.
                </div>
                <button onClick={() => setShowCongeModal(true)} className="btn btn-primary">📤 Nouvelle demande de congés</button>
              </SectionCard>

              <SectionCard icon="📋" title="Historique des congés">
                {conges.length === 0 ? (
                  <div style={{ color:'#9aa3b8', fontStyle:'italic', fontSize:13 }}>Aucun congé enregistré</div>
                ) : conges.map(c => (
                  <div key={c.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', background:'#f4f6fb', borderRadius:10, marginBottom:8, border:'1px solid #dde3f0' }}>
                    <span style={{ fontSize:20 }}>🏖️</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:600 }}>{fmtDate(c.date_debut)} → {fmtDate(c.date_fin)}</div>
                      <div style={{ fontSize:11, color:'#9aa3b8' }}>{c.nb_jours} jours{c.notes && ` · ${c.notes}`}</div>
                    </div>
                    <span style={{ padding:'3px 10px', borderRadius:10, fontSize:11, fontWeight:600,
                      background: c.statut === 'valide' ? '#e6f5eb' : c.statut === 'refuse' ? '#fdf0ee' : '#fef3e2',
                      color: c.statut === 'valide' ? '#2e8b4a' : c.statut === 'refuse' ? '#c0392b' : '#d97706' }}>
                      {c.statut === 'valide' ? '✅ Validé' : c.statut === 'refuse' ? '❌ Refusé' : '⏳ En attente'}
                    </span>
                    {isReferent && c.statut === 'en_attente' && (
                      <div style={{ display:'flex', gap:6 }}>
                        <button onClick={() => validerConge(c.id, 'valide')} style={{ padding:'4px 8px', borderRadius:6, border:'1px solid #c4e8cc', background:'#e6f5eb', color:'#2e8b4a', fontSize:11, cursor:'pointer' }}>✅</button>
                        <button onClick={() => validerConge(c.id, 'refuse')} style={{ padding:'4px 8px', borderRadius:6, border:'1px solid #fde8e8', background:'#fdf0ee', color:'#c0392b', fontSize:11, cursor:'pointer' }}>❌</button>
                      </div>
                    )}
                  </div>
                ))}
              </SectionCard>
            </>
          )}

          {/* ══ FORMATIONS ══ */}
          {onglet === 'formations' && (
            <>
              <SectionCard icon="🎓" title="DEAF — Diplôme d'État">
                <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', background: af?.deaf_obtenu === 'oui' ? '#e6f5eb' : '#fef3e2', borderRadius:10, marginBottom:14, border:`1px solid ${af?.deaf_obtenu === 'oui' ? '#c4e8cc' : '#f5dca4'}` }}>
                  <span style={{ fontSize:24 }}>🎓</span>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color: af?.deaf_obtenu === 'oui' ? '#2e8b4a' : '#d97706' }}>
                      {af?.deaf_obtenu === 'oui' ? 'DEAF obtenu ✅' : af?.deaf_obtenu === 'en_cours' ? 'DEAF en cours ⏳' : 'DEAF non obtenu ❌'}
                    </div>
                    {af?.deaf_date && <div style={{ fontSize:12, color:'#5a6478' }}>Obtenu le {fmtDate(af.deaf_date)} · {af.deaf_centre}</div>}
                  </div>
                </div>
              </SectionCard>

              <SectionCard icon="📚" title="Formations continues">
                <button onClick={() => setShowFormationModal(true)} className="btn btn-secondary" style={{ marginBottom:16 }}>+ Ajouter une formation</button>
                {formations.length === 0 ? (
                  <div style={{ color:'#9aa3b8', fontStyle:'italic', fontSize:13 }}>Aucune formation enregistrée</div>
                ) : (
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                    <thead>
                      <tr style={{ borderBottom:'2px solid #dde3f0' }}>
                        {['Formation','Organisme','Date','Durée','Statut'].map(h => (
                          <th key={h} style={{ padding:'8px 10px', textAlign:'left', fontSize:11, fontWeight:600, color:'#5a6478', textTransform:'uppercase', letterSpacing:'.3px' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {formations.map(f => (
                        <tr key={f.id} style={{ borderBottom:'1px solid #f0f0f0' }}>
                          <td style={{ padding:'10px 10px' }}>{f.titre}</td>
                          <td style={{ padding:'10px 10px', color:'#9aa3b8' }}>{f.organisme}</td>
                          <td style={{ padding:'10px 10px', color:'#9aa3b8' }}>{f.date_debut ? fmtDate(f.date_debut) : '—'}</td>
                          <td style={{ padding:'10px 10px', textAlign:'center' }}>{f.duree_heures ? `${f.duree_heures}h` : '—'}</td>
                          <td style={{ padding:'10px 10px' }}>
                            <span style={{ padding:'2px 8px', borderRadius:10, fontSize:11, fontWeight:600,
                              background: f.statut === 'validee' ? '#e6f5eb' : f.statut === 'planifiee' ? '#fef3e2' : '#e8eef8',
                              color: f.statut === 'validee' ? '#2e8b4a' : f.statut === 'planifiee' ? '#d97706' : '#1a4b8f' }}>
                              {f.statut === 'validee' ? '✅ Validée' : f.statut === 'planifiee' ? '⏳ Planifiée' : f.statut}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </SectionCard>
            </>
          )}

          {/* ══ MD & CONTRAT ══ */}
          {onglet === 'md' && (
            <>
              <SectionCard icon="🏛️" title="Maison du Département">
                <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:12 }}>
                  {collegues.filter(c => ['referent','encadrant','rtase','admin'].includes(c.role)).map(c => (
                    <div key={c.id} style={{ background:'#f4f6fb', borderRadius:10, padding:14, border:'1px solid #dde3f0' }}>
                      <div style={{ fontSize:11, fontWeight:600, color:'#5a6478', textTransform:'uppercase', marginBottom:8 }}>
                        {c.role === 'referent' ? '👩‍💼 Référent(e)' : c.role === 'encadrant' ? '👨‍💼 Encadrant technique' : c.role === 'rtase' ? '🎖️ RTASE' : '👤 Admin'}
                      </div>
                      <div style={{ fontSize:13, fontWeight:600 }}>{c.prenom} {c.nom}</div>
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard icon="📃" title="Contrat de travail">
                <FG>
                  <Field label="Type de contrat" value="CDI — Assistant Familial" readOnly />
                  <Field label="Employeur" value="Conseil Départemental du Tarn (81)" readOnly />
                  <Field label="Convention collective" value="CC Assistants familiaux" readOnly />
                </FG>
                <div style={{ marginTop:14 }}>
                  <label style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 12px', border:'1px dashed #c4d4f5', borderRadius:8, background:'#f0f9ff', color:'#1a4b8f', fontSize:12, cursor:'pointer', fontFamily:'Sora,sans-serif' }}>
                    {uploadingDoc === 'contrat' ? '⏳...' : '📎 Uploader contrat de travail'}
                    <input type="file" accept="image/*,application/pdf" style={{ display:'none' }} onChange={e => { if (e.target.files[0]) uploadDoc(e.target.files[0], 'contrat') }} />
                  </label>
                  {documents.filter(d => d.type_doc === 'contrat').map(d => (
                    <div key={d.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', background:'#f4f6fb', borderRadius:7, border:'1px solid #dde3f0', marginTop:6 }}>
                      <span>📃</span><span style={{ flex:1, fontSize:12 }}>{d.nom}</span>
                      <button onClick={async () => { const { data: u } = await supabase.storage.from('documents-enfants').createSignedUrl(d.storage_path, 3600); if (u?.signedUrl) window.open(u.signedUrl, '_blank') }} style={{ padding:'3px 7px', borderRadius:5, border:'1px solid #dde3f0', background:'#fff', fontSize:11, cursor:'pointer' }}>👁</button>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </>
          )}
        </div>
      </div>

      {/* Modal congé */}
      {showCongeModal && (
        <div className="modal-overlay" onClick={() => setShowCongeModal(false)}>
          <div className="modal-box" style={{ maxWidth:480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">🏖️ Demande de congés</div>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Date de début</label>
                <input type="date" className="form-control" value={newConge.date_debut} onChange={e => setNewConge(n => ({...n, date_debut: e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Date de fin</label>
                <input type="date" className="form-control" value={newConge.date_fin} onChange={e => setNewConge(n => ({...n, date_fin: e.target.value}))} />
              </div>
              {newConge.date_debut && newConge.date_fin && (
                <div className="form-group col-span-2">
                  <div style={{ padding:'8px 12px', background:'#e8eef8', borderRadius:8, fontSize:13, color:'#1a4b8f', fontWeight:600 }}>
                    📅 {Math.ceil((new Date(newConge.date_fin) - new Date(newConge.date_debut)) / (1000*60*60*24)) + 1} jours
                  </div>
                </div>
              )}
              {enfantsAccueillis.map(e => (
                <div key={e.id} className="form-group col-span-2">
                  <label className="form-label">AF relais pour {e.prenom} {e.nom}</label>
                  <input className="form-control" placeholder="Nom de l'AF relais..." />
                </div>
              ))}
              <div className="form-group col-span-2">
                <label className="form-label">Notes pour l'encadrant</label>
                <textarea className="form-control" rows={3} value={newConge.notes} onChange={e => setNewConge(n => ({...n, notes: e.target.value}))} placeholder="Informations complémentaires..." />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowCongeModal(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={saveConge}>📤 Envoyer la demande</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal formation */}
      {showFormationModal && (
        <div className="modal-overlay" onClick={() => setShowFormationModal(false)}>
          <div className="modal-box" style={{ maxWidth:480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">🎓 Ajouter une formation</div>
            <div className="form-grid-2">
              <div className="form-group col-span-2">
                <label className="form-label">Titre *</label>
                <input className="form-control" value={newFormation.titre} onChange={e => setNewFormation(n => ({...n, titre: e.target.value}))} placeholder="Ex: Gestion des crises..." />
              </div>
              <div className="form-group">
                <label className="form-label">Organisme</label>
                <input className="form-control" value={newFormation.organisme} onChange={e => setNewFormation(n => ({...n, organisme: e.target.value}))} placeholder="IRTS, CNFPT..." />
              </div>
              <div className="form-group">
                <label className="form-label">Durée (heures)</label>
                <input type="number" className="form-control" value={newFormation.duree_heures} onChange={e => setNewFormation(n => ({...n, duree_heures: e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Date de début</label>
                <input type="date" className="form-control" value={newFormation.date_debut} onChange={e => setNewFormation(n => ({...n, date_debut: e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Statut</label>
                <select className="form-control" value={newFormation.statut} onChange={e => setNewFormation(n => ({...n, statut: e.target.value}))}>
                  <option value="planifiee">⏳ Planifiée</option>
                  <option value="en_cours">🔄 En cours</option>
                  <option value="validee">✅ Validée</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowFormationModal(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={saveFormation}>✅ Ajouter</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal foyer enfant */}
      {showFoyerModal && (
        <div className="modal-overlay" onClick={() => setShowFoyerModal(false)}>
          <div className="modal-box" style={{ maxWidth:400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">👧👦 Ajouter un enfant du foyer</div>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Prénom *</label>
                <input className="form-control" value={newFoyerEnfant.prenom} onChange={e => setNewFoyerEnfant(n => ({...n, prenom: e.target.value}))} autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Nom</label>
                <input className="form-control" value={newFoyerEnfant.nom} onChange={e => setNewFoyerEnfant(n => ({...n, nom: e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Date de naissance</label>
                <input type="date" className="form-control" value={newFoyerEnfant.date_naissance} onChange={e => setNewFoyerEnfant(n => ({...n, date_naissance: e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Sexe</label>
                <select className="form-control" value={newFoyerEnfant.sexe} onChange={e => setNewFoyerEnfant(n => ({...n, sexe: e.target.value}))}>
                  <option value="M">👦 Masculin</option>
                  <option value="F">👧 Féminin</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowFoyerModal(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={saveFoyerEnfant}>✅ Ajouter</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
