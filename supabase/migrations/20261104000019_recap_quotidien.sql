-- ===========================================================================
-- Le récapitulatif quotidien et les rappels par e-mail (4 novembre 2026)
-- ---------------------------------------------------------------------------
-- Chaque compte choisit, dans Mon compte, de recevoir chaque jour par e-mail
-- les textes parus ce jour-là qui touchent le plan de veille de son
-- entreprise. Désactivé par défaut. Le robot outils/recap.mjs lit cette table
-- avec la connexion de service ; le site, lui, ne passe que par les
-- fonctions ci-dessous. Chaque e-mail porte un lien de désinscription en un
-- clic (le jeton), valable sans connexion.
--
-- Les rappels : une action du plan d'actions dont le délai est dépassé et qui
-- n'est pas validée vaut un e-mail de rappel aux membres de l'entreprise
-- (administrateurs et membres), le premier jour du retard puis chaque
-- semaine tant qu'elle reste en retard. Activés par défaut ; chacun peut les
-- couper dans Mon compte.
-- ===========================================================================

create table prive.recap_quotidien (
  user_id         uuid primary key references auth.users (id) on delete cascade,
  actif           boolean not null default false,       -- le récapitulatif quotidien
  rappels         boolean not null default true,        -- les rappels des actions en retard
  jeton           uuid not null unique default gen_random_uuid(),
  maj_le          timestamptz not null default now(),
  dernier_envoi   date
);
alter table prive.recap_quotidien enable row level security;   -- aucune règle : fonctions seulement

create function public.mon_recap() returns json
language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'recap', coalesce((select actif from prive.recap_quotidien where user_id = auth.uid()), false),
    'rappels', coalesce((select rappels from prive.recap_quotidien where user_id = auth.uid()), true))
$$;

create function public.regler_recap(oui boolean default null, rappels boolean default null) returns json
language plpgsql volatile security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Connexion requise.' using errcode = '42501';
  end if;
  insert into prive.recap_quotidien (user_id, actif, rappels)
  values (auth.uid(), coalesce(oui, false), coalesce(regler_recap.rappels, true))
  on conflict (user_id) do update set
    actif = coalesce(oui, prive.recap_quotidien.actif),
    rappels = coalesce(regler_recap.rappels, prive.recap_quotidien.rappels), maj_le = now();
  return public.mon_recap();
end $$;

-- Le lien de désinscription de l'e-mail : sans connexion, avec le jeton.
-- Il ne dit rien du compte (ni adresse, ni entreprise) : vrai ou faux.
-- quoi : « recap » (le récapitulatif) ou « rappels » (les rappels).
create function public.recap_desabonner(jeton uuid, quoi text default 'recap') returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare n integer;
begin
  update prive.recap_quotidien r
     set actif = case when quoi = 'rappels' then r.actif else false end,
         rappels = case when quoi = 'rappels' then false else r.rappels end, maj_le = now()
   where r.jeton = recap_desabonner.jeton;
  get diagnostics n = row_count;
  return n > 0;
end $$;

revoke all on function public.mon_recap(), public.regler_recap(boolean, boolean), public.recap_desabonner(uuid, text) from public;
grant execute on function public.mon_recap(), public.regler_recap(boolean, boolean) to authenticated;
grant execute on function public.recap_desabonner(uuid, text) to anon, authenticated;

-- Pour le robot (connexion de service) : à qui écrire et pour quel plan.
-- Seuls les comptes qui l'ont demandé, à l'adresse confirmée, membres d'une
-- entreprise abonnée (rang ≥ 1).
create function prive.recap_destinataires() returns json
language sql stable security definer set search_path = '' as $$
  select coalesce(json_agg(json_build_object(
           'user_id', r.user_id, 'courriel', u.email, 'jeton', r.jeton, 'dernier_envoi', r.dernier_envoi,
           'entreprise_id', e.id, 'denomination', e.denomination, 'naf', e.naf,
           'contexte', coalesce((select json_agg(x.declencheur order by x.declencheur) from public.reponses x
                                  where x.entreprise_id = e.id and x.valeur), '[]'))
         order by u.email, e.denomination), '[]')
    from prive.recap_quotidien r
    join auth.users u on u.id = r.user_id and u.email_confirmed_at is not null
    join public.membres_entreprise m on m.user_id = r.user_id
    join public.entreprises e on e.id = m.entreprise_id and e.active
   where r.actif and prive.rang_entreprise(e.id) >= 1
$$;
revoke all on function prive.recap_destinataires() from public;

-- Les rappels envoyés : une ligne par action et par compte, pour n'écrire
-- qu'une fois par semaine au plus.
create table prive.rappels_envoyes (
  action_id  bigint not null,
  user_id    uuid not null references auth.users (id) on delete cascade,
  le         date not null,
  primary key (action_id, user_id)
);
alter table prive.rappels_envoyes enable row level security;

-- Pour le robot : les actions en retard, par compte à prévenir.
create function prive.rappels_a_envoyer(jour date) returns json
language sql stable security definer set search_path = '' as $$
  with retard as (
    select r.id, r.entreprise_id, r.objet, r.echeance, r.detail
      from public.registre r
     where r.genre = 'action' and r.statut = 'ouverte' and r.echeance is not null and r.echeance < jour
       and not exists (select 1 from public.registre c where c.corrige_id = r.id)
       and not exists (select 1 from public.registre f where f.entreprise_id = r.entreprise_id and f.cle = 'action:' || r.id)
       and prive.rang_entreprise(r.entreprise_id) >= 2
  ), qui as (
    select m.user_id, u.email, e.id as entreprise_id, e.denomination
      from public.membres_entreprise m
      join auth.users u on u.id = m.user_id and u.email_confirmed_at is not null
      join public.entreprises e on e.id = m.entreprise_id and e.active
     where m.role in ('admin', 'membre')
       and coalesce((select q.rappels from prive.recap_quotidien q where q.user_id = m.user_id), true)
  )
  select coalesce(json_agg(x order by x.courriel), '[]') from (
    select q.user_id, q.email as courriel, q.entreprise_id, q.denomination,
           (select r.jeton from prive.recap_quotidien r where r.user_id = q.user_id) as jeton,
           json_agg(json_build_object('id', a.id, 'objet', a.objet, 'echeance', a.echeance, 'note', a.detail)
                    order by a.echeance, a.id) as actions
      from qui q join retard a on a.entreprise_id = q.entreprise_id
     where not exists (select 1 from prive.rappels_envoyes s where s.action_id = a.id and s.user_id = q.user_id and s.le > jour - 7)
     group by q.user_id, q.email, q.entreprise_id, q.denomination) x
$$;
revoke all on function prive.rappels_a_envoyer(date) from public;

-- Un compte sans ligne n'a pas de jeton : le robot lui en crée une (réglages
-- par défaut) avant d'écrire, pour que le lien de désinscription marche.
create function prive.jeton_de(u uuid) returns uuid
language sql volatile security definer set search_path = '' as $$
  insert into prive.recap_quotidien (user_id) values (u)
  on conflict (user_id) do update set user_id = excluded.user_id
  returning jeton
$$;
revoke all on function prive.jeton_de(uuid) from public;
