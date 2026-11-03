-- ===========================================================================
-- L'évaluation de conformité réglementaire (formule « Veille complète »)
-- ---------------------------------------------------------------------------
-- Pour chaque texte de référence du plan, l'entreprise dit où elle en est :
-- conforme / partiel / non_conforme / a_evaluer, avec sa preuve ou son
-- commentaire. Comme une qualification, chaque évaluation s'inscrit au
-- registre (genre « conformite ») et ne s'efface pas : réévaluer ajoute une
-- entrée, la dernière fait foi. C'est ce qu'un auditeur demande (ISO 14001
-- et 45001 : « évaluation de la conformité »).
-- ===========================================================================
alter type public.genre_registre add value if not exists 'conformite';

create function public.espace_conformite(e uuid, quoi text, intitule text, statut text, note text)
returns date language plpgsql set search_path = '' as $$
declare le date;
begin
  if statut not in ('conforme', 'partiel', 'non_conforme', 'a_evaluer') then
    raise exception 'Évaluation inconnue : %', statut;
  end if;
  if nullif(btrim(coalesce(quoi, '')), '') is null or length(quoi) > 300 then
    raise exception 'Texte évalué manquant.';
  end if;
  if not prive.peut_ecrire(e) then
    raise exception 'Vous ne pouvez pas écrire dans le registre de cette entreprise.' using errcode = '42501';
  end if;
  if prive.rang_entreprise(e) < 3 then
    raise exception 'L''évaluation de conformité fait partie de la formule « Veille complète ».' using errcode = '42501';
  end if;
  insert into public.registre (entreprise_id, genre, objet, detail, statut, cle)
  values (e, 'conformite', left(coalesce(nullif(btrim(intitule), ''), quoi), 500),
          nullif(left(btrim(coalesce(note, '')), 5000), ''), statut, quoi)
  returning date_effet into le;
  return le;
end $$;
revoke execute on function public.espace_conformite(uuid, text, text, text, text) from public, anon;
grant execute on function public.espace_conformite(uuid, text, text, text, text) to authenticated, service_role;

-- espace_lire rend aussi la dernière évaluation de chaque texte.
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
    'profil', coalesce((select p.reglages from public.profils p where p.id = auth.uid()), '{}'));
end $$;
