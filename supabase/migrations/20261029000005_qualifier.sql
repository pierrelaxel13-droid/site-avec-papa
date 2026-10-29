-- ===========================================================================
-- Qualifier un texte, et en tirer une action datée
-- ---------------------------------------------------------------------------
-- Tout s'inscrit au registre, rien ne s'efface :
--   - « qualification » : statut applicable / a_suivre / sans_objet. Changer
--     d'avis ajoute une nouvelle qualification ; la dernière fait foi.
--   - « action » ouverte : ce qu'il faut faire, avec son échéance.
--   - l'action faite : une nouvelle entrée « action », statut « faite », dont
--     la clé est « action:<n° de l'action> ».
-- Le texte est désigné par sa clé (« jo:JORFARTI… »), la même que la case
-- « Fait ». Le rattachement à public.textes viendra avec le robot (lot 6).
-- ===========================================================================

create function public.espace_qualifier(e uuid, quoi text, intitule text, statut text, note text)
returns date language plpgsql set search_path = '' as $$
declare le date;
begin
  if statut not in ('applicable', 'a_suivre', 'sans_objet') then
    raise exception 'Qualification inconnue : %', statut;
  end if;
  if not prive.peut_ecrire(e) then
    if prive.voit_entreprise(e) and prive.rang_entreprise(e) < 2 then
      raise exception 'Qualifier les textes fait partie de la formule « Textes et suivi ».' using errcode = '42501';
    end if;
    raise exception 'Vous êtes en lecture seule dans cette entreprise.' using errcode = '42501';
  end if;
  insert into public.registre (entreprise_id, genre, objet, detail, statut, cle)
  values (e, 'qualification', left(coalesce(nullif(btrim(intitule), ''), quoi), 500),
          nullif(left(btrim(coalesce(note, '')), 5000), ''), statut, quoi)
  returning date_effet into le;
  return le;
end $$;

-- Ouvrir une action (avec son échéance), rattachée à un texte.
create function public.espace_action(e uuid, quoi text, intitule text, echeance date, note text)
returns bigint language plpgsql set search_path = '' as $$
declare n bigint;
begin
  if nullif(btrim(intitule), '') is null then raise exception 'Dites ce qu''il faut faire.'; end if;
  if echeance is null then raise exception 'Donnez une échéance.'; end if;
  if not prive.peut_ecrire(e) then
    raise exception 'Vous ne pouvez pas écrire dans le registre de cette entreprise.' using errcode = '42501';
  end if;
  insert into public.registre (entreprise_id, genre, objet, detail, statut, echeance, cle)
  values (e, 'action', left(btrim(intitule), 500), nullif(left(btrim(coalesce(note, '')), 5000), ''),
          'ouverte', echeance, quoi)
  returning id into n;
  return n;
end $$;

-- Dire qu'une action ouverte est faite.
create function public.espace_action_faite(e uuid, action bigint)
returns date language plpgsql set search_path = '' as $$
declare a public.registre; le date;
begin
  select r.* into a from public.registre r
   where r.id = action and r.entreprise_id = e and r.genre = 'action' and r.statut = 'ouverte';
  if not found then raise exception 'Action introuvable.'; end if;
  if exists (select 1 from public.registre r where r.entreprise_id = e and r.cle = 'action:' || action) then
    raise exception 'Cette action est déjà faite.';
  end if;
  if not prive.peut_ecrire(e) then
    raise exception 'Vous ne pouvez pas écrire dans le registre de cette entreprise.' using errcode = '42501';
  end if;
  insert into public.registre (entreprise_id, genre, objet, detail, statut, cle)
  values (e, 'action', left('Fait : ' || a.objet, 500), 'Action n° ' || a.id || ', prévue pour le ' ||
          to_char(a.echeance, 'DD/MM/YYYY') || '.', 'faite', 'action:' || action)
  returning date_effet into le;
  return le;
end $$;

-- espace_lire rend aussi les qualifications en vigueur et les actions ouvertes.
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
    'actions', coalesce((select json_agg(json_build_object(
          'id', r.id, 'cle', r.cle, 'objet', r.objet, 'echeance', r.echeance, 'note', r.detail,
          'le', r.date_effet, 'par', r.auteur_nom) order by r.echeance, r.id)
        from public.registre r
        where r.entreprise_id = e and r.genre = 'action' and r.statut = 'ouverte'
          and not exists (select 1 from public.registre c where c.corrige_id = r.id)
          and not exists (select 1 from public.registre f where f.entreprise_id = e and f.cle = 'action:' || r.id)), '[]'),
    'profil', coalesce((select p.reglages from public.profils p where p.id = auth.uid()), '{}'));
end $$;

revoke execute on function public.espace_qualifier(uuid, text, text, text, text),
  public.espace_action(uuid, text, text, date, text), public.espace_action_faite(uuid, bigint) from public, anon;
grant execute on function public.espace_qualifier(uuid, text, text, text, text),
  public.espace_action(uuid, text, text, date, text), public.espace_action_faite(uuid, bigint) to authenticated, service_role;
