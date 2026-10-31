-- ===========================================================================
-- Les conseils de l'IA (Perplexity) : rangés dans la base, réservés aux
-- formules « Textes et suivi » (2) et « Veille complète » (3)
-- ---------------------------------------------------------------------------
-- Avant : écrits en clair dans les pages du site — lisibles sans payer. Ici,
-- la table n'est ouverte à PERSONNE côté navigateur (ni règle, ni droit) : on
-- la lit par conseils_lire(), qui vérifie l'entreprise et sa formule.
--
--   metier = ''    le conseil général d'un texte : formules 2 et 3 ;
--   metier = '43'  le conseil pour une famille de métiers (division NAF) :
--                  formule 3, et seulement pour SA famille.
--
-- Le robot (outils/conseils.mjs, connexion du propriétaire) écrit la table, et
-- lit par prive.clients_conseils() qui en a besoin : rien n'est demandé à
-- Perplexity tant qu'aucun client payant n'est concerné.
-- ===========================================================================

create table public.conseils (
  texte_id  text not null check (length(texte_id) between 1 and 500),     -- l'identifiant du texte au relevé (parfois son adresse)
  metier    text not null default '' check (metier = '' or metier ~ '^[0-9]{2}$'),
  titre     text check (length(titre) <= 1000),        -- le titre du texte officiel (public), pour l'administration
  le        timestamptz not null default now(),
  modele    text check (length(modele) <= 100),
  texte     text check (length(texte) <= 3000),        -- null : réponse écartée
  sources   jsonb not null default '[]',
  details   jsonb not null default '{}',               -- { concerne, qui, quand }
  ecarte    text check (length(ecarte) <= 300),        -- pourquoi la réponse n'est pas montrée
  primary key (texte_id, metier),
  check ((texte is null) = (ecarte is not null))
);
alter table public.conseils enable row level security;
revoke all on public.conseils from public, anon, authenticated;

-- Ce qu'une page lit : les conseils des textes affichés, selon la formule.
--   rang 0 ou 1 : aucun ; rang 2 : les généraux ; rang 3 : + ceux de sa famille.
create function public.conseils_lire(e uuid, ids text[]) returns json
language plpgsql stable security definer set search_path = '' as $$
declare
  r integer;
  fam text;
begin
  if not prive.voit_entreprise(e) then
    raise exception 'Cette entreprise n''est pas la vôtre.' using errcode = '42501';
  end if;
  if coalesce(array_length(ids, 1), 0) > 500 then raise exception 'Trop de textes demandés.'; end if;
  r := prive.rang_entreprise(e);
  select left(regexp_replace(coalesce(en.naf, ''), '[^0-9]', '', 'g'), 2) into fam
    from public.entreprises en where en.id = e;
  return json_build_object(
    'rang', r,
    'metier', nullif(fam, ''),
    'conseils', coalesce((select json_agg(json_build_object(
        'texte_id', c.texte_id, 'metier', nullif(c.metier, ''), 'le', c.le, 'modele', c.modele,
        'texte', c.texte, 'sources', c.sources, 'details', c.details) order by c.texte_id, c.metier)
      from public.conseils c
      where c.texte_id = any (ids) and c.texte is not null
        and ((c.metier = '' and r >= 2) or (r >= 3 and c.metier = fam and fam <> ''))), '[]'));
end $$;
revoke execute on function public.conseils_lire(uuid, text[]) from public, anon;
grant execute on function public.conseils_lire(uuid, text[]) to authenticated, service_role;

-- Pour le robot : les entreprises qui PAIENT au moins « Textes et suivi », avec
-- de quoi calculer leur plan (division NAF, situations cochées). Ni nom, ni
-- adresse, ni identifiant. L'entreprise de l'administrateur ne compte pas
-- (son accès est ouvert sans payer) ; un abonnement « offert » compte : c'est
-- l'administrateur qui l'a donné à quelqu'un.
create function prive.clients_conseils()
returns table (division text, rang integer, contexte text[])
language sql stable security definer set search_path = '' as $$
  with payes as (
    select en.id, en.naf, greatest(
      coalesce((select max(case a.formule when 'textes' then 1 when 'suivi' then 2 when 'complet' then 3 else 0 end)
                from public.abonnements a
                where a.entreprise_id = en.id and a.statut in ('active', 'trialing', 'past_due', 'offert')), 0),
      coalesce((select 3 from public.abonnements a
                where en.consultant_id is not null and a.consultant_id = en.consultant_id
                  and a.statut in ('active', 'trialing', 'past_due', 'offert') limit 1), 0)) as rang
    from public.entreprises en
    where en.active and en.naf is not null)
  select left(p.naf, 2), p.rang,
         coalesce((select array_agg(r.declencheur order by r.declencheur)
                   from public.reponses r where r.entreprise_id = p.id and r.valeur), '{}')
  from payes p where p.rang >= 2
$$;
revoke execute on function prive.clients_conseils() from public, anon, authenticated;

-- L'administration : ce que l'IA a dit « à revoir » (le texte ne concernerait
-- pas le sujet où le robot l'a rangé) et ce qui a été écarté, pour Clément.
create function public.admin_conseils() returns json
language plpgsql stable security definer set search_path = '' as $$
begin
  if not prive.est_administrateur() then
    raise exception 'Réservé à l''administrateur du service.' using errcode = '42501';
  end if;
  return json_build_object(
    'gardes', (select count(*) from public.conseils where texte is not null),
    'ecartes', (select count(*) from public.conseils where texte is null),
    'a_revoir', coalesce((select json_agg(json_build_object(
        'texte_id', c.texte_id, 'metier', nullif(c.metier, ''), 'titre', c.titre, 'le', c.le,
        'ecarte', c.ecarte, 'details', c.details) order by c.le desc)
      from (select * from public.conseils where details ->> 'concerne' = 'non' order by le desc limit 50) c), '[]'));
end $$;
revoke execute on function public.admin_conseils() from public, anon;
grant execute on function public.admin_conseils() to authenticated, service_role;
