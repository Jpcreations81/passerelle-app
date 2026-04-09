// api/parse-pdf-modif.js
// Vercel Serverless Function — lit un PDF de modification de calendrier
// Compare avec les événements existants et propose des mises à jour

export const config = { maxDuration: 30 }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { pdf, filename, evenements_existants } = req.body
  if (!pdf) return res.status(400).json({ error: 'PDF base64 requis' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY non configurée' })

  // Préparer le contexte des événements existants
  const contexteExistants = evenements_existants && evenements_existants.length > 0
    ? `\nÉVÉNEMENTS DÉJÀ EN BASE (à comparer avec le nouveau calendrier) :\n${
        evenements_existants.map(e =>
          `- ID:${e.id} | ${e.categorie} | ${e.date_debut} → ${e.date_fin} | ${e.titre} | Enfants: ${e.enfants_noms || ''}`
        ).join('\n')
      }\n`
    : ''

  const prompt = `Tu es un assistant pour les Assistants Familiaux de l'ASE du Tarn (81).
Ce document est un CALENDRIER MODIFIÉ — il remplace ou met à jour des dates existantes.
${contexteExistants}

Pour chaque événement du PDF, détermine s'il faut :
- "creer" : nouvel événement qui n'existait pas avant
- "modifier" : mise à jour d'un événement existant (même type/enfant, date différente)
- "inchange" : événement identique à un existant (même date, même enfant)

Pour identifier un événement existant à modifier, compare :
- La catégorie (vm, relais, etc.)
- Les enfants concernés
- Si le PDF mentionne explicitement "en remplacement de" ou "reporté du", utilise cette info

RÈGLE sur les enfants :
- 1 objet par enfant — si "Ava et Lou", crée 2 objets séparés

RÈGLE sur les TISF :
- tisf_debut et tisf_fin = heures de présence si mentionnées

Pour chaque événement, retourne :
- action : "creer", "modifier", ou "inchange"
- evenement_id_existant : ID de l'événement existant à modifier (si action="modifier"), sinon null
- date_originale : ancienne date si connue (ex: "2026-04-27T15:00:00"), sinon null
- titre : string court (ex: "VM — Marssac/Tarn")
- categorie : "vm", "ase", "medical", "scolaire", "relais", "conge", "formation", "personnel", "autre"
- date_debut : string ISO 8601
- date_fin : string ISO 8601
- lieu : string
- notes : string (infos TISF, remplacement, présence enfants, etc.)
- enfants_noms : array avec 1 seul enfant (ex: ["Lou Pereira"])
- tisf_debut : string heure ou null
- tisf_fin : string heure ou null

Réponds UNIQUEMENT avec un JSON valide :
{"evenements": [...], "est_calendrier_modifie": true, "resume": "string court décrivant les changements"}

Si aucun événement : {"evenements": [], "est_calendrier_modifie": false, "resume": ""}`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: pdf }
            },
            { type: 'text', text: prompt }
          ]
        }]
      })
    })

    if (!response.ok) {
      const err = await response.text()
      return res.status(500).json({ error: 'Erreur API Claude : ' + response.status + ' ' + err })
    }

    const data = await response.json()
    const text = data.content?.[0]?.text || ''

    let parsed
    try {
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      parsed = JSON.parse(cleaned)
    } catch (e) {
      return res.status(500).json({ error: 'Impossible de parser la réponse', raw: text })
    }

    return res.status(200).json(parsed)

  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
