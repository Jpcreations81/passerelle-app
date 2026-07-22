// SortieDepartement.js - v2026-07-22b - mise en page officielle avec logo Tarn
import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { useSignature } from './useSignature'
import { LOGO_TARN_B64 } from './logoTarn'
import { LOGO_TARN_B64 } from './logoTarn'

function b64ToBytes(b64) {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

function b64ToBytes(b64) {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

export default function SortieDepartement({ profile, onClose }) {
  const [enfants, setEnfants] = useState([])
  const [maisons, setMaisons] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [toast, setToast] = useState('')
  const [destination, setDestination] = useState('')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [nuiteesFacturees, setNuiteesFacturees] = useState(false)
  const [enfantsSelectionnes, setEnfantsSelectionnes] = useState({})
  const { getSignatureBytes, SignatureModal } = useSignature(profile)

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    fetchEnfants()
    fetchMaisons()
  }, [])

  async function fetchEnfants() {
    const { data } = await supabase
      .from('enfants')
      .select('id, prenom, nom, territoire, rt_ase:rt_ase_id(nom, prenom)')
      .eq('af_principal_id', profile.id)
      .not('type_placement', 'eq', 'non_place')
    if (data) {
      setEnfants(data)
      // Sélectionner tous les enfants par défaut
      const sel = {}
      data.forEach(e => sel[e.id] = true)
      setEnfantsSelectionnes(sel)
    }
    setLoading(false)
  }

  async function fetchMaisons() {
    const { data } = await supabase.from('maisons_departementales').select('nom, territoire, email_gestionnaire')
    if (data) setMaisons(data)
  }

  function getGestionnaire(territoire) {
    const md = maisons.find(m => m.nom === territoire)
    return md ? md.email_gestionnaire : null
  }

  function getInfosTerritoire(territoire) {
    const md = maisons.find(m => m.nom === territoire)
    if (!md) return { email: '', nomTerritoire: territoire || '', tel: '' }
    // Infos téléphone selon territoire
    const tels = {
      'Nord': '05 63 49 10 10',
      'Ouest': '05 63 34 01 10',
      'Sud': '05 63 71 02 21'
    }
    return {
      email: md.email_gestionnaire,
      nomTerritoire: md.territoire,
      tel: tels[md.territoire] || '',
    }
  }

  // Grouper les enfants sélectionnés par gestionnaire
  function getGroupesParGestionnaire() {
    const groupes = {}
    enfants
      .filter(e => enfantsSelectionnes[e.id])
      .forEach(e => {
        const gestionnaire = getGestionnaire(e.territoire) || 'inconnu'
        if (!groupes[gestionnaire]) groupes[gestionnaire] = []
        groupes[gestionnaire].push(e)
      })
    return groupes
  }

  async function genererPDFs() {
    if (!destination.trim()) { showToast('⚠️ Destination obligatoire'); return }
    if (!dateDebut || !dateFin) { showToast('⚠️ Dates obligatoires'); return }
    if (Object.values(enfantsSelectionnes).every(v => !v)) { showToast('⚠️ Sélectionnez au moins un enfant'); return }

    setGenerating(true)
    const sigBytes = await getSignatureBytes()
    const groupes = getGroupesParGestionnaire()

    for (const [gestionnaire, enfantsGroupe] of Object.entries(groupes)) {
      await genererUnPDF(gestionnaire, enfantsGroupe, sigBytes)
    }

    // Créer événement agenda si demandé
    // TODO: créer événement "Vacances" dans l'agenda

    setGenerating(false)
    showToast(`✅ ${Object.keys(groupes).length} PDF(s) générés !`)
  }

  async function genererUnPDF(gestionnaire, enfantsGroupe, sigBytes) {
    try {
      const pdfDoc = await PDFDocument.create()
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
      const fontB = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
      const page = pdfDoc.addPage([595, 842])
      const { width, height } = page.getSize()
      const M = 50

      const premierEnfant = enfantsGroupe[0]
      const infos = getInfosTerritoire(premierEnfant.territoire)

      // Logo Tarn
      try {
        const logoBytes = b64ToBytes(LOGO_TARN_B64)
        const logoImg = await pdfDoc.embedJpg(logoBytes)
        page.drawImage(logoImg, { x: M, y: height - 100, width: 70, height: 70 })
      } catch(e) { console.log('Logo error:', e.message) }

      // En-tete
      const entete = [
        { text: 'Direction Generale Adjointe de la Solidarite', bold: true },
        { text: 'Direction Enfance Famille', bold: true },
        { text: "Service Aide Sociale a l'Enfance", bold: true },
        { text: 'Territoire ' + infos.nomTerritoire, bold: true },
        { text: 'Telephone : ' + infos.tel, bold: false },
        { text: gestionnaire, bold: false },
      ]
      entete.forEach((l, i) => {
        page.drawText(l.text, { x: M, y: height - 115 - (i * 13), size: 9, font: l.bold ? fontB : font, color: rgb(0, 0, 0) })
      })

      // Titre
      const titre = 'AUTORISATION SORTIE DU DEPARTEMENT'
      const titreW = fontB.widthOfTextAtSize(titre, 14)
      page.drawText(titre, { x: (width - titreW) / 2, y: height - 225, size: 14, font: fontB, color: rgb(0, 0, 0) })

      // Corps
      let y = height - 290
      page.drawText('Madame, Monsieur :', { x: M, y, size: 11, font, color: rgb(0, 0, 0) })
      y -= 22
      page.drawText(profile.prenom + ' ' + profile.nom, { x: M, y, size: 11, font: fontB, color: rgb(0, 0, 0) })
      const nomW = fontB.widthOfTextAtSize(profile.prenom + ' ' + profile.nom, 11)
      page.drawText(", assistant(e) familial(e), est autorise(e) a se rendre a :", { x: M + nomW + 3, y, size: 11, font, color: rgb(0, 0, 0) })
      y -= 22
      page.drawText(destination, { x: M + 10, y, size: 11, font, color: rgb(0, 0, 0) })
      y -= 35

      // Période
      const dDebut = new Date(dateDebut + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
      const dFin = new Date(dateFin + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
      page.drawText('Pour la periode du :', { x: M, y, size: 11, font, color: rgb(0, 0, 0) })
      y -= 22
      page.drawText(dDebut + ' au ' + dFin, { x: M + 10, y, size: 11, font: fontB, color: rgb(0, 0, 0) })
      y -= 35

      // Enfants
      page.drawText(enfantsGroupe.length > 1 ? 'Avec les enfants :' : "Avec l'enfant :", { x: M, y, size: 11, font, color: rgb(0, 0, 0) })
      y -= 22
      enfantsGroupe.forEach(enf => {
        page.drawText(enf.prenom + ' ' + enf.nom, { x: M + 10, y, size: 11, font: fontB, color: rgb(0, 0, 0) })
        y -= 18
      })
      y -= 40

      // Signatures
      const colLeft = M
      const colRight = width / 2 + 30
      page.drawText('Accord obligatoire du', { x: colLeft, y, size: 10, font: fontB, color: rgb(0, 0, 0) })
      page.drawText("Signature de l'assistant(e) familial(e)", { x: colRight, y, size: 10, font: fontB, color: rgb(0, 0, 0) })
      y -= 14
      page.drawText('Responsable Territorial', { x: colLeft, y, size: 10, font: fontB, color: rgb(0, 0, 0) })
      y -= 14
      page.drawText("a l'Aide Sociale a l'Enfance", { x: colLeft, y, size: 10, font: fontB, color: rgb(0, 0, 0) })
      y -= 20
      page.drawRectangle({ x: colLeft, y: y - 60, width: 180, height: 55, borderColor: rgb(0.5, 0.5, 0.5), borderWidth: 0.5 })
      page.drawRectangle({ x: colRight, y: y - 60, width: 200, height: 55, borderColor: rgb(0.5, 0.5, 0.5), borderWidth: 0.5 })
      if (sigBytes) {
        try {
          const sigImg = await pdfDoc.embedPng(sigBytes)
          page.drawImage(sigImg, { x: colRight + 5, y: y - 55, width: 190, height: 45 })
        } catch(e) {}
      }

      // Pied de page
      page.drawLine({ start: { x: M, y: 55 }, end: { x: width - M, y: 55 }, thickness: 0.5, color: rgb(0.5, 0.5, 0.5) })
      const ww = fontB.widthOfTextAtSize('WWW.TARN.FR', 8)
      page.drawText('WWW.TARN.FR', { x: (width - ww) / 2, y: 44, size: 8, font: fontB, color: rgb(0.3, 0.3, 0.3) })
      const pdp = 'DEPARTEMENT DU TARN - 81013 ALBI CEDEX 9 - Tel : 05.63.45.64.64 - Mail : president@tarn.fr'
      const pdp2 = 'Tout courrier doit etre adresse de facon impersonnelle a Monsieur le President du Departement'
      page.drawText(pdp, { x: (width - font.widthOfTextAtSize(pdp, 7)) / 2, y: 32, size: 7, font, color: rgb(0.3, 0.3, 0.3) })
      page.drawText(pdp2, { x: (width - font.widthOfTextAtSize(pdp2, 7)) / 2, y: 22, size: 7, font, color: rgb(0.3, 0.3, 0.3) })

      const pdfBytes = await pdfDoc.save()
      const blob = new Blob([pdfBytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'Autorisation_sortie_' + infos.nomTerritoire + '_' + dateDebut + '.pdf'
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch(e) {
      showToast('Erreur PDF : ' + e.message)
    }
  }

  if (loading) return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ maxWidth:500, textAlign:'center', padding:40 }}>
        ⏳ Chargement...
      </div>
    </div>
  )

  const groupes = getGroupesParGestionnaire()
  const nbPDFs = Object.keys(groupes).length

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth:640 }} onClick={e => e.stopPropagation()}>
        <div className="modal-title">🗺️ Sortie de département</div>

        {/* Info */}
        <div style={{ background:'#e8eef8', border:'1px solid #c4d4f5', borderRadius:8, padding:'10px 14px', marginBottom:16, fontSize:12, color:'#1a4b8f' }}>
          📋 {nbPDFs > 0 ? `${nbPDFs} formulaire(s) seront générés selon les gestionnaires des enfants.` : 'Sélectionnez au moins un enfant.'}
        </div>

        {/* Destination */}
        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:11, fontWeight:600, color:'#5a6478', textTransform:'uppercase', display:'block', marginBottom:5 }}>Destination *</label>
          <input className="form-control" value={destination} onChange={e => setDestination(e.target.value)}
            placeholder="Ex: Camping Le Domaine de la Yole, Valras" />
        </div>

        {/* Dates */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
          <div>
            <label style={{ fontSize:11, fontWeight:600, color:'#5a6478', textTransform:'uppercase', display:'block', marginBottom:5 }}>Du *</label>
            <input type="date" className="form-control" value={dateDebut} onChange={e => setDateDebut(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize:11, fontWeight:600, color:'#5a6478', textTransform:'uppercase', display:'block', marginBottom:5 }}>Au *</label>
            <input type="date" className="form-control" value={dateFin} onChange={e => setDateFin(e.target.value)} />
          </div>
        </div>

        {/* Nuitées facturées */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16, padding:'10px 14px', background:'#fffbeb', border:'1px solid #fcd34d', borderRadius:8 }}>
          <input type="checkbox" id="nuitees" checked={nuiteesFacturees} onChange={e => setNuiteesFacturees(e.target.checked)}
            style={{ width:16, height:16, cursor:'pointer' }} />
          <label htmlFor="nuitees" style={{ fontSize:12, color:'#b45309', cursor:'pointer', fontWeight:600 }}>
            💰 Nuitées facturées (déclenchera une demande d'état des sommes dues)
          </label>
        </div>

        {/* Enfants */}
        <div style={{ marginBottom:16 }}>
          <label style={{ fontSize:11, fontWeight:600, color:'#5a6478', textTransform:'uppercase', display:'block', marginBottom:8 }}>Enfants concernés *</label>
          {enfants.length === 0 ? (
            <div style={{ color:'#9aa3b8', fontSize:12, fontStyle:'italic' }}>Aucun enfant trouvé</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {enfants.map(enf => {
                const gestionnaire = getGestionnaire(enf.territoire)
                return (
                  <div key={enf.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background: enfantsSelectionnes[enf.id] ? '#f0fdf4' : '#f8f9fb', border:`1px solid ${enfantsSelectionnes[enf.id] ? '#bbf7d0' : '#eef1f8'}`, borderRadius:8 }}>
                    <input type="checkbox" checked={!!enfantsSelectionnes[enf.id]}
                      onChange={e => setEnfantsSelectionnes(prev => ({ ...prev, [enf.id]: e.target.checked }))}
                      style={{ width:16, height:16, cursor:'pointer' }} />
                    <div style={{ flex:1 }}>
                      <span style={{ fontSize:13, fontWeight:600 }}>{enf.prenom} {enf.nom}</span>
                      {enf.territoire && <span style={{ fontSize:11, color:'#9aa3b8', marginLeft:8 }}>📍 {enf.territoire}</span>}
                    </div>
                    {gestionnaire && (
                      <span style={{ fontSize:10, color:'#1a4b8f', background:'#e8eef8', padding:'2px 6px', borderRadius:4 }}>
                        {gestionnaire}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Aperçu groupes */}
        {nbPDFs > 0 && (
          <div style={{ background:'#f8faff', border:'1px solid #dde3f0', borderRadius:8, padding:'10px 14px', marginBottom:16, fontSize:12 }}>
            <div style={{ fontWeight:700, color:'#1a4b8f', marginBottom:8 }}>📄 Formulaires qui seront générés :</div>
            {Object.entries(groupes).map(([gest, enfs]) => (
              <div key={gest} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                <span style={{ color:'#15803d' }}>✅</span>
                <span><strong>{enfs.map(e => `${e.prenom} ${e.nom}`).join(', ')}</strong> → {gest}</span>
              </div>
            ))}
          </div>
        )}

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={genererPDFs} disabled={generating}>
            {generating ? '⏳ Génération...' : `📄 Générer ${nbPDFs > 1 ? nbPDFs + ' formulaires' : 'le formulaire'}`}
          </button>
        </div>

        {toast && <div className="toast">{toast}</div>}
        {SignatureModal}
      </div>
    </div>
  )
}
