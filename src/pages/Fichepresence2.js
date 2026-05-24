// FichePresence2.js — v2026-05-24a — PDF officiel Tarn rempli via pdf-lib
import React, { useState, useEffect } from 'react'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

const MOIS_LABELS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const FERIES_2026 = ['2026-01-01','2026-04-06','2026-05-01','2026-05-08','2026-05-14','2026-05-25','2026-07-14','2026-08-15','2026-11-01','2026-11-11','2026-12-25']

// URLs publiques des PDFs templates dans Supabase Storage
const PDF_URLS = {
  permanent: 'https://ebvwiwdefecaxfmnfppz.supabase.co/storage/v1/object/public/templates/fiche_presence_permanent.pdf',
  relais: 'https://ebvwiwdefecaxfmnfppz.supabase.co/storage/v1/object/public/templates/fiche_presence_relais.pdf',
}

function isFerie(date) {
  const y = date.getFullYear(), m = String(date.getMonth()+1).padStart(2,'0'), d = String(date.getDate()).padStart(2,'0')
  return FERIES_2026.includes(y+'-'+m+'-'+d)
}
function fmt(date) {
  return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0')
}
function getDaysInMonth(year, month) {
  const days = [], d = new Date(year, month, 1)
  while (d.getMonth() === month) { days.push(new Date(d)); d.setDate(d.getDate() + 1) }
  return days
}

export default function FichePresence2({ enfant, profile, mois, annee, presences, moisComplet, onClose, typeFiche, afPrincipal }) {
  const [generating, setGenerating] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => { genererPDF() }, [])

  async function genererPDF() {
    try {
      const isRelais = typeFiche === 'relais'
      const url = isRelais ? PDF_URLS.relais : PDF_URLS.permanent
      
      const resp = await fetch(url)
      if (!resp.ok) throw new Error('Impossible de charger le template PDF')
      const pdfBytes = await resp.arrayBuffer()
      
      const pdfDoc = await PDFDocument.load(pdfBytes)
      const page = pdfDoc.getPages()[0]
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
      const black = rgb(0, 0, 0)

      function draw(text, x, y, opts = {}) {
        page.drawText(String(text || ''), {
          x, y: y - 3,
          size: opts.size || 8,
          font: opts.bold ? fontBold : font,
          color: black,
        })
      }

      if (isRelais) {
        draw(`${enfant.prenom} ${enfant.nom}`, 197, 750, { bold: true })
        draw(`${profile.prenom} ${profile.nom}`, 298, 726, { bold: true })
        if (afPrincipal) draw(`${afPrincipal.prenom} ${afPrincipal.nom}`, 275, 702, { bold: true })
        draw(enfant?.territoire || '', 57, 678)
        draw(`${MOIS_LABELS[mois]} ${annee}`, 175, 760, { bold: true, size: 9 })
      } else {
        draw(`${enfant.prenom} ${enfant.nom}`, 195, 744, { bold: true })
        draw(`${profile.prenom} ${profile.nom}`, 216, 726, { bold: true })
        draw(enfant?.territoire || '', 57, 702)
        draw(`${MOIS_LABELS[mois]} ${annee}`, 175, 779, { bold: true, size: 9 })
        if (moisComplet) draw('X', 32, 654, { bold: true })
      }

      const days = getDaysInMonth(annee, mois)
      const nbJours = Object.values(presences).filter(p => p.present).length
      const nbFeries = days.filter(d => isFerie(d) && presences[fmt(d)]?.present).length

      if (isRelais) {
        draw(String(nbJours), 250, 664, { bold: true, size: 10 })
        draw(String(nbFeries), 250, 647, { bold: true, size: 10 })
      } else {
        draw(String(nbJours), 248, 687, { bold: true, size: 10 })
        draw(String(nbFeries), 248, 670, { bold: true, size: 10 })
      }

      // Tableau
      const Y_FIRST = isRelais ? 591 : 597
      const DELTA_Y = 17
      const X_PRESENCE = 120
      const X_H1 = 155
      const X_H2 = 230
      const X_MOTIF = 325

      days.forEach((d, i) => {
        const key = fmt(d)
        const p = presences[key] || { present: isRelais ? false : true, heure_depart:'', heure_arrivee:'', motif:'' }
        const y = Y_FIRST - i * DELTA_Y
        if (p.present) draw('x', X_PRESENCE, y, { bold: true })
        if (isRelais) {
          if (p.heure_arrivee) draw(p.heure_arrivee, X_H1, y)
          if (p.heure_depart) draw(p.heure_depart, X_H2, y)
        } else {
          if (p.heure_depart) draw(p.heure_depart, X_H1, y)
          if (p.heure_arrivee) draw(p.heure_arrivee, X_H2, y)
        }
        if (p.motif) {
          const motif = p.motif.length > 45 ? p.motif.substring(0, 45) + '...' : p.motif
          draw(motif, X_MOTIF, y)
        }
      })

      const pdfBytesOut = await pdfDoc.save()
      const blob = new Blob([pdfBytesOut], { type: 'application/pdf' })
      const urlOut = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = urlOut
      a.download = `Fiche_${typeFiche}_${enfant.prenom}_${enfant.nom}_${MOIS_LABELS[mois]}_${annee}.pdf`
      a.click()
      URL.revokeObjectURL(urlOut)
      setGenerating(false)
    } catch(e) {
      console.error('Erreur PDF:', e)
      setError(e.message)
      setGenerating(false)
    }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'#fff', borderRadius:12, padding:'32px 40px', textAlign:'center', fontFamily:'Sora,sans-serif', minWidth:280 }}>
        <div style={{ fontSize:36, marginBottom:12 }}>{error ? '❌' : generating ? '⏳' : '✅'}</div>
        <div style={{ fontSize:16, fontWeight:700, color:'#1a4b8f' }}>
          {error ? 'Erreur' : generating ? 'Génération du PDF...' : 'PDF généré !'}
        </div>
        {error && <div style={{ fontSize:12, color:'#e53e3e', marginTop:8 }}>{error}</div>}
        <div style={{ fontSize:12, color:'#9aa3b8', marginTop:8 }}>
          {!error && !generating && 'Téléchargement démarré'}
        </div>
        {!generating && (
          <button onClick={onClose} style={{ marginTop:16, padding:'8px 20px', background:'#1a4b8f', color:'#fff', border:'none', borderRadius:6, cursor:'pointer' }}>
            Fermer
          </button>
        )}
      </div>
    </div>
  )
}
