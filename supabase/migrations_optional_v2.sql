-- ============================================================================
-- DJIFFA ACADEMY - Migration SQL Optionnelle & Non-Destructive (v2)
-- ============================================================================
-- À exécuter manuellement dans Supabase SQL Editor UNIQUEMENT si vous souhaitez
-- persister dans PostgreSQL les nouveaux champs éditoriaux de site_settings,
-- les prix promotionnels dédiés, les notes internes d'accompagnement et les
-- messages envoyés depuis la page Contact.
-- Aucune table ni donnée existante n'est supprimée ou modifiée destructivement.
-- ============================================================================

-- 1. Champs promotionnels explicites sur public.courses
alter table public.courses
  add column if not exists promo_active boolean not null default false,
  add column if not exists promo_price_xof integer,
  add column if not exists promo_price_eur integer,
  add column if not exists promo_price_usd integer;

-- 2. Notes internes Direction sur public.coaching_requests
alter table public.coaching_requests
  add column if not exists admin_notes text;

-- 3. Identité complète & textes légaux éditables dans public.site_settings
alter table public.site_settings
  add column if not exists academy_name text,
  add column if not exists parent_agency_name text,
  add column if not exists director_name text,
  add column if not exists academy_presentation text,
  add column if not exists parent_agency_presentation text,
  add column if not exists director_bio text,
  add column if not exists whatsapp_number text,
  add column if not exists support_hours text,
  add column if not exists instagram_url text,
  add column if not exists linkedin_url text,
  add column if not exists youtube_url text,
  add column if not exists legal_notices text,
  add column if not exists terms_of_sale text;

-- 4. Table des messages reçus via le formulaire de Contact
create table if not exists public.contact_messages (
  id text primary key,
  name text not null,
  email text not null,
  phone text,
  subject text not null,
  message text not null,
  status text not null default 'new' check (status in ('new', 'read', 'replied', 'archived')),
  admin_notes text,
  created_at timestamptz not null default now()
);

alter table public.contact_messages
  drop constraint if exists contact_messages_status_check;

alter table public.contact_messages
  add constraint contact_messages_status_check
  check (status in ('new', 'read', 'replied', 'archived'));

alter table public.contact_messages enable row level security;

create policy "contact_messages_insert_public"
  on public.contact_messages for insert
  with check (status = 'new');

create policy "contact_messages_admin_all"
  on public.contact_messages for all
  using (public.is_admin())
  with check (public.is_admin());
