/* GET /api/moi : qui est connecté. Sert aux pages publiques à savoir si les
   comptes existent ici (sur une adresse sans serveur, cette route n'existe pas)
   et si le visiteur est déjà connecté. */
import { lireSession, json, accueilDe, estAdmin } from "../../serveur/compte.mjs";

export async function onRequestGet(ctx) {
  const s = await lireSession(ctx.request, ctx.env);
  return s ? json({ connecte: true, courriel: s.e, formule: s.f, accueil: accueilDe(s.f), admin: estAdmin(ctx.env, s.e) })
           : json({ connecte: false });
}
