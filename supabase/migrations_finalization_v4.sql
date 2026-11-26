-- ============================================================================
-- DJIFFA ACADEMY - Migration SQL Additive & Sûre (v4 - Finalisation)
-- ============================================================================
-- À exécuter manuellement dans Supabase SQL Editor.
-- Aucune table, colonne, donnée ou politique existante n'est supprimée ou modifiée destructivement.
-- ============================================================================

-- 1. Stockage sécurisé de l'examen final (Quiz final) dans course_private_contents
--    Protégé par la politique RLS existante "private_contents_enrolled_or_admin"
--    afin de ne jamais exposer les bonnes réponses aux visiteurs non inscrits.
alter table public.course_private_contents
  add column if not exists final_quiz jsonb;

-- 2. Permissions explicites non destructives pour service_role et utilisateurs authentifiés
--    (Les politiques RLS existantes restent entièrement actives.)
grant select, insert, update, delete on table public.course_private_contents to service_role;
grant select on table public.course_private_contents to authenticated;

-- 3. Vérification non destructive des permissions si migrations_optional_v2.sql a été exécutée
do $$
begin
  if to_regclass('public.contact_messages') is not null then
    execute 'grant insert on table public.contact_messages to anon, authenticated';
    execute 'grant select, insert, update, delete on table public.contact_messages to service_role, authenticated';
  end if;
end
$$;

-- 4. Rafraîchissement du cache de schéma PostgREST / Supabase API
notify pgrst, 'reload schema';
