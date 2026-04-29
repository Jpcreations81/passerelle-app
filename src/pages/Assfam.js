import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Sidebar from '../components/Sidebar'
import PageHeader from '../components/PageHeader'

export default function Assfam({ profile }) {
  const navigate = useNavigate()
  const [afs, setAfs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newAF, setNewAF] = useState({ email:'', nom:'', prenom:'', telephone:'', territoire:'' })
  const [creating, setCreating] = useState(false)

  function fmtDate(iso) {
    if (!iso) return ''
    const [y,m,d] = iso.split('T')[0].split('-')
    return `${d}/${m}/${y}`
  }

  function calcAge(ddn) {
    if (!ddn) return ''
    const d = new Date(ddn), now = new Date()
    let age = now.getFullYear() - d.getFullYear()
    if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--
    return `${age} ans`
  }

  const fetchAfs = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('profiles').select('*').eq('role', 'af')
    if (profile?.role === 'af') {
      q = q.eq('id', profile.id)
    } else if (profile?.role === 'referent' || profile?.role === 'encadrant') {
      q = q.eq('territoire', profile.territoire)
    }
    q = q.order('nom')
    const { data } = await q
    if (data) setAfs(data)
    setLoading(false)
  }, [profile])

  useEffect(() => { fetchAfs() }, [fetchAfs])

  const afsFiltres = afs.filter(a =>
    `${a.nom} ${a.prenom}`.toLowerCase().includes(search.toLowerCase()) ||
    (a.territoire || '').toLowerCase().includes(search.toLowerCase())
  )

  async function createAF() {
    if (!newAF.email || !newAF.nom || !newAF.prenom) {
      alert('Email, nom et prénom sont requis')
      return
    }
    setCreating(true)
    try {
      const session = JSON.parse(localStorage.getItem('sb-ebvwiwdefecaxfmnfppz-auth-token'))
      const token = session?.access_token
      const resp = await fetch('https://ebvwiwdefecaxfmnfppz.supabase.co/auth/v1/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVidndpd2RlZmVjYXhmbW5mcHB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwMjkzNDIsImV4cCI6MjA1ODYwNTM0Mn0.wMqjRGHuuJT-B-xX4cdwFI1iaTRo8AcnKJWOc8aGvfs',
          'Authorization': 'Bearer ' + token,
        },
        body: JSON.stringify({ email: newAF.email, password: 'Passerelle2026!', email_confirm: true })
      })
      const data = await resp.json()
      if (!data.id) {
        alert('Erreur: ' + JSON.stringify(data))
        setCreating(false)
        return
      }
      await supabase.from('profiles').update({
        nom: newAF.nom,
        prenom: newAF.prenom,
        role: 'af',
        telephone: newAF.telephone,
        territoire: newAF.territoire || profile?.territoire,
      }).eq('id', data.id)
      setShowCreateModal(false)
      setNewAF({ email:'', nom:'', prenom:'', telephone:'', territoire:'' })
      await fetchAfs()
      navigate('/assfam/' + data.id)
    } catch(e) {
      alert('Erreur: ' + e.message)
    }
    setCreating(false)
  }

  return (
    <div className="app-layout">
      <Sidebar profile={profile} />
      <div className="main-content">
        <PageHeader icon="👨‍👩‍👧" title="Assistants familiaux" subtitle={`${afs.length} assistant${afs.length > 1 ? 's' : ''} familial${afs.length > 1 ? 'aux' : ''}`} />

        <div style={{ padding:24 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
            <input className="form-control" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="🔍 Rechercher par nom ou territoire..."
              style={{ maxWidth:380 }} />
            {['encadrant','rtase','admin'].includes(profile?.role) && (
              <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
                + Créer un AF
              </button>
            )}
          </div>

          {loading ? (
            <div style={{ textAlign:'center', padding:60, color:'#9aa3b8' }}>
              <div style={{ fontSize:36, marginBottom:12 }}>👨‍👩‍👧</div>
              <div>Chargement...</div>
            </div>
          ) : afsFiltres.length === 0 ? (
            <div style={{ textAlign:'center', padding:60, color:'#9aa3b8' }}>
              <div style={{ fontSize:36, marginBottom:12 }}>🔍</div>
              <div>Aucun assistant familial trouvé</div>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(340px, 1fr))', gap:16 }}>
              {afsFiltres.map(af => {
                const initiales = `${af.nom?.[0] || ''}${af.prenom?.[0] || ''}`
                const joursAgr = af.date_expiration_agrement
                  ? Math.ceil((new Date(af.date_expiration_agrement) - new Date()) / (1000*60*60*24))
                  : null
                const agrAlerte = joursAgr !== null && joursAgr <= 90

                return (
                  <div key={af.id}
                    onClick={() => navigate(`/assfam/${af.id}`)}
                    style={{ background:'#fff', border:'1px solid #dde3f0', borderRadius:14, padding:20, cursor:'pointer', boxShadow:'0 2px 12px rgba(26,75,143,.07)', transition:'all .15s' }}
                    onMouseOver={e => { e.currentTarget.style.boxShadow='0 4px 20px rgba(26,75,143,.14)'; e.currentTarget.style.transform='translateY(-2px)' }}
                    onMouseOut={e => { e.currentTarget.style.boxShadow='0 2px 12px rgba(26,75,143,.07)'; e.currentTarget.style.transform='none' }}>

                    <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:14 }}>
                      <div style={{ width:48, height:48, borderRadius:'50%', background:'linear-gradient(135deg,#1a4b8f,#2e8b4a)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:700, color:'#fff', flexShrink:0 }}>
                        {initiales}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:15, fontWeight:700 }}>{af.nom} {af.prenom}</div>
                        {af.date_naissance && (
                          <div style={{ fontSize:12, color:'#9aa3b8' }}>{calcAge(af.date_naissance)}</div>
                        )}
                      </div>
                      {agrAlerte && (
                        <span style={{ padding:'3px 8px', borderRadius:8, background:'#fef3e2', color:'#d97706', fontSize:10, fontWeight:700 }}>
                          ⚠️ {joursAgr}j
                        </span>
                      )}
                    </div>

                    <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:12 }}>
                      {af.numero_agrement && (
                        <span style={{ padding:'3px 10px', borderRadius:10, background:'#e8eef8', color:'#1a4b8f', fontSize:11, fontWeight:600 }}>
                          📜 {af.numero_agrement}
                        </span>
                      )}
                      <span style={{ padding:'3px 10px', borderRadius:10, background:'#f4f6fb', color:'#5a6478', fontSize:11 }}>
                        🏛️ {af.territoire || '—'}
                      </span>
                      {af.places_agreees && (
                        <span style={{ padding:'3px 10px', borderRadius:10, background:'#f4f6fb', color:'#5a6478', fontSize:11 }}>
                          🏠 {af.places_agreees} place{af.places_agreees > 1 ? 's' : ''}
                        </span>
                      )}
                      {af.accord_urgence && (
                        <span style={{ padding:'3px 10px', borderRadius:10, background:'#fdf0ee', color:'#c0392b', fontSize:11, fontWeight:600 }}>
                          🚨 Urgence
                        </span>
                      )}
                    </div>

                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', borderTop:'1px solid #f0f0f0', paddingTop:10 }}>
                      {af.telephone ? (
                        <a href={`tel:${af.telephone}`} onClick={e => e.stopPropagation()}
                          style={{ fontSize:12, color:'#1a4b8f', textDecoration:'none', display:'flex', alignItems:'center', gap:4 }}>
                          📞 {af.telephone}
                        </a>
                      ) : (
                        <span style={{ fontSize:12, color:'#9aa3b8' }}>—</span>
                      )}
                      {af.date_expiration_agrement && (
                        <span style={{ fontSize:11, color: agrAlerte ? '#d97706' : '#9aa3b8' }}>
                          Agrément : {fmtDate(af.date_expiration_agrement)}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-box" style={{ maxWidth:480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">👨‍👩‍👧 Créer un dossier AF</div>
            <div style={{ background:'#e8eef8', border:'1px solid #c4d4f5', borderRadius:9, padding:'10px 14px', marginBottom:16, fontSize:12, color:'#1a4b8f' }}>
              💡 Mot de passe provisoire : <strong>Passerelle2026!</strong> — à changer à la première connexion.
            </div>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Nom *</label>
                <input className="form-control" value={newAF.nom} onChange={e => setNewAF(n => ({...n, nom: e.target.value}))} placeholder="NOM" autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Prénom *</label>
                <input className="form-control" value={newAF.prenom} onChange={e => setNewAF(n => ({...n, prenom: e.target.value}))} placeholder="Prénom" />
              </div>
              <div className="form-group col-span-2">
                <label className="form-label">Email *</label>
                <input className="form-control" type="email" value={newAF.email} onChange={e => setNewAF(n => ({...n, email: e.target.value}))} placeholder="email@exemple.fr" />
              </div>
              <div className="form-group">
                <label className="form-label">Téléphone</label>
                <input className="form-control" type="tel" value={newAF.telephone} onChange={e => setNewAF(n => ({...n, telephone: e.target.value}))} placeholder="06 XX XX XX XX" />
              </div>
              <div className="form-group">
                <label className="form-label">Territoire</label>
                <input className="form-control" value={newAF.territoire || profile?.territoire || ''} onChange={e => setNewAF(n => ({...n, territoire: e.target.value}))} placeholder="MD Gaillac-Graulhet" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={createAF} disabled={creating}>
                {creating ? '⏳ Création...' : '✅ Créer le dossier'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
