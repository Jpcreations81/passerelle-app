// Frais.js — v2026-05-13c — barème SNCF formation (aller seulement) + pro (AR kilométrique)
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Sidebar from '../components/Sidebar'

const GOOGLE_MAPS_KEY = process.env.REACT_APP_GOOGLE_MAPS_KEY

// ── Barème kilométrique Tarn — arrêté ministériel 14 mars 2022 ───────────────
function getTauxKm(cv, kmCumules) {
  // Tranches : ≤2000 km / 2001-10000 km / >10000 km
  const baremes = {
    5:  [0.32, 0.40, 0.23], // 5 CV et moins
    7:  [0.41, 0.51, 0.30], // 6 et 7 CV
    99: [0.45, 0.55, 0.32], // 8 CV et plus
  }
  let b
  if (cv <= 5) b = baremes[5]
  else if (cv <= 7) b = baremes[7]
  else b = baremes[99]
  if (kmCumules <= 2000) return b[0]
  if (kmCumules <= 10000) return b[1]
  return b[2]
}

// ── Barème SNCF 2ème classe — formation (aller seulement) ────────────────────
// Formule : montant = a + (distance × b)
function getMontantSNCF(distanceKm) {
  const d = Math.round(distanceKm)
  if (d <= 0) return 0
  if (d <= 16)  return Math.round((0.7781 + d * 0.1944) * 100) / 100
  if (d <= 32)  return Math.round((0.2503 + d * 0.2165) * 100) / 100
  if (d <= 64)  return Math.round((2.0706 + d * 0.1597) * 100) / 100
  if (d <= 109) return Math.round((2.8891 + d * 0.1489) * 100) / 100
  if (d <= 149) return Math.round((4.0864 + d * 0.1425) * 100) / 100
  return Math.round((8.0871 + d * 0.1193) * 100) / 100
}

// Catégories formation (aller seulement, barème SNCF)
const CATS_FORMATION = ['formation']
// Catégories pro (AR, barème kilométrique Tarn)
const CATS_PRO = ['vm', 'medical', 'scolaire', 'ase', 'relais', 'autre']

// ── Calcul distance Google Maps ───────────────────────────────────────────────
async function calculerDistance(origine, destination) {
  try {
    const resp = await fetch(`/api/distance?origine=${encodeURIComponent(origine)}&destination=${encodeURIComponent(destination)}`)
    if (!resp.ok) throw new Error('Erreur API ' + resp.status)
    const data = await resp.json()
    if (data.km) return data.km
    return null
  } catch (e) {
    console.error('Erreur calcul distance:', e)
    return null
  }
}

// ── Calcul boucle optimisée ───────────────────────────────────────────────────
async function calculerBoucle(etapes) {
  // etapes = [{ adresse, label }] dans l'ordre indiqué par l'AF
  // Calcul : etape[0] → etape[1] → ... → etape[n] → domicile
  let totalKm = 0
  for (let i = 0; i < etapes.length - 1; i++) {
    const km = await calculerDistance(etapes[i].adresse, etapes[i + 1].adresse)
    if (km) totalKm += km
  }
  return Math.round(totalKm * 10) / 10
}

// ── Formatage date ────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return ''
  const d = iso.split('T')[0]
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function fmtDateCourt(iso) {
  if (!iso) return ''
  const d = iso.split('T')[0]
  const [, m, day] = d.split('-')
  const date = new Date(iso)
  const jours = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
  return `${jours[date.getDay()]} ${day}/${m}`
}

const MOIS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

const CATS_AVEC_DEPLACEMENT = ['vm', 'medical', 'scolaire', 'ase', 'relais', 'formation', 'autre']

export default function Frais({ profile }) {
  const navigate = useNavigate()
  const printRef = useRef(null)

  const now = new Date()
  const [mois, setMois] = useState(now.getMonth())
  const [annee, setAnnee] = useState(now.getFullYear())
  const [loading, setLoading] = useState(false)
  const [calcul, setCalcul] = useState(false)
  const [lignes, setLignes] = useState([]) // une ligne par trajet
  const [enfants, setEnfants] = useState([])
  const [toast, setToast] = useState('')
  const [domicile, setDomicile] = useState('')
  const [cv, setCv] = useState(5)
  const [kmCumules, setKmCumules] = useState(0)

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  // ── Charger profil AF ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!profile) return
    const adresse = [profile.adresse, profile.code_postal, profile.ville].filter(Boolean).join(' ')
    setDomicile(adresse)
    setCv(profile.vehicule_cv || 5)
    setKmCumules(profile.km_cumules_annee || 0)
  }, [profile])

  // ── Charger enfants ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!profile) return
    supabase.from('enfants').select('id, prenom, nom, af_principal_id')
      .eq('af_principal_id', profile.id)
      .then(({ data }) => { if (data) setEnfants(data) })
  }, [profile])

  // ── Charger événements du mois ────────────────────────────────────────────
  const chargerEvenements = useCallback(async () => {
    if (!profile || !domicile) return
    setLoading(true)
    setLignes([])

    const debut = new Date(annee, mois, 1)
    const fin = new Date(annee, mois + 1, 0, 23, 59, 59)

    const { data: evts } = await supabase
      .from('evenements')
      .select('*')
      .eq('af_id', profile.id)
      .in('categorie', CATS_AVEC_DEPLACEMENT)
      .gte('date_debut', debut.toISOString())
      .lte('date_debut', fin.toISOString())
      .order('date_debut', { ascending: true })

    if (!evts || evts.length === 0) { setLoading(false); return }

    // Grouper par jour
    const parJour = {}
    evts.forEach(e => {
      const jour = e.date_debut.slice(0, 10)
      if (!parJour[jour]) parJour[jour] = []
      parJour[jour].push(e)
    })

    // Construire les lignes de frais
    const nouvLignes = []
    for (const [jour, evtsDuJour] of Object.entries(parJour)) {
      const evtsAvecLieu = evtsDuJour.filter(e => e.lieu)
      if (evtsAvecLieu.length === 0) continue

      // Séparer formations et déplacements pro
      const evtsFormation = evtsAvecLieu.filter(e => CATS_FORMATION.includes(e.categorie))
      const evtsPro = evtsAvecLieu.filter(e => CATS_PRO.includes(e.categorie))

      // Formations → aller seulement (barème SNCF)
      evtsFormation.forEach(e => {
        nouvLignes.push({
          id: e.id,
          date: jour,
          type: 'formation',
          typeLabel: '🎓 Formation (aller SNCF)',
          evenements: [e],
          etapes: [
            { adresse: domicile, label: 'Domicile' },
            { adresse: e.lieu, label: e.titre },
          ],
          km: null,
          montantSNCF: null, // calculé après km
          taux: null, // pas de taux km pour formation
          repas: false,
          repas_montant: '',
          peage: false,
          peage_montant: '',
          notes: '',
          editable: true,
        })
      })

      // Déplacements pro → AR (barème kilométrique Tarn)
      if (evtsPro.length === 1) {
        const e = evtsPro[0]
        nouvLignes.push({
          id: e.id,
          date: jour,
          type: 'ar',
          typeLabel: '↔️ Aller-Retour',
          evenements: [e],
          etapes: [
            { adresse: domicile, label: 'Domicile' },
            { adresse: e.lieu, label: e.titre },
            { adresse: domicile, label: 'Domicile' },
          ],
          km: null,
          taux: getTauxKm(cv, kmCumules),
          repas: false,
          repas_montant: '',
          peage: false,
          peage_montant: '',
          notes: '',
          editable: true,
        })
      } else if (evtsPro.length > 1) {
        // Boucle
        const etapes = [
          { adresse: domicile, label: 'Domicile (départ)' },
          ...evtsPro.map(e => ({ adresse: e.lieu, label: e.titre, evtId: e.id })),
          { adresse: domicile, label: 'Domicile (retour)' },
        ]
        nouvLignes.push({
          id: `boucle-${jour}`,
          date: jour,
          type: 'boucle',
          typeLabel: '🔄 Boucle',
          evenements: evtsPro,
          etapes,
          km: null,
          taux: getTauxKm(cv, kmCumules),
          repas: false,
          repas_montant: '',
          peage: false,
          peage_montant: '',
          notes: '',
          editable: true,
          ordreEditable: true,
        })
      }
    }

    setLignes(nouvLignes)
    setLoading(false)
  }, [profile, domicile, mois, annee, cv, kmCumules])

  // ── Calculer toutes les distances ─────────────────────────────────────────
  async function calculerTout() {
    setCalcul(true)
    const updated = await Promise.all(lignes.map(async ligne => {
      if (ligne.km !== null) return ligne
      const km = await calculerBoucle(ligne.etapes)
      if (ligne.type === 'formation') {
        // Formation : aller seulement → montant SNCF
        const montantSNCF = km ? getMontantSNCF(km) : null
        return { ...ligne, km, montantSNCF }
      }
      return { ...ligne, km }
    }))
    setLignes(updated)
    setCalcul(false)
    showToast('✅ Distances calculées !')
  }

  // ── Mettre à jour une ligne ───────────────────────────────────────────────
  function updateLigne(id, champ, valeur) {
    setLignes(prev => prev.map(l => l.id === id ? { ...l, [champ]: valeur } : l))
  }

  // ── Réordonner les étapes d'une boucle ───────────────────────────────────
  function monterEtape(ligneId, idx) {
    setLignes(prev => prev.map(l => {
      if (l.id !== ligneId) return l
      const etapes = [...l.etapes]
      // Ne pas déplacer domicile départ (idx=0) ni retour (idx=last)
      if (idx <= 1 || idx >= etapes.length - 1) return l
      ;[etapes[idx], etapes[idx - 1]] = [etapes[idx - 1], etapes[idx]]
      return { ...l, etapes, km: null } // reset km car ordre changé
    }))
  }

  function descendreEtape(ligneId, idx) {
    setLignes(prev => prev.map(l => {
      if (l.id !== ligneId) return l
      const etapes = [...l.etapes]
      if (idx <= 0 || idx >= etapes.length - 2) return l
      ;[etapes[idx], etapes[idx + 1]] = [etapes[idx + 1], etapes[idx]]
      return { ...l, etapes, km: null }
    }))
  }

  // ── Totaux ────────────────────────────────────────────────────────────────
  const totalKmPro = lignes.filter(l => l.type !== 'formation').reduce((s, l) => s + (l.km || 0), 0)
  const totalKmFormation = lignes.filter(l => l.type === 'formation').reduce((s, l) => s + (l.km || 0), 0)
  const totalKm = totalKmPro + totalKmFormation
  const totalIndemnitePro = lignes.filter(l => l.type !== 'formation').reduce((s, l) => s + ((l.km || 0) * (l.taux || 0)), 0)
  const totalIndemniteFormation = lignes.filter(l => l.type === 'formation').reduce((s, l) => s + (l.montantSNCF || 0), 0)
  const totalIndemnite = totalIndemnitePro + totalIndemniteFormation
  const totalRepas = lignes.reduce((s, l) => l.repas && l.repas_montant ? s + parseFloat(l.repas_montant || 0) : s, 0)
  const totalPeage = lignes.reduce((s, l) => l.peage && l.peage_montant ? s + parseFloat(l.peage_montant || 0) : s, 0)
  const totalGeneral = totalIndemnite + totalRepas + totalPeage

  // ── Impression PDF ────────────────────────────────────────────────────────
  function imprimerPDF() {
    window.print()
  }

  if (!profile) return null

  return (
    <div className="app-layout">
      <Sidebar profile={profile} />
      <div className="main-content" ref={printRef}>

        {/* ── Header ── */}
        <header className="page-header">
          <img src="/logo_transparent.png" alt="P" className="header-logo" onError={e => e.target.style.display='none'} />
          <div className="header-sep" />
          <div style={{ flex:1 }}>
            <div className="page-title">🚗 Frais kilométriques</div>
            <div className="page-subtitle">{profile.nom} {profile.prenom} · {profile.matricule}</div>
          </div>
          <div className="header-actions">
            <button onClick={imprimerPDF} className="btn btn-secondary" style={{ fontSize:12 }}>
              🖨️ Imprimer / PDF
            </button>
          </div>
        </header>

        <div style={{ padding:24 }}>

          {/* ── Sélection mois + infos véhicule ── */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:20 }}>

            {/* Période */}
            <div style={{ background:'#fff', border:'1px solid #dde3f0', borderRadius:12, padding:16, boxShadow:'0 2px 8px rgba(26,75,143,.06)' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#5a6478', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:10 }}>📅 Période</div>
              <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                <select className="form-control" style={{ flex:1 }} value={mois} onChange={e => setMois(parseInt(e.target.value))}>
                  {MOIS_FR.map((m, i) => <option key={i} value={i}>{m}</option>)}
                </select>
                <select className="form-control" style={{ width:90 }} value={annee} onChange={e => setAnnee(parseInt(e.target.value))}>
                  {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <button onClick={chargerEvenements} className="btn btn-primary" style={{ whiteSpace:'nowrap' }}>
                  📋 Charger
                </button>
              </div>
            </div>

            {/* Véhicule */}
            <div style={{ background:'#fff', border:'1px solid #dde3f0', borderRadius:12, padding:16, boxShadow:'0 2px 8px rgba(26,75,143,.06)' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#5a6478', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:10 }}>🚗 Véhicule</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
                <div>
                  <div style={{ fontSize:10, color:'#9aa3b8', marginBottom:3 }}>CV fiscaux</div>
                  <select className="form-control" value={cv} onChange={e => setCv(parseInt(e.target.value))}>
                    <option value={5}>5 CV et moins</option>
                    <option value={6}>6 CV</option>
                    <option value={7}>7 CV</option>
                    <option value={8}>8 CV et plus</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize:10, color:'#9aa3b8', marginBottom:3 }}>Km cumulés 2026</div>
                  <input className="form-control" type="number" value={kmCumules}
                    onChange={e => setKmCumules(parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <div style={{ fontSize:10, color:'#9aa3b8', marginBottom:3 }}>Taux actuel</div>
                  <div style={{ padding:'10px 12px', background:'#e6f5eb', borderRadius:8, fontSize:13, fontWeight:700, color:'#2e8b4a' }}>
                    {getTauxKm(cv, kmCumules).toFixed(3)} €/km
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Bouton calculer distances ── */}
          {lignes.length > 0 && (
            <div style={{ marginBottom:16, display:'flex', gap:10, alignItems:'center' }}>
              <button onClick={calculerTout} className="btn btn-primary" disabled={calcul}>
                {calcul ? '⏳ Calcul en cours...' : '📍 Calculer les distances'}
              </button>
              <span style={{ fontSize:11, color:'#9aa3b8' }}>
                Via Google Maps — trajet le plus court
              </span>
            </div>
          )}

          {/* ── Tableau des trajets ── */}
          {loading ? (
            <div style={{ textAlign:'center', padding:60, color:'#9aa3b8' }}>
              <div style={{ fontSize:36, marginBottom:12 }}>🚗</div>
              <div>Chargement des événements...</div>
            </div>
          ) : lignes.length === 0 ? (
            <div style={{ textAlign:'center', padding:60, color:'#9aa3b8', border:'2px dashed #dde3f0', borderRadius:12 }}>
              <div style={{ fontSize:36, marginBottom:12 }}>📋</div>
              <div style={{ fontSize:14 }}>Sélectionnez un mois et cliquez sur "Charger"</div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {lignes.map((ligne, idx) => (
                <div key={ligne.id} style={{ background:'#fff', border:'1px solid #dde3f0', borderRadius:12, overflow:'hidden', boxShadow:'0 2px 8px rgba(26,75,143,.06)' }}>

                  {/* En-tête ligne */}
                  <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 16px', background: ligne.type === 'boucle' ? '#f0ebfb' : '#f4f6fb', borderBottom:'1px solid #dde3f0' }}>
                    <span style={{ fontSize:18 }}>{ligne.type === 'boucle' ? '🔄' : '↔️'}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:'#1c2333' }}>
                        {fmtDateCourt(ligne.date)} — {ligne.type === 'boucle' ? 'Boucle' : 'Aller-Retour'}
                      </div>
                      <div style={{ fontSize:11, color:'#9aa3b8' }}>
                        {ligne.evenements.map(e => e.titre).join(' · ')}
                      </div>
                    </div>
                    {/* Km */}
                    <div style={{ textAlign:'right' }}>
                      {ligne.km !== null ? (
                        <div>
                          <input type="number" value={ligne.km} step="0.1" min="0"
                            onChange={e => updateLigne(ligne.id, 'km', parseFloat(e.target.value) || 0)}
                            style={{ width:70, padding:'4px 8px', border:'1.5px solid #dde3f0', borderRadius:7, fontSize:13, fontWeight:700, textAlign:'center', fontFamily:'Sora,sans-serif' }} />
                          <span style={{ fontSize:11, color:'#9aa3b8', marginLeft:4 }}>km</span>
                        </div>
                      ) : (
                        <span style={{ fontSize:11, color:'#9aa3b8', fontStyle:'italic' }}>— km</span>
                      )}
                    </div>
                  </div>

                  {/* Étapes */}
                  <div style={{ padding:'10px 16px', borderBottom:'1px solid #f0f0f0' }}>
                    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                      {ligne.etapes.map((etape, i) => (
                        <div key={i} style={{ display:'flex', alignItems:'center', gap:8, fontSize:11 }}>
                          <span style={{ color: i === 0 ? '#2e8b4a' : i === ligne.etapes.length-1 ? '#c0392b' : '#1a4b8f', fontWeight:700, minWidth:16 }}>
                            {i === 0 ? '🏠' : i === ligne.etapes.length-1 ? '🏁' : `${i}.`}
                          </span>
                          <span style={{ flex:1, color:'#5a6478' }}>{etape.label}</span>
                          <span style={{ color:'#9aa3b8', fontSize:10, maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {etape.adresse}
                          </span>
                          {/* Boutons réordonnement pour boucle */}
                          {ligne.type === 'boucle' && i > 0 && i < ligne.etapes.length - 1 && (
                            <div style={{ display:'flex', gap:2 }}>
                              <button onClick={() => monterEtape(ligne.id, i)}
                                style={{ padding:'1px 5px', fontSize:10, border:'1px solid #dde3f0', borderRadius:4, background:'#fff', cursor:'pointer' }}>▲</button>
                              <button onClick={() => descendreEtape(ligne.id, i)}
                                style={{ padding:'1px 5px', fontSize:10, border:'1px solid #dde3f0', borderRadius:4, background:'#fff', cursor:'pointer' }}>▼</button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Options repas + péage + montant */}
                  <div style={{ padding:'10px 16px', display:'flex', gap:16, alignItems:'center', flexWrap:'wrap' }}>
                    {/* Indemnité */}
                    {ligne.type === 'formation' ? (
                      <div style={{ fontSize:12, color:'#6b21a8', fontWeight:600 }}>
                        🎓 {ligne.montantSNCF !== null ? ligne.montantSNCF.toFixed(2) : '—'} €
                        <span style={{ fontSize:10, color:'#9aa3b8', fontWeight:400, marginLeft:4 }}>
                          (SNCF 2ème cl. · aller {ligne.km || '—'} km)
                        </span>
                      </div>
                    ) : (
                      <div style={{ fontSize:12, color:'#1a4b8f', fontWeight:600 }}>
                        💶 {ligne.km ? (ligne.km * ligne.taux).toFixed(2) : '—'} €
                        <span style={{ fontSize:10, color:'#9aa3b8', fontWeight:400, marginLeft:4 }}>
                          ({ligne.km || '—'} km × {ligne.taux?.toFixed(3)} €)
                        </span>
                      </div>
                    )}

                    {/* Repas */}
                    <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:12 }}>
                      <input type="checkbox" checked={ligne.repas}
                        onChange={e => updateLigne(ligne.id, 'repas', e.target.checked)} />
                      🍽️ Repas
                    </label>
                    {ligne.repas && (
                      <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                        <input type="number" value={ligne.repas_montant} min="0" max="20" step="0.5"
                          onChange={e => updateLigne(ligne.id, 'repas_montant', e.target.value)}
                          placeholder="0"
                          style={{ width:60, padding:'3px 7px', border:'1.5px solid #dde3f0', borderRadius:7, fontSize:12, fontFamily:'Sora,sans-serif' }} />
                        <span style={{ fontSize:11, color:'#9aa3b8' }}>€ (max 20€)</span>
                      </div>
                    )}

                    {/* Péage */}
                    <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:12 }}>
                      <input type="checkbox" checked={ligne.peage}
                        onChange={e => updateLigne(ligne.id, 'peage', e.target.checked)} />
                      🛣️ Péage
                    </label>
                    {ligne.peage && (
                      <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                        <input type="number" value={ligne.peage_montant} min="0" step="0.1"
                          onChange={e => updateLigne(ligne.id, 'peage_montant', e.target.value)}
                          placeholder="0"
                          style={{ width:60, padding:'3px 7px', border:'1.5px solid #dde3f0', borderRadius:7, fontSize:12, fontFamily:'Sora,sans-serif' }} />
                        <span style={{ fontSize:11, color:'#9aa3b8' }}>€</span>
                      </div>
                    )}

                    {/* Notes */}
                    <input className="form-control" value={ligne.notes}
                      onChange={e => updateLigne(ligne.id, 'notes', e.target.value)}
                      placeholder="Notes..."
                      style={{ fontSize:11, padding:'4px 8px', flex:1, minWidth:100 }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Récapitulatif total ── */}
          {lignes.length > 0 && (
            <div style={{ marginTop:20, background:'#fff', border:'2px solid #1a4b8f', borderRadius:12, padding:20, boxShadow:'0 4px 16px rgba(26,75,143,.12)' }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#1a4b8f', marginBottom:14 }}>
                📊 Récapitulatif — {MOIS_FR[mois]} {annee}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:12, marginBottom:16 }}>
                {[
                  { label:'Km pro', value:`${Math.round(totalKmPro * 10) / 10} km`, icon:'🚗', color:'#1a4b8f', bg:'#e8eef8' },
                  { label:'Indemnité pro', value:`${totalIndemnitePro.toFixed(2)} €`, icon:'💶', color:'#2e8b4a', bg:'#e6f5eb' },
                  { label:'Formation SNCF', value:`${totalIndemniteFormation.toFixed(2)} €`, icon:'🎓', color:'#6b21a8', bg:'#f0ebfb' },
                  { label:'Repas', value:`${totalRepas.toFixed(2)} €`, icon:'🍽️', color:'#d97706', bg:'#fef3e2' },
                  { label:'Péages', value:`${totalPeage.toFixed(2)} €`, icon:'🛣️', color:'#0891b2', bg:'#e0f2fe' },
                ].map(({ label, value, icon, color, bg }) => (
                  <div key={label} style={{ background: bg, borderRadius:10, padding:14, textAlign:'center' }}>
                    <div style={{ fontSize:20, marginBottom:4 }}>{icon}</div>
                    <div style={{ fontSize:11, color:'#5a6478', marginBottom:2 }}>{label}</div>
                    <div style={{ fontSize:16, fontWeight:700, color }}>{value}</div>
                  </div>
                ))}
              </div>
              <div style={{ background:'#1a4b8f', borderRadius:10, padding:'14px 20px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span style={{ fontSize:14, fontWeight:700, color:'#fff' }}>💰 Total général</span>
                <span style={{ fontSize:22, fontWeight:800, color:'#fff' }}>{totalGeneral.toFixed(2)} €</span>
              </div>
              <div style={{ marginTop:12, fontSize:11, color:'#9aa3b8', textAlign:'center' }}>
                Taux appliqué : {getTauxKm(cv, kmCumules).toFixed(3)} €/km · {cv} CV · {kmCumules} km cumulés en {annee}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── Styles impression ── */}
      <style>{`
        @media print {
          .sidebar, .header-actions, button, input[type="checkbox"] + label,
          .btn, select { display: none !important; }
          .main-content { margin: 0 !important; padding: 20px !important; }
          .app-layout { display: block !important; }
        }
      `}</style>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
