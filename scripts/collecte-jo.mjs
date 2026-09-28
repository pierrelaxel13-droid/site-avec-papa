#!/usr/bin/env node
/* ==========================================================================
   Collecte des textes du Journal officiel et rattachement aux domaines
   --------------------------------------------------------------------------
   Exécuté par .github/workflows/veille.yml, toutes les heures. Écrit
   data/veille-feed.json, que l'outil de veille lit côté navigateur.

   Usage :
     node scripts/collecte-jo.mjs                      # source Légifrance
     node scripts/collecte-jo.mjs --source=mock        # jeu d'essai local
     node scripts/collecte-jo.mjs --jours=7 --dry-run  # sans écriture

   Variables d'environnement :
     PISTE_CLIENT_ID / PISTE_CLIENT_SECRET   identifiants API Légifrance (PISTE)
     PISTE_ENV                               "production" (défaut) ou "sandbox"
     ALERTE_WEBHOOK_URL                      optionnel : notification des
                                             nouveautés (Slack, Teams, Make…)

   Le script ne fait jamais échouer la publication du site : en cas de
   problème, il conserve le fil précédent et inscrit l'erreur dans le JSON,
   que l'interface affiche.
   ========================================================================== */

import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(ICI, "..");
const SORTIE_DEFAUT = resolve(RACINE, "data/veille-feed.json");

const MAX_TEXTES = 400;          // taille maximale du fil conservé
const RETENTION_JOURS = 120;     // au-delà, les textes sortent du fil

/* ----------------------------------------------------------- arguments ---- */

function args() {
  const o = { source: "legifrance", jours: 3, sortie: SORTIE_DEFAUT, dryRun: false };
  for (const a of process.argv.slice(2)) {
    if (a.startsWith("--source=")) o.source = a.slice(9);
    else if (a.startsWith("--jours=")) o.jours = Math.max(1, parseInt(a.slice(8), 10) || 3);
    else if (a.startsWith("--sortie=")) o.sortie = resolve(process.cwd(), a.slice(9));
    else if (a === "--dry-run") o.dryRun = true;
    else if (a === "--help" || a === "-h") { usage(); process.exit(0); }
    else { console.error("Option inconnue : " + a); usage(); process.exit(2); }
  }
  return o;
}
function usage() {
  console.log("Usage : node scripts/collecte-jo.mjs [--source=legifrance|mock] [--jours=N] [--sortie=chemin] [--dry-run]");
}

/* ----------------------------------------------------------- référentiel -- */

function chargeReferentiel() {
  globalThis.window = globalThis.window || {};
  const code = readFileSync(resolve(RACINE, "assets/veille-data.js"), "utf8");
  new Function(code)();
  const V = globalThis.window.VEILLE;
  if (!V || !V.domaines) throw new Error("Référentiel illisible : window.VEILLE absent");
  return V;
}

/* ------------------------------------------------------------- outillage -- */

/** Minuscules, accents retirés, apostrophes et espaces uniformisés. */
function normalise(txt) {
  return String(txt || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function jourISO(d) { return new Date(d).toISOString().slice(0, 10); }
function ilYA(jours) { return jourISO(Date.now() - jours * 86400000); }

/* ------------------------------------------------- source : jeu d'essai --- */

async function sourceMock() {
  const f = resolve(ICI, "fixtures/jorf-exemple.json");
  if (!existsSync(f)) throw new Error("Jeu d'essai introuvable : " + f);
  const brut = JSON.parse(readFileSync(f, "utf8"));
  // Les dates du jeu d'essai sont exprimées en jours avant aujourd'hui, pour
  // qu'il reste utilisable quelle que soit la date à laquelle on le rejoue.
  return brut
    .map((t) => normaliseTexte({ ...t, datePublication: t.datePublication || ilYA(t.ilYaJours || 0) }))
    .filter(Boolean);
}

/* ------------------------------------------- source : Légifrance (PISTE) -- */

const PISTE = {
  production: { oauth: "https://oauth.piste.gouv.fr/api/oauth/token", api: "https://api.piste.gouv.fr/dila/legifrance/lf-engine-app" },
  sandbox: { oauth: "https://sandbox-oauth.piste.gouv.fr/api/oauth/token", api: "https://sandbox-api.piste.gouv.fr/dila/legifrance/lf-engine-app" }
};

async function jeton(env) {
  const id = process.env.PISTE_CLIENT_ID;
  const secret = process.env.PISTE_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error("PISTE_CLIENT_ID / PISTE_CLIENT_SECRET absents. Créez une application sur piste.gouv.fr (API Légifrance), puis ajoutez-les en secrets du dépôt.");
  }
  const r = await fetch(PISTE[env].oauth, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: id, client_secret: secret, scope: "openid" })
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`Authentification PISTE refusée (${r.status}) : ${txt.slice(0, 300)}`);
  let j;
  try { j = JSON.parse(txt); } catch { throw new Error("Réponse d'authentification illisible : " + txt.slice(0, 200)); }
  if (!j.access_token) throw new Error("Aucun access_token dans la réponse : " + txt.slice(0, 200));
  return j.access_token;
}

async function appelApi(env, token, chemin, corps) {
  const r = await fetch(PISTE[env].api + chemin, {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(corps)
  });
  const txt = await r.text();
  if (!r.ok) {
    const e = new Error(`${chemin} → HTTP ${r.status} : ${txt.slice(0, 400)}`);
    e.statut = r.status;
    throw e;
  }
  try { return JSON.parse(txt); } catch { throw new Error(`${chemin} → réponse non JSON : ${txt.slice(0, 200)}`); }
}

/**
 * Deux voies sont tentées, car l'API expose plusieurs façons d'obtenir les
 * derniers textes publiés. La première qui rend des textes exploitables gagne ;
 * les échecs sont journalisés pour pouvoir corriger sans deviner.
 */
async function sourceLegifrance(jours) {
  const env = process.env.PISTE_ENV === "sandbox" ? "sandbox" : "production";
  const token = await jeton(env);
  const journal = [];

  // Voie 1 — les N derniers Journaux officiels et leur sommaire.
  try {
    const rep = await appelApi(env, token, "/consult/lastNJo", { nbElement: Math.min(30, Math.max(2, jours * 2)) });
    const textes = extraitDepuisLastNJo(rep);
    if (textes.length) {
      console.log(`[legifrance] consult/lastNJo : ${textes.length} texte(s)`);
      return textes;
    }
    journal.push("consult/lastNJo : réponse exploitable mais vide (clés : " + Object.keys(rep || {}).join(", ") + ")");
  } catch (e) {
    journal.push("consult/lastNJo : " + e.message);
  }

  // Voie 2 — recherche dans le fonds JORF sur une fenêtre de dates.
  try {
    const rep = await appelApi(env, token, "/search", {
      fond: "JORF",
      recherche: {
        filtres: [{ facette: "DATE_PUBLICATION", dates: { start: ilYA(jours), end: jourISO(Date.now()) } }],
        pageNumber: 1,
        pageSize: 100,
        operateur: "ET",
        sort: "PUBLICATION_DATE_DESC",
        typePagination: "DEFAUT",
        champs: [{
          typeChamp: "TITLE",
          operateur: "ET",
          criteres: [{ typeRecherche: "TOUS_LES_MOTS_DANS_UN_CHAMP", valeur: "", operateur: "ET" }]
        }]
      }
    });
    const textes = extraitDepuisSearch(rep);
    if (textes.length) {
      console.log(`[legifrance] search : ${textes.length} texte(s)`);
      return textes;
    }
    journal.push("search : réponse exploitable mais vide (clés : " + Object.keys(rep || {}).join(", ") + ")");
  } catch (e) {
    journal.push("search : " + e.message);
  }

  throw new Error("Aucune voie d'accès n'a rendu de texte.\n  - " + journal.join("\n  - "));
}

/** Aplatit la réponse de consult/lastNJo, dont l'arborescence varie. */
function extraitDepuisLastNJo(rep) {
  const out = [];
  const vus = new Set();
  (function parcours(noeud, datePublication) {
    if (!noeud || typeof noeud !== "object") return;
    if (Array.isArray(noeud)) { noeud.forEach((n) => parcours(n, datePublication)); return; }
    const date = noeud.publicationDate || noeud.datePubli || noeud.datepublication || datePublication;
    const id = noeud.id || noeud.cid || noeud.textCid;
    const titre = noeud.title || noeud.titre || noeud.titreLong;
    if (id && titre && String(id).startsWith("JORFTEXT") && !vus.has(id)) {
      vus.add(id);
      out.push(normaliseTexte({ id, titre, nature: noeud.nature || noeud.natureText, datePublication: date }));
    }
    for (const k of Object.keys(noeud)) {
      const v = noeud[k];
      if (v && typeof v === "object") parcours(v, date);
    }
  })(rep, null);
  return out.filter(Boolean);
}

/** Aplatit la réponse de /search (results[].titles[]). */
function extraitDepuisSearch(rep) {
  const out = [];
  for (const r of rep?.results || []) {
    for (const t of r.titles || []) {
      out.push(normaliseTexte({
        id: t.id || t.cid,
        titre: t.title || t.titre,
        nature: r.nature || r.natureText,
        datePublication: r.date || t.datePubli || r.datePublication
      }));
    }
  }
  return out.filter(Boolean);
}

/* ------------------------------------------------------ normalisation ----- */

function normaliseTexte(brut) {
  if (!brut) return null;
  const id = String(brut.id || "").trim();
  const titre = String(brut.titre || brut.title || "").replace(/\s+/g, " ").trim();
  if (!id || !titre) return null;
  let date = brut.datePublication;
  if (typeof date === "number") date = jourISO(date);
  if (typeof date === "string" && date.length > 10) date = date.slice(0, 10);
  return {
    id,
    titre,
    nature: (brut.nature || deduitNature(titre) || "TEXTE").toUpperCase(),
    datePublication: /^\d{4}-\d{2}-\d{2}$/.test(date || "") ? date : jourISO(Date.now()),
    url: brut.url || `https://www.legifrance.gouv.fr/jorf/id/${encodeURIComponent(id)}`
  };
}

function deduitNature(titre) {
  const n = normalise(titre);
  if (n.startsWith("decret")) return "DECRET";
  if (n.startsWith("arrete")) return "ARRETE";
  if (n.startsWith("loi ")) return "LOI";
  if (n.startsWith("ordonnance")) return "ORDONNANCE";
  if (n.startsWith("circulaire") || n.startsWith("instruction")) return "CIRCULAIRE";
  if (n.startsWith("avis")) return "AVIS";
  if (n.startsWith("decision")) return "DECISION";
  return null;
}

/* ------------------------------------------------------- rattachement ----- */

/** Rattache un texte aux domaines dont un mot-clé apparaît dans le titre. */
function rattache(texte, index) {
  const titre = normalise(texte.titre);
  const domaines = [];
  const motsTrouves = [];
  for (const { domaine, motNormalise, motAffiche } of index) {
    if (titre.includes(motNormalise)) {
      if (!domaines.includes(domaine)) domaines.push(domaine);
      if (!motsTrouves.includes(motAffiche)) motsTrouves.push(motAffiche);
    }
  }
  return { ...texte, domaines, motsCles: motsTrouves };
}

function construitIndex(V) {
  const index = [];
  for (const [domaine, mots] of Object.entries(V.motsCles || {})) {
    for (const mot of mots) index.push({ domaine, motNormalise: normalise(mot), motAffiche: mot });
  }
  // Les mots-clés les plus longs d'abord : plus spécifiques, meilleurs indices.
  return index.sort((a, b) => b.motNormalise.length - a.motNormalise.length);
}

/** Un texte est prioritaire s'il touche un domaine à surveiller au moins chaque semaine. */
function estPrioritaire(texte, V) {
  return texte.domaines.some((d) => {
    const f = V.domaines[d]?.frequence;
    return f === "quotidienne" || f === "hebdomadaire";
  });
}

/* ------------------------------------------------------------- fusion ----- */

function litFilExistant(chemin) {
  if (!existsSync(chemin)) return { textes: [] };
  try {
    const j = JSON.parse(readFileSync(chemin, "utf8"));
    return { ...j, textes: Array.isArray(j.textes) ? j.textes : [] };
  } catch (e) {
    console.warn("Fil existant illisible, il sera reconstruit : " + e.message);
    return { textes: [] };
  }
}

function fusionne(ancien, nouveaux) {
  const parId = new Map();
  for (const t of ancien) parId.set(t.id, t);
  const inedits = [];
  for (const t of nouveaux) {
    if (parId.has(t.id)) {
      // On rafraîchit le rattachement (les mots-clés ont pu évoluer) sans
      // perdre la date de première détection.
      const avant = parId.get(t.id);
      parId.set(t.id, { ...t, detecteLe: avant.detecteLe || t.detecteLe });
    } else {
      parId.set(t.id, t);
      inedits.push(t);
    }
  }
  const limite = ilYA(RETENTION_JOURS);
  const textes = [...parId.values()]
    .filter((t) => t.datePublication >= limite)
    .sort((a, b) => (b.datePublication || "").localeCompare(a.datePublication || "") || b.id.localeCompare(a.id))
    .slice(0, MAX_TEXTES);
  return { textes, inedits };
}

/* ------------------------------------------------------------ webhook ----- */

async function notifie(inedits, V) {
  const url = process.env.ALERTE_WEBHOOK_URL;
  if (!url || !inedits.length) return;
  const prioritaires = inedits.filter((t) => estPrioritaire(t, V));
  const lignes = (prioritaires.length ? prioritaires : inedits).slice(0, 10).map((t) => {
    const noms = t.domaines.map((d) => V.domaines[d]?.nom || d).join(", ");
    return `• ${t.titre}\n  ${noms}\n  ${t.url}`;
  });
  const texte = `Veille réglementaire — ${inedits.length} nouveau(x) texte(s), dont ${prioritaires.length} prioritaire(s).\n\n${lignes.join("\n\n")}`;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: texte, content: texte, nombre: inedits.length, prioritaires: prioritaires.length, textes: inedits })
    });
    console.log(`[webhook] notification envoyée (HTTP ${r.status})`);
  } catch (e) {
    console.warn("[webhook] échec de la notification : " + e.message);
  }
}

/* --------------------------------------------------------------- main ----- */

async function main() {
  const o = args();
  const V = chargeReferentiel();
  const index = construitIndex(V);
  console.log(`Référentiel : ${Object.keys(V.domaines).length} domaines, ${index.length} mots-clés.`);

  const precedent = litFilExistant(o.sortie);
  let bruts = [];
  let erreur = null;

  try {
    bruts = o.source === "mock" ? await sourceMock() : await sourceLegifrance(o.jours);
  } catch (e) {
    erreur = e.message;
    console.error("Collecte en échec : " + e.message);
  }

  const maintenant = new Date().toISOString();
  const rattaches = bruts
    .map((t) => rattache(t, index))
    .filter((t) => t.domaines.length > 0)
    .map((t) => ({ ...t, prioritaire: estPrioritaire(t, V), detecteLe: maintenant }));

  console.log(`Textes reçus : ${bruts.length} — retenus après rattachement : ${rattaches.length}`);

  const { textes, inedits } = fusionne(precedent.textes, rattaches);
  console.log(`Fil : ${textes.length} texte(s), dont ${inedits.length} inédit(s).`);

  const fil = {
    genere: maintenant,
    source: o.source,
    fenetreJours: o.jours,
    statut: erreur ? "echec" : "ok",
    erreur: erreur || null,
    // En cas d'échec, on garde la date de la dernière collecte réussie pour
    // que l'interface puisse dire depuis quand le fil n'est plus à jour.
    derniereReussite: erreur ? (precedent.derniereReussite || null) : maintenant,
    nombreTextes: textes.length,
    nombreInedits: erreur ? 0 : inedits.length,
    textes
  };

  // Le fichier n'est réécrit que si son contenu utile a bougé : sans cela, le
  // seul horodatage ferait un commit par exécution, soit vingt-quatre par jour
  // pour rien. L'horodatage affiché est donc celui de la dernière évolution
  // du fil, pas celui de la dernière vérification.
  const memeContenu =
    JSON.stringify(precedent.textes) === JSON.stringify(textes) &&
    (precedent.statut || null) === fil.statut &&
    (precedent.erreur || null) === fil.erreur;

  if (o.dryRun) {
    console.log(JSON.stringify({ ...fil, textes: fil.textes.slice(0, 3) }, null, 2));
    console.log("(--dry-run : rien n'a été écrit)");
  } else if (memeContenu) {
    console.log("Fil inchangé : le fichier n'est pas réécrit.");
  } else {
    mkdirSync(dirname(o.sortie), { recursive: true });
    writeFileSync(o.sortie, JSON.stringify(fil, null, 2) + "\n", "utf8");
    console.log("Écrit : " + o.sortie);
  }

  // Signale au workflow s'il y a matière à publier.
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT,
      `modifie=${!o.dryRun && !memeContenu}\ninedits=${erreur ? 0 : inedits.length}\nstatut=${fil.statut}\n`);
  }

  if (!erreur && !o.dryRun && !memeContenu) await notifie(inedits, V);

  // Une collecte en échec ne doit pas casser la publication du site : on sort
  // en 0, le statut est porté par le JSON et affiché dans l'interface.
  process.exit(0);
}

main().catch((e) => {
  console.error("Erreur inattendue : " + (e && e.stack ? e.stack : e));
  process.exit(1);
});
