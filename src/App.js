import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ListeEnfants from './pages/ListeEnfants'
import DossierEnfant from './pages/DossierEnfant'
import DocumentsEnfant from './pages/DocumentsEnfant'
import Agenda from './pages/Agenda'
import FichePresence from './pages/FichePresence'
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
    <Router>
      <Routes>
        <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />
        <Route path="/" element={session ? <Dashboard profile={profile} session={session} /> : <Navigate to="/login" />} />
        <Route path="/enfants" element={session ? <ListeEnfants profile={profile} /> : <Navigate to="/login" />} />
        <Route path="/enfants/:id" element={session ? <DossierEnfant profile={profile} /> : <Navigate to="/login" />} />
        <Route path="/enfants/:id/docs" element={session ? <DocumentsEnfant profile={profile} /> : <Navigate to="/login" />} />
        <Route path="/enfant/:id" element={session ? <DossierEnfant profile={profile} /> : <Navigate to="/login" />} />
        <Route path="/agenda" element={session ? <Agenda profile={profile} /> : <Navigate to="/login" />} />
        <Route path="/fiche-presence" element={session ? <FichePresence profile={profile} /> : <Navigate to="/login" />} />
        <Route path="/rapports" element={session ? <Rapports profile={profile} /> : <Navigate to="/login" />} />
        <Route path="/assfam" element={session ? <Assfam profile={profile} /> : <Navigate to="/login" />} />
        <Route path="/assfam/:id" element={session ? <DossierAssfam profile={profile} /> : <Navigate to="/login" />} />
        <Route path="/documents" element={session ? <Documents profile={profile} /> : <Navigate to="/login" />} />
        <Route path="/ase" element={session ? <InterfaceASE profile={profile} /> : <Navigate to="/login" />} />
        <Route path="/frais" element={session ? <Frais profile={profile} /> : <Navigate to="/login" />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  )
}
