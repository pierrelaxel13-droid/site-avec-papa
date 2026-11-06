-- ===========================================================================
-- Pas d'e-mail « nouveau compte » pour les comptes du test automatique
-- (6 novembre 2026)
-- ---------------------------------------------------------------------------
-- Le test en ligne (outils/essai-en-ligne.mjs) crée à chaque publication une
-- entreprise et un cabinet d'essai (essai-auto-…@example.com) : ils ne doivent
-- pas remplir la boîte de l'équipe. La migration 29 est déjà appliquée en
-- ligne : la fonction est redéfinie ici.
-- ===========================================================================

create or replace function prive.courriel_nouveau_compte() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  qui text; nom text; quoi text; cabinet text;
begin
  select u.email into qui from auth.users u where u.id = new.user_id;
  if coalesce(qui, '') ~* '^essai-auto-.*@example\.com$' then return new; end if;
  if tg_table_name = 'membres_entreprise' then
    if exists (select 1 from public.membres_entreprise m where m.entreprise_id = new.entreprise_id and m.user_id <> new.user_id) then
      return new;
    end if;
    select e.denomination, c.nom into nom, cabinet
      from public.entreprises e left join public.consultants c on c.id = e.consultant_id where e.id = new.entreprise_id;
    quoi := case when cabinet is null then 'entreprise' else 'client de consultant' end;
  else
    if exists (select 1 from public.membres_consultant m where m.consultant_id = new.consultant_id and m.user_id <> new.user_id) then
      return new;
    end if;
    select c.nom into nom from public.consultants c where c.id = new.consultant_id;
    quoi := 'cabinet consultant';
  end if;
  insert into prive.courriels (genre, destinataire, donnees)
    values ('nouveau_compte', 'equipe', jsonb_build_object('courriel', qui, 'espace', nom, 'type', quoi, 'cabinet', cabinet, 'le', now()));
  return new;
end $$;
revoke all on function prive.courriel_nouveau_compte() from public, anon, authenticated;

-- Ceux déjà en file, venus des tests, ne partent pas.
update prive.courriels set envoye_le = now(), erreur = 'compte du test automatique : pas envoyé'
 where genre = 'nouveau_compte' and envoye_le is null and donnees ->> 'courriel' ~* '^essai-auto-.*@example\.com$';
