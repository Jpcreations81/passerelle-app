// useSignature.js — v2026-06-17a — hook réutilisable : récupère signature AF + canvas "signer à chaque fois"
import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Hook useSignature
 * - Charge la signature sauvegardée depuis Supabase Storage
 * - Gère le modal canvas "signer à chaque fois"
 * - Retourne signatureBytes (Uint8Array) prêt pour pdf-lib embedPng
 *
 * Usage :
 *   const { getSignatureBytes, SignatureModal } = useSignature(profile)
 *   // Avant de générer le PDF :
 *   const sigBytes = await getSignatureBytes()  // ouvre le canvas si mode=chaque_fois
 *   // Dans le PDF :
 *   if (sigBytes) { const img = await pdfDoc.embedPng(sigBytes); page.drawImage(img, {...}) }
 */
export function useSignature(profile) {
  const [showModal, setShowModal] = useState(false)
  const [drawing, setDrawing] = useState(false)
  const [resolveRef, setResolveRef] = useState(null)
  const canvasRef = useRef(null)

  // Récupérer les bytes de la signature sauvegardée
  const fetchSavedSignature = useCallback(async () => {
    if (!profile?.id) return null
    const path = `${profile.id}/signature.png`
    const { data, error } = await supabase.storage.from('signatures').download(path)
    if (error || !data) return null
    const buffer = await data.arrayBuffer()
    return new Uint8Array(buffer)
  }, [profile?.id])

  // Fonction principale appelée avant chaque génération de PDF
  const getSignatureBytes = useCallback(() => {
    return new Promise(async (resolve) => {
      const mode = profile?.signature_mode
      if (!mode || mode === 'chaque_fois') {
        // Ouvrir le modal canvas
        setResolveRef(() => resolve)
        setShowModal(true)
      } else {
        // Charger la signature sauvegardée
        const bytes = await fetchSavedSignature()
        resolve(bytes)
      }
    })
  }, [profile?.signature_mode, fetchSavedSignature])

  // Canvas drawing
  function startDraw(e) {
    if (!canvasRef.current) return
    setDrawing(true)
    const ctx = canvasRef.current.getContext('2d')
    const rect = canvasRef.current.getBoundingClientRect()
    const x = (e.touches?.[0]?.clientX ?? e.clientX) - rect.left
    const y = (e.touches?.[0]?.clientY ?? e.clientY) - rect.top
    ctx.beginPath(); ctx.moveTo(x, y)
  }
  function draw(e) {
    if (!drawing || !canvasRef.current) return
    e.preventDefault()
    const ctx = canvasRef.current.getContext('2d')
    const rect = canvasRef.current.getBoundingClientRect()
    const x = (e.touches?.[0]?.clientX ?? e.clientX) - rect.left
    const y = (e.touches?.[0]?.clientY ?? e.clientY) - rect.top
    ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#1a2340'
    ctx.lineTo(x, y); ctx.stroke()
  }
  function stopDraw() { setDrawing(false) }
  function clearCanvas() {
    if (!canvasRef.current) return
    canvasRef.current.getContext('2d').clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
  }

  async function validerSignature() {
    if (!canvasRef.current || !resolveRef) return
    const ctx = canvasRef.current.getContext('2d')
    const pixels = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height).data
    const hasContent = pixels.some((v, i) => i % 4 === 3 && v > 0)
    if (!hasContent) { alert('Veuillez dessiner votre signature.'); return }
    const dataUrl = canvasRef.current.toDataURL('image/png')
    const res = await fetch(dataUrl)
    const buffer = await res.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    setShowModal(false)
    clearCanvas()
    resolveRef(bytes)
    setResolveRef(null)
  }

  function annulerSignature() {
    setShowModal(false)
    clearCanvas()
    if (resolveRef) { resolveRef(null); setResolveRef(null) }
  }

  // Composant modal canvas
  const SignatureModal = showModal ? (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:'#fff', borderRadius:16, padding:24, maxWidth:500, width:'100%', boxShadow:'0 8px 40px rgba(0,0,0,0.18)', fontFamily:'Sora,sans-serif' }}>
        <div style={{ fontSize:18, fontWeight:800, color:'#1a4b8f', marginBottom:4 }}>🖊️ Signez le document</div>
        <div style={{ fontSize:12, color:'#9aa3b8', marginBottom:12 }}>Dessinez votre signature dans le cadre ci-dessous</div>
        <canvas ref={canvasRef} width={440} height={140}
          style={{ border:'2px solid #dde3f0', borderRadius:10, width:'100%', touchAction:'none', background:'#fafbff', cursor:'crosshair' }}
          onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
          onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw} />
        <div style={{ display:'flex', gap:8, marginTop:10 }}>
          <button onClick={clearCanvas} style={{ flex:1, padding:10, borderRadius:8, border:'1px solid #dde3f0', background:'#f4f6fb', color:'#5a6478', fontSize:12, cursor:'pointer', fontWeight:600 }}>🗑️ Effacer</button>
          <button onClick={annulerSignature} style={{ flex:1, padding:10, borderRadius:8, border:'1px solid #dde3f0', background:'#f4f6fb', color:'#5a6478', fontSize:12, cursor:'pointer', fontWeight:600 }}>Annuler</button>
          <button onClick={validerSignature} style={{ flex:2, padding:10, borderRadius:8, border:'none', background:'#1a4b8f', color:'#fff', fontSize:12, cursor:'pointer', fontWeight:700 }}>✅ Valider et générer le PDF</button>
        </div>
      </div>
    </div>
  ) : null

  return { getSignatureBytes, SignatureModal }
}
