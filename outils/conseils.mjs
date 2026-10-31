/* ==========================================================================
   Les conseils proposés par l'IA (Perplexity), à côté de chaque texte relevé
   --------------------------------------------------------------------------
   Lancé par l'action « Relève », après le robot (outils/veille.mjs). Pour
   chaque texte du relevé qui n'a pas encore de conseil, il demande à
   Perplexity ce qu'une PME doit faire concrètement — UNE fois par texte : la
   réponse est gardée dans contenu/conseils.json.

   Les garde-fous (docs/a-reprendre.md, voulus par Axel et Clément) :
   - Perplexity ne reçoit que le titre, la date et le lien du texte officiel,
     qui sont publics. JAMAIS une donnée de client.
   - La recherche est limitée aux sites officiels (search_domain_filter).
   - Chaque source citée est contrôlée : site de la liste ET page qui répond.
     Une réponse sans au moins une source valable est jetée.
   - Les liens écrits dans le texte de la réponse sont retirés : seules les
     sources contrôlées s'affichent, à part.
   - Le site affiche le conseil SOUS le texte officiel, jamais à sa place,
     avec « Proposé par l'IA, à vérifier » et « Ne constitue pas un conseil
     juridique ». Rien n'entre au registre.
   - Plafond de questions par passage ; le coût réel est noté.

   Sans la clé (secret PERPLEXITY_API_KEY), il ne fait rien et le dit.
   Tests : node outils/conseils.test.mjs (sans réseau, réponses simulées).
   ========================================================================== */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

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
  "Tu aides une petite entreprise française à appliquer un texte réglementaire officiel.",
  "Réponds en français courant, en 3 à 5 points courts : ce que l'entreprise doit faire concrètement, et pour qui le texte compte.",
  "Appuie-toi uniquement sur des sources officielles, et cite-les. N'invente rien : si tu n'es pas sûr qu'une obligation existe, dis-le, ou ne la mentionne pas.",
  "Ne recopie pas le texte et ne le résume pas en entier : il est affiché à côté.",
  "Tu ne donnes pas de conseil juridique ; pas d'interprétation d'un cas particulier.",
  "120 mots au plus. Pas de titre, pas de tableau."
].join(" ");

export function question(t) {
  return `Texte officiel : « ${t.titre} »` +
    (t.dateTexte || t.date ? `, daté du ${t.dateTexte || t.date}` : "") +
    (t.lien ? `. Lien : ${t.lien}` : "") +
    (t.domaines && t.domaines.length ? `. Sujets : ${t.domaines.map((d) => d.nom).join(", ")}` : "") +
    ". Que doit faire concrètement une PME concernée ?";
}

export function corps(t) {
  return {
    effort: EFFORT,
    instructions: CONSIGNE,
    input: question(t),
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
export async function demander(t, { cle, fetch: f = fetch, attendre = pause } = {}) {
  let r, j;
  for (let essai = 0; essai < 2; essai++) {
    r = await f(API, {
      method: "POST",
      headers: { Authorization: `Bearer ${cle}`, "Content-Type": "application/json" },
      body: JSON.stringify(corps(t)),
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

/* Une page qui existe : elle répond (2xx ou 3xx). */
export async function repond(url, { fetch: f = fetch } = {}) {
  try {
    const r = await f(url, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(15000),
      headers: { "user-agent": "vigie-veille/1.0 (controle des sources)" } });
    return r.status >= 200 && r.status < 400;
  } catch { return false; }
}

/* Contrôler une réponse : rend { garde: {texte, sources} } ou { ecarte: raison }. */
export async function controler(rep, { verifier = repond } = {}) {
  const texte = nettoyer(rep.texte);
  if (texte.length < 40) return { ecarte: "réponse vide ou trop courte" };
  const vues = new Set();
  const candidates = (rep.sources || []).filter((s) => {
    if (!officiel(s.url) || vues.has(s.url)) return false;
    vues.add(s.url); return true;
  }).slice(0, 6);
  const valables = [];
  for (const s of candidates) if (await verifier(s.url)) valables.push({ titre: String(s.titre || "").slice(0, 160), url: s.url });
  if (!valables.length) return { ecarte: "aucune source officielle valable" };
  return { garde: { texte, sources: valables } };
}

/* Un passage : les textes du relevé sans conseil, PLAFOND au plus. */
export async function traiter(releve, conseils, { cle, plafond = 10, maintenant = new Date().toISOString(),
                                                    demande = demander, controle = controler } = {}) {
  const bilan = { demandes: 0, gardes: 0, ecartes: 0, erreurs: 0, cout: 0, attente: 0 };
  const ids = new Set((releve.textes || []).map((t) => t.id));
  // On n'oublie que ce qui a quitté le relevé.
  for (const k of Object.keys(conseils)) if (!ids.has(k)) delete conseils[k];
  // Une réponse écartée se redemande au bout d'une semaine, pas avant.
  const aRedemander = (c) => c.ecarte && (Date.parse(maintenant) - Date.parse(c.le)) > 7 * 86400000;
  const restants = (releve.textes || []).filter((t) => t.id && (!conseils[t.id] || aRedemander(conseils[t.id])));
  bilan.attente = Math.max(0, restants.length - plafond);
  if (!cle) return { bilan, sansCle: true };
  for (const t of restants.slice(0, plafond)) {
    bilan.demandes++;
    let rep;
    try { rep = await demande(t, { cle }); } catch (e) { rep = { ok: false, erreur: String(e.message || e).slice(0, 160) }; }
    if (!rep.ok) { bilan.erreurs++; bilan.derniereErreur = rep.erreur; continue; }
    if (rep.cout) bilan.cout += rep.cout;
    const c = await controle(rep);
    if (c.garde) { conseils[t.id] = { le: maintenant, modele: rep.modele || EFFORT, ...c.garde }; bilan.gardes++; }
    else { conseils[t.id] = { le: maintenant, ecarte: c.ecarte }; bilan.ecartes++; }
  }
  bilan.cout = Math.round(bilan.cout * 10000) / 10000;
  return { bilan };
}

/* --- Lancé par la relève -------------------------------------------------- */
if (process.argv[1] === fileURLToPath(import.meta.url) && process.argv.includes("--essai")) {
  /* L'essai : UNE vraie question, sur un texte officiel public. N'affiche que
     le statut HTTP, la forme de la réponse et des comptes — jamais la clé,
     jamais le texte. Rien n'est écrit. */
  const cle = process.env.PERPLEXITY_API_KEY || "";
  if (!cle) { console.log("::error::PERPLEXITY_API_KEY absente : créez une clé sur https://console.perplexity.ai, puis le secret du dépôt."); process.exit(1); }
  // Le premier texte du relevé ; à défaut, un texte connu (lien pris dans contenu/codes.json).
  const releve = existsSync("contenu/veille-releve.json") ? JSON.parse(readFileSync("contenu/veille-releve.json", "utf8")) : {};
  const t = (releve.textes || []).find((x) => x.titre && x.lien) ||
    { id: "essai", titre: "Décret n° 2008-244 du 7 mars 2008 relatif au code du travail (partie réglementaire)",
      dateTexte: "2008-03-07", lien: "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000018442415" };
  const rep = await demander(t, { cle });
  console.log("statut HTTP :", rep.statut);
  if (rep.forme) console.log("forme :", JSON.stringify(rep.forme));
  if (!rep.ok) {
    console.log("erreur :", rep.erreur);
    if (rep.statut === 401) console.log("::error::Clé refusée (401) : vérifiez le secret PERPLEXITY_API_KEY, ou refaites une clé sur https://console.perplexity.ai.");
    if (rep.statut === 429) console.log("::warning::Trop de demandes (429) : réessayer plus tard.");
    process.exit(1);
  }
  const c = await controler(rep);
  console.log(`modèle : ${rep.modele} ; texte : ${rep.texte.length} caractères ; sources proposées : ${rep.sources.length}, ` +
    `officielles : ${rep.sources.filter((s) => officiel(s.url)).length} ; coût : ${rep.cout} $`);
  console.log("contrôle :", c.garde ? `gardée (${c.garde.sources.length} sources valables)` : `écartée — ${c.ecarte}`);
  process.exit(0);
}

if (process.argv[1] === fileURLToPath(import.meta.url) && !process.argv.includes("--essai")) {
  const RELEVE = "contenu/veille-releve.json", CONSEILS = "contenu/conseils.json";
  const cle = process.env.PERPLEXITY_API_KEY || "";
  const plafond = Number(process.env.CONSEILS_PLAFOND || 10);
  try {
    const releve = existsSync(RELEVE) ? JSON.parse(readFileSync(RELEVE, "utf8")) : { textes: [] };
    const conseils = existsSync(CONSEILS) ? JSON.parse(readFileSync(CONSEILS, "utf8")) : {};
    const { bilan, sansCle } = await traiter(releve, conseils, { cle, plafond });
    if (sansCle) {
      console.log(`::notice title=Conseils de l'IA::Pas de clé PERPLEXITY_API_KEY : aucun conseil demandé (${bilan.attente + Math.min(plafond, (releve.textes || []).length)} textes en attente).`);
    } else {
      writeFileSync(CONSEILS, JSON.stringify(conseils, null, 1) + "\n");
      console.log(`::notice title=Conseils de l'IA::${bilan.demandes} demandés, ${bilan.gardes} gardés, ${bilan.ecartes} écartés, ` +
        `${bilan.erreurs} erreurs, ${bilan.attente} en attente ; coût ${bilan.cout} $.` + (bilan.derniereErreur ? ` Dernière erreur : ${bilan.derniereErreur}` : ""));
    }
    // Le journal du robot le reprend (outils/journal-collecte.mjs).
    const BILAN = "releve-bilan.json";
    if (existsSync(BILAN)) {
      const b = JSON.parse(readFileSync(BILAN, "utf8"));
      b.conseils = { ...bilan, sansCle: !!sansCle };
      writeFileSync(BILAN, JSON.stringify(b));
    }
  } catch (e) {
    // Les conseils ne doivent jamais arrêter la relève.
    console.log(`::warning title=Conseils de l'IA::${String(e.message || e).slice(0, 300)}`);
  }
}
