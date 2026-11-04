-- ===========================================================================
-- Les statistiques de l'espace administrateur (4 novembre 2026)
-- ---------------------------------------------------------------------------
-- Deux courbes, pour l'administrateur seul :
--   1. les connexions par jour : combien de comptes différents se sont
--      connectés ce jour-là (et combien de sessions) ;
--   2. les abonnements actifs, jour après jour (payés chez Stripe, et donnés
--      par l'administrateur à part).
-- Rien sur ce que les clients font dans leur espace : seulement qu'ils sont
-- venus, un jour donné. Personne d'autre que l'administrateur ne lit ces
-- chiffres (prive.est_administrateur()).
-- ===========================================================================

-- 1. Une ligne par compte et par jour de connexion. Le site appelle
--    noter_connexion() une fois par jour et par navigateur.
create table prive.connexions (
  user_id  uuid not null references auth.users (id) on delete cascade,
  jour     date not null,
  sessions integer not null default 1 check (sessions between 1 and 1000),
  primary key (user_id, jour)
);
alter table prive.connexions enable row level security;   -- aucune règle : lue par la fonction ci-dessous seulement

-- Ce qu'on savait déjà : la dernière connexion de chaque compte.
insert into prive.connexions (user_id, jour)
select id, (last_sign_in_at at time zone 'Europe/Paris')::date from auth.users where last_sign_in_at is not null
on conflict do nothing;

create function public.noter_connexion() returns void
language sql volatile security definer set search_path = '' as $$
  insert into prive.connexions (user_id, jour)
  select auth.uid(), (now() at time zone 'Europe/Paris')::date where auth.uid() is not null
  on conflict (user_id, jour) do update set sessions = least(prive.connexions.sessions + 1, 1000)
$$;
revoke all on function public.noter_connexion() from public, anon;
grant execute on function public.noter_connexion() to authenticated;

-- 2. La date de début et de fin de chaque abonnement, pour la courbe.
alter table public.abonnements add column if not exists cree_le timestamptz not null default now();
alter table public.abonnements add column if not exists fini_le timestamptz;
update public.abonnements set cree_le = maj_le where cree_le > maj_le;
update public.abonnements set fini_le = maj_le
 where statut not in ('active', 'trialing', 'past_due', 'offert') and fini_le is null;

create function prive.abonnement_dates() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.statut in ('active', 'trialing', 'past_due', 'offert') then
    new.fini_le := null;
  elsif tg_op = 'INSERT' or old.statut is distinct from new.statut then
    new.fini_le := coalesce(new.fini_le, now());
  end if;
  return new;
end $$;
create trigger abonnement_dates before insert or update on public.abonnements
  for each row execute function prive.abonnement_dates();

-- 3. Ce que la page affiche, en un appel : les N derniers jours.
create function public.admin_statistiques(jours integer default 90) returns json
language plpgsql stable security definer set search_path = '' as $$
declare
  n integer := greatest(7, least(coalesce(jours, 90), 730));
  auj date := (now() at time zone 'Europe/Paris')::date;
begin
  if not prive.est_administrateur() then
    raise exception 'Réservé à l''administrateur du service.' using errcode = '42501';
  end if;
  return json_build_object(
    'jours', (select json_agg(json_build_object(
        'jour', d.jour,
        'comptes', coalesce((select count(*) from prive.connexions c where c.jour = d.jour), 0),
        'sessions', coalesce((select sum(c.sessions) from prive.connexions c where c.jour = d.jour), 0),
        'payes', (select count(*) from public.abonnements a
                   where a.statut <> 'offert' and (a.cree_le at time zone 'Europe/Paris')::date <= d.jour
                     and (a.fini_le is null or (a.fini_le at time zone 'Europe/Paris')::date > d.jour)),
        'offerts', (select count(*) from public.abonnements a
                   where a.statut = 'offert' and (a.cree_le at time zone 'Europe/Paris')::date <= d.jour
                     and (a.fini_le is null or (a.fini_le at time zone 'Europe/Paris')::date > d.jour)),
        'inscrits', (select count(*) from auth.users u where (u.created_at at time zone 'Europe/Paris')::date <= d.jour))
      order by d.jour)
      from (select (auj - g)::date as jour from generate_series(n - 1, 0, -1) g) d),
    'par_formule', coalesce((select json_object_agg(formule, nb) from (
        select a.formule, count(*) as nb from public.abonnements a
         where a.statut in ('active', 'trialing', 'past_due', 'offert') group by a.formule) x), '{}'),
    'comptes_30j', (select count(distinct c.user_id) from prive.connexions c where c.jour > auj - 30),
    'comptes_total', (select count(*) from auth.users)
  );
end $$;
revoke all on function public.admin_statistiques(integer) from public, anon;
grant execute on function public.admin_statistiques(integer) to authenticated;
