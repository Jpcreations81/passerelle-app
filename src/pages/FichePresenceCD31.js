// FichePresenceCD31.js — v2026-08-25c — logo Haute-Garonne intégré + mise en page rapprochée du modèle officiel (cadre nota bene page 1, titre/sous-titre, bandeau période, colonnes centrées)
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import Sidebar from '../components/Sidebar'
import { LOGO_HG_B64 } from './logoHauteGaronne'

function b64ToBytes(b64) {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

const MOIS_LABELS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const JOURS_LABELS = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']

function fmt(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth()+1).padStart(2,'0')
  const d = String(date.getDate()).padStart(2,'0')
  return y+'-'+m+'-'+d
}
function fmtDate(isoStr) {
  if (!isoStr) return null
  const d = new Date(isoStr)
  const localStr = d.toLocaleDateString('fr-FR', { timeZone:'Europe/Paris', year:'numeric', month:'2-digit', day:'2-digit' })
  const [day, month, year] = localStr.split('/')
  return year+'-'+month+'-'+day
}
// Jours du calendrier CD31 : du 25 du mois précédent au 31 du mois en cours (2 pages)
function getJoursMoisPrecedent(annee, mois) {
  const moisPrec = mois === 0 ? 11 : mois - 1
  const anneePrec = mois === 0 ? annee - 1 : annee
  const dernierJourMoisPrec = new Date(anneePrec, moisPrec + 1, 0).getDate()
  const jours = []
  for (let j = 25; j <= dernierJourMoisPrec; j++) {
    jours.push(new Date(anneePrec, moisPrec, j))
  }
  return jours
}
function getJoursMoisEnCours(annee, mois) {
  const dernierJour = new Date(annee, mois + 1, 0).getDate()
  const jours = []
  for (let j = 1; j <= dernierJour; j++) jours.push(new Date(annee, mois, j))
  return jours
}

export default function FichePresenceCD31({ profile, enfantIdInitial, onRetourListe }) {
  const navigate = useNavigate()
  const [groupes, setGroupes] = useState([]) // tableaux de 1 à 3 enfants
  const [groupeIndex, setGroupeIndex] = useState(0)
  const [selectedMois, setSelectedMois] = useState(new Date().getMonth())
  const [selectedAnnee, setSelectedAnnee] = useState(new Date().getFullYear())
  const [presencesParEnfant, setPresencesParEnfant] = useState({}) // { enfantId: { 'YYYY-MM-DD': true/false } }
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [toast, setToast] = useState('')

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => { fetchEnfantsCD31() }, [])
  useEffect(() => { if (groupes.length > 0) loadPresences() }, [groupes, groupeIndex, selectedMois, selectedAnnee])

  async function fetchEnfantsCD31() {
    const { data: enfants } = await supabase
      .from('enfants')
      .select('id, nom, prenom, md_id')
      .eq('af_principal_id', profile.id)
    if (!enfants || enfants.length === 0) { setLoading(false); return }

    const mdIds = [...new Set(enfants.map(e => e.md_id).filter(Boolean))]
    if (mdIds.length === 0) { setLoading(false); return }
    const { data: maisons } = await supabase.from('maisons_departement').select('id, departement').in('id', mdIds)
    const idsCD31 = new Set((maisons || []).filter(m => m.departement === '31').map(m => m.id))

    const enfantsCD31 = enfants.filter(e => idsCD31.has(e.md_id))
    const grps = []
    for (let i = 0; i < enfantsCD31.length; i += 3) grps.push(enfantsCD31.slice(i, i + 3))
    setGroupes(grps)
    if (enfantIdInitial) {
      const idx = grps.findIndex(g => g.some(e => e.id === enfantIdInitial))
      if (idx >= 0) setGroupeIndex(idx)
    }
    setLoading(false)
  }

  async function loadPresences() {
    const groupe = groupes[groupeIndex]
    if (!groupe) return
    const joursPrec = getJoursMoisPrecedent(selectedAnnee, selectedMois)
    const joursCourant = getJoursMoisEnCours(selectedAnnee, selectedMois)
    const tousJours = [...joursPrec, ...joursCourant]
    const debut = joursPrec[0] || joursCourant[0]
    const fin = joursCourant[joursCourant.length - 1]

    const result = {}
    for (const enf of groupe) {
      const p = {}
      tousJours.forEach(d => { p[fmt(d)] = true })

      const { data: evts } = await supabase
        .from('evenements')
        .select('date_debut, date_fin')
        .eq('af_id', profile.id)
        .eq('categorie', 'relais')
        .contains('enfant_ids', [enf.id])
        .lte('date_debut', fin.toISOString())
        .gte('date_fin', debut.toISOString())

      if (evts) {
        evts.forEach(evt => {
          const premierJour = fmtDate(evt.date_debut)
          const dernierJour = fmtDate(evt.date_fin)
          const cur = new Date(evt.date_debut); cur.setHours(0,0,0,0)
          const finDate = new Date(evt.date_fin); finDate.setHours(23,59,59,999)
          while (cur <= finDate) {
            const key = fmt(cur)
            if (key in p) {
              // Présent le premier et le dernier jour (arrivée/retour), absent les jours pleins entre les deux
              p[key] = (key === premierJour || key === dernierJour)
            }
            cur.setDate(cur.getDate() + 1)
          }
        })
      }
      result[enf.id] = p
    }
    setPresencesParEnfant(result)
  }

  function togglePresence(enfantId, key) {
    setPresencesParEnfant(prev => ({
      ...prev,
      [enfantId]: { ...prev[enfantId], [key]: !prev[enfantId]?.[key] }
    }))
  }

  async function genererEtSauvegarder() {
    const groupe = groupes[groupeIndex]
    if (!groupe || groupe.length === 0) return
    setGenerating(true)
    try {
      const pdfDoc = await PDFDocument.create()
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
      const fontB = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique === undefined ? StandardFonts.HelveticaBold : StandardFonts.HelveticaBold)
      const fontI = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)

      let logoImg = null
      try { logoImg = await pdfDoc.embedPng(b64ToBytes(LOGO_HG_B64)) } catch(e) { console.log('Logo error:', e.message) }

      const joursPrec = getJoursMoisPrecedent(selectedAnnee, selectedMois)
      const joursCourant = getJoursMoisEnCours(selectedAnnee, selectedMois)

      function dessinerPage(jours, titrePeriode, avecNotaBene) {
        const page = pdfDoc.addPage([595, 842])
        const { width, height } = page.getSize()
        const M = 42
        const bleu = rgb(0.10, 0.16, 0.42)
        const gris = rgb(0.35, 0.35, 0.35)

        // Logo (haut gauche)
        if (logoImg) {
          const logoW = 55
          const logoH = logoW * (logoImg.height / logoImg.width)
          page.drawImage(logoImg, { x: M, y: height - 32 - logoH, width: logoW, height: logoH })
        }

        // En-tête texte (à droite du logo)
        const txX = M + 70
        page.drawText('CONSEIL DÉPARTEMENTAL DE LA HAUTE-GARONNE', { x: txX, y: height - 40, size: 11, font: fontB, color: bleu })
        page.drawText('Direction Enfance et Famille', { x: txX, y: height - 54, size: 9, font: fontB, color: gris })
        page.drawText('Dispositif Enfance - Placement Familial', { x: txX, y: height - 66, size: 9, font, color: gris })

        // Titre centré
        const titre = 'État de présence'
        const sousTitre = "de l'Assistant(e) Familial(e)"
        const titreW = fontB.widthOfTextAtSize(titre, 18)
        const sousTitreW = font.widthOfTextAtSize(sousTitre, 11)
        page.drawText(titre, { x: (width - titreW) / 2, y: height - 108, size: 18, font: fontB, color: bleu })
        page.drawText(sousTitre, { x: (width - sousTitreW) / 2, y: height - 124, size: 11, font, color: gris })

        // Identité
        let yId = height - 155
        page.drawText('NOM :', { x: M, y: yId, size: 10, font: fontB })
        page.drawText(profile.nom, { x: M + 40, y: yId, size: 10, font })
        page.drawText('Prénom :', { x: M + 200, y: yId, size: 10, font: fontB })
        page.drawText(profile.prenom, { x: M + 250, y: yId, size: 10, font })
        page.drawText('Mois :', { x: M + 380, y: yId, size: 10, font: fontB })
        page.drawText(`${MOIS_LABELS[selectedMois]} ${selectedAnnee}`, { x: M + 415, y: yId, size: 10, font })

        let y = height - 180

        // Cadre nota bene (page 1 uniquement)
        if (avecNotaBene) {
          const notaLines = [
            "À retourner sans faute le 25 de chaque mois, nom et signature indispensable pour le paiement.",
            "Vous pouvez compléter le calendrier jusqu'au 30 ou 31.",
            "La paye étant établie avec un mois d'avance, merci d'indiquer les éventuelles sorties",
            "durant les périodes de vacances scolaires du mois suivant s'il y a lieu.",
          ]
          const notaH = 16 + notaLines.length * 13
          page.drawRectangle({ x: M, y: y - notaH, width: width - 2*M, height: notaH, borderColor: gris, borderWidth: 0.7 })
          notaLines.forEach((l, i) => {
            page.drawText(l, { x: M + 8, y: y - 16 - i * 13, size: 8, font: fontI, color: gris })
          })
          y -= notaH + 12
        }

        // Bandeau titre tableau
        const bandH = 22
        page.drawRectangle({ x: M, y: y - bandH, width: width - 2*M, height: bandH, color: rgb(0.90, 0.93, 0.98) })
        const periodeW = fontB.widthOfTextAtSize(titrePeriode, 10)
        page.drawText(titrePeriode, { x: (width - periodeW) / 2, y: y - bandH + 7, size: 10, font: fontB, color: bleu })
        y -= bandH

        // Tableau
        const colJourW = 85
        const colEnfW = (width - 2 * M - colJourW) / 3
        const headH = 22

        page.drawRectangle({ x: M, y: y - headH, width: width - 2*M, height: headH, color: rgb(0.95,0.96,0.98) })
        page.drawText('Jours', { x: M + 8, y: y - headH + 7, size: 9, font: fontB, color: bleu })
        groupe.forEach((enf, i) => {
          const x = M + colJourW + i * colEnfW
          const label = enf ? `${enf.prenom} ${enf.nom}` : ''
          const lw = fontB.widthOfTextAtSize(label, 8)
          page.drawText(label, { x: x + (colEnfW - lw)/2, y: y - headH + 7, size: 8, font: fontB, color: bleu })
        })
        y -= headH

        const rowH = 15.5
        jours.forEach((d, idx) => {
          const rowY = y - idx * rowH
          const key = fmt(d)
          const dim = d.getDay() === 0
          if (dim) {
            page.drawRectangle({ x: M, y: rowY - rowH, width: width - 2*M, height: rowH, color: rgb(0.92,0.95,0.99) })
          }
          page.drawText(`${JOURS_LABELS[d.getDay()].slice(0,3)}. ${d.getDate()}`, { x: M + 8, y: rowY - rowH + 4.5, size: 8, font: dim ? fontB : font })
          groupe.forEach((enf, i) => {
            const x = M + colJourW + i * colEnfW
            const present = presencesParEnfant[enf.id]?.[key]
            if (present) {
              const xw = fontB.widthOfTextAtSize('x', 9)
              page.drawText('x', { x: x + colEnfW/2 - xw/2, y: rowY - rowH + 4.5, size: 9, font: fontB, color: bleu })
            }
          })
          page.drawLine({ start:{x:M, y:rowY-rowH}, end:{x:width-M, y:rowY-rowH}, thickness:0.4, color: rgb(0.75,0.75,0.75) })
        })

        const tableBottom = y - jours.length * rowH
        // Cadre extérieur + séparateurs colonnes
        page.drawRectangle({ x: M, y: tableBottom, width: width - 2*M, height: (y + headH) - tableBottom, borderColor: gris, borderWidth: 0.8 })
        for (let i = 1; i <= 3; i++) {
          const x = M + colJourW + i * colEnfW
          page.drawLine({ start:{x, y: y + headH}, end:{x, y: tableBottom}, thickness: i === 0 ? 0.8 : 0.4, color: gris })
        }
        page.drawLine({ start:{x:M+colJourW, y:y+headH}, end:{x:M+colJourW, y: tableBottom}, thickness:0.8, color: gris })

        // Pied de page
        page.drawText('WWW.HAUTEGARONNE.FR', { x: (width - font.widthOfTextAtSize('WWW.HAUTEGARONNE.FR', 7))/2, y: 25, size: 7, font, color: gris })

        return { page, bottom: tableBottom }
      }

      const p1 = dessinerPage(joursPrec, 'MOIS PRÉCÉDENT', true)
      const p2 = dessinerPage(joursCourant, 'MOIS EN COURS', false)
      const dernierePage = p2.page

      // Attestation + signature sur la dernière page
      const { height } = dernierePage.getSize()
      const ySign = Math.min(p2.bottom - 30, 70)
      dernierePage.drawText("J'atteste sur l'honneur l'exactitude des renseignements portés ci-après.", { x: 42, y: ySign, size: 9, font: fontB })
      dernierePage.drawText(`Fait le : ${new Date().toLocaleDateString('fr-FR')}`, { x: 42, y: ySign - 20, size: 9, font })
      dernierePage.drawText("Signature de l'Assistant(e) Familial(e)", { x: 350, y: ySign - 20, size: 9, font })

      const pdfBytes = await pdfDoc.save()
      const blob = new Blob([pdfBytes], { type: 'application/pdf' })
      const nomsFichier = groupe.map(e => e.prenom).join('-')
      const nomFichier = `Fiche_presence_CD31_${nomsFichier}_${MOIS_LABELS[selectedMois]}_${selectedAnnee}.pdf`

      // Sauvegarde dans Administratif > Feuilles de présence de l'AF
      try {
        let { data: administratif } = await supabase.from('documents_dossiers')
          .select('id').eq('created_by', profile.id).eq('nom', '📋 Administratif').is('parent_id', null).eq('type', 'af').single()
        let administratifId = administratif?.id
        if (!administratifId) {
          const { data: newAdmin } = await supabase.from('documents_dossiers').insert({
            nom: '📋 Administratif', parent_id: null, created_by: profile.id, type: 'af'
          }).select().single()
          administratifId = newAdmin?.id
        }
        if (administratifId) {
          let { data: sousDossier } = await supabase.from('documents_dossiers')
            .select('id').eq('parent_id', administratifId).eq('nom', 'Feuilles de présence').single()
          let sousDossierId = sousDossier?.id
          if (!sousDossierId) {
            const { data: newSous } = await supabase.from('documents_dossiers').insert({
              nom: 'Feuilles de présence', parent_id: administratifId, created_by: profile.id, type: 'af'
            }).select().single()
            sousDossierId = newSous?.id
          }
          if (sousDossierId) {
            const storagePath = `af/${profile.id}/docs/${sousDossierId}/${Date.now()}.pdf`
            const { error: storageErr } = await supabase.storage
              .from('documents-enfants')
              .upload(storagePath, blob, { contentType: 'application/pdf' })
            if (!storageErr) {
              await supabase.from('documents_generaux').insert({
                dossier_id: sousDossierId,
                nom: nomFichier,
                storage_path: storagePath,
                taille: pdfBytes.length,
                mime_type: 'application/pdf',
                uploaded_by: profile.id,
              })
            } else { console.log('Upload fiche CD31 échoué:', storageErr.message) }
          }
        }
      } catch(e) { console.log('Erreur sauvegarde fiche CD31:', e.message) }

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = nomFichier
      a.click()
      URL.revokeObjectURL(url)
      showToast('✅ Fiche générée et sauvegardée !')
    } catch(e) {
      showToast('❌ Erreur : ' + e.message)
    }
    setGenerating(false)
  }

  if (loading) return (
    <div className="app-layout">
      <Sidebar profile={profile} />
      <div className="main-content" style={{ padding:40, textAlign:'center' }}>⏳ Chargement...</div>
    </div>
  )

  if (groupes.length === 0) return (
    <div className="app-layout">
      <Sidebar profile={profile} />
      <div className="main-content" style={{ padding:40, textAlign:'center', color:'#9aa3b8' }}>
        Aucun enfant rattaché au CD31 pour l'instant.
      </div>
    </div>
  )

  const groupe = groupes[groupeIndex]
  const joursPrec = getJoursMoisPrecedent(selectedAnnee, selectedMois)
  const joursCourant = getJoursMoisEnCours(selectedAnnee, selectedMois)

  return (
    <div className="app-layout">
      <Sidebar profile={profile} />
      <div className="main-content" style={{ padding:24 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
          {onRetourListe && (
            <button onClick={onRetourListe} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'#5a6478' }}>‹</button>
          )}
          <h2 style={{ margin:0 }}>📋 Fiche de présence — CD31</h2>
          {groupes.length > 1 && (
            <select value={groupeIndex} onChange={e => setGroupeIndex(Number(e.target.value))} className="form-control" style={{ width:'auto' }}>
              {groupes.map((g, i) => (
                <option key={i} value={i}>{g.map(e => e.prenom).join(', ')}</option>
              ))}
            </select>
          )}
          <select value={selectedMois} onChange={e => setSelectedMois(Number(e.target.value))} className="form-control" style={{ width:'auto' }}>
            {MOIS_LABELS.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select value={selectedAnnee} onChange={e => setSelectedAnnee(Number(e.target.value))} className="form-control" style={{ width:'auto' }}>
            {[selectedAnnee - 1, selectedAnnee, selectedAnnee + 1].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        <div style={{ background:'#fff', border:'1px solid #dde3f0', borderRadius:12, padding:20, marginBottom:16 }}>
          <div style={{ fontSize:12, color:'#9aa3b8', marginBottom:12 }}>
            Cliquez sur une case pour basculer présent/absent (pré-rempli automatiquement selon les relais enregistrés).
          </div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr>
                <th style={{ textAlign:'left', padding:6, borderBottom:'2px solid #dde3f0' }}>Jour</th>
                {groupe.map(enf => (
                  <th key={enf.id} style={{ padding:6, borderBottom:'2px solid #dde3f0' }}>{enf.prenom} {enf.nom}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr><td colSpan={groupe.length + 1} style={{ padding:'8px 6px', fontWeight:700, background:'#f4f6fb' }}>Mois précédent</td></tr>
              {joursPrec.map(d => {
                const key = fmt(d)
                return (
                  <tr key={key}>
                    <td style={{ padding:6, borderBottom:'1px solid #f0f0f0' }}>{JOURS_LABELS[d.getDay()].slice(0,3)} {d.getDate()}</td>
                    {groupe.map(enf => (
                      <td key={enf.id} style={{ padding:6, textAlign:'center', borderBottom:'1px solid #f0f0f0', cursor:'pointer' }}
                        onClick={() => togglePresence(enf.id, key)}>
                        {presencesParEnfant[enf.id]?.[key] ? '✅' : ''}
                      </td>
                    ))}
                  </tr>
                )
              })}
              <tr><td colSpan={groupe.length + 1} style={{ padding:'8px 6px', fontWeight:700, background:'#f4f6fb' }}>Mois en cours</td></tr>
              {joursCourant.map(d => {
                const key = fmt(d)
                return (
                  <tr key={key}>
                    <td style={{ padding:6, borderBottom:'1px solid #f0f0f0' }}>{JOURS_LABELS[d.getDay()].slice(0,3)} {d.getDate()}</td>
                    {groupe.map(enf => (
                      <td key={enf.id} style={{ padding:6, textAlign:'center', borderBottom:'1px solid #f0f0f0', cursor:'pointer' }}
                        onClick={() => togglePresence(enf.id, key)}>
                        {presencesParEnfant[enf.id]?.[key] ? '✅' : ''}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <button className="btn btn-primary" onClick={genererEtSauvegarder} disabled={generating}>
          {generating ? '⏳ Génération...' : '📄 Générer le PDF'}
        </button>

        {toast && <div className="toast">{toast}</div>}
      </div>
    </div>
  )
}
