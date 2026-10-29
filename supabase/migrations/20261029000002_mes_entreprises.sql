-- ===========================================================================
-- Ce que le site demande à la connexion : « où suis-je membre, avec quel
-- rôle, et qu'est-ce que l'entreprise a payé ? »
-- ---------------------------------------------------------------------------
-- Le rang de la formule se calcule dans prive.rang_entreprise, que le site ne
-- peut pas appeler (le schéma prive n'est pas exposé). Cette fonction rend à
-- la personne connectée SES entreprises, et rien d'autre : elle ne prend
-- aucun paramètre, elle lit auth.uid().
--   rang : 0 pas d'abonnement actif, 1 Textes, 2 Textes et suivi, 3 Veille complète
-- ===========================================================================

create function public.mes_entreprises()
returns table (entreprise_id uuid, denomination text, role public.role_membre, rang integer)
language sql stable security definer set search_path = '' as $$
  select e.id, e.denomination, m.role, prive.rang_entreprise(e.id)
  from public.membres_entreprise m
  join public.entreprises e on e.id = m.entreprise_id
  where m.user_id = auth.uid() and e.active
  order by m.depuis, e.denomination
$$;

-- Supabase donne d'office l'exécution des nouvelles fonctions à tout le monde.
revoke execute on function public.mes_entreprises() from public, anon;
grant execute on function public.mes_entreprises() to authenticated, service_role;
