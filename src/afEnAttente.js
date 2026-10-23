// afEnAttente.js — v2026-10-14a — emplacement : src/lib/afEnAttente.js
// Création centralisée d'une AF "en attente d'inscription" (vraie fiche profiles, sans compte de connexion).
// Utilisé par : ListeEnfants, DossierEnfant, FicheConges, Agenda.
// Règles : prénom, nom ET ville obligatoires (la ville sert au calcul des frais tant que l'adresse n'est pas connue).
// À l'inscription de l'AF, un trigger SQL (migration_af_en_attente.sql) rattache automatiquement la fiche au vrai compte.
import { supabase } from './supabase'

const RE_EN_ATTENTE = /^temp\..+@passerelle\.local$/

// Une AF est "en attente" tant que son email est un faux email temp.xxx@passerelle.local
export function estEnAttente(profil) {
  return !!profil?.email && RE_EN_ATTENTE.test(profil.email)
}

function norm(s) {
  return (s || '').toString().trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

// Vérifie les champs obligatoires. Retourne un message d'erreur ou null.
export function validerAfEnAttente({ prenom, nom, ville }) {
  if (!prenom?.trim() || !nom?.trim() || !ville?.trim()) return 'Prénom, nom et ville de l\'AF sont obligatoires'
  return null
}

// Cherche une AF déjà présente (inscrite ou en attente) avec le même prénom + nom (insensible à la casse/accents)
// pour éviter de créer un doublon.
export async function trouverAfExistante({ prenom, nom }) {
  const { data } = await supabase.from('profiles')
    .select('id, prenom, nom, ville, email')
    .eq('role', 'af')
    .ilike('nom', nom.trim())
  const p = norm(prenom)
  const n = norm(nom)
  return (data || []).find(a => norm(a.nom) === n && norm(a.prenom) === p) || null
}

// Crée (ou retrouve) une AF en attente.
// Retourne { data, existante, error } — data = ligne profiles complète.
export async function creerAfEnAttente({ prenom, nom, ville }) {
  const err = validerAfEnAttente({ prenom, nom, ville })
  if (err) return { data: null, existante: false, error: { message: err } }

  const deja = await trouverAfExistante({ prenom, nom })
  if (deja) return { data: deja, existante: true, error: null }

  const { data, error } = await supabase.from('profiles').insert({
    id: crypto.randomUUID(),
    prenom: prenom.trim(),
    nom: nom.trim().toUpperCase(),
    ville: ville.trim(),
    role: 'af',
    email: `temp.${crypto.randomUUID()}@passerelle.local`,
  }).select().single()
  return { data: data || null, existante: false, error: error || null }
}
