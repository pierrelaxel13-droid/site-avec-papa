-- ===========================================================================
-- L'abonnement consultant couvre un nombre de clients (6 novembre 2026)
-- ---------------------------------------------------------------------------
-- Demande d'Axel : un consultant abonné pour 3 clients ne peut pas en
-- inscrire un quatrième sans augmenter son abonnement. Message :
-- « Vous devez modifier votre abonnement pour ajouter un client supplémentaire. »
--
-- Le nombre vient de Stripe : la quantité choisie au paiement (outils/stripe.mjs
-- la recopie dans clients_max). Sans quantité (abonnement « offert » ouvert par
-- l'administrateur du service) : pas de limite.
--
-- La règle est tenue par la base, quel que soit le chemin :
--   1. un déclencheur sur public.entreprises refuse tout nouveau client d'un
--      cabinet qui a déjà atteint son nombre (création par le cabinet comme
--      rattachement par l'entreprise) ;
--   2. prive.rang_entreprise n'ouvre la veille complète qu'aux N premiers
--      clients du cabinet (par date de création) : des espaces préparés avant
--      l'abonnement, au-delà du nombre payé, restent fermés.
-- Un cabinet sans abonnement en cours peut préparer les espaces de ses
-- clients (ils sont fermés tant qu'il n'est pas abonné).
-- ===========================================================================

alter table public.abonnements add column if not exists clients_max integer
  check (clients_max is null or clients_max >= 0);

-- Le nombre de clients que couvre l'abonnement en cours du cabinet ;
-- null : pas de limite (abonnement sans quantité) ou pas d'abonnement en cours.
create function prive.places_cabinet(c uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select case
    when not exists (select 1 from public.abonnements a where a.consultant_id = c
                     and a.statut in ('active', 'trialing', 'past_due', 'offert')) then null
    when exists (select 1 from public.abonnements a where a.consultant_id = c
                 and a.statut in ('active', 'trialing', 'past_due', 'offert') and a.clients_max is null) then null
    else (select max(a.clients_max) from public.abonnements a where a.consultant_id = c
          and a.statut in ('active', 'trialing', 'past_due', 'offert'))
  end
$$;

create function prive.limite_clients() returns trigger
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if new.consultant_id is null or (tg_op = 'UPDATE' and old.consultant_id is not distinct from new.consultant_id) then
    return new;
  end if;
  -- Deux créations en même temps ne doivent pas passer toutes les deux.
  perform pg_advisory_xact_lock(hashtext('clients:' || new.consultant_id::text));
  n := prive.places_cabinet(new.consultant_id);
  if n is not null and (select count(*) from public.entreprises x
                        where x.consultant_id = new.consultant_id and x.id <> new.id) >= n then
    raise exception 'Vous devez modifier votre abonnement pour ajouter un client supplémentaire.'
      using errcode = 'P0001', hint = format('Votre abonnement couvre %s client%s.', n, case when n > 1 then 's' else '' end);
  end if;
  return new;
end $$;
create trigger limite_clients before insert or update of consultant_id on public.entreprises
  for each row execute function prive.limite_clients();

-- Le rang d'une entreprise (migration 3), avec la limite : la veille complète
-- du cabinet ne couvre que ses N premiers clients.
create or replace function prive.rang_entreprise(e uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select greatest(
    coalesce((select max(case a.formule when 'textes' then 1 when 'suivi' then 2 when 'complet' then 3 else 0 end)
              from public.abonnements a
              where a.entreprise_id = e and a.statut in ('active', 'trialing', 'past_due', 'offert')), 0),
    coalesce((select 3 from public.entreprises en
              join public.abonnements a on a.consultant_id = en.consultant_id
              where en.id = e and a.statut in ('active', 'trialing', 'past_due', 'offert')
                and (prive.places_cabinet(en.consultant_id) is null
                     or (select count(*) from public.entreprises x
                         where x.consultant_id = en.consultant_id and (x.cree_le, x.id) < (en.cree_le, en.id))
                        < prive.places_cabinet(en.consultant_id))
              limit 1), 0),
    coalesce((select 3 from public.membres_entreprise m
              join prive.administrateurs ad on ad.user_id = m.user_id
              where m.entreprise_id = e limit 1), 0))
$$;

-- Pour l'espace consultant : combien de clients l'abonnement couvre, combien il y en a.
create function public.cabinet_places(c uuid) returns json
language plpgsql stable security definer set search_path = '' as $$
begin
  if not prive.membre_consultant(c) then
    raise exception 'Ce cabinet n''est pas le vôtre.' using errcode = '42501';
  end if;
  return json_build_object(
    'max', prive.places_cabinet(c),
    'clients', (select count(*) from public.entreprises x where x.consultant_id = c),
    'abonne', exists (select 1 from public.abonnements a where a.consultant_id = c
                      and a.statut in ('active', 'trialing', 'past_due', 'offert')));
end $$;

revoke all on function prive.places_cabinet(uuid), prive.limite_clients() from public, anon, authenticated;
revoke all on function public.cabinet_places(uuid) from public, anon;
grant execute on function public.cabinet_places(uuid) to authenticated;
