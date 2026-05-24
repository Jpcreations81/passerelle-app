// FichePresenceIntermittentPrint.js — v2026-05-22d — design fidèle original : logo SVG + titre bleu + cases arrondies
import React from 'react'

const JOURS_LABELS = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']
const MOIS_LABELS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const FERIES_2026 = ['2026-01-01','2026-04-06','2026-05-01','2026-05-08','2026-05-14','2026-05-25','2026-07-14','2026-08-15','2026-11-01','2026-11-11','2026-12-25']

function isFerie(date) {
  const y = date.getFullYear(), m = String(date.getMonth()+1).padStart(2,'0'), d = String(date.getDate()).padStart(2,'0')
  return FERIES_2026.includes(y+'-'+m+'-'+d)
}
function isDimanche(date) { return date.getDay() === 0 }
function fmt(date) {
  return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0')
}
function getDaysInMonth(year, month) {
  const days = [], d = new Date(year, month, 1)
  while (d.getMonth() === month) { days.push(new Date(d)); d.setDate(d.getDate() + 1) }
  return days
}

export default function FichePresenceIntermittentPrint({ enfant, profile, mois, annee, presences, onClose, afPrincipal }) {
  const days = getDaysInMonth(annee, mois)
  const nbJours = Object.values(presences).filter(p => p.present).length
  const nbFeries = days.filter(d => isFerie(d) && presences[fmt(d)]?.present).length

  const S = {
    cell: { border:'1px solid #333', padding:'2px 5px', fontSize:9 },
    th: { border:'1px solid #333', padding:'3px 5px', fontSize:9, fontWeight:'bold', background:'#f0f0f0' },
  }

  function imprimerDansNouvelleFenetre() {
    const contenu = document.getElementById('fiche-intermittente-print').innerHTML
    const fenetre = window.open('', '_blank', 'width=800,height=900')
    fenetre.document.write(`<!DOCTYPE html><html><head>
      <title>Fiche relais ${enfant.prenom} ${enfant.nom} — ${MOIS_LABELS[mois]} ${annee}</title>
      <style>
        * { -webkit-print-color-adjust:exact!important; print-color-adjust:exact!important; box-sizing:border-box; }
        body { font-family:Arial,sans-serif; font-size:9pt; margin:0; padding:8mm; }
        @page { size:A4 portrait; margin:8mm; }
        table { border-collapse:collapse; width:100%; }
        .row-bleu { background:#dbeafe!important; }
        .row-jaune { background:#fef9c3!important; }
      </style></head><body>${contenu}</body></html>`)
    fenetre.document.close()
    setTimeout(() => { fenetre.print(); fenetre.close() }, 500)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', zIndex:300, display:'flex', alignItems:'flex-start', justifyContent:'center', overflow:'auto', padding:'20px 0' }}>
      <div style={{ background:'#fff', width:720, maxWidth:'98vw', fontFamily:'Arial,sans-serif' }}>
        <div style={{ display:'flex', gap:8, padding:'10px 14px', background:'#1a4b8f', justifyContent:'flex-end' }}>
          <button onClick={imprimerDansNouvelleFenetre}
            style={{ padding:'7px 16px', background:'#fff', color:'#1a4b8f', border:'none', borderRadius:6, fontWeight:700, cursor:'pointer', fontSize:12 }}>🖨️ Imprimer / PDF</button>
          <button onClick={onClose}
            style={{ padding:'7px 16px', background:'rgba(255,255,255,.2)', color:'#fff', border:'1px solid rgba(255,255,255,.4)', borderRadius:6, cursor:'pointer', fontSize:12 }}>✕ Fermer</button>
        </div>

        <div id="fiche-intermittente-print" style={{ padding:'10px 14px', fontFamily:'Arial,sans-serif', fontSize:10 }}>

          {/* EN-TÊTE */}
          <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:8 }}>
            <tbody>
              <tr>
                <td style={{ width:70, verticalAlign:'middle', paddingRight:8 }}>
                  <svg width="60" height="55" viewBox="0 0 60 55" xmlns="http://www.w3.org/2000/svg">
                    <rect width="60" height="55" fill="#c8401a" rx="3"/>
                    <rect x="3" y="3" width="54" height="30" fill="#8b2500" rx="2"/>
                    <text x="30" y="22" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold" fontFamily="Arial">TARN</text>
                    <rect x="3" y="36" width="54" height="16" fill="#8b2500" rx="2"/>
                    <text x="30" y="47" textAnchor="middle" fill="white" fontSize="6" fontFamily="Arial">LE DÉPARTEMENT</text>
                  </svg>
                </td>
                <td style={{ textAlign:'center', verticalAlign:'middle' }}>
                  <div style={{ fontSize:16, fontWeight:900, textDecoration:'underline', color:'#1a3a8f', fontFamily:'Arial Black, Arial', letterSpacing:0.5 }}>FICHE DE PRÉSENCE {annee}</div>
                  <div style={{ fontSize:11, fontWeight:400, marginTop:4, fontStyle:'italic' }}>Mois concerné : {MOIS_LABELS[mois]} {annee}</div>
                </td>
                <td style={{ width:200, verticalAlign:'top' }}>
                  <div style={{ background:'#fef9e7', borderRadius:4, border:'1px solid #ccc', padding:'5px 8px' }}>
                    <div style={{ display:'flex', gap:16, marginBottom:4, fontSize:9 }}>
                      <span><span style={{ display:'inline-block', width:10, height:10, border:'1px solid #555', marginRight:4, verticalAlign:'middle' }}></span>Formation</span>
                      <span><span style={{ display:'inline-block', width:10, height:10, border:'1px solid #555', marginRight:4, verticalAlign:'middle' }}></span>Adaptation <em style={{ fontSize:8 }}>(Nbrs d'heures)</em></span>
                    </div>
                    <div style={{ fontSize:9 }}>
                      <span style={{ display:'inline-block', width:10, height:10, border:'1px solid #555', marginRight:4, verticalAlign:'middle', background:'#333', textAlign:'center', lineHeight:'10px', color:'#fff', fontSize:8 }}>✓</span>
                      <strong>Intermittent</strong>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* IDENTITÉ */}
          <div style={{ marginBottom:6, fontSize:10 }}>
            <div style={{ marginBottom:3 }}>Nom et prénom de l'enfant (obligatoire) : <span style={{ borderBottom:'1px solid #000', paddingBottom:1, paddingRight:100, fontWeight:700 }}>{enfant.prenom} {enfant.nom}</span></div>
            <div style={{ marginBottom:3 }}>Nom et Prénom de l'Assistant(e) familial(e) <strong>qui fait le Relais</strong> : <span style={{ borderBottom:'1px solid #000', paddingBottom:1, paddingRight:40, fontWeight:700 }}>{profile.prenom} {profile.nom}</span></div>
            <div style={{ marginBottom:3 }}>Nom et Prénom de l'Assistant(e) familial(e) <strong>Principal(e)</strong> : <span style={{ borderBottom:'1px solid #000', paddingBottom:1, paddingRight:50, fontWeight:700 }}>{afPrincipal?.prenom} {afPrincipal?.nom}</span></div>
            <div>Territoire : <strong>{enfant?.territoire || ''}</strong></div>
          </div>

          {/* COMPTEURS + ADMIN */}
          <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:6, fontSize:10 }}>
            <tbody>
              <tr>
                <td style={{ verticalAlign:'top', width:'50%', paddingRight:8 }}>
                  <div style={{ marginBottom:3 }}>Nombre de jours de présence et de fériés</div>
                  <table style={{ borderCollapse:'collapse', border:'1px solid #555' }}>
                    <tbody>
                      <tr>
                        <td style={{ border:'1px solid #555', padding:'3px 10px', fontSize:10 }}>
                          <div style={{ fontWeight:700 }}>NBRS/J</div>
                          <div style={{ fontSize:14, fontWeight:900 }}>{nbJours}</div>
                        </td>
                        <td style={{ border:'1px solid #555', padding:'3px 10px', fontSize:10 }}>
                          <div style={{ fontWeight:700 }}>NBRS/FERIES :</div>
                          <div style={{ fontSize:14, fontWeight:900 }}>{nbFeries}</div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
                <td style={{ verticalAlign:'top', border:'1px solid #555', padding:'5px 8px' }}>
                  <div style={{ fontWeight:700, fontSize:10, marginBottom:4 }}>Partie réservé à l'Administration</div>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:9 }}>
                    <tbody>
                      <tr>
                        <td style={{ paddingBottom:2 }}>Nbrs/J/Entretiens : <span style={{ borderBottom:'1px solid #555', paddingRight:20 }}></span></td>
                        <td style={{ paddingBottom:2 }}>Nbrs/J/Salaire : <span style={{ borderBottom:'1px solid #555', paddingRight:20 }}></span></td>
                      </tr>
                      <tr>
                        <td style={{ paddingBottom:2 }}>Féries : <span style={{ borderBottom:'1px solid #555', paddingRight:40 }}></span></td>
                        <td></td>
                      </tr>
                      <tr>
                        <td colSpan={2}>Date : <span style={{ borderBottom:'1px solid #555', paddingRight:60 }}></span></td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>

          {/* TABLEAU */}
          <table style={{ width:'100%', borderCollapse:'collapse', border:'1px solid #555' }}>
            <thead>
              <tr style={{ background:'#f0f0f0' }}>
                <th style={{ ...S.th, width:'22%', textAlign:'left' }}>Période</th>
                <th style={{ ...S.th, width:'11%', textAlign:'center' }}>Présence (x)</th>
                <th style={{ ...S.th, width:'13%', textAlign:'center' }}>Heure arrivée</th>
                <th style={{ ...S.th, width:'13%', textAlign:'center' }}>Heure départ</th>
                <th style={{ ...S.th, textAlign:'left' }}>Motif</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d, i) => {
                const key = fmt(d)
                const p = presences[key] || { present: false, heure_arrivee:'', heure_depart:'', motif:'' }
                const fe = isFerie(d), dim = isDimanche(d)
                const isRelaisJour = !!presences[key]
                const rowClass = isRelaisJour ? 'row-bleu' : (dim || fe) ? 'row-jaune' : ''
                const rowBg = isRelaisJour ? '#dbeafe' : (dim || fe) ? '#fef9c3' : '#fff'
                return (
                  <tr key={i} className={rowClass} style={{ background: rowBg }}>
                    <td style={{ ...S.cell, fontWeight: (dim||fe) ? 700 : 400 }}>
                      {JOURS_LABELS[d.getDay()]} {d.getDate()}
                      {fe && <span style={{ fontSize:8, marginLeft:3 }}>férié</span>}
                    </td>
                    <td style={{ ...S.cell, textAlign:'center', fontWeight:700 }}>{p.present ? 'x' : ''}</td>
                    <td style={{ ...S.cell, textAlign:'center' }}>{p.heure_arrivee || ''}</td>
                    <td style={{ ...S.cell, textAlign:'center' }}>{p.heure_depart || ''}</td>
                    <td style={{ ...S.cell }}>{p.motif || ''}</td>
                  </tr>
                )
              })}
              <tr><td colSpan={5} style={{ border:'1px solid #555', height:8 }}></td></tr>
            </tbody>
          </table>

          {/* SIGNATURE */}
          <table style={{ width:'100%', marginTop:8, borderCollapse:'collapse' }}>
            <tbody>
              <tr>
                <td style={{ verticalAlign:'bottom', width:'40%' }}>
                  <div style={{ fontSize:9, marginBottom:2 }}>Date : <span style={{ borderBottom:'1px solid #000', paddingRight:80 }}></span></div>
                  <div style={{ fontSize:9, marginBottom:4 }}>Signature de l'Assistant(e) familial(e)</div>
                  <div style={{ border:'1px solid #555', width:160, height:40 }}></div>
                </td>
                <td style={{ textAlign:'center', verticalAlign:'middle' }}>
                  <div style={{ border:'2px solid #333', borderRadius:3, padding:'5px 14px', display:'inline-block' }}>
                    <span style={{ fontWeight:700, fontSize:11 }}>Notice →</span>
                  </div>
                </td>
                <td style={{ textAlign:'right', verticalAlign:'bottom', fontSize:7, color:'#555' }}>
                  <div>Document à transmettre au plus tard le dernier jour du mois à l'ASE</div>
                  <div style={{ fontWeight:700 }}>ase.gaillac-graulhet@tarn.fr</div>
                  <div>DÉPARTEMENT DU TARN – 81013 ALBI CEDEX 9</div>
                </td>
              </tr>
            </tbody>
          </table>

        </div>
      </div>
    </div>
  )
}
