#!/usr/bin/env node
/* ==========================================================================
   Vigie réglementaire — installer les paiements dans Stripe (5 novembre 2026)
   --------------------------------------------------------------------------
   Fait en une fois, dans le compte Stripe, tout ce que contenu/paiement.js
   décrit à la main :
     1. un produit par formule (métadonnée « formule » = textes, suivi, complet),
        avec deux prix récurrents HT : à l'année et au mois (build.mjs, FORMULES) ;
     2. un lien de paiement par prix : carte et prélèvement SEPA, codes promo
        acceptés, retour vers compte/paiement.html?merci=1 ;
     3. le portail client : factures, moyen de paiement, et résiliation « à la
        fin de la période payée » (mensuel : fin du mois ; annuel : pas de
        renouvellement), avec sa page de connexion ;
   puis réécrit contenu/paiement.js avec les liens obtenus.

   Rien n'est créé deux fois : ce qui existe déjà (même formule, même prix,
   même période) est repris. On peut donc le relancer sans risque.

   La clé : STRIPE_SETUP_KEY, une clé RESTREINTE, en ÉCRITURE sur Produits,
   Prix, Liens de paiement et Portail client (Billing portal). Elle va dans
   les secrets GitHub, jamais ici, et peut être supprimée après l'installation.
   STRIPE_TVA=auto : TVA calculée par Stripe Tax (à activer avant dans Stripe).
   ========================================================================== */
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = process.env.STRIPE_SITE || "https://vigie-reglementaire.fr/";

// Les prix HT, en euros (les mêmes que build.mjs, FORMULES).
export const OFFRES = {
  textes:  { nom: "01 — État des lieux réglementaire", an: 410, mois: 39 },
  suivi:   { nom: "02 — État des lieux réglementaire et plan d'actions", an: 650, mois: 59 },
  complet: { nom: "03 — Veille complète", an: 869, mois: 79 }
};

/* Les paramètres Stripe, en formulaire : { a: { b: 1 }, c: [{ d: 2 }] } → a[b]=1&c[0][d]=2 */
export function formulaire(o, prefixe = "", sortie = new URLSearchParams()) {
  for (const [k, v] of Object.entries(o)) {
    const cle = prefixe ? `${prefixe}[${k}]` : k;
    if (v === undefined || v === null) continue;
    if (typeof v === "object") formulaire(v, cle, sortie);
    else sortie.append(cle, String(v));
  }
  return sortie;
}

export function clientStripe(cle, base = process.env.STRIPE_API || "https://api.stripe.com") {
  return async (methode, chemin, params = {}) => {
    const corps = formulaire(params);
    const u = new URL(base.replace(/\/$/, "") + chemin);
    if (methode === "GET") corps.forEach((v, k) => u.searchParams.append(k, v));
    const r = await fetch(u, {
      method: methode,
      headers: { Authorization: `Bearer ${cle}`, "Stripe-Version": "2024-06-20",
                 ...(methode === "GET" ? {} : { "content-type": "application/x-www-form-urlencoded" }) },
      body: methode === "GET" ? undefined : corps.toString()
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`Stripe ${methode} ${chemin} : ${r.status} ${(j.error || {}).message || ""}`);
    return j;
  };
}

async function tous(stripe, chemin, params = {}) {
  const l = []; let apres;
  for (let i = 0; i < 20; i++) {
    const r = await stripe("GET", chemin, { ...params, limit: 100, ...(apres ? { starting_after: apres } : {}) });
    l.push(...(r.data || []));
    if (!r.has_more || !r.data.length) break;
    apres = r.data[r.data.length - 1].id;
  }
  return l;
}

export async function installer(stripe, { tva = "" } = {}) {
  const bilan = { produits: [], prix: [], liens: {}, portail: "" };
  const produits = await tous(stripe, "/v1/products", { active: "true" });
  const tousPrix = await tous(stripe, "/v1/prices", { active: "true" });
  const tousLiens = await tous(stripe, "/v1/payment_links", { active: "true" });
  const retour = `${SITE}compte/paiement.html?merci=1`;

  for (const [formule, o] of Object.entries(OFFRES)) {
    let p = produits.find((x) => (x.metadata || {}).formule === formule);
    if (!p) {
      p = await stripe("POST", "/v1/products", { name: `Vigie réglementaire — ${o.nom}`, metadata: { formule },
        ...(tva === "auto" ? { tax_code: "txcd_10103001" } : {}) });   // logiciel en ligne (SaaS) pour entreprises
      bilan.produits.push(`créé : ${o.nom}`);
    } else bilan.produits.push(`repris : ${o.nom}`);
    bilan.liens[formule] = {};
    for (const periode of ["an", "mois"]) {
      const montant = o[periode] * 100, intervalle = periode === "an" ? "year" : "month";
      let prix = tousPrix.find((x) => x.product === p.id && x.unit_amount === montant && x.currency === "eur" &&
        x.recurring && x.recurring.interval === intervalle);
      if (!prix) {
        prix = await stripe("POST", "/v1/prices", { product: p.id, currency: "eur", unit_amount: montant,
          recurring: { interval: intervalle }, tax_behavior: "exclusive", metadata: { formule, periode } });
        bilan.prix.push(`créé : ${o.nom}, ${o[periode]} € HT par ${periode}`);
      }
      let lien = tousLiens.find((x) => (x.metadata || {}).formule === formule && (x.metadata || {}).periode === periode &&
        (x.metadata || {}).prix === prix.id);
      if (!lien) {
        lien = await stripe("POST", "/v1/payment_links", {
          line_items: [{ price: prix.id, quantity: 1 }],
          payment_method_types: ["card", "sepa_debit"],
          allow_promotion_codes: "true",
          billing_address_collection: "required",
          tax_id_collection: { enabled: "true" },
          ...(tva === "auto" ? { automatic_tax: { enabled: "true" } } : {}),
          after_completion: { type: "redirect", redirect: { url: retour } },
          subscription_data: { metadata: { formule, periode } },
          metadata: { formule, periode, prix: prix.id }
        });
      }
      bilan.liens[formule][periode] = lien.url;
    }
  }

  // Le portail client : factures, carte ou IBAN, résiliation à la fin de la période payée.
  const configs = await tous(stripe, "/v1/billing_portal/configurations", { active: "true" });
  let conf = configs.find((c) => (c.metadata || {}).vigie === "1");
  const reglages = {
    business_profile: { headline: "Vigie réglementaire — votre abonnement",
      privacy_policy_url: `${SITE}confidentialite.html`, terms_of_service_url: `${SITE}cgv.html` },
    default_return_url: `${SITE}compte/`,
    features: {
      invoice_history: { enabled: "true" },
      payment_method_update: { enabled: "true" },
      customer_update: { enabled: "true", allowed_updates: ["address", "tax_id", "email"] },
      subscription_cancel: { enabled: "true", mode: "at_period_end", proration_behavior: "none",
        cancellation_reason: { enabled: "true", options: ["too_expensive", "unused", "switched_service", "other"] } }
    },
    login_page: { enabled: "true" },
    metadata: { vigie: "1" }
  };
  conf = conf ? await stripe("POST", `/v1/billing_portal/configurations/${conf.id}`, reglages)
              : await stripe("POST", "/v1/billing_portal/configurations", reglages);
  bilan.portail = (conf.login_page || {}).url || "";
  return bilan;
}

/* contenu/paiement.js : on remplace seulement l'objet window.PAIEMENT. */
export function reecrire(source, liens, portail) {
  const ligne = (f, l) => `  ${(f + ":").padEnd(8)} { an: "${l.an}", mois: "${l.mois}" },`;
  const objet = `window.PAIEMENT = {
  //         à l'année · au mois (installés par outils/stripe-installation.mjs)
${Object.entries(liens).map(([f, l]) => ligne(f, l)).join("\n")}
  portail: "${portail}"    // Gérer ou résilier son abonnement
};`;
  return source.replace(/window\.PAIEMENT = \{[\s\S]*?\n\};/, objet);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const cle = process.env.STRIPE_SETUP_KEY || "";
  if (!cle) { console.log("::error::Il manque le secret STRIPE_SETUP_KEY (clé restreinte en écriture)."); process.exit(1); }
  if (/^sk_/.test(cle)) { console.log("::error::STRIPE_SETUP_KEY est une clé secrète complète (sk_…). Utilisez une clé RESTREINTE (rk_…)."); process.exit(1); }
  const mode = /_test_/.test(cle) ? "TEST" : "RÉEL";
  const b = await installer(clientStripe(cle), { tva: process.env.STRIPE_TVA || "" });
  b.produits.forEach((x) => console.log("Produit " + x));
  b.prix.forEach((x) => console.log("Prix " + x));
  console.log(`Mode Stripe : ${mode}. Liens de paiement : ${Object.values(b.liens).flatMap((l) => Object.values(l)).length}. Portail : ${b.portail ? "oui" : "non"}.`);
  const chemin = join(RACINE, "contenu", "paiement.js");
  await writeFile(chemin, reecrire(await readFile(chemin, "utf8"), b.liens, b.portail));
  console.log("contenu/paiement.js mis à jour.");
}
