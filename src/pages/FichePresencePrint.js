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
                <td style={{ width:80, verticalAlign:'top' }}>
                  <img src="data:image/jpeg;base64,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" alt="Tarn" style={{ width:70, height:'auto' }} />
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
                const isRelaisTransit = p.motif && (p.motif.startsWith('Départ en relais') || p.motif.startsWith('Retour de relais') || p.motif.startsWith('Relais —'))
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
