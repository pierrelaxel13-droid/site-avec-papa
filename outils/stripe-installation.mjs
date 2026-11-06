#!/usr/bin/env node
/* ==========================================================================
   Vigie réglementaire — installer les paiements dans Stripe (5 novembre 2026)
   --------------------------------------------------------------------------
   Fait en une fois, dans le compte Stripe, tout ce que contenu/paiement.js
   décrit à la main :
     1. un produit par formule (métadonnée « formule » = textes, suivi, complet),
        avec deux prix récurrents HT : à l'année et au mois (build.mjs, FORMULES) ;
     2. un lien de paiement par prix : les moyens de paiement activés dans Stripe
        (carte, prélèvement SEPA…), codes promo
        acceptés, retour vers compte/paiement.html?merci=1 ;
     2 bis. l'offre consultant (métadonnée « formule » = consultant) : un prix
        HT par client et par mois pour chaque palier (build.mjs,
        OFFRE_CONSULTANT), et un lien de paiement par palier où le consultant
        indique son nombre de clients, dans les bornes du palier ;
     3. le portail client : factures, moyen de paiement, et résiliation « à la
        fin de la période payée » (mensuel : fin du mois ; annuel : pas de
        renouvellement), avec sa page de connexion ;
   puis réécrit contenu/paiement.js avec les liens obtenus.

   Rien n'est créé deux fois : ce qui existe déjà (même formule, même prix,
   même période) est repris. On peut donc le relancer sans risque.

   La clé : STRIPE_SETUP_KEY, une clé RESTREINTE, en ÉCRITURE sur Produits,
   Prix, Liens de paiement et Portail client (Billing portal). Elle va dans
   les secrets GitHub, jamais ici, et peut être supprimée après l'installation.
   TVA calculée par Stripe Tax (activée dans Stripe) ; STRIPE_TVA=non pour s'en passer.
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

// L'offre consultant : prix HT par client et par mois, selon le nombre de clients
// (les mêmes que build.mjs, OFFRE_CONSULTANT). « a: null » : sans limite haute.
export const CONSULTANT = {
  nom: "Offre consultant QSE",
  paliers: [
    { de: 1, a: 5, mois: 32 },
    { de: 6, a: 15, mois: 28 },
    { de: 16, a: null, mois: 25 }
  ]
};
const PLAFOND_CLIENTS = 500;

/* Les prix Stripe sont TTC, TVA de 20 % comprise (tax_behavior « inclusive ») :
   la page de paiement Stripe affiche ainsi d'emblée le montant que le client
   paie, au lieu du hors taxes complété par la TVA une fois l'adresse saisie
   (demande d'Axel, 6 novembre 2026). 39 € HT → 46,80 € TTC. Stripe Tax
   (STRIPE_TVA=auto) détaille la TVA comprise sur la page et les factures. */
export const TAUX_TVA = 0.2;
export const centimesTTC = (ht) => Math.round(ht * (1 + TAUX_TVA) * 100);
const ttc = (ht) => (centimesTTC(ht) / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 });

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
  const gardes = { prix: new Set(), liens: new Set() };

  for (const [formule, o] of Object.entries(OFFRES)) {
    let p = produits.find((x) => (x.metadata || {}).formule === formule);
    if (!p) {
      p = await stripe("POST", "/v1/products", { name: `Vigie réglementaire — ${o.nom}`, metadata: { formule },
        ...(tva === "auto" ? { tax_code: "txcd_10103001" } : {}) });   // logiciel en ligne (SaaS) pour entreprises
      bilan.produits.push(`créé : ${o.nom}`);
    } else {
      if (tva === "auto" && !p.tax_code) await stripe("POST", `/v1/products/${p.id}`, { tax_code: "txcd_10103001" });
      bilan.produits.push(`repris : ${o.nom}`);
    }
    bilan.liens[formule] = {};
    for (const periode of ["an", "mois"]) {
      const montant = centimesTTC(o[periode]), intervalle = periode === "an" ? "year" : "month";
      let prix = tousPrix.find((x) => x.product === p.id && x.unit_amount === montant && x.currency === "eur" &&
        x.tax_behavior === "inclusive" && x.recurring && x.recurring.interval === intervalle);
      if (!prix) {
        prix = await stripe("POST", "/v1/prices", { product: p.id, currency: "eur", unit_amount: montant,
          recurring: { interval: intervalle }, tax_behavior: "inclusive", metadata: { formule, periode, ht: String(o[periode]) } });
        bilan.prix.push(`créé : ${o.nom}, ${ttc(o[periode])} € TTC (${o[periode]} € HT) par ${periode}`);
      }
      let lien = tousLiens.find((x) => (x.metadata || {}).formule === formule && (x.metadata || {}).periode === periode &&
        (x.metadata || {}).prix === prix.id);
      if (!lien) {
        lien = await stripe("POST", "/v1/payment_links", {
          line_items: [{ price: prix.id, quantity: 1 }],
          // Pas de liste imposée : les moyens de paiement activés dans le tableau de bord
          // Stripe (Paramètres → Moyens de paiement : carte, prélèvement SEPA…) s'appliquent.
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
      gardes.prix.add(prix.id); gardes.liens.add(lien.id);
    }
  }

  // L'offre consultant : un produit, un prix par palier, un lien par palier.
  const retourCabinet = `${SITE}compte/paiement-consultant.html?merci=1`;
  let pc = produits.find((x) => (x.metadata || {}).formule === "consultant");
  if (!pc) {
    pc = await stripe("POST", "/v1/products", { name: `Vigie réglementaire — ${CONSULTANT.nom}`, metadata: { formule: "consultant" },
      unit_label: "client", ...(tva === "auto" ? { tax_code: "txcd_10103001" } : {}) });
    bilan.produits.push(`créé : ${CONSULTANT.nom}`);
  } else bilan.produits.push(`repris : ${CONSULTANT.nom}`);
  bilan.liens.consultant = {};
  for (const [k, palier] of CONSULTANT.paliers.entries()) {
    const montant = centimesTTC(palier.mois), nom = `p${k + 1}`;
    let prix = tousPrix.find((x) => x.product === pc.id && x.unit_amount === montant && x.currency === "eur" &&
      x.tax_behavior === "inclusive" && x.recurring && x.recurring.interval === "month");
    if (!prix) {
      prix = await stripe("POST", "/v1/prices", { product: pc.id, currency: "eur", unit_amount: montant,
        recurring: { interval: "month" }, tax_behavior: "inclusive", metadata: { formule: "consultant", palier: nom, ht: String(palier.mois) } });
      bilan.prix.push(`créé : ${CONSULTANT.nom}, ${ttc(palier.mois)} € TTC (${palier.mois} € HT) par client et par mois`);
    }
    const de = palier.de, a = palier.a || PLAFOND_CLIENTS;
    let lien = tousLiens.find((x) => (x.metadata || {}).formule === "consultant" && (x.metadata || {}).prix === prix.id &&
      (x.metadata || {}).bornes === `${de}-${a}`);
    if (!lien) {
      lien = await stripe("POST", "/v1/payment_links", {
        line_items: [{ price: prix.id, quantity: de, adjustable_quantity: { enabled: "true", minimum: de, maximum: a } }],
        allow_promotion_codes: "true",
        billing_address_collection: "required",
        tax_id_collection: { enabled: "true" },
        ...(tva === "auto" ? { automatic_tax: { enabled: "true" } } : {}),
        after_completion: { type: "redirect", redirect: { url: retourCabinet } },
        subscription_data: { metadata: { formule: "consultant", palier: nom } },
        metadata: { formule: "consultant", palier: nom, prix: prix.id, bornes: `${de}-${a}` }
      });
    }
    bilan.liens.consultant[nom] = lien.url;
    gardes.prix.add(prix.id); gardes.liens.add(lien.id);
  }

  // Les anciens liens et prix posés par cet outil (hors taxes, 5 novembre 2026), qui ne
  // servent plus : désactivés, pour qu'un ancien lien ne fasse plus payer hors taxes.
  // Seulement ce que l'outil a créé (métadonnée « formule ») ; le reste n'est pas touché.
  bilan.retires = [];
  const notreFormule = (x) => /^(textes|suivi|complet|consultant)$/.test((x.metadata || {}).formule || "");
  for (const l of tousLiens.filter((x) => notreFormule(x) && !gardes.liens.has(x.id))) {
    try { await stripe("POST", `/v1/payment_links/${l.id}`, { active: "false" }); }
    catch (e) { bilan.retires.push(`non désactivé (${e.message})`); continue; }
    bilan.retires.push(`lien ${(l.metadata || {}).formule} ${(l.metadata || {}).periode || (l.metadata || {}).palier || ""}`.trim());
  }
  for (const x of tousPrix.filter((x) => notreFormule(x) && !gardes.prix.has(x.id))) {
    // Un prix « par défaut » de son produit ne se désactive pas : sans gravité, aucun lien ne le propose plus.
    try { await stripe("POST", `/v1/prices/${x.id}`, { active: "false" }); }
    catch (e) { bilan.retires.push(`prix ${(x.metadata || {}).formule} gardé (${e.message})`); continue; }
    bilan.retires.push(`prix ${(x.metadata || {}).formule} ${(x.unit_amount / 100).toLocaleString("fr-FR")} €`);
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

  // La TVA à 0 sur la page de paiement (6 novembre 2026) : Stripe Tax ne collecte une
  // taxe que dans un pays où le compte est inscrit (Stripe → Taxes → Inscriptions).
  // On lit seulement l'état, sans rien changer.
  bilan.taxe = [];
  try {
    const t = await stripe("GET", "/v1/tax/settings");
    bilan.taxe.push(`Stripe Tax : ${t.status === "active" ? "actif" : `pas actif (${t.status || "?"} : ${((t.status_details || {}).pending || {}).missing_fields || ""})`}` +
      `, adresse d'origine : ${t.head_office && t.head_office.address && t.head_office.address.country ? t.head_office.address.country : "absente"}` +
      `, comportement par défaut : ${(t.defaults || {}).tax_behavior || "non réglé"}`);
  } catch (e) { bilan.taxe.push(`réglages Stripe Tax illisibles (${e.message})`); }
  try {
    const r = await tous(stripe, "/v1/tax/registrations", { status: "all" });
    const actives = r.filter((x) => x.status === "active").map((x) => `${x.country} (${x.country_options && x.country_options[x.country.toLowerCase()] ? x.country_options[x.country.toLowerCase()].type : "?"})`);
    bilan.taxe.push(`inscriptions actives : ${actives.length ? actives.join(", ") : "AUCUNE — la TVA est calculée à 0"}` +
      (r.length > actives.length ? ` ; autres : ${r.filter((x) => x.status !== "active").map((x) => `${x.country} ${x.status}`).join(", ")}` : ""));
  } catch (e) { bilan.taxe.push(`inscriptions illisibles (${e.message})`); }
  return bilan;
}

/* contenu/paiement.js : on remplace seulement l'objet window.PAIEMENT. */
export function reecrire(source, liens, portail) {
  const ligne = (f, l) => f === "consultant"
    ? `  consultant: { ${Object.entries(l).map(([k, u]) => `${k}: "${u}"`).join(", ")} },   // par palier : 1 à 5, 6 à 15, 16 et plus`
    : `  ${(f + ":").padEnd(8)} { an: "${l.an}", mois: "${l.mois}" },`;
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
  const b = await installer(clientStripe(cle), { tva: /^(non|aucune?)$/i.test(process.env.STRIPE_TVA || "") ? "" : "auto" });
  b.produits.forEach((x) => console.log("Produit " + x));
  b.prix.forEach((x) => console.log("Prix " + x));
  b.retires.forEach((x) => console.log("Désactivé : " + x));
  b.taxe.forEach((x) => console.log("TVA : " + x));
  console.log(`Mode Stripe : ${mode}. Liens de paiement : ${Object.values(b.liens).flatMap((l) => Object.values(l)).length}. Portail : ${b.portail ? "oui" : "non"}.`);
  const chemin = join(RACINE, "contenu", "paiement.js");
  await writeFile(chemin, reecrire(await readFile(chemin, "utf8"), b.liens, b.portail));
  console.log("contenu/paiement.js mis à jour.");
}
