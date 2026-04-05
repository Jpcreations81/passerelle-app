-- ═══════════════════════════════════════════════
-- PASSERELLE — Schéma base de données Supabase
-- Département du Tarn (81)
-- ═══════════════════════════════════════════════

-- PROFILS UTILISATEURS
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  nom text not null,
  prenom text not null,
  role text not null check (role in ('af', 'referent', 'encadrant', 'gestionnaire', 'rtase', 'admin')),
  matricule text,
  territoire text,
  telephone text,
  actif boolean default true,
  created_at timestamp with time zone default now()
);

-- ENFANTS
create table enfants (
  id uuid default gen_random_uuid() primary key,
  nom text not null,
  prenom text not null,
  date_naissance date not null,
  lieu_naissance text,
  numero_dossier text unique,
  sexe text check (sexe in ('M', 'F')),
  nationalite text default 'Française',
  numero_secu text,
  type_placement text check (type_placement in ('judiciaire', 'administratif', 'urgence', 'secret')),
  date_placement date,
  date_fin_placement date,
  af_principal_id uuid references profiles(id),
  referent_id uuid references profiles(id),
  territoire text,
  statut text default 'en_accueil' check (statut in (
    'en_accueil', 'en_relais', 'en_famille', 'en_parrainage',
    'colonie_vacances', 'colonie_neige', 'centre_departemental',
    'hospitalisation', 'internat', 'sejour_linguistique',
    'sejour_vacances_af', 'urgence_provisoire', 'fugue', 'inconnu'
  )),
  placement_secret boolean default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- ASSISTANTS FAMILIAUX (infos complémentaires au profil)
create table assistants_familiaux (
  id uuid references profiles(id) on delete cascade primary key,
  adresse text,
  code_postal text,
  ville text,
  date_naissance date,
  situation_familiale text,
  conjoint_nom text,
  conjoint_prenom text,
  conjoint_matricule text,
  numero_agrement text,
  date_agrement date,
  date_expiration_agrement date,
  places_agreees integer default 3,
  places_accordees integer default 3,
  accord_urgence boolean default false,
  types_accueil text[] default '{}',
  deaf_obtenu boolean default false,
  date_deaf date,
  vehicule_marque text,
  vehicule_cv integer default 5,
  created_at timestamp with time zone default now()
);

-- JOURNAL
create table journal (
  id uuid default gen_random_uuid() primary key,
  enfant_id uuid references enfants(id) on delete cascade not null,
  auteur_id uuid references profiles(id) not null,
  date_observation timestamp with time zone default now(),
  humeur text check (humeur in ('bien', 'neutre', 'difficile', 'incident')),
  observation text not null,
  tags text[] default '{}',
  visible_ase boolean default true,
  created_at timestamp with time zone default now()
);

-- AGENDA / EVENEMENTS
create table evenements (
  id uuid default gen_random_uuid() primary key,
  titre text not null,
  categorie text check (categorie in ('vm', 'relais', 'conge', 'medical', 'ase', 'scolaire', 'formation', 'personnel', 'autre')),
  date_debut timestamp with time zone not null,
  date_fin timestamp with time zone,
  lieu text,
  notes text,
  enfant_ids uuid[] default '{}',
  af_id uuid references profiles(id),
  cree_par uuid references profiles(id),
  visible_ase boolean default true,
  chevauchement_accepte boolean default false,
  source text default 'passerelle' check (source in ('passerelle', 'ase_import', 'autre_dept')),
  created_at timestamp with time zone default now()
);

-- DOCUMENTS
create table documents (
  id uuid default gen_random_uuid() primary key,
  nom text not null,
  categorie text not null,
  enfant_id uuid references enfants(id),
  af_id uuid references profiles(id),
  url_stockage text,
  taille_ko integer,
  transmis_ase boolean default false,
  date_transmission timestamp with time zone,
  created_at timestamp with time zone default now()
);

-- FICHES DE PRESENCE
create table fiches_presence (
  id uuid default gen_random_uuid() primary key,
  enfant_id uuid references enfants(id) not null,
  af_id uuid references profiles(id) not null,
  mois integer not null,
  annee integer not null,
  type_fiche text check (type_fiche in ('permanent', 'relais')),
  nb_jours_presence integer,
  nb_jours_feries integer,
  transmise boolean default false,
  date_transmission timestamp with time zone,
  donnees jsonb,
  created_at timestamp with time zone default now(),
  unique(enfant_id, af_id, mois, annee, type_fiche)
);

-- RAPPORTS
create table rapports (
  id uuid default gen_random_uuid() primary key,
  enfant_id uuid references enfants(id) not null,
  auteur_id uuid references profiles(id) not null,
  type_rapport text check (type_rapport in ('suivi_mensuel', 'relais', 'incident', 'audience_tj', 'fin_placement', 'bilan_annuel')),
  periode_mois integer,
  periode_annee integer,
  statut text default 'brouillon' check (statut in ('brouillon', 'envoye', 'valide')),
  contenu jsonb,
  transmis_a uuid references profiles(id),
  date_transmission timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- CONGES
create table conges (
  id uuid default gen_random_uuid() primary key,
  af_id uuid references profiles(id) not null,
  date_debut date not null,
  date_fin date not null,
  nb_jours integer,
  statut text default 'en_attente' check (statut in ('en_attente', 'accord', 'refus', 'accord_partiel')),
  solutions jsonb default '[]',
  valide_par uuid references profiles(id),
  date_validation timestamp with time zone,
  created_at timestamp with time zone default now()
);

-- ═══════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════

alter table profiles enable row level security;
alter table enfants enable row level security;
alter table assistants_familiaux enable row level security;
alter table journal enable row level security;
alter table evenements enable row level security;
alter table documents enable row level security;
alter table fiches_presence enable row level security;
alter table rapports enable row level security;
alter table conges enable row level security;

-- Politiques basiques (à affiner selon les rôles)
create policy "Les utilisateurs voient leur propre profil"
  on profiles for select using (auth.uid() = id);

create policy "Les AF voient leurs enfants"
  on enfants for select using (
    af_principal_id = auth.uid() or
    exists (select 1 from profiles where id = auth.uid() and role in ('referent', 'encadrant', 'gestionnaire', 'rtase', 'admin'))
  );

create policy "Les AF voient leur journal"
  on journal for select using (
    auteur_id = auth.uid() or
    exists (select 1 from profiles where id = auth.uid() and role in ('referent', 'encadrant', 'rtase', 'admin'))
  );

create policy "Insertion journal par AF"
  on journal for insert with check (auteur_id = auth.uid());

-- ═══════════════════════════════════════════════
-- DONNEES DE TEST — Tarn (81)
-- ═══════════════════════════════════════════════

-- Note: Les utilisateurs auth sont créés via l'interface Supabase Auth
-- puis les profils sont insérés ici

insert into profiles (id, email, nom, prenom, role, matricule, territoire, telephone) values
  ('00000000-0000-0000-0000-000000000001', 'marie.laurent@passerelle-af.fr', 'Laurent', 'Marie', 'af', '13622', 'MD Gaillac-Graulhet', '06 XX XX XX XX'),
  ('00000000-0000-0000-0000-000000000002', 'jp.laurent@passerelle-af.fr', 'Laurent', 'Jean-Pierre', 'af', '12728', 'MD Gaillac-Graulhet', '06 XX XX XX XX'),
  ('00000000-0000-0000-0000-000000000003', 'l.gondy@tarn.fr', 'Gondy', 'Ludivine', 'referent', NULL, 'MD Gaillac-Graulhet', '05 63 34 01 10'),
  ('00000000-0000-0000-0000-000000000004', 'f.salles@tarn.fr', 'Salles', 'Franck', 'encadrant', NULL, 'MD Gaillac-Graulhet', '05 63 34 01 10'),
  ('00000000-0000-0000-0000-000000000005', 's.verdier@tarn.fr', 'Verdier', 'Sophie', 'rtase', NULL, 'MD Gaillac-Graulhet', '05 63 34 01 10');

insert into enfants (id, nom, prenom, date_naissance, lieu_naissance, numero_dossier, sexe, type_placement, date_placement, af_principal_id, referent_id, territoire, statut) values
  ('10000000-0000-0000-0000-000000000001', 'Pereira', 'Lou', '2016-07-03', 'Albi (81)', 'CD81-2026-0089', 'F', 'judiciaire', '2026-01-20', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'MD Gaillac-Graulhet', 'en_accueil'),
  ('10000000-0000-0000-0000-000000000002', 'Pereira', 'Ava', '2018-09-14', 'Albi (81)', 'CD81-2026-0090', 'F', 'judiciaire', '2026-01-20', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'MD Gaillac-Graulhet', 'en_accueil');

insert into assistants_familiaux (id, adresse, code_postal, ville, numero_agrement, date_agrement, date_expiration_agrement, places_agreees, places_accordees, accord_urgence, types_accueil, deaf_obtenu, date_deaf, vehicule_marque, vehicule_cv) values
  ('00000000-0000-0000-0000-000000000001', '14 chemin des Vignes', '81600', 'Gaillac', 'AGR-81-2019-0234', '2019-07-01', '2026-06-30', 3, 3, true, ARRAY['urgence','court_terme','relais','permanent','capacite_urgence'], true, '2022-06-15', 'Renault Scenic', 5);
