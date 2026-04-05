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

export default function DossierEnfant({ profile }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [enfant, setEnfant] = useState(null)
  const [journal, setJournal] = useState([])
  const [activeTab, setActiveTab] = useState('identite')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [newNote, setNewNote] = useState({ humeur: 'bien', observation: '', tags: '' })
  const [showNoteForm, setShowNoteForm] = useState(false)

  useEffect(() => {
    fetchEnfant()
    fetchJournal()
  }, [id])

  async function fetchEnfant() {
    const { data, error } = await supabase
      .from('enfants')
      .select(`
        *,
        af_principal:profiles!enfants_af_principal_id_fkey(id, nom, prenom, matricule, telephone),
        referent:profiles!enfants_referent_id_fkey(id, nom, prenom, telephone)
      `)
      .eq('id', id)
      .single()
    if (!error) setEnfant(data)
    setLoading(false)
  }

  async function fetchJournal() {
    const { data } = await supabase
      .from('journal')
      .select('*, auteur:profiles(nom, prenom)')
      .eq('enfant_id', id)
      .order('date_observation', { ascending: false })
      .limit(20)
    if (data) setJournal(data)
  }

  async function addNote() {
    if (!newNote.observation.trim()) return
    const { error } = await supabase.from('journal').insert({
      enfant_id: id,
      auteur_id: profile.id,
      humeur: newNote.humeur,
      observation: newNote.observation,
      tags: newNote.tags ? newNote.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    })
    if (!error) {
      showToast('✅ Note enregistrée !')
      setNewNote({ humeur: 'bien', observation: '', tags: '' })
      setShowNoteForm(false)
      fetchJournal()
    }
  }

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 2800)
  }

  if (loading) return (
    <div className="app-layout">
      <Sidebar profile={profile} />
      <div className="main-content">
        <div className="loading-spinner">⏳ Chargement du dossier...</div>
      </div>
    </div>
  )

  if (!enfant) return (
    <div className="app-layout">
      <Sidebar profile={profile} />
      <div className="main-content">
        <div style={{ padding: 32, textAlign: 'center', color: '#9aa3b8' }}>
          Enfant non trouvé. <button className="btn btn-secondary" onClick={() => navigate('/')}>Retour</button>
        </div>
      </div>
    </div>
  )

  const age = enfant.date_naissance
    ? Math.floor((new Date() - new Date(enfant.date_naissance)) / (1000*60*60*24*365.25))
    : '?'

  const humeurEmojis = { bien: '😊', neutre: '😐', difficile: '😢', incident: '⚠️' }

  return (
    <div className="app-layout">
      <Sidebar profile={profile} />
      <div className="main-content">

        {/* Header */}
        <header className="page-header">
          <button
            onClick={() => navigate('/')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#5a6478' }}
          >‹</button>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'linear-gradient(135deg,#1a4b8f,#2e8b4a)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0
          }}>
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
            <button className="btn btn-secondary" onClick={() => showToast('✏️ Mode modification')}>✏️ Modifier</button>
            <button className="btn btn-success" onClick={() => showToast('📄 Rapport généré !')}>📄 Rapport</button>
          </div>
        </header>

        {/* Tabs */}
        <div style={{ padding: '12px 16px 0' }}>
          <div className="tabs-container">
            {TABS.map(tab => (
              <button
                key={tab.id}
                className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Contenu */}
        <div className="page-content">

          {/* ── IDENTITE ── */}
          {activeTab === 'identite' && (
            <div>
              <div className="card">
                <div className="card-header" style={{ cursor: 'default' }}>
                  <h3>👤 État civil</h3>
                </div>
                <div className="card-body">
                  <div className="form-grid-3">
                    <div className="form-group">
                      <label className="form-label">N° Dossier ASE</label>
                      <div className="form-value" style={{ color: '#1a4b8f', fontWeight: 600 }}>
                        {enfant.numero_dossier || '—'}
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Nom de famille</label>
                      <div className="form-value">{enfant.nom}</div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Prénom</label>
                      <div className="form-value">{enfant.prenom}</div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Date de naissance</label>
                      <div className="form-value">
                        {enfant.date_naissance ? new Date(enfant.date_naissance).toLocaleDateString('fr-FR') : '—'}
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Lieu de naissance</label>
                      <div className="form-value">{enfant.lieu_naissance || '—'}</div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Nationalité</label>
                      <div className="form-value">{enfant.nationalite || 'Française'}</div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Sexe</label>
                      <div className="form-value">{enfant.sexe === 'F' ? 'Féminin' : enfant.sexe === 'M' ? 'Masculin' : '—'}</div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">N° Sécurité Sociale</label>
                      <div className="form-value">{enfant.numero_secu || '—'}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header" style={{ cursor: 'default' }}>
                  <h3>📄 Documents</h3>
                  <button className="btn btn-secondary" onClick={() => showToast('📎 Ajouter document...')}>+ Ajouter</button>
                </div>
                <div className="card-body">
                  {[
                    { icon: '📋', label: 'PPE — Projet Pour l\'Enfant', color: '#e8eef8', meta: 'Mme Gondy · 20/01/2026' },
                    { icon: '⚖️', label: 'Jugement placement TJ81', color: '#fde8e8', meta: 'Confidentiel · 20/01/2026' },
                    { icon: '📗', label: 'Carnet de santé', color: '#e6f5eb', meta: '2.9 Mo · 16/01/2026' },
                    { icon: '💊', label: 'Ordonnance Mélatonine', color: '#e6f5eb', meta: 'Dr. Carayon · Mars 2026' },
                    { icon: '📚', label: 'Bulletin scolaire T2', color: '#e8eef8', meta: 'CM1 · Fév. 2026' },
                  ].map((doc, i) => (
                    <div key={i} className="doc-item">
                      <div className="doc-icon" style={{ background: doc.color }}>{doc.icon}</div>
                      <div style={{ flex: 1 }}>
                        <div className="doc-name">{doc.label}</div>
                        <div className="doc-meta">{doc.meta}</div>
                      </div>
                      <div className="doc-actions">
                        <button className="doc-btn" onClick={() => showToast('👁 Ouverture...')}>👁</button>
                        <button className="doc-btn" onClick={() => showToast('⬇ Téléchargement...')}>⬇</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── PLACEMENT ── */}
          {activeTab === 'placement' && (
            <div>
              <div className="card">
                <div className="card-header" style={{ cursor: 'default' }}>
                  <h3>🏠 Placement</h3>
                </div>
                <div className="card-body">
                  <div className="form-grid-3">
                    <div className="form-group">
                      <label className="form-label">Type de placement</label>
                      <div className="form-value">
                        {enfant.type_placement === 'judiciaire' ? '⚖️ Judiciaire' :
                         enfant.type_placement === 'administratif' ? '📋 Administratif' :
                         enfant.type_placement === 'urgence' ? '🚨 Urgence' : enfant.type_placement || '—'}
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Date de placement</label>
                      <div className="form-value">
                        {enfant.date_placement ? new Date(enfant.date_placement).toLocaleDateString('fr-FR') : '—'}
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Date de fin prévue</label>
                      <div className="form-value">
                        {enfant.date_fin_placement ? new Date(enfant.date_fin_placement).toLocaleDateString('fr-FR') : '—'}
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Statut actuel</label>
                      <div className="form-value">
                        {enfant.statut === 'en_accueil' ? '🏠 En accueil' :
                         enfant.statut === 'en_relais' ? '🔄 En relais' : enfant.statut || '—'}
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Territoire</label>
                      <div className="form-value">{enfant.territoire || '—'}</div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Placement secret</label>
                      <div className="form-value">
                        {enfant.placement_secret ? '🔒 Oui' : 'Non'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Contacts ASE */}
              <div className="card">
                <div className="card-header" style={{ cursor: 'default' }}>
                  <h3>🏛️ Contacts ASE</h3>
                </div>
                <div className="card-body">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {enfant.af_principal && (
                      <ContactCard
                        role="AF Principal(e)"
                        nom={`${enfant.af_principal.prenom} ${enfant.af_principal.nom}`}
                        meta={`N° ${enfant.af_principal.matricule || '—'}`}
                        tel={enfant.af_principal.telephone}
                        color="#e8eef8"
                        onCall={() => showToast(`📞 Appel ${enfant.af_principal.prenom}...`)}
                      />
                    )}
                    {enfant.referent && (
                      <ContactCard
                        role="Référent(e) enfant"
                        nom={`${enfant.referent.prenom} ${enfant.referent.nom}`}
                        meta="MD Gaillac-Graulhet"
                        tel={enfant.referent.telephone || '05 63 34 01 10'}
                        color="#e8eef8"
                        onCall={() => showToast(`📞 Appel Mme ${enfant.referent.nom}...`)}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── JOURNAL ── */}
          {activeTab === 'journal' && (
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <button
                  className="btn btn-primary"
                  onClick={() => setShowNoteForm(!showNoteForm)}
                >
                  {showNoteForm ? '✕ Annuler' : '+ Nouvelle note'}
                </button>
                <button className="btn btn-success" onClick={() => showToast('📄 Rapport ASE généré !')}>
                  📄 Rapport ASE
                </button>
              </div>

              {/* Formulaire nouvelle note */}
              {showNoteForm && (
                <div className="card" style={{ border: '2px solid #1a4b8f' }}>
                  <div className="card-body">
                    <div style={{ marginBottom: 10 }}>
                      <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>Humeur</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {['bien', 'neutre', 'difficile', 'incident'].map(h => (
                          <button
                            key={h}
                            onClick={() => setNewNote(n => ({ ...n, humeur: h }))}
                            style={{
                              width: 42, height: 42, borderRadius: '50%', fontSize: 20,
                              border: `2px solid ${newNote.humeur === h ? '#1a4b8f' : '#dde3f0'}`,
                              background: newNote.humeur === h ? '#e8eef8' : 'none',
                              cursor: 'pointer', transition: 'all .15s'
                            }}
                          >
                            {humeurEmojis[h]}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Observation</label>
                      <textarea
                        className="form-control"
                        rows={4}
                        value={newNote.observation}
                        onChange={e => setNewNote(n => ({ ...n, observation: e.target.value }))}
                        placeholder="Décrivez la journée, le comportement, les événements..."
                        style={{ resize: 'vertical', lineHeight: 1.6, minHeight: 90 }}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Tags (séparés par des virgules)</label>
                      <input
                        className="form-control"
                        value={newNote.tags}
                        onChange={e => setNewNote(n => ({ ...n, tags: e.target.value }))}
                        placeholder="anxiété, école, VM, bonne humeur..."
                      />
                    </div>
                    <button className="btn btn-primary" style={{ width: '100%', padding: 12, justifyContent: 'center' }} onClick={addNote}>
                      📝 Enregistrer la note
                    </button>
                  </div>
                </div>
              )}

              {/* Liste des notes */}
              {journal.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#9aa3b8', padding: 30, fontSize: 13 }}>
                  Aucune note dans le journal
                </div>
              ) : (
                journal.map(note => (
                  <div key={note.id} style={{
                    background: '#fff', border: '1px solid #dde3f0',
                    borderLeft: '4px solid #1a4b8f',
                    borderRadius: 10, padding: '12px 14px',
                    marginBottom: 9, boxShadow: '0 1px 5px rgba(0,0,0,.05)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10, color: '#9aa3b8' }}>
                        {new Date(note.date_observation).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span style={{ background: '#e8eef8', color: '#1a4b8f', fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 10 }}>
                        {note.auteur ? `${note.auteur.prenom} ${note.auteur.nom}` : 'AF'}
                      </span>
                      <span style={{ fontSize: 16, marginLeft: 'auto' }}>{humeurEmojis[note.humeur] || '😐'}</span>
                    </div>
                    <div style={{ fontSize: 12, lineHeight: 1.6 }}>{note.observation}</div>
                    {note.tags && note.tags.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 7 }}>
                        {note.tags.map((tag, i) => (
                          <span key={i} style={{ padding: '2px 6px', background: '#eef1f8', borderRadius: 3, fontSize: 10, color: '#5a6478' }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Autres onglets */}
          {['famille', 'judiciaire', 'quotidien'].includes(activeTab) && (
            <div className="alert-info">
              <span>🚧</span>
              <span>Cet onglet est en cours de développement. Les données seront connectées à la base Supabase prochainement.</span>
            </div>
          )}

        </div>
      </div>

      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

function ContactCard({ role, nom, meta, tel, color, onCall }) {
  return (
    <div style={{ background: color, border: '1px solid #dde3f0', borderRadius: 9, padding: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: '#5a6478', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 5 }}>{role}</div>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{nom}</div>
      <div style={{ fontSize: 10, color: '#9aa3b8', marginBottom: 7 }}>{meta}</div>
      {tel && (
        <div style={{ fontSize: 11, color: '#1a4b8f', fontWeight: 500, marginBottom: 7 }}>📞 {tel}</div>
      )}
      <button
        onClick={onCall}
        style={{
          padding: '5px 10px', borderRadius: 6, border: '1px solid #1a4b8f',
          background: '#e8eef8', color: '#1a4b8f', fontSize: 11,
          fontWeight: 600, cursor: 'pointer', fontFamily: 'Sora, sans-serif'
        }}
      >
        📞 Appeler
      </button>
    </div>
  )
}
