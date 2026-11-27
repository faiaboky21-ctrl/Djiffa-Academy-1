-- ============================================================================
-- DJIFFA ACADEMY - Migration SQL Additive & Sécurisée (v5 - Suivi Accompagnement)
-- ============================================================================
-- À exécuter manuellement dans Supabase SQL Editor.
-- Aucune table, colonne, donnée ou politique RLS existante n'est supprimée.
-- Toutes les opérations sur public.coaching_requests passent par le backend
-- Express (server.ts via service_role) afin de protéger admin_notes et d'assurer
-- l'intégrité des profils et des soumissions.
-- ============================================================================

-- 1. S'assurer que la colonne optionnelle admin_notes existe sur coaching_requests
alter table public.coaching_requests
  add column if not exists admin_notes text;

-- 2. Principe du moindre privilège sur public.coaching_requests
--    - Suppression de tout accès direct navigateur/anonyme (PostgREST)
--    - Conservation de l'accès complet côté serveur uniquement (service_role)
revoke all on table public.coaching_requests from anon, authenticated;
grant select, insert, update, delete on table public.coaching_requests to service_role;

-- 3. Créer uniquement les profils manquants pour les comptes auth.users actifs
--    (sans modifier ni écraser aucun profil existant ; rôle forcé à 'student')
insert into public.profiles (id, email, name, phone, country, role)
select
  u.id,
  trim(u.email),
  coalesce(
    nullif(trim(u.raw_user_meta_data->>'name'), ''),
    nullif(trim(split_part(trim(u.email), '@', 1)), ''),
    'Apprenant DJIFFA'
  ),
  nullif(trim(u.raw_user_meta_data->>'phone'), ''),
  coalesce(nullif(trim(u.raw_user_meta_data->>'country'), ''), 'Bénin'),
  'student'
from auth.users u
where u.deleted_at is null
  and nullif(trim(u.email), '') is not null
  and not exists (
    select 1
    from public.profiles p
    where p.id = u.id
       or lower(trim(p.email)) = lower(trim(u.email))
  )
on conflict do nothing;

-- 4. Rafraîchissement du cache de schéma PostgREST / Supabase API
notify pgrst, 'reload schema';
