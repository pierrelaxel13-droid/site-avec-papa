/* Après le paiement, Stripe renvoie le client sur
   /compte/bienvenue.html?session={CHECKOUT_SESSION_ID}.
   GET  /api/bienvenue?session=cs_…   ce qui a été payé, et par qui
   POST /api/bienvenue { session, motdepasse }   crée le compte, ouvre la session
   Le compte ne se crée qu'une fois : ensuite, c'est la connexion. */
import {
  json, lireJson, paiement, lireCompte, ecrireCompte, empreinte,
  motDePasseValide, cookiesSession, accueilDe, FORMULES
} from "../../serveur/compte.mjs";

export async function onRequestGet(ctx) {
  const id = new URL(ctx.request.url).searchParams.get("session");
  const p = await paiement(ctx.env, id);
  if (p.erreur) return json({ erreur: p.erreur }, p.indisponible ? 503 : 400);
  const existe = !!(await lireCompte(ctx.env, p.courriel));
  return json({ courriel: p.courriel, formule: p.formule, libelle: FORMULES[p.formule].l, existe });
}

export async function onRequestPost(ctx) {
  const { session, motdepasse } = await lireJson(ctx.request);
  const p = await paiement(ctx.env, session);
  if (p.erreur) return json({ erreur: p.erreur }, p.indisponible ? 503 : 400);
  if (await lireCompte(ctx.env, p.courriel))
    return json({ erreur: "Un compte existe déjà pour cette adresse : connectez-vous.", existe: true }, 409);
  if (!motDePasseValide(motdepasse))
    return json({ erreur: "Le mot de passe doit faire au moins 10 caractères." }, 400);

  await ecrireCompte(ctx.env, p.courriel, { ...(await empreinte(motdepasse)), client: p.client, cree: new Date().toISOString() });
  const cookies = await cookiesSession(ctx.env, { e: p.courriel, c: p.client, f: p.formule });
  return json({ ok: true, formule: p.formule, accueil: accueilDe(p.formule) }, 200, { "Set-Cookie": cookies });
}
