import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Sidebar from '../components/Sidebar'
import PageHeader from '../components/PageHeader'

export default function ListeEnfants({ profile }) {
  const navigate = useNavigate()
  const [enfants, setEnfants] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [newEnfant, setNewEnfant] = useState({ prenom:'', nom:'', date_naissance:'', sexe:'', numero_dossier:'', type_placement:'judiciaire' })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [collegues, setCollegues] = useState([])
  const [search, setSearch] = useState('')

  const isReferent = ['referent','encadrant','rtase','admin'].includes(profile?.role)

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 2800) }

  const fetchEnfants = useCallback(async () => {
    if (!profile) return
    let q = supabase.from('enfants').select(`
      id, prenom, nom, date_naissance, sexe, numero_dossier, type_placement, date_placement,
      af_principal:af_principal_id(nom, prenom),
      referent:referent_id(nom, prenom)
    `)
    if (profile.role === 'af') q = q.eq('af_principal_id', profile.id)
    else if (profile.role === 'referent') q = q.eq('referent_id', profile.id)
    const { data } = await q.order('nom', { ascending: true })
    if (data) setEnfants(data)
    setLoading(false)
  }, [profile])

  const fetchCollegues = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('id, nom, prenom, role').eq('territoire', profile?.territoire)
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

  async function createEnfant() {
    if (!newEnfant.prenom || !newEnfant.nom) { showToast('⚠️ Prénom et nom requis'); return }
    setSaving(true)
    const { data, error } = await supabase.from('enfants').insert({
      prenom: newEnfant.prenom,
      nom: newEnfant.nom,
      date_naissance: newEnfant.date_naissance || null,
      sexe: newEnfant.sexe || null,
      numero_dossier: newEnfant.numero_dossier || null,
      type_placement: newEnfant.type_placement || 'judiciaire',
      af_principal_id: newEnfant.af_principal_id || null,
      referent_id: profile.id,
      territoire: profile.territoire,
    }).select().single()

    if (!error && data) {
      showToast('✅ Dossier créé !')
      setShowModal(false)
      setNewEnfant({ prenom:'', nom:'', date_naissance:'', sexe:'', numero_dossier:'', type_placement:'judiciaire' })
      navigate(`/enfants/${data.id}`)
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
  }

  return (
    <div className="app-layout">
      <Sidebar profile={profile} />
      <div className="main-content">
        <PageHeader icon="👶" title="Enfants" subtitle={`${enfants.length} dossier${enfants.length > 1 ? 's' : ''} · ${profile?.territoire || ''}`}>
          {isReferent && (
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Nouveau dossier</button>
          )}
        </PageHeader>

        <div style={{ padding:24 }}>

          {/* Recherche */}
          <div style={{ marginBottom:20 }}>
            <input className="form-control" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="🔍 Rechercher par nom ou n° dossier..."
              style={{ maxWidth:380 }} />
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
                const initiales = `${e.prenom?.[0] || ''}${e.nom?.[0] || ''}`
                return (
                  <div key={e.id} onClick={() => navigate(`/enfants/${e.id}`)}
                    style={{ background:'#fff', border:'1px solid #dde3f0', borderRadius:14, padding:18, cursor:'pointer', boxShadow:'0 2px 12px rgba(26,75,143,.08)', transition:'all .15s' }}
                    onMouseOver={e => { e.currentTarget.style.boxShadow='0 4px 20px rgba(26,75,143,.15)'; e.currentTarget.style.transform='translateY(-2px)' }}
                    onMouseOut={e => { e.currentTarget.style.boxShadow='0 2px 12px rgba(26,75,143,.08)'; e.currentTarget.style.transform='none' }}>

                    <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
                      <div style={{ width:44, height:44, borderRadius:'50%', background:'linear-gradient(135deg, #1a4b8f, #2e8b4a)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:700, color:'#fff', flexShrink:0 }}>
                        {initiales}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:15, fontWeight:700 }}>{e.prenom} {e.nom}</div>
                        <div style={{ fontSize:12, color:'#9aa3b8' }}>
                          {age}{e.date_naissance && ` · ${new Date(e.date_naissance).toLocaleDateString('fr-FR')}`}
                        </div>
                      </div>
                      {e.type_placement === 'secret' && (
                        <span style={{ fontSize:14 }}>🔒</span>
                      )}
                    </div>

                    <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:10 }}>
                      {e.numero_dossier && (
                        <span style={{ padding:'2px 8px', borderRadius:10, background:'#e8eef8', color:'#1a4b8f', fontSize:10, fontWeight:600 }}>
                          {e.numero_dossier}
                        </span>
                      )}
                      {e.type_placement && (
                        <span style={{ padding:'2px 8px', borderRadius:10, background: placement.bg, color: placement.color, fontSize:10, fontWeight:600 }}>
                          {placement.label}
                        </span>
                      )}
                    </div>

                    <div style={{ borderTop:'1px solid #f0f0f0', paddingTop:10, display:'flex', justifyContent:'space-between', fontSize:11, color:'#9aa3b8' }}>
                      <span>👨‍👩‍👧 {e.af_principal ? `${e.af_principal.prenom} ${e.af_principal.nom}` : 'AF non assigné'}</span>
                      <span>👩‍💼 {e.referent ? `${e.referent.prenom} ${e.referent.nom}` : '—'}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Modal création dossier ── */}
        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal-box" style={{ maxWidth:480 }} onClick={e => e.stopPropagation()}>
              <div className="modal-title">👶 Nouveau dossier enfant</div>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Prénom *</label>
                  <input className="form-control" value={newEnfant.prenom} onChange={e => setNewEnfant(n => ({...n, prenom: e.target.value}))} />
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
                    <option value="Féminin">Féminin</option>
                    <option value="Masculin">Masculin</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">N° dossier CD81</label>
                  <input className="form-control" value={newEnfant.numero_dossier} onChange={e => setNewEnfant(n => ({...n, numero_dossier: e.target.value}))} placeholder="CD81-2026-XXXX" />
                </div>
                <div className="form-group">
                  <label className="form-label">Type de placement</label>
                  <select className="form-control" value={newEnfant.type_placement} onChange={e => setNewEnfant(n => ({...n, type_placement: e.target.value}))}>
                    <option value="judiciaire">⚖️ Judiciaire</option>
                    <option value="administratif">📋 Administratif</option>
                    <option value="urgence">🚨 Urgence</option>
                    <option value="secret">🔒 Secret</option>
                  </select>
                </div>
                <div className="form-group col-span-2">
                  <label className="form-label">AF Principal</label>
                  <select className="form-control" value={newEnfant.af_principal_id || ''} onChange={e => setNewEnfant(n => ({...n, af_principal_id: e.target.value}))}>
                    <option value="">— Sélectionner un AF —</option>
                    {collegues.filter(c => c.role === 'af').map(c => (
                      <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Annuler</button>
                <button className="btn btn-primary" onClick={createEnfant} disabled={saving}>
                  {saving ? '⏳...' : '👶 Créer le dossier'}
                </button>
              </div>
            </div>
          </div>
        )}

        {toast && <div className="toast">{toast}</div>}
      </div>
    </div>
  )
}
