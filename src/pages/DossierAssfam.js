// DossierAssfam.js — v2026-05-19b — vehicule_cv champ numérique libre + barème auto affiché
import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Sidebar from '../components/Sidebar'

function SectionCard({ icon, title, children }) {
  const [open, setOpen] = useState(true)
  return (
    <div style={{ background:'#fff', border:'1px solid #dde3f0', borderRadius:12, boxShadow:'0 2px 12px rgba(26,75,143,.08)', marginBottom:16, overflow:'hidden' }}>
      <div onClick={() => setOpen(o => !o)} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 20px', borderBottom: open ? '1px solid #dde3f0' : 'none', cursor:'pointer', userSelect:'none' }}>
        <h3 style={{ display:'flex', alignItems:'center', gap:10, fontSize:14, fontWeight:600, margin:0 }}>
          <span style={{ fontSize:18 }}>{icon}</span>{title}
        </h3>
        <span style={{ color:'#9aa3b8', fontSize:16, transition:'transform .2s', transform: open ? 'none' : 'rotate(-90deg)' }}>▾</span>
      </div>
      {open && <div style={{ padding:20 }}>{children}</div>}
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', options, readOnly, span }) {
  const style = span ? { gridColumn: `span ${span}` } : {}
  const fmtDate = iso => { if (!iso) return ''; const [y,m,d] = iso.split('T')[0].split('-'); return `${d}/${m}/${y}` }
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:5, ...style }}>
      <label style={{ fontSize:11, fontWeight:600, color:'#5a6478', letterSpacing:'.4px', textTransform:'uppercase' }}>{label}</label>
      {readOnly ? (
        <div style={{ padding:'10px 12px', background:'#eef1f8', borderRadius:8, fontSize:13, color:'#1c2333' }}>
          {(type === 'date' ? fmtDate(value) : value) || <span style={{ color:'#9aa3b8', fontStyle:'italic' }}>—</span>}
        </div>
      ) : options ? (
        <select value={value || ''} onChange={e => onChange(e.target.value)} style={{ padding:'10px 12px', border:'1.5px solid #dde3f0', borderRadius:8, fontFamily:'Sora,sans-serif', fontSize:13, background:'#f4f6fb', color:'#1c2333', outline:'none' }}>
          <option value="">—</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : type === 'textarea' ? (
        <textarea value={value || ''} onChange={e => onChange(e.target.value)} style={{ padding:'10px 12px', border:'1.5px solid #dde3f0', borderRadius:8, fontFamily:'Sora,sans-serif', fontSize:13, background:'#f4f6fb', color:'#1c2333', outline:'none', minHeight:80, resize:'vertical' }} />
      ) : (
        <input type={type} value={value || ''} onChange={e => onChange(e.target.value)} style={{ padding:'10px 12px', border:'1.5px solid #dde3f0', borderRadius:8, fontFamily:'Sora,sans-serif', fontSize:13, background:'#f4f6fb', color:'#1c2333', outline:'none' }} />
      )}
    </div>
  )
}

function FG({ cols = 3, children, style: s }) {
  return <div style={{ display:'grid', gridTemplateColumns:`repeat(${cols}, 1fr)`, gap:16, ...s }}>{children}</div>
}

const BAREME_KM = {
  5: [{ max:2000, taux:0.32 }, { max:10000, taux:0.40 }, { max:Infinity, taux:0.23 }],
  6: [{ max:2000, taux:0.41 }, { max:10000, taux:0.51 }, { max:Infinity, taux:0.30 }],
  8: [{ max:2000, taux:0.45 }, { max:10000, taux:0.55 }, { max:Infinity, taux:0.32 }],
}
function calcTauxKm(cv, km) {
  let cvKey = 5
  if (typeof cv === 'string') {
    if (cv.includes('8')) cvKey = 8
    else if (cv.includes('6')) cvKey = 6
    else cvKey = 5
  } else {
    cvKey = cv >= 8 ? 8 : cv >= 6 ? 6 : 5
  }
  const t = BAREME_KM[cvKey].find(t => km <= t.max)
  return t ? t.taux : 0.23
}

export default function DossierAssfam({ profile }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [af, setAf] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [form, setForm] = useState({})
  const [onglet, setOnglet] = useState('identite')
  const [toast, setToast] = useState('')
  const [enfantsAccueillis, setEnfantsAccueillis] = useState([])
  const [historique, setHistorique] = useState([])
  const [conges, setConges] = useState([])
  const [formations, setFormations] = useState([])
  const [foyerEnfants, setFoyerEnfants] = useState([])
  const [documents, setDocuments] = useState([])
  const [uploadingDoc, setUploadingDoc] = useState(null)
  const [collegues, setCollegues] = useState([])
  const [photoUrl, setPhotoUrl] = useState(null)
  const [readingPdf, setReadingPdf] = useState(false)
  const [frDep, setFrDep] = useState('')
  const [frArr, setFrArr] = useState('')
  const [frKm, setFrKm] = useState('')
  const [frType, setFrType] = useState('ar')
  const [frMotif, setFrMotif] = useState('Visite médiatisée (VM)')
  const [frDate, setFrDate] = useState(new Date().toISOString().slice(0,10))
  const [frResult, setFrResult] = useState(null)
  const [congeDebut, setCongeDebut] = useState('')
  const [congeFin, setCongeFin] = useState('')
  const [congeRelais, setCongeRelais] = useState({})
  const [congeNotes, setCongeNotes] = useState('')
  const [showFormationModal, setShowFormationModal] = useState(false)
  const [newFormation, setNewFormation] = useState({ titre:'', organisme:'', date_debut:'', duree_heures:'', statut:'planifiee' })
  const [showFoyerModal, setShowFoyerModal] = useState(false)
  const [newFoyerEnfant, setNewFoyerEnfant] = useState({ prenom:'', nom:'', date_naissance:'', sexe:'M', lien:'enfant' })

  const isReferent = ['referent','encadrant','rtase','admin'].includes(profile?.role)
  const isOwnProfile = profile?.id === id

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 2800) }
  function fmtDate(iso) { if (!iso) return ''; const [y,m,d] = iso.split('T')[0].split('-'); return `${d}/${m}/${y}` }
  function F(k) { return v => setForm(f => ({ ...f, [k]: v })) }
  function v(k) { return form[k] !== undefined ? form[k] : '' }
  function calcAge(ddn) { if (!ddn) return ''; const d=new Date(ddn),now=new Date(); let a=now.getFullYear()-d.getFullYear(); if(now.getMonth()<d.getMonth()||(now.getMonth()===d.getMonth()&&now.getDate()<d.getDate()))a--; return `${a} ans` }
  function dureePlacement(d1, d2) { const a=new Date(d1),b=d2?new Date(d2):new Date(); const m=Math.round((b-a)/(1000*60*60*24*30)); if(m<1)return "< 1 mois"; if(m<12)return `${m} mois`; const an=Math.floor(m/12),rm=m%12; return rm?`${an} an${an>1?'s':''} et ${rm} mois`:`${an} an${an>1?'s':''}` }
  function calcAnciennete(debut) { if(!debut)return '—'; const d=new Date(debut),now=new Date(); const m=(now.getFullYear()-d.getFullYear())*12+(now.getMonth()-d.getMonth()); const a=Math.floor(m/12),rm=m%12; return [a>0?`${a} an${a>1?'s':''}`:null,rm>0?`${rm} mois`:null].filter(Boolean).join(' et ')||"< 1 mois" }

  const fetchAf = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', id).single()
    if (data) { setAf(data); setForm(data) }
    setLoading(false)
  }, [id])

  const fetchEnfants = useCallback(async () => {
    const { data } = await supabase.from('enfants').select('id,prenom,nom,date_naissance,type_placement,date_placement,date_fin_placement').eq('af_principal_id', id).order('date_placement',{ascending:false})
    if (data) {
      setEnfantsAccueillis(data.filter(e=>!e.date_fin_placement&&e.type_placement!=='non_place'))
      setHistorique(data.filter(e=>e.date_fin_placement))
    }
  }, [id])

  const fetchConges = useCallback(async () => {
    const { data } = await supabase.from('conges').select('*').eq('af_id', id).order('date_debut',{ascending:false})
    if (data) setConges(data)
  }, [id])

  const fetchFormations = useCallback(async () => {
    const { data } = await supabase.from('formations').select('*').eq('af_id', id).order('date_debut',{ascending:false})
    if (data) setFormations(data)
  }, [id])

  const fetchFoyerEnfants = useCallback(async () => {
    const { data } = await supabase.from('foyer_enfants').select('*').eq('af_id', id)
    if (data) setFoyerEnfants(data)
  }, [id])

  const fetchDocuments = useCallback(async () => {
    const { data } = await supabase.from('documents_parent').select('*').eq('parent_id', id).order('created_at',{ascending:false})
    if (data) setDocuments(data)
  }, [id])

  const fetchCollegues = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('id,nom,prenom,role,telephone,email').in('role',['encadrant','admin'])
    if (data) setCollegues(data)
  }, [])

  const fetchPhoto = useCallback(async () => {
    const { data } = await supabase.storage.from('documents-enfants').list(`assfam/${id}/photos`)
    if (data && data.length > 0) {
      const { data:url } = await supabase.storage.from('documents-enfants').createSignedUrl(`assfam/${id}/photos/${data[0].name}`, 3600)
      if (url?.signedUrl) setPhotoUrl(url.signedUrl)
    }
  }, [id])

  useEffect(() => {
    fetchAf(); fetchEnfants(); fetchConges(); fetchFormations()
    fetchFoyerEnfants(); fetchDocuments(); fetchCollegues(); fetchPhoto()
  }, [fetchAf,fetchEnfants,fetchConges,fetchFormations,fetchFoyerEnfants,fetchDocuments,fetchCollegues,fetchPhoto])

  async function saveForm() {
    setSaving(true)
    const cols = [
      'nom','prenom','date_naissance','situation_familiale','telephone','telephone2',
      'email','numero_secu','adresse','code_postal','ville','territoire','matricule',
      'numero_agrement','date_agrement','date_expiration_agrement','delivre_par',
      'places_agreees','places_relais','places_contrat_tarn',
      'deaf_obtenu','deaf_date','deaf_centre','deaf_numero','accord_urgence',
      'vehicule_marque','vehicule_immat','vehicule_cv','vehicule_assurance_exp','vehicule_ct_exp',
      'conjoint_nom','conjoint_profession','conjoint_telephone','km_cumules_annee',
      'profil_age','profil_sexe','profil_duree',
      'cap_troubles_comportement_legers','cap_troubles_comportement','cap_handicap',
      'cap_fratrie','cap_urgence','cap_bas_age','cap_relais',
      'date_debut_contrat','secteur','ville_rattachement',
      'gestionnaire_paie_nom','gestionnaire_paie_tel','gestionnaire_paie_email',
    ]
    const fd = Object.fromEntries(cols.filter(k=>form[k]!==undefined).map(k=>[k,form[k]]))
    const { error } = await supabase.from('profiles').update(fd).eq('id', id)
    if (!error) { showToast('✅ Enregistré !'); setAf({...af,...fd}); setEditMode(false) }
    else showToast('❌ ' + error.message)
    setSaving(false)
  }

  async function uploadDoc(file, typeDoc) {
    if (!file) return; setUploadingDoc(typeDoc)
    const ext = file.name.split('.').pop()
    const path = `assfam/${id}/${typeDoc}.${ext}`
    const { error:sErr } = await supabase.storage.from('documents-enfants').upload(path, file, { contentType:file.type, upsert:true })
    if (sErr) { showToast('❌ Storage: '+sErr.message); setUploadingDoc(null); return }
    await supabase.from('documents_parent').delete().eq('parent_id', id).eq('type_doc', typeDoc)
    const { error:dbErr } = await supabase.from('documents_parent').insert({ parent_id:id, type_doc:typeDoc, nom:file.name, storage_path:path, taille:file.size, mime_type:file.type, uploaded_by:profile.id })
    if (dbErr) { showToast('❌ DB: '+dbErr.message); setUploadingDoc(null); return }
    showToast('✅ Document uploadé !'); fetchDocuments(); setUploadingDoc(null)
  }

  async function uploadPhoto(file) {
    if (!file) return; setUploadingDoc('photo')
    const ext = file.name.split('.').pop()
    const path = `assfam/${id}/photos/photo.${ext}`
    await supabase.storage.from('documents-enfants').upload(path, file, { contentType:file.type, upsert:true })
    const { data:url } = await supabase.storage.from('documents-enfants').createSignedUrl(path, 3600)
    if (url?.signedUrl) setPhotoUrl(url.signedUrl)
    showToast('✅ Photo mise à jour !'); setUploadingDoc(null)
  }

  async function viewDoc(path) {
    const { data } = await supabase.storage.from('documents-enfants').createSignedUrl(path, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  async function readAgrementPdf(file) {
    if (!file) return; setReadingPdf(true)
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result.split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      await uploadDoc(file, 'agrement')
      const resp = await fetch('/api/read-agrement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfBase64: base64 })
      })
      const result = await resp.json()
      if (!result.success) throw new Error(result.error)
      const d = result.data
      setForm(f => ({
        ...f,
        ...(d.numero_agrement && { numero_agrement: d.numero_agrement }),
        ...(d.delivre_par && { delivre_par: d.delivre_par }),
        ...(d.date_agrement && { date_agrement: d.date_agrement }),
        ...(d.date_expiration_agrement && { date_expiration_agrement: d.date_expiration_agrement }),
        ...(d.places_agreees && { places_agreees: Math.min(d.places_agreees, 3) }),
        ...(d.nom && { nom: d.nom }),
        ...(d.prenom && { prenom: d.prenom }),
        ...(d.adresse && { adresse: d.adresse }),
        ...(d.code_postal && { code_postal: d.code_postal }),
        ...(d.ville && { ville: d.ville }),
      }))
      setEditMode(true)
      showToast('✅ Agrément lu ! Vérifiez et enregistrez.')
    } catch(e) {
      showToast('❌ ' + e.message)
    }
    setReadingPdf(false)
  }

  function calcFrais() {
    const km = parseFloat(frKm); if (!km||km<=0) { showToast('⚠️ Distance invalide'); return }
    const kmC = af?.km_cumules_annee||0, taux = calcTauxKm(af?.vehicule_cv||5, kmC)
    const dist = frType==='ar' ? km*2 : km
    setFrResult({ km:dist, taux, montant:dist*taux, motif:frMotif, depart:frDep, arrivee:frArr, date:frDate })
  }

  async function saveConge() {
    if (!congeDebut||!congeFin) { showToast('⚠️ Dates requises'); return }
    const nb_jours = Math.ceil((new Date(congeFin)-new Date(congeDebut))/(1000*60*60*24))+1
    const relaisStr = Object.entries(congeRelais).filter(([,v])=>v).map(([,v])=>v).join(' | ')
    const { error } = await supabase.from('conges').insert({ date_debut:congeDebut, date_fin:congeFin, nb_jours, notes:[relaisStr,congeNotes].filter(Boolean).join('\n'), af_id:id, statut:'en_attente' })
    if (!error) { showToast('✅ Demande envoyée !'); setCongeDebut(''); setCongeFin(''); setCongeRelais({}); setCongeNotes(''); fetchConges() }
    else showToast('❌ '+error.message)
  }

  async function validerConge(congeId, statut) {
    await supabase.from('conges').update({ statut, valideur_id:profile.id }).eq('id', congeId)
    showToast(statut==='valide'?'✅ Validé':'❌ Refusé'); fetchConges()
  }

  async function saveFormation() {
    if (!newFormation.titre) { showToast('⚠️ Titre requis'); return }
    const { error } = await supabase.from('formations').insert({ ...newFormation, af_id:id })
    if (!error) { showToast('✅ Ajoutée !'); setShowFormationModal(false); setNewFormation({ titre:'',organisme:'',date_debut:'',duree_heures:'',statut:'planifiee' }); fetchFormations() }
    else showToast('❌ '+error.message)
  }

  async function saveFoyerEnfant() {
    if (!newFoyerEnfant.prenom) { showToast('⚠️ Prénom requis'); return }
    const { error } = await supabase.from('foyer_enfants').insert({ ...newFoyerEnfant, af_id:id })
    if (!error) { showToast('✅ Ajouté !'); setShowFoyerModal(false); setNewFoyerEnfant({ prenom:'',nom:'',date_naissance:'',sexe:'M',lien:'enfant' }); fetchFoyerEnfants() }
    else showToast('❌ '+error.message)
  }

  const placesOccupees = enfantsAccueillis.length
  const placesContratTarn = af?.places_contrat_tarn||af?.places_agreees||3
  const placesDisponibles = Math.max(0, placesContratTarn-placesOccupees)
  const congesPris = conges.filter(c=>c.statut==='valide').reduce((s,c)=>s+(c.nb_jours||0),0)
  const congesRestants = 30-congesPris
  const kmCumules = af?.km_cumules_annee||0
  const agrExp = af?.date_expiration_agrement ? new Date(af.date_expiration_agrement) : null
  const joursAgrExp = agrExp ? Math.ceil((agrExp-new Date())/(1000*60*60*24)) : null
  const agrAlerte = joursAgrExp!==null && joursAgrExp<=90
  const agrExpire = joursAgrExp!==null && joursAgrExp<=0
  const initiales = `${af?.nom?.[0]||''}${af?.prenom?.[0]||''}`

  const ONGLETS = [
    {id:'identite',icon:'🪪',label:'Identité'},
    {id:'agrement',icon:'📜',label:'Agrément'},
    {id:'foyer',icon:'🏠',label:'Foyer'},
    {id:'enfants',icon:'👶',label:'Enfants & Frais'},
    {id:'conges',icon:'🏖️',label:'Congés'},
    {id:'formations',icon:'🎓',label:'Formations'},
    {id:'safa',icon:'🏛️',label:'SAFA & Contrat'},
  ]

  if (loading) return (
    <div className="app-layout"><Sidebar profile={profile} />
      <div className="main-content" style={{display:'flex',alignItems:'center',justifyContent:'center'}}>
        <div style={{textAlign:'center',color:'#9aa3b8'}}><div style={{fontSize:36}}>👨‍👩‍👧</div><div>Chargement...</div></div>
      </div>
    </div>
  )
  if (!af) return (
    <div className="app-layout"><Sidebar profile={profile} />
      <div className="main-content" style={{padding:32}}><div style={{color:'#c0392b'}}>❌ Profil introuvable</div></div>
    </div>
  )

  return (
    <div className="app-layout">
      <Sidebar profile={profile} />
      <div className="main-content">
        <header className="page-header">
          <img src="/logo_transparent.png" alt="P" className="header-logo" onError={e=>e.target.style.display='none'} />
          <div className="header-sep" />
          <button onClick={()=>navigate('/assfam')} style={{display:'flex',alignItems:'center',gap:6,color:'#1a4b8f',fontSize:13,fontWeight:500,cursor:'pointer',background:'none',border:'none',fontFamily:'Sora,sans-serif',padding:'6px 10px',borderRadius:8}} onMouseOver={e=>e.currentTarget.style.background='#e8eef8'} onMouseOut={e=>e.currentTarget.style.background='none'}>← Assfam</button>
          <div className="header-sep" />
          <div style={{display:'flex',alignItems:'center',gap:12,flex:1}}>
            <div style={{width:40,height:40,borderRadius:'50%',overflow:'hidden',flexShrink:0,background:'linear-gradient(135deg,#1a4b8f,#2e8b4a)',display:'flex',alignItems:'center',justifyContent:'center'}}>
              {photoUrl ? <img src={photoUrl} alt="photo" style={{width:'100%',height:'100%',objectFit:'cover'}} /> : <span style={{fontSize:14,fontWeight:700,color:'#fff'}}>{initiales}</span>}
            </div>
            <div>
              <div className="page-title">{af.nom} {af.prenom}</div>
              <div className="page-subtitle">
                Assistante familiale agréée · {af.secteur||af.territoire||''}
                {af.numero_agrement&&` · Agrément N° ${af.numero_agrement}`}
                {agrAlerte&&<span style={{marginLeft:8,background:agrExpire?'#fdf0ee':'#fef3e2',color:agrExpire?'#c0392b':'#d97706',padding:'1px 8px',borderRadius:10,fontSize:10,fontWeight:700}}>{agrExpire?'🔴 Agrément EXPIRÉ':`⚠️ Renouvellement dans ${joursAgrExp}j`}</span>}
              </div>
            </div>
          </div>
          <div className="header-actions">
            {editMode
              ? (<><button onClick={()=>{setForm(af);setEditMode(false)}} className="btn btn-danger">✕ Annuler</button><button onClick={saveForm} disabled={saving} className="btn btn-primary">{saving?'⏳...':'💾 Enregistrer'}</button></>)
              : ((isReferent||isOwnProfile)&&<button onClick={()=>setEditMode(true)} className="btn btn-secondary">✏️ Modifier</button>)
            }
          </div>
        </header>

        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,padding:'16px 24px 0'}}>
          {[
            {val:placesOccupees,lbl:'Enfants accueillis',sub:enfantsAccueillis.map(e=>`${e.nom} ${e.prenom[0]}.`).join(' · ')||'—',color:'#2e8b4a',bg:'#e6f5eb'},
            {val:placesDisponibles,lbl:`Place${placesDisponibles!==1?'s':''} disponible${placesDisponibles!==1?'s':''}`,sub:`Contrat Tarn : ${placesContratTarn} place${placesContratTarn!==1?'s':''}`,color:'#1a4b8f',bg:'#e8eef8'},
            {val:congesRestants,lbl:'Jours de congés',sub:'Solde restant '+new Date().getFullYear(),color:'#d97706',bg:'#fef3e2'},
            {val:kmCumules.toLocaleString('fr-FR'),lbl:'Km cumulés '+new Date().getFullYear(),sub:`Tranche ${kmCumules<=2000?'1 (≤2 000)':kmCumules<=10000?'2 (2 001–10 000)':'3 (>10 000)'}`,color:'#6d4c9e',bg:'#f0ebfb'},
          ].map((s,i)=>(
            <div key={i} style={{background:s.bg,borderRadius:12,padding:'16px 18px'}}>
              <div style={{fontSize:26,fontWeight:700,color:s.color}}>{s.val}</div>
              <div style={{fontSize:12,fontWeight:600,color:'#1c2333',marginTop:2}}>{s.lbl}</div>
              <div style={{fontSize:11,color:'#9aa3b8',marginTop:2}}>{s.sub}</div>
            </div>
          ))}
        </div>

        <div style={{padding:'16px 24px 24px'}}>
          <div style={{display:'flex',gap:4,background:'#fff',border:'1px solid #dde3f0',borderRadius:12,padding:6,marginBottom:24,boxShadow:'0 2px 12px rgba(26,75,143,.08)',flexWrap:'wrap'}}>
            {ONGLETS.map(o=>(
              <button key={o.id} onClick={()=>setOnglet(o.id)} style={{display:'flex',alignItems:'center',gap:7,padding:'9px 16px',borderRadius:8,fontSize:13,fontWeight:500,cursor:'pointer',border:'none',fontFamily:'Sora,sans-serif',transition:'all .15s',whiteSpace:'nowrap',background:onglet===o.id?'#1a4b8f':'none',color:onglet===o.id?'#fff':'#5a6478'}}>
                <span style={{fontSize:15}}>{o.icon}</span>{o.label}
              </button>
            ))}
          </div>

          {onglet==='identite'&&(
            <>
              <SectionCard icon="👤" title="État civil">
                <div style={{display:'grid',gridTemplateColumns:'120px 1fr',gap:20,marginBottom:20}}>
                  <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8}}>
                    <div style={{width:100,height:120,borderRadius:10,overflow:'hidden',background:'#eef1f8',border:'2px solid #dde3f0',display:'flex',alignItems:'center',justifyContent:'center'}}>
                      {photoUrl ? <img src={photoUrl} alt="photo AF" style={{width:'100%',height:'100%',objectFit:'cover'}} /> : <div style={{textAlign:'center',color:'#9aa3b8'}}><div style={{fontSize:32}}>👤</div><div style={{fontSize:10}}>Photo</div></div>}
                    </div>
                    <label style={{padding:'4px 10px',border:'1px dashed #c4d4f5',borderRadius:7,background:'#e8eef8',color:'#1a4b8f',fontSize:11,cursor:'pointer',textAlign:'center'}}>
                      {uploadingDoc==='photo'?'⏳...':'📷 Changer'}
                      <input type="file" accept="image/*" style={{display:'none'}} onChange={e=>{if(e.target.files[0]) uploadPhoto(e.target.files[0])}} />
                    </label>
                  </div>
                  <FG cols={3}>
                    <Field label="Nom" value={v('nom')} onChange={F('nom')} readOnly={!editMode} />
                    <Field label="Prénom" value={v('prenom')} onChange={F('prenom')} readOnly={!editMode} />
                    <Field label="Date de naissance" type="date" value={v('date_naissance')} onChange={F('date_naissance')} readOnly={!editMode} />
                    <Field label="Situation familiale" value={v('situation_familiale')} onChange={F('situation_familiale')} readOnly={!editMode} options={['Célibataire','Marié(e)','Pacsé(e)','Divorcé(e)','Veuf/Veuve']} />
                    <Field label="Téléphone" type="tel" value={v('telephone')} onChange={F('telephone')} readOnly={!editMode} />
                    <Field label="Téléphone 2" type="tel" value={v('telephone2')} onChange={F('telephone2')} readOnly={!editMode} />
                    <Field label="Email" type="email" value={v('email')} onChange={F('email')} readOnly={!editMode} span={2} />
                    <div style={{display:'flex',flexDirection:'column',gap:5}}>
                      <label style={{fontSize:11,fontWeight:600,color:'#5a6478',letterSpacing:'.4px',textTransform:'uppercase'}}>N° Sécurité Sociale</label>
                      {editMode ? (
                        <input value={v('numero_secu')} onChange={e=>{
                          const digits=e.target.value.replace(/\D/g,'').slice(0,15)
                          let fmt=''
                          if(digits.length>0)  fmt+=digits.slice(0,1)
                          if(digits.length>1)  fmt+=' '+digits.slice(1,3)
                          if(digits.length>3)  fmt+=' '+digits.slice(3,5)
                          if(digits.length>5)  fmt+=' '+digits.slice(5,7)
                          if(digits.length>7)  fmt+=' '+digits.slice(7,10)
                          if(digits.length>10) fmt+=' '+digits.slice(10,13)
                          if(digits.length>13) fmt+=' '+digits.slice(13,15)
                          F('numero_secu')(fmt)
                        }} placeholder="1 85 07 75 108 042 28" maxLength={21} style={{padding:'10px 12px',border:'1.5px solid #dde3f0',borderRadius:8,fontFamily:'monospace',fontSize:14,background:'#f4f6fb',outline:'none',letterSpacing:'1px'}} />
                      ) : (
                        <div style={{padding:'10px 12px',background:'#eef1f8',borderRadius:8,fontSize:14,fontFamily:'monospace',letterSpacing:'1px'}}>
                          {v('numero_secu')||<span style={{color:'#9aa3b8',fontStyle:'italic',fontFamily:'Sora,sans-serif',fontSize:13,letterSpacing:'normal'}}>—</span>}
                        </div>
                      )}
                    </div>
                  </FG>
                </div>
              </SectionCard>

              <SectionCard icon="📄" title="Documents personnels">
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16}}>
                  {[{key:'cni_assfam',icon:'🪪',label:'CNI'},{key:'casier_assfam',icon:'📋',label:'Casier judiciaire B3'},{key:'autre_assfam',icon:'📎',label:'Autre document'}].map(doc=>{
                    const docsType=documents.filter(d=>d.type_doc===doc.key)
                    return (
                      <div key={doc.key} style={{background:'#f4f6fb',borderRadius:10,padding:14,border:'1px solid #dde3f0'}}>
                        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                          <span style={{fontSize:20}}>{doc.icon}</span>
                          <span style={{fontSize:12,fontWeight:600}}>{doc.label}</span>
                        </div>
                        {docsType.map(d=>(
                          <div key={d.id} style={{display:'flex',alignItems:'center',gap:6,padding:'6px 8px',background:'#fff',borderRadius:7,border:'1px solid #dde3f0',marginBottom:6}}>
                            <span style={{fontSize:14}}>{d.mime_type?.includes('pdf')?'📄':'🖼️'}</span>
                            <span style={{fontSize:11,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{d.nom}</span>
                            <button onClick={()=>viewDoc(d.storage_path)} style={{padding:'2px 6px',borderRadius:4,border:'1px solid #dde3f0',background:'#fff',fontSize:11,cursor:'pointer'}}>👁</button>
                          </div>
                        ))}
                        <label style={{display:'flex',alignItems:'center',gap:6,padding:'5px 8px',border:'1px dashed #c4d4f5',borderRadius:7,background:'#e8eef8',color:'#1a4b8f',fontSize:11,cursor:'pointer'}}>
                          {uploadingDoc===doc.key?'⏳...':'📎 Ajouter'}
                          <input type="file" accept="image/*,application/pdf" style={{display:'none'}} onChange={e=>{if(e.target.files[0]) uploadDoc(e.target.files[0],doc.key)}} />
                        </label>
                      </div>
                    )
                  })}
                </div>
              </SectionCard>
            </>
          )}

          {onglet==='agrement'&&(
            <>
              <SectionCard icon="📜" title="Agrément en cours">
                {agrAlerte&&(
                  <div style={{background:agrExpire?'#fdf0ee':'#fef3e2',border:`1px solid ${agrExpire?'#fde8e8':'#f5dca4'}`,borderRadius:10,padding:'10px 14px',marginBottom:16,fontSize:12,color:agrExpire?'#c0392b':'#d97706',display:'flex',alignItems:'center',gap:8}}>
                    {agrExpire?'🔴':'⚠️'} <strong>{agrExpire?'Agrément EXPIRÉ':'Renouvellement dans '+joursAgrExp+' jours'}</strong> — {agrExpire?'Expiré le':'Expire le'} {fmtDate(af.date_expiration_agrement)}
                  </div>
                )}
                <div style={{background:'#e8eef8',border:'1px solid #c4d4f5',borderRadius:9,padding:'10px 14px',marginBottom:14,fontSize:12,color:'#1a4b8f'}}>
                  📎 Ces informations sont renseignées par lecture du PDF — uploadez-le ci-dessous.
                </div>
                <FG cols={4}>
                  <Field label="N° Agrément" value={v('numero_agrement')} onChange={F('numero_agrement')} readOnly={!editMode} />
                  <Field label="Délivré par (PMI)" value={v('delivre_par')} onChange={F('delivre_par')} readOnly={!editMode} />
                  <Field label="Date de délivrance" type="date" value={v('date_agrement')} onChange={F('date_agrement')} readOnly={!editMode} />
                  <Field label="Date d'expiration" type="date" value={v('date_expiration_agrement')} onChange={F('date_expiration_agrement')} readOnly={!editMode} />
                </FG>
                <FG cols={3} style={{marginTop:12}}>
                  <div style={{display:'flex',flexDirection:'column',gap:5}}>
                    <label style={{fontSize:11,fontWeight:600,color:'#5a6478',textTransform:'uppercase',letterSpacing:'.4px'}}>Places agréées (total)</label>
                    {editMode
                      ? <input type="number" min="1" max="3" value={v('places_agreees')||''} onChange={e=>F('places_agreees')(Math.min(parseInt(e.target.value)||1,3))} style={{padding:'10px 12px',border:'1.5px solid #dde3f0',borderRadius:8,fontFamily:'Sora,sans-serif',fontSize:13,background:'#f4f6fb',outline:'none'}} />
                      : <div style={{padding:'10px 12px',background:'#eef1f8',borderRadius:8,fontSize:13}}>{v('places_agreees')||<span style={{color:'#9aa3b8',fontStyle:'italic'}}>—</span>}</div>
                    }
                    <div style={{fontSize:10,color:'#9aa3b8'}}>Max 3 places (agrément individuel)</div>
                  </div>
                  <Field label="Places contractées Tarn" type="number" value={v('places_contrat_tarn')} onChange={F('places_contrat_tarn')} readOnly={!editMode} />
                  <Field label="Dont places relais" type="number" value={v('places_relais')} onChange={F('places_relais')} readOnly={!editMode} />
                </FG>
                <div style={{marginTop:14}}>
                  <div style={{fontSize:12,color:'#5a6478',marginBottom:4}}>
                    <strong>Contrat Tarn :</strong> {placesOccupees}/{placesContratTarn} occupée{placesOccupees>1?'s':''}
                    <span style={{float:'right',fontWeight:600,color:placesDisponibles>0?'#2e8b4a':'#c0392b'}}>{placesDisponibles>0?`${placesDisponibles} dispo${placesDisponibles>1?'s':''}`:' Complet Tarn'}</span>
                  </div>
                  <div style={{height:8,background:'#eef1f8',borderRadius:10,overflow:'hidden'}}>
                    <div style={{height:'100%',width:`${Math.min(100,(placesOccupees/Math.max(placesContratTarn,1))*100)}%`,background:placesOccupees>=placesContratTarn?'#c0392b':'#2e8b4a',borderRadius:10}} />
                  </div>
                </div>
                <div style={{marginTop:14}}>
                  <label style={{display:'flex',alignItems:'center',gap:8,padding:'9px 14px',border:'1px dashed #c4d4f5',borderRadius:8,background:'linear-gradient(135deg,#e8eef8,#f0f9ff)',color:'#1a4b8f',fontSize:12,cursor:'pointer',fontFamily:'Sora,sans-serif',fontWeight:600}}>
                    {readingPdf?'⏳ Lecture en cours...':(uploadingDoc==='agrement'?'⏳ Upload...':'🤖 Uploader et lire l\'agrément PDF')}
                    <input type="file" accept="application/pdf" style={{display:'none'}} onChange={e=>{if(e.target.files[0]) readAgrementPdf(e.target.files[0])}} disabled={readingPdf} />
                  </label>
                  <div style={{fontSize:11,color:'#9aa3b8',marginTop:4}}>Le formulaire sera pré-rempli automatiquement</div>
                  {documents.filter(d=>d.type_doc==='agrement').map(d=>(
                    <div key={d.id} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 10px',background:'#f4f6fb',borderRadius:7,border:'1px solid #dde3f0',marginTop:6}}>
                      <span>📄</span><span style={{flex:1,fontSize:12}}>{d.nom}</span>
                      <button onClick={()=>viewDoc(d.storage_path)} style={{padding:'3px 7px',borderRadius:5,border:'1px solid #dde3f0',background:'#fff',fontSize:11,cursor:'pointer'}}>👁</button>
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard icon="📋" title="Historique des agréments">
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                  <thead><tr style={{background:'#eef2ff',borderBottom:'2px solid #1a4b8f'}}>{['N° Agrément','Période','Places','Statut'].map(h=><th key={h} style={{padding:'8px 12px',textAlign:'left',fontSize:11,fontWeight:700,color:'#1a4b8f',textTransform:'uppercase',letterSpacing:'.4px'}}>{h}</th>)}</tr></thead>
                  <tbody>
                    {af.numero_agrement&&(
                      <tr style={{borderBottom:'1px solid #f0f0f0'}}>
                        <td style={{padding:'10px 12px',fontWeight:600}}>{af.numero_agrement}</td>
                        <td style={{padding:'10px 12px',color:'#5a6478'}}>{fmtDate(af.date_agrement)} → {fmtDate(af.date_expiration_agrement)}</td>
                        <td style={{padding:'10px 12px'}}>{af.places_agreees}</td>
                        <td style={{padding:'10px 12px'}}><span style={{padding:'3px 10px',borderRadius:10,background:agrExpire?'#fdf0ee':'#e6f5eb',color:agrExpire?'#c0392b':'#2e8b4a',fontSize:11,fontWeight:600}}>{agrExpire?'Expiré':'En cours'}</span></td>
                      </tr>
                    )}
                    <tr><td colSpan={4} style={{padding:'10px 12px',color:'#9aa3b8',fontStyle:'italic',fontSize:12}}>Les agréments précédents s'afficheront ici</td></tr>
                  </tbody>
                </table>
              </SectionCard>

              <SectionCard icon="🎓" title="DEAF — Diplôme d'État">
                <FG cols={4}>
                  <Field label="DEAF obtenu" value={v('deaf_obtenu')} onChange={F('deaf_obtenu')} readOnly={!editMode} options={['oui','non','en_cours']} />
                  <Field label="Date d'obtention" type="date" value={v('deaf_date')} onChange={F('deaf_date')} readOnly={!editMode} />
                  <Field label="N° Diplôme" value={v('deaf_numero')} onChange={F('deaf_numero')} readOnly={!editMode} />
                  <Field label="Centre de formation" value={v('deaf_centre')} onChange={F('deaf_centre')} readOnly={!editMode} />
                </FG>
                <div style={{marginTop:12}}>
                  <label style={{display:'flex',alignItems:'center',gap:8,padding:'7px 12px',border:'1px dashed #c4d4f5',borderRadius:8,background:'#f0f9ff',color:'#1a4b8f',fontSize:12,cursor:'pointer',fontFamily:'Sora,sans-serif'}}>
                    {uploadingDoc==='deaf'?'⏳...':'📎 Uploader diplôme DEAF'}
                    <input type="file" accept="image/*,application/pdf" style={{display:'none'}} onChange={e=>{if(e.target.files[0]) uploadDoc(e.target.files[0],'deaf')}} />
                  </label>
                  {documents.filter(d=>d.type_doc==='deaf').map(d=>(
                    <div key={d.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:'#f4f6fb',borderRadius:9,border:'1px solid #dde3f0',marginTop:6,cursor:'pointer'}} onClick={()=>viewDoc(d.storage_path)}>
                      <span style={{fontSize:20}}>🎓</span>
                      <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600}}>{d.nom}</div><div style={{fontSize:11,color:'#9aa3b8'}}>PDF · {af.deaf_centre} · {fmtDate(af.deaf_date)}</div></div>
                      <button style={{padding:'4px 10px',borderRadius:7,border:'1px solid #dde3f0',background:'#fff',fontSize:12,cursor:'pointer'}}>👁 Voir</button>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </>
          )}

          {onglet==='foyer'&&(
            <>
              <SectionCard icon="🏠" title="Domicile">
                <FG>
                  <Field label="Adresse" value={v('adresse')} onChange={F('adresse')} readOnly={!editMode} span={2} />
                  <Field label="Code postal" value={v('code_postal')} onChange={F('code_postal')} readOnly={!editMode} />
                  <Field label="Ville" value={v('ville')} onChange={F('ville')} readOnly={!editMode} />
                  <Field label="Téléphone domicile" type="tel" value={v('telephone')} onChange={F('telephone')} readOnly={!editMode} />
                </FG>
                {(v('adresse')||v('ville'))&&<div style={{marginTop:12}}><a href={`https://maps.google.com/?q=${encodeURIComponent([v('adresse'),v('code_postal'),v('ville')].filter(Boolean).join(', '))}`} target="_blank" rel="noreferrer" style={{padding:'6px 12px',borderRadius:8,border:'1px solid #c4d4f5',background:'#e8eef8',color:'#1a4b8f',fontSize:12,textDecoration:'none',fontFamily:'Sora,sans-serif'}}>📍 Ouvrir dans Maps</a><span style={{fontSize:11,color:'#5a6478',marginLeft:10}}>Règle Tarn : <strong>Ville à Ville (Mairie à Mairie)</strong></span></div>}
              </SectionCard>

              <SectionCard icon="🚗" title="Véhicule">
                <FG>
                  <Field label="Marque / Modèle" value={v('vehicule_marque')} onChange={F('vehicule_marque')} readOnly={!editMode} />
                  <Field label="Immatriculation" value={v('vehicule_immat')} onChange={F('vehicule_immat')} readOnly={!editMode} />
                  <div className="form-group">
                    <label className="form-label">Puissance fiscale (CV)</label>
                    {editMode ? (
                      <div>
                        <input type="number" className="form-control" min="1" max="20"
                          value={v('vehicule_cv') || ''}
                          onChange={e => F('vehicule_cv')(parseInt(e.target.value) || null)}
                          placeholder="Ex: 6" />
                        {v('vehicule_cv') && (
                          <div style={{ fontSize:10, color:'#0891b2', marginTop:3, fontWeight:600 }}>
                            → Barème : {v('vehicule_cv') <= 5 ? '5 CV et moins (0,32€/km)' : v('vehicule_cv') <= 7 ? '6-7 CV (0,41€/km)' : '8 CV et plus (0,45€/km)'}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ padding:'10px 12px', background:'#f4f6fb', borderRadius:8, fontSize:13 }}>
                        {v('vehicule_cv') ? `${v('vehicule_cv')} CV` : '—'}
                      </div>
                    )}
                  </div>
                  <Field label="Expiration assurance" type="date" value={v('vehicule_assurance_exp')} onChange={F('vehicule_assurance_exp')} readOnly={!editMode} />
                  <Field label="Contrôle technique" type="date" value={v('vehicule_ct_exp')} onChange={F('vehicule_ct_exp')} readOnly={!editMode} />
                </FG>
                <div style={{marginTop:14,background:'#f4f6fb',border:'1px solid #dde3f0',borderRadius:10,padding:14}}>
                  <div style={{fontSize:12,fontWeight:700,color:'#5a6478',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:10}}>
                    Barème kilométrique {new Date().getFullYear()}
                    <span style={{fontSize:10,fontWeight:400,marginLeft:8,color:'#9aa3b8'}}>(arrêté ministériel 14/03/2022)</span>
                  </div>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                    <thead><tr style={{borderBottom:'2px solid #dde3f0'}}>{['Véhicule','≤ 2 000 km','2 001–10 000 km','> 10 000 km'].map(h=><th key={h} style={{padding:'7px 10px',textAlign:'left',fontSize:11,fontWeight:700,color:'#5a6478',textTransform:'uppercase',letterSpacing:'.3px'}}>{h}</th>)}</tr></thead>
                    <tbody>
                      {[['5 CV et moins',0.32,0.40,0.23],['6 et 7 CV',0.41,0.51,0.30],['8 CV et plus',0.45,0.55,0.32]].map(([label,t1,t2,t3])=>{
                        const cvStr = String(af?.vehicule_cv||'')
                        const isCurrent = (label.includes('5')&&(cvStr.includes('5')||cvStr==='5'))||(label.includes('6')&&(cvStr.includes('6')||cvStr.includes('7')))||(label.includes('8')&&cvStr.includes('8'))
                        return (
                          <tr key={label} style={{borderBottom:'1px solid #f0f0f0',background:isCurrent?'#e8eef8':'transparent'}}>
                            <td style={{padding:'8px 10px',fontWeight:isCurrent?700:400}}>{label}</td>
                            <td style={{padding:'8px 10px',color:'#1a4b8f',fontWeight:700}}>{t1.toFixed(2)} €/km</td>
                            <td style={{padding:'8px 10px',color:'#1a4b8f',fontWeight:700}}>{t2.toFixed(2)} €/km</td>
                            <td style={{padding:'8px 10px',color:'#1a4b8f',fontWeight:700}}>{t3.toFixed(2)} €/km</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </SectionCard>

              <SectionCard icon="👨‍👩‍👧" title="Composition du foyer">
                <div style={{background:'#fef3e2',border:'1px solid #f5dca4',borderRadius:9,padding:'10px 14px',marginBottom:14,fontSize:12,color:'#d97706'}}>
                  ⚠️ Toute personne vivant de façon permanente dans le foyer (conjoint, enfant de plus de 13 ans, cohabitant) doit fournir un <strong>casier judiciaire B3</strong>.
                </div>
                <FG>
                  <Field label="Conjoint(e) — Nom Prénom" value={v('conjoint_nom')} onChange={F('conjoint_nom')} readOnly={!editMode} />
                  <Field label="Profession" value={v('conjoint_profession')} onChange={F('conjoint_profession')} readOnly={!editMode} />
                  <Field label="Téléphone conjoint" type="tel" value={v('conjoint_telephone')} onChange={F('conjoint_telephone')} readOnly={!editMode} />
                </FG>
                <div style={{marginTop:16}}>
                  <div style={{fontSize:11,fontWeight:600,color:'#5a6478',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:8}}>Personnes du foyer</div>
                  {foyerEnfants.map(e=>{
                    const age = e.date_naissance ? parseInt(calcAge(e.date_naissance)) : 0
                    const needsCasier = age>=13||e.lien!=='enfant'
                    const hasCasier = documents.some(d=>d.type_doc===`casier_foyer_${e.id}`)
                    return (
                      <div key={e.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 12px',background:'#f4f6fb',borderRadius:8,marginBottom:8,border:'1px solid #dde3f0'}}>
                        <span style={{fontSize:20}}>{e.sexe==='F'?'👧':'👦'}</span>
                        <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600}}>{e.nom} {e.prenom}</div><div style={{fontSize:11,color:'#9aa3b8'}}>{e.date_naissance&&calcAge(e.date_naissance)} · {e.lien||'Enfant'}</div></div>
                        {needsCasier&&<span style={{padding:'3px 8px',borderRadius:8,fontSize:10,fontWeight:600,background:hasCasier?'#e6f5eb':'#fdf0ee',color:hasCasier?'#2e8b4a':'#c0392b'}}>{hasCasier?'✅ Casier B3':'⚠️ Casier B3 requis'}</span>}
                        {needsCasier&&!hasCasier&&<label style={{padding:'3px 8px',border:'1px dashed #fde8e8',borderRadius:7,background:'#fdf0ee',color:'#c0392b',fontSize:10,cursor:'pointer'}}>📎 B3<input type="file" accept="application/pdf,image/*" style={{display:'none'}} onChange={ev=>{if(ev.target.files[0]) uploadDoc(ev.target.files[0],`casier_foyer_${e.id}`)}} /></label>}
                      </div>
                    )
                  })}
                  {editMode&&<button onClick={()=>setShowFoyerModal(true)} className="btn btn-secondary" style={{marginTop:8,fontSize:12}}>+ Ajouter une personne</button>}
                </div>
              </SectionCard>
            </>
          )}

          {onglet==='enfants'&&(
            <>
              {placesDisponibles>0&&<div style={{background:'#e6f5eb',border:'1px solid #c4e8cc',borderRadius:10,padding:'10px 16px',marginBottom:16,fontSize:12,color:'#2e8b4a',display:'flex',gap:8}}>✅ <strong>{placesDisponibles} place{placesDisponibles>1?'s':''} disponible{placesDisponibles>1?'s':''}</strong> sur {placesContratTarn} contractées{af.profil_age&&` — Profil souhaité : ${af.profil_age}`}</div>}
              <SectionCard icon="👶" title="Enfants accueillis actuellement">
                {enfantsAccueillis.length===0 ? <div style={{color:'#9aa3b8',fontStyle:'italic',fontSize:13}}>Aucun enfant accueilli actuellement</div>
                : enfantsAccueillis.map(e=>(
                  <div key={e.id} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',background:'#f4f6fb',borderRadius:10,marginBottom:8,border:'1px solid #dde3f0'}}>
                    <div style={{width:38,height:38,borderRadius:'50%',background:'linear-gradient(135deg,#1a4b8f,#2e8b4a)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'#fff'}}>{e.nom?.[0]}{e.prenom?.[0]}</div>
                    <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700}}>{e.nom} {e.prenom}</div><div style={{fontSize:11,color:'#9aa3b8'}}>{calcAge(e.date_naissance)} · Depuis {fmtDate(e.date_placement)}</div></div>
                    <button onClick={()=>navigate(`/enfants/${e.id}`)} style={{padding:'5px 10px',borderRadius:7,border:'1px solid #c4d4f5',background:'#e8eef8',color:'#1a4b8f',fontSize:11,cursor:'pointer'}}>📁 Dossier</button>
                  </div>
                ))}
              </SectionCard>

              <SectionCard icon="👤" title="Profil d'accueil souhaité">
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16,marginBottom:16}}>
                  <div>
                    <label style={{fontSize:11,fontWeight:600,color:'#5a6478',textTransform:'uppercase',letterSpacing:'.4px',display:'block',marginBottom:8}}>Tranche d'âge souhaitée</label>
                    <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                      {['0-3 ans','3-6 ans','6-10 ans','10-15 ans','15-18 ans','Indifférent'].map(a=>(
                        <button key={a} type="button" onClick={()=>editMode&&F('profil_age')(a)} style={{padding:'5px 10px',borderRadius:20,border:`1.5px solid ${v('profil_age')===a?'#1a4b8f':'#dde3f0'}`,background:v('profil_age')===a?'#e8eef8':'#fff',color:v('profil_age')===a?'#1a4b8f':'#5a6478',fontSize:11,fontWeight:v('profil_age')===a?700:500,cursor:editMode?'pointer':'default'}}>{a}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={{fontSize:11,fontWeight:600,color:'#5a6478',textTransform:'uppercase',letterSpacing:'.4px',display:'block',marginBottom:8}}>Sexe préféré</label>
                    <div style={{display:'flex',gap:6}}>
                      {['Indifférent','Fille','Garçon'].map(s=>(
                        <button key={s} type="button" onClick={()=>editMode&&F('profil_sexe')(s)} style={{flex:1,padding:'8px',borderRadius:8,border:`1.5px solid ${v('profil_sexe')===s?'#1a4b8f':'#dde3f0'}`,background:v('profil_sexe')===s?'#e8eef8':'#fff',color:v('profil_sexe')===s?'#1a4b8f':'#5a6478',fontSize:12,fontWeight:v('profil_sexe')===s?700:500,cursor:editMode?'pointer':'default'}}>{s}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={{fontSize:11,fontWeight:600,color:'#5a6478',textTransform:'uppercase',letterSpacing:'.4px',display:'block',marginBottom:8}}>Durée accueil préférée</label>
                    <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                      {['Indifférent','Court terme','Long terme','Urgence'].map(d=>(
                        <button key={d} type="button" onClick={()=>editMode&&F('profil_duree')(d)} style={{padding:'6px 10px',borderRadius:20,border:`1.5px solid ${v('profil_duree')===d?'#1a4b8f':'#dde3f0'}`,background:v('profil_duree')===d?'#e8eef8':'#fff',color:v('profil_duree')===d?'#1a4b8f':'#5a6478',fontSize:11,fontWeight:v('profil_duree')===d?700:500,cursor:editMode?'pointer':'default'}}>{d}</button>
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:'#5a6478',textTransform:'uppercase',letterSpacing:'.4px',display:'block',marginBottom:10}}>Capacités particulières</label>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                    {[
                      {key:'cap_troubles_comportement_legers',label:'Troubles du comportement légers',icon:'🧠'},
                      {key:'cap_troubles_comportement',label:'Troubles du comportement lourds',icon:'🧠'},
                      {key:'cap_handicap',label:'Enfants porteurs de handicap',icon:'♿'},
                      {key:'cap_fratrie',label:'Fratries (accueil simultané)',icon:'👧👦'},
                      {key:'cap_urgence',label:"Accueil d'urgence (moins de 48h)",icon:'🚨'},
                      {key:'cap_bas_age',label:'Enfants en bas âge (0-3 ans)',icon:'🍼'},
                      {key:'cap_relais',label:'Accepte les relais',icon:'🔄'},
                    ].map(cap=>(
                      <label key={cap.key} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:v(cap.key)?'#e8eef8':'#f4f6fb',borderRadius:8,cursor:editMode?'pointer':'default',border:`1px solid ${v(cap.key)?'#1a4b8f':'#dde3f0'}`,transition:'all .15s'}}>
                        <input type="checkbox" checked={!!v(cap.key)} onChange={e=>editMode&&F(cap.key)(e.target.checked)} style={{width:16,height:16,cursor:editMode?'pointer':'default',accentColor:'#1a4b8f'}} />
                        <span style={{fontSize:16}}>{cap.icon}</span>
                        <span style={{fontSize:12,color:v(cap.key)?'#1a4b8f':'#5a6478',fontWeight:v(cap.key)?600:400}}>{cap.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </SectionCard>

              <SectionCard icon="📋" title="Historique enfants accueillis">
                {historique.length===0 ? <div style={{color:'#9aa3b8',fontStyle:'italic',fontSize:13}}>Aucun historique disponible</div> : (
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                    <thead><tr style={{background:'#eef2ff',borderBottom:'2px solid #1a4b8f'}}>{['Enfant','Période','Type','Durée'].map(h=><th key={h} style={{padding:'8px 12px',textAlign:'left',fontSize:11,fontWeight:700,color:'#1a4b8f',textTransform:'uppercase',letterSpacing:'.4px'}}>{h}</th>)}</tr></thead>
                    <tbody>
                      {historique.map(e=>(
                        <tr key={e.id} style={{borderBottom:'1px solid #f0f0f0',cursor:'pointer'}} onClick={()=>navigate(`/enfants/${e.id}`)} onMouseOver={ev=>ev.currentTarget.style.background='#f4f6fb'} onMouseOut={ev=>ev.currentTarget.style.background='transparent'}>
                          <td style={{padding:'10px 12px',fontWeight:600}}>{e.nom} {e.prenom}</td>
                          <td style={{padding:'10px 12px',color:'#5a6478'}}>{fmtDate(e.date_placement)} → {e.date_fin_placement?fmtDate(e.date_fin_placement):'en cours'}</td>
                          <td style={{padding:'10px 12px'}}><span style={{padding:'2px 8px',borderRadius:10,fontSize:11,fontWeight:600,background:e.type_placement==='relais'?'#fef3e2':'#e8eef8',color:e.type_placement==='relais'?'#d97706':'#1a4b8f'}}>{e.type_placement==='relais'?'Relais':'Principal'}</span></td>
                          <td style={{padding:'10px 12px',color:'#5a6478'}}>{dureePlacement(e.date_placement,e.date_fin_placement)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </SectionCard>
            </>
          )}

          {onglet==='conges'&&(
            <>
              <SectionCard icon="🏖️" title="Solde de congés">
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:16}}>
                  {[{val:30,lbl:'Jours acquis',color:'#2e8b4a',bg:'#e6f5eb'},{val:congesPris,lbl:'Jours pris',color:'#1a4b8f',bg:'#e8eef8'},{val:congesRestants,lbl:'Jours restants',color:'#d97706',bg:'#fef3e2'},{val:conges.filter(c=>c.statut==='en_attente').reduce((s,c)=>s+(c.nb_jours||0),0),lbl:'En attente',color:'#6d4c9e',bg:'#f0ebfb'}].map((s,i)=>(
                    <div key={i} style={{background:s.bg,borderRadius:10,padding:14,textAlign:'center'}}><div style={{fontSize:24,fontWeight:700,color:s.color}}>{s.val}</div><div style={{fontSize:11,color:'#5a6478',marginTop:2}}>{s.lbl}</div></div>
                  ))}
                </div>
                <div style={{fontSize:12,color:'#5a6478',marginBottom:4}}>Consommation {congesPris}/30 jours ({Math.round((congesPris/30)*100)}%)</div>
                <div style={{height:8,background:'#eef1f8',borderRadius:10,overflow:'hidden'}}><div style={{height:'100%',width:`${Math.min(100,(congesPris/30)*100)}%`,background:congesPris>20?'#c0392b':'#2e8b4a',borderRadius:10}} /></div>
              </SectionCard>

              <SectionCard icon="📅" title="Demande de congés">
                <div style={{background:'#e8eef8',border:'1px solid #c4d4f5',borderRadius:9,padding:'10px 14px',fontSize:12,color:'#1a4b8f',marginBottom:16}}>
                  💡 La demande sera transmise à votre encadrant technique. Elle inclura les dates de relais pour chaque enfant accueilli.
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:12}}>
                  <div style={{display:'flex',flexDirection:'column',gap:5}}>
                    <label style={{fontSize:11,fontWeight:600,color:'#5a6478',textTransform:'uppercase'}}>Date de début</label>
                    <input type="date" className="form-control" value={congeDebut} onChange={e=>setCongeDebut(e.target.value)} />
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:5}}>
                    <label style={{fontSize:11,fontWeight:600,color:'#5a6478',textTransform:'uppercase'}}>Date de fin</label>
                    <input type="date" className="form-control" value={congeFin} onChange={e=>setCongeFin(e.target.value)} />
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:5}}>
                    <label style={{fontSize:11,fontWeight:600,color:'#5a6478',textTransform:'uppercase'}}>Nombre de jours</label>
                    <div style={{padding:'10px 12px',background:'#eef1f8',borderRadius:8,fontSize:13,fontWeight:600,color:'#1a4b8f'}}>{congeDebut&&congeFin?`${Math.ceil((new Date(congeFin)-new Date(congeDebut))/(1000*60*60*24))+1} jours`:'—'}</div>
                  </div>
                </div>
                {enfantsAccueillis.map(e=>(
                  <div key={e.id} style={{marginBottom:10}}>
                    <label style={{fontSize:11,fontWeight:600,color:'#5a6478',textTransform:'uppercase',display:'block',marginBottom:5}}>Famille relais pour {e.nom} {e.prenom}</label>
                    <input className="form-control" placeholder="Nom de l'AF relais..." value={congeRelais[e.id]||''} onChange={ev=>setCongeRelais(r=>({...r,[e.id]:ev.target.value}))} />
                  </div>
                ))}
                <div style={{marginBottom:12}}>
                  <label style={{fontSize:11,fontWeight:600,color:'#5a6478',textTransform:'uppercase',display:'block',marginBottom:5}}>Notes pour l'encadrant</label>
                  <textarea className="form-control" rows={3} value={congeNotes} onChange={e=>setCongeNotes(e.target.value)} placeholder="Informations complémentaires..." style={{resize:'vertical'}} />
                </div>
                <div style={{display:'flex',gap:10}}>
                  <button onClick={saveConge} className="btn btn-primary">📤 Envoyer la demande</button>
                  <button onClick={()=>showToast('💾 Brouillon sauvegardé')} className="btn btn-secondary">💾 Sauvegarder brouillon</button>
                </div>
              </SectionCard>

              <SectionCard icon="📋" title="Historique des congés">
                {conges.length===0 ? <div style={{color:'#9aa3b8',fontStyle:'italic',fontSize:13}}>Aucun congé enregistré</div>
                : conges.map(c=>{
                  const relaisInfo = c.notes?.split('\n')[0]
                  return (
                    <div key={c.id} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',background:'#f4f6fb',borderRadius:10,marginBottom:8,border:'1px solid #dde3f0'}}>
                      <span style={{fontSize:24}}>{c.statut==='valide'?'🏖️':c.statut==='refuse'?'❌':'⏳'}</span>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:600}}>{fmtDate(c.date_debut)} → {fmtDate(c.date_fin)}</div>
                        <div style={{fontSize:11,color:'#9aa3b8'}}>{c.nb_jours} jours{relaisInfo&&` · Relais : ${relaisInfo}`}</div>
                      </div>
                      <span style={{padding:'3px 10px',borderRadius:10,fontSize:11,fontWeight:600,background:c.statut==='valide'?'#e6f5eb':c.statut==='refuse'?'#fdf0ee':'#fef3e2',color:c.statut==='valide'?'#2e8b4a':c.statut==='refuse'?'#c0392b':'#d97706'}}>
                        {c.statut==='valide'?'✅ Validé':c.statut==='refuse'?'❌ Refusé':'⏳ En attente'}
                      </span>
                      {isReferent&&c.statut==='en_attente'&&<div style={{display:'flex',gap:6}}>
                        <button onClick={()=>validerConge(c.id,'valide')} style={{padding:'4px 8px',borderRadius:6,border:'1px solid #c4e8cc',background:'#e6f5eb',color:'#2e8b4a',fontSize:11,cursor:'pointer'}}>✅</button>
                        <button onClick={()=>validerConge(c.id,'refuse')} style={{padding:'4px 8px',borderRadius:6,border:'1px solid #fde8e8',background:'#fdf0ee',color:'#c0392b',fontSize:11,cursor:'pointer'}}>❌</button>
                      </div>}
                    </div>
                  )
                })}
              </SectionCard>
            </>
          )}

          {onglet==='formations'&&(
            <>
              <SectionCard icon="🎓" title="DEAF — Diplôme d'État">
                <div style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',background:af?.deaf_obtenu==='oui'?'#e6f5eb':'#fef3e2',borderRadius:10,marginBottom:14,border:`1px solid ${af?.deaf_obtenu==='oui'?'#c4e8cc':'#f5dca4'}`}}>
                  <span style={{fontSize:24}}>🎓</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:700,color:af?.deaf_obtenu==='oui'?'#2e8b4a':'#d97706'}}>{af?.deaf_obtenu==='oui'?'DEAF obtenu ✅':af?.deaf_obtenu==='en_cours'?'DEAF en cours ⏳':'DEAF non obtenu ❌'}</div>
                    {af?.deaf_date&&<div style={{fontSize:12,color:'#5a6478'}}>Obtenu le {fmtDate(af.deaf_date)} · {af.deaf_centre}</div>}
                    {af?.deaf_numero&&<div style={{fontSize:12,color:'#5a6478'}}>N° diplôme : {af.deaf_numero}</div>}
                  </div>
                </div>
                <FG cols={3}>
                  <div><label style={{fontSize:11,fontWeight:600,color:'#5a6478',textTransform:'uppercase',letterSpacing:'.4px',display:'block',marginBottom:5}}>Date d'obtention</label><div style={{padding:'10px 12px',background:'#eef1f8',borderRadius:8,fontSize:13}}>{fmtDate(af?.deaf_date)||'—'}</div></div>
                  <div><label style={{fontSize:11,fontWeight:600,color:'#5a6478',textTransform:'uppercase',letterSpacing:'.4px',display:'block',marginBottom:5}}>Centre de formation</label><div style={{padding:'10px 12px',background:'#eef1f8',borderRadius:8,fontSize:13}}>{af?.deaf_centre||'—'}</div></div>
                  <div><label style={{fontSize:11,fontWeight:600,color:'#5a6478',textTransform:'uppercase',letterSpacing:'.4px',display:'block',marginBottom:5}}>N° Diplôme</label><div style={{padding:'10px 12px',background:'#eef1f8',borderRadius:8,fontSize:13}}>{af?.deaf_numero||'—'}</div></div>
                </FG>
                {documents.filter(d=>d.type_doc==='deaf').map(d=>(
                  <div key={d.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:'#f4f6fb',borderRadius:9,border:'1px solid #dde3f0',marginTop:12,cursor:'pointer'}} onClick={()=>viewDoc(d.storage_path)}>
                    <span style={{fontSize:20}}>🎓</span>
                    <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600}}>{d.nom}</div><div style={{fontSize:11,color:'#9aa3b8'}}>PDF · {af?.deaf_centre} · {fmtDate(af?.deaf_date)}</div></div>
                    <button style={{padding:'4px 10px',borderRadius:7,border:'1px solid #dde3f0',background:'#fff',fontSize:12,cursor:'pointer'}}>👁 Voir</button>
                  </div>
                ))}
              </SectionCard>

              <SectionCard icon="📚" title="Formations continues">
                <button onClick={()=>setShowFormationModal(true)} className="btn btn-secondary" style={{marginBottom:16}}>+ Ajouter une formation</button>
                {formations.length===0 ? <div style={{color:'#9aa3b8',fontStyle:'italic',fontSize:13}}>Aucune formation enregistrée</div> : (
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                    <thead><tr style={{borderBottom:'2px solid #dde3f0'}}>{['Formation','Organisme','Date','Durée','Statut'].map(h=><th key={h} style={{padding:'8px 10px',textAlign:'left',fontSize:11,fontWeight:600,color:'#5a6478',textTransform:'uppercase',letterSpacing:'.3px'}}>{h}</th>)}</tr></thead>
                    <tbody>
                      {formations.map(f=>(
                        <tr key={f.id} style={{borderBottom:'1px solid #f0f0f0'}}>
                          <td style={{padding:'10px 10px',fontWeight:500}}>{f.titre}</td>
                          <td style={{padding:'10px 10px',color:'#9aa3b8'}}>{f.organisme}</td>
                          <td style={{padding:'10px 10px',color:'#9aa3b8'}}>{f.date_debut?fmtDate(f.date_debut):'—'}</td>
                          <td style={{padding:'10px 10px',textAlign:'center'}}>{f.duree_heures?`${f.duree_heures} jours`:'—'}</td>
                          <td style={{padding:'10px 10px'}}><span style={{padding:'2px 8px',borderRadius:10,fontSize:11,fontWeight:600,background:f.statut==='validee'?'#e6f5eb':f.statut==='planifiee'?'#fef3e2':'#e8eef8',color:f.statut==='validee'?'#2e8b4a':f.statut==='planifiee'?'#d97706':'#1a4b8f'}}>{f.statut==='validee'?'✅ Validée':f.statut==='planifiee'?'⏳ Planifiée':f.statut}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </SectionCard>
            </>
          )}

          {onglet==='safa'&&(
            <>
              <SectionCard icon="👥" title="Équipe SAFA référente">
                <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:12}}>
                  {collegues.filter(c=>c.role==='encadrant').map(c=>(
                    <div key={c.id} style={{background:'#f4f6fb',borderRadius:10,padding:16,border:'1px solid #dde3f0'}}>
                      <div style={{fontSize:11,fontWeight:600,color:'#5a6478',textTransform:'uppercase',marginBottom:8}}>👨‍💼 Encadrant Technique</div>
                      <div style={{fontSize:14,fontWeight:700,marginBottom:8}}>{c.nom} {c.prenom}</div>
                      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                        {c.telephone&&<a href={`tel:${c.telephone}`} style={{display:'flex',alignItems:'center',gap:4,padding:'5px 10px',borderRadius:7,background:'#e8eef8',color:'#1a4b8f',fontSize:12,textDecoration:'none',fontFamily:'Sora,sans-serif'}}>📞 {c.telephone}</a>}
                        {c.email&&<a href={`mailto:${c.email}`} style={{display:'flex',alignItems:'center',gap:4,padding:'5px 10px',borderRadius:7,background:'#e6f5eb',color:'#2e8b4a',fontSize:12,textDecoration:'none',fontFamily:'Sora,sans-serif'}}>✉️ {c.email}</a>}
                      </div>
                    </div>
                  ))}
                  <div style={{background:'#f4f6fb',borderRadius:10,padding:16,border:'1px solid #dde3f0'}}>
                    <div style={{fontSize:11,fontWeight:600,color:'#5a6478',textTransform:'uppercase',marginBottom:12}}>💰 Gestionnaire Paie</div>
                    {editMode ? (
                      <FG cols={1}>
                        <Field label="Nom Prénom" value={v('gestionnaire_paie_nom')} onChange={F('gestionnaire_paie_nom')} />
                        <Field label="Téléphone" type="tel" value={v('gestionnaire_paie_tel')} onChange={F('gestionnaire_paie_tel')} />
                        <Field label="Email" type="email" value={v('gestionnaire_paie_email')} onChange={F('gestionnaire_paie_email')} />
                      </FG>
                    ) : v('gestionnaire_paie_nom') ? (
                      <div>
                        <div style={{fontSize:14,fontWeight:700,marginBottom:8}}>{v('gestionnaire_paie_nom')}</div>
                        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                          {v('gestionnaire_paie_tel')&&<a href={`tel:${v('gestionnaire_paie_tel')}`} style={{display:'flex',alignItems:'center',gap:4,padding:'5px 10px',borderRadius:7,background:'#e8eef8',color:'#1a4b8f',fontSize:12,textDecoration:'none',fontFamily:'Sora,sans-serif'}}>📞 {v('gestionnaire_paie_tel')}</a>}
                          {v('gestionnaire_paie_email')&&<a href={`mailto:${v('gestionnaire_paie_email')}`} style={{display:'flex',alignItems:'center',gap:4,padding:'5px 10px',borderRadius:7,background:'#e6f5eb',color:'#2e8b4a',fontSize:12,textDecoration:'none',fontFamily:'Sora,sans-serif'}}>✉️ {v('gestionnaire_paie_email')}</a>}
                        </div>
                      </div>
                    ) : <div style={{fontSize:12,color:'#9aa3b8',fontStyle:'italic'}}>Non renseigné — cliquez sur Modifier</div>}
                  </div>
                </div>
              </SectionCard>

              <SectionCard icon="📃" title="Contrat de travail">
                <FG cols={3}>
                  <Field label="Type de contrat" value="CDI — Assistant Familial" readOnly />
                  <div style={{display:'flex',flexDirection:'column',gap:5}}>
                    <label style={{fontSize:11,fontWeight:600,color:'#5a6478',textTransform:'uppercase',letterSpacing:'.4px'}}>Date de début</label>
                    {editMode ? <input type="date" className="form-control" value={v('date_debut_contrat')} onChange={e=>F('date_debut_contrat')(e.target.value)} /> : <div style={{padding:'10px 12px',background:'#eef1f8',borderRadius:8,fontSize:13}}>{fmtDate(v('date_debut_contrat'))||'—'}</div>}
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:5}}>
                    <label style={{fontSize:11,fontWeight:600,color:'#5a6478',textTransform:'uppercase',letterSpacing:'.4px'}}>Ancienneté</label>
                    <div style={{padding:'10px 12px',background:'#eef1f8',borderRadius:8,fontSize:13,color:'#1a4b8f',fontWeight:600}}>{calcAnciennete(af?.date_debut_contrat)}</div>
                  </div>
                  <Field label="Employeur" value="Conseil Départemental du Tarn (81)" readOnly />
                  <Field label="Convention collective" value="CC Assistants familiaux" readOnly span={2} />
                </FG>
                <div style={{marginTop:14}}>
                  <label style={{display:'flex',alignItems:'center',gap:8,padding:'7px 12px',border:'1px dashed #c4d4f5',borderRadius:8,background:'#f0f9ff',color:'#1a4b8f',fontSize:12,cursor:'pointer',fontFamily:'Sora,sans-serif'}}>
                    {uploadingDoc==='contrat'?'⏳...':'📎 Uploader contrat de travail'}
                    <input type="file" accept="image/*,application/pdf" style={{display:'none'}} onChange={e=>{if(e.target.files[0]) uploadDoc(e.target.files[0],'contrat')}} />
                  </label>
                  {documents.filter(d=>d.type_doc==='contrat').map(d=>(
                    <div key={d.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:'#f4f6fb',borderRadius:9,border:'1px solid #dde3f0',marginTop:6,cursor:'pointer'}} onClick={()=>viewDoc(d.storage_path)}>
                      <span style={{fontSize:20}}>📃</span>
                      <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600}}>{d.nom}</div><div style={{fontSize:11,color:'#9aa3b8'}}>PDF · CD Tarn · {fmtDate(af?.date_debut_contrat)}</div></div>
                      <button style={{padding:'4px 10px',borderRadius:7,border:'1px solid #dde3f0',background:'#fff',fontSize:12,cursor:'pointer'}}>👁 Voir</button>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </>
          )}
        </div>
      </div>

      {showFormationModal&&(
        <div className="modal-overlay" onClick={()=>setShowFormationModal(false)}>
          <div className="modal-box" style={{maxWidth:520}} onClick={e=>e.stopPropagation()}>
            <div className="modal-title">🎓 Ajouter une formation</div>
            <div className="form-grid-2">
              <div className="form-group col-span-2"><label className="form-label">Titre *</label><input className="form-control" value={newFormation.titre} onChange={e=>setNewFormation(n=>({...n,titre:e.target.value}))} autoFocus /></div>
              <div className="form-group"><label className="form-label">Organisme</label><input className="form-control" value={newFormation.organisme} onChange={e=>setNewFormation(n=>({...n,organisme:e.target.value}))} placeholder="IRTS, CNFPT..." /></div>
              <div className="form-group"><label className="form-label">Durée (jours)</label><input type="number" className="form-control" value={newFormation.duree_heures} onChange={e=>setNewFormation(n=>({...n,duree_heures:e.target.value}))} /></div>
              <div className="form-group"><label className="form-label">Date de début</label><input type="date" className="form-control" value={newFormation.date_debut} onChange={e=>setNewFormation(n=>({...n,date_debut:e.target.value}))} /></div>
              <div className="form-group"><label className="form-label">Statut</label><select className="form-control" value={newFormation.statut} onChange={e=>setNewFormation(n=>({...n,statut:e.target.value}))}><option value="planifiee">⏳ Planifiée</option><option value="en_cours">🔄 En cours</option><option value="validee">✅ Validée</option></select></div>
            </div>
            <div className="modal-footer"><button className="btn btn-secondary" onClick={()=>setShowFormationModal(false)}>Annuler</button><button className="btn btn-primary" onClick={saveFormation}>✅ Ajouter</button></div>
          </div>
        </div>
      )}

      {showFoyerModal&&(
        <div className="modal-overlay" onClick={()=>setShowFoyerModal(false)}>
          <div className="modal-box" style={{maxWidth:420}} onClick={e=>e.stopPropagation()}>
            <div className="modal-title">👥 Ajouter une personne du foyer</div>
            <div className="form-grid-2">
              <div className="form-group"><label className="form-label">Prénom *</label><input className="form-control" value={newFoyerEnfant.prenom} onChange={e=>setNewFoyerEnfant(n=>({...n,prenom:e.target.value}))} autoFocus /></div>
              <div className="form-group"><label className="form-label">Nom</label><input className="form-control" value={newFoyerEnfant.nom} onChange={e=>setNewFoyerEnfant(n=>({...n,nom:e.target.value}))} /></div>
              <div className="form-group"><label className="form-label">Date de naissance</label><input type="date" className="form-control" value={newFoyerEnfant.date_naissance} onChange={e=>setNewFoyerEnfant(n=>({...n,date_naissance:e.target.value}))} /></div>
              <div className="form-group"><label className="form-label">Sexe</label><select className="form-control" value={newFoyerEnfant.sexe} onChange={e=>setNewFoyerEnfant(n=>({...n,sexe:e.target.value}))}><option value="M">👦 Masculin</option><option value="F">👧 Féminin</option></select></div>
              <div className="form-group col-span-2"><label className="form-label">Lien avec l'AF</label><select className="form-control" value={newFoyerEnfant.lien} onChange={e=>setNewFoyerEnfant(n=>({...n,lien:e.target.value}))}><option value="enfant">Enfant</option><option value="conjoint">Conjoint(e)</option><option value="autre">Autre cohabitant</option></select></div>
            </div>
            <div className="modal-footer"><button className="btn btn-secondary" onClick={()=>setShowFoyerModal(false)}>Annuler</button><button className="btn btn-primary" onClick={saveFoyerEnfant}>✅ Ajouter</button></div>
          </div>
        </div>
      )}

      {toast&&<div className="toast">{toast}</div>}
    </div>
  )
}
