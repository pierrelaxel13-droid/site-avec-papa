-- ===========================================================================
-- Le récapitulatif quotidien activé par défaut (6 novembre 2026)
-- ---------------------------------------------------------------------------
-- Demande d'Axel : les clients doivent recevoir le mail du matin (les textes
-- publiés qui les concernent) sans avoir à le demander. Il part à l'adresse de
-- leur propre compte ; chacun peut l'arrêter dans Mon compte ou par le lien de
-- désinscription de l'e-mail.
--   1. Par défaut : activé (nouveaux comptes et comptes sans réglage).
--   2. Les membres actuels des entreprises : activé (personne ne l'avait encore
--      réellement reçu, la case était décochée par défaut).
--   3. Chaque nouveau membre d'une entreprise : activé dès son arrivée.
-- ===========================================================================

alter table prive.recap_quotidien alter column actif set default true;

insert into prive.recap_quotidien (user_id, actif)
  select distinct m.user_id, true from public.membres_entreprise m
  on conflict (user_id) do update set actif = true, maj_le = now();

create or replace function public.mon_recap() returns json
language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'recap', coalesce((select actif from prive.recap_quotidien where user_id = auth.uid()), true),
    'rappels', coalesce((select rappels from prive.recap_quotidien where user_id = auth.uid()), true))
$$;

create or replace function prive.recap_nouveau_membre() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into prive.recap_quotidien (user_id, actif) values (new.user_id, true) on conflict (user_id) do nothing;
  return new;
end $$;
drop trigger if exists recap_nouveau_membre on public.membres_entreprise;
create trigger recap_nouveau_membre after insert on public.membres_entreprise
  for each row execute function prive.recap_nouveau_membre();
revoke all on function prive.recap_nouveau_membre() from public, anon, authenticated;
