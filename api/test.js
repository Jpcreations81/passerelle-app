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
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY non configurée' })

  const prompt = `Tu es un assistant pour les Assistants Familiaux de l'ASE du Tarn (81).
Analyse ce document PDF et extrait TOUS les événements (rendez-vous, visites, réunions, etc.).

RÈGLE CRITIQUE sur les enfants :
- Si un événement concerne PLUSIEURS enfants (ex: "Ava et Lou", "ses filles Ava et Lou"),
  crée UN événement SÉPARÉ par enfant avec enfants_noms contenant UN SEUL enfant.
- Exemple : "VM avec Ava et Lou le 13 avril 15h-17h" → crée 2 objets séparés :
  {"titre":"VM — Marssac/Tarn","date_debut":"2026-04-13T15:00:00","enfants_noms":["Lou Pereira"],...}
  {"titre":"VM — Marssac/Tarn","date_debut":"2026-04-13T15:00:00","enfants_noms":["Ava Pereira"],...}
- Ne jamais mettre 2 enfants dans le même enfants_noms.

Pour chaque événement, retourne un objet JSON avec :
- titre : string court (ex: "VM — Marssac/Tarn", "Audience TJ Gaillac")
- categorie : string parmi ["vm", "ase", "medical", "scolaire", "relais", "conge", "formation", "personnel", "autre"]
- date_debut : string ISO 8601 (ex: "2026-04-13T15:00:00")
- date_fin : string ISO 8601 (ex: "2026-04-13T17:00:00")
- lieu : string (ex: "Marssac/Tarn", "Tribunal de Gaillac")
- notes : string (informations supplémentaires)
- enfants_noms : array avec UN SEUL prénom+nom (ex: ["Lou Pereira"] ou ["Ava Pereira"])
- tisf_debut : string heure ou null (ex: "15:00")
- tisf_fin : string heure ou null (ex: "17:00")

Règles de catégorisation :
- "vm" : visite médiatisée, visite en présence, droit de visite
- "ase" : réunion ASE, synthèse, audience tribunal (TJ), convocation
- "medical" : consultation, rendez-vous médical, vaccin, pédiatre
- "scolaire" : réunion parents, conseil de classe, rendez-vous école
- "relais" : accueil relais, famille relais
- "formation" : formation, stage assistant familial

Réponds UNIQUEMENT avec un JSON valide, rien d'autre, pas de markdown :
{"evenements": [...]}

Si aucun événement n'est trouvé : {"evenements": []}`

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
      // Nettoyer les éventuels backticks markdown
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
