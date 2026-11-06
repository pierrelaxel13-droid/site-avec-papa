#!/usr/bin/env node
/* ==========================================================================
   Vigie — Stripe → la base : ouvrir la formule de qui a payé
   --------------------------------------------------------------------------
   Lancé toutes les 15 minutes par .github/workflows/paiements.yml.

   1. Les paiements terminés des 7 derniers jours (Checkout Sessions) : chacun
      porte client_reference_id = l'identifiant de l'entreprise, posé par la
      page compte/paiement.html (assets/souscrire.js).
   2. Leurs abonnements et ceux déjà connus de la base : statut, formule,
      période, fin de période. Un abonnement résilié, impayé ou repris chez
      Stripe change donc ici aussi, au plus tard 15 minutes après.
   3. public.abonnements, une ligne par abonnement Stripe (stripe_abonnement).

   La formule se lit sur le prix ou le produit Stripe : métadonnée
   « formule » = textes, suivi ou complet ; à défaut, le nom du produit
   (« Veille complète », « Textes et suivi », « Textes »). La période se lit
   sur la récurrence du prix (mois ou année).

   Secrets (GitHub, jamais dans le code) :
     STRIPE_SECRET_KEY  une clé RESTREINTE, en lecture seule : Checkout
                        Sessions, Subscriptions, Products, Prices ;
     SUPABASE_DB_URL    l'adresse de la base (déjà là pour les robots).
   Sans l'un ou l'autre, le robot le dit et s'arrête sans erreur.
   Il n'affiche jamais une clé, une adresse électronique ni un IBAN.
   ========================================================================== */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* --- Ce que dit Stripe, traduit pour la base ------------------------------ */
export function formuleDe(prix, produit) {
  const meta = (o) => (o && o.metadata && String(o.metadata.formule || "").trim().toLowerCase()) || "";
  let formule = meta(prix) || meta(produit);
  if (!/^(textes|suivi|complet|consultant)$/.test(formule)) {
    const nom = String((produit && produit.name) || (prix && prix.nickname) || "").toLowerCase();
    formule = /consultant/.test(nom) ? "consultant"
      : /veille compl|conformit/.test(nom) ? "complet"
      : /suivi|plan d.actions/.test(nom) ? "suivi"
      : /textes|état des lieux|etat des lieux/.test(nom) ? "textes" : "";
  }
  const intervalle = prix && prix.recurring && prix.recurring.interval;
  const periode = intervalle === "year" ? "an" : intervalle === "month" ? "mois" : "";
  return formule && periode ? { formule, periode } : null;
}

/* « pour » : l'identifiant posé par la page de paiement (client_reference_id) :
   l'entreprise pour les formules 01 à 03, le cabinet pour l'offre consultant
   (compte/paiement-consultant.html). */
export function ligneDe(abonnement, pour) {
  const item = ((abonnement.items && abonnement.items.data) || [])[0] || {};
  const prix = item.price || abonnement.plan || {};
  const produit = typeof prix.product === "object" ? prix.product : null;
  const f = formuleDe(prix, produit);
  if (!f) return { erreur: `abonnement ${abonnement.id} : formule introuvable (métadonnée « formule » ou nom du produit)` };
  const fin = abonnement.current_period_end || item.current_period_end || null;
  return {
    stripe_abonnement: abonnement.id,
    stripe_client: typeof abonnement.customer === "object" ? abonnement.customer.id : abonnement.customer || null,
    entreprise_id: f.formule === "consultant" ? null : pour || null,
    consultant_id: f.formule === "consultant" ? pour || null : null,
    formule: f.formule, periode: f.periode,
    statut: String(abonnement.status || "inconnu"),
    fin_periode: fin ? new Date(fin * 1000).toISOString() : null,
    // Résiliation demandée par le client (portail Stripe) : l'abonnement s'arrête à la fin
    // de la période payée, sans nouveau prélèvement (5 novembre 2026, Mon compte).
    resiliation_prevue: !!(abonnement.cancel_at_period_end || abonnement.cancel_at)
  };
}

/* --- Stripe -------------------------------------------------------------- */
export function clientStripe(cle, base = process.env.STRIPE_API || "https://api.stripe.com") {
  return async (chemin, params = {}) => {
    const u = new URL(base.replace(/\/$/, "") + chemin);
    for (const [k, v] of Object.entries(params)) (Array.isArray(v) ? v : [v]).forEach((x) => u.searchParams.append(k, x));
    const r = await fetch(u, { headers: { Authorization: `Bearer ${cle}`, "Stripe-Version": "2024-06-20" } });
    if (!r.ok) {
      let msg = `${r.status}`;
      try { msg += " " + ((await r.json()).error || {}).message; } catch { /* corps illisible */ }
      throw new Error(`Stripe ${chemin} : ${msg}`);
    }
    return r.json();
  };
}

async function tout(stripe, chemin, params) {
  const liste = [];
  let apres = null;
  for (let page = 0; page < 50; page++) {
    const r = await stripe(chemin, { ...params, limit: 100, ...(apres ? { starting_after: apres } : {}) });
    liste.push(...(r.data || []));
    if (!r.has_more || !r.data.length) break;
    apres = r.data[r.data.length - 1].id;
  }
  return liste;
}

/* --- La base ------------------------------------------------------------- */
function base(url) {
  return (q, vars = {}) => execFileSync("psql", [url, "-qtA", "-v", "ON_ERROR_STOP=1",
    ...Object.entries(vars).flatMap(([k, v]) => ["-v", `${k}=${v}`])], { input: q + ";\n" }).toString().trim();
}

export async function synchroniser({ stripe, sql, jours = 7, maintenant = Date.now() }) {
  const bilan = { paiements: 0, abonnements: 0, ecrits: 0, ignores: [] };
  // 1. Les paiements terminés récents : à quelle entreprise va chaque abonnement.
  const depuis = Math.floor(maintenant / 1000) - jours * 86400;
  const sessions = await tout(stripe, "/v1/checkout/sessions", { status: "complete", "created[gte]": String(depuis) });
  const pour = {};
  for (const s of sessions) {
    if (s.mode !== "subscription" || !s.subscription) continue;
    bilan.paiements++;
    const id = typeof s.subscription === "object" ? s.subscription.id : s.subscription;
    if (UUID.test(s.client_reference_id || "")) pour[id] = s.client_reference_id;
    else bilan.ignores.push(`paiement ${s.id} : sans entreprise (client_reference_id absent ou invalide)`);
  }
  // 2. Les abonnements déjà connus de la base.
  const connus = JSON.parse(sql("select coalesce(json_object_agg(stripe_abonnement, coalesce(entreprise_id, consultant_id)), '{}') from public.abonnements where stripe_abonnement is not null") || "{}");
  const ids = [...new Set([...Object.keys(pour), ...Object.keys(connus)])];
  const lignes = [];
  for (const id of ids) {
    const a = await stripe(`/v1/subscriptions/${encodeURIComponent(id)}`, { "expand[]": ["items.data.price.product"] });
    bilan.abonnements++;
    const l = ligneDe(a, pour[id] || connus[id]);
    if (l.erreur) { bilan.ignores.push(l.erreur); continue; }
    lignes.push(l);
  }
  // 3. Écrire : une ligne par abonnement Stripe. Une entreprise inconnue est ignorée (et dite).
  if (lignes.length) {
    const r = sql(`with x as (select * from jsonb_to_recordset(:'j'::jsonb) as x(stripe_abonnement text, stripe_client text,
        entreprise_id uuid, consultant_id uuid, formule text, periode text, statut text, fin_periode timestamptz, resiliation_prevue boolean)),
      ok as (select x.* from x where (x.formule <> 'consultant' and exists (select 1 from public.entreprises e where e.id = x.entreprise_id))
                                or (x.formule = 'consultant' and exists (select 1 from public.consultants c where c.id = x.consultant_id))),
      ecrits as (insert into public.abonnements (entreprise_id, consultant_id, formule, periode, statut, fin_periode, resiliation_prevue, stripe_client, stripe_abonnement, maj_le)
        select entreprise_id, consultant_id, formule, periode, statut, fin_periode, coalesce(resiliation_prevue, false), stripe_client, stripe_abonnement, now() from ok
        on conflict (stripe_abonnement) do update set formule = excluded.formule, periode = excluded.periode,
          statut = excluded.statut, fin_periode = excluded.fin_periode, resiliation_prevue = excluded.resiliation_prevue,
          stripe_client = excluded.stripe_client, maj_le = now()
        returning stripe_abonnement)
      select json_build_object('ecrits', (select count(*) from ecrits),
        'inconnues', (select coalesce(json_agg(stripe_abonnement), '[]') from x where not exists (select 1 from ok where ok.stripe_abonnement = x.stripe_abonnement)))`,
      { j: JSON.stringify(lignes) });
    const res = JSON.parse(r || "{}");
    bilan.ecrits = res.ecrits || 0;
    (res.inconnues || []).forEach((id) => bilan.ignores.push(`abonnement ${id} : l'entreprise ou le cabinet n'existe pas dans la base`));
  }
  return bilan;
}

async function principal() {
  const cle = process.env.STRIPE_SECRET_KEY || "";
  const url = process.env.SUPABASE_DB_URL || "";
  if (!cle || !url) {
    console.log(`Rien à faire : ${!cle ? "STRIPE_SECRET_KEY" : "SUPABASE_DB_URL"} n'est pas dans les secrets du dépôt.`);
    return;
  }
  if (/^sk_live_/.test(cle)) console.log("Attention : clé secrète complète. Préférez une clé restreinte (rk_…) en lecture seule.");
  const bilan = await synchroniser({ stripe: clientStripe(cle), sql: base(url) });
  console.log(`Paiements récents : ${bilan.paiements} · abonnements lus : ${bilan.abonnements} · lignes écrites : ${bilan.ecrits}`);
  bilan.ignores.forEach((m) => console.log("Ignoré : " + m));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  principal().catch((e) => { console.error(e.message); process.exit(1); });
}
