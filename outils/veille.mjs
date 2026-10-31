#!/usr/bin/env node
/* ==========================================================================
   Vigie — la relève
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
     node outils/veille.mjs --decouvrir     # cherche le vrai flux des sources muettes
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
import { controle } from "./controles.mjs";
import { rattache, dateDuTitre, ficheAncienne, texteBrut } from "./tri.mjs";

const execFileP = promisify(execFile);
const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TRAVAIL = join(RACINE, ".releve");
const SORTIE = join(RACINE, "contenu", "veille-releve.json");
/* Le bilan du passage, pour son journal (outils/journal-collecte.mjs). Il
   n'est pas commité : il change à chaque passage. */
const BILAN = process.env.BILAN || join(RACINE, "releve-bilan.json");
const ecrireBilan = (b) => writeFile(BILAN, JSON.stringify({ le: new Date().toISOString(), ...b }, null, 1));

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
const DECOUVRIR = args.includes("--decouvrir");
const GARDER = args.includes("--garder");

/* --- Chargement des fichiers du dépôt -------------------------------------- */
async function charge(chemin, cle) {
  const source = await readFile(join(RACINE, chemin), "utf8");
  const faux = {};
  new Function("window", source)(faux);
  return faux[cle];
}


/* --- Réseau ---------------------------------------------------------------- */
/* Un échec n'est jamais masqué : on remonte le code, et le programme continue
   avec les autres sources. Une source muette doit se voir dans le rapport. */
/* Une source rate parfois une relève et revient à la suivante (l'Ineris a
   répondu 403 une fois le 26 octobre, l'AMF une autre fois). On réessaie donc
   une fois, quinze secondes plus tard, sur un échec passager : délai,
   connexion coupée, 403, 429, 5xx. Pas plus, et toujours sous notre nom : un
   site qui refuse deux fois est noté comme tel. */
const PASSAGER = /timeout|aborted|fetch failed|ECONNRESET|UND_ERR|HTTP (403|408|429|5\d\d)/i;
async function recupere(url, delai = 20000, essai = 1) {
  try {
    const stop = AbortSignal.timeout(delai);
    const r = await fetch(url, {
      signal: stop,
      redirect: "follow",
      headers: { "user-agent": "pierrel-co-veille/1.0 (+veille reglementaire)" }
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r;
  } catch (e) {
    const m = String((e && e.message) || e) + " " + String((e && e.cause && (e.cause.code || e.cause.message)) || "");
    if (essai < 2 && !DECOUVRIR && PASSAGER.test(m)) {
      await new Promise((ok) => setTimeout(ok, 15000));
      return recupere(url, delai, essai + 1);
    }
    throw e;
  }
}

function diagnostic(e) {
  /* « fetch failed » ne dit rien : la vraie raison est dans e.cause — un nom
     d'hôte inconnu, une connexion coupée, un certificat incomplet. */
  const cause = e && e.cause && (e.cause.code || e.cause.message);
  const m = String((e && e.message) || e) + (cause ? ` : ${cause}` : "");
  if (/fetch failed|ECONNREFUSED|ENOTFOUND|CONNECT|403/i.test(m)) {
    return "injoignable (" + m + ") — l'hôte refuse le robot, ou le réseau d'ici le bloque";
  }
  if (/timeout|aborted/i.test(m)) return "délai dépassé";
  return m;
}

/* --- Lecture d'un flux RSS ou Atom ----------------------------------------- */
const entre = (x, balise) => {
  const m = x.match(new RegExp(`<${balise}[^>]*>([\\s\\S]*?)</${balise}>`, "i"));
  return m ? m[1] : "";
};


function dateIso(s) {
  if (!s) return "";
  /* Certains sites publics datent à la française : 24/10/2026. */
  const fr = String(s).match(/^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (fr) return `${fr[3]}-${fr[2].padStart(2, "0")}-${fr[1].padStart(2, "0")}`;
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

/* --- Lecture d'une API de données ouvertes (Opendatasoft) ------------------ */
/* Certaines administrations n'ont pas de flux mais publient leurs données :
   RappelConso, par exemple, sur data.economie.gouv.fr. La source dit quels
   champs donnent le titre, la date, le lien et le corps ; rien d'autre n'est lu. */
const propre = (v) => (v == null ? "" : (Array.isArray(v) ? v.join(", ") : String(v)))
  .split("|").map((x) => x.trim()).filter(Boolean).join(", ");
const majuscule = (x) => x.charAt(0).toUpperCase() + x.slice(1);

function lisOds(json, champs) {
  let d;
  try { d = JSON.parse(json); } catch { return []; }
  const vus = new Set();
  return (d.results || []).map((r) => ({
    titre: champs.titre.map((c) => majuscule(propre(r[c]))).filter(Boolean).join(" — "),
    lien: propre(r[champs.lien]),
    date: dateIso(r[champs.date]),
    corps: Object.entries(champs.corps)
      .map(([etiquette, c]) => (propre(r[c]) ? `${etiquette} : ${majuscule(propre(r[c]))}.` : ""))
      .filter(Boolean).join("\n\n")
  /* Une fiche corrigée reparaît avec un nouveau numéro de version et le même
     lien : on n'en garde qu'une, la plus récente, qui vient en premier. */
  })).filter((x) => x.titre && !(x.lien && vus.has(x.lien)) && (vus.add(x.lien), true));
}

const lisSource = (s, corps) => (s.type === "ods" ? lisOds(corps, s.champs) : lisFlux(corps));

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

/* --- Fondre les morceaux d'un même texte ------------------------------------
   Les archives du Journal officiel donnent un fichier par ARTICLE et par
   SECTION, pas un par texte : un décret de 2013 est arrivé en 1 482 morceaux,
   tous avec le même titre. Publier ça, c'est publier mille fois le même texte.
   On refond donc par titre, en recollant les morceaux dans l'ordre où ils sont
   venus, sans répéter deux fois le même. */
const PLAFOND_CORPS = 60000;

function fond(entrees) {
  const par = new Map();
  for (const t of entrees) {
    /* La clé est le titre seul : un titre de texte officiel porte sa date,
       donc deux textes différents ne peuvent pas la partager. Le même texte
       reparaît en revanche dans les archives de plusieurs jours — c'est ce
       qu'on veut fondre. On garde la date la plus récente où on l'a vu. */
    const cle = t.titre;
    if (!par.has(cle)) par.set(cle, { ...t, corps: "", morceaux: 0, vus: new Set() });
    const e = par.get(cle);
    if (t.date > e.date) e.date = t.date;
    const c = String(t.corps || "").trim();
    if (!c || e.vus.has(c)) continue;
    e.vus.add(c);
    e.morceaux++;
    if (e.corps.length < PLAFOND_CORPS) e.corps += (e.corps ? "\n\n" : "") + c;
  }
  return [...par.values()].map((e) => {
    delete e.vus;
    /* Le plafond vaut pour le résultat, pas seulement pour la décision
       d'ajouter : un seul morceau peut être énorme à lui tout seul. */
    if (e.corps.length > PLAFOND_CORPS) {
      e.corps = `${e.corps.slice(0, PLAFOND_CORPS).replace(/\s+\S*$/, "")}` +
        "\n\n[…] Texte tronqué ici ; la suite est à la source.";
    }
    return e;
  });
}

/* --- Relève d'une source par flux ------------------------------------------ */
/* Une entrée sans date — le BOFiP n'en met pas — n'en reçoit pas une
   inventée : elle prend le jour où la relève l'a vue pour la première fois, et
   le garde d'une relève à l'autre. */
const AUJOURDHUI = new Date().toISOString().slice(0, 10);
let DEJA_VUS = new Map();
let AVANT = [];
async function chargeDejaVus() {
  try {
    const avant = JSON.parse(await readFile(SORTIE, "utf8"));
    AVANT = avant.textes || [];
    DEJA_VUS = new Map(AVANT.map((t) => [t.id, t.vuLe || t.date]));
  } catch { /* première relève : rien à reprendre */ }
}

async function relevéFlux(V, s, depuis) {
  /* Une source pas encore confirmée n'a pas droit au second essai : elle
     ne répond pas d'habitude, inutile d'attendre deux fois. */
  const xml = await (await recupere(s.url, 20000, s.confirme ? 1 : 2)).text();
  const entrees = lisSource(s, xml);
  if (!entrees.length) {
    /* Un flux bien formé mais vide — l'ANSM ne garde que ceux du jour — n'est
       pas un souci : la source a répondu, elle n'avait rien. */
    const vide = s.type === "ods" ? /"results"\s*:\s*\[\s*\]/.test(xml) : /<(channel|feed)[\s>]/i.test(xml);
    return { entrees: 0, retenus: [], souci: vide ? null : "format inattendu — aucune entrée lue" };
  }
  const retenus = [];
  for (const e of entrees) {
    if (e.date && e.date < depuis) continue;
    const domaines = rattache(V, e.titre, s.id);
    if (!domaines.length) continue;
    retenus.push({
      source: s.id, sourceNom: s.nom, genre: s.genre,
      id: e.lien || `${s.id}:${e.titre}`,
      titre: e.titre, nature: s.genre === "texte" ? "Texte officiel" : "Publication officielle",
      date: e.date || DEJA_VUS.get(e.lien || `${s.id}:${e.titre}`) || AUJOURDHUI,
      corps: e.corps, lien: /^https?:\/\//i.test(e.lien || "") ? e.lien : "", domaines
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
  let entrees = 0, anciennes = 0;
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
        if (ficheAncienne(t.titre, t.date, a.date)) { anciennes++; continue; }
        const domaines = rattache(V, t.titre, s.id);
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
  if (anciennes) console.log(`      ${anciennes} fiches d'anciens textes renvoyées par les archives : écartées`);
  return { entrees, retenus, derniere: archives[0].date };
}

/* --- Trouver le vrai flux d'une source muette ------------------------------ */
/* Une adresse de flux, ça se périme : un site change d'outil, et /rss devient
   /feed/. Plutôt que de deviner, on demande au site lui-même :
     1. les pistes connues (relevées dans la documentation de chaque site) ;
     2. les liens que ses pages déclarent : <link rel="alternate" type="…rss…">
        et les liens dont l'adresse parle de rss, feed, atom ou backend ;
     3. les chemins que les outils courants donnent par défaut.
   Une adresse n'est retenue que si elle renvoie de vraies entrées, datées.
   Le robot se présente sous son nom et ne contourne rien : un site qui le
   refuse est noté comme tel. */
const PISTES = {
  "eurlex-l":    { pages: ["https://eur-lex.europa.eu/oj/direct-access.html"],
                   flux: ["https://eur-lex.europa.eu/FR/display-feed.rss?rssId=165",
                          "https://eur-lex.europa.eu/EN/display-feed.rss?rssId=165"] },
  inrs:          { pages: ["https://www.inrs.fr/actualites.html", "https://www.inrs.fr/"], flux: [] },
  travail:       { pages: ["https://travail-emploi.gouv.fr/"],
                   flux: ["https://travail-emploi.gouv.fr/rss.xml"] },
  oppbtp:        { pages: ["https://www.oppbtp.com/actualites/", "https://www.preventionbtp.fr/"],
                   flux: ["https://www.oppbtp.com/feed/", "https://www.oppbtp.com/actualites/feed/"] },
  boss:          { pages: ["https://boss.gouv.fr/portail/accueil.html"], flux: [] },
  urssaf:        { pages: ["https://www.urssaf.fr/accueil.html"], flux: [] },
  bofip:         { pages: ["https://bofip.impots.gouv.fr/flux-rss"],
                   flux: ["https://bofip.impots.gouv.fr/bofip/ext/rss.xml?actualites=1&maxR=50&maxJ=30"] },
  ecologie:      { pages: ["https://www.ecologie.gouv.fr/flux-rss"], flux: [] },
  "ineris-aida": { pages: ["https://aida.ineris.fr/thematiques/prevention-risques",
                           "https://aida.ineris.fr/user/thematic-subscription", "https://aida.ineris.fr/"],
                   flux: ["https://aida.ineris.fr/rss.xml"] },
  ademe:         { pages: ["https://librairie.ademe.fr/", "https://www.ademe.fr/presse/", "https://www.ademe.fr/"],
                   flux: ["https://www.ademe.fr/feed/", "https://www.ademe.fr/actualites/feed/",
                          "https://www.ademe.fr/presse/communiques-de-presse/feed/"] },
  dgccrf:        { pages: ["https://www.economie.gouv.fr/dgccrf"],
                   flux: ["https://www.economie.gouv.fr/dgccrf/rss",
                          "https://www.economie.gouv.fr/rss/toutesactualites"] },
  anses:         { pages: ["https://www.anses.fr/fr/content/flux-rss-de-lanses"], flux: [] },
  entreprendre:  { pages: ["https://entreprendre.service-public.gouv.fr/actualites"],
                   flux: ["https://www.service-public.gouv.fr/abonnements/rss/actu-actu-pro.rss",
                          "https://entreprendre.service-public.gouv.fr/abonnements/rss/actu-actu-pro.rss"] },
  acpr:          { pages: ["https://acpr.banque-france.fr/fr"], flux: [] },
  amf:           { pages: ["https://www.amf-france.org/fr/abonnements-flux-rss",
                           "https://www.amf-france.org/fr/flux-rss/display/30"],
                   flux: ["https://www.amf-france.org/fr/flux-rss/display/30"] },
  arcep:         { pages: ["https://en.arcep.fr/news/arcep-rss-news-feeds.html"],
                   flux: ["https://www.arcep.fr/actualites/suivre-actualite-regulation-arcep/fil-dinfos/rss.xml"] },
  has:           { pages: ["https://www.has-sante.fr/jcms/c_1771214/fr/nos-flux-d-information-rss"],
                   flux: ["https://www.has-sante.fr/feed/Rss2.jsp?id=p_3081656",
                          "https://www.has-sante.fr/feed/Rss2.jsp?id=p_3081452"] },
  ansm:          { pages: ["https://ansm.sante.fr/page/flux-rss"],
                   flux: ["https://ansm.sante.fr/rss/actualites", "https://ansm.sante.fr/rss/informations_securite"] },
  rappelconso:   { pages: ["https://rappel.conso.gouv.fr/"],
                   flux: ["https://rappel.conso.gouv.fr/rss?categorie=0",
                          /* Les données ouvertes de Bercy : pas de flux, mais une API.
                             On en lit la description et un enregistrement, pour savoir
                             comment la lire. */
                          "https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/rappelconso-v2-gtin-espaces/records?limit=1",
                          "https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/rappelconso-v2-gtin-trie/records?limit=1"] },
  boamp:         { pages: ["https://www.boamp.fr/"],
                   flux: ["https://boamp-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/boamp/exports/rss?order_by=dateparution%20desc&limit=50"] }
};
const CHEMINS_COURANTS = ["/feed/", "/rss", "/rss.xml", "/fr/rss.xml", "/feed.xml", "/atom.xml",
                          "/index.xml", "/spip.php?page=backend"];

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const echappe = (x) => x.replace(/&amp;/g, "&").replace(/&#0?38;/g, "&");

/* Les liens qu'une page déclare comme flux, ou qui en ont tout l'air. */
function liensDeFlux(html, base) {
  const vus = new Set();
  const garde = (href) => {
    try {
      const u = new URL(echappe(href), base);
      if (!/^https?:$/.test(u.protocol)) return;
      vus.add(u.href);
    } catch { /* lien mal formé : ignoré */ }
  };
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const l = m[0];
    if (/rel=["']?alternate/i.test(l) && /type=["']?application\/(rss|atom)\+xml/i.test(l)) {
      const h = l.match(/href=["']([^"']+)["']/i);
      if (h) garde(h[1]);
    }
  }
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)) {
    if (/rss|feed|atom|backend|\.xml(\?|$)/i.test(m[1]) && !/sitemap|feedback|facebook|twitter|linkedin|x\.com/i.test(m[1])) {
      garde(m[1]);
    }
  }
  return [...vus].slice(0, 25);
}

async function essaieFlux(url) {
  try {
    const r = await recupere(url, 15000);
    const corps = await r.text();
    const entrees = lisFlux(corps);
    const dates = entrees.map((x) => x.date).filter(Boolean).sort();
    return { url, ok: true, entrees: entrees.length, datees: dates.length,
             derniere: dates[dates.length - 1] || "", type: r.headers.get("content-type") || "",
             titre: texteBrut(entre(corps, "title")).slice(0, 90), corps,
             apercu: corps.replace(/\s+/g, " ").trim().slice(0, 2500) };
  } catch (e) {
    return { url, ok: false, souci: diagnostic(e) };
  }
}

async function decouvre(SOURCES) {
  const muettes = SOURCES.filter((s) => !s.confirme && s.type !== "dila");
  console.log(`Recherche du flux de ${muettes.length} sources muettes.\n`);
  const bilan = [];
  for (const s of muettes) {
    const p = PISTES[s.id] || { pages: [], flux: [] };
    console.log(`■ ${s.id} — ${s.nom}`);
    const essayees = new Set();
    const resultats = [];
    const essaie = async (url, d_ou) => {
      if (essayees.has(url) || essayees.size >= 60) return;
      essayees.add(url);
      await pause(400);
      const r = await essaieFlux(url);
      r.d_ou = d_ou;
      resultats.push(r);
      console.log(`    ${r.ok ? (r.entrees ? "✔" : "·") : "✘"} ${url}` +
        (r.ok ? `  — ${r.entrees} entrées${r.derniere ? `, la plus récente du ${r.derniere}` : ""}` +
                (r.entrees ? `  « ${r.titre} »` : `  (${r.type.split(";")[0]})`)
              : `  — ${r.souci}`) + `  [${d_ou}]`);
      /* Du XML qui ne donne rien, ou rien de daté : on montre ce qu'il contient,
         pour savoir si c'est le flux qui est vide ou notre lecteur qui le rate. */
      if (r.ok && /xml|rss|atom|json/i.test(r.type) && (!r.entrees || !r.datees)) {
        console.log(`        contenu : ${r.apercu}`);
      }
      return r;
    };

    /* Une page qui répond sans être un flux peut en annoncer un. */
    const fouille = async (r, page, profondeur = 0) => {
      if (!r || !r.ok || r.entrees || !/html/i.test(r.type)) return;
      const liens = liensDeFlux(r.corps, page);
      console.log(`      la page déclare ${liens.length} lien(s) de flux`);
      for (const u of liens) {
        const r2 = await essaie(u, "déclaré par la page");
        /* Une page « Nos flux RSS » renvoie souvent vers d'autres pages, pas
           directement vers le flux : on descend d'un cran, pas plus. */
        if (profondeur < 1) await fouille(r2, u, profondeur + 1);
      }
    };
    await fouille(await essaie(s.url, "adresse actuelle"), s.url);
    for (const u of p.flux) await essaie(u, "piste connue");
    const origines = new Set();
    for (const page of p.pages) {
      origines.add(new URL(page).origin);
      await fouille(await essaie(page, "page du site"), page);
    }
    origines.add(new URL(s.url).origin);
    if (!resultats.some((r) => r.ok && r.entrees)) {
      for (const o of origines) for (const c of CHEMINS_COURANTS) await essaie(o + c, "chemin courant");
    }

    /* Pas de flux du tout : on montre les liens d'actualité que la page
       publie, pour juger si on peut la lire telle quelle. */
    if (!resultats.some((r) => r.ok && r.entrees)) {
      for (const r of resultats.filter((x) => x.ok && /html/i.test(x.type)).slice(0, 2)) {
        const liens = [...r.corps.matchAll(/<a\b[^>]*href=["']([^"']*actualit[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)]
          .map((m) => `${m[1]} « ${texteBrut(m[2]).slice(0, 80)} »`).slice(0, 12);
        if (liens.length) console.log(`      liens d'actualité sur ${r.url} :\n        ` + liens.join("\n        "));
      }
    }

    /* La meilleure : des entrées datées, la plus récente d'abord. */
    const bonnes = resultats.filter((r) => r.ok && r.entrees && r.datees)
      .sort((a, b) => (a.derniere < b.derniere ? 1 : a.derniere > b.derniere ? -1 : b.entrees - a.entrees));
    const tous = resultats.filter((r) => r.ok && r.entrees).map((r) =>
      ({ url: r.url, entrees: r.entrees, derniere: r.derniere, titre: r.titre, d_ou: r.d_ou }));
    const refus = resultats.filter((r) => !r.ok).map((r) => r.souci);
    bilan.push({ id: s.id, nom: s.nom, retenue: bonnes[0] ? bonnes[0].url : null,
                 derniere: bonnes[0] ? bonnes[0].derniere : null, flux: tous,
                 essais: resultats.length, refus: [...new Set(refus)].slice(0, 4) });
    console.log(bonnes[0] ? `  → RETENUE : ${bonnes[0].url}\n` : "  → aucun flux trouvé\n");
  }
  const trouvees = bilan.filter((b) => b.retenue).length;
  console.log(`${trouvees} source(s) sur ${muettes.length} ont maintenant un flux qui répond.`);
  await writeFile(join(RACINE, "contenu", "sources-decouverte.json"),
    JSON.stringify({ le: new Date().toISOString(), bilan }, null, 1));
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

  if (DECOUVRIR) return decouvre(SOURCES);

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
          : lisSource(s, corps).length;
        console.log(`répond — ${n} ${s.type === "dila" ? "archives" : "entrées"}` +
                    (n ? "" : "  ← format à revoir"));
        /* Une source qui répond sans rien donner mérite qu'on regarde ce
           qu'elle envoie : neuf fois sur dix ce n'est pas un flux, c'est une
           page d'accueil ou un message d'erreur en HTML. */
        if (!n) {
          const debut = corps.replace(/\s+/g, " ").trim().slice(0, 700);
          console.log(`${" ".repeat(18)}type : ${r.headers.get("content-type") || "inconnu"}`);
          console.log(`${" ".repeat(18)}début : ${debut}`);
          console.log(`${" ".repeat(18)}balises : ` +
            `${(corps.match(/<item[\s>]/gi) || []).length} <item>, ` +
            `${(corps.match(/<entry[\s>]/gi) || []).length} <entry>, ` +
            `${(corps.match(/<[a-z]+:item[\s>]/gi) || []).length} <ns:item>`);
        }
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
  await chargeDejaVus();
  /* Le relevé précédent, repassé au tri d'aujourd'hui : ce que le tri écarte
     désormais n'est pas « perdu », et ne doit être ni repris ni compté comme
     une chute par les contrôles (outils/controles.mjs). */
  const avantBrut = AVANT.length;
  AVANT = AVANT
    .filter((t) => !(t.source === "jorf" && ficheAncienne(t.titre, t.date, t.vuLe || t.date)))
    .map((t) => ({ ...t, domaines: rattache(V, t.titre, t.source) }))
    .filter((t) => t.domaines.length);
  if (AVANT.length < avantBrut) console.log(`Relevé précédent : ${avantBrut - AVANT.length} textes écartés par le tri actuel.\n`);
  await rm(TRAVAIL, { recursive: true, force: true });

  const tout = [];
  const rapport = [];
  let joDerniere = "";
  for (const s of SOURCES) {
    process.stdout.write(`  ${s.id.padEnd(16)} `);
    try {
      const r = s.type === "dila" ? await relevéDila(V, s, depuis) : await relevéFlux(V, s, depuis);
      if (s.id === "jorf" && r.derniere) joDerniere = r.derniere;
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
    await ecrireBilan({ statut: "echouee", examines: SOURCES.length, retenus: 0, nouveaux: 0, rapport,
      alertes: [{ niveau: "grave", source: "", quoi: "Aucune entrée retenue, sur aucune source : rien n'a été écrit." }] });
    console.error("\nAucune entrée retenue : rien n'est écrit.\n" +
      "Le fichier contenu/veille-releve.json n'est pas touché, et l'application\n" +
      "continuera d'afficher « aucune relève ». C'est voulu : mieux vaut une page\n" +
      "qui dit ne rien savoir qu'une page qui affirme sans savoir.");
    process.exit(4);
  }

  const fondus = fond(tout).map((t) => ({
    ...t,
    dateTexte: dateDuTitre(t.titre) || "",
    vuLe: t.date
  }));
  fondus.sort((a, b) => (a.vuLe < b.vuLe ? 1 : (a.vuLe > b.vuLe ? -1 : (a.titre < b.titre ? -1 : 1))));
  const vus = new Set();
  const propres = fondus.filter((t) => {
    const cle = `${t.titre}|${t.dateTexte || t.vuLe}`;
    return vus.has(cle) ? false : (vus.add(cle), true);
  });

  /* Une source qui a raté cette relève ne perd pas ses textes. Le 27 octobre
     à 5 h, le Journal officiel a coupé la connexion deux fois de suite : la
     relève a réécrit le fichier sans lui, et 130 textes ont disparu du site
     jusqu'à l'heure suivante. On reprend donc, pour chaque source muette, ses
     textes de la relève précédente encore dans la fenêtre — et le rapport le
     dit, la source reste signalée muette. */
  const muettes = new Set(rapport.filter((r) => r.souci).map((r) => r.id));
  for (const r of rapport) {
    if (!r.souci) continue;
    const repris = AVANT.filter((t) => t.source === r.id && (t.vuLe || t.date) >= depuis)
      .filter((t) => { const cle = `${t.titre}|${t.dateTexte || t.vuLe}`; return vus.has(cle) ? false : (vus.add(cle), true); });
    if (!repris.length) continue;
    propres.push(...repris);
    r.repris = repris.length;
    r.souci += ` — ${repris.length} texte${repris.length > 1 ? "s" : ""} de la relève précédente conservé${repris.length > 1 ? "s" : ""}`;
    console.log(`  ${r.id.padEnd(16)} muette : ${repris.length} textes de la relève précédente conservés`);
  }
  /* Les contrôles de vraisemblance (outils/controles.mjs). Le JO muet à ce
     passage-ci n'est pas « sans JO » : on prend alors le dernier qu'on
     connaissait. */
  const joDernier = joDerniere ||
    AVANT.filter((t) => t.source === "jorf").map((t) => t.date || t.vuLe).sort().pop() || "";
  const { alertes, nouveaux } = controle({ rapport, propres, avant: AVANT, sources: SOURCES, depuis,
    aujourdhui: new Date().toISOString().slice(0, 10), joDernier });
  for (const a of alertes) console.log(`  ${a.niveau === "grave" ? "GRAVE" : "attention"} : ${a.quoi}`);
  propres.sort((a, b) => (a.vuLe < b.vuLe ? 1 : (a.vuLe > b.vuLe ? -1 : (a.titre < b.titre ? -1 : 1))));

  /* vuA : l'heure exacte où la relève a vu ce texte pour la PREMIÈRE fois.
     C'est elle qui dit « nouveau » à l'abonné (assets/avis.js) : un texte
     relevé à 15 h est nouveau pour celui qui est passé à 14 h. Un texte déjà
     là la garde ; un texte d'avant ce champ prend le début de son jour ; à la
     toute première relève, rien n'est « nouveau ». */
  const PREMIERE = new Map(AVANT.map((t) => [t.id, t.vuA || `${t.vuLe || t.date}T00:00:00Z`]));
  const MAINTENANT = new Date().toISOString().slice(0, 19) + "Z";
  for (const t of propres) t.vuA = PREMIERE.get(t.id) || (AVANT.length ? MAINTENANT : `${t.vuLe}T00:00:00Z`);

  await writeFile(SORTIE, JSON.stringify({
    licence: "Textes officiels de la République française — Licence Ouverte. " +
             "Publications des autorités citées, reproduites avec leur source et leur date.",
    releve_le: new Date().toISOString().slice(0, 10),
    depuis,
    rapport,
    textes: propres
  }, null, 1));

  if (!GARDER) await rm(TRAVAIL, { recursive: true, force: true });
  await ecrireBilan({ statut: alertes.length ? "alerte" : "reussie", examines: SOURCES.length,
    retenus: propres.length, nouveaux, joDernier, rapport, alertes });

  const parGenre = propres.reduce((a, t) => ((a[t.genre] = (a[t.genre] || 0) + 1), a), {});
  console.log(`\n${propres.length} textes écrits dans contenu/veille-releve.json` +
    ` (${tout.length} morceaux relevés, fondus par titre)`);
  console.log(`  ${parGenre.texte || 0} textes de droit, ${parGenre.actualite || 0} publications officielles.`);
  console.log("Relancer node build.mjs pour les publier.");
}

main().catch((e) => {
  console.error("\nÉchec : " + diagnostic(e));
  process.exit(1);
});
