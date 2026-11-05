-- ===========================================================================
-- Mon compte : l'abonnement, ses dates, et les factures (5 novembre 2026)
-- ---------------------------------------------------------------------------
-- Demande d'Axel : dans Mon compte, au-dessus du mot de passe, le type
-- d'abonnement souscrit, la date de fin, la date du prochain prélèvement et
-- les factures, que l'administrateur dépose et que le client télécharge.
--
-- Les dates viennent de Stripe (outils/stripe.mjs, recopié toutes les 15
-- minutes) : fin de la période en cours (current_period_end) et résiliation
-- demandée (cancel_at_period_end). Rien n'est calculé ni deviné ici.
--
-- Les factures sont des PDF déposés par l'administrateur (compte/admin.html).
-- Elles sont rangées dans prive.factures, que personne ne lit directement :
-- seules les fonctions ci-dessous les rendent, et seulement aux
-- administrateurs de l'entreprise ou du cabinet concerné (une facture n'est
-- pas l'affaire d'un simple membre), ou à l'administrateur du service.
-- ===========================================================================

alter table public.abonnements add column if not exists resiliation_prevue boolean not null default false;

create table prive.factures (
  id              uuid primary key default gen_random_uuid(),
  entreprise_id   uuid references public.entreprises (id) on delete cascade,
  consultant_id   uuid references public.consultants (id) on delete cascade,
  numero          text not null check (length(numero) between 1 and 60),
  emise_le        date not null,
  montant_ttc     numeric(10, 2) check (montant_ttc is null or montant_ttc >= 0),
  nom_fichier     text not null check (nom_fichier ~* '^[^/\\]{1,120}\.pdf$'),
  contenu         bytea not null check (octet_length(contenu) between 100 and 2097152),   -- 2 Mo au plus
  ajoutee_le      timestamptz not null default now(),
  ajoutee_par     uuid,
  check (num_nonnulls(entreprise_id, consultant_id) = 1)
);
alter table prive.factures enable row level security;   -- aucune règle : fonctions seulement
create index factures_entreprise on prive.factures (entreprise_id);
create index factures_consultant on prive.factures (consultant_id);

-- L'abonnement d'un espace, tel que Mon compte le montre.
create function prive.abonnement_json(e uuid, c uuid) returns json
language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'formule', a.formule, 'periode', a.periode, 'statut', a.statut,
    'fin_periode', a.fin_periode, 'resiliation_prevue', a.resiliation_prevue,
    'offert', a.statut = 'offert' or a.stripe_abonnement is null)
  from public.abonnements a
  where (e is not null and a.entreprise_id = e) or (c is not null and a.consultant_id = c)
  order by (a.statut in ('active', 'trialing', 'past_due', 'offert')) desc,
           case a.formule when 'complet' then 3 when 'consultant' then 3 when 'suivi' then 2 when 'textes' then 1 else 0 end desc,
           a.maj_le desc
  limit 1
$$;

create function prive.factures_json(e uuid, c uuid) returns json
language sql stable security definer set search_path = '' as $$
  select coalesce(json_agg(json_build_object('id', f.id, 'numero', f.numero, 'emise_le', f.emise_le,
    'montant_ttc', f.montant_ttc, 'nom', f.nom_fichier) order by f.emise_le desc, f.ajoutee_le desc), '[]'::json)
  from prive.factures f
  where (e is not null and f.entreprise_id = e) or (c is not null and f.consultant_id = c)
$$;

-- Mes espaces, leur abonnement et — pour leurs administrateurs — leurs factures.
create function public.mon_abonnement() returns json
language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'entreprises', coalesce((select json_agg(json_build_object(
        'id', en.id, 'nom', en.denomination, 'role', m.role,
        'par_cabinet', en.consultant_id is not null and exists (select 1 from public.abonnements a
                         where a.consultant_id = en.consultant_id and a.statut in ('active', 'trialing', 'past_due', 'offert')),
        'abonnement', prive.abonnement_json(en.id, null),
        'factures', case when m.role = 'admin' then prive.factures_json(en.id, null) else null end))
      from public.membres_entreprise m join public.entreprises en on en.id = m.entreprise_id
      where m.user_id = auth.uid()), '[]'::json),
    'cabinets', coalesce((select json_agg(json_build_object(
        'id', c.id, 'nom', c.nom, 'role', mc.role,
        'abonnement', prive.abonnement_json(null, c.id),
        'factures', case when mc.role = 'admin' then prive.factures_json(null, c.id) else null end))
      from public.membres_consultant mc join public.consultants c on c.id = mc.consultant_id
      where mc.user_id = auth.uid()), '[]'::json))
$$;

-- Télécharger une facture : le PDF, en base64.
create function public.ma_facture(id uuid) returns json
language plpgsql stable security definer set search_path = '' as $$
declare f prive.factures;
begin
  select * into f from prive.factures x where x.id = ma_facture.id;
  if f.id is null or not (prive.est_administrateur()
       or (f.entreprise_id is not null and prive.est_admin(f.entreprise_id))
       or (f.consultant_id is not null and prive.admin_consultant(f.consultant_id))) then
    raise exception 'Facture introuvable.' using errcode = '42501';
  end if;
  return json_build_object('nom', f.nom_fichier, 'contenu', encode(f.contenu, 'base64'));
end $$;

-- L'administrateur du service : déposer, lister, retirer.
create function public.admin_ajouter_facture(entreprise uuid, cabinet uuid, numero text, emise_le date,
                                             montant_ttc numeric, nom_fichier text, contenu text) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare octets bytea; nouvel uuid;
begin
  if not prive.est_administrateur() then
    raise exception 'Réservé à l''administrateur du service.' using errcode = '42501';
  end if;
  octets := decode(contenu, 'base64');
  if substring(octets from 1 for 5) <> '\x255044462d'::bytea then   -- « %PDF- »
    raise exception 'Le fichier n''est pas un PDF.';
  end if;
  insert into prive.factures (entreprise_id, consultant_id, numero, emise_le, montant_ttc, nom_fichier, contenu, ajoutee_par)
    values (entreprise, cabinet, trim(numero), emise_le, montant_ttc, trim(nom_fichier), octets, auth.uid())
    returning id into nouvel;
  insert into prive.journal_admin (par, action, entreprise_id, detail)
    values (auth.uid(), 'facture_ajoutee', entreprise, jsonb_build_object('facture', nouvel, 'cabinet', cabinet, 'numero', trim(numero)));
  return nouvel;
end $$;

create function public.admin_factures(entreprise uuid, cabinet uuid) returns json
language plpgsql stable security definer set search_path = '' as $$
begin
  if not prive.est_administrateur() then
    raise exception 'Réservé à l''administrateur du service.' using errcode = '42501';
  end if;
  return prive.factures_json(entreprise, cabinet);
end $$;

create function public.admin_supprimer_facture(id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare f prive.factures;
begin
  if not prive.est_administrateur() then
    raise exception 'Réservé à l''administrateur du service.' using errcode = '42501';
  end if;
  delete from prive.factures x where x.id = admin_supprimer_facture.id returning * into f;
  if f.id is not null then
    insert into prive.journal_admin (par, action, entreprise_id, detail)
      values (auth.uid(), 'facture_retiree', f.entreprise_id, jsonb_build_object('cabinet', f.consultant_id, 'numero', f.numero));
  end if;
end $$;

-- Les droits : rien pour les visiteurs ; les comptes connectés, par les fonctions seulement.
revoke all on function prive.abonnement_json(uuid, uuid), prive.factures_json(uuid, uuid) from public, anon, authenticated;
revoke all on function public.mon_abonnement(), public.ma_facture(uuid),
  public.admin_ajouter_facture(uuid, uuid, text, date, numeric, text, text),
  public.admin_factures(uuid, uuid), public.admin_supprimer_facture(uuid) from public, anon, authenticated;
grant execute on function public.mon_abonnement(), public.ma_facture(uuid),
  public.admin_ajouter_facture(uuid, uuid, text, date, numeric, text, text),
  public.admin_factures(uuid, uuid), public.admin_supprimer_facture(uuid) to authenticated;
