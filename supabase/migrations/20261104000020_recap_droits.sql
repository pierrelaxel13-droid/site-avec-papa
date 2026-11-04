-- ===========================================================================
-- Récapitulatif par e-mail : les droits resserrés (4 novembre 2026)
-- ---------------------------------------------------------------------------
-- Supabase donne d'office l'exécution des nouvelles fonctions aux rôles anon
-- et authenticated. La migration 19 ne retirait que « public » : un visiteur
-- pouvait appeler mon_recap() (sans rien obtenir : pas de compte, pas de
-- réglage). On retire tout, puis on rend à chacun ce qu'il lui faut.
-- ===========================================================================
revoke all on function public.mon_recap(), public.regler_recap(boolean, boolean)
  from public, anon, authenticated;
grant execute on function public.mon_recap(), public.regler_recap(boolean, boolean) to authenticated;

-- Le lien de désinscription de l'e-mail : sans connexion, avec le jeton.
revoke all on function public.recap_desabonner(uuid, text) from public, anon, authenticated;
grant execute on function public.recap_desabonner(uuid, text) to anon, authenticated;

-- Le robot seulement (connexion de service).
revoke all on function prive.recap_destinataires(), prive.rappels_a_envoyer(date), prive.jeton_de(uuid)
  from public, anon, authenticated;
