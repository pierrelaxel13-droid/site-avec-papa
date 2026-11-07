-- ===========================================================================
-- Les limites contre les abus (7 novembre 2026, revue de sécurité)
-- ---------------------------------------------------------------------------
-- Faille corrigée : n'importe qui pouvait ouvrir un compte gratuit, créer une
-- entreprise, puis envoyer des milliers d'invitations, à n'importe quelles
-- adresses, depuis contact@vigie-reglementaire.fr (avec un nom d'entreprise
-- trompeur dans l'e-mail). Brevo aurait suspendu l'envoi et le domaine aurait
-- été classé comme expéditeur de spam. De même, rien ne limitait la création
-- d'entreprises ou de cabinets (remplissage de la base).
--
-- Les limites sont posées sur les TABLES (déclencheurs « before insert »),
-- donc valables quel que soit le chemin : inviter, renvoyer l'invitation,
-- créer un client, une future fonction… Les insertions faites par les robots
-- et l'administration (sans utilisateur connecté) ne sont pas comptées.
--
--   Invitations : adresse valable ; 30 par heure et 100 par jour par compte ;
--                 5 par jour vers une même adresse ; 500 par jour pour tout
--                 le site.
--   Entreprises : 50 créées par jour par compte (un consultant qui ouvre les
--                 espaces de ses clients compris).
--   Cabinets    : 5 créés par jour par compte.
--   Fonction serveur « vigie » : prive.depasse() sert aussi à limiter ses
--                 appels (paiement, résiliation…), voir supabase/functions.
-- ===========================================================================

create table if not exists prive.compteurs (
  cle  text not null check (length(cle) <= 200),
  le   timestamptz not null default now()
);
create index if not exists compteurs_cle_le on prive.compteurs (cle, le);
alter table prive.compteurs enable row level security;   -- aucune règle : fonctions seulement

-- Vrai si la limite est atteinte ; sinon compte ce passage et rend faux.
create or replace function prive.depasse(cle text, maxi integer, fenetre interval) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare n integer;
begin
  perform pg_advisory_xact_lock(hashtext('compteur:' || depasse.cle));
  select count(*) into n from prive.compteurs c where c.cle = depasse.cle and c.le > now() - fenetre;
  if n >= maxi then return true; end if;
  insert into prive.compteurs (cle) values (depasse.cle);
  -- Ménage : rien ne sert au-delà d'un jour (la plus longue fenêtre).
  if random() < 0.02 then delete from prive.compteurs c where c.le < now() - interval '2 days'; end if;
  return false;
end $$;
revoke all on function prive.depasse(text, integer, interval) from public, anon, authenticated;

-- --- Les invitations ---------------------------------------------------------
create or replace function prive.limite_invitations() returns trigger
language plpgsql security definer set search_path = '' as $$
declare qui uuid := auth.uid(); a text := lower(btrim(coalesce(new.courriel, '')));
begin
  if a !~ '^[a-z0-9._%+''-]+@[a-z0-9.-]+\.[a-z]{2,}$' or length(a) > 254 then
    raise exception 'Adresse électronique invalide.' using errcode = '22023';
  end if;
  new.courriel := a;
  if qui is null then return new; end if;   -- robots et administration
  if prive.depasse('invit:compte:' || qui, 30, interval '1 hour')
     or prive.depasse('invit:compte-jour:' || qui, 100, interval '1 day') then
    raise exception 'Trop d''invitations envoyées en peu de temps. Réessayez plus tard.' using errcode = 'P0001';
  end if;
  if prive.depasse('invit:adresse:' || a, 5, interval '1 day') then
    raise exception 'Cette adresse a déjà reçu plusieurs invitations aujourd''hui. Réessayez demain.' using errcode = 'P0001';
  end if;
  if prive.depasse('invit:site', 500, interval '1 day') then
    raise exception 'Le nombre d''invitations du jour est atteint. Réessayez demain, ou écrivez-nous.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists limite_invitations on public.invitations;
create trigger limite_invitations before insert on public.invitations
  for each row execute function prive.limite_invitations();

-- --- Les entreprises et les cabinets ----------------------------------------
create or replace function prive.limite_creations() returns trigger
language plpgsql security definer set search_path = '' as $$
declare qui uuid := auth.uid();
begin
  if qui is null then return new; end if;
  if tg_table_name = 'entreprises' and prive.depasse('creer:entreprise:' || qui, 50, interval '1 day') then
    raise exception 'Trop d''espaces créés aujourd''hui depuis ce compte. Réessayez demain, ou écrivez-nous.' using errcode = 'P0001';
  end if;
  if tg_table_name = 'consultants' and prive.depasse('creer:cabinet:' || qui, 5, interval '1 day') then
    raise exception 'Trop de cabinets créés aujourd''hui depuis ce compte. Réessayez demain, ou écrivez-nous.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists limite_creations on public.entreprises;
create trigger limite_creations before insert on public.entreprises
  for each row execute function prive.limite_creations();
drop trigger if exists limite_creations on public.consultants;
create trigger limite_creations before insert on public.consultants
  for each row execute function prive.limite_creations();

revoke all on function prive.limite_invitations(), prive.limite_creations() from public, anon, authenticated;
