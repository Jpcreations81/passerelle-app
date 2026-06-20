// Login.js — v2026-06-20d — infos stockées en métadonnées Auth, profil créé au premier login
import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [mode, setMode] = useState('connexion') // 'connexion' | 'inscription'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nom, setNom] = useState('')
  const [prenom, setPrenom] = useState('')
  const [ville, setVille] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

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

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          nom: nom.trim().toUpperCase(),
          prenom: prenom.trim(),
          ville: ville.trim() || null,
          role: 'af',
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
      // Le profil sera créé automatiquement à la première connexion réussie
      // (après confirmation de l'email), voir App.js → fetchProfile()
      setSuccess('✅ Compte créé ! Vérifiez votre email pour confirmer votre inscription, puis connectez-vous.')
      setMode('connexion')
      setNom(''); setPrenom(''); setVille(''); setPassword('')
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
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 20, background: '#f4f6fb', borderRadius: 10, padding: 4 }}>
            <button
              onClick={() => { setMode('connexion'); setError(''); setSuccess('') }}
              style={{
                flex: 1, padding: '8px', borderRadius: 7, border: 'none', cursor: 'pointer',
                fontFamily: 'Sora, sans-serif', fontSize: 13, fontWeight: 600,
                background: mode === 'connexion' ? '#fff' : 'transparent',
                color: mode === 'connexion' ? '#1a4b8f' : '#9aa3b8',
                boxShadow: mode === 'connexion' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none'
              }}>
              Connexion
            </button>
            <button
              onClick={() => { setMode('inscription'); setError(''); setSuccess('') }}
              style={{
                flex: 1, padding: '8px', borderRadius: 7, border: 'none', cursor: 'pointer',
                fontFamily: 'Sora, sans-serif', fontSize: 13, fontWeight: 600,
                background: mode === 'inscription' ? '#fff' : 'transparent',
                color: mode === 'inscription' ? '#1a4b8f' : '#9aa3b8',
                boxShadow: mode === 'inscription' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none'
              }}>
              Créer un compte
            </button>
          </div>

          {error && (
            <div style={{ background: '#fdf0ee', border: '1px solid #f5c4c4', borderRadius: 8, padding: '10px 13px', fontSize: 12, color: '#c0392b', marginBottom: 16 }}>
              ⚠️ {error}
            </div>
          )}
          {success && (
            <div style={{ background: '#eafaf0', border: '1px solid #a8e6c1', borderRadius: 8, padding: '10px 13px', fontSize: 12, color: '#15803d', marginBottom: 16 }}>
              {success}
            </div>
          )}

          {mode === 'connexion' ? (
            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 10, fontWeight: 600, color: '#5a6478', textTransform: 'uppercase', letterSpacing: '.4px', display: 'block', marginBottom: 5 }}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="votre@email.fr" required
                  style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #dde3f0', borderRadius: 8, fontFamily: 'Sora, sans-serif', fontSize: 13, background: '#f4f6fb', outline: 'none' }} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 10, fontWeight: 600, color: '#5a6478', textTransform: 'uppercase', letterSpacing: '.4px', display: 'block', marginBottom: 5 }}>Mot de passe</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required
                  style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #dde3f0', borderRadius: 8, fontFamily: 'Sora, sans-serif', fontSize: 13, background: '#f4f6fb', outline: 'none' }} />
              </div>
              <button type="submit" disabled={loading}
                style={{ width: '100%', padding: '13px', background: loading ? '#9aa3b8' : 'linear-gradient(135deg, #1a4b8f 0%, #2d7a1f 100%)', color: '#fff', border: 'none', borderRadius: 10, fontFamily: 'Sora, sans-serif', fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', transition: 'all .15s', boxShadow: loading ? 'none' : '0 4px 12px rgba(26,75,143,0.3)' }}>
                {loading ? '⏳ Connexion...' : '🔐 Se connecter'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleInscription}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 600, color: '#5a6478', textTransform: 'uppercase', letterSpacing: '.4px', display: 'block', marginBottom: 5 }}>Nom</label>
                  <input type="text" value={nom} onChange={e => setNom(e.target.value.toUpperCase())} placeholder="NOM" required
                    style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #dde3f0', borderRadius: 8, fontFamily: 'Sora, sans-serif', fontSize: 13, background: '#f4f6fb', outline: 'none', textTransform: 'uppercase' }} />
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 600, color: '#5a6478', textTransform: 'uppercase', letterSpacing: '.4px', display: 'block', marginBottom: 5 }}>Prénom</label>
                  <input type="text" value={prenom} onChange={e => setPrenom(e.target.value)} placeholder="Prénom" required
                    style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #dde3f0', borderRadius: 8, fontFamily: 'Sora, sans-serif', fontSize: 13, background: '#f4f6fb', outline: 'none' }} />
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 10, fontWeight: 600, color: '#5a6478', textTransform: 'uppercase', letterSpacing: '.4px', display: 'block', marginBottom: 5 }}>Ville</label>
                <input type="text" value={ville} onChange={e => setVille(e.target.value)} placeholder="Votre ville (optionnel)"
                  style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #dde3f0', borderRadius: 8, fontFamily: 'Sora, sans-serif', fontSize: 13, background: '#f4f6fb', outline: 'none' }} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 10, fontWeight: 600, color: '#5a6478', textTransform: 'uppercase', letterSpacing: '.4px', display: 'block', marginBottom: 5 }}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="votre@email.fr" required
                  style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #dde3f0', borderRadius: 8, fontFamily: 'Sora, sans-serif', fontSize: 13, background: '#f4f6fb', outline: 'none' }} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 10, fontWeight: 600, color: '#5a6478', textTransform: 'uppercase', letterSpacing: '.4px', display: 'block', marginBottom: 5 }}>Mot de passe</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="6 caractères minimum" required
                  style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #dde3f0', borderRadius: 8, fontFamily: 'Sora, sans-serif', fontSize: 13, background: '#f4f6fb', outline: 'none' }} />
              </div>
              <button type="submit" disabled={loading}
                style={{ width: '100%', padding: '13px', background: loading ? '#9aa3b8' : 'linear-gradient(135deg, #1a4b8f 0%, #2d7a1f 100%)', color: '#fff', border: 'none', borderRadius: 10, fontFamily: 'Sora, sans-serif', fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', transition: 'all .15s', boxShadow: loading ? 'none' : '0 4px 12px rgba(26,75,143,0.3)' }}>
                {loading ? '⏳ Création...' : '✅ Créer mon compte'}
              </button>
            </form>
          )}
        </div>

      </div>
    </div>
  )
}
