/* ==========================================================================
   Vigie réglementaire — la fonction serveur « vigie » (6 novembre 2026)
   --------------------------------------------------------------------------
   Une fonction Supabase (Edge Function), déployée par
   .github/workflows/fonctions.yml. Elle fait ce que le site seul ne peut pas
   faire, parce qu'il faut une clé secrète :

     courriels  envoie aussitôt les e-mails en file (prive.courriels) :
                invitation, facture, nouveau compte. La base l'appelle
                elle-même à chaque e-mail mis en file (migration 31) ; le
                robot GitHub (outils/courriels.mjs) reste en secours.
     paiement   ouvre la page de paiement Stripe avec l'adresse du client
                déjà connue : la TVA s'affiche dès l'ouverture.
     confirmer  au retour du paiement : ouvre la formule tout de suite
                (sans attendre le robot outils/stripe.mjs).
     resilier   résiliation à la fin de la période payée, ou son annulation,
                directement chez Stripe.
     clients    l'offre consultant : change le nombre de clients.
     etat       dit quels réglages sont présents (oui / non, jamais une valeur).

   Qui appelle : la personne connectée (son jeton de session, vérifié auprès
   de Supabase Auth), sauf « courriels » et « etat », sans risque.
   Secrets (posés par le workflow, jamais dans le code) : STRIPE_SECRET_KEY,
   BREVO_API_KEY, RECAP_EXPEDITEUR. SUPABASE_URL, SUPABASE_ANON_KEY et
   SUPABASE_DB_URL sont fournis par Supabase.
   Le journal ne contient jamais une clé ni une adresse électronique.
   ========================================================================== */
import postgres from "npm:postgres@3.4.5";
import { gabarit, NOM } from "./gabarits.mjs";

const env = (k: string) => Deno.env.get(k) || "";
const SITE = env("VIGIE_SITE") || "https://vigie-reglementaire.fr/";
const ORIGINES = new Set(["https://vigie-reglementaire.fr", "https://www.vigie-reglementaire.fr",
  ...env("VIGIE_ORIGINES").split(",").map((x) => x.trim()).filter(Boolean)]);
const ESSAI_JOURS = 30;
const ACTIFS = ["active", "trialing", "past_due"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let base: ReturnType<typeof postgres> | null = null;
function sql() {
  if (!base) base = postgres(env("SUPABASE_DB_URL"), { prepare: false, max: 2, idle_timeout: 20 });
  return base;
}

class Refus extends Error { constructor(m: string, public statut = 400) { super(m); } }

/* --- Stripe --------------------------------------------------------------- */
function formulaire(o: unknown, prefixe = "", p = new URLSearchParams()) {
  if (Array.isArray(o)) o.forEach((v, i) => formulaire(v, `${prefixe}[${i}]`, p));
  else if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) formulaire(v, prefixe ? `${prefixe}[${k}]` : k, p);
  else if (o !== undefined && o !== null) p.append(prefixe, String(o));
  return p;
}
async function stripe(methode: string, chemin: string, params: Record<string, unknown> = {}) {
  const cle = env("STRIPE_SECRET_KEY");
  if (!cle) throw new Refus("Le paiement en ligne n'est pas encore branché.", 503);
  const corps = formulaire(params);
  const u = (env("STRIPE_API") || "https://api.stripe.com") + chemin + (methode === "GET" && [...corps].length ? "?" + corps : "");
  const r = await fetch(u, {
    method: methode,
    headers: { Authorization: `Bearer ${cle}`, "Stripe-Version": "2024-06-20", "content-type": "application/x-www-form-urlencoded" },
    body: methode === "GET" ? undefined : corps,
    signal: AbortSignal.timeout(20000)
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.log(`Stripe ${methode} ${chemin.replace(/\/(sub|cus|cs|si)_[A-Za-z0-9_]+/g, "/$1_…")} : ${r.status} ${(j.error || {}).message || ""}`);
    throw new Refus("Stripe a refusé la demande. Réessayez dans un instant ; si cela persiste, écrivez-nous.", 502);
  }
  return j;
}

/* --- Qui appelle ---------------------------------------------------------- */
async function personne(req: Request) {
  const jeton = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jeton) throw new Refus("Connectez-vous d'abord.", 401);
  // La clé publique : celle que le site envoie (clé publiable), sinon celle fournie par Supabase.
  const apikey = req.headers.get("apikey") || env("SUPABASE_ANON_KEY");
  const r = await fetch(env("SUPABASE_URL") + "/auth/v1/user", { headers: { apikey, Authorization: `Bearer ${jeton}` },
    signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Refus("Votre session a expiré : reconnectez-vous.", 401);
  const u = await r.json();
  return { id: String(u.id), courriel: String(u.email || "") };
}

/* L'espace dont la personne est responsable : une entreprise ou un cabinet. */
async function espace(qui: { id: string }, d: Record<string, unknown>) {
  const cabinet = String(d.cabinet || ""), entreprise = String(d.entreprise || "");
  if (cabinet && UUID.test(cabinet)) {
    const [c] = await sql()`select c.id, c.nom, c.adresse from public.consultants c
      join public.membres_consultant m on m.consultant_id = c.id and m.user_id = ${qui.id} and m.role = 'admin' where c.id = ${cabinet}`;
    if (!c) throw new Refus("Seul le responsable du compte du cabinet peut gérer son abonnement.", 403);
    return { type: "cabinet", id: c.id as string, nom: c.nom as string, adresse: c.adresse || null, colonne: "consultant_id" };
  }
  if (entreprise && UUID.test(entreprise)) {
    const [e] = await sql()`select e.id, e.denomination as nom, e.reglages->'adresse' as adresse from public.entreprises e
      join public.membres_entreprise m on m.entreprise_id = e.id and m.user_id = ${qui.id} and m.role = 'admin' where e.id = ${entreprise}`;
    if (!e) throw new Refus("Seul le responsable du compte de l'entreprise peut gérer son abonnement.", 403);
    return { type: "entreprise", id: e.id as string, nom: e.nom as string, adresse: e.adresse || null, colonne: "entreprise_id" };
  }
  throw new Refus("Espace inconnu.");
}
type Espace = Awaited<ReturnType<typeof espace>>;

async function abonnementEnCours(esp: Espace) {
  const [a] = esp.type === "cabinet"
    ? await sql()`select * from public.abonnements where consultant_id = ${esp.id} and stripe_abonnement is not null and statut = any(${ACTIFS}) order by maj_le desc limit 1`
    : await sql()`select * from public.abonnements where entreprise_id = ${esp.id} and stripe_abonnement is not null and statut = any(${ACTIFS}) order by maj_le desc limit 1`;
  return a || null;
}

/* Ce que dit Stripe d'un abonnement, écrit dans public.abonnements (comme outils/stripe.mjs). */
async function ecrire(esp: Espace, sub: Record<string, any>) {
  const item = (sub.items && sub.items.data && sub.items.data[0]) || {};
  const prix = item.price || {};
  const m = { ...(prix.metadata || {}), ...(sub.metadata || {}) };
  const formule = esp.type === "cabinet" ? "consultant" : String(m.formule || "");
  const periode = prix.recurring && prix.recurring.interval === "year" ? "an" : "mois";
  if (!/^(textes|suivi|complet|consultant)$/.test(formule)) throw new Refus("Formule introuvable sur l'abonnement Stripe.", 500);
  const fin = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
  const ligne = {
    entreprise_id: esp.type === "entreprise" ? esp.id : null, consultant_id: esp.type === "cabinet" ? esp.id : null,
    formule, periode, statut: String(sub.status), fin_periode: fin,
    resiliation_prevue: !!(sub.cancel_at_period_end || sub.cancel_at),
    clients_max: esp.type === "cabinet" && Number.isInteger(item.quantity) ? item.quantity : null,
    stripe_client: typeof sub.customer === "object" ? sub.customer.id : sub.customer, stripe_abonnement: sub.id
  };
  await sql()`insert into public.abonnements ${sql()(ligne)}
    on conflict (stripe_abonnement) do update set formule = excluded.formule, periode = excluded.periode, statut = excluded.statut,
      fin_periode = excluded.fin_periode, resiliation_prevue = excluded.resiliation_prevue, clients_max = excluded.clients_max,
      stripe_client = excluded.stripe_client, maj_le = now()`;
  return ligne;
}

/* --- Les actions ---------------------------------------------------------- */
async function paiement(qui: { id: string; courriel: string }, d: Record<string, unknown>) {
  const esp = await espace(qui, d);
  const ad = esp.adresse as Record<string, string> | null;
  if (!ad || !ad.ligne || !ad.cp || !ad.ville || !/^[A-Z]{2}$/.test(ad.pays || "")) {
    throw new Refus("Adresse obligatoire : renseignez l'adresse de votre " + (esp.type === "cabinet" ? "cabinet" : "entreprise") + " avant de vous abonner.");
  }
  // Déjà abonné : pas un second abonnement, mais un changement de formule (action « changer »).
  const enCours = await abonnementEnCours(esp);
  if (enCours) {
    if (esp.type === "cabinet") throw new Refus("Votre abonnement est déjà en cours : changez le nombre de clients depuis Mon compte.", 409);
    if (enCours.formule === d.formule && enCours.periode === d.periode) throw new Refus("C'est déjà votre formule actuelle.", 409);
    return { changement: true, formule: enCours.formule, periode: enCours.periode, statut: enCours.statut };
  }

  // Le prix : celui que l'installation Stripe a créé (métadonnées formule et période ; TTC).
  const prix = (await stripe("GET", "/v1/prices", { active: "true", limit: 100 })).data as Record<string, any>[];
  let choisi: Record<string, any> | undefined, quantite = 1, formule: string, periode: string;
  if (esp.type === "cabinet") {
    quantite = Math.floor(Number(d.clients));
    if (!(quantite >= 1 && quantite <= 500)) throw new Refus("Indiquez votre nombre de clients (de 1 à 500).");
    formule = "consultant"; periode = "mois";
    choisi = prix.find((p) => (p.metadata || {}).formule === "consultant" && (p.metadata || {}).paliers && p.tax_behavior === "inclusive");
  } else {
    formule = String(d.formule || ""); periode = String(d.periode || "");
    if (!/^(textes|suivi|complet)$/.test(formule) || !/^(an|mois)$/.test(periode)) throw new Refus("Formule inconnue.");
    choisi = prix.find((p) => (p.metadata || {}).formule === formule && (p.metadata || {}).periode === periode && p.tax_behavior === "inclusive");
  }
  if (!choisi) throw new Refus("Ce tarif n'est pas encore en ligne : écrivez-nous.", 503);

  // Le texte sous le bouton de paiement Stripe : total TTC et « dont TVA 20 % » (prix TTC, TVA incluse).
  let centimes = Number(choisi.unit_amount) * quantite;
  if (choisi.billing_scheme === "tiered") {
    const t = await stripe("GET", `/v1/prices/${choisi.id}`, { "expand[]": "tiers" });
    const palier = (t.tiers || []).find((x: Record<string, any>) => x.up_to === null || quantite <= x.up_to) || {};
    centimes = Number(palier.unit_amount) * quantite + Number(palier.flat_amount || 0);
  }
  const eur = (c: number) => (c / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
  const par = periode === "an" ? "par an" : "par mois";
  const texte = Number.isFinite(centimes) && centimes > 0
    ? `Total ${eur(centimes)} TTC ${par}, dont TVA 20 % : ${eur(centimes - Math.round(centimes / 1.2))}. ` +
      `Rien à payer aujourd'hui : 1er mois d'essai gratuit ; en résiliant depuis Mon compte avant sa fin, vous ne payez rien.`
    : "Prix TTC, dont TVA 20 %. Rien à payer aujourd'hui : 1er mois d'essai gratuit.";

  // Le client Stripe, avec l'adresse : c'est elle qui fait apparaître la TVA dès l'ouverture de la page.
  const client = {
    name: esp.nom, email: qui.courriel, preferred_locales: ["fr"],
    address: { line1: ad.ligne, postal_code: ad.cp, city: ad.ville, country: ad.pays },
    metadata: { [esp.colonne]: esp.id }
  };
  const [connu] = esp.type === "cabinet"
    ? await sql()`select stripe_client from public.abonnements where consultant_id = ${esp.id} and stripe_client is not null order by maj_le desc limit 1`
    : await sql()`select stripe_client from public.abonnements where entreprise_id = ${esp.id} and stripe_client is not null order by maj_le desc limit 1`;
  let cus: string;
  try {
    cus = connu ? (await stripe("POST", `/v1/customers/${connu.stripe_client}`, client)).id : "";
  } catch { cus = ""; }
  if (!cus) cus = (await stripe("POST", "/v1/customers", client)).id;

  // Le code promo saisi sur le site : appliqué d'office s'il existe ; sinon, la page Stripe le demande.
  let remise: Record<string, unknown> = { allow_promotion_codes: "true" };
  const code = String(d.code || "").trim().toUpperCase();
  if (/^[A-Z0-9_-]{2,40}$/.test(code)) {
    try {
      const pc = (await stripe("GET", "/v1/promotion_codes", { code, active: "true", limit: 1 })).data[0];
      if (pc) remise = { discounts: [{ promotion_code: pc.id }] };
    } catch { /* droits absents : la page Stripe demandera le code */ }
  }
  const retour = SITE + (esp.type === "cabinet" ? "compte/paiement-consultant.html" : "compte/paiement.html");
  const s = await stripe("POST", "/v1/checkout/sessions", {
    mode: "subscription", customer: cus, client_reference_id: esp.id, locale: "fr",
    line_items: [{ price: choisi.id, quantity: quantite }],
    automatic_tax: { enabled: "true" },
    customer_update: { address: "auto", name: "auto" },
    billing_address_collection: "required",
    tax_id_collection: { enabled: "true" },
    ...remise,
    payment_method_collection: "always",
    custom_text: { submit: { message: texte } },
    subscription_data: { trial_period_days: ESSAI_JOURS, metadata: { formule, periode, [esp.colonne]: esp.id } },
    metadata: { formule, periode, [esp.colonne]: esp.id },
    success_url: retour + "?merci=1&session={CHECKOUT_SESSION_ID}",
    cancel_url: retour + (esp.type === "cabinet" ? "?clients=" + quantite : "?formule=" + formule + "&periode=" + periode)
  });
  return { url: s.url };
}

async function confirmer(qui: { id: string }, d: Record<string, unknown>) {
  const id = String(d.session || "");
  if (!/^cs_[A-Za-z0-9_]+$/.test(id)) throw new Refus("Paiement inconnu.");
  const s = await stripe("GET", `/v1/checkout/sessions/${id}`, { "expand[]": "subscription" });
  if (s.status !== "complete" || !s.subscription) return { ouvert: false };
  const esp = await espace(qui, (s.metadata || {}).consultant_id ? { cabinet: s.client_reference_id } : { entreprise: s.client_reference_id });
  const l = await ecrire(esp, s.subscription);
  return { ouvert: true, formule: l.formule, statut: l.statut };
}

/* Changer de formule (01, 02, 03) ou de période sur l'abonnement en cours, chez Stripe.
   Pendant le mois d'essai : rien n'est facturé, le nouveau prix s'applique à la fin de l'essai.
   Ensuite : la différence est facturée (ou créditée) tout de suite, au prorata. */
async function changer(qui: { id: string }, d: Record<string, unknown>) {
  const esp = await espace(qui, d);
  if (esp.type !== "entreprise") throw new Refus("Changement de formule réservé aux entreprises.");
  const formule = String(d.formule || ""), periode = String(d.periode || "");
  if (!/^(textes|suivi|complet)$/.test(formule) || !/^(an|mois)$/.test(periode)) throw new Refus("Formule inconnue.");
  const a = await abonnementEnCours(esp);
  if (!a) throw new Refus("Aucun abonnement payant en cours pour cet espace.", 404);
  const prix = (await stripe("GET", "/v1/prices", { active: "true", limit: 100 })).data as Record<string, any>[];
  const choisi = prix.find((p) => (p.metadata || {}).formule === formule && (p.metadata || {}).periode === periode && p.tax_behavior === "inclusive");
  if (!choisi) throw new Refus("Ce tarif n'est pas encore en ligne : écrivez-nous.", 503);
  const sub0 = await stripe("GET", `/v1/subscriptions/${a.stripe_abonnement}`);
  const item = sub0.items.data[0];
  if (item.price && item.price.id === choisi.id) throw new Refus("C'est déjà votre formule actuelle.", 409);
  const sub = await stripe("POST", `/v1/subscriptions/${a.stripe_abonnement}`, {
    items: [{ id: item.id, price: choisi.id }],
    proration_behavior: sub0.status === "trialing" ? "none" : "always_invoice",
    cancel_at_period_end: "false",
    metadata: { formule, periode }
  });
  const l = await ecrire(esp, sub);
  console.log(`Formule changée (${a.formule} ${a.periode} → ${formule} ${periode}).`);
  return { formule: l.formule, periode: l.periode, statut: l.statut, fin_periode: l.fin_periode };
}

async function resilier(qui: { id: string }, d: Record<string, unknown>) {
  const esp = await espace(qui, d);
  const a = await abonnementEnCours(esp);
  if (!a) throw new Refus("Aucun abonnement payant en cours pour cet espace.", 404);
  const sub = await stripe("POST", `/v1/subscriptions/${a.stripe_abonnement}`, { cancel_at_period_end: d.reprendre ? "false" : "true" });
  const l = await ecrire(esp, sub);
  console.log(`Résiliation ${d.reprendre ? "annulée" : "demandée"} (${esp.type}).`);
  return { resiliation_prevue: l.resiliation_prevue, fin_periode: l.fin_periode, statut: l.statut };
}

async function clients(qui: { id: string }, d: Record<string, unknown>) {
  const esp = await espace(qui, { cabinet: d.cabinet });
  const n = Math.floor(Number(d.nombre));
  if (!(n >= 1 && n <= 500)) throw new Refus("Indiquez un nombre de clients de 1 à 500.");
  const [{ deja }] = await sql()`select count(*)::int as deja from public.entreprises where consultant_id = ${esp.id}`;
  if (n < deja) throw new Refus(`Vous avez déjà ${deja} clients : retirez-en d'abord, ou choisissez au moins ${deja}.`);
  const a = await abonnementEnCours(esp);
  if (!a) throw new Refus("Aucun abonnement payant en cours pour ce cabinet.", 404);
  const sub0 = await stripe("GET", `/v1/subscriptions/${a.stripe_abonnement}`);
  const item = sub0.items.data[0];
  const sub = await stripe("POST", `/v1/subscriptions/${a.stripe_abonnement}`, {
    items: [{ id: item.id, quantity: n }],
    // Pendant le mois d'essai, rien à facturer ; ensuite, la différence au prorata, tout de suite.
    proration_behavior: sub0.status === "trialing" ? "none" : "always_invoice"
  });
  const l = await ecrire(esp, sub);
  return { clients_max: l.clients_max };
}

/* Les e-mails en file : chacun n'est pris que par un seul envoi (verrou). */
async function courriels() {
  const cle = env("BREVO_API_KEY"), expediteur = env("RECAP_EXPEDITEUR");
  if (!cle || !expediteur) return { envoyes: 0, attente: "réglages Brevo absents" };
  let ok = 0, ko = 0;
  await sql().begin(async (t) => {
    const file = await t`select id, genre, destinataire, donnees from prive.courriels
      where envoye_le is null and essais < 5 order by id limit 20 for update skip locked`;
    for (const c of file) {
      const m = gabarit(c.genre, c.donnees || {});
      const r = await fetch(env("BREVO_API") || "https://api.brevo.com/v3/smtp/email", {
        method: "POST", headers: { "api-key": cle, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ sender: { name: NOM, email: expediteur }, to: [{ email: c.destinataire === "equipe" ? expediteur : c.destinataire }],
          subject: m.sujet, htmlContent: m.html, textContent: m.texte }),
        signal: AbortSignal.timeout(10000)   // ne pas garder la file verrouillée si Brevo traîne
      }).catch(() => null);
      if (r && r.ok) { await t`select prive.courriel_fait(${c.id}, true)`; ok++; }
      else { await t`select prive.courriel_fait(${c.id}, false, ${"envoi refusé (" + (r ? r.status : "réseau") + ")"})`; ko++; }
    }
  });
  console.log(`E-mails envoyés : ${ok} ; en échec : ${ko}.`);
  return { envoyes: ok, echecs: ko };
}

/* --- L'entrée ------------------------------------------------------------- */
Deno.serve(async (req) => {
  const origine = req.headers.get("origin") || "";
  const entetes: Record<string, string> = {
    "Access-Control-Allow-Origin": ORIGINES.has(origine) ? origine : SITE.replace(/\/$/, ""),
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin", "content-type": "application/json; charset=utf-8"
  };
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: entetes });
  const repondre = (j: unknown, statut = 200) => new Response(JSON.stringify(j), { status: statut, headers: entetes });
  if (req.method !== "POST") return repondre({ erreur: "POST seulement." }, 405);
  try {
    const d = await req.json().catch(() => ({})) as Record<string, unknown>;
    switch (d.action) {
      case "etat": return repondre({ stripe: !!env("STRIPE_SECRET_KEY"), brevo: !!(env("BREVO_API_KEY") && env("RECAP_EXPEDITEUR")), base: !!env("SUPABASE_DB_URL") });
      case "courriels": return repondre(await courriels());
      case "paiement": return repondre(await paiement(await personne(req), d));
      case "confirmer": return repondre(await confirmer(await personne(req), d));
      case "resilier": return repondre(await resilier(await personne(req), d));
      case "changer": return repondre(await changer(await personne(req), d));
      case "clients": return repondre(await clients(await personne(req), d));
      default: return repondre({ erreur: "Action inconnue." }, 400);
    }
  } catch (e) {
    if (e instanceof Refus) return repondre({ erreur: e.message }, e.statut);
    console.log("Erreur : " + (e instanceof Error ? e.message : String(e)).replace(/[\w.+-]+@[\w.-]+/g, "…@…"));
    return repondre({ erreur: "Le service n'a pas pu traiter la demande. Réessayez dans un instant." }, 500);
  }
});
