/* Le lien reçu par courriel : /compte/nouveau.html?jeton=…
   GET  /api/nouveau?jeton=…              à quelle adresse il appartient
   POST /api/nouveau { jeton, motdepasse }  change le mot de passe, ouvre la session */
import {
  json, lireJson, lireJeton, effaceJeton, lireCompte, ecrireCompte, empreinte,
  motDePasseValide, estAdmin, formuleDuClient, cookiesSession, accueilDe, CLIENT_ADMIN
} from "../../serveur/compte.mjs";

const PERIME = "Ce lien n'est plus valable : il a servi, ou il a plus d'une heure. Demandez-en un nouveau.";

export async function onRequestGet(ctx) {
  const adresse = await lireJeton(ctx.env, new URL(ctx.request.url).searchParams.get("jeton"));
  if (!adresse) return json({ erreur: PERIME }, 400);
  return json({ courriel: adresse, admin: estAdmin(ctx.env, adresse) });
}

export async function onRequestPost(ctx) {
  const { jeton, motdepasse } = await lireJson(ctx.request);
  const adresse = await lireJeton(ctx.env, jeton);
  if (!adresse) return json({ erreur: PERIME }, 400);
  if (!motDePasseValide(motdepasse)) return json({ erreur: "Le mot de passe doit faire au moins 10 caractères." }, 400);

  const admin = estAdmin(ctx.env, adresse);
  const compte = await lireCompte(ctx.env, adresse);
  if (!compte && !admin) return json({ erreur: PERIME }, 400);
  await ecrireCompte(ctx.env, adresse, {
    ...(compte || { client: CLIENT_ADMIN, cree: new Date().toISOString() }),
    ...(await empreinte(motdepasse)),
    change: new Date().toISOString()
  });
  await effaceJeton(ctx.env, jeton);

  let formule = "complet";
  if (!admin) {
    try { formule = await formuleDuClient(ctx.env, compte.client); }
    catch { return json({ ok: true, message: "Mot de passe changé. Connectez-vous." }); }
    if (!formule) return json({ ok: true, message: "Mot de passe changé, mais votre abonnement n'est plus actif." });
  }
  const cookies = await cookiesSession(ctx.env, { e: adresse, c: admin ? CLIENT_ADMIN : compte.client, f: formule });
  return json({ ok: true, formule, accueil: admin ? "/compte/admin.html" : accueilDe(formule) }, 200, { "Set-Cookie": cookies });
}
