// App.js — v2026-06-17d — retrait "ASE Tarn (81)" du sous-titre CGU
import React, { useState, useEffect, useRef } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ListeEnfants from './pages/ListeEnfants'
import DossierEnfant from './pages/DossierEnfant'
import DocumentsEnfant from './pages/DocumentsEnfant'
import Agenda from './pages/Agenda'
import FichePresence from './pages/FichePresence'
import FichePresencePermanent from './pages/Fichepresencepermanent'
import FichePresenceIntermittent from './pages/Fichepresenceintermittent'
import Rapports from './pages/Rapports'
import Assfam from './pages/Assfam'
import DossierAssfam from './pages/DossierAssfam'
import Documents from './pages/Documents'
import InterfaceASE from './pages/InterfaceASE'
import Frais from './pages/Frais'
import './App.css'

export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showCGU, setShowCGU] = useState(false)
  const [showSignature, setShowSignature] = useState(false)
  const [signatureEtape, setSignatureEtape] = useState('choix') // 'choix' | 'dessiner' | 'importer'
  const [signatureDataUrl, setSignatureDataUrl] = useState(null)
  const canvasRef = useRef(null)
  const [drawing, setDrawing] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    setProfile(data)
    setLoading(false)
    // Vérifier si l'AF doit voir le modal CGU/signature
    if (data?.role === 'af' && !data?.cgu_acceptee) {
      setShowCGU(true)
    } else if (data?.role === 'af' && data?.cgu_acceptee && !data?.signature_mode) {
      setShowSignature(true)
    }
  }

  async function accepterCGU() {
    await supabase.from('profiles').update({ cgu_acceptee: true }).eq('id', profile?.id)
    setProfile(p => ({ ...p, cgu_acceptee: true }))
    setShowCGU(false)
    setShowSignature(true)
  }

  async function sauvegarderSignatureMode(mode, url = null) {
    await supabase.from('profiles').update({
      signature_mode: mode,
      ...(url ? { signature_url: url } : {})
    }).eq('id', profile?.id)
    setProfile(p => ({ ...p, signature_mode: mode, ...(url ? { signature_url: url } : {}) }))
    setShowSignature(false)
    setSignatureEtape('choix')
  }

  // Canvas signature — dessin
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
    setSignatureDataUrl(null)
  }
  function validerSignatureDessinee() {
    if (!canvasRef.current) return
    const dataUrl = canvasRef.current.toDataURL('image/png')
    setSignatureDataUrl(dataUrl)
  }
  async function sauvegarderSignatureDessinee() {
    if (!signatureDataUrl) return
    // Convertir dataUrl en blob et uploader dans Supabase Storage
    const res = await fetch(signatureDataUrl)
    const blob = await res.blob()
    const path = `signatures/${profile.id}/signature.png`
    const { error } = await supabase.storage.from('signatures').upload(path, blob, { upsert: true, contentType: 'image/png' })
    if (error) { alert('Erreur upload : ' + error.message); return }
    const { data: urlData } = supabase.storage.from('signatures').getPublicUrl(path)
    await sauvegarderSignatureMode('sauvegardee', urlData.publicUrl)
  }
  async function importerSignature(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const path = `signatures/${profile.id}/signature.png`
    const { error } = await supabase.storage.from('signatures').upload(path, file, { upsert: true, contentType: file.type })
    if (error) { alert('Erreur upload : ' + error.message); return }
    const { data: urlData } = supabase.storage.from('signatures').getPublicUrl(path)
    await sauvegarderSignatureMode('importee', urlData.publicUrl)
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'f4f6fb', fontFamily:'Sora,sans-serif' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:48, marginBottom:16 }}>🌉</div>
        <div style={{ fontSize:18, fontWeight:700, color:'#1a4b8f' }}>Passerelle</div>
        <div style={{ fontSize:13, color:'#9aa3b8', marginTop:8 }}>Chargement...</div>
      </div>
    </div>
  )

  return (
    <>
    {/* ===== MODAL CGU ===== */}
    {showCGU && (
      <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
        <div style={{ background:'#fff', borderRadius:16, padding:32, maxWidth:520, width:'100%', boxShadow:'0 8px 40px rgba(0,0,0,0.18)', fontFamily:'Sora,sans-serif' }}>
          <div style={{ fontSize:22, fontWeight:800, color:'#1a4b8f', marginBottom:4 }}>📋 Conditions Générales d'Utilisation</div>
          <div style={{ fontSize:12, color:'#9aa3b8', marginBottom:20 }}>Passerelle</div>
          <div style={{ background:'#f4f6fb', borderRadius:10, padding:16, maxHeight:280, overflowY:'auto', fontSize:12, color:'#3a4460', lineHeight:1.7, marginBottom:20 }}>
            <p><strong>Éditeur de l'application</strong><br/>Passerelle est développée et éditée par JP Créations, entreprise individuelle (auto-entrepreneur), immatriculée au R.C.S. de Paris sous le numéro 505 232 504, dont le siège social est situé 60 rue François 1er, 75008 Paris. Contact : jpcreations3d@gmail.com</p>
            <p><strong>1. Objet</strong><br/>L'application Passerelle est un outil de gestion administrative destiné aux assistants familiaux (AF). Elle permet la gestion des dossiers enfants confiés, des agendas, des fiches de présence et des documents professionnels. Elle est mise à disposition à titre professionnel, indépendamment de tout partenariat institutionnel.</p>
            <p><strong>2. Accès et confidentialité</strong><br/>L'accès à Passerelle est strictement personnel et nominatif. Chaque utilisateur est seul responsable de la confidentialité de ses identifiants. Les données relatives aux enfants confiés sont soumises au secret professionnel. Toute divulgation est interdite.</p>
            <p><strong>3. Données personnelles (RGPD)</strong><br/>Les données sont hébergées sur des serveurs européens (Supabase, région eu-west-1, Irlande), conformément au Règlement Général sur la Protection des Données (RGPD). Elles ne sont ni vendues ni transmises à des tiers. Vous disposez d'un droit d'accès, de rectification, de portabilité et de suppression, exerceable à l'adresse : jpcreations3d@gmail.com</p>
            <p><strong>4. Utilisation</strong><br/>L'application est mise à disposition à titre professionnel exclusivement. Toute utilisation abusive, détournement de données ou accès non autorisé est strictement interdit et susceptible d'engager la responsabilité de l'utilisateur.</p>
            <p><strong>5. Responsabilité</strong><br/>JP Créations, en tant qu'éditeur, ne saurait être tenu responsable des décisions professionnelles, administratives ou éducatives prises à partir des informations saisies dans l'application, ni des interruptions de service liées à des tiers (hébergeur, fournisseur d'accès).</p>
            <p><strong>6. Modifications</strong><br/>Ces CGU peuvent être mises à jour à tout moment. Vous serez informé de toute modification substantielle lors de votre prochaine connexion et devrez les accepter à nouveau.</p>
          </div>
          <button
            style={{ width:'100%', padding:'13px', background:'#1a4b8f', color:'#fff', border:'none', borderRadius:10, fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'Sora,sans-serif' }}
            onClick={accepterCGU}>
            ✅ J'accepte les CGU et je continue
          </button>
        </div>
      </div>
    )}

    {/* ===== MODAL SIGNATURE ===== */}
    {showSignature && (
      <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
        <div style={{ background:'#fff', borderRadius:16, padding:32, maxWidth:520, width:'100%', boxShadow:'0 8px 40px rgba(0,0,0,0.18)', fontFamily:'Sora,sans-serif' }}>

          {signatureEtape === 'choix' && (<>
            <div style={{ fontSize:20, fontWeight:800, color:'#1a4b8f', marginBottom:6 }}>✍️ Votre signature</div>
            <div style={{ fontSize:13, color:'#5a6478', marginBottom:24 }}>
              Choisissez comment vous souhaitez signer vos documents (fiches de présence, congés...).
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <button onClick={() => sauvegarderSignatureMode('chaque_fois')}
                style={{ padding:16, borderRadius:10, border:'2px solid #dde3f0', background:'#f4f6fb', color:'#1a2340', fontSize:13, fontWeight:600, cursor:'pointer', textAlign:'left' }}>
                ✏️ <strong>Signer à chaque fois</strong>
                <div style={{ fontSize:11, color:'#9aa3b8', marginTop:3 }}>Un canvas s'ouvrira à chaque génération de document</div>
              </button>
              <button onClick={() => setSignatureEtape('importer')}
                style={{ padding:16, borderRadius:10, border:'2px solid #dde3f0', background:'#f4f6fb', color:'#1a2340', fontSize:13, fontWeight:600, cursor:'pointer', textAlign:'left' }}>
                📎 <strong>Importer une signature</strong>
                <div style={{ fontSize:11, color:'#9aa3b8', marginTop:3 }}>Uploadez une image ou PDF de votre signature scannée</div>
              </button>
              <button onClick={() => setSignatureEtape('dessiner')}
                style={{ padding:16, borderRadius:10, border:'2px solid #1a4b8f', background:'#e8eef8', color:'#1a4b8f', fontSize:13, fontWeight:600, cursor:'pointer', textAlign:'left' }}>
                🖊️ <strong>Dessiner et sauvegarder</strong>
                <div style={{ fontSize:11, color:'#4a6aa0', marginTop:3 }}>Dessinez votre signature une fois, réutilisée automatiquement</div>
              </button>
            </div>
            <button onClick={() => sauvegarderSignatureMode('chaque_fois')}
              style={{ marginTop:16, width:'100%', padding:10, background:'none', border:'none', color:'#9aa3b8', fontSize:11, cursor:'pointer' }}>
              Ignorer pour l'instant
            </button>
          </>)}

          {signatureEtape === 'dessiner' && (<>
            <div style={{ fontSize:18, fontWeight:800, color:'#1a4b8f', marginBottom:4 }}>🖊️ Dessinez votre signature</div>
            <div style={{ fontSize:12, color:'#9aa3b8', marginBottom:12 }}>Utilisez votre doigt ou la souris dans le cadre ci-dessous</div>
            <canvas ref={canvasRef} width={440} height={160}
              style={{ border:'2px solid #dde3f0', borderRadius:10, width:'100%', touchAction:'none', background:'#fafbff', cursor:'crosshair' }}
              onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
              onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw} />
            <div style={{ display:'flex', gap:8, marginTop:10 }}>
              <button onClick={clearCanvas} style={{ flex:1, padding:10, borderRadius:8, border:'1px solid #dde3f0', background:'#f4f6fb', color:'#5a6478', fontSize:12, cursor:'pointer', fontWeight:600 }}>🗑️ Effacer</button>
              <button onClick={() => setSignatureEtape('choix')} style={{ flex:1, padding:10, borderRadius:8, border:'1px solid #dde3f0', background:'#f4f6fb', color:'#5a6478', fontSize:12, cursor:'pointer', fontWeight:600 }}>← Retour</button>
              <button onClick={sauvegarderSignatureDessinee} style={{ flex:2, padding:10, borderRadius:8, border:'none', background:'#1a4b8f', color:'#fff', fontSize:12, cursor:'pointer', fontWeight:700 }}>✅ Sauvegarder</button>
            </div>
          </>)}

          {signatureEtape === 'importer' && (<>
            <div style={{ fontSize:18, fontWeight:800, color:'#1a4b8f', marginBottom:4 }}>📎 Importer votre signature</div>
            <div style={{ fontSize:12, color:'#9aa3b8', marginBottom:20 }}>Sélectionnez une image (PNG, JPG) ou un PDF contenant votre signature</div>
            <label style={{ display:'block', border:'2px dashed #dde3f0', borderRadius:10, padding:28, textAlign:'center', cursor:'pointer', background:'#f4f6fb' }}>
              <div style={{ fontSize:28, marginBottom:8 }}>📁</div>
              <div style={{ fontSize:13, color:'#5a6478', fontWeight:600 }}>Cliquez pour choisir un fichier</div>
              <div style={{ fontSize:11, color:'#9aa3b8', marginTop:4 }}>PNG, JPG, PDF acceptés</div>
              <input type="file" accept="image/*,application/pdf" style={{ display:'none' }} onChange={importerSignature} />
            </label>
            <button onClick={() => setSignatureEtape('choix')} style={{ marginTop:12, width:'100%', padding:10, borderRadius:8, border:'1px solid #dde3f0', background:'#f4f6fb', color:'#5a6478', fontSize:12, cursor:'pointer', fontWeight:600 }}>← Retour</button>
          </>)}

        </div>
      </div>
    )}

    <Router>
      <Routes>
        <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />
        <Route path="/" element={session ? <Dashboard profile={profile} session={session} /> : <Navigate to="/login" />} />
        <Route path="/enfants" element={session ? <ListeEnfants profile={profile} /> : <Navigate to="/login" />} />
        <Route path="/enfants/:id" element={session ? <DossierEnfant profile={profile} /> : <Navigate to="/login" />} />
        <Route path="/enfants/:id/docs" element={session ? <DocumentsEnfant profile={profile} /> : <Navigate to="/login" />} />
        <Route path="/enfant/:id" element={session ? <DossierEnfant profile={profile} /> : <Navigate to="/login" />} />
        <Route path="/agenda" element={session ? <Agenda profile={profile} /> : <Navigate to="/login" />} />
        <Route path="/fiche-presence" element={session ? <FichePresencePermanent profile={profile} /> : <Navigate to="/login" />} />
        <Route path="/fiche-presence-intermittent" element={session ? <FichePresenceIntermittent profile={profile} /> : <Navigate to="/login" />} />
        <Route path="/rapports" element={session ? <Rapports profile={profile} /> : <Navigate to="/login" />} />
        <Route path="/assfam" element={session ? <Assfam profile={profile} /> : <Navigate to="/login" />} />
        <Route path="/assfam/:id" element={session ? <DossierAssfam profile={profile} /> : <Navigate to="/login" />} />
        <Route path="/documents" element={session ? <Documents profile={profile} /> : <Navigate to="/login" />} />
        <Route path="/ase" element={session ? <InterfaceASE profile={profile} /> : <Navigate to="/login" />} />
        <Route path="/frais" element={session ? <Frais profile={profile} /> : <Navigate to="/login" />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
    </>
  )
}
