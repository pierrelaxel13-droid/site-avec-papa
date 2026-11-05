#!/usr/bin/env node
/* ==========================================================================
   Vigie réglementaire — le fonds des textes en vigueur (4 novembre 2026)
   --------------------------------------------------------------------------
   Demande d'Axel : que la veille reprenne les textes des 50 dernières années,
   SEULEMENT ceux qui sont encore en vigueur. Les codes (code du travail…)
   sont déjà lus article par article (outils/codes.mjs) ; ce robot ajoute les
   textes NON codifiés encore en vigueur : lois, ordonnances, décrets et
   arrêtés publiés depuis 50 ans, rattachés à nos 44 sujets.

   LA SOURCE
   La base LEGI de la DILA (textes consolidés de Légifrance), en archive
   ouverte : https://echanges.dila.gouv.fr/OPENDATA/LEGI/ — fichier
   « Freemium_legi_global_AAAAMMJJ-HHMMSS.tar.gz », licence ouverte. On n'en
   lit que le dossier « TNC_en_vigueur » (textes non codifiés en vigueur).

   COMMENT
   L'archive pèse plus d'un gigaoctet : on ne la décompresse pas sur le
   disque, on la lit en flux, deux fois.
     1. Les fiches des textes (texte/version) : on garde ceux qui sont en
        vigueur (ni abrogés ni périmés), publiés depuis 50 ans, de nature loi,
        ordonnance, décret ou arrêté, et dont le titre touche un de nos sujets
        (outils/tri.mjs, la même règle que le relevé quotidien).
     2. Les articles de ces textes : seuls ceux en vigueur, dans l'ordre.
   Rien n'est deviné : ce qui n'est pas dans la base n'est pas écrit.

   USAGE
     node outils/fonds-legi.mjs --url            # l'adresse de la dernière archive complète
     node outils/fonds-legi.mjs archive.tar.gz   # écrit contenu/fonds-legi.json
   Lancé par .github/workflows/fonds.yml (la DILA n'est joignable que de là).
   ========================================================================== */
import { createReadStream } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { createGunzip } from "node:zlib";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { rattache, texteBrut } from "./tri.mjs";

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SORTIE = join(RACINE, "contenu", "fonds-legi.json");
const INDEX = "https://echanges.dila.gouv.fr/OPENDATA/LEGI/";
export const ANS = 50;
const PLAFOND_CORPS = 2500;      // caractères gardés par texte (le texte entier est à la source)
const NATURES = { LOI: "Loi", LOI_ORGANIQUE: "Loi organique", ORDONNANCE: "Ordonnance", DECRET: "Décret", DECRET_LOI: "Décret-loi", ARRETE: "Arrêté" };

/* --- Lire une archive .tar.gz en flux -------------------------------------
   Le format tar : des blocs de 512 octets ; un en-tête (nom, taille, type)
   puis le contenu, complété jusqu'au bloc suivant. Les noms longs arrivent
   dans une entrée « L » (GNU) ou « x » (pax) juste avant. */
export async function parcourir(fichier, garder, traiter) {
  let tampon = Buffer.alloc(0), etat = "entete", reste = 0, bourrage = 0, nom = "", type = "", morceaux = [], nomLong = "";
  const octal = (b) => parseInt(b.toString("ascii").replace(/\0.*$/s, "").trim() || "0", 8);
  const flux = createReadStream(fichier).pipe(createGunzip());
  for await (const bloc of flux) {
    tampon = tampon.length ? Buffer.concat([tampon, bloc]) : bloc;
    for (;;) {
      if (etat === "entete") {
        if (tampon.length < 512) break;
        const h = tampon.subarray(0, 512); tampon = tampon.subarray(512);
        if (h.every((x) => x === 0)) continue;
        const base = h.subarray(0, 100).toString("utf8").replace(/\0.*$/s, "");
        const prefixe = h.subarray(345, 500).toString("utf8").replace(/\0.*$/s, "");
        type = String.fromCharCode(h[156] || 48);
        nom = nomLong || (prefixe ? `${prefixe}/${base}` : base);
        nomLong = "";
        reste = octal(h.subarray(124, 136));
        bourrage = (512 - (reste % 512)) % 512;
        morceaux = [];
        etat = "contenu";
        if (reste === 0) { etat = "fin"; }
      }
      if (etat === "contenu") {
        if (!tampon.length) break;
        const n = Math.min(reste, tampon.length);
        const utile = type === "L" || type === "x" || ((type === "0" || type === "\0") && garder(nom));
        if (utile) morceaux.push(tampon.subarray(0, n));
        tampon = tampon.subarray(n); reste -= n;
        if (reste > 0) break;
        etat = "fin";
      }
      if (etat === "fin") {
        if (tampon.length < bourrage) break;
        tampon = tampon.subarray(bourrage);
        etat = "entete";
        const contenu = morceaux.length ? Buffer.concat(morceaux) : null;
        if (type === "L" && contenu) nomLong = contenu.toString("utf8").replace(/\0.*$/s, "");
        else if (type === "x" && contenu) { const m = /\d+ path=([^\n]*)\n/.exec(contenu.toString("utf8")); if (m) nomLong = m[1]; }
        else if (contenu) await traiter(nom, contenu.toString("utf8"));
      }
    }
  }
}

const entre = (xml, b) => { const m = new RegExp(`<${b}(?:\\s[^>]*)?>([\\s\\S]*?)</${b}>`).exec(xml); return m ? m[1] : ""; };
const nu = (xml, b) => texteBrut(entre(xml, b)).trim();
/* L'état d'un texte ou d'un article dans LEGI : VIGUEUR, VIGUEUR_DIFF, MODIFIE (en vigueur,
   modifié depuis), ABROGE_DIFF (abrogé à une date à venir : encore en vigueur aujourd'hui),
   et ceux qui ne le sont plus (ABROGE, PERIME, ANNULE, MODIFIE_MORT_NE…). */
const enVigueur = (etat, fin, auj) => !/^ABROGE$|^PERIME|^ANNULE|^TRANSFERE|^DISJOINT|MORT_NE/.test(etat || "") && (!fin || fin.slice(0, 10) > auj);

/* Une fiche de texte (texte/version) : ce qu'on en garde, ou null. */
export const RAISONS = {};
const raison = (r) => { RAISONS[r] = (RAISONS[r] || 0) + 1; return null; };
export function lisVersion(xml, auj, limite) {
  const id = nu(xml, "ID");
  const natureBrute = nu(xml, "NATURE").toUpperCase();
  const nature = NATURES[natureBrute];
  const version = entre(xml, "META_TEXTE_VERSION");
  const etat = nu(version, "ETAT"), fin = nu(version, "DATE_FIN");
  const date = (nu(xml, "DATE_PUBLI") || nu(xml, "DATE_TEXTE")).slice(0, 10);
  const titre = nu(version, "TITREFULL") || nu(version, "TITRE");
  if (!id) return raison("sans identifiant");
  if (!nature) return raison(`nature ${natureBrute || "vide"}`);
  if (!titre) return raison("sans titre");
  if (!date || date.startsWith("2999")) return raison("sans date");
  if (date < limite) return raison("plus de 50 ans");
  if (!enVigueur(etat, fin, auj)) return raison(`pas en vigueur (${etat || "?"})`);
  return { id, cid: nu(xml, "CID"), nature, titre, date, nota: nu(entre(xml, "NOTA"), "CONTENU") };
}

/* Un article : son texte, s'il est en vigueur, et le texte auquel il appartient. */
export function lisArticle(xml, auj) {
  const meta = entre(xml, "META_ARTICLE");
  if (!enVigueur(nu(meta, "ETAT"), nu(meta, "DATE_FIN"), auj)) return null;
  // Un article cite son texte deux fois : par son numéro au Journal officiel (JORFTEXT…)
  // et par son numéro consolidé (LEGITEXT…). On garde les deux.
  const txts = [...xml.matchAll(/<TITRE_TXT[^>]*\bid_txt="([^"]+)"/g)].map((m) => m[1]);
  const cid = (/<TEXTE[^>]*\bcid="([^"]+)"/.exec(xml) || [])[1];
  if (cid) txts.push(cid);
  const corps = texteBrut(entre(entre(xml, "BLOC_TEXTUEL"), "CONTENU")).replace(/\s+/g, " ").trim();
  if (!txts.length || !corps) return null;
  // « a modifié les dispositions suivantes » : un texte qui n'a fait que modifier d'autres
  // textes ; ce qu'il a changé est déjà dans les textes consolidés.
  if (/^(?:a |ont )?(?:modifié|abrogé|créé|transféré|modifie|abroge|crée)\s.{0,40}dispositions suivantes/i.test(corps) || corps.length < 15) return null;
  return { txts, num: nu(meta, "NUM"), corps };
}

/* Ce qui ne regarde pas une entreprise, lu dans le titre (4 novembre 2026). Le premier
   passage a retenu 12 676 textes par leurs mots-clés ; beaucoup ne font que modifier un autre
   texte (déjà consolidé), règlent la fonction publique ou l'administration elle-même, ne
   valent que pour une année, une collectivité d'outre-mer ou un territoire. On les écarte. */
const sansAccent = (x) => String(x).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export const EXCLUS = [
  ["ne fait que modifier ou abroger un autre texte", /^(?:decret|arrete|loi|ordonnance)[^,]{0,60}? (?:modifiant|portant modification|completant|abrogeant|portant abrogation)\b/],
  ["fonction publique", /fonctionnaires|fonction publique|\bcorps (?:de|des)\b|statut particulier|\bpersonnels? (?:de|des|du|enseignant|navigant|civils|militaires|non titulaires|techniques|administratifs)|agents (?:de l'etat|publics|titulaires|contractuels de l'etat|non titulaires|des)|emplois? (?:de direction|fonctionnels)|grille indiciaire|echelonnement indiciaire|indemnites? (?:susceptibles|de|d'|forfaitaire|speciale|horaire) .{0,40}(?:personnels|agents|fonctionnaires)|magistrats|militaires|gendarmerie|police nationale|sapeurs-pompiers professionnels|praticiens hospitaliers|enseignants-chercheurs|professeurs/],
  ["organisation de l'administration", /traitement automatise|traitements automatises|fichier (?:national|central)|\bportant creation (?:d'un|d'une|du|de la|des) (?:traitement|service|commission|comite|conseil|observatoire|mission|centre|etablissement|direction|groupement|groupe|formation)|groupe d'experts|groupe de travail|organisation (?:de l'administration|des services|de la direction|du ministere)|attributions? (?:du|de la|des|de) (?:ministre|secretaire|competences)|delegation de (?:signature|pouvoir)|portant nomination|conseil d'administration|composition (?:et|du|de la)|\binstituant (?:un|une) (?:comite|commission|conseil)|ecole nationale|universit|academie|elections? des representants des (?:eleves|etudiants)|habilitant une|commission nationale de conciliation|commissions? administratives? paritaires?|emoluments|hopitaux|personnels? medica|conseil general de l'alimentation/],
  ["ne vaut que pour une année ou une crise", /au titre de l'annee \d{4}|pour l'annee \d{4}|pour (?:la campagne|l'exercice) \d{4}|aide (?:temporaire|exceptionnelle)|fonds de solidarite|covid|autorisant provisoirement/],
  ["outre-mer ou territoire", /polynesie|nouvelle-caledonie|wallis|saint-pierre-et-miquelon|terres australes|\bmayotte\b|saint-barthelemy|saint-martin|guyane|martinique|guadeloupe|la reunion|\bcorse\b|departement d(?:e|u|es) [a-z]|region (?:de|d') [a-z]/],
  ["liste, agrément ou accord particulier", /fixant la liste des (?:organisations|etablissements)|habilitees a designer|portant agrement|portant habilitation|portant approbation (?:de la convention|du cahier|des statuts)|reconnaissance d'utilite publique|portant extension|accord (?:collectif|national)|convention collective|portant derogation/]
];
/* Un titre qui cite un code (« l'article L. 162-5 du code de la sécurité sociale ») ne
   parle pas pour autant de ce que dit son nom : sans ce retrait, « sécurité sociale »
   rangeait 1 635 textes de remboursement et de retraite dans « Paie », et « pêche maritime »
   tout ce qui cite le code rural. On trie sur le titre sans les noms de codes. */
const CODES = "de la securite sociale|rural et de la peche maritime|rural|de l'action sociale et des familles|de la sante publique|de l'environnement|du travail|de commerce|de la consommation|des transports|de l'urbanisme|civil|penal|general des impots|de la route|minier|de l'energie|de la propriete intellectuelle|de la construction et de l'habitation|de l'education|du sport|du tourisme|de la commande publique|monetaire et financier|des assurances|de la mutualite|general des collectivites territoriales|des douanes|forestier|de la defense|de la recherche|des postes et des communications electroniques|du patrimoine|de la voirie routiere|des pensions [a-z ]+|de l'organisation judiciaire|de procedure penale|de procedure civile|de justice administrative|de l'entree et du sejour des etrangers et du droit d'asile|du cinema et de l'image animee|des relations entre le public et l'administration|general de la propriete des personnes publiques|du domaine de l'etat";
const RE_CODES = new RegExp(`\\bcode (?:${CODES})\\b`, "g");
export const titrePourTri = (titre) => sansAccent(titre).replace(RE_CODES, " ");
/* Des mots-clés bons pour le relevé du jour, trop larges sur cinquante ans de textes :
   un texte qui ne touche un sujet que par eux n'y est pas rangé (sauf les cotisations,
   qui regardent bien la paie). */
const TROP_LARGES = new Set(["securite sociale", "action sociale et des familles", "importation", "exportation", "associations"]);
export function sujetsDuFonds(V, titre) {
  const t = titrePourTri(titre);
  return rattache(V, t, "legi").filter((d) => !(d.mots || []).every((m) => TROP_LARGES.has(m)) || (d.id === "paie" && /cotisation/.test(t)));
}
export const exclusion = (titre) => { const x = sansAccent(titre); const e = EXCLUS.find(([, re]) => re.test(x)); return e ? e[0] : ""; };

const ordreNum = (a) => String(a.num || "").replace(/\d+/g, (n) => n.padStart(6, "0"));

export async function fonds(fichier, V, { auj = new Date().toISOString().slice(0, 10), ans = ANS } = {}) {
  const limite = `${Number(auj.slice(0, 4)) - ans}${auj.slice(4)}`;
  const dansTnc = (n) => n.includes("/TNC_en_vigueur/");
  const textes = new Map();
  let fiches = 0;
  // 1. Les fiches des textes.
  await parcourir(fichier, (n) => dansTnc(n) && /\/texte\/version\/[^/]+\.xml$/.test(n), async (n, xml) => {
    fiches++;
    if (fiches <= 2 && process.env.FONDS_EXEMPLES) console.log(`--- exemple ${n}\n${xml.slice(0, 2500)}\n---`);
    const t = lisVersion(xml, auj, limite);
    if (!t) return;
    const domaines = sujetsDuFonds(V, t.titre);
    if (!domaines.length) { raison("hors de nos sujets"); return; }
    const ex = exclusion(t.titre);
    if (ex) { raison(ex); return; }
    raison("retenu");
    const avant = textes.get(t.id);
    if (!avant || t.date > avant.date) textes.set(t.id, { ...t, domaines, articles: [] });
  });
  // 2. Leurs articles en vigueur, retrouvés par l'un ou l'autre numéro du texte.
  const parCid = new Map([...textes.values()].filter((t) => t.cid).map((t) => [t.cid, t.id]));
  let articles = 0, vus = 0;
  await parcourir(fichier, (n) => dansTnc(n) && /\/article\/.+\.xml$/.test(n), async (n, xml) => {
    vus++;
    if (vus <= 1 && process.env.FONDS_EXEMPLES) console.log(`--- exemple d'article ${n}\n${xml.slice(0, 2000)}\n---`);
    const a = lisArticle(xml, auj);
    if (!a) return;
    const id = a.txts.map((x) => (textes.has(x) ? x : parCid.get(x))).find(Boolean);
    if (!id) return;
    articles++;
    textes.get(id).articles.push({ num: a.num, corps: a.corps });
  });
  const liste = [...textes.values()].map((t) => {
    t.articles.sort((a, b) => (ordreNum(a) < ordreNum(b) ? -1 : 1));
    let corps = "";
    for (const a of t.articles) {
      if (corps.length >= PLAFOND_CORPS) break;
      corps += (corps ? "\n\n" : "") + (a.num ? `Article ${a.num} : ` : "") + a.corps;
    }
    if (corps.length > PLAFOND_CORPS) corps = corps.slice(0, PLAFOND_CORPS).replace(/\s+\S*$/, "") + "\n\n[…] La suite est à la source.";
    return {
      source: "legi", sourceNom: "Légifrance — textes consolidés (base LEGI)", genre: "texte", fonds: true,
      id: t.id, titre: t.titre, nature: t.nature, date: t.date, dateTexte: t.date,
      articlesEnVigueur: t.articles.length, corps, nota: t.nota || "",
      lien: `https://www.legifrance.gouv.fr/loda/id/${t.id}`,
      domaines: t.domaines.map((d) => ({ id: d.id, nom: d.nom, mots: d.mots }))
    };
  }).filter((t) => t.articlesEnVigueur > 0).sort((a, b) => (a.date < b.date ? 1 : -1));
  return { fiches, articles, articlesVus: vus, textes: liste, limite };
}

async function derniereArchive() {
  const html = await (await fetch(INDEX)).text();
  const l = [...html.matchAll(/href="([^"]*Freemium_legi_global_[^"]+\.tar\.gz)"/gi)].map((m) => m[1]).sort();
  if (!l.length) throw new Error("Aucune archive complète LEGI dans l'index de la DILA.");
  return new URL(l[l.length - 1], INDEX).href;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = process.argv[2];
  if (arg === "--url") { console.log(await derniereArchive()); process.exit(0); }
  if (!arg) { console.error("Usage : node outils/fonds-legi.mjs archive.tar.gz"); process.exit(2); }
  const source = await readFile(join(RACINE, "assets/referentiel.js"), "utf8");
  const w = {}; new Function("window", source)(w);
  const auj = new Date().toISOString().slice(0, 10);
  const r = await fonds(arg, w.VEILLE, { auj });
  const parSujet = {};
  r.textes.forEach((t) => t.domaines.forEach((d) => { parSujet[d.nom] = (parSujet[d.nom] || 0) + 1; }));
  await writeFile(SORTIE, JSON.stringify({
    licence: "Base LEGI (DILA), licence ouverte Etalab 2.0 — https://echanges.dila.gouv.fr/OPENDATA/LEGI/",
    archive: arg.split("/").pop(), lu_le: auj, depuis: r.limite, textes: r.textes
  }) + "\n");
  console.log(`Fiches de textes lues : ${r.fiches}. Textes en vigueur depuis le ${r.limite} retenus : ${r.textes.length} (${r.articles} articles).`);
  console.log(`Articles lus : ${r.articlesVus}. Raisons : ${JSON.stringify(RAISONS)}`);
  for (let i = 0; i < Math.min(25, r.textes.length); i++) { const t = r.textes[Math.floor((i * r.textes.length) / 25)]; console.log(`  · ${t.date} ${t.titre.slice(0, 150)} [${t.domaines.map((d) => d.id).join(", ")}] ${t.articlesEnVigueur} art.`); }
  Object.entries(parSujet).sort((a, b) => b[1] - a[1]).forEach(([n, k]) => console.log(`  ${String(k).padStart(5)}  ${n}`));
}
