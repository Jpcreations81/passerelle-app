import React from 'react'

const JOURS_LABELS = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']
const MOIS_LABELS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const FERIES_2026 = ['2026-01-01','2026-04-06','2026-05-01','2026-05-08','2026-05-14','2026-05-25','2026-07-14','2026-08-15','2026-11-01','2026-11-11','2026-12-25']

function isFerie(date) { return FERIES_2026.includes(date.toISOString().slice(0,10)) }
function isDimanche(date) { return date.getDay() === 0 }
function getDaysInMonth(year, month) {
  const days = []
  const d = new Date(year, month, 1)
  while (d.getMonth() === month) { days.push(new Date(d)); d.setDate(d.getDate() + 1) }
  return days
}

export default function FichePresencePrint({ enfant, profile, mois, annee, presences, moisComplet, onClose }) {
  const days = getDaysInMonth(annee, mois)
  const nbJours = Object.values(presences).filter(p => p.present).length
  const nbFeries = days.filter(d => isFerie(d) && presences[d.toISOString().slice(0,10)]?.present).length

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', zIndex:300, display:'flex', alignItems:'flex-start', justifyContent:'center', overflow:'auto', padding:'20px 0' }}>
      <div style={{ background:'#fff', width:700, maxWidth:'98vw', fontFamily:'Arial,sans-serif', fontSize:11 }}>

        {/* Boutons hors impression */}
        <div style={{ display:'flex', gap:8, padding:'10px 14px', background:'#1a4b8f', justifyContent:'flex-end' }} className="no-print">
          <button onClick={() => window.print()} style={{ padding:'7px 16px', background:'#fff', color:'#1a4b8f', border:'none', borderRadius:6, fontWeight:700, cursor:'pointer', fontSize:12 }}>🖨️ Imprimer / PDF</button>
          <button onClick={onClose} style={{ padding:'7px 16px', background:'rgba(255,255,255,.2)', color:'#fff', border:'1px solid rgba(255,255,255,.4)', borderRadius:6, cursor:'pointer', fontSize:12 }}>✕ Fermer</button>
        </div>

        <style>{`
          @media print {
            .no-print { display:none!important; }
            body * { visibility:hidden; }
            .fiche-to-print, .fiche-to-print * { visibility:visible; }
            .fiche-to-print { position:fixed; left:0; top:0; width:100%; }
            @page { size:A4 portrait; margin:8mm; }
          }
        `}</style>

        <div className="fiche-to-print" style={{ padding:'12px 16px' }}>

          {/* EN-TÊTE */}
          <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:8 }}>
            <tbody>
              <tr>
                <td style={{ width:120, verticalAlign:'top' }}>
                  <div style={{ border:'2px solid #1a4b8f', padding:'6px 10px', textAlign:'center', display:'inline-block' }}>
                    <div style={{ fontSize:16, fontWeight:900, color:'#1a4b8f', letterSpacing:2 }}>TARN</div>
                    <div style={{ fontSize:8, color:'#1a4b8f' }}>LE DÉPARTEMENT</div>
                  </div>
                </td>
                <td style={{ textAlign:'center', verticalAlign:'middle' }}>
                  <div style={{ fontSize:16, fontWeight:900, textDecoration:'underline', color:'#1a4b8f' }}>FICHE DE PRÉSENCE {annee}</div>
                  <div style={{ fontSize:12, fontWeight:700, marginTop:4 }}>Mois concerné : {MOIS_LABELS[mois]} {annee}</div>
                </td>
                <td style={{ width:150, verticalAlign:'top' }}>
                  <table style={{ borderCollapse:'collapse', border:'1px solid #333', width:'100%' }}>
                    <tbody>
                      <tr>
                        <td style={{ padding:'4px 8px', borderBottom:'1px solid #333', fontSize:10 }}>
                          <span style={{ display:'inline-block', width:12, height:12, border:'1px solid #333', marginRight:6, verticalAlign:'middle', background: moisComplet ? '#333' : '#fff', textAlign:'center', lineHeight:'12px', color:'#fff', fontSize:9 }}>{moisComplet ? '✓' : ''}</span>
                          Temps complet
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding:'4px 8px', fontSize:10 }}>
                          <span style={{ display:'inline-block', width:12, height:12, border:'1px solid #333', marginRight:6, verticalAlign:'middle' }}></span>
                          Continu week-end
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>

          {/* IDENTITÉ */}
          <div style={{ marginBottom:6 }}>
            <div style={{ fontSize:11, marginBottom:4 }}>
              Nom et prénom de l'enfant (obligatoire) : <span style={{ borderBottom:'1px solid #000', paddingBottom:1, paddingRight:80 }}><strong>{enfant.prenom} {enfant.nom}</strong></span>
            </div>
            <div style={{ fontSize:11, marginBottom:4 }}>
              Nom et Prénom de l'Assistant(e) familial(e) : <span style={{ borderBottom:'1px solid #000', paddingBottom:1, paddingRight:40 }}><strong>{profile.prenom} {profile.nom}</strong></span>
            </div>
            <div style={{ fontSize:11 }}>
              Territoire : <strong>MD Gaillac – Graulhet</strong>
            </div>
          </div>

          {/* COMPTEURS */}
          <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:8 }}>
            <tbody>
              <tr>
                <td style={{ verticalAlign:'top', width:'55%' }}>
                  <div style={{ fontSize:10, marginBottom:4 }}>Nombre de jours de présence et de fériés</div>
                  <table style={{ borderCollapse:'collapse', border:'1px solid #333' }}>
                    <tbody>
                      <tr>
                        <td style={{ border:'1px solid #333', padding:'3px 12px', fontWeight:700, fontSize:10 }}>NBRS/J : <strong style={{ fontSize:14 }}>{nbJours}</strong></td>
                        <td style={{ border:'1px solid #333', padding:'3px 12px', fontWeight:700, fontSize:10 }}>NBRS/FERIES : <strong style={{ fontSize:14 }}>{nbFeries}</strong></td>
                      </tr>
                    </tbody>
                  </table>
                </td>
                <td style={{ verticalAlign:'top', paddingLeft:16 }}>
                  <table style={{ borderCollapse:'collapse', border:'1px solid #333', width:'100%' }}>
                    <tbody>
                      <tr><td style={{ border:'1px solid #333', padding:'3px 8px', fontWeight:700, fontSize:10, background:'#f0f0f0' }} colSpan={2}>Partie réservée à l'Administration</td></tr>
                      <tr><td style={{ border:'1px solid #333', padding:'3px 8px', fontSize:10 }}>Nbrs/Jours :</td><td style={{ border:'1px solid #333', padding:'3px 8px', width:80 }}></td></tr>
                      <tr><td style={{ border:'1px solid #333', padding:'3px 8px', fontSize:10 }}>Nbrs/Jours Fériés :</td><td style={{ border:'1px solid #333', padding:'3px 8px' }}></td></tr>
                      <tr><td style={{ border:'1px solid #333', padding:'3px 8px', fontSize:10 }}>Date :</td><td style={{ border:'1px solid #333', padding:'3px 8px' }}></td></tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>

          {/* TABLEAU DES JOURS */}
          <table style={{ width:'100%', borderCollapse:'collapse', border:'1px solid #333' }}>
            <thead>
              <tr style={{ background:'#e8e8e8' }}>
                <th style={{ border:'1px solid #333', padding:'5px 8px', textAlign:'left', width:'22%', fontSize:10 }}>Période</th>
                <th style={{ border:'1px solid #333', padding:'5px 8px', textAlign:'center', width:'13%', fontSize:10 }}>Présence (x)</th>
                <th style={{ border:'1px solid #333', padding:'5px 8px', textAlign:'center', width:'13%', fontSize:10 }}>Heure départ</th>
                <th style={{ border:'1px solid #333', padding:'5px 8px', textAlign:'center', width:'13%', fontSize:10 }}>Heure arrivée</th>
                <th style={{ border:'1px solid #333', padding:'5px 8px', textAlign:'left', fontSize:10 }}>Motif absence</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d, i) => {
                const key = d.toISOString().slice(0,10)
                const p = presences[key] || { present: true, heure_depart:'', heure_arrivee:'', motif:'' }
                const fe = isFerie(d)
                const dim = isDimanche(d)
                const isBlue = dim || fe
                const isRelaisTransit = p.motif && (p.motif.startsWith('Départ en relais') || p.motif.startsWith('Retour de relais'))
                const rowBg = isBlue ? '#dbeafe' : isRelaisTransit ? '#fef9c3' : '#fff'
                return (
                  <tr key={i} style={{ background: rowBg }}>
                    <td style={{ border:'1px solid #ccc', padding:'3px 8px', fontWeight: isBlue ? 700 : 400, fontSize:10, color: isBlue ? '#1a4b8f' : '#000' }}>
                      {JOURS_LABELS[d.getDay()]} {d.getDate()}
                      {fe && <span style={{ fontSize:8, marginLeft:4, fontWeight:700 }}>férié</span>}
                    </td>
                    <td style={{ border:'1px solid #ccc', padding:'3px 8px', textAlign:'center', fontSize:11, fontWeight:700 }}>
                      {p.present ? 'x' : ''}
                    </td>
                    <td style={{ border:'1px solid #ccc', padding:'3px 8px', textAlign:'center', fontSize:10 }}>
                      {p.heure_depart || ''}
                    </td>
                    <td style={{ border:'1px solid #ccc', padding:'3px 8px', textAlign:'center', fontSize:10 }}>
                      {p.heure_arrivee || ''}
                    </td>
                    <td style={{ border:'1px solid #ccc', padding:'3px 8px', fontSize:10, color: !p.present ? '#b45309' : '#000' }}>
                      {p.motif || ''}
                    </td>
                  </tr>
                )
              })}
              {/* Ligne vide finale */}
              <tr>
                <td style={{ border:'1px solid #ccc', padding:'8px' }}></td>
                <td style={{ border:'1px solid #ccc' }}></td>
                <td style={{ border:'1px solid #ccc' }}></td>
                <td style={{ border:'1px solid #ccc' }}></td>
                <td style={{ border:'1px solid #ccc' }}></td>
              </tr>
            </tbody>
          </table>

          {/* SIGNATURE */}
          <table style={{ width:'100%', marginTop:10, borderCollapse:'collapse' }}>
            <tbody>
              <tr>
                <td style={{ verticalAlign:'bottom', width:'40%' }}>
                  <div style={{ fontSize:10, marginBottom:4 }}>Date : ______________________</div>
                  <div style={{ fontSize:10, marginBottom:6 }}>Signature de l'Assistant(e) familial(e)</div>
                  <div style={{ border:'1px solid #333', width:180, height:50 }}></div>
                </td>
                <td style={{ textAlign:'center', verticalAlign:'middle' }}>
                  <div style={{ border:'2px solid #1a4b8f', borderRadius:4, padding:'8px 16px', display:'inline-block', cursor:'pointer' }}>
                    <span style={{ fontWeight:700, fontSize:12, color:'#1a4b8f' }}>Notice →</span>
                  </div>
                </td>
                <td style={{ textAlign:'right', verticalAlign:'bottom', fontSize:8, color:'#666' }}>
                  <div>Document à transmettre au plus tard le dernier jour du mois à l'ASE</div>
                  <div style={{ fontWeight:700, color:'#1a4b8f' }}>ase.gaillac-graulhet@tarn.fr</div>
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
