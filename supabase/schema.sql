-- ============================================================================
-- DJIFFA ACADEMY - Schéma Complet Supabase (PostgreSQL + Auth + RLS + Storage)
-- Marque : DJIFFA ACADEMY | Agence mère : DJIFFA DESIGN AGENCY | Faith Ariola
-- À exécuter dans : Supabase Dashboard -> SQL Editor
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. PROFILS & RÔLES UTILISATEURS
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text not null,
  phone text,
  country text default 'Bénin',
  role text not null default 'student' check (role in ('student', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Fonction utilitaire sécurisée pour vérifier si l'utilisateur courant est Admin
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Trigger automatique à l'inscription : force toujours role = 'student'
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, phone, country, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'phone',
    coalesce(new.raw_user_meta_data->>'country', 'Bénin'),
    'student'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;

create policy "profiles_select_own_or_admin"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

create policy "profiles_update_own_safe"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select p.role from public.profiles p where p.id = auth.uid())
  );

create policy "profiles_admin_all"
  on public.profiles for all
  using (public.is_admin())
  with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 2. DOMAINES DE FORMATION
-- ----------------------------------------------------------------------------
create table if not exists public.domains (
  id text primary key,
  code text not null,
  title text not null,
  short_label text not null,
  description text not null,
  skills jsonb not null default '[]'::jsonb,
  highlight_course_id text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.domains enable row level security;

create policy "domains_public_read"
  on public.domains for select
  using (true);

create policy "domains_admin_write"
  on public.domains for all
  using (public.is_admin())
  with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 3. FORMATIONS & CONTENUS PRIVÉS PROTÉGÉS
-- ----------------------------------------------------------------------------
create table if not exists public.courses (
  id text primary key,
  slug text not null unique,
  title text not null,
  subtitle text not null,
  description text not null,
  domain_id text not null references public.domains(id) on update cascade,
  level text not null,
  duration text not null,
  modules_count integer not null default 0,
  lessons_count integer not null default 0,
  price_xof integer not null,
  price_eur integer not null,
  price_usd integer not null,
  original_price_xof integer,
  cover_image text not null,
  is_featured boolean not null default false,
  is_published boolean not null default true,
  certificate_eligible boolean not null default true,
  objectives jsonb not null default '[]'::jsonb,
  skills_acquired jsonb not null default '[]'::jsonb,
  resources_included jsonb not null default '[]'::jsonb,
  syllabus_modules jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.courses enable row level security;

create policy "courses_public_published_read"
  on public.courses for select
  using (is_published = true or public.is_admin());

create policy "courses_admin_write"
  on public.courses for all
  using (public.is_admin())
  with check (public.is_admin());

-- Table séparée pour les contenus payants privés (liens vidéos, chemins PDF, corrections, quiz)
create table if not exists public.course_private_contents (
  course_id text primary key references public.courses(id) on delete cascade,
  modules_payload jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 4. INSCRIPTIONS & ACCÈS AUX FORMATIONS
-- ----------------------------------------------------------------------------
create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id text not null references public.courses(id) on delete cascade,
  granted_by text not null default 'payment',
  created_at timestamptz not null default now(),
  unique(user_id, course_id)
);

alter table public.enrollments enable row level security;

create policy "enrollments_read_own_or_admin"
  on public.enrollments for select
  using (auth.uid() = user_id or public.is_admin());

-- Seul l'admin (ou service_role côté serveur lors d'un webhook confirmé) peut modifier les accès
create policy "enrollments_admin_write"
  on public.enrollments for all
  using (public.is_admin())
  with check (public.is_admin());

alter table public.course_private_contents enable row level security;

create policy "private_contents_enrolled_or_admin"
  on public.course_private_contents for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.enrollments e
      where e.user_id = auth.uid() and e.course_id = course_private_contents.course_id
    )
  );

create policy "private_contents_admin_write"
  on public.course_private_contents for all
  using (public.is_admin())
  with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 5. PROGRESSION, DEVOIRS & QUIZ DES APPRENANTS
-- ----------------------------------------------------------------------------
create table if not exists public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id text not null references public.courses(id) on delete cascade,
  completed_lesson_ids jsonb not null default '[]'::jsonb,
  last_accessed_lesson_id text,
  submitted_exercises jsonb not null default '{}'::jsonb,
  quiz_scores jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique(user_id, course_id)
);

alter table public.lesson_progress enable row level security;

create policy "progress_own_or_admin"
  on public.lesson_progress for all
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

-- ----------------------------------------------------------------------------
-- 6. CERTIFICATS OFFICIELS
-- ----------------------------------------------------------------------------
create table if not exists public.certificates (
  id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id text not null references public.courses(id) on delete cascade,
  course_title text not null,
  student_name text not null,
  director_name text not null default 'Faith Ariola',
  verification_code text not null unique,
  issued_date date not null default current_date,
  created_at timestamptz not null default now(),
  unique(user_id, course_id)
);

alter table public.certificates enable row level security;

create policy "certificates_own_or_admin"
  on public.certificates for select
  using (auth.uid() = user_id or public.is_admin());

create policy "certificates_insert_enrolled"
  on public.certificates for insert
  with check (
    public.is_admin()
    or (
      auth.uid() = user_id
      and exists (
        select 1 from public.enrollments e
        where e.user_id = auth.uid() and e.course_id = certificates.course_id
      )
    )
  );

-- ----------------------------------------------------------------------------
-- 7. COMMANDES, PAIEMENTS & CODES PROMO
-- ----------------------------------------------------------------------------
create table if not exists public.orders (
  id text primary key,
  reference text not null unique,
  user_id uuid references public.profiles(id) on delete set null,
  user_name text not null,
  user_email text not null,
  course_id text not null references public.courses(id) on delete restrict,
  course_title text not null,
  amount integer not null,
  currency text not null check (currency in ('XOF', 'EUR', 'USD')),
  payment_method text not null,
  payment_provider text not null,
  provider_transaction_id text,
  status text not null default 'pending' check (status in ('pending', 'processing', 'confirmed', 'failed', 'cancelled', 'refunded')),
  is_demo_transaction boolean not null default false,
  promo_code_used text,
  customer_phone text,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

alter table public.orders enable row level security;

create policy "orders_read_own_or_admin"
  on public.orders for select
  using (auth.uid() = user_id or public.is_admin());

-- Un utilisateur ne peut créer qu'une commande initialement en statut 'pending'
create policy "orders_insert_pending_own"
  on public.orders for insert
  with check (
    auth.uid() = user_id
    and status = 'pending'
  );

-- Seul le backend (service_role) ou l'admin peut confirmer/rembourser une commande
create policy "orders_admin_update"
  on public.orders for update
  using (public.is_admin())
  with check (public.is_admin());

create table if not exists public.promo_codes (
  id text primary key,
  code text not null unique,
  discount_percent integer not null check (discount_percent between 1 and 95),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.promo_codes enable row level security;

create policy "promo_public_active_read"
  on public.promo_codes for select
  using (is_active = true or public.is_admin());

create policy "promo_admin_write"
  on public.promo_codes for all
  using (public.is_admin())
  with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 8. ACCOMPAGNEMENT / COACHING, TÉMOIGNAGES, PARAMÈTRES & NOTIFICATIONS
-- ----------------------------------------------------------------------------
create table if not exists public.coaching_programs (
  id text primary key,
  type text not null check (type in ('individual', 'collective')),
  title text not null,
  subtitle text not null,
  price_xof integer not null,
  price_eur integer not null,
  price_usd integer not null,
  duration text not null,
  badge text not null,
  features jsonb not null default '[]'::jsonb
);

alter table public.coaching_programs enable row level security;

create policy "coaching_programs_public_read"
  on public.coaching_programs for select
  using (true);

create policy "coaching_programs_admin_write"
  on public.coaching_programs for all
  using (public.is_admin())
  with check (public.is_admin());

create table if not exists public.coaching_requests (
  id text primary key,
  user_id uuid references public.profiles(id) on delete set null,
  user_name text not null,
  user_email text not null,
  user_phone text not null,
  type text not null check (type in ('individual', 'collective')),
  program_title text not null,
  need_description text not null,
  preferred_date text not null,
  status text not null default 'pending' check (status in ('pending', 'validated', 'scheduled', 'completed', 'cancelled')),
  meeting_link text,
  created_at timestamptz not null default now()
);

alter table public.coaching_requests enable row level security;

create policy "coaching_req_read_own_or_admin"
  on public.coaching_requests for select
  using (auth.uid() = user_id or public.is_admin());

create policy "coaching_req_insert_anyone"
  on public.coaching_requests for insert
  with check (status = 'pending');

create policy "coaching_req_admin_update"
  on public.coaching_requests for all
  using (public.is_admin())
  with check (public.is_admin());

create table if not exists public.testimonials (
  id text primary key,
  author_name text not null,
  author_role text not null,
  course_title text not null,
  quote text not null,
  verified_date text not null,
  is_published boolean not null default true
);

alter table public.testimonials enable row level security;

create policy "testimonials_public_read"
  on public.testimonials for select
  using (is_published = true or public.is_admin());

create policy "testimonials_admin_write"
  on public.testimonials for all
  using (public.is_admin())
  with check (public.is_admin());

create table if not exists public.site_settings (
  id text primary key default 'default',
  agency_logo_url text,
  contact_email text not null,
  contact_phone text not null,
  headquarters text not null,
  updated_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;

create policy "site_settings_public_read"
  on public.site_settings for select
  using (true);

create policy "site_settings_admin_write"
  on public.site_settings for all
  using (public.is_admin())
  with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 9. BUCKETS SUPABASE STORAGE (PDF, VIDÉOS & LOGO)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values
  ('brand-assets', 'brand-assets', true),
  ('course-pdfs', 'course-pdfs', false),
  ('course-videos', 'course-videos', false)
on conflict (id) do nothing;

-- Brand assets : lecture publique, écriture réservée à la Direction
create policy "brand_assets_public_read"
  on storage.objects for select
  using (bucket_id = 'brand-assets');

create policy "brand_assets_admin_write"
  on storage.objects for all
  using (bucket_id = 'brand-assets' and public.is_admin())
  with check (bucket_id = 'brand-assets' and public.is_admin());

-- Course PDFs & Videos : accès privé via URL signées (générées par le serveur après vérification d'achat) ou Admin
create policy "course_media_admin_all"
  on storage.objects for all
  using (bucket_id in ('course-pdfs', 'course-videos') and public.is_admin())
  with check (bucket_id in ('course-pdfs', 'course-videos') and public.is_admin());
