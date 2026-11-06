-- ===========================================================================
-- Prévenir l'équipe à chaque nouveau compte (6 novembre 2026)
-- ---------------------------------------------------------------------------
-- Demande d'Axel : recevoir un e-mail sur l'adresse du site quand quelqu'un
-- ouvre un compte. Le compte « s'ouvre » quand l'espace prend son premier
-- membre : une entreprise nommée par son responsable, le client d'un
-- consultant qui accepte son invitation, ou un cabinet consultant créé.
-- Déclencheur « before insert » : dans un ajout de plusieurs membres d'un coup, seul le
-- premier voit l'espace encore vide (un « after insert » les voit tous).
-- Le destinataire est « equipe » : le robot (outils/courriels.mjs) l'envoie à
-- l'adresse d'expédition du site (RECAP_EXPEDITEUR), qui n'est pas écrite ici.
-- ===========================================================================

alter table prive.courriels drop constraint if exists courriels_genre_check;
alter table prive.courriels add constraint courriels_genre_check check (genre in ('invitation', 'facture', 'nouveau_compte'));

create function prive.courriel_nouveau_compte() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  qui text; nom text; quoi text; cabinet text;
begin
  select u.email into qui from auth.users u where u.id = new.user_id;
  if tg_table_name = 'membres_entreprise' then
    if exists (select 1 from public.membres_entreprise m where m.entreprise_id = new.entreprise_id and m.user_id <> new.user_id) then
      return new;   -- un collègue de plus, pas un nouveau compte
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

create trigger nouveau_compte_entreprise before insert on public.membres_entreprise
  for each row execute function prive.courriel_nouveau_compte();
create trigger nouveau_compte_cabinet before insert on public.membres_consultant
  for each row execute function prive.courriel_nouveau_compte();

revoke all on function prive.courriel_nouveau_compte() from public, anon, authenticated;
