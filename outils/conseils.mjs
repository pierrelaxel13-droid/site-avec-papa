/* ==========================================================================
   Les conseils proposés par l'IA (Perplexity), à côté des textes relevés
   --------------------------------------------------------------------------
   Lancé par l'action « Relève », après le robot (outils/veille.mjs).

   Qui paie quoi (choix d'Axel, 31 octobre 2026) :
   - formule 2 « Textes et suivi » : un conseil par texte, le même pour tous ;
   - formule 3 « Veille complète » : le même, PLUS un conseil pour sa famille
     de métiers (division NAF, « 43 » : travaux de construction spécialisés).
   Rien n'est demandé pour un texte qui ne touche le plan d'AUCUN client payant
   en formule 2 ou 3 : sans client, zéro question, zéro centime. Les clients
   sont lus dans la base (prive.clients_conseils : division NAF, formule,
   situations cochées — ni nom ni adresse) ; leur plan est calculé comme sur le
   site (assets/referentiel.js).

   Les conseils vont dans la base (table conseils), jamais dans le dépôt ni
   dans les pages : seuls les abonnés qui y ont droit les lisent
   (conseils_lire, supabase/migrations/20261031000010_conseils.sql).

   Le robot et l'IA travaillent ensemble :
   - le robot donne à Perplexity le début du texte officiel, les sujets où il
     l'a rangé, et ce que le site fait déjà suivre sur ces sujets (le
     référentiel de Clément) : l'IA dit ce qui CHANGE, sans répéter ;
   - l'IA répond en cases (concerne / qui / à faire / quand), et le robot
     contrôle chaque case : une date « quand » qui n'est pas écrite dans le
     texte officiel est retirée ; « ne concerne pas ce sujet » n'est pas
     montré, et part « à revoir » dans l'administration, pour Clément — l'IA
     ne retire jamais un texte du relevé.

   Les garde-fous (docs/a-reprendre.md) :
   - Perplexity ne reçoit que des données publiques : le texte officiel, le
     référentiel du site, le nom d'une famille de métiers. JAMAIS une donnée
     de client.
   - La recherche est limitée aux sites officiels (search_domain_filter) ;
     chaque source citée est contrôlée (site de la liste ET page qui répond) ;
     sans source valable, la réponse est jetée. Les liens écrits dans la
     réponse sont retirés : seules les sources contrôlées s'affichent.
   - Affiché SOUS le texte officiel, avec « Proposé par l'IA, à vérifier » et
     « Ne constitue pas un conseil juridique ». Rien n'entre au registre.
   - Plafond de questions par passage (10), et de dépense par mois (10 $,
     CONSEILS_BUDGET_MOIS) ; le coût réel est noté au journal et dans la base.

   Tests : node outils/conseils.test.mjs (sans réseau, réponses simulées).
   Essai réel : action « Perplexity », étape essai (node outils/conseils.mjs --essai).
   ========================================================================== */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import vm from "node:vm";

/* Les sites officiels où l'IA peut chercher (20 au plus : limite de l'API). */
export const SITES_OFFICIELS = [
  "legifrance.gouv.fr", "service-public.fr", "travail-emploi.gouv.fr", "inrs.fr", "urssaf.fr",
  "boss.gouv.fr", "cnil.fr", "ecologie.gouv.fr", "economie.gouv.fr", "impots.gouv.fr",
  "douane.gouv.fr", "anses.fr", "ademe.fr", "ineris.fr", "eur-lex.europa.eu",
  "has-sante.fr", "ansm.sante.fr", "sante.gouv.fr", "oppbtp.com", "ssi.gouv.fr"
];
export const officiel = (url) => {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return new URL(url).protocol === "https:" && SITES_OFFICIELS.some((d) => h === d || h.endsWith("." + d));
  } catch { return false; }
};

/* L'Agent API de Perplexity (docs.perplexity.ai/api-reference/agent-post).
   « effort: low » : un modèle et des réglages de recherche choisis par
   Perplexity, le niveau le moins cher qui cherche sur le web. La recherche
   web est l'outil web_search, en « fast » (1 $ les 1 000 recherches), limitée
   aux sites officiels. */
const API = "https://api.perplexity.ai/v1/agent";
const EFFORT = "low";
const CONSIGNE = [
  "Tu aides une petite entreprise française à appliquer un texte réglementaire officiel. Un robot de veille te donne le texte, les sujets où il l'a rangé, et ce que l'entreprise suit déjà.",
  "Appuie-toi d'abord sur le texte officiel fourni, puis uniquement sur des sources officielles, et cite-les. N'invente rien : si tu n'es pas sûr qu'une obligation existe, ne la mentionne pas.",
  "Dis ce qui change pour l'entreprise ; ne répète pas ce qu'elle suit déjà, ne recopie pas le texte.",
  "Tu ne donnes pas de conseil juridique ; pas d'interprétation d'un cas particulier.",
  "Réponds en français courant, 120 mots au plus, sans titre ni tableau, exactement sous cette forme :",
  "CONCERNE : oui, non ou incertain — le texte concerne-t-il vraiment les sujets où le robot l'a rangé ?",
  "QUI : une phrase sur les entreprises concernées.",
  "À FAIRE :",
  "- 2 à 4 points courts et concrets",
  "QUAND : la date limite ou d'entrée en vigueur écrite dans le texte, au format JJ/MM/AAAA ; sinon « non précisé »."
].join("\n");

/* Le référentiel du site (assets/referentiel.js), comme le lit le navigateur. */
export function referentiel(chemin = new URL("../assets/referentiel.js", import.meta.url)) {
  const c = { window: {} };
  vm.runInNewContext(readFileSync(chemin, "utf8"), c);
  return c.window.VEILLE;
}

/* Le plan d'un client : comme planDe() de build.mjs et perimetre() du site —
   les sujets de tous, ceux de sa division NAF, et ceux de ses situations. */
export function planClient(V, c) {
  const plan = new Set();
  for (const id of [...V.transversaux, ...(V.parDivision[c.division] || [])]) if (V.domaines[id]) plan.add(id);
  for (const qid of c.contexte || []) {
    const q = V.declencheurs.find((x) => x.id === qid);
    if (q) for (const id of q.domaines) if (V.domaines[id]) plan.add(id);
  }
  return plan;
}

const court = (x, n) => {
  const s = String(x || "").replace(/\s+/g, " ").trim();
  return s.length > n ? s.slice(0, n).replace(/\s+\S*$/, "") + "…" : s;
};

/* La question : tout ce que le robot sait, et qui est public. */
export function question(t, { V = null, metier = "" } = {}) {
  const sujets = (t.domaines || []).map((d) => d.nom);
  const suivi = V ? (t.domaines || []).flatMap((d) =>
    ((V.domaines[d.id] || {}).obligations || []).slice(0, 3).map((o) => `${d.nom} : ${o}`)).slice(0, 8) : [];
  const famille = metier && V ? ((V.divisions || []).find((x) => x.c === metier) || {}).l : "";
  const extrait = court(t.corps, 1200);
  return [
    `Texte officiel : « ${t.titre} »` + (t.dateTexte || t.date ? `, daté du ${t.dateTexte || t.date}` : "") +
      (t.lien ? `. Lien : ${t.lien}` : "") + ".",
    sujets.length ? `Le robot de veille l'a rangé dans : ${sujets.join(", ")}.` : "",
    extrait ? `Début du texte officiel : « ${extrait} »` : "",
    suivi.length ? `Ce que l'entreprise suit déjà sur ces sujets : ${suivi.join(" ; ")}.` : "",
    famille ? `L'entreprise est du métier « ${famille} » (code NAF ${metier}) : réponds pour ce métier précisément.`
            : "Réponds pour une PME en général.",
    "Que change ce texte, concrètement, pour l'entreprise ?"
  ].filter(Boolean).join("\n");
}

export function corps(t, { V = null, metier = "" } = {}) {
  return {
    effort: EFFORT,
    instructions: CONSIGNE,
    input: question(t, { V, metier }),
    language_preference: "fr",
    max_output_tokens: 2000,
    tools: [{ type: "web_search", search_type: "fast", max_results: 10,
              filters: { search_domain_filter: SITES_OFFICIELS } }]
  };
}

/* La forme d'une réponse, sans son contenu : pour l'essai et les erreurs. */
export function forme(j) {
  return { cles: Object.keys(j || {}).sort(), statut: j && j.status,
           sorties: ((j && j.output) || []).map((o) => o.type) };
}

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/* Une question à Perplexity. Rend { ok, texte, sources: [{titre, url}], cout, modele }
   ou { ok: false, erreur }. Un 429 est réessayé une fois, après Retry-After (30 s au plus). */
export async function demander(t, { cle, fetch: f = fetch, attendre = pause, V = null, metier = "" } = {}) {
  let r, j;
  for (let essai = 0; essai < 2; essai++) {
    r = await f(API, {
      method: "POST",
      headers: { Authorization: `Bearer ${cle}`, "Content-Type": "application/json" },
      body: JSON.stringify(corps(t, { V, metier })),
      signal: AbortSignal.timeout(120000)
    });
    j = await r.json().catch(() => ({}));
    if (r.status !== 429 || essai) break;
    const apres = Number((r.headers && r.headers.get && r.headers.get("retry-after")) || 2);
    await attendre(Math.min(30, Math.max(1, apres || 2)) * 1000);
  }
  if (!r.ok) {
    const e = j.error || {};
    // Le message vient de Perplexity : la clé n'y est jamais redite, même par erreur.
    const message = cle ? String(e.message || "").split(cle).join("***") : String(e.message || "");
    return { ok: false, statut: r.status, erreur: `HTTP ${r.status}${e.type ? " " + e.type : ""} ${message.slice(0, 160)}`.trim() };
  }
  if (j.status && j.status !== "completed") {
    return { ok: false, statut: r.status, forme: forme(j), erreur: `réponse ${j.status}${j.error && j.error.message ? " : " + String(j.error.message).slice(0, 160) : ""}` };
  }
  const sorties = j.output || [];
  const morceaux = sorties.filter((o) => o.type === "message")
    .flatMap((o) => o.content || []).filter((c) => c.type === "output_text");
  const texte = morceaux.map((c) => c.text || "").join("\n\n");
  // Les sources : les résultats de recherche, et les liens cités dans le texte.
  const sources = [
    ...sorties.filter((o) => o.type === "search_results").flatMap((o) => o.results || [])
      .map((s) => ({ titre: s.title || "", url: s.url || "" })),
    ...morceaux.flatMap((c) => c.annotations || []).filter((a) => a && a.url)
      .map((a) => ({ titre: a.title || "", url: a.url }))
  ];
  const cout = j.usage && j.usage.cost && typeof j.usage.cost.total_cost === "number" ? j.usage.cost.total_cost : null;
  return { ok: true, statut: r.status, forme: forme(j), texte, sources, cout, modele: j.effort || j.model || EFFORT };
}

/* Le texte de la réponse, en clair : sans liens, sans renvois [1], sans mise en forme. */
export function nettoyer(texte) {
  return String(texte || "")
    .replace(/\[(?:[a-z_]+:)?\d+(?:\s*,\s*(?:[a-z_]+:)?\d+)*\]/gi, "") // les renvois aux sources : [1], [web:4]
    .replace(/\[([^\]]+)\]\((?:https?:)?[^)]*\)/g, "$1") // [mot](lien) → mot
    .replace(/https?:\/\/\S+/g, "")                     // tout lien écrit dans le texte
    .replace(/\*\*|__|`|^#+\s*/gm, "")                  // la mise en forme
    .replace(/^\s*[-*•]\s+/gm, "• ")
    .replace(/[ \t]+/g, " ").replace(/ +([,.])/g, "$1")     // l'espace avant : ; ? ! reste (typographie française)
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 1200);
}

/* Le code HTTP d'une page (0 : pas de réponse). */
export async function statutPage(url, { fetch: f = fetch } = {}) {
  try {
    const r = await f(url, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(15000),
      headers: { "user-agent": "vigie-veille/1.0 (controle des sources)" } });
    return r.status;
  } catch { return 0; }
}
/* Une page qui existe : elle répond (2xx, 3xx), ou le site officiel refuse
   les robots (401, 403, 429 — Légifrance le fait) : la page est là, c'est
   nous qu'on écarte. Une page absente (404, 410), un site en panne (5xx) ou
   muet ne comptent pas. */
export const pageExiste = (statut) => (statut >= 200 && statut < 400) || [401, 403, 429].includes(statut);
export async function repond(url, options = {}) { return pageExiste(await statutPage(url, options)); }

/* Les cases de la réponse : CONCERNE, QUI, À FAIRE, QUAND. */
const sansAccent = (x) => String(x).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
export function lireReponse(brut) {
  const r = { concerne: null, qui: "", points: [], quand: "", reste: [] };
  let dans = null;
  for (const l of String(brut || "").split("\n")) {
    const s = l.replace(/\*\*|__/g, "").replace(/^#+\s*/, "").trim();
    if (!s) continue;
    const m = /^(CONCERNE|QUI|[ÀA] FAIRE|QUAND)\s*:\s*(.*)$/i.exec(s);
    if (m) {
      dans = sansAccent(m[1]).toUpperCase();
      const v = m[2].trim();
      if (dans === "CONCERNE") r.concerne = /^non\b/i.test(v) ? "non" : /^oui\b/i.test(v) ? "oui" : "incertain";
      else if (dans === "QUI") r.qui = v;
      else if (dans === "QUAND") r.quand = v;
      else if (v) r.points.push(v.replace(/^[-*•]\s*/, ""));
      continue;
    }
    if (dans === "A FAIRE" && /^[-*•]\s+/.test(s)) r.points.push(s.replace(/^[-*•]\s+/, ""));
    else if (dans === "QUI" && !r.points.length) r.qui += " " + s;
    else r.reste.push(s);
  }
  return r;
}

/* Une date JJ/MM/AAAA est-elle écrite dans le texte officiel ? (« 1er janvier
   2027 », « 01/01/2027 » ou « 2027-01-01 »). Sinon, elle ne s'affiche pas. */
const MOIS = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"];
export function dateDansTexte(date, texte) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(date || "").trim());
  if (!m) return false;
  const j = Number(m[1]), mo = Number(m[2]), a = m[3];
  if (mo < 1 || mo > 12 || j < 1 || j > 31) return false;
  const t = sansAccent(String(texte || "")).toLowerCase().replace(/[\s  ]+/g, " ");
  const p = (n) => String(n).padStart(2, "0");
  const formes = [`${j} ${MOIS[mo - 1]} ${a}`, `${p(j)}/${p(mo)}/${a}`, `${j}/${mo}/${a}`, `${a}-${p(mo)}-${p(j)}`];
  if (j === 1) formes.push(`1er ${MOIS[mo - 1]} ${a}`);
  return formes.some((f) => t.includes(f));
}

/* Contrôler une réponse : rend { garde: {texte, sources, details} } ou
   { ecarte: raison, details }. t : le texte officiel, pour vérifier les dates. */
export async function controler(rep, t = {}, { verifier = repond } = {}) {
  const lu = lireReponse(rep.texte);
  const qui = nettoyer(lu.qui);
  if (lu.concerne === "non") {
    return { ecarte: "l'IA estime que ce texte ne concerne pas le sujet où le robot l'a rangé — à revoir", details: { concerne: "non", qui } };
  }
  const points = lu.points.map(nettoyer).filter((x) => x.length > 3);
  // Le format n'a pas été suivi : on garde la réponse entière, nettoyée.
  const texte = points.length ? points.map((x) => "• " + x).join("\n") : nettoyer(rep.texte);
  if (texte.length < 40) return { ecarte: "réponse vide ou trop courte", details: {} };
  const details = { concerne: lu.concerne || "incertain" };
  if (points.length && qui) details.qui = qui;
  const date = (/(\d{1,2}\/\d{1,2}\/\d{4})/.exec(lu.quand) || [])[1];
  if (date && dateDansTexte(date, `${t.titre || ""} ${t.corps || ""}`)) details.quand = date;
  else if (date) details.quandRetire = date;     // écrite par l'IA, absente du texte : pas montrée
  const vues = new Set();
  const candidates = (rep.sources || []).filter((s) => {
    if (!officiel(s.url) || vues.has(s.url)) return false;
    vues.add(s.url); return true;
  }).slice(0, 6);
  const valables = [];
  for (const s of candidates) if (await verifier(s.url)) valables.push({ titre: String(s.titre || "").slice(0, 160), url: s.url });
  if (!valables.length) {
    // Pourquoi : pour savoir, au journal, si c'est la recherche ou nos contrôles.
    details.sources = { proposees: (rep.sources || []).length, officielles: candidates.length };
    return { ecarte: candidates.length ? "les sources officielles citées ne répondent pas" : "aucune source officielle parmi celles citées", details };
  }
  return { garde: { texte, sources: valables, details } };
}

/* Ce qu'il faut demander : pour chaque texte qui touche le plan d'au moins un
   client en formule 2 ou 3, le conseil général ; et pour chaque famille de
   métiers des clients en formule 3 qu'il touche, le sien. */
export function besoins(V, releve, clients) {
  const plans = clients.map((c) => ({ rang: Number(c.rang), division: String(c.division || ""), plan: planClient(V, c) }));
  const liste = [];
  for (const t of releve.textes || []) {
    if (!t.id || String(t.id).length > 500) continue;
    const touches = plans.filter((p) => (t.domaines || []).some((d) => p.plan.has(d.id)));
    if (!touches.length) continue;
    liste.push({ t, metier: "" });
    for (const div of [...new Set(touches.filter((p) => p.rang >= 3 && /^\d{2}$/.test(p.division)).map((p) => p.division))].sort())
      liste.push({ t, metier: div });
  }
  return liste;
}

/* Un passage. existants : [{texte_id, metier, le, ecarte}] déjà en base.
   depense : ce que les conseils ont déjà coûté ce mois-ci ($) ; budget : le
   plafond du mois ($) — atteint, on ne demande plus rien jusqu'au mois suivant.
   Rend { bilan, lignes } : les lignes à écrire dans la table conseils. */
export async function traiter(releve, existants, clients, { V, cle, plafond = 10, maintenant = new Date().toISOString(),
                                                           depense = 0, budget = 10,
                                                           demande = demander, controle = controler } = {}) {
  const bilan = { clients: clients.length, demandes: 0, gardes: 0, ecartes: 0, aRevoir: 0, erreurs: 0, cout: 0, attente: 0,
                  depenseMois: Number(depense) || 0, budgetMois: budget };
  const deja = new Map(existants.map((x) => [`${x.texte_id}|${x.metier || ""}`, x]));
  // Une réponse écartée se redemande au bout d'une semaine, pas avant.
  const aRedemander = (c) => c.ecarte && (Date.parse(maintenant) - Date.parse(c.le)) > 7 * 86400000;
  const restants = besoins(V, releve, clients).filter((b) => {
    const c = deja.get(`${b.t.id}|${b.metier}`);
    return !c || aRedemander(c);
  });
  bilan.aDemander = restants.length;
  bilan.attente = Math.max(0, restants.length - plafond);
  if (!clients.length) return { bilan, lignes: [], sansClient: true };
  if (!cle) return { bilan, lignes: [], sansCle: true };
  const lignes = [];
  for (const { t, metier } of restants.slice(0, plafond)) {
    if (bilan.depenseMois + bilan.cout >= budget) { bilan.budgetAtteint = true; break; }
    bilan.demandes++;
    let rep;
    try { rep = await demande(t, { cle, V, metier }); } catch (e) { rep = { ok: false, erreur: String(e.message || e).slice(0, 160) }; }
    if (!rep.ok) { bilan.erreurs++; bilan.derniereErreur = rep.erreur; continue; }
    if (rep.cout) bilan.cout += rep.cout;
    const c = await controle(rep, t);
    const ligne = { texte_id: String(t.id), metier, titre: String(t.titre || "").slice(0, 1000), le: maintenant,
                    modele: rep.modele || EFFORT, cout: rep.cout > 0 ? rep.cout : 0 };
    if (c.garde) { lignes.push({ ...ligne, texte: c.garde.texte, sources: c.garde.sources, details: c.garde.details, ecarte: null }); bilan.gardes++; }
    else {
      lignes.push({ ...ligne, texte: null, sources: [], details: c.details || {}, ecarte: c.ecarte.slice(0, 300) });
      bilan.ecartes++;
      bilan.raisons = bilan.raisons || {};
      bilan.raisons[c.ecarte] = (bilan.raisons[c.ecarte] || 0) + 1;
      if ((c.details || {}).concerne === "non") bilan.aRevoir++;
    }
  }
  bilan.cout = Math.round(bilan.cout * 10000) / 10000;
  bilan.attente = Math.max(0, restants.length - bilan.demandes);
  bilan.depenseMois = Math.round((bilan.depenseMois + bilan.cout) * 10000) / 10000;
  return { bilan, lignes };
}

/* --- La base : lire les clients et les conseils, écrire les nouveaux -------- */
function base(url) {
  return (q, vars = {}) => execFileSync("psql", [url, "-qtA", "-v", "ON_ERROR_STOP=1",
    ...Object.entries(vars).flatMap(([k, v]) => ["-v", `${k}=${v}`])], { input: q + ";\n" }).toString().trim();
}
export function lireBase(sql, ids) {
  const clients = JSON.parse(sql("select coalesce(json_agg(c), '[]') from prive.clients_conseils() c") || "[]");
  const existants = JSON.parse(sql(`select coalesce(json_agg(json_build_object('texte_id', texte_id, 'metier', metier, 'le', le, 'ecarte', ecarte)), '[]')
    from public.conseils where texte_id in (select jsonb_array_elements_text(:'ids'::jsonb))`, { ids: JSON.stringify(ids) }) || "[]");
  const depense = Number(sql("select coalesce(sum(cout), 0) from public.conseils where le >= date_trunc('month', now())") || 0);
  return { clients, existants, depense };
}
export function ecrireBase(sql, lignes) {
  if (!lignes.length) return;
  // Redemandé dans le même mois : le coût s'ajoute, pour que le total du mois soit juste.
  sql(`insert into public.conseils (texte_id, metier, titre, le, modele, texte, sources, details, ecarte, cout)
    select x.texte_id, x.metier, x.titre, x.le, x.modele, x.texte, coalesce(x.sources, '[]'), coalesce(x.details, '{}'), x.ecarte, coalesce(x.cout, 0)
    from jsonb_to_recordset(:'j'::jsonb) as x(texte_id text, metier text, titre text, le timestamptz, modele text,
                                              texte text, sources jsonb, details jsonb, ecarte text, cout numeric)
    on conflict (texte_id, metier) do update set titre = excluded.titre, le = excluded.le, modele = excluded.modele,
      texte = excluded.texte, sources = excluded.sources, details = excluded.details, ecarte = excluded.ecarte,
      cout = case when public.conseils.le >= date_trunc('month', excluded.le) then public.conseils.cout + excluded.cout
                  else excluded.cout end`,
    { j: JSON.stringify(lignes) });
}

const PRINCIPAL = process.argv[1] === fileURLToPath(import.meta.url);
const lireReleve = () => existsSync("contenu/veille-releve.json") ? JSON.parse(readFileSync("contenu/veille-releve.json", "utf8")) : { textes: [] };

if (PRINCIPAL && process.argv.includes("--essai")) {
  /* L'essai : UNE vraie question, sur un texte du relevé (ou un texte connu),
     pour une famille de métiers si on la donne (--metier 43). N'affiche que le
     statut HTTP, la forme de la réponse et des comptes — jamais la clé,
     jamais le texte. Rien n'est écrit. */
  const cle = process.env.PERPLEXITY_API_KEY || "";
  if (!cle) { console.log("::error::PERPLEXITY_API_KEY absente : créez une clé sur https://console.perplexity.ai, puis le secret du dépôt."); process.exit(1); }
  const i = process.argv.indexOf("--metier");
  const metier = i > -1 && /^\d{2}$/.test(process.argv[i + 1] || "") ? process.argv[i + 1] : "";
  // Le premier texte du relevé ; à défaut, un texte connu (lien pris dans contenu/codes.json).
  const t = (lireReleve().textes || []).find((x) => x.titre && x.lien) ||
    { id: "essai", titre: "Décret n° 2008-244 du 7 mars 2008 relatif au code du travail (partie réglementaire)",
      dateTexte: "2008-03-07", lien: "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000018442415", domaines: [] };
  const V = referentiel();
  const rep = await demander(t, { cle, V, metier });
  console.log("statut HTTP :", rep.statut);
  if (rep.forme) console.log("forme :", JSON.stringify(rep.forme));
  if (!rep.ok) {
    console.log("erreur :", rep.erreur);
    if (rep.statut === 401) console.log("::error::Clé refusée (401) : vérifiez le secret PERPLEXITY_API_KEY, ou refaites une clé sur https://console.perplexity.ai.");
    if (rep.statut === 403) console.log("::error::Accès refusé (403) : l'Agent API demande du crédit payé sur https://console.perplexity.ai.");
    if (rep.statut === 429) console.log("::warning::Trop de demandes (429) : réessayer plus tard.");
    process.exit(1);
  }
  const lu = lireReponse(rep.texte);
  const vues = [...new Set(rep.sources.map((s) => s.url).filter(officiel))].slice(0, 6);
  for (const u of vues) console.log(`source officielle ${new URL(u).hostname} : HTTP ${await statutPage(u)}`);
  const c = await controler(rep, t);
  console.log(`modèle : ${rep.modele} ; métier : ${metier || "aucun (conseil général)"} ; texte : ${rep.texte.length} caractères ; ` +
    `cases lues : concerne=${lu.concerne || "?"}, qui=${lu.qui ? "oui" : "non"}, à faire=${lu.points.length}, quand=${lu.quand ? "oui" : "non"} ; ` +
    `sources proposées : ${rep.sources.length}, officielles : ${rep.sources.filter((s) => officiel(s.url)).length} ; coût : ${rep.cout} $`);
  console.log("contrôle :", c.garde ? `gardée (${c.garde.sources.length} sources valables ; date ${c.garde.details.quand ? "vérifiée" : c.garde.details.quandRetire ? "retirée, absente du texte" : "aucune"})` : `écartée — ${c.ecarte}`);
  process.exit(0);
}

if (PRINCIPAL && !process.argv.includes("--essai")) {
  const url = process.env.SUPABASE_DB_URL || "";
  const cle = process.env.PERPLEXITY_API_KEY || "";
  const plafond = Number(process.env.CONSEILS_PLAFOND || 10);
  const budget = Number(process.env.CONSEILS_BUDGET_MOIS || 10);
  let bilan = null, note = "";
  try {
    if (!url) {
      note = "Pas de SUPABASE_DB_URL : sans la base, on ne sait pas qui est client — aucun conseil demandé.";
    } else {
      const releve = lireReleve();
      const sql = base(url);
      const { clients, existants, depense } = lireBase(sql, (releve.textes || []).map((t) => String(t.id || "")).filter(Boolean));
      const r = await traiter(releve, existants, clients, { V: referentiel(), cle, plafond, depense, budget });
      bilan = r.bilan;
      ecrireBase(sql, r.lignes);
      note = r.sansClient ? "Aucun client en formule Textes et suivi ou Veille complète : aucun conseil demandé (rien n'est dépensé)."
        : r.sansCle ? `Pas de clé PERPLEXITY_API_KEY : ${bilan.aDemander} conseil(s) en attente.`
        : `${bilan.clients} client(s) en formule 2 ou 3 ; ${bilan.demandes} demandés, ${bilan.gardes} gardés, ${bilan.ecartes} écartés ` +
          `(dont ${bilan.aRevoir} à revoir), ${bilan.erreurs} erreurs, ${bilan.attente} en attente ; coût ${bilan.cout} $.` +
          (bilan.raisons ? ` Écartés : ${Object.entries(bilan.raisons).map(([k, v]) => `${k} (${v})`).join(", ")}.` : "") +
          ` Ce mois : ${bilan.depenseMois} $ sur ${budget} $.` +
          (bilan.derniereErreur ? ` Dernière erreur : ${bilan.derniereErreur}` : "");
      if (bilan.budgetAtteint) console.log(`::warning title=Conseils de l'IA::Plafond du mois atteint (${bilan.depenseMois} $ sur ${budget} $) : plus aucune question jusqu'au mois prochain. ${bilan.attente} conseil(s) en attente.`);
    }
    console.log(`::notice title=Conseils de l'IA::${note}`);
  } catch (e) {
    // Les conseils ne doivent jamais arrêter la relève.
    console.log(`::warning title=Conseils de l'IA::${String(e.stderr || e.message || e).slice(0, 300).replace(/\n/g, " ")}`);
  }
  // Le journal du robot le reprend (outils/journal-collecte.mjs).
  const BILAN = "releve-bilan.json";
  if (existsSync(BILAN)) {
    const b = JSON.parse(readFileSync(BILAN, "utf8"));
    b.conseils = bilan ? { ...bilan } : { note };
    writeFileSync(BILAN, JSON.stringify(b));
  }
}
