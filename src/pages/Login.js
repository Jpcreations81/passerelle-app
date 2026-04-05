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
      minHeight: '100vh', background: '#f4f6fb',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Sora, sans-serif', padding: 16
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Logo + titre */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 72, height: 72, borderRadius: 20,
            background: '#1a4b8f', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', boxShadow: '0 8px 24px rgba(26,75,143,.3)'
          }}>
            <span style={{ fontSize: 36 }}>🌉</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#1a4b8f' }}>Passerelle</h1>
          <p style={{ fontSize: 13, color: '#5a6478', marginTop: 6 }}>
            Un pont entre l'Assfam et l'ASE<br />
            <span style={{ fontSize: 11, color: '#9aa3b8' }}>Département du Tarn (81)</span>
          </p>
        </div>

        {/* Formulaire */}
        <div style={{
          background: '#fff', borderRadius: 16, padding: 28,
          boxShadow: '0 4px 24px rgba(26,75,143,.1)',
          border: '1px solid #dde3f0'
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
                background: loading ? '#9aa3b8' : '#1a4b8f',
                color: '#fff', border: 'none', borderRadius: 10,
                fontFamily: 'Sora, sans-serif', fontSize: 14,
                fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all .15s'
              }}
            >
              {loading ? '⏳ Connexion...' : '🔐 Se connecter'}
            </button>
          </form>
        </div>

        {/* Profils de test */}
        <div style={{
          background: '#e8eef8', borderRadius: 10, padding: 14,
          marginTop: 16, border: '1px solid #c4d4f5'
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#1a4b8f', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 8 }}>
            Comptes de test
          </div>
          {[
            { role: 'AF', email: 'marie.laurent@passerelle-af.fr', label: 'Marie Laurent' },
            { role: 'ASE', email: 'l.gondy@tarn.fr', label: 'Mme Gondy (Référente)' },
            { role: 'Encadrant', email: 'f.salles@tarn.fr', label: 'M. Salles' },
          ].map(u => (
            <div
              key={u.email}
              onClick={() => setEmail(u.email)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 8px', borderRadius: 6, cursor: 'pointer',
                marginBottom: 4, transition: 'background .1s'
              }}
              onMouseOver={e => e.currentTarget.style.background = '#d0dcf0'}
              onMouseOut={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{
                background: '#1a4b8f', color: '#fff',
                fontSize: 9, fontWeight: 700, padding: '2px 6px',
                borderRadius: 8, minWidth: 52, textAlign: 'center'
              }}>{u.role}</span>
              <span style={{ fontSize: 11, color: '#1c2333' }}>{u.label}</span>
              <span style={{ fontSize: 10, color: '#9aa3b8', marginLeft: 'auto' }}>{u.email}</span>
            </div>
          ))}
          <p style={{ fontSize: 10, color: '#9aa3b8', marginTop: 8 }}>
            Mot de passe de test : <strong>Passerelle2026!</strong>
          </p>
        </div>
      </div>
    </div>
  )
}
