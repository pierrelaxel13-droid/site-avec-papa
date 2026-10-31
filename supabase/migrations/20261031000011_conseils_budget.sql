-- ===========================================================================
-- Les conseils de l'IA : ce qu'ils coûtent, pour un plafond par mois
-- ---------------------------------------------------------------------------
-- Chaque conseil garde ce que Perplexity a facturé pour le faire (en dollars,
-- usage.cost.total_cost). Le robot additionne le mois en cours et s'arrête au
-- plafond (CONSEILS_BUDGET_MOIS, 10 $ par défaut) jusqu'au mois suivant ;
-- l'administration affiche la dépense du mois.
-- Un conseil redemandé dans le même mois ajoute son coût au précédent, pour
-- que rien ne soit oublié dans le total.
-- ===========================================================================
alter table public.conseils add column cout numeric not null default 0 check (cout >= 0);

create or replace function public.admin_conseils() returns json
language plpgsql stable security definer set search_path = '' as $$
begin
  if not prive.est_administrateur() then
    raise exception 'Réservé à l''administrateur du service.' using errcode = '42501';
  end if;
  return json_build_object(
    'gardes', (select count(*) from public.conseils where texte is not null),
    'ecartes', (select count(*) from public.conseils where texte is null),
    'depense_mois', (select coalesce(round(sum(cout), 4), 0) from public.conseils where le >= date_trunc('month', now())),
    'a_revoir', coalesce((select json_agg(json_build_object(
        'texte_id', c.texte_id, 'metier', nullif(c.metier, ''), 'titre', c.titre, 'le', c.le,
        'ecarte', c.ecarte, 'details', c.details) order by c.le desc)
      from (select * from public.conseils where details ->> 'concerne' = 'non' order by le desc limit 50) c), '[]'));
end $$;
revoke execute on function public.admin_conseils() from public, anon;
grant execute on function public.admin_conseils() to authenticated, service_role;
