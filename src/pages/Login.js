// Login.js — v2026-06-25e — debug log recherche AF similaires
import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [mode, setMode] = useState('connexion')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nom, setNom] = useState('')
  const [prenom, setPrenom] = useState('')
  const [ville, setVille] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showPasswordInscription, setShowPasswordInscription] = useState(false)
  // Détection profil temporaire
  const [profilTemp, setProfilTemp] = useState(null) // profil temporaire trouvé
  const [showConfirmTemp, setShowConfirmTemp] = useState(false) // modal confirmation

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Email ou mot de passe incorrect')
    setLoading(false)
  }

  async function handleInscription(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    if (!nom.trim() || !prenom.trim() || !email.trim() || !password) {
      setError('Tous les champs sont requis (sauf ville)')
      setLoading(false)
      return
    }
    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères')
      setLoading(false)
      return
    }

    // Chercher un profil temporaire via pg_trgm (tolérance fautes/accents)
    const { data: tempProfils, error: rpcError } = await supabase.rpc('rechercher_af_similaires', {
      p_nom: nom.trim().toUpperCase(),
      p_prenom: prenom.trim(),
      p_seuil: 0.4
    })
    console.log('Recherche AF similaires:', nom.trim().toUpperCase(), prenom.trim(), tempProfils, rpcError)

    if (tempProfils && tempProfils.length > 0) {
      // Profil temporaire trouvé — demander confirmation
      setProfilTemp(tempProfils[0])
      setShowConfirmTemp(true)
      setLoading(false)
      return
    }

    // Pas de profil temporaire → inscription normale
    await creerCompte()
  }

  async function creerCompte(profilTempId = null) {
    setLoading(true)
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          nom: nom.trim().toUpperCase(),
          prenom: prenom.trim(),
          ville: ville.trim() || null,
          role: 'af',
          ...(profilTempId ? { profil_temp_id: profilTempId } : {})
        }
      }
    })

    if (signUpError) {
      setError(signUpError.message === 'User already registered'
        ? 'Un compte existe déjà avec cet email'
        : 'Erreur lors de la création du compte : ' + signUpError.message)
      setLoading(false)
      return
    }

    if (data?.user) {
      // Si profil temporaire confirmé → transférer les enfants vers le nouveau profil
      if (profilTempId) {
        // Mettre à jour les enfants qui référencent le profil temporaire
        await supabase.from('enfants')
          .update({ af_principal_id: data.user.id })
          .eq('af_principal_id', profilTempId)
        // Supprimer le profil temporaire (le trigger a créé le vrai profil)
        await supabase.from('profiles')
          .delete()
          .eq('id', profilTempId)
      }

      setSuccess('✅ Compte créé ! Vérifiez votre email pour confirmer votre inscription, puis connectez-vous.')
      setMode('connexion')
      setNom(''); setPrenom(''); setVille(''); setPassword('')
      setShowConfirmTemp(false)
      setProfilTemp(null)
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #0d2b5e 0%, #1a4b8f 55%, #2d7a1f 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Sora, sans-serif', padding: 16, position: 'relative', overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 25% 20%, rgba(45,122,31,0.2) 0%, transparent 55%), radial-gradient(ellipse at 80% 80%, rgba(13,43,94,0.3) 0%, transparent 50%)'
      }} />

      <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}>

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ margin: '0 auto 20px', display: 'flex', justifyContent: 'center' }}>
            <img
              src="/logo_transparent.png"
              alt="Passerelle"
              style={{ height: 90, width: 'auto', objectFit: 'contain', filter: 'brightness(0) invert(1)' }}
              onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block' }}
            />
            <span style={{ fontSize: 40, display: 'none', color: '#fff' }}>🌉</span>
          </div>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 6 }}>
            Un pont entre l'Assfam et l'ASE<br />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Département du Tarn (81)</span>
          </p>
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.95)', borderRadius: 20, padding: 28,
          boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
          border: '1px solid rgba(255,255,255,0.3)',
          WebkitBackdropFilter: 'blur(10px)', backdropFilter: 'blur(10px)'
        }}>

          {/* ── Modal confirmation profil temporaire ── */}
          {showConfirmTemp && profilTemp && (
            <div style={{ background:'#fffbeb', border:'1px solid #fcd34d', borderRadius:12, padding:20, marginBottom:20 }}>
              <div style={{ fontSize:22, textAlign:'center', marginBottom:12 }}>👋</div>
              <div style={{ fontSize:14, fontWeight:700, color:'#b45309', marginBottom:10, textAlign:'center' }}>
                Vous existez déjà dans Passerelle !
              </div>
              <div style={{ fontSize:13, color:'#5a6478', marginBottom:16, lineHeight:1.7 }}>
                Un profil a été créé pour <strong>{profilTemp.prenom} {profilTemp.nom}</strong>
                {profilTemp.ville && ` (${profilTemp.ville})`}.
                <br />Est-ce bien vous ?
              </div>
              {/* Enfants liés */}
              <EnfantsLies profilId={profilTemp.id} />
              <div style={{ display:'flex', gap:10, marginTop:16 }}>
                <button
                  onClick={() => creerCompte(profilTemp.id)}
                  disabled={loading}
                  style={{ flex:1, padding:'11px', background:'linear-gradient(135deg,#1a4b8f,#2d7a1f)', color:'#fff', border:'none', borderRadius:10, fontFamily:'Sora,sans-serif', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                  ✅ Oui, c'est moi !
                </button>
                <button
                  onClick={() => { setShowConfirmTemp(false); setProfilTemp(null); creerCompte() }}
                  disabled={loading}
                  style={{ flex:1, padding:'11px', background:'#f4f6fb', color:'#5a6478', border:'1px solid #dde3f0', borderRadius:10, fontFamily:'Sora,sans-serif', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                  Non, créer un nouveau compte
                </button>
              </div>
            </div>
          )}

          {!showConfirmTemp && (
            <>
              <div style={{ display: 'flex', gap: 6, marginBottom: 20, background: '#f4f6fb', borderRadius: 10, padding: 4 }}>
                <button onClick={() => { setMode('connexion'); setError(''); setSuccess('') }}
                  style={{ flex:1, padding:'8px', borderRadius:7, border:'none', cursor:'pointer', fontFamily:'Sora, sans-serif', fontSize:13, fontWeight:600, background: mode==='connexion' ? '#fff' : 'transparent', color: mode==='connexion' ? '#1a4b8f' : '#9aa3b8', boxShadow: mode==='connexion' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none' }}>
                  Connexion
                </button>
                <button onClick={() => { setMode('inscription'); setError(''); setSuccess('') }}
                  style={{ flex:1, padding:'8px', borderRadius:7, border:'none', cursor:'pointer', fontFamily:'Sora, sans-serif', fontSize:13, fontWeight:600, background: mode==='inscription' ? '#fff' : 'transparent', color: mode==='inscription' ? '#1a4b8f' : '#9aa3b8', boxShadow: mode==='inscription' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none' }}>
                  Créer un compte
                </button>
              </div>

              {error && (
                <div style={{ background:'#fdf0ee', border:'1px solid #f5c4c4', borderRadius:8, padding:'10px 13px', fontSize:12, color:'#c0392b', marginBottom:16 }}>
                  ⚠️ {error}
                </div>
              )}
              {success && (
                <div style={{ background:'#eafaf0', border:'1px solid #a8e6c1', borderRadius:8, padding:'10px 13px', fontSize:12, color:'#15803d', marginBottom:16 }}>
                  {success}
                </div>
              )}

              {mode === 'connexion' ? (
                <form onSubmit={handleLogin}>
                  <div style={{ marginBottom:14 }}>
                    <label style={{ fontSize:10, fontWeight:600, color:'#5a6478', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:5 }}>Email</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="votre@email.fr" required
                      style={{ width:'100%', padding:'10px 12px', border:'1.5px solid #dde3f0', borderRadius:8, fontFamily:'Sora, sans-serif', fontSize:13, background:'#f4f6fb', outline:'none' }} />
                  </div>
                  <div style={{ marginBottom:20 }}>
                    <label style={{ fontSize:10, fontWeight:600, color:'#5a6478', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:5 }}>Mot de passe</label>
                    <div style={{ position:'relative' }}>
                      <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required
                        style={{ width:'100%', padding:'10px 40px 10px 12px', border:'1.5px solid #dde3f0', borderRadius:8, fontFamily:'Sora, sans-serif', fontSize:13, background:'#f4f6fb', outline:'none', boxSizing:'border-box' }} />
                      <button type="button" onClick={() => setShowPassword(p => !p)}
                        style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:16, color:'#9aa3b8', padding:0 }}>
                        {showPassword ? '🙈' : '👁️'}
                      </button>
                    </div>
                  </div>
                  <button type="submit" disabled={loading}
                    style={{ width:'100%', padding:'13px', background: loading ? '#9aa3b8' : 'linear-gradient(135deg, #1a4b8f 0%, #2d7a1f 100%)', color:'#fff', border:'none', borderRadius:10, fontFamily:'Sora, sans-serif', fontSize:14, fontWeight:600, cursor: loading ? 'not-allowed' : 'pointer', transition:'all .15s', boxShadow: loading ? 'none' : '0 4px 12px rgba(26,75,143,0.3)' }}>
                    {loading ? '⏳ Connexion...' : '🔐 Se connecter'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleInscription}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
                    <div>
                      <label style={{ fontSize:10, fontWeight:600, color:'#5a6478', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:5 }}>Nom</label>
                      <input type="text" value={nom} onChange={e => setNom(e.target.value.toUpperCase())} placeholder="NOM" required
                        style={{ width:'100%', padding:'10px 12px', border:'1.5px solid #dde3f0', borderRadius:8, fontFamily:'Sora, sans-serif', fontSize:13, background:'#f4f6fb', outline:'none', textTransform:'uppercase' }} />
                    </div>
                    <div>
                      <label style={{ fontSize:10, fontWeight:600, color:'#5a6478', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:5 }}>Prénom</label>
                      <input type="text" value={prenom} onChange={e => setPrenom(e.target.value)} placeholder="Prénom" required
                        style={{ width:'100%', padding:'10px 12px', border:'1.5px solid #dde3f0', borderRadius:8, fontFamily:'Sora, sans-serif', fontSize:13, background:'#f4f6fb', outline:'none' }} />
                    </div>
                  </div>
                  <div style={{ marginBottom:14 }}>
                    <label style={{ fontSize:10, fontWeight:600, color:'#5a6478', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:5 }}>Ville</label>
                    <input type="text" value={ville} onChange={e => setVille(e.target.value)} placeholder="Votre ville (optionnel)"
                      style={{ width:'100%', padding:'10px 12px', border:'1.5px solid #dde3f0', borderRadius:8, fontFamily:'Sora, sans-serif', fontSize:13, background:'#f4f6fb', outline:'none' }} />
                  </div>
                  <div style={{ marginBottom:14 }}>
                    <label style={{ fontSize:10, fontWeight:600, color:'#5a6478', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:5 }}>Email</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="votre@email.fr" required
                      style={{ width:'100%', padding:'10px 12px', border:'1.5px solid #dde3f0', borderRadius:8, fontFamily:'Sora, sans-serif', fontSize:13, background:'#f4f6fb', outline:'none' }} />
                  </div>
                  <div style={{ marginBottom:20 }}>
                    <label style={{ fontSize:10, fontWeight:600, color:'#5a6478', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:5 }}>Mot de passe</label>
                    <div style={{ position:'relative' }}>
                      <input type={showPasswordInscription ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="6 caractères minimum" required
                        style={{ width:'100%', padding:'10px 40px 10px 12px', border:'1.5px solid #dde3f0', borderRadius:8, fontFamily:'Sora, sans-serif', fontSize:13, background:'#f4f6fb', outline:'none', boxSizing:'border-box' }} />
                      <button type="button" onClick={() => setShowPasswordInscription(p => !p)}
                        style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:16, color:'#9aa3b8', padding:0 }}>
                        {showPasswordInscription ? '🙈' : '👁️'}
                      </button>
                    </div>
                  </div>
                  <button type="submit" disabled={loading}
                    style={{ width:'100%', padding:'13px', background: loading ? '#9aa3b8' : 'linear-gradient(135deg, #1a4b8f 0%, #2d7a1f 100%)', color:'#fff', border:'none', borderRadius:10, fontFamily:'Sora, sans-serif', fontSize:14, fontWeight:600, cursor: loading ? 'not-allowed' : 'pointer', transition:'all .15s', boxShadow: loading ? 'none' : '0 4px 12px rgba(26,75,143,0.3)' }}>
                    {loading ? '⏳ Création...' : '✅ Créer mon compte'}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// Composant qui affiche les enfants liés au profil temporaire
function EnfantsLies({ profilId }) {
  const [enfants, setEnfants] = React.useState([])
  React.useEffect(() => {
    supabase.from('enfants')
      .select('id, prenom, nom')
      .eq('af_principal_id', profilId)
      .then(({ data }) => { if (data) setEnfants(data) })
  }, [profilId])
  if (enfants.length === 0) return null
  return (
    <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#15803d' }}>
      👶 Enfant{enfants.length > 1 ? 's' : ''} en accueil : <strong>{enfants.map(e => `${e.prenom} ${e.nom}`).join(', ')}</strong>
    </div>
  )
}
