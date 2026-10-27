/* La porte de l'application : chaque page de /app/ passe par ici, sur
   Cloudflare. Sans session valide, on renvoie vers la connexion ; avec une
   formule trop basse, vers la page qui dit laquelle il faut. La démonstration,
   elle, vit sous /demo/ et reste ouverte à tous. */
import {
  lireSession, aRevoir, formuleDuClient, cookiesSession, cookiesEffaces,
  formuleExigee, rang, redirige, estAdmin, CLIENT_ADMIN
} from "../../serveur/compte.mjs";

export async function onRequest(ctx) {
  const url = new URL(ctx.request.url);
  const retour = encodeURIComponent(url.pathname + url.search);
  let session = await lireSession(ctx.request, ctx.env);
  if (!session) return redirige(`/connexion.html?retour=${retour}`);

  // L'administrateur ne dépend d'aucun abonnement — tant que son adresse
  // reste celle d'ADMIN_COURRIEL.
  const admin = session.c === CLIENT_ADMIN;
  if (admin && !estAdmin(ctx.env, session.e)) return redirige(`/connexion.html`, cookiesEffaces);

  // Toutes les six heures, on redemande à Stripe ce qui est payé.
  let cookies = [];
  if (!admin && aRevoir(session)) {
    try {
      const f = await formuleDuClient(ctx.env, session.c);
      if (!f) return redirige(`/connexion.html?fin=1`, cookiesEffaces);
      session = { ...session, f, v: Date.now() };
      cookies = await cookiesSession(ctx.env, session);
    } catch {
      // Stripe ne répond pas : on garde la formule connue plutôt que de
      // fermer la porte à un abonné. On réessaiera à la page suivante.
    }
  }

  const exige = formuleExigee(url.pathname);
  if (rang(session.f) < rang(exige)) {
    return redirige(`/compte/formule.html?exige=${exige}&active=${session.f}`, cookies);
  }

  const reponse = await ctx.next();
  const r = new Response(reponse.body, reponse);
  // Une page d'abonné ne doit rester dans aucun cache partagé.
  r.headers.set("Cache-Control", "private, no-store");
  cookies.forEach((c) => r.headers.append("Set-Cookie", c));
  return r;
}
