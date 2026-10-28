-- ===========================================================================
-- Vigie — le schéma initial de la base (lot 5)
-- ---------------------------------------------------------------------------
-- Lire d'abord docs/lot5-base-de-donnees.md : il explique les choix.
--
-- Trois règles, partout :
--   1. La RLS (Row Level Security) est activée sur CHAQUE table, dès sa
--      création. Une table sans règle ne montre rien à personne.
--   2. Le navigateur n'a que les droits accordés explicitement plus bas
--      (GRANT). Tout le reste lui est refusé, même si une règle RLS existait.
--   3. Le registre de preuves ne se modifie ni ne s'efface, jamais.
--
-- Ce fichier est appliqué une seule fois, par l'action « Base de données »
-- (.github/workflows/base.yml). Pour changer le schéma, on n'édite PAS ce
-- fichier : on en ajoute un nouveau, daté, à côté.
-- ===========================================================================

-- Le schéma « prive » n'est pas exposé par l'API de Supabase : on y range les
-- fonctions d'aide aux règles et ce que le navigateur ne doit pas voir.
create schema if not exists prive;
grant usage on schema prive to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 1. LE COMMUN : écrit par le robot (clé service), lu par tous
-- ---------------------------------------------------------------------------

create table public.sujets (
  id          text primary key,                       -- ex. « sst », « amiante »
  nom         text not null,
  famille     text not null,
  frequence   text not null check (frequence in ('quotidienne', 'hebdomadaire', 'mensuelle', 'trimestrielle')),
  classement  text,
  actions     jsonb not null default '[]',
  maj_le      timestamptz not null default now()
);

create table public.textes (
  id          text primary key,                       -- identifiant stable : NOR, id Légifrance…
  source      text not null,                          -- ex. « jorf »
  titre       text not null,
  nature      text,                                   -- décret, arrêté…
  numero      text,                                   -- NOR, n° du JO
  publie_le   date,
  url         text not null check (url ~ '^https?://'),
  collecte_le timestamptz not null default now()
);

create table public.textes_sujets (
  texte_id  text not null references public.textes (id) on delete cascade,
  sujet_id  text not null references public.sujets (id) on delete cascade,
  primary key (texte_id, sujet_id)
);

-- Le journal du robot de collecte (lot 6) : une ligne par exécution.
create table public.collectes (
  id         bigint generated always as identity primary key,
  debut      timestamptz not null default now(),
  fin        timestamptz,
  statut     text not null check (statut in ('en_cours', 'reussie', 'echouee', 'alerte')),
  examines   integer check (examines >= 0),
  retenus    integer check (retenus >= 0),
  erreurs    jsonb not null default '[]',
  details    jsonb not null default '{}'
);

-- ---------------------------------------------------------------------------
-- 2. LES ORGANISATIONS : cabinets consultants, entreprises, membres
-- ---------------------------------------------------------------------------

create type public.role_membre as enum ('admin', 'membre', 'lecteur');

create table public.profils (
  id   uuid primary key references auth.users (id) on delete cascade,
  nom  text not null default '' check (length(nom) <= 120)
);

create table public.consultants (
  id              uuid primary key default gen_random_uuid(),
  nom             text not null check (length(nom) between 1 and 200),
  theme           jsonb not null default '{}',        -- { nom_affiche, couleur, logo }
  marque_blanche  boolean not null default false,     -- posé par la facturation (dès 6 clients)
  cree_le         timestamptz not null default now()
);

create table public.entreprises (
  id                uuid primary key default gen_random_uuid(),
  denomination      text not null check (length(denomination) between 1 and 200),
  naf               text check (naf ~ '^[0-9]{2}([.][0-9]{2}[A-Z])?$'),   -- « 43 » ou « 43.21A »
  effectif          integer check (effectif >= 0),
  implantation      text check (length(implantation) <= 200),
  consultant_id     uuid references public.consultants (id) on delete set null,
  acces_consultant  boolean not null default false,   -- l'entreprise autorise son consultant à la voir
  active            boolean not null default true,
  cree_le           timestamptz not null default now()
);
create index on public.entreprises (consultant_id);

create table public.membres_entreprise (
  entreprise_id  uuid not null references public.entreprises (id) on delete cascade,
  user_id        uuid not null references auth.users (id) on delete cascade,
  role           public.role_membre not null default 'membre',
  depuis         timestamptz not null default now(),
  primary key (entreprise_id, user_id)
);
create index on public.membres_entreprise (user_id);

create table public.membres_consultant (
  consultant_id  uuid not null references public.consultants (id) on delete cascade,
  user_id        uuid not null references auth.users (id) on delete cascade,
  role           public.role_membre not null default 'membre',
  depuis         timestamptz not null default now(),
  primary key (consultant_id, user_id)
);
create index on public.membres_consultant (user_id);

-- Une invitation à rejoindre une entreprise ou un cabinet. On ne garde que
-- l'empreinte du jeton : le jeton lui-même n'est connu que de l'invité.
create table public.invitations (
  id             uuid primary key default gen_random_uuid(),
  entreprise_id  uuid references public.entreprises (id) on delete cascade,
  consultant_id  uuid references public.consultants (id) on delete cascade,
  courriel       text not null check (courriel ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'),
  role           public.role_membre not null default 'membre',
  jeton_hash     text not null unique,
  expire_le      timestamptz not null default now() + interval '7 days',
  acceptee_le    timestamptz,
  cree_par       uuid default auth.uid(),
  check (num_nonnulls(entreprise_id, consultant_id) = 1)
);

-- L'administrateur du service (toi) : voit la liste des entreprises et des
-- abonnements, JAMAIS les registres. Rempli à la main, avec la clé service.
create table prive.administrateurs (
  user_id uuid primary key references auth.users (id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- 3. LES ABONNEMENTS : écrits par Stripe seulement (dernier lot)
-- ---------------------------------------------------------------------------

create table public.abonnements (
  id                 uuid primary key default gen_random_uuid(),
  entreprise_id      uuid references public.entreprises (id) on delete cascade,
  consultant_id      uuid references public.consultants (id) on delete cascade,
  formule            text not null check (formule in ('textes', 'suivi', 'complet', 'consultant')),
  periode            text not null check (periode in ('mois', 'an')),
  statut             text not null,                   -- statut Stripe : active, trialing, past_due, canceled…
  fin_periode        timestamptz,
  stripe_client      text,
  stripe_abonnement  text unique,
  maj_le             timestamptz not null default now(),
  check (num_nonnulls(entreprise_id, consultant_id) = 1),
  check ((formule = 'consultant') = (consultant_id is not null))
);

-- ---------------------------------------------------------------------------
-- 4. LE PLAN DE VEILLE D'UNE ENTREPRISE
-- ---------------------------------------------------------------------------

create table public.reponses (
  entreprise_id  uuid not null references public.entreprises (id) on delete cascade,
  declencheur    text not null check (declencheur ~ '^[a-z_]{2,40}$'),    -- les 22 questions
  valeur         boolean not null,
  maj_le         timestamptz not null default now(),
  maj_par        uuid default auth.uid(),
  primary key (entreprise_id, declencheur)
);

create table public.plan_sujets (
  entreprise_id  uuid not null references public.entreprises (id) on delete cascade,
  sujet_id       text not null references public.sujets (id),
  origine        text not null check (origine in ('metier', 'reponse', 'manuel')),
  frequence      text check (frequence in ('quotidienne', 'hebdomadaire', 'mensuelle', 'trimestrielle')),
  actif          boolean not null default true,       -- on ne supprime pas : on désactive, et le registre le dit
  depuis         timestamptz not null default now(),
  primary key (entreprise_id, sujet_id)
);

-- ---------------------------------------------------------------------------
-- 5. LE REGISTRE DE PREUVES — IMMUABLE
-- ---------------------------------------------------------------------------

create type public.genre_registre as enum ('revue', 'qualification', 'decision', 'action', 'plan', 'correction');

create table public.registre (
  id             bigint generated always as identity primary key,
  entreprise_id  uuid not null references public.entreprises (id) on delete restrict,
  genre          public.genre_registre not null,
  sujet_id       text references public.sujets (id),
  texte_id       text references public.textes (id),
  objet          text not null check (length(objet) between 1 and 500),
  detail         text check (length(detail) <= 5000),
  statut         text check (length(statut) <= 40),   -- qualification : applicable / sans_objet / a_suivre ; action : ouverte / faite
  date_effet     date not null default current_date,  -- la date du fait, déclarée par l'utilisateur
  echeance       date,
  corrige_id     bigint references public.registre (id),
  -- Posés par la base, jamais par le navigateur (voir le déclencheur) :
  enregistre_le  timestamptz not null default now(),
  auteur_id      uuid,
  auteur_nom     text,
  precedente     text,                                -- empreinte de l'entrée précédente de la même entreprise
  empreinte      text not null default ''
);
create index on public.registre (entreprise_id, id);
create index on public.registre (entreprise_id, texte_id);
create index on public.registre (entreprise_id, sujet_id);

-- À l'ajout : la base pose l'heure, l'auteur et l'empreinte. Ce que le
-- navigateur aurait envoyé dans ces colonnes est écrasé.
create function prive.registre_avant_ajout() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  derniere text;
begin
  -- Une chaîne d'empreintes par entreprise : deux ajouts simultanés pour la
  -- même entreprise passent l'un après l'autre.
  perform pg_advisory_xact_lock(hashtextextended(new.entreprise_id::text, 0));

  new.enregistre_le := now();
  new.auteur_id := auth.uid();
  new.auteur_nom := coalesce(
    (select nullif(p.nom, '') from public.profils p where p.id = new.auteur_id),
    (select u.email from auth.users u where u.id = new.auteur_id),
    case when new.auteur_id is null then 'Vigie (automatique)' end);

  if new.corrige_id is not null then
    if new.genre <> 'correction' then
      raise exception 'Une entrée qui en corrige une autre doit être de genre « correction ».';
    end if;
    if not exists (select 1 from public.registre r where r.id = new.corrige_id and r.entreprise_id = new.entreprise_id) then
      raise exception 'L''entrée corrigée n''appartient pas à cette entreprise.';
    end if;
  elsif new.genre = 'correction' then
    raise exception 'Une correction doit dire quelle entrée elle corrige (corrige_id).';
  end if;

  select r.empreinte into derniere from public.registre r
    where r.entreprise_id = new.entreprise_id order by r.id desc limit 1;
  new.precedente := derniere;
  new.empreinte := prive.empreinte_registre(new);
  return new;
end $$;

-- L'empreinte d'une entrée : SHA-256 de son contenu ET de l'empreinte de la
-- précédente. Changer une ligne casserait toute la suite de la chaîne.
create function prive.empreinte_registre(r public.registre) returns text
language sql immutable set search_path = '' as $$
  select encode(sha256(convert_to(concat_ws('|',
    coalesce(r.precedente, ''), r.id, r.entreprise_id, r.genre, coalesce(r.sujet_id, ''),
    coalesce(r.texte_id, ''), r.objet, coalesce(r.detail, ''), coalesce(r.statut, ''),
    r.date_effet, coalesce(r.echeance::text, ''), coalesce(r.corrige_id::text, ''),
    to_char(r.enregistre_le at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    coalesce(r.auteur_id::text, ''), coalesce(r.auteur_nom, '')), 'UTF8')), 'hex')
$$;

create trigger registre_avant_ajout before insert on public.registre
  for each row execute function prive.registre_avant_ajout();

-- Ni modification, ni suppression — même avec la clé service, même par nous.
-- Seule exception : la purge d'une entreprise entière en fin de conservation
-- (prive.purger_entreprise), qui lève le verrou pour sa seule transaction.
create function prive.registre_immuable() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' and current_setting('vigie.purge', true) = 'oui' then
    return old;
  end if;
  raise exception 'Le registre de preuves est immuable : une entrée ne se modifie pas et ne s''efface pas. Pour corriger, ajoutez une entrée de genre « correction ».';
end $$;

create trigger registre_immuable before update or delete on public.registre
  for each row execute function prive.registre_immuable();
create trigger registre_pas_de_vidage before truncate on public.registre
  for each statement execute function prive.registre_immuable();

-- Vérifier la chaîne d'une entreprise : rend la première entrée dont
-- l'empreinte ne correspond plus, ou rien si tout est intact. Elle respecte
-- la RLS : on ne vérifie que ce qu'on a le droit de lire.
create function public.verifier_registre(e uuid)
returns table (intact boolean, entrees bigint, rompue_a bigint, derniere_empreinte text)
language plpgsql stable set search_path = '' as $$
declare
  r public.registre;
  attendue text := null;
  n bigint := 0;
begin
  for r in select * from public.registre where entreprise_id = e order by id loop
    n := n + 1;
    if r.precedente is distinct from attendue or r.empreinte <> prive.empreinte_registre(r) then
      return query select false, n, r.id, r.empreinte; return;
    end if;
    attendue := r.empreinte;
  end loop;
  return query select true, n, null::bigint, attendue;
end $$;

-- ---------------------------------------------------------------------------
-- 6. LES FONCTIONS D'AIDE AUX RÈGLES (qui suis-je par rapport à quoi ?)
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER : elles lisent les tables de membres sans être bloquées par
-- leurs propres règles, et ne rendent qu'un oui ou un non sur l'utilisateur
-- connecté (auth.uid()).

create function prive.role_dans_entreprise(e uuid) returns public.role_membre
language sql stable security definer set search_path = '' as $$
  select m.role from public.membres_entreprise m where m.entreprise_id = e and m.user_id = auth.uid()
$$;

create function prive.est_membre(e uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select prive.role_dans_entreprise(e) is not null
$$;

create function prive.est_admin(e uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select prive.role_dans_entreprise(e) = 'admin'
$$;

-- Le consultant de l'entreprise : membre de son cabinet, ET autorisé par elle.
-- « voit » : tout membre du cabinet ; « écrit » : admin ou membre, pas lecteur.
create function prive.consultant_voit(e uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.entreprises en
    join public.membres_consultant mc on mc.consultant_id = en.consultant_id
    where en.id = e and en.acces_consultant and mc.user_id = auth.uid())
$$;

create function prive.consultant_ecrit(e uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.entreprises en
    join public.membres_consultant mc on mc.consultant_id = en.consultant_id
    where en.id = e and en.acces_consultant and mc.user_id = auth.uid() and mc.role in ('admin', 'membre'))
$$;

create function prive.voit_entreprise(e uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select prive.est_membre(e) or prive.consultant_voit(e)
$$;

create function prive.membre_consultant(c uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.membres_consultant m where m.consultant_id = c and m.user_id = auth.uid())
$$;

create function prive.admin_consultant(c uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.membres_consultant m where m.consultant_id = c and m.user_id = auth.uid() and m.role = 'admin')
$$;

create function prive.est_administrateur() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from prive.administrateurs a where a.user_id = auth.uid())
$$;

-- Le rang de ce qu'une entreprise a payé : 1 textes, 2 suivi, 3 complet ;
-- 3 aussi si son cabinet consultant a un abonnement « consultant » actif.
-- 0 : pas d'abonnement actif. past_due (paiement en retard) garde l'accès.
create function prive.rang_entreprise(e uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select greatest(
    coalesce((select max(case a.formule when 'textes' then 1 when 'suivi' then 2 when 'complet' then 3 else 0 end)
              from public.abonnements a
              where a.entreprise_id = e and a.statut in ('active', 'trialing', 'past_due')), 0),
    coalesce((select 3 from public.entreprises en
              join public.abonnements a on a.consultant_id = en.consultant_id
              where en.id = e and a.statut in ('active', 'trialing', 'past_due') limit 1), 0))
$$;

-- Peut-il écrire dans le plan et le registre de cette entreprise ?
-- Admin ou membre (pas lecteur), ou son consultant autorisé ; et une formule
-- d'au moins « Textes et suivi ».
create function prive.peut_ecrire(e uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (prive.role_dans_entreprise(e) in ('admin', 'membre') or prive.consultant_ecrit(e))
     and prive.rang_entreprise(e) >= 2
$$;

grant execute on all functions in schema prive to authenticated;

-- ---------------------------------------------------------------------------
-- 7. LES ACTIONS CONTRÔLÉES (appelées par le site)
-- ---------------------------------------------------------------------------

-- Créer son entreprise : on en devient l'admin.
create function public.creer_entreprise(denomination text, naf text default null, effectif integer default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare e uuid;
begin
  if auth.uid() is null then raise exception 'Il faut être connecté.'; end if;
  insert into public.entreprises (denomination, naf, effectif) values (denomination, naf, effectif) returning id into e;
  insert into public.membres_entreprise (entreprise_id, user_id, role) values (e, auth.uid(), 'admin');
  return e;
end $$;

-- Créer son cabinet consultant : on en devient l'admin.
create function public.creer_cabinet(nom text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare c uuid;
begin
  if auth.uid() is null then raise exception 'Il faut être connecté.'; end if;
  insert into public.consultants (nom) values (nom) returning id into c;
  insert into public.membres_consultant (consultant_id, user_id, role) values (c, auth.uid(), 'admin');
  return c;
end $$;

-- Un consultant crée l'espace d'un client. L'accès du consultant est ouvert
-- au départ (il l'installe) ; l'entreprise peut le retirer quand elle veut.
create function public.creer_entreprise_cliente(cabinet uuid, denomination text, naf text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare e uuid;
begin
  if not exists (select 1 from public.membres_consultant m where m.consultant_id = cabinet
                 and m.user_id = auth.uid() and m.role in ('admin', 'membre')) then
    raise exception 'Seul un membre du cabinet peut créer l''espace d''un client.';
  end if;
  insert into public.entreprises (denomination, naf, consultant_id, acces_consultant)
    values (denomination, naf, cabinet, true) returning id into e;
  return e;
end $$;

-- Inviter quelqu'un : rend le jeton UNE fois (à envoyer à l'invité) ; la base
-- n'en garde que l'empreinte.
create function public.inviter(courriel text, role public.role_membre default 'membre',
                               entreprise uuid default null, cabinet uuid default null)
returns text language plpgsql security definer set search_path = '' as $$
declare jeton text := encode(gen_random_uuid()::text::bytea, 'hex') || encode(gen_random_uuid()::text::bytea, 'hex');
begin
  if num_nonnulls(entreprise, cabinet) <> 1 then raise exception 'Une invitation vise une entreprise OU un cabinet.'; end if;
  if entreprise is not null and not (prive.est_admin(entreprise)
       or (prive.consultant_ecrit(entreprise) and not exists (select 1 from public.membres_entreprise m where m.entreprise_id = entreprise))) then
    raise exception 'Seul un admin de l''entreprise peut inviter.';
  end if;
  if cabinet is not null and not prive.admin_consultant(cabinet) then
    raise exception 'Seul un admin du cabinet peut inviter.';
  end if;
  insert into public.invitations (entreprise_id, consultant_id, courriel, role, jeton_hash)
    values (entreprise, cabinet, lower(courriel), role, encode(sha256(convert_to(jeton, 'UTF8')), 'hex'));
  return jeton;
end $$;

-- Accepter une invitation : l'adresse du compte connecté doit être celle invitée.
create function public.accepter_invitation(jeton text)
returns void language plpgsql security definer set search_path = '' as $$
declare i public.invitations;
begin
  select * into i from public.invitations
    where jeton_hash = encode(sha256(convert_to(jeton, 'UTF8')), 'hex') for update;
  if i.id is null or i.acceptee_le is not null or i.expire_le < now() then
    raise exception 'Cette invitation n''est plus valable.';
  end if;
  if lower(coalesce(auth.email(), '')) <> i.courriel then
    raise exception 'Cette invitation a été envoyée à une autre adresse.';
  end if;
  if i.entreprise_id is not null then
    insert into public.membres_entreprise (entreprise_id, user_id, role) values (i.entreprise_id, auth.uid(), i.role)
      on conflict (entreprise_id, user_id) do update set role = excluded.role;
  else
    insert into public.membres_consultant (consultant_id, user_id, role) values (i.consultant_id, auth.uid(), i.role)
      on conflict (consultant_id, user_id) do update set role = excluded.role;
  end if;
  update public.invitations set acceptee_le = now() where id = i.id;
end $$;

-- Rattacher son entreprise à un cabinet, ou s'en détacher (admin seulement).
create function public.choisir_consultant(entreprise uuid, cabinet uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not prive.est_admin(entreprise) then raise exception 'Seul un admin de l''entreprise peut choisir son consultant.'; end if;
  update public.entreprises set consultant_id = cabinet, acces_consultant = (cabinet is not null) where id = entreprise;
end $$;

-- Le dernier admin d'une entreprise ne peut pas partir ni perdre son rôle :
-- elle se retrouverait sans personne pour la gérer.
create function prive.garder_un_admin() returns trigger
language plpgsql security definer set search_path = '' as $$
declare e uuid := coalesce(old.entreprise_id, new.entreprise_id);
begin
  if current_setting('vigie.purge', true) = 'oui' then return coalesce(new, old); end if;
  if old.role = 'admin' and (tg_op = 'DELETE' or new.role <> 'admin')
     and not exists (select 1 from public.membres_entreprise m
                     where m.entreprise_id = e and m.role = 'admin' and m.user_id <> old.user_id) then
    raise exception 'L''entreprise doit garder au moins un admin.';
  end if;
  return coalesce(new, old);
end $$;
create trigger garder_un_admin before update or delete on public.membres_entreprise
  for each row execute function prive.garder_un_admin();

-- La purge d'une entreprise entière, en fin de durée de conservation (RGPD).
-- Réservée à la clé service : le navigateur ne peut pas l'appeler.
create table prive.purges (
  entreprise_id uuid not null, denomination text, entrees_registre bigint, purgee_le timestamptz not null default now()
);
create function prive.purger_entreprise(e uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare n bigint; d text;
begin
  select denomination into d from public.entreprises where id = e;
  select count(*) into n from public.registre where entreprise_id = e;
  perform set_config('vigie.purge', 'oui', true);
  delete from public.registre where entreprise_id = e;
  delete from public.entreprises where id = e;
  insert into prive.purges (entreprise_id, denomination, entrees_registre) values (e, d, n);
end $$;
revoke execute on function prive.purger_entreprise(uuid) from public, authenticated;

-- ---------------------------------------------------------------------------
-- 8. LES VUES : l'état courant se DÉDUIT du registre, il n'est pas stocké
-- ---------------------------------------------------------------------------
-- security_invoker : la vue applique les règles de celui qui la lit.

-- Une entrée corrigée ne compte plus.
create view public.registre_en_vigueur with (security_invoker = true) as
  select r.* from public.registre r
  where r.genre <> 'correction'
    and not exists (select 1 from public.registre c where c.corrige_id = r.id);

-- La qualification d'un texte : la dernière en vigueur.
create view public.qualifications with (security_invoker = true) as
  select distinct on (r.entreprise_id, r.texte_id)
         r.entreprise_id, r.texte_id, r.statut, r.date_effet, r.auteur_nom, r.id as registre_id
  from public.registre_en_vigueur r
  where r.genre = 'qualification' and r.texte_id is not null
  order by r.entreprise_id, r.texte_id, r.id desc;

-- Les échéances : pour chaque sujet suivi, la dernière revue et la prochaine.
create view public.echeances with (security_invoker = true) as
  select p.entreprise_id, p.sujet_id, s.nom as sujet,
         coalesce(p.frequence, s.frequence) as frequence,
         d.derniere_revue,
         coalesce(d.derniere_revue, p.depuis::date) + case coalesce(p.frequence, s.frequence)
           when 'quotidienne' then 1 when 'hebdomadaire' then 7 when 'mensuelle' then 31 else 92 end as prochaine,
         coalesce(d.derniere_revue, p.depuis::date) + case coalesce(p.frequence, s.frequence)
           when 'quotidienne' then 1 when 'hebdomadaire' then 7 when 'mensuelle' then 31 else 92 end < current_date as en_retard
  from public.plan_sujets p
  join public.sujets s on s.id = p.sujet_id
  left join lateral (select max(r.date_effet) as derniere_revue from public.registre_en_vigueur r
                     where r.entreprise_id = p.entreprise_id and r.sujet_id = p.sujet_id and r.genre = 'revue') d on true
  where p.actif;

-- Pour la facturation consultant : clients actifs par cabinet (lue par la clé service).
create view prive.clients_actifs_consultant as
  select consultant_id, count(*) filter (where active) as actifs
  from public.entreprises where consultant_id is not null group by consultant_id;

-- ---------------------------------------------------------------------------
-- 9. LA RLS : activée partout, puis les règles une par une
-- ---------------------------------------------------------------------------

alter table public.sujets             enable row level security;
alter table public.textes             enable row level security;
alter table public.textes_sujets      enable row level security;
alter table public.collectes          enable row level security;
alter table public.profils            enable row level security;
alter table public.consultants        enable row level security;
alter table public.entreprises        enable row level security;
alter table public.membres_entreprise enable row level security;
alter table public.membres_consultant enable row level security;
alter table public.invitations        enable row level security;
alter table public.abonnements        enable row level security;
alter table public.reponses           enable row level security;
alter table public.plan_sujets        enable row level security;
alter table public.registre           enable row level security;
alter table prive.administrateurs     enable row level security;
alter table prive.purges              enable row level security;

-- Le commun : lisible par tous (ce sont des textes publics).
create policy lecture on public.sujets        for select using (true);
create policy lecture on public.textes        for select using (true);
create policy lecture on public.textes_sujets for select using (true);
create policy lecture on public.collectes     for select using (true);

-- Profils : chacun le sien ; et les membres des entreprises qu'on voit.
create policy le_mien on public.profils for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy collegues on public.profils for select to authenticated using (exists (
  select 1 from public.membres_entreprise m where m.user_id = profils.id and prive.voit_entreprise(m.entreprise_id)));

-- Entreprises.
create policy lecture on public.entreprises for select to authenticated
  using (prive.voit_entreprise(id) or prive.est_administrateur());
create policy modification on public.entreprises for update to authenticated
  using (prive.est_admin(id)) with check (prive.est_admin(id));

-- Membres d'une entreprise.
create policy lecture on public.membres_entreprise for select to authenticated
  using (prive.voit_entreprise(entreprise_id));
create policy role on public.membres_entreprise for update to authenticated
  using (prive.est_admin(entreprise_id)) with check (prive.est_admin(entreprise_id));
create policy depart on public.membres_entreprise for delete to authenticated
  using (prive.est_admin(entreprise_id) or user_id = auth.uid());

-- Cabinets consultants : leurs membres ; et leurs entreprises clientes (le thème).
create policy lecture on public.consultants for select to authenticated using (
  prive.membre_consultant(id) or prive.est_administrateur() or exists (
    select 1 from public.entreprises e where e.consultant_id = consultants.id and prive.est_membre(e.id)));
create policy modification on public.consultants for update to authenticated
  using (prive.admin_consultant(id)) with check (prive.admin_consultant(id));

create policy lecture on public.membres_consultant for select to authenticated
  using (prive.membre_consultant(consultant_id));
create policy role on public.membres_consultant for update to authenticated
  using (prive.admin_consultant(consultant_id)) with check (prive.admin_consultant(consultant_id));
create policy depart on public.membres_consultant for delete to authenticated
  using (prive.admin_consultant(consultant_id) or user_id = auth.uid());

-- Invitations : les admins de l'organisation concernée.
create policy lecture on public.invitations for select to authenticated using (
  (entreprise_id is not null and prive.est_admin(entreprise_id)) or
  (consultant_id is not null and prive.admin_consultant(consultant_id)));

-- Abonnements : lecture par les intéressés ; écriture par Stripe seul (clé service).
create policy lecture on public.abonnements for select to authenticated using (
  (entreprise_id is not null and prive.voit_entreprise(entreprise_id)) or
  (consultant_id is not null and prive.membre_consultant(consultant_id)) or prive.est_administrateur());

-- Réponses et plan : lire si on voit l'entreprise ; écrire si on peut écrire.
-- Les réponses suffisent à la formule Textes (rang 1) : c'est ce qui dit ce
-- qui s'applique ; le plan suivi demande au moins Textes et suivi (rang 2).
create policy lecture on public.reponses for select to authenticated using (prive.voit_entreprise(entreprise_id));
create policy ajout on public.reponses for insert to authenticated with check (
  (prive.role_dans_entreprise(entreprise_id) in ('admin', 'membre') or prive.consultant_ecrit(entreprise_id))
  and prive.rang_entreprise(entreprise_id) >= 1);
create policy modification on public.reponses for update to authenticated
  using (prive.voit_entreprise(entreprise_id)) with check (
  (prive.role_dans_entreprise(entreprise_id) in ('admin', 'membre') or prive.consultant_ecrit(entreprise_id))
  and prive.rang_entreprise(entreprise_id) >= 1);

create policy lecture on public.plan_sujets for select to authenticated using (prive.voit_entreprise(entreprise_id));
create policy ajout on public.plan_sujets for insert to authenticated with check (prive.peut_ecrire(entreprise_id));
create policy modification on public.plan_sujets for update to authenticated
  using (prive.voit_entreprise(entreprise_id)) with check (prive.peut_ecrire(entreprise_id));

-- Le registre : lire si on voit l'entreprise — même sans abonnement en cours,
-- pour pouvoir l'exporter ; ajouter si on peut écrire. Ni modification ni
-- suppression : aucune règle, aucun droit, et le déclencheur en plus.
create policy lecture on public.registre for select to authenticated using (prive.voit_entreprise(entreprise_id));
create policy ajout on public.registre for insert to authenticated with check (prive.peut_ecrire(entreprise_id));

-- ---------------------------------------------------------------------------
-- 10. LES DROITS : ce que le navigateur peut tenter, au plus
-- ---------------------------------------------------------------------------
-- Supabase accorde par défaut tous les droits sur les nouvelles tables aux
-- rôles du navigateur. On repart de zéro, et on n'ouvre que le nécessaire.

revoke all on all tables in schema public from anon, authenticated;
revoke all on all tables in schema prive from anon, authenticated;
-- Par défaut, PostgreSQL laisse TOUT LE MONDE (« public », donc aussi le
-- visiteur non connecté) appeler une fonction nouvelle. On le retire, puis on
-- n'accorde que les fonctions utiles, aux seuls utilisateurs connectés.
revoke execute on all functions in schema public, prive from public, anon;
grant execute on all functions in schema prive to authenticated;
revoke execute on function prive.purger_entreprise(uuid) from authenticated;

grant select on public.sujets, public.textes, public.textes_sujets, public.collectes to anon, authenticated;

grant select, insert, update on public.profils to authenticated;
grant select on public.entreprises to authenticated;
grant update (denomination, naf, effectif, implantation, acces_consultant) on public.entreprises to authenticated;
grant select, delete on public.membres_entreprise to authenticated;
grant update (role) on public.membres_entreprise to authenticated;
grant select on public.consultants to authenticated;
grant update (nom, theme) on public.consultants to authenticated;
grant select, delete on public.membres_consultant to authenticated;
grant update (role) on public.membres_consultant to authenticated;
grant select on public.invitations, public.abonnements to authenticated;
grant select, insert on public.reponses to authenticated;
grant update (valeur, maj_le, maj_par) on public.reponses to authenticated;
grant select, insert on public.plan_sujets to authenticated;
grant update (frequence, actif) on public.plan_sujets to authenticated;
grant select on public.registre to authenticated;
grant insert (entreprise_id, genre, sujet_id, texte_id, objet, detail, statut, date_effet, echeance, corrige_id)
  on public.registre to authenticated;
grant select on public.registre_en_vigueur, public.qualifications, public.echeances to authenticated;

grant execute on function public.creer_entreprise(text, text, integer), public.creer_cabinet(text),
  public.creer_entreprise_cliente(uuid, text, text), public.inviter(text, public.role_membre, uuid, uuid),
  public.accepter_invitation(text), public.choisir_consultant(uuid, uuid), public.verifier_registre(uuid)
  to authenticated;

-- La clé service (robot, Stripe, migrations) a tout — sauf modifier ou effacer
-- le registre : le déclencheur l'en empêche, comme tout le monde.
grant usage on schema prive to service_role;
grant all on all tables in schema public, prive to service_role;
grant all on all sequences in schema public, prive to service_role;
grant execute on all functions in schema public, prive to service_role;
