-- ===========================================================================
-- Le plan d'actions (3 novembre 2026)
-- ---------------------------------------------------------------------------
-- Une action du plan est une action du registre (espace_action), avec sa clé
-- « actions:<texte>:<action> », son échéance (le délai de réalisation)
-- et son responsable (dans la note : « Responsable : … »). La valider, c'est
-- espace_action_faite : une entrée datée, avec son auteur.
--
-- Changer le délai ou le responsable : le registre ne s'efface pas. On
-- inscrit une correction de l'action (genre « correction », corrige_id),
-- puis l'action replanifiée ; la première reste lisible, barrée.
-- espace_lire rend aussi les actions du plan déjà validées.
-- ===========================================================================
create function public.espace_action_modifier(e uuid, action bigint, echeance date, note text)
returns bigint language plpgsql set search_path = '' as $$
declare a public.registre; n bigint;
begin
  if echeance is null then raise exception 'Donnez une échéance.'; end if;
  if not prive.peut_ecrire(e) then
    raise exception 'Vous ne pouvez pas écrire dans le registre de cette entreprise.' using errcode = '42501';
  end if;
  select r.* into a from public.registre r
   where r.id = action and r.entreprise_id = e and r.genre = 'action' and r.statut = 'ouverte'
     and not exists (select 1 from public.registre c where c.corrige_id = r.id)
     and not exists (select 1 from public.registre f where f.entreprise_id = e and f.cle = 'action:' || r.id);
  if not found then raise exception 'Action introuvable, déjà faite ou déjà modifiée.'; end if;
  insert into public.registre (entreprise_id, genre, objet, detail, corrige_id, cle)
  values (e, 'correction', left('Replanifié : ' || a.objet, 500),
          'Échéance ' || to_char(echeance, 'DD/MM/YYYY') || coalesce(' ; ' || nullif(btrim(coalesce(note, '')), ''), ''), a.id, a.cle);
  insert into public.registre (entreprise_id, genre, objet, detail, statut, echeance, cle)
  values (e, 'action', a.objet, nullif(left(btrim(coalesce(note, '')), 5000), ''), 'ouverte', echeance, a.cle)
  returning id into n;
  return n;
end $$;
revoke execute on function public.espace_action_modifier(uuid, bigint, date, text) from public, anon;
grant execute on function public.espace_action_modifier(uuid, bigint, date, text) to authenticated, service_role;

-- espace_lire rend aussi les actions du plan déjà validées.
create or replace function public.espace_lire(e uuid) returns json
language plpgsql stable set search_path = '' as $$
begin
  if not prive.voit_entreprise(e) then
    raise exception 'Cette entreprise n''est pas la vôtre.' using errcode = '42501';
  end if;
  return json_build_object(
    'entreprise', (select json_build_object(
        'id', en.id, 'denomination', en.denomination, 'naf', en.naf, 'effectif', en.effectif,
        'implantation', en.implantation, 'reglages', en.reglages, 'cree_le', en.cree_le)
      from public.entreprises en where en.id = e),
    'role', prive.role_dans_entreprise(e),
    'rang', prive.rang_entreprise(e),
    'ecrit', prive.peut_ecrire(e),
    'reponses', coalesce((select json_object_agg(r.declencheur, r.valeur)
      from public.reponses r where r.entreprise_id = e), '{}'),
    'faits', coalesce((select json_object_agg(x.cle, x.le) from (
        select r.cle, max(r.date_effet) as le from public.registre r
        where r.entreprise_id = e and r.genre = 'revue' and r.cle is not null
          and not exists (select 1 from public.registre c where c.corrige_id = r.id)
        group by r.cle) x), '{}'),
    'qualifications', coalesce((select json_object_agg(x.cle, json_build_object(
          'statut', x.statut, 'le', x.date_effet, 'note', x.detail, 'par', x.auteur_nom)) from (
        select distinct on (r.cle) r.cle, r.statut, r.date_effet, r.detail, r.auteur_nom
        from public.registre r
        where r.entreprise_id = e and r.genre = 'qualification' and r.cle is not null
          and not exists (select 1 from public.registre c where c.corrige_id = r.id)
        order by r.cle, r.id desc) x), '{}'),
    'conformites', coalesce((select json_object_agg(x.cle, json_build_object(
          'statut', x.statut, 'le', x.date_effet, 'note', x.detail, 'par', x.auteur_nom)) from (
        select distinct on (r.cle) r.cle, r.statut, r.date_effet, r.detail, r.auteur_nom
        from public.registre r
        where r.entreprise_id = e and r.genre = 'conformite' and r.cle is not null
          and not exists (select 1 from public.registre c where c.corrige_id = r.id)
        order by r.cle, r.id desc) x), '{}'),
    'actions', coalesce((select json_agg(json_build_object(
          'id', r.id, 'cle', r.cle, 'objet', r.objet, 'echeance', r.echeance, 'note', r.detail,
          'le', r.date_effet, 'par', r.auteur_nom) order by r.echeance, r.id)
        from public.registre r
        where r.entreprise_id = e and r.genre = 'action' and r.statut = 'ouverte'
          and not exists (select 1 from public.registre c where c.corrige_id = r.id)
          and not exists (select 1 from public.registre f where f.entreprise_id = e and f.cle = 'action:' || r.id)), '[]'),
    'actions_faites', coalesce((select json_agg(json_build_object(
          'id', r.id, 'cle', r.cle, 'objet', r.objet, 'echeance', r.echeance, 'note', r.detail,
          'faite_le', f.date_effet, 'par', f.auteur_nom) order by f.id desc)
        from public.registre r
        join public.registre f on f.entreprise_id = e and f.cle = 'action:' || r.id
        where r.entreprise_id = e and r.genre = 'action' and r.statut = 'ouverte' and r.cle like 'actions:%'
          and not exists (select 1 from public.registre c where c.corrige_id = r.id)), '[]'),
    'profil', coalesce((select p.reglages from public.profils p where p.id = auth.uid()), '{}'));
end $$;
