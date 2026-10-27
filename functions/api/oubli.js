/* POST /api/oubli { courriel }
   Envoie un lien « nouveau mot de passe », valable une heure, à un compte qui
   existe — ou à l'administrateur, dont c'est la seule façon de choisir son
   mot de passe. La réponse est la même dans tous les cas : on ne dit pas à un
   inconnu quelles adresses ont un compte. */
import {
  lireJson, json, normaliseAdresse, adresseValide, lireCompte, estAdmin,
  creeJeton, tropDeLiens, envoieCourriel, courrielPossible
} from "../../serveur/compte.mjs";

const REPONSE = "Si un compte existe pour cette adresse, un courriel vient de partir avec un lien valable une heure. Pensez à regarder dans les indésirables.";

export async function onRequestPost(ctx) {
  const adresse = normaliseAdresse((await lireJson(ctx.request)).courriel);
  if (!adresseValide(adresse)) return json({ erreur: "Entrez une adresse électronique valide." }, 400);
  if (!courrielPossible(ctx.env))
    return json({ erreur: "L'envoi de courriels n'est pas encore branché. Écrivez-nous, on vous répond dans la journée." }, 503);

  const admin = estAdmin(ctx.env, adresse);
  if (!admin && !(await lireCompte(ctx.env, adresse))) return json({ ok: true, message: REPONSE });
  if (await tropDeLiens(ctx.env, adresse)) return json({ ok: true, message: REPONSE });

  const jeton = await creeJeton(ctx.env, adresse);
  const lien = `${new URL(ctx.request.url).origin}/compte/nouveau.html?jeton=${jeton}`;
  try {
    await envoieCourriel(ctx.env, {
      a: adresse,
      sujet: admin ? "Votre mot de passe administrateur — Pierrel & Co" : "Votre nouveau mot de passe — Pierrel & Co",
      texte: `Bonjour,\n\nVous avez demandé à choisir un ${admin ? "mot de passe administrateur" : "nouveau mot de passe"} pour ${adresse}. Le lien ci-dessous est valable une heure, et ne sert qu'une fois.\n\nSi vous n'avez rien demandé, ignorez ce courriel : votre mot de passe actuel ne change pas.`,
      lien, bouton: "Choisir mon mot de passe"
    });
  } catch {
    return json({ erreur: "Le courriel n'a pas pu partir. Réessayez dans un instant." }, 503);
  }
  return json({ ok: true, message: REPONSE });
}
