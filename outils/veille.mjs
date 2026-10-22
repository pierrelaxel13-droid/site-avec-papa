#!/usr/bin/env node
/* ==========================================================================
   Pierrel & Co — la relève
   --------------------------------------------------------------------------
   Va chercher ce qui paraît sur les sources officielles, en extrait ce qui
   touche un domaine du référentiel, et écrit contenu/veille-releve.json, que
   build.mjs publie dans l'application.

   LES SOURCES
   Déclarées dans contenu/sources.js. Deux méthodes :
     dila — les archives ouvertes de la DILA (Journal officiel), sans compte,
            un XML par texte, contenu intégral ;
     rss  — un flux RSS ou Atom : titre, date, résumé, lien.

   DEUX GENRES, QU'IL NE FAUT PAS CONFONDRE
     texte     — du droit : loi, décret, arrêté, règlement.
     actualite — un commentaire officiel : guide, avis, doctrine, alerte.
   L'application les sépare, et la fiche le dit.

   USAGE
     node outils/veille.mjs                 # les 7 derniers jours
     node outils/veille.mjs --jours 30
     node outils/veille.mjs --depuis 2026-10-01
     node outils/veille.mjs --verifier      # interroge chaque source et s'arrête
     node outils/veille.mjs --source cnil   # une seule source
     node outils/veille.mjs --garder        # garde les archives téléchargées

   CE QUE LE ROBOT NE FAIT JAMAIS
   Inventer. Une source injoignable est signalée par son nom et son code
   d'erreur ; un flux au format inattendu remonte « 0 entrée » ; et si la
   relève entière ne ramène rien, rien n'est écrit. Mieux vaut une page qui dit
   « aucune relève » qu'une page qui affirme sans savoir.

   SI TOUT REFUSE DE SE CONNECTER
   L'environnement de développement a une politique réseau qui bloque ces
   hôtes. Sur les machines de construction de Netlify, le réseau est libre :
   c'est là que la relève tourne, à chaque publication (voir netlify.toml).
   ========================================================================== */

import { mkdir, readFile, writeFile, rm, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TRAVAIL = join(RACINE, ".releve");
const SORTIE = join(RACINE, "contenu", "veille-releve.json");

/* --- Arguments ------------------------------------------------------------ */
const args = process.argv.slice(2);
const valeur = (nom, defaut) => {
  const i = args.indexOf(nom);
  return i !== -1 && args[i + 1] ? args[i + 1] : defaut;
};
const JOURS = Number(valeur("--jours", 7));
const DEPUIS = valeur("--depuis", null);
const UNE = valeur("--source", null);
const VERIFIER = args.includes("--verifier");
const GARDER = args.includes("--garder");

/* --- Chargement des fichiers du dépôt -------------------------------------- */
async function charge(chemin, cle) {
  const source = await readFile(join(RACINE, chemin), "utf8");
  const faux = {};
  new Function("window", source)(faux);
  return faux[cle];
}

const sansAccent = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const normalise = (s) => sansAccent(String(s)).toLowerCase().replace(/\s+/g, " ");

/* --- Réseau ---------------------------------------------------------------- */
/* Un échec n'est jamais masqué : on remonte le code, et le programme continue
   avec les autres sources. Une source muette doit se voir dans le rapport. */
async function recupere(url, delai = 20000) {
  const stop = AbortSignal.timeout(delai);
  const r = await fetch(url, {
    signal: stop,
    redirect: "follow",
    headers: { "user-agent": "pierrel-co-veille/1.0 (+veille reglementaire)" }
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r;
}

function diagnostic(e) {
  const m = String((e && e.message) || e);
  if (/fetch failed|ECONNREFUSED|ENOTFOUND|CONNECT|403/i.test(m)) {
    return "injoignable (" + m + ") — hôte probablement refusé par la politique réseau";
  }
  if (/timeout|aborted/i.test(m)) return "délai dépassé";
  return m;
}

/* --- Lecture d'un flux RSS ou Atom ----------------------------------------- */
const entre = (x, balise) => {
  const m = x.match(new RegExp(`<${balise}[^>]*>([\\s\\S]*?)</${balise}>`, "i"));
  return m ? m[1] : "";
};
const texteBrut = (x) => String(x)
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/<br\s*\/?>/gi, "\n")
  .replace(/<\/p>/gi, "\n\n")
  .replace(/<[^>]+>/g, " ")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
  .replace(/&(?:nbsp|#160);/g, " ")
  .replace(/&amp;/g, "&")
  .replace(/[ \t]+/g, " ")
  .replace(/\n{3,}/g, "\n\n")
  .trim();

function dateIso(s) {
  if (!s) return "";
  const d = new Date(s);
  return isNaN(d) ? "" : d.toISOString().slice(0, 10);
}

function lisFlux(xml) {
  const blocs = [
    ...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi),
    ...xml.matchAll(/<entry[\s>][\s\S]*?<\/entry>/gi)
  ].map((m) => m[0]);

  return blocs.map((b) => {
    const lienAtom = b.match(/<link[^>]*href="([^"]+)"/i);
    return {
      titre: texteBrut(entre(b, "title")),
      lien: lienAtom ? lienAtom[1] : texteBrut(entre(b, "link")),
      date: dateIso(texteBrut(entre(b, "pubDate")) || texteBrut(entre(b, "updated")) ||
                    texteBrut(entre(b, "published")) || texteBrut(entre(b, "dc:date"))),
      corps: texteBrut(entre(b, "content:encoded")) || texteBrut(entre(b, "description")) ||
             texteBrut(entre(b, "summary")) || texteBrut(entre(b, "content"))
    };
  }).filter((x) => x.titre);
}

/* --- Lecture d'un texte du Journal officiel (format DILA) ------------------ */
function lisTexteDila(xml) {
  const titre = texteBrut(entre(xml, "TITREFULL")) || texteBrut(entre(xml, "TITRE_TXT")) ||
                texteBrut(entre(xml, "TITRE"));
  if (!titre) return null;
  const corps = texteBrut(entre(xml, "BLOC_TEXTUEL")) || texteBrut(entre(xml, "CONTENU")) ||
                texteBrut(entre(xml, "TEXTE"));
  return {
    id: texteBrut(entre(xml, "ID")) || texteBrut(entre(xml, "ID_ELI")),
    titre,
    nature: texteBrut(entre(xml, "NATURE")) || "Texte",
    date: (texteBrut(entre(xml, "DATE_PUBLI")) || texteBrut(entre(xml, "DATE_TEXTE")) || "").slice(0, 10),
    corps,
    nota: texteBrut(entre(xml, "NOTA"))
  };
}

/* --- Rattachement aux domaines --------------------------------------------- */
/* Un texte n'est retenu que si un mot-clé d'un domaine apparaît. Les mots de
   moins de cinq lettres sont écartés : « eau » ou « air » ramèneraient tout. */
function rattache(V, titre, corps) {
  const foin = normalise(`${titre} ${String(corps).slice(0, 20000)}`);
  const touches = [];
  for (const [id, d] of Object.entries(V.domaines)) {
    const mots = (d.motsCles || []).map(normalise).filter((m) => m.length > 4);
    const trouves = mots.filter((m) => foin.includes(m));
    if (trouves.length) touches.push({ id, nom: d.nom, mots: trouves.slice(0, 3) });
  }
  return touches;
}

/* --- Relève d'une source par flux ------------------------------------------ */
async function relevéFlux(V, s, depuis) {
  const xml = await (await recupere(s.url)).text();
  const entrees = lisFlux(xml);
  if (!entrees.length) {
    return { entrees: 0, retenus: [], souci: "format inattendu — aucune entrée lue" };
  }
  const retenus = [];
  for (const e of entrees) {
    if (e.date && e.date < depuis) continue;
    const domaines = rattache(V, e.titre, e.corps);
    if (!domaines.length) continue;
    retenus.push({
      source: s.id, sourceNom: s.nom, genre: s.genre,
      id: e.lien || `${s.id}:${e.titre}`,
      titre: e.titre, nature: s.genre === "texte" ? "Texte officiel" : "Publication officielle",
      date: e.date || depuis, corps: e.corps, lien: e.lien, domaines
    });
  }
  return { entrees: entrees.length, retenus };
}

/* --- Relève du Journal officiel (archives DILA) ---------------------------- */
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

async function tousLesXml(dossier) {
  const out = [];
  for (const e of await readdir(dossier, { withFileTypes: true })) {
    const p = join(dossier, e.name);
    if (e.isDirectory()) out.push(...await tousLesXml(p));
    else if (/\.xml$/i.test(e.name)) out.push(p);
  }
  return out;
}

async function relevéDila(V, s, depuis) {
  const listing = await (await recupere(s.url, 30000)).text();
  const archives = archivesDuListing(listing, depuis);
  if (!archives.length) {
    return { entrees: 0, retenus: [], souci: "aucune archive datée dans l'index — format du listing à revoir" };
  }

  await mkdir(TRAVAIL, { recursive: true });
  const retenus = [];
  let entrees = 0;
  for (const a of archives) {
    const url = new URL(a.lien, s.url).href;
    const fichier = join(TRAVAIL, a.lien.split("/").pop());
    try {
      const r = await recupere(url, 120000);
      await writeFile(fichier, Buffer.from(await r.arrayBuffer()));
      const dossier = join(TRAVAIL, a.date);
      await mkdir(dossier, { recursive: true });
      await execFileP("tar", ["-xzf", fichier, "-C", dossier]);
      for (const x of await tousLesXml(dossier)) {
        const t = lisTexteDila(await readFile(x, "utf8"));
        if (!t || !t.corps) continue;
        entrees++;
        const domaines = rattache(V, t.titre, t.corps);
        if (!domaines.length) continue;
        retenus.push({
          source: s.id, sourceNom: s.nom, genre: "texte",
          id: t.id || t.titre, titre: t.titre, nature: t.nature,
          date: t.date || a.date, corps: t.corps, nota: t.nota,
          lien: t.id ? `https://www.legifrance.gouv.fr/jorf/id/${t.id}` : "",
          domaines
        });
      }
    } catch (e) {
      console.log(`      ${a.date} : ${diagnostic(e)}`);
    }
  }
  return { entrees, retenus };
}

/* --- Programme -------------------------------------------------------------- */
async function main() {
  const V = await charge("assets/referentiel.js", "VEILLE");
  const SOURCES = (await charge("contenu/sources.js", "SOURCES"))
    .filter((s) => !UNE || s.id === UNE);

  if (!SOURCES.length) {
    console.error(`Aucune source nommée « ${UNE} » dans contenu/sources.js.`);
    process.exit(2);
  }

  const depuis = DEPUIS || new Date(Date.now() - JOURS * 86400000).toISOString().slice(0, 10);

  if (VERIFIER) {
    console.log(`Vérification de ${SOURCES.length} sources.\n`);
    let vivantes = 0;
    for (const s of SOURCES) {
      process.stdout.write(`  ${s.id.padEnd(16)} `);
      try {
        const r = await recupere(s.url, 15000);
        const corps = await r.text();
        const n = s.type === "dila"
          ? archivesDuListing(corps, "2000-01-01").length
          : lisFlux(corps).length;
        console.log(`répond — ${n} ${s.type === "dila" ? "archives" : "entrées"}` +
                    (n ? "" : "  ← format à revoir"));
        if (n) vivantes++;
      } catch (e) {
        console.log(diagnostic(e));
      }
    }
    console.log(`\n${vivantes} source(s) sur ${SOURCES.length} exploitables.`);
    console.log("Passer « confirme: true » dans contenu/sources.js pour celles-là, et seulement celles-là.");
    return;
  }

  console.log(`Relève depuis le ${depuis}, sur ${SOURCES.length} sources.\n`);
  await rm(TRAVAIL, { recursive: true, force: true });

  const tout = [];
  const rapport = [];
  for (const s of SOURCES) {
    process.stdout.write(`  ${s.id.padEnd(16)} `);
    try {
      const r = s.type === "dila" ? await relevéDila(V, s, depuis) : await relevéFlux(V, s, depuis);
      tout.push(...r.retenus);
      rapport.push({ id: s.id, nom: s.nom, entrees: r.entrees, retenus: r.retenus.length, souci: r.souci || null });
      console.log(`${r.entrees} lus, ${r.retenus.length} retenus` + (r.souci ? `  ← ${r.souci}` : ""));
    } catch (e) {
      const souci = diagnostic(e);
      rapport.push({ id: s.id, nom: s.nom, entrees: 0, retenus: 0, souci });
      console.log(souci);
    }
  }

  if (!tout.length) {
    console.error("\nAucune entrée retenue : rien n'est écrit.\n" +
      "Le fichier contenu/veille-releve.json n'est pas touché, et l'application\n" +
      "continuera d'afficher « aucune relève ». C'est voulu : mieux vaut une page\n" +
      "qui dit ne rien savoir qu'une page qui affirme sans savoir.");
    process.exit(4);
  }

  tout.sort((a, b) => (a.date < b.date ? 1 : -1));
  const vus = new Set();
  const propres = tout.filter((t) => (vus.has(t.id) ? false : (vus.add(t.id), true)));

  await writeFile(SORTIE, JSON.stringify({
    licence: "Textes officiels de la République française — Licence Ouverte. " +
             "Publications des autorités citées, reproduites avec leur source et leur date.",
    releve_le: new Date().toISOString().slice(0, 10),
    depuis,
    rapport,
    textes: propres
  }, null, 1));

  if (!GARDER) await rm(TRAVAIL, { recursive: true, force: true });

  const parGenre = propres.reduce((a, t) => ((a[t.genre] = (a[t.genre] || 0) + 1), a), {});
  console.log(`\n${propres.length} entrées écrites dans contenu/veille-releve.json`);
  console.log(`  ${parGenre.texte || 0} textes de droit, ${parGenre.actualite || 0} publications officielles.`);
  console.log("Relancer node build.mjs pour les publier.");
}

main().catch((e) => {
  console.error("\nÉchec : " + diagnostic(e));
  process.exit(1);
});
