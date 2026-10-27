/* GET /api/admin/comptes : la liste des comptes, pour l'administrateur seul.
   On ne montre que l'adresse, la date et l'identifiant Stripe — jamais une
   empreinte de mot de passe. */
import { lireSession, estAdmin, json, CLIENT_ADMIN } from "../../../serveur/compte.mjs";

export async function onRequestGet(ctx) {
  const s = await lireSession(ctx.request, ctx.env);
  if (!s || !estAdmin(ctx.env, s.e)) return json({ erreur: "Réservé à l'administrateur." }, 403);
  const comptes = [];
  let curseur;
  do {
    const page = await ctx.env.COMPTES.list({ prefix: "compte:", cursor: curseur });
    for (const k of page.keys) {
      const c = JSON.parse((await ctx.env.COMPTES.get(k.name)) || "{}");
      comptes.push({ courriel: k.name.slice(7), cree: c.cree || "", client: c.client === CLIENT_ADMIN ? "" : (c.client || ""),
                     admin: estAdmin(ctx.env, k.name.slice(7)) });
    }
    curseur = page.list_complete ? null : page.cursor;
  } while (curseur);
  comptes.sort((a, b) => String(b.cree).localeCompare(String(a.cree)));
  return json({ comptes });
}
