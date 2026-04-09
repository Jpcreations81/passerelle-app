// api/parse-pdf-modif.js
// Vercel Serverless Function — lit un PDF de modification de calendrier

export const config = { maxDuration: 30 }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { pdf, filename, evenements_existants } = req.body
  if (!pdf) return res.status(400).json({ error: 'PDF base64 requis' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY non configurée' })

  // Préparer le contexte des événements existants avec dates lisibles
  const contexteExistants = evenements_existants && evenements_existants.length > 0
    ? `\nÉVÉNEMENTS DÉJÀ DANS L'AGENDA (utilise date_debut_lisible pour comparer avec le PDF) :\n${
        evenements_existants.map(e =>
          `- ID:${e.id} | ${e.categorie} | "${e.date_debut_lisible}" → "${e.date_fin_lisible}" | Enfants: ${(e.enfants_noms || []).join(', ')}`
        ).join('\n')
      }\n`
    : '\nAucun événement existant en base.\n'

  const prompt = `Tu es un assistant pour les Assistants Familiaux de l'ASE du Tarn (81).
Ce document PDF est un CALENDRIER MODIFIÉ — il remplace ou met à jour des événements existants.
${contexteExistants}

RÈGLE ABSOLUE sur la comparaison avec l'agenda existant :
- Compare les dates du PDF avec les "date_debut_lisible" des événements existants
- Si le PDF mentionne une date qui existe déjà dans l'agenda pour le même enfant et la même catégorie → action = "inchange" (si identique) ou "modifier" (si heures/lieu changés)
- Si le PDF mentionne une date qui N'EXISTE PAS dans l'agenda → action = "creer"
- Si le PDF dit "en remplacement de X" → l'événement X doit être supprimé (action = "supprimer" pour l'ancien) et le nouveau créé (action = "creer")

RÈGLE sur les enfants :
- 1 objet par enfant — si "Ava et Lou", crée 2 objets séparés
- Sois précis : si le PDF dit "en présence de Lou et Téo" → seulement Lou (Téo n'est pas un enfant ASE)
- Si le PDF dit "Lou en relais" → Lou n'est PAS présent à cette VM

RÈGLE sur les heures :
- Les heures doivent être EXACTEMENT celles du document, en heure française locale
- "15h à 17h" → date_debut: "...T15:00:00", date_fin: "...T17:00:00"

RÈGLE sur les TISF :
- tisf_debut et tisf_fin = heures de présence TISF si mentionnées

Pour chaque événement, retourne :
- action : "creer", "modifier", "inchange", ou "supprimer"
- evenement_id_existant : ID exact (copié depuis la liste ci-dessus) de l'événement à modifier/supprimer, sinon null
- date_originale_lisible : la date de l'événement remplacé si mentionné dans le PDF (ex: "lundi 27 avril 2026 à 15:00")
- titre : court (ex: "VM — Marssac/Tarn")
- categorie : "vm", "ase", "medical", "scolaire", "relais", "conge", "formation", "personnel", "autre"
- date_debut : ISO 8601 heure française (ex: "2026-05-03T10:00:00")
- date_fin : ISO 8601 heure française
- lieu : string
- notes : string (TISF, enfants présents, info remplacement)
- enfants_noms : array avec 1 seul prénom+nom (ex: ["Lou Pereira"])
- tisf_debut : heure ou null
- tisf_fin : heure ou null

Réponds UNIQUEMENT avec un JSON valide :
{"evenements": [...], "est_calendrier_modifie": true, "resume": "description courte des changements"}

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
