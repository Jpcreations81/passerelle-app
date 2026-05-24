// FichePresenceIntermittentPrint.js — v2026-05-22b — design fidèle au document officiel Tarn (relais)
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

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', zIndex:300, display:'flex', alignItems:'flex-start', justifyContent:'center', overflow:'auto', padding:'20px 0' }}>
      <div style={{ background:'#fff', width:720, maxWidth:'98vw', fontFamily:'Arial,sans-serif' }}>

        {/* Boutons hors impression */}
        <div style={{ display:'flex', gap:8, padding:'10px 14px', background:'#1a4b8f', justifyContent:'flex-end' }} className="no-print">
          <button onClick={() => {
            const oldTitle = document.title
            document.title = `Fiche relais ${enfant.prenom} ${enfant.nom} — ${MOIS_LABELS[mois]} ${annee}`
            window.print()
            document.title = oldTitle
          }} style={{ padding:'7px 16px', background:'#fff', color:'#1a4b8f', border:'none', borderRadius:6, fontWeight:700, cursor:'pointer', fontSize:12 }}>🖨️ Imprimer / PDF</button>
          <button onClick={onClose} style={{ padding:'7px 16px', background:'rgba(255,255,255,.2)', color:'#fff', border:'1px solid rgba(255,255,255,.4)', borderRadius:6, cursor:'pointer', fontSize:12 }}>✕ Fermer</button>
        </div>

        <style>{`
          @media print {
            .no-print { display:none!important; }
            body * { visibility:hidden; }
            .fiche-to-print, .fiche-to-print * { visibility:visible; }
            .fiche-to-print { position:fixed; left:0; top:0; width:100%; }
            @page { size:A4 portrait; margin:8mm; }
            * { -webkit-print-color-adjust:exact!important; print-color-adjust:exact!important; }
            .row-bleu { background:#dbeafe!important; }
            .row-jaune { background:#fef9c3!important; }
          }
        `}</style>

        <div className="fiche-to-print" style={{ padding:'10px 14px', fontFamily:'Arial,sans-serif', fontSize:10 }}>

          {/* EN-TÊTE */}
          <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:6 }}>
            <tbody>
              <tr>
                <td style={{ width:80, verticalAlign:'middle', paddingRight:10 }}>
                  <div style={{ background:'#e8001c', color:'#fff', fontWeight:900, fontSize:11, padding:'4px 6px', textAlign:'center', lineHeight:1.2 }}>
                    TARN<br/><span style={{ fontSize:7, fontWeight:400 }}>LE DÉPARTEMENT</span>
                  </div>
                </td>
                <td style={{ textAlign:'center', verticalAlign:'middle' }}>
                  <div style={{ fontSize:15, fontWeight:900, textDecoration:'underline', color:'#000', letterSpacing:1 }}>FICHE DE PRÉSENCE {annee}</div>
                  <div style={{ fontSize:11, fontWeight:700, marginTop:3 }}>Mois concerné : {MOIS_LABELS[mois]} {annee}</div>
                </td>
                <td style={{ width:180, verticalAlign:'top' }}>
                  <table style={{ borderCollapse:'collapse', border:'1px solid #999', width:'100%', background:'#fef9e7' }}>
                    <tbody>
                      <tr>
                        <td style={{ padding:'3px 8px', fontSize:9, borderBottom:'1px solid #999' }}>
                          <span style={{ display:'inline-block', width:10, height:10, border:'1px solid #555', marginRight:5, verticalAlign:'middle' }}></span>
                          Formation
                        </td>
                        <td style={{ padding:'3px 8px', fontSize:9, borderBottom:'1px solid #999' }}>
                          <span style={{ display:'inline-block', width:10, height:10, border:'1px solid #555', marginRight:5, verticalAlign:'middle' }}></span>
                          Adaptation <span style={{ fontSize:8 }}>(Nbrs d'heures)</span>
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={2} style={{ padding:'3px 8px', fontSize:9 }}>
                          <span style={{ display:'inline-block', width:10, height:10, border:'1px solid #555', marginRight:5, verticalAlign:'middle', background:'#333', textAlign:'center', lineHeight:'10px', color:'#fff', fontSize:8 }}>✓</span>
                          <strong>Intermittent</strong>
                        </td>
                      </tr>
                    </tbody>
                  </table>
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
