# 🌉 Passerelle — Application ASE Tarn (81)

## Description
Plateforme collaborative entre les Assistants Familiaux et l'ASE du département du Tarn.

## Stack technique
- **Frontend** : React 18
- **Backend / Base de données** : Supabase (PostgreSQL)
- **Hébergement** : Vercel
- **Authentification** : Supabase Auth

---

## 🚀 Installation

### 1. Cloner le projet
```bash
git clone https://github.com/VOTRE_USERNAME/passerelle-app.git
cd passerelle-app
npm install
```

### 2. Configurer Supabase
Votre projet Supabase est déjà configuré dans `src/lib/supabase.js`

**Exécuter le schéma SQL :**
1. Allez sur [supabase.com](https://supabase.com)
2. Ouvrez votre projet `passerelle-tarn`
3. Allez dans **SQL Editor**
4. Copiez-collez le contenu de `supabase-schema.sql`
5. Cliquez **Run**

### 3. Créer les utilisateurs de test
Dans Supabase → Authentication → Users → **Add user** :

| Email | Mot de passe | Rôle |
|-------|-------------|------|
| marie.laurent@passerelle-af.fr | Passerelle2026! | AF |
| l.gondy@tarn.fr | Passerelle2026! | Référente |
| f.salles@tarn.fr | Passerelle2026! | Encadrant |
| s.verdier@tarn.fr | Passerelle2026! | RTASE |

⚠️ Les IDs des utilisateurs créés dans Auth doivent correspondre aux IDs dans la table `profiles`.
Après création, mettez à jour les UUIDs dans le fichier `supabase-schema.sql`.

### 4. Lancer en local
```bash
npm start
```
Ouvrez http://localhost:3000

---

## 📦 Déploiement sur Vercel

### 1. Pousser sur GitHub
```bash
git init
git add .
git commit -m "Initial commit — Passerelle v1"
git branch -M main
git remote add origin https://github.com/VOTRE_USERNAME/passerelle-app.git
git push -u origin main
```

### 2. Déployer sur Vercel
1. Allez sur [vercel.com](https://vercel.com)
2. **New Project** → importer depuis GitHub
3. Sélectionnez `passerelle-app`
4. **Deploy** — c'est tout !

Votre URL sera : `https://passerelle-app-XXXX.vercel.app`

---

## 🗂️ Structure du projet

```
src/
  lib/
    supabase.js          # Client Supabase
  pages/
    Login.js             # Page de connexion
    Dashboard.js         # Tableau de bord
    DossierEnfant.js     # Dossier complet enfant
  components/
    Sidebar.js           # Navigation latérale
  App.js                 # Routes principales
  App.css                # Styles globaux
supabase-schema.sql      # Schéma BDD + données de test
vercel.json              # Config déploiement
```

---

## 👥 Rôles utilisateurs

| Rôle | Accès |
|------|-------|
| `af` | Ses enfants, son agenda, ses documents |
| `referent` | Tous les enfants de son territoire |
| `encadrant` | Tous les AF et enfants de son territoire |
| `gestionnaire` | Fiches présence, paie |
| `rtase` | Vue complète, placement urgence |
| `admin` | Accès total |

---

## 📞 Support
Projet Passerelle — Département du Tarn (81) — MD Gaillac-Graulhet
