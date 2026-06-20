// Login.js — v2026-06-20b — retrait texte "Passerelle" en double (logo seul conservé)
import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Email ou mot de passe incorrect')
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #0d2b5e 0%, #1a4b8f 55%, #2d7a1f 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Sora, sans-serif', padding: 16, position: 'relative', overflow: 'hidden'
    }}>
      {/* Effet radial en arrière-plan */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 25% 20%, rgba(45,122,31,0.2) 0%, transparent 55%), radial-gradient(ellipse at 80% 80%, rgba(13,43,94,0.3) 0%, transparent 50%)'
      }} />

      <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}>

        {/* Logo + titre */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ margin: '0 auto 20px', display: 'flex', justifyContent: 'center' }}>
            <img
              src="/logo_transparent.png"
              alt="Passerelle"
              style={{
                height: 90,
                width: 'auto',
                objectFit: 'contain',
                filter: 'brightness(0) invert(1)'
              }}
              onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block' }}
            />
            <span style={{ fontSize: 40, display: 'none', color: '#fff' }}>🌉</span>
          </div>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 6 }}>
            Un pont entre l'Assfam et l'ASE<br />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Département du Tarn (81)</span>
          </p>
        </div>

        {/* Formulaire */}
        <div style={{
          background: 'rgba(255,255,255,0.95)', borderRadius: 20, padding: 28,
          boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
          border: '1px solid rgba(255,255,255,0.3)',
          backdropFilter: 'blur(10px)'
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20, color: '#1c2333' }}>
            Connexion
          </h2>

          {error && (
            <div style={{
              background: '#fdf0ee', border: '1px solid #f5c4c4',
              borderRadius: 8, padding: '10px 13px',
              fontSize: 12, color: '#c0392b', marginBottom: 16
            }}>
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 14 }}>
              <label style={{
                fontSize: 10, fontWeight: 600, color: '#5a6478',
                textTransform: 'uppercase', letterSpacing: '.4px',
                display: 'block', marginBottom: 5
              }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="votre@email.fr"
                required
                style={{
                  width: '100%', padding: '10px 12px',
                  border: '1.5px solid #dde3f0', borderRadius: 8,
                  fontFamily: 'Sora, sans-serif', fontSize: 13,
                  background: '#f4f6fb', outline: 'none'
                }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{
                fontSize: 10, fontWeight: 600, color: '#5a6478',
                textTransform: 'uppercase', letterSpacing: '.4px',
                display: 'block', marginBottom: 5
              }}>Mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  width: '100%', padding: '10px 12px',
                  border: '1.5px solid #dde3f0', borderRadius: 8,
                  fontFamily: 'Sora, sans-serif', fontSize: 13,
                  background: '#f4f6fb', outline: 'none'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '13px',
                background: loading ? '#9aa3b8' : 'linear-gradient(135deg, #1a4b8f 0%, #2d7a1f 100%)',
                color: '#fff', border: 'none', borderRadius: 10,
                fontFamily: 'Sora, sans-serif', fontSize: 14,
                fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all .15s', boxShadow: loading ? 'none' : '0 4px 12px rgba(26,75,143,0.3)'
              }}
            >
              {loading ? '⏳ Connexion...' : '🔐 Se connecter'}
            </button>
          </form>
        </div>

      </div>
    </div>
  )
}
