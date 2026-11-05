-- ===========================================================================
-- Un consultant retire un client de sa liste (5 novembre 2026)
-- ---------------------------------------------------------------------------
-- Demande d'Axel : dans son compte, le consultant voit la liste de ses
-- clients et peut les supprimer. Deux cas, pour ne jamais effacer les
-- données de quelqu'un d'autre :
--   - le client n'a pas encore créé son compte (personne dans l'espace) :
--     l'espace, ouvert par le consultant et encore vide, est supprimé, avec
--     ses invitations ;
--   - le client a créé son compte : l'espace est à lui. Il est seulement
--     détaché du cabinet ; il garde son plan, son registre et ses comptes.
-- Seul le responsable du compte du cabinet peut le faire.
-- ===========================================================================

create function public.cabinet_retirer_client(c uuid, e uuid) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare comptes bigint;
begin
  if not prive.admin_consultant(c) then
    raise exception 'Seul le responsable du compte du cabinet retire un client.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.entreprises where id = e and consultant_id = c) then
    raise exception 'Ce client n''est pas suivi par votre cabinet.' using errcode = '42501';
  end if;
  select count(*) into comptes from public.membres_entreprise where entreprise_id = e;
  if comptes = 0 then
    delete from public.invitations where entreprise_id = e;
    perform prive.purger_entreprise(e);
    return 'supprime';
  end if;
  update public.entreprises set consultant_id = null, acces_consultant = false where id = e;
  return 'detache';
end $$;

revoke all on function public.cabinet_retirer_client(uuid, uuid) from public, anon, authenticated;
grant execute on function public.cabinet_retirer_client(uuid, uuid) to authenticated;
