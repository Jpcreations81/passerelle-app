// parse-pdf.js — v2026-06-16a — détection enfant renforcée : "concernant NOM", "sera accueilli(e)"
// api/parse-pdf.js
// Vercel Serverless Function — lit un PDF et extrait les événements via Claude API
// Variables d'environnement requises dans Vercel :
//   ANTHROPIC_API_KEY = sk-ant-...

export const config = { maxDuration: 30 }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { pdf, filename } = req.body
  if (!pdf) return res.status(400).json({ error: 'PDF base64 requis' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  // Debug complet
  const allEnvKeys = Object.keys(process.env).filter(k => !k.includes('SECRET') && !k.includes('TOKEN'))
  if (!apiKey) return res.status(500).json({ 
    error: 'ANTHROPIC_API_KEY non configurée',
    env_keys_disponibles: allEnvKeys,
    node_env: process.env.NODE_ENV
  })

  const prompt = `Tu es un assistant pour les Assistants Familiaux de l'ASE du Tarn (81).
Analyse ce document PDF et extrait TOUS les événements (rendez-vous, visites, réunions, relais, adaptations, etc.).

RÈGLE sur les enfants :
- L'enfant est TOUJOURS le mineur confié à l'ASE, JAMAIS l'assistante familiale.
- Dans un courrier dont l'objet contient un nom propre : "Calendrier relais concernant Madyson NAVARRO" → l'enfant est "Madyson NAVARRO".
- Dans un courrier dont l'objet est "Calendrier d'accueils relais Léna BOYOT" → l'enfant est "Léna BOYOT".
- Toute formulation "concernant [Prénom NOM]", "relatif à [Prénom NOM]", "pour [Prénom NOM]" dans l'objet → c'est l'enfant.
- Si le document dit "[Prénom] sera accueilli(e)" ou "[Prénom] sera hébergé(e)" → c'est l'enfant.
- Si le document dit "votre fille/fils [Prénom]" ou "l'enfant [Prénom NOM]" → c'est l'enfant.
- "Madame LAURENT, assistante familiale" ou "Madame ABOUDAOUD, assistante familiale" → c'est l'AF relais, PAS l'enfant. Ne jamais mettre le nom de l'AF dans enfants_noms.
- "assistant familial", "assistante familiale", "famille d'accueil", "famille relais" = toujours un AF adulte, JAMAIS l'enfant.
- Le nom dans l'objet du courrier = toujours l'enfant (sauf si explicitement qualifié d'AF).
- Liste tous les enfants concernés dans enfants_noms.
- Si l'événement ne concerne qu'un enfant : enfants_noms: ["Léna BOYOT"]
- Si plusieurs enfants : enfants_noms: ["Lou Pereira", "Ava Pereira"]

RÈGLE sur les relais et adaptations :
- "Adaptation" = rencontres préparatoires avant le relais → categorie: "relais", notes doit contenir "Adaptation"
- "Accueil relais" = hébergement chez famille relais → categorie: "relais", notes doit contenir "Relais"
- Extraire le nom de la famille relais dans relais_nom (ex: "ABOUDAOUD Fares") — c'est le nom de l'ASSISTANTE FAMILIALE qui accueille l'enfant, jamais le nom de l'enfant lui-même
- Pour les périodes multi-jours sans heures : date_debut = debut à T00:00:00, date_fin = fin à T23:59:00

RÈGLE sur les TISF :
- tisf_debut et tisf_fin = heures de présence de la TISF si mentionnées, sinon null

Pour chaque événement, retourne un objet JSON avec :
- titre : OBLIGATOIRE suivre ces règles : pour une VM → "VM — [qui] — [lieu]" (ex: "VM — Père — Graulhet", "VM — Mère — Castres", "VM — Parents — AID 81"). Pour un relais → "Relais — [nom famille]". Ne JAMAIS mettre juste "VM" sans préciser qui et où.
- categorie : string parmi ["vm", "ase", "medical", "scolaire", "relais", "conge", "formation", "personnel", "autre"]
- date_debut : string ISO 8601 en heure locale française (Europe/Paris), ex: "2026-04-01T15:00:00" pour 15h
- date_fin : string ISO 8601 en heure locale française (Europe/Paris), ex: "2026-04-01T17:00:00" pour 17h
- IMPORTANT : les heures doivent être EXACTEMENT celles du document, sans conversion UTC
- lieu : string (ex: "Domicile ABOUDAOUD", "Marssac/Tarn", "AID 81 Graulhet")
- notes : string (préciser si Adaptation ou Relais, nom famille relais, présence TISF, etc.)
- enfants_noms : array de strings (prénoms et noms des enfants)
- relais_nom : string ou null — OBLIGATOIRE si categorie="relais", mettre le nom complet de la famille relais (ex: "ABOUDAOUD Fares"), sinon null
- tisf_debut : string heure ou null (ex: "15:00")
- tisf_fin : string heure ou null (ex: "17:00")
- vm_presents : array parmi ["pere", "mere", "parents", "fratrie", "pere_fratrie", "mere_fratrie", "parents_fratrie"] — OBLIGATOIRE si categorie="vm", détecter qui est présent à la visite (ex: "le père" → ["pere"], "les parents" → ["parents"], "la mère et la fratrie" → ["mere_fratrie"]), sinon []

RÈGLE sur les VM :
- Pour les visites médiatisées, détecter qui est présent : père, mère, les deux parents, fratrie
- [qui] dans le titre = le PARENT ou ADULTE présent, JAMAIS le nom de l'enfant
- Exemples CORRECTS : "VM — Père — Graulhet", "VM — Mère — Castres", "VM — Parents — AID 81"
- Exemples INCORRECTS : "VM — Ava — Graulhet" ❌, "VM — Lou — Castres" ❌ (ne jamais mettre le prénom de l'enfant dans le titre)
- Si le document dit "visite au domicile du père" → titre: "VM — Père — Domicile PEREIRA" (nom de famille du père)
- Si le document dit "visite au domicile de la mère" → titre: "VM — Mère — Domicile ROTONDO" (nom de famille de la mère)
- vm_presents doit aussi correspondre : père → ["pere"], mère → ["mere"], les deux → ["parents"]
- Le lieu = toujours celui mentionné dans le PDF en priorité (ville, adresse, lieu-dit, structure)
- Si le PDF dit "à Gaillac" → lieu: "Gaillac"
- Si le PDF dit "au domicile de la mère" sans préciser → lieu: "Domicile [nom de famille]" (ex: "Domicile ROTONDO")
- Si le PDF dit "au domicile du père" sans préciser → lieu: "Domicile [nom de famille père]" (ex: "Domicile PEREIRA")
- Si présence non précisée : titre: "VM — [lieu]"

Règles de catégorisation :
- "vm" : visite médiatisée, visite en présence, droit de visite
- "relais" : accueil relais, famille relais, adaptation relais, rencontres préparatoires
- "ase" : réunion ASE, synthèse, audience tribunal (TJ), convocation
- "medical" : consultation, rendez-vous médical, vaccin, pédiatre
- "scolaire" : réunion parents, conseil de classe, rendez-vous école
- "formation" : formation, stage assistant familial
- "conge" : vacances, congés

Réponds UNIQUEMENT avec un JSON valide, rien d'autre, pas de markdown :
{"evenements": [...]}

Si aucun événement n'est trouvé : {"evenements": []}`

  // Récupérer le dernier modèle Haiku disponible
  let model = 'claude-haiku-4-5-20251001' // fallback
  try {
    const modelsResp = await fetch('https://api.anthropic.com/v1/models', {
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }
    })
    if (modelsResp.ok) {
      const modelsData = await modelsResp.json()
      const haiku = modelsData.data?.find(m => m.id.includes('haiku'))
      if (haiku) model = haiku.id
    }
  } catch(e) { /* utilise le fallback */ }
  console.log('Modèle utilisé:', model)

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model,
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: pdf,
              }
            },
            {
              type: 'text',
              text: prompt
            }
          ]
        }]
      })
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Anthropic API error:', err)
      return res.status(500).json({ error: 'Erreur API Claude : ' + response.status })
    }

    const data = await response.json()
    const text = data.content?.[0]?.text || ''

    // Parser le JSON retourné par Claude
    let parsed
    try {
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      parsed = JSON.parse(cleaned)
    } catch (e) {
      console.error('JSON parse error:', e, 'Raw text:', text)
      return res.status(500).json({ error: 'Impossible de parser la réponse de Claude', raw: text })
    }

    return res.status(200).json(parsed)

  } catch (e) {
    console.error('Handler error:', e)
    return res.status(500).json({ error: e.message })
  }
}
