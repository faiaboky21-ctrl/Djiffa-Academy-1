-- ============================================================================
-- DJIFFA ACADEMY - Migration SQL Additive & Sécurisée (v3)
-- Journal durable des événements paiements & webhooks (Sandbox / Live)
-- ============================================================================
-- À exécuter manuellement dans Supabase SQL Editor.
-- Aucune table, colonne, donnée ou politique existante n'est supprimée ou altérée.
-- ============================================================================

create table if not exists public.payment_events (
  id text primary key,
  reference text not null,
  provider text not null,
  mode text not null default 'sandbox' check (mode in ('sandbox', 'live')),
  event text not null,
  status text not null,
  detail text not null,
  received_at timestamptz not null default now()
);

create index if not exists idx_payment_events_received_at
  on public.payment_events (received_at desc);

create index if not exists idx_payment_events_reference
  on public.payment_events (reference);

alter table public.payment_events enable row level security;

-- Aucun accès public ou apprenant : lecture/écriture réservées au serveur (service_role)
-- et à la Direction authentifiée.
drop policy if exists "payment_events_admin_read" on public.payment_events;
create policy "payment_events_admin_read"
  on public.payment_events for select
  using (public.is_admin());

drop policy if exists "payment_events_admin_write" on public.payment_events;
create policy "payment_events_admin_write"
  on public.payment_events for all
  using (public.is_admin())
  with check (public.is_admin());
