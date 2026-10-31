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

const MODELE = "sonar";
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

/* Une question à Perplexity. Rend { ok, texte, sources: [{titre, url}], cout } ou { ok: false, erreur }. */
export async function demander(t, { cle, fetch: f = fetch } = {}) {
  const r = await f("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${cle}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODELE,
      temperature: 0.2,
      max_tokens: 500,
      search_domain_filter: SITES_OFFICIELS,
      messages: [{ role: "system", content: CONSIGNE }, { role: "user", content: question(t) }]
    }),
    signal: AbortSignal.timeout(60000)
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return { ok: false, erreur: `HTTP ${r.status} ${String((j.error && j.error.message) || "").slice(0, 160)}` };
  const texte = (((j.choices || [])[0] || {}).message || {}).content || "";
  const sources = (j.search_results && j.search_results.length
    ? j.search_results.map((s) => ({ titre: s.title || "", url: s.url || "" }))
    : (j.citations || []).map((u) => ({ titre: "", url: u })));
  const cout = j.usage && j.usage.cost && typeof j.usage.cost.total_cost === "number" ? j.usage.cost.total_cost : null;
  return { ok: true, texte, sources, cout };
}

/* Le texte de la réponse, en clair : sans liens, sans renvois [1], sans mise en forme. */
export function nettoyer(texte) {
  return String(texte || "")
    .replace(/\[(\d+(?:,\s*\d+)*)\]/g, "")             // les renvois aux sources
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
    if (c.garde) { conseils[t.id] = { le: maintenant, modele: MODELE, ...c.garde }; bilan.gardes++; }
    else { conseils[t.id] = { le: maintenant, ecarte: c.ecarte }; bilan.ecartes++; }
  }
  bilan.cout = Math.round(bilan.cout * 10000) / 10000;
  return { bilan };
}

/* --- Lancé par la relève -------------------------------------------------- */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
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
