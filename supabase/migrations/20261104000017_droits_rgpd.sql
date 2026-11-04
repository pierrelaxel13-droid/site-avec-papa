-- ===========================================================================
-- RGPD : chacun exerce ses droits lui-même, depuis « Mon compte » (4 novembre 2026)
-- ---------------------------------------------------------------------------
-- 1. mes_donnees() : le droit d'accès et de portabilité (art. 15 et 20).
--    Tout ce que la base garde sur la personne connectée, en JSON : son
--    compte, son profil (dont les textes lus), ses entreprises et cabinets
--    avec son rôle, les invitations qu'elle a envoyées, et les entrées de
--    registre qu'elle a écrites. Les registres eux-mêmes appartiennent à
--    l'entreprise (responsable du traitement) : ils s'exportent depuis
--    « Registre et conformité réglementaire ».
-- 2. supprimer_mon_compte() : le droit à l'effacement (art. 17).
--    Le compte, le profil et les rattachements sont supprimés. Refusé si la
--    personne est le seul administrateur d'une entreprise ou d'un cabinet où
--    d'autres travaillent : il faut d'abord nommer un autre administrateur,
--    sinon ils ne pourraient plus rien gérer. Les entrées de registre déjà
--    écrites restent, avec le nom de leur auteur : le registre est la preuve
--    datée de l'entreprise, qui en est responsable (art. 17.3.b et e).
--    Une entreprise dont la personne était seule reste sans membre : ses
--    données partent avec la purge de fin de conservation.
-- ===========================================================================
create function public.mes_donnees() returns json
language plpgsql stable security definer set search_path = '' as $$
declare moi uuid := auth.uid();
begin
  if moi is null then raise exception 'Il faut être connecté.' using errcode = '42501'; end if;
  return json_build_object(
    'export_le', now(),
    'compte', (select json_build_object('id', u.id, 'courriel', u.email, 'inscrit_le', u.created_at,
                 'derniere_connexion', u.last_sign_in_at) from auth.users u where u.id = moi),
    'profil', (select json_build_object('nom', p.nom, 'reglages', p.reglages) from public.profils p where p.id = moi),
    'entreprises', coalesce((select json_agg(json_build_object('entreprise', e.denomination, 'code_ape', e.naf,
                 'role', m.role, 'depuis', m.depuis) order by e.denomination)
               from public.membres_entreprise m join public.entreprises e on e.id = m.entreprise_id
               where m.user_id = moi), '[]'),
    'cabinets', coalesce((select json_agg(json_build_object('cabinet', c.nom, 'role', m.role, 'depuis', m.depuis))
               from public.membres_consultant m join public.consultants c on c.id = m.consultant_id
               where m.user_id = moi), '[]'),
    'invitations_envoyees', coalesce((select json_agg(json_build_object('a', i.courriel, 'role', i.role,
                 'expire_le', i.expire_le, 'acceptee_le', i.acceptee_le))
               from public.invitations i where i.cree_par = moi), '[]'),
    'registre_ecrit', coalesce((select json_agg(json_build_object('entreprise', e.denomination, 'genre', r.genre,
                 'objet', r.objet, 'detail', r.detail, 'statut', r.statut, 'date_effet', r.date_effet,
                 'echeance', r.echeance, 'enregistre_le', r.enregistre_le) order by r.id)
               from public.registre r join public.entreprises e on e.id = r.entreprise_id
               where r.auteur_id = moi), '[]'));
end $$;

create function public.supprimer_mon_compte() returns void
language plpgsql security definer set search_path = '' as $$
declare moi uuid := auth.uid(); bloque text;
begin
  if moi is null then raise exception 'Il faut être connecté.' using errcode = '42501'; end if;
  select e.denomination into bloque
    from public.membres_entreprise m join public.entreprises e on e.id = m.entreprise_id
    where m.user_id = moi and m.role = 'admin'
      and not exists (select 1 from public.membres_entreprise a where a.entreprise_id = m.entreprise_id
                      and a.role = 'admin' and a.user_id <> moi)
      and exists (select 1 from public.membres_entreprise o where o.entreprise_id = m.entreprise_id and o.user_id <> moi)
    limit 1;
  if bloque is null then
    select c.nom into bloque
      from public.membres_consultant m join public.consultants c on c.id = m.consultant_id
      where m.user_id = moi and m.role = 'admin'
        and not exists (select 1 from public.membres_consultant a where a.consultant_id = m.consultant_id
                        and a.role = 'admin' and a.user_id <> moi)
        and exists (select 1 from public.membres_consultant o where o.consultant_id = m.consultant_id and o.user_id <> moi)
      limit 1;
  end if;
  if bloque is not null then
    raise exception 'Vous êtes le seul administrateur de « % », où d''autres personnes travaillent : nommez d''abord un autre administrateur.', bloque
      using errcode = '42501';
  end if;
  -- Personne d'autre ne travaille dans ses entreprises (vérifié ci-dessus) : le
  -- garde-fou « au moins un admin » (prive.garder_un_admin) n'a rien à
  -- protéger ; on le lève pour cette seule transaction, comme la purge.
  perform set_config('vigie.purge', 'oui', true);
  delete from auth.users where id = moi;   -- profil et rattachements suivent (on delete cascade)
  perform set_config('vigie.purge', '', true);
end $$;

revoke execute on function public.mes_donnees(), public.supprimer_mon_compte() from public, anon;
grant execute on function public.mes_donnees(), public.supprimer_mon_compte() to authenticated, service_role;
