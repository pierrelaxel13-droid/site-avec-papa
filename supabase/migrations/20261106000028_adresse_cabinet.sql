-- ===========================================================================
-- L'adresse du cabinet consultant (6 novembre 2026)
-- ---------------------------------------------------------------------------
-- Demande d'Axel : l'adresse est obligatoire, avec le pays, pour les comptes
-- clients comme consultants. Elle sert aux factures et, ensuite, au calcul
-- de la TVA dès l'ouverture de la page de paiement Stripe.
-- Pour une entreprise, elle est rangée dans entreprises.reglages (« adresse »),
-- avec ses autres réglages. Pour un cabinet, la voici : une colonne et deux
-- fonctions (lire : les membres du cabinet ; écrire : son responsable).
-- Forme : { ligne, cp, ville, pays }, pays en code ISO à deux lettres (FR…).
-- ===========================================================================

alter table public.consultants add column if not exists adresse jsonb
  check (adresse is null or (jsonb_typeof(adresse) = 'object' and length(adresse::text) <= 1000));

create function prive.adresse_valable(a jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select a is not null
     and length(btrim(coalesce(a->>'ligne', ''))) between 3 and 200
     and length(btrim(coalesce(a->>'cp', ''))) between 2 and 12
     and length(btrim(coalesce(a->>'ville', ''))) between 1 and 120
     and coalesce(a->>'pays', '') ~ '^[A-Z]{2}$'
$$;

create function public.cabinet_adresse_lire(c uuid) returns json
language plpgsql stable security definer set search_path = '' as $$
begin
  if not prive.membre_consultant(c) then
    raise exception 'Ce cabinet n''est pas le vôtre.' using errcode = '42501';
  end if;
  return (select coalesce(co.adresse, '{}'::jsonb)::json from public.consultants co where co.id = c);
end $$;

create function public.cabinet_adresse(c uuid, adresse jsonb) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not coalesce(prive.admin_consultant(c), false) then
    raise exception 'Seul le responsable du compte du cabinet change son adresse.' using errcode = '42501';
  end if;
  if not prive.adresse_valable(cabinet_adresse.adresse) then
    raise exception 'Adresse obligatoire : indiquez l''adresse, le code postal, la ville et le pays.';
  end if;
  update public.consultants co set adresse = jsonb_build_object(
      'ligne', btrim(cabinet_adresse.adresse->>'ligne'), 'cp', btrim(cabinet_adresse.adresse->>'cp'),
      'ville', btrim(cabinet_adresse.adresse->>'ville'), 'pays', cabinet_adresse.adresse->>'pays')
   where co.id = c;
end $$;

-- L'adresse d'une entreprise, depuis Mon compte : les Réglages ne s'ouvrent qu'avec
-- l'abonnement, or l'adresse est demandée AVANT de payer. Seul l'adresse change
-- dans entreprises.reglages ; le reste des réglages est gardé.
create function public.entreprise_adresse(e uuid, adresse jsonb) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not prive.est_admin(e) then
    raise exception 'Seul le responsable du compte de l''entreprise change son adresse.' using errcode = '42501';
  end if;
  if not prive.adresse_valable(entreprise_adresse.adresse) then
    raise exception 'Adresse obligatoire : indiquez l''adresse, le code postal, la ville et le pays.';
  end if;
  update public.entreprises en
     set reglages = en.reglages || jsonb_build_object('adresse', jsonb_build_object(
           'ligne', btrim(entreprise_adresse.adresse->>'ligne'), 'cp', btrim(entreprise_adresse.adresse->>'cp'),
           'ville', btrim(entreprise_adresse.adresse->>'ville'), 'pays', entreprise_adresse.adresse->>'pays')),
         implantation = btrim(entreprise_adresse.adresse->>'ville')
   where en.id = e;
end $$;
revoke all on function public.entreprise_adresse(uuid, jsonb) from public, anon;
grant execute on function public.entreprise_adresse(uuid, jsonb) to authenticated;

revoke all on function prive.adresse_valable(jsonb) from public, anon;
revoke all on function public.cabinet_adresse_lire(uuid), public.cabinet_adresse(uuid, jsonb) from public, anon;
grant execute on function public.cabinet_adresse_lire(uuid), public.cabinet_adresse(uuid, jsonb) to authenticated;
