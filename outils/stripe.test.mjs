#!/usr/bin/env node
/* Vigie — essais du robot Stripe (outils/stripe.mjs), sans Stripe ni base. */
import { formuleDe, ligneDe, synchroniser } from "./stripe.mjs";

let n = 0, ko = 0;
const ok = (v, quoi) => { n++; if (v) return; ko++; console.log("ÉCHEC : " + quoi); };

const mois = { recurring: { interval: "month" } }, an = { recurring: { interval: "year" } };

// La formule : la métadonnée d'abord, puis le nom du produit.
ok(JSON.stringify(formuleDe({ ...an, metadata: { formule: "complet" } }, { name: "N'importe quoi" })) === '{"formule":"complet","periode":"an"}', "métadonnée du prix");
ok(formuleDe({ ...mois }, { name: "x", metadata: { formule: "suivi" } }).formule === "suivi", "métadonnée du produit");
ok(formuleDe({ ...mois }, { name: "Vigie — Veille complète" }).formule === "complet", "nom : Veille complète");
ok(formuleDe({ ...mois }, { name: "Vigie — Textes et suivi" }).formule === "suivi", "nom : Textes et suivi (pas « Textes »)");
ok(formuleDe({ ...mois }, { name: "Vigie — Textes" }).formule === "textes", "nom : Textes");
ok(formuleDe({ ...mois }, { name: "État des lieux réglementaire, plan d'actions" }).formule === "suivi", "nom de carte : plan d'actions");
ok(formuleDe({ ...mois }, { name: "Autre chose" }) === null, "produit inconnu : rien");
ok(formuleDe({ recurring: { interval: "week" } }, { name: "Veille complète" }) === null, "période inconnue : rien");
ok(formuleDe({ ...mois, metadata: { formule: "consultant" } }, { name: "Veille complète" }).formule === "complet", "métadonnée hors liste : on retombe sur le nom");

// La ligne pour la base.
const abo = (id, statut, nom, intervalle, fin, ancien) => ({
  id, status: statut, customer: "cus_1",
  ...(ancien ? { current_period_end: fin } : {}),
  items: { data: [{ current_period_end: ancien ? undefined : fin, price: { recurring: { interval: intervalle }, product: { name: nom } } }] }
});
const l = ligneDe(abo("sub_1", "active", "Veille complète", "year", 1800000000), "11111111-1111-1111-1111-111111111111");
ok(l.formule === "complet" && l.periode === "an" && l.statut === "active" && l.stripe_client === "cus_1" &&
   l.fin_periode === new Date(1800000000 * 1000).toISOString(), "ligne : formule, période, statut, client, fin (API récente)");
ok(ligneDe(abo("sub_2", "past_due", "Textes", "month", 1700000000, true), null).fin_periode === new Date(1700000000 * 1000).toISOString(),
  "ligne : fin de période (API ancienne)");
ok(!!ligneDe(abo("sub_3", "active", "???", "month", 1), null).erreur, "ligne : formule introuvable, dite");

// La synchronisation, avec un faux Stripe et une fausse base.
const E = "22222222-2222-2222-2222-222222222222";
const faux = {
  "/v1/checkout/sessions": { data: [
    { id: "cs_1", mode: "subscription", subscription: "sub_A", client_reference_id: E },
    { id: "cs_2", mode: "subscription", subscription: "sub_B", client_reference_id: "pas-un-uuid" },
    { id: "cs_3", mode: "payment", subscription: null, client_reference_id: E }
  ], has_more: false },
  "/v1/subscriptions/sub_A": abo("sub_A", "active", "Textes et suivi", "month", 1800000000),
  "/v1/subscriptions/sub_B": abo("sub_B", "active", "Textes", "month", 1800000000),
  "/v1/subscriptions/sub_OLD": abo("sub_OLD", "canceled", "Textes", "year", 1700000000)
};
const appels = [];
const stripe = async (chemin, params) => { appels.push([chemin, params]); if (!faux[chemin]) throw new Error("inconnu " + chemin); return faux[chemin]; };
let ecrit = null;
const sql = (q, vars) => {
  if (/json_object_agg/.test(q)) return JSON.stringify({ sub_OLD: "33333333-3333-3333-3333-333333333333" });
  ecrit = JSON.parse(vars.j);
  return JSON.stringify({ ecrits: ecrit.length, inconnues: [] });
};
const b = await synchroniser({ stripe, sql, maintenant: Date.parse("2026-11-03T12:00:00Z") });
ok(b.paiements === 2, "deux paiements d'abonnement (pas le paiement unique)");
ok(b.ignores.some((m) => /cs_2/.test(m)), "un paiement sans entreprise valable est dit");
ok(ecrit && ecrit.length === 2 && ecrit.find((x) => x.stripe_abonnement === "sub_A").entreprise_id === E &&
   ecrit.find((x) => x.stripe_abonnement === "sub_A").formule === "suivi", "sub_A écrit pour la bonne entreprise, formule suivi");
ok(ecrit.find((x) => x.stripe_abonnement === "sub_OLD").statut === "canceled", "un abonnement connu est relu : résilié");
ok(!ecrit.find((x) => x.stripe_abonnement === "sub_B"), "sub_B (sans entreprise, inconnu de la base) n'est pas écrit");
ok(appels[0][1]["created[gte]"] === String(Math.floor(Date.parse("2026-11-03T12:00:00Z") / 1000) - 7 * 86400), "seulement les 7 derniers jours");

console.log(`${n - ko}/${n} vérifications passées`);
if (ko) process.exit(1);
