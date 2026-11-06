-- ===========================================================================
-- Résilier soi-même un abonnement ouvert par nos soins (6 novembre 2026)
-- ---------------------------------------------------------------------------
-- Demande d'Axel : un abonnement « offert » (ouvert par l'administrateur du
-- service, sans Stripe) se résilie depuis Mon compte, automatiquement, sans
-- e-mail. Le responsable du compte de l'entreprise, ou du cabinet, le fait ;
-- l'abonnement s'arrête aussitôt (statut « canceled », fin à maintenant).
-- Un abonnement payé chez Stripe ne passe pas par ici : il se résilie dans le
-- portail client de Stripe, et le robot outils/stripe.mjs le relit.
-- ===========================================================================

create function public.resilier_offert(entreprise uuid, cabinet uuid) returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare n integer;
begin
  if num_nonnulls(entreprise, cabinet) <> 1 then
    raise exception 'Indiquez l''entreprise ou le cabinet.';
  end if;
  if (entreprise is not null and not prive.est_admin(entreprise))
     or (cabinet is not null and not coalesce(prive.admin_consultant(cabinet), false)) then
    raise exception 'Seul le responsable du compte peut résilier l''abonnement.' using errcode = '42501';
  end if;
  update public.abonnements a
     set statut = 'canceled', fin_periode = now(), resiliation_prevue = false, maj_le = now()
   where a.stripe_abonnement is null and a.statut = 'offert'
     and ((entreprise is not null and a.entreprise_id = entreprise) or (cabinet is not null and a.consultant_id = cabinet));
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'Aucun abonnement ouvert par nos soins à résilier.';
  end if;
  insert into prive.journal_admin (par, action, entreprise_id, detail)
    values (auth.uid(), 'abonnement_offert_resilie', entreprise, jsonb_build_object('cabinet', cabinet));
  return n;
end $$;

revoke all on function public.resilier_offert(uuid, uuid) from public, anon;
grant execute on function public.resilier_offert(uuid, uuid) to authenticated;
