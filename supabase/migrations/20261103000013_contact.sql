-- ===========================================================================
-- Le formulaire de contact (3 novembre 2026)
-- ---------------------------------------------------------------------------
-- Un visiteur, connecté ou non, laisse un message par public.contacter().
-- La table n'est ouverte à PERSONNE côté navigateur : on y écrit par la
-- fonction (qui vérifie les longueurs, l'adresse, et freine les envois en
-- rafale), et seul l'administrateur du service la lit, par admin_messages().
-- Les messages sont effacés au bout de 3 ans (à chaque nouvel envoi, les plus
-- anciens partent), comme le dit la politique de confidentialité.
-- ===========================================================================
create table public.messages_contact (
  id         bigint generated always as identity primary key,
  recu_le    timestamptz not null default now(),
  nom        text not null check (length(nom) between 1 and 200),
  entreprise text check (length(entreprise) <= 200),
  courriel   text not null check (length(courriel) between 3 and 320),
  telephone  text check (length(telephone) <= 40),
  objet      text not null check (objet in ('offres', 'demonstration', 'consultant', 'autre')),
  message    text not null check (length(message) between 1 and 5000),
  lu         boolean not null default false
);
alter table public.messages_contact enable row level security;
revoke all on public.messages_contact from public, anon, authenticated;
create index on public.messages_contact (recu_le desc);

create function public.contacter(nom text, entreprise text, courriel text, telephone text, objet text, message text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare a text := lower(btrim(coalesce(courriel, '')));
begin
  if nullif(btrim(coalesce(nom, '')), '') is null then raise exception 'Indiquez votre nom.'; end if;
  if a !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(a) > 320 then raise exception 'Indiquez une adresse électronique valable.'; end if;
  if nullif(btrim(coalesce(message, '')), '') is null then raise exception 'Écrivez votre message.'; end if;
  if length(message) > 5000 then raise exception 'Le message est trop long (5 000 caractères au plus).'; end if;
  if coalesce(objet, '') not in ('offres', 'demonstration', 'consultant', 'autre') then raise exception 'Objet inconnu.'; end if;
  -- Contre les envois en rafale : 3 messages par adresse et par heure, 30 en tout par heure.
  if (select count(*) from public.messages_contact m where m.courriel = a and m.recu_le > now() - interval '1 hour') >= 3
     or (select count(*) from public.messages_contact m where m.recu_le > now() - interval '1 hour') >= 30 then
    raise exception 'Trop de messages en peu de temps. Réessayez dans une heure, ou écrivez-nous directement.';
  end if;
  delete from public.messages_contact where recu_le < now() - interval '3 years';   -- durée de conservation
  insert into public.messages_contact (nom, entreprise, courriel, telephone, objet, message)
  values (left(btrim(nom), 200), nullif(left(btrim(coalesce(entreprise, '')), 200), ''), a,
          nullif(left(btrim(coalesce(telephone, '')), 40), ''), objet, btrim(message));
  return true;
end $$;
revoke execute on function public.contacter(text, text, text, text, text, text) from public;
grant execute on function public.contacter(text, text, text, text, text, text) to anon, authenticated, service_role;

-- L'administration : les messages, du plus récent au plus ancien.
create function public.admin_messages() returns json
language plpgsql stable security definer set search_path = '' as $$
begin
  if not prive.est_administrateur() then
    raise exception 'Réservé à l''administrateur du service.' using errcode = '42501';
  end if;
  return coalesce((select json_agg(json_build_object('id', m.id, 'recu_le', m.recu_le, 'nom', m.nom, 'entreprise', m.entreprise,
      'courriel', m.courriel, 'telephone', m.telephone, 'objet', m.objet, 'message', m.message, 'lu', m.lu) order by m.recu_le desc)
    from (select * from public.messages_contact order by recu_le desc limit 200) m), '[]');
end $$;
revoke execute on function public.admin_messages() from public, anon;
grant execute on function public.admin_messages() to authenticated, service_role;

create function public.admin_message_lu(message bigint, lu boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not prive.est_administrateur() then
    raise exception 'Réservé à l''administrateur du service.' using errcode = '42501';
  end if;
  update public.messages_contact set lu = admin_message_lu.lu where id = message;
end $$;
revoke execute on function public.admin_message_lu(bigint, boolean) from public, anon;
grant execute on function public.admin_message_lu(bigint, boolean) to authenticated, service_role;
