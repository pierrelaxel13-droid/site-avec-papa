-- ===========================================================================
-- Imiter Supabase sur un PostgreSQL ordinaire — POUR LES TESTS SEULEMENT
-- ---------------------------------------------------------------------------
-- Sur Supabase, tout ceci existe déjà : les rôles anon / authenticated /
-- service_role, le schéma auth, la table auth.users et les fonctions
-- auth.uid(), auth.email(). Ce fichier les recrée à l'identique, en plus
-- simple, pour tester le schéma et ses règles d'isolation sur une base vide
-- (dans GitHub Actions, ou sur un poste). Ne JAMAIS l'appliquer sur Supabase.
--
-- Comme sur Supabase, l'utilisateur connecté est lu dans la variable
-- request.jwt.claims : {"sub": "<uuid>", "email": "<adresse>"}.
-- ===========================================================================

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  email_confirmed_at timestamptz,
  created_at timestamptz default now(),
  last_sign_in_at timestamptz
);

create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid
$$;

create or replace function auth.email() returns text language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::json ->> 'email', '')
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
grant select on auth.users to service_role;
