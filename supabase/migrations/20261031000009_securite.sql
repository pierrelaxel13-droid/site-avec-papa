-- ===========================================================================
-- Revue de sécurité du 31 octobre 2026
-- ---------------------------------------------------------------------------
-- 1. choisir_consultant : un admin d'entreprise pouvait rattacher son
--    entreprise à N'IMPORTE QUEL cabinet, sans son accord — et, si ce cabinet
--    était abonné, avoir la veille complète à ses frais. Désormais : se
--    détacher, toujours ; se rattacher, seulement à un cabinet dont on est
--    aussi l'administrateur (sinon c'est le cabinet qui crée ou invite).
-- 2. profils : la règle « collegues » laissait les collègues — et le
--    consultant — lire les réglages personnels d'un membre (adresse d'alerte,
--    textes ouverts). Le site ne s'en sert pas : retirée.
-- 3. collectes (le journal du robot) : lisible par tous avec la clé publique.
--    Réservé à l'administrateur du service.
-- ===========================================================================

create or replace function public.choisir_consultant(entreprise uuid, cabinet uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not prive.est_admin(entreprise) then raise exception 'Seul un admin de l''entreprise peut choisir son consultant.'; end if;
  if cabinet is not null and not prive.admin_consultant(cabinet) then
    raise exception 'Un cabinet se rattache une entreprise en créant son espace ou en l''invitant.' using errcode = '42501';
  end if;
  update public.entreprises set consultant_id = cabinet, acces_consultant = (cabinet is not null) where id = entreprise;
end $$;

drop policy if exists collegues on public.profils;

drop policy if exists lecture on public.collectes;
revoke select on public.collectes from anon;
create policy lecture on public.collectes for select to authenticated using (prive.est_administrateur());
