-- ===========================================================================
-- L'équipe d'une entreprise : qui en fait partie, inviter, changer un rôle,
-- retirer quelqu'un, annuler une invitation
-- ---------------------------------------------------------------------------
-- L'invitation elle-même existe depuis le schéma initial (inviter,
-- accepter_invitation). Le site ne sait pas encore envoyer de courriel :
-- l'administrateur reçoit le lien et l'envoie lui-même.
-- La règle « au moins un admin » est tenue par le déclencheur
-- garder_un_admin, quelle que soit la façon de modifier.
-- ===========================================================================

-- Ce qu'on peut savoir d'une invitation quand on a son lien (même sans
-- compte) : pour quelle entreprise, pour quelle adresse, avec quel rôle.
create function public.invitation_infos(jeton text) returns json
language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'entreprise', coalesce(en.denomination, c.nom), 'courriel', i.courriel, 'role', i.role,
    'valide', i.acceptee_le is null and i.expire_le > now(), 'expire_le', i.expire_le)
  from public.invitations i
  left join public.entreprises en on en.id = i.entreprise_id
  left join public.consultants c on c.id = i.consultant_id
  where i.jeton_hash = encode(sha256(convert_to(jeton, 'UTF8')), 'hex')
$$;

-- Les personnes de l'entreprise (pour ses membres) ; les invitations en
-- attente (pour ses admins seulement).
create function public.espace_membres(e uuid) returns json
language plpgsql stable security definer set search_path = '' as $$
begin
  if prive.role_dans_entreprise(e) is null then
    raise exception 'Cette entreprise n''est pas la vôtre.' using errcode = '42501';
  end if;
  return json_build_object(
    'membres', coalesce((select json_agg(json_build_object(
        'id', m.user_id, 'courriel', u.email, 'role', m.role, 'depuis', m.depuis, 'moi', m.user_id = auth.uid())
        order by m.depuis)
      from public.membres_entreprise m join auth.users u on u.id = m.user_id where m.entreprise_id = e), '[]'),
    'invitations', case when prive.est_admin(e) then coalesce((select json_agg(json_build_object(
        'id', i.id, 'courriel', i.courriel, 'role', i.role, 'expire_le', i.expire_le) order by i.expire_le)
      from public.invitations i
      where i.entreprise_id = e and i.acceptee_le is null and i.expire_le > now()), '[]') else '[]'::json end);
end $$;

-- Changer le rôle de quelqu'un (admin de l'entreprise).
create function public.espace_role(e uuid, membre uuid, nouveau_role public.role_membre) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not prive.est_admin(e) then
    raise exception 'Seul l''administrateur de l''entreprise change les rôles.' using errcode = '42501';
  end if;
  update public.membres_entreprise set role = nouveau_role where entreprise_id = e and user_id = membre;
  if not found then raise exception 'Cette personne ne fait pas partie de l''entreprise.'; end if;
end $$;

-- Retirer quelqu'un (admin), ou partir soi-même.
create function public.espace_retirer(e uuid, membre uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (prive.est_admin(e) or membre = auth.uid()) then
    raise exception 'Seul l''administrateur de l''entreprise retire quelqu''un.' using errcode = '42501';
  end if;
  delete from public.membres_entreprise where entreprise_id = e and user_id = membre;
  if not found then raise exception 'Cette personne ne fait pas partie de l''entreprise.'; end if;
end $$;

-- Annuler une invitation pas encore acceptée (admin de l'entreprise).
create function public.annuler_invitation(invitation uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare e uuid;
begin
  select i.entreprise_id into e from public.invitations i where i.id = invitation and i.acceptee_le is null;
  if e is null or not prive.est_admin(e) then
    raise exception 'Invitation introuvable.' using errcode = '42501';
  end if;
  delete from public.invitations where id = invitation;
end $$;

revoke execute on function public.invitation_infos(text), public.espace_membres(uuid),
  public.espace_role(uuid, uuid, public.role_membre), public.espace_retirer(uuid, uuid),
  public.annuler_invitation(uuid) from public, anon;
grant execute on function public.invitation_infos(text) to anon, authenticated, service_role;
grant execute on function public.espace_membres(uuid), public.espace_role(uuid, uuid, public.role_membre),
  public.espace_retirer(uuid, uuid), public.annuler_invitation(uuid) to authenticated, service_role;

-- La purge lève les protections (registre immuable, « au moins un admin »)
-- pour sa propre opération : elle les remet dès qu'elle a fini, au lieu de
-- les laisser levées jusqu'à la fin de la transaction.
create or replace function prive.purger_entreprise(e uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare n bigint; d text;
begin
  select denomination into d from public.entreprises where id = e;
  select count(*) into n from public.registre where entreprise_id = e;
  perform set_config('vigie.purge', 'oui', true);
  delete from public.registre where entreprise_id = e;
  delete from public.entreprises where id = e;
  perform set_config('vigie.purge', '', true);
  insert into prive.purges (entreprise_id, denomination, entrees_registre) values (e, d, n);
end $$;
