/* ==========================================================================
   Les liens vers les sites officiels répondent-ils encore ?
   --------------------------------------------------------------------------
   Le site pointe vers des milliers de pages officielles (Légifrance, EUR-Lex,
   INRS, CNIL…). Un ministère qui réorganise son site, et nos liens tombent sur
   une page d'erreur : c'est exactement le genre de défaut qui fait douter du
   reste. Ce script les teste tous, une fois par mois
   (.github/workflows/liens-officiels.yml), et liste ceux qui sont morts.

   Trois verdicts, pour ne pas crier au loup :
     mort      404, 410, ou le site n'existe plus (adresse introuvable)
     à revoir  le site refuse le robot (401, 403, 429), répond en erreur
               (5xx), ou ne répond pas dans les 20 s. Ça ne veut pas dire que
               le lien est mauvais : à ouvrir à la main.
     bon       tout le reste (2xx, 3xx)
   Seuls les liens morts font échouer l'action.

   Politesse : deux requêtes à la fois par site au plus, une pause entre deux,
   et un nom de robot qui dit qui nous sommes.

   Usage : node build.mjs && node outils/liens-officiels.mjs [_site]
   ========================================================================== */
import { readdir, readFile, appendFile } from "node:fs/promises";
import { join, resolve, relative } from "node:path";

const RACINE = resolve(process.argv[2] || "_site");
const PAR_SITE = 2, EN_TOUT = 8, PAUSE_MS = 250, DELAI_MS = 20000;
const ROBOT = "Vigie-verif-liens/1.0 (veille reglementaire ; verification mensuelle des liens)";

async function pages(d) {
  const out = [];
  for (const e of await readdir(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) { if (e.name !== "demo") out.push(...await pages(p)); }   // la démo est une copie de app/
    else if (e.name.endsWith(".html")) out.push(p);
  }
  return out;
}

// Chaque lien extérieur, et les pages où il apparaît.
const ou = new Map();
for (const p of await pages(RACINE)) {
  const h = await readFile(p, "utf8");
  for (const m of h.matchAll(/href="(https?:\/\/[^"#]+)[^"]*"/g)) {
    const url = m[1].replace(/&amp;/g, "&");
    if (!ou.has(url)) ou.set(url, []);
    const liste = ou.get(url);
    if (liste.length < 3) liste.push(relative(RACINE, p));
  }
}
const urls = [...ou.keys()];
console.log(`${urls.length} liens extérieurs distincts, sur ${new Set(urls.map((u) => new URL(u).host)).size} sites.`);

async function essaie(url, methode) {
  const ctrl = new AbortController();
  const minuterie = setTimeout(() => ctrl.abort(), DELAI_MS);
  try {
    const r = await fetch(url, { method: methode, redirect: "follow", signal: ctrl.signal,
      headers: { "User-Agent": ROBOT, ...(methode === "GET" ? { Range: "bytes=0-0" } : {}) } });
    if (r.body) await r.body.cancel().catch(() => {});
    return { statut: r.status };
  } catch (e) {
    const code = (e.cause && e.cause.code) || e.name;
    return { erreur: code };
  } finally { clearTimeout(minuterie); }
}

function verdict(r) {
  if (r.erreur) return r.erreur === "ENOTFOUND" ? "mort" : "à revoir";   // adresse introuvable : le site n'existe plus
  if (r.statut === 404 || r.statut === 410) return "mort";
  if (r.statut >= 400) return "à revoir";
  return "bon";
}

async function teste(url) {
  let r = await essaie(url, "HEAD");
  // Beaucoup de sites refusent HEAD : on redemande en GET avant de conclure.
  if (r.erreur || r.statut >= 400) r = await essaie(url, "GET");
  return { url, ...r, verdict: verdict(r) };
}

// File d'attente : EN_TOUT requêtes à la fois, PAR_SITE par site.
const enCours = new Map();
const resultats = [];
let i = 0;
async function ouvrier() {
  while (i < urls.length) {
    const k = urls.findIndex((u, j) => j >= i && (enCours.get(new URL(u).host) || 0) < PAR_SITE);
    if (k === -1) { await new Promise((ok) => setTimeout(ok, 50)); continue; }
    const [url] = urls.splice(k, 1);
    const site = new URL(url).host;
    enCours.set(site, (enCours.get(site) || 0) + 1);
    resultats.push(await teste(url));
    await new Promise((ok) => setTimeout(ok, PAUSE_MS));
    enCours.set(site, enCours.get(site) - 1);
    if (resultats.length % 250 === 0) console.log(`  … ${resultats.length} testés`);
  }
}
await Promise.all(Array.from({ length: EN_TOUT }, ouvrier));

const morts = resultats.filter((r) => r.verdict === "mort");
const aRevoir = resultats.filter((r) => r.verdict === "à revoir");
const ligne = (r) => `- ${r.url} — ${r.statut || r.erreur} — sur ${ou.get(r.url).join(", ")}`;
const rapport = [
  `## Liens vers les sites officiels`,
  ``,
  `${resultats.length} testés : **${morts.length} morts**, ${aRevoir.length} à revoir à la main, ${resultats.length - morts.length - aRevoir.length} bons.`,
  ``,
  ...(morts.length ? [`### Morts (à corriger)`, ...morts.map(ligne), ``] : []),
  ...(aRevoir.length ? [`### À revoir à la main (le site a refusé le robot, ou n'a pas répondu)`, ...aRevoir.slice(0, 200).map(ligne),
    aRevoir.length > 200 ? `- … et ${aRevoir.length - 200} autres` : "", ``] : [])
].join("\n");
console.log("\n" + rapport);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, rapport + "\n");
for (const r of morts.slice(0, 50)) console.log(`::error::Lien mort : ${r.url} (${r.statut || r.erreur}) sur ${ou.get(r.url)[0]}`);
process.exit(morts.length ? 1 : 0);
