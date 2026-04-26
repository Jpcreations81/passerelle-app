
import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Sidebar from '../components/Sidebar'
import PageHeader from '../components/PageHeader'

export default function Rapports({ profile }) {
  const navigate = useNavigate()
  const [rapports, setRapports] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showRapport, setShowRapport] = useState(null)
  const [toast, setToast] = useState('')

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 2800) }

  function fmtDate(iso) {
    if (!iso) return ''
    const datePart = iso.split('T')[0]
    const [y, m, d] = datePart.split('-')
    return `${d}/${m}/${y}`
  }

  const fetchRapports = useCallback(async () => {
    if (!profile) return
    let q = supabase
      .from('rapports')
      .select(`*, enfant:enfant_id(id, prenom, nom, numero_dossier), auteur:auteur_id(prenom, nom)`)
      .order('created_at', { ascending: false })

    if (profile.role === 'af') {
      // AF voit les rapports des enfants qui lui sont assignés
      const { data: enfants } = await supabase
        .from('enfants')
        .select('id')
        .eq('af_principal_id', profile.id)
      if (enfants) {
        const ids = enfants.map(e => e.id)
        q = q.in('enfant_id', ids)
      }
    } else if (profile.role === 'referent') {
      const { data: enfants } = await supabase
        .from('enfants')
        .select('id')
        .eq('referent_id', profile.id)
      if (enfants) {
        const ids = enfants.map(e => e.id)
        q = q.in('enfant_id', ids)
      }
    }

    const { data } = await q
    if (data) setRapports(data)
    setLoading(false)
  }, [profile])

  useEffect(() => { fetchRapports() }, [fetchRapports])

  async function deleteRapport(id) {
    if (!window.confirm('Supprimer ce rapport ?')) return
    await supabase.from('rapports').delete().eq('id', id)
    showToast('🗑 Rapport supprimé')
    fetchRapports()
  }

  function imprimer(rapport) {
    const w = window.open('', '_blank')
    w.document.write(`<html><head><title>Rapport - ${rapport.enfant?.prenom} ${rapport.enfant?.nom}</title>
      <style>
        body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;line-height:1.8;font-size:13px;}
        .header{display:flex;justify-content:space-between;margin-bottom:24px;font-size:11px;color:#666;border-bottom:1px solid #ddd;padding-bottom:8px;}
        h1{font-size:18px;border-bottom:2px solid #1a4b8f;padding-bottom:8px;color:#1a4b8f;margin-top:0;}
        @media print{body{margin:20px;}}
      </style></head><body>
      <div class="header">
        <span>Passerelle — Département du Tarn (81)</span>
        <span>Période : ${fmtDate(rapport.periode_debut)} au ${fmtDate(rapport.periode_fin)}</span>
      </div>
      <h1>${rapport.titre}</h1>
      <div style="line-height:1.9;">${rapport.contenu.split('\n').map(l => l ? `<p>${l}</p>` : '<br/>').join('')}</div>
      </body></html>`)
    w.document.close()
    w.print()
  }

  const rapportsFiltres = rapports.filter(r =>
    `${r.enfant?.prenom} ${r.enfant?.nom}`.toLowerCase().includes(search.toLowerCase()) ||
    r.titre?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="app-layout">
      <Sidebar profile={profile} />
      <div className="main-content">
        <PageHeader icon="📄" title="Rapports" subtitle={`${rapports.length} rapport${rapports.length > 1 ? 's' : ''}`} />

        <div style={{ padding:24 }}>
          <div style={{ marginBottom:20 }}>
            <input className="form-control" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="🔍 Rechercher par enfant ou titre..."
              style={{ maxWidth:380 }} />
          </div>

          {loading ? (
            <div style={{ textAlign:'center', padding:60, color:'#9aa3b8' }}>
              <div style={{ fontSize:36, marginBottom:12 }}>📄</div>
              <div>Chargement...</div>
            </div>
          ) : rapportsFiltres.length === 0 ? (
            <div style={{ textAlign:'center', padding:60, color:'#9aa3b8' }}>
              <div style={{ fontSize:36, marginBottom:12 }}>📄</div>
              <div style={{ fontSize:14 }}>{search ? 'Aucun résultat' : 'Aucun rapport'}</div>
              <div style={{ fontSize:12, marginTop:4 }}>Les rapports sont générés depuis le journal des enfants</div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {rapportsFiltres.map(r => (
                <div key={r.id} style={{ background:'#fff', border:'1px solid #dde3f0', borderRadius:12, padding:18, boxShadow:'0 2px 8px rgba(26,75,143,.06)' }}>
                  <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                    <div style={{ width:40, height:40, borderRadius:10, background:'#e8eef8', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>📄</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:14, fontWeight:700, color:'#1c2333', marginBottom:4 }}>{r.titre}</div>
                      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:8 }}>
                        {r.enfant && (
                          <span style={{ padding:'2px 8px', borderRadius:10, background:'#e8eef8', color:'#1a4b8f', fontSize:11, fontWeight:600, cursor:'pointer' }}
                            onClick={() => navigate(`/enfants/${r.enfant.id}`)}>
                            👶 {r.enfant.prenom} {r.enfant.nom}
                          </span>
                        )}
                        {r.periode_debut && r.periode_fin && (
                          <span style={{ padding:'2px 8px', borderRadius:10, background:'#f4f6fb', color:'#5a6478', fontSize:11 }}>
                            📅 {fmtDate(r.periode_debut)} → {fmtDate(r.periode_fin)}
                          </span>
                        )}
                        <span style={{ padding:'2px 8px', borderRadius:10, background:'#f4f6fb', color:'#9aa3b8', fontSize:11 }}>
                          {fmtDate(r.created_at?.slice(0,10))} · {r.auteur?.prenom} {r.auteur?.nom}
                        </span>
                      </div>
                      <div style={{ fontSize:12, color:'#5a6478', lineHeight:1.6, maxHeight:60, overflow:'hidden', textOverflow:'ellipsis' }}>
                        {r.contenu?.slice(0, 200)}...
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                      <button onClick={() => setShowRapport(r)}
                        style={{ padding:'6px 12px', borderRadius:8, border:'1px solid #c4d4f5', background:'#e8eef8', color:'#1a4b8f', fontSize:12, cursor:'pointer', fontWeight:600 }}>
                        👁 Lire
                      </button>
                      <button onClick={() => imprimer(r)}
                        style={{ padding:'6px 12px', borderRadius:8, border:'1px solid #dde3f0', background:'#fff', color:'#5a6478', fontSize:12, cursor:'pointer' }}>
                        🖨️
                      </button>
                      <button onClick={() => deleteRapport(r.id)}
                        style={{ padding:'6px 12px', borderRadius:8, border:'1px solid #fde8e8', background:'#fdf0ee', color:'#c0392b', fontSize:12, cursor:'pointer' }}>
                        🗑
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal lecture rapport */}
        {showRapport && (
          <div className="modal-overlay" onClick={() => setShowRapport(null)}>
            <div className="modal-box" style={{ maxWidth:700, maxHeight:'80vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>
              <div className="modal-title">{showRapport.titre}</div>
              <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
                {showRapport.enfant && (
                  <span style={{ padding:'2px 8px', borderRadius:10, background:'#e8eef8', color:'#1a4b8f', fontSize:11, fontWeight:600 }}>
                    👶 {showRapport.enfant.prenom} {showRapport.enfant.nom}
                  </span>
                )}
                {showRapport.periode_debut && (
                  <span style={{ padding:'2px 8px', borderRadius:10, background:'#f4f6fb', color:'#5a6478', fontSize:11 }}>
                    📅 {fmtDate(showRapport.periode_debut)} → {fmtDate(showRapport.periode_fin)}
                  </span>
                )}
                <span style={{ padding:'2px 8px', borderRadius:10, background:'#f4f6fb', color:'#9aa3b8', fontSize:11 }}>
                  {fmtDate(showRapport.created_at?.slice(0,10))} · {showRapport.auteur?.prenom} {showRapport.auteur?.nom}
                </span>
              </div>
              <div style={{ fontSize:13, lineHeight:1.9, color:'#1c2333', whiteSpace:'pre-wrap', borderTop:'1px solid #dde3f0', paddingTop:16 }}>
                {showRapport.contenu}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowRapport(null)}>Fermer</button>
                <button className="btn btn-secondary" onClick={() => {
                  navigator.clipboard.writeText(showRapport.contenu)
                  showToast('📋 Copié !')
                }}>📋 Copier</button>
                <button className="btn btn-primary" onClick={() => imprimer(showRapport)}>🖨️ Imprimer</button>
              </div>
            </div>
          </div>
        )}

        {toast && <div className="toast">{toast}</div>}
      </div>
    </div>
  )
}
