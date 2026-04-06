import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Sidebar from '../components/Sidebar'

const MOIS_LABELS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

const FERIES_2026 = [
  '2026-01-01','2026-04-06','2026-05-01','2026-05-08',
  '2026-05-14','2026-05-25','2026-07-14','2026-08-15',
  '2026-11-01','2026-11-11','2026-12-25'
]

function isFerie(date) {
  return FERIES_2026.includes(date.toISOString().slice(0,10))
}

function isWeekend(date) {
  return date.getDay() === 0 || date.getDay() === 6
}

function getDaysInMonth(year, month) {
  const days = []
  const d = new Date(year, month, 1)
  while (d.getMonth() === month) {
    days.push(new Date(d))
    d.setDate(d.getDate() + 1)
  }
  return days
}

export default function FichePresence({ profile }) {
  const navigate = useNavigate()
  const [enfants, setEnfants] = useState([])
  const [selectedEnfant, setSelectedEnfant] = useState(null)
  const [selectedMois, setSelectedMois] = useState(3) // Avril = index 3
  const [selectedAnnee, setSelectedAnnee] = useState(2026)
  const [typeFiche, setTypeFiche] = useState('permanent')
  const [presences, setPresences] = useState({})
  const [evenements, setEvenements] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => { fetchEnfants() }, [])
  useEffect(() => { if (selectedEnfant) { fetchEvenements(); buildPresences() } }, [selectedEnfant, selectedMois, selectedAnnee])

  async function fetchEnfants() {
    const { data } = await supabase
      .from('enfants')
      .select('id, nom, prenom, numero_dossier, statut')
      .eq('af_principal_id', profile.id)
    if (data) {
      setEnfants(data)
      if (data.length > 0) setSelectedEnfant(data[0])
    }
    setLoading(false)
  }

  async function fetchEvenements() {
    const debut = new Date(selectedAnnee, selectedMois, 1)
    const fin = new Date(selectedAnnee, selectedMois + 1, 0)
    const { data } = await supabase
      .from('evenements')
      .select('*')
      .gte('date_debut', debut.toISOString())
      .lte('date_debut', fin.toISOString())
      .eq('af_id', profile.id)
    if (data) setEvenements(data)
  }

  function buildPresences() {
    const days = getDaysInMonth(selectedAnnee, selectedMois)
    const p = {}
    days.forEach(d => {
      const key = d.toISOString().slice(0,10)
      p[key] = { present: !isWeekend(d), note: '', heure: '' }
    })
    setPresences(p)
  }

  function togglePresence(key) {
    setPresences(prev => ({
      ...prev,
      [key]: { ...prev[key], present: !prev[key].present }
    }))
  }

  function setNote(key, note) {
    setPresences(prev => ({ ...prev, [key]: { ...prev[key], note } }))
  }

  function setHeure(key, heure) {
    setPresences(prev => ({ ...prev, [key]: { ...prev[key], heure } }))
  }

  const days = getDaysInMonth(selectedAnnee, selectedMois)
  const nbPresences = Object.values(presences).filter(p => p.present && !isWeekend(new Date(Object.keys(presences).find(k => presences[k] === p) || ''))).length
  const nbFeries = days.filter(d => isFerie(d) && presences[d.toISOString().slice(0,10)]?.present).length
  const nbJours = Object.values(presences).filter(p => p.present).length

  async function saveFiche() {
    setSaving(true)
    const { error } = await supabase.from('fiches_presence').upsert({
      enfant_id: selectedEnfant.id,
      af_id: profile.id,
      mois: selectedMois + 1,
      annee: selectedAnnee,
      type_fiche: typeFiche,
      nb_jours_presence: nbJours,
      nb_jours_feries: nbFeries,
      donnees: presences,
      transmise: false,
    }, { onConflict: 'enfant_id,af_id,mois,annee,type_fiche' })
    if (!error) showToast('✅ Fiche sauvegardée !')
    else showToast('❌ Erreur lors de la sauvegarde')
    setSaving(false)
  }

  async function transmettreASE() {
    await saveFiche()
    const { error } = await supabase.from('fiches_presence').update({
      transmise: true, date_transmission: new Date().toISOString()
    }).eq('enfant_id', selectedEnfant.id)
      .eq('af_id', profile.id)
      .eq('mois', selectedMois + 1)
      .eq('annee', selectedAnnee)
      .eq('type_fiche', typeFiche)
    if (!error) showToast('📤 Fiche transmise à l\'ASE !')
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 2800) }

  const JOURS_COURT = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']

  function getDayLabel(date) {
    const j = date.getDay()
    return JOURS_COURT[j === 0 ? 6 : j - 1]
  }

  if (loading) return (
    <div className="app-layout"><Sidebar profile={profile} />
      <div className="main-content"><div className="loading-spinner">⏳ Chargement...</div></div>
    </div>
  )

  return (
    <div className="app-layout">
      <Sidebar profile={profile} />
      <div className="main-content">

        <header className="page-header">
          <button onClick={() => navigate('/documents')} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'#5a6478' }}>‹</button>
          <span style={{ fontSize:20 }}>📋</span>
          <div>
            <div className="page-title">Fiche de présence</div>
            <div className="page-subtitle">Format officiel Tarn (81) · MD Gaillac-Graulhet</div>
          </div>
          <div className="header-actions">
            <button className="btn btn-secondary" onClick={saveFiche} disabled={saving}>
              {saving ? '⏳...' : '💾 Sauvegarder'}
            </button>
            <button className="btn btn-primary" onClick={() => showToast('📥 Export PDF...')}>
              📥 PDF
            </button>
            <button className="btn btn-success" onClick={transmettreASE}>
              📤 Transmettre ASE
            </button>
          </div>
        </header>

        <div className="page-content">

          {/* Sélecteurs */}
          <div className="card" style={{ marginBottom:16 }}>
            <div className="card-body">
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
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
                    <option value={2025}>2025</option>
                    <option value={2026}>2026</option>
                    <option value={2027}>2027</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Type de fiche</label>
                  <select className="form-control" value={typeFiche} onChange={e => setTypeFiche(e.target.value)}>
                    <option value="permanent">Permanent (AF Principal)</option>
                    <option value="relais">Relais / Adaptation</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Fiche officielle */}
          {selectedEnfant && (
            <div style={{ background:'#fff', border:'2px solid #1a4b8f', borderRadius:12, overflow:'hidden', boxShadow:'0 4px 20px rgba(26,75,143,.1)' }}>

              {/* En-tête officiel */}
              <div style={{ background:'#eef4ff', borderBottom:'2px solid #1a4b8f', padding:'14px 18px', display:'flex', alignItems:'flex-start', gap:14, flexWrap:'wrap' }}>
                <div style={{ background:'#1a4b8f', color:'#fff', padding:'7px 11px', borderRadius:7, fontSize:12, fontWeight:700, lineHeight:1.3, textAlign:'center', flexShrink:0 }}>
                  TARN<br /><span style={{ fontSize:9, fontWeight:400 }}>LE DÉPARTEMENT</span>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:16, fontWeight:700, color:'#1a4b8f' }}>FICHE DE PRÉSENCE {selectedAnnee}</div>
                  <div style={{ fontSize:13, fontWeight:600, color:'#1c2333', marginTop:3 }}>
                    Mois concerné : {MOIS_LABELS[selectedMois]} {selectedAnnee}
                  </div>
                </div>
                <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                  <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, cursor:'pointer', background:'#fff', border:`2px solid ${typeFiche === 'permanent' ? '#1a4b8f' : '#dde3f0'}`, borderRadius:6, padding:'4px 10px', color: typeFiche === 'permanent' ? '#1a4b8f' : '#9aa3b8', fontWeight: typeFiche === 'permanent' ? 600 : 400 }}>
                    <input type="radio" checked={typeFiche === 'permanent'} onChange={() => setTypeFiche('permanent')} style={{ margin:0 }} />
                    Temps complet
                  </label>
                  <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, cursor:'pointer', background:'#fff', border:`2px solid ${typeFiche === 'relais' ? '#1a4b8f' : '#dde3f0'}`, borderRadius:6, padding:'4px 10px', color: typeFiche === 'relais' ? '#1a4b8f' : '#9aa3b8', fontWeight: typeFiche === 'relais' ? 600 : 400 }}>
                    <input type="radio" checked={typeFiche === 'relais'} onChange={() => setTypeFiche('relais')} style={{ margin:0 }} />
                    Relais
                  </label>
                </div>
              </div>

              {/* Infos enfant / AF */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:0, borderBottom:'1px solid #dde3f0' }}>
                {[
                  { label:"Nom et prénom de l'enfant", value:`${selectedEnfant.prenom} ${selectedEnfant.nom}` },
                  { label:"Assistant(e) Familial(e)", value:`${profile.prenom} ${profile.nom}` },
                  { label:"Territoire", value:"MD Gaillac – Graulhet · Tarn (81)" },
                ].map((f, i) => (
                  <div key={i} style={{ padding:'10px 14px', borderRight: i < 2 ? '1px solid #dde3f0' : 'none', background:'#f8f9fb' }}>
                    <div style={{ fontSize:9, fontWeight:700, color:'#5a6478', textTransform:'uppercase', letterSpacing:'.3px', marginBottom:4 }}>{f.label}</div>
                    <div style={{ fontSize:12, fontWeight:600, borderBottom:'1px solid #9aa3b8', paddingBottom:2 }}>{f.value}</div>
                  </div>
                ))}
              </div>

              {/* Compteurs */}
              <div style={{ display:'flex', alignItems:'center', gap:24, padding:'10px 18px', borderBottom:'1px solid #dde3f0', background:'#f0f4ff', flexWrap:'wrap' }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12 }}>
                  <div style={{ width:16, height:16, border:'1.5px solid #1a4b8f', borderRadius:3 }}></div>
                  <span style={{ color:'#5a6478' }}>Mois complet</span>
                </div>
                <div style={{ fontSize:12, color:'#5a6478' }}>
                  NBRS/J : <strong style={{ color:'#1a4b8f', fontSize:15 }}>{nbJours}</strong>
                </div>
                <div style={{ fontSize:12, color:'#5a6478' }}>
                  NBRS/FERIES : <strong style={{ color:'#1a4b8f', fontSize:15 }}>{nbFeries}</strong>
                </div>
                <div style={{ fontSize:11, color:'#9aa3b8', marginLeft:'auto' }}>
                  💡 Cliquez sur ✓ pour basculer présence/absence
                </div>
              </div>

              {/* Tableau des jours */}
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                  <thead>
                    <tr>
                      {['Période','Présence (✓)','Heure départ','Heure arrivée','Motif absence'].map((h, i) => (
                        <th key={i} style={{ padding:'8px 10px', background:'#e8eef8', color:'#1a4b8f', fontWeight:700, fontSize:10, textAlign: i > 0 ? 'center' : 'left', borderBottom:'2px solid #1a4b8f', textTransform:'uppercase', letterSpacing:'.3px', borderRight: i < 4 ? '1px solid #dde3f0' : 'none' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {days.map((d, i) => {
                      const key = d.toISOString().slice(0,10)
                      const p = presences[key] || { present: false, note: '', heure: '' }
                      const fe = isFerie(d)
                      const we = isWeekend(d)
                      const dayLabel = getDayLabel(d)
                      return (
                        <tr key={i} style={{ background: fe ? '#fff8f8' : we ? '#fafafe' : p.present ? '#fff' : '#fff4f0' }}>
                          <td style={{ padding:'5px 10px', borderBottom:'1px solid #dde3f0', borderRight:'1px solid #dde3f0', fontWeight: fe ? 700 : 400, color: fe ? '#c0392b' : we ? '#9aa3b8' : '#1c2333' }}>
                            {dayLabel} {d.getDate()}
                            {fe && <span style={{ fontSize:9, marginLeft:5, color:'#c0392b', fontWeight:600 }}>F</span>}
                          </td>
                          <td style={{ padding:'5px 10px', textAlign:'center', borderBottom:'1px solid #dde3f0', borderRight:'1px solid #dde3f0' }}>
                            <div
                              onClick={() => togglePresence(key)}
                              style={{ width:24, height:24, border:`1.5px solid ${p.present ? '#1a4b8f' : '#dde3f0'}`, borderRadius:4, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', margin:'0 auto', background: p.present ? '#1a4b8f' : 'none', color:'#fff', fontWeight:700, fontSize:14, transition:'all .15s' }}
                            >
                              {p.present ? '✓' : ''}
                            </div>
                          </td>
                          <td style={{ padding:'3px 8px', textAlign:'center', borderBottom:'1px solid #dde3f0', borderRight:'1px solid #dde3f0' }}>
                            <input type="time" value={p.heure || ''} onChange={e => setHeure(key, e.target.value)}
                              style={{ border:'none', background:'none', fontSize:11, fontFamily:'Sora,sans-serif', outline:'none', textAlign:'center', width:70 }} />
                          </td>
                          <td style={{ padding:'3px 8px', textAlign:'center', borderBottom:'1px solid #dde3f0', borderRight:'1px solid #dde3f0' }}></td>
                          <td style={{ padding:'3px 8px', borderBottom:'1px solid #dde3f0' }}>
                            {!p.present && (
                              <input type="text" value={p.note || ''} onChange={e => setNote(key, e.target.value)}
                                placeholder="Motif..."
                                style={{ border:'none', background:'none', fontSize:10, fontFamily:'Sora,sans-serif', outline:'none', width:'100%', color:'#c0392b' }} />
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Zone admin */}
              <div style={{ padding:'12px 18px', borderTop:'1px solid #dde3f0', background:'#fffbf0' }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#d97706', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:8 }}>
                  Partie réservée à l'Administration
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, fontSize:11, color:'#5a6478' }}>
                  <div>Nbrs/J/Entretiens : ___________</div>
                  <div>Nbrs/J/Salaire : ___________</div>
                  <div>Féries : ___________</div>
                  <div>Date : ___________</div>
                </div>
              </div>

              {/* Signatures */}
              <div style={{ padding:'14px 18px', borderTop:'1px solid #dde3f0', display:'flex', justifyContent:'space-between', alignItems:'flex-end', flexWrap:'wrap', gap:14 }}>
                <div>
                  <div style={{ fontSize:11, color:'#5a6478', marginBottom:6 }}>Date : ____________________</div>
                  <div style={{ fontSize:11, color:'#5a6478', marginBottom:8 }}>Signature de l'Assistant(e) Familial(e) :</div>
                  <div style={{ width:200, height:60, border:'1px solid #dde3f0', borderRadius:6, background:'#f8f9fb' }}></div>
                </div>
                <div style={{ textAlign:'right', fontSize:10, color:'#9aa3b8' }}>
                  <div>ase.gaillac-graulhet@tarn.fr</div>
                  <div>DÉPARTEMENT DU TARN — 81013 ALBI CEDEX 9</div>
                </div>
              </div>

            </div>
          )}

        </div>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
