-- ===========================================================================
-- Les robots du matin, à l'heure (6 novembre 2026)
-- ---------------------------------------------------------------------------
-- GitHub retarde énormément ses horaires programmés sur ce dépôt : le relevé
-- « toutes les heures » n'a tourné que 4 fois le 6 novembre et le
-- récapitulatif de 8 h 37 est parti à 16 h 21. Un lancement DEMANDÉ
-- (workflow_dispatch), lui, démarre dans la minute.
-- Supabase sert donc de réveil (pg_cron) et demande à GitHub de lancer :
--   - le relevé des textes (releve.yml)        à 5 h 00 UTC (6 h à Paris l'hiver) ;
--   - le récapitulatif par e-mail (recap.yml)  à 6 h 30 UTC (7 h 30 à Paris l'hiver).
-- (pg_cron compte en UTC : l'été, ce sera 7 h et 8 h 30 à Paris.)
-- Les horaires GitHub restent en secours ; un récapitulatif déjà envoyé dans
-- la journée ne repart pas.
--
-- La clé GitHub (droit « Actions : écriture » sur ce dépôt seulement) est
-- rangée dans le coffre de Supabase (Vault) sous le nom « github_robots » par
-- .github/workflows/fonctions.yml, depuis le secret GitHub VIGIE_GITHUB_ROBOTS.
-- Elle n'est jamais écrite dans le dépôt.
-- Sans pg_cron, pg_net ou Vault (base de test du dépôt), rien ne change.
-- ===========================================================================

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
  end if;
exception when others then
  raise notice 'pg_cron indisponible (%) : les robots gardent les horaires GitHub.', sqlerrm;
end $$;

create or replace function prive.lancer_robot(fichier text, entrees jsonb default '{}'::jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare cle text;
begin
  if fichier !~ '^[a-z0-9-]+\.yml$' then return 'nom de robot refusé'; end if;
  if to_regnamespace('net') is null or to_regnamespace('vault') is null then return 'pg_net ou Vault absent'; end if;
  execute $q$select decrypted_secret from vault.decrypted_secrets where name = 'github_robots' limit 1$q$ into cle;
  if cle is null or cle = '' then return 'clé GitHub absente du coffre'; end if;
  execute $q$select net.http_post(
      url := 'https://api.github.com/repos/pierrelaxel13-droid/site-avec-papa/actions/workflows/' || $1 || '/dispatches',
      body := jsonb_build_object('ref', 'main', 'inputs', $2),
      headers := jsonb_build_object('Authorization', 'Bearer ' || $3, 'Accept', 'application/vnd.github+json',
                                    'X-GitHub-Api-Version', '2022-11-28', 'User-Agent', 'vigie-reglementaire',
                                    'Content-Type', 'application/json'),
      timeout_milliseconds := 20000)$q$ using fichier, entrees, cle;
  return 'demandé';
end $$;
revoke all on function prive.lancer_robot(text, jsonb) from public, anon, authenticated;

do $$
begin
  if to_regnamespace('cron') is null then return; end if;
  perform cron.unschedule(jobid) from cron.job where jobname in ('vigie-releve-matin', 'vigie-recap-matin');
  perform cron.schedule('vigie-releve-matin', '0 5 * * *',
    $j$select prive.lancer_robot('releve.yml', '{"controle":"false"}'::jsonb)$j$);
  perform cron.schedule('vigie-recap-matin', '30 6 * * *',
    $j$select prive.lancer_robot('recap.yml')$j$);
end $$;
