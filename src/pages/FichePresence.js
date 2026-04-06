import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Sidebar from '../components/Sidebar'
import FichePresencePrint from './FichePresencePrint'

const MOIS_LABELS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const JOURS_LABELS = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']

const FERIES_2026 = [
  '2026-01-01','2026-04-06','2026-05-01','2026-05-08',
  '2026-05-14','2026-05-25','2026-07-14','2026-08-15',
  '2026-11-01','2026-11-11','2026-12-25'
]

function isFerie(date) { return FERIES_2026.includes(date.toISOString().slice(0,10)) }
function isDimanche(date) { return date.getDay() === 0 }
function getDaysInMonth(year, month) {
  const days = []
  const d = new Date(year, month, 1)
  while (d.getMonth() === month) { days.push(new Date(d)); d.setDate(d.getDate() + 1) }
  return days
}
function fmt(date) { return date.toISOString().slice(0,10) }
function fmtHeure(isoStr) {
  if (!isoStr) return ''
  return new Date(isoStr).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' })
}

export default function FichePresence({ profile }) {
  const navigate = useNavigate()
  const [enfants, setEnfants] = useState([])
  const [selectedEnfant, setSelectedEnfant] = useState(null)
  const [selectedMois, setSelectedMois] = useState(3)
  const [selectedAnnee, setSelectedAnnee] = useState(2026)
  const [presences, setPresences] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [moisComplet, setMoisComplet] = useState(false)
  const [toast, setToast] = useState('')
  const [showPrint, setShowPrint] = useState(false)

  useEffect(() => { fetchEnfants() }, [])
  useEffect(() => { if (selectedEnfant) loadFiche() }, [selectedEnfant, selectedMois, selectedAnnee])

  async function fetchEnfants() {
    const { data } = await supabase.from('enfants').select('id, nom, prenom, numero_dossier').eq('af_principal_id', profile.id)
    if (data) { setEnfants(data); if (data.length > 0) setSelectedEnfant(data[0]) }
    setLoading(false)
  }

  async function loadFiche() {
    const days = getDaysInMonth(selectedAnnee, selectedMois)
    // Init toutes les cases cochées
    const p = {}
    days.forEach(d => {
      p[fmt(d)] = { present: true, heure_depart: '', heure_arrivee: '', motif: '' }
    })

    // Charger les événements relais depuis l'agenda
    const debut = new Date(selectedAnnee, selectedMois, 1)
    const fin = new Date(selectedAnnee, selectedMois + 1, 0, 23, 59, 59)
    const { data: evts } = await supabase
      .from('evenements')
      .select('*')
      .eq('af_id', profile.id)
      .eq('categorie', 'relais')
      .lte('date_debut', fin.toISOString())
      .gte('date_fin', debut.toISOString())

    if (evts) {
      evts.forEach(evt => {
        const dDebut = new Date(evt.date_debut)
        const dFin = new Date(evt.date_fin)
        const premierJour = fmt(dDebut)
        const dernierJour = fmt(dFin)
        // Parcourir tous les jours du relais
        const cur = new Date(dDebut)
        cur.setHours(0,0,0,0)
        const finDate = new Date(dFin)
        finDate.setHours(23,59,59,999)
        while (cur <= finDate) {
          const key = fmt(cur)
          if (p[key]) {
            if (key === premierJour && key === dernierJour) {
              // Relais sur 1 seul jour
              p[key].present = true
              p[key].heure_depart = fmtHeure(evt.date_debut)
              p[key].heure_arrivee = fmtHeure(evt.date_fin)
              p[key].motif = evt.titre || 'Relais'
            } else if (key === premierJour) {
              // Premier jour : coché, heure de départ
              p[key].present = true
              p[key].heure_depart = fmtHeure(evt.date_debut)
              p[key].motif = 'Départ en relais — ' + (evt.titre || 'AF Relais')
            } else if (key === dernierJour) {
              // Dernier jour : coché, heure d'arrivée
              p[key].present = true
              p[key].heure_arrivee = fmtHeure(evt.date_fin)
              p[key].motif = 'Retour de relais — ' + (evt.titre || 'AF Relais')
            } else {
              // Jours intermédiaires : absent avec motif
              p[key].present = false
              p[key].heure_depart = ''
              p[key].heure_arrivee = ''
              p[key].motif = 'Relais — ' + (evt.titre || '')
            }
          }
          cur.setDate(cur.getDate() + 1)
        }
      })

      // Seul le relais génère des heures automatiques
      // VM, réunions, formations : l'AF remplit manuellement
    }

    setPresences(p)
  }

  function togglePresence(key) {
    setPresences(prev => ({ ...prev, [key]: { ...prev[key], present: !prev[key].present } }))
  }

  function setField(key, field, val) {
    setPresences(prev => ({ ...prev, [key]: { ...prev[key], [field]: val } }))
  }

  const days = getDaysInMonth(selectedAnnee, selectedMois)
  const nbJours = Object.entries(presences).filter(([k, p]) => p.present).length
  const nbFeries = days.filter(d => isFerie(d) && presences[fmt(d)]?.present).length

  async function saveFiche() {
    setSaving(true)
    const { error } = await supabase.from('fiches_presence').upsert({
      enfant_id: selectedEnfant.id, af_id: profile.id,
      mois: selectedMois + 1, annee: selectedAnnee,
      type_fiche: 'permanent',
      nb_jours_presence: nbJours, nb_jours_feries: nbFeries,
      donnees: presences, transmise: false,
    }, { onConflict: 'enfant_id,af_id,mois,annee,type_fiche' })
    if (!error) showToast('✅ Fiche sauvegardée !')
    else showToast('❌ Erreur')
    setSaving(false)
  }

  async function transmettreASE() {
    await saveFiche()
    await supabase.from('fiches_presence').update({ transmise: true, date_transmission: new Date().toISOString() })
      .eq('enfant_id', selectedEnfant.id).eq('af_id', profile.id)
      .eq('mois', selectedMois + 1).eq('annee', selectedAnnee).eq('type_fiche', 'permanent')
    showToast('📤 Fiche transmise à ase.gaillac-graulhet@tarn.fr !')
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  if (loading) return (
    <div className="app-layout"><Sidebar profile={profile} />
      <div className="main-content"><div className="loading-spinner">⏳ Chargement...</div></div>
    </div>
  )

  return (
    <div className="app-layout">
      <Sidebar profile={profile} />
      <div className="main-content">

        <header className="page-header no-print">
          <button onClick={() => navigate('/')} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'#5a6478' }}>‹</button>
          <span style={{ fontSize:20 }}>📋</span>
          <div>
            <div className="page-title">Fiche de présence — Permanent</div>
            <div className="page-subtitle">Format officiel Tarn (81)</div>
          </div>
          <div className="header-actions">
            <button className="btn btn-secondary" onClick={saveFiche} disabled={saving}>{saving ? '⏳...' : '💾 Sauvegarder'}</button>
            <button className="btn btn-primary" onClick={() => setShowPrint(true)}>🖨️ Imprimer / PDF</button>
            <button className="btn btn-success" onClick={transmettreASE}>📤 Transmettre ASE</button>
          </div>
        </header>

        <style>{`
          @media print {
            .no-print { display:none!important; }
            .sidebar { display:none!important; }
            .main-content { margin-left:0!important; }
            .page-content { padding:0!important; }
            @page { size: A4 portrait; margin: 10mm; }
            body { background:white!important; font-family:Arial,sans-serif!important; font-size:10pt!important; }
            .fiche-print { border:1.5px solid #000!important; box-shadow:none!important; border-radius:0!important; }
            .fiche-print table { font-size:9pt!important; }
            .fiche-print th { background:#e8e8e8!important; color:#000!important; border-bottom:1.5px solid #000!important; }
            .fiche-print tr td { border-bottom:0.5px solid #ccc!important; }
            .fiche-print input { font-size:9pt!important; }
            /* Dimanches/fériés : fond gris clair à l'impression */
            .row-blue { background:#e8e8e8!important; }
            /* Relais transit : fond gris très clair */
            .row-yellow { background:#f5f5f5!important; }
            /* En-tête bleu → gris à l'impression */
            .fiche-header-print { background:#e8e8e8!important; }
            /* Compteurs */
            .compteur-box { border:1px solid #000!important; background:#f0f0f0!important; }
          }
        `}</style>

        <div className="page-content">

          {/* Sélecteurs */}
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
            <div className="fiche-print" style={{ background:'#fff', border:'2px solid #1a4b8f', borderRadius:10, overflow:'hidden', boxShadow:'0 4px 20px rgba(26,75,143,.1)' }}>

              {/* EN-TÊTE */}
              <div className="fiche-header-print" style={{ background:'#dbeafe', borderBottom:'2px solid #1a4b8f', padding:'12px 18px', display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
                <div style={{ background:'#1a4b8f', color:'#fff', padding:'6px 10px', borderRadius:6, fontSize:11, fontWeight:700, lineHeight:1.3, textAlign:'center', flexShrink:0 }}>
                  TARN<br /><span style={{ fontSize:8, fontWeight:400 }}>LE DÉPARTEMENT</span>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:15, fontWeight:700, color:'#1a4b8f', textDecoration:'underline' }}>FICHE DE PRÉSENCE {selectedAnnee}</div>
                  <div style={{ fontSize:12, fontWeight:600, color:'#1c2333', marginTop:2 }}>Mois concerné : {MOIS_LABELS[selectedMois]} {selectedAnnee}</div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, cursor:'pointer' }}>
                    <div style={{ width:14, height:14, border:'1.5px solid #1a4b8f', borderRadius:2, background: !moisComplet ? 'none' : '#1a4b8f', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:10, fontWeight:700, cursor:'pointer' }} onClick={() => setMoisComplet(v => !v)}>{moisComplet ? '✓' : ''}</div>
                    <span style={{ fontWeight:600 }}>Temps complet</span>
                  </label>
                  <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:11 }}>
                    <div style={{ width:14, height:14, border:'1.5px solid #1a4b8f', borderRadius:2 }}></div>
                    <span>Continu week-end</span>
                  </label>
                </div>
              </div>

              {/* CHAMPS IDENTITÉ */}
              <div style={{ padding:'10px 18px', borderBottom:'1px solid #dde3f0', background:'#f8faff' }}>
                <div style={{ fontSize:12, marginBottom:6 }}>
                  Nom et prénom de l'enfant (obligatoire) : <strong style={{ borderBottom:'1px solid #333', paddingBottom:1 }}>{selectedEnfant.prenom} {selectedEnfant.nom}</strong>
                </div>
                <div style={{ fontSize:12, marginBottom:6 }}>
                  Nom et Prénom de l'Assistant(e) familial(e) : <strong style={{ borderBottom:'1px solid #333', paddingBottom:1 }}>{profile.prenom} {profile.nom}</strong>
                </div>
                <div style={{ fontSize:12 }}>
                  Territoire : <strong>MD Gaillac – Graulhet</strong>
                </div>
              </div>

              {/* COMPTEURS */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', borderBottom:'1px solid #dde3f0' }}>
                <div style={{ padding:'10px 18px', borderRight:'1px solid #dde3f0' }}>
                  <div style={{ fontSize:11, color:'#5a6478', marginBottom:4 }}>Nombre de jours de présence et de fériés</div>
                  <div style={{ display:'flex', gap:20 }}>
                    <div style={{ background:'#e8eef8', border:'1px solid #1a4b8f', borderRadius:6, padding:'6px 14px', fontSize:11 }}>
                      <div style={{ fontWeight:700 }}>NBRS/J :</div>
                      <div style={{ fontSize:16, fontWeight:700, color:'#1a4b8f' }}>{nbJours}</div>
                    </div>
                    <div style={{ background:'#e8eef8', border:'1px solid #1a4b8f', borderRadius:6, padding:'6px 14px', fontSize:11 }}>
                      <div style={{ fontWeight:700 }}>NBRS/FERIES :</div>
                      <div style={{ fontSize:16, fontWeight:700, color:'#1a4b8f' }}>{nbFeries}</div>
                    </div>
                  </div>
                </div>
                <div style={{ padding:'10px 18px', background:'#f8f9fb' }}>
                  <div style={{ fontSize:11, fontWeight:700, marginBottom:4 }}>Partie réservée à l'Administration</div>
                  <div style={{ fontSize:11, color:'#5a6478', lineHeight:1.8 }}>
                    <div>Nbrs/Jours : ___________</div>
                    <div>Nbrs/Jours Fériés : ___________</div>
                    <div>Date : ___________</div>
                  </div>
                </div>
              </div>

              {/* TABLEAU */}
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                  <thead>
                    <tr style={{ background:'#f0f4ff' }}>
                      {['Période','Présence (x)','Heure départ','Heure arrivée','Motif absence'].map((h, i) => (
                        <th key={i} style={{ padding:'7px 10px', borderBottom:'2px solid #1a4b8f', borderRight: i < 4 ? '1px solid #dde3f0' : 'none', textAlign: i === 0 ? 'left' : 'center', fontSize:10, fontWeight:700, color:'#1c2333' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {days.map((d, i) => {
                      const key = fmt(d)
                      const p = presences[key] || { present: true, heure_depart:'', heure_arrivee:'', motif:'' }
                      const fe = isFerie(d)
                      const dim = isDimanche(d)
                      const isBlue = dim || fe
                      const isRelaisTransit = p.motif && (p.motif.startsWith('Départ en relais') || p.motif.startsWith('Retour de relais'))
                      const rowBg = isBlue ? '#dbeafe' : isRelaisTransit ? '#fef9c3' : p.present ? '#fff' : '#fff9e6'
                      const rowClass = isBlue ? 'row-blue' : isRelaisTransit ? 'row-yellow' : ''
                      return (
                        <tr key={i} className={rowClass} style={{ background: rowBg }}>
                          <td style={{ padding:'4px 10px', borderBottom:'1px solid #dde3f0', borderRight:'1px solid #dde3f0', fontWeight: isBlue ? 700 : 400, color: isBlue ? '#1a4b8f' : '#1c2333', minWidth:110 }}>
                            {JOURS_LABELS[d.getDay()]} {d.getDate()}
                            {fe && <span style={{ fontSize:9, marginLeft:5, color:'#1a4b8f', fontWeight:700 }}> férié</span>}
                          </td>
                          <td style={{ padding:'4px 10px', textAlign:'center', borderBottom:'1px solid #dde3f0', borderRight:'1px solid #dde3f0', minWidth:90 }}>
                            <div onClick={() => togglePresence(key)}
                              style={{ width:20, height:20, border:'1.5px solid #555', borderRadius:2, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', margin:'0 auto', fontSize:14, fontWeight:700, color:'#1c2333' }}>
                              {p.present ? 'x' : ''}
                            </div>
                          </td>
                          <td style={{ padding:'3px 8px', textAlign:'center', borderBottom:'1px solid #dde3f0', borderRight:'1px solid #dde3f0', minWidth:90 }}>
                            <input type="time" value={p.heure_depart || ''} onChange={e => setField(key, 'heure_depart', e.target.value)}
                              style={{ border:'none', background:'none', fontSize:11, fontFamily:'Sora,sans-serif', outline:'none', textAlign:'center', width:75 }} />
                          </td>
                          <td style={{ padding:'3px 8px', textAlign:'center', borderBottom:'1px solid #dde3f0', borderRight:'1px solid #dde3f0', minWidth:90 }}>
                            <input type="time" value={p.heure_arrivee || ''} onChange={e => setField(key, 'heure_arrivee', e.target.value)}
                              style={{ border:'none', background:'none', fontSize:11, fontFamily:'Sora,sans-serif', outline:'none', textAlign:'center', width:75 }} />
                          </td>
                          <td style={{ padding:'3px 8px', borderBottom:'1px solid #dde3f0', minWidth:200 }}>
                            <input type="text" value={p.motif || ''} onChange={e => setField(key, 'motif', e.target.value)}
                              placeholder={!p.present ? 'Motif absence...' : ''}
                              style={{ border:'none', background:'none', fontSize:11, fontFamily:'Sora,sans-serif', outline:'none', width:'100%', color: !p.present ? '#d97706' : '#1c2333' }} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* SIGNATURE */}
              <div style={{ padding:'12px 18px', borderTop:'1px solid #dde3f0', display:'flex', justifyContent:'space-between', alignItems:'flex-end', flexWrap:'wrap', gap:12 }}>
                <div>
                  <div style={{ fontSize:11, color:'#5a6478', marginBottom:5 }}>Date : ____________________</div>
                  <div style={{ fontSize:11, color:'#5a6478', marginBottom:8 }}>Signature de l'Assistant(e) familial(e)</div>
                  <div style={{ width:200, height:55, border:'1px solid #dde3f0', borderRadius:5, background:'#f8f9fb' }}></div>
                </div>
                <div style={{ textAlign:'center', fontSize:10, color:'#5a6478', border:'2px solid #1a4b8f', borderRadius:6, padding:'8px 16px', cursor:'pointer' }}>
                  <div style={{ fontWeight:700, fontSize:13 }}>Notice →</div>
                </div>
                <div style={{ textAlign:'right', fontSize:9, color:'#9aa3b8' }}>
                  <div>Document à transmettre au plus tard le dernier jour du mois</div>
                  <div style={{ fontWeight:600 }}>ase.gaillac-graulhet@tarn.fr</div>
                  <div>DÉPARTEMENT DU TARN – 81013 ALBI CEDEX 9</div>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
      {showPrint && selectedEnfant && (
        <FichePresencePrint
          enfant={selectedEnfant}
          profile={profile}
          mois={selectedMois}
          annee={selectedAnnee}
          presences={presences}
          moisComplet={moisComplet}
          onClose={() => setShowPrint(false)}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
