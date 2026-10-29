-- ===========================================================================
-- L'administration du service (compte/admin.html), pour l'administrateur seul
-- ---------------------------------------------------------------------------
-- Il voit : les entreprises, leur formule, leurs comptes (adresse, rôle,
-- adresse confirmée ou non). Il ne voit JAMAIS leur registre, leur plan ni
-- leurs réponses : ces fonctions ne les lisent pas, et les règles de la base
-- les lui refusent (tests d'isolation).
-- Il peut : donner ou retirer une formule (« offert » : essai, virement…).
-- Un abonnement payé chez Stripe n'est jamais touché ici : Stripe fait foi.
-- Chaque action est inscrite dans prive.journal_admin.
--
-- Devenir administrateur : une ligne dans prive.administrateurs, posée à la
-- main dans Supabase (voir supabase/README.md). Personne ne peut se l'ajouter.
-- ===========================================================================

create table prive.journal_admin (
  id             bigint generated always as identity primary key,
  le             timestamptz not null default now(),
  par            uuid not null,
  action         text not null,
  entreprise_id  uuid,
  detail         jsonb not null default '{}'
);
alter table prive.journal_admin enable row level security;

-- Le rang d'une entreprise compte désormais :
--   - les abonnements « offert » (donnés par l'administrateur) ;
--   - l'entreprise de l'administrateur lui-même : tout est ouvert.
create or replace function prive.rang_entreprise(e uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select greatest(
    coalesce((select max(case a.formule when 'textes' then 1 when 'suivi' then 2 when 'complet' then 3 else 0 end)
              from public.abonnements a
              where a.entreprise_id = e and a.statut in ('active', 'trialing', 'past_due', 'offert')), 0),
    coalesce((select 3 from public.entreprises en
              join public.abonnements a on a.consultant_id = en.consultant_id
              where en.id = e and a.statut in ('active', 'trialing', 'past_due', 'offert') limit 1), 0),
    coalesce((select 3 from public.membres_entreprise m
              join prive.administrateurs ad on ad.user_id = m.user_id
              where m.entreprise_id = e limit 1), 0))
$$;

-- Le site demande : « suis-je l'administrateur ? » (pour montrer le lien).
create function public.suis_administrateur() returns boolean
language sql stable security definer set search_path = '' as $$
  select prive.est_administrateur()
$$;

-- Tout ce que la page d'administration affiche, en un appel.
create function public.admin_vue() returns json
language plpgsql stable security definer set search_path = '' as $$
begin
  if not prive.est_administrateur() then
    raise exception 'Réservé à l''administrateur du service.' using errcode = '42501';
  end if;
  return json_build_object(
    'entreprises', coalesce((select json_agg(x order by x.cree_le desc) from (
      select e.id, e.denomination, e.naf, e.cree_le, e.active,
             c.nom as consultant,
             prive.rang_entreprise(e.id) as rang,
             (select json_agg(json_build_object(
                       'formule', a.formule, 'periode', a.periode, 'statut', a.statut,
                       'fin_periode', a.fin_periode, 'stripe', a.stripe_abonnement is not null)
                     order by a.maj_le desc)
                from public.abonnements a where a.entreprise_id = e.id) as abonnements,
             (select json_agg(json_build_object(
                       'courriel', u.email, 'role', m.role, 'depuis', m.depuis,
                       'confirme', u.email_confirmed_at is not null, 'derniere_connexion', u.last_sign_in_at)
                     order by m.depuis)
                from public.membres_entreprise m join auth.users u on u.id = m.user_id
               where m.entreprise_id = e.id) as membres
        from public.entreprises e
        left join public.consultants c on c.id = e.consultant_id) x), '[]'),
    'sans_entreprise', coalesce((select json_agg(json_build_object(
                       'courriel', u.email, 'inscrit_le', u.created_at,
                       'confirme', u.email_confirmed_at is not null) order by u.created_at desc)
        from auth.users u
       where not exists (select 1 from public.membres_entreprise m where m.user_id = u.id)
         and not exists (select 1 from public.membres_consultant m where m.user_id = u.id)), '[]'));
end $$;

-- Donner (ou retirer, avec null) une formule à une entreprise.
create function public.admin_abonnement(entreprise uuid, nouvelle_formule text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not prive.est_administrateur() then
    raise exception 'Réservé à l''administrateur du service.' using errcode = '42501';
  end if;
  if nouvelle_formule is not null and nouvelle_formule not in ('textes', 'suivi', 'complet') then
    raise exception 'Formule inconnue : %', nouvelle_formule;
  end if;
  if not exists (select 1 from public.entreprises en where en.id = entreprise) then
    raise exception 'Entreprise inconnue.';
  end if;
  delete from public.abonnements a where a.entreprise_id = entreprise and a.stripe_abonnement is null;
  if nouvelle_formule is not null then
    insert into public.abonnements (entreprise_id, formule, periode, statut)
    values (entreprise, nouvelle_formule, 'an', 'offert');
  end if;
  insert into prive.journal_admin (par, action, entreprise_id, detail)
  values (auth.uid(), 'abonnement', entreprise, jsonb_build_object('formule', nouvelle_formule));
end $$;

revoke execute on function public.suis_administrateur(), public.admin_vue(),
  public.admin_abonnement(uuid, text) from public, anon;
grant execute on function public.suis_administrateur(), public.admin_vue(),
  public.admin_abonnement(uuid, text) to authenticated, service_role;
