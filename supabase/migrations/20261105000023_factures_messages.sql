-- ===========================================================================
-- Factures : des messages clairs au dépôt (5 novembre 2026)
-- ---------------------------------------------------------------------------
-- Un fichier vide, trop gros ou qui n'est pas un PDF était refusé par la
-- contrainte de la table, avec un message technique. On le dit en clair.
-- Et un même numéro ne se dépose pas deux fois pour le même client.
-- ===========================================================================
create or replace function public.admin_ajouter_facture(entreprise uuid, cabinet uuid, numero text, emise_le date,
                                                        montant_ttc numeric, nom_fichier text, contenu text) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare octets bytea; nouvel uuid;
begin
  if not prive.est_administrateur() then
    raise exception 'Réservé à l''administrateur du service.' using errcode = '42501';
  end if;
  if num_nonnulls(entreprise, cabinet) <> 1 then
    raise exception 'Une facture va à une entreprise ou à un cabinet.';
  end if;
  if coalesce(trim(numero), '') = '' then
    raise exception 'Indiquez le numéro de la facture.';
  end if;
  if exists (select 1 from prive.factures f where f.numero = trim(admin_ajouter_facture.numero)
             and (f.entreprise_id = admin_ajouter_facture.entreprise or f.consultant_id = admin_ajouter_facture.cabinet)) then
    raise exception 'Ce client a déjà une facture numéro %.', trim(admin_ajouter_facture.numero);
  end if;
  begin
    octets := decode(contenu, 'base64');
  exception when others then
    raise exception 'Le fichier n''a pas pu être lu.';
  end;
  if octets is null or octet_length(octets) < 100 or substring(octets from 1 for 5) <> '\x255044462d'::bytea then
    raise exception 'Le fichier n''est pas un PDF valable.';
  end if;
  if octet_length(octets) > 2097152 then
    raise exception 'Le fichier dépasse 2 Mo.';
  end if;
  if trim(nom_fichier) !~* '^[^/\\]{1,120}\.pdf$' then
    raise exception 'Le nom du fichier doit finir par .pdf (120 caractères au plus).';
  end if;
  insert into prive.factures (entreprise_id, consultant_id, numero, emise_le, montant_ttc, nom_fichier, contenu, ajoutee_par)
    values (entreprise, cabinet, trim(numero), emise_le, montant_ttc, trim(nom_fichier), octets, auth.uid())
    returning id into nouvel;
  insert into prive.journal_admin (par, action, entreprise_id, detail)
    values (auth.uid(), 'facture_ajoutee', entreprise, jsonb_build_object('facture', nouvel, 'cabinet', cabinet, 'numero', trim(numero)));
  return nouvel;
end $$;

revoke all on function public.admin_ajouter_facture(uuid, uuid, text, date, numeric, text, text) from public, anon, authenticated;
grant execute on function public.admin_ajouter_facture(uuid, uuid, text, date, numeric, text, text) to authenticated;
