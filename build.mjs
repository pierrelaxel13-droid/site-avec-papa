#!/usr/bin/env node
/* ==========================================================================
   Assemble le site publiable dans _site/
   --------------------------------------------------------------------------
   Deux zones :

     public/   l'accueil qui montre les écrans, la tarification, la connexion
     app/      l'application : tableau de bord, plan, relevé, registre et les
               88 fiches de secteur

   Tout est engendré depuis assets/referentiel.js et contenu/. Rien n'est écrit
   deux fois : un domaine corrigé se propage aux 88 fiches.

   AVERTISSEMENT TENU DANS LE CODE ET DANS LES PAGES
   L'application n'a pas de serveur. La « connexion » pose un jeton dans le
   navigateur et rien d'autre : ce n'est pas une sécurité, le contenu des pages
   de l'application est lisible par qui regarde la source. Les données sont un
   jeu de démonstration. Les deux faits sont écrits sur les écrans concernés
   et doivent y rester tant qu'un vrai service d'authentification n'est pas en
   place.

   Usage : node build.mjs
   ========================================================================== */

import { cp, rm, mkdir, writeFile, readFile, readdir, stat } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pagesLegales, champsLegauxManquants } from "./legales.mjs";
import { texteBrut } from "./outils/tri.mjs";
import { applicationDuTexte, CATEGORIES_TABLEAU } from "./outils/textes-communs.mjs";

const RACINE = dirname(fileURLToPath(import.meta.url));
const SORTIE = resolve(RACINE, "_site");

const SITE = {
  /* Le nom du PRODUIT, celui que voient clients et consultants. La société qui
     l'édite est à part (societe) et n'apparaît que dans les pages légales :
     un consultant n'achète pas l'outil du cabinet d'un confrère. */
  nom: "Vigie",
  societe: "Pierrel & Co",       // l'éditeur — société en cours de création
  /* La caution métier : la personne, pas son cabinet. */
  concepteur: "Clément Pierrel",
  bareme: "Veille réglementaire par secteur",
  courriel: "contact@pierrel-co.fr",
  /* L'adresse publique du site : pour les liens de partage et l'aperçu sur les réseaux sociaux. */
  adresseWeb: "https://vigie-reglementaire.fr/",
  /* Le téléphone : vide tant qu'on n'a pas le vrai numéro. Vide, aucune ligne
     téléphone n'apparaît nulle part — un faux numéro est pire que pas de
     numéro. Pour l'ajouter : telephone "04 42 12 34 56", telephoneLien
     "+33442123456" (le même, en format international, sans espaces). */
  telephone: "",
  telephoneLien: "",
  /* « Le premier échange d'une heure est sans engagement » : seulement quand
     Clément l'a décidé. false = la promesse n'apparaît nulle part. */
  premierEchange: false,
  /* La TVA. "franchise" : micro-entreprise sous franchise en base, les prix
     sont nets et portent « TVA non applicable, art. 293 B du CGI ». "ht" : le
     jour où la TVA est facturée, les prix s'affichent « HT ». */
  tva: "franchise",
  /* L'identité légale de l'éditeur, pour les mentions légales, la politique de
     confidentialité et les CGV (legales.mjs). Vide = « [À COMPLÉTER] » visible
     sur ces pages et listé à chaque construction. */
  editeur: {
    denomination: "",          // une fois la société créée, ex. « Pierrel & Co SAS »
    forme: "",                 // ex. « SAS », « entreprise individuelle (micro-entreprise) »
    capital: "",               // pour une société, ex. « 1 000 € »
    adresse: "",               // siège social complet
    siret: "",
    immatriculation: "",       // ex. « RCS Salon-de-Provence » ou « Registre national des entreprises »
    directeurPublication: "",  // le représentant légal
    hebergeurDonnees: "Supabase, Inc. (États-Unis), base de données hébergée en Irlande (Union européenne)",
    tribunal: ""               // ex. « le tribunal de commerce d'Aix-en-Provence », avec l'avocat
  },
  /* L'offre consultant : la page consultants.html, le bloc « Vous êtes
     consultant QSE ? » de l'accueil et le lien du pied. Allumée depuis que le
     produit a son propre nom (Vigie). false les retire tous les trois. */
  offreConsultant: true,
  /* La base de données et les comptes : Supabase. Seulement l'adresse du
     projet et la clé PUBLIQUE (sb_publishable_…), faites pour être dans le
     site : ce qui protège les données, ce sont les règles de la base. La clé
     SECRÈTE va dans les secrets GitHub, JAMAIS ici (la construction s'arrête
     si elle y est). url vide = les pages de compte disent « pas encore ouverts ».
     Pour essayer sur un poste, avec l'imitation outils/supabase-local.mjs :
       VIGIE_SUPABASE=http://localhost:8830 node build.mjs */
  supabase: {
    url: process.env.VIGIE_SUPABASE || "https://denpxyqbvjcwsbxjtqpd.supabase.co",
    cle: "sb_publishable_zJXo39cN5hEAdCQFwm5DkA_ru99Xodj"
  },
  hebergeur: { nom: "GitHub, Inc. (GitHub Pages)", site: "https://github.com",
               adresse: "88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis" }
};

/* Le logo écrit : le sigle et le nom du produit. Partout le même. */
const motMarque = () => `${sigle}<span>${esc(SITE.nom)} <span class="marque-suite">réglementaire</span></span>`;

/* « de Istres » ne se dit pas : « d'Istres ». */
const de = (lieu) => (/^[aeiouyéèêh]/i.test(lieu) ? "d'" : "de ") + lieu;

/* Le téléphone, seulement s'il existe. */
const aTel = () => !!SITE.telephone;
const lienTel = (classe = "") => aTel()
  ? `<a${classe ? ` class="${classe}"` : ""} href="tel:${esc(SITE.telephoneLien)}">${esc(SITE.telephone)}</a>` : "";
const parQuoi = () => (aTel() ? "par téléphone ou par courriel" : "par courriel");
/* Garde-fou : un numéro de remplissage (« 04 00 00 00 00 ») arrête la construction. */
/* Garde-fou : une clé secrète de Supabase dans le site serait lisible par tous. */
{
  const k = SITE.supabase.cle;
  let role = "";
  try { role = JSON.parse(Buffer.from(k.split(".")[1] || "", "base64url").toString()).role || ""; } catch { /* pas un jeton */ }
  if (/^sb_secret_/.test(k) || role === "service_role")
    throw new Error("SITE.supabase.cle est la clé SECRÈTE de Supabase : elle ne doit jamais être dans le site. Mettre la clé publique (sb_publishable_…).");
}
if (/^0\d( 00){4}$|^\+33\d0{8}$/.test(SITE.telephone) || /0{8}$/.test(SITE.telephoneLien))
  throw new Error("SITE.telephone ressemble à un numéro de remplissage : mettre le vrai, ou laisser vide.");

async function chargeFichier(chemin, cle) {
  const source = await readFile(resolve(RACINE, chemin), "utf8");
  const faux = {};
  new Function("window", source)(faux);
  return faux[cle];
}

const esc = (v) => String(v == null ? "" : v)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const sansAccent = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const slug = (s) => sansAccent(s).toLowerCase()
  .replace(/['’]/g, " ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);

const JOUR = { day: "numeric", month: "long", year: "numeric" };
/* En français le premier du mois se dit « 1er » ; les autres jours, non. */
const dateFr = (iso) => new Date(iso + "T12:00:00Z")
  .toLocaleDateString("fr-FR", JOUR).replace(/^1 /, "1er ");

/* --- Les trois formules et ce que chacune ouvre ---------------------------- */
/* Grille du 4 novembre 2026 : 39, 59 et 89 € HT par mois ; à l'année, 410, 650
   et 999 € HT (« 1 mois offert »), sans cadrage sur place. Les montants sont
   ici, en euros ; tout le reste (libellés, mention de TVA) en est tiré. Le rang décide : une page demande un
   rang, la session en porte un. C'est la seule règle et elle est appliquée
   dans le navigateur — donc contournable. Elle décrit le produit, elle ne le
   protège pas. Les mêmes clés et les mêmes rangs sont dans assets/session.js. */
/* Les liens de paiement Stripe, lus dans contenu/paiement.js par main(). Vide :
   le bouton ouvre un courriel. */
let PAIEMENT = {};
/* Les normes de référence par sujet (contenu/normes.js) : seules les validées s'affichent. */
let NORMES = {};
/* Les sources relevées qui ne sont pas officielles (« officielle: false » dans
   contenu/sources.js, ex. Prism'emploi) : leurs publications le disent. */
let NON_OFFICIELLES = new Set();
const lienPaiement = (id, periode) =>
  (id === "portail" ? PAIEMENT.portail : PAIEMENT[id] && PAIEMENT[id][periode]) || "";
const paiementComplet = () => Object.keys(FORMULES).every((id) => lienPaiement(id, "an") && lienPaiement(id, "mois"));

const FORMULES = {
  textes:  { l: "Textes", carte: "État des lieux réglementaire", rang: 1, mois: 39, an: 410,
             pour: "Vous voulez savoir ce qui paraît pour votre métier.",
             ouvre: "Les textes de votre métier, chacun avec ce qu'il faut faire et la fiche de chaque métier (732 codes APE).",
             surCarte: false,   // la carte ne dit pas « pour qui » (choix d'Axel, 2 novembre 2026)
             donne: ["L'ensemble des textes applicables à votre société, par catégorie (santé, hygiène, sécurité, environnement, ressources humaines), en fonction des spécificités de votre structure",
                     "Une analyse synthétique de chaque texte",
                     "Les sources et les liens des textes",
                     "Les alertes : une alerte vous rappelle de prendre connaissance des nouveautés",
                     "Tableau de bord de suivi"] },
  suivi:   { l: "Textes et suivi", carte: "État des lieux réglementaire et plan d'actions", rang: 2, mois: 59, an: 650,
             pour: "Vous voulez aussi savoir quoi revoir et quand.",
             ouvre: "En plus : votre plan de veille, le tableau de bord, les alertes et les conseils de l'IA.",
             surCarte: false,
             donne: ["L'ensemble des textes applicables à votre société, par catégorie (santé, hygiène, sécurité, environnement, ressources humaines), en fonction des spécificités de votre structure",
                     "Une analyse synthétique de chaque texte",
                     "Les sources et les liens des textes",
                     "Les alertes : une alerte vous rappelle de prendre connaissance des nouveautés",
                     "Préconisation des actions pour répondre aux nouvelles exigences",
                     "Tableau de bord de suivi de réalisation des actions"] },
  complet: { l: "Veille complète", carte: "État des lieux réglementaire, plan d'actions, état de conformité réglementaire", rang: 3, surCarte: false, mois: 89, an: 999,
             pour: "Vous passez un audit ou une certification.",
             ouvre: "Tout, le registre de preuves et le conseil de l'IA pour votre métier compris.",
             donne: ["Tout ce que donne l'offre État des lieux réglementaire et plan d'actions",
                     "Établissement d'un tableau de synthèse de veille réglementaire"] }
};

/* --- L'offre consultant ----------------------------------------------------
   Un consultant QSE livre la veille à ses clients ; on facture par client
   suivi, au mois, selon le nombre de clients équipés. Chaque client a la
   formule complète. Marque blanche (logo, nom, couleurs, exports PDF) dès 6. */
const OFFRE_CONSULTANT = {
  paliers: [
    { de: 3, a: 5, mois: 49, blanche: false },
    { de: 6, a: 15, mois: 42, blanche: true },
    { de: 16, a: null, mois: 35, blanche: true }
  ],
  equivalent: "complet"   // la formule que chaque client final reçoit
};

/* Les prix, écrits une seule fois. « 1 490 € » : espace insécable avant les
   milliers et avant le symbole, pour qu'ils ne se coupent jamais en fin de ligne. */
const TVA = {
  franchise: { suffixe: "", mention: "TVA non applicable, art. 293 B du CGI" },
  ht:        { suffixe: " HT", mention: "Prix hors taxes" }
}[SITE.tva];
if (!TVA) throw new Error(`SITE.tva doit valoir "franchise" ou "ht", pas « ${SITE.tva} ».`);
// L'espace fine insécable (U+202F) que donne toLocaleString n'existe pas dans
// la police du site : elle s'affichait « 1490 ». On met l'insécable ordinaire.
const eur = (n) => `${n.toLocaleString("fr-FR").replace(/\u202f/g, "\u00a0")}\u00a0€${TVA.suffixe}`;
for (const [id, f] of Object.entries(FORMULES)) {
  // « N mois offerts » : les mois que l'année épargne, arrondis au mois le plus proche.
  f.moisOfferts = Math.round(12 - f.an / f.mois);
  if (f.moisOfferts < 1) throw new Error(`FORMULES.${id} : ${f.an} € par an n'offre aucun mois sur ${f.mois} € par mois.`);
  f.offre = f.moisOfferts === 1 ? "1 mois offert" : `${f.moisOfferts} mois offerts`;
  f.montant = eur(f.mois);                 // « 59 € »
  f.prix = `${eur(f.mois)} par mois`;      // « 59 € par mois »
  f.prixAn = `${eur(f.an)} par an`;        // « 590 € par an »
}

/* --- Le manifeste : ce qui rend l'application installable ------------------- */
/* Android veut du PNG en 192 et 512 et une icône « maskable » qu'il peut
   rogner jusqu'à 20 % du bord sans manger le dessin. assets/icones/ est
   engendré depuis le sigle par outils/icones.mjs. */
const MANIFESTE = JSON.stringify({
  name: "Vigie — veille réglementaire",
  short_name: "Vigie",
  description: "Votre veille réglementaire tenue et prouvable : plan de veille, relevé des textes, registre de preuves.",
  lang: "fr",
  dir: "ltr",
  start_url: "./index.html",
  scope: "./",
  display: "standalone",
  orientation: "any",
  background_color: "#FFFFFF",
  theme_color: "#4A2BE8",
  categories: ["business", "productivity"],
  icons: [
    { src: "assets/icones/icone-192.png", sizes: "192x192", type: "image/png" },
    { src: "assets/icones/icone-512.png", sizes: "512x512", type: "image/png" },
    { src: "assets/icones/icone-512-pleine.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
  ],
  shortcuts: [
    { name: "Tableau de bord", url: "./app/index.html" },
    { name: "Ma veille réglementaire", url: "./app/plan.html" },
    { name: "Registre et conformité", url: "./app/conformite.html" }
  ]
}, null, 2);

/* --- Le sigle : trois feuillets décalés ------------------------------------ */
const sigle = `<svg class="sigle" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
  <rect x="2" y="4" width="14" height="3.1" rx="1.55"/>
  <rect x="5" y="10.45" width="14" height="3.1" rx="1.55" opacity=".7"/>
  <rect x="8" y="16.9" width="14" height="3.1" rx="1.55" opacity=".42"/>
</svg>`;

/* L'empreinte de l'habillage, posée par main() avant d'écrire les pages. */
let VERSION = "";

/* Une taille écrite sur l'icône elle-même : si la feuille de style manque ou
   est en retard d'une version, la flèche reste une flèche, pas un dessin qui
   prend toute la largeur. */
const fleche = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor"
  stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h13m-5-6 6 6-6 6"/></svg>`;

const imprimante = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"
  stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:1.1em;height:1.1em">
  <path d="M7 9V3.5h10V9"/><rect x="3.5" y="9" width="17" height="7.5" rx="1.6"/>
  <path d="M7 14h10v6.5H7z"/></svg>`;

const chevron = `<svg class="chevron" viewBox="0 0 24 24" aria-hidden="true" fill="none"
  stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`;

/* La taille est posée ici, pas dans la feuille : ce pictogramme se glisse dans
   des contextes très différents — puces, tableaux, notes — et partout où rien
   ne le dimensionnait il s'affichait à la largeur de son conteneur. */
const sortant = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"
  stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"
  style="width:.8em;height:.8em;display:inline-block;vertical-align:-.05em;flex:none"><path d="M8 16 16 8m0 0H9m7 0v7"/></svg>`;

/* --- Le sélecteur de thème, identique partout ------------------------------- */
const selecteurTheme = `<span class="theme" role="group" aria-label="Thème de la page">
  <button type="button" data-theme-choix="light" aria-pressed="false" title="Thème clair">
    <span class="cache-visuellement">Thème clair</span>
    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.2M12 19.2v2.2M4.2 12H2M22 12h-2.2M6.1 6.1 4.6 4.6M19.4 19.4l-1.5-1.5M17.9 6.1l1.5-1.5M4.6 19.4l1.5-1.5"/></svg>
  </button>
  <button type="button" data-theme-choix="auto" aria-pressed="false" title="Suivre le système">
    <span class="cache-visuellement">Suivre le réglage du système</span>
    <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.8" y="4.2" width="18.4" height="13" rx="1"/><path d="M8.5 20.5h7"/></svg>
  </button>
  <button type="button" data-theme-choix="dark" aria-pressed="false" title="Thème sombre">
    <span class="cache-visuellement">Thème sombre</span>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.4 8.4 0 1 0 10.2 10.2Z"/></svg>
  </button>
</span>`;

/* --- La bande « Installer l'application » ----------------------------------- */
/* Pierrel & Co n'est pas sur l'App Store ni sur Google Play : il n'y a pas
   d'application native, donc pas de badge de boutique à afficher — ce serait
   un lien vers rien. Ce qui existe vraiment, c'est une application web
   installable : le navigateur la pose sur l'écran d'accueil, elle s'ouvre
   sans barre d'adresse et fonctionne hors ligne. Les pictogrammes sont donc
   des appareils, pas des marques. */
function bandeInstallation(a) {
  const appareil = (titre, aide, chemin) => `<li class="appareil">
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"
         stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${chemin}</svg>
    <div><h3>${esc(titre)}</h3><p>${aide}</p></div>
  </li>`;

  return `<section class="section installation" id="installer">
  <div class="enveloppe">
    <div class="deux-colonnes">
      <div>
        <h2>Installer l'application</h2>
        <p class="intro">Accessible sur votre téléphone, elle s'ouvre comme une application et fonctionne sans réseau.</p>
        <p class="rangee" style="margin-top:var(--t4)">
          <button type="button" class="bouton bouton-accent" id="installer-appli" hidden>
            Installer maintenant
          </button>
          <a class="bouton bouton-sobre" href="${a("connexion.html")}">Connexion</a>
        </p>
        <p class="etiq" id="etat-installation" role="status" style="margin-top:var(--t3)"></p>
      </div>
      <ul class="appareils">
        ${appareil("iPhone et iPad", "Dans Safari : <strong>Partager</strong>, puis <strong>Sur l'écran d'accueil</strong>.",
          '<rect x="6.5" y="2.5" width="11" height="19" rx="2.4"/><path d="M10.5 5.2h3"/>')}
        ${appareil("Android", "Dans Chrome : le bandeau <strong>Installer</strong>, ou le menu ⋮ puis <strong>Ajouter à l'écran d'accueil</strong>.",
          '<rect x="5.5" y="2.5" width="13" height="19" rx="2.4"/><path d="M10 18.3h4"/>')}
        ${appareil("Ordinateur", "Dans Chrome ou Edge : l'icône <strong>Installer</strong> dans la barre d'adresse.",
          '<rect x="2.5" y="4.5" width="19" height="12.5" rx="1.6"/><path d="M8 20.5h8"/>')}
      </ul>
    </div>
    <p class="note-source" style="margin-top:var(--t5)">
      ${esc(SITE.nom)} n'est ni sur l'App Store ni sur Google Play : il n'y a pas
      d'application à télécharger, mais une application web que le navigateur installe
      lui-même. Rien n'est transmis à une boutique et il n'y a pas de compte à créer
      pour l'installer.
    </p>
  </div>
</section>`;
}

/* --- Gabarit commun ----------------------------------------------------------- */
/* La politique de sécurité, écrite aussi dans chaque page. GitHub Pages, qui
   publie le site depuis le 27 octobre 2026, ne sait pas envoyer d'en-têtes :
   sans cette balise, la règle « aucun script écrit dans le HTML » tomberait.
   C'est celle de netlify.toml, moins frame-ancestors, qu'une balise ne peut
   pas porter (le navigateur l'ignore et le signale).
   connect-src : le site ne parle qu'à lui-même et à Supabase (les comptes et
   la base). Rien d'autre ne peut être appelé, même par un script injecté. */
const SUPABASE = SITE.supabase.url ? new URL(SITE.supabase.url).origin : "";
const POLITIQUE = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; " +
  `font-src 'self'; connect-src 'self'${SUPABASE ? " " + SUPABASE : ""}; manifest-src 'self'; worker-src 'self'; frame-src 'none'; object-src 'none'; ` +
  "base-uri 'none'; form-action 'self'" + (/^https:/.test(SUPABASE) || !SUPABASE ? "; upgrade-insecure-requests" : "");

function page({ titre, description, racine = "", zone = "public", actif = "", corps,
                attrsBody = "", verrou = false, donneesPlan = false, formule = "", scripts = [], installation = true,
                piedCourt = zone === "app" }) {
  /* piedCourt : là où le client travaille (l'application, la démo, ses pages
     de compte, la connexion), le bas de page ne garde que les liens légaux. */
  /* Les feuilles de style et les scripts portent la version de l'habillage :
     une page nouvelle ne peut plus être servie avec la feuille de style de la
     veille, gardée par le navigateur (une heure) ou par le service worker. */
  const a = (f) => racine + f + (VERSION && /\.(css|js)$/.test(f) ? `?v=${VERSION}` : "");
  const lien = (href, libelle, cle) =>
    `<a href="${a(href)}"${actif === cle ? ' aria-current="page"' : ""}>${libelle}</a>`;

  /* Le menu du site, dans l'ordre voulu par Axel (2 novembre 2026) : Accueil,
     Présentation (la page « Comment ça marche »), S'abonner, Connexion. Au
     téléphone, « Connexion » reste dans le bandeau, hors du menu replié. */
  const maison = `<svg class="icone-menu" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 10.5 12 3.5l8.5 7"/>
        <path d="M5.5 9v10.5h4.5v-6h4v6h4.5V9"/></svg>`;
  const menuPublic = `
      ${lien("index.html", `${maison}Accueil`, "produit")}
      ${lien("contact.html", "Nous contacter", "contact")}
      ${lien("decouvrir.html", "Présentation", "decouvrir")}
      ${lien("abonnement.html", "S'abonner", "abonnement")}
      <a class="bouton bouton-bandeau connexion-bureau" href="${a("connexion.html")}">Connexion</a>
      ${selecteurTheme}`;

  const menuApp = `
      ${lien("app/index.html", "Tableau de bord", "bord")}
      ${lien("app/plan.html", "Ma veille réglementaire", "plan")}
      ${lien("app/actions.html", "Plan d'actions", "actions")}
      ${lien("app/conformite.html", "Registre et conformité réglementaire", "conformite")}
      ${lien("app/reglages.html", "Réglages", "reglages")}
      ${selecteurTheme}`;

  return tailleDesIcones(`<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${POLITIQUE}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titre)}</title>
<meta name="description" content="${esc(description)}">
<meta name="author" content="${esc(SITE.nom)}">
<meta name="theme-color" content="#4A2BE8">
${zone === "app" ? '<meta name="robots" content="noindex">' : ""}
<meta property="og:title" content="${esc(titre)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(SITE.nom)} réglementaire">
<meta property="og:locale" content="fr_FR">
<meta property="og:image" content="${esc(SITE.adresseWeb)}assets/ecrans/bord.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${a("assets/favicon.svg")}" type="image/svg+xml">
<link rel="apple-touch-icon" href="${a("assets/icones/icone-apple.png")}">
<link rel="manifest" href="${a("manifest.webmanifest")}">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="${esc(SITE.nom)}">
<link rel="preload" href="${a("assets/polices/plus-jakarta-sans.woff2")}" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${a("assets/polices.css")}">
<link rel="stylesheet" href="${a("assets/site.css")}">
<script src="${a("assets/theme.js")}"></script>
<script src="${a("assets/amorce.js")}"></script>
</head>
<body class="zone-${zone}" data-racine="${racine || "./"}" data-courriel="${esc(SITE.courriel)}" data-nom="${esc(SITE.nom)}"${zone === "app" || scripts.includes("assets/compte.js") || scripts.includes("assets/contact.js") || scripts.includes("assets/recap.js") ? ` data-supabase="${esc(SITE.supabase.url)}" data-supabase-cle="${esc(SITE.supabase.cle)}"` : ""}${formule ? ` data-formule="${esc(formule)}"` : ""}${attrsBody}>

<a class="evitement" href="#contenu">Aller au contenu</a>

<header class="bandeau">
  <div class="enveloppe bandeau-interieur">
    <a class="marque" href="${a(zone === "app" ? "app/index.html" : "index.html")}">
      ${motMarque()}
    </a>
    ${zone === "public" ? `<a class="bouton bouton-bandeau connexion-telephone" href="${a("connexion.html")}">Connexion</a>` : ""}
    ${zone === "app" ? `<div class="cloche-boite" data-exige="textes">
      <button type="button" class="cloche" id="cloche" aria-expanded="false" aria-controls="panneau-avis">
        <span class="cache-visuellement">Nouveaux textes</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M18 8.5a6 6 0 1 0-12 0c0 6-2 7.5-2 7.5h16s-2-1.5-2-7.5"/>
          <path d="M10.4 19.5a2 2 0 0 0 3.2 0"/>
        </svg>
        <span class="pastille-compte" id="compte-avis" hidden>0</span>
      </button>
      <div class="panneau-avis" id="panneau-avis" hidden>
        <div class="panneau-tete">
          <h2>Nouveaux textes</h2>
          <button type="button" class="lien-nu" id="tout-lu">Tout marquer comme lu</button>
        </div>
        <ul id="liste-avis"></ul>
        <p class="panneau-pied">
          Ces alertes s'affichent dans l'application. Pour les recevoir aussi par
          courriel, il faut un serveur qui envoie — voir
          <a href="${a("app/reglages.html")}">Réglages, Mes alertes</a>.
        </p>
      </div>
    </div>` : ""}
    <button type="button" class="menu-bascule" aria-expanded="false" aria-controls="menu-principal">
      <span class="cache-visuellement">Ouvrir le menu</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
        <path d="M4 7h16M4 12h16M4 17h16"/></svg>
    </button>
    <nav class="menu" id="menu-principal" aria-label="Navigation principale">${zone === "app" ? menuApp : menuPublic}</nav>
  </div>
</header>

${zone === "app" ? `<p class="bandeau-demo" data-mode="demo">
  <strong>Démonstration.</strong>
  <span id="formule-active"></span>
  Les données ci-dessous sont un jeu d'essai (entreprise et textes fictifs).
  Rien n'est envoyé chez nous : ce que vous faites ici reste dans votre navigateur.
  <a href="${a("abonnement.html")}#essayer">Changer de formule</a> ·
  <a href="${a("index.html")}">Revenir au site</a>
</p>
<p class="bandeau-demo" data-mode="compte" hidden>
  <strong>Votre espace.</strong>
  <span data-formule-compte></span>
  Vos réglages, vos cases « Fait » et votre registre sont enregistrés dans votre compte.
  <a href="${a("compte/")}">Mon compte</a>
</p>` : ""}

<main id="contenu">
${verrou ? `<section class="verrou" id="verrou">
  <div class="enveloppe">
    <p class="etiq" id="verrou-etiq">Accès réservé</p>
    <h1 id="verrou-titre">Votre veille est derrière la connexion</h1>
    <p class="chapeau" id="verrou-texte">
      Le plan de veille, le relevé des textes et le registre de preuves sont réservés
      aux abonnés. Vous pouvez ouvrir la démonstration pour voir exactement ce que
      contient l'application.
    </p>
    <p class="rangee rangee-centre" style="margin-top:var(--t5)">
      <a class="bouton bouton-accent" href="${a("abonnement.html")}#essayer" id="verrou-action">Ouvrir la démonstration</a>
      <a class="bouton bouton-sobre" href="${a("abonnement.html")}" id="verrou-tarifs">Voir les tarifs</a>
    </p>
  </div>
</section>` : ""}
${corps}
${zone === "public" && installation ? bandeInstallation(a) : ""}
</main>

<footer class="pied${piedCourt ? " pied-court" : ""}">
  <div class="enveloppe">
${piedCourt ? "" : `
    <div class="pied-grille">
      <div class="pied-marque">
        <span class="marque">${motMarque()}</span>
        <p>${esc(SITE.bareme)}, pour les PME : les textes qui vous concernent et ce qu'il faut faire.</p>
        <p class="pied-contact"><a href="mailto:${esc(SITE.courriel)}">${esc(SITE.courriel)}</a>${aTel() ? ` · ${lienTel()}` : ""}</p>
      </div>
      <nav aria-label="Le produit">
        <h2>Le produit</h2>
        <ul>
          <li><a href="${a("decouvrir.html")}">Présentation</a></li>
          <li><a href="${a("abonnement.html")}">Nos offres</a></li>
          ${SITE.offreConsultant ? `<li><a href="${a("consultants.html")}">Offre consultants QSE</a></li>` : ""}
          <li><a href="${a("abonnement.html")}#essayer">Démonstration gratuite</a></li>
          ${lienPaiement("portail") ? `<li><a href="${esc(lienPaiement("portail"))}">Gérer mon abonnement</a></li>` : ""}
        </ul>
      </nav>
      ${zone === "app" ? `<nav aria-label="L'application">
        <h2>L'application</h2>
        <ul>
          <li><a href="${a("app/index.html")}">Tableau de bord</a></li>
          <li><a href="${a("app/plan.html")}">Ma veille réglementaire</a></li>
          <li><a href="${a("app/actions.html")}">Plan d'actions</a></li>
          <li><a href="${a("app/conformite.html")}">Registre et conformité</a></li>
          <li><a href="${a("app/reglages.html")}">Réglages</a></li>
        </ul>
      </nav>` : `<nav aria-label="Vigie">
        <h2>${esc(SITE.nom)}</h2>
        <ul>
          <li><a href="${a("nous.html")}">Qui sommes-nous</a></li>
          <li><a href="${a("contact.html")}">Nous contacter</a></li>
          <li><a href="${a("connexion.html")}">Connexion</a></li>
        </ul>
      </nav>`}
      <nav aria-label="Sources officielles">
        <h2>Sources officielles</h2>
        <ul>
          <li><a href="https://www.legifrance.gouv.fr" target="_blank" rel="noopener">Légifrance</a></li>
          <li><a href="https://www.legifrance.gouv.fr/jorf/jo" target="_blank" rel="noopener">Journal officiel</a></li>
          <li><a href="https://eur-lex.europa.eu" target="_blank" rel="noopener">EUR-Lex</a></li>
          <li><a href="https://entreprendre.service-public.fr" target="_blank" rel="noopener">Entreprendre</a></li>
          <li><a href="https://www.inrs.fr" target="_blank" rel="noopener">INRS</a></li>
        </ul>
      </nav>
    </div>
`}
    <div class="pied-bas">
      <p class="pied-droits">© ${new Date().getFullYear()} ${esc(SITE.nom)}, édité par ${esc(SITE.societe)}. Ne constitue pas un conseil juridique.</p>
      <p class="pied-legal">
        <a href="${a("mentions-legales.html")}">Mentions légales</a>
        <a href="${a("confidentialite.html")}">Confidentialité et RGPD</a>
        <a href="${a("cgv.html")}">CGV</a>
        <a href="${a("contact.html")}">Contact</a>
      </p>
    </div>
  </div>
</footer>

${donneesPlan || zone === "app" ? `<script src="${a("assets/plan-data.js")}"></script>` : ""}
${zone === "app" ? `<script src="${a("assets/vigie.js")}"></script>
<script src="${a("assets/magasin.js")}"></script>` : ""}
<script src="${a("assets/app.js")}"></script>
${zone === "app" ? `<script src="${a("assets/avis-data.js")}"></script>
<script src="${a("assets/entreprise.js")}"></script>
<script src="${a("assets/avis.js")}"></script>` : ""}
${zone !== "app" && (scripts.includes("assets/compte.js") || scripts.includes("assets/contact.js") || scripts.includes("assets/recap.js")) ? `<script src="${a("assets/vigie.js")}"></script>` : ""}
${zone === "app" || verrou || actif === "abonnement" ? `<script src="${a("assets/session.js")}"></script>` : ""}
${zone === "app" ? `<script src="${a("assets/espace.js")}"></script>` : ""}
${scripts.map((f) => `<script src="${a(f)}"></script>`).join("\n")}
</body>
</html>
`);
}

/* Chaque icône (dessin de 24 sur 24) porte une taille par défaut sur elle-même.
   La feuille de style la remplace partout ; mais si elle manque ou arrive en
   retard, une icône sans taille prend toute la largeur — d'où les « grosses
   flèches » vues le 26 octobre. */
function tailleDesIcones(html) {
  return html.replace(/<svg(?![^>]*\swidth=)([^>]*viewBox="0 0 24 24")/g, '<svg width="20" height="20"$1');
}

/* --- Périmètre d'une division ---------------------------------------------- */
function perimetre(V, code) {
  const base = [];
  const vu = new Set();
  [...V.transversaux, ...(V.parDivision[code] || [])].forEach((id) => {
    if (V.domaines[id] && !vu.has(id)) { vu.add(id); base.push(id); }
  });
  const declencheurs = V.declencheurs.filter((q) =>
    q.domaines.some((id) => V.domaines[id] && !vu.has(id)));
  const ajoutables = [];
  const vuAjout = new Set();
  declencheurs.forEach((q) => q.domaines.forEach((id) => {
    if (V.domaines[id] && !vu.has(id) && !vuAjout.has(id)) { vuAjout.add(id); ajoutables.push(id); }
  }));
  const ordre = Object.keys(V.frequences).sort((a, b) => V.frequences[a].ordre - V.frequences[b].ordre);
  const groupes = ordre.map((fid) => ({
    id: fid, f: V.frequences[fid],
    base: base.filter((id) => V.domaines[id].frequence === fid),
    ajout: ajoutables.filter((id) => V.domaines[id].frequence === fid)
  })).filter((g) => g.base.length || g.ajout.length);
  return { base, declencheurs, ajoutables, groupes };
}

/* --- Le plan d'une entreprise : LA source des chiffres ----------------------
   Code APE (sa division) + situations cochées. Tout ce qui compte les sujets
   d'une entreprise — en-tête, cartes, rubriques, sujets écartés, relevé —
   part d'ici et assets/entreprise.js refait le même calcul dans le
   navigateur (perimetre()) sur les mêmes données. */
function planDe(V, ent) {
  const { base } = perimetre(V, ent.naf);
  const ajoutes = [];
  (ent.contexte || []).forEach((qid) => {
    const q = V.declencheurs.find((x) => x.id === qid);
    if (q) q.domaines.forEach((id) => { if (V.domaines[id] && !base.includes(id) && !ajoutes.includes(id)) ajoutes.push(id); });
  });
  const liste = [...base, ...ajoutes];
  return { base, ajoutes, liste, ecartes: Object.keys(V.domaines).filter((id) => !liste.includes(id)) };
}
/* La phrase qui dit d'où vient le chiffre : le code APE, puis la situation. */
function phrasePlan(V, ent, plan) {
  const noms = plan.ajoutes.map((id) => V.domaines[id].nom);
  return `<span data-plan-total>${plan.liste.length}</span> sujets s'appliquent chez <span id="plan-chez">${esc(ent.nom)}</span><span id="plan-detail"> : ` +
    (noms.length
      ? `${plan.base.length} par son code APE (${esc(ent.nafComplet || ent.naf)}), ${noms.length} par sa situation (${esc(noms.join(", "))})`
      : `tous par son code APE (${esc(ent.nafComplet || ent.naf)})`) +
    `</span>. Ils sont rangés selon le rythme auquel les revoir : cliquez sur un rythme pour voir les sujets à revoir à ce rythme.`;
}

/* --- Fait, ou pas fait ------------------------------------------------------
   Pour chaque texte qui demande un geste, le client dit s'il l'a fait. Le
   bouton vit dans « Ce que vous devez faire » ; le titre de la fiche porte la
   marque « Fait » une fois coché et la carte de la catégorie compte. Pour un
   sujet du plan, c'est la revue qui est faite et elle se refait à son rythme
   (« periode », en jours). C'est gardé dans ce navigateur (app.js). */
/* objet : ce que le registre d'un vrai compte retiendra quand on coche. */
function boutonFait(id, { periode = 0, libelle = "Marquer comme fait", objet = "" } = {}) {
  return `<div class="bloc-fait" data-fait="${esc(id)}"${periode ? ` data-periode="${periode}"` : ""} data-libelle="${esc(libelle)}"${objet ? ` data-objet="${esc(objet)}"` : ""}>
    <button type="button" class="bouton-fait" aria-pressed="false">
      <span class="fait-case" aria-hidden="true"></span><span class="fait-texte">${esc(libelle)}</span>
    </button>
    <span class="fait-quand" role="status"></span>
  </div>`;
}
const marqueFait = (id) => `<span class="marque-fait" data-etat-fait="${esc(id)}" hidden>Fait</span>`;
const JOURS_DE = { quotidienne: 1, hebdomadaire: 7, mensuelle: 31, trimestrielle: 92 };
/* Un rythme dit en français courant : « à revoir chaque semaine », pas « à revoir hebdomadaire ». */
const CHAQUE = { quotidienne: "chaque jour", hebdomadaire: "chaque semaine", mensuelle: "chaque mois", trimestrielle: "chaque trimestre" };

function blocDomaine(C, LIENS, id, d, origine, lienSecteur = "", racine = "", fait = false, rang = -1) {
  return `<article class="bloc-domaine" id="domaine-${esc(id)}" data-domaine="${esc(id)}" data-origine="${origine}"${rang >= 0 ? ` data-rang="${rang}"` : ""}${origine === "declencheur" || origine === "hors" ? " hidden" : ""}>
  <div class="bloc-domaine-tete">
    <h3>${esc(d.nom)}</h3>
    ${origine === "declencheur" ? '<span class="marque-ajout">ajouté par votre contexte</span>' : ""}
    ${fait ? marqueFait(`plan:${id}`) : ""}
  </div>
  <p class="bloc-domaine-resume">${esc(d.resume)}</p>
  ${fait ? boutonFait(`plan:${id}`, { periode: JOURS_DE[d.frequence] || 31, libelle: "Marquer la revue comme faite", objet: `Revue « ${d.nom} »` }) : ""}
  <div class="bloc-domaine-corps">
    <div>
      <span class="etiq">Ce qu'il faut faire</span>
      <ul class="a-faire">${(d.actions || []).map((a) => `<li>${esc(a)}</li>`).join("")}</ul>
      <span class="etiq" style="margin-top:var(--t4)">Ce qu'il faut tenir</span>
      <ul>${d.obligations.map((o) => `<li>${esc(o)}</li>`).join("")}</ul>
    </div>
    <div>
      <span class="etiq">Les textes et où les lire</span>
      <ul class="textes-lies">${d.textes.map((ref) => {
        const L = lienDuTexte(C, LIENS, ref);
        return `<li>
        <a href="${racine}texte/${slug(ref)}.html">${esc(ref)}</a>
        <a class="lien-officiel" href="${esc(L.url)}" target="_blank" rel="noopener"
           title="${esc(L.quoi)}">${esc(intituleDuLien(L))} ${sortant}</a></li>`;
      }).join("")}</ul>
      ${(NORMES[id] || []).filter((x) => x.valide).length ? `<span class="etiq" style="margin-top:var(--t4)">Normes de référence</span>
      <ul class="normes-sujet">${NORMES[id].filter((x) => x.valide).map((x) => `<li><strong>${esc(x.ref)}</strong> — ${esc(x.titre)}</li>`).join("")}</ul>
      <p class="note-source">Texte payant, chez l'AFNOR. Une norme est volontaire, sauf si un texte la rend obligatoire.</p>` : ""}
    </div>
  </div>
  ${lienSecteur ? `<p style="margin-top:var(--t4)">
    <a class="lien-fleche" href="${lienSecteur}">Voir un secteur où ce domaine s'applique ${fleche}</a>
  </p>` : ""}
</article>`;
}

/* Une rubrique de l'application : un titre à gauche, le contenu dessous. */
function rubrique({ etiq, contenu, aplat = false, id = "", attrs = "" }) {
  return `<section class="rubrique${aplat ? " section-tein" : ""}"${id ? ` id="${id}"` : ""}${attrs}>
  <div class="enveloppe">
    <h2>${esc(etiq)}</h2>
    ${contenu}
  </div>
</section>`;
}

/* ==========================================================================
   L'application
   ========================================================================== */

const STATUTS = {
  "a-analyser": { l: "À analyser", c: "attente" },
  "analyse":    { l: "Analysé",    c: "neutre" },
  "action":     { l: "Action ouverte", c: "ouvert" },
  "clos":       { l: "Clos",       c: "clos" }
};

/* La fiche du secteur de l'entreprise suivie : le code NAF du bandeau y mène. */
function ficheDeLEntreprise(V, D) {
  const d = V.divisions.filter((x) => x.c === D.entreprise.naf)[0];
  return d ? `secteur/${d.c}-${slug(d.l)}.html` : "";
}

function enTeteApp(D, titre, chapeau, lienNaf = "") {
  return `<section class="tete-app">
  <div class="enveloppe">
    <!-- Chaque pastille mène quelque part : le nom, la ville et l'effectif à
         Réglages, où on les change ; le code NAF à la fiche du métier ; la
         date de début de suivi au registre, qui en garde la trace. -->
    <ul class="jalons">
      <li><a class="fort" href="reglages.html" title="Modifier dans Réglages"><span id="tete-nom">${esc(D.entreprise.nom)}</span></a></li>
      <li><a href="${lienNaf || "secteurs.html"}">NAF <span id="tete-naf">${esc(D.entreprise.nafComplet)}</span></a></li>
      <li><a href="reglages.html" title="Modifier dans Réglages"><span id="tete-ville">${esc(D.entreprise.ville)}</span></a></li>
      <li><a href="reglages.html" title="Modifier dans Réglages"><span id="tete-effectif">${esc(D.entreprise.effectif)}</span> salariés</a></li>
      <li><a href="conformite.html#registre" title="Voir le registre">Suivi depuis <span id="tete-depuis">${esc(D.entreprise.depuis)}</span></a></li>
    </ul>
    <h1>${esc(titre)}</h1>
    ${chapeau ? `<p class="chapeau">${chapeau}</p>` : ""}
  </div>
</section>`;
}

/* Un lien qui couvre toute la carte. Posé dans le <dd> et non autour du couple
   <dt>/<dd> : à l'intérieur d'une <dl>, un <div> n'admet que des <dt> et des
   <dd> et un <a> à cet endroit serait un balisage invalide. */
const lienCarte = (href, intitule) =>
  `<a class="lien-carte" href="${esc(href)}"><span class="cache-visuellement">${esc(intitule)}</span></a>`;

/* --- Tableau de bord ------------------------------------------------------- */
function appTableauBord(V, D, C, LIENS) {
  const aAnalyser = D.releve.filter((t) => t.statut === "a-analyser");
  const ouvertes = D.registre.filter((r) => r.echeance && !r.clos);
  const enRetard = D.echeances.filter((e) => e.retard);

  const fiche = ficheDeLEntreprise(V, D);
  const corps = enTeteApp(D, "Tableau de bord",
    "Ce qui attend une décision, ce qui arrive et ce qui est en retard.", fiche) + `
<!-- Le jeu d'essai : caché dans un vrai compte (assets/espace.js montre le vrai).
     4 novembre 2026 : la démonstration montre le MÊME tableau de bord qu'un
     compte — cinq carrés, prochaines revues, historiques. Les chiffres des
     carrés sont calculés dans le navigateur (assets/bord-demo.js), comme
     dans un compte. -->
<div data-demo>

${rubrique({ etiq: "Tableau de bord", contenu: `
  <dl class="compteurs compteurs-liens tableau-bord" id="bord-demo">
    <div><dt class="etiq">Nouveaux textes</dt><dd><span class="grand" data-bord="nouveaux">—</span><span class="precision">non lus</span>${lienCarte("plan.html", "Voir ma veille réglementaire")}</dd></div>
    <div><dt class="etiq">Textes publiés</dt><dd><span class="grand" data-bord="publies">—</span><span class="precision">ces 14 derniers jours</span>${lienCarte("plan.html", "Voir ma veille réglementaire")}</dd></div>
    <div><dt class="etiq">Textes applicables</dt><dd><span class="grand" data-bord="applicables">—</span><span class="precision">touchent votre plan</span>${lienCarte("plan.html", "Voir ma veille réglementaire")}</dd></div>
    <div><dt class="etiq">Textes lus</dt><dd><span class="grand" data-bord="lus">—</span><span class="precision" data-bord="lus-sur"></span>${lienCarte("plan.html", "Voir ma veille réglementaire")}</dd></div>
    <div data-bord-carre="actions"><dt class="etiq">Actions à réaliser</dt><dd><span class="grand" data-bord="actions">0</span><span class="precision" data-bord="retard"></span>${lienCarte("actions.html", "Voir le plan d'actions")}</dd></div>
  </dl>` })}

${rubrique({ etiq: "Prochaines revues", aplat: true, contenu: `
  <ul class="liste-echeances">
    ${D.echeances.filter((e) => !e.retard).map((e) => `<li>
      <a href="plan.html">
        <span class="etiq">${esc(V.frequences[e.frequence] ? V.frequences[e.frequence].l : e.frequence)}</span>
        <span class="mono">${esc(dateFr(e.prochaine))}</span>
      </a>
    </li>`).join("")}
  </ul>` })}

${rubrique({ etiq: "Historiques", contenu: `
  <ul class="liste-registre">
    ${D.registre.slice(0, 10).map((r) => ligneRegistre(r)).join("")}
  </ul>
  <p style="margin-top:var(--t4)"><a class="lien-fleche" href="conformite.html#registre">Voir tout le registre</a></p>` })}
</div>
<div id="bord-compte" data-compte hidden></div>`;

  return page({
    titre: `Tableau de bord | ${SITE.nom}`,
    description: "Tableau de bord de la veille réglementaire.",
    racine: "../", zone: "app", actif: "bord", corps, verrou: true, formule: "textes", donneesPlan: true,
    scripts: ["assets/bord-demo.js"]
  });
}

/* Une ligne de relevé s'ouvre sur ce qui la justifie : le domaine auquel elle
   est rattachée, ce qu'il faut y tenir et les sources officielles où vérifier.
   Sans cela, l'écran se regarde mais ne se consulte pas. */
function ligneReleve(V, C, LIENS, t, racine = "") {
  const s = STATUTS[t.statut] || STATUTS.analyse;
  const d = V.domaines[t.domaine];
  const division = divisionDuDomaine(V, t.domaine);
  const idFait = `essai:${slug(t.titre)}`;
  return `<li class="ligne-releve statut-${s.c}">
  <details>
    <summary>
      <span class="mono date">${esc(dateFr(t.date))}</span>
      <span class="corps">
        <span class="titre">${d ? marqueFait(idFait) : ""}${esc(t.titre)}</span>
        <span class="quoi">${esc(t.quoi)}</span>
        <span class="meta etiq">${esc(t.nature)} · ${esc(d ? d.nom : t.domaine)}${t.priorite === "haute" ? " · prioritaire" : ""}</span>
      </span>
      <span class="statut etiq">${esc(s.l)}</span>
      ${chevron}
    </summary>
    <div class="detail">
      ${d ? `<div class="encarts-fiche">
        <section class="encart encart-faire">
          <h4 class="encart-titre"><span class="numero-encart" aria-hidden="true">1</span>Ce que vous devez faire</h4>
          <ul class="a-faire">${(d.actions || []).map((a) => `<li>${esc(a)}</li>`).join("")}</ul>
          ${boutonFait(idFait, { objet: t.titre })}
          <p class="rangee">
            <button type="button" class="bouton bouton-sobre imprimer-fiche">${imprimante} Enregistrer en PDF</button>
          </p>
        </section>
        <section class="encart encart-texte">
          <h4 class="encart-titre"><span class="numero-encart" aria-hidden="true">2</span>Ce que ça change</h4>
          <p class="lecture" style="margin:0">${esc(d.resume)}</p>
        </section>
        <section class="encart encart-source encart-large">
          <h4 class="encart-titre">Les textes, à la source</h4>
          <ul>${d.textes.map((ref) => {
            const L = lienDuTexte(C, LIENS, ref);
            return `<li><a href="${racine}texte/${slug(ref)}.html">${esc(ref)}</a> —
              <a class="lien-officiel" href="${esc(L.url)}" target="_blank" rel="noopener"
                 title="${esc(L.quoi)}">${esc(intituleDuLien(L))} ${sortant}</a></li>`;
          }).join("")}</ul>
          <p class="rangee" style="margin-top:var(--t3)">
            <a class="lien-fleche" href="${racine}plan.html">Voir ce sujet dans mon plan ${fleche}</a>
            ${division ? `<a class="lien-fleche" href="${racine}secteur/${esc(division)}.html">Voir la fiche de mon métier ${fleche}</a>` : ""}
          </p>
        </section>
      </div>` : `<p class="rangee" style="margin-top:var(--t4)">
        <button type="button" class="bouton bouton-sobre imprimer-fiche">${imprimante} Enregistrer en PDF</button>
      </p>`}
    </div>
  </details>
</li>`;
}

/* Le premier secteur où ce domaine s'applique : de quoi offrir un lien utile
   depuis une ligne de relevé. Les domaines transversaux n'en ont pas. */
function divisionDuDomaine(V, id) {
  if (V.transversaux.indexOf(id) !== -1) return "";
  for (const d of V.divisions) {
    if ((V.parDivision[d.c] || []).indexOf(id) !== -1) return `${d.c}-${slug(d.l)}`;
  }
  return "";
}

function ligneRegistre(r) {
  const types = { revue: "Revue", action: "Action", decision: "Décision" };
  const champ = (etiq, valeur) => valeur
    ? `<div><dt class="etiq">${esc(etiq)}</dt><dd>${esc(valeur)}</dd></div>` : "";
  return `<li class="ligne-registre${r.clos ? " clos" : ""}">
  <details>
    <summary>
      <span class="mono date">${esc(dateFr(r.date))}</span>
      <span class="corps">
        <span class="titre">${esc(r.objet)}</span>
        <span class="quoi">${esc(r.detail)}</span>
        <span class="meta etiq">${esc(types[r.type] || r.type)} · ${esc(r.par)}${r.echeance && !r.clos ? " · échéance " + esc(dateFr(r.echeance)) : ""}</span>
      </span>
      ${chevron}
    </summary>
    <div class="detail">
      <dl class="detail-champs">
        ${champ("Nature", types[r.type] || r.type)}
        ${champ("Date", dateFr(r.date))}
        ${champ("Par", r.par)}
        ${champ("Échéance", r.echeance ? dateFr(r.echeance) : "—")}
        ${champ("État", r.type === "action" ? (r.clos ? "Close" : "Ouverte") : "Faite")}
      </dl>
      <p class="note-source">Une ligne du registre ne se modifie pas après coup : une
      correction s'ajoute à la suite, avec sa propre date et celle-ci reste.</p>
      <p class="rangee" style="margin-top:var(--t4)">
        <button type="button" class="bouton bouton-sobre imprimer-fiche">${imprimante} Enregistrer en PDF</button>
      </p>
    </div>
  </details>
</li>`;
}

/* --- Mon plan : le tableau des textes (3 novembre 2026, demandé par Axel) ---
   Une ligne par texte relevé qui touche le plan : sa date, sa catégorie, sa
   référence avec le lien officiel et les actions à déclencher (celles des
   sujets du plan auxquels il est rattaché, comme « Ce que vous devez faire »
   dans le relevé). La catégorie vient du classement du référentiel ; le
   social y est appelé « Ressources humaines ». Chaque ligne porte ses sujets
   (data-domaines) : assets/entreprise.js la montre ou la cache selon le plan
   de l'entreprise et n'y garde que la catégorie et les actions de ses sujets. */
function categorieTexte(V, ids) {
  const parCat = {};
  ids.forEach((id) => {
    const cl = CATEGORIES_TABLEAU[V.domaines[id].classement] ? V.domaines[id].classement : "metier";
    (parCat[cl] = parCat[cl] || []).push(id);
  });
  return Object.keys(CATEGORIES_TABLEAU).filter((cl) => parCat[cl]).map((cl) =>
    `<span class="categorie-texte" data-cat="${cl}" data-sujets="${esc(parCat[cl].join(" "))}">${esc(CATEGORIES_TABLEAU[cl])}</span>`).join("");
}
/* Les actions à déclencher d'un texte : celles de ses sujets (deux par sujet,
   sans doublon), chacune marquée de son sujet pour suivre le plan. */
function actionsDuSujet(V, ids) {
  const vues = new Set();
  const li = ids.flatMap((id) => ((V.domaines[id] || {}).actions || []).slice(0, 2)
    .filter((a) => !vues.has(a) && vues.add(a)).map((a) => `<li data-sujets="${esc(id)}">${esc(a)}</li>`)).join("");
  return li ? `<ul class="actions-sujet">${li}</ul>` : "Rien à faire : à connaître.";
}
/* La recherche dans les tableaux de textes (3 novembre 2026) : par mot, par
   période et par source. Chaque ligne porte sa date (data-date) et sa source
   (data-source) ; assets/applicable.js filtre. */
const NOMS_SOURCES = [[/legifrance\.gouv\.fr/, "Légifrance"], [/eur-lex\.europa\.eu/, "EUR-Lex"], [/service-public\.fr/, "Service-public"],
  [/inrs\.fr/, "INRS"], [/cnil\.fr/, "CNIL"], [/travail-emploi\.gouv\.fr/, "Ministère du Travail"], [/boss\.gouv\.fr/, "BOSS"],
  [/afnor\.org/, "AFNOR"], [/cyber\.gouv\.fr/, "ANSSI"], [/securite-sociale\.fr/, "Sécurité sociale"], [/unece\.org/, "Nations unies (CEE-ONU)"],
  [/preventionbtp\.fr|oppbtp/, "OPPBTP"], [/developpement-durable\.gouv\.fr|ecologie\.gouv\.fr/, "Ministère de la Transition écologique"],
  [/budget\.gouv\.fr|economie\.gouv\.fr|impots\.gouv\.fr/, "Ministère de l'Économie"], [/anc\.gouv\.fr/, "Autorité des normes comptables"],
  [/ademe\.fr/, "ADEME"], [/anses\.fr/, "ANSES"], [/has-sante\.fr/, "HAS"], [/urssaf\.fr/, "URSSAF"]];
function sourceDeLien(url) {
  for (const [re, nom] of NOMS_SOURCES) if (re.test(url || "")) return nom;
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "Autre"; }
}
const sourceDuReleve = (t) => {
  const n = String(t.sourceNom || "").split(" — ")[0];
  return /République française/.test(n) ? "Journal officiel" : /Union européenne/.test(n) ? "Journal officiel de l'UE" : n || "Relevé";
};
function rechercheTextes(sources) {
  const l = [...new Set(sources)].sort((a, b) => a.localeCompare(b, "fr"));
  return `<div class="recherche-textes" role="search" aria-label="Rechercher un texte">
      <div class="rt-champ rt-mot"><label for="rt-mot">Texte</label>
        <input type="search" id="rt-mot" placeholder="Un mot, une référence : amiante, R4412, décret…" autocomplete="off" spellcheck="false"></div>
      <div class="rt-champ"><label for="rt-du">Du</label><input type="date" id="rt-du"></div>
      <div class="rt-champ"><label for="rt-au">Au</label><input type="date" id="rt-au"></div>
      <div class="rt-champ"><label for="rt-source">Source</label>
        <select id="rt-source"><option value="">Toutes les sources</option>${l.map((x) => `<option>${esc(x)}</option>`).join("")}</select></div>
      <button type="button" class="lien-nu rt-effacer" id="rt-effacer" hidden>Effacer la recherche</button>
    </div>`;
}
/* Les carrés par catégorie, au-dessus des tableaux de textes (3 novembre
   2026) : le nombre de textes du plan dans chacune ; un clic filtre le
   tableau (assets/applicable.js les compte et les relie au filtre). */
function carresCategories() {
  return `<div class="carres-categories" role="group" aria-label="Textes par catégorie">
      ${Object.keys(CATEGORIES_TABLEAU).map((cl) => `<button type="button" class="carre-categorie" data-filtre-cat="${cl}" aria-pressed="false">
        <span class="etiq">${esc(CATEGORIES_TABLEAU[cl])}</span><span class="grand" data-n-cat="${cl}">0</span><span class="precision">texte(s)</span></button>`).join("")}
    </div>`;
}
/* L'analyse synthétique d'un texte (4 novembre 2026, demandes d'Axel) : un
   volet sous chaque texte des tableaux (Ma veille réglementaire, Plan
   d'actions, Registre et conformité). Elle dit ce qu'il faut retenir du
   texte — sa nature, son objet, qui il vise, ce qu'il dit, ce qu'il
   modifie, quand il s'applique — pour qu'on sache ce qu'il contient sans
   l'ouvrir. Pas d'actions à entreprendre : elles sont dans le plan
   d'actions. Rien n'y est inventé : tout est lu dans le texte officiel (ou
   dans la fiche du texte de référence, contenu/textes.js). */
function analyseCadre(lignes) {
  return `<details class="analyse"><summary>Analyse synthétique</summary><div class="analyse-corps">
        <dl class="analyse-champs">${lignes.filter(Boolean).map(([t, v]) => `<div><dt>${esc(t)}</dt><dd>${v}</dd></div>`).join("")}</dl>
        <p class="analyse-note">À retenir, lu dans le texte officiel. Seul le texte officiel fait foi ; ne constitue pas un conseil juridique.</p>
      </div></details>`;
}
const majuscule = (x) => (x ? x.charAt(0).toUpperCase() + x.slice(1) : "");
const coupe = (x, n) => (x.length > n ? x.slice(0, n).replace(/\s+\S*$/, "") + "…" : x);
const liste = (l) => `<ul>${l.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
/* Le type d'un texte, lu dans son titre : « Décret », « Arrêté », « Avis »… */
function typeDuTexte(t) {
  const m = /^(Décret|Arrêté|Ordonnance|Loi|Décision|Directive|Règlement|Avis|Circulaire|Instruction|Délibération|Rectificatif|Recommandation|Communication)\b/i.exec(String(t.titre || "").replace(/^CELEX:\S+\s*/, ""));
  if (m) return majuscule(m[1].toLowerCase()) + (/\((?:UE|CE|PESC|Euratom)\)/.test(t.titre) ? (/^(Décision|Directive|Recommandation|Communication)$/i.test(m[1]) ? " européenne" : " européen") : "");
  return t.genre === "actualite" ? "Publication officielle" : t.nature && t.nature !== "Article" ? t.nature : "";
}
/* Ce que dit le texte : ses premières phrases utiles, sans les formules du
   Journal officiel (« Vous pouvez consulter… », « Rectificatif au… »). */
function cequeDit(corps) {
  const lignes = String(corps || "").split(/\n+/).map((x) => x.replace(/\s+/g, " ").trim()).filter((x) =>
    x.length > 2 && !/^(Vous pouvez consulter|Rectificatif au Journal|Le (?:présent|ministre).{0,60}chargés?.{0,40}exécution|Fait le|Pour le ministre|NOR\s*:|ELI\s*:)/i.test(x));
  const puces = lignes.filter((x) => /^[-•–]\s+/.test(x)).map((x) => coupe(x.replace(/^[-•–]\s+/, "").replace(/[;.]$/, ""), 140)).slice(0, 3);
  const phrases = lignes.filter((x) => !/^[-•–]\s+/.test(x)).join(" ").split(/(?<=[a-zà-ÿ0-9)»]\.)\s+(?=[A-ZÀÂÉÈÊÎÔÛÇ«])/).filter((x) => x.length > 25);
  let resume = "";
  for (const p of phrases) { if ((resume + " " + p).length > 420) break; resume = (resume + " " + p).trim(); }
  if (!resume && phrases[0]) resume = coupe(phrases[0], 420);
  return { resume, puces };
}
function analyseRef(V, ref, ids) {
  const f = FICHES[ref] || null;
  if (!f) return analyseCadre([["À retenir", "La fiche de ce texte est en préparation : son contenu se lit à la source officielle, par le lien ci-dessus."]]);
  return analyseCadre([
    f.nature ? ["Nature", esc(f.nature)] : null,
    f.porte ? ["Porte sur", esc(f.porte)] : null,
    f.qui ? ["Qui est concerné", esc(f.qui)] : null,
    f.exige && f.exige.length ? ["Ce que prévoit le texte", liste(f.exige)] : null,
    f.valide === false ? ["Statut", "Fiche à faire relire par un consultant"] : null
  ]);
}
function analyseJO(V, t, ids) {
  const c = String(t.corps || "").replace(/\r/g, "");
  const ligneApres = (re) => { const m = re.exec(c); return m ? majuscule(coupe(m[1].replace(/\s+/g, " ").trim(), 400)) : ""; };
  const objet = ligneApres(/(?:^|\n)\s*Objet\s*:\s*\n?\s*([^\n]{8,500})/i);
  const publics = ligneApres(/Publics?\s+concernés?\s*:\s*([^\n]{5,400})/i);
  const app = applicationDuTexte(t);
  // Sans « Objet : » dans le texte, l'objet se lit dans son titre (« relatif à… », « modifiant… »).
  const mt = /\b((?:relatif|relative|relatifs|relatives) (?:à|aux?)\b|portant\b|modifiant\b|fixant\b|pris pour l'application\b|abrogeant\b|concernant\b).*/i.exec(String(t.titre || ""));
  const objetTitre = !objet && mt ? majuscule(coupe(mt[0], 300)) : "";
  // Ce qu'il modifie : « L'arrêté du … susvisé est ainsi modifié ».
  const mm = /((?:l'|le |la )(?:article [^.:;]{1,40}? d[eu]s? |annexe [^.:;]{0,30}? d[eu]s? )?(?:arrêté|décret|ordonnance|loi|code|règlement)[^.:;]{0,120}?)\s+(?:susvisée?\s+)?(?:est|sont) ainsi modifiée?s?/i.exec(c);
  const modifie = mm ? majuscule(mm[1].replace(/\s+susvisée?$/i, "").replace(/(\d) er\b/g, "$1er").trim()) : "";
  // Un texte qui ne fait que réécrire un autre (« … est ainsi modifié : les mots … ») : sa
  // lettre n'apprend rien ; l'objet et le texte modifié suffisent.
  const dit = /est ainsi modifiée?\s*:/i.test(c.slice(0, 400)) && (objet || objetTitre) ? { resume: "", puces: [] } : cequeDit(c);
  const type = typeDuTexte(t);
  return analyseCadre([
    type ? ["Nature", esc(type)] : null,
    objet || objetTitre ? ["Objet", esc(objet || objetTitre)] : null,
    publics ? ["Publics concernés", esc(publics)] : null,
    dit.resume ? ["Ce que dit le texte", esc(dit.resume) + (dit.puces.length ? liste(dit.puces) : "")]
      : dit.puces.length ? ["Ce que dit le texte", liste(dit.puces)] : null,
    modifie ? ["Texte modifié", esc(modifie)] : null,
    !dit.resume && !dit.puces.length && !objet && !objetTitre ? ["À retenir", "Le relevé ne donne que le titre de ce texte : son contenu se lit à la source officielle, par le lien ci-dessus."] : null,
    t.genre === "texte" ? ["Application", esc(app.etiquette) + (app.precision ? ` (${esc(app.precision)})` : "")] : null
  ]);
}
function analyseCode(V, m, vig, ids) {
  const auj = new Date().toISOString().slice(0, 10);
  const recents = vig.filter((x) => x.depuis).sort((a, b) => (a.depuis < b.depuis ? 1 : -1)).slice(0, 3);
  const futurs = m.articles.filter((x) => x.depuis && x.depuis > auj);
  // Ce que disent les articles : la première phrase des deux premiers.
  const debuts = vig.slice(0, 2).map((x) => {
    const txt = texteBrut(x.html || "").replace(/\s+/g, " ").trim();
    const p = txt.split(/(?<=[a-zà-ÿ0-9)»]\.)\s+(?=[A-ZÀ-Ý])/)[0] || "";
    return p ? `Article ${x.num} : ${coupe(p, 220)}` : "";
  }).filter(Boolean);
  return analyseCadre([
    ["Section", esc(m.chemin.join(" › "))],
    ["Articles en vigueur", `${vig.length} (articles ${esc(vig[0].num)} à ${esc(vig[vig.length - 1].num)})`],
    debuts.length ? ["Ce que disent les articles", liste(debuts)] : null,
    recents.length ? ["Dernières évolutions", recents.map((x) => `article ${esc(x.num)} le ${esc(dateFr(x.depuis))}`).join(" · ")] : null,
    futurs.length ? ["Modifications programmées", futurs.map((x) => `article ${esc(x.num)} au ${esc(dateFr(x.depuis))}`).join(" · ")] : null
  ]);
}

/* La date d'application d'un texte (4 novembre 2026, demande d'Axel) :
   lue dans le texte officiel lui-même, jamais devinée. On cherche « entre en
   vigueur le… », « à compter du… », « prend effet le… » et « le lendemain de
   sa publication ». Rien de trouvé : on le dit. */
const celluleApplication = (a) => `<td data-titre="Application">${a.iso ? `<time datetime="${esc(a.iso)}">${esc(a.etiquette)}</time>` : `<span class="app-texte">${esc(a.etiquette)}</span>`}` +
  `${a.classe === "app-venir" ? '<span class="etat-date app-venir">À venir</span>' : a.classe === "app-vigueur" ? '<span class="etat-date app-vigueur">En vigueur</span>' : ""}` +
  `${a.precision ? `<span class="precision">${esc(a.precision)}</span>` : ""}</td>`;

function tableauTextesPlan(V, C, LIENS, plan, JO) {
  const categorie = (ids) => {
    const parCat = {};
    ids.forEach((id) => {
      const cl = CATEGORIES_TABLEAU[V.domaines[id].classement] ? V.domaines[id].classement : "metier";
      (parCat[cl] = parCat[cl] || []).push(id);
    });
    return Object.keys(CATEGORIES_TABLEAU).filter((cl) => parCat[cl]).map((cl) =>
      `<span class="categorie-texte" data-cat="${cl}" data-sujets="${esc(parCat[cl].join(" "))}">${esc(CATEGORIES_TABLEAU[cl])}</span>`).join("");
  };
  const actionsDe = (ids) => {
    const vues = new Set();
    const li = ids.flatMap((id) => (V.domaines[id].actions || []).slice(0, 2)
      .filter((a) => !vues.has(a) && vues.add(a)).map((a) => `<li data-sujets="${esc(id)}">${esc(a)}</li>`)).join("");
    return li ? `<ul>${li}</ul>` : "Rien à faire : à connaître.";
  };
  const touche = (ids) => ids.some((id) => plan.liste.includes(id));

  /* Les textes de référence des sujets (codes, décrets, règlements, tout le
     référentiel) : la date est leur dernière évolution quand nous relevons
     leur contenu consolidé, sinon nous ne l'inventons pas. */
  const parRef = {};
  Object.keys(V.domaines).forEach((id) => (V.domaines[id].textes || []).forEach((ref) => {
    (parRef[ref] = parRef[ref] || []).push(id);
  }));
  const fond = Object.keys(parRef).map((ref) => {
    const ids = parRef[ref], q = dateDuTexte(C, ref), L = lienDuTexte(C, LIENS, ref);
    const src = sourceDeLien(L.url);
    return { ids, date: (q && q.depuis) || "", ordre: ref, src, html: (dans) => `<tr data-domaines="${esc(ids.join(" "))}" data-date="${esc((q && q.depuis) || "")}" data-source="${esc(src)}" data-cle="ref:${esc(slug(ref))}" data-objet="${esc(ref)}"${dans ? "" : " hidden"}>
      <td data-titre="Date">${q && q.depuis ? `<time datetime="${esc(q.depuis)}">${esc(dateFr(q.depuis))}</time><span class="etat-date">Dernière mise à jour</span>` : `<span class="etat-date etat-fond">Texte de référence</span>`}</td>
      <td data-titre="Catégorie">${categorie(ids)}</td>
      <td data-titre="Référence et lien"><a href="texte/${slug(ref)}.html">${esc(ref)}</a>
        <a class="lien-officiel" href="${esc(L.url)}" target="_blank" rel="noopener">${esc(intituleDuLien(L))} ${sortant}</a>
        ${analyseRef(V, ref, ids)}</td>
      <td data-titre="Application"><span class="app-texte">En vigueur</span></td>
      <td data-titre="Lu"><label class="case-lu"><input type="checkbox" class="lu" aria-label="Texte lu"><span>Lu</span></label></td>
      <td data-titre="Applicable"><select class="applicable" aria-label="Ce texte est-il applicable ?"><option value="">À décider</option><option value="applicable">Oui</option><option value="sans_objet">Non</option></select><span class="precision applicable-etat"></span></td>
    </tr>` };
  });

  /* Les textes parus au Journal officiel et relevés ces derniers jours. */
  const recents = !(JO && JO.textes) ? [] : JO.textes.map((t) => {
    const ids = t.domaines.map((d) => d.id).filter((id) => V.domaines[id]);
    const quand = t.dateTexte || t.date;
    const lien = /^https?:\/\//i.test(t.lien || "") ? t.lien : "";
    const src = sourceDuReleve(t);
    return { ids, date: quand, ordre: t.titre, src, html: (dans) => `<tr data-domaines="${esc(ids.join(" "))}" data-date="${esc(quand)}" data-source="${esc(src)}" data-cle="${esc(cleJO(t))}" data-objet="${esc(String(t.titre).slice(0, 480))}"${dans ? "" : " hidden"}>
      <td data-titre="Date"><time datetime="${esc(quand)}">${esc(dateFr(quand))}</time><span class="etat-date etat-recent">Parution récente</span></td>
      <td data-titre="Catégorie">${categorie(ids)}</td>
      <td data-titre="Référence et lien"><span class="marque-neuf marque-nouveau" hidden>Nouveau texte</span>${lien ? `<a href="${esc(lien)}" target="_blank" rel="noopener">${esc(t.titre)}</a>` : esc(t.titre)}
        ${lien ? `<a class="lien-officiel" href="${esc(lien)}" target="_blank" rel="noopener">${/legifrance\.gouv\.fr/.test(lien) ? "Légifrance" : esc(t.sourceNom || "Voir chez la source")} ${sortant}</a>` : ""}
        ${analyseJO(V, t, ids)}</td>
      ${celluleApplication(applicationDuTexte(t))}
      <td data-titre="Lu"><label class="case-lu"><input type="checkbox" class="lu" aria-label="Texte lu"><span>Lu</span></label></td>
      <td data-titre="Applicable"><select class="applicable" aria-label="Ce texte est-il applicable ?"><option value="">À décider</option><option value="applicable">Oui</option><option value="sans_objet">Non</option></select><span class="precision applicable-etat"></span></td>
    </tr>` };
  });

  /* Les sections des codes relevés article par article (Code du travail, de
     la sécurité sociale, rural) : les mêmes lignes que « Registre et
     conformité réglementaire », pour une seule liste partout (3 novembre 2026). */
  const sections = ((C && C.morceaux) || []).map((m) => {
    const refs = Object.keys(C.perimetres).filter((r) => (C.perimetres[r] || []).includes(m.id));
    const ids = [...new Set(refs.flatMap((r) => parRef[r] || []))].filter((id) => V.domaines[id]);
    const vig = m.articles.filter((x) => !x.etat || x.etat === "VIGUEUR");
    if (!ids.length || !vig.length) return null;
    const tard = vig.reduce((t, x) => (x.depuis && x.depuis > t ? x.depuis : t), "");
    const nom = `${m.codeTitre}, articles ${vig[0].num} à ${vig[vig.length - 1].num}`;
    return { ids, date: tard, ordre: nom, src: "Légifrance", html: (dans) => `<tr data-domaines="${esc(ids.join(" "))}" data-date="${esc(tard)}" data-source="Légifrance" data-cle="code:${esc(m.id)}" data-objet="${esc(nom)}"${dans ? "" : " hidden"}>
      <td data-titre="Date">${tard ? `<time datetime="${esc(tard)}">${esc(dateFr(tard))}</time><span class="etat-date">Dernière mise à jour</span>` : `<span class="etat-date etat-fond">Texte de référence</span>`}</td>
      <td data-titre="Catégorie">${categorie(ids)}</td>
      <td data-titre="Référence et lien"><a href="code/${esc(m.id)}.html">${esc(nom)}</a>
        <span class="precision">${esc(m.chemin[m.chemin.length - 1] || "")} · ${vig.length} article${vig.length > 1 ? "s" : ""} en vigueur</span>
        ${analyseCode(V, m, vig, ids)}</td>
      ${(() => { const auj = new Date().toISOString().slice(0, 10); const fut = m.articles.filter((x) => x.depuis && x.depuis > auj).map((x) => x.depuis).sort()[0]; return fut ? celluleApplication({ iso: fut, etiquette: dateFr(fut), classe: "app-venir", precision: "modification programmée" }) : '<td data-titre="Application"><span class="app-texte">En vigueur</span></td>'; })()}
      <td data-titre="Lu"><label class="case-lu"><input type="checkbox" class="lu" aria-label="Texte lu"><span>Lu</span></label></td>
      <td data-titre="Applicable"><select class="applicable" aria-label="Ce texte est-il applicable ?"><option value="">À décider</option><option value="applicable">Oui</option><option value="sans_objet">Non</option></select><span class="precision applicable-etat"></span></td>
    </tr>` };
  }).filter(Boolean);

  const toutes = recents.concat(fond, sections).sort((a, b) =>
    a.date !== b.date ? (a.date < b.date ? 1 : -1) : a.ordre.localeCompare(b.ordre, "fr"));
  if (!toutes.length) return "";
  return `<section class="rubrique" id="textes-du-plan">
  <div class="enveloppe">
    <h2>Les textes de votre plan de veille réglementaire</h2>
    <p class="textes-attente" id="textes-attente" role="status"></p>
    ${carresCategories()}
    ${rechercheTextes(toutes.filter((x) => touche(x.ids)).map((x) => x.src))}
    <div class="filtre-plan">
      <label for="filtre-categorie">Catégorie</label>
      <select id="filtre-categorie">
        <option value="">Toutes les catégories</option>
        ${Object.keys(CATEGORIES_TABLEAU).map((cl) => `<option value="${cl}">${esc(CATEGORIES_TABLEAU[cl])}</option>`).join("")}
      </select>
      <span class="precision" id="filtre-compte" role="status"></span>
    </div>
    <div class="defile-tableau">
    <table class="tableau-plan tableau-textes-plan" data-export="veille-reglementaire" data-titre-export="Ma veille réglementaire">
      <thead><tr><th scope="col">Date</th><th scope="col">Catégorie</th><th scope="col">Référence et lien</th><th scope="col">Application</th><th scope="col">Lu</th><th scope="col">Applicable</th></tr></thead>
      <tbody>${toutes.map((x) => x.html(touche(x.ids))).join("\n")}</tbody>
    </table>
    </div>
  </div>
</section>`;
}

/* --- Conformité réglementaire (3 novembre 2026, formule Veille complète) ---
   L'évaluation de conformité : pour chaque texte de référence du plan, où en
   est l'entreprise (conforme, partiellement, non conforme, à évaluer), avec sa
   preuve ou son commentaire. Chaque évaluation s'inscrit, datée, au registre
   (assets/conformite.js, espace_conformite). Les lignes portent leurs sujets
   (data-domaines) : la page suit le plan des réglages, comme Mon plan. */
/* --- Plan d'actions (3 novembre 2026, demandé par Axel) ----------------------
   Une ligne par action : la date du texte, le texte de référence (avec son
   lien), l'action qui en découle, le délai de réalisation, le responsable, et
   la validation. Les textes sont ceux du plan (référentiel et relevé), les
   actions celles de leurs sujets (« Ce que vous devez faire »). Chaque ligne
   porte son sujet (data-domaines) : assets/plan-actions.js n'y garde que le
   plan de l'entreprise, enregistre délai et responsable et valide — au
   registre dans un compte. Formule « Textes et suivi » et au-dessus. */
const cleCourte = (t) => { let h = 5381; for (const c of t) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0; return h.toString(36); };
function appActions(V, D, C, LIENS, JO = null) {
  const plan = planDe(V, D.entreprise);
  const parRef = {};
  Object.keys(V.domaines).forEach((id) => (V.domaines[id].textes || []).forEach((ref) => {
    (parRef[ref] = parRef[ref] || []).push(id);
  }));
  const textes = [];
  Object.keys(parRef).forEach((ref) => {
    const q = dateDuTexte(C, ref), L = lienDuTexte(C, LIENS, ref);
    textes.push({ ids: parRef[ref], cle: `ref:${slug(ref)}`, titre: ref, date: (q && q.depuis) || "",
      dateHtml: q && q.depuis ? `<time datetime="${esc(q.depuis)}">${esc(dateFr(q.depuis))}</time><span class="etat-date">Dernière mise à jour</span>`
        : `<span class="etat-date etat-fond">Texte de référence</span>`,
      lien: `<a href="texte/${slug(ref)}.html">${esc(ref)}</a><a class="lien-officiel" href="${esc(L.url)}" target="_blank" rel="noopener">${esc(intituleDuLien(L))} ${sortant}</a>`,
      analyse: analyseRef(V, ref, parRef[ref]) });
  });
  ((JO && JO.textes) || []).forEach((t) => {
    const ids = t.domaines.map((d) => d.id).filter((id) => V.domaines[id]);
    if (!ids.length) return;
    const quand = t.dateTexte || t.date;
    const l = /^https?:\/\//i.test(t.lien || "") ? t.lien : "";
    textes.push({ ids, cle: cleJO(t), titre: String(t.titre).slice(0, 300), date: quand,
      dateHtml: `<time datetime="${esc(quand)}">${esc(dateFr(quand))}</time><span class="etat-date etat-recent">Parution récente</span>`,
      lien: `${l ? `<a href="${esc(l)}" target="_blank" rel="noopener">${esc(t.titre)}</a>` : esc(t.titre)}${l ? `<a class="lien-officiel" href="${esc(l)}" target="_blank" rel="noopener">${/legifrance\.gouv\.fr/.test(l) ? "Légifrance" : esc(t.sourceNom || "Voir chez la source")} ${sortant}</a>` : ""}`,
      analyse: analyseJO(V, t, ids), application: applicationDuTexte(t).iso || "" });
  });
  textes.sort((x, y) => (x.date !== y.date ? (x.date < y.date ? 1 : -1) : x.titre.localeCompare(y.titre, "fr")));

  const lignes = [];
  for (const t of textes) {
    const vues = new Set();
    for (const id of t.ids) {
      for (const action of (V.domaines[id].actions || []).slice(0, 2)) {
        if (vues.has(action)) continue;
        vues.add(action);
        const dans = plan.liste.includes(id);
        // La base n'accepte que « lettres:[A-Za-z0-9_.:-]{1,160} » (registre.cle).
        const cle = `actions:${t.cle.replace(/[^A-Za-z0-9_.:-]/g, "-").slice(0, 140)}:${cleCourte(action)}`;
        lignes.push(`<tr data-domaines="${esc(id)}" data-cle="${esc(cle)}" data-objet="${esc(`${action} — ${t.titre}`.slice(0, 480))}"${t.application ? ` data-application="${esc(t.application)}"` : ""}${dans ? "" : " hidden"}>
      <td data-titre="Date du texte">${t.dateHtml}</td>
      <td data-titre="Texte de référence">${t.lien}${t.analyse || ""}</td>
      <td data-titre="Action à mener">${esc(action)}</td>
      <td data-titre="Délai de réalisation"><input type="date" class="pa-delai" aria-label="Délai : ${esc(action)}"></td>
      <td data-titre="Responsable"><input type="text" class="pa-resp" maxlength="120" aria-label="Responsable : ${esc(action)}" placeholder="Nom"></td>
      <td data-titre="Validation"><span class="pa-etat precision"></span>
        <span class="pa-boutons"><button type="button" class="bouton bouton-sobre pa-enregistrer">Enregistrer</button>
        <button type="button" class="bouton bouton-accent pa-valider" hidden>Valider l'action</button></span></td>
    </tr>`);
      }
    }
  }

  const corps = enTeteApp(D, "Plan d'actions",
    "Les actions qui découlent des textes qui vous concernent : fixez un délai et un responsable, puis validez chaque action une fois réalisée.") + `
<section class="rubrique">
  <div class="enveloppe">
    <dl class="compteurs pa-compteurs">
      <div><dt class="etiq">À planifier</dt><dd><span class="grand" id="pa-n-libre">0</span><span class="precision">sans délai ni responsable</span></dd></div>
      <div><dt class="etiq">En cours</dt><dd><span class="grand" id="pa-n-ouverte">0</span><span class="precision">avec un délai</span></dd></div>
      <div><dt class="etiq">En retard</dt><dd><span class="grand" id="pa-n-retard">0</span><span class="precision">délai dépassé</span></dd></div>
      <div><dt class="etiq">Réalisées</dt><dd><span class="grand" id="pa-n-faite">0</span><span class="precision">validées</span></dd></div>
    </dl>
  </div>
</section>

<section class="rubrique" id="plan-actions">
  <div class="enveloppe">
    <div class="filtre-plan">
      <label for="pa-filtre">Afficher</label>
      <select id="pa-filtre">
        <option value="">Toutes les actions</option>
        <option value="libre">À planifier</option>
        <option value="ouverte">En cours</option>
        <option value="retard">En retard</option>
        <option value="faite">Réalisées</option>
      </select>
      <span class="precision" id="pa-compte" role="status"></span>
    </div>
    <p class="note-source pa-lecture" hidden></p>
    <table class="tableau-plan tableau-actions" data-export="plan-d-actions" data-titre-export="Plan d'actions">
      <thead><tr><th scope="col">Date du texte</th><th scope="col">Texte de référence</th><th scope="col">Action à mener</th>
        <th scope="col">Délai de réalisation</th><th scope="col">Responsable</th><th scope="col">Validation</th></tr></thead>
      <tbody>${lignes.join("\n")}</tbody>
    </table>
    <p class="note-source">Chaque délai, chaque responsable et chaque validation s'inscrivent, datés, au registre. Les actions
    proposées viennent des sujets de votre plan ; elles ne constituent pas un conseil juridique.</p>
  </div>
</section>`;
  return page({
    titre: `Plan d'actions | ${SITE.nom}`,
    description: "Le plan d'actions de votre veille réglementaire.",
    racine: "../", zone: "app", actif: "actions", corps, verrou: true, formule: "suivi",
    donneesPlan: true, scripts: ["assets/plan-actions.js", "assets/export-tableaux.js", "assets/analyse.js"]
  });
}

let TEXTES_CLES = [];
let FICHES = {};   // contenu/textes.js, posé au chargement (analyse des textes de référence)
function appConformite(V, D, C, LIENS, JO = null) {
  const plan = planDe(V, D.entreprise);
  const parRef = {};
  Object.keys(V.domaines).forEach((id) => (V.domaines[id].textes || []).forEach((ref) => {
    (parRef[ref] = parRef[ref] || []).push(id);
  }));
  const ordreCat = Object.keys(CATEGORIES_TABLEAU);
  const catDe = (ids) => {
    const cl = (V.domaines[ids[0]] || {}).classement;
    return CATEGORIES_TABLEAU[cl] ? cl : "metier";
  };
  const options = [["a_evaluer", "À évaluer"], ["conforme", "Conforme"], ["partiel", "Partiellement conforme"], ["non_conforme", "Non conforme"]];
  const uniques = (l) => [...new Set(l)].filter((id) => V.domaines[id]);

  /* Trois sources, toutes en vigueur, que l'entreprise les ait vues passer ou
     non : (1) les textes de référence de ses sujets ; (2) les sections des
     codes que nous relevons article par article (Code du travail, de la
     sécurité sociale, rural), avec leurs articles en vigueur ; (3) les textes
     parus au Journal officiel depuis le début du relevé. */
  const entrees = [];
  Object.keys(parRef).forEach((ref) => {
    const L = lienDuTexte(C, LIENS, ref);
    entrees.push({ ids: parRef[ref], cle: `ref:${slug(ref)}`, objet: ref, ordre: 0, date: (dateDuTexte(C, ref) || {}).depuis || "", src: sourceDeLien(L.url),
      texte: `<a href="texte/${slug(ref)}.html">${esc(ref)}</a>
        <span class="precision">Texte de référence</span>
        <a class="lien-officiel" href="${esc(L.url)}" target="_blank" rel="noopener">${esc(intituleDuLien(L))} ${sortant}</a>
        ${analyseRef(V, ref, parRef[ref])}` });
  });
  ((C && C.morceaux) || []).forEach((m) => {
    const refs = Object.keys(C.perimetres).filter((r) => (C.perimetres[r] || []).includes(m.id));
    const ids = uniques(refs.flatMap((r) => parRef[r] || []));
    const vig = m.articles.filter((x) => !x.etat || x.etat === "VIGUEUR");
    if (!ids.length || !vig.length) return;
    const tard = vig.reduce((t, x) => (x.depuis && x.depuis > t ? x.depuis : t), "");
    const nom = `${m.codeTitre}, articles ${vig[0].num} à ${vig[vig.length - 1].num}`;
    entrees.push({ ids, cle: `code:${m.id}`, objet: nom, ordre: 1, date: tard, src: "Légifrance",
      texte: `<a href="code/${esc(m.id)}.html">${esc(nom)}</a>
        <span class="precision">${esc(m.chemin[m.chemin.length - 1] || "")} · ${vig.length} article${vig.length > 1 ? "s" : ""} en vigueur${tard ? `, dernière évolution le ${esc(dateFr(tard))}` : ""}</span>
        ${analyseCode(V, m, vig, ids)}` });
  });
  ((JO && JO.textes) || []).forEach((t) => {
    const ids = uniques(t.domaines.map((d) => d.id));
    if (!ids.length) return;
    const lien = /^https?:\/\//i.test(t.lien || "") ? t.lien : "";
    entrees.push({ ids, cle: cleJO(t), objet: String(t.titre).slice(0, 480), ordre: 2, date: t.dateTexte || t.date, src: sourceDuReleve(t),
      texte: `${lien ? `<a href="${esc(lien)}" target="_blank" rel="noopener">${esc(t.titre)}</a>` : esc(t.titre)}
        ${lien ? `<a class="lien-officiel" href="${esc(lien)}" target="_blank" rel="noopener">${/legifrance\.gouv\.fr/.test(lien) ? "Légifrance" : esc(t.sourceNom || "Voir chez la source")} ${sortant}</a>` : ""}
        ${analyseJO(V, t, ids)}` });
  });
  entrees.sort((x, y) => ordreCat.indexOf(catDe(x.ids)) - ordreCat.indexOf(catDe(y.ids)) || x.ordre - y.ordre || x.objet.localeCompare(y.objet, "fr"));
  // Pour l'espace consultant : la liste des textes (clé et sujets), afin de
  // compter chez chaque client ses textes non lus et sa part de conformes.
  TEXTES_CLES = entrees.map((e) => [e.cle, e.ids.join(" ")]);

  const lignes = entrees.map((e, i) => {
    const dans = e.ids.some((id) => plan.liste.includes(id));
    return `<tr data-domaines="${esc(e.ids.join(" "))}" data-date="${esc(e.date || "")}" data-source="${esc(e.src || "")}" data-cle="${esc(e.cle)}" data-objet="${esc(e.objet)}"${dans ? "" : " hidden"}>
      <td data-titre="Date de parution" class="conf-date">${!e.date ? '<span class="etat-date etat-fond">Texte de référence</span>'
        : `<time datetime="${esc(e.date)}">${esc(dateFr(e.date))}</time>${e.ordre === 2 ? "" : '<span class="etat-date">Dernière mise à jour</span>'}`}</td>
      <td data-titre="Texte">${e.texte}</td>
      <td data-titre="Catégorie">${categorieTexte(V, e.ids)}</td>
      <td data-titre="Actions à déclencher">${actionsDuSujet(V, e.ids)}</td>
      <td data-titre="Évaluation">
        <span class="conf-marque" aria-hidden="true"></span>
        <select class="conf-statut" aria-label="Évaluation : ${esc(e.objet)}">${options.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select>
        <span class="precision conf-etat"></span></td>
      <td data-titre="Preuve ou commentaire">
        <form class="conf-form" novalidate>
          <input type="text" class="conf-note" maxlength="500" aria-label="Preuve ou commentaire : ${esc(e.objet)}" placeholder="Document, date, commentaire…">
          <button type="submit" class="bouton bouton-sobre conf-ok">Enregistrer</button>
        </form></td>
    </tr>`;
  }).join("\n");

  const corps = enTeteApp(D, "Registre et conformité réglementaire",
    "Établissez votre veille réglementaire.") + `

<section class="rubrique">
  <div class="enveloppe">
    <dl class="compteurs conf-compteurs">
      <div><dt class="etiq">Conformes</dt><dd><span class="grand" id="conf-n-conforme">0</span></dd></div>
      <div><dt class="etiq">Partiellement</dt><dd><span class="grand" id="conf-n-partiel">0</span></dd></div>
      <div><dt class="etiq">Non conformes</dt><dd><span class="grand" id="conf-n-non_conforme">0</span></dd></div>
      <div><dt class="etiq">À évaluer</dt><dd><span class="grand" id="conf-n-a_evaluer">0</span><span class="precision" id="conf-taux"></span></dd></div>
    </dl>
  </div>
</section>

<section class="rubrique" id="conformite">
  <div class="enveloppe">
    <h2>Les textes de votre plan de veille réglementaire</h2>
    <p class="note-source conf-lecture" hidden></p>
    ${carresCategories()}
    ${rechercheTextes(entrees.filter((e) => e.ids.some((id) => plan.liste.includes(id))).map((e) => e.src))}
    <div class="filtre-plan">
      <label for="filtre-categorie">Catégorie</label>
      <select id="filtre-categorie">
        <option value="">Toutes les catégories</option>
        ${Object.keys(CATEGORIES_TABLEAU).map((cl) => `<option value="${cl}">${esc(CATEGORIES_TABLEAU[cl])}</option>`).join("")}
      </select>
      <span class="precision" id="filtre-compte" role="status"></span>
    </div>
    <table class="tableau-plan tableau-conformite tableau-textes-plan" data-export="registre-et-conformite" data-titre-export="Registre et conformité réglementaire">
      <thead><tr><th scope="col">Date de parution</th><th scope="col">Texte</th><th scope="col">Catégorie</th><th scope="col">Actions à déclencher</th><th scope="col">Évaluation</th><th scope="col">Preuve ou commentaire</th></tr></thead>
      <tbody>${lignes}</tbody>
    </table>
    <p class="note-source">L'évaluation est la vôtre : Vigie range les textes et garde la trace de vos décisions.
    Ne constitue pas un conseil juridique : en cas de doute, c'est le texte officiel qui fait foi.</p>
  </div>
</section>

<div id="registre">
<section class="rubrique" data-demo>
  <div class="enveloppe">
    <div>
      <h2>Le registre</h2>
      <p class="lecture">Les revues faites, les décisions prises, les actions menées et les évaluations de conformité,
      avec leurs dates. Chronologique, sans trou : une ligne ne se modifie pas après coup, une correction s'ajoute.</p>
      <ul class="liste-registre" style="margin-top:var(--t4)">
        ${D.registre.map((r) => ligneRegistre(r)).join("")}
      </ul>
      <p class="rangee" style="margin-top:var(--t5)">
        <button type="button" class="bouton bouton-sobre" data-imprimer>Imprimer le registre</button>
      </p>
    </div>
      </div>
</section>
<div id="registre-compte" data-compte hidden></div>
</div>`;

  return page({
    titre: `Registre et conformité réglementaire | ${SITE.nom}`,
    description: "L'évaluation de conformité de l'entreprise, texte par texte, inscrite au registre.",
    racine: "../", zone: "app", actif: "conformite", corps, verrou: true, formule: "complet",
    donneesPlan: true, scripts: ["assets/conformite.js", "assets/applicable.js", "assets/export-tableaux.js", "assets/analyse.js"]
  });
}

/* --- Mon plan --------------------------------------------------------------- */
function appPlan(V, D, C, LIENS, JO = null) {
  const plan = planDe(V, D.entreprise);
  const { base } = plan;
  const ajoutes = new Set(plan.ajoutes);
  const total = plan.liste.length;
  const rangs = Object.keys(V.domaines);
  const contexteNoms = D.entreprise.contexte
    .map((qid) => (V.declencheurs.filter((x) => x.id === qid)[0] || {}).q).filter(Boolean);

  /* Les rubriques ne portent que les sujets du plan. Les autres attendent dans
     un <template> (rien ne s'en affiche, rien ne s'en lit) : « Réglages » peut
     refaire le plan sans recharger la page (assets/entreprise.js). Leurs noms
     sont dans un volet replié, en bas : ce qui a été écarté se montre à un
     auditeur, mais ce n'est pas la vue principale. */
  const parFrequence = Object.keys(V.frequences)
    .sort((a, b) => V.frequences[a].ordre - V.frequences[b].ordre)
    .map((fid) => ({
      id: fid, f: V.frequences[fid],
      ids: Object.keys(V.domaines).filter((id) => V.domaines[id].frequence === fid)
    }))
    .filter((g) => g.ids.length);

  const blocPlan = (id) => {
    const division = divisionDuDomaine(V, id);
    const origine = base.includes(id) ? "base" : (ajoutes.has(id) ? "declencheur-retenu" : "hors");
    return blocDomaine(C, LIENS, id, V.domaines[id], origine,
      division ? `secteur/${division}.html` : "", "", true, rangs.indexOf(id));
  };

  const corps = enTeteApp(D, "Ma veille réglementaire",
    phrasePlan(V, D.entreprise, plan),
    ficheDeLEntreprise(V, D)) + `

<section class="rubrique">
  <div class="enveloppe">
  ${/* Les rythmes en carrés, comme les indicateurs du tableau de bord
       (3 novembre 2026) : le nom, le nombre de sujets, la prochaine revue. */ ""}
  <nav class="choix-categories" data-choix aria-label="Rythmes de revue">
  <ul class="carres-rythmes">
    ${parFrequence.map((g) => {
      const ech = D.echeances.filter((e) => e.frequence === g.id)[0];
      const n = g.ids.filter((id) => base.includes(id) || ajoutes.has(id)).length;
      return `<li><a class="carte-categorie carte-rythme${n ? "" : " carte-vide"}" href="#frequence-${esc(g.id)}"${n ? "" : ' aria-disabled="true" tabindex="-1"'}>
        <span class="etiq">${esc(g.f.l)}${ech && ech.retard ? ' <span class="marque-neuf" data-demo>En retard</span>' : ""}</span>
        <span class="grand" data-compte-frequence="${esc(g.id)}">${n}</span>
        <span class="precision" data-unite-frequence="${esc(g.id)}">${n ? `sujet${n > 1 ? "s" : ""}` : "aucun sujet"}</span>
        ${ech ? `<span class="precision" data-demo>Prochaine revue : ${esc(dateFr(ech.prochaine))}</span>` : ""}
        <span class="precision" data-compte hidden data-prochaine="${esc(g.id)}"></span>
      </a></li>`;
    }).join("")}
  </ul>
  </nav>
  </div>
</section>

${tableauTextesPlan(V, C, LIENS, plan, JO)}

${parFrequence.map((g) => {
    const ech = D.echeances.filter((e) => e.frequence === g.id)[0];
    const dedans = g.ids.filter((id) => base.includes(id) || ajoutes.has(id));
    return rubrique({ etiq: g.f.l, id: `frequence-${g.id}`, contenu: `
      <p class="lecture">${esc(g.f.d)}${ech ? `<span data-demo> Prochaine revue : <strong>${esc(dateFr(ech.prochaine))}</strong>${ech.retard ? " — en retard." : "."}</span>` : ""}</p>
      <nav class="dedans" aria-label="Ce qu'il y a à ce rythme">
        <p class="etiq">À ce rythme</p>
        <ul>${dedans.map((id) => `<li data-sujet-plan="${esc(id)}"><a href="#domaine-${esc(id)}"><span>${esc(V.domaines[id].nom)}</span></a></li>`).join("")}</ul>
      </nav>
      ${dedans.map((id) => blocPlan(id)).join("\n")}`, attrs: ` data-categorie data-groupe-frequence="${esc(g.id)}"${dedans.length ? "" : " hidden"}` });
  }).join("\n")}

<template id="plan-reserve">
${plan.ecartes.map((id) => blocPlan(id)).join("\n")}
</template>

<section class="rubrique">
  <div class="enveloppe">
    <details class="a-savoir plan-ecartes" id="plan-ecartes">
      <summary><span>Voir aussi les <b data-ecartes-total>${plan.ecartes.length}</b> sujets qui ne vous concernent pas</span></summary>
      <div class="a-savoir-corps">
        <p class="lecture">Ni votre code APE ni votre situation ne les déclenchent. Si l'un d'eux vous concerne
        quand même, cochez la situation qui l'ajoute dans <a href="reglages.html">Réglages</a>.</p>
        <ul class="liste-ecartes" id="plan-ecartes-liste">${plan.ecartes.map((id) => `<li data-ecarte="${esc(id)}">${esc(V.domaines[id].nom)}</li>`).join("")}</ul>
      </div>
    </details>
  </div>
</section>`;

  return page({
    titre: `Ma veille réglementaire | ${SITE.nom}`,
    description: "Ce qui s'applique chez vous et à quel rythme le revoir.",
    racine: "../", zone: "app", actif: "plan", corps, verrou: true, formule: "textes",
    donneesPlan: true, scripts: ["assets/applicable.js", "assets/export-tableaux.js", "assets/analyse.js"]
  });
}

/* --- Le lien du texte, pas celui du site -----------------------------------
   « Voir la source » renvoyait sur l'accueil de Légifrance ou de l'INRS : au
   client de retrouver son texte. Ici on vise le texte lui-même, à partir de
   son identifiant officiel.

   Trois cas, dans cet ordre :
     1. un code français — son identifiant LEGITEXT vient de l'annuaire que
        relève outils/codes.mjs, donc de la base LEGI elle-même ;
     2. un texte européen — son numéro CELEX se déduit de sa référence
        (« Règlement (UE) 2016/679 » → 32016R0679) ;
     3. le reste — une recherche nommée sur Légifrance et la page le dit :
        « chercher ce texte », pas « voir le texte ».

   Ce qui n'est pas exact est annoncé comme tel. Un lien qui ment coûte plus
   cher qu'un lien qui manque. */
const normaliseTitre = (s) => sansAccent(String(s)).toLowerCase()
  .replace(/[’']/g, " ").replace(/[^a-z0-9]+/g, " ").trim();

function celexDepuis(ref) {
  const m = ref.match(/\b(R[eè]glement|Directive)\b[^0-9]*(\d{1,4})\s*\/\s*(\d{2,4})/i);
  if (!m) return null;
  const type = /^R/i.test(m[1]) ? "R" : "L";
  let a = Number(m[2]), b = Number(m[3]);
  // « 1907/2006 » : le numéro puis l'année ; « 2016/679 » : l'inverse.
  const annee = a >= 1950 ? a : (b >= 1950 ? b : 0);
  const numero = annee === a ? b : a;
  if (!annee || !numero) return null;
  return `3${annee}${type}${String(numero).padStart(4, "0")}`;
}

function lienDuTexte(C, LIENS, ref) {
  const annuaire = (C && C.annuaire) || [];
  const parTitre = (titre) => {
    const cherche = normaliseTitre(titre);
    return annuaire.filter((a) => normaliseTitre(a.titre) === cherche)[0] ||
      annuaire.filter((a) => normaliseTitre(a.titre).startsWith(`${cherche} `))
        .sort((a, b) => a.titre.length - b.titre.length)[0];
  };

  /* 1. Ce que contenu/liens.js déclare pour cette référence, en premier :
        c'est le seul endroit où un humain a tranché. */
  const declare = LIENS && LIENS[ref];
  if (declare && declare.code) {
    const code = parTitre(declare.code);
    if (code) {
      return { url: `https://www.legifrance.gouv.fr/codes/texte_lc/${code.id}`,
               ou: "Légifrance", quoi: declare.quoi || code.titre, direct: true };
    }
  }
  if (declare && declare.url) {
    const direct = /CELEX:|texte_lc\/|\/loda\/id\//.test(declare.url);
    return { url: declare.url, ou: hote(declare.url), quoi: declare.quoi || ref, direct };
  }

  /* 2. Un code français, reconnu à son nom dans l'annuaire de la base LEGI. */
  const tronc = ref.replace(/\s*\([^)]*\)/g, "").split(/\s[—–-]\s|,\s/)[0].trim();
  const code = parTitre(tronc);
  if (code) {
    return { url: `https://www.legifrance.gouv.fr/codes/texte_lc/${code.id}`,
             ou: "Légifrance", quoi: code.titre, direct: true };
  }

  /* 3. Un texte européen, reconnu à son numéro. */
  const celex = celexDepuis(ref);
  if (celex) {
    return { url: `https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:${celex}`,
             ou: "EUR-Lex", quoi: `le texte intégral (CELEX ${celex})`, direct: true };
  }

  /* 4. Rien de déclaré : on le dit et verifieLiens() l'aura déjà signalé. */
  return { url: `https://www.legifrance.gouv.fr/search/all?tab_selection=all&searchField=ALL&query=${
             encodeURIComponent(ref)}`,
           ou: "Légifrance", quoi: `la recherche « ${ref} »`, direct: false, orphelin: true };
}

/* Le nom du site, pour le dire sous le lien : « sur boss.gouv.fr ». */
function hote(url) {
  try { return new URL(url).host.replace(/^www\./, ""); } catch (e) { return "la source officielle"; }
}

/* Le mot sous le lien. Jamais « chercher » : ce serait rendre au client le
   travail qu'il nous paie à faire. Soit on lui donne le texte, soit on lui
   donne le recueil officiel qui le contient et on le dit. */
const intituleDuLien = (L) => L.direct ? "Lire le texte officiel" : "Voir les textes officiels";

/* --- Le texte des codes, mot pour mot ---------------------------------------
   outils/codes.mjs écrit contenu/codes.json : les morceaux de codes consolidés
   que le client doit pouvoir lire chez nous, sans partir ailleurs. Le html de
   chaque article y est déjà nettoyé par l'outil — balises de mise en forme
   seulement, aucun attribut, aucun lien — et il est posé tel quel. C'est du
   texte officiel : il ne doit pas être réécrit en passant.

   Son absence n'empêche pas de construire. Les fiches gardent alors leur lien
   vers la source et le disent. */
const LEGI_ARTICLE = "https://www.legifrance.gouv.fr/codes/article_lc/";

function articleDeLoi(a) {
  const m = a.modifiePar[0];
  return `<li class="article" id="art-${esc(a.num)}">
  <p class="article-tete">
    <span class="article-num">Article ${esc(a.num)}</span>
    ${a.depuis ? `<span class="etiq">en vigueur depuis le ${esc(dateFr(a.depuis))}</span>` : ""}
  </p>
  <div class="texte-loi">${a.html}</div>
  <p class="note-source">
    ${m ? `${m.quoi === "cree" ? "Créé par" : "Modifié par"}
      ${m.lien ? `<a href="${esc(m.lien)}" target="_blank" rel="noopener">${esc(m.titre)} ${sortant}</a>`
               : esc(m.titre)} · ` : ""}
    ${a.id ? `<a href="${LEGI_ARTICLE}${esc(a.id)}" target="_blank" rel="noopener">Vérifier sur Légifrance ${sortant}</a>` : ""}
  </p>
</li>`;
}

/* Ce que le dernier passage du robot a vu bouger. Pas une annonce : une
   comparaison de deux relevés, mot à mot, avec l'avant et l'après. */
function ligneChangement(c, vers = "code/") {
  const quoi = { modifie: "Texte modifié", nouveau: "Vous concerne désormais", sorti: "Ne vous concerne plus" };
  return `<li class="changement change-${esc(c.quoi)}">
  <p class="article-tete">
    <span class="article-num">Article ${esc(c.num)}</span>
    <span class="etiq">${esc(quoi[c.quoi] || c.quoi)}</span>
    ${c.depuis ? `<span class="etiq">en vigueur depuis le ${esc(dateFr(c.depuis))}</span>` : ""}
  </p>
  ${c.quoi === "modifie" ? `<dl class="avant-apres">
    <div><dt class="etiq">Avant</dt><dd><span class="tenu">${esc(c.contexteAvant)} </span><del>${
      esc(c.avant) || "—"}</del><span class="tenu"> ${esc(c.contexteApres)}</span></dd></div>
    <div><dt class="etiq">Maintenant</dt><dd><span class="tenu">${esc(c.contexteAvant)} </span><ins>${
      esc(c.apres) || "—"}</ins><span class="tenu"> ${esc(c.contexteApres)}</span></dd></div>
  </dl>` : `<p class="lecture">${esc(c.apres || c.avant).slice(0, 400)}</p>`}
  <p class="note-source">
    ${c.codeTitre ? `${esc(c.codeTitre)} · ` : ""}
    ${c.par ? `${c.par.lien
      ? `<a href="${esc(c.par.lien)}" target="_blank" rel="noopener">${esc(c.par.titre)} ${sortant}</a>`
      : esc(c.par.titre)} · ` : ""}
    ${c.morceau ? `<a href="${vers}${esc(c.morceau)}.html#art-${esc(c.num)}">Lire l’article en entier</a>` : ""}
  </p>
</li>`;
}

/* Les morceaux de code attachés à une référence et de quoi en parler. */
function texteDuSite(C, ref) {
  if (!C || !C.perimetres) return null;
  const ids = C.perimetres[ref] || [];
  if (!ids.length) return null;
  const morceaux = ids.map((id) => C.morceaux.filter((m) => m.id === id)[0]).filter(Boolean);
  if (!morceaux.length) return null;
  return {
    ids, morceaux,
    articles: morceaux.reduce((s, m) => s + m.articles.length, 0),
    code: C.codes.filter((c) => c.id === morceaux[0].code)[0] || { titre: morceaux[0].codeTitre, version: "" },
    changements: (C.changements || []).filter((c) => ids.indexOf(c.morceau) !== -1)
  };
}

function noteDeSource(C) {
  return `<p class="note-source">
    Source : ${esc(C.source.nom)} — ${esc(C.source.par)}. ${esc(C.source.licence)} : la
    republication est permise, à charge de citer la source et la version, ce que fait
    cette page. Relevé le ${esc(dateFr(C.preleve))} (${esc(C.paquet)}).
    En cas de doute ou de litige, c’est la version publiée par l’État qui fait foi.
  </p>`;
}

/* Une page par morceau : le texte en entier et de quoi circuler dedans. */
function appMorceauDeCode(C, m, refs, precedent, suivant) {
  const intitule = m.chemin[m.chemin.length - 1];
  const dessus = m.chemin.slice(0, -1);
  const code = C.codes.filter((c) => c.id === m.code)[0] || { titre: m.codeTitre, version: "" };
  const changes = (C.changements || []).filter((c) => c.morceau === m.id);

  const corps = `<section class="tete-app">
  <div class="enveloppe">
    <ul class="jalons">
      <li><a href="../plan.html">Ma veille réglementaire</a></li>
      <li><span class="fort">${esc(code.titre)}</span></li>
      <li><span>texte officiel</span></li>
    </ul>
    <h1>${esc(intitule)}</h1>
    <p class="chapeau">${esc(dessus.join(" · "))}</p>
    <dl class="faits" style="margin-top:var(--t5)">
      <div><dt class="etiq">Articles</dt><dd><span class="grand">${m.articles.length}</span></dd></div>
      <div><dt class="etiq">Du</dt><dd>${esc(m.articles[0].num)}</dd></div>
      <div><dt class="etiq">Au</dt><dd>${esc(m.articles[m.articles.length - 1].num)}</dd></div>
      <div><dt class="etiq">Version du code</dt><dd>${esc(code.version ? dateFr(code.version) : "—")}</dd></div>
    </dl>
  </div>
</section>

${changes.length ? rubrique({ etiq: "Ce qui a changé ici", contenu: `
  <p class="lecture">Depuis la relève précédente et rien d’autre : c’est une
  comparaison des deux versions, pas un commentaire.</p>
  <ul class="changements" style="margin-top:var(--t4)">${changes.map((c) => ligneChangement(c, "")).join("")}</ul>` }) : ""}

${rubrique({ etiq: "Le texte, mot pour mot", contenu: `
  <p class="lecture">Le texte officiel consolidé, tel qu’il est en vigueur, reproduit
  ici en entier. Vous n’avez pas à aller le chercher ailleurs.</p>
  <ul class="articles" style="margin-top:var(--t5)">${m.articles.map(articleDeLoi).join("")}</ul>
  <p class="rangee" style="margin-top:var(--t5)">
    <button type="button" class="bouton bouton-sobre" data-imprimer>${imprimante} Enregistrer en PDF</button>
  </p>
  ${noteDeSource(C)}` })}

${rubrique({ etiq: "D’où ça vient dans votre veille", aplat: true, contenu: `
  ${refs.length ? `<p class="lecture">Ce morceau de code est le texte de référence
  de ${refs.length === 1 ? "la fiche suivante" : `${refs.length} fiches`} :</p>
  <ul class="puces" style="margin-top:var(--t4)">
    ${refs.map((r) => `<li><a href="../texte/${slug(r)}.html">
      <span class="code">fiche</span><span class="nom">${esc(r)}</span></a></li>`).join("")}
  </ul>` : ""}
  <p class="rangee" style="margin-top:var(--t5)">
    ${precedent ? `<a class="lien-fleche" href="${esc(precedent.id)}.html">◀ ${esc(precedent.chemin[precedent.chemin.length - 1])}</a>` : ""}
    ${suivant ? `<a class="lien-fleche" href="${esc(suivant.id)}.html">${esc(suivant.chemin[suivant.chemin.length - 1])} ${fleche}</a>` : ""}
  </p>` })}`;

  return page({
    titre: `${intitule} | ${code.titre} | ${SITE.nom}`,
    description: `${intitule} — ${m.articles.length} articles du ${code.titre}, texte officiel consolidé.`,
    racine: "../../", zone: "app", actif: "textes", corps, verrou: true, formule: "textes"
  });
}

/* La liste des textes d'un secteur : chacun se déplie sur ce qu'il exige, avec
   sa date d'entrée en vigueur quand nous la relevons. */
function listeDeTextes(V, C, LIENS, TEXTES, entrees) {
  return `<ul class="textes textes-depliants">
    ${entrees.map((x) => {
      const L = lienDuTexte(C, LIENS, x.ref);
      const f = TEXTES[x.ref] || {};
      const quand = dateDuTexte(C, x.ref);
      return `<li>
      <details>
        <summary>
          <span class="ref">${esc(x.ref)}</span>
          <span class="rattache">${esc(x.domaine)}</span>
          <span class="source etiq">${quand && quand.depuis
            ? `${quand.neuf ? `<span class="marque-neuf">Nouveau</span> ` : ""}depuis le ${esc(dateFr(quand.depuis))}`
            : esc(x.nature)}</span>
          ${chevron}
        </summary>
        <div class="detail">
          ${f.porte ? `<p class="lecture">${esc(f.porte)}</p>` : ""}
          ${f.qui ? `<p class="lecture"><strong>À qui ça s'applique.</strong> ${esc(f.qui)}</p>` : ""}
          ${(f.exige || []).length ? `<span class="etiq" style="margin-top:var(--t4)">Ce que ce texte exige</span>
          <ul class="exigences">${f.exige.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>` : ""}
          <p class="rangee" style="margin-top:var(--t4)">
            <a class="bouton bouton-sobre" href="../texte/${slug(x.ref)}.html">La fiche ${fleche}</a>
            <a class="bouton bouton-sobre" href="${esc(L.url)}" target="_blank" rel="noopener"
               title="${esc(L.quoi)}">${esc(intituleDuLien(L))} ${sortant}</a>
          </p>
        </div>
      </details>
    </li>`; }).join("\n")}
  </ul>`;
}

/* --- Le relevé officiel, quand il a été fait -------------------------------- */
/* outils/jorf.mjs va chercher les textes au Journal officiel (données ouvertes
   de la DILA, sans compte) et écrit contenu/jo-releve.json. Quand ce fichier
   existe, l'application sert ces textes-là, avec leur contenu intégral. Quand
   il n'existe pas, elle sert le jeu d'essai — et le dit. Jamais l'un déguisé
   en l'autre. */
/* Le conseil de l'IA, SOUS le texte officiel, jamais à sa place : ce qu'elle
   propose, ses sources officielles contrôlées (outils/conseils.mjs) et ce
   qu'il n'est pas. Rien s'il n'y en a pas, ou s'il a été écarté. */
/* Le conseil de l'IA n'est jamais écrit dans la page : il est dans la base
   et seuls les abonnés qui y ont droit le lisent (conseils_lire). Dans un
   compte, assets/espace.js remplit la place ; dans la démonstration, une
   phrase dit ce qui s'affiche ici — sans conseil inventé. */
function placeConseil(t) {
  return `<div class="place-conseil encart-large" data-conseil="${esc(t.id)}" data-compte hidden></div>
        <section class="encart encart-ia encart-large" data-demo>
          <h4 class="encart-titre">Proposé par l'IA, à vérifier</h4>
          <p>Dans un compte <strong>Textes et suivi</strong> ou <strong>Veille complète</strong>, un conseil proposé par l'IA
          s'affiche ici, sous le texte officiel, avec ses sources officielles ; en Veille complète, un second, pour votre métier.
          La démonstration n'en montre pas : nous n'en inventons pas pour l'exemple.</p>
        </section>`;
}

/* La clé d'un texte relevé : la même pour la case « Fait », le registre, la
   cloche et ce que l'abonné a déjà ouvert (assets/avis.js). */
/* La clé d'un texte du relevé. Sans identifiant, elle vient du titre ; un
   titre long tronqué à 70 caractères pouvait donner la même clé à plusieurs
   textes (4 novembre 2026 : trois « Décision relative à une modification
   administrative d'autorisation de… » partageaient leur « Lu », leur
   « Applicable » et leurs actions). On ajoute alors une empreinte du titre
   complet ; les titres courts gardent leur clé et ce qui y est enregistré. */
const cleJO = (t) => {
  if (t.id && !/^http/.test(t.id)) return `jo:${t.id}`;
  const s = slug(t.titre);   // slug() coupe à 70 caractères
  const entier = sansAccent(t.titre).toLowerCase().replace(/['’]/g, " ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return entier.length > s.length ? `jo:${s.replace(/-+$/, "")}-${cleCourte(`${t.titre}|${t.lien || ""}`)}` : `jo:${s}`;
};
const ancreJO = (t) => `t-${slug(cleJO(t)).slice(0, 90)}`;

function ligneJO(V, t, i, releveLe = "") {
  const noms = t.domaines.map((d) => d.nom);
  const droit = t.genre === "texte";
  /* Les gestes à faire, pris sur les domaines auxquels le texte est rattaché :
     un abonné qui lit « un texte est sorti » veut savoir quoi faire. */
  const actions = [...new Set(t.domaines.flatMap((d) =>
    (V.domaines[d.id] || {}).actions || []))].slice(0, 4);
  /* La date du texte vient de son titre quand il la porte ; la date d'archive
     dit seulement quand nous l'avons vu passer. Les deux sont utiles et ce ne
     sont pas les mêmes. */
  const quand = t.dateTexte || t.date;
  const vu = t.vuLe || t.date;
  /* « Lesquels sont nouveaux ? » Ceux que la dernière relève a vus passer pour
     la première fois. Nous ne connaissons pas la date d'entrée en vigueur d'un
     texte qui vient de paraître — nous ne l'inventons donc pas, nous disons la
     date qu'il porte et nous marquons ce qui est arrivé depuis la dernière
     relève. */
  /* « Nouveau » se dit par personne, pas à la construction : un texte est
     nouveau pour qui ne l'a pas encore ouvert (assets/avis.js pose la marque). */
  const neuf = false;
  const idFait = cleJO(t);

  /* data-domaines, data-date, data-premier : de quoi le ranger dans le plan
     d'une autre entreprise sans rien recalculer (assets/entreprise.js). */
  return `<li class="ligne-releve statut-${droit ? "attente" : "neutre"}${neuf ? " est-neuf" : ""}" id="${ancreJO(t)}" data-cle="${esc(idFait)}" data-domaines="${esc(t.domaines.map((d) => d.id).join(" "))}" data-date="${esc(quand)}"${neuf ? " data-neuf" : ""}${actions.length ? ` data-premier="${esc(actions[0])}"` : ""}>
  <details>
    <summary>
      <span class="mono date">${esc(dateFr(quand))}</span>
      <span class="corps">
        <span class="titre">${actions.length ? marqueFait(idFait) : ""}${actions.length ? `<span class="marque-qualif" data-qualif="${esc(idFait)}" hidden></span>` : ""}${neuf ? `<span class="marque-neuf">Nouveau</span> ` : ""}${esc(t.titre)}</span>
        <span class="quoi">${esc(String(t.corps || "").slice(0, 180).replace(/\s+\S*$/, ""))}…</span>
        <span class="meta etiq">${esc(t.sourceNom)} · ${esc(noms.join(" · "))}${
          quand !== vu ? ` · relevé le ${esc(dateFr(vu))}` : ""}</span>
      </span>
      <span class="statut etiq">${droit ? "Texte" : NON_OFFICIELLES.has(t.source) ? "Profession" : "Publication"}</span>
      ${chevron}
    </summary>
    <div class="detail">
      <div class="encarts-fiche">
        <section class="encart encart-faire">
          <h4 class="encart-titre"><span class="numero-encart" aria-hidden="true">1</span>Ce que vous devez faire</h4>
          ${actions.length
            ? `<ul class="a-faire">${actions.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>
               <div data-demo>${boutonFait(idFait, { objet: `Texte traité : ${t.titre}` })}</div>
               <div class="qualifier" data-compte hidden data-cle="${esc(idFait)}" data-objet="${esc(t.titre)}"
                    data-action="${esc(actions[0])}"></div>`
            : `<p>Rien à faire de votre côté : ce texte est à connaître, pas à appliquer.</p>`}
          <p class="rangee">
            <button type="button" class="bouton bouton-sobre imprimer-fiche">${imprimante} Enregistrer en PDF</button>
          </p>
        </section>
        <section class="encart encart-texte">
          <h4 class="encart-titre"><span class="numero-encart" aria-hidden="true">2</span>${droit ? "Le texte, tel que publié" : "Ce qu'en dit la source"}</h4>
          <div class="texte-officiel">${esc(String(t.corps || "")).replace(/\n/g, "<br>")}</div>
          ${t.nota ? `<p class="note-source"><strong>Nota.</strong> ${esc(t.nota)}</p>` : ""}
        </section>
        ${placeConseil(t)}
        <section class="encart encart-source encart-large">
          <h4 class="encart-titre">D'où vient ce texte</h4>
          <p>
            ${esc(t.sourceNom)} — ${droit
              ? "texte officiel de la République française, sous Licence Ouverte."
              : NON_OFFICIELLES.has(t.source)
                ? "publication d'une organisation professionnelle, non officielle, reproduite avec sa source et sa date. Ce n'est pas du droit : c'est le commentaire de la profession."
                : "publication officielle, reproduite avec sa source et sa date. Ce n'est pas du droit, c'est un commentaire officiel."}
            ${quand !== vu ? `Texte du ${esc(dateFr(quand))}, relevé le ${esc(dateFr(vu))}`
                           : `Publié le ${esc(dateFr(quand))}`}${
              t.id && !/^http/.test(t.id) ? ` — identifiant ${esc(t.id)}` : ""}.
            ${/^https?:\/\//i.test(t.lien || "") ? `<a href="${esc(t.lien)}" target="_blank" rel="noopener">Voir chez la source ${sortant}</a>` : ""}
            En cas de doute, c'est la source qui fait foi.
          </p>
        </section>
      </div>
    </div>
  </details>
</li>`;
}

/* --- Depuis quand un texte est en vigueur -----------------------------------
   « Lesquels sont nouveaux ? » est la première question d'un abonné. Quand
   nous publions le texte consolidé, nous connaissons la date d'entrée en
   vigueur de chacun de ses articles : la plus récente dit quand ce morceau de
   droit a bougé pour la dernière fois. Quand nous ne publions pas le texte,
   nous ne savons pas et la page le dit — elle n'invente pas une date. */
function dateDuTexte(C, ref) {
  const T = texteDuSite(C, ref);
  if (!T) return null;
  let tard = "";
  for (const m of T.morceaux)
    for (const a of m.articles)
      if (a.depuis && a.depuis > tard) tard = a.depuis;
  return {
    depuis: tard || null,
    neuf: T.changements.length > 0,
    articles: T.articles
  };
}

/* Ce qu'on affiche dans la colonne « depuis quand ». */
function celluleDepuis(C, ref) {
  const d = dateDuTexte(C, ref);
  if (!d || !d.depuis) {
    return `<span class="tenu" title="Nous donnons la date d'entrée en vigueur des textes dont nous relevons le contenu consolidé. Celui-ci n'en fait pas encore partie : nous ne l'inventons pas.">pas encore relevée</span>`;
  }
  return `${d.neuf ? `<span class="marque-neuf">Nouveau</span> ` : ""}
    <span class="mono date">${esc(dateFr(d.depuis))}</span>
    <span class="precision">dernière évolution sur ${d.articles} article${d.articles > 1 ? "s" : ""} suivis</span>`;
}

/* --- Les textes en tableau, rangés par catégorie ----------------------------
   Une liste de cent vingt-quatre textes à la file, c'est du brouillon : on ne
   sait pas lequel regarde quoi. Ici chaque texte tombe dans sa catégorie —
   santé & sécurité, hygiène, social, environnement, métier — et chaque
   tableau dit trois choses : le texte, ce qu'il exige, où le lire.

   Sous 52 rem, chaque ligne devient une carte : même contenu, même ordre,
   sans défilement latéral. */
function tableauDeTextes(V, C, LIENS, TEXTES, entrees, racine = "", cherchable = false) {
  const par = {};
  entrees.forEach((e) => {
    const d = V.domaines[e.id];
    const cl = d && V.classements[d.classement] ? d.classement : "metier";
    (par[cl] = par[cl] || []).push(e);
  });

  const familles = Object.keys(V.classements)
    .map((id) => ({ id, cl: V.classements[id], textes: par[id] || [] }));

  const avecDate = entrees.filter((e) => (dateDuTexte(C, e.ref) || {}).depuis).length;
  const neufs = entrees.filter((e) => (dateDuTexte(C, e.ref) || {}).neuf).length;

  const note = avecDate ? `<p class="note-source">
    La colonne « en vigueur depuis » donne la dernière évolution du texte, pour les
    ${avecDate} textes dont nous publions le contenu consolidé${neufs ? ` ; ${neufs} ${neufs > 1 ? "ont" : "a"} bougé à la dernière relève et porte${neufs > 1 ? "nt" : ""} la marque <span class="marque-neuf">Nouveau</span>` : " ; aucun n'a bougé à la dernière relève"}.
    Pour les autres, nous n'avons pas encore la date et nous ne l'inventons pas.
  </p>` : "";

  const cartes = cartesCategories(familles.map((g) => {
    const n = g.textes.filter((e) => (dateDuTexte(C, e.ref) || {}).neuf).length;
    return {
      id: `textes-${g.id}`, nom: g.cl.l, vide: !g.textes.length,
      compte: g.textes.length ? `${g.textes.length} texte${g.textes.length > 1 ? "s" : ""}` : "Aucun texte",
      marque: n ? `${n} nouveau${n > 1 ? "x" : ""}` : "",
      lignes: [esc(g.cl.d)]
    };
  }));

  const tables = familles.filter((g) => g.textes.length).map((g) => `
  <section class="famille-textes" id="textes-${esc(g.id)}" data-categorie${cherchable ? " data-groupe" : ""}>
    <h3>${esc(g.cl.l)} <span class="etiq">${g.textes.length} texte${g.textes.length > 1 ? "s" : ""}</span></h3>
    <p class="precision">${esc(g.cl.d)}</p>
    ${parSujet(V, `textes-${g.id}`, g.textes, (e) => e.id, (liste) => `
    <div class="tableau-boite">
    <table class="tableau-textes">
      <thead><tr>
        <th scope="col">Texte</th>
        <th scope="col">En vigueur depuis</th>
        <th scope="col">Ce qu'il exige</th>
        <th scope="col">Où le lire</th>
      </tr></thead>
      <tbody>
        ${liste.map((e) => {
          const f = TEXTES[e.ref] || {};
          const L = lienDuTexte(C, LIENS, e.ref);
          const exige = (f.exige || []).slice(0, 2);
          const fiche = `${racine}texte/${slug(e.ref)}.html`;
          const quand = dateDuTexte(C, e.ref);
          return `<tr${quand && quand.neuf ? ' class="ligne-neuve"' : ""}${cherchable
            ? ` data-recherche="${esc([e.ref, f.nature || "", f.qui || "", e.domaine, g.cl.l,
                quand && quand.neuf ? "nouveau récent" : "", ...(f.exige || [])].join(" "))}"` : ""}>
        <th scope="row" data-intitule="Texte">
          <a href="${fiche}">${esc(e.ref)}</a>
          <span class="precision">${esc(e.domaine)}${f.nature ? ` · ${esc(f.nature)}` : ""}</span>
          ${lienCarte(fiche, `Ouvrir la fiche : ${e.ref}`)}</th>
        <td data-intitule="En vigueur depuis" class="cellule-depuis">${celluleDepuis(C, e.ref)}</td>
        <td data-intitule="Ce qu'il exige">${exige.length
          ? `<ul class="exige-court">${exige.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
             ${(f.exige || []).length > 2 ? `<span class="lien-fleche">les ${f.exige.length} points ${fleche}</span>` : ""}`
          : `<span class="tenu">Fiche à écrire.</span>`}</td>
        <td data-intitule="Où le lire">
          <a class="lien-officiel" href="${esc(L.url)}" target="_blank" rel="noopener"
             title="${esc(L.quoi)}">${esc(intituleDuLien(L))} ${sortant}</a>
          <span class="precision">${esc(L.quoi)}</span></td>
      </tr>`; }).join("")}
      </tbody>
    </table>
    </div>`)}
  </section>`).join("");

  return { note, cartes, tables };
}

/* --- Les textes rangés par nature ------------------------------------------
   « Plus clair » veut dire : ne pas servir une liste unique où tout se vaut.
   Un texte qui sort relève de la santé-sécurité, de l'hygiène, du social, de
   l'environnement, ou du métier. Le tableau le dit d'un coup d'œil et dit ce
   qu'il faut faire en premier ; les listes dessous donnent le détail. */
function groupesParClassement(V, entrees, domaineDe) {
  const par = {};
  entrees.forEach((t) => {
    const d = V.domaines[domaineDe(t)];
    const cl = d && V.classements[d.classement] ? d.classement : "metier";
    (par[cl] = par[cl] || []).push(t);
  });
  return Object.keys(V.classements)
    .map((id) => ({ id, cl: V.classements[id], textes: par[id] || [] }));
}

/* --- Les catégories, d'abord seules -----------------------------------------
   « Une seule page avec les catégories et quand on clique sur une, ce qui y
   appartient, seulement ça. » Les pages Relevé, Textes et Secteurs s'ouvrent
   sur une carte par catégorie et rien d'autre ; app.js n'affiche ensuite que
   celle qu'on a choisie. Sans JavaScript, les cartes sont des ancres et tout
   reste lisible dessous.

   Les cartes finissent toujours leurs lignes : sur la grille de six colonnes
   du bureau, la dernière rangée se partage la largeur au lieu de laisser une
   carte seule dans un coin. */
function cartesCategories(cartes) {
  const n = cartes.length;
  const cols = n % 3 === 0 ? 3 : (n % 2 === 0 ? 2 : 3);
  const reste = n % cols;
  return `<nav class="choix-categories" data-choix aria-label="Catégories">
  <ul class="cartes-categories">
    ${cartes.map((c, i) => {
      const large = reste && i >= n - reste ? 6 / reste : 6 / cols;
      const dedans = `
        <span class="carte-tete"><span class="carte-nom">${esc(c.nom)}</span>${
          c.marque ? `<span class="marque-neuf"${c.marqueAttr || ""}>${esc(c.marque)}</span>` : ""}</span>
        <span class="carte-compte"${c.compteAttr || ""}>${esc(c.compte)}</span>
        ${c.id ? `<span class="carte-faits" data-faits-de="${esc(c.id)}" hidden></span>` : ""}
        ${(c.lignes || []).map((l) => `<span class="carte-ligne">${l}</span>`).join("")}`;
      return `<li data-large="${large}">${c.vide
        ? `<div class="carte-categorie carte-vide">${dedans}</div>`
        : `<a class="carte-categorie${c.classe ? ` ${c.classe}` : ""}" href="#${esc(c.id)}"${c.attrs || ""}>${dedans}<span class="carte-aller">${fleche}</span></a>`}</li>`;
    }).join("")}
  </ul>
</nav>`;
}

/* Ce qu'il y a dans une catégorie, rangé par sujet : en haut, la liste des
   sujets avec leur nombre, qui mène à chacun ; dessous, un encadré par sujet.
   « Social », c'est cinquante textes de paie et cinq de droit du travail :
   les servir d'affilée, c'est ne pas les distinguer. Un seul sujet : pas de
   liste en haut, il n'y a rien à choisir. */
function parSujet(V, prefixe, entrees, domaineDe, rendre, unite = "texte") {
  const par = new Map();
  for (const e of entrees) {
    const id = domaineDe(e) || "autres";
    if (!par.has(id)) par.set(id, []);
    par.get(id).push(e);
  }
  const sujets = [...par.entries()]
    .map(([id, liste]) => ({ id, nom: (V.domaines[id] || {}).nom || "Autres", liste }))
    .sort((a, b) => b.liste.length - a.liste.length || a.nom.localeCompare(b.nom, "fr"));
  const compte = (n) => `${n} ${unite}${n > 1 ? "s" : ""}`;
  return `${sujets.length > 1 ? `<nav class="dedans" aria-label="Ce qu'il y a dans cette catégorie">
    <p class="etiq">Dans cette catégorie</p>
    <ul>${sujets.map((g) => `<li><a href="#${esc(prefixe)}--${esc(g.id)}"><span>${esc(g.nom)}</span>
      <span class="compte">${g.liste.length}</span></a></li>`).join("")}</ul>
  </nav>` : ""}
  ${sujets.map((g) => `<section class="sous-groupe" id="${esc(prefixe)}--${esc(g.id)}" data-groupe data-sujet-releve="${esc(g.id)}">
    <h4>${esc(g.nom)} <span class="etiq">${compte(g.liste.length)}</span></h4>
    ${rendre(g.liste)}
  </section>`).join("")}`;
}

/* Ce qui explique la page sans être ce qu'on vient y chercher : replié. */
function aSavoir(titre, contenu) {
  return `<details class="a-savoir" data-annexe>
  <summary>${esc(titre)}</summary>
  <div class="a-savoir-corps">${contenu}</div>
</details>`;
}

/* --- Relevé ------------------------------------------------------------------ */
function appReleve(V, D, JO, C, LIENS, SOURCES = []) {
  const confirmees = SOURCES.filter((x) => x.confirme && x.officielle !== false);   // les officielles seulement
  const parStatut = Object.keys(STATUTS).map((s) => ({
    s, l: STATUTS[s].l, n: D.releve.filter((t) => t.statut === s).length
  }));

  const officiel = JO && JO.textes && JO.textes.length;
  const groupes = groupesParClassement(V, D.releve, (t) => t.domaine);
  /* Seuls les textes qui touchent le plan de l'entreprise sont rangés par
     famille ; les autres vont dans un volet replié, en bas. Un texte est rangé
     sous le premier de ses sujets qui est dans le plan. Dans un vrai compte,
     ou après « Réglages », assets/entreprise.js refait ce tri sur son plan. */
  const plan = planDe(V, D.entreprise);
  const dansPlan = (t) => t.domaines.some((d) => plan.liste.includes(d.id));
  const textesPlan = officiel ? JO.textes.filter(dansPlan) : [];
  const textesHors = officiel ? JO.textes.filter((t) => !dansPlan(t))
    .sort((a, b) => ((a.dateTexte || a.date) < (b.dateTexte || b.date) ? 1 : -1)) : [];
  /* Les textes relevés, rangés par famille : santé-sécurité, hygiène, social,
     environnement, métier. Cent quarante-deux textes d'affilée, c'est illisible ;
     rangés par nature, on voit d'un coup d'œil où il y a du travail. */
  const domaineJO = (t) => ((t.domaines || []).find((d) => plan.liste.includes(d.id)) || (t.domaines || [])[0] || {}).id || "";
  const groupesJO = officiel ? groupesParClassement(V, textesPlan, domaineJO) : [];
  /* Une source vérifiée qui n'a pas répondu cette fois-ci. Celles qu'on ne sait
     pas encore relever sont dites à part, avec leur raison. */
  const muettes = officiel
    ? JO.rapport.filter((r) => r.souci && confirmees.some((c) => c.id === r.id)) : [];

  /* Une carte par famille : combien de textes, combien de nouveaux, le plus
     récent et ce qu'il faut faire en premier. C'est ce qu'on voit en
     arrivant ; les textes eux-mêmes viennent au clic, famille par famille. */
  const carteFamille = (g, prefixe, dateDe, domaineDe, neufDe) => {
    const liste = g.textes.slice().sort((a, b) => (dateDe(a) < dateDe(b) ? 1 : -1));
    if (!liste.length) {
      // Une famille du relevé officiel garde son lien : le plan d'un autre compte peut la remplir.
      return prefixe === "jo-"
        ? { id: `${prefixe}famille-${g.id}`, nom: g.cl.l, compte: "Rien qui vous concerne", lignes: [esc(g.cl.d)],
            classe: "carte-vide", attrs: ' aria-disabled="true" tabindex="-1"' }
        : { nom: g.cl.l, compte: "Rien sur la période", lignes: [esc(g.cl.d)], vide: true };
    }
    const d = V.domaines[domaineDe(liste[0])];
    const neufs = neufDe ? liste.filter(neufDe).length : 0;
    return {
      id: `${prefixe}famille-${g.id}`, nom: g.cl.l,
      compte: `${liste.length} texte${liste.length > 1 ? "s" : ""}`,
      marque: neufs ? `${neufs} nouveau${neufs > 1 ? "x" : ""}` : "",
      lignes: [`Le plus récent : ${esc(dateFr(dateDe(liste[0])))}`,
               d && d.actions && d.actions.length ? `En premier : ${esc(d.actions[0])}` : esc(g.cl.d)]
    };
  };
  const articlesSuivis = C ? C.morceaux.reduce((n, m) => n + m.articles.length, 0) : 0;
  const carteCodes = C ? [{
    id: "codes-changements", nom: "Les codes",
    compte: C.changements.length
      ? `${C.changements.length} changement${C.changements.length > 1 ? "s" : ""}` : "Aucun changement",
    lignes: [`${articlesSuivis} articles suivis, mot à mot`, `Relevés le ${esc(dateFr(C.preleve))}`]
  }] : [];

  /* Le jeu d'essai montre le parcours complet d'un texte : analyse, décision,
     trace. Avec un vrai relevé, il passe dans un repli ; sans, c'est lui que
     la page présente, famille par famille. */
  const familleDemo = (g, categorie) => `
  <section class="famille-releve" id="famille-${esc(g.id)}"${categorie ? " data-categorie" : ""}>
    <h3>${esc(g.cl.l)} <span class="etiq">${g.textes.length} texte${g.textes.length > 1 ? "s" : ""}</span></h3>
    <p class="precision">${esc(g.cl.d)}</p>
    ${parSujet(V, `famille-${g.id}`, g.textes, (t) => t.domaine, (liste) => `<ul class="liste-releve">
      ${liste.map((t) => ligneReleve(V, C, LIENS, t)).join("")}
    </ul>`)}
  </section>`;
  const statutsDemo = `<dl class="compteurs">
    ${parStatut.map((x) => `<div><dt class="etiq">${esc(x.l)}</dt><dd><span class="grand">${x.n}</span></dd></div>`).join("")}
  </dl>`;

  const commentFait = officiel ? `
  <dl class="compteurs">
    <div><dt class="etiq">Textes de droit</dt><dd><span class="grand">${JO.textes.filter((x) => x.genre === "texte").length}</span></dd></div>
    <div><dt class="etiq">Publications officielles</dt><dd><span class="grand">${JO.textes.filter((x) => x.genre !== "texte").length}</span></dd></div>
    <div><dt class="etiq">Sources qui ont répondu</dt><dd><span class="grand">${JO.rapport.filter((r) => !r.souci).length}</span>
      <span class="precision">sur ${JO.rapport.length} interrogées</span></dd></div>
    <div><dt class="etiq">Dernière relève</dt><dd>${esc(dateFr(JO.releve_le))}</dd></div>
  </dl>
  <p class="lecture" style="margin-top:var(--t4)">
    Relevé automatiquement sur ${confirmees.length} sources officielles vérifiées —
    Journal officiel en tête — et filtré sur les domaines du référentiel. Un
    <strong>texte</strong> est du droit ; une <strong>publication</strong> est un
    commentaire officiel, qui compte pour la veille mais n'en est pas.
  </p>
  ${SOURCES.length > confirmees.length ? `<p class="note-source" style="margin-top:var(--t4)">
    <strong>Pas encore relevées :</strong>
    ${esc(SOURCES.filter((x) => !x.confirme).map((x) => `${x.nom.split(" — ")[0]} (${x.pourquoi || "ne répond pas"})`).join(" · "))}.
    Ce qui vient de là ne figure pas ici : ce n'est pas une absence de texte.</p>` : ""}
  ${muettes.length ? `<p class="reserve" style="margin-top:var(--t4)">
    <strong>Muettes à la dernière relève :</strong> ${esc(muettes.map((r) => r.nom).join(" · "))}.
    Ce qu'elles auraient publié depuis ne figure pas ici ; elles seront relues à la
    prochaine relève.</p>` : ""}` : "";

  const corps = enTeteApp(D, "Relevé des textes",
    "Les textes parus qui touchent votre plan, rangés par famille. Cliquez sur une famille pour voir les textes de cette famille, chacun avec ce qu'il faut faire.",
    ficheDeLEntreprise(V, D)) + `

<section class="rubrique">
  <div class="enveloppe">
  ${officiel ? `
  ${cartesCategories([
    ...groupesJO.map((g) => carteFamille(g, "jo-", (t) => t.dateTexte || t.date, domaineJO, null)),
    ...carteCodes])}
  ${aSavoir("Comment ce relevé est fait", commentFait)}
  <div data-demo>${aSavoir("Exemple : le parcours complet d'un texte", `<p class="lecture">
    Des textes de démonstration, conservés pour montrer le cycle complet : analyse,
    décision, trace.</p>
    ${statutsDemo}
    ${groupes.filter((g) => g.textes.length).map((g) => familleDemo(g, false)).join("")}`)}</div>
  <p class="reserve" id="releve-sans-plan" hidden>Votre code APE n'est pas encore renseigné : tous les textes relevés
    sont ici. Renseignez-le dans <a href="reglages.html">Réglages</a> : le relevé ne montrera plus que ce qui vous concerne.</p>
  ${(() => { let n = 0; return groupesJO.map((g) => `
  <section class="famille-releve" id="jo-famille-${esc(g.id)}" data-categorie data-famille="${esc(g.id)}"${g.textes.length ? "" : " hidden"}>
    <h3>${esc(g.cl.l)} <span class="etiq">${g.textes.length} texte${g.textes.length > 1 ? "s" : ""}</span></h3>
    <p class="precision">${esc(g.cl.d)}</p>
    ${parSujet(V, `jo-famille-${g.id}`,
      g.textes.slice().sort((a, b) => ((a.dateTexte || a.date) < (b.dateTexte || b.date) ? 1 : -1)),
      domaineJO, (liste) => `<ul class="liste-releve">
      ${liste.map((t) => ligneJO(V, t, n++, JO.releve_le)).join("")}
    </ul>`)}
  </section>`).join("") + `
  <details class="a-savoir releve-ecartes" id="releve-ecartes"${textesHors.length ? "" : " hidden"}>
    <summary><span>Voir aussi les <b data-ecartes-total>${textesHors.length}</b> textes parus qui ne vous concernent pas</span></summary>
    <div class="a-savoir-corps">
      <p class="lecture">Ils ne touchent aucun des sujets de votre plan. Ils restent ici pour qui veut vérifier
      que rien n'a été oublié.</p>
      <ul class="liste-releve" id="releve-ecartes-liste">
      ${textesHors.map((t) => ligneJO(V, t, n++, JO.releve_le)).join("")}
      </ul>
    </div>
  </details>`; })()}` : `
  <p class="reserve">
    <strong>Aucune relève n'a encore été faite.</strong>
    Le robot qui va chercher sur les sources officielles tourne
    <strong>toutes les heures</strong>. Cette page montre donc le jeu d'essai, et
    rien d'autre : pas de texte inventé.
  </p>
  ${cartesCategories([
    ...groupes.map((g) => carteFamille(g, "", (t) => t.date, (t) => t.domaine, null)),
    ...carteCodes])}
  ${aSavoir("Où en sont ces textes", statutsDemo)}
  ${groupes.filter((g) => g.textes.length).map((g) => familleDemo(g, true)).join("")}`}
  </div>
</section>

${C ? rubrique({ etiq: "Ce qui a changé dans les codes", id: "codes-changements", attrs: " data-categorie", contenu: `
  <dl class="compteurs">
    <div><dt class="etiq">Articles suivis</dt><dd><span class="grand">${C.morceaux.reduce((n, m) => n + m.articles.length, 0)}</span></dd></div>
    <div><dt class="etiq">Codes suivis</dt><dd><span class="grand">${C.codes.length}</span></dd></div>
    <div><dt class="etiq">Changements</dt><dd><span class="grand">${C.changements.length}</span></dd></div>
    <div><dt class="etiq">Dernière relève</dt><dd>${esc(dateFr(C.preleve))}</dd></div>
  </dl>
  ${C.changements.length ? `<p class="lecture" style="margin-top:var(--t4)">
    Le robot compare chaque article avec la relève précédente. Voici ce qui a bougé,
    mot à mot. Rien n’est deviné : c’est la différence entre deux versions.</p>
  <ul class="changements" style="margin-top:var(--t4)">
    ${C.changements.slice(0, 40).map((c) => ligneChangement(c, "code/")).join("")}
  </ul>
  ${C.changements.length > 40 ? `<p class="note-source">… et ${C.changements.length - 40} autres,
    visibles sur la fiche du texte concerné.</p>` : ""}`
  : `<p class="lecture" style="margin-top:var(--t4)">
    Aucun des ${C.morceaux.reduce((n, m) => n + m.articles.length, 0)} articles suivis n’a
    changé depuis la relève précédente. C’est une comparaison article par article, pas une
    absence d’information : le jour où un mot bouge, il apparaît ici, avec l’avant et
    l’après et part en alerte.</p>`}
  ${noteDeSource(C)}` }) : ""}`;

  return page({
    titre: `Relevé des textes | ${SITE.nom}`,
    description: "Les textes parus qui vous concernent.",
    racine: "../", zone: "app", actif: "releve", corps, verrou: true, formule: "textes", donneesPlan: true,
    attrsBody: ' data-page="releve"'
  });
}

/* --- Registre ------------------------------------------------------------------ */
/* Les pages Relevé et Textes sont retirées (3 novembre 2026) : tout se lit
   dans « Ma veille réglementaire ». Les anciennes adresses y renvoient. */
function renvoi(nom, url, libelle) {
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="0; url=${url}">
<title>${esc(nom)} | ${esc(SITE.nom)}</title><meta name="robots" content="noindex"></head>
<body><p>Cette page est maintenant dans <a href="${url}">${esc(libelle)}</a>.</p></body></html>`;
}

function appRegistre() {
  /* Le registre est désormais en bas de « Registre et conformité réglementaire »
     (3 novembre 2026) : l'ancienne adresse y renvoie, pour les favoris. */
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="0; url=conformite.html#registre">
<title>Registre | ${esc(SITE.nom)}</title><meta name="robots" content="noindex"></head>
<body><p>Le registre est maintenant dans <a href="conformite.html#registre">Registre et conformité réglementaire</a>.</p></body></html>
`;
}

/* --- Les 88 fiches ----------------------------------------------------------- */
/* Essayé en bulles : le diamètre portait le nombre de domaines, mais ça
   n'était pas beau et ça se lisait mal. Retour à une grille de cartes —
   la même que sur l'accueil — qui se parcourt et se cherche mieux. */
function appSecteurs(V, METIERS, NAF) {
  /* On n'affiche plus 88 divisions mais les 732 codes APE, groupés par la
     division qui porte leur périmètre : une entreprise se reconnaît à son
     code, pas à sa division. Sans contenu/naf.js, on retombe sur les
     divisions seules et la page le dit. */
  const codes = NAF ? NAF.codes : [];
  const parDivision = {};
  codes.forEach((c) => { (parDivision[c.d] = parDivision[c.d] || []).push(c); });

  const groupes = V.divisions.map((d) => ({
    d,
    section: V.sections.filter((x) => x.c === d.s)[0],
    codes: parDivision[d.c] || []
  }));

  const corps = `<section class="tete-app">
  <div class="enveloppe">
    <ul class="jalons">
      <li><span class="fort">Référentiel</span></li>
      ${NAF ? `<li><span>${codes.length} codes APE</span></li>` : ""}
      <li><span>${V.divisions.length} familles · ${V.sections.length} sections</span></li>
      <li><span>${Object.keys(V.domaines).length} domaines</span></li>
    </ul>
    <h1>Trouvez votre code</h1>
    <p class="chapeau">
      Choisissez votre grand secteur, puis votre code APE : vous verrez ce qui
      s'applique à votre métier.
    </p>
    <div class="recherche" style="margin-top:var(--t5)">
      <label class="etiq" for="recherche-secteur">Ou tapez votre code ou votre métier</label>
      <input type="search" id="recherche-secteur" placeholder="4322B, plomberie, boulangerie, 43…"
             autocomplete="off" spellcheck="false">
      <p class="recherche-compte etiq"><span id="compte-secteurs"></span></p>
    </div>
    <p class="note-source">Votre code APE est sur votre avis de situation INSEE et sur vos
      bulletins de paie.${NAF ? ` Nomenclature ${esc(NAF.source.nom)}, relevée le ${esc(dateFr(NAF.releve))}.` : ""}</p>
  </div>
</section>

<section class="rubrique">
<div class="enveloppe" data-unite="${NAF ? "codes" : "secteurs"}">
  <p id="aucun-secteur" class="etat-vide" hidden>
    Aucun code ne correspond. Essayez les deux premiers chiffres, ou un mot du métier.
  </p>
  ${cartesCategories(V.sections.map((sec) => {
    const divs = groupes.filter((g) => g.d.s === sec.c);
    const n = divs.reduce((k, g) => k + g.codes.length, 0);
    const noms = divs.map((g) => g.d.l);
    return {
      id: `naf-${sec.c}`, nom: sec.l,
      compte: `${n ? `${n} codes APE · ` : ""}${divs.length} famille${divs.length > 1 ? "s" : ""}`,
      lignes: [esc(noms.slice(0, 3).join(" · ") + (noms.length > 3 ? " …" : ""))]
    };
  }))}
  <div id="liste-secteurs">
    ${V.sections.map((sec) => `
    <section class="categorie-naf" id="naf-${esc(sec.c)}" data-categorie data-groupe>
      <h2>${esc(sec.l)}</h2>
      ${(() => { const divs = groupes.filter((g) => g.d.s === sec.c); return divs.length > 1 ? `
      <nav class="dedans" aria-label="Ce qu'il y a dans ce secteur">
        <p class="etiq">Dans ce secteur</p>
        <ul>${divs.map((g) => `<li><a href="#naf-${esc(sec.c)}--${esc(g.d.c)}"><span>${esc(g.d.l)}</span>
          <span class="compte">${g.codes.length || 1}</span></a></li>`).join("")}</ul>
      </nav>` : ""; })()}
      ${groupes.filter((g) => g.d.s === sec.c).map((g) => {
      const mots = METIERS[g.d.c] || [];
      const adresse = `secteur/${esc(g.d.c)}-${slug(g.d.l)}.html`;
      const commun = [g.d.c, g.d.l, g.section ? g.section.l : "", ...mots].join(" ");
      return `
    <section class="grappe grappe-naf" id="naf-${esc(g.d.s)}--${esc(g.d.c)}" data-groupe>
      <h3 class="etiq">
        <span class="lettre">${esc(g.d.c)}</span>
        <a href="${adresse}">${esc(g.d.l)}</a>
        <span class="precision">${g.codes.length ? `${g.codes.length} code${g.codes.length > 1 ? "s" : ""} APE` : "division"}</span>
      </h3>
      <ul class="puces">
        ${(g.codes.length ? g.codes.map((c) => `<li data-recherche="${esc([c.c, c.c.replace(".", ""), c.l, commun].join(" "))}">
          <a href="${adresse}?ape=${esc(c.c.replace(".", ""))}" title="${esc(c.l)}">
            <span class="code">${esc(c.c)}</span><span class="nom">${esc(c.l)}</span></a></li>`)
          : [`<li data-recherche="${esc(commun)}">
          <a href="${adresse}" title="${esc(g.d.l)}">
            <span class="code">${esc(g.d.c)}</span><span class="nom">${esc(g.d.l)}</span></a></li>`]).join("\n")}
      </ul>
    </section>`; }).join("\n")}
    </section>`).join("\n")}
  </div>
  </div>
</div>
</section>`;

  return page({
    titre: `Trouvez votre code | ${SITE.nom}`,
    description: NAF
      ? `Les ${codes.length} codes APE et ce qui s'applique à chacun.`
      : "Les 88 divisions de la nomenclature NAF et leurs obligations.",
    racine: "../", zone: "app", actif: "secteurs", corps, verrou: true, formule: "textes"
  });
}

/* --- Une page par texte ---------------------------------------------------- */
/* Le but : lire ce que le texte exige sans quitter le site. Ces fiches ne
   reproduisent pas le texte officiel — il est sur Légifrance, lui seul fait
   foi et une copie se périme en silence. Elles disent ce qu'il exige, en
   français courant. Le lien vers la source reste, en second. */
function appTexte(V, TEXTES, METIERS, C, LIENS, ref, fiche, domaines) {
  const T = texteDuSite(C, ref);
  const L = lienDuTexte(C, LIENS, ref);
  /* Les actions de tous les domaines qui citent ce texte, sans doublon : c'est
     ce que le client doit faire le jour où il bouge. */
  const actions = [...new Set(domaines.flatMap((id) => V.domaines[id].actions || []))];
  const secteurs = V.divisions.filter((x) =>
    domaines.some((id) => perimetre(V, x.c).base.indexOf(id) !== -1));

  const corps = `<section class="tete-app">
  <div class="enveloppe">
    <ul class="jalons">
      <li><a href="../plan.html">Ma veille réglementaire</a></li>
      <li><span class="fort">Fiche de texte</span></li>
      <li><span>${esc(fiche.nature)}</span></li>
    </ul>
    <h1>${esc(ref)}</h1>
    ${fiche.porte ? `<p class="chapeau">${esc(fiche.porte)}</p>` : ""}
    <dl class="faits" style="margin-top:var(--t5)">
      <div><dt class="etiq">Nature</dt><dd>${esc(fiche.nature)}</dd></div>
      <div><dt class="etiq">Points à tenir</dt><dd><span class="grand">${fiche.exige.length}</span></dd></div>
      <div><dt class="etiq">Domaines concernés</dt><dd><span class="grand">${domaines.length}</span></dd></div>
      <div><dt class="etiq">Secteurs concernés</dt><dd><span class="grand">${secteurs.length}</span></dd></div>
      ${T ? `<div><dt class="etiq">Articles sur le site</dt><dd><span class="grand">${T.articles}</span></dd></div>` : ""}
    </dl>
  </div>
</section>

${rubrique({ etiq: "Ce que ce texte exige", contenu: `
  ${fiche.valide ? "" : `<p class="reserve" style="margin-bottom:var(--t4)">
    <strong>Premier jet, en attente de relecture.</strong>
    Cette fiche dit ce que le texte exige, en français courant. Elle n'a pas encore
    été relue par Clément Pierrel. Le texte officiel et à jour est sur la source
    citée plus bas : lui seul fait foi.</p>`}
  ${fiche.qui ? `<p class="lecture"><strong>À qui ça s'applique.</strong> ${esc(fiche.qui)}</p>` : ""}
  <ul class="exigences">
    ${fiche.exige.map((x) => `<li>${esc(x)}</li>`).join("\n")}
  </ul>
  ${actions.length ? `<p class="etiq" style="margin-top:var(--t5)">Ce qu'il faut faire quand ce texte bouge</p>
  <ul class="a-faire" style="margin-top:var(--t3)">
    ${actions.map((a) => `<li>${esc(a)}</li>`).join("")}
  </ul>` : ""}
  <p class="rangee" style="margin-top:var(--t5)">
    <a class="bouton bouton-accent" href="${esc(L.url)}" target="_blank" rel="noopener">
      ${esc(intituleDuLien(L))} ${sortant}</a>
    <button type="button" class="bouton bouton-sobre" data-imprimer>${imprimante} Enregistrer en PDF</button>
  </p>` })}

${rubrique({ etiq: "Où il s'applique", aplat: true, contenu: `
  <p class="lecture">Ce texte est rattaché à ${domaines.length} domaine${domaines.length > 1 ? "s" : ""}
  de veille et concerne ${secteurs.length} famille${secteurs.length > 1 ? "s" : ""} de métiers sur
  ${V.divisions.length}.</p>
  <ul class="puces" style="margin-top:var(--t4)">
    ${domaines.map((id) => `<li><a href="../plan.html">
      <span class="code">${esc((V.frequences[V.domaines[id].frequence] || {}).l || V.domaines[id].frequence)}</span>
      <span class="nom">${esc(V.domaines[id].nom)}</span></a></li>`).join("")}
  </ul>
  ${secteurs.length ? `<p class="etiq" style="margin-top:var(--t5)">Secteurs concernés</p>
  <ul class="puces" style="margin-top:var(--t3)">
    ${secteurs.slice(0, 24).map((x) => `<li><a href="../secteur/${esc(x.c)}-${slug(x.l)}.html" title="${esc(x.l)}">
      <span class="code">${esc(x.c)}</span><span class="nom">${esc(x.l)}</span></a></li>`).join("")}
  </ul>
  ${secteurs.length > 24 ? `<p class="note-source">… et ${secteurs.length - 24} autres.</p>` : ""}` : ""}` })}

${T && T.changements.length ? rubrique({ etiq: "Ce qui a changé", contenu: `
  <p class="lecture">Depuis la relève précédente, dans ce texte et rien d’autre. C’est
  une comparaison des deux versions mot à mot : l’avant, l’après.</p>
  <ul class="changements" style="margin-top:var(--t4)">${T.changements.map((c) => ligneChangement(c, "../code/")).join("")}</ul>` }) : ""}

${T ? rubrique({ etiq: "Le texte, mot pour mot", contenu: `
  <dl class="compteurs">
    <div><dt class="etiq">Articles</dt><dd><span class="grand">${T.articles}</span></dd></div>
    <div><dt class="etiq">Pages de texte</dt><dd><span class="grand">${T.morceaux.length}</span></dd></div>
    <div><dt class="etiq">Version du code</dt><dd>${esc(T.code.version ? dateFr(T.code.version) : "—")}</dd></div>
    <div><dt class="etiq">Relevé le</dt><dd>${esc(dateFr(C.preleve))}</dd></div>
  </dl>
  <p class="lecture" style="margin-top:var(--t4)">
    Le texte officiel du <strong>${esc(T.code.titre)}</strong>, consolidé, tel qu’il est
    en vigueur. Il est publié ici en entier : ${T.morceaux.length === 1
      ? "le voici, de bout en bout."
      : `${T.articles} articles, répartis en ${T.morceaux.length} pages pour rester lisibles.`}
    Rien à aller chercher ailleurs.
  </p>
  ${T.morceaux.length === 1
    ? `<ul class="articles" style="margin-top:var(--t5)">${T.morceaux[0].articles.map(articleDeLoi).join("")}</ul>`
    : `<p class="etiq" style="margin-top:var(--t5)">Les premiers articles</p>
       <ul class="articles" style="margin-top:var(--t3)">${T.morceaux[0].articles.slice(0, 3).map(articleDeLoi).join("")}</ul>
       <p class="etiq" style="margin-top:var(--t5)">La suite, chapitre par chapitre</p>
       <ul class="sommaire-code" style="margin-top:var(--t3)">
         ${T.morceaux.map((m) => `<li><a href="../code/${esc(m.id)}.html">
           <span class="nom">${esc(m.chemin[m.chemin.length - 1])}</span>
           <span class="precision">${esc(m.chemin.slice(-3, -1).join(" · "))} ·
             ${m.articles.length} article${m.articles.length > 1 ? "s" : ""}</span>
           <span class="code">${esc(m.articles[0].num)} → ${esc(m.articles[m.articles.length - 1].num)}</span></a></li>`).join("")}
       </ul>`}
  <p class="rangee" style="margin-top:var(--t5)">
    <button type="button" class="bouton bouton-sobre" data-imprimer>${imprimante} Enregistrer en PDF</button>
  </p>
  ${noteDeSource(C)}` }) : ""}

${rubrique({ etiq: T ? "Vérifier à la source" : "Lire le texte officiel", contenu: `
  <p class="lecture">${T
    ? `Le texte ci-dessus est relevé automatiquement sur la base officielle des codes
       consolidés et republié ici sous Licence Ouverte. En cas de doute ou de litige,
       c’est la version publiée par l’État qui fait foi : voici où la retrouver.`
    : `La fiche ci-dessus est notre lecture du texte. Son texte intégral n’est pas
       encore publié sur le site : la base consolidée que notre robot sait relever ne
       couvre aujourd’hui que ${C && C.codes.length
         ? C.codes.map((x) => esc(x.titre)).join(", ")
         : "quelques codes"}. Pour celui-ci, le texte officiel et à jour est publié
       par l’État — lui seul fait foi et c’est à lui qu’il faut se référer en cas de
       doute ou de litige.`}</p>
  <p class="rangee" style="margin-top:var(--t4)">
    <a class="bouton bouton-accent" href="${esc(L.url)}" target="_blank" rel="noopener">
      ${esc(intituleDuLien(L))} ${sortant}</a>
  </p>
  <p class="note-source">${L.direct
    ? `Lien direct vers le texte lui-même : ${esc(L.quoi)}, sur ${esc(L.ou)}.`
    : `Cette référence couvre plusieurs textes : le lien mène au recueil officiel qui les
       publie — ${esc(L.quoi)}, sur ${esc(L.ou)}.`}</p>
  <p class="etiq" style="margin-top:var(--t5)">Les sources qui suivent ce domaine</p>
  <ul class="sources-bande sources-bande-gauche" style="margin-top:var(--t3)">
    ${[...new Set(domaines.flatMap((id) => V.domaines[id].sources.map((s) => JSON.stringify(s))))]
      .map((s) => JSON.parse(s))
      .map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.nom)} ${sortant}</a></li>`)
      .join("")}
  </ul>` })}`;

  return page({
    titre: `${ref} | ${SITE.nom}`,
    description: `Ce qu'exige « ${ref} » : à qui ça s'applique, ce qu'il faut tenir et où lire le texte officiel.`,
    racine: "../../", zone: "app", actif: "textes", corps, verrou: true, formule: "textes"
  });
}

/* --- L'index des textes ----------------------------------------------------- */
function appTextes(V, TEXTES, parTexte, C, LIENS) {
  const refs = Object.keys(parTexte).sort((a, b) => a.localeCompare(b, "fr"));
  /* Un texte peut être cité par plusieurs domaines : on le range dans la
     catégorie du premier qui le cite et on nomme les autres sous son titre. */
  const entrees = refs.map((ref) => ({
    ref, id: parTexte[ref][0],
    domaine: parTexte[ref].map((id) => V.domaines[id].nom).join(" · ")
  }));
  const tableaux = tableauDeTextes(V, C, LIENS, TEXTES, entrees, "", true);
  const corps = `<section class="tete-app">
  <div class="enveloppe">
    <ul class="jalons">
      <li><span class="fort">Textes</span></li>
      <li><span>${refs.length} fiches</span></li>
    </ul>
    <h1>Tous les textes</h1>
    <p class="chapeau">
      Cliquez sur une catégorie pour voir les textes de cette catégorie, chacun avec ce
      qu'il exige et où le lire.
    </p>
    <div class="recherche" style="margin-top:var(--t5)">
      <label class="etiq" for="recherche-secteur">Ou tapez un mot</label>
      <input type="search" id="recherche-secteur" placeholder="amiante, RGPD, code du travail…"
             autocomplete="off" spellcheck="false">
      <p class="recherche-compte etiq"><span id="compte-secteurs">${refs.length} textes</span></p>
    </div>
  </div>
</section>

<section class="rubrique">
<div class="enveloppe" data-unite="textes">
  ${tableaux.cartes}
  ${aSavoir("À savoir sur ces fiches", `<p class="lecture">
    Chaque texte de référence a sa fiche : à qui il s'applique, ce qu'il exige et le
    texte officiel lui-même quand nous savons le relever.${C ? ` <strong>${Object.keys(C.perimetres).filter((r) => (C.perimetres[r] || []).length).length} fiches
    portent le texte intégral</strong>, soit ${C.morceaux.reduce((n, m) => n + m.articles.length, 0)}
    articles de code, relevés le ${esc(dateFr(C.preleve))}.` : ""}</p>
    ${tableaux.note}`)}
  <p id="aucun-secteur" class="etat-vide" hidden>Aucun texte ne correspond.</p>
  <div id="liste-secteurs">
    ${tableaux.tables}
  </div>
</div>
</section>`;

  return page({
    titre: `Tous les textes | ${SITE.nom}`,
    description: "Les textes de référence de la veille et ce que chacun exige.",
    racine: "../", zone: "app", actif: "textes", corps, verrou: true, formule: "textes"
  });
}

function appSecteur(V, PIEGES, METIERS, TEXTES, NAF, C, LIENS, d) {
  const apes = NAF ? NAF.codes.filter((c) => c.d === d.c) : [];
  const section = V.sections.filter((s) => s.c === d.s)[0];
  const mots = METIERS[d.c] || [];
  const { base, declencheurs, groupes } = perimetre(V, d.c);
  const p = PIEGES[d.c];
  const rythme = groupes.length ? groupes[0].f.l : "—";

  // Tous les textes de référence du périmètre, mis à plat : c'est ce qu'on
  // vient chercher sur une fiche de secteur et ça ne doit pas être derrière
  // un dépliant ni derrière un lien sortant.
  const textes = [];
  base.forEach((id) => {
    const dom = V.domaines[id];
    dom.textes.forEach((ref) => {
      textes.push({ ref, id, domaine: dom.nom, nature: (TEXTES[ref] || {}).nature || "Texte",
                    propre: V.transversaux.indexOf(id) === -1 });
    });
  });
  /* « Que les textes qui concernent » : ceux du métier d'abord, le socle
     commun à toute entreprise ensuite, replié. Les deux sont dans le
     périmètre — on ne cache rien, on met le plus utile devant. */
  const propres = textes.filter((t) => t.propre);
  const socle = textes.filter((t) => !t.propre);

  const corps = `<section class="tete-app">
  <div class="enveloppe">
    <ul class="jalons">
      <li><a href="../secteurs.html">Fiches par secteur</a></li>
      <li><span class="fort">Fiche ${esc(d.c)}</span></li>
      <li><span>Section ${esc(d.s)} — ${esc(section ? section.l : "")}</span></li>
    </ul>
    <h1>${esc(d.l)}</h1>
    ${apes.length ? `<p class="code-choisi" id="code-choisi" hidden>
      <span class="etiq">Votre code</span>
      <span class="code" id="code-choisi-code"></span>
      <span class="nom" id="code-choisi-nom"></span>
    </p>` : ""}
    ${mots.length ? `<p class="chapeau"><span class="etiq">On dit aussi</span>${esc(mots.join(" · "))}</p>` : ""}
    <dl class="faits" style="margin-top:var(--t5)">
      <div><dt class="etiq">Textes de référence</dt><dd><span class="grand">${textes.length}</span></dd></div>
      <div><dt class="etiq">Sujets à suivre</dt><dd><span class="grand" id="compte-domaines">${base.length}</span>
        <span class="precision" id="compte-precision">par le code APE seul ; vos situations, plus bas, peuvent en ajouter</span></dd></div>
      <div><dt class="etiq">À revoir le plus souvent</dt><dd>${esc(rythme)}</dd></div>
      <div><dt class="etiq">Questions de contexte</dt><dd><span class="grand">${declencheurs.length}</span></dd></div>
      ${apes.length ? `<div><dt class="etiq">Codes APE</dt><dd><span class="grand">${apes.length}</span></dd></div>` : ""}
    </dl>
  </div>
</section>

${rubrique({ etiq: "Les textes qui s'appliquent", contenu: `
  <p class="lecture">${propres.length
    ? `${propres.length} texte${propres.length > 1 ? "s" : ""} propre${propres.length > 1 ? "s" : ""} à ce métier et ${socle.length} du socle commun à toute entreprise. Les premiers d'abord : ce sont eux qui vous distinguent.`
    : `Ce secteur n'a pas de texte qui lui soit propre : ce qui s'y applique, c'est le socle commun à toute entreprise, ${socle.length} textes.`}
  Pour chacun, ce qu'il exige et où le lire — sans quitter la page.</p>

  ${propres.length ? `<p class="etiq" style="margin-top:var(--t5)">Propres à ce métier</p>
  ${listeDeTextes(V, C, LIENS, TEXTES, propres)}` : ""}

  ${socle.length ? `<details class="pliant" style="margin-top:var(--t5)">
    <summary>
      <span class="titre">Le socle commun — ${socle.length} textes</span>
      <span class="precision">Ce que toute entreprise tient, quel que soit son métier : travail, paie, données, fiscalité, environnement de base.</span>
      ${chevron}
    </summary>
    ${listeDeTextes(V, C, LIENS, TEXTES, socle)}
  </details>` : ""}` })}

${rubrique({ etiq: "Ce qu'il faut tenir, domaine par domaine", aplat: true, contenu: `
  <p class="lecture">Le socle commun à toute entreprise, plus ce qui tient à ce métier.
  Groupé par rythme de revue.</p>
  ${groupes.map((g) => `
  <div class="groupe-frequence" data-groupe-frequence="${esc(g.id)}">
    <div class="tete"><h3>${esc(g.f.l)}</h3><span class="etiq">${esc(g.f.d)}</span></div>
    ${g.base.map((id) => blocDomaine(C, LIENS, id, V.domaines[id], "base", "", "../")).join("\n")}
    ${g.ajout.map((id) => blocDomaine(C, LIENS, id, V.domaines[id], "declencheur", "", "../")).join("\n")}
  </div>`).join("\n")}` })}

${declencheurs.length ? rubrique({ etiq: "Contexte", aplat: true, contenu: `
  <p class="lecture">Cochez ce qui est vrai pour l'entreprise : les sujets qui vont avec
  s'ajoutent à la liste ci-dessus.</p>
  <ul class="questions" id="declencheurs" style="margin-top:var(--t4)">
    ${declencheurs.map((q) => `<li><label class="question">
      <input type="checkbox" data-domaines="${esc(q.domaines.join(" "))}">
      <span><span class="intitule">${esc(q.q)}</span><span class="aide">${esc(q.d)}</span></span>
    </label></li>`).join("\n")}
  </ul>` }) : ""}


${apes.length ? rubrique({ etiq: "Les codes APE de cette division", aplat: true, id: "codes-ape", contenu: `
  <details class="pliant" id="pliant-ape">
    <summary>
      <span class="titre">Voir les ${apes.length} codes APE de la division ${esc(d.c)}</span>
      <span class="precision">Les mêmes textes s'appliquent à tous : c'est à ce niveau que les obligations se ressemblent.</span>
      ${chevron}
    </summary>
    <ul class="puces codes-ape" style="margin-top:var(--t4)">
      ${apes.map((c) => `<li id="ape-${esc(c.c.replace(".", ""))}">
        <span class="code">${esc(c.c)}</span><span class="nom">${esc(c.l)}</span></li>`).join("")}
    </ul>
    <p class="note-source">${esc(NAF.source.nom)}, relevée le ${esc(dateFr(NAF.releve))}.</p>
  </details>` }) : ""}

${p ? rubrique({ etiq: "Le terrain", contenu: `
  ${p.valide ? "" : `<p class="reserve" style="margin-bottom:var(--t4)">
    <strong>Premier jet, en attente de relecture.</strong>
    Déduits des obligations du secteur, pas encore validés par Clément Pierrel.</p>`}
  <div class="pieges">
    ${p.pieges.map((x) => `<article class="piege"><h3>${esc(x.titre)}</h3><p>${esc(x.texte)}</p></article>`).join("\n")}
  </div>` }) : ""}`;

  return page({
    titre: `${d.l} (NAF ${d.c}) | ${SITE.nom}`,
    description: `Obligations réglementaires de la division NAF ${d.c}, ${d.l}.`,
    racine: "../../", zone: "app", actif: "secteurs", corps, verrou: true, formule: "textes",
    attrsBody: ` data-domaines-base="${base.length}"`
  });
}

/* --- Réglages : mon entreprise et mes alertes ------------------------------- */
/* Ce que le visiteur saisit ici ne part nulle part : c'est gardé dans son
   navigateur et c'est écrit sur la page. Le périmètre se recalcule dessus,
   exactement comme le simulateur de l'accueil — même données, même règle. */
function appReglages(V, D, NAF, METIERS) {
  const parSection = V.sections.map((s) => ({
    s, divisions: V.divisions.filter((d) => d.s === s.c)
  })).filter((g) => g.divisions.length);

  /* Réglages (3 novembre 2026, « plus professionnelle ») : des cartes par
     thème, une ligne par champ (intitulé à gauche, champ à droite), des
     onglets discrets et une barre d'enregistrement en bas. Les identifiants
     des champs ne changent pas : assets/entreprise.js les lit. */
  const ligne = (id, libelle, champ, aide = "", large = false) => `<div class="rg-ligne${large ? " rg-ligne-large" : ""}">
          <label class="rg-libelle" for="${id}">${libelle}</label>
          <div class="rg-champ">${champ}${aide}</div>
        </div>`;
  const corps = `<section class="tete-app tete-reglages">
  <div class="enveloppe">
    <h1>Réglages</h1>
    <p class="rg-chapeau">Les informations de votre entreprise et vos alertes.<span data-demo> En démonstration, elles restent dans ce navigateur.</span></p>
    <div class="rg-onglets" role="tablist" aria-label="Réglages" data-bascule>
      <button type="button" role="tab" id="onglet-entreprise" aria-selected="true" aria-controls="volet-entreprise">Mon entreprise</button>
      <button type="button" role="tab" id="onglet-alertes" aria-selected="false" aria-controls="volet-alertes" data-exige="suivi">Mes alertes</button>
    </div>
  </div>
</section>

<section class="rubrique rg-volet" id="volet-entreprise" role="tabpanel" aria-labelledby="onglet-entreprise">
  <div class="enveloppe">
    <form class="rg-form" id="form-entreprise" novalidate>
      <section class="rg-carte" aria-labelledby="rg-t-identite">
        <header class="rg-tete">
          <h2 id="rg-t-identite">Informations sur votre entreprise</h2>
          <p>Votre code APE détermine les sujets de votre veille réglementaire.</p>
        </header>
        ${ligne("e-nom", "Nom de l'entreprise", `<input type="text" id="e-nom" name="nom" placeholder="${esc(D.entreprise.nom)}" autocomplete="organization">`)}
        ${ligne("e-ville", "Commune", `<input type="text" id="e-ville" name="ville" placeholder="${esc(D.entreprise.ville)}" autocomplete="address-level2">`)}
        ${NAF ? ligne("e-activite", "Votre activité", `<input type="text" id="e-activite" name="activite" autocomplete="off" spellcheck="false"
                 placeholder="plomberie chauffage, boulangerie, transport de marchandises…">`,
          `<p class="rg-aide">Décrivez-la avec vos mots : nous retrouvons votre code APE.</p>
          <div class="propositions" id="e-propositions" hidden></div>`) : ""}
        ${ligne("e-naf", NAF ? "Code APE" : "Activité principale (NAF)", `<select id="e-naf" name="naf">
            ${NAF
              ? V.divisions.map((d) => {
                  const codes = NAF.codes.filter((c) => c.d === d.c);
                  if (!codes.length) return "";
                  const mots = METIERS[d.c] || [];
                  return `<optgroup label="${esc(d.c)} — ${esc(d.l)}" data-mots="${esc(mots.join(" "))}">
              ${codes.map((c) => `<option value="${esc(c.c)}"${c.d === D.entreprise.naf && c === codes[0] ? " selected" : ""}>${esc(c.c)} — ${esc(c.l)}</option>`).join("")}
            </optgroup>`; }).join("")
              : parSection.map((g) => `<optgroup label="${esc(g.s.c)} — ${esc(g.s.l)}">
              ${g.divisions.map((d) => `<option value="${esc(d.c)}"${d.c === D.entreprise.naf ? " selected" : ""}>${esc(d.c)} — ${esc(d.l)}</option>`).join("")}
            </optgroup>`).join("")}
          </select>`,
          NAF ? `<p class="rg-aide" id="e-division">Il figure sur votre avis de situation INSEE et sur vos bulletins de paie.</p>` : "")}
        ${ligne("e-effectif", "Effectif", `<input type="number" id="e-effectif" name="effectif" min="0" max="100000"
                 placeholder="${esc(D.entreprise.effectif)}" inputmode="numeric">`)}
        ${ligne("e-responsable", "Dirigeant", `<input type="text" id="e-responsable" name="responsable" placeholder="${esc(D.entreprise.responsable)}" autocomplete="name">`)}
      </section>

      <!-- Ces informations décrivent l'entreprise sur le plan ; elles ne
           changent pas la liste des sujets : ce sont les cases « vrai chez
           vous », plus bas, qui la font. On le dit. -->
      <section class="rg-carte" aria-labelledby="rg-t-chiffres">
        <header class="rg-tete">
          <h2 id="rg-t-chiffres">Votre entreprise en chiffres <span class="rg-facultatif">Facultatif</span></h2>
          <p>Ces informations complètent votre plan pour un audit. Elles ne changent pas les sujets suivis.</p>
        </header>
        ${ligne("e-ca", "Chiffre d'affaires de l'an dernier", `<select id="e-ca" data-champ="ca">
            <option value="">Non communiqué</option>
            ${["Moins de 100 000 €", "100 000 à 500 000 €", "500 000 € à 2 M€",
               "2 à 10 M€", "10 à 50 M€", "Plus de 50 M€"]
              .map((t) => `<option>${esc(t)}</option>`).join("")}
          </select>`)}
        ${ligne("e-forme", "Forme juridique", `<select id="e-forme" data-champ="forme">
            <option value="">Non renseignée</option>
            ${["Entreprise individuelle ou micro-entreprise", "EURL", "SARL", "SASU", "SAS", "SA",
               "SCOP", "Association", "Autre"].map((t) => `<option>${esc(t)}</option>`).join("")}
          </select>`)}
        ${ligne("e-creation", "Année de création", `<input type="number" id="e-creation" data-champ="creation" min="1800" max="2100"
                 placeholder="2008" inputmode="numeric">`)}
        ${ligne("e-sites", "Nombre d'établissements", `<input type="number" id="e-sites" data-champ="sites" min="1" max="10000"
                 placeholder="1" inputmode="numeric">`)}
        ${ligne("e-siret", "Numéro SIRET", `<input type="text" id="e-siret" data-champ="siret" inputmode="numeric" autocomplete="off"
                 placeholder="14 chiffres" maxlength="20">`, `<p class="rg-aide" id="e-siret-aide"></p>`)}
        <div class="rg-ligne">
          <span class="rg-libelle">Certifications obtenues ou visées</span>
          <div class="rg-champ certifs">
            ${["ISO 9001", "ISO 14001", "ISO 45001", "ISO 50001", "ISO 22000", "ISO/IEC 27001", "ISO 13485", "MASE", "Qualiopi"].map((c) => `<label class="certif">
              <input type="checkbox" data-certif="${esc(c)}"><span>${esc(c)}</span></label>`).join("")}
          </div>
        </div>
      </section>

      <section class="rg-carte" aria-labelledby="rg-t-situations">
        <header class="rg-tete">
          <h2 id="rg-t-situations">Vos activités particulières</h2>
          <p>Cochez ce qui s'applique à votre entreprise : chaque case ajoute les sujets correspondants à votre veille.</p>
        </header>
        <div class="rg-cases cases cases-ouvertes" id="e-contexte"></div>
      </section>

      <div class="rg-barre">
        <p class="rg-etat" id="e-etat" role="status"></p>
        <button type="button" class="bouton bouton-sobre" id="e-reinit" data-demo>Revenir à l'exemple</button>
        <button type="submit" class="bouton bouton-accent">Enregistrer</button>
      </div>
    </form>
  </div>
</section>

<section class="rubrique rg-volet" id="volet-alertes" role="tabpanel" aria-labelledby="onglet-alertes" hidden>
  <div class="enveloppe">
    <p class="rg-note"><strong>Les courriels ne sont pas encore envoyés.</strong> Vos préférences sont enregistrées
      pour la mise en service de l'envoi ; l'aperçu montre ce que vous recevrez.</p>
    <div class="rg-alertes">
      <form class="rg-form" id="form-alertes" novalidate>
        <section class="rg-carte" aria-labelledby="rg-t-alertes">
          <header class="rg-tete">
            <h2 id="rg-t-alertes">Alertes par courriel</h2>
            <p>Choisissez l'adresse, le rythme et les textes qui vous sont signalés.</p>
          </header>
          ${ligne("a-courriel", "Adresse électronique", `<input type="email" id="a-courriel" name="courriel" placeholder="prenom@entreprise.fr"
                 inputmode="email" spellcheck="false" autocomplete="email">`)}
          ${ligne("a-rythme", "Fréquence", `<select id="a-rythme" name="rythme">
            <option value="immediat">À chaque nouveau texte</option>
            <option value="quotidien">Un résumé par jour</option>
            <option value="hebdomadaire" selected>Un résumé par semaine</option>
            <option value="mensuel">Un résumé par mois</option>
          </select>`)}
          ${ligne("a-seuil", "Textes signalés", `<select id="a-seuil" name="seuil">
            <option value="tout" selected>Tous ceux qui me concernent</option>
            <option value="prioritaire">Seulement les plus importants</option>
            <option value="action">Seulement ceux qui demandent une action</option>
          </select>`)}
          <div class="rg-ligne">
            <span class="rg-libelle">Options</span>
            <div class="rg-champ cases cases-ouvertes">
              <label class="case">
                <input type="checkbox" id="a-revues" checked>
                <span><span class="intitule">Rappel des revues à faire</span>
                <span class="aide">Avant chaque échéance de revue et une seconde fois si elle est dépassée.</span></span>
              </label>
              <label class="case">
                <input type="checkbox" id="a-pdf" checked>
                <span><span class="intitule">Fiche de chaque texte en pièce jointe</span>
                <span class="aide">Au format PDF, prête à classer.</span></span>
              </label>
            </div>
          </div>
        </section>
        <div class="rg-barre">
          <p class="rg-etat" id="a-etat" role="status"></p>
          <button type="submit" class="bouton bouton-accent">Enregistrer</button>
        </div>
      </form>

      <aside class="rg-carte rg-apercu" aria-labelledby="rg-t-apercu">
        <header class="rg-tete">
          <h2 id="rg-t-apercu">Aperçu du courriel</h2>
          <p>Avec les réglages choisis.</p>
        </header>
        <div class="apercu-courriel" id="a-apercu"></div>
      </aside>
    </div>
  </div>
</section>`;

  return page({
    titre: `Réglages | ${SITE.nom}`,
    description: "Mon entreprise et mes alertes.",
    racine: "../", zone: "app", actif: "reglages", corps, verrou: true,
    formule: "textes", donneesPlan: true, attrsBody: ' data-page="reglages"'
  });
}

/* ==========================================================================
   Le site public
   ========================================================================== */

/* Un écran de l'application dans une maquette d'ordinateur portable.
   Deux fichiers quand ils existent : la capture claire et la capture sombre.
   Celle qui ne correspond pas au thème est en display:none et un navigateur
   ne télécharge pas une image lazy qui n'est pas affichée. */
/* Une capture ressemble à l'application : on clique dessus et rien ne se
   passait. Elle s'agrandit maintenant, en plein écran (app.js). Le bouton
   couvre tout l'écran dessiné ; sans JavaScript il n'est pas montré. */
function agrandir(alt) {
  return `<button type="button" class="agrandir" aria-label="Agrandir la capture : ${esc(alt)}"></button>`;
}

function portable(ECRANS, nom, alt) {
  if (!ECRANS.includes(nom)) {
    return `<p class="ecran-absent etiq">Capture manquante : ${esc(nom)} — lancer outils/captures.mjs</p>`;
  }
  const sombre = nom.replace(".png", "-sombre.png");
  const img = (f, classe) => `<img class="${classe}" src="assets/ecrans/${esc(f)}" alt="${esc(alt)}"
         loading="lazy" decoding="async" width="1280" height="860">`;
  /* Le capot et le socle sont deux éléments à part : chacun porte ses propres
     détails — l'encoche et le reflet pour l'un, la charnière et l'échancrure
     d'ouverture pour l'autre — et deux pseudo-éléments n'y auraient pas
     suffi. Rien n'est une photographie : c'est un boîtier dessiné, qui tient
     l'écran sans lui voler la vedette. */
  return `<figure class="portable" style="margin:0">
         ${agrandir(alt)}
         <span class="capot"><span class="dalle">
           ${img(nom, "ecran-clair")}
           ${ECRANS.includes(sombre) ? img(sombre, "ecran-sombre") : ""}
         </span></span>
         <span class="socle"></span>
       </figure>`;
}

function mobile(ECRANS, nom, alt) {
  if (!ECRANS.includes(nom)) return "";
  const sombre = nom.replace(".png", "-sombre.png");
  const img = (f, classe) => `<img class="${classe}" src="assets/ecrans/${esc(f)}" alt="${esc(alt)}"
         loading="lazy" decoding="async" width="390" height="844">`;
  /* Deux coques l'une dans l'autre : la tranche claire au-dehors, le cadre
     noir au-dedans. C'est ce qui fait reconnaître un téléphone d'aujourd'hui,
     plus encore que l'arrondi. */
  return `<figure class="mobile" style="margin:0">
         ${agrandir(alt)}
         <span class="chassis">
           ${img(nom, "ecran-clair")}
           ${ECRANS.includes(sombre) ? img(sombre, "ecran-sombre") : ""}
         </span>
       </figure>`;
}

/* À côté d'une capture : le texte, puis un bouton qui mène à une page à part.
   « En savoir plus sur le site » ne déplie plus rien sur l'accueil : il ouvre
   le-site.html, où il n'y a que ça (de même pour nous.html). L'accueil reste
   court et la page d'à côté se lit d'un bout à l'autre. */
function vitrine(ECRANS, { image, alt, titre, texte, bouton = "", lien = "" }) {
  return `<article class="vitrine" data-paraitre>
  ${portable(ECRANS, image, alt)}
  <div class="vitrine-texte">
    <h2>${titre}</h2>
    <p>${texte}</p>
    ${lien ? `<p class="rangee"><a class="bouton bouton-accent" href="${esc(lien)}">${esc(bouton)}</a></p>` : ""}
  </div>
</article>`;
}

/* Les encarts des deux pages « En savoir plus ». Chaque chiffre vient des
   données du dépôt. */
function encartsDuSite(V, C, NAF, SOURCES) {
  const confirmees = SOURCES.filter((x) => x.confirme && x.officielle !== false);   // les officielles seulement
  const nArticles = C ? C.morceaux.reduce((n, m) => n + m.articles.length, 0) : 0;
  return [
    { titre: "Nos sources", lignes: [
      `Relevés <strong>toutes les heures</strong>, automatiquement, sans que vous ayez rien à faire`,
      `Sur <strong>${confirmees.length} sources officielles</strong> vérifiées, Journal officiel en tête : ${esc(
        [...new Set(confirmees.map((x) => x.nom.split(" — ")[0]))].slice(1, 7).join(", "))}…`,
      C ? `${C.codes.length} codes relus chaque jour, article par article (${esc(C.codes.map((c) => c.titre).join(", "))}) — ${nArticles.toLocaleString("fr-FR")} articles en tout`
        : `Les codes consolidés, relus chaque jour`,
      `Chaque texte garde sa source et le lien direct vers l'original : c'est la source qui fait foi`
    ] },
    { titre: "Ce que vous voyez pour chaque texte", lignes: [
      `<strong>Ce que vous devez faire</strong>, en premier, en liste et en français courant`,
      `Le <strong>texte entier</strong>, tel que publié, à côté de sa source — pas un résumé`,
      `Sa date de parution et la marque « Nouveau » tant que vous ne l'avez pas lu`,
      `Un bouton <strong>Fait</strong> qui garde la date où vous l'avez traité`
    ] },
    { titre: "Seulement ce qui vous concerne", lignes: [
      `${NAF ? `${NAF.codes.length} codes APE, rangés en ${V.divisions.length} familles de métiers` : `${V.divisions.length} familles de métiers`} : vous choisissez le vôtre, le reste disparaît`,
      `${Object.keys(V.domaines).length} sujets à suivre, rangés en cinq familles : santé et sécurité, hygiène, social, environnement, métier et gestion`,
      `${V.declencheurs.length} questions simples (salariés, chantiers, produits chimiques…) ajoutent ce qui vient de votre façon de travailler`,
      `Chaque sujet a son rythme de revue : chaque semaine, chaque mois ou chaque trimestre`
    ] },
    { titre: "Ce que vous gardez", lignes: [
      `Un <strong>registre</strong> daté de chaque revue, décision et action, prêt pour l'auditeur`,
      `Chaque fiche s'enregistre en PDF et s'imprime telle quelle`,
      `L'application s'installe sur le téléphone et s'ouvre même sans réseau`,
      `Vos réglages et votre registre sont gardés dans votre compte : vous les retrouvez sur tous vos appareils`
    ] }
  ];
}

function encartsDeNous() {
  return [
    { titre: "Le produit", lignes: [
      `<strong>${esc(SITE.nom)}</strong>, la veille réglementaire par métier, pour les PME`,
      `Uniquement des sources officielles : Journal officiel, Légifrance, EUR-Lex et sites publics`,
      `Édité par ${esc(SITE.societe)}${SITE.editeur.denomination ? "" : ", société en cours de création"}`,
      `Joignable ${aTel() ? `au ${lienTel()} et ` : ""}à <a href="mailto:${esc(SITE.courriel)}">${esc(SITE.courriel)}</a>`
    ] },
    { titre: "Conçu sur le terrain", lignes: [
      `Avec <strong>${esc(SITE.concepteur)}</strong>, consultant QSE et HSE en exercice`,
      `La méthode vient de sa pratique : les sujets par métier, leur rythme de revue, les gestes à faire`,
      `Une fiche qu'il n'a pas encore relue le dit, en tête : « premier jet »`,
      `Un interlocuteur unique, joignable directement ${parQuoi()}`
    ] },
    { titre: "Ce qu'on fait pour vous", lignes: [
      ...Object.values(FORMULES).map((f) => { const o = f.ouvre.replace(/^En plus : /, "en plus, ").replace(/\.$/, "");
        return `<strong>${esc(f.l)}</strong> (${esc(f.prixAn)} ou ${esc(f.prix)}) : ${esc(o.charAt(0).toLowerCase() + o.slice(1))}`; }),
      `L'année au prix de dix mois. Prix affichés sur la <a href="abonnement.html">page des tarifs</a>, sans devis`
    ] },
    { titre: `Les audits que ${esc(SITE.nom)} prépare`, lignes: [
      `<strong>ISO 14001</strong> (environnement) et <strong>ISO 45001</strong> (santé et sécurité)`,
      `<strong>MASE</strong>, pour les entreprises qui interviennent chez des industriels`,
      `<strong>Qualiopi</strong>, pour les organismes de formation`,
      `On vous aide à tenir et à montrer votre veille ; la décision reste à l'auditeur`
    ] }
  ];
}

/* Une page « En savoir plus » : le titre, une phrase, les quatre encarts en
   deux et deux et de quoi continuer. Rien d'autre. */
function pageInfos({ titre, h1, sous, encarts, suite }) {
  const corps = `
<section class="heros heros-court">
  <div class="enveloppe">
    <div class="heros-texte"><h1>${esc(h1)}</h1></div>
    <p class="heros-sous">${sous}</p>
  </div>
</section>

<section class="section">
  <div class="enveloppe">
    <div class="infos-encarts infos-page">
      ${encarts.map((e) => `<section class="info-encart">
        <h2>${esc(e.titre)}</h2>
        <ul>${e.lignes.map((l) => `<li>${l}</li>`).join("")}</ul>
      </section>`).join("")}
    </div>
    <p class="rangee rangee-centre" style="margin-top:var(--t6)">${suite}</p>
  </div>
</section>`;
  return page({ titre: `${titre} | ${SITE.nom}`, description: sous.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&"), zone: "public", corps });
}

/* La page de vente pour les consultants QSE. Elle n'est écrite que si
   SITE.offreConsultant est allumé (après le choix du nom du produit). */
/* Le tableau de bord consultant, dessiné (4 novembre 2026) : le même que
   l'espace consultant — par société, les textes non lus, la conformité
   réglementaire et l'avancement du plan d'actions. Des sociétés sans nom
   (« Entreprise A »…) et des chiffres d'exemple : c'est une illustration,
   pas une capture et la légende le dit. */
function dessinVueConsultant() {
  // [nom, non lus, conformité %, actions %, en retard]
  const clients = [
    ["Entreprise A", 12, 68, 75, true], ["Entreprise B", 0, 92, 100, false],
    ["Entreprise C", 31, 40, 50, true], ["Entreprise D", 4, 85, 90, false],
    ["Entreprise E", 18, 55, 60, false]
  ];
  const barre = (x, y, w, pct, retard) => `<rect class="d-piste" x="${x}" y="${y}" width="${w}" height="8" rx="4"/>
    <rect class="${retard ? "d-barre-retard" : "d-barre"}" x="${x}" y="${y}" width="${Math.max(4, w * pct / 100)}" height="8" rx="4"/>`;
  const large = `<svg class="dessin" viewBox="0 0 640 400" role="img"
    aria-label="Illustration du tableau de bord consultant : pour chaque société, les textes non lus, le pourcentage de conformité réglementaire et l'avancement du plan d'actions.">
    <rect class="d-carte" x="8" y="8" width="624" height="384" rx="18"/>
    <text class="d-titre" x="32" y="48">Tableau de bord de vos clients</text>
    <text class="d-petit" x="608" y="48" text-anchor="end">5 sociétés</text>
    <text class="d-petit" x="32" y="88">Société</text>
    <text class="d-petit" x="196" y="88">Non lus</text>
    <text class="d-petit" x="290" y="88">Conformité</text>
    <text class="d-petit" x="460" y="88">Plan d'actions</text>
    ${clients.map(([n, nl, cf, ac, rt], k) => { const y = 100 + k * 56; return `<line class="d-repere" x1="32" x2="608" y1="${y}" y2="${y}"/>
    <text class="d-titre" x="32" y="${y + 34}">${n}</text>
    <text class="${nl ? "d-chiffre-accent" : "d-chiffre"}" x="196" y="${y + 34}">${nl}</text>
    ${barre(290, y + 24, 100, cf, false)}<text class="d-petit" x="400" y="${y + 33}">${cf} %</text>
    ${barre(460, y + 24, 100, ac, rt)}<text class="d-petit" x="570" y="${y + 33}">${ac} %</text>`; }).join("")}
  </svg>`;
  const etroit = `<svg class="dessin" viewBox="0 0 340 470" role="img"
    aria-label="Illustration du tableau de bord consultant sur téléphone : par société, textes non lus, conformité et plan d'actions.">
    <rect class="d-carte" x="6" y="6" width="328" height="458" rx="16"/>
    <text class="d-titre" x="22" y="40">Tableau de bord de vos clients</text>
    ${clients.slice(0, 4).map(([n, nl, cf, ac, rt], k) => { const y = 58 + k * 100; return `<line class="d-repere" x1="22" x2="318" y1="${y}" y2="${y}"/>
    <text class="d-titre" x="22" y="${y + 26}">${n}</text>
    <text class="d-petit" x="318" y="${y + 26}" text-anchor="end">${nl} non lus</text>
    <text class="d-petit" x="22" y="${y + 52}">Conformité</text>${barre(130, y + 44, 130, cf, false)}<text class="d-petit" x="318" y="${y + 52}" text-anchor="end">${cf} %</text>
    <text class="d-petit" x="22" y="${y + 78}">Actions</text>${barre(130, y + 70, 130, ac, rt)}<text class="d-petit" x="318" y="${y + 78}" text-anchor="end">${ac} %</text>`; }).join("")}
  </svg>`;
  return `<figure class="dessin-cadre"><div class="dessin-large">${large}</div><div class="dessin-etroit">${etroit}</div>
    <figcaption>Illustration du tableau de bord consultant (chiffres d'exemple).</figcaption></figure>`;
}

/* Le calcul de marge : servi tout fait pour 10 clients (lisible sans
   JavaScript), puis recalculé par la page quand le curseur bouge
   (assets/app.js, calculMarge()). */
function calculMarge(O, direct, n) {
  const p = O.paliers.find((x) => n >= x.de && (!x.a || n <= x.a)) || O.paliers[0];
  return { p, paye: p.mois * n, public: direct.mois * n, marge: (direct.mois - p.mois) * n };
}

function pageConsultants() {
  const O = OFFRE_CONSULTANT, direct = FORMULES[O.equivalent];
  const palier = O.paliers[1];                         // le palier de 6 à 15 clients
  const marge = direct.mois - palier.mois;
  const exemple = 10;
  const corps = `
<section class="heros heros-court">
  <div class="enveloppe">
    <div class="heros-texte"><h1>Livrez la veille réglementaire à vos clients, sous votre marque</h1></div>
    <p class="heros-sous">Vous accompagnez des PME. ${esc(SITE.nom)} réglementaire est un outil pour vous aider.</p>
    <p class="rangee rangee-centre">
      <a class="bouton bouton-accent" href="compte/creer.html?type=cabinet">Créer mon compte consultant</a>
      <a class="bouton bouton-sobre" href="demo/cabinet.html">Voir la démonstration</a>
      <a class="bouton bouton-sobre" href="abonnement.html#consultants">Nos offres consultant</a>
    </p>
  </div>
</section>

<section class="section">
  <div class="enveloppe deux-temps">
    <div>
      <h2>La veille réglementaire de tous vos clients centralisée</h2>
      <p class="lecture">Vous pilotez vos clients et disposez de l'avancement de leurs actions.</p>
    </div>
    ${dessinVueConsultant()}
  </div>
</section>

<section class="section section-tein">
  <div class="enveloppe">
    <h2 class="titre-section">Comment ça se passe</h2>
    <ol class="etapes etapes-trois">
      ${[
        ["Vous équipez vos clients", "Pour chacun, vous ouvrez un espace : son métier, ses réponses à quelques questions. Sa veille se fait dessus, aussitôt."],
        ["Ils voient votre marque", `Dès ${O.paliers.find((p) => p.blanche).de} clients, l'interface et les exports porteront votre logo et votre nom (en préparation). Vous facturez vos clients à votre prix.`],
        ["Vous suivez tout", "Votre vue liste vos clients et ce qui est en retard chez chacun. Le registre de chaque client est prêt pour son audit."]
      ].map(([t, d], k) => `<li class="etape">
        <span class="etape-num">${k + 1}</span>
        <h3>${esc(t)}</h3>
        <p>${esc(d)}</p>
      </li>`).join("")}
    </ol>
  </div>
</section>

<section class="section">
  <div class="enveloppe">
    <h2 class="titre-section">Ce que vous y gagnez</h2>
    <ul class="raisons">
      <li class="raison" data-paraitre>
        <span class="numero" aria-hidden="true">1</span>
        <h3>Votre marque, pas la nôtre</h3>
        <p>À partir de ${O.paliers.find((p) => p.blanche).de} clients, l'espace de vos clients et leurs exports PDF porteront
        votre logo, votre nom et vos couleurs : pour eux, ce sera votre outil. La marque blanche est en préparation.</p>
      </li>
      <li class="raison" data-paraitre>
        <span class="numero" aria-hidden="true">2</span>
        <h3>Des heures gagnées, chaque mois, par client</h3>
        <p>Le relevé des textes, le tri par métier, le rythme de revue de chaque sujet et le registre daté sont tenus
        pour vous. Votre temps va à ce qui se facture : l'analyse et l'accompagnement.</p>
      </li>
      <li class="raison" data-paraitre>
        <span class="numero" aria-hidden="true">3</span>
        <h3>Un revenu récurrent</h3>
        <p>Chaque client équipé est une ligne mensuelle de plus sur votre facture, à votre prix. Vous l'achetez
        ${esc(eur(palier.mois))} ; en direct, votre client paierait ${esc(eur(direct.mois))}.</p>
      </li>
      <li class="raison" data-paraitre>
        <span class="numero" aria-hidden="true">4</span>
        <h3>Une vue sur tous vos clients</h3>
        <p>Un seul espace pour voir vos clients et ce qui est en retard chez chacun : les revues à faire, les textes
        à analyser, les actions ouvertes.</p>
      </li>
    </ul>
  </div>
</section>

<section class="section section-tein">
  <div class="enveloppe">
    <h2 class="titre-section">Vos clients restent les vôtres</h2>
    <div class="deux-colonnes">
      <p class="reserve"><strong>Nous ne démarchons pas vos clients.</strong> Ils vous appartiennent : nous ne les
        contactons pas et ne leur vendons rien en direct. Nous nous y engageons par écrit, dans le contrat consultant.</p>
      <p class="reserve"><strong>Leurs données ne sont qu'à eux et à vous.</strong> Chaque entreprise est isolée dans la
        base : elle ne verra que ses données et vous, que celles de vos clients.</p>
    </div>
    <p class="note-source" style="text-align:center;margin-top:var(--t4)">L'espace consultant est ouvert : votre cabinet,
      la liste de vos clients, leur espace. La marque blanche (votre logo, vos couleurs) arrive ensuite. Le paiement en
      ligne aussi : d'ici là, nous ouvrons votre abonnement sur simple demande.</p>
    <p class="rangee rangee-centre" style="margin-top:var(--t4)">
      <a class="bouton bouton-accent" href="compte/creer.html?type=cabinet">Créer mon compte consultant</a>
      <a class="bouton bouton-sobre" href="demo/cabinet.html">Voir la démonstration</a>
      <a class="bouton bouton-sobre" href="mailto:${esc(SITE.courriel)}?subject=${encodeURIComponent("Offre consultant")}">En parler</a>
    </p>
  </div>
</section>`;
  return page({
    titre: `Offre consultant QSE | ${SITE.nom}`,
    description: "Livrez la veille réglementaire à vos clients sous votre marque : prix par client, dégressif, marque blanche dès 6 clients.",
    zone: "public", corps
  });
}

/* Tous les métiers, rangés par grand secteur d'activité. Un clic choisit le
   métier dans l'outil de l'accueil, qui dit tout de suite ce qui s'applique. */
function pageMetiers(V, NAF) {
  const groupes = V.sections.map((s) => ({ s, divisions: V.divisions.filter((d) => d.s === s.c) }))
    .filter((g) => g.divisions.length);
  const corps = `
<section class="heros heros-court">
  <div class="enveloppe">
    <div class="heros-texte"><h1>Tous les métiers couverts</h1></div>
    <p class="heros-sous">${NAF ? `Les ${NAF.codes.length} codes APE de la nomenclature officielle, rangés en
      ${V.divisions.length} familles de métiers` : `Les ${V.divisions.length} familles de métiers de la nomenclature officielle`}. Cliquez sur la vôtre : vous voyez tout de suite ce qui s'applique chez vous.
      Votre code APE (par exemple 43.21A) commence par le numéro de votre famille.</p>
  </div>
</section>

<section class="section">
  <div class="enveloppe">
    ${groupes.map((g) => `<section class="groupe-metiers">
      <h2><span class="lettre">${esc(g.s.c)}</span> ${esc(g.s.l)}</h2>
      <ul class="puces">
        ${g.divisions.map((d) => `<li><a href="index.html?q=${esc(d.c)}#simulateur" title="Voir ce qui s'applique : ${esc(d.l)}">
          <span class="code">${esc(d.c)}</span><span class="nom">${esc(d.l)}</span></a></li>`).join("")}
      </ul>
    </section>`).join("\n")}
  </div>
</section>`;
  return page({
    titre: `Tous les métiers couverts | ${SITE.nom}`,
    description: `${NAF ? `Les ${NAF.codes.length} codes APE couverts par la veille, rangés en ${V.divisions.length} familles de métiers` : `Les ${V.divisions.length} familles de métiers couvertes par la veille`}, par secteur d'activité.`,
    zone: "public", corps
  });
}

function questionsSimulateur(declencheurs) {
  return declencheurs.map((q) => `<label class="case">
  <input type="checkbox" data-domaines="${esc(q.domaines.join(" "))}">
  <span><span class="intitule">${esc(q.q)}</span><span class="aide">${esc(q.d)}</span></span>
</label>`).join("\n");
}

/* --- La barre des avis ---------------------------------------------------
   Une bande qui défile sous le héros, avec « Laisser votre avis » à côté. On
   n'y met que de vrais avis (contenu/temoignages.js), publiés avec l'accord
   de leur auteur ; tant qu'il n'y en a pas, elle le dit et invite à laisser le
   sien. Le bouton ouvre un petit formulaire qui prépare un courriel : sans
   serveur, c'est la seule façon honnête de recevoir un avis. Sans JavaScript,
   le bouton ouvre directement la messagerie. La piste est écrite deux fois
   pour boucler sans à-coup ; la copie est cachée aux lecteurs d'écran. */
function bandeAvis(AVIS) {
  /* Pas encore d'avis : pas de section du tout. Des emplacements vides
     « Laissez votre avis » inquiètent plus qu'ils ne rassurent. Elle revient
     d'elle-même au premier avis ajouté dans contenu/temoignages.js. */
  if (!AVIS.length) return "";
  const etoiles = (n) => `<span class="etoiles" aria-label="${n} sur 5">${"★".repeat(n)}${"☆".repeat(5 - n)}</span>`;
  /* « Laisser votre avis » est écrit dans la bande elle-même et revient
     entre les avis : c'est ce qui défile en premier. */
  const appel = `<li class="avis-item avis-appel"><span class="bulle" aria-hidden="true">✎</span> <strong>Laisser votre avis</strong></li>`;
  const items = AVIS.length
    ? AVIS.flatMap((a, k) => [`<li class="avis-item">${a.note ? etoiles(a.note) : ""}
        <q>${esc(a.texte)}</q>
        <span class="avis-qui">— ${esc([a.nom, a.entreprise, a.ville].filter(Boolean).join(", "))}</span></li>`]
        .concat(k % 3 === 2 || k === AVIS.length - 1 ? [appel] : []))
    : [];
  const piste = (cache) => `<ul class="defile-piste"${cache ? ' aria-hidden="true"' : ""}>${items.join("")}</ul>`;
  const sujet = encodeURIComponent(`Mon avis sur ${SITE.nom}`);
  return `<section class="bande-avis" aria-labelledby="titre-avis">
  <div class="enveloppe bande-avis-interieur">
    <h2 class="bande-avis-titre" id="titre-avis">${sigle}<span>Avis clients</span></h2>
    <a class="defile" href="mailto:${esc(SITE.courriel)}?subject=${sujet}" data-avis>
      <div class="defile-rail" style="--duree:${Math.max(30, items.join("").replace(/<[^>]+>/g, "").length / 5).toFixed(0)}s">${piste(false)}${piste(true)}</div>
    </a>
    <a class="bouton bouton-accent bouton-avis" href="mailto:${esc(SITE.courriel)}?subject=${sujet}" data-avis>Laisser votre avis</a>
  </div>
</section>

<dialog class="fenetre-avis" id="fenetre-avis" aria-labelledby="titre-fenetre-avis">
  <form class="formulaire-avis" id="formulaire-avis" method="dialog" novalidate>
    <div class="fenetre-tete">
      <h2 id="titre-fenetre-avis">Laisser votre avis</h2>
      <button type="button" class="zoom-fermer" data-fermer>Fermer ✕</button>
    </div>
    <p class="aide-avis">Votre messagerie s'ouvre avec l'avis déjà écrit : il ne reste qu'à
      l'envoyer. Il arrive à ${esc(SITE.courriel)} et n'est publié qu'avec votre accord.</p>
    <fieldset class="note-avis">
      <legend>Votre note</legend>
      <div class="note-choix">
        ${[5, 4, 3, 2, 1].map((n) => `<label><input type="radio" name="note" value="${n}"${n === 5 ? " checked" : ""}>
          <span>${"★".repeat(n)}<span class="cache-visuellement"> ${n} sur 5</span></span></label>`).join("")}
      </div>
    </fieldset>
    <div class="champs-avis">
      <label>Votre nom <span class="aide">prénom et initiale</span>
        <input type="text" name="nom" autocomplete="name" required maxlength="80"></label>
      <label>Votre entreprise <span class="aide">facultatif</span>
        <input type="text" name="entreprise" autocomplete="organization" maxlength="100"></label>
      <label>Votre ville <span class="aide">facultatif</span>
        <input type="text" name="ville" autocomplete="address-level2" maxlength="60"></label>
    </div>
    <label class="champ-texte-avis">Votre avis
      <textarea name="texte" rows="5" required maxlength="1200"></textarea></label>
    <label class="accord-avis"><input type="checkbox" name="accord" required>
      <span>J'accepte que cet avis soit publié sur ce site, avec mon nom tel que je l'ai écrit.</span></label>
    <p class="erreur-avis" id="erreur-avis" role="alert" hidden></p>
    <p class="rangee">
      <button type="submit" class="bouton bouton-accent">Préparer le courriel</button>
    </p>
    <p class="merci-avis" id="merci-avis" role="status" hidden>Merci ! Votre messagerie devrait
      s'ouvrir avec votre avis. Si rien ne s'ouvre, écrivez-nous simplement à
      <a href="mailto:${esc(SITE.courriel)}?subject=${sujet}">${esc(SITE.courriel)}</a>.</p>
  </form>
</dialog>`;
}

/* Les douze secteurs montrés sur l'accueil : ceux qu'un cabinet d'Istres
   rencontre le plus. L'index des 88 est dans l'application. */
const VITRINE_SECTEURS = ["43", "41", "10", "56", "47", "49", "52", "20", "25", "81", "86", "85"];

/* --- La dernière collecte -----------------------------------------------------
   « Le client voit que ça tourne et si ça n'a pas tourné, il le voit aussi. »
   L'heure vient de la dernière exécution RÉUSSIE du robot de relève, que la
   publication lit chez GitHub (variable COLLECTE_LE, posée par publie.yml) ;
   les chiffres, du relevé lui-même. Sans COLLECTE_LE (construction sur un
   poste), on n'a que le jour du relevé et on n'invente pas d'heure. La page
   calcule ensuite l'âge : au-delà de 26 heures, elle l'affiche en alerte
   (assets/app.js, collecte()). Le lot 6 rendra la surveillance rigoureuse. */
function blocCollecte(JO) {
  if (!JO) return "";
  const ok = JO.rapport.filter((r) => !r.souci).length;
  const iso = process.env.COLLECTE_LE || "";
  const date = iso ? new Date(iso) : null;
  const quand = date && !isNaN(date)
    ? `le ${date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "Europe/Paris" }).replace(/^1 /, "1er ")}
       à ${date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).replace(":", " h ")}`
    : `le ${dateFr(JO.releve_le)}`;
  return `<p class="collecte"${date && !isNaN(date) ? ` data-collecte="${esc(date.toISOString())}"` : ""}>
      <span class="collecte-point" aria-hidden="true"></span>
      <span><strong>Dernière collecte réussie <span class="collecte-quand">${quand}</span></strong>
      · ${ok} sources officielles sur ${JO.rapport.length} ont répondu · ${JO.textes.length} textes retenus</span>
    </p>`;
}

/* --- « Ce qui s'applique chez vous » : l'outil, sur la page Présentation ----
   Le même calcul que l'application (assets/app.js, simulateur()). Arrivé par
   un métier de l'accueil (?metier=43), il s'ouvre sur ce métier. */
function sectionSimulateur(V) {
  const nbDomaines = Object.keys(V.domaines).length;
  const divDefaut = V.divisions.filter((d) => d.c === "43")[0] || V.divisions[0];
  const vuDefaut = perimetre(V, divDefaut.c);
  const parSection = V.sections.map((s) => ({
    s, divisions: V.divisions.filter((d) => d.s === s.c)
  })).filter((g) => g.divisions.length);
  return `
<section class="section section-tein" id="simulateur">
  <div class="enveloppe">
    <h2 class="titre-section">Ce qui s'applique chez vous</h2>
    <p class="intro titre-section">Choisissez votre métier, cochez ce qui est vrai chez vous.
    La liste se met à jour toute seule et c'est le même calcul que dans l'application.</p>

    <div class="simulateur">
      <div class="reglages">
        <div class="reglage">
          <label class="etiq" for="choix-division">Votre métier</label>
          <select id="choix-division">
            ${parSection.map((g) => `<optgroup label="${esc(g.s.c)} — ${esc(g.s.l)}">
              ${g.divisions.map((d) => `<option value="${esc(d.c)}"${d.c === divDefaut.c ? " selected" : ""}>${esc(d.c)} — ${esc(d.l)}</option>`).join("")}
            </optgroup>`).join("")}
          </select>
        </div>
        <div class="reglage">
          <span class="etiq">Ce qui est vrai chez vous</span>
          <div class="cases" id="sim-questions">
            ${questionsSimulateur(vuDefaut.declencheurs)}
          </div>
        </div>
      </div>

      <div class="resultat">
        <h3 id="sim-titre">${esc(divDefaut.l)}</h3>
        <p>Ce que ça représente, sur l'ensemble des sujets suivis.</p>
        <hr class="filet">

        <ul class="coup-d-oeil">
          <li>
            <span class="pastille"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v16l-7-3-7 3Z"/></svg></span>
            <span><span class="etiq">Sujets à suivre</span><span class="valeur" id="sim-total">${vuDefaut.base.length}</span></span>
          </li>
          <li>
            <span class="pastille ambre"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></span>
            <span><span class="etiq">À revoir le plus souvent</span><span class="valeur" id="sim-rythme">${esc(vuDefaut.groupes.length ? vuDefaut.groupes[0].f.l : "—")}</span></span>
          </li>
          <li>
            <span class="pastille verte"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></span>
            <span><span class="etiq">Ajoutés par vos réponses</span><span class="valeur" id="sim-contexte">0</span></span>
          </li>
        </ul>

        <div class="jauge" id="sim-jauge" aria-hidden="true">
          ${Array.from({ length: nbDomaines }, (_, i) =>
            `<span${i < vuDefaut.base.length ? ' class="pleine"' : ""}></span>`).join("")}
        </div>

        <ul class="rythmes" id="sim-rythmes">
          ${vuDefaut.groupes.map((g) => {
            const noms = g.base.map((id) => V.domaines[id].nom);
            const reste = noms.length - 3;
            return `<li>
            <span class="nom">${esc(g.f.l)}</span>
            <span class="mots">${esc(noms.slice(0, 3).join(" · "))}${reste > 0 ? ` <span class="reste">et ${reste} autre${reste > 1 ? "s" : ""}</span>` : ""}</span>
            <span class="compte">${g.base.length}</span>
          </li>`; }).join("")}
        </ul>

        <p class="note-source" id="sim-phrase">
          Pour <strong>${esc(divDefaut.l)}</strong> (NAF ${esc(divDefaut.c)}), il y a
          <strong>${vuDefaut.base.length} sujets à suivre sur ${nbDomaines}</strong>. Le rythme le plus
          soutenu : <strong>${esc(vuDefaut.groupes.length ? CHAQUE[vuDefaut.groupes[0].id] || vuDefaut.groupes[0].f.l.toLowerCase() : "—")}</strong>.
        </p>
        <p class="note-source">
          C'est un point de départ, pas un avis juridique sur votre situation. Les textes
          viennent de Légifrance et des sites publics cités sur chaque sujet.
        </p>
        <p class="rangee" style="margin-top:var(--t4)">
          <a class="bouton bouton-accent" href="abonnement.html">Démarrer un abonnement</a>
        </p>
      </div>
    </div>
  </div>
</section>

`;
}

/* --- D'où viennent les textes (page Présentation) -------------------------- */
/* « Nos sources » (4 novembre 2026, « être plus complets ») : toutes les
   sources que le robot relève réellement (contenu/sources.js, confirmées),
   les codes lus article par article, et les sites de référence consultés,
   rangés par famille. Chaque nom mène au site officiel, pas au flux. */
function sectionSources(V, SOURCES = [], C = null) {
  const accueil = { jorf: "https://www.legifrance.gouv.fr/jorf/", "eurlex-l": "https://eur-lex.europa.eu/",
    "certfr-avis": "https://www.cert.ssi.gouv.fr/", rappelconso: "https://rappel.conso.gouv.fr/",
    entreprendre: "https://entreprendre.service-public.gouv.fr/", dgccrf: "https://www.economie.gouv.fr/dgccrf",
    ademe: "https://www.ademe.fr/", "ineris-aida": "https://aida.ineris.fr/" };
  const nom = (x) => x.nom.split(" — ")[0].replace(/^Journal officiel de l'Union européenne$/, "Journal officiel de l'Union européenne");
  const lien = (x) => accueil[x.id] || (() => { try { return new URL(x.url).origin + "/"; } catch (e) { return "#"; } })();
  const familles = [
    { t: "Textes officiels", ids: ["jorf", "eurlex-l"] },
    { t: "Ministères et administrations", ids: ["travail", "ecologie", "agriculture", "entreprendre", "dgccrf", "douane", "bofip"] },
    { t: "Agences et autorités", ids: ["anses", "ansm", "has", "asnr", "cnil", "certfr-avis", "ineris-aida", "ademe", "amf", "arcep", "rappelconso", "oppbtp"] }
  ];
  const confirmees = SOURCES.filter((x) => x.confirme && x.officielle !== false && x.id !== "certfr-alerte");
  const rangees = new Set(familles.flatMap((f) => f.ids));
  const autres = confirmees.filter((x) => !rangees.has(x.id));
  if (autres.length) familles[2].ids.push(...autres.map((x) => x.id));
  const parId = Object.fromEntries(confirmees.map((x) => [x.id, x]));
  const pastille = (nomS, url) => `<li><a href="${esc(url)}" target="_blank" rel="noopener">${esc(nomS)} ${sortant}</a></li>`;
  const codes = (C && C.codes) || [];
  const deja = new Set(["Légifrance", "Journal officiel (JORF)", "EUR-Lex / JOUE", "Entreprendre.service-public.fr", "BOFiP"]);
  const references = V.sourcesGenerales.filter((x) => !deja.has(x.nom));
  const pros = SOURCES.filter((x) => x.confirme && x.officielle === false);
  const nbReleve = confirmees.length + (SOURCES.some((x) => x.id === "certfr-alerte" && x.confirme) ? 0 : 0);
  return `
<section class="section">
  <div class="enveloppe">
    <h2 class="titre-section">Nos sources</h2>
    <p class="intro titre-section">Le robot relève chaque jour ${nbReleve} sources officielles${codes.length ? ` et lit ${codes.length} codes article par article sur Légifrance` : ""}.
    Chaque texte garde le lien vers sa source : c'est la source officielle qui fait foi.</p>
    <div class="sources-familles">
      ${familles.map((f) => `<div class="sources-famille">
        <h3>${esc(f.t)}</h3>
        <ul class="sources-bande sources-bande-gauche">
          ${f.ids.filter((id) => parId[id]).map((id) => pastille(nom(parId[id]), lien(parId[id]))).join("\n          ")}
          ${f.t === "Textes officiels" ? codes.map((c) => pastille(c.titre, "https://www.legifrance.gouv.fr/liste/code")).join("\n          ") : ""}
        </ul>
      </div>`).join("\n      ")}
      <div class="sources-famille">
        <h3>Sites de référence consultés</h3>
        <ul class="sources-bande sources-bande-gauche">
          ${references.map((x) => pastille(x.nom, x.url)).join("\n          ")}
        </ul>
        ${pros.length ? `<p class="sources-note">Également suivie, mais non officielle : ${pros.map((x) => esc(nom(x))).join(", ")} (organisation professionnelle).</p>` : ""}
      </div>
    </div>
  </div>
</section>

`;
}

function pageAccueil(V, D, METIERS, ECRANS, C = null, NAF = null, SOURCES = [], AVIS = [], JO = null) {
  const nbDomaines = Object.keys(V.domaines).length;
  const defaut = "43";                      // Travaux de construction spécialisés
  const divDefaut = V.divisions.filter((d) => d.c === defaut)[0] || V.divisions[0];
  const vuDefaut = perimetre(V, divDefaut.c);

  const parSection = V.sections.map((s) => ({
    s, divisions: V.divisions.filter((d) => d.s === s.c)
  })).filter((g) => g.divisions.length);

  const confirmees = SOURCES.filter((x) => x.confirme && x.officielle !== false);   // les officielles seulement
  const muettes = SOURCES.filter((x) => !x.confirme);
  const nomCourt = (x) => x.nom.split(" — ")[0];
  const exemples = ["salaries", "chantier", "chimique", "alimentaire"]
    .map((id) => V.declencheurs.filter((q) => q.id === id)[0]).filter(Boolean)
    .map((q) => `« ${esc(q.q.replace(/^Vous /, "vous ").replace(/^Votre /, "votre "))} »`);
  /* Un exemple chiffré, pris sur le métier montré par défaut dans l'outil. */
  const CHAQUE = { quotidienne: "chaque jour", hebdomadaire: "chaque semaine", mensuelle: "chaque mois", trimestrielle: "chaque trimestre" };
  const exempleRythmes = vuDefaut.groupes.filter((g) => g.base.length)
    .map((g, k) => `${g.base.length}${k ? "" : " à revoir"} ${CHAQUE[g.id] || g.f.l.toLowerCase()}`)
    .join(", ").replace(/, ([^,]+)$/, " et $1");
  const gestesSst = (V.domaines.sst ? V.domaines.sst.actions : []).slice(0, 3);
  const prixListe = Object.values(FORMULES).map((f) => esc(f.montant)).join(", ").replace(/, ([^,]+)$/, " ou $1");
  const faq = [
    { theme: "Le service", questions: [
      ["À quoi sert une veille réglementaire ?",
       `<p><strong>À savoir, avant qu'on vous le demande, quels textes s'appliquent chez vous et ce qu'ils vous obligent à faire.</strong></p>
        <p>Lois, décrets, arrêtés, normes : les règles qui encadrent une entreprise changent chaque semaine. Personne
        ne peut tout lire et pourtant c'est à vous de les appliquer. Lors d'un contrôle de l'inspection du travail,
        après un accident, ou pendant un audit, la question est toujours la même : qu'est-ce que vous saviez, et
        qu'est-ce que vous avez fait ?</p>
        <p>Faire sa veille, c'est quatre gestes, toujours les mêmes :</p>
        <ul>
          <li><strong>repérer</strong> les textes qui concernent votre métier et seulement ceux-là ;</li>
          <li><strong>comprendre</strong> ce qu'ils changent chez vous ;</li>
          <li><strong>agir</strong> : mettre à jour un document, former quelqu'un, changer une consigne ;</li>
          <li><strong>garder la trace</strong> de ce que vous avez fait et de quand.</li>
        </ul>
        <p>Le site fait le premier geste à votre place, vous prépare les deux suivants et garde le dernier.</p>`],
      ["D'où viennent les textes ?",
       `<p><strong>De ${confirmees.length} sources officielles, relues automatiquement toutes les heures.</strong></p>
        <p>Le Journal officiel en tête, puis les ministères, les autorités et les organismes publics :
        ${esc([...new Set(confirmees.map(nomCourt))].join(", "))}.</p>
        ${C ? `<p>S'y ajoutent ${C.codes.length} codes (${esc(C.codes.map((c) => c.titre).join(", "))}), relus chaque
        matin, article par article : quand un article change, vous le voyez.</p>` : ""}
        <p>Rien n'est recopié de mémoire ni résumé à la main : chaque texte garde sa date de parution, sa source
        et le lien direct vers l'original. En cas de doute, c'est toujours la source officielle qui fait foi.</p>
        ${muettes.length ? `<p>Pour être complet : ${muettes.length} sources ne sont pas encore relevées automatiquement —
        ${esc(muettes.map((x) => `${nomCourt(x)} (${x.pourquoi || "ne répond pas"})`).join(", "))}.</p>` : ""}`],
      ["Comment savez-vous ce qui me concerne ?",
       `<p><strong>Par votre métier d'abord, puis par vos réponses à quelques questions simples.</strong></p>
        <p>La nomenclature officielle compte ${NAF ? `${NAF.codes.length} codes APE, rangés en ` : ""}${V.divisions.length} familles
        de métiers. Chaque famille est rattachée aux sujets qui la concernent, parmi ${Object.keys(V.domaines).length} ;
        votre code APE prend ceux de sa famille. Par exemple, pour les
        <strong>${esc(divDefaut.l.toLowerCase())}</strong> (électriciens, plombiers, peintres…), cela fait
        <strong>${vuDefaut.base.length} sujets</strong> : ${esc(exempleRythmes)}.</p>
        <p>Ensuite, ${V.declencheurs.length} questions ajoutent ce qui vient de votre façon de travailler :
        ${exemples.join(", ")}… Chaque réponse « oui » ajoute les sujets qui vont avec.</p>
        <p>Ce qui ne vous concerne pas n'arrive pas. La liste n'est pas pour autant garantie complète :
        ${SITE.premierEchange ? "lors du premier échange, Clément Pierrel peut la revoir avec vous." : "chaque sujet reste à vérifier pour votre cas."}</p>`],
      ["Que se passe-t-il quand un nouveau texte paraît ?",
       `<p><strong>Il arrive dans votre relevé, rangé dans son sujet, avec la marque « Nouveau ».</strong></p>
        <p>Vous ouvrez sa fiche et vous y trouvez trois choses, toujours dans cet ordre :</p>
        <ul>
          <li><strong>ce que vous devez faire</strong>, en liste et en français courant${gestesSst.length ? ` — pour un texte de
            santé-sécurité, par exemple : « ${esc(gestesSst[0])} », « ${esc(gestesSst[1] || "")} »` : ""} ;</li>
          <li><strong>le texte lui-même</strong>, tel qu'il a été publié, pas un résumé ;</li>
          <li><strong>sa source</strong> : qui l'a publié, quand et le lien direct.</li>
        </ul>
        <p>Quand c'est traité, vous cochez « Fait » : la date est gardée. Avec la formule ${esc(FORMULES.complet.l)},
        elle va aussi au registre, prête à montrer à l'auditeur.</p>`],
      ["Est-ce que je reçois un courriel à chaque nouveauté ?",
       `<p><strong>Pas encore : l'envoi automatique par courriel n'est pas en place.</strong></p>
        <p>Il suppose un serveur qui expédie les courriels et le site n'en a pas encore. En attendant :</p>
        <ul>
          <li>le relevé se met à jour <strong>toutes les heures</strong>, tout seul ;</li>
          <li>ce qui vient d'arriver porte la marque <strong>« Nouveau »</strong> tant que vous ne l'avez pas lu ;</li>
          <li>avec les formules ${esc(FORMULES.suivi.l)} et ${esc(FORMULES.complet.l)}, la <strong>cloche</strong>, en haut
            de l'écran, compte les textes que vous n'avez pas encore lus.</li>
        </ul>
        <p>Vos réglages d'alerte (l'adresse, le rythme d'envoi, les revues à rappeler) sont déjà gardés : ils
        serviront le jour où l'envoi sera branché.</p>`],
      ["Est-ce un conseil juridique ?",
       `<p><strong>Non.</strong></p>
        <p>Le site vous dit ce qui s'applique à votre métier, ce qui paraît et les gestes habituels à faire
        pour chaque texte. Il ne tranche pas un point de droit et il ne connaît pas les détails de votre
        situation.</p>
        <p>Ce qu'un texte implique dans votre cas précis reste à valider par quelqu'un de compétent : un juriste,
        un avocat, ou votre organisation professionnelle. Et en cas de doute, c'est toujours la source
        officielle qui fait foi, pas le site.</p>`]
    ] },
    { theme: "Prix et démarrage", questions: [
      ["Combien ça coûte ?",
       `<p><strong>${prixListe} par mois selon la formule, ou à l'année avec ${(() => { const n = [...new Set(Object.values(FORMULES).map((f) => f.moisOfferts))].sort(); return n.length === 1 ? FORMULES.textes.offre : `${n[0]} à ${n[n.length - 1]} mois offerts`; })()}.</strong> Sans devis.</p>
        <ul>
          ${Object.values(FORMULES).map((f) => `<li><strong>${esc(f.l)}</strong> — ${esc(f.prixAn)}, ou ${esc(f.prix)} : ${esc(f.ouvre.replace(/^En plus : /, "en plus de la formule précédente, "))}</li>`).join("\n          ")}
        </ul>
        <p>Le détail de chaque formule est sur <a href="abonnement.html">la page des tarifs</a>. ${paiementComplet()
        ? "Le paiement se fait en ligne, par Stripe et se renouvelle chaque année ou chaque mois, selon votre choix."
        : "Le paiement en ligne n'est pas encore branché : pour l'instant, on s'abonne par courriel."}</p>`],
      ["Laquelle choisir ?",
       `<p><strong>Celle qui correspond à ce que vous devez montrer.</strong></p>
        <ul>
          ${Object.values(FORMULES).map((f) => `<li>${esc(f.pour.replace(/\.$/, ""))} : <strong>${esc(f.l)}</strong> (${esc(f.prixAn)}, ou ${esc(f.prix)}).</li>`).join("\n          ")}
        </ul>
        <p>En cas de doute, commencez par la démonstration : vous voyez exactement les écrans que chaque formule
        ouvre et vous changez de formule d'un clic.</p>`],
      ["Mon métier est-il couvert ?",
       `<p><strong>Oui, quel qu'il soit : ${NAF ? `les ${NAF.codes.length} codes APE de la nomenclature officielle, rangés en ${V.divisions.length} familles de métiers` : `les ${V.divisions.length} familles de métiers de la nomenclature officielle`}.</strong></p>
        <p>Votre code APE figure sur votre extrait Kbis ou votre avis de situation Insee ; ses deux premiers
        chiffres sont ceux de votre famille de métiers (43.21A, par exemple, appartient à la famille 43).</p>
        <p>Choisissez-la dans <a href="#simulateur">l'outil en haut de page</a>, ou dans
        <a href="metiers.html">la liste de tous les métiers</a> : vous voyez tout de suite les sujets à suivre
        et à quel rythme les revoir.</p>`],
      ["Peut-on essayer avant de s'abonner ?",
       `<p><strong>Oui, tout de suite, sans compte et sans mot de passe.</strong></p>
        <p>L'application est ouverte en démonstration, avec une entreprise et des textes d'essai. Vous choisissez
        une formule et vous voyez exactement les écrans qu'elle ouvre — ceux qu'elle n'ouvre pas vous le disent.
        Vous pouvez en changer autant de fois que vous voulez.</p>
        <p><a href="abonnement.html#essayer">Démarrer une démonstration</a>.</p>`],
      ["Comment on démarre ?",
       `<p><strong>En trois étapes.</strong></p>
        <ul>
          <li><strong>Regardez ce qui vous concerne</strong>, avec <a href="#simulateur">l'outil en haut de page</a> : c'est gratuit et sans inscription.</li>
          <li><strong>Choisissez votre formule</strong> sur <a href="abonnement.html">la page des tarifs</a> et écrivez-nous avec le bouton « Démarrer un abonnement ».</li>
          <li><strong>Renseignez votre entreprise</strong> dans les réglages : votre métier et vos réponses. Votre veille se fait dessus, aussitôt.</li>
        </ul>
        <p>Vous préférez en parler d'abord ? ${SITE.premierEchange ? "Le premier échange, d'une heure, est sans engagement :" : "Écrivez-nous :"}
        ${aTel() ? `${lienTel()} ou` : ""}
        <a href="mailto:${esc(SITE.courriel)}">${esc(SITE.courriel)}</a>.</p>`]
    ] },
    { theme: "L'outil et vos données", questions: [
      ["Est-ce que ça m'aide pour ma certification ?",
       `<p><strong>Oui pour la partie réglementaire : ISO 9001, ISO 14001, ISO 45001, MASE, Qualiopi.</strong></p>
        <p>Ces référentiels demandent tous deux choses : connaître les exigences légales qui vous concernent, et
        montrer que vous les suivez. Concrètement :</p>
        <ul>
          <li><strong>ISO 9001</strong> : déterminer les exigences légales et réglementaires applicables à vos
            produits et services (§ 5.1.2 et § 8.2.2) ;</li>
          <li><strong>ISO 14001 et ISO 45001</strong> : identifier vos obligations (§ 6.1.3) et évaluer votre
            conformité, preuve à l'appui (§ 9.1.2) ;</li>
          <li><strong>MASE</strong> : connaître et suivre la réglementation de vos interventions ;</li>
          <li><strong>Qualiopi</strong> : une veille légale et réglementaire et son exploitation (indicateur 23).</li>
        </ul>
        <p>Le site vous donne la liste de ce qui s'applique, les textes qui paraissent et — avec la formule
        ${esc(FORMULES.complet.l)} — un registre daté de chaque revue et de chaque décision, qui s'imprime tel quel.
        Le site ne certifie pas : la décision reste à l'auditeur.</p>`],
      ["Où sont mes données ?",
       `<p><strong>Dans votre compte, dans une base de données hébergée en Irlande (Union européenne).</strong></p>
        <p>Votre entreprise, vos réponses, vos cases « Fait » et votre registre sont gardés dans votre compte :
        vous les retrouvez sur l'ordinateur comme sur le téléphone et vos collègues invités aussi. Chaque
        entreprise ne voit que ses propres données. Le site ne pose ni cookie publicitaire ni mesure d'audience.</p>
        <p>La démonstration, elle, ne garde rien chez nous : ce que vous y faites reste dans votre navigateur.
        Le détail est dans la <a href="confidentialite.html">politique de confidentialité</a>.</p>`],
      ["Faut-il installer quelque chose ?",
       `<p><strong>Non : tout marche dans le navigateur, sur ordinateur comme sur téléphone.</strong></p>
        <p>Si vous le souhaitez, vous pouvez l'ajouter à l'écran d'accueil :</p>
        <ul>
          <li><strong>iPhone</strong> : dans Safari, Partager, puis « Sur l'écran d'accueil » ;</li>
          <li><strong>Android</strong> : dans Chrome, le menu, puis « Ajouter à l'écran d'accueil » ;</li>
          <li><strong>ordinateur</strong> : dans Chrome ou Edge, l'icône « Installer » de la barre d'adresse.</li>
        </ul>
        <p>Elle s'ouvre alors comme une application et marche même sans réseau — sur un chantier, dans un
        entrepôt. Ce n'est pas une application de l'App Store : rien à télécharger, pas de compte à créer.</p>`],
      ["Et si une source officielle ne répond pas ?",
       `<p><strong>Rien n'est perdu.</strong></p>
        <p>Il arrive qu'un site public soit en panne ou lent. Le robot réessaie alors une seconde fois. Si la
        source reste muette, les textes qu'elle avait déjà donnés restent affichés et la relève suivante, une
        heure plus tard, reprend là où elle en était.</p>
        <p>Les sources qu'on ne peut pas encore relever automatiquement sont citées, avec la raison, dans la
        réponse « D'où viennent les textes ? » ci-dessus. On ne fait pas comme si elles étaient suivies.</p>`],
      [`Qui est derrière ${SITE.nom} ?`,
       `<p><strong>${esc(SITE.nom)} est conçu avec ${esc(SITE.concepteur)}, consultant QSE et HSE en exercice.</strong></p>
        <p>La méthode — les sujets par métier, leur rythme de revue, les gestes à faire pour chaque texte — vient de sa
        pratique auprès des entreprises qu'il prépare à leurs audits. Une fiche qu'il n'a pas encore relue le dit, en tête.</p>
        <p>${esc(SITE.nom)} est édité par ${esc(SITE.societe)}${SITE.editeur.denomination ? "" : ", société en cours de création"}.
        Une question ? Un interlocuteur unique, joignable directement ${aTel() ? `: ${lienTel()} ou` : "par courriel :"}
        <a href="mailto:${esc(SITE.courriel)}">${esc(SITE.courriel)}</a>. <a href="nous.html">En savoir plus sur nous</a>.</p>`]
    ] }
  ];

  const corps = `
<section class="heros heros-accueil">
  <div class="enveloppe">
    ${barrePartage()}
    <div class="heros-texte">
      <h1>Votre veille réglementaire, notre préoccupation</h1>
    </div>
    <p class="heros-sous">
      Vigie réglementaire vous accompagne dans votre démarche en vous proposant un service complet
      de veille réglementaire, vous permettant de suivre les évolutions législatives et normatives dans
      les domaines de la santé, de la sécurité, de l'hygiène, de l'environnement et des ressources humaines.
      Vigie réglementaire vous accompagne également dans la mise en conformité de votre société.
    </p>
    <p class="rangee rangee-centre heros-actions">
      <a class="bouton bouton-accent" href="abonnement.html">Démarrer un abonnement</a>
      <a class="bouton bouton-sobre" href="abonnement.html#essayer">Démarrer une démonstration</a>
    </p>
    ${blocCollecte(JO)}

    <div class="heros-visuel">
      ${portable(ECRANS, "bord.png", "Le tableau de bord de l'application : nouveaux textes, textes applicables, textes lus, actions à réaliser.")}
      ${mobile(ECRANS, "plan-tel.png", "Ma veille réglementaire sur téléphone.")}
    </div>
  </div>
</section>

${bandeAvis(AVIS)}

<section class="section">
  <div class="enveloppe">
    <div class="rail">
      <span class="rail-fil" data-fil></span>
      <div class="rail-item" data-paraitre data-compte="${NAF ? NAF.codes.length : V.divisions.length}">
        <span class="chiffre">${NAF ? NAF.codes.length : V.divisions.length}</span>
        <p class="legende">${NAF ? "Codes APE disponibles" : "Familles de métiers disponibles"}</p>
      </div>
      <div class="rail-item" data-paraitre data-compte="${nbDomaines}">
        <span class="chiffre">${nbDomaines}</span>
        <p class="legende">Thèmes abordés</p>
        <p class="legende-detail">Santé et sécurité au travail, environnement, droit du travail et paie, fiscalité,
        numérique et données personnelles, bâtiment et sécurité incendie et les réglementations propres à chaque métier.</p>
      </div>
      <div class="rail-item" data-paraitre data-compte="${V.declencheurs.length}">
        <span class="chiffre">${V.declencheurs.length}</span>
        <p class="legende">Questions qui permettent de préciser les spécificités de votre structure et d'individualiser la veille réglementaire</p>
      </div>
      <div class="rail-item" data-paraitre>
        <span class="chiffre">ISO</span>
        <p class="legende">Les certifications qui exigent une veille</p>
        <p class="legende-detail">ISO 9001 (qualité), ISO 14001 (environnement), ISO 45001 (santé et sécurité au travail),
        ISO 50001 (énergie), ISO 22000 (sécurité des aliments), ISO/IEC 27001 (sécurité de l'information),
        ISO 13485 (dispositifs médicaux), ainsi que MASE et Qualiopi.</p>
      </div>
    </div>
  </div>
</section>

<section class="section section-tein">
  <div class="enveloppe">
    <h2 class="titre-section">Un outil qui répond à vos besoins</h2>
    <p class="intro titre-section">Quel que soit votre domaine d'activité, chaque entreprise doit se tenir informée
      des textes réglementaires qui lui sont applicables et mettre en place les actions nécessaires pour y répondre.</p>

    <div class="bascule bascule-trois" role="tablist" aria-label="Profil" data-bascule>
      <span class="bascule-curseur" aria-hidden="true"></span>
      <button type="button" role="tab" id="onglet-dirigeant" aria-selected="true" aria-controls="profil-dirigeant">Dirigeant</button>
      <button type="button" role="tab" id="onglet-qhse" aria-selected="false" aria-controls="profil-qhse">Responsable QHSE</button>
      <button type="button" role="tab" id="onglet-consultant" aria-selected="false" aria-controls="profil-consultant">Consultant</button>
    </div>

    <div id="profil-dirigeant" role="tabpanel" aria-labelledby="onglet-dirigeant">
    <ul class="traits">
      <li class="trait">
        <svg class="icone" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7v5l3 2"/><circle cx="12" cy="12" r="9"/></svg>
        <div><h3>Une synthèse globale des textes qui vous sont applicables</h3>
        <p>Seuls les textes qui vous concernent vous sont présentés. Les autres restent à part,
        mais sont accessibles.</p></div>
      </li>
      <li class="trait">
        <svg class="icone" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 12l2 2 4-5"/><circle cx="12" cy="12" r="9"/></svg>
        <div><h3>Réalisation de votre registre de conformité réglementaire</h3>
        <p>Une synthèse des textes qui vous sont applicables et de ceux qui sont appliqués dans votre société.</p></div>
      </li>
      <li class="trait">
        <svg class="icone" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v16l-7-3-7 3Z"/><path d="M9 9h6"/></svg>
        <div><h3>Un plan d'actions préconisées</h3>
        <p>Pour répondre aux textes passés, présents et futurs.</p></div>
      </li>
      <li class="trait">
        <svg class="icone" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h12M8 12h12M8 18h12"/><path d="M4 6h.01M4 12h.01M4 18h.01"/></svg>
        <div><h3>Un tableau des textes publiés chaque jour</h3>
        <p>Avec l'ensemble des liens pour y accéder.</p></div>
      </li>
    </ul>
    <p class="rangee rangee-centre offre-profil"><a class="bouton bouton-accent" href="abonnement.html">Découvrir l'offre</a></p>
    </div>

    <div id="profil-qhse" role="tabpanel" aria-labelledby="onglet-qhse" hidden>
    <ul class="traits">
      <li class="trait">
        <svg class="icone" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7v5l3 2"/><circle cx="12" cy="12" r="9"/></svg>
        <div><h3>Une synthèse globale des textes qui vous sont applicables</h3>
        <p>Seuls les textes qui vous concernent vous sont présentés. Les autres restent à part,
        mais sont accessibles.</p></div>
      </li>
      <li class="trait">
        <svg class="icone" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 12l2 2 4-5"/><circle cx="12" cy="12" r="9"/></svg>
        <div><h3>Réalisation de votre registre de conformité réglementaire</h3>
        <p>Une synthèse des textes qui vous sont applicables et de ceux qui sont appliqués dans votre société.</p></div>
      </li>
      <li class="trait">
        <svg class="icone" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v16l-7-3-7 3Z"/><path d="M9 9h6"/></svg>
        <div><h3>Un plan d'actions préconisées</h3>
        <p>Pour répondre aux textes passés, présents et futurs.</p></div>
      </li>
      <li class="trait">
        <svg class="icone" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h12M8 12h12M8 18h12"/><path d="M4 6h.01M4 12h.01M4 18h.01"/></svg>
        <div><h3>Un tableau des textes publiés chaque jour</h3>
        <p>Avec l'ensemble des liens pour y accéder.</p></div>
      </li>
    </ul>
    <div class="normes-onglet">
    <p class="normes-intro"><strong>Pour votre certification.</strong> Ce que la norme demande sur la réglementation et ce que le
    site vous donne pour le montrer à l'auditeur.</p>
    <ul class="normes">
      ${[
        { n: "ISO 9001", t: "Qualité",
          demande: "Déterminer les exigences légales et réglementaires applicables à vos produits et services et les satisfaire (§ 5.1.2 et § 8.2.2).",
          donne: "Les textes qui s'appliquent à votre activité, leur source officielle et le registre de conformité pour le démontrer." },
        { n: "ISO 14001", t: "Environnement",
          demande: "Connaître vos obligations de conformité (§ 6.1.3) et évaluer votre conformité, en gardant la preuve (§ 9.1.2).",
          donne: "La liste de ce qui s'applique chez vous, les textes qui paraissent et chaque évaluation datée au registre." },
        { n: "ISO 45001", t: "Santé et sécurité au travail",
          demande: "Déterminer les exigences légales applicables (§ 6.1.3) et évaluer votre conformité, preuve à l'appui (§ 9.1.2).",
          donne: "Les sujets santé-sécurité de votre métier, ce qu'il faut faire pour chaque texte et la case « fait » datée." },
        { n: "MASE", t: "Entreprises intervenantes",
          demande: "Connaître et suivre la réglementation qui s'applique à vos interventions et le montrer.",
          donne: "La fiche de votre métier, ce qu'il faut faire pour chaque texte et un registre qui s'imprime tel quel pour l'audit." },
        { n: "Qualiopi", t: "Organismes de formation",
          demande: "Une veille légale et réglementaire sur la formation professionnelle et son exploitation (indicateur 23).",
          donne: "Le sujet « Enseignement, formation et certification qualité » suivi à son rythme, revue après revue." }
      ].map((x) => `<li class="norme">
        <p class="norme-nom">${esc(x.n)} <span>${esc(x.t)}</span></p>
        <p><strong>Elle demande :</strong> ${esc(x.demande)}</p>
        <p><strong>Le site donne :</strong> ${esc(x.donne)}</p>
      </li>`).join("")}
    </ul>
    <p class="note-source" style="text-align:center;margin-top:var(--t4)">Le site ne certifie
    pas : il vous aide à tenir et à montrer votre veille. La décision reste à l'auditeur.</p>
    </div>
    <p class="rangee rangee-centre offre-profil"><a class="bouton bouton-accent" href="abonnement.html">Découvrir l'offre</a></p>
    </div>

    <div id="profil-consultant" role="tabpanel" aria-labelledby="onglet-consultant" hidden>
    <ul class="traits">
      <li class="trait">
        <svg class="icone" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 12l2 2 4-5"/><circle cx="12" cy="12" r="9"/></svg>
        <div><h3>Réalisation des registres de conformité réglementaire de vos clients</h3>
        <p>Une synthèse des textes qui sont applicables à vos clients.</p></div>
      </li>
      <li class="trait">
        <svg class="icone" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 20V10"/></svg>
        <div><h3>Gérer vos clients sur un même et seul espace</h3>
        <p>La veille de vos clients est optimisée.</p></div>
      </li>
      <li class="trait">
        <svg class="icone" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 3 7v5c0 5 3.8 8.3 9 9 5.2-.7 9-4 9-9V7Z"/><path d="M9 12l2 2 4-5"/></svg>
        <div><h3>Vos clients ont accès aux mêmes informations</h3>
        <p>Vous partagez le même espace avec vos clients, qui peuvent, sous vos conseils, mettre à jour leur plan d'actions et leur conformité.</p></div>
      </li>
      <li class="trait">
        <svg class="icone" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7v5l3 2"/><circle cx="12" cy="12" r="9"/></svg>
        <div><h3>Une synthèse globale des textes qui sont applicables à vos clients</h3>
        <p>Seuls les textes qui concernent vos clients sont présentés.</p></div>
      </li>
      <li class="trait">
        <svg class="icone" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v16l-7-3-7 3Z"/><path d="M9 9h6"/></svg>
        <div><h3>Un plan d'actions préconisées</h3>
        <p>Pour répondre aux textes passés, présents et futurs.</p></div>
      </li>
      <li class="trait">
        <svg class="icone" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h12M8 12h12M8 18h12"/><path d="M4 6h.01M4 12h.01M4 18h.01"/></svg>
        <div><h3>Un tableau des textes publiés chaque jour</h3>
        <p>Avec l'ensemble des liens pour y accéder.</p></div>
      </li>
    </ul>
    <p class="rangee rangee-centre offre-profil"><a class="bouton bouton-accent" href="consultants.html">Découvrir l'offre</a></p>
    </div>
  </div>
</section>

<section class="section section-tein">
  <div class="enveloppe">
    <h2 class="titre-section">Pourquoi choisir Vigie réglementaire</h2>
    <p class="intro titre-section">Un outil simple, ludique et facile d'utilisation pour assurer votre veille réglementaire.</p>
    <ul class="raisons raisons-deux">
      <li class="raison" data-paraitre>
        <span class="numero" aria-hidden="true">1</span>
        <h3>État des lieux réglementaire</h3>
        <p>Disposer d'un état des lieux réglementaire.</p>
      </li>
      <li class="raison" data-paraitre>
        <span class="numero" aria-hidden="true">2</span>
        <h3>Plan d'actions</h3>
        <p>Un plan d'actions pour répondre aux textes qui vous sont applicables.</p>
      </li>
      <li class="raison" data-paraitre>
        <span class="numero" aria-hidden="true">3</span>
        <h3>Une équipe de consultants séniors</h3>
        <p>Une équipe de consultants séniors à votre service.</p>
      </li>
      <li class="raison" data-paraitre>
        <span class="numero" aria-hidden="true">4</span>
        <h3>Une veille réglementaire individualisée</h3>
        <p>Une veille adaptée à votre société : ${NAF ? `${NAF.codes.length} codes NAF` : `${V.divisions.length} familles de métiers`}, des questions sur les spécificités de votre société, pour une veille réglementaire individualisée.</p>
      </li>
    </ul>
  </div>
</section>

<!-- Les questions qu'on pose avant de s'abonner, rangées en trois thèmes.
     Chaque réponse commence par la réponse elle-même (oui, non, le chiffre),
     puis le détail. Elle dit ce qui est vrai aujourd'hui, y compris ce qui
     n'est pas encore en place. Repliées : on n'ouvre que celle qui intéresse. -->
${SITE.offreConsultant ? `<section class="section">
  <div class="enveloppe">
    <div class="bloc-consultant">
      <h2>Vous êtes consultant QSE ?</h2>
      <p class="rangee"><a class="bouton bouton-accent" href="consultants.html">Découvrir l'offre consultant</a></p>
    </div>
  </div>
</section>

` : ""}`;

  return page({
    titre: `${SITE.nom} — ${SITE.bareme}`,
    description: "Votre veille réglementaire tenue et prouvable : plan de veille, relevé des textes de votre métier, registre de preuves prêt pour l'audit.",
    zone: "public", actif: "produit", corps, donneesPlan: true, scripts: ["assets/partage.js"]
  });
}

/* --- Partager le site sur les réseaux sociaux (4 novembre 2026, demande
   d'Axel) : de simples liens vers les pages de partage de chaque réseau.
   Aucun script ni traceur tiers n'est chargé : rien ne part tant que
   l'internaute ne clique pas. Sur téléphone, le bouton « Partager » ouvre
   le partage du système (assets/partage.js). */
function barrePartage() {
  const url = SITE.adresseWeb, e = encodeURIComponent;
  const texte = `J'utilise ${SITE.nom} réglementaire pour suivre la veille réglementaire de mon entreprise : les textes qui s'appliquent, un plan d'actions et un registre de conformité.`;
  const reseaux = [
    ["LinkedIn", `https://www.linkedin.com/sharing/share-offsite/?url=${e(url)}`,
      '<path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3zM9 9h3.8v1.7h.05c.53-1 1.83-2.05 3.77-2.05C20.6 8.65 21 11.2 21 14.5V21h-4v-5.8c0-1.4 0-3.2-1.95-3.2S12.8 13.5 12.8 15.1V21H9z"/>'],
    ["Facebook", `https://www.facebook.com/sharer/sharer.php?u=${e(url)}`,
      '<path d="M14 8.5V6.8c0-.8.5-1 1-1h2.5V2h-3.4C10.4 2 9.7 4.6 9.7 6.3v2.2H7.5V12h2.2v10H14V12h3l.4-3.5z"/>'],
    ["X", `https://twitter.com/intent/tweet?text=${e(texte)}&url=${e(url)}`,
      '<path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.3-8.3L2 3h6.4l4.4 5.8zm-1.1 16.2h1.7L7.4 4.7H5.6z"/>'],
    ["WhatsApp", `https://wa.me/?text=${e(texte + " " + url)}`,
      '<path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2s.2-1.1.2-1.2-.2-.2-.4-.3z"/>'],
    ["E-mail", `mailto:?subject=${e(`${SITE.nom} réglementaire`)}&body=${e(texte + "\n\n" + url)}`,
      '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>']
  ];
  const icone = (d, plein = true) => `<svg viewBox="0 0 24 24" aria-hidden="true"${plein ? ' fill="currentColor"' : ' fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"'}>${d}</svg>`;
  return `<div class="partage-barre" role="group" aria-label="Partager ${esc(SITE.nom)} réglementaire">
      <span class="partage-libelle">Partager</span>
      <ul class="partage-liens" role="list">
        ${reseaux.map(([nom, href, d]) => `<li><a class="partage-icone" href="${esc(href)}"${nom === "E-mail" ? "" : ' target="_blank" rel="noopener"'} title="${nom === "E-mail" ? "Envoyer par e-mail" : `Partager sur ${esc(nom)}`}" aria-label="${nom === "E-mail" ? "Envoyer par e-mail" : `Partager sur ${esc(nom)} (nouvelle fenêtre)`}">${icone(d, nom !== "E-mail")}</a></li>`).join("")}
        <li><button type="button" class="partage-icone" data-copier-lien="${esc(url)}" title="Copier le lien du site" aria-label="Copier le lien du site">${icone('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>', false)}</button></li>
        <li data-partage-natif hidden><button type="button" class="partage-icone" data-partager="${esc(url)}" data-texte="${esc(texte)}" title="Partager" aria-label="Partager avec une autre application">${icone('<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/>', false)}</button></li>
      </ul>
      <span class="partage-etat" role="status"></span>
    </div>`;
}

/* --- Nous contacter (3 novembre 2026) -----------------------------------------
   La page du formulaire de contact, sortie de l'accueil à la demande d'Axel.
   Le menu « Nous contacter » et le lien « Contact » du bas de page y mènent. */
function pageContact() {
  const corps = `
<section class="section section-contact" id="contact">
  <div class="enveloppe contact-page">
    <div class="contact-intro">
      <h1>Nous contacter</h1>
      <p class="contact-texte">Contactez-nous et notre équipe vous répondra dans les meilleurs délais.</p>
      <ul class="contact-infos">
        <li><span class="contact-icone" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6 8.5-6"/></svg></span>
          <span><span class="contact-etiquette">Par courriel</span><a href="mailto:${esc(SITE.courriel)}">${esc(SITE.courriel)}</a></span></li>
        ${SITE.telephone ? `<li><span class="contact-icone" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg></span>
          <span><span class="contact-etiquette">Par téléphone</span>${lienTel("")}</span></li>` : ""}
        <li><span class="contact-icone" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg></span>
          <span><span class="contact-etiquette">Voir le site en action</span><a href="abonnement.html#essayer">Démarrer une démonstration gratuite</a></span></li>
      </ul>
    </div>
    ${formulaireContact()}
  </div>
</section>`;
  return page({ titre: `Nous contacter | ${SITE.nom}`, description: "Une question sur Vigie ? Écrivez-nous : notre équipe vous répond dans les meilleurs délais.",
    zone: "public", actif: "contact", corps, scripts: ["assets/contact.js"] });
}

/* --- Le formulaire de contact (3 novembre 2026) ------------------------------
   Enregistré dans la base par public.contacter() (migration 13), lu dans
   l'espace administrateur. Aucun champ ne porte de « name » : sans le script,
   rien ne part dans l'adresse de la page. Le champ « site » est un piège à
   robots, caché aux personnes : rempli, l'envoi est ignoré. */
function formulaireContact() {
  return `<form class="form-contact" id="form-contact" method="post" novalidate>
      <div class="contact-grille">
        <div class="champ"><label for="c-nom">Nom et prénom <span class="requis">*</span></label>
          <input type="text" id="c-nom" autocomplete="name" maxlength="200" required></div>
        <div class="champ"><label for="c-entreprise">Entreprise</label>
          <input type="text" id="c-entreprise" autocomplete="organization" maxlength="200"></div>
        <div class="champ"><label for="c-courriel">Adresse électronique <span class="requis">*</span></label>
          <input type="email" id="c-courriel" autocomplete="email" inputmode="email" spellcheck="false" maxlength="320" required></div>
        <div class="champ"><label for="c-telephone">Téléphone</label>
          <input type="tel" id="c-telephone" autocomplete="tel" maxlength="40"></div>
        <div class="champ contact-large"><label for="c-objet">Objet</label>
          <select id="c-objet">
            <option value="offres">Une question sur les offres</option>
            <option value="demonstration">Une démonstration</option>
            ${SITE.offreConsultant ? `<option value="consultant">L'offre consultant</option>` : ""}
            <option value="autre">Autre</option>
          </select></div>
        <div class="champ contact-large"><label for="c-message">Votre message <span class="requis">*</span></label>
          <textarea id="c-message" rows="5" maxlength="5000" required></textarea></div>
        <div class="contact-piege" aria-hidden="true"><label for="c-site">Ne pas remplir</label>
          <input type="text" id="c-site" tabindex="-1" autocomplete="off"></div>
      </div>
      <label class="contact-accord"><input type="checkbox" id="c-accord">
        <span>J'accepte que ces informations servent à me répondre (voir la <a href="confidentialite.html">politique de confidentialité</a>).</span></label>
      <p class="rangee"><button type="submit" class="bouton bouton-accent">Envoyer le message</button></p>
      <p class="etat-contact" id="etat-contact" role="status"></p>
      <p class="contact-autre"><span class="requis">*</span> champs obligatoires</p>
    </form>
    <div class="form-contact contact-merci" id="contact-merci" hidden tabindex="-1">
      <p><strong>Merci, votre message est bien envoyé.</strong></p>
      <p>Nous vous répondons dans les meilleurs délais, à l'adresse indiquée.</p>
    </div>`;
}

/* --- Comment ça marche ------------------------------------------------------
   « Plus d'infos sur le site, avec des dessins, mais pas directement sur
   l'accueil : on clique sur un bouton. » Cette page explique le site, du
   Journal officiel à la case « fait », avec des schémas dessinés ici même
   (SVG, aux couleurs du thème clair ou sombre). Tous les chiffres viennent
   des données du dépôt ; rien n'est arrondi à la hausse. Comme l'accueil,
   elle ne mène pas dans l'application : on y entre par « Connexion » ou
   « Démarrer un abonnement ». */
function pageDecouvrir(V, ECRANS, C, NAF, SOURCES) {
  const confirmees = SOURCES.filter((x) => x.confirme && x.officielle !== false);   // les officielles seulement
  const manquantes = SOURCES.filter((x) => !x.confirme);
  const nomCourt = (x) => x.nom.split(" — ")[0];
  const nDomaines = Object.keys(V.domaines).length;
  const nCodes = NAF ? NAF.codes.length : 0;
  const nArticles = C ? C.morceaux.reduce((n, m) => n + m.articles.length, 0) : 0;

  const icone = (chemin) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"
    stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${chemin}</svg>`;

  const etapes = [
    { t: "Les sources officielles", i: '<path d="M6 3h9l3 3v15H6z"/><path d="M15 3v3h3M9 11h6M9 15h6"/>',
      d: "Un croisement de l'ensemble des sources officielles disponibles." },
    { t: "Mise à jour quotidienne des textes", i: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      d: "Chaque jour, les nouveaux textes sont intégrés à votre veille." },
    { t: "Une veille réglementaire individualisée", i: '<path d="M4 5h16l-6 8v6l-4-2v-4z"/>',
      d: `${nCodes || V.divisions.length} codes NAF et des questions sur les spécificités de votre entreprise permettant d'individualiser votre veille réglementaire.` },
    { t: "Vos textes sous forme de synthèse", i: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3.5 6 1 1 2-2M3.5 12l1 1 2-2M3.5 18l1 1 2-2"/>',
      d: "Chaque jour, votre synthèse est mise à jour avec les textes qui vous sont applicables." },
    { t: "Votre plan d'actions", i: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/>',
      d: "Un plan d'actions vous est proposé pour répondre aux exigences réglementaires." },
    { t: "Votre conformité, validée", i: '<path d="M12 3 4 6v6c0 4.5 3.4 7.8 8 9 4.6-1.2 8-4.5 8-9V6z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
      d: "Validez votre conformité réglementaire en confirmant la réalisation du plan d'actions." }
  ];

  /* Le dessin d'une fiche : ce qu'on voit en ouvrant un texte. */
  const dessinFiche = `<svg class="dessin" viewBox="0 0 640 400" role="img"
    aria-label="Schéma d'une fiche de texte : en haut le titre ; à gauche, ce que vous devez faire, avec le bouton Fait ; à droite, le texte tel que publié ; en bas, d'où vient le texte.">
    <rect class="d-carte" x="8" y="8" width="624" height="384" rx="18"/>
    <text class="d-petit" x="36" y="46">23 octobre 2026</text>
    <rect class="d-pastille" x="500" y="30" width="96" height="26" rx="13"/>
    <text class="d-petit d-accent" x="548" y="48" text-anchor="middle">Texte</text>
    <rect class="d-ligne-forte" x="36" y="64" width="420" height="12" rx="6"/>
    <rect class="d-ligne" x="36" y="86" width="330" height="10" rx="5"/>
    <rect class="d-encart-faire" x="36" y="118" width="250" height="186" rx="14"/>
    <circle class="d-num" cx="62" cy="144" r="12"/><text class="d-num-t" x="62" y="149" text-anchor="middle">1</text>
    <text class="d-titre" x="84" y="149">Ce que vous devez faire</text>
    <circle class="d-puce" cx="58" cy="178" r="3.5"/><rect class="d-ligne" x="70" y="173" width="190" height="9" rx="4.5"/>
    <circle class="d-puce" cx="58" cy="202" r="3.5"/><rect class="d-ligne" x="70" y="197" width="160" height="9" rx="4.5"/>
    <circle class="d-puce" cx="58" cy="226" r="3.5"/><rect class="d-ligne" x="70" y="221" width="176" height="9" rx="4.5"/>
    <rect class="d-fait" x="52" y="250" width="104" height="36" rx="18"/>
    <rect class="d-case" x="66" y="260" width="16" height="16" rx="4"/>
    <path class="d-coche" d="m70 268 3 3 6-7"/>
    <text class="d-fait-t" x="92" y="273">Fait</text>
    <rect class="d-encart" x="302" y="118" width="302" height="186" rx="14"/>
    <circle class="d-num" cx="328" cy="144" r="12"/><text class="d-num-t" x="328" y="149" text-anchor="middle">2</text>
    <text class="d-titre" x="350" y="149">Le texte, tel que publié</text>
    ${[176, 196, 216, 236, 256, 276].map((y, k) => `<rect class="d-ligne" x="322" y="${y}" width="${[262, 250, 258, 230, 254, 170][k]}" height="8" rx="4"/>`).join("")}
    <rect class="d-encart" x="36" y="320" width="568" height="48" rx="12"/>
    <text class="d-titre" x="56" y="350">D'où vient ce texte</text>
    <rect class="d-ligne" x="226" y="340" width="250" height="8" rx="4"/>
    <text class="d-petit d-accent" x="584" y="350" text-anchor="end">la source ↗</text>
  </svg>`;

  /* Le même dessin, en hauteur, pour un téléphone : les encadrés l'un sous
     l'autre et un texte lisible sans zoomer. */
  const dessinFicheTel = `<svg class="dessin" viewBox="0 0 360 560" role="img"
    aria-label="Schéma d'une fiche de texte : le titre, puis ce que vous devez faire avec le bouton Fait, puis le texte tel que publié, puis d'où vient le texte.">
    <rect class="d-carte" x="4" y="4" width="352" height="552" rx="18"/>
    <text class="d-petit" x="24" y="38">23 octobre 2026</text>
    <rect class="d-ligne-forte" x="24" y="54" width="290" height="12" rx="6"/>
    <rect class="d-ligne" x="24" y="76" width="220" height="10" rx="5"/>
    <rect class="d-encart-faire" x="20" y="104" width="320" height="196" rx="14"/>
    <circle class="d-num" cx="46" cy="132" r="13"/><text class="d-num-t" x="46" y="137" text-anchor="middle">1</text>
    <text class="d-titre d-titre-tel" x="68" y="138">Ce que vous devez faire</text>
    <circle class="d-puce" cx="44" cy="168" r="4"/><rect class="d-ligne" x="58" y="163" width="250" height="10" rx="5"/>
    <circle class="d-puce" cx="44" cy="194" r="4"/><rect class="d-ligne" x="58" y="189" width="210" height="10" rx="5"/>
    <circle class="d-puce" cx="44" cy="220" r="4"/><rect class="d-ligne" x="58" y="215" width="230" height="10" rx="5"/>
    <rect class="d-fait" x="38" y="244" width="116" height="40" rx="20"/>
    <rect class="d-case" x="54" y="255" width="18" height="18" rx="4"/>
    <path class="d-coche" d="m58 264 3.5 3.5 6.5-7.5"/>
    <text class="d-fait-t d-titre-tel" x="82" y="270">Fait</text>
    <rect class="d-encart" x="20" y="316" width="320" height="156" rx="14"/>
    <circle class="d-num" cx="46" cy="344" r="13"/><text class="d-num-t" x="46" y="349" text-anchor="middle">2</text>
    <text class="d-titre d-titre-tel" x="68" y="350">Le texte, tel que publié</text>
    ${[374, 394, 414, 434, 454].map((y, k) => `<rect class="d-ligne" x="40" y="${y}" width="${[280, 268, 276, 250, 180][k]}" height="9" rx="4.5"/>`).join("")}
    <rect class="d-encart" x="20" y="488" width="320" height="52" rx="12"/>
    <text class="d-titre d-titre-tel" x="38" y="520">D'où vient ce texte</text>
    <text class="d-petit d-accent d-titre-tel" x="322" y="520" text-anchor="end">↗</text>
  </svg>`;

  /* Un trimestre de revues : chaque rythme, ses passages. */
  const semaines = 13;
  const x0 = 170, larg = 440, pas = larg / semaines;
  const rangs = [
    { l: "Quotidienne", y: 70, pts: Array.from({ length: semaines * 5 }, (_, k) => x0 + (k + .5) * (larg / (semaines * 5))) },
    { l: "Hebdomadaire", y: 130, pts: Array.from({ length: semaines }, (_, k) => x0 + (k + .5) * pas) },
    { l: "Mensuelle", y: 190, pts: [0, 1, 2].map((k) => x0 + (k * 4.33 + 2) * pas) },
    { l: "Trimestrielle", y: 250, pts: [x0 + 6.5 * pas] }
  ];
  const dessinRythmes = `<svg class="dessin" viewBox="0 0 640 310" role="img"
    aria-label="Schéma d'un trimestre de revues : une revue chaque jour ouvré pour le rythme quotidien, une par semaine pour l'hebdomadaire, une par mois pour la mensuelle, une par trimestre pour la trimestrielle.">
    <rect class="d-carte" x="8" y="8" width="624" height="294" rx="18"/>
    ${[0, 4.33, 8.66, 13].map((k, i) => `<line class="d-repere" x1="${x0 + k * pas}" y1="34" x2="${x0 + k * pas}" y2="272"/>
    ${i < 3 ? `<text class="d-petit" x="${x0 + (k + 2.16) * pas}" y="290" text-anchor="middle">${["Mois 1", "Mois 2", "Mois 3"][i]}</text>` : ""}`).join("")}
    ${rangs.map((r) => `<text class="d-titre" x="32" y="${r.y + 5}">${r.l}</text>
    <line class="d-rail" x1="${x0}" y1="${r.y}" x2="${x0 + larg}" y2="${r.y}"/>
    ${r.pts.map((x) => `<circle class="d-point" cx="${x.toFixed(1)}" cy="${r.y}" r="${r.pts.length > 20 ? 2.6 : 6}"/>`).join("")}`).join("")}
  </svg>`;

  const rangsTel = rangs.map((r, k) => ({ ...r, y: 70 + k * 70,
    pts: r.pts.map((x) => 24 + ((x - x0) / larg) * 312) }));
  const dessinRythmesTel = `<svg class="dessin" viewBox="0 0 360 340" role="img"
    aria-label="Schéma d'un trimestre de revues : une revue chaque jour ouvré pour le rythme quotidien, une par semaine pour l'hebdomadaire, une par mois pour la mensuelle, une par trimestre pour la trimestrielle.">
    <rect class="d-carte" x="4" y="4" width="352" height="332" rx="18"/>
    ${rangsTel.map((r) => `<text class="d-titre d-titre-tel" x="24" y="${r.y - 14}">${r.l}</text>
    <line class="d-rail" x1="24" y1="${r.y}" x2="336" y2="${r.y}"/>
    ${r.pts.map((x) => `<circle class="d-point" cx="${x.toFixed(1)}" cy="${r.y}" r="${r.pts.length > 20 ? 1.9 : 5.5}"/>`).join("")}`).join("")}
    ${["Mois 1", "Mois 2", "Mois 3"].map((m, i) => `<text class="d-petit d-titre-tel" x="${24 + (i + .5) * 104}" y="318" text-anchor="middle">${m}</text>`).join("")}
  </svg>`;

  /* L'application, écran par écran : des captures, qu'un clic agrandit. */
  const pieces = [
    { img: "bord.png", t: "Tableaux de bord", d: "" },
    { img: "plan.png", t: "Ma veille réglementaire", d: "" },
    { img: "actions.png", t: "Plan d'actions", d: "" },
    { img: "registre.png", t: "Registre et conformité réglementaire", d: "" }
  ];
  const vignette = (p) => {
    if (!p.img || !ECRANS.includes(p.img)) return `<div class="vignette vignette-vide">${icone('<circle cx="12" cy="12" r="3"/><path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1M7.7 16.3l-2.1 2.1"/>')}</div>`;
    const sombre = p.img.replace(".png", "-sombre.png");
    const im = (f, cl) => `<img class="${cl}" src="assets/ecrans/${esc(f)}" alt="Capture : ${esc(p.t)}" loading="lazy" decoding="async" width="1280" height="860">`;
    return `<figure class="vignette">${agrandir(p.t)}${im(p.img, "ecran-clair")}${ECRANS.includes(sombre) ? im(sombre, "ecran-sombre") : ""}</figure>`;
  };

  const corps = `
<section class="heros heros-court heros-accueil">
  <div class="enveloppe">
    <div class="heros-texte">
      <h1>Les étapes de la construction de votre veille réglementaire individualisée</h1>
    </div>
    <ol class="etapes etapes-six">
      ${etapes.map((e, k) => `<li class="etape">
        <span class="etape-num">${k + 1}</span>
        <span class="etape-icone">${icone(e.i)}</span>
        <h3>${esc(e.t)}</h3>
        <p>${e.d}</p>
      </li>`).join("")}
    </ol>
  </div>
</section>

<section class="section section-tein">
  <div class="enveloppe">
    <ul class="pieces">
      ${pieces.map((p) => `<li class="piece">
        ${vignette(p)}
        <h3>${esc(p.t)}</h3>
        ${p.d ? `<p>${esc(p.d)}</p>` : ""}
      </li>`).join("")}
    </ul>
  </div>
</section>

${sectionSources(V, SOURCES, C)}<section class="section section-appel">
  <div class="enveloppe">
    <p class="rangee rangee-centre">
      <a class="bouton bouton-accent" href="abonnement.html">Démarrer un abonnement</a>
      <a class="bouton bouton-sobre" href="connexion.html">Connexion</a>
    </p>
  </div>
</section>`;

  return page({
    titre: `Présentation | ${SITE.nom}`,
    description: "Du Journal officiel à la case « fait » : ce que le site va chercher, comment il trie et ce que vous voyez.",
    zone: "public", actif: "decouvrir", corps, donneesPlan: true, attrsBody: ' data-page="presentation"'
  });
}

function pageAbonnement(V) {
  const corps = `
<section class="heros heros-abonnement">
  <div class="enveloppe">
    <div class="heros-texte"><h1>Démarrer un abonnement</h1></div>
  </div>
</section>

<section class="section">
  <div class="enveloppe">
    <h2 class="titre-section">Nos offres entreprise</h2>

    <div class="formules">
      ${Object.entries(FORMULES).map(([id, f], k) => `<article class="formule${id === "complet" ? " mise-en-avant" : ""}" data-paraitre>
        <span class="etiq nom-offre${(f.carte || f.l).length > 55 ? " nom-offre-long" : ""}">0${k + 1} — ${esc(f.carte || f.l)}</span>
        <!-- L'année d'abord : en entreprise, la veille est une ligne de budget annuel. -->
        <p class="prix"><span class="grand">${esc(eur(f.an))}</span> <span class="etiq">par an</span></p>
        <p class="offre-an"><span class="pastille-offre">${esc(f.offre)}</span> ou <strong>${esc(f.prix)}</strong></p>
        ${f.surCarte === false ? "" : `<p class="pour">${esc(f.pour)}</p>`}
        <ul class="formule-donne">${f.donne.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>
        <a class="bouton ${id === "complet" ? "bouton-accent" : "bouton-sobre"}" href="compte/paiement.html?formule=${id}&amp;periode=an">Abonnement annuel</a>
        <a class="lien-mois" href="compte/paiement.html?formule=${id}&amp;periode=mois">Abonnement mensuel</a>
      </article>`).join("\n      ")}
    </div>

    <p class="note-source abo-promo">Vous avez un code promo ? Vous le saisissez à l'étape du paiement : la réduction s'applique au prix mensuel ou annuel, selon le code.</p>

    ${paiementComplet() ? `<p class="reserve reserve-ok" style="margin-top:var(--t5)">
      <strong>Paiement en ligne, sécurisé par Stripe.</strong>
      Par carte bancaire ou par prélèvement SEPA, chaque année ou chaque mois.
      Vos coordonnées bancaires ne passent jamais par ce site.
      ${lienPaiement("portail") ? `Vous pouvez <a href="${esc(lienPaiement("portail"))}">gérer ou résilier votre abonnement</a> à tout moment.` : ""}
    </p>` : ""}
  </div>
</section>

${SITE.offreConsultant ? (() => {
  // L'offre consultant (3 novembre 2026, demandé par Axel) : la même grille
  // que consultants.html. Pas de paiement en ligne pour elle : l'abonnement
  // s'ouvre sur demande et la carte le dit.
  const O = OFFRE_CONSULTANT, direct = FORMULES[O.equivalent];
  return `<section class="section section-tein" id="consultants">
  <div class="enveloppe">
    <h2 class="titre-section">Nos offres consultant</h2>
    <p class="intro titre-section">Pour les consultants QSE qui accompagnent plusieurs entreprises : un prix par client et par mois.
    Plus vous suivez de clients, plus le prix est dégressif.</p>
    <div class="formules">
      ${O.paliers.map((p, k) => `<article class="formule${k === 1 ? " mise-en-avant" : ""}" data-paraitre>
        <span class="etiq nom-offre">${p.a ? `De ${p.de} à ${p.a} clients` : `${p.de} clients et plus`}</span>
        <p class="prix"><span class="grand">${esc(eur(p.mois))}</span> <span class="etiq">par client et par mois</span></p>
        <ul class="formule-donne">
          <li>La veille, le plan d'actions et le registre de conformité de chaque client</li>
          <li>L'espace consultant : le tableau de bord de tous vos clients (textes non lus, conformité, avancement du plan d'actions)</li>
          <li>${p.blanche ? "Votre marque : logo, nom, couleurs (en préparation)" : "Sans marque blanche (dès 6 clients)"}</li>
        </ul>
        <a class="bouton ${k === 1 ? "bouton-accent" : "bouton-sobre"}" href="compte/creer.html?type=cabinet">Créer mon compte consultant</a>
        <a class="lien-mois" href="demo/cabinet.html">Voir la démonstration</a>
      </article>`).join("\n      ")}
    </div>
    <p class="note-source" style="margin-top:var(--t4)">L'abonnement consultant s'ouvre sur demande, après la création de votre compte :
    le paiement en ligne n'est pas encore disponible pour cette offre. <a href="consultants.html">Tout savoir sur l'offre consultant</a>.</p>
  </div>
</section>
`;
})() : ""}
<section class="section" id="essayer">
  <div class="enveloppe">
    <h2 class="titre-section">Démarrer une démonstration gratuite</h2>

    <div class="essai" id="essai">
      <p class="rangee rangee-centre" style="margin-top:var(--t4)">
        <button type="button" class="bouton bouton-accent" id="entrer-demo">Entrer en démonstration</button>
      </p>
    </div>
  </div>
</section>`;

  return page({
    titre: `S'abonner | ${SITE.nom}`,
    description: "Trois formules de veille réglementaire, avec leurs prix affichés.",
    zone: "public", actif: "abonnement", corps
  });
}

/* --- Les comptes (Supabase, par assets/vigie.js et assets/compte.js) --------
   Quatre pages : se connecter, créer son compte, mot de passe oublié, et
   « Mon compte » — où arrivent aussi les liens reçus par courriel. */

/* Le message qui s'affiche si SITE.supabase.url est vide. */
const comptesFermes = () => `<p class="reserve" data-comptes-fermes hidden>
          <strong>Les comptes ne sont pas encore ouverts.</strong>
          Écrivez-nous à <a href="mailto:${esc(SITE.courriel)}">${esc(SITE.courriel)}</a>.
        </p>`;

/* Les formulaires de compte : aucun champ ne porte de « name » et l'envoi est
   en « post ». Si le script ne tournait pas, le navigateur enverrait le
   formulaire lui-même : ainsi, rien — surtout pas un mot de passe — ne peut
   finir dans l'adresse de la page ni dans l'historique. */
/* Les écrans d'accès (connexion, création de compte, mot de passe oublié),
   3 novembre 2026 : deux colonnes au bureau, le formulaire à droite et, à
   gauche, ce que l'on retrouve une fois connecté (rien qui ne soit pas déjà
   dans l'application). Au téléphone, le formulaire seul. */
function ecranAuth({ titre, sous, carte, pied = "", carteTitre = "Vos identifiants" }) {
  /* 4 novembre 2026 : sur le modèle des autres pages (Mon compte, Réglages) —
     le titre à gauche, puis des cartes : le formulaire et à côté ce que l'on
     retrouve dans son espace. */
  return `
<section class="section compte-page auth-uni">
  <div class="enveloppe">
    <div class="compte-tete">
      <div>
        <h1>${titre}</h1>
        ${sous ? `<p class="compte-connecte">${sous}</p>` : ""}
      </div>
    </div>
    <div class="auth-grille">
      <section class="rg-carte compte-carte" aria-label="${esc(carteTitre)}">
        <header class="rg-tete"><h2>${esc(carteTitre)}</h2></header>
        <div class="compte-corps">
          ${carte}
          ${pied}
        </div>
      </section>
      <aside class="rg-carte compte-carte auth-aside" aria-label="Votre espace">
        <ul class="auth-liste">
          <li><strong>Ma veille réglementaire</strong><span>Les textes qui s'appliquent à votre entreprise, par catégorie, avec leur source officielle.</span></li>
          <li><strong>Plan d'actions</strong><span>Les actions à mener, avec un délai, un responsable et leur validation.</span></li>
          <li><strong>Registre et conformité réglementaire</strong><span>L'évaluation de chaque texte et l'historique daté de vos décisions.</span></li>
        </ul>
        <p class="auth-note">Ne constitue pas un conseil juridique.</p>
      </aside>
    </div>
  </div>
</section>`;
}

function pageConnexion() {
  const corps = ecranAuth({
    titre: "Connexion",
    sous: "Accédez à votre espace de veille réglementaire.",
    carte: `<form class="carte-connexion auth-carte" id="form-connexion" method="post" novalidate>
        ${comptesFermes()}
        <div class="reserve" id="connexion-deja" hidden></div>

        <div id="connexion-champs">
          <div class="champ">
            <label for="courriel">Adresse électronique</label>
            <input type="email" id="courriel" autocomplete="username"
                   inputmode="email" placeholder="prenom@entreprise.fr" spellcheck="false" required>
          </div>

          <div class="champ">
            <div class="auth-libelle"><label for="motdepasse">Mot de passe</label>
              <a href="compte/oubli.html">Mot de passe oublié ?</a></div>
            <input type="password" id="motdepasse" autocomplete="current-password" required>
          </div>

          <button type="submit" class="bouton bouton-accent auth-bouton">Se connecter</button>
          <p class="etat-compte" id="etat-connexion" role="status"></p>
        </div>
      </form>`,
    pied: `<p class="auth-pied">Pas encore de compte ? <a href="compte/creer.html">Créer un compte</a></p>
      <p class="auth-pied auth-demo"><a href="abonnement.html#essayer">Essayer la démonstration, sans compte</a></p>`
  });

  return page({
    titre: `Connexion | ${SITE.nom}`,
    description: `Connexion à ${SITE.nom}, la veille réglementaire des PME.`,
    zone: "public", actif: "connexion", corps, scripts: ["assets/compte.js"], installation: false,
    attrsBody: ' data-page="connexion"', piedCourt: true   // la connexion et rien d'autre : seuls les liens légaux restent en bas
  });
}

/* Créer son compte : l'adresse et un mot de passe. Supabase envoie un lien de
   confirmation ; l'abonnement vient ensuite et c'est lui qui ouvre l'espace. */
function pageCreer() {
  const corps = ecranAuth({
    titre: "Créer votre compte",
    sous: `Le compte est gratuit ; votre espace de veille s'ouvre avec l'abonnement.`,
    carte: `<form class="carte-connexion auth-carte" id="form-creer" method="post" novalidate>
        <p class="reserve reserve-ok" id="creer-pour" hidden><strong>Compte consultant.</strong> Après la confirmation
        de votre adresse, vous nommerez votre cabinet ; vous y créerez ensuite l'espace de chacun de vos clients.</p>
        ${comptesFermes()}
        <div id="creer-champs">
          <div class="champ">
            <label for="c-courriel">Adresse électronique <span class="aide">professionnelle, de préférence</span></label>
            <input type="email" id="c-courriel" autocomplete="username" inputmode="email"
                   placeholder="prenom@entreprise.fr" spellcheck="false" required>
          </div>
          <div class="champ">
            <label for="c-motdepasse">Mot de passe <span class="aide">au moins 10 caractères</span></label>
            <input type="password" id="c-motdepasse" autocomplete="new-password" minlength="10" required>
          </div>
          <div class="champ">
            <label for="c-confirme">Confirmer le mot de passe</label>
            <input type="password" id="c-confirme" autocomplete="new-password" minlength="10" required>
          </div>
          <button type="submit" class="bouton bouton-accent auth-bouton">Créer mon compte</button>
          <p class="aide-bas">Votre adresse sert à vous connecter et à recevoir les liens de votre compte,
          rien d'autre. Voir la <a href="../confidentialite.html">politique de confidentialité</a>.</p>
        </div>
        <div class="reserve" id="creer-envoye" tabindex="-1" hidden>
          <p><strong>Plus qu'une étape : ouvrez votre boîte de réception.</strong></p>
          <p>Un lien de confirmation vient de partir à <strong id="creer-adresse"></strong>.
          Cliquez dessus : votre compte est alors actif et vous arrivez dans votre espace.</p>
          <p>Rien reçu après quelques minutes ? Regardez dans les courriels indésirables.
          <span id="creer-renvoi"></span></p>
          <p>Cette adresse a déjà un compte ? <a href="../connexion.html">Connectez-vous</a>.</p>
        </div>
        <p class="etat-compte" id="etat-creer" role="status"></p>
      </form>`,
    pied: `<p class="auth-pied">Déjà un compte ? <a href="../connexion.html">Se connecter</a></p>`
  });

  return page({ titre: `Créer un compte | ${SITE.nom}`, description: `Créer votre compte ${SITE.nom}.`,
    racine: "../", zone: "public", corps, scripts: ["assets/compte.js"], installation: false, piedCourt: true });
}

/* Mot de passe oublié : on reçoit un lien par courriel. */
function pageOubli() {
  const corps = ecranAuth({
    titre: "Mot de passe oublié",
    carteTitre: "Recevoir un lien",
    sous: `Saisissez votre adresse : vous recevrez un lien, valable une heure, pour choisir un nouveau mot de passe.`,
    carte: `<form class="carte-connexion auth-carte" id="form-oubli" method="post" novalidate>
        ${comptesFermes()}
        <div class="champ">
          <label for="o-courriel">Adresse électronique</label>
          <input type="email" id="o-courriel" autocomplete="username" inputmode="email" spellcheck="false" required>
        </div>
        <button type="submit" class="bouton bouton-accent auth-bouton">Envoyer le lien</button>
        <p class="etat-compte" id="etat-oubli" role="status"></p>
      </form>`,
    pied: `<p class="auth-pied"><a href="../connexion.html">Revenir à la connexion</a></p>`
  });

  return page({ titre: `Mot de passe oublié | ${SITE.nom}`, description: "Recevoir un lien pour choisir un nouveau mot de passe.",
    racine: "../", zone: "public", corps, scripts: ["assets/compte.js"], installation: false, piedCourt: true });
}

/* « Mon compte ». Tout est caché au départ : compte.js montre ce qui
   correspond à la situation — le choix d'un nouveau mot de passe si l'on
   arrive par le lien « oublié », sinon le compte. Sans session, il renvoie à
   la connexion. */
function pageMonCompte() {
  const formules = Object.fromEntries(Object.entries(FORMULES).map(([id, f]) => [id, { l: f.l, rang: f.rang }]));
  const corps = `
<section class="section compte-page">
  <div class="enveloppe">
    <div class="compte-tete">
      <div>
        <h1>Mon compte</h1>
        <p class="compte-connecte">Connecté avec <span class="compte-adresse" id="compte-adresse"></span></p>
        <p class="etat-compte" id="etat-compte" role="status">Un instant…</p>
      </div>
      <div class="compte-tete-actions">
        <a class="bouton bouton-sobre" id="compte-admin" href="admin.html" hidden>Espace administrateur</a>
        <button type="button" class="bouton bouton-sobre" id="compte-sortir">Se déconnecter</button>
      </div>
    </div>
    <div class="connexion connexion-seule">
      ${comptesFermes()}
      <p class="reserve annonce-compte" id="compte-annonce" role="status" hidden></p>

      <form class="carte-connexion" id="compte-nouveau" method="post" novalidate hidden>
        <h2>Choisir votre nouveau mot de passe</h2>
        <div class="champ">
          <label for="n-courriel">Adresse électronique</label>
          <input type="email" id="n-courriel" autocomplete="username" readonly>
        </div>
        <div class="champ">
          <label for="n-motdepasse">Nouveau mot de passe <span class="aide">au moins 10 caractères</span></label>
          <input type="password" id="n-motdepasse" autocomplete="new-password" minlength="10" required>
        </div>
        <div class="champ">
          <label for="n-confirme">Le même, une seconde fois</label>
          <input type="password" id="n-confirme" autocomplete="new-password" minlength="10" required>
        </div>
        <p class="rangee" style="margin-top:var(--t4)">
          <button type="submit" class="bouton bouton-accent bouton-large">Enregistrer</button>
        </p>
        <p class="etat-compte" id="etat-nouveau" role="status"></p>
      </form>

      <div id="compte-principal" data-formules="${esc(JSON.stringify(formules))}" hidden>
        <div class="compte-col">
        <section class="rg-carte compte-carte" aria-labelledby="cc-t-espace">
          <header class="rg-tete">
            <h2 id="cc-t-espace">Votre espace</h2>
            <p>L'entreprise ou le cabinet rattaché à votre compte.</p>
          </header>
          <div id="compte-entreprise" hidden>
            <div class="rg-ligne"><span class="rg-libelle">Entreprise</span><div class="rg-champ"><strong id="entreprise-nom"></strong></div></div>
            <div class="rg-ligne"><span class="rg-libelle">Votre rôle</span><div class="rg-champ"><span id="entreprise-role"></span></div></div>
            <div class="rg-ligne"><span class="rg-libelle">Formule</span><div class="rg-champ"><span id="entreprise-formule"></span></div></div>
            <div class="compte-corps compte-consultant" id="entreprise-consultant" hidden></div>
            <div class="compte-actions">
              <a class="bouton bouton-accent" id="entreprise-ouvrir" href="../app/" hidden>Ouvrir mon espace</a>
              <a class="bouton bouton-accent" id="entreprise-tarifs" href="../abonnement.html" hidden>Choisir ma formule</a>
            </div>
          </div>
          <div id="compte-cabinet" hidden>
            <div class="rg-ligne"><span class="rg-libelle">Cabinet</span><div class="rg-champ"><strong id="cabinet-nom"></strong></div></div>
            <div class="rg-ligne"><span class="rg-libelle">Abonnement</span><div class="rg-champ"><span id="cabinet-statut"></span></div></div>
            <div class="compte-actions"><a class="bouton bouton-accent" href="cabinet.html">Ouvrir l'espace consultant</a></div>
          </div>
          <div class="compte-corps">
          <form id="form-entreprise" method="post" novalidate hidden>
            <p><strong>Dernière étape : qui êtes-vous ?</strong> <span id="e-explique"></span></p>
            <fieldset class="champ choix-type">
              <legend>Vous êtes</legend>
              <label><input type="radio" name="e-type" value="entreprise" checked> Une entreprise
                <span class="aide">vous suivez votre propre veille</span></label>
              <label><input type="radio" name="e-type" value="cabinet"> Un cabinet de conseil QSE
                <span class="aide">vous suivez celle de vos clients</span></label>
            </fieldset>
            <div class="champ">
              <label for="e-nom" id="e-nom-l">Nom de l'entreprise</label>
              <input type="text" id="e-nom" autocomplete="organization" maxlength="200" required>
            </div>
            <p class="rangee" style="margin-top:var(--t4)">
              <button type="submit" class="bouton bouton-accent bouton-large">Enregistrer</button>
            </p>
            <p class="etat-compte" id="etat-entreprise" role="status"></p>
          </form>
          </div>
        </section>

        <section class="rg-carte compte-carte" id="compte-equipe" aria-labelledby="cc-t-equipe" hidden>
          <header class="rg-tete">
            <h2 id="cc-t-equipe">Votre équipe</h2>
            <p>Invitez un membre de votre équipe : il reçoit un lien pour créer son compte.</p>
          </header>
          <div class="compte-corps">
          <form id="form-inviter" class="form-inviter" method="post" novalidate hidden>
            <label class="cache-visuellement" for="i-courriel">Son adresse électronique</label>
            <input type="email" id="i-courriel" autocomplete="off" inputmode="email" spellcheck="false" required
                   placeholder="adresse@entreprise.fr">
            <button type="submit" class="bouton bouton-accent">Inviter</button>
          </form>
          <p class="etat-compte" id="etat-inviter" role="status"></p>
          <ul class="admin-comptes" id="equipe-liste"></ul>
          <div id="equipe-attente" hidden>
            <p class="compte-sous-titre">Invitations en attente</p>
            <ul class="admin-comptes" id="equipe-invitations"></ul>
          </div>
          <div class="reserve reserve-ok" id="invitation-lien" hidden>
            <p><strong>Envoyez-lui ce lien.</strong> Il est valable 7 jours et ne sert qu'une fois ; elle y créera
            son compte avec l'adresse <b id="i-pour"></b>.</p>
            <input type="text" id="i-lien" readonly aria-label="Le lien d'invitation">
            <p class="rangee" style="margin-top:var(--t3)">
              <button type="button" class="bouton bouton-accent" id="i-copier">Copier le lien</button>
              <a class="bouton bouton-sobre" id="i-mail" href="#">Écrire le courriel</a>
            </p>
          </div>
          </div>
        </section>
        </div>

        <section class="rg-carte compte-carte compte-reglages" aria-labelledby="cc-t-param">
          <header class="rg-tete">
            <h2 id="cc-t-param">Paramètres du compte</h2>
            <p>Votre mot de passe, votre adresse, vos e-mails, vos données personnelles.</p>
          </header>
          <div class="compte-corps compte-lignes">
        <details class="ligne-reglage">
          <summary><span>Mot de passe</span><span class="modifier">Modifier</span></summary>
          <form id="form-motdepasse" method="post" novalidate>
            <div class="champ">
              <label for="m-motdepasse">Nouveau mot de passe <span class="aide">au moins 10 caractères</span></label>
              <input type="password" id="m-motdepasse" autocomplete="new-password" minlength="10" required>
            </div>
            <div class="champ">
              <label for="m-confirme">Le même, une seconde fois</label>
              <input type="password" id="m-confirme" autocomplete="new-password" minlength="10" required>
            </div>
            <p class="rangee"><button type="submit" class="bouton bouton-sobre">Enregistrer</button></p>
            <p class="etat-compte" id="etat-motdepasse" role="status"></p>
          </form>
        </details>

        <details class="ligne-reglage">
          <summary><span>Adresse électronique</span><span class="modifier">Modifier</span></summary>
          <form id="form-adresse" method="post" novalidate>
            <div class="champ">
              <label for="a-courriel">Nouvelle adresse</label>
              <input type="email" id="a-courriel" autocomplete="email" inputmode="email" spellcheck="false" required>
            </div>
            <p class="rangee"><button type="submit" class="bouton bouton-sobre">Recevoir le lien de confirmation</button></p>
            <p class="etat-compte" id="etat-adresse" role="status"></p>
          </form>
        </details>

        <!-- Les e-mails (4 novembre 2026) : récapitulatif quotidien et rappels. -->
        <div class="ligne-reglage ligne-bascule">
          <label for="p-recap"><span class="lb-texte"><span>Récapitulatif quotidien par e-mail</span>
            <span class="lb-aide">Chaque matin, les textes parus qui touchent votre plan de veille, présentés comme le tableau « Ma veille réglementaire ». Aucun e-mail les jours sans nouveau texte.</span></span>
            <input type="checkbox" role="switch" id="p-recap" disabled></label>
        </div>
        <div class="ligne-reglage ligne-bascule">
          <label for="p-rappels"><span class="lb-texte"><span>Rappels des actions en retard</span>
            <span class="lb-aide">Un e-mail quand le délai d'une action du plan d'actions est dépassé, puis chaque semaine tant qu'elle n'est pas validée.</span></span>
            <input type="checkbox" role="switch" id="p-rappels" disabled></label>
        </div>
        <p class="etat-compte" id="etat-recap" role="status"></p>

        <!-- RGPD (4 novembre 2026) : chacun exerce ses droits lui-même. -->
        <details class="ligne-reglage">
          <summary><span>Mes données personnelles</span><span class="modifier">Télécharger</span></summary>
          <div class="rgpd-bloc">
            <p class="aide-bas">Tout ce que nous gardons sur vous : votre compte, vos entreprises et votre rôle,
            les invitations que vous avez envoyées et les entrées de registre que vous avez écrites, dans un fichier
            lisible (JSON). Le registre complet de votre entreprise s'exporte depuis « Registre et conformité
            réglementaire ».</p>
            <p class="rangee"><button type="button" class="bouton bouton-sobre" id="rgpd-exporter">Télécharger mes données</button></p>
            <p class="etat-compte" id="etat-exporter" role="status"></p>
          </div>
        </details>

        <details class="ligne-reglage" id="supprimer">
          <summary><span>Supprimer mon compte</span><span class="modifier">Supprimer</span></summary>
          <form id="form-supprimer" method="post" novalidate class="rgpd-bloc">
            <p class="aide-bas">Votre compte, votre profil et vos accès sont supprimés définitivement. Les entrées que
            vous avez écrites dans le registre de votre entreprise restent, avec votre nom : c'est la preuve datée de
            l'entreprise. Si vous êtes le seul administrateur d'une entreprise ou d'un cabinet où d'autres
            travaillent, nommez d'abord un autre administrateur.</p>
            <div class="champ">
              <label for="s-courriel">Pour confirmer, saisissez votre adresse électronique</label>
              <input type="email" id="s-courriel" autocomplete="off" inputmode="email" spellcheck="false" required>
            </div>
            <p class="rangee"><button type="submit" class="bouton bouton-sobre bouton-danger">Supprimer définitivement mon compte</button></p>
            <p class="etat-compte" id="etat-supprimer" role="status"></p>
          </form>
        </details>
          </div>
        </section>
      </div>
      </div>
    </div>
  </div>
</section>`;
  return page({ titre: `Mon compte | ${SITE.nom}`, description: `Votre compte ${SITE.nom}.`,
    racine: "../", zone: "public", corps, attrsBody: ' data-page="compte"', scripts: ["assets/compte.js"], installation: false, piedCourt: true });
}

/* --- Le paiement (3 novembre 2026, demandé par Axel) -------------------------
   Derrière chaque bouton « S'abonner » : le récapitulatif de l'offre, les deux
   moyens de paiement (carte bancaire, prélèvement SEPA), le compte et
   l'entreprise auxquels l'abonnement se rattache, l'acceptation des CGV.
   Puis la page de paiement de Stripe, où le client choisit carte ou
   prélèvement : ses coordonnées bancaires ne passent jamais par ce site.
   L'identifiant de l'entreprise part avec (client_reference_id) : le robot
   outils/stripe.mjs s'en sert pour ouvrir la formule dans la base. */
function pageSouscrire() {
  const donnees = {
    formules: Object.fromEntries(Object.entries(FORMULES).map(([id, f]) => [id, {
      l: f.carte || f.l, court: f.l, an: eur(f.an), mois: eur(f.mois), montantAn: f.an, montantMois: f.mois, offre: f.offre }])),
    liens: Object.fromEntries(Object.keys(FORMULES).map((id) => [id, { an: lienPaiement(id, "an"), mois: lienPaiement(id, "mois") }])),
    tva: SITE.tva, mention: TVA.mention, courriel: SITE.courriel, portail: lienPaiement("portail")
  };
  const corps = `
<section class="section compte-page">
  <div class="enveloppe">
    <div class="compte-tete">
      <p class="fil"><a href="../abonnement.html">← Nos offres</a></p>
      <h1>Votre abonnement</h1>
      <p class="etat-compte" id="paie-etat" role="status"></p>
    </div>
    <div class="connexion connexion-seule" id="paiement" data-paiement="${esc(JSON.stringify(donnees))}">
      ${comptesFermes()}

      <div class="carte-connexion" id="paie-merci" hidden>
        <h2>Merci, votre paiement est enregistré</h2>
        <p>Votre formule s'ouvre dans les minutes qui suivent, dès que Stripe nous confirme le paiement.
        Par prélèvement SEPA, la confirmation peut prendre quelques jours ouvrés. Vous recevez la facture par courriel.</p>
        <p class="rangee" style="margin-top:var(--t4)"><a class="bouton bouton-accent" href="./">Mon compte</a></p>
      </div>

      <div id="paie-formulaire">
      <div class="carte-connexion">
        <h2>Récapitulatif</h2>
        <p class="paie-offre" id="paie-offre"></p>
        <div class="paie-periodes" role="radiogroup" aria-label="Durée">
          <label class="paie-periode"><input type="radio" name="paie-periode" value="an">
            <span><strong>Annuel</strong><span class="precision" id="paie-prix-an"></span><span class="pastille-offre" id="paie-offert"></span></span></label>
          <label class="paie-periode"><input type="radio" name="paie-periode" value="mois">
            <span><strong>Mensuel</strong><span class="precision" id="paie-prix-mois"></span></span></label>
        </div>
        <dl class="paie-total" id="paie-total"></dl>
        <form class="paie-promo" id="paie-promo" novalidate>
          <label for="paie-code">Code promo</label>
          <div class="paie-promo-ligne">
            <input type="text" id="paie-code" maxlength="40" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Votre code">
            <button type="submit" class="bouton bouton-sobre">Appliquer</button>
          </div>
          <p class="precision" id="paie-promo-dit" role="status"></p>
        </form>
        <p class="precision">Renouvelé automatiquement à chaque échéance ; résiliable à tout moment pour l'échéance suivante.</p>
      </div>

      <div class="carte-connexion">
        <h2>Moyen de paiement</h2>
        <ul class="paie-moyens">
          <li><span class="paie-icone" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h3"/></svg></span>
            <span><strong>Carte bancaire</strong><span class="precision">CB, Visa, Mastercard. Débitée à chaque échéance.</span></span></li>
          <li><span class="paie-icone" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10 12 4l9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/></svg></span>
            <span><strong>Prélèvement SEPA</strong><span class="precision">Avec l'IBAN de l'entreprise ; le mandat se signe en ligne.</span></span></li>
        </ul>
        <p class="precision">Vous choisissez l'un ou l'autre à l'étape suivante, sur la page sécurisée de notre prestataire de paiement, Stripe.
        Vos coordonnées bancaires ne passent jamais par ce site.</p>
      </div>

      <div class="carte-connexion">
        <h2>Entreprise abonnée</h2>
        <div id="paie-compte"><p class="precision">Un instant…</p></div>
      </div>

      <div class="carte-connexion">
        <label class="paie-cgv"><input type="checkbox" id="paie-cgv">
          <span>J'ai lu et j'accepte les <a href="../cgv.html" target="_blank" rel="noopener">conditions générales de vente</a>.</span></label>
        <p class="rangee" style="margin-top:var(--t4)">
          <a class="bouton bouton-accent bouton-large" id="paie-payer" href="#" aria-disabled="true">Continuer vers le paiement sécurisé</a>
        </p>
        <p class="etat-compte" id="paie-dit" role="status"></p>
      </div>
      </div>
    </div>
  </div>
</section>`;
  return page({ titre: `Votre abonnement | ${SITE.nom}`, description: "Paiement de l'abonnement, par carte ou par prélèvement.",
    racine: "../", zone: "public", corps, attrsBody: ' data-page="compte"', scripts: ["assets/compte.js", "assets/souscrire.js"],
    installation: false, piedCourt: true });
}

/* Le lien d'invitation mène ici (compte/invitation.html#jeton=…). Le jeton
   est après le « # » : il ne part dans aucune requête et n'apparaît dans
   aucun journal de serveur. */
function pageInvitation() {
  const corps = `
<section class="heros heros-court">
  <div class="enveloppe">
    <div class="heros-texte"><h1>Invitation</h1></div>
    <p class="heros-sous etat-compte" id="etat-invitation" role="status">Lecture de l'invitation…</p>
  </div>
</section>
<section class="section">
  <div class="enveloppe">
    <div class="connexion connexion-seule">
      ${comptesFermes()}
      <div class="carte-connexion" id="invitation-carte" hidden>
        <p class="etiq">Vigie — veille réglementaire</p>
        <h2 id="invitation-titre"></h2>
        <p id="invitation-texte"></p>
        <p class="rangee" id="invitation-actions" style="margin-top:var(--t4)"></p>
      </div>
    </div>
  </div>
</section>`;
  return page({ titre: `Invitation | ${SITE.nom}`, description: `Rejoindre une entreprise sur ${SITE.nom}.`,
    racine: "../", zone: "public", corps, scripts: ["assets/compte.js"], installation: false, piedCourt: true });
}

/* Mon cabinet (compte/cabinet.html) : la page du consultant. Ses clients,
   où ils en sont, en ajouter un, inviter son responsable, entrer chez lui.
   La base ne lui donne que ses clients et seulement ceux qui l'autorisent
   (supabase/migrations/…_consultants.sql). */
/* L'espace consultant (3 novembre 2026) : un tableau de bord de tous ses
   clients — par société, les textes non lus, le pourcentage de conformité
   réglementaire et l'avancement du plan d'actions —, puis la gestion des
   clients (invitations, nouveau client). Les chiffres sont calculés par
   assets/compte.js à partir de cabinet_vue (migration 15). */
function tableauConsultant(lignes = "") {
  return `<dl class="compteurs cs-compteurs">
      <div><dt class="etiq">Sociétés suivies</dt><dd><span class="grand" id="cs-clients">—</span></dd></div>
      <div><dt class="etiq">Textes non lus</dt><dd><span class="grand" id="cs-non-lus">—</span><span class="precision">toutes sociétés</span></dd></div>
      <div><dt class="etiq">Conformité moyenne</dt><dd><span class="grand" id="cs-conformite">—</span><span class="precision">des textes applicables</span></dd></div>
      <div><dt class="etiq">Plan d'actions</dt><dd><span class="grand" id="cs-avancement">—</span><span class="precision">des actions réalisées</span></dd></div>
    </dl>
    <div class="cs-cadre">
      <table class="cs-tableau">
        <thead><tr><th scope="col">Société</th><th scope="col">Textes non lus</th><th scope="col">Conformité réglementaire</th><th scope="col">Avancement du plan d'actions</th><th scope="col">Ouvrir le compte</th></tr></thead>
        <tbody id="cs-lignes">${lignes}</tbody>
      </table>
    </div>`;
}

/* Une barre de pourcentage, avec le chiffre à côté. */
function barreCs(pct, detail = "") {
  if (pct == null) return `<span class="cs-vide">—</span>${detail ? `<span class="cs-detail">${detail}</span>` : ""}`;
  return `<span class="cs-barre" role="img" aria-label="${pct} %"><span style="width:${pct}%"></span></span><span class="cs-pct">${pct} %</span>${detail ? `<span class="cs-detail">${detail}</span>` : ""}`;
}

function pageCabinet() {
  const corps = `
<section class="section compte-page cs-page">
  <div class="enveloppe">
    <div class="cs-tete">
      <div>
        <p class="cs-sur">Espace consultant</p>
        <h1 id="cabinet-titre">Mon cabinet</h1>
        <p class="etat-compte" id="cabinet-etat" role="status">Chargement…</p>
      </div>
      <a class="bouton bouton-sobre" href="./">Mon compte</a>
    </div>
    ${comptesFermes()}
    <div class="connexion connexion-seule" id="cabinet-aucun" hidden>
      <div class="carte-connexion">
        <h2>Vous n'avez pas encore de cabinet</h2>
        <p>Il se crée en une ligne, dans votre compte : choisissez « Un cabinet de conseil QSE » et donnez son nom.</p>
        <p class="rangee" style="margin-top:var(--t4)"><a class="bouton bouton-accent" href="./">Mon compte</a></p>
      </div>
    </div>
    <div id="cabinet-principal" data-contact="${esc(SITE.courriel)}" hidden>
      <div class="reserve" id="cabinet-inactif" hidden>
        <p><strong>Votre abonnement consultant n'est pas encore ouvert.</strong> Vous pouvez déjà créer l'espace
        de vos clients ; ils s'ouvrent avec l'abonnement.</p>
        <p class="rangee" style="margin-top:var(--t3)">
          <a class="bouton bouton-accent" id="cabinet-demander" href="mailto:${esc(SITE.courriel)}">Demander l'ouverture</a>
          <a class="bouton bouton-sobre" href="../abonnement.html#consultants">Voir les tarifs</a>
        </p>
      </div>
      <section id="cabinet-vos-clients" class="cs-bloc" aria-labelledby="cs-t-bord" hidden>
        <h2 id="cs-t-bord" class="cs-titre">Tableau de bord de vos clients</h2>
        ${tableauConsultant()}
        <p class="cs-note">Textes non lus : les textes du plan de veille qu'aucune personne de la société n'a encore
        ouverts. Conformité : la part des textes du plan évalués « conforme ». Plan d'actions : les actions
        réalisées sur les actions engagées. Un client qui a coupé votre accès n'affiche aucun chiffre.</p>
      </section>
      <section class="cs-bloc" aria-labelledby="cs-t-gerer">
        <h2 id="cs-t-gerer" class="cs-titre">Gérer vos clients</h2>
        <div class="admin-grille" id="cabinet-clients"></div>
        <form class="carte-connexion cs-ajout" id="form-client" method="post" novalidate>
          <h3>Ajouter un client</h3>
          <ol class="etapes-cabinet">
            <li>Créez son espace ici.</li>
            <li>Ouvrez-le pour régler son plan de veille (code APE, situations).</li>
            <li>Invitez son responsable : il crée son compte et voit tout. Il peut couper votre accès quand il veut.</li>
          </ol>
          <div class="champ">
            <label for="cl-nom">Nom de l'entreprise cliente</label>
            <input type="text" id="cl-nom" autocomplete="off" maxlength="200" required>
          </div>
          <p class="rangee"><button type="submit" class="bouton bouton-accent">Créer son espace</button></p>
          <p class="etat-compte" id="etat-client" role="status"></p>
        </form>
      </section>
    </div>
  </div>
</section>`;
  return page({ titre: `Espace consultant | ${SITE.nom}`, description: `Votre cabinet de conseil sur ${SITE.nom} : le tableau de bord de vos clients.`,
    racine: "../", zone: "public", corps, donneesPlan: true, scripts: ["assets/textes-plan.js", "assets/compte.js"], installation: false, piedCourt: true,
    attrsBody: ' data-page="cabinet"' });
}

/* La démonstration consultant (demo/cabinet.html) : la page « Mon cabinet »
   avec un cabinet et des clients fictifs (contenu/demo.js, DEMO.cabinet).
   Maçonnerie Vidal est l'entreprise du jeu d'essai : ses chiffres viennent de
   son registre et « Ouvrir son espace » entre dans la démonstration avec le
   bandeau consultant (assets/session.js). Rien n'y est enregistré. */
function pageCabinetDemo(V, D) {
  const C = D.cabinet, E = D.entreprise, planVidal = planDe(V, E);
  const jour = new Date().toISOString().slice(0, 10);
  const ouvertes = D.registre.filter((r) => r.type === "action" && !r.clos);
  const vidal = {
    denomination: E.nom, naf: E.nafComplet, cree_le: "2026-03-02", membres: 1, vidal: true,
    actions_ouvertes: ouvertes.length,
    actions_en_retard: ouvertes.filter((r) => r.echeance && r.echeance < jour).length,
    derniere_trace: D.registre.map((r) => r.date).sort().pop(),
    textes: TEXTES_CLES.filter(([, ids]) => ids.split(" ").some((id) => planVidal.liste.includes(id))).length,
    conformes: 0, actions_faites: D.registre.filter((r) => r.type === "action" && r.clos).length
  };
  vidal.non_lus = vidal.textes;
  // Celui qui s'ouvre d'abord : c'est lui qu'on vient essayer.
  const clients = [vidal, ...C.clients];
  const pl = (n, un, plus) => `${n} ${n > 1 ? plus : un}`;
  const carte = (c) => {
    const tete = `<h3>${esc(c.denomination)}</h3>
        <p class="admin-details">Espace créé le ${dateFr(c.cree_le)} · code APE ${esc(c.naf)}</p>`;
    if (c.acces === false) {
      return `<article class="carte-connexion admin-entreprise">${tete}
        <p>Ce client a coupé votre accès : vous ne voyez plus son espace. Lui seul peut le rouvrir, depuis son compte.</p></article>`;
    }
    const actions = c.actions_ouvertes
      ? `<strong>${pl(c.actions_ouvertes, "action ouverte", "actions ouvertes")}</strong>${c.actions_en_retard ? `, dont <span class="admin-alerte">${c.actions_en_retard} en retard</span>` : ""}.`
      : "Aucune action ouverte.";
    const compte = c.membres
      ? `<p class="admin-details">${pl(c.membres, "personne de l'entreprise a", "personnes de l'entreprise ont")} un compte.</p>`
      : `<p>Votre client n'a pas encore de compte : invitez son responsable.</p>
        <p class="admin-details">Avec votre compte, vous créez ici son lien d'invitation, à copier ou à envoyer par courriel.</p>`;
    const ouvrir = c.vidal
      ? `<a class="bouton bouton-accent" href="index.html" data-demo-consultant="${esc(C.nom)}" data-demo-client="${esc(E.nom)}">Ouvrir son espace</a>`
      : `<span class="admin-details">Dans la démonstration, seul l'espace de ${esc(E.nom)} s'ouvre.</span>`;
    return `<article class="carte-connexion admin-entreprise">${tete}
        <p class="admin-details">${c.derniere_trace ? `Dernière trace au registre le ${dateFr(c.derniere_trace)}.` : "Rien au registre pour l'instant."}</p>
        ${compte}
        <p class="rangee" style="margin-top:var(--t3)">${ouvrir}</p>
      </article>`;
  };
  const retard = clients.filter((c) => c.actions_en_retard).length;
  const pct = (a, b) => (b ? Math.round(a / b * 100) : null);
  const vus = clients.filter((c) => c.acces !== false);
  const lignes = clients.map((c) => {
    const nom = `<th scope="row"><span class="cs-nom">${esc(c.denomination)}</span><span class="cs-detail">Code APE ${esc(c.naf)}</span></th>`;
    if (c.acces === false) return `<tr>${nom}<td class="cs-coupe" colspan="3">Accès coupé par le client</td><td class="cs-ouvrir"></td></tr>`;
    const eng = c.actions_faites + c.actions_ouvertes;
    return `<tr>${nom}
      <td data-titre="Textes non lus"><span class="cs-nombre${c.non_lus ? " cs-attention" : ""}">${c.non_lus}</span><span class="cs-detail">sur ${c.textes} textes</span></td>
      <td data-titre="Conformité réglementaire">${barreCs(pct(c.conformes, c.textes))}</td>
      <td data-titre="Avancement du plan d'actions"${c.actions_en_retard ? ' class="cs-retard"' : ""}>${barreCs(pct(c.actions_faites, eng), eng ? `${c.actions_faites} sur ${eng}${c.actions_en_retard ? ` · ${c.actions_en_retard} en retard` : ""}` : "Aucune action engagée")}</td>
      <td class="cs-ouvrir">${c.vidal ? `<ul class="cs-liens">${[["index.html", "Tableau de bord"], ["plan.html", "Veille réglementaire"], ["actions.html", "Plan d'actions"], ["conformite.html", "Registre de conformité"]]
        .map(([u, l]) => `<li><a href="${u}" data-demo-consultant="${esc(C.nom)}" data-demo-client="${esc(E.nom)}">${l}</a></li>`).join("")}</ul>` : '<span class="cs-detail">Démonstration : seul Maçonnerie Vidal s\'ouvre</span>'}</td></tr>`;
  }).join("");
  const somme = (k) => vus.reduce((t, c) => t + (c[k] || 0), 0);
  const moyConf = Math.round(vus.reduce((t, c) => t + pct(c.conformes, c.textes), 0) / vus.length);
  const tableau = tableauConsultant(lignes)
    .replace('id="cs-clients">—', `id="cs-clients">${clients.length}`)
    .replace('id="cs-non-lus">—', `id="cs-non-lus">${somme("non_lus")}`)
    .replace('id="cs-conformite">—', `id="cs-conformite">${moyConf} %`)
    .replace('id="cs-avancement">—', `id="cs-avancement">${pct(somme("actions_faites"), somme("actions_faites") + somme("actions_ouvertes")) ?? "—"}${somme("actions_faites") + somme("actions_ouvertes") ? " %" : ""}`);
  const corps = `
<p class="bandeau-demo"><strong>Démonstration consultant.</strong> Le cabinet et ses clients sont fictifs ;
  rien de ce que vous faites ici n'est enregistré. <a href="../compte/creer.html?type=cabinet">Créer mon compte consultant</a> ·
  <a href="../consultants.html">L'offre consultants</a></p>
<section class="section compte-page cs-page">
  <div class="enveloppe">
    <div class="cs-tete">
      <div>
        <p class="cs-sur">Espace consultant</p>
        <h1>${esc(C.nom)}</h1>
        <p class="etat-compte">${pl(clients.length, "client", "clients")}${retard ? ` — ${pl(retard, "avec des actions en retard", "avec des actions en retard")}.` : ", aucun en retard."}</p>
      </div>
    </div>
    <section class="cs-bloc" aria-labelledby="cs-t-bord">
      <h2 id="cs-t-bord" class="cs-titre">Tableau de bord de vos clients</h2>
      ${tableau}
      <p class="cs-note">Démonstration : les chiffres des sociétés autres que ${esc(E.nom)} sont fictifs. Textes non lus : les textes
      du plan de veille qu'aucune personne de la société n'a encore ouverts. Conformité : la part des textes du plan évalués
      « conforme ». Plan d'actions : les actions réalisées sur les actions engagées.</p>
    </section>
    <section class="cs-bloc" aria-labelledby="cs-t-gerer">
    <h2 id="cs-t-gerer" class="cs-titre">Gérer vos clients</h2>
    <div class="admin-grille">${clients.map(carte).join("")}</div>
    <div class="carte-connexion cs-ajout">
      <h3>Ajouter un client</h3>
      <ol class="etapes-cabinet">
        <li>Créez son espace ici.</li>
        <li>Ouvrez-le pour régler son plan de veille (code APE, situations).</li>
        <li>Invitez son responsable : il crée son compte et voit tout. Il peut couper votre accès quand il veut.</li>
      </ol>
      <p>Dans la démonstration, on n'ajoute pas de client : cela se fait avec votre compte consultant.</p>
      <p class="rangee" style="margin-top:var(--t4)">
        <a class="bouton bouton-accent" href="../compte/creer.html?type=cabinet">Créer mon compte consultant</a>
      </p>
    </div>
    </section>
  </div>
</section>`;
  return page({ titre: `Démonstration consultant | ${SITE.nom}`,
    description: "La page d'un cabinet de conseil sur Vigie : ses clients, où ils en sont, leur espace. Démonstration avec des données fictives.",
    racine: "../", zone: "public", corps, scripts: ["assets/session.js"], installation: false, piedCourt: true,
    attrsBody: ' data-page="cabinet"' });
}

/* L'administration du service, pour l'administrateur seul : la base refuse
   les données à tout autre compte (supabase/migrations/…_administration.sql).
   Les entreprises, leur formule, leurs comptes — jamais leurs registres. */
function pageAdmin() {
  const formules = Object.fromEntries(Object.entries(FORMULES).map(([id, f]) => [id, { l: f.l, rang: f.rang }]));
  const corps = `
<section class="section compte-page">
  <div class="enveloppe admin-enveloppe">
    <div class="compte-tete admin-tete">
      <div>
        <h1>Espace administrateur</h1>
        <p class="etat-compte" id="admin-etat" role="status">Chargement…</p>
      </div>
      <a class="bouton bouton-accent" id="admin-app" href="../app/" hidden>Ouvrir l'application</a>
    </div>
    ${comptesFermes()}
    <div id="admin-liste" data-formules="${esc(JSON.stringify(formules))}" hidden>
      <p class="aide-bas admin-rappel">Les registres, plans et réponses des clients n'apparaissent jamais ici :
      la base ne les donne pas à l'administrateur. Une formule « donnée par vous » ne touche jamais un abonnement payé chez Stripe.</p>
      <section class="admin-stats" id="admin-stats" aria-labelledby="admin-stats-titre" hidden>
        <div class="admin-stats-tete">
          <h2 class="titre-section" id="admin-stats-titre">Fréquentation et abonnements</h2>
          <div class="admin-periode" role="group" aria-label="Période">
            <button type="button" data-jours="30" aria-pressed="false">30 jours</button>
            <button type="button" data-jours="90" aria-pressed="true">90 jours</button>
            <button type="button" data-jours="365" aria-pressed="false">1 an</button>
          </div>
        </div>
        <dl class="admin-tuiles">
          <div><dt>Connectés aujourd'hui</dt><dd id="st-auj">—</dd></div>
          <div><dt>Comptes actifs sur 30 jours</dt><dd id="st-30">—</dd></div>
          <div><dt>Abonnements actifs</dt><dd id="st-abos">—</dd></div>
          <div><dt>Comptes créés</dt><dd id="st-comptes">—</dd></div>
        </dl>
        <div class="admin-graphes">
          <figure class="admin-graphe carte-connexion">
            <figcaption><strong>Connexions par jour</strong><span>Comptes différents connectés chaque jour</span></figcaption>
            <div class="graphe" id="graphe-connexions"></div>
          </figure>
          <figure class="admin-graphe carte-connexion">
            <figcaption><strong>Abonnements actifs</strong><span>Nombre d'abonnements en cours, jour après jour</span></figcaption>
            <div class="graphe" id="graphe-abonnements"></div>
          </figure>
        </div>
        <p class="aide-bas" id="st-formules"></p>
        <details class="admin-chiffres"><summary>Voir les chiffres jour par jour</summary><div class="defile-tableau"><table class="tableau-plan" id="st-table"></table></div></details>
        <p class="aide-bas">Les connexions sont comptées depuis le 4 novembre 2026 : avant, seule la dernière connexion de chaque compte était connue.
        Un compte connecté plusieurs fois le même jour compte pour un.</p>
      </section>
      <h2 class="titre-section">Les messages reçus</h2>
      <p class="aide-bas" id="admin-messages-etat">Ceux du formulaire de contact de l'accueil.</p>
      <div class="carte-connexion"><ul class="admin-comptes" id="admin-messages"></ul></div>
      <h2 class="titre-section">Les entreprises</h2>
      <div class="admin-grille" id="admin-entreprises"></div>
      ${Object.values(NORMES).flat().length ? `<h2 class="titre-section">Les normes de référence, à valider</h2>
      <p class="aide-bas">Proposées par l'assistant, par sujet. Rien ne s'affiche chez les clients avant validation :
      passer « valide » à true dans contenu/normes.js, après relecture de la référence et de l'intitulé.</p>
      <div class="carte-connexion"><ul class="admin-comptes">${Object.entries(NORMES).flatMap(([id, l]) => l.map((x) =>
        `<li class="admin-compte"><span class="admin-courriel">${esc(x.ref)} — ${esc(x.titre)}</span>
        <span class="admin-details">Sujet : ${esc(id)} · ${x.valide ? "validée, affichée" : "à valider, pas affichée"}</span></li>`)).join("")}</ul></div>` : ""}
      <h2 class="titre-section">Les cabinets de conseil</h2>
      <p class="aide-bas">Tant que le paiement en ligne n'existe pas, c'est ici qu'on ouvre l'abonnement consultant
      d'un cabinet : tous ses clients ont alors la veille complète.</p>
      <div class="admin-grille" id="admin-cabinets"></div>
      <h2 class="titre-section">Le robot de collecte</h2>
      <p class="aide-bas" id="admin-robot-etat">Les derniers passages, du plus récent au plus ancien. Un passage
      « en alerte » a été mené au bout, mais quelque chose y est anormal : c'est écrit dessous.</p>
      <div class="carte-connexion"><ul class="admin-comptes admin-collectes" id="admin-collectes"></ul></div>
      <h2 class="titre-section">Les conseils de l'IA</h2>
      <p class="aide-bas" id="admin-conseils-etat">Demandés à Perplexity seulement pour les textes qui touchent le plan d'un
      client en formule Textes et suivi ou Veille complète. Ci-dessous, ceux où l'IA estime que le texte ne concerne pas
      le sujet où le robot l'a rangé : à revoir par Clément. Rien n'est retiré du relevé sans lui.</p>
      <div class="carte-connexion"><ul class="admin-comptes" id="admin-conseils"></ul></div>
      <h2 class="titre-section">Les comptes sans entreprise</h2>
      <p class="aide-bas">Inscrits, mais qui n'ont pas encore nommé leur entreprise.</p>
      <div class="carte-connexion"><ul class="admin-comptes" id="admin-seuls"></ul></div>
      <p class="rangee rangee-centre" style="margin-top:var(--t5)">
        <a class="bouton bouton-sobre" href="./">Mon compte</a>
      </p>
    </div>
  </div>
</section>`;
  return page({ titre: `Espace administrateur | ${SITE.nom}`, description: "Espace administrateur du service.",
    racine: "../", zone: "public", corps, attrsBody: ' data-page="admin"', scripts: ["assets/compte.js", "assets/admin-stats.js"], installation: false, piedCourt: true });
}

/* --- Ne plus recevoir un e-mail (4 novembre 2026) ----------------------------
   Le lien en bas du récapitulatif quotidien et des rappels : un clic suffit,
   sans connexion (le jeton de l'e-mail). */
function pageRecap() {
  const corps = `
<section class="section compte-page">
  <div class="enveloppe" style="max-width:40rem">
    <div class="carte-connexion recap-carte" id="recap" aria-live="polite">
      <h1>Vos e-mails</h1>
      <p id="recap-etat">Un instant…</p>
      <p class="rangee" style="margin-top:var(--t4)">
        <a class="bouton bouton-sobre" href="./">Régler mes e-mails dans Mon compte</a>
      </p>
    </div>
  </div>
</section>`;
  return page({ titre: `Vos e-mails | ${SITE.nom}`, description: "Ne plus recevoir le récapitulatif quotidien ou les rappels.",
    racine: "../", zone: "public", corps, scripts: ["assets/recap.js"], installation: false, piedCourt: true });
}

/* --- Les avis : de quoi alimenter la cloche ------------------------------- */
/* Le relevé complet est engendré dans deux pages seulement ; la cloche, elle,
   vit sur tous les écrans. On en extrait donc le strict nécessaire — moins de
   deux kilo-octets — plutôt que de charger le référentiel partout. */
function donneesAvis(V, D, C, JO) {
  /* Un article de code qui bouge est une alerte, au même titre qu'un texte qui
     paraît : c'est ce que l'abonné paie. La cloche les mélange, triés par date. */
  /* La date de l'avis est celle où nous l'avons vu, pas celle où l'article a
     pris effet : c'est la première qui dit « c'est nouveau pour vous ». La
     seconde est dans le texte de l'avis, parce qu'elle commande le délai. */
  /* Chaque avis mène à la fiche du texte : on y trouve le texte lui-même et
     ce qu'il faut faire. C'est ce que l'abonné vient chercher en cliquant. */
  const ficheDuMorceau = (morceau) => {
    if (!C || !morceau) return "";
    const ref = Object.keys(C.perimetres).filter((r) => (C.perimetres[r] || []).indexOf(morceau) !== -1)[0];
    return ref ? `texte/${slug(ref)}.html` : `code/${morceau}.html`;
  };

  const codes = !C ? [] : (C.changements || []).map((c) => ({
    k: `code:${c.morceau}:${c.num}:${C.preleve}`, v: `${C.preleve}T00:00:00Z`,
    d: C.preleve,
    t: `Article ${c.num} — ${c.codeTitre || "code suivi"}`,
    q: (c.quoi === "modifie"
      ? `Le texte a changé : « … ${String(c.apres || "").slice(0, 110)} … »`
      : c.quoi === "nouveau" ? "Vous concerne désormais." : "Ne vous concerne plus.") +
      (c.depuis ? ` En vigueur depuis le ${dateFr(c.depuis)}.` : ""),
    dom: c.codeTitre || "Codes suivis",
    u: ficheDuMorceau(c.morceau),
    s: "a-analyser", p: 1
  }));

  /* Les textes officiels relevés : la cloche ne garde que ceux du plan de
     l'entreprise (ds : leurs sujets), vus par le robot après le début du suivi
     (v : première vue) et pas encore ouverts. Chacun mène à sa ligne du relevé. */
  const textes = !(JO && JO.textes) ? [] : JO.textes.map((t) => {
    const actions = t.domaines.flatMap((x) => (V.domaines[x.id] || {}).actions || []);
    return {
      k: cleJO(t), v: t.vuA || `${t.vuLe || t.date}T00:00:00Z`, d: t.dateTexte || t.date,
      t: String(t.titre).slice(0, 180), q: actions.length ? `En premier : ${actions[0]}` : "À connaître, rien à faire.",
      dom: t.domaines.slice(0, 2).map((x) => x.nom).join(" · "), ds: t.domaines.map((x) => x.id),
      u: "plan.html"
    };
  });
  const avis = textes.concat(codes).sort((a, b) => (a.v < b.v ? 1 : a.v > b.v ? -1 : (a.d < b.d ? 1 : -1)));
  /* La démonstration : le plan de Maçonnerie Vidal et « depuis » une semaine
     avant la dernière relève, pour qu'il y ait quelque chose à montrer. */
  const fin = JO && JO.releve_le ? JO.releve_le : new Date().toISOString().slice(0, 10);
  const depuis = new Date(Date.parse(fin + "T00:00:00Z") - 7 * 86400000).toISOString().slice(0, 19) + "Z";
  return "/* Engendré par build.mjs — ne pas modifier à la main. */\n" +
         "window.AVIS = " + JSON.stringify(avis) + ";\n" +
         "window.AVIS_DEMO = " + JSON.stringify({ plan: planDe(V, D.entreprise).liste, depuis }) + ";\n";
}

/* --- Les données du simulateur --------------------------------------------- */
/* Le référentiel complet pèse 75 Ko : trop pour l'accueil. On n'y envoie que ce
   dont le calcul a besoin — nom, famille et rythme des domaines, périmètre de
   base de chaque division, questions de contexte. */
function donneesPlan(V, METIERS) {
  const f = {};
  Object.keys(V.frequences).forEach((id) => { f[id] = { l: V.frequences[id].l, ordre: V.frequences[id].ordre }; });

  const d = {};
  Object.keys(V.domaines).forEach((id) => {
    const cl = V.classements[V.domaines[id].classement] ? V.domaines[id].classement : "metier";
    d[id] = { n: V.domaines[id].nom, f: V.domaines[id].frequence, c: cl };
  });

  const div = {};
  V.divisions.forEach((x) => {
    div[x.c] = { l: x.l, s: x.s, u: `${x.c}-${slug(x.l)}`, b: perimetre(V, x.c).base };
  });

  const q = V.declencheurs.map((x) => ({ id: x.id, q: x.q, d: x.d, dom: x.domaines }));

  const mots = {};
  Object.keys(METIERS).forEach((c) => { mots[c] = METIERS[c].slice(0, 8); });

  return "/* Engendré par build.mjs — ne pas modifier à la main. */\n" +
         "window.PLAN = " + JSON.stringify({ f, d, div, q, mots }) + ";\n";
}

/* ==========================================================================
   Garde-fous et construction
   ========================================================================== */
function verifie(V, PIEGES, METIERS, D, TEXTES) {
  if (!V) throw new Error("Référentiel introuvable : assets/referentiel.js n'expose rien.");
  if (V.divisions.length !== 88) throw new Error(`Divisions NAF : ${V.divisions.length}, 88 attendues.`);
  if (V.sections.length !== 21) throw new Error(`Sections NAF : ${V.sections.length}, 21 attendues.`);
  if (Object.keys(V.domaines).length < 40) throw new Error("Référentiel appauvri : moins de 40 domaines.");

  const cites = [...V.transversaux, ...Object.values(V.parDivision).flat(),
                 ...V.declencheurs.flatMap((q) => q.domaines)];
  const cassees = [...new Set(cites.filter((id) => !V.domaines[id]))];
  if (cassees.length) throw new Error(`Domaines cités mais absents : ${cassees.join(", ")}.`);

  const freqInconnues = Object.keys(V.domaines).filter((id) => !V.frequences[V.domaines[id].frequence]);
  if (freqInconnues.length) throw new Error(`Fréquences invalides : ${freqInconnues.join(", ")}.`);

  for (const [nom, table] of [["Pièges", PIEGES], ["Mots du métier", METIERS]]) {
    const inconnues = Object.keys(table).filter((c) => !V.divisions.some((d) => d.c === c));
    if (inconnues.length) throw new Error(`${nom} rattachés à des divisions inexistantes : ${inconnues.join(", ")}.`);
  }

  // Chaque référence citée doit avoir sa fiche et chaque fiche doit se
  // rattacher à une référence : sans ces deux contrôles, un renommage dans le
  // référentiel laisserait des liens vers des pages inexistantes.
  const refs = [...new Set(Object.values(V.domaines).flatMap((d) => d.textes))];
  const sansFiche = refs.filter((r) => !TEXTES[r]);
  if (sansFiche.length) throw new Error(`Textes sans fiche : ${sansFiche.join(" | ")}.`);
  const orphelines = Object.keys(TEXTES).filter((r) => refs.indexOf(r) === -1);
  if (orphelines.length) throw new Error(`Fiches sans référence : ${orphelines.join(" | ")}.`);
  const mal = Object.keys(TEXTES).filter((r) =>
    !TEXTES[r].nature || !Array.isArray(TEXTES[r].exige) || !TEXTES[r].exige.length);
  if (mal.length) throw new Error(`Fiches incomplètes : ${mal.join(" | ")}.`);
  const adressesTextes = refs.map((r) => slug(r));
  const doublonsTextes = adressesTextes.filter((n, i) => adressesTextes.indexOf(n) !== i);
  if (doublonsTextes.length) throw new Error(`Adresses de texte en double : ${[...new Set(doublonsTextes)].join(", ")}.`);

  const noms = V.divisions.map((d) => `${d.c}-${slug(d.l)}`);
  const doublons = noms.filter((n, i) => noms.indexOf(n) !== i);
  if (doublons.length) throw new Error(`Adresses en double : ${[...new Set(doublons)].join(", ")}.`);

  // Le jeu de démonstration doit rester cohérent avec le référentiel, sinon
  // l'application affiche des domaines qui n'existent pas.
  if (!V.divisions.some((d) => d.c === D.entreprise.naf)) {
    throw new Error(`Démonstration : division ${D.entreprise.naf} inconnue du référentiel.`);
  }
  const qInconnues = D.entreprise.contexte.filter((q) => !V.declencheurs.some((x) => x.id === q));
  if (qInconnues.length) throw new Error(`Démonstration : questions inconnues — ${qInconnues.join(", ")}.`);
  const dInconnus = D.releve.map((t) => t.domaine).filter((id) => !V.domaines[id]);
  if (dInconnus.length) throw new Error(`Démonstration : domaines inconnus dans le relevé — ${[...new Set(dInconnus)].join(", ")}.`);
  const sInconnus = D.releve.map((t) => t.statut).filter((s) => !STATUTS[s]);
  if (sInconnus.length) throw new Error(`Démonstration : statuts inconnus — ${[...new Set(sInconnus)].join(", ")}.`);
}

/* Chaque texte de référence doit mener quelque part de précis. Si une
   référence n'a ni code reconnu, ni numéro européen, ni ligne dans
   contenu/liens.js, elle retomberait sur une recherche — c'est-à-dire sur du
   travail rendu au client. On refuse de publier ça. */
function verifieLiens(TEXTES, C, LIENS) {
  const orphelines = Object.keys(TEXTES).filter((ref) => lienDuTexte(C, LIENS, ref).orphelin);
  if (orphelines.length)
    throw new Error(`Textes sans destination officielle (ajouter une ligne dans ` +
      `contenu/liens.js) : ${orphelines.join(" | ")}`);

  const inconnues = Object.keys(LIENS).filter((ref) => !TEXTES[ref]);
  if (inconnues.length)
    throw new Error(`contenu/liens.js cite des références qui n'existent pas : ${inconnues.join(" | ")}`);

  for (const [ref, l] of Object.entries(LIENS)) {
    if (!l.quoi) throw new Error(`contenu/liens.js : « ${ref} » ne dit pas ce qu'on va trouver.`);
    if (l.url) {
      try { new URL(l.url); } catch (e) { throw new Error(`contenu/liens.js : adresse invalide pour « ${ref} ».`); }
      if (!/^https:/.test(l.url)) throw new Error(`contenu/liens.js : « ${ref} » n'est pas en https.`);
    } else if (!l.code) {
      throw new Error(`contenu/liens.js : « ${ref} » n'a ni « url » ni « code ».`);
    }
  }
}

/* La nomenclature est engendrée, donc à vérifier comme le reste : un code APE
   qui ne retombe sur aucune division enverrait le client sur une page absente. */
function verifieNaf(V, NAF) {
  if (!NAF || !Array.isArray(NAF.codes) || NAF.codes.length < 700)
    throw new Error(`contenu/naf.js : ${NAF && NAF.codes ? NAF.codes.length : 0} codes APE, 732 attendus.`);

  const divisions = new Set(V.divisions.map((d) => d.c));
  const orphelins = NAF.codes.filter((c) => !divisions.has(c.d));
  if (orphelins.length)
    throw new Error(`Codes APE sans division dans le référentiel : ` +
      `${orphelins.slice(0, 5).map((c) => `${c.c} → ${c.d}`).join(", ")}` +
      `${orphelins.length > 5 ? ` (et ${orphelins.length - 5} autres)` : ""}`);

  const vus = new Set();
  for (const c of NAF.codes) {
    if (!/^\d{2}\.\d{2}[A-Z]$/.test(c.c))
      throw new Error(`Code APE mal formé : « ${c.c} ».`);
    if (vus.has(c.c)) throw new Error(`Code APE en double : ${c.c}.`);
    vus.add(c.c);
    if (!c.l) throw new Error(`Code APE sans intitulé : ${c.c}.`);
  }

  const sansCode = V.divisions.filter((d) => !NAF.codes.some((c) => c.d === d.c));
  if (sansCode.length)
    throw new Error(`Divisions sans aucun code APE : ${sansCode.map((d) => d.c).join(", ")}.`);
}

/* Le texte des codes est relevé par un robot et posé dans la page sans être
   réécrit : il faut donc vérifier ce qu'on reçoit avant de le publier. Un
   périmètre qui ne tombe sur rien, un morceau vide, une balise qui n'a rien à
   faire là : on s'arrête, on ne publie pas. */
function verifieCodes(TEXTES, C) {
  if (!Array.isArray(C.morceaux) || !C.morceaux.length)
    throw new Error("contenu/codes.json : aucun morceau de code.");

  const inconnues = Object.keys(C.perimetres).filter((r) => !TEXTES[r]);
  if (inconnues.length)
    throw new Error(`Périmètre sur une référence qui n'existe pas : ${inconnues.join(" | ")}`);

  const vus = new Set();
  for (const m of C.morceaux) {
    if (!/^[a-z0-9-]+$/.test(m.id))
      throw new Error(`Morceau de code : « ${m.id} » ne fait pas un nom de fichier.`);
    if (vus.has(m.id)) throw new Error(`Deux morceaux de code portent l'identifiant ${m.id}.`);
    vus.add(m.id);
    if (!m.articles.length) throw new Error(`Morceau de code ${m.id} : aucun article.`);
    if (!m.chemin || m.chemin.length < 2) throw new Error(`Morceau de code ${m.id} : chemin trop court.`);
    for (const a of m.articles) {
      if (!a.num || !a.html) throw new Error(`Morceau ${m.id} : un article sans numéro ou sans texte.`);
      const suspect = a.html.match(/<\s*(script|style|iframe|a|img|form|input)\b/i) ||
                      a.html.match(/\son[a-z]+\s*=/i) || a.html.match(/<[a-z]+\s+[a-z-]+=/i);
      if (suspect)
        throw new Error(`Article ${a.num} : le texte relevé contient « ${suspect[0]} », ` +
                        "ce qui ne passe pas le nettoyage d'outils/codes.mjs.");
    }
  }

  const perdus = Object.entries(C.perimetres)
    .flatMap(([r, ids]) => ids.filter((id) => !vus.has(id)).map((id) => `${r} → ${id}`));
  if (perdus.length) throw new Error(`Périmètre qui pointe un morceau absent : ${perdus.join(" | ")}`);

  const sans = Object.entries(C.perimetres).filter(([, ids]) => !ids.length).map(([r]) => r);
  if (sans.length) throw new Error(`Périmètre vide : ${sans.join(" | ")}`);
}


async function poids(chemin) {
  const s = await stat(chemin);
  if (!s.isDirectory()) return s.size;
  let total = 0;
  for (const e of await readdir(chemin, { withFileTypes: true })) total += await poids(join(chemin, e.name));
  return total;
}

/* --- La démonstration, à part ----------------------------------------------
   /app/ est l'espace des abonnés : assets/session.js y exige une session
   Supabase et une formule. La démonstration en est une copie exacte sous
   /demo/, ouverte à tous, avec le jeu d'essai. Les liens d'une page de démo vers une autre restent dans
   /demo/ : on réécrit « ../app/ » en « ../demo/ ». */
async function copieDemo() {
  const source = join(SORTIE, "app"), cible = join(SORTIE, "demo");
  await cp(source, cible, { recursive: true });
  async function reecrit(d) {
    for (const e of await readdir(d, { withFileTypes: true })) {
      const f = join(d, e.name);
      if (e.isDirectory()) { await reecrit(f); continue; }
      if (!e.name.endsWith(".html")) continue;
      const h = await readFile(f, "utf8");
      await writeFile(f, h.replace(/(href|src)="((?:\.\.\/)+)app\//g, '$1="$2demo/'));
    }
  }
  await reecrit(cible);
}

async function main() {
  const V = await chargeFichier("assets/referentiel.js", "VEILLE");
  const PIEGES = await chargeFichier("contenu/pieges.js", "PIEGES");
  const METIERS = await chargeFichier("contenu/metiers.js", "METIERS");
  const D = await chargeFichier("contenu/demo.js", "DEMO");
  const TEXTES = await chargeFichier("contenu/textes.js", "TEXTES");
  FICHES = TEXTES || {};

  // Le relevé officiel n'existe que si outils/jorf.mjs a tourné. Son absence
  // n'empêche pas de construire : la page le dit et montre le jeu d'essai.
  const cheminJO = resolve(RACINE, "contenu/veille-releve.json");
  const JO = existsSync(cheminJO) ? JSON.parse(await readFile(cheminJO, "utf8")) : null;
  /* Le texte des sources, en clair : un relevé fait avant le nouveau nettoyage
     (outils/tri.mjs) pouvait garder du HTML encodé. */
  if (JO && JO.textes) {
    JO.textes = JO.textes.map((t) => ({ ...t, titre: texteBrut(t.titre), corps: texteBrut(t.corps || ""),
      nota: t.nota ? texteBrut(t.nota) : t.nota }));
  }

  // Le texte des codes n'existe que si outils/codes.mjs a tourné. Son absence
  // n'empêche pas de construire : les fiches gardent leur lien et le disent.
  // La nomenclature NAF entière : 732 codes APE. Son absence n'empêche pas de
  // construire — la page des secteurs retombe sur les 88 divisions seules.
  const LIENS = await chargeFichier("contenu/liens.js", "LIENS");
  if (existsSync(resolve(RACINE, "contenu/normes.js"))) {
    NORMES = await chargeFichier("contenu/normes.js", "NORMES") || {};
    const V0 = await chargeFichier("assets/referentiel.js", "VEILLE");
    for (const id of Object.keys(NORMES)) if (!V0.domaines[id]) throw new Error(`contenu/normes.js : « ${id} » n'est pas un sujet du référentiel.`);
    const n = Object.values(NORMES).flat(), ok = n.filter((x) => x.valide).length;
    console.log(`Normes : ${n.length} proposées, ${ok} validées (seules celles-ci s'affichent).`);
  }

  const SOURCES = await chargeFichier("contenu/sources.js", "SOURCES");
  NON_OFFICIELLES = new Set(SOURCES.filter((x) => x.officielle === false).map((x) => x.id));

  // Les liens de paiement : publics par nature, mais jamais une clé Stripe.
  if (existsSync(resolve(RACINE, "contenu/paiement.js"))) {
    PAIEMENT = await chargeFichier("contenu/paiement.js", "PAIEMENT") || {};
    const liens = Object.entries(PAIEMENT).flatMap(([id, v]) =>
      typeof v === "string" ? [[id, v]] : Object.entries(v || {}).map(([periode, url]) => [`${id}.${periode}`, url]));
    for (const [id, url] of liens) {
      if (!url) continue;
      if (/\b(sk|pk|rk)_(live|test)_/.test(url)) throw new Error(`contenu/paiement.js : « ${id} » contient une clé Stripe. Ne mettre que des liens.`);
      const attendu = id === "portail" ? "https://billing.stripe.com/" : "https://buy.stripe.com/";
      if (!url.startsWith(attendu)) throw new Error(`contenu/paiement.js : le lien « ${id} » doit commencer par ${attendu}`);
    }
  }

  // Les avis des clients : de vrais avis seulement, publiés avec leur accord.
  const AVIS = existsSync(resolve(RACINE, "contenu/temoignages.js"))
    ? await chargeFichier("contenu/temoignages.js", "TEMOIGNAGES") : [];
  AVIS.forEach((a, k) => {
    if (!a || !a.nom || !a.texte) throw new Error(`contenu/temoignages.js : l'avis n° ${k + 1} n'a pas de nom ou de texte.`);
    if (a.note != null && !(Number.isInteger(a.note) && a.note >= 1 && a.note <= 5))
      throw new Error(`contenu/temoignages.js : la note de l'avis n° ${k + 1} doit aller de 1 à 5.`);
  });

  const cheminNaf = resolve(RACINE, "contenu/naf.js");
  const NAF = existsSync(cheminNaf) ? await chargeFichier("contenu/naf.js", "NAF") : null;
  if (NAF) verifieNaf(V, NAF);

  const cheminCodes = resolve(RACINE, "contenu/codes.json");
  const C = existsSync(cheminCodes) ? JSON.parse(await readFile(cheminCodes, "utf8")) : null;
  if (C) verifieCodes(TEXTES, C);
  verifieLiens(TEXTES, C, LIENS);
  verifie(V, PIEGES, METIERS, D, TEXTES);

  // Les écrans de l'accueil sont de vraies captures de l'application, prises
  // par outils/captures.mjs. Tant qu'elles n'existent pas, la page le dit au
  // lieu d'afficher une image cassée.
  const dossierEcrans = resolve(RACINE, "assets/ecrans");
  const ECRANS = existsSync(dossierEcrans) ? await readdir(dossierEcrans) : [];

  await rm(SORTIE, { recursive: true, force: true });
  await mkdir(join(SORTIE, "app", "secteur"), { recursive: true });
  await mkdir(join(SORTIE, "app", "texte"), { recursive: true });
  await mkdir(join(SORTIE, "app", "code"), { recursive: true });
  await cp(resolve(RACINE, "assets"), join(SORTIE, "assets"), { recursive: true });

  const plan = donneesPlan(V, METIERS);
  await writeFile(join(SORTIE, "assets", "plan-data.js"), plan);
  const avis = donneesAvis(V, D, C, JO);
  await writeFile(join(SORTIE, "assets", "avis-data.js"), avis);

  // Le manifeste et le service worker vivent à la racine : un worker servi
  // depuis assets/ ne contrôlerait que assets/.
  await writeFile(join(SORTIE, "manifest.webmanifest"), MANIFESTE);

  // Le cache du service worker est nommé d'après l'empreinte de l'habillage.
  // Une empreinte stable évite de purger le cache pour rien ; une empreinte
  // qui change purge tout et c'est ce qui fait qu'une publication atteint
  // les visiteurs déjà venus.
  /* Tout ce que les pages chargent avec « ?v= » doit entrer dans l'empreinte :
     sans amorce.js ni les données des alertes, un changement de l'un d'eux
     restait servi dans son ancienne version. */
  const habillage = ["site.css", "polices.css", "app.js", "theme.js", "amorce.js",
                     "session.js", "entreprise.js", "avis.js", "referentiel.js", "compte.js", "vigie.js",
                     "magasin.js", "espace.js"];
  const empreinte = createHash("sha256");
  for (const f of habillage) empreinte.update(await readFile(join(SORTIE, "assets", f)));
  empreinte.update(plan);
  empreinte.update(avis);
  const version = empreinte.digest("hex").slice(0, 12);
  VERSION = version;
  const worker = (await readFile(resolve(RACINE, "sw.js"), "utf8")).replaceAll("__EMPREINTE__", version);
  if (worker.includes("__EMPREINTE__")) throw new Error("sw.js : l'empreinte n'a pas été posée.");
  await writeFile(join(SORTIE, "sw.js"), worker);

  /* Un repère pour savoir, depuis l'extérieur, quelle version est réellement
     en ligne. Netlify pose COMMIT_REF à la construction ; on le recopie tel
     quel. Sans lui — construction sur un poste — on écrit « local », ce qui
     est l'information honnête. C'est ce fichier que lit
     .github/workflows/verifie-en-ligne.yml pour dire si le site publié est
     bien celui du dernier commit, ou s'il est resté en arrière. */
  await writeFile(join(SORTIE, "version.txt"),
    `${process.env.COMMIT_REF || "local"}\n${new Date().toISOString()}\n`);
  console.log(`  cache du worker     pco-${version}`);

  await writeFile(join(SORTIE, "index.html"), pageAccueil(V, D, METIERS, ECRANS, C, NAF, SOURCES, AVIS, JO));
  await writeFile(join(SORTIE, "le-site.html"), pageInfos({
    titre: "Le site en détail", h1: "Le site en détail",
    sous: "D'où viennent les textes, ce que vous voyez pour chacun, comment le tri se fait et ce que vous gardez.",
    encarts: encartsDuSite(V, C, NAF, SOURCES),
    suite: `<a class="bouton bouton-accent" href="decouvrir.html">Comment ça marche, en dessins</a>
      <a class="bouton bouton-sobre" href="index.html#simulateur">Voir ce qui me concerne</a>`
  }));
  await writeFile(join(SORTIE, "nous.html"), pageInfos({
    titre: "Qui sommes-nous", h1: "Qui sommes-nous",
    sous: `${esc(SITE.nom)}, la veille réglementaire des PME : qui l'a conçu, ce que vous achetez et les audits qu'il prépare.`,
    encarts: encartsDeNous(),
    suite: `<a class="bouton bouton-accent" href="mailto:${esc(SITE.courriel)}">${esc(SITE.courriel)}</a>
      ${lienTel("bouton bouton-sobre")}
      <a class="bouton bouton-sobre" href="abonnement.html">Les tarifs</a>`
  }));
  await writeFile(join(SORTIE, "metiers.html"), pageMetiers(V, NAF));
  if (SITE.offreConsultant) await writeFile(join(SORTIE, "consultants.html"), pageConsultants());
  for (const [fichier, html] of pagesLegales({ page, SITE, FORMULES, TVA, esc, eur }))
    await writeFile(join(SORTIE, fichier), html);
  await writeFile(join(SORTIE, "abonnement.html"), pageAbonnement(V));
  await writeFile(join(SORTIE, "decouvrir.html"), pageDecouvrir(V, ECRANS, C, NAF, SOURCES));
  await writeFile(join(SORTIE, "connexion.html"), pageConnexion());
  await writeFile(join(SORTIE, "contact.html"), pageContact());
  await mkdir(join(SORTIE, "compte"), { recursive: true });
  await writeFile(join(SORTIE, "compte", "index.html"), pageMonCompte());
  await writeFile(join(SORTIE, "compte", "creer.html"), pageCreer());
  await writeFile(join(SORTIE, "compte", "oubli.html"), pageOubli());
  await writeFile(join(SORTIE, "compte", "admin.html"), pageAdmin());
  await writeFile(join(SORTIE, "compte", "recap.html"), pageRecap());
  // Le nom de domaine du site (GitHub Pages) : vigie-reglementaire.fr.
  await writeFile(join(SORTIE, "CNAME"), new URL(SITE.adresseWeb).hostname + "\n");
  await writeFile(join(SORTIE, "compte", "paiement.html"), pageSouscrire());
  await writeFile(join(SORTIE, "compte", "cabinet.html"), pageCabinet());
  await writeFile(join(SORTIE, "compte", "invitation.html"), pageInvitation());

  await writeFile(join(SORTIE, "app", "index.html"), appTableauBord(V, D, C, LIENS));
  await writeFile(join(SORTIE, "app", "plan.html"), appPlan(V, D, C, LIENS, JO));
  await writeFile(join(SORTIE, "app", "conformite.html"), appConformite(V, D, C, LIENS, JO));
  await writeFile(join(SORTIE, "assets", "textes-plan.js"), "/* Les textes du plan de veille : [clé, sujets]. Engendré par build.mjs. */\nwindow.TEXTES_PLAN = " + JSON.stringify(TEXTES_CLES) + ";\n");
  await writeFile(join(SORTIE, "app", "actions.html"), appActions(V, D, C, LIENS, JO));
  await writeFile(join(SORTIE, "app", "releve.html"), renvoi("Relevé", "plan.html", "Ma veille réglementaire"));
  await writeFile(join(SORTIE, "app", "registre.html"), appRegistre());
  await writeFile(join(SORTIE, "app", "secteurs.html"), appSecteurs(V, METIERS, NAF));
  await writeFile(join(SORTIE, "app", "reglages.html"), appReglages(V, D, NAF, METIERS));

  // Une page par texte de référence. parTexte dit, pour chaque référence, les
  // domaines qui la citent : c'est ce qui permet de lister les secteurs
  // concernés sans recalculer 88 périmètres par page.
  const parTexte = {};
  Object.keys(V.domaines).forEach((id) => {
    V.domaines[id].textes.forEach((ref) => {
      (parTexte[ref] = parTexte[ref] || []).push(id);
    });
  });
  await writeFile(join(SORTIE, "app", "textes.html"), renvoi("Textes", "plan.html", "Ma veille réglementaire"));
  for (const ref of Object.keys(parTexte)) {
    await writeFile(join(SORTIE, "app", "texte", `${slug(ref)}.html`),
      appTexte(V, TEXTES, METIERS, C, LIENS, ref, TEXTES[ref], parTexte[ref]));
  }

  // Une page par morceau de code relevé : c'est là que le texte officiel se
  // lit en entier. Les voisines sont celles du même code, dans l'ordre de
  // l'arbre : on circule dans le code comme dans un code.
  if (C) {
    for (const m of C.morceaux) {
      const voisines = C.morceaux.filter((x) => x.code === m.code);
      const i = voisines.indexOf(m);
      const refs = Object.keys(C.perimetres).filter((r) => (C.perimetres[r] || []).indexOf(m.id) !== -1);
      await writeFile(join(SORTIE, "app", "code", `${m.id}.html`),
        appMorceauDeCode(C, m, refs, voisines[i - 1], voisines[i + 1]));
    }
  }

  for (const d of V.divisions) {
    await writeFile(join(SORTIE, "app", "secteur", `${d.c}-${slug(d.l)}.html`),
      appSecteur(V, PIEGES, METIERS, TEXTES, NAF, C, LIENS, d));
  }

  await copieDemo();
  if (SITE.offreConsultant) await writeFile(join(SORTIE, "demo", "cabinet.html"), pageCabinetDemo(V, D));

  const total = await poids(SORTIE);
  console.log(`  public              4 pages (accueil, comment ça marche, abonnement, connexion)`);
  console.log(`  app/                7 écrans + ${V.divisions.length} fiches de secteur + ${Object.keys(parTexte).length} fiches de texte`);
  console.log(`  assets/             ${((await poids(join(SORTIE, "assets"))) / 1024).toFixed(1)} Ko`);
  console.log(`  plan-data.js        ${(plan.length / 1024).toFixed(1)} Ko pour le simulateur`);
  console.log(`  écrans de l'accueil ${ECRANS.length ? ECRANS.length + " captures" : "AUCUNE — lancer outils/captures.mjs"}`);
  console.log(`  nomenclature NAF    ${NAF
    ? NAF.codes.length + " codes APE sur " + V.divisions.length + " divisions, relevés le " + NAF.releve
    : "AUCUNE — lancer outils/naf.mjs"}`);
  console.log(`  texte des codes     ${C
    ? C.morceaux.length + " pages, " + C.morceaux.reduce((n, m) => n + m.articles.length, 0) +
      " articles, " + C.codes.length + " codes, relevés le " + C.preleve +
      (C.changements.length ? " — " + C.changements.length + " changement(s)" : " — aucun changement")
    : "AUCUN — lancer outils/codes.mjs"}`);
  console.log(`  relève officielle   ${JO ? JO.textes.length + " entrées, relevées le " + JO.releve_le +
    " (" + JO.rapport.filter((r) => !r.souci).length + " sources ont répondu sur " + JO.rapport.length + ")"
    : "AUCUNE — lancer outils/veille.mjs (tourne toutes les heures dans .github/workflows/releve.yml)"}`);
  if (SITE.offreConsultant && !existsSync(join(SORTIE, "consultants.html")))
    throw new Error("SITE.offreConsultant est allumé, mais la page consultants.html n'existe pas : le bloc de l'accueil mènerait nulle part.");
  // Le référencement (4 novembre 2026) : adresse canonique de chaque page
  // publique, plan du site (sitemap.xml) et robots.txt pour les moteurs de
  // recherche. L'application, la démonstration et les pages de compte ne
  // sont pas à indexer.
  {
    const base = SITE.adresseWeb.replace(/\/?$/, "/");
    const pages = [];
    const parcourir = async (dossier) => {
      for (const e of await readdir(join(SORTIE, dossier), { withFileTypes: true })) {
        const rel = dossier ? `${dossier}/${e.name}` : e.name;
        if (e.isDirectory()) { if (!/^(assets|app|demo)$/.test(rel)) await parcourir(rel); continue; }
        if (!e.name.endsWith(".html")) continue;
        let html = await readFile(join(SORTIE, rel), "utf8");
        if (/http-equiv="refresh"/.test(html)) continue;
        // Le nom complet dans l'onglet et dans les résultats de recherche.
        html = html.replace(/(<title>[^<]*?)\| Vigie<\/title>/, "$1| Vigie réglementaire</title>")
                   .replace(/<title>Vigie — /, "<title>Vigie réglementaire — ");
        const prive = /^compte\//.test(rel) || rel === "connexion.html" || /name="robots"/.test(html);
        if (prive) {
          if (!/name="robots"/.test(html)) html = html.replace("<meta charset=\"utf-8\">", '<meta charset="utf-8">\n<meta name="robots" content="noindex">');
        } else {
          const url = base + (rel === "index.html" ? "" : rel);
          html = html.replace("</title>", `</title>\n<link rel="canonical" href="${url}">\n<meta property="og:url" content="${url}">`);
          pages.push(url);
        }
        await writeFile(join(SORTIE, rel), html);
      }
    };
    await parcourir("");
    const jour = new Date().toISOString().slice(0, 10);
    await writeFile(join(SORTIE, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.sort().map((u) => `  <url><loc>${esc(u)}</loc><lastmod>${jour}</lastmod>${u === base ? "<priority>1.0</priority>" : ""}</url>`).join("\n")}
</urlset>
`);
    await writeFile(join(SORTIE, "robots.txt"), `User-agent: *
Disallow: /app/
Disallow: /demo/
Disallow: /compte/

Sitemap: ${base}sitemap.xml
`);
    console.log(`  référencement       ${pages.length} pages dans sitemap.xml`);
  }
  const aCompleter = champsLegauxManquants(SITE);
  if (aCompleter.length) console.log(`  pages légales       À COMPLÉTER dans SITE.editeur : ${aCompleter.join(", ")}`);
  console.log(`\n_site/ prêt — ${(total / 1024).toFixed(1)} Ko, ` +
    `${V.divisions.length + Object.keys(parTexte).length + (C ? C.morceaux.length : 0) + 11} pages, ` +
    `${Object.keys(V.domaines).length} domaines, ${Object.keys(PIEGES).length} secteurs avec pièges.`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
