// api/read-agrement.js
// Lit un PDF d'agrément AF et extrait les données structurées via Claude API

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { pdfBase64 } = req.body
  if (!pdfBase64) return res.status(400).json({ error: 'PDF requis' })

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: pdfBase64,
              }
            },
            {
              type: 'text',
              text: `Tu es un assistant qui extrait des données d'un agrément d'assistant familial français.
Lis ce document et extrait UNIQUEMENT les informations suivantes en JSON, sans aucun texte autour :
{
  "numero_agrement": "le numéro d'agrément (ex: AGR-XX-XXXX-XXXX ou format similaire)",
  "delivre_par": "l'organisme qui a délivré l'agrément (PMI, conseil départemental, etc.)",
  "date_agrement": "date de délivrance au format YYYY-MM-DD",
  "date_expiration_agrement": "date d'expiration au format YYYY-MM-DD",
  "places_agreees": nombre entier de places agréées,
  "nom": "NOM de l'assistant familial en majuscules",
  "prenom": "Prénom de l'assistant familial",
  "adresse": "adresse complète",
  "code_postal": "code postal",
  "ville": "ville"
}
Si une information est absente du document, mets null pour ce champ.
Réponds UNIQUEMENT avec le JSON, sans markdown, sans explication.`
            }
          ]
        }]
      })
    })

    const data = await response.json()
    if (!response.ok) throw new Error(data.error?.message || 'Erreur API Claude')

    const text = data.content?.[0]?.text || ''
    // Parser le JSON retourné
    const clean = text.replace(/```json|```/g, '').trim()
    const extracted = JSON.parse(clean)

    res.status(200).json({ success: true, data: extracted })
  } catch (error) {
    console.error('Erreur read-agrement:', error)
    res.status(500).json({ error: error.message })
  }
}
