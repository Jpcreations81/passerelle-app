// FichePresencePermanentPrint.js — v2026-05-22d — design fidèle original : logo SVG + titre bleu + cases arrondies
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

const TARN_LOGO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAACXBIWXMAAAsTAAALEwEAmpwYAAAF8WlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgNi4wLWMwMDIgNzkuMTY0MzUyLCAyMDIwLzAxLzMwLTE1OjUwOjM4ICAgICAgICAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtbG5zOnhtcE1NPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvbW0vIiB4bWxuczpzdEV2dD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL3NUeXBlL1Jlc291cmNlRXZlbnQjIiB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iIHhtbG5zOnBob3Rvc2hvcD0iaHR0cDovL25zLmFkb2JlLmNvbS9waG90b3Nob3AvMS4wLyIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgMjEuMSAoV2luZG93cykiIHhtcDpDcmVhdGVEYXRlPSIyMDIwLTA1LTI4VDE0OjMzOjUyKzAyOjAwIiB4bXA6TWV0YWRhdGFEYXRlPSIyMDIwLTA1LTI4VDE0OjMzOjUyKzAyOjAwIiB4bXA6TW9kaWZ5RGF0ZT0iMjAyMC0wNS0yOFQxNDozMzo1MiswMjowMCIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDo4YzllZTgxZC1lZWI2LTQyNDgtYTM0Yi03ZWUzMTYyMjE4ZGQiIHhtcE1NOkRvY3VtZW50SUQ9ImFkb2JlOmRvY2lkOnBob3Rvc2hvcDpmMGI1OGNjNS0yMmYxLTliNDYtYTVjOC1kMGExNzRiNmIxZDciIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDoyZjNhNThhOS01ZjM5LThlNDUtODJmOC0yNmRjNDhkNmNmYjciIGRjOmZvcm1hdD0iaW1hZ2UvcG5nIiBwaG90b3Nob3A6Q29sb3JNb2RlPSIzIj4gPHhtcE1NOkhpc3Rvcnk+IDxyZGY6U2VxPiA8cmRmOmxpIHN0RXZ0OmFjdGlvbj0iY3JlYXRlZCIgc3RFdnQ6aW5zdGFuY2VJRD0ieG1wLmlpZDoyZjNhNThhOS01ZjM5LThlNDUtODJmOC0yNmRjNDhkNmNmYjciIHN0RXZ0OndoZW49IjIwMjAtMDUtMjhUMTQ6MzM6NTIrMDI6MDAiIHN0RXZ0OnNvZnR3YXJlQWdlbnQ9IkFkb2JlIFBob3Rvc2hvcCAyMS4xIChXaW5kb3dzKSIvPiA8cmRmOmxpIHN0RXZ0OmFjdGlvbj0ic2F2ZWQiIHN0RXZ0Omluc3RhbmNlSUQ9InhtcC5paWQ6OGM5ZWU4MWQtZWViNi00MjQ4LWEzNGItN2VlMzE2MjIxOGRkIiBzdEV2dDp3aGVuPSIyMDIwLTA1LTI4VDE0OjMzOjUyKzAyOjAwIiBzdEV2dDpzb2Z0d2FyZUFnZW50PSJBZG9iZSBQaG90b3Nob3AgMjEuMSAoV2luZG93cykiIHN0RXZ0OmNoYW5nZWQ9Ii8iLz4gPC9yZGY6U2VxPiA8L3htcE1NOkhpc3Rvcnk+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5kPSJyIj8+AUMzygAAA4tJREFUaN7tmU1oE0EUx/+zk2w2adJGo1YUxINQBEFEPHgQQRAPKoiIiAcRQREPIiIiHkQEERHxICIiHkREREREPHgQwYMHD6IHDyIiIiIiIh5EREREPHgQEQ8eRERERERERERERBEREREREREREREREREREREREREREREREREREREREREREREREREREdF/rPUHy+f7+fMFwAAAAAASUVORK5CYII="

export default function FichePresencePermanentPrint({ enfant, profile, mois, annee, presences, moisComplet, onClose }) {
  const days = getDaysInMonth(annee, mois)
  const nbJours = Object.values(presences).filter(p => p.present).length
  const nbFeries = days.filter(d => isFerie(d) && presences[fmt(d)]?.present).length

  const S = {
    cell: { border:'1px solid #333', padding:'2px 5px', fontSize:9 },
    th: { border:'1px solid #333', padding:'3px 5px', fontSize:9, fontWeight:'bold', background:'#f0f0f0' },
  }

  function imprimerDansNouvelleFenetre() {
    const contenu = document.getElementById('fiche-permanente-print').innerHTML
    const fenetre = window.open('', '_blank', 'width=800,height=900')
    fenetre.document.write(`
      <!DOCTYPE html><html><head>
      <title>Fiche présence ${enfant.prenom} ${enfant.nom} — ${MOIS_LABELS[mois]} ${annee}</title>
      <style>
        * { -webkit-print-color-adjust:exact!important; print-color-adjust:exact!important; box-sizing:border-box; }
        body { font-family:Arial,sans-serif; font-size:9pt; margin:0; padding:8mm; }
        @page { size:A4 portrait; margin:8mm; }
        table { border-collapse:collapse; width:100%; }
        .row-jaune { background:#fef9c3!important; }
        .row-bleu { background:#dbeafe!important; }
        @media print { @page { size:A4 portrait; margin:8mm; } }
      </style></head><body>${contenu}</body></html>
    `)
    fenetre.document.close()
    setTimeout(() => { fenetre.print(); fenetre.close() }, 500)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', zIndex:300, display:'flex', alignItems:'flex-start', justifyContent:'center', overflow:'auto', padding:'20px 0' }}>
      <div style={{ background:'#fff', width:720, maxWidth:'98vw', fontFamily:'Arial,sans-serif' }}>

        {/* Boutons hors impression */}
        <div style={{ display:'flex', gap:8, padding:'10px 14px', background:'#1a4b8f', justifyContent:'flex-end' }}>
          <button onClick={imprimerDansNouvelleFenetre}
            style={{ padding:'7px 16px', background:'#fff', color:'#1a4b8f', border:'none', borderRadius:6, fontWeight:700, cursor:'pointer', fontSize:12 }}>🖨️ Imprimer / PDF</button>
          <button onClick={onClose}
            style={{ padding:'7px 16px', background:'rgba(255,255,255,.2)', color:'#fff', border:'1px solid rgba(255,255,255,.4)', borderRadius:6, cursor:'pointer', fontSize:12 }}>✕ Fermer</button>
        </div>

        <div id="fiche-permanente-print" style={{ padding:'10px 14px', fontFamily:'Arial,sans-serif', fontSize:10 }}>

          {/* EN-TÊTE */}
          <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:8 }}>
            <tbody>
              <tr>
                <td style={{ width:70, verticalAlign:'middle', paddingRight:8 }}>
                  {/* Logo Tarn SVG fidèle */}
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
                <td style={{ width:170, verticalAlign:'top' }}>
                  <div style={{ background:'#c8dff5', borderRadius:8, border:'1.5px solid #7ba8d0', padding:'6px 10px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6, fontSize:10 }}>
                      <span style={{ display:'inline-block', width:12, height:12, border:'1.5px solid #333', background: moisComplet ? '#333' : '#fff', flexShrink:0 }}>{moisComplet ? '✓' : ''}</span>
                      <span style={{ fontWeight:600 }}>Temps complet</span>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:10 }}>
                      <span style={{ display:'inline-block', width:12, height:12, border:'1.5px solid #333', background:'#fff', flexShrink:0 }}></span>
                      <span>Continu week-end</span>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* IDENTITÉ */}
          <div style={{ marginBottom:8, fontSize:10, borderBottom:'1px solid #ccc', paddingBottom:6 }}>
            <div style={{ marginBottom:4 }}>Nom et prénom de l'enfant (obligatoire) : <span style={{ borderBottom:'1px solid #000', display:'inline-block', minWidth:280, fontWeight:700 }}>{enfant.prenom} {enfant.nom}</span></div>
            <div style={{ marginBottom:4 }}>Nom et Prénom de l'Assistant(e) familial(e) : <span style={{ borderBottom:'1px solid #000', display:'inline-block', minWidth:260, fontWeight:700 }}>{profile.prenom} {profile.nom}</span></div>
            <div>Territoire : <strong>{enfant?.territoire || ''}</strong></div>
          </div>

          {/* COMPTEURS + ADMIN sur la même ligne */}
          <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:6, fontSize:10 }}>
            <tbody>
              <tr>
                <td style={{ verticalAlign:'top', paddingRight:8 }}>
                  <div style={{ marginBottom:4 }}>Nombre de jours de présence et de fériés</div>
                  <div style={{ display:'flex', gap:0, marginBottom:6 }}>
                    <div style={{ border:'1.5px solid #1a3a8f', padding:'3px 12px', fontSize:10 }}>
                      <div style={{ fontWeight:700, color:'#1a3a8f' }}>NBRS/J :</div>
                      <div style={{ fontSize:16, fontWeight:900, color:'#1a3a8f' }}>{nbJours}</div>
                    </div>
                    <div style={{ border:'1.5px solid #1a3a8f', borderLeft:'none', padding:'3px 12px', fontSize:10 }}>
                      <div style={{ fontWeight:700, color:'#1a3a8f' }}>NBRS/FERIES :</div>
                      <div style={{ fontSize:16, fontWeight:900, color:'#1a3a8f' }}>{nbFeries}</div>
                    </div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:10 }}>
                    <span style={{ display:'inline-block', width:12, height:12, border:'1.5px solid #333', background: moisComplet ? '#333' : '#fff', flexShrink:0 }}>{moisComplet ? '✓' : ''}</span>
                    <strong>Mois complet</strong>
                  </div>
                </td>
                <td style={{ verticalAlign:'top', border:'1px solid #aaa', padding:'5px 8px', background:'#f5f5f5', width:'42%' }}>
                  <div style={{ fontWeight:700, fontSize:10, marginBottom:4, textAlign:'center' }}>Partie réservé à l'Administration</div>
                  <div style={{ display:'flex', gap:20, fontSize:9, marginBottom:3 }}>
                    <span>Nbrs/Jours : <span style={{ borderBottom:'1px solid #555', paddingRight:35 }}></span></span>
                    <span>Nbrs/Jours Fériés : <span style={{ borderBottom:'1px solid #555', paddingRight:20 }}></span></span>
                  </div>
                  <div style={{ fontSize:9 }}>Date : <span style={{ borderBottom:'1px solid #555', paddingRight:60 }}></span></div>
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
                <th style={{ ...S.th, width:'13%', textAlign:'center' }}>Heure départ</th>
                <th style={{ ...S.th, width:'13%', textAlign:'center' }}>Heure arrivée</th>
                <th style={{ ...S.th, textAlign:'left' }}>Motif absence</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d, i) => {
                const key = fmt(d)
                const p = presences[key] || { present: true, heure_depart:'', heure_arrivee:'', motif:'' }
                const fe = isFerie(d), dim = isDimanche(d)
                const isRelais = p.motif && (p.motif.includes('relais') || p.motif.includes('Relais') || p.motif === 'Retour')
                const rowClass = isRelais ? 'row-jaune' : (dim || fe) ? 'row-bleu' : ''
                const rowBg = isRelais ? '#fef9c3' : (dim || fe) ? '#dbeafe' : '#fff'
                return (
                  <tr key={i} className={rowClass} style={{ background: rowBg }}>
                    <td style={{ ...S.cell, fontWeight: (dim||fe) ? 700 : 400 }}>
                      {JOURS_LABELS[d.getDay()]} {d.getDate()}
                      {fe && <span style={{ fontSize:8, marginLeft:3 }}>férié</span>}
                    </td>
                    <td style={{ ...S.cell, textAlign:'center', fontWeight:700 }}>{p.present ? 'x' : ''}</td>
                    <td style={{ ...S.cell, textAlign:'center' }}>{p.heure_depart || ''}</td>
                    <td style={{ ...S.cell, textAlign:'center' }}>{p.heure_arrivee || ''}</td>
                    <td style={{ ...S.cell, maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.motif || ''}</td>
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
                  <div style={{ border:'2px solid #333', borderRadius:3, padding:'5px 14px', display:'inline-block', cursor:'pointer' }}>
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
