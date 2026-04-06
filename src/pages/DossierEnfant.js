import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Sidebar from '../components/Sidebar'

const TABS = [
  { id: 'identite', label: '🪪 Identité' },
  { id: 'famille', label: '👨‍👩‍👧 Famille' },
  { id: 'placement', label: '🏠 Placement' },
  { id: 'judiciaire', label: '⚖️ Judiciaire' },
  { id: 'quotidien', label: '🌱 Vie quotidienne' },
  { id: 'journal', label: '📝 Journal' },
]

const humeurEmojis = { bien: '😊', neutre: '😐', difficile: '😢', incident: '⚠️' }

const statutLabels = {
  en_accueil: '🏠 En accueil', en_relais: '🔄 En relais',
  en_famille: '👨‍👩‍👧 En famille', en_parrainage: '🤝 En parrainage',
  colonie_vacances: '🏕️ Colonie vacances', colonie_neige: '⛷️ Colonie neige',
  centre_departemental: '🏛️ Centre départemental', hospitalisation: '🏥 Hospitalisation',
  internat: '🏫 Internat', sejour_linguistique: '🌍 Séjour linguistique',
  urgence_provisoire: '🚨 Urgence provisoire',
}

export default function DossierEnfant({ profile }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [enfant, setEnfant] = useState(null)
  const [journal, setJournal] = useState([])
  const [activeTab, setActiveTab] = useState('identite')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [editData, setEditData] = useState({})
  const [newNote, setNewNote] = useState({ humeur: 'bien', observation: '', tags: '' })
  const [showNoteForm, setShowNoteForm] = useState(false)

  useEffect(() => { fetchEnfant(); fetchJournal() }, [id])

  async function fetchEnfant() {
    const { data } = await supabase
      .from('enfants')
      .select(`*, af_principal:profiles!enfants_af_principal_id_fkey(id,nom,prenom,matricule,telephone,email), referent:profiles!enfants_referent_id_fkey(id,nom,prenom,telephone,email)`)
      .eq('id', id).single()
    if (data) { setEnfant(data); setEditData(data) }
    setLoading(false)
  }

  async function fetchJournal() {
    const { data } = await supabase.from('journal')
      .select('*, auteur:profiles(nom,prenom)')
      .eq('enfant_id', id)
      .order('date_observation', { ascending: false })
      .limit(50)
    if (data) setJournal(data)
  }

  async function saveEnfant() {
    setSaving(true)
    const { error } = await supabase.from('enfants').update({
      nom: editData.nom, prenom: editData.prenom,
      date_naissance: editData.date_naissance,
      lieu_naissance: editData.lieu_naissance,
      numero_dossier: editData.numero_dossier,
      sexe: editData.sexe, nationalite: editData.nationalite,
      numero_secu: editData.numero_secu,
      type_placement: editData.type_placement,
      date_placement: editData.date_placement,
      date_fin_placement: editData.date_fin_placement,
      statut: editData.statut, territoire: editData.territoire,
      placement_secret: editData.placement_secret,
      updated_at: new Date().toISOString()
    }).eq('id', id)
    if (!error) { showToast('✅ Dossier sauvegardé !'); setEditMode(false); fetchEnfant() }
    else showToast('❌ Erreur lors de la sauvegarde')
    setSaving(false)
  }

  async function addNote() {
    if (!newNote.observation.trim()) return
    const { error } = await supabase.from('journal').insert({
      enfant_id: id, auteur_id: profile.id,
      humeur: newNote.humeur, observation: newNote.observation,
      tags: newNote.tags ? newNote.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    })
    if (!error) { showToast('✅ Note enregistrée !'); setNewNote({ humeur: 'bien', observation: '', tags: '' }); setShowNoteForm(false); fetchJournal() }
  }

  async function deleteNote(noteId) {
    if (!window.confirm('Supprimer cette note ?')) return
    await supabase.from('journal').delete().eq('id', noteId)
    showToast('🗑 Note supprimée'); fetchJournal()
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 2800) }

  const age = enfant?.date_naissance
    ? Math.floor((new Date() - new Date(enfant.date_naissance)) / (1000*60*60*24*365.25))
    : '?'

  function Field({ label, field, type = 'text', options = null, readOnly = false }) {
    const val = editMode && !readOnly ? editData[field] : enfant?.[field]
    if (editMode && !readOnly) {
      if (options) return (
        <div className="form-group">
          <label className="form-label">{label}</label>
          <select className="form-control" value={val || ''} onChange={e => setEditData(d => ({ ...d, [field]: e.target.value }))}>
            <option value="">— Sélectionner —</option>
            {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        </div>
      )
      return (
        <div className="form-group">
          <label className="form-label">{label}</label>
          <input className="form-control" type={type} value={val || ''}
            onChange={e => setEditData(d => ({ ...d, [field]: e.target.value }))} />
        </div>
      )
    }
    return (
      <div className="form-group">
        <label className="form-label">{label}</label>
        <div className="form-value">{val || '—'}</div>
      </div>
    )
  }

  if (loading) return (
    <div className="app-layout"><Sidebar profile={profile} />
      <div className="main-content"><div className="loading-spinner">⏳ Chargement...</div></div>
    </div>
  )

  if (!enfant) return (
    <div className="app-layout"><Sidebar profile={profile} />
      <div className="main-content">
        <div style={{ padding: 32, textAlign: 'center', color: '#9aa3b8' }}>
          Enfant non trouvé. <button className="btn btn-secondary" onClick={() => navigate('/')}>Retour</button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="app-layout">
      <Sidebar profile={profile} />
      <div className="main-content">

        <header className="page-header">
          <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#5a6478' }}>‹</button>
          <div style={{ width:32, height:32, borderRadius:'50%', background:'linear-gradient(135deg,#1a4b8f,#2e8b4a)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'#fff', flexShrink:0 }}>
            {enfant.prenom[0]}{enfant.nom[0]}
          </div>
          <div>
            <div className="page-title">{enfant.prenom} {enfant.nom}</div>
            <div className="page-subtitle">
              {age} ans · {enfant.date_naissance ? new Date(enfant.date_naissance).toLocaleDateString('fr-FR') : ''}
              {enfant.numero_dossier && ` · N° ${enfant.numero_dossier}`}
            </div>
          </div>
          <div className="header-actions">
            {editMode ? (
              <>
                <button className="btn btn-secondary" onClick={() => { setEditMode(false); setEditData(enfant) }}>✕ Annuler</button>
                <button className="btn btn-success" onClick={saveEnfant} disabled={saving}>{saving ? '⏳...' : '💾 Sauvegarder'}</button>
              </>
            ) : (
              <>
                <button className="btn btn-secondary" onClick={() => setEditMode(true)}>✏️ Modifier</button>
                <button className="btn btn-success" onClick={() => showToast('📄 Rapport généré !')}>📄 Rapport</button>
              </>
            )}
          </div>
        </header>

        <div style={{ padding: '12px 16px 0' }}>
          <div className="tabs-container">
            {TABS.map(tab => (
              <button key={tab.id} className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="page-content">

          {/* ══ IDENTITE ══ */}
          {activeTab === 'identite' && (
            <>
              <div className="card">
                <div className="card-header" style={{ cursor:'default' }}><h3>👤 État civil</h3></div>
                <div className="card-body">
                  <div className="form-grid-3">
                    <div className="form-group"><label className="form-label">N° Dossier ASE</label><div className="form-value" style={{ color:'#1a4b8f', fontWeight:600 }}>{enfant.numero_dossier || '—'}</div></div>
                    <Field label="Nom de famille" field="nom" />
                    <Field label="Prénom" field="prenom" />
                    <Field label="Date de naissance" field="date_naissance" type="date" />
                    <Field label="Lieu de naissance" field="lieu_naissance" />
                    <Field label="Nationalité" field="nationalite" />
                    <Field label="Sexe" field="sexe" options={[{v:'F',l:'Féminin'},{v:'M',l:'Masculin'}]} />
                    <Field label="N° Sécurité Sociale" field="numero_secu" />
                  </div>
                </div>
              </div>
              <div className="card">
                <div className="card-header" style={{ cursor:'default' }}>
                  <h3>📄 Documents</h3>
                  <button className="btn btn-secondary" onClick={() => showToast('📎 Ajouter document...')}>+ Ajouter</button>
                </div>
                <div className="card-body">
                  {[
                    { icon:'📋', label:"PPE — Projet Pour l'Enfant", color:'#e8eef8', meta:'Mme Gondy · 20/01/2026' },
                    { icon:'⚖️', label:'Jugement placement TJ81', color:'#fde8e8', meta:'Confidentiel · 20/01/2026' },
                    { icon:'📗', label:'Carnet de santé', color:'#e6f5eb', meta:'16/01/2026' },
                    { icon:'💊', label:'Ordonnance Mélatonine', color:'#e6f5eb', meta:'Dr. Carayon · Mars 2026' },
                    { icon:'📚', label:'Bulletin scolaire T2', color:'#e8eef8', meta:'CM1 · Fév. 2026' },
                  ].map((doc, i) => (
                    <div key={i} className="doc-item">
                      <div className="doc-icon" style={{ background:doc.color }}>{doc.icon}</div>
                      <div style={{ flex:1 }}><div className="doc-name">{doc.label}</div><div className="doc-meta">{doc.meta}</div></div>
                      <div className="doc-actions">
                        <button className="doc-btn" onClick={() => showToast('👁 Ouverture...')}>👁</button>
                        <button className="doc-btn" onClick={() => showToast('⬇ Téléchargement...')}>⬇</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ══ FAMILLE ══ */}
          {activeTab === 'famille' && (
            <>
              <div className="card">
                <div className="card-header" style={{ cursor:'default' }}><h3>👨 Père</h3></div>
                <div className="card-body">
                  <div className="form-grid-3">
                    <Field label="Nom" field="pere_nom" />
                    <Field label="Prénom" field="pere_prenom" />
                    <Field label="Téléphone" field="pere_telephone" type="tel" />
                    <div className="col-span-2"><Field label="Adresse" field="pere_adresse" /></div>
                    <Field label="Droits parentaux" field="pere_droits" options={[
                      {v:'complet',l:'Autorité parentale complète'},
                      {v:'partiel',l:'Autorité parentale partielle'},
                      {v:'decheance_partielle',l:'Déchéance partielle'},
                      {v:'decheance_totale',l:'Déchéance totale'},
                    ]} />
                    <Field label="Droit de visite" field="pere_visite" options={[
                      {v:'vm',l:'Visite médiatisée (VM)'},
                      {v:'libre',l:'Visite libre'},
                      {v:'aucun',l:'Aucun droit'},
                      {v:'suspendu',l:'Suspendu'},
                    ]} />
                  </div>
                </div>
              </div>
              <div className="card">
                <div className="card-header" style={{ cursor:'default' }}><h3>👩 Mère</h3></div>
                <div className="card-body">
                  <div className="form-grid-3">
                    <Field label="Nom" field="mere_nom" />
                    <Field label="Prénom" field="mere_prenom" />
                    <Field label="Téléphone" field="mere_telephone" type="tel" />
                    <div className="col-span-2"><Field label="Adresse" field="mere_adresse" /></div>
                    <Field label="Droits parentaux" field="mere_droits" options={[
                      {v:'complet',l:'Autorité parentale complète'},
                      {v:'partiel',l:'Autorité parentale partielle'},
                      {v:'decheance_partielle',l:'Déchéance partielle'},
                      {v:'decheance_totale',l:'Déchéance totale'},
                    ]} />
                    <Field label="Droit de visite" field="mere_visite" options={[
                      {v:'vm',l:'Visite médiatisée (VM)'},
                      {v:'libre',l:'Visite libre'},
                      {v:'aucun',l:'Aucun droit'},
                      {v:'suspendu',l:'Suspendu'},
                    ]} />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ══ PLACEMENT ══ */}
          {activeTab === 'placement' && (
            <>
              <div className="card">
                <div className="card-header" style={{ cursor:'default' }}><h3>🏠 Informations de placement</h3></div>
                <div className="card-body">
                  <div className="form-grid-3">
                    <Field label="Type de placement" field="type_placement" options={[
                      {v:'judiciaire',l:'⚖️ Judiciaire'},
                      {v:'administratif',l:'📋 Administratif'},
                      {v:'urgence',l:'🚨 Urgence'},
                      {v:'secret',l:'🔒 Secret'},
                    ]} />
                    <Field label="Date de placement" field="date_placement" type="date" />
                    <Field label="Date de fin prévue" field="date_fin_placement" type="date" />
                    <Field label="Statut actuel" field="statut" options={Object.entries(statutLabels).map(([v,l]) => ({v,l}))} />
                    <Field label="Territoire" field="territoire" />
                    <Field label="Placement secret" field="placement_secret" options={[{v:false,l:'Non'},{v:true,l:'🔒 Oui'}]} />
                  </div>
                </div>
              </div>
              <div className="card">
                <div className="card-header" style={{ cursor:'default' }}><h3>👥 Contacts ASE</h3></div>
                <div className="card-body">
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                    {enfant.af_principal && (
                      <ContactCard role="AF Principal(e)" nom={`${enfant.af_principal.prenom} ${enfant.af_principal.nom}`}
                        meta={`N° ${enfant.af_principal.matricule || '—'}`} tel={enfant.af_principal.telephone}
                        email={enfant.af_principal.email} color="#e8eef8" onCall={() => showToast(`📞 Appel ${enfant.af_principal.prenom}...`)} />
                    )}
                    {enfant.referent && (
                      <ContactCard role="Référent(e) enfant" nom={`${enfant.referent.prenom} ${enfant.referent.nom}`}
                        meta="MD Gaillac-Graulhet" tel={enfant.referent.telephone || '05 63 34 01 10'}
                        email={enfant.referent.email} color="#e8eef8" onCall={() => showToast(`📞 Appel Mme ${enfant.referent.nom}...`)} />
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ══ JUDICIAIRE ══ */}
          {activeTab === 'judiciaire' && (
            <div className="card">
              <div className="card-header" style={{ cursor:'default' }}>
                <h3>⚖️ Informations judiciaires</h3>
                <span style={{ fontSize:11, background:'#fdf0ee', color:'#c0392b', padding:'2px 8px', borderRadius:10, fontWeight:600 }}>🔒 Accès restreint</span>
              </div>
              <div className="card-body">
                <div className="form-grid-3">
                  <Field label="Tribunal" field="tribunal" />
                  <Field label="Juge des enfants" field="juge" />
                  <Field label="Prochaine audience" field="prochaine_audience" type="date" />
                  <Field label="N° dossier TJ" field="numero_tj" />
                  <Field label="Avocat enfant" field="avocat" />
                  <Field label="Représentant légal" field="representant_legal" />
                </div>
              </div>
            </div>
          )}

          {/* ══ VIE QUOTIDIENNE ══ */}
          {activeTab === 'quotidien' && (
            <>
              <div className="card">
                <div className="card-header" style={{ cursor:'default' }}><h3>🏥 Santé</h3></div>
                <div className="card-body">
                  <div className="form-grid-3">
                    <Field label="Médecin traitant" field="medecin" />
                    <Field label="Pédiatre" field="pediatre" />
                    <Field label="Groupe sanguin" field="groupe_sanguin" />
                    <Field label="Psychologue / Psy" field="psy" />
                    <div className="col-span-2"><Field label="Allergies" field="allergies" /></div>
                    <div className="col-span-3"><Field label="Traitements en cours" field="traitements" /></div>
                    <div className="col-span-3"><Field label="Pathologies / Notes médicales" field="notes_medicales" /></div>
                  </div>
                </div>
              </div>
              <div className="card">
                <div className="card-header" style={{ cursor:'default' }}><h3>🏫 Scolarité</h3></div>
                <div className="card-body">
                  <div className="form-grid-3">
                    <div className="col-span-2"><Field label="École" field="ecole" /></div>
                    <Field label="Classe" field="classe" />
                    <Field label="Enseignant(e)" field="enseignant" />
                    <Field label="Téléphone école" field="tel_ecole" type="tel" />
                  </div>
                </div>
              </div>
              <div className="card">
                <div className="card-header" style={{ cursor:'default' }}><h3>👕 Vêture & Quotidien</h3></div>
                <div className="card-body">
                  <div className="form-grid-3">
                    <Field label="Taille vêtements" field="taille_vetements" />
                    <Field label="Pointure" field="pointure" />
                    <Field label="Allocation vêture/mois" field="allocation_veture" />
                    <div className="col-span-3"><Field label="Préconisations particulières (visibles AF relais)" field="preconisations" /></div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ══ JOURNAL ══ */}
          {activeTab === 'journal' && (
            <>
              <div style={{ display:'flex', gap:8, marginBottom:12 }}>
                <button className="btn btn-primary" onClick={() => setShowNoteForm(!showNoteForm)}>
                  {showNoteForm ? '✕ Annuler' : '+ Nouvelle note'}
                </button>
                <button className="btn btn-success" onClick={() => showToast('📄 Rapport généré !')}>📄 Rapport ASE</button>
              </div>

              {showNoteForm && (
                <div className="card" style={{ border:'2px solid #1a4b8f' }}>
                  <div className="card-body">
                    <div style={{ marginBottom:10 }}>
                      <label className="form-label" style={{ display:'block', marginBottom:6 }}>Humeur</label>
                      <div style={{ display:'flex', gap:8 }}>
                        {['bien','neutre','difficile','incident'].map(h => (
                          <button key={h} onClick={() => setNewNote(n => ({ ...n, humeur:h }))}
                            style={{ width:42, height:42, borderRadius:'50%', fontSize:20, border:`2px solid ${newNote.humeur===h?'#1a4b8f':'#dde3f0'}`, background:newNote.humeur===h?'#e8eef8':'none', cursor:'pointer' }}>
                            {humeurEmojis[h]}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Observation</label>
                      <textarea className="form-control" rows={4} value={newNote.observation}
                        onChange={e => setNewNote(n => ({ ...n, observation:e.target.value }))}
                        placeholder="Décrivez la journée, le comportement, les événements..."
                        style={{ resize:'vertical', lineHeight:1.6, minHeight:90 }} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Tags (séparés par virgules)</label>
                      <input className="form-control" value={newNote.tags}
                        onChange={e => setNewNote(n => ({ ...n, tags:e.target.value }))}
                        placeholder="anxiété, école, VM, bonne humeur..." />
                    </div>
                    <button className="btn btn-primary" style={{ width:'100%', padding:12, justifyContent:'center' }} onClick={addNote}>
                      📝 Enregistrer la note
                    </button>
                  </div>
                </div>
              )}

              {journal.length === 0 ? (
                <div style={{ textAlign:'center', color:'#9aa3b8', padding:30, fontSize:13 }}>Aucune note dans le journal</div>
              ) : (
                journal.map(note => (
                  <div key={note.id} style={{ background:'#fff', border:'1px solid #dde3f0', borderLeft:'4px solid #1a4b8f', borderRadius:10, padding:'12px 14px', marginBottom:9, boxShadow:'0 1px 5px rgba(0,0,0,.05)' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:7, flexWrap:'wrap' }}>
                      <span style={{ fontSize:10, color:'#9aa3b8' }}>
                        {new Date(note.date_observation).toLocaleDateString('fr-FR', { weekday:'short', day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                      </span>
                      <span style={{ background:'#e8eef8', color:'#1a4b8f', fontSize:10, fontWeight:600, padding:'1px 7px', borderRadius:10 }}>
                        {note.auteur ? `${note.auteur.prenom} ${note.auteur.nom}` : 'AF'}
                      </span>
                      <span style={{ fontSize:16, marginLeft:'auto' }}>{humeurEmojis[note.humeur] || '😐'}</span>
                      <button onClick={() => deleteNote(note.id)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:14, color:'#c0392b', opacity:.6 }}>🗑</button>
                    </div>
                    <div style={{ fontSize:12, lineHeight:1.6 }}>{note.observation}</div>
                    {note.tags && note.tags.length > 0 && (
                      <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginTop:7 }}>
                        {note.tags.map((tag,i) => (
                          <span key={i} style={{ padding:'2px 6px', background:'#eef1f8', borderRadius:3, fontSize:10, color:'#5a6478' }}>{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </>
          )}

        </div>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

function ContactCard({ role, nom, meta, tel, email, color, onCall }) {
  return (
    <div style={{ background:color, border:'1px solid #dde3f0', borderRadius:9, padding:12 }}>
      <div style={{ fontSize:10, fontWeight:600, color:'#5a6478', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:5 }}>{role}</div>
      <div style={{ fontSize:13, fontWeight:600, marginBottom:3 }}>{nom}</div>
      <div style={{ fontSize:10, color:'#9aa3b8', marginBottom:5 }}>{meta}</div>
      {tel && <div style={{ fontSize:11, color:'#1a4b8f', fontWeight:500, marginBottom:3 }}>📞 {tel}</div>}
      {email && <div style={{ fontSize:10, color:'#9aa3b8', marginBottom:7 }}>✉️ {email}</div>}
      <button onClick={onCall} style={{ padding:'5px 10px', borderRadius:6, border:'1px solid #1a4b8f', background:'#e8eef8', color:'#1a4b8f', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'Sora,sans-serif' }}>
        📞 Appeler
      </button>
    </div>
  )
}
