
// FichePresencePermanent.js — v2026-05-22a — fiche de présence permanente AF principal
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Sidebar from '../components/Sidebar'
import FichePresencePrint from './FichePresencePrint'

const MOIS_LABELS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const JOURS_LABELS = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']
const FERIES_2026 = ['2026-01-01','2026-04-06','2026-05-01','2026-05-08','2026-05-14','2026-05-25','2026-07-14','2026-08-15','2026-11-01','2026-11-11','2026-12-25']

function isFerie(date) {
  const y = date.getFullYear(), m = String(date.getMonth()+1).padStart(2,'0'), d = String(date.getDate()).padStart(2,'0')
  return FERIES_2026.includes(y+'-'+m+'-'+d)
}
function isDimanche(date) { return date.getDay() === 0 }
function getDaysInMonth(year, month) {
  const days = [], d = new Date(year, month, 1)
  while (d.getMonth() === month) { days.push(new Date(d)); d.setDate(d.getDate() + 1) }
  return days
}
function fmt(date) {
  return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0')
}
function fmtHeure(isoStr) {
  if (!isoStr) return ''
  return new Date(isoStr).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit', timeZone:'Europe/Paris' })
}
function fmtDate(isoStr) {
  if (!isoStr) return null
  const d = new Date(isoStr)
  const localStr = d.toLocaleDateString('fr-FR', { timeZone:'Europe/Paris', year:'numeric', month:'2-digit', day:'2-digit' })
  const [day, month, year] = localStr.split('/')
  return year+'-'+month+'-'+day
}

export default function FichePresencePermanent({ profile }) {
  const navigate = useNavigate()
  const [enfants, setEnfants] = useState([])
  const [selectedEnfant, setSelectedEnfant] = useState(null)
  const [selectedMois, setSelectedMois] = useState(new Date().getMonth())
  const [selectedAnnee, setSelectedAnnee] = useState(new Date().getFullYear())
  const [presences, setPresences] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [moisComplet, setMoisComplet] = useState(true)
  const [toast, setToast] = useState('')
  const [showPrint, setShowPrint] = useState(false)

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => { fetchEnfants() }, [])
  useEffect(() => { if (selectedEnfant) loadFiche() }, [selectedEnfant, selectedMois, selectedAnnee])

  async function fetchEnfants() {
    const { data } = await supabase.from('enfants').select('id, nom, prenom, numero_dossier').eq('af_principal_id', profile.id)
    if (data) { setEnfants(data); if (data.length > 0) setSelectedEnfant(data[0]) }
    setLoading(false)
  }

  async function loadFiche() {
    const days = getDaysInMonth(selectedAnnee, selectedMois)
    const p = {}
    days.forEach(d => { p[fmt(d)] = { present: true, heure_depart: '', heure_arrivee: '', motif: '' } })

    // Charger les événements relais
    const debutPerm = new Date(selectedAnnee, selectedMois, 1)
    const finPerm = new Date(selectedAnnee, selectedMois + 1, 0, 23, 59, 59)
    const { data: evts } = await supabase.from('evenements').select('*')
      .eq('af_id', profile.id).eq('categorie', 'relais')
      .lte('date_debut', finPerm.toISOString()).gte('date_fin', debutPerm.toISOString())

    if (evts) {
      const relaisProfiles = {}
      for (const evt of evts) {
        for (const pid of (evt.participants_ids || [])) {
          if (!relaisProfiles[pid] && pid !== profile.id) {
            const { data: af } = await supabase.from('profiles').select('id, nom, prenom').eq('id', pid).single()
            if (af) relaisProfiles[pid] = af
          }
        }
      }
      evts.forEach(evt => {
        const premierJour = fmtDate(evt.date_debut)
        const dernierJour = fmtDate(evt.date_fin)
        const afRelaisId = (evt.participants_ids || [])[0]
        const afRelais = relaisProfiles[afRelaisId]
        const nomRelais = afRelais ? `${afRelais.prenom} ${afRelais.nom}` : (evt.titre?.replace(/^Relais\s*—\s*/i, '') || 'AF Relais')
        const cur = new Date(evt.date_debut); cur.setHours(0,0,0,0)
        const finDate = new Date(evt.date_fin); finDate.setHours(23,59,59,999)
        while (cur <= finDate) {
          const key = fmt(cur)
          if (p[key]) {
            if (key === premierJour && key === dernierJour) {
              p[key] = { present: true, heure_depart: fmtHeure(evt.date_debut), heure_arrivee: fmtHeure(evt.date_fin), motif: `Relais chez un(e) ASSFAM — ${nomRelais}` }
            } else if (key === premierJour) {
              p[key] = { present: true, heure_depart: fmtHeure(evt.date_debut), heure_arrivee: '', motif: `Début accueil relais chez un(e) ASSFAM — ${nomRelais}` }
            } else if (key === dernierJour) {
              p[key] = { present: true, heure_arrivee: fmtHeure(evt.date_fin), heure_depart: '', motif: 'Retour' }
            } else {
              p[key] = { present: false, heure_depart: '', heure_arrivee: '', motif: `Relais chez un(e) ASSFAM — ${nomRelais}` }
            }
          }
          cur.setDate(cur.getDate() + 1)
        }
      })
    }

    // Charger la fiche sauvegardée
    const { data: saved } = await supabase.from('fiches_presence').select('*')
      .eq('enfant_id', selectedEnfant.id).eq('af_id', profile.id)
      .eq('mois', selectedMois + 1).eq('annee', selectedAnnee).eq('type_fiche', 'permanent').single()
    if (saved?.donnees) { setPresences(saved.donnees); setMoisComplet(saved.donnees._moisComplet ?? true) }
    else setPresences(p)
  }

  const days = getDaysInMonth(selectedAnnee, selectedMois)
  const nbJours = Object.values(presences).filter(p => p.present).length
  const nbFeries = days.filter(d => isFerie(d) && presences[fmt(d)]?.present).length

  async function saveFiche() {
    setSaving(true)
    const { error } = await supabase.from('fiches_presence').upsert({
      enfant_id: selectedEnfant.id, af_id: profile.id,
      mois: selectedMois + 1, annee: selectedAnnee, type_fiche: 'permanent',
      nb_jours_presence: nbJours, nb_jours_feries: nbFeries,
      donnees: presences, transmise: false,
    }, { onConflict: 'enfant_id,af_id,mois,annee,type_fiche' })
    if (!error) showToast('✅ Fiche sauvegardée !')
    else showToast('❌ Erreur : ' + error.message)
    setSaving(false)
  }

  function togglePresence(key) {
    setPresences(prev => ({ ...prev, [key]: { ...prev[key], present: !prev[key]?.present } }))
  }
  function updateField(key, field, value) {
    setPresences(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }))
  }

  if (loading) return <div className="page-loading">Chargement...</div>

  return (
    <div className="app-layout">
      <Sidebar profile={profile} />
      <div className="main-content">
        <div className="page-header">
          <div className="header-left">
            <div className="page-title">📋 Fiche de présence permanente</div>
          </div>
          <div className="header-actions">
            <button onClick={() => navigate('/fiche-presence-intermittent')} className="btn btn-secondary" style={{ fontSize:12 }}>
              🔄 Fiche intermittente
            </button>
            <button onClick={saveFiche} className="btn btn-secondary" disabled={saving} style={{ fontSize:12 }}>
              {saving ? '⏳...' : '💾 Sauvegarder'}
            </button>
            <button onClick={() => setShowPrint(true)} className="btn btn-primary" style={{ fontSize:12 }}>
              🖨️ Imprimer
            </button>
          </div>
        </div>

        <div className="card no-print" style={{ marginBottom:14 }}>
          <div className="card-body">
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
              <div className="form-group">
                <label className="form-label">Enfant</label>
                <select className="form-control" value={selectedEnfant?.id || ''} onChange={e => setSelectedEnfant(enfants.find(en => en.id === e.target.value))}>
                  {enfants.map(en => <option key={en.id} value={en.id}>{en.prenom} {en.nom}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Mois</label>
                <select className="form-control" value={selectedMois} onChange={e => setSelectedMois(parseInt(e.target.value))}>
                  {MOIS_LABELS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Année</label>
                <select className="form-control" value={selectedAnnee} onChange={e => setSelectedAnnee(parseInt(e.target.value))}>
                  {[2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        {selectedEnfant && (
          <div className="card">
            <div className="card-body" style={{ padding:0 }}>
              <div style={{ padding:'10px 16px', borderBottom:'1px solid #eef1f8', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ fontSize:14, fontWeight:700 }}>{selectedEnfant.prenom} {selectedEnfant.nom}</div>
                <div style={{ fontSize:12, color:'#5a6478' }}>{nbJours} jours · {nbFeries} fériés</div>
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'#f4f6fb' }}>
                    <th style={{ padding:'8px 12px', textAlign:'left', fontSize:11, fontWeight:700, color:'#5a6478', borderBottom:'1px solid #eef1f8', width:'22%' }}>Période</th>
                    <th style={{ padding:'8px 12px', textAlign:'center', fontSize:11, fontWeight:700, color:'#5a6478', borderBottom:'1px solid #eef1f8', width:'10%' }}>Présence</th>
                    <th style={{ padding:'8px 12px', textAlign:'center', fontSize:11, fontWeight:700, color:'#5a6478', borderBottom:'1px solid #eef1f8', width:'12%' }}>Heure départ</th>
                    <th style={{ padding:'8px 12px', textAlign:'center', fontSize:11, fontWeight:700, color:'#5a6478', borderBottom:'1px solid #eef1f8', width:'12%' }}>Heure arrivée</th>
                    <th style={{ padding:'8px 12px', textAlign:'left', fontSize:11, fontWeight:700, color:'#5a6478', borderBottom:'1px solid #eef1f8' }}>Motif</th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((d, i) => {
                    const key = fmt(d)
                    const p = presences[key] || { present: true, heure_depart:'', heure_arrivee:'', motif:'' }
                    const fe = isFerie(d), dim = isDimanche(d)
                    const isRelaisDebut = p.motif?.startsWith('Début accueil relais')
                    const isRetour = p.motif === 'Retour'
                    const isRelaisJour = p.motif?.includes('Relais chez')
                    const isRelaisAny = isRelaisDebut || isRetour || isRelaisJour
                    const rowBg = isRelaisAny ? '#fef9c3' : (dim || fe) ? '#dbeafe' : '#fff'
                    return (
                      <tr key={i} style={{ background: rowBg, borderBottom:'1px solid #f0f0f0' }}>
                        <td style={{ padding:'6px 12px', fontSize:11, fontWeight: (dim||fe) ? 700 : 400 }}>
                          {JOURS_LABELS[d.getDay()]} {d.getDate()} {fe ? '🎉' : ''}
                        </td>
                        <td style={{ padding:'6px 12px', textAlign:'center' }}>
                          <input type="checkbox" checked={!!p.present} onChange={() => togglePresence(key)} />
                        </td>
                        <td style={{ padding:'4px 8px' }}>
                          <input type="time" value={p.heure_depart||''} onChange={e => updateField(key,'heure_depart',e.target.value)}
                            style={{ width:'100%', fontSize:11, border:'1px solid #eef1f8', borderRadius:4, padding:'2px 4px' }} />
                        </td>
                        <td style={{ padding:'4px 8px' }}>
                          <input type="time" value={p.heure_arrivee||''} onChange={e => updateField(key,'heure_arrivee',e.target.value)}
                            style={{ width:'100%', fontSize:11, border:'1px solid #eef1f8', borderRadius:4, padding:'2px 4px' }} />
                        </td>
                        <td style={{ padding:'4px 8px' }}>
                          <input type="text" value={p.motif||''} onChange={e => updateField(key,'motif',e.target.value)}
                            style={{ width:'100%', fontSize:11, border:'1px solid #eef1f8', borderRadius:4, padding:'2px 6px' }} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {showPrint && selectedEnfant && (
          <FichePresencePrint enfant={selectedEnfant} profile={profile} mois={selectedMois} annee={selectedAnnee}
            presences={presences} moisComplet={moisComplet} onClose={() => setShowPrint(false)} typeFiche="permanent" />
        )}
        {toast && <div className="toast">{toast}</div>}
      </div>
    </div>
  )
}
