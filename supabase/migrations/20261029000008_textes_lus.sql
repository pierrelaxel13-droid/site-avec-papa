-- ===========================================================================
-- Les nouveaux textes : ce que chacun a déjà ouvert
-- ---------------------------------------------------------------------------
-- Un texte est « nouveau » pour une personne s'il touche le plan de son
-- entreprise, si la relève l'a vu après le début de son suivi (« depuis »),
-- et si elle ne l'a pas encore ouvert (« ids »). C'est rangé dans son profil
-- (profils.reglages.lus), comme ses alertes : elle le retrouve sur tous ses
-- appareils, et personne d'autre ne le lit (règles de profils).
--   lus = { "depuis": "2026-10-29T14:00:00Z", "ids": ["jo:JORFTEXT…", …] }
-- ===========================================================================
create function public.espace_lus(lus jsonb) returns void
language plpgsql set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Il faut être connecté.' using errcode = '42501'; end if;
  if jsonb_typeof(lus) is distinct from 'object'
     or jsonb_typeof(coalesce(lus->'ids', '[]')) is distinct from 'array'
     or pg_column_size(lus) > 65536 then
    raise exception 'Lectures illisibles.';
  end if;
  insert into public.profils (id, reglages) values (auth.uid(), jsonb_build_object('lus', lus))
  on conflict (id) do update set reglages = public.profils.reglages || jsonb_build_object('lus', lus);
end $$;

revoke execute on function public.espace_lus(jsonb) from public, anon;
grant execute on function public.espace_lus(jsonb) to authenticated, service_role;
