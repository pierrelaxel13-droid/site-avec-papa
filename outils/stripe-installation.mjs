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
        à paliers par client et par mois (build.mjs, OFFRE_CONSULTANT) et un
        lien de paiement où le consultant indique son nombre de clients ;
        il le change ensuite seul dans le portail client ;
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
// Le mois d'essai gratuit des formules 01 à 03, mensuelles et annuelles (6 novembre 2026,
// demande d'Axel) : la carte est enregistrée, rien n'est prélevé avant 30 jours.
export const ESSAI_JOURS = 30;
// La marque du prix à paliers en vigueur : un changement de prix en crée un nouveau.
export const signaturePaliers = () => CONSULTANT.paliers.map((p) => `${p.de}-${p.a || "inf"}:${centimesTTC(p.mois)}`).join(",");

/* Les prix Stripe sont TTC, TVA de 20 % comprise (tax_behavior « inclusive ») :
   la page de paiement Stripe affiche ainsi d'emblée le montant que le client
   paie, au lieu du hors taxes complété par la TVA une fois l'adresse saisie
   (demande d'Axel, 6 novembre 2026). 39 € HT → 46,80 € TTC. Stripe Tax
   (STRIPE_TVA=auto) détaille la TVA comprise sur la page et les factures. */
export const TAUX_TVA = 0.2;
export const centimesTTC = (ht) => Math.round(ht * (1 + TAUX_TVA) * 100);
const messageTva = (ht) => `Premier mois gratuit : rien n'est prélevé avant 30 jours. Ensuite, prix TTC, TVA 20 % incluse : ${ht.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} € HT + ` +
  `${((centimesTTC(ht) - ht * 100) / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} € de TVA = ${(centimesTTC(ht) / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} € TTC. ` +
  "Le détail de la TVA s'affiche dès que votre adresse est saisie.";
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
  const nouveauxLiens = {};
  const messagesTva = {};

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
        (x.metadata || {}).prix === prix.id && (x.metadata || {}).essai === String(ESSAI_JOURS));
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
          subscription_data: { metadata: { formule, periode }, trial_period_days: ESSAI_JOURS },
          payment_method_collection: "always",
          metadata: { formule, periode, prix: prix.id, essai: String(ESSAI_JOURS) }
        });
      }
      bilan.liens[formule][periode] = lien.url;
      if (formule === "textes" && periode === "mois") (bilan.prixIds = bilan.prixIds || {}).textesMois = prix.id;
      messagesTva[lien.id] = messageTva(o[periode]);
      gardes.prix.add(prix.id); gardes.liens.add(lien.id); nouveauxLiens[lien.id] = lien;
    }
  }

  // L'offre consultant (6 novembre 2026) : un produit, UN prix à paliers (« volume » :
  // le prix par client dépend du nombre total de clients) et un lien de paiement.
  // Le consultant change seul son nombre de clients dans le portail client : Stripe
  // applique de lui-même le prix du palier, et le robot outils/stripe.mjs recopie le
  // nombre dans la base (la limite de clients, migration 26).
  const retourCabinet = `${SITE}compte/paiement-consultant.html?merci=1`;
  let pc = produits.find((x) => (x.metadata || {}).formule === "consultant");
  if (!pc) {
    pc = await stripe("POST", "/v1/products", { name: `Vigie réglementaire — ${CONSULTANT.nom}`, metadata: { formule: "consultant" },
      unit_label: "client", ...(tva === "auto" ? { tax_code: "txcd_10103001" } : {}) });
    bilan.produits.push(`créé : ${CONSULTANT.nom}`);
  } else bilan.produits.push(`repris : ${CONSULTANT.nom}`);
  const signature = signaturePaliers();
  let prixC = tousPrix.find((x) => x.product === pc.id && (x.metadata || {}).paliers === signature && x.tax_behavior === "inclusive");
  if (!prixC) {
    prixC = await stripe("POST", "/v1/prices", { product: pc.id, currency: "eur", recurring: { interval: "month" },
      billing_scheme: "tiered", tiers_mode: "volume", tax_behavior: "inclusive",
      tiers: CONSULTANT.paliers.map((p) => ({ up_to: p.a || "inf", unit_amount: centimesTTC(p.mois) })),
      metadata: { formule: "consultant", paliers: signature } });
    bilan.prix.push(`créé : ${CONSULTANT.nom}, à paliers : ${CONSULTANT.paliers.map((p) => `${p.a ? `${p.de}-${p.a}` : `${p.de}+`} → ${ttc(p.mois)} € TTC (${p.mois} € HT)`).join(" ; ")} par client et par mois`);
  }
  let lienC = tousLiens.find((x) => (x.metadata || {}).formule === "consultant" && (x.metadata || {}).prix === prixC.id);
  if (!lienC) {
    lienC = await stripe("POST", "/v1/payment_links", {
      line_items: [{ price: prixC.id, quantity: CONSULTANT.paliers[0].de,
        adjustable_quantity: { enabled: "true", minimum: CONSULTANT.paliers[0].de, maximum: PLAFOND_CLIENTS } }],
      allow_promotion_codes: "true",
      billing_address_collection: "required",
      tax_id_collection: { enabled: "true" },
      ...(tva === "auto" ? { automatic_tax: { enabled: "true" } } : {}),
      after_completion: { type: "redirect", redirect: { url: retourCabinet } },
      subscription_data: { metadata: { formule: "consultant" } },
      metadata: { formule: "consultant", prix: prixC.id }
    });
  }
  bilan.liens.consultant = { lien: lienC.url };
  gardes.prix.add(prixC.id); gardes.liens.add(lienC.id); nouveauxLiens[lienC.id] = lienC;
  messagesTva[lienC.id] = "Prix par client et par mois, TTC (TVA 20 % incluse) : " +
    CONSULTANT.paliers.map((p) => `${p.a ? `${p.de} à ${p.a}` : `${p.de} et plus`} clients ${ttc(p.mois)} € (${p.mois} € HT)`).join(" ; ") +
    ". Le détail de la TVA s'affiche dès que votre adresse est saisie.";

  // La TVA sur la page de paiement (6 novembre 2026) : chaque lien gardé doit avoir le calcul
  // automatique de Stripe Tax ; un lien créé avant l'activation de Stripe Tax est corrigé ici.
  bilan.liensTva = [];
  for (const id of gardes.liens) {
    const l = [...tousLiens, ...Object.values(nouveauxLiens)].find((x) => x.id === id) || {};
    const actif = !!(l.automatic_tax && l.automatic_tax.enabled === true);
    const nom = `${(l.metadata || {}).formule || "?"} ${(l.metadata || {}).periode || ""}`.trim();
    // La période d'essai (6 novembre 2026) : lue, pour savoir si le premier mois est facturé.
    const essai = ((l.subscription_data || {}).trial_period_days) || 0;
    bilan.liensTva.push(`${nom} : période d'essai ${essai ? essai + " jours (rien de facturé avant la fin)" : "aucune (facturé dès le paiement)"}`);
    if (tva === "auto" && !actif) {
      try { await stripe("POST", `/v1/payment_links/${id}`, { automatic_tax: { enabled: "true" } }); bilan.liensTva.push(`${nom} : calcul de la TVA activé`); }
      catch (e) { bilan.liensTva.push(`${nom} : calcul de la TVA NON activé (${e.message})`); }
    } else bilan.liensTva.push(`${nom} : calcul de la TVA ${actif ? "actif" : "inactif"}`);
    // Le message TVA au-dessus du bouton « Payer » : Stripe n'affiche le montant de la TVA
    // qu'une fois l'adresse saisie ; ce message le dit dès l'ouverture de la page.
    const voulu = messagesTva[id];
    const actuel = (((l.custom_text || {}).submit) || {}).message || "";
    if (voulu && actuel !== voulu) {
      try { await stripe("POST", `/v1/payment_links/${id}`, { custom_text: { submit: { message: voulu } } }); bilan.liensTva.push(`${nom} : message TVA posé`); }
      catch (e) { bilan.liensTva.push(`${nom} : message TVA NON posé (${e.message})`); }
    }
  }

  // Diagnostic TVA (6 novembre 2026) : un calcul d'essai par Stripe Tax, pour chaque produit,
  // avec une adresse à Istres. Stripe donne la raison d'un 0 (taxability_reason). Rien n'est facturé.
  bilan.essaisTva = [];
  const nosProduits = [...produits.filter((x) => /^(textes|suivi|complet|consultant)$/.test((x.metadata || {}).formule || "")), ...(pc && !produits.includes(pc) ? [pc] : [])];
  for (const prod of tva === "auto" ? nosProduits : []) {
    try {
      const c = await stripe("POST", "/v1/tax/calculations", {
        currency: "eur",
        customer_details: { address: { country: "FR", postal_code: "13800", city: "Istres", line1: "1 rue de l'essai" }, address_source: "billing" },
        line_items: [{ amount: 4680, reference: "essai", tax_behavior: "inclusive", product: prod.id }]
      });
      const r = (((c.line_items || {}).data || [])[0] || {});
      const b = (c.tax_breakdown || [])[0] || {};
      bilan.essaisTva.push(`${prod.name} (code ${prod.tax_code || "aucun"}) : TVA ${((c.tax_amount_inclusive || 0) / 100).toFixed(2)} € sur 46,80 € — ` +
        `${b.taxability_reason || "?"}${b.tax_rate_details ? `, taux ${b.tax_rate_details.percentage_decimal} %` : ""}`);
    } catch (e) { bilan.essaisTva.push(`${prod.name} : calcul d'essai impossible (${e.message})`); }
  }

  // Diagnostic TVA, 2 (6 novembre 2026) : une vraie session de paiement Stripe Checkout,
  // comme celle d'un lien de paiement, pour un client d'essai à Istres. On lit la TVA que
  // Stripe y met, puis on ferme la session et on supprime le client : rien n'est facturé.
  if (tva === "auto" && process.env.STRIPE_ESSAI_SESSION === "1") {
    const prixEssai = (bilan.prixIds || {}).textesMois;
    let client = null;
    try {
      client = await stripe("POST", "/v1/customers", { name: "Essai TVA (à supprimer)", email: "essai-tva@example.com",
        address: { country: "FR", postal_code: "13800", city: "Istres", line1: "1 rue de l'essai" }, metadata: { essai: "tva" } });
      const sess = await stripe("POST", "/v1/checkout/sessions", { mode: "subscription", customer: client.id,
        line_items: [{ price: prixEssai, quantity: 1 }], automatic_tax: { enabled: "true" },
        success_url: `${SITE}compte/paiement.html?merci=1`, cancel_url: `${SITE}compte/paiement.html` });
      const t = sess.total_details || {};
      bilan.essaisTva.push(`session Checkout (client à Istres) : total ${(sess.amount_total / 100).toFixed(2)} €, TVA ${((t.amount_tax || 0) / 100).toFixed(2)} €` +
        `, calcul ${(sess.automatic_tax || {}).status || "?"}`);
      await stripe("POST", `/v1/checkout/sessions/${sess.id}/expire`, {}).catch(() => {});
    } catch (e) { bilan.essaisTva.push(`session Checkout d'essai impossible (${e.message})`); }
    if (client) await stripe("DELETE", `/v1/customers/${client.id}`).catch(() => {});
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
      // Le consultant change seul son nombre de clients ; la différence est facturée tout de suite,
      // au prorata. Seul le produit consultant est modifiable ici (les formules 01 à 03 non).
      subscription_update: { enabled: "true", default_allowed_updates: ["quantity"], proration_behavior: "always_invoice",
        products: [{ product: pc.id, prices: [prixC.id] }] },
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
  // Les « taux de taxe » créés à la main (Produits → Taux de taxe) : Stripe Tax ne s'en sert pas.
  try {
    const tr = await tous(stripe, "/v1/tax_rates", { active: "true" });
    if (tr.length) bilan.taxe.push(`taux de taxe manuels : ${tr.map((x) => `${x.display_name || "?"} ${x.percentage} % ${x.country || ""} (${x.inclusive ? "inclus" : "en sus"})`).join(", ")} — non utilisés par Stripe Tax`);
  } catch (e) { bilan.taxe.push(`taux de taxe illisibles (${e.message})`); }
  // Sans inscription en France, Stripe Tax calcule 0 : on l'inscrit (demande d'Axel, 6 novembre 2026 :
  // l'entreprise est immatriculée à la TVA en France, FR 22504851312). Taux normal, dès maintenant.
  if (tva === "auto") {
    try {
      const r0 = await tous(stripe, "/v1/tax/registrations", { status: "all" });
      if (!r0.some((x) => x.country === "FR" && /^(active|scheduled)$/.test(x.status))) {
        await stripe("POST", "/v1/tax/registrations", { country: "FR", active_from: "now", country_options: { fr: { type: "standard", standard: { place_of_supply_scheme: "standard" } } } });
        bilan.taxe.push("inscription France créée (TVA collectée dès maintenant)");
      }
    } catch (e) { bilan.taxe.push(`inscription France NON créée (${e.message})`); }
  }
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
    ? `  consultant: { ${Object.entries(l).map(([k, u]) => `${k}: "${u}"`).join(", ")} },   // un seul lien, prix à paliers`
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
  b.liensTva.forEach((x) => console.log("Lien " + x));
  (b.essaisTva || []).forEach((x) => console.log("Essai TVA : " + x));
  console.log(`Mode Stripe : ${mode}. Liens de paiement : ${Object.values(b.liens).flatMap((l) => Object.values(l)).length}. Portail : ${b.portail ? "oui" : "non"}.`);
  const chemin = join(RACINE, "contenu", "paiement.js");
  await writeFile(chemin, reecrire(await readFile(chemin, "utf8"), b.liens, b.portail));
  console.log("contenu/paiement.js mis à jour.");
}
