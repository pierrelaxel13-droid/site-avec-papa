#!/usr/bin/env node
/* ==========================================================================
   Pierrel & Co — relève du Journal officiel
   --------------------------------------------------------------------------
   Va chercher les textes parus au Journal officiel, en extrait le contenu, et
   ne garde que ceux qui touchent un domaine du référentiel. Le résultat est
   écrit dans contenu/jo-releve.json, que build.mjs rend dans l'application.

   LA SOURCE
   La DILA publie le JORF en données ouvertes, sans compte ni clé :
   https://echanges.dila.gouv.fr/OPENDATA/JORF/
   Des archives .tar.gz, une par jour, contenant un fichier XML par texte.
   C'est la source primaire — pas un agrégateur, pas une copie.

   CE QUI EST RÉUTILISABLE
   Les textes officiels français sont sous Licence Ouverte : les republier est
   permis, à condition d'en citer la source et la date de version. C'est ce que
   fait la fiche engendrée.

   USAGE
     node outils/jorf.mjs                 # les 7 derniers jours
     node outils/jorf.mjs --jours 30      # un mois
     node outils/jorf.mjs --depuis 2026-10-01
     node outils/jorf.mjs --garder        # garde les archives téléchargées

   SI ÇA REFUSE DE SE CONNECTER
   L'environnement a une politique réseau : echanges.dila.gouv.fr doit y être
   autorisé. Le script le dit clairement plutôt que d'échouer en silence, et
   n'invente jamais de contenu : pas de texte relevé, pas de fiche.
   ========================================================================== */

import { mkdir, readFile, writeFile, rm, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.JORF_BASE || "https://echanges.dila.gouv.fr/OPENDATA/JORF/";
const TRAVAIL = join(RACINE, ".jorf");
const SORTIE = join(RACINE, "contenu", "jo-releve.json");

/* --- Arguments ------------------------------------------------------------ */
const args = process.argv.slice(2);
const valeur = (nom, defaut) => {
  const i = args.indexOf(nom);
  return i !== -1 && args[i + 1] ? args[i + 1] : defaut;
};
const JOURS = Number(valeur("--jours", 7));
const DEPUIS = valeur("--depuis", null);
const GARDER = args.includes("--garder");

/* --- Le référentiel, pour savoir quoi retenir ----------------------------- */
async function referentiel() {
  const source = await readFile(join(RACINE, "assets/referentiel.js"), "utf8");
  const faux = {};
  new Function("window", source)(faux);
  return faux.VEILLE;
}

const sansAccent = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const normalise = (s) => sansAccent(String(s)).toLowerCase().replace(/\s+/g, " ");

/* --- Téléchargement -------------------------------------------------------- */
async function recupere(url) {
  const r = await fetch(url, { headers: { "user-agent": "pierrel-co-veille/1.0" } });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText} sur ${url}`);
  return r;
}

function expliqueReseau(e) {
  const m = String(e && e.message || e);
  if (/ECONNREFUSED|403|CONNECT|fetch failed|ENOTFOUND|certificate/i.test(m)) {
    console.error(
      "\nLa connexion à " + BASE + " a été refusée.\n" +
      "Ce n'est pas une panne du site : la politique réseau de l'environnement\n" +
      "bloque l'hôte. Il faut autoriser « echanges.dila.gouv.fr » dans les\n" +
      "domaines autorisés de l'environnement, puis relancer.\n" +
      "Détail : " + m + "\n");
  } else {
    console.error("\nÉchec : " + m + "\n");
  }
}

/* --- Quelles archives prendre --------------------------------------------- */
/* La page d'index est un listing de liens. On en tire les archives datées, et
   on garde celles de la fenêtre demandée. Le nom varie selon les lots publiés
   par la DILA : on repère la date dans le nom, quelle que soit sa forme. */
function archivesDuListing(html, depuis) {
  const liens = [...html.matchAll(/href="([^"]+\.(?:tar\.gz|tgz))"/gi)].map((m) => m[1]);
  const avecDate = [];
  for (const lien of liens) {
    const m = lien.match(/(20\d{2})[-_]?(\d{2})[-_]?(\d{2})/);
    if (!m) continue;
    const date = `${m[1]}-${m[2]}-${m[3]}`;
    if (date >= depuis) avecDate.push({ lien, date });
  }
  avecDate.sort((a, b) => (a.date < b.date ? 1 : -1));
  return avecDate;
}

/* --- Extraction d'un texte depuis son XML ---------------------------------- */
/* Pas de dépendance : un extracteur tolérant, qui va chercher les balises
   connues du format DILA et se tait quand elles manquent. Il vaut mieux
   remonter « 0 texte extrait » qu'un contenu inventé. */
const entre = (xml, balise) => {
  const m = xml.match(new RegExp(`<${balise}[^>]*>([\\s\\S]*?)</${balise}>`, "i"));
  return m ? m[1] : "";
};
const texteBrut = (x) => x
  .replace(/<br\s*\/?>/gi, "\n")
  .replace(/<\/p>/gi, "\n\n")
  .replace(/<[^>]+>/g, " ")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
  .replace(/&amp;/g, "&")
  .replace(/[ \t]+/g, " ")
  .replace(/\n{3,}/g, "\n\n")
  .trim();

function lisTexte(xml) {
  const id = texteBrut(entre(xml, "ID")) || texteBrut(entre(xml, "ID_ELI"));
  const titre = texteBrut(entre(xml, "TITREFULL")) ||
                texteBrut(entre(xml, "TITRE_TXT")) ||
                texteBrut(entre(xml, "TITRE"));
  const nature = texteBrut(entre(xml, "NATURE")) || "Texte";
  const date = (texteBrut(entre(xml, "DATE_PUBLI")) ||
                texteBrut(entre(xml, "DATE_TEXTE")) || "").slice(0, 10);
  const corps = texteBrut(entre(xml, "BLOC_TEXTUEL")) ||
                texteBrut(entre(xml, "CONTENU")) ||
                texteBrut(entre(xml, "TEXTE"));
  const nota = texteBrut(entre(xml, "NOTA"));
  if (!titre) return null;
  return { id, titre, nature, date, corps, nota };
}

/* --- Rattachement aux domaines --------------------------------------------- */
function rattache(V, t) {
  const foin = normalise(`${t.titre} ${t.corps.slice(0, 20000)}`);
  const touches = [];
  for (const [id, d] of Object.entries(V.domaines)) {
    const mots = (d.motsCles || []).map(normalise).filter((m) => m.length > 4);
    const trouves = mots.filter((m) => foin.includes(m));
    if (trouves.length) touches.push({ id, nom: d.nom, mots: trouves.slice(0, 3) });
  }
  return touches;
}

/* --- Programme ------------------------------------------------------------- */
async function main() {
  const V = await referentiel();

  const depuis = DEPUIS || (() => {
    const d = new Date(Date.now() - JOURS * 86400000);
    return d.toISOString().slice(0, 10);
  })();
  console.log(`Relève du Journal officiel depuis le ${depuis}.`);
  console.log(`Source : ${BASE}\n`);

  let listing;
  try {
    listing = await (await recupere(BASE)).text();
  } catch (e) {
    expliqueReseau(e);
    process.exit(2);
  }

  const archives = archivesDuListing(listing, depuis);
  if (!archives.length) {
    console.error("Aucune archive datée trouvée dans l'index. Le format du listing a pu changer :\n" +
                  "vérifier " + BASE + " à la main avant de modifier l'extracteur.");
    process.exit(3);
  }
  console.log(`${archives.length} archive(s) à prendre.`);

  await rm(TRAVAIL, { recursive: true, force: true });
  await mkdir(TRAVAIL, { recursive: true });

  const textes = [];
  for (const a of archives) {
    const url = new URL(a.lien, BASE).href;
    const fichier = join(TRAVAIL, a.lien.split("/").pop());
    process.stdout.write(`  ${a.date} … `);
    try {
      const r = await recupere(url);
      await writeFile(fichier, Buffer.from(await r.arrayBuffer()));
      const dossier = join(TRAVAIL, a.date);
      await mkdir(dossier, { recursive: true });
      await execFileP("tar", ["-xzf", fichier, "-C", dossier]);
      const xmls = await tousLesXml(dossier);
      let gardes = 0;
      for (const x of xmls) {
        const t = lisTexte(await readFile(x, "utf8"));
        if (!t || !t.corps) continue;
        const domaines = rattache(V, t);
        if (!domaines.length) continue;
        textes.push({ ...t, date: t.date || a.date, domaines });
        gardes++;
      }
      console.log(`${xmls.length} textes, ${gardes} retenus`);
    } catch (e) {
      console.log("échec — " + String(e.message || e));
    }
  }

  if (!textes.length) {
    console.error("\nAucun texte retenu. Rien n'est écrit : mieux vaut un relevé absent\n" +
                  "qu'un relevé inventé. Vérifier l'extracteur contre un XML réel.");
    process.exit(4);
  }

  textes.sort((a, b) => (a.date < b.date ? 1 : -1));
  const vus = new Set();
  const propres = textes.filter((t) => {
    const cle = t.id || t.titre;
    if (vus.has(cle)) return false;
    vus.add(cle);
    return true;
  });

  await writeFile(SORTIE, JSON.stringify({
    source: BASE,
    licence: "Licence Ouverte — textes officiels de la République française",
    releve_le: new Date().toISOString().slice(0, 10),
    depuis,
    textes: propres
  }, null, 1));

  if (!GARDER) await rm(TRAVAIL, { recursive: true, force: true });
  console.log(`\n${propres.length} textes écrits dans contenu/jo-releve.json.`);
  console.log("Relancer node build.mjs pour les publier.");
}

async function tousLesXml(dossier) {
  const out = [];
  for (const e of await readdir(dossier, { withFileTypes: true })) {
    const p = join(dossier, e.name);
    if (e.isDirectory()) out.push(...await tousLesXml(p));
    else if (/\.xml$/i.test(e.name)) out.push(p);
  }
  return out;
}

main().catch((e) => { expliqueReseau(e); process.exit(1); });
