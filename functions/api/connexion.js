/* POST /api/connexion  { courriel, motdepasse }
   Vérifie le mot de passe, puis demande à Stripe ce qui est payé. */
import {
  lireJson, json, normaliseAdresse, lireCompte, verifieMotDePasse, empreinte, tropDEssais,
  noteEssai, oublieEssais, formuleDuClient, cookiesSession, accueilDe, estAdmin, CLIENT_ADMIN
} from "../../serveur/compte.mjs";

export async function onRequestPost(ctx) {
  const { courriel, motdepasse } = await lireJson(ctx.request);
  const adresse = normaliseAdresse(courriel);
  if (!adresse || !motdepasse) return json({ erreur: "Entrez votre adresse et votre mot de passe." }, 400);
  if (await tropDEssais(ctx.env, adresse))
    return json({ erreur: "Trop d'essais avec cette adresse. Réessayez dans un quart d'heure." }, 429);

  const compte = await lireCompte(ctx.env, adresse);
  // Même réponse, que l'adresse soit inconnue ou le mot de passe faux : on ne
  // dit pas à un inconnu quelles adresses ont un compte.
  // Adresse inconnue : on calcule quand même une empreinte, pour que la
  // réponse prenne le même temps et ne trahisse pas l'existence du compte.
  if (!compte) await empreinte(String(motdepasse));
  if (!compte || !(await verifieMotDePasse(String(motdepasse), compte))) {
    await noteEssai(ctx.env, adresse);
    return json({ erreur: "Adresse ou mot de passe incorrect." }, 401);
  }
  await oublieEssais(ctx.env, adresse);

  // L'administrateur a tout, sans abonnement.
  if (estAdmin(ctx.env, adresse)) {
    const cookies = await cookiesSession(ctx.env, { e: adresse, c: CLIENT_ADMIN, f: "complet" });
    return json({ ok: true, formule: "complet", admin: true, accueil: "/compte/admin.html" }, 200, { "Set-Cookie": cookies });
  }

  let formule;
  try { formule = await formuleDuClient(ctx.env, compte.client); }
  catch { return json({ erreur: "Le service de paiement ne répond pas. Réessayez dans un instant." }, 503); }
  if (!formule) return json({ erreur: "Votre abonnement n'est plus actif.", inactif: true }, 402);

  const cookies = await cookiesSession(ctx.env, { e: adresse, c: compte.client, f: formule });
  return json({ ok: true, formule, accueil: accueilDe(formule) }, 200, { "Set-Cookie": cookies });
}
