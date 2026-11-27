-- ============================================================================
-- DJIFFA ACADEMY - Migration SQL Additive & Sécurisée (v6 - Certificats)
-- ============================================================================
-- À exécuter manuellement dans Supabase SQL Editor.
-- Aucune table, colonne, politique RLS ou certificat existant n'est supprimé.
-- Toutes les émissions et vérifications de certificats passent par le backend
-- Express (server.ts via service_role) afin d'empêcher toute falsification,
-- tout doublon et tout écrasement des certificats existants.
-- ============================================================================

-- 1. S'assurer de manière additive (sans écrasement) que les colonnes optionnelles
--    utilisées pour l'examen final et l'en-tête officiel du certificat existent
alter table public.course_private_contents
  add column if not exists final_quiz jsonb;

alter table public.site_settings
  add column if not exists academy_name text,
  add column if not exists parent_agency_name text,
  add column if not exists director_name text;

-- 2. S'assurer que la table public.certificates conserve son activation RLS
--    sans modifier ni supprimer aucun certificat ou contrainte existante
alter table public.certificates
  enable row level security;

-- 3. Principe du moindre privilège sur public.certificates :
--    - Interdiction des écritures/lectures directes navigateur/anonymes (PostgREST)
--    - Conservation de l'accès complet côté serveur uniquement (service_role)
revoke all on table public.certificates from anon, authenticated;
grant select, insert, update, delete on table public.certificates to service_role;

-- 4. S'assurer que le backend (service_role) peut lire les tables nécessaires
--    à la vérification serveur d'éligibilité (inscriptions, progression, cours,
--    quiz final, profils et logo officiel)
grant select on table public.enrollments to service_role;
grant select on table public.lesson_progress to service_role;
grant select on table public.courses to service_role;
grant select on table public.course_private_contents to service_role;
grant select on table public.profiles to service_role;
grant select on table public.site_settings to service_role;

-- 5. Rafraîchissement du cache de schéma PostgREST / Supabase API
notify pgrst, 'reload schema';
