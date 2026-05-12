
// api/distance.js — Proxy Vercel pour Google Maps Distance Matrix API
export default async function handler(req, res) {
  const { origine, destination } = req.query
  if (!origine || !destination) {
    return res.status(400).json({ error: 'Paramètres manquants' })
  }

  const key = process.env.REACT_APP_GOOGLE_MAPS_KEY
  if (!key) return res.status(500).json({ error: 'Clé API manquante' })

  try {
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origine)}&destinations=${encodeURIComponent(destination)}&mode=driving&language=fr&key=${key}`
    const resp = await fetch(url)
    const data = await resp.json()

    if (data.status !== 'OK') return res.status(500).json({ error: data.status })

    const element = data.rows?.[0]?.elements?.[0]
    if (!element || element.status !== 'OK') return res.status(404).json({ error: 'Trajet introuvable' })

    const km = Math.round(element.distance.value / 100) / 10 // en km arrondi à 0.1
    return res.status(200).json({ km, texte: element.distance.text, duree: element.duration.text })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
