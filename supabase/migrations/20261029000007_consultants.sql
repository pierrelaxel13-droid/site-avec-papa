-- ===========================================================================
-- Lot 7 — l'espace des consultants
-- ---------------------------------------------------------------------------
-- Un cabinet (public.consultants) a ses membres, ses clients (entreprises
-- dont consultant_id est le cabinet) et un abonnement « consultant ». Tant
-- qu'il est actif, ses clients ont la formule complète (prive.rang_entreprise).
-- Le consultant voit et travaille chez un client tant que celui-ci l'y
-- autorise (acces_consultant) ; il ne voit jamais les autres entreprises.
-- ===========================================================================

-- Tous les espaces où la personne connectée peut entrer : ceux dont elle est
-- membre, et ceux de ses clients si elle est consultant (role = 'consultant').
create function public.mes_acces()
returns table (entreprise_id uuid, denomination text, role text, rang integer, cabinet text)
language sql stable security definer set search_path = '' as $$
  select e.id, e.denomination, m.role::text, prive.rang_entreprise(e.id), null::text
  from public.membres_entreprise m join public.entreprises e on e.id = m.entreprise_id
  where m.user_id = auth.uid() and e.active
  union all
  select e.id, e.denomination, 'consultant', prive.rang_entreprise(e.id), c.nom
  from public.membres_consultant mc
  join public.consultants c on c.id = mc.consultant_id
  join public.entreprises e on e.consultant_id = mc.consultant_id
  where mc.user_id = auth.uid() and e.active and e.acces_consultant
    and not exists (select 1 from public.membres_entreprise m where m.entreprise_id = e.id and m.user_id = auth.uid())
$$;

-- Les cabinets de la personne connectée, et si leur abonnement est actif.
create function public.mes_cabinets()
returns table (cabinet_id uuid, nom text, role public.role_membre, actif boolean, marque_blanche boolean)
language sql stable security definer set search_path = '' as $$
  select c.id, c.nom, mc.role,
         exists (select 1 from public.abonnements a where a.consultant_id = c.id
                 and a.statut in ('active', 'trialing', 'past_due', 'offert')),
         c.marque_blanche
  from public.membres_consultant mc join public.consultants c on c.id = mc.consultant_id
  where mc.user_id = auth.uid()
  order by mc.depuis
$$;

-- Le tableau du cabinet : ses clients, et pour ceux qui l'autorisent, où ils
-- en sont (actions ouvertes, en retard, dernière trace). Rien du contenu des
-- registres : des nombres et une date.
create function public.cabinet_vue(c uuid) returns json
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
        'derniere_trace', case when e.acces_consultant then (select max(r.enregistre_le) from public.registre r where r.entreprise_id = e.id) end)
        order by e.denomination)
      from public.entreprises e where e.consultant_id = c and e.active), '[]'));
end $$;

-- Les réglages d'une entreprise : son administrateur, ou son consultant
-- autorisé (c'est souvent lui qui installe le plan). Mêmes effets qu'avant.
create or replace function public.espace_reglages(e uuid, nouveaux jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  naf_choisi text := nullif(nouveaux->>'naf', '');
  ctx text[];
  avant_naf text;
  avant_ctx text[];
begin
  if not (prive.role_dans_entreprise(e) = 'admin' or prive.consultant_ecrit(e)) then
    raise exception 'Seul l''administrateur de l''entreprise, ou son consultant, peut changer ses réglages.' using errcode = '42501';
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

-- L'entreprise et son consultant : qui c'est, et couper ou rouvrir son accès
-- (l'administrateur de l'entreprise seulement). L'accès coupé, le consultant
-- ne voit plus rien ; le registre garde ce qu'il a fait.
create function public.mon_consultant(e uuid) returns json
language sql stable security definer set search_path = '' as $$
  select case when prive.est_membre(e) then (
    select json_build_object('nom', c.nom, 'acces', en.acces_consultant)
    from public.entreprises en join public.consultants c on c.id = en.consultant_id where en.id = e) end
$$;
create function public.espace_acces_consultant(e uuid, acces boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not prive.est_admin(e) then
    raise exception 'Seul l''administrateur de l''entreprise décide de l''accès de son consultant.' using errcode = '42501';
  end if;
  update public.entreprises set acces_consultant = acces where id = e and consultant_id is not null;
  if not found then raise exception 'Cette entreprise n''a pas de consultant.'; end if;
end $$;

-- L'administration : les cabinets aussi, et leur ouvrir ou fermer l'abonnement.
create or replace function public.admin_vue() returns json
language plpgsql stable security definer set search_path = '' as $$
begin
  if not prive.est_administrateur() then
    raise exception 'Réservé à l''administrateur du service.' using errcode = '42501';
  end if;
  return json_build_object(
    'entreprises', coalesce((select json_agg(x order by x.cree_le desc) from (
      select e.id, e.denomination, e.naf, e.cree_le, e.active,
             c.nom as consultant,
             prive.rang_entreprise(e.id) as rang,
             (select json_agg(json_build_object(
                       'formule', a.formule, 'periode', a.periode, 'statut', a.statut,
                       'fin_periode', a.fin_periode, 'stripe', a.stripe_abonnement is not null)
                     order by a.maj_le desc)
                from public.abonnements a where a.entreprise_id = e.id) as abonnements,
             (select json_agg(json_build_object(
                       'courriel', u.email, 'role', m.role, 'depuis', m.depuis,
                       'confirme', u.email_confirmed_at is not null, 'derniere_connexion', u.last_sign_in_at)
                     order by m.depuis)
                from public.membres_entreprise m join auth.users u on u.id = m.user_id
               where m.entreprise_id = e.id) as membres
        from public.entreprises e
        left join public.consultants c on c.id = e.consultant_id) x), '[]'),
    'cabinets', coalesce((select json_agg(x order by x.cree_le desc) from (
      select c.id, c.nom, c.cree_le, c.marque_blanche,
             (select count(*) from public.entreprises e where e.consultant_id = c.id and e.active) as clients,
             (select json_agg(json_build_object('statut', a.statut, 'stripe', a.stripe_abonnement is not null))
                from public.abonnements a where a.consultant_id = c.id) as abonnements,
             (select json_agg(json_build_object('courriel', u.email, 'role', m.role, 'confirme', u.email_confirmed_at is not null) order by m.depuis)
                from public.membres_consultant m join auth.users u on u.id = m.user_id where m.consultant_id = c.id) as membres
        from public.consultants c) x), '[]'),
    'sans_entreprise', coalesce((select json_agg(json_build_object(
                       'courriel', u.email, 'inscrit_le', u.created_at,
                       'confirme', u.email_confirmed_at is not null) order by u.created_at desc)
        from auth.users u
       where not exists (select 1 from public.membres_entreprise m where m.user_id = u.id)
         and not exists (select 1 from public.membres_consultant m where m.user_id = u.id)), '[]'));
end $$;

create function public.admin_abonnement_cabinet(cabinet uuid, ouvrir boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not prive.est_administrateur() then
    raise exception 'Réservé à l''administrateur du service.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.consultants c where c.id = cabinet) then raise exception 'Cabinet inconnu.'; end if;
  delete from public.abonnements a where a.consultant_id = cabinet and a.stripe_abonnement is null;
  if ouvrir then
    insert into public.abonnements (consultant_id, formule, periode, statut) values (cabinet, 'consultant', 'mois', 'offert');
  end if;
  insert into prive.journal_admin (par, action, entreprise_id, detail)
  values (auth.uid(), 'abonnement cabinet', null, jsonb_build_object('cabinet', cabinet, 'ouvert', ouvrir));
end $$;

revoke execute on function public.mes_acces(), public.mes_cabinets(), public.cabinet_vue(uuid),
  public.mon_consultant(uuid), public.espace_acces_consultant(uuid, boolean),
  public.admin_abonnement_cabinet(uuid, boolean) from public, anon;
grant execute on function public.mes_acces(), public.mes_cabinets(), public.cabinet_vue(uuid),
  public.mon_consultant(uuid), public.espace_acces_consultant(uuid, boolean),
  public.admin_abonnement_cabinet(uuid, boolean) to authenticated, service_role;
