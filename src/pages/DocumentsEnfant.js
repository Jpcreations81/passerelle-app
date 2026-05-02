import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Sidebar from '../components/Sidebar'

const DOSSIERS_DEFAUT = [
  { nom: '🏥 Médical', enfants: ['Ordonnances', 'Comptes-rendus', 'Vaccinations'] },
  { nom: '🏫 Scolaire', enfants: ['Bulletins', 'Correspondance école', 'Inscriptions'] },
]

export default function DocumentsEnfant({ profile }) {
  const navigate = useNavigate()
  const { id } = useParams()
  const [enfant, setEnfant] = useState(null)
  const [dossiers, setDossiers] = useState([])
  const [documents, setDocuments] = useState([])
  const [dossierActif, setDossierActif] = useState(null)
  const [chemin, setChemin] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState('')

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 2800) }

  // Charger l'enfant
  useEffect(() => {
    supabase.from('enfants').select('nom, prenom').eq('id', id).single()
      .then(({ data }) => { if (data) setEnfant(data) })
  }, [id])

  // Charger les dossiers
  const fetchDossiers = useCallback(async (parentId = null) => {
    let q = supabase.from('documents_dossiers').select('*').order('nom')
    if (parentId) q = q.eq('parent_id', parentId)
    else q = q.is('parent_id', null)
    q = q.eq('territoire', id)
    const { data } = await q
    return data || []
  }, [id])

  // Charger les documents d'un dossier
  const fetchDocuments = useCallback(async (dossierId) => {
    if (!dossierId) { setDocuments([]); return }
    const { data } = await supabase.from('documents_generaux')
      .select('*').eq('dossier_id', dossierId).order('created_at', { ascending: false })
    setDocuments(data || [])
  }, [])

  // Initialisation
  useEffect(() => {
    async function init() {
      setLoading(true)
      const racine = await fetchDossiers(null)
      if (racine.length === 0) {
        // Créer les dossiers par défaut
        for (const d of DOSSIERS_DEFAUT) {
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
        const recharged = await fetchDossiers(null)
        setDossiers(recharged)
      } else {
        setDossiers(racine)
      }
      setLoading(false)
    }
    init()
  }, [fetchDossiers, id, profile])

  async function ouvrirDossier(dossier) {
    setChemin(prev => [...prev, dossier])
    setDossierActif(dossier.id)
    const sous = await fetchDossiers(dossier.id)
    setDossiers(sous)
    fetchDocuments(dossier.id)
  }

  async function naviguerVers(index) {
    if (index === -1) {
      // Retour racine
      setChemin([])
      setDossierActif(null)
      setDocuments([])
      const racine = await fetchDossiers(null)
      setDossiers(racine)
    } else {
      const cible = chemin[index]
      const newChemin = chemin.slice(0, index + 1)
      setChemin(newChemin)
      setDossierActif(cible.id)
      const sous = await fetchDossiers(cible.id)
      setDossiers(sous)
      fetchDocuments(cible.id)
    }
  }

  async function creerDossier() {
    const nom = prompt('Nom du nouveau dossier :')
    if (!nom) return
    await supabase.from('documents_dossiers').insert({
      nom, parent_id: dossierActif || null, territoire: id, created_by: profile?.id
    })
    const sous = await fetchDossiers(dossierActif)
    setDossiers(sous)
    showToast('✅ Dossier créé !')
  }

  async function uploadFichier(file) {
    if (!file || !dossierActif) { showToast('⚠️ Sélectionnez d\'abord un dossier'); return }
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `enfants/${id}/docs/${dossierActif}/${Date.now()}.${ext}`
    const { error: sErr } = await supabase.storage.from('documents-enfants').upload(path, file, { contentType: file.type })
    if (sErr) { showToast('❌ ' + sErr.message); setUploading(false); return }
    await supabase.from('documents_generaux').insert({
      dossier_id: dossierActif, nom: file.name, storage_path: path,
      taille: file.size, mime_type: file.type, created_by: profile?.id
    })
    showToast('✅ Document uploadé !')
    fetchDocuments(dossierActif)
    setUploading(false)
  }

  async function voirDocument(path) {
    const { data } = await supabase.storage.from('documents-enfants').createSignedUrl(path, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  async function supprimerDocument(docId, path) {
    if (!window.confirm('Supprimer ce document ?')) return
    await supabase.storage.from('documents-enfants').remove([path])
    await supabase.from('documents_generaux').delete().eq('id', docId)
    showToast('🗑 Supprimé')
    fetchDocuments(dossierActif)
  }

  return (
    <div className="app-layout">
      <Sidebar profile={profile} />
      <div className="main-content">

        {/* Header */}
        <header className="page-header">
          <img src="/logo_transparent.png" alt="P" className="header-logo" onError={e => e.target.style.display='none'} />
          <div className="header-sep" />
          <button onClick={() => navigate(`/enfants/${id}`)}
            style={{ display:'flex', alignItems:'center', gap:6, color:'#1a4b8f', fontSize:13, fontWeight:500, cursor:'pointer', background:'none', border:'none', fontFamily:'Sora,sans-serif', padding:'6px 10px', borderRadius:8 }}
            onMouseOver={e => e.currentTarget.style.background='#e8eef8'}
            onMouseOut={e => e.currentTarget.style.background='none'}>
            ← {enfant?.nom} {enfant?.prenom}
          </button>
          <div className="header-sep" />
          <div style={{ flex:1 }}>
            <div className="page-title">📂 Documents · {enfant?.nom} {enfant?.prenom}</div>
          </div>
          <div className="header-actions">
            <button onClick={creerDossier} className="btn btn-secondary">📁 Nouveau dossier</button>
            {dossierActif && (
              <label className="btn btn-primary" style={{ cursor:'pointer' }}>
                {uploading ? '⏳...' : '📎 Ajouter un fichier'}
                <input type="file" accept="image/*,application/pdf" style={{ display:'none' }}
                  onChange={e => { if (e.target.files[0]) uploadFichier(e.target.files[0]) }} />
              </label>
            )}
          </div>
        </header>

        <div style={{ padding:24 }}>

          {/* Fil d'ariane */}
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:20, flexWrap:'wrap' }}>
            <button onClick={() => naviguerVers(-1)}
              style={{ padding:'5px 12px', borderRadius:8, border:'1px solid #dde3f0', background: chemin.length === 0 ? '#1a4b8f' : '#fff', color: chemin.length === 0 ? '#fff' : '#1a4b8f', fontSize:12, cursor:'pointer', fontFamily:'Sora,sans-serif' }}>
              📂 Racine
            </button>
            {chemin.map((d, i) => (
              <React.Fragment key={d.id}>
                <span style={{ color:'#9aa3b8', fontSize:16 }}>›</span>
                <button onClick={() => naviguerVers(i)}
                  style={{ padding:'5px 12px', borderRadius:8, border:'1px solid #dde3f0', background: i === chemin.length-1 ? '#1a4b8f' : '#fff', color: i === chemin.length-1 ? '#fff' : '#1a4b8f', fontSize:12, cursor:'pointer', fontFamily:'Sora,sans-serif' }}>
                  {d.nom}
                </button>
              </React.Fragment>
            ))}
          </div>

          {loading ? (
            <div style={{ textAlign:'center', padding:60, color:'#9aa3b8' }}>
              <div style={{ fontSize:36 }}>📂</div>
              <div>Chargement...</div>
            </div>
          ) : (
            <>
              {/* Dossiers */}
              {dossiers.length > 0 && (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))', gap:12, marginBottom:24 }}>
                  {dossiers.map(d => (
                    <div key={d.id} onClick={() => ouvrirDossier(d)}
                      style={{ background:'#f4f6fb', border:'1px solid #dde3f0', borderRadius:12, padding:20, cursor:'pointer', textAlign:'center', transition:'all .15s' }}
                      onMouseOver={e => { e.currentTarget.style.background='#e8eef8'; e.currentTarget.style.borderColor='#1a4b8f' }}
                      onMouseOut={e => { e.currentTarget.style.background='#f4f6fb'; e.currentTarget.style.borderColor='#dde3f0' }}>
                      <div style={{ fontSize:36, marginBottom:8 }}>📁</div>
                      <div style={{ fontSize:12, fontWeight:600, color:'#1c2333' }}>{d.nom}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Documents */}
              {dossierActif && (
                <>
                  {documents.length === 0 ? (
                    <div style={{ textAlign:'center', padding:40, color:'#9aa3b8', border:'2px dashed #dde3f0', borderRadius:12 }}>
                      <div style={{ fontSize:32, marginBottom:8 }}>📄</div>
                      <div style={{ fontSize:13 }}>Aucun document — cliquez sur "Ajouter un fichier"</div>
                    </div>
                  ) : (
                    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                      {documents.map(d => (
                        <div key={d.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 16px', background:'#fff', borderRadius:10, border:'1px solid #dde3f0', boxShadow:'0 1px 4px rgba(26,75,143,.06)' }}>
                          <span style={{ fontSize:24 }}>{d.mime_type?.includes('pdf') ? '📄' : '🖼️'}</span>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:13, fontWeight:600 }}>{d.nom}</div>
                            <div style={{ fontSize:11, color:'#9aa3b8' }}>
                              {d.taille ? `${Math.round(d.taille/1024)} Ko` : ''}
                              {d.created_at && ` · ${new Date(d.created_at).toLocaleDateString('fr-FR')}`}
                            </div>
                          </div>
                          <button onClick={() => voirDocument(d.storage_path)}
                            style={{ padding:'5px 10px', borderRadius:7, border:'1px solid #dde3f0', background:'#fff', fontSize:12, cursor:'pointer' }}>👁 Voir</button>
                          <button onClick={() => supprimerDocument(d.id, d.storage_path)}
                            style={{ padding:'5px 10px', borderRadius:7, border:'1px solid #fde8e8', background:'#fdf0ee', color:'#c0392b', fontSize:12, cursor:'pointer' }}>🗑</button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {dossiers.length === 0 && !dossierActif && (
                <div style={{ textAlign:'center', padding:60, color:'#9aa3b8' }}>
                  <div style={{ fontSize:36, marginBottom:8 }}>📂</div>
                  <div>Aucun dossier</div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
