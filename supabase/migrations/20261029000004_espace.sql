-- ===========================================================================
-- L'espace d'un abonné, enregistré dans la base (et plus dans le navigateur)
-- ---------------------------------------------------------------------------
--   - les réglages de l'entreprise : colonnes connues + entreprises.reglages
--     (le reste du formulaire : SIRET, responsable, chiffres, certifications) ;
--     les questions de situation dans public.reponses ;
--   - les réglages d'alerte de chaque personne : profils.reglages ;
--   - chaque case « Fait » : une entrée « revue » du registre, datée, avec son
--     auteur. La décocher n'efface rien : une « correction » s'ajoute.
--
-- Toutes ces fonctions s'exécutent avec les droits de la personne connectée
-- (pas de security definer) : ce sont les règles de la base (RLS) qui
-- décident, comme pour un accès direct aux tables.
-- ===========================================================================

alter table public.entreprises add column reglages jsonb not null default '{}'
  check (jsonb_typeof(reglages) = 'object' and length(reglages::text) <= 20000);
grant update (reglages) on public.entreprises to authenticated;

alter table public.profils add column reglages jsonb not null default '{}'
  check (jsonb_typeof(reglages) = 'object' and length(reglages::text) <= 5000);

-- Ce que l'entrée concerne dans le site : « plan:sst » (la revue d'un
-- domaine), « jo:JORFARTI… » (un texte du Journal officiel)…
alter table public.registre add column cle text
  check (cle is null or cle ~ '^[a-z]{2,12}:[A-Za-z0-9_.:-]{1,160}$');
grant insert (cle) on public.registre to authenticated;
create index on public.registre (entreprise_id, cle);

-- L'empreinte couvre aussi la clé. concat_ws saute les valeurs nulles : les
-- entrées d'avant, sans clé, gardent exactement la même empreinte.
create or replace function prive.empreinte_registre(r public.registre) returns text
language sql immutable set search_path = '' as $$
  select encode(sha256(convert_to(concat_ws('|',
    coalesce(r.precedente, ''), r.id, r.entreprise_id, r.genre, coalesce(r.sujet_id, ''),
    coalesce(r.texte_id, ''), r.objet, coalesce(r.detail, ''), coalesce(r.statut, ''),
    r.date_effet, coalesce(r.echeance::text, ''), coalesce(r.corrige_id::text, ''),
    to_char(r.enregistre_le at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    coalesce(r.auteur_id::text, ''), coalesce(r.auteur_nom, ''), r.cle), 'UTF8')), 'hex')
$$;

-- Tout ce qu'une page de l'espace lit, en un appel.
--   faits : pour chaque clé, la date de la dernière revue non annulée.
create function public.espace_lire(e uuid) returns json
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
    'profil', coalesce((select p.reglages from public.profils p where p.id = auth.uid()), '{}'));
end $$;

-- Enregistrer les réglages de l'entreprise (son administrateur seulement).
-- Si le code APE ou les situations changent, le registre le note.
create function public.espace_reglages(e uuid, nouveaux jsonb) returns void
language plpgsql set search_path = '' as $$
declare
  naf_choisi text := nullif(nouveaux->>'naf', '');
  ctx text[];
  avant_naf text;
  avant_ctx text[];
begin
  if prive.role_dans_entreprise(e) is distinct from 'admin' then
    raise exception 'Seul l''administrateur de l''entreprise peut changer ses réglages.' using errcode = '42501';
  end if;
  if jsonb_typeof(nouveaux) is distinct from 'object' then
    raise exception 'Réglages illisibles.';
  end if;
  if naf_choisi is not null and naf_choisi !~ '^[0-9]{2}([.][0-9]{2}[A-Z])?$' then
    raise exception 'Code APE invalide : %', naf_choisi;
  end if;
  select coalesce(array_agg(x order by x), '{}') into ctx
    from jsonb_array_elements_text(coalesce(nouveaux->'contexte', '[]')) x;
  select en.naf into avant_naf from public.entreprises en where en.id = e;
  select coalesce(array_agg(r.declencheur order by r.declencheur), '{}') into avant_ctx
    from public.reponses r where r.entreprise_id = e and r.valeur;

  update public.entreprises en set
    denomination = coalesce(nullif(btrim(nouveaux->>'nom'), ''), en.denomination),
    naf          = naf_choisi,
    effectif     = case when nouveaux->>'effectif' ~ '^[0-9]{1,7}$' then (nouveaux->>'effectif')::integer end,
    implantation = nullif(btrim(nouveaux->>'ville'), ''),
    reglages     = nouveaux - 'contexte' - 'resume'
  where en.id = e;

  insert into public.reponses (entreprise_id, declencheur, valeur)
    select e, x, true from unnest(ctx) x
    on conflict (entreprise_id, declencheur) do update set valeur = true, maj_le = now(), maj_par = auth.uid();
  update public.reponses r set valeur = false, maj_le = now(), maj_par = auth.uid()
    where r.entreprise_id = e and r.valeur and not (r.declencheur = any (ctx));

  if prive.peut_ecrire(e) and (avant_naf is distinct from naf_choisi or avant_ctx is distinct from ctx) then
    insert into public.registre (entreprise_id, genre, objet, detail)
    values (e, 'plan', 'Plan de veille mis à jour',
      left(coalesce(nullif(nouveaux->>'resume', ''),
        'Code APE ' || coalesce(naf_choisi, 'non renseigné') || ' ; situations : ' ||
        coalesce(nullif(array_to_string(ctx, ', '), ''), 'aucune') || '.'), 5000));
  end if;
end $$;

-- Cocher (fait = true) ou décocher une case « Fait ».
--   quoi    : la clé (plan:sst, jo:…)      intitule : ce qui s'inscrit au registre
--   sujet   : le domaine concerné, s'il y en a un
-- Rend la date inscrite (cocher) ou null (décocher).
create function public.espace_fait(e uuid, quoi text, intitule text, sujet text, fait boolean)
returns date language plpgsql set search_path = '' as $$
declare
  derniere public.registre;
  le date;
begin
  if not prive.peut_ecrire(e) then
    if prive.voit_entreprise(e) and prive.rang_entreprise(e) < 2 then
      raise exception 'La formule « Textes » ne tient pas de registre : il commence avec « Textes et suivi ».' using errcode = '42501';
    end if;
    raise exception 'Vous êtes en lecture seule dans cette entreprise.' using errcode = '42501';
  end if;
  if fait then
    insert into public.registre (entreprise_id, genre, sujet_id, objet, cle)
    values (e, 'revue', (select s.id from public.sujets s where s.id = sujet),
            left(coalesce(nullif(btrim(intitule), ''), quoi), 500), quoi)
    returning date_effet into le;
    return le;
  end if;
  select r.* into derniere from public.registre r
   where r.entreprise_id = e and r.genre = 'revue' and r.cle = quoi
     and not exists (select 1 from public.registre c where c.corrige_id = r.id)
   order by r.id desc limit 1;
  if found then
    insert into public.registre (entreprise_id, genre, sujet_id, objet, corrige_id, cle)
    values (e, 'correction', derniere.sujet_id, left('Annulé : ' || derniere.objet, 500), derniere.id, quoi);
  end if;
  return null;
end $$;

-- Les réglages d'alerte de la personne connectée.
create function public.espace_alertes(choix jsonb) returns void
language plpgsql set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Il faut être connecté.' using errcode = '42501'; end if;
  if jsonb_typeof(choix) is distinct from 'object' then raise exception 'Réglages illisibles.'; end if;
  insert into public.profils (id, reglages) values (auth.uid(), jsonb_build_object('alertes', choix))
  on conflict (id) do update set reglages = public.profils.reglages || jsonb_build_object('alertes', choix);
end $$;

revoke execute on function public.espace_lire(uuid), public.espace_reglages(uuid, jsonb),
  public.espace_fait(uuid, text, text, text, boolean), public.espace_alertes(jsonb) from public, anon;
grant execute on function public.espace_lire(uuid), public.espace_reglages(uuid, jsonb),
  public.espace_fait(uuid, text, text, text, boolean), public.espace_alertes(jsonb) to authenticated, service_role;
