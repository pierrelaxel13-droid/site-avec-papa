#!/usr/bin/env node
/* ==========================================================================
   Pierrel & Co — le texte des codes, mot pour mot
   --------------------------------------------------------------------------
   Va chercher les codes consolidés, en découpe les morceaux déclarés dans
   contenu/perimetres.js, et écrit contenu/codes.json, que build.mjs publie
   sur le site. Le client lit le texte chez nous ; il n'a plus à partir.

   LA SOURCE
   La base LEGI, base officielle des codes et lois consolidés. Le robot la
   prend dans l'extraction quotidienne publiée par la Fabrique numérique des
   ministères sociaux, sur le registre npm : @socialgouv/legi-data, construite
   en interrogeant l'API Légifrance. Licence ouverte, donc republiable à
   condition de citer la source et la version — ce que fait chaque page.
   Pas de compte, pas de clé, et le registre npm répond partout, y compris
   depuis un environnement de développement fermé. C'est la seule source de
   texte intégral joignable d'ici : la DILA et Légifrance, elles, ne le sont
   que depuis les machines de construction (voir netlify.toml).

   CE QU'IL ÉCRIT
   contenu/codes.json : les codes suivis avec leur version, les morceaux
   découpés en pages lisibles, le texte de chaque article avec sa date d'entrée
   en vigueur et les textes qui l'ont modifié, et — c'est le point — la liste
   des changements depuis la relève précédente.

   CE QUE ÇA CHANGE, EXACTEMENT
   contenu/codes.json est suivi par git. À chaque passage, le robot compare
   article par article avec la version précédente et écrit ce qui a bougé :
   article nouveau, texte modifié (avec l'avant et l'après), article abrogé.
   C'est de là que viennent l'alerte et la ligne « ce que ça change » sur le
   site. Rien n'est deviné : c'est une comparaison de deux relevés.

   USAGE
     node outils/codes.mjs                  # relève et compare
     node outils/codes.mjs --version 2.574.0
     node outils/codes.mjs --sans-reseau    # réutilise le paquet déjà extrait
     node outils/codes.mjs --garder         # garde l'archive téléchargée

   CE QUE LE ROBOT NE FAIT JAMAIS
   Écrire un texte qu'il n'a pas lu. Si le registre ne répond pas, ou si un
   périmètre ne trouve rien dans l'arbre du code, il le dit et sort en erreur
   sans toucher contenu/codes.json. La page d'hier vaut mieux qu'une page
   inventée aujourd'hui.
   ========================================================================== */

import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TRAVAIL = join(RACINE, ".codes");
const SORTIE = join(RACINE, "contenu", "codes.json");
const PAQUET = "@socialgouv/legi-data";

/* Au-delà de ce poids de texte, un morceau se redécoupe sur ses sous-sections :
   c'est ce qui tient le poids des pages, pas une règle juridique. */
const SEUIL = 60 * 1024;

const args = process.argv.slice(2);
const valeur = (nom, defaut) => {
  const i = args.indexOf(nom);
  return i === -1 || !args[i + 1] ? defaut : args[i + 1];
};
const VERSION = valeur("--version", null);
const SANS_RESEAU = args.includes("--sans-reseau");
const GARDER = args.includes("--garder");

async function charge(chemin, ...cles) {
  const source = await readFile(join(RACINE, chemin), "utf8");
  const faux = {};
  new Function("window", source)(faux);
  return cles.map((c) => faux[c]);
}

const sansAccent = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const slug = (s) => sansAccent(String(s)).toLowerCase()
  .replace(/[’'`]/g, " ").replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "").slice(0, 72).replace(/-+$/, "");

/* --- Le texte de l'article -------------------------------------------------
   On garde la mise en forme officielle — alinéas, listes, tableaux de valeurs
   limites — et rien d'autre : aucune balise qui exécute, aucun attribut,
   aucun lien. C'est du texte, il doit se lire comme du texte. */
const BALISES_GARDEES = new Set([
  "p", "br", "em", "strong", "i", "b", "u", "sup", "sub",
  "ul", "ol", "li", "table", "thead", "tbody", "tr", "td", "th", "caption"
]);

function nettoieHtml(brut) {
  if (!brut) return "";
  return String(brut)
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\/?([a-zA-Z0-9]+)[^>]*>/g, (tout, nom) => {
      const n = nom.toLowerCase();
      if (!BALISES_GARDEES.has(n)) return " ";
      return tout[1] === "/" ? `</${n}>` : (n === "br" ? "<br>" : `<${n}>`);
    })
    .replace(/[ \t]+/g, " ")
    .replace(/\s+(<\/(?:p|li|td|th)>)/g, "$1")
    .trim();
}

const enTexte = (s) => String(s || "")
  .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ")
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/\s+/g, " ").trim();

const jour = (ms) => {
  if (!ms && ms !== 0) return "";
  const d = new Date(Number(ms));
  if (isNaN(d)) return "";
  const a = d.getUTCFullYear();
  return a < 1900 || a > 2100 ? "" : d.toISOString().slice(0, 10);
};

function article(n) {
  const d = n.data || {};
  const html = nettoieHtml(d.texteHtml || d.texte);
  const modifie = (d.lienModifications || [])
    .filter((l) => l.linkOrientation === "cible" && /MODIFIE|CREATION|CREE/i.test(l.linkType || ""))
    .map((l) => ({
      quoi: /CREAT|CREE/i.test(l.linkType || "") ? "cree" : "modifie",
      titre: enTexte(l.textTitle),
      date: l.datePubliTexte || l.dateDebutCible || "",
      lien: l.textCid ? `https://www.legifrance.gouv.fr/jorf/id/${l.textCid}` : ""
    }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  return {
    num: d.num || "",
    id: d.id || "",
    etat: d.etat || "",
    depuis: jour(d.dateDebut),
    html,
    modifiePar: modifie.slice(0, 2)
  };
}

/* --- L'arbre du code -------------------------------------------------------- */
const estSection = (n) => n.type === "section";
const titre = (n) => String((n.data || {}).title || "").replace(/\s+/g, " ").trim();

function poids(n) {
  if (n.type === "article") return ((n.data || {}).texte || "").length;
  return (n.children || []).reduce((s, c) => s + poids(c), 0);
}

function articles(n) {
  if (n.type === "article") return [n];
  return (n.children || []).flatMap((c) => articles(c));
}

/* Les racines d'un périmètre : les sections dont le chemin complet répond au
   motif. On ne garde que les plus hautes — un périmètre inclus dans un autre
   ne doit pas produire deux fois la même page. */
function racines(arbre, motifs) {
  const re = motifs.map((m) => new RegExp(m));
  const trouves = [];
  const parcours = (n, chemin) => {
    const t = estSection(n) ? titre(n) : "";
    const c = estSection(n) ? [...chemin, t] : chemin;
    if (estSection(n)) {
      const joint = c.join(" / ");
      if (re.some((r) => r.test(joint))) {
        trouves.push({ n, chemin: c });
        return; // inutile de descendre : la page prendra tout le sous-arbre
      }
    }
    (n.children || []).forEach((k) => parcours(k, c));
  };
  parcours(arbre, []);
  return trouves;
}

/* Le découpage en pages : on descend tant qu'un morceau pèse trop lourd et
   qu'il a des sous-sections où descendre. */
function decoupe(n, chemin, sortie) {
  const p = poids(n);
  const sous = (n.children || []).filter(estSection);
  if (p <= SEUIL || !sous.length) {
    const arts = articles(n);
    if (arts.length) sortie.push({ chemin, articles: arts });
    return;
  }
  const directs = (n.children || []).filter((c) => c.type === "article");
  if (directs.length) sortie.push({ chemin: [...chemin, "Articles d’introduction"], articles: directs });
  for (const s of sous) decoupe(s, [...chemin, titre(s)], sortie);
}

/* --- Le paquet -------------------------------------------------------------- */
async function recupere(url, delai = 180000) {
  const r = await fetch(url, {
    signal: AbortSignal.timeout(delai),
    headers: { "user-agent": "pierrel-co-veille/1.0 (+https://pierrel-co.fr)" }
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r;
}

async function telecharge() {
  const meta = await (await recupere(`https://registry.npmjs.org/${PAQUET}`, 60000)).json();
  const v = VERSION || meta["dist-tags"].latest;
  const infos = meta.versions[v];
  if (!infos) throw new Error(`version ${v} inconnue sur le registre`);
  console.log(`  paquet ${PAQUET} ${v}, publié le ${(meta.time[v] || "").slice(0, 10)}`);
  await mkdir(TRAVAIL, { recursive: true });
  const archive = join(TRAVAIL, "paquet.tgz");
  const r = await recupere(infos.dist.tarball);
  await writeFile(archive, Buffer.from(await r.arrayBuffer()));
  await execFileP("tar", ["-xzf", archive, "-C", TRAVAIL]);
  if (!GARDER) await rm(archive, { force: true });
  return { version: v, publie: (meta.time[v] || "").slice(0, 10) };
}

/* --- La comparaison avec la relève précédente ------------------------------ */
/* Un découpage mot à mot : on cherche le plus long début commun et la plus
   longue fin commune, et on montre ce qui tient entre les deux. C'est ce que
   lit le client : « avant ceci, maintenant cela ». */
function difference(avant, apres) {
  const a = avant.split(" ");
  const b = apres.split(" ");
  let d = 0;
  while (d < a.length && d < b.length && a[d] === b[d]) d++;
  let f = 0;
  while (f < a.length - d && f < b.length - d &&
         a[a.length - 1 - f] === b[b.length - 1 - f]) f++;
  const coupe = (mots) => {
    const t = mots.slice(d, mots.length - f).join(" ");
    return t.length > 900 ? `${t.slice(0, 900)}…` : t;
  };
  return {
    avant: coupe(a),
    apres: coupe(b),
    contexteAvant: a.slice(Math.max(0, d - 12), d).join(" "),
    contexteApres: a.slice(a.length - f, a.length - f + 12).join(" ")
  };
}

function compare(ancien, nouveau) {
  const avant = new Map();
  for (const m of (ancien.morceaux || []))
    for (const a of m.articles) avant.set(`${m.code}|${a.num}`, enTexte(a.html));
  const changements = [];
  for (const m of nouveau.morceaux) {
    for (const a of m.articles) {
      const cle = `${m.code}|${a.num}`;
      const v = avant.get(cle);
      const t = enTexte(a.html);
      avant.delete(cle);
      if (!v) {
        if (ancien.morceaux) changements.push({
          quoi: "nouveau", code: m.code, codeTitre: m.codeTitre, morceau: m.id,
          num: a.num, depuis: a.depuis, par: a.modifiePar[0] || null,
          apres: t.slice(0, 900)
        });
        continue;
      }
      if (v !== t) {
        changements.push({
          quoi: "modifie", code: m.code, codeTitre: m.codeTitre, morceau: m.id,
          num: a.num, depuis: a.depuis, par: a.modifiePar[0] || null,
          ...difference(v, t)
        });
      }
    }
  }
  for (const [cle, t] of avant) {
    const [code, num] = cle.split("|");
    changements.push({ quoi: "sorti", code, num, avant: t.slice(0, 900) });
  }
  return changements;
}

/* Une ligne par article : le fichier est suivi par git, et un changement de
   texte doit se voir comme une ligne changée, pas comme un fichier réécrit. */
function ecris(o) {
  const j = (x) => JSON.stringify(x);
  const morceaux = o.morceaux.map((m) => {
    const tete = [["id", m.id], ["code", m.code], ["codeTitre", m.codeTitre], ["chemin", m.chemin]]
      .map(([c, v]) => `${j(c)}: ${j(v)}`).join(", ");
    const arts = m.articles.map((a) => `   ${j(a)}`).join(",\n");
    return `  {${tete},\n   "articles": [\n${arts}\n  ]}`;
  }).join(",\n");
  const reste = { ...o };
  delete reste.morceaux;
  const dessus = j(reste).replace(/^\{/, "").replace(/\}$/, "");
  return `{${dessus},\n "morceaux": [\n${morceaux}\n ]}\n`;
}

/* --- Programme -------------------------------------------------------------- */
async function main() {
  const [PERIMETRES, CODES] = await charge("contenu/perimetres.js", "PERIMETRES", "CODES_SUIVIS");
  console.log(`Relève des codes — ${PERIMETRES.length} périmètres sur ${CODES.length} codes`);

  let paquet = { version: "inconnue", publie: "" };
  if (SANS_RESEAU) console.log("  --sans-reseau : on réutilise le paquet déjà extrait");
  else paquet = await telecharge();

  const dossier = join(TRAVAIL, "package", "data");
  const morceaux = [];
  const parRef = {};
  const codesVus = [];
  const vides = [];

  for (const code of CODES) {
    const voulus = PERIMETRES.filter((p) => p.code === code.id);
    if (!voulus.length) continue;

    let arbre;
    try {
      arbre = JSON.parse(await readFile(join(dossier, `${code.id}.json`), "utf8"));
    } catch (e) {
      throw new Error(`${code.titre} : ${code.id}.json illisible (${e.message})`);
    }
    const v = arbre.data || {};
    codesVus.push({
      id: code.id, titre: v.title || code.titre,
      version: v.dateDebutVersion || "", modifie: v.dateModif || ""
    });
    console.log(`  ${v.title || code.titre} — version du ${v.dateDebutVersion || "?"}`);

    /* Toutes les racines du code, tous périmètres confondus, puis on écarte
       celles qui sont déjà dans une autre : une page, un morceau. */
    const toutes = [];
    for (const p of voulus) {
      const r = racines(arbre, p.racines);
      if (!r.length) vides.push(`${p.ref} (${code.titre})`);
      toutes.push(...r.map((x) => ({ ...x, ref: p.ref })));
    }
    const chemins = toutes.map((x) => x.chemin.join(" / "));
    const hautes = toutes.filter((x, i) =>
      !chemins.some((c, j) => j !== i && chemins[i].startsWith(`${c} / `)));

    const deja = new Set();
    for (const r of hautes) {
      const joint = r.chemin.join(" / ");
      if (deja.has(joint)) continue;
      deja.add(joint);
      const pages = [];
      decoupe(r.n, r.chemin, pages);
      for (const page of pages) {
        /* Le nom de la page dit ce qu'elle contient : le code, et la plage
           d'articles. « code-du-travail-r4412-1-a-r4412-159 » se lit ; un
           numéro d'ordre ne se lit pas. */
        const bornes = page.articles.map((a) => (a.data || {}).num || "");
        const borne = (x) => slug(x).slice(0, 24).replace(/-+$/, "");
        const id = `${slug(v.title || code.titre)}-${borne(bornes[0])}` +
                   (bornes.length > 1 ? `-a-${borne(bornes[bornes.length - 1])}` : "");
        let unique = id;
        for (let i = 2; morceaux.some((m) => m.id === unique); i++) unique = `${id}-${i}`;
        morceaux.push({
          id: unique, code: code.id, codeTitre: v.title || code.titre,
          chemin: page.chemin,
          articles: page.articles.map(article).filter((a) => a.num && a.html)
        });
      }
    }

    /* Chaque référence reçoit les morceaux qui tombent dans son périmètre. Un
       périmètre peut être plus large qu'une page (il en prend plusieurs) ou
       plus fin qu'elle (il prend la page qui le contient : mieux vaut lire une
       section de trop que de ne rien lire). */
    for (const p of voulus) {
      const chemins = racines(arbre, p.racines).map((r) => r.chemin.join(" / "));
      parRef[p.ref] = morceaux
        .filter((m) => m.code === code.id)
        .filter((m) => {
          const joint = m.chemin.join(" / ");
          return chemins.some((c) =>
            joint === c || joint.startsWith(`${c} / `) || c.startsWith(`${joint} / `));
        })
        .map((m) => m.id);
    }
  }

  const utiles = morceaux.filter((m) => m.articles.length);
  if (!utiles.length) throw new Error("aucun article relevé — contenu/codes.json n'est pas touché");
  if (vides.length) throw new Error(`périmètre introuvable dans l'arbre : ${vides.join(" ; ")}`);

  let ancien = {};
  try { ancien = JSON.parse(await readFile(SORTIE, "utf8")); } catch { /* première fois */ }

  const sortie = {
    preleve: new Date().toISOString().slice(0, 10),
    paquet: `${PAQUET} ${paquet.version}`,
    paquetPublie: paquet.publie,
    source: {
      nom: "Base LEGI, codes et lois consolidés",
      par: "extraction quotidienne de l'API Légifrance publiée par la Fabrique numérique des ministères sociaux",
      licence: "Licence ouverte",
      url: "https://www.data.gouv.fr/fr/datasets/legi-codes-lois-et-reglements-consolides/"
    },
    codes: codesVus,
    morceaux: utiles,
    perimetres: parRef,
    changements: []
  };
  sortie.changements = compare(ancien, sortie);

  await writeFile(SORTIE, ecris(sortie), "utf8");
  if (!GARDER) await rm(TRAVAIL, { recursive: true, force: true });

  const arts = utiles.reduce((s, m) => s + m.articles.length, 0);
  const poidsTexte = utiles.reduce((s, m) => s + m.articles.reduce((t, a) => t + a.html.length, 0), 0);
  console.log(`\n  ${utiles.length} pages de texte, ${arts} articles, ${Math.round(poidsTexte / 1024)} Ko de texte officiel`);
  for (const [ref, ids] of Object.entries(parRef))
    console.log(`    ${ids.length.toString().padStart(3)} pages — ${ref}`);
  console.log(sortie.changements.length
    ? `\n  ${sortie.changements.length} changement(s) depuis la relève précédente`
    : `\n  aucun changement depuis la relève précédente`);
  console.log(`  écrit : ${SORTIE.replace(`${RACINE}/`, "")}`);
}

main().catch((e) => {
  console.error(`\nLa relève des codes s'arrête : ${e.message}`);
  process.exit(1);
});
