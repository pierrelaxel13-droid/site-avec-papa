-- ===========================================================================
-- Les e-mails automatiques du site (5 novembre 2026)
-- ---------------------------------------------------------------------------
-- Le site est statique : il ne peut pas envoyer d'e-mail lui-même. La base
-- met chaque e-mail à envoyer dans une file (prive.courriels) ; le robot
-- outils/courriels.mjs (.github/workflows/courriels.yml, toutes les 10
-- minutes) les envoie par Brevo et les marque envoyés.
--   - « invitation » : posée par public.inviter (client d'un consultant,
--     collègue invité, membre d'un cabinet). Le lien contient le jeton en
--     clair : il ne reste dans la file que le temps de l'envoi, puis il est
--     effacé (la base n'en garde que l'empreinte, comme avant).
--   - « facture » : posée au dépôt d'une facture, pour chaque responsable du
--     compte de l'entreprise ou du cabinet.
-- Personne ne lit la file depuis le site : ni règle de ligne, ni fonction
-- publique. Seul le robot (connexion de service) y accède.
-- ===========================================================================

create table prive.courriels (
  id           bigint generated always as identity primary key,
  cree_le      timestamptz not null default now(),
  genre        text not null check (genre in ('invitation', 'facture')),
  destinataire text not null,
  donnees      jsonb not null default '{}',
  essais       integer not null default 0,
  envoye_le    timestamptz,
  erreur       text
);
alter table prive.courriels enable row level security;
create index courriels_a_envoyer on prive.courriels (cree_le) where envoye_le is null;

-- L'invitation : la même qu'avant, et son e-mail mis en file.
create or replace function public.inviter(courriel text, role public.role_membre default 'membre',
                                          entreprise uuid default null, cabinet uuid default null)
returns text language plpgsql security definer set search_path = '' as $$
declare jeton text := encode(gen_random_uuid()::text::bytea, 'hex') || encode(gen_random_uuid()::text::bytea, 'hex');
        nom text; cab text;
begin
  if num_nonnulls(entreprise, cabinet) <> 1 then raise exception 'Une invitation vise une entreprise OU un cabinet.'; end if;
  if entreprise is not null and not (prive.est_admin(entreprise)
       or (prive.consultant_ecrit(entreprise) and not exists (select 1 from public.membres_entreprise m where m.entreprise_id = entreprise))) then
    raise exception 'Seul le responsable du compte de l''entreprise peut inviter.';
  end if;
  if cabinet is not null and not prive.admin_consultant(cabinet) then
    raise exception 'Seul le responsable du compte du cabinet peut inviter.';
  end if;
  insert into public.invitations (entreprise_id, consultant_id, courriel, role, jeton_hash)
    values (entreprise, cabinet, lower(courriel), role, encode(sha256(convert_to(jeton, 'UTF8')), 'hex'));
  if entreprise is not null then
    select e.denomination, c.nom into nom, cab from public.entreprises e left join public.consultants c on c.id = e.consultant_id
      where e.id = entreprise;
  else
    select c.nom into nom from public.consultants c where c.id = cabinet;
  end if;
  insert into prive.courriels (genre, destinataire, donnees) values ('invitation', lower(courriel), jsonb_build_object(
    'jeton', jeton, 'espace', nom, 'cabinet', case when entreprise is not null then cab end,
    'type', case when entreprise is not null then 'entreprise' else 'cabinet' end,
    'role', role, 'par', coalesce(auth.email(), '')));
  return jeton;
end $$;
revoke all on function public.inviter(text, public.role_membre, uuid, uuid) from public, anon;
grant execute on function public.inviter(text, public.role_membre, uuid, uuid) to authenticated;

-- Une facture déposée : un e-mail à chaque responsable du compte.
create function prive.courriel_facture() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into prive.courriels (genre, destinataire, donnees)
  select 'facture', lower(u.email), jsonb_build_object('numero', new.numero, 'emise_le', new.emise_le,
           'montant_ttc', new.montant_ttc, 'espace', coalesce(e.denomination, c.nom))
  from auth.users u
  left join public.entreprises e on e.id = new.entreprise_id
  left join public.consultants c on c.id = new.consultant_id
  where u.email is not null and (
    (new.entreprise_id is not null and exists (select 1 from public.membres_entreprise m
       where m.entreprise_id = new.entreprise_id and m.user_id = u.id and m.role = 'admin'))
    or (new.consultant_id is not null and exists (select 1 from public.membres_consultant m
       where m.consultant_id = new.consultant_id and m.user_id = u.id and m.role = 'admin')));
  return new;
end $$;
create trigger factures_courriel after insert on prive.factures for each row execute function prive.courriel_facture();

-- Pour le robot : ce qui attend, et le compte rendu de chaque envoi.
create function prive.courriels_a_envoyer() returns json
language sql stable security definer set search_path = '' as $$
  select coalesce(json_agg(json_build_object('id', id, 'genre', genre, 'destinataire', destinataire, 'donnees', donnees) order by id), '[]')
  from (select * from prive.courriels where envoye_le is null and essais < 5 order by id limit 100) x
$$;
create function prive.courriel_fait(i bigint, ok boolean, err text default null) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if ok then
    -- Envoyé : le jeton en clair n'a plus rien à faire ici.
    update prive.courriels set envoye_le = now(), erreur = null, donnees = donnees - 'jeton' where id = i;
  else
    update prive.courriels set essais = essais + 1, erreur = left(err, 500),
      donnees = case when essais + 1 >= 5 then donnees - 'jeton' else donnees end where id = i;
  end if;
  -- Ménage : rien ne reste plus de 60 jours.
  delete from prive.courriels where cree_le < now() - interval '60 days';
end $$;
revoke all on function prive.courriel_facture(), prive.courriels_a_envoyer(), prive.courriel_fait(bigint, boolean, text)
  from public, anon, authenticated;
