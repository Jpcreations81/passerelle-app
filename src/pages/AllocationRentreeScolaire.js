// AllocationRentreeScolaire.js — v2026-07-21d — secteur au lieu de territoire
import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

export default function AllocationRentreeScolaire({ profile, onClose }) {
  const [enfants, setEnfants] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [toast, setToast] = useState('')

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => { fetchEnfants() }, [])

  async function fetchEnfants() {
    const { data } = await supabase
      .from('enfants')
      .select('id, prenom, nom, ecole_nom, ecole_classe, ecole_adresse, type_placement')
      .eq('af_principal_id', profile.id)
      .not('type_placement', 'eq', 'non_place')
    if (data) {
      // Filtrer les enfants scolarisés (qui ont une école ou une classe)
      setEnfants(data.map(e => ({
        ...e,
        inclus: !!(e.ecole_nom || e.ecole_classe),
        classe: e.ecole_classe || '',
        ecole: e.ecole_nom || '',
        lieu: e.ecole_adresse || '',
      })))
    }
    setLoading(false)
  }

  function updateEnfant(id, field, val) {
    setEnfants(prev => prev.map(e => e.id === id ? { ...e, [field]: val } : e))
  }

  async function generatePDF() {
    const enfantsInclus = enfants.filter(e => e.inclus)
    if (enfantsInclus.length === 0) {
      showToast('⚠️ Aucun enfant sélectionné')
      return
    }

    setGenerating(true)
    try {
      const pdfDoc = await PDFDocument.create()
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
      const fontB = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

      const page = pdfDoc.addPage([842, 595]) // A4 paysage
      const { width, height } = page.getSize() // width=842, height=595
      const M = 50 // marge

      // Titre principal
      page.drawText('SCOLARITE 2026/2027 DES ENFANTS CONFIES', {
        x: M, y: height - 50,
        size: 18, font: fontB,
        color: rgb(0, 0, 0)
      })

      // Ligne décorative
      page.drawLine({
        start: { x: M, y: height - 68 },
        end: { x: width - M, y: height - 68 },
        thickness: 1.5, color: rgb(0, 0, 0)
      })

      // Nom AF
      page.drawText("Nom de l'Assistant(e) Familial(e) :", {
        x: M, y: height - 100,
        size: 10, font: fontB, color: rgb(0, 0, 0)
      })
      page.drawText(`${profile.nom} ${profile.prenom}`, {
        x: M + 175, y: height - 100,
        size: 10, font, color: rgb(0, 0, 0)
      })
      page.drawLine({
        start: { x: M + 175, y: height - 102 },
        end: { x: width - M, y: height - 102 },
        thickness: 0.5, color: rgb(0, 0, 0)
      })

      // Territoire
      page.drawText('Territoire Concerne :', {
        x: M, y: height - 120,
        size: 10, font: fontB, color: rgb(0, 0, 0)
      })
      page.drawText(profile.secteur || profile.territoire || '', {
        x: M + 130, y: height - 120,
        size: 10, font, color: rgb(0, 0, 0)
      })
      page.drawLine({
        start: { x: M + 130, y: height - 122 },
        end: { x: width - M, y: height - 122 },
        thickness: 0.5, color: rgb(0, 0, 0)
      })

      // Tableau
      const tableTop = height - 155
      const colWidths = [220, 100, 380]
      const colX = [M, M + 220, M + 220 + 100]
      const rowH = 28
      const headers = ["NOM - PRENOM DE L'ENFANT", 'CLASSE', 'NOM ETABLISSEMENT SCOLAIRE - LIEU']

      // En-tête tableau
      let bgGray = rgb(0.85, 0.85, 0.85)
      page.drawRectangle({
        x: M, y: tableTop - rowH,
        width: colWidths[0] + colWidths[1] + colWidths[2],
        height: rowH,
        color: bgGray
      })

      headers.forEach((h, i) => {
        page.drawText(h, {
          x: colX[i] + 4, y: tableTop - rowH + 8,
          size: 8, font: fontB, color: rgb(0, 0, 0),
          maxWidth: colWidths[i] - 8
        })
        // Bordure verticale
        if (i > 0) {
          page.drawLine({
            start: { x: colX[i], y: tableTop },
            end: { x: colX[i], y: tableTop - rowH },
            thickness: 0.5, color: rgb(0, 0, 0)
          })
        }
      })

      // Bordure en-tête
      page.drawRectangle({
        x: M, y: tableTop - rowH,
        width: colWidths[0] + colWidths[1] + colWidths[2],
        height: rowH,
        borderColor: rgb(0, 0, 0), borderWidth: 1,
        color: bgGray
      })

      // Lignes enfants (8 lignes minimum)
      const nbLignes = Math.max(enfantsInclus.length, 8)
      for (let i = 0; i < nbLignes; i++) {
        const y = tableTop - rowH - (i + 1) * rowH
        const enf = enfantsInclus[i]

        // Fond blanc
        page.drawRectangle({
          x: M, y,
          width: colWidths[0] + colWidths[1] + colWidths[2],
          height: rowH,
          color: rgb(1, 1, 1),
          borderColor: rgb(0.7, 0.7, 0.7),
          borderWidth: 0.5
        })

        // Séparateurs colonnes
        page.drawLine({
          start: { x: colX[1], y },
          end: { x: colX[1], y: y + rowH },
          thickness: 0.5, color: rgb(0.5, 0.5, 0.5)
        })
        page.drawLine({
          start: { x: colX[2], y },
          end: { x: colX[2], y: y + rowH },
          thickness: 0.5, color: rgb(0.5, 0.5, 0.5)
        })

        if (enf) {
          page.drawText(`${enf.nom} ${enf.prenom}`, {
            x: colX[0] + 4, y: y + 8,
            size: 9, font, color: rgb(0, 0, 0)
          })
          page.drawText(enf.classe || '', {
            x: colX[1] + 4, y: y + 8,
            size: 9, font, color: rgb(0, 0, 0)
          })
          page.drawText(`${enf.ecole || ''}${enf.lieu ? ' - ' + enf.lieu : ''}`, {
            x: colX[2] + 4, y: y + 8,
            size: 9, font, color: rgb(0, 0, 0),
            maxWidth: colWidths[2] - 8
          })
        }
      }

      // Bordure extérieure tableau (juste les lignes, pas de fond)
      const tableH = rowH + nbLignes * rowH
      const totalWidth = colWidths[0] + colWidths[1] + colWidths[2]
      // Bord gauche
      page.drawLine({ start:{x:M, y:tableTop}, end:{x:M, y:tableTop-tableH}, thickness:1, color:rgb(0,0,0) })
      // Bord droit
      page.drawLine({ start:{x:M+totalWidth, y:tableTop}, end:{x:M+totalWidth, y:tableTop-tableH}, thickness:1, color:rgb(0,0,0) })
      // Bord haut
      page.drawLine({ start:{x:M, y:tableTop}, end:{x:M+totalWidth, y:tableTop}, thickness:1, color:rgb(0,0,0) })
      // Bord bas
      page.drawLine({ start:{x:M, y:tableTop-tableH}, end:{x:M+totalWidth, y:tableTop-tableH}, thickness:1, color:rgb(0,0,0) })

      // Date et signature
      const sigY = tableTop - tableH - 40
      page.drawText(`Fait le : ${new Date().toLocaleDateString('fr-FR')}`, {
        x: M, y: sigY,
        size: 10, font, color: rgb(0, 0, 0)
      })
      page.drawText('Signature :', {
        x: width - M - 150, y: sigY,
        size: 10, font, color: rgb(0, 0, 0)
      })

      const pdfBytes = await pdfDoc.save()
      const blob = new Blob([pdfBytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Allocation_rentree_scolaire_2026_2027_${profile.nom}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      showToast('✅ PDF généré !')
    } catch(e) {
      showToast('❌ Erreur : ' + e.message)
    }
    setGenerating(false)
  }

  if (loading) return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ maxWidth:600, textAlign:'center', padding:40 }}>
        ⏳ Chargement...
      </div>
    </div>
  )

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth:700 }} onClick={e => e.stopPropagation()}>
        <div className="modal-title">📄 Allocation rentrée scolaire 2026/2027</div>

        {/* Info */}
        <div style={{ background:'#e8eef8', border:'1px solid #c4d4f5', borderRadius:8, padding:'10px 14px', marginBottom:16, fontSize:12, color:'#1a4b8f' }}>
          📋 Ce formulaire liste tous vos enfants scolarisés. Vérifiez les informations avant de générer le PDF.
        </div>

        {/* En-tête AF */}
        <div style={{ background:'#f8faff', border:'1px solid #dde3f0', borderRadius:8, padding:'10px 14px', marginBottom:16, fontSize:12 }}>
          <div><strong>Nom de l'Assistant(e) Familial(e) :</strong> {profile.nom} {profile.prenom}</div>
          <div style={{ marginTop:4 }}><strong>Territoire Concerné :</strong> {profile.secteur || profile.territoire || '—'}</div>
        </div>

        {/* Tableau enfants */}
        {enfants.length === 0 ? (
          <div style={{ textAlign:'center', padding:40, color:'#9aa3b8' }}>
            <div style={{ fontSize:32, marginBottom:8 }}>👶</div>
            <div>Aucun enfant trouvé</div>
            <div style={{ fontSize:11, marginTop:4 }}>Vérifiez que vos enfants sont bien renseignés dans Passerelle</div>
          </div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, marginBottom:16 }}>
            <thead>
              <tr style={{ background:'#e8eef8' }}>
                <th style={{ padding:'8px 10px', textAlign:'left', borderBottom:'2px solid #1a4b8f', width:30 }}>✓</th>
                <th style={{ padding:'8px 10px', textAlign:'left', borderBottom:'2px solid #1a4b8f' }}>Nom – Prénom</th>
                <th style={{ padding:'8px 10px', textAlign:'left', borderBottom:'2px solid #1a4b8f', width:100 }}>Classe</th>
                <th style={{ padding:'8px 10px', textAlign:'left', borderBottom:'2px solid #1a4b8f' }}>Établissement – Lieu</th>
              </tr>
            </thead>
            <tbody>
              {enfants.map(enf => (
                <tr key={enf.id} style={{ borderBottom:'1px solid #dde3f0', background: enf.inclus ? '#fff' : '#f8f9fb', opacity: enf.inclus ? 1 : 0.5 }}>
                  <td style={{ padding:'6px 10px', textAlign:'center' }}>
                    <input type="checkbox" checked={enf.inclus}
                      onChange={e => updateEnfant(enf.id, 'inclus', e.target.checked)} />
                  </td>
                  <td style={{ padding:'6px 10px', fontWeight:600 }}>
                    {enf.nom} {enf.prenom}
                  </td>
                  <td style={{ padding:'6px 10px' }}>
                    <input className="form-control" style={{ fontSize:11 }}
                      value={enf.classe}
                      onChange={e => updateEnfant(enf.id, 'classe', e.target.value)}
                      placeholder="CE2, 6ème..." />
                  </td>
                  <td style={{ padding:'6px 10px' }}>
                    <input className="form-control" style={{ fontSize:11 }}
                      value={enf.ecole + (enf.lieu ? ' - ' + enf.lieu : '')}
                      onChange={e => updateEnfant(enf.id, 'ecole', e.target.value)}
                      placeholder="École Jules Ferry - Graulhet" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Avertissement données manquantes */}
        {enfants.some(e => e.inclus && (!e.classe || !e.ecole)) && (
          <div style={{ background:'#fef3e2', border:'1px solid #f5dca4', borderRadius:8, padding:'8px 12px', marginBottom:12, fontSize:12, color:'#d97706' }}>
            ⚠️ Certains enfants ont des informations manquantes. Complétez-les ici ou dans l'onglet Scolarité de leur dossier.
          </div>
        )}

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={generatePDF} disabled={generating || enfants.filter(e => e.inclus).length === 0}>
            {generating ? '⏳ Génération...' : '📄 Générer le PDF'}
          </button>
        </div>

        {toast && <div className="toast">{toast}</div>}
      </div>
    </div>
  )
}
