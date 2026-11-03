-- ===========================================================================
-- L'espace consultant : un tableau de bord de tous ses clients (3 novembre 2026)
-- ---------------------------------------------------------------------------
-- Pour chaque client, le consultant voit trois chiffres : les textes non lus,
-- le pourcentage de conformité réglementaire et l'avancement du plan
-- d'actions. La base lui donne de quoi les calculer, et rien de plus :
--   - contexte : les cases « vrai chez nous » (avec le code APE, elles font le
--     plan de veille, donc la liste des textes) ;
--   - lus : les textes ouverts par AU MOINS UNE personne de l'entreprise
--     (l'union, sans dire qui a lu quoi) ;
--   - conformes : les textes dont la dernière évaluation est « conforme » ;
--   - actions_faites : les actions validées.
-- Comme avant, un client qui a coupé l'accès ne donne aucun chiffre.
-- ===========================================================================
create or replace function public.cabinet_vue(c uuid) returns json
language plpgsql stable security definer set search_path = '' as $$
begin
  if not prive.membre_consultant(c) then
    raise exception 'Ce cabinet n''est pas le vôtre.' using errcode = '42501';
  end if;
  return json_build_object(
    'cabinet', (select json_build_object('id', co.id, 'nom', co.nom, 'marque_blanche', co.marque_blanche,
        'actif', exists (select 1 from public.abonnements a where a.consultant_id = co.id
                         and a.statut in ('active', 'trialing', 'past_due', 'offert')))
      from public.consultants co where co.id = c),
    'clients', coalesce((select json_agg(json_build_object(
        'id', e.id, 'denomination', e.denomination, 'naf', e.naf, 'cree_le', e.cree_le,
        'acces', e.acces_consultant, 'rang', prive.rang_entreprise(e.id),
        'membres', (select count(*) from public.membres_entreprise m where m.entreprise_id = e.id),
        'actions_ouvertes', case when e.acces_consultant then (select count(*) from public.registre r
            where r.entreprise_id = e.id and r.genre = 'action' and r.statut = 'ouverte'
              and not exists (select 1 from public.registre x where x.corrige_id = r.id)
              and not exists (select 1 from public.registre f where f.entreprise_id = e.id and f.cle = 'action:' || r.id)) end,
        'actions_en_retard', case when e.acces_consultant then (select count(*) from public.registre r
            where r.entreprise_id = e.id and r.genre = 'action' and r.statut = 'ouverte' and r.echeance < current_date
              and not exists (select 1 from public.registre x where x.corrige_id = r.id)
              and not exists (select 1 from public.registre f where f.entreprise_id = e.id and f.cle = 'action:' || r.id)) end,
        'actions_faites', case when e.acces_consultant then (select count(*) from public.registre r
            where r.entreprise_id = e.id and r.genre = 'action' and r.statut = 'ouverte'
              and not exists (select 1 from public.registre x where x.corrige_id = r.id)
              and exists (select 1 from public.registre f where f.entreprise_id = e.id and f.cle = 'action:' || r.id)) end,
        'derniere_trace', case when e.acces_consultant then (select max(r.enregistre_le) from public.registre r where r.entreprise_id = e.id) end,
        'contexte', case when e.acces_consultant then coalesce((select json_agg(r.declencheur order by r.declencheur)
            from public.reponses r where r.entreprise_id = e.id and r.valeur), '[]') end,
        'lus', case when e.acces_consultant then coalesce((select json_agg(distinct x.k)
            from public.membres_entreprise m
            join public.profils p on p.id = m.user_id
            cross join lateral jsonb_array_elements_text(
              case when jsonb_typeof(p.reglages -> 'lus' -> 'ids') = 'array' then p.reglages -> 'lus' -> 'ids' else '[]'::jsonb end) x(k)
            where m.entreprise_id = e.id), '[]') end,
        'conformes', case when e.acces_consultant then coalesce((select json_agg(x.cle) from (
            select distinct on (r.cle) r.cle, r.statut from public.registre r
            where r.entreprise_id = e.id and r.genre = 'conformite' and r.cle is not null
              and not exists (select 1 from public.registre k where k.corrige_id = r.id)
            order by r.cle, r.id desc) x where x.statut = 'conforme'), '[]') end)
        order by e.denomination)
      from public.entreprises e where e.consultant_id = c and e.active), '[]'));
end $$;
