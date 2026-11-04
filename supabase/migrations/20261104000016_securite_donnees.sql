-- ===========================================================================
-- Sécurité des données des clients (4 novembre 2026)
-- ---------------------------------------------------------------------------
-- Revue demandée par Axel : « que les données des clients ne puissent être
-- volées ». La lecture était déjà fermée (règles RLS sur chaque table, testées
-- par supabase/tests/isolation.sql). Cette migration resserre l'écriture,
-- pour qu'un appel direct à la base, sans passer par l'application, ne puisse
-- rien faire de plus que l'application :
--   1. Registre : une évaluation de conformité exige la formule complète, les
--      statuts sont ceux de l'application, et une date d'effet ne peut pas
--      être dans le futur.
--   2. Réponses (« vrai chez nous ») : l'auteur et la date de la modification
--      sont posés par la base, pas par l'appelant.
--   3. Textes lus : la limite de taille passe de 5 000 à 100 000 caractères.
--      À 5 000, la mémoire des textes lus s'arrêtait vers la centième lecture.
-- ===========================================================================

-- 1. Le registre ------------------------------------------------------------
create or replace function prive.registre_controles() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.date_effet > current_date + 1 then
    raise exception 'La date d''effet ne peut pas être dans le futur.';
  end if;
  if new.genre = 'conformite' then
    if new.statut is null or new.statut not in ('conforme', 'partiel', 'non_conforme', 'a_evaluer') then
      raise exception 'Évaluation inconnue : %', new.statut;
    end if;
    if prive.rang_entreprise(new.entreprise_id) < 3 then
      raise exception 'L''évaluation de conformité fait partie de la formule « Veille complète ».' using errcode = '42501';
    end if;
  elsif new.genre = 'qualification' then
    if new.statut is null or new.statut not in ('applicable', 'a_suivre', 'sans_objet') then
      raise exception 'Qualification inconnue : %', new.statut;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists registre_controles on public.registre;
create trigger registre_controles before insert on public.registre
  for each row execute function prive.registre_controles();

-- 2. Les réponses : l'auteur est celui qui est connecté -----------------------
create or replace function prive.reponses_auteur() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.maj_par := auth.uid();
  new.maj_le := now();
  return new;
end $$;

drop trigger if exists reponses_auteur on public.reponses;
create trigger reponses_auteur before insert or update on public.reponses
  for each row execute function prive.reponses_auteur();

-- 3. La mémoire des textes lus ----------------------------------------------
alter table public.profils drop constraint if exists profils_reglages_check;
alter table public.profils add constraint profils_reglages_check
  check (jsonb_typeof(reglages) = 'object' and length(reglages::text) <= 100000);

create or replace function public.espace_lus(lus jsonb) returns void
language plpgsql set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Il faut être connecté.' using errcode = '42501'; end if;
  if jsonb_typeof(lus) is distinct from 'object'
     or jsonb_typeof(coalesce(lus->'ids', '[]')) is distinct from 'array'
     or length(lus::text) > 90000 then
    raise exception 'Lectures illisibles.';
  end if;
  insert into public.profils (id, reglages) values (auth.uid(), jsonb_build_object('lus', lus))
  on conflict (id) do update set reglages = public.profils.reglages || jsonb_build_object('lus', lus);
end $$;
