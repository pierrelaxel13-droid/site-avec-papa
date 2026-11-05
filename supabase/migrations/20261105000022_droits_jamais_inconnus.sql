-- ===========================================================================
-- Faille corrigée : un droit « inconnu » ne vaut jamais « oui » (5 novembre 2026)
-- ---------------------------------------------------------------------------
-- prive.est_admin(e) et prive.peut_ecrire(e) rendaient NULL (et non « non »)
-- pour un compte qui n'est pas membre de l'entreprise : role = 'admin' sur
-- un rôle absent vaut NULL. Dans une règle de ligne (RLS), NULL refuse ; mais
-- dans une fonction, « if not prive.est_admin(e) then refuser » ne refuse PAS
-- quand la valeur est NULL. Un compte connecté qui connaissait l'identifiant
-- d'une autre entreprise pouvait ainsi s'y inviter comme administrateur
-- (inviter), retirer quelqu'un (espace_retirer), changer un rôle
-- (espace_role), couper l'accès du consultant ou le changer, et écrire dans
-- son registre (qualifier…). Trouvé en testant les factures (migration 21).
--
-- Correction à la racine : ces deux fonctions rendent toujours vrai ou faux.
-- Les tests d'isolation essaient chacune de ces portes depuis une autre
-- entreprise.
-- ===========================================================================

create or replace function prive.est_admin(e uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(prive.role_dans_entreprise(e) = 'admin', false)
$$;

create or replace function prive.peut_ecrire(e uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((prive.role_dans_entreprise(e) in ('admin', 'membre') or prive.consultant_ecrit(e))
     and prive.rang_entreprise(e) >= 2, false)
$$;
