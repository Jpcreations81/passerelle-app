import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import Sidebar from '../components/Sidebar'
import PageHeader from '../components/PageHeader'

// ── SQL à exécuter si pas encore fait ──────────────────────────────────────
// CREATE TABLE IF NOT EXISTS documents_dossiers (
//   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
//   nom TEXT NOT NULL,
//   parent_id UUID REFERENCES documents_dossiers(id) ON DELETE CASCADE,
//   territoire TEXT,
//   created_by UUID REFERENCES profiles(id),
//   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
// );
// CREATE TABLE IF NOT EXISTS documents_generaux (
//   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
//   dossier_id UUID REFERENCES documents_dossiers(id) ON DELETE CASCADE,
//   nom TEXT NOT NULL,
//   storage_path TEXT NOT NULL,
//   taille INTEGER,
//   mime_type TEXT,
//   uploaded_by UUID REFERENCES profiles(id),
//   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
// );

const DOSSIERS_DEFAUT = [
  { nom: '📋 Administratif', enfants: ['Feuilles de présence', 'Relais', 'Courriers'] },
  { nom: '🚗 Frais', enfants: ['Frais de déplacement', 'Sommes dues', 'Remboursements'] },
]

export default function Documents({ profile }) {
  const [dossiers, setDossiers] = useState([])
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [dossierActif, setDossierActif] = useState(null) // null = racine
  const [chemin, setChemin] = useState([]) // breadcrumb
  const [toast, setToast] = useState('')
  const [showNouveauDossier, setShowNouveauDossier] = useState(false)
  const [nomNouveauDossier, setNomNouveauDossier] = useState('')
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const [search, setSearch] = useState('')

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 2800) }
  function fmtDate(iso) { if (!iso) return ''; const [y,m,d] = iso.split('T')[0].split('-'); return `${d}/${m}/${y}` }

  const fetchDossiers = useCallback(async (parentId = null) => {
    let q = supabase.from('documents_dossiers').select('*').order('nom')
    if (parentId) q = q.eq('parent_id', parentId)
    else q = q.is('parent_id', null)
    if (profile?.territoire) q = q.eq('territoire', profile.territoire)
    const { data } = await q
    return data || []
  }, [profile])

  const fetchDocuments = useCallback(async (dossierId = null) => {
    if (!dossierId) { setDocuments([]); return }
    const { data } = await supabase.from('documents_generaux').select('*').eq('dossier_id', dossierId).order('created_at', { ascending: false })
    setDocuments(data || [])
  }, [])

  const chargerDossier = useCallback(async (dossierId, nouveauChemin) => {
    setLoading(true)
    const sous = await fetchDossiers(dossierId)
    setDossiers(sous)
    await fetchDocuments(dossierId)
    setDossierActif(dossierId)
    setChemin(nouveauChemin)
    setLoading(false)
  }, [fetchDossiers, fetchDocuments])

  useEffect(() => {
    async function init() {
      setLoading(true)
      // Initialiser les dossiers par défaut si vide
      const racine = await fetchDossiers(null)
      if (racine.length === 0 && profile?.role === 'af') {
        // Créer les 2 dossiers par défaut pour les AF
        for (const d of DOSSIERS_DEFAUT) {
          const { data: parent } = await supabase.from('documents_dossiers').insert({
            nom: d.nom, parent_id: null, created_by: profile.id, proprietaire_id: profile.id
          }).select().single()
          if (parent) {
            for (const enfant of d.enfants) {
              await supabase.from('documents_dossiers').insert({
                nom: enfant, parent_id: parent.id, created_by: profile.id, proprietaire_id: profile.id
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
  }, [fetchDossiers, profile])

  async function creerDossier() {
    if (!nomNouveauDossier.trim()) { showToast('⚠️ Nom requis'); return }
    const { error } = await supabase.from('documents_dossiers').insert({
      nom: nomNouveauDossier.trim(),
      parent_id: dossierActif || null,
      territoire: profile?.territoire,
      created_by: profile?.id,
    })
    if (!error) {
      showToast('✅ Dossier créé !')
      setNomNouveauDossier('')
      setShowNouveauDossier(false)
      const sous = await fetchDossiers(dossierActif)
      setDossiers(sous)
    } else showToast('❌ ' + error.message)
  }

  async function supprimerDossier(id) {
    if (!window.confirm('Supprimer ce dossier et son contenu ?')) return
    await supabase.from('documents_dossiers').delete().eq('id', id)
    const sous = await fetchDossiers(dossierActif)
    setDossiers(sous)
    showToast('🗑 Dossier supprimé')
  }

  async function uploadDocument(file, dossierId) {
    if (!file || !dossierId) { showToast('⚠️ Ouvrez un dossier d\'abord'); return }
    setUploadingDoc(true)
    const ext = file.name.split('.').pop()
    const path = `documents/${profile?.territoire || 'general'}/${dossierId}/${Date.now()}.${ext}`
    const { error: sErr } = await supabase.storage.from('documents-enfants').upload(path, file, { contentType: file.type })
    if (sErr) { showToast('❌ ' + sErr.message); setUploadingDoc(false); return }
    await supabase.from('documents_generaux').insert({
      dossier_id: dossierId, nom: file.name, storage_path: path,
      taille: file.size, mime_type: file.type, uploaded_by: profile?.id
    })
    showToast('✅ Document uploadé !')
    await fetchDocuments(dossierId)
    setUploadingDoc(false)
  }

  async function supprimerDocument(doc) {
    if (!window.confirm('Supprimer ce document ?')) return
    await supabase.storage.from('documents-enfants').remove([doc.storage_path])
    await supabase.from('documents_generaux').delete().eq('id', doc.id)
    showToast('🗑 Supprimé')
    await fetchDocuments(dossierActif)
  }

  const dossiersFiltres = search
    ? dossiers.filter(d => d.nom.toLowerCase().includes(search.toLowerCase()))
    : dossiers
  const documentsFiltres = search
    ? documents.filter(d => d.nom.toLowerCase().includes(search.toLowerCase()))
    : documents

  const isReferent = ['referent','encadrant','rtase','admin'].includes(profile?.role)

  return (
    <div className="app-layout">
      <Sidebar profile={profile} />
      <div className="main-content">
        <PageHeader icon="📂" title="Documents" subtitle={profile?.territoire || ''} />

        <div style={{ padding:24 }}>

          {/* Breadcrumb */}
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:20, flexWrap:'wrap' }}>
            <button onClick={async () => { const d = await fetchDossiers(null); setDossiers(d); setDocuments([]); setDossierActif(null); setChemin([]) }}
              style={{ padding:'4px 10px', borderRadius:8, border:'1px solid #dde3f0', background: dossierActif === null ? '#e8eef8' : '#fff', color: dossierActif === null ? '#1a4b8f' : '#5a6478', fontSize:13, cursor:'pointer', fontWeight: dossierActif === null ? 700 : 400, fontFamily:'Sora,sans-serif' }}>
              📂 Racine
            </button>
            {chemin.map((c, i) => (
              <React.Fragment key={c.id}>
                <span style={{ color:'#dde3f0' }}>›</span>
                <button onClick={() => {
                  const nouveauChemin = chemin.slice(0, i + 1)
                  chargerDossier(c.id, nouveauChemin)
                }} style={{ padding:'4px 10px', borderRadius:8, border:'1px solid #dde3f0', background: i === chemin.length - 1 ? '#e8eef8' : '#fff', color: i === chemin.length - 1 ? '#1a4b8f' : '#5a6478', fontSize:13, cursor:'pointer', fontWeight: i === chemin.length - 1 ? 700 : 400, fontFamily:'Sora,sans-serif' }}>
                  {c.nom}
                </button>
              </React.Fragment>
            ))}
          </div>

          {/* Barre d'actions */}
          <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap', alignItems:'center' }}>
            <input className="form-control" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="🔍 Rechercher..." style={{ maxWidth:280 }} />
            <button onClick={() => setShowNouveauDossier(true)} className="btn btn-secondary" style={{ fontSize:13 }}>
              📁 Nouveau dossier
            </button>
            {dossierActif && (
              <label style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 14px', borderRadius:8, border:'1px solid #c4d4f5', background:'#e8eef8', color:'#1a4b8f', fontSize:13, cursor:'pointer', fontFamily:'Sora,sans-serif', fontWeight:600 }}>
                {uploadingDoc ? '⏳ Upload...' : '📎 Ajouter un document'}
                <input type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" style={{ display:'none' }}
                  onChange={e => { if (e.target.files[0]) uploadDocument(e.target.files[0], dossierActif) }} />
              </label>
            )}
          </div>

          {loading ? (
            <div style={{ textAlign:'center', padding:60, color:'#9aa3b8' }}>
              <div style={{ fontSize:36, marginBottom:12 }}>📂</div>
              <div>Chargement...</div>
            </div>
          ) : (
            <>
              {/* Sous-dossiers */}
              {dossiersFiltres.length > 0 && (
                <div style={{ marginBottom:24 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#5a6478', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:12 }}>
                    Dossiers ({dossiersFiltres.length})
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:10 }}>
                    {dossiersFiltres.map(d => (
                      <div key={d.id}
                        style={{ background:'#fff', border:'1px solid #dde3f0', borderRadius:10, padding:'14px 16px', cursor:'pointer', boxShadow:'0 2px 8px rgba(26,75,143,.06)', transition:'all .15s', display:'flex', alignItems:'center', gap:10, position:'relative' }}
                        onMouseOver={e => { e.currentTarget.style.boxShadow='0 4px 16px rgba(26,75,143,.12)'; e.currentTarget.style.transform='translateY(-1px)' }}
                        onMouseOut={e => { e.currentTarget.style.boxShadow='0 2px 8px rgba(26,75,143,.06)'; e.currentTarget.style.transform='none' }}
                        onClick={() => chargerDossier(d.id, [...chemin, { id: d.id, nom: d.nom }])}>
                        <span style={{ fontSize:24 }}>📁</span>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.nom}</div>
                        </div>
                        {isReferent && (
                          <button onClick={e => { e.stopPropagation(); supprimerDossier(d.id) }}
                            style={{ position:'absolute', top:6, right:6, padding:'2px 6px', borderRadius:5, border:'1px solid #fde8e8', background:'#fdf0ee', color:'#c0392b', fontSize:10, cursor:'pointer', opacity:0 }}
                            onMouseOver={e => e.currentTarget.style.opacity='1'}
                            onMouseOut={e => e.currentTarget.style.opacity='0'}>
                            🗑
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Documents */}
              {dossierActif && (
                <div>
                  <div style={{ fontSize:11, fontWeight:700, color:'#5a6478', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:12 }}>
                    Documents ({documentsFiltres.length})
                  </div>
                  {documentsFiltres.length === 0 ? (
                    <div style={{ textAlign:'center', padding:40, color:'#9aa3b8', background:'#f4f6fb', borderRadius:12, border:'1px dashed #dde3f0' }}>
                      <div style={{ fontSize:28, marginBottom:8 }}>📄</div>
                      <div style={{ fontSize:13 }}>Aucun document dans ce dossier</div>
                      <div style={{ fontSize:12, marginTop:4 }}>Cliquez sur "📎 Ajouter un document" pour uploader</div>
                    </div>
                  ) : (
                    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                      {documentsFiltres.map(doc => (
                        <div key={doc.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', background:'#fff', borderRadius:10, border:'1px solid #dde3f0', boxShadow:'0 1px 4px rgba(26,75,143,.04)' }}>
                          <span style={{ fontSize:22 }}>{doc.mime_type?.includes('pdf') ? '📄' : doc.mime_type?.includes('image') ? '🖼️' : doc.mime_type?.includes('word') ? '📝' : '📎'}</span>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:13, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{doc.nom}</div>
                            <div style={{ fontSize:11, color:'#9aa3b8' }}>
                              {doc.taille ? `${Math.round(doc.taille/1024)} Ko` : ''} · {fmtDate(doc.created_at?.slice(0,10))}
                            </div>
                          </div>
                          <button onClick={async () => { const { data: u } = await supabase.storage.from('documents-enfants').createSignedUrl(doc.storage_path, 3600); if (u?.signedUrl) window.open(u.signedUrl, '_blank') }}
                            style={{ padding:'5px 10px', borderRadius:7, border:'1px solid #dde3f0', background:'#fff', fontSize:12, cursor:'pointer' }}>👁</button>
                          <button onClick={async () => { const { data: u } = await supabase.storage.from('documents-enfants').createSignedUrl(doc.storage_path, 60); if (u?.signedUrl) { const r = await fetch(u.signedUrl); const b = await r.blob(); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = doc.nom; document.body.appendChild(a); a.click(); document.body.removeChild(a) } }}
                            style={{ padding:'5px 10px', borderRadius:7, border:'1px solid #dde3f0', background:'#fff', fontSize:12, cursor:'pointer' }}>⬇</button>
                          <button onClick={() => supprimerDocument(doc)}
                            style={{ padding:'5px 10px', borderRadius:7, border:'1px solid #fde8e8', background:'#fdf0ee', color:'#c0392b', fontSize:12, cursor:'pointer' }}>🗑</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Dossier vide */}
              {dossiersFiltres.length === 0 && documentsFiltres.length === 0 && !loading && (
                <div style={{ textAlign:'center', padding:60, color:'#9aa3b8' }}>
                  <div style={{ fontSize:36, marginBottom:12 }}>📂</div>
                  <div style={{ fontSize:14 }}>Dossier vide</div>
                  <div style={{ fontSize:12, marginTop:4 }}>Créez des sous-dossiers ou ajoutez des documents</div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal nouveau dossier */}
      {showNouveauDossier && (
        <div className="modal-overlay" onClick={() => setShowNouveauDossier(false)}>
          <div className="modal-box" style={{ maxWidth:400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">📁 Nouveau dossier</div>
            <div style={{ marginBottom:8, fontSize:12, color:'#9aa3b8' }}>
              Créer dans : {chemin.length > 0 ? chemin[chemin.length-1].nom : 'Racine'}
            </div>
            <div className="form-group">
              <label className="form-label">Nom du dossier</label>
              <input className="form-control" value={nomNouveauDossier} autoFocus
                onChange={e => setNomNouveauDossier(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && creerDossier()}
                placeholder="Ex: Médical, Scolaire, Contrats..." />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowNouveauDossier(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={creerDossier}>✅ Créer</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
