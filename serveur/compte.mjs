/* ==========================================================================
   Vigie — les comptes, côté serveur (Cloudflare Pages Functions)
   --------------------------------------------------------------------------
   Ce fichier ne tourne que sur Cloudflare, jamais dans le navigateur. Il est
   importé par les fonctions de functions/ ; wrangler l'assemble au déploiement.

   CE QUI EST GARDÉ, ET OÙ
   Dans le stockage KV « COMPTES » de Cloudflare, une entrée par compte :
     compte:<adresse>  { sel, hash, client, cree }
   - le mot de passe n'y est jamais : seulement son empreinte PBKDF2 (SHA-256,
     100 000 tours, sel de 16 octets), comparée en temps constant ;
   - « client » est l'identifiant Stripe (cus_…). La formule n'est PAS gardée :
     elle est relue chez Stripe, qui seul sait ce qui est payé.
   - config:secret  la clé qui signe les cookies, tirée au hasard au premier
     passage si SECRET_SESSION n'est pas fourni.
   - essais:<adresse>  le compte des connexions ratées, effacé après 15 min.

   LA SESSION
   Un cookie « pco_session », HttpOnly, Secure, SameSite=Lax, signé HMAC :
     { e: adresse, c: client Stripe, f: formule, v: vérifiée le (ms), x: expire (ms) }
   La formule est revérifiée chez Stripe toutes les six heures : un abonnement
   résilié ferme l'accès au plus tard six heures après. Un second cookie,
   « pco_formule », lisible par la page, ne sert qu'à l'affichage (menus) ;
   il ne donne aucun droit.

   LES SECRETS (variables de l'environnement Cloudflare, jamais dans le dépôt)
     STRIPE_SECRET   clé Stripe restreinte, en lecture seule : Checkout
                     Sessions, Customers, Subscriptions
     ADMIN_COURRIEL  l'adresse de l'administrateur. Ce compte ouvre tout, sans
                     abonnement, et voit la liste des comptes. Son mot de passe
                     se choisit par le lien « mot de passe oublié » : il n'est
                     écrit nulle part.
     BREVO_API_KEY   la clé de Brevo, qui envoie les courriels
     EXPEDITEUR      l'adresse qui les envoie (vérifiée chez Brevo)
     SECRET_SESSION  facultatif (sinon tiré au hasard et gardé dans KV)

   LES LIENS PAR COURRIEL
     reinit:<jeton>  l'adresse à qui il appartient ; valable une heure, une fois.
     oubli:<adresse> le nombre de liens demandés dans l'heure (trois au plus).
   ========================================================================== */

/* Mêmes clés, rangs et montants que FORMULES dans build.mjs, qui le vérifie. */
/* Le nom du produit, dans les courriels. Le même que SITE.nom (build.mjs). */
export const NOM = "Vigie";

export const FORMULES = {
  // Montants en centimes, tels que Stripe les donne : au mois, et à l'année.
  textes:  { l: "Textes", rang: 1, mois: 5900, an: 59000 },
  suivi:   { l: "Textes et suivi", rang: 2, mois: 9900, an: 99000 },
  complet: { l: "Veille complète", rang: 3, mois: 14900, an: 149000 }
};

const SIX_HEURES = 6 * 3600 * 1000;
const TRENTE_JOURS = 30 * 24 * 3600 * 1000;
const TOURS = 100000;   // le plafond de PBKDF2 sur Cloudflare Workers

export const rang = (f) => (FORMULES[f] ? FORMULES[f].rang : 0);
export const formuleDuMontant = (centimes) =>
  Object.keys(FORMULES).find((id) => FORMULES[id].mois === centimes || FORMULES[id].an === centimes) || null;
export const accueilDe = (f) => (rang(f) >= 2 ? "/app/" : "/app/releve.html");

/* Quelle formule demande une adresse de l'application. Cloudflare sert aussi
   les pages sans « .html » (/app/plan) : les deux formes sont reconnues. */
export function formuleExigee(chemin) {
  const p = chemin.replace(/\.html$/, "").replace(/\/index$/, "/").replace(/^\/app$/, "/app/");
  if (p === "/app/" || p === "/app/plan") return "suivi";
  if (p === "/app/registre") return "complet";
  return "textes";
}

export const normaliseAdresse = (a) => String(a || "").trim().toLowerCase();
export const adresseValide = (a) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a) && a.length <= 200;

/* --- Réponses --------------------------------------------------------------- */
export function json(corps, statut = 200, entetes = {}) {
  const h = new Headers({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  for (const [k, v] of Object.entries(entetes)) {
    if (Array.isArray(v)) v.forEach((x) => h.append(k, x)); else h.set(k, v);
  }
  return new Response(JSON.stringify(corps), { status: statut, headers: h });
}

export function redirige(vers, cookies = []) {
  const h = new Headers({ Location: vers, "Cache-Control": "no-store" });
  cookies.forEach((c) => h.append("Set-Cookie", c));
  return new Response(null, { status: 302, headers: h });
}

export async function lireJson(requete) {
  try { return await requete.json(); } catch { return {}; }
}

/* --- Octets, base64url --------------------------------------------------------- */
const enc = new TextEncoder();
const b64u = (octets) => btoa(String.fromCharCode(...new Uint8Array(octets)))
  .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const deB64u = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const hex = (octets) => [...new Uint8Array(octets)].map((b) => b.toString(16).padStart(2, "0")).join("");
const deHex = (s) => Uint8Array.from(s.match(/../g) || [], (h) => parseInt(h, 16));

function egal(a, b) {   // en temps constant
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}

/* --- Mots de passe --------------------------------------------------------- */
async function derive(motdepasse, sel) {
  const cle = await crypto.subtle.importKey("raw", enc.encode(motdepasse), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: sel, iterations: TOURS }, cle, 256));
}

export async function empreinte(motdepasse) {
  const sel = crypto.getRandomValues(new Uint8Array(16));
  return { sel: hex(sel), hash: hex(await derive(motdepasse, sel)) };
}

export async function verifieMotDePasse(motdepasse, compte) {
  const calcule = await derive(motdepasse, deHex(compte.sel));
  return egal(calcule, deHex(compte.hash));
}

export const motDePasseValide = (m) => typeof m === "string" && m.length >= 10 && m.length <= 200;

/* --- Signature des cookies -------------------------------------------------- */
async function secret(env) {
  if (env.SECRET_SESSION) return env.SECRET_SESSION;
  let s = await env.COMPTES.get("config:secret");
  if (!s) {
    s = hex(crypto.getRandomValues(new Uint8Array(32)));
    await env.COMPTES.put("config:secret", s);
  }
  return s;
}

async function cleHmac(env) {
  return crypto.subtle.importKey("raw", enc.encode(await secret(env)),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

async function signe(env, objet) {
  const charge = b64u(enc.encode(JSON.stringify(objet)));
  const sig = await crypto.subtle.sign("HMAC", await cleHmac(env), enc.encode(charge));
  return `${charge}.${b64u(sig)}`;
}

async function verifieSigne(env, valeur) {
  const [charge, sig] = String(valeur || "").split(".");
  if (!charge || !sig) return null;
  let ok = false;
  try { ok = await crypto.subtle.verify("HMAC", await cleHmac(env), deB64u(sig), enc.encode(charge)); }
  catch { return null; }
  if (!ok) return null;
  try { return JSON.parse(new TextDecoder().decode(deB64u(charge))); } catch { return null; }
}

/* --- Session -------------------------------------------------------------- */
export function lireCookie(requete, nom) {
  const brut = requete.headers.get("Cookie") || "";
  for (const morceau of brut.split(/;\s*/)) {
    const i = morceau.indexOf("=");
    if (i > 0 && morceau.slice(0, i) === nom) return morceau.slice(i + 1);
  }
  return null;
}

export async function lireSession(requete, env) {
  const s = await verifieSigne(env, lireCookie(requete, "pco_session"));
  if (!s || !s.e || !s.c || !FORMULES[s.f] || !(s.x > Date.now())) return null;
  return s;
}

export async function cookiesSession(env, { e, c, f, v = Date.now(), x = Date.now() + TRENTE_JOURS }) {
  const age = Math.max(0, Math.floor((x - Date.now()) / 1000));
  return [
    `pco_session=${await signe(env, { e, c, f, v, x })}; Path=/; Max-Age=${age}; HttpOnly; Secure; SameSite=Lax`,
    `pco_formule=${f}; Path=/; Max-Age=${age}; Secure; SameSite=Lax`
  ];
}

export const cookiesEffaces = [
  "pco_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax",
  "pco_formule=; Path=/; Max-Age=0; Secure; SameSite=Lax"
];

export const aRevoir = (s) => Date.now() - (s.v || 0) > SIX_HEURES;

/* --- Stripe ----------------------------------------------------------------- */
export async function stripe(env, chemin) {
  if (!env.STRIPE_SECRET) throw new Error("STRIPE_SECRET manquant");
  const r = await fetch(`https://api.stripe.com/v1/${chemin}`, {
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET}` }
  });
  const corps = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error((corps.error && corps.error.message) || `Stripe ${r.status}`);
    e.statut = r.status;
    throw e;
  }
  return corps;
}

/* La formule réellement payée par un client : la plus haute de ses
   abonnements en cours. past_due (paiement en retard, Stripe réessaie) garde
   l'accès ; canceled, unpaid, incomplete le ferment. */
export async function formuleDuClient(env, client) {
  const liste = await stripe(env, `subscriptions?customer=${encodeURIComponent(client)}&status=all&limit=20`);
  let meilleure = null;
  for (const abo of liste.data || []) {
    if (!["active", "trialing", "past_due"].includes(abo.status)) continue;
    for (const ligne of (abo.items && abo.items.data) || []) {
      const f = formuleDuMontant(ligne.price && ligne.price.unit_amount);
      if (f && rang(f) > rang(meilleure)) meilleure = f;
    }
  }
  return meilleure;
}

/* Une session de paiement Stripe (Checkout, ou un lien de paiement), payée,
   pour un abonnement : qui a payé, et quelle formule. */
export async function paiement(env, idSession) {
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(String(idSession || ""))) return { erreur: "Lien de paiement incomplet." };
  let s;
  try { s = await stripe(env, `checkout/sessions/${idSession}?expand[]=line_items`); }
  catch (e) { return { erreur: e.statut === 404 ? "Ce paiement est introuvable." : "Stripe ne répond pas, réessayez dans un instant.", indisponible: e.statut !== 404 }; }
  if (s.mode !== "subscription" || s.status !== "complete" || !["paid", "no_payment_required"].includes(s.payment_status))
    return { erreur: "Ce paiement n'est pas terminé." };
  const courriel = normaliseAdresse(s.customer_details && s.customer_details.email);
  const client = typeof s.customer === "string" ? s.customer : s.customer && s.customer.id;
  const ligne = s.line_items && s.line_items.data && s.line_items.data[0];
  const formule = formuleDuMontant(ligne && ligne.price && ligne.price.unit_amount);
  if (!courriel || !client || !formule) return { erreur: "Ce paiement ne correspond à aucune formule." };
  return { courriel, client, formule };
}

export const lireCompte = async (env, adresse) => {
  const v = await env.COMPTES.get(`compte:${adresse}`);
  return v ? JSON.parse(v) : null;
};
export const ecrireCompte = (env, adresse, compte) =>
  env.COMPTES.put(`compte:${adresse}`, JSON.stringify(compte));

/* Trop d'essais ratés sur une même adresse : on attend un quart d'heure. */
export async function tropDEssais(env, adresse) {
  const n = Number(await env.COMPTES.get(`essais:${adresse}`)) || 0;
  return n >= 8;
}
export async function noteEssai(env, adresse) {
  const n = (Number(await env.COMPTES.get(`essais:${adresse}`)) || 0) + 1;
  await env.COMPTES.put(`essais:${adresse}`, String(n), { expirationTtl: 900 });
}
export const oublieEssais = (env, adresse) => env.COMPTES.delete(`essais:${adresse}`);

/* --- L'administrateur -------------------------------------------------------- */
export const estAdmin = (env, adresse) =>
  !!env.ADMIN_COURRIEL && normaliseAdresse(env.ADMIN_COURRIEL) === normaliseAdresse(adresse);
/* L'administrateur a tout, sans passer par Stripe. */
export const CLIENT_ADMIN = "admin";

/* --- Les liens « nouveau mot de passe » ---------------------------------------- */
export async function creeJeton(env, adresse) {
  const jeton = hex(crypto.getRandomValues(new Uint8Array(32)));
  await env.COMPTES.put(`reinit:${jeton}`, adresse, { expirationTtl: 3600 });
  return jeton;
}
export const lireJeton = (env, jeton) =>
  /^[0-9a-f]{64}$/.test(String(jeton || "")) ? env.COMPTES.get(`reinit:${jeton}`) : Promise.resolve(null);
export const effaceJeton = (env, jeton) => env.COMPTES.delete(`reinit:${jeton}`);

export async function tropDeLiens(env, adresse) {
  const n = (Number(await env.COMPTES.get(`oubli:${adresse}`)) || 0) + 1;
  await env.COMPTES.put(`oubli:${adresse}`, String(n), { expirationTtl: 3600 });
  return n > 3;
}

/* --- Les courriels (Brevo) ----------------------------------------------------- */
export const courrielPossible = (env) => !!(env.BREVO_API_KEY && env.EXPEDITEUR);

export async function envoieCourriel(env, { a, sujet, texte, lien, bouton }) {
  if (!courrielPossible(env)) throw new Error("Courriel non configuré");
  const echappe = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const html = `<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#14142A;max-width:520px">
<p style="font-weight:bold;font-size:18px">${echappe(NOM)}</p>
${texte.split("\n\n").map((p) => `<p>${echappe(p)}</p>`).join("")}
${lien ? `<p><a href="${echappe(lien)}" style="display:inline-block;background:#4A2BE8;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none">${echappe(bouton || "Ouvrir")}</a></p>
<p style="font-size:13px;color:#555">Si le bouton ne marche pas, copiez cette adresse : ${echappe(lien)}</p>` : ""}
</div>`;
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": env.BREVO_API_KEY, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      sender: { name: NOM, email: env.EXPEDITEUR },
      to: [{ email: a }],
      subject: sujet,
      textContent: texte + (lien ? `\n\n${lien}` : ""),
      htmlContent: html
    })
  });
  if (!r.ok) throw new Error(`Brevo ${r.status}`);
}
