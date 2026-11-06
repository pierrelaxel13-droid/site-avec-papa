-- ===========================================================================
-- Les e-mails partent aussitôt (6 novembre 2026)
-- ---------------------------------------------------------------------------
-- Jusqu'ici, la file prive.courriels n'était vidée que par le robot GitHub
-- (toutes les 10 minutes en principe ; en pratique, GitHub le lance bien plus
-- rarement). Désormais, chaque e-mail mis en file réveille la fonction
-- Supabase « vigie » (supabase/functions/vigie, action « courriels »), qui
-- l'envoie dans la seconde. L'appel part par pg_net APRÈS la validation de la
-- transaction : la fonction voit donc bien l'e-mail.
-- Sans pg_net (base de test du dépôt), rien ne change : le robot reste là, en
-- secours, de toute façon.
-- L'adresse de la fonction est publique (celle du projet Supabase, déjà dans
-- le site) ; l'action « courriels » n'envoie que ce que la base a mis en file.
-- ===========================================================================

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net;
  end if;
exception when others then
  raise notice 'pg_net indisponible (%), les e-mails partiront par le robot.', sqlerrm;
end $$;

create or replace function prive.courriels_reveil() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if to_regnamespace('net') is not null then
    execute $q$select net.http_post(url := 'https://denpxyqbvjcwsbxjtqpd.supabase.co/functions/v1/vigie',
      body := '{"action":"courriels"}'::jsonb, headers := '{"Content-Type":"application/json"}'::jsonb, timeout_milliseconds := 20000)$q$;
  end if;
  return null;
exception when others then
  return null;   -- jamais bloquer une invitation ou une facture pour un e-mail
end $$;

drop trigger if exists courriels_reveil on prive.courriels;
create trigger courriels_reveil after insert on prive.courriels
  for each statement execute function prive.courriels_reveil();

revoke all on function prive.courriels_reveil() from public, anon, authenticated;

-- Mon compte : le nombre de clients couvert par l'abonnement consultant
-- (bouton « Modifier le nombre de clients »).
create or replace function prive.abonnement_json(e uuid, c uuid) returns json
language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'formule', a.formule, 'periode', a.periode, 'statut', a.statut,
    'fin_periode', a.fin_periode, 'resiliation_prevue', a.resiliation_prevue,
    'clients_max', a.clients_max,
    'offert', a.statut = 'offert' or a.stripe_abonnement is null)
  from public.abonnements a
  where (e is not null and a.entreprise_id = e) or (c is not null and a.consultant_id = c)
  order by (a.statut in ('active', 'trialing', 'past_due', 'offert')) desc,
           case a.formule when 'complet' then 3 when 'consultant' then 3 when 'suivi' then 2 when 'textes' then 1 else 0 end desc,
           a.maj_le desc
  limit 1
$$;
