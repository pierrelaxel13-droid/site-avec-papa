#!/usr/bin/env node
/* ==========================================================================
   Assemble le site publiable dans _site/
   --------------------------------------------------------------------------
   Deux zones :

     public/   l'accueil qui montre les écrans, la tarification, la connexion
     app/      l'application : tableau de bord, plan, relevé, registre, et les
               88 fiches de secteur

   Tout est engendré depuis assets/referentiel.js et contenu/. Rien n'est écrit
   deux fois : un domaine corrigé se propage aux 88 fiches.

   AVERTISSEMENT TENU DANS LE CODE ET DANS LES PAGES
   L'application n'a pas de serveur. La « connexion » pose un jeton dans le
   navigateur et rien d'autre : ce n'est pas une sécurité, le contenu des pages
   de l'application est lisible par qui regarde la source. Les données sont un
   jeu de démonstration. Les deux faits sont écrits sur les écrans concernés,
   et doivent y rester tant qu'un vrai service d'authentification n'est pas en
   place.

   Usage : node build.mjs
   ========================================================================== */

import { cp, rm, mkdir, writeFile, readFile, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = dirname(fileURLToPath(import.meta.url));
const SORTIE = resolve(RACINE, "_site");

const SITE = {
  nom: "Pierrel & Co",
  bareme: "Veille réglementaire par secteur",
  ville: "Istres (13800)",
  zone: "Istres et pourtour de l'étang de Berre",
  courriel: "contact@pierrel-co.fr",
  telephone: "04 00 00 00 00",
  telephoneLien: "+33400000000"
};

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

/* --- Les trois formules, et ce que chacune ouvre ---------------------------- */
/* Le rang décide : une page demande un rang, la session en porte un. C'est la
   seule règle, et elle est appliquée dans le navigateur — donc contournable.
   Elle décrit le produit, elle ne le protège pas. */
const FORMULES = {
  cadrage: { l: "Cadrage", rang: 1, prix: "890 € une fois",
             ouvre: "Ce qui s'applique chez vous, et les 88 fiches de métier." },
  veille:  { l: "Veille tenue", rang: 2, prix: "180 € par mois",
             ouvre: "En plus : le tableau de bord et les textes qui paraissent." },
  preuves: { l: "Veille et preuves", rang: 3, prix: "290 € par mois",
             ouvre: "Tout, le registre de preuves compris." }
};

/* --- Le manifeste : ce qui rend l'application installable ------------------- */
/* Android veut du PNG en 192 et 512, et une icône « maskable » qu'il peut
   rogner jusqu'à 20 % du bord sans manger le dessin. assets/icones/ est
   engendré depuis le sigle par outils/icones.mjs. */
const MANIFESTE = JSON.stringify({
  name: "Pierrel & Co — veille réglementaire",
  short_name: "Pierrel & Co",
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
    { name: "Relevé des textes", url: "./app/releve.html" },
    { name: "Registre de preuves", url: "./app/registre.html" }
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
        <p class="intro">Posée sur l'écran d'accueil du téléphone, elle s'ouvre comme une
        application, et marche sans réseau — sur un chantier, dans un entrepôt.</p>
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
      Pierrel &amp; Co n'est ni sur l'App Store ni sur Google Play : il n'y a pas
      d'application à télécharger, mais une application web que le navigateur installe
      lui-même. Rien n'est transmis à une boutique, et il n'y a pas de compte à créer
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
   pas porter (le navigateur l'ignore et le signale). */
const POLITIQUE = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; " +
  "font-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'self'; frame-src 'none'; object-src 'none'; " +
  "base-uri 'none'; form-action 'self'; upgrade-insecure-requests";

function page({ titre, description, racine = "", zone = "public", actif = "", corps,
                attrsBody = "", verrou = false, donneesPlan = false, formule = "" }) {
  /* Les feuilles de style et les scripts portent la version de l'habillage :
     une page nouvelle ne peut plus être servie avec la feuille de style de la
     veille, gardée par le navigateur (une heure) ou par le service worker. */
  const a = (f) => racine + f + (VERSION && /\.(css|js)$/.test(f) ? `?v=${VERSION}` : "");
  const lien = (href, libelle, cle) =>
    `<a href="${a(href)}"${actif === cle ? ' aria-current="page"' : ""}>${libelle}</a>`;

  const menuPublic = `
      ${lien("index.html", "Le produit", "produit")}
      ${lien("abonnement.html", "S'abonner", "abonnement")}
      ${selecteurTheme}`;

  const menuApp = `
      ${lien("app/index.html", "Tableau de bord", "bord")}
      ${lien("app/plan.html", "Mon plan", "plan")}
      ${lien("app/releve.html", "Relevé", "releve")}
      ${lien("app/registre.html", "Registre", "registre")}
      ${lien("app/textes.html", "Textes", "textes")}
      ${lien("app/secteurs.html", "Secteurs", "secteurs")}
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
<link rel="icon" href="${a("assets/favicon.svg")}" type="image/svg+xml">
<link rel="apple-touch-icon" href="${a("assets/icones/icone-apple.png")}">
<link rel="manifest" href="${a("manifest.webmanifest")}">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Pierrel &amp; Co">
<link rel="preload" href="${a("assets/polices/plus-jakarta-sans.woff2")}" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${a("assets/polices.css")}">
<link rel="stylesheet" href="${a("assets/site.css")}">
<script src="${a("assets/theme.js")}"></script>
<script src="${a("assets/amorce.js")}"></script>
</head>
<body class="zone-${zone}" data-racine="${racine || "./"}"${formule ? ` data-formule="${esc(formule)}"` : ""}${attrsBody}>

<a class="evitement" href="#contenu">Aller au contenu</a>

<header class="bandeau">
  <div class="enveloppe bandeau-interieur">
    <a class="marque" href="${a(zone === "app" ? "app/index.html" : "index.html")}">
      ${sigle}<span>Pierrel <span class="co">&amp; Co</span></span>
    </a>
    ${zone === "public" ? `<a class="bouton bouton-sobre bouton-bandeau" href="${a("decouvrir.html")}"${actif === "decouvrir" ? ' aria-current="page"' : ""}>Comment ça marche</a>
    <a class="bouton bouton-bandeau" href="${a("connexion.html")}">Connexion</a>` : ""}
    ${zone === "app" ? `<div class="cloche-boite">
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

${zone === "app" ? `<p class="bandeau-demo">
  <strong>Démonstration.</strong>
  <span id="formule-active"></span>
  Les données ci-dessous sont un jeu d'essai (entreprise et textes fictifs).
  La connexion ne protège rien : elle pose un jeton dans votre navigateur, et le
  contenu de ces pages reste lisible dans la source. Un vrai compte suppose un
  service d'authentification, qui n'est pas encore en place.
  <a href="${a("connexion.html")}">Changer de formule</a> ·
  <a href="${a("index.html")}">Revenir au site</a>
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
      <a class="bouton bouton-accent" href="${a("connexion.html")}" id="verrou-action">Ouvrir la démonstration</a>
      <a class="bouton bouton-sobre" href="${a("abonnement.html")}">Voir les tarifs</a>
    </p>
  </div>
</section>` : ""}
${corps}
${zone === "public" ? bandeInstallation(a) : ""}
</main>

<footer class="pied">
  <div class="enveloppe">
    <div class="pied-grille">
      <div>
        <span class="marque">${sigle}<span>Pierrel <span class="co">&amp; Co</span></span></span>
        <p>${esc(SITE.bareme)}.<br>Conseil en organisation et conformité, ${esc(SITE.ville)}.</p>
        <p style="margin-top:var(--t3)">
          <a href="mailto:${esc(SITE.courriel)}">${esc(SITE.courriel)}</a><br>
          <a href="tel:${esc(SITE.telephoneLien)}">${esc(SITE.telephone)}</a>
        </p>
      </div>
      <div>
        <h2>Le site</h2>
        <ul>
          <li><a href="${a("index.html")}">Le produit</a></li>
          <li><a href="${a("decouvrir.html")}">Comment ça marche</a></li>
          <li><a href="${a("abonnement.html")}">S'abonner et voir les tarifs</a></li>
          <li><a href="${a("connexion.html")}">Connexion</a></li>
        </ul>
      </div>
      ${zone === "app" ? `<div>
        <h2>L'application</h2>
        <ul>
          <li><a href="${a("app/index.html")}">Tableau de bord</a></li>
          <li><a href="${a("app/plan.html")}">Mon plan de veille</a></li>
          <li><a href="${a("app/releve.html")}">Relevé des textes</a></li>
          <li><a href="${a("app/registre.html")}">Registre de preuves</a></li>
          <li><a href="${a("app/secteurs.html")}">Fiches par secteur</a></li>
          <li><a href="${a("app/reglages.html")}">Mon entreprise et mes alertes</a></li>
        </ul>
      </div>` : `<div>
        <h2>Le cabinet</h2>
        <!-- Les pages publiques servent à nous connaître, pas à entrer : on n'y
             entre que par « Connexion » ou « Démarrer un abonnement ». La
             colonne qui menait droit dans l'application dit donc qui nous
             sommes, et garde le pied symétrique, en quatre colonnes. -->
        <ul>
          <li><a href="${a("index.html")}#cabinet">Conseil en organisation et conformité</a></li>
          <li><a href="${a("index.html")}#cabinet">${esc(SITE.zone)}</a></li>
          <li><a href="${a("index.html")}#cabinet">Un interlocuteur, qui vient sur place</a></li>
          <li><a href="${a("abonnement.html")}">Prix affichés, sans devis</a></li>
        </ul>
      </div>`}
      <div>
        <h2>Sources officielles</h2>
        <ul>
          <li><a href="https://www.legifrance.gouv.fr" target="_blank" rel="noopener">Légifrance</a></li>
          <li><a href="https://www.legifrance.gouv.fr/jorf/jo" target="_blank" rel="noopener">Journal officiel</a></li>
          <li><a href="https://eur-lex.europa.eu" target="_blank" rel="noopener">EUR-Lex</a></li>
          <li><a href="https://entreprendre.service-public.fr" target="_blank" rel="noopener">Entreprendre</a></li>
          <li><a href="https://www.inrs.fr" target="_blank" rel="noopener">INRS</a></li>
        </ul>
      </div>
    </div>
    <div class="pied-bas">
      <p class="pied-legal">
        <span>© ${new Date().getFullYear()} ${esc(SITE.nom)} — tous droits réservés</span>
        <a href="${a("abonnement.html")}">Tarifs</a>
        <a href="mailto:${esc(SITE.courriel)}">Contact</a>
      </p>
      <p>
        Éditeur : ${esc(SITE.nom)}, Clément Pierrel, ${esc(SITE.ville)}.
        SIRET : à compléter. Hébergement : à compléter.
        Aucun cookie, aucune mesure d'audience, aucune requête vers un service tiers.
        Le service fournit un cadre méthodologique, pas un conseil juridique.
      </p>
    </div>
  </div>
</footer>

${donneesPlan ? `<script src="${a("assets/plan-data.js")}"></script>` : ""}
<script src="${a("assets/app.js")}"></script>
${zone === "app" ? `<script src="${a("assets/avis-data.js")}"></script>
<script src="${a("assets/entreprise.js")}"></script>
<script src="${a("assets/avis.js")}"></script>` : ""}
${zone === "app" || verrou || actif === "connexion" || actif === "abonnement" ? `<script src="${a("assets/session.js")}"></script>` : ""}
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

/* --- Fait, ou pas fait ------------------------------------------------------
   Pour chaque texte qui demande un geste, le client dit s'il l'a fait. Le
   bouton vit dans « Ce que vous devez faire » ; le titre de la fiche porte la
   marque « Fait » une fois coché, et la carte de la catégorie compte. Pour un
   sujet du plan, c'est la revue qui est faite, et elle se refait à son rythme
   (« periode », en jours). C'est gardé dans ce navigateur (app.js). */
function boutonFait(id, { periode = 0, libelle = "Marquer comme fait" } = {}) {
  return `<div class="bloc-fait" data-fait="${esc(id)}"${periode ? ` data-periode="${periode}"` : ""} data-libelle="${esc(libelle)}">
    <button type="button" class="bouton-fait" aria-pressed="false">
      <span class="fait-case" aria-hidden="true"></span><span class="fait-texte">${esc(libelle)}</span>
    </button>
    <span class="fait-quand" role="status"></span>
  </div>`;
}
const marqueFait = (id) => `<span class="marque-fait" data-etat-fait="${esc(id)}" hidden>Fait</span>`;
const JOURS_DE = { quotidienne: 1, hebdomadaire: 7, mensuelle: 31, trimestrielle: 92 };

function blocDomaine(C, LIENS, id, d, origine, lienSecteur = "", racine = "", fait = false) {
  return `<article class="bloc-domaine" id="domaine-${esc(id)}" data-domaine="${esc(id)}" data-origine="${origine}"${origine === "declencheur" || origine === "hors" ? " hidden" : ""}>
  <div class="bloc-domaine-tete">
    <h3>${esc(d.nom)}</h3>
    ${origine === "declencheur" ? '<span class="marque-ajout">ajouté par votre contexte</span>' : ""}
    ${fait ? marqueFait(`plan:${id}`) : ""}
  </div>
  <p class="bloc-domaine-resume">${esc(d.resume)}</p>
  ${fait ? boutonFait(`plan:${id}`, { periode: JOURS_DE[d.frequence] || 31, libelle: "Marquer la revue comme faite" }) : ""}
  <div class="bloc-domaine-corps">
    <div>
      <span class="etiq">Ce qu'il faut faire</span>
      <ul class="a-faire">${(d.actions || []).map((a) => `<li>${esc(a)}</li>`).join("")}</ul>
      <span class="etiq" style="margin-top:var(--t4)">Ce qu'il faut tenir</span>
      <ul>${d.obligations.map((o) => `<li>${esc(o)}</li>`).join("")}</ul>
    </div>
    <div>
      <span class="etiq">Les textes, et où les lire</span>
      <ul class="textes-lies">${d.textes.map((ref) => {
        const L = lienDuTexte(C, LIENS, ref);
        return `<li>
        <a href="${racine}texte/${slug(ref)}.html">${esc(ref)}</a>
        <a class="lien-officiel" href="${esc(L.url)}" target="_blank" rel="noopener"
           title="${esc(L.quoi)}">${esc(intituleDuLien(L))} ${sortant}</a></li>`;
      }).join("")}</ul>
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
      <li><a href="registre.html" title="Voir le registre de preuves">Suivi depuis ${esc(D.entreprise.depuis)}</a></li>
    </ul>
    <h1>${esc(titre)}</h1>
    ${chapeau ? `<p class="chapeau">${chapeau}</p>` : ""}
  </div>
</section>`;
}

/* Un lien qui couvre toute la carte. Posé dans le <dd> et non autour du couple
   <dt>/<dd> : à l'intérieur d'une <dl>, un <div> n'admet que des <dt> et des
   <dd>, et un <a> à cet endroit serait un balisage invalide. */
const lienCarte = (href, intitule) =>
  `<a class="lien-carte" href="${esc(href)}"><span class="cache-visuellement">${esc(intitule)}</span></a>`;

/* --- Tableau de bord ------------------------------------------------------- */
function appTableauBord(V, D, C, LIENS) {
  const aAnalyser = D.releve.filter((t) => t.statut === "a-analyser");
  const ouvertes = D.registre.filter((r) => r.echeance && !r.clos);
  const enRetard = D.echeances.filter((e) => e.retard);

  const fiche = ficheDeLEntreprise(V, D);
  const corps = enTeteApp(D, "Tableau de bord",
    "Ce qui attend une décision, ce qui arrive, et ce qui est en retard.", fiche) + `

${rubrique({ etiq: "À traiter", contenu: `
  <dl class="compteurs compteurs-liens">
    <div${enRetard.length ? ' class="alerte"' : ""}>
      <dt class="etiq">Revues en retard</dt>
      <dd><span class="grand">${enRetard.length}</span>
        ${enRetard.length ? `<span class="precision">${esc(enRetard.map((e) => e.frequence).join(", "))}</span>` : ""}
        ${lienCarte("plan.html", "Voir le plan de veille")}</dd>
    </div>
    <div><dt class="etiq">Textes à analyser</dt>
      <dd><span class="grand">${aAnalyser.length}</span>${lienCarte("releve.html", "Voir le relevé des textes")}</dd></div>
    <div><dt class="etiq">Actions ouvertes</dt>
      <dd><span class="grand">${ouvertes.length}</span>${lienCarte("registre.html", "Voir le registre de preuves")}</dd></div>
    <div><dt class="etiq">Textes relevés, 90 jours</dt>
      <dd><span class="grand">${D.releve.length}</span>${lienCarte("releve.html", "Voir le relevé des textes")}</dd></div>
  </dl>` })}

${aAnalyser.length ? rubrique({ etiq: "Ce qu'il faut faire maintenant", contenu: `
  <p class="lecture">Les textes qui attendent une décision, et le geste à faire pour
  chacun. Le texte officiel est au bout du lien : rien à chercher.</p>
  <ul class="conseils">
    ${aAnalyser.map((t) => {
      const d = V.domaines[t.domaine];
      if (!d) return "";
      const ref = d.textes[0];
      const L = lienDuTexte(C, LIENS, ref);
      return `<li>
      ${lienCarte(`texte/${slug(ref)}.html`, `Ouvrir la fiche : ${ref}`)}
      <p class="titre">${marqueFait(`essai:${slug(t.titre)}`)}${esc(t.titre)}</p>
      <p class="meta etiq">${esc(d.nom)}${t.priorite === "haute" ? " · prioritaire" : ""}</p>
      <ul class="a-faire">${(d.actions || []).slice(0, 3).map((a) => `<li>${esc(a)}</li>`).join("")}</ul>
      ${boutonFait(`essai:${slug(t.titre)}`)}
      <p class="note-source">
        <a href="texte/${slug(ref)}.html">${esc(ref)}</a> ·
        <a class="lien-officiel" href="${esc(L.url)}" target="_blank" rel="noopener"
           title="${esc(L.quoi)}">${esc(intituleDuLien(L))} ${sortant}</a>
      </p>
    </li>`; }).join("")}
  </ul>` }) : ""}

${rubrique({ etiq: "Prochaines revues", aplat: true, contenu: `
  <ul class="liste-echeances">
    ${D.echeances.map((e) => `<li${e.retard ? ' class="retard"' : ""}>
      <a href="plan.html">
        <span class="etiq">${esc(V.frequences[e.frequence] ? V.frequences[e.frequence].l : e.frequence)}</span>
        <span class="mono">${esc(dateFr(e.prochaine))}</span>
        ${e.retard ? '<span class="marque-ajout">en retard</span>' : ""}
        ${fleche}
      </a>
    </li>`).join("")}
  </ul>` })}

${rubrique({ etiq: "En attente de vous", contenu: `
  <p class="lecture">Les textes relevés qui n'ont pas encore été tranchés.</p>
  <ul class="liste-releve" style="margin-top:var(--t4)">
    ${aAnalyser.map((t) => ligneReleve(V, C, LIENS, t)).join("")}
  </ul>
  <p style="margin-top:var(--t4)"><a class="lien-fleche" href="releve.html">Voir tout le relevé ${fleche}</a></p>` })}

${rubrique({ etiq: "Dernières traces", aplat: true, contenu: `
  <p class="lecture">Ce qu'un auditeur regarderait en premier.</p>
  <ul class="liste-registre" style="margin-top:var(--t4)">
    ${D.registre.slice(0, 4).map((r) => ligneRegistre(r)).join("")}
  </ul>
  <p style="margin-top:var(--t4)"><a class="lien-fleche" href="registre.html">Voir tout le registre ${fleche}</a></p>` })}`;

  return page({
    titre: `Tableau de bord | ${SITE.nom}`,
    description: "Tableau de bord de la veille réglementaire.",
    racine: "../", zone: "app", actif: "bord", corps, verrou: true, formule: "veille"
  });
}

/* Une ligne de relevé s'ouvre sur ce qui la justifie : le domaine auquel elle
   est rattachée, ce qu'il faut y tenir, et les sources officielles où vérifier.
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
          ${boutonFait(idFait)}
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
        ${champ("État", r.clos ? "Close" : "Ouverte")}
      </dl>
      <p class="note-source">Une ligne du registre ne se modifie pas après coup : une
      correction s'ajoute à la suite, avec sa propre date, et celle-ci reste.</p>
      <p class="rangee" style="margin-top:var(--t4)">
        <button type="button" class="bouton bouton-sobre imprimer-fiche">${imprimante} Enregistrer en PDF</button>
      </p>
    </div>
  </details>
</li>`;
}

/* --- Mon plan --------------------------------------------------------------- */
function appPlan(V, D, C, LIENS) {
  const { base } = perimetre(V, D.entreprise.naf);
  const ajoutes = new Set();
  D.entreprise.contexte.forEach((qid) => {
    const q = V.declencheurs.filter((x) => x.id === qid)[0];
    if (q) q.domaines.forEach((id) => { if (V.domaines[id] && !base.includes(id)) ajoutes.add(id); });
  });

  const total = base.length + ajoutes.size;
  const contexteNoms = D.entreprise.contexte
    .map((qid) => (V.declencheurs.filter((x) => x.id === qid)[0] || {}).q).filter(Boolean);

  /* La page porte les 44 domaines, pas seulement ceux du jeu d'essai : c'est
     ce qui permet à « Mon entreprise » de la refaire sans recharger quoi que
     ce soit. Sans JavaScript, seuls ceux du périmètre sont visibles — les
     autres sont posés `hidden`, et rien ne manque à l'écran. */
  const parFrequence = Object.keys(V.frequences)
    .sort((a, b) => V.frequences[a].ordre - V.frequences[b].ordre)
    .map((fid) => ({
      id: fid, f: V.frequences[fid],
      ids: Object.keys(V.domaines).filter((id) => V.domaines[id].frequence === fid)
    }))
    .filter((g) => g.ids.length);

  const corps = enTeteApp(D, "Mon plan de veille",
    `Ce qui s'applique chez ${esc(D.entreprise.nom)} : ${total} sujets à suivre. Choisissez un rythme de revue : vous ne verrez que ses sujets.`,
    ficheDeLEntreprise(V, D)) + `

<section class="rubrique">
  <div class="enveloppe">
  ${cartesCategories(parFrequence.map((g) => {
    const ech = D.echeances.filter((e) => e.frequence === g.id)[0];
    const n = g.ids.filter((id) => base.includes(id) || ajoutes.has(id)).length;
    return {
      id: `frequence-${g.id}`, nom: g.f.l,
      compte: n ? `${n} sujet${n > 1 ? "s" : ""}` : "Aucun sujet à ce rythme",
      compteAttr: ` data-compte-frequence="${esc(g.id)}"`,
      classe: n ? "" : "carte-vide",
      attrs: n ? "" : ' aria-disabled="true" tabindex="-1"',
      marque: ech && ech.retard ? "En retard" : "",
      lignes: [esc(g.f.d),
               ech ? `Prochaine revue : ${esc(dateFr(ech.prochaine))}` : ""].filter(Boolean)
    };
  }))}
  ${aSavoir("Ce qui a servi à faire ce plan", `
  <dl class="faits">
    <div><dt class="etiq">Domaines suivis</dt><dd><span class="grand" id="plan-total">${total}</span></dd></div>
    <div><dt class="etiq">Code de l'entreprise</dt><dd><span class="grand" id="plan-naf">${esc(D.entreprise.nafComplet || D.entreprise.naf)}</span></dd></div>
    <div><dt class="etiq">Responsable</dt><dd id="plan-responsable">${esc(D.entreprise.responsable)}</dd></div>
  </dl>
  <p style="margin-top:var(--t4)">
    <span class="etiq">Contexte retenu</span><span id="plan-contexte">${esc(contexteNoms.join(" · "))}</span>
  </p>
  <dl class="fiche-chiffres" id="plan-chiffres" hidden></dl>
  <p class="note-source" id="plan-origine">
    Ce plan est celui du jeu d'essai. Renseignez votre entreprise dans
    <a href="reglages.html">Réglages</a> : il se refera dessus, ici même.
  </p>`)}
  </div>
</section>

${parFrequence.map((g) => {
    const ech = D.echeances.filter((e) => e.frequence === g.id)[0];
    const dedans = g.ids.filter((id) => base.includes(id) || ajoutes.has(id));
    return rubrique({ etiq: g.f.l, id: `frequence-${g.id}`, contenu: `
      <p class="lecture">${esc(g.f.d)}${ech ? ` Prochaine revue : <strong>${esc(dateFr(ech.prochaine))}</strong>${ech.retard ? " — en retard." : "."}` : ""}</p>
      <nav class="dedans" aria-label="Ce qu'il y a à ce rythme">
        <p class="etiq">À ce rythme</p>
        <ul>${g.ids.map((id) => `<li data-sujet-plan="${esc(id)}"${dedans.includes(id) ? "" : " hidden"}><a href="#domaine-${esc(id)}"><span>${esc(V.domaines[id].nom)}</span></a></li>`).join("")}</ul>
      </nav>
      ${g.ids.map((id) => {
        const division = divisionDuDomaine(V, id);
        const origine = base.includes(id) ? "base" : (ajoutes.has(id) ? "declencheur-retenu" : "hors");
        return blocDomaine(C, LIENS, id, V.domaines[id], origine,
          division ? `secteur/${division}.html` : "", "", true);
      }).join("\n")}`, attrs: ` data-categorie data-groupe-frequence="${esc(g.id)}"${dedans.length ? "" : " hidden"}` });
  }).join("\n")}`;

  return page({
    titre: `Mon plan de veille | ${SITE.nom}`,
    description: "Ce qui s'applique chez vous, et à quel rythme le revoir.",
    racine: "../", zone: "app", actif: "plan", corps, verrou: true, formule: "cadrage",
    donneesPlan: true
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
     3. le reste — une recherche nommée sur Légifrance, et la page le dit :
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

  /* 4. Rien de déclaré : on le dit, et verifieLiens() l'aura déjà signalé. */
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
   donne le recueil officiel qui le contient, et on le dit. */
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

/* Les morceaux de code attachés à une référence, et de quoi en parler. */
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

/* Une page par morceau : le texte en entier, et de quoi circuler dedans. */
function appMorceauDeCode(C, m, refs, precedent, suivant) {
  const intitule = m.chemin[m.chemin.length - 1];
  const dessus = m.chemin.slice(0, -1);
  const code = C.codes.filter((c) => c.id === m.code)[0] || { titre: m.codeTitre, version: "" };
  const changes = (C.changements || []).filter((c) => c.morceau === m.id);

  const corps = `<section class="tete-app">
  <div class="enveloppe">
    <ul class="jalons">
      <li><a href="../textes.html">Tous les textes</a></li>
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
  <p class="lecture">Depuis la relève précédente, et rien d’autre : c’est une
  comparaison des deux versions, pas un commentaire.</p>
  <ul class="changements" style="margin-top:var(--t4)">${changes.map((c) => ligneChangement(c, "")).join("")}</ul>` }) : ""}

${rubrique({ etiq: "Le texte, mot pour mot", contenu: `
  <p class="lecture">Le texte officiel consolidé, tel qu’il est en vigueur, reproduit
  ici en entier. Vous n’avez pas à aller le chercher ailleurs.</p>
  <ul class="articles" style="margin-top:var(--t5)">${m.articles.map(articleDeLoi).join("")}</ul>
  <p class="rangee" style="margin-top:var(--t5)">
    <button type="button" class="bouton bouton-sobre" onclick="window.print()">${imprimante} Enregistrer en PDF</button>
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
    racine: "../../", zone: "app", actif: "textes", corps, verrou: true, formule: "cadrage"
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
function ligneJO(V, t, i, releveLe = "") {
  const noms = t.domaines.map((d) => d.nom);
  const droit = t.genre === "texte";
  /* Les gestes à faire, pris sur les domaines auxquels le texte est rattaché :
     un abonné qui lit « un texte est sorti » veut savoir quoi faire. */
  const actions = [...new Set(t.domaines.flatMap((d) =>
    (V.domaines[d.id] || {}).actions || []))].slice(0, 4);
  /* La date du texte vient de son titre quand il la porte ; la date d'archive
     dit seulement quand nous l'avons vu passer. Les deux sont utiles, et ce ne
     sont pas les mêmes. */
  const quand = t.dateTexte || t.date;
  const vu = t.vuLe || t.date;
  /* « Lesquels sont nouveaux ? » Ceux que la dernière relève a vus passer pour
     la première fois. Nous ne connaissons pas la date d'entrée en vigueur d'un
     texte qui vient de paraître — nous ne l'inventons donc pas, nous disons la
     date qu'il porte, et nous marquons ce qui est arrivé depuis la dernière
     relève. */
  const neuf = Boolean(releveLe) && vu === releveLe;
  const idFait = `jo:${t.id && !/^http/.test(t.id) ? t.id : slug(t.titre).slice(0, 80)}`;

  return `<li class="ligne-releve statut-${droit ? "attente" : "neutre"}${neuf ? " est-neuf" : ""}">
  <details>
    <summary>
      <span class="mono date">${esc(dateFr(quand))}</span>
      <span class="corps">
        <span class="titre">${actions.length ? marqueFait(idFait) : ""}${neuf ? `<span class="marque-neuf">Nouveau</span> ` : ""}${esc(t.titre)}</span>
        <span class="quoi">${esc(String(t.corps || "").slice(0, 180).replace(/\s+\S*$/, ""))}…</span>
        <span class="meta etiq">${esc(t.sourceNom)} · ${esc(noms.join(" · "))}${
          quand !== vu ? ` · relevé le ${esc(dateFr(vu))}` : ""}</span>
      </span>
      <span class="statut etiq">${droit ? "Texte" : "Publication"}</span>
      ${chevron}
    </summary>
    <div class="detail">
      <div class="encarts-fiche">
        <section class="encart encart-faire">
          <h4 class="encart-titre"><span class="numero-encart" aria-hidden="true">1</span>Ce que vous devez faire</h4>
          ${actions.length
            ? `<ul class="a-faire">${actions.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>
               ${boutonFait(idFait)}`
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
        <section class="encart encart-source encart-large">
          <h4 class="encart-titre">D'où vient ce texte</h4>
          <p>
            ${esc(t.sourceNom)} — ${droit
              ? "texte officiel de la République française, sous Licence Ouverte."
              : "publication officielle, reproduite avec sa source et sa date. Ce n'est pas du droit, c'est un commentaire officiel."}
            ${quand !== vu ? `Texte du ${esc(dateFr(quand))}, relevé le ${esc(dateFr(vu))}`
                           : `Publié le ${esc(dateFr(quand))}`}${
              t.id && !/^http/.test(t.id) ? ` — identifiant ${esc(t.id)}` : ""}.
            ${t.lien ? `<a href="${esc(t.lien)}" target="_blank" rel="noopener">Voir chez la source ${sortant}</a>` : ""}
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
   nous ne savons pas, et la page le dit — elle n'invente pas une date. */
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
    Pour les autres, nous n'avons pas encore la date, et nous ne l'inventons pas.
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
   l'environnement, ou du métier. Le tableau le dit d'un coup d'œil, et dit ce
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
   « Une seule page avec les catégories, et quand on clique sur une, ce qui y
   appartient, seulement ça. » Les pages Relevé, Textes et Secteurs s'ouvrent
   sur une carte par catégorie, et rien d'autre ; app.js n'affiche ensuite que
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
          c.marque ? `<span class="marque-neuf">${esc(c.marque)}</span>` : ""}</span>
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
  ${sujets.map((g) => `<section class="sous-groupe" id="${esc(prefixe)}--${esc(g.id)}" data-groupe>
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
  const confirmees = SOURCES.filter((x) => x.confirme);
  const parStatut = Object.keys(STATUTS).map((s) => ({
    s, l: STATUTS[s].l, n: D.releve.filter((t) => t.statut === s).length
  }));

  const officiel = JO && JO.textes && JO.textes.length;
  const groupes = groupesParClassement(V, D.releve, (t) => t.domaine);
  /* Les textes relevés, rangés par famille : santé-sécurité, hygiène, social,
     environnement, métier. Cent quarante-deux textes d'affilée, c'est illisible ;
     rangés par nature, on voit d'un coup d'œil où il y a du travail. */
  const domaineJO = (t) => (t.domaines && t.domaines[0] ? t.domaines[0].id : "");
  const groupesJO = officiel ? groupesParClassement(V, JO.textes, domaineJO) : [];
  /* Une source vérifiée qui n'a pas répondu cette fois-ci. Celles qu'on ne sait
     pas encore relever sont dites à part, avec leur raison. */
  const muettes = officiel
    ? JO.rapport.filter((r) => r.souci && confirmees.some((c) => c.id === r.id)) : [];
  const neufsJO = officiel
    ? JO.textes.filter((t) => (t.vuLe || t.date) === JO.releve_le).length : 0;

  /* Une carte par famille : combien de textes, combien de nouveaux, le plus
     récent, et ce qu'il faut faire en premier. C'est ce qu'on voit en
     arrivant ; les textes eux-mêmes viennent au clic, famille par famille. */
  const carteFamille = (g, prefixe, dateDe, domaineDe, neufDe) => {
    const liste = g.textes.slice().sort((a, b) => (dateDe(a) < dateDe(b) ? 1 : -1));
    if (!liste.length) {
      return { nom: g.cl.l, compte: "Rien sur la période", lignes: [esc(g.cl.d)], vide: true };
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
    "Choisissez une famille : vous ne verrez que ses textes, chacun avec ce qu'il faut faire.",
    ficheDeLEntreprise(V, D)) + `

<section class="rubrique">
  <div class="enveloppe">
  ${officiel ? `
  ${cartesCategories([
    ...groupesJO.map((g) => carteFamille(g, "jo-", (t) => t.dateTexte || t.date, domaineJO,
                                         (t) => (t.vuLe || t.date) === JO.releve_le)),
    ...carteCodes])}
  ${aSavoir("Comment ce relevé est fait", commentFait)}
  ${aSavoir("Exemple : le parcours complet d'un texte", `<p class="lecture">
    Des textes de démonstration, conservés pour montrer le cycle complet : analyse,
    décision, trace.</p>
    ${statutsDemo}
    ${groupes.filter((g) => g.textes.length).map((g) => familleDemo(g, false)).join("")}`)}
  ${(() => { let n = 0; return groupesJO.filter((g) => g.textes.length).map((g) => `
  <section class="famille-releve" id="jo-famille-${esc(g.id)}" data-categorie>
    <h3>${esc(g.cl.l)} <span class="etiq">${g.textes.length} texte${g.textes.length > 1 ? "s" : ""}</span></h3>
    <p class="precision">${esc(g.cl.d)}</p>
    ${parSujet(V, `jo-famille-${g.id}`,
      g.textes.slice().sort((a, b) => ((a.dateTexte || a.date) < (b.dateTexte || b.date) ? 1 : -1)),
      domaineJO, (liste) => `<ul class="liste-releve">
      ${liste.map((t) => ligneJO(V, t, n++, JO.releve_le)).join("")}
    </ul>`)}
  </section>`).join(""); })()}` : `
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
    l’après, et part en alerte.</p>`}
  ${noteDeSource(C)}` }) : ""}`;

  return page({
    titre: `Relevé des textes | ${SITE.nom}`,
    description: "Les textes parus qui vous concernent.",
    racine: "../", zone: "app", actif: "releve", corps, verrou: true, formule: "veille"
  });
}

/* --- Registre ------------------------------------------------------------------ */
function appRegistre(V, D) {
  const ouvertes = D.registre.filter((r) => r.echeance && !r.clos);
  const corps = enTeteApp(D, "Registre de preuves",
    "Les revues faites, les décisions prises, les actions menées — avec leurs dates. C'est ce qu'un auditeur demande, et ce qui manque le plus souvent.",
    ficheDeLEntreprise(V, D)) + `

${rubrique({ etiq: "Actions ouvertes", contenu: ouvertes.length ? `
  <ul class="liste-registre">${ouvertes.map((r) => ligneRegistre(r)).join("")}</ul>` :
  "<p>Aucune action ouverte.</p>" })}

${rubrique({ etiq: "Tout le registre", aplat: true, contenu: `
  <p class="lecture">Chronologique, sans trou. Une ligne ne se modifie pas après coup :
  une correction s'ajoute, elle ne remplace pas.</p>
  <ul class="liste-registre" style="margin-top:var(--t4)">
    ${D.registre.map((r) => ligneRegistre(r)).join("")}
  </ul>
  <p class="rangee" style="margin-top:var(--t5)">
    <button type="button" class="bouton bouton-sobre" onclick="window.print()">Imprimer le registre</button>
  </p>` })}`;

  return page({
    titre: `Registre de preuves | ${SITE.nom}`,
    description: "Les traces datées de la veille.",
    racine: "../", zone: "app", actif: "registre", corps, verrou: true, formule: "preuves"
  });
}

/* --- Les 88 fiches ----------------------------------------------------------- */
/* Essayé en bulles : le diamètre portait le nombre de domaines, mais ça
   n'était pas beau et ça se lisait mal. Retour à une grille de cartes —
   la même que sur l'accueil — qui se parcourt et se cherche mieux. */
function appSecteurs(V, METIERS, NAF) {
  /* On n'affiche plus 88 divisions mais les 732 codes APE, groupés par la
     division qui porte leur périmètre : une entreprise se reconnaît à son
     code, pas à sa division. Sans contenu/naf.js, on retombe sur les
     divisions seules, et la page le dit. */
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
      <li><span>${V.divisions.length} divisions · ${V.sections.length} sections</span></li>
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
      compte: `${divs.length} division${divs.length > 1 ? "s" : ""}${n ? ` · ${n} codes APE` : ""}`,
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
      ? `Les ${codes.length} codes APE, et ce qui s'applique à chacun.`
      : "Les 88 divisions de la nomenclature NAF et leurs obligations.",
    racine: "../", zone: "app", actif: "secteurs", corps, verrou: true, formule: "cadrage"
  });
}

/* --- Une page par texte ---------------------------------------------------- */
/* Le but : lire ce que le texte exige sans quitter le site. Ces fiches ne
   reproduisent pas le texte officiel — il est sur Légifrance, lui seul fait
   foi, et une copie se périme en silence. Elles disent ce qu'il exige, en
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
      <li><a href="../textes.html">Tous les textes</a></li>
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
    <button type="button" class="bouton bouton-sobre" onclick="window.print()">${imprimante} Enregistrer en PDF</button>
  </p>` })}

${rubrique({ etiq: "Où il s'applique", aplat: true, contenu: `
  <p class="lecture">Ce texte est rattaché à ${domaines.length} domaine${domaines.length > 1 ? "s" : ""}
  de veille, et concerne ${secteurs.length} division${secteurs.length > 1 ? "s" : ""} d'activité sur
  ${V.divisions.length}.</p>
  <ul class="puces" style="margin-top:var(--t4)">
    ${domaines.map((id) => `<li><a href="../plan.html">
      <span class="code">${esc(V.domaines[id].frequence.slice(0, 3))}</span>
      <span class="nom">${esc(V.domaines[id].nom)}</span></a></li>`).join("")}
  </ul>
  ${secteurs.length ? `<p class="etiq" style="margin-top:var(--t5)">Secteurs concernés</p>
  <ul class="puces" style="margin-top:var(--t3)">
    ${secteurs.slice(0, 24).map((x) => `<li><a href="../secteur/${esc(x.c)}-${slug(x.l)}.html" title="${esc(x.l)}">
      <span class="code">${esc(x.c)}</span><span class="nom">${esc(x.l)}</span></a></li>`).join("")}
  </ul>
  ${secteurs.length > 24 ? `<p class="note-source">… et ${secteurs.length - 24} autres.</p>` : ""}` : ""}` })}

${T && T.changements.length ? rubrique({ etiq: "Ce qui a changé", contenu: `
  <p class="lecture">Depuis la relève précédente, dans ce texte, et rien d’autre. C’est
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
    <button type="button" class="bouton bouton-sobre" onclick="window.print()">${imprimante} Enregistrer en PDF</button>
  </p>
  ${noteDeSource(C)}` }) : ""}

${rubrique({ etiq: T ? "Vérifier à la source" : "Lire le texte officiel", contenu: `
  <p class="lecture">${T
    ? `Le texte ci-dessus est relevé automatiquement sur la base officielle des codes
       consolidés, et republié ici sous Licence Ouverte. En cas de doute ou de litige,
       c’est la version publiée par l’État qui fait foi : voici où la retrouver.`
    : `La fiche ci-dessus est notre lecture du texte. Son texte intégral n’est pas
       encore publié sur le site : la base consolidée que notre robot sait relever ne
       couvre aujourd’hui que ${C && C.codes.length
         ? C.codes.map((x) => esc(x.titre)).join(", ")
         : "quelques codes"}. Pour celui-ci, le texte officiel et à jour est publié
       par l’État — lui seul fait foi, et c’est à lui qu’il faut se référer en cas de
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
    description: `Ce qu'exige « ${ref} » : à qui ça s'applique, ce qu'il faut tenir, et où lire le texte officiel.`,
    racine: "../../", zone: "app", actif: "textes", corps, verrou: true, formule: "cadrage"
  });
}

/* --- L'index des textes ----------------------------------------------------- */
function appTextes(V, TEXTES, parTexte, C, LIENS) {
  const refs = Object.keys(parTexte).sort((a, b) => a.localeCompare(b, "fr"));
  /* Un texte peut être cité par plusieurs domaines : on le range dans la
     catégorie du premier qui le cite, et on nomme les autres sous son titre. */
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
      Choisissez une catégorie : vous ne verrez que ses textes, chacun avec ce qu'il
      exige et où le lire.
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
    Chaque texte de référence a sa fiche : à qui il s'applique, ce qu'il exige, et le
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
    description: "Les textes de référence de la veille, et ce que chacun exige.",
    racine: "../", zone: "app", actif: "textes", corps, verrou: true, formule: "cadrage"
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
  // vient chercher sur une fiche de secteur, et ça ne doit pas être derrière
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
      <div><dt class="etiq">Domaines de base</dt><dd><span class="grand" id="compte-domaines">${base.length}</span></dd></div>
      <div><dt class="etiq">À revoir le plus souvent</dt><dd>${esc(rythme)}</dd></div>
      <div><dt class="etiq">Questions de contexte</dt><dd><span class="grand">${declencheurs.length}</span></dd></div>
      ${apes.length ? `<div><dt class="etiq">Codes APE</dt><dd><span class="grand">${apes.length}</span></dd></div>` : ""}
    </dl>
  </div>
</section>

${rubrique({ etiq: "Les textes qui s'appliquent", contenu: `
  <p class="lecture">${propres.length
    ? `${propres.length} texte${propres.length > 1 ? "s" : ""} propre${propres.length > 1 ? "s" : ""} à ce métier, et ${socle.length} du socle commun à toute entreprise. Les premiers d'abord : ce sont eux qui vous distinguent.`
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
    racine: "../../", zone: "app", actif: "secteurs", corps, verrou: true, formule: "cadrage",
    attrsBody: ` data-domaines-base="${base.length}"`
  });
}

/* --- Réglages : mon entreprise et mes alertes ------------------------------- */
/* Ce que le visiteur saisit ici ne part nulle part : c'est gardé dans son
   navigateur, et c'est écrit sur la page. Le périmètre se recalcule dessus,
   exactement comme le simulateur de l'accueil — même données, même règle. */
function appReglages(V, D, NAF, METIERS) {
  const parSection = V.sections.map((s) => ({
    s, divisions: V.divisions.filter((d) => d.s === s.c)
  })).filter((g) => g.divisions.length);

  const corps = `<section class="tete-app">
  <div class="enveloppe">
    <ul class="jalons">
      <li><span class="fort">Réglages</span></li>
      <li><span>Gardés dans ce navigateur</span></li>
    </ul>
    <h1>Mon entreprise et mes alertes</h1>
    <p class="chapeau">
      Dites qui vous êtes : on en déduit ce qui vous concerne. Puis choisissez ce que
      vous voulez recevoir.
    </p>

    <div class="bascule" role="tablist" aria-label="Réglages" data-bascule style="margin-inline:0">
      <span class="bascule-curseur" aria-hidden="true"></span>
      <button type="button" role="tab" id="onglet-entreprise" aria-selected="true" aria-controls="volet-entreprise">Mon entreprise</button>
      <button type="button" role="tab" id="onglet-alertes" aria-selected="false" aria-controls="volet-alertes">Mes alertes</button>
    </div>
  </div>
</section>

<section class="rubrique" id="volet-entreprise" role="tabpanel" aria-labelledby="onglet-entreprise">
  <div class="enveloppe">
    <h2 class="cache-visuellement">Mon entreprise</h2>
    <p class="reserve">
      <strong>Tout reste sur cet appareil.</strong> Rien n'est envoyé à personne ; si vous
      videz les données du navigateur, il faudra tout ressaisir.
    </p>

    <div class="simulateur simulateur-reglages" style="margin-top:var(--t5)">
      <form class="reglages reglages-entreprise" id="form-entreprise" novalidate>
        <div class="reglage">
          <label class="etiq" for="e-nom">Nom de l'entreprise</label>
          <input type="text" id="e-nom" name="nom" placeholder="${esc(D.entreprise.nom)}" autocomplete="organization">
        </div>
        <div class="reglage">
          <label class="etiq" for="e-ville">Commune</label>
          <input type="text" id="e-ville" name="ville" placeholder="${esc(D.entreprise.ville)}" autocomplete="address-level2">
        </div>
        ${NAF ? `<div class="reglage reglage-large">
          <label class="etiq" for="e-activite">Ce que vous faites, en vos mots</label>
          <input type="text" id="e-activite" name="activite" autocomplete="off" spellcheck="false"
                 placeholder="plomberie chauffage, boulangerie, transport de marchandises…">
          <p class="precision">Écrivez-le comme vous le diriez : on trouve votre code APE.</p>
          <div class="propositions" id="e-propositions" hidden></div>
        </div>` : ""}
        <div class="reglage reglage-large">
          <label class="etiq" for="e-naf">${NAF ? "Votre code APE" : "Activité principale (NAF)"}</label>
          <select id="e-naf" name="naf">
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
          </select>
          ${NAF ? `<p class="precision" id="e-division">Il est sur votre avis de situation INSEE
          et sur vos bulletins de paie.</p>` : ""}
        </div>
        <div class="reglage">
          <label class="etiq" for="e-effectif">Effectif</label>
          <input type="number" id="e-effectif" name="effectif" min="0" max="100000"
                 placeholder="${esc(D.entreprise.effectif)}" inputmode="numeric">
        </div>
        <div class="reglage">
          <label class="etiq" for="e-responsable">Qui s'en occupe chez vous</label>
          <input type="text" id="e-responsable" name="responsable" placeholder="${esc(D.entreprise.responsable)}" autocomplete="name">
        </div>
        <!-- Votre entreprise en chiffres. Ces informations la décrivent sur le
             plan ; elles ne changent pas la liste des sujets : ce sont les
             cases « vrai chez vous », dessous, qui la font. On le dit. -->
        <div class="reglage-large intertitre">
          <h3>Votre entreprise en chiffres <span class="precision">— facultatif</span></h3>
          <p class="precision">Ces informations s'affichent sur votre plan, pour qu'il soit complet le jour
          d'un audit. Elles ne changent pas les sujets suivis : ce sont les cases plus bas qui le font.</p>
        </div>
        <div class="reglage">
          <label class="etiq" for="e-ca">Chiffre d'affaires de l'an dernier</label>
          <select id="e-ca" data-champ="ca">
            <option value="">Je ne veux pas le dire</option>
            ${["Moins de 100 000 €", "100 000 à 500 000 €", "500 000 € à 2 M€",
               "2 à 10 M€", "10 à 50 M€", "Plus de 50 M€"]
              .map((t) => `<option>${esc(t)}</option>`).join("")}
          </select>
        </div>
        <div class="reglage">
          <label class="etiq" for="e-forme">Forme juridique</label>
          <select id="e-forme" data-champ="forme">
            <option value="">—</option>
            ${["Entreprise individuelle ou micro-entreprise", "EURL", "SARL", "SASU", "SAS", "SA",
               "SCOP", "Association", "Autre"].map((t) => `<option>${esc(t)}</option>`).join("")}
          </select>
        </div>
        <div class="reglage">
          <label class="etiq" for="e-creation">Année de création</label>
          <input type="number" id="e-creation" data-champ="creation" min="1800" max="2100"
                 placeholder="2008" inputmode="numeric">
        </div>
        <div class="reglage">
          <label class="etiq" for="e-sites">Nombre de sites ou d'établissements</label>
          <input type="number" id="e-sites" data-champ="sites" min="1" max="10000"
                 placeholder="1" inputmode="numeric">
        </div>
        <div class="reglage reglage-large">
          <label class="etiq" for="e-siret">Numéro SIRET</label>
          <input type="text" id="e-siret" data-champ="siret" inputmode="numeric" autocomplete="off"
                 placeholder="14 chiffres, sur votre avis de situation INSEE" maxlength="20">
          <p class="precision" id="e-siret-aide"></p>
        </div>
        <div class="reglage reglage-large">
          <span class="etiq">Certifications que vous avez, ou que vous visez</span>
          <div class="certifs">
            ${["ISO 9001", "ISO 14001", "ISO 45001", "MASE", "Qualiopi"].map((c) => `<label class="certif">
              <input type="checkbox" data-certif="${esc(c)}"><span>${esc(c)}</span></label>`).join("")}
          </div>
        </div>
        <div class="reglage reglage-large">
          <span class="etiq">Cochez ce qui est vrai chez vous</span>
          <div class="cases cases-ouvertes" id="e-contexte"></div>
        </div>
        <p class="rangee reglage-large">
          <button type="submit" class="bouton bouton-accent">Enregistrer</button>
          <button type="button" class="bouton bouton-sobre" id="e-reinit">Tout effacer et revenir à l'exemple</button>
        </p>
        <p class="etiq reglage-large" id="e-etat" role="status"></p>
      </form>

      <div class="resultat">
        <h3 id="e-titre">${esc(D.entreprise.nom)}</h3>
        <p>Ce qui vous concerne, d'après ces informations.</p>
        <hr class="filet">
        <ul class="coup-d-oeil">
          <li>
            <span class="pastille"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v16l-7-3-7 3Z"/></svg></span>
            <span><span class="etiq">Sujets à suivre</span><span class="valeur" id="e-total">—</span></span>
          </li>
          <li>
            <span class="pastille ambre"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></span>
            <span><span class="etiq">À revoir le plus souvent</span><span class="valeur" id="e-rythme">—</span></span>
          </li>
          <li>
            <span class="pastille verte"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></span>
            <span><span class="etiq">Ajoutés par vos réponses</span><span class="valeur" id="e-ajouts">—</span></span>
          </li>
        </ul>
        <div class="jauge" id="e-jauge" aria-hidden="true"></div>
        <ul class="rythmes" id="e-rythmes"></ul>
        <p style="margin-top:var(--t4)">
          <a class="lien-fleche" href="plan.html">Voir le plan complet ${fleche}</a>
        </p>
      </div>
    </div>
  </div>
</section>

<section class="rubrique section-tein" id="volet-alertes" role="tabpanel" aria-labelledby="onglet-alertes" hidden>
  <div class="enveloppe">
    <h2 class="cache-visuellement">Mes alertes</h2>
    <p class="reserve">
      <strong>Aucun courriel ne part encore.</strong> Vos réglages sont gardés pour le jour
      où l'envoi sera branché ; l'aperçu montre ce que vous recevrez.
    </p>

    <div class="simulateur simulateur-reglages" style="margin-top:var(--t5)">
      <form class="reglages" id="form-alertes" novalidate>
        <div class="reglage">
          <label class="etiq" for="a-courriel">Votre adresse e-mail</label>
          <input type="email" id="a-courriel" name="courriel" placeholder="prenom@entreprise.fr"
                 inputmode="email" spellcheck="false" autocomplete="email">
        </div>
        <div class="reglage">
          <label class="etiq" for="a-rythme">Quand recevoir</label>
          <select id="a-rythme" name="rythme">
            <option value="immediat">À chaque texte relevé</option>
            <option value="quotidien">Un résumé par jour</option>
            <option value="hebdomadaire" selected>Un résumé par semaine</option>
            <option value="mensuel">Un résumé par mois</option>
          </select>
        </div>
        <div class="reglage">
          <label class="etiq" for="a-seuil">Quels textes</label>
          <select id="a-seuil" name="seuil">
            <option value="tout" selected>Tous ceux qui me concernent</option>
            <option value="prioritaire">Seulement les plus importants</option>
            <option value="action">Seulement ceux qui demandent une action</option>
          </select>
        </div>
        <div class="reglage">
          <span class="etiq">En plus</span>
          <div class="cases cases-ouvertes">
            <label class="case">
              <input type="checkbox" id="a-revues" checked>
              <span><span class="intitule">Me rappeler les revues à faire</span>
              <span class="aide">Un rappel avant chaque échéance de revue, et un autre si elle passe.</span></span>
            </label>
            <label class="case">
              <input type="checkbox" id="a-pdf" checked>
              <span><span class="intitule">Joindre la fiche de chaque texte</span>
              <span class="aide">En PDF, prête à ranger dans votre dossier.</span></span>
            </label>
          </div>
        </div>
        <p class="rangee">
          <button type="submit" class="bouton bouton-accent">Enregistrer</button>
        </p>
        <p class="etiq" id="a-etat" role="status"></p>
      </form>

      <div class="resultat">
        <h3>Aperçu du courriel</h3>
        <p>Ce que vous recevrez, avec ces réglages.</p>
        <hr class="filet">
        <div class="apercu-courriel" id="a-apercu"></div>
        <p class="note-source">
          Un aperçu : rien n'est envoyé, et votre adresse reste sur cet appareil.
        </p>
      </div>
    </div>
  </div>
</section>`;

  return page({
    titre: `Réglages | ${SITE.nom}`,
    description: "Mon entreprise et mes alertes.",
    racine: "../", zone: "app", actif: "reglages", corps, verrou: true,
    formule: "cadrage", donneesPlan: true
  });
}

/* ==========================================================================
   Le site public
   ========================================================================== */

/* Un écran de l'application dans une maquette d'ordinateur portable.
   Deux fichiers quand ils existent : la capture claire et la capture sombre.
   Celle qui ne correspond pas au thème est en display:none, et un navigateur
   ne télécharge pas une image lazy qui n'est pas affichée. */
/* Une capture ressemble à l'application : on clique dessus, et rien ne se
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
   court, et la page d'à côté se lit d'un bout à l'autre. */
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
  const confirmees = SOURCES.filter((x) => x.confirme);
  const nArticles = C ? C.morceaux.reduce((n, m) => n + m.articles.length, 0) : 0;
  return [
    { titre: "D'où viennent les textes", lignes: [
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
      `Sa date de parution, et la marque « Nouveau » tant que vous ne l'avez pas lu`,
      `Un bouton <strong>Fait</strong> qui garde la date où vous l'avez traité`
    ] },
    { titre: "Seulement ce qui vous concerne", lignes: [
      `${V.divisions.length} familles de métiers${NAF ? `, ${NAF.codes.length} codes APE` : ""} : vous choisissez le vôtre, le reste disparaît`,
      `${Object.keys(V.domaines).length} sujets à suivre, rangés en cinq familles : santé et sécurité, hygiène, social, environnement, métier et gestion`,
      `${V.declencheurs.length} questions simples (salariés, chantiers, produits chimiques…) ajoutent ce qui vient de votre façon de travailler`,
      `Chaque sujet a son rythme de revue : chaque semaine, chaque mois ou chaque trimestre`
    ] },
    { titre: "Ce que vous gardez", lignes: [
      `Un <strong>registre</strong> daté de chaque revue, décision et action, prêt pour l'auditeur`,
      `Chaque fiche s'enregistre en PDF et s'imprime telle quelle`,
      `L'application s'installe sur le téléphone et s'ouvre même sans réseau`,
      `Vos réglages restent sur votre appareil : rien n'est envoyé ailleurs`
    ] }
  ];
}

function encartsDeNous() {
  return [
    { titre: "Le cabinet", lignes: [
      `<strong>${esc(SITE.nom)}</strong>, conseil en organisation et conformité`,
      `Installé à ${esc(SITE.ville)}`,
      `Zone d'intervention : ${esc(SITE.zone)}`,
      `Joignable au <a href="tel:${esc(SITE.telephoneLien)}">${esc(SITE.telephone)}</a> et à <a href="mailto:${esc(SITE.courriel)}">${esc(SITE.courriel)}</a>`
    ] },
    { titre: "Votre interlocuteur", lignes: [
      `<strong>Clément Pierrel</strong>`,
      `Un interlocuteur unique, pas un abonnement anonyme ni un centre d'appels`,
      `Il connaît votre site, et il vient dessus`,
      `Le premier échange, d'une heure, est sans engagement`
    ] },
    { titre: "Ce qu'on fait pour vous", lignes: [
      `<strong>Le cadrage</strong> (${esc(FORMULES.cadrage.prix)}) : une demi-journée chez vous, puis le document écrit — ce qui s'applique, à quel rythme, et qui s'en occupe`,
      `<strong>La veille tenue</strong> (${esc(FORMULES.veille.prix)}) : on vous prévient dès qu'un texte vous concerne, avec ce qu'il faut faire`,
      `<strong>Les preuves</strong> (${esc(FORMULES.preuves.prix)}) : le registre, et une revue annuelle sur place`,
      `Prix hors taxes, affichés sur la <a href="abonnement.html">page des tarifs</a>, sans devis`
    ] },
    { titre: "Les audits qu'on prépare", lignes: [
      `<strong>ISO 14001</strong> (environnement) et <strong>ISO 45001</strong> (santé et sécurité)`,
      `<strong>MASE</strong>, pour les entreprises qui interviennent chez des industriels`,
      `<strong>Qualiopi</strong>, pour les organismes de formation`,
      `On vous aide à tenir et à montrer votre veille ; la décision reste à l'auditeur`
    ] }
  ];
}

/* Une page « En savoir plus » : le titre, une phrase, les quatre encarts en
   deux et deux, et de quoi continuer. Rien d'autre. */
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

/* Tous les métiers, rangés par grand secteur d'activité. Un clic choisit le
   métier dans l'outil de l'accueil, qui dit tout de suite ce qui s'applique. */
function pageMetiers(V, NAF) {
  const groupes = V.sections.map((s) => ({ s, divisions: V.divisions.filter((d) => d.s === s.c) }))
    .filter((g) => g.divisions.length);
  const corps = `
<section class="heros heros-court">
  <div class="enveloppe">
    <div class="heros-texte"><h1>Tous les métiers couverts</h1></div>
    <p class="heros-sous">Les ${V.divisions.length} familles de métiers de la nomenclature officielle${NAF ? `
      (${NAF.codes.length} codes APE)` : ""}. Cliquez la vôtre : vous voyez tout de suite ce qui s'applique chez vous.
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
    description: `Les ${V.divisions.length} familles de métiers couvertes par la veille, rangées par secteur d'activité.`,
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
  const etoiles = (n) => `<span class="etoiles" aria-label="${n} sur 5">${"★".repeat(n)}${"☆".repeat(5 - n)}</span>`;
  /* « Laisser votre avis » est écrit dans la bande elle-même, et revient
     entre les avis : c'est ce qui défile en premier. */
  const appel = `<li class="avis-item avis-appel"><span class="bulle" aria-hidden="true">✎</span> <strong>Laisser votre avis</strong></li>`;
  const items = AVIS.length
    ? AVIS.flatMap((a, k) => [`<li class="avis-item">${a.note ? etoiles(a.note) : ""}
        <q>${esc(a.texte)}</q>
        <span class="avis-qui">— ${esc([a.nom, a.entreprise, a.ville].filter(Boolean).join(", "))}</span></li>`]
        .concat(k % 3 === 2 || k === AVIS.length - 1 ? [appel] : []))
    : [appel,
       `<li class="avis-item">Vous êtes client ? Dites-nous ce que vous en pensez</li>`,
       appel,
       `<li class="avis-item">Votre avis paraîtra ici, avec votre accord</li>`,
       appel,
       `<li class="avis-item">Pas encore d'avis publié : soyez le premier</li>`];
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

function pageAccueil(V, D, METIERS, ECRANS, C = null, NAF = null, SOURCES = [], AVIS = []) {
  const nbDomaines = Object.keys(V.domaines).length;
  const defaut = "43";                      // Travaux de construction spécialisés
  const divDefaut = V.divisions.filter((d) => d.c === defaut)[0] || V.divisions[0];
  const vuDefaut = perimetre(V, divDefaut.c);

  const parSection = V.sections.map((s) => ({
    s, divisions: V.divisions.filter((d) => d.s === s.c)
  })).filter((g) => g.divisions.length);

  const confirmees = SOURCES.filter((x) => x.confirme);
  const muettes = SOURCES.filter((x) => !x.confirme);
  const nomCourt = (x) => x.nom.split(" — ")[0];
  const exemples = ["salaries", "chantier", "chimique", "alimentaire"]
    .map((id) => V.declencheurs.filter((q) => q.id === id)[0]).filter(Boolean)
    .map((q) => `« ${esc(q.q.replace(/^Vous /, "vous ").replace(/^Votre /, "votre "))} »`);
  const faq = [
    { theme: "Le service", questions: [
      ["À quoi sert une veille réglementaire ?",
       `<p><strong>À savoir, avant qu'on vous le demande, quels textes s'appliquent chez vous et ce qu'ils vous obligent à faire.</strong></p>
        <p>Lois, décrets et arrêtés changent chaque semaine. Lors d'un contrôle, d'un accident ou d'un audit,
        on vous demandera ce que vous saviez et ce que vous avez fait. La veille, c'est repérer les textes
        qui vous concernent, comprendre ce qu'ils changent, agir, et garder la trace de tout cela.</p>`],
      ["D'où viennent les textes ?",
       `<p><strong>De ${confirmees.length} sources officielles, relues automatiquement toutes les heures.</strong></p>
        <p>${esc([...new Set(confirmees.map(nomCourt))].join(", "))}.${C ? ` S'y ajoutent ${C.codes.length} codes
        (${esc(C.codes.map((c) => c.titre).join(", "))}), relus chaque jour, article par article.` : ""}</p>
        <p>Chaque texte garde sa date, sa source et le lien direct vers l'original : c'est la source qui fait foi.</p>
        ${muettes.length ? `<p>${muettes.length} sources ne sont pas encore relevées automatiquement :
        ${esc(muettes.map((x) => `${nomCourt(x)} (${x.pourquoi || "ne répond pas"})`).join(", "))}.</p>` : ""}`],
      ["Comment savez-vous ce qui me concerne ?",
       `<p><strong>Par votre métier, puis par vos réponses à quelques questions.</strong></p>
        <p>Chacune des ${V.divisions.length} familles de métiers est rattachée aux sujets qui la concernent,
        parmi ${Object.keys(V.domaines).length}. ${V.declencheurs.length} questions simples ajoutent ce qui vient de votre
        façon de travailler : ${exemples.join(", ")}… Ce qui ne vous concerne pas n'arrive pas.</p>
        <p>La liste n'est pas garantie complète : le cadrage sert justement à la vérifier avec vous, chez vous.</p>`],
      ["Que se passe-t-il quand un nouveau texte paraît ?",
       `<p><strong>Il arrive dans votre relevé, rangé dans son sujet, avec la marque « Nouveau ».</strong></p>
        <p>Vous ouvrez sa fiche et vous y trouvez, dans cet ordre : ce que vous devez faire, le texte tel
        qu'il a été publié, et sa source. Quand c'est traité, vous cochez « Fait » : la date est gardée
        et le registre la montre à l'auditeur.</p>`],
      ["Est-ce que je reçois un courriel à chaque nouveauté ?",
       `<p><strong>Pas encore automatiquement.</strong></p>
        <p>L'envoi suppose un serveur qui expédie les courriels, et il n'est pas encore en place. En attendant,
        le relevé se met à jour toutes les heures dans l'application, et la cloche, en haut de l'écran, compte
        les textes que vous n'avez pas lus. Vos réglages d'alerte sont gardés pour le jour où l'envoi sera branché.</p>`],
      ["Est-ce un conseil juridique ?",
       `<p><strong>Non.</strong></p>
        <p>Le site dit ce qui s'applique à votre métier et ce qu'il faut faire. Ce que cela implique dans
        votre cas précis reste à valider par quelqu'un de compétent. En cas de doute, c'est toujours la
        source officielle qui fait foi.</p>`]
    ] },
    { theme: "Prix et démarrage", questions: [
      ["Combien ça coûte ?",
       `<p><strong>${esc(FORMULES.cadrage.prix)} pour le cadrage, puis ${esc(FORMULES.veille.prix)} ou ${esc(FORMULES.preuves.prix)}.</strong> Hors taxes, sans devis.</p>
        <ul>
          <li><strong>${esc(FORMULES.cadrage.l)}</strong> (${esc(FORMULES.cadrage.prix)}) : une demi-journée chez vous, puis le
            document écrit — ce qui s'applique, à quel rythme le revoir, et qui s'en occupe. Il vous reste,
            que vous continuiez ou non.</li>
          <li><strong>${esc(FORMULES.veille.l)}</strong> (${esc(FORMULES.veille.prix)}) : on vous prévient dès qu'un texte vous
            concerne, avec ce qu'il change et ce qu'il faut faire. L'application comprise.</li>
          <li><strong>${esc(FORMULES.preuves.l)}</strong> (${esc(FORMULES.preuves.prix)}) : la veille tenue, plus le registre
            de preuves et une revue annuelle sur place.</li>
        </ul>
        <p>Ces montants sont encore une proposition : ils seront confirmés avec vous avant tout engagement.</p>`],
      ["Laquelle choisir ?",
       `<p><strong>Celle qui correspond à votre situation d'aujourd'hui.</strong></p>
        <ul>
          <li>Vous ne savez pas ce qui vous concerne : le <strong>cadrage</strong>.</li>
          <li>Vous le savez, mais vous n'avez pas le temps de suivre : la <strong>veille tenue</strong>.</li>
          <li>Vous préparez un audit ou une certification : la <strong>veille et preuves</strong>.</li>
        </ul>`],
      ["Mon métier est-il couvert ?",
       `<p><strong>Oui, quel qu'il soit : les ${V.divisions.length} familles de métiers${NAF ? ` et les ${NAF.codes.length} codes APE` : ""} de la nomenclature officielle.</strong></p>
        <p>Choisissez le vôtre dans <a href="#simulateur">l'outil en haut de page</a>, ou dans
        <a href="metiers.html">la liste de tous les métiers</a> : vous voyez tout de suite les sujets à
        suivre et à quel rythme.</p>`],
      ["Peut-on essayer avant de s'abonner ?",
       `<p><strong>Oui, tout de suite, sans compte et sans mot de passe.</strong></p>
        <p>L'application est ouverte en démonstration, avec une entreprise et des textes d'essai. Vous
        choisissez une formule et vous voyez exactement les écrans qu'elle ouvre :
        <a href="abonnement.html#essayer">essayer la démonstration</a>.</p>`],
      ["Comment on démarre ?",
       `<p><strong>Par un premier échange d'une heure, sans engagement.</strong></p>
        <p>Avec Clément Pierrel, on définit ensemble ce qui s'applique chez vous. Si vous continuez, le
        cadrage se fait sur place, puis la veille prend le relais. Pour prendre rendez-vous :
        <a href="tel:${esc(SITE.telephoneLien)}">${esc(SITE.telephone)}</a> ou
        <a href="mailto:${esc(SITE.courriel)}">${esc(SITE.courriel)}</a>.</p>`]
    ] },
    { theme: "L'outil et vos données", questions: [
      ["Est-ce que ça m'aide pour ma certification ?",
       `<p><strong>Oui pour la partie réglementaire : ISO 14001, ISO 45001, MASE, Qualiopi.</strong></p>
        <p>Ces référentiels demandent de connaître les exigences légales qui vous concernent et de montrer
        que vous les suivez. Le site vous donne la liste de ce qui s'applique, les textes qui paraissent, et
        un registre daté de chaque revue et de chaque décision, qui s'imprime tel quel.</p>
        <p>Le site ne certifie pas : la décision reste à l'auditeur.</p>`],
      ["Où sont mes données ?",
       `<p><strong>Aujourd'hui, uniquement sur votre appareil.</strong></p>
        <p>Vos réglages, vos chiffres et vos cases « Fait » restent dans votre navigateur : rien n'est envoyé
        à un serveur. C'est aussi pourquoi l'application est encore en démonstration : de vrais comptes,
        partagés entre plusieurs personnes, supposent un serveur qui n'est pas encore en place.</p>`],
      ["Faut-il installer quelque chose ?",
       `<p><strong>Non : tout marche dans le navigateur, sur ordinateur comme sur téléphone.</strong></p>
        <p>Si vous le souhaitez, vous pouvez l'ajouter à l'écran d'accueil de votre téléphone. Elle s'ouvre
        alors comme une application, même sans réseau.</p>`],
      ["Et si une source officielle ne répond pas ?",
       `<p><strong>Rien n'est perdu.</strong></p>
        <p>Le robot réessaie, et les textes déjà relevés restent affichés tant que la source est muette. Les
        sources qu'on ne peut pas encore relever sont citées, avec la raison, dans la réponse
        « D'où viennent les textes ? » ci-dessus.</p>`],
      ["Qui est derrière le site ?",
       `<p><strong>${esc(SITE.nom)}, un cabinet de conseil en organisation et conformité installé à ${esc(SITE.ville)}.</strong></p>
        <p>Votre interlocuteur est Clément Pierrel. Il intervient sur ${esc(SITE.zone)}, connaît votre site et
        vient dessus. <a href="nous.html">En savoir plus sur nous</a>.</p>`]
    ] }
  ];

  const corps = `
<section class="heros">
  <div class="enveloppe">
    <div class="heros-texte">
      <h1>La veille réglementaire de votre métier</h1>
    </div>
    <p class="heros-sous">
      Dites ce que vous faites : vous voyez tout de suite ce qui s'applique chez vous,
      à quel rythme le revoir, et quoi faire quand un texte paraît.
    </p>
    <p class="rangee rangee-centre">
      <a class="bouton bouton-accent" href="#simulateur">Voir ce qui me concerne</a>
      <a class="bouton bouton-sobre" href="abonnement.html">Les tarifs</a>
    </p>
    <p class="gage">
      ${sigle}
      <span>${V.divisions.length} familles de métiers couvertes</span>
      <span class="doux">— rien à créer, rien à payer pour regarder</span>
    </p>
    <!-- Presque tous les services de veille vendent « sur devis ». Le nôtre
         affiche ses prix : on le dit dès le haut, chiffres tirés de FORMULES. -->
    <p class="gage gage-prix">
      <span>Prix affichés, sans devis :</span>
      <span class="doux">${esc(FORMULES.cadrage.prix.replace(" une fois", ""))} le cadrage, puis
        ${esc(FORMULES.veille.prix.replace(" par mois", ""))} ou ${esc(FORMULES.preuves.prix)}</span>
    </p>

    <div class="heros-visuel">
      ${portable(ECRANS, "bord.png", "Le tableau de bord de l'application : revues en retard, textes à analyser, actions ouvertes.")}
      ${mobile(ECRANS, "releve-tel.png", "Le relevé des textes sur téléphone.")}
    </div>
  </div>
</section>

${bandeAvis(AVIS)}

<section class="section section-tein" id="simulateur">
  <div class="enveloppe">
    <h2 class="titre-section">Ce qui s'applique chez vous</h2>
    <p class="intro titre-section">Choisissez votre métier, cochez ce qui est vrai chez vous.
    La liste se met à jour toute seule, et c'est le même calcul que dans l'application.</p>

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
          <strong>${vuDefaut.base.length} sujets à suivre sur ${nbDomaines}</strong>. Le plus
          fréquent est à revoir <strong>${esc(vuDefaut.groupes.length ? vuDefaut.groupes[0].f.l.toLowerCase() : "—")}</strong>.
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

<section class="section">
  <div class="enveloppe">
    <div class="rail">
      <span class="rail-fil" data-fil></span>
      <div class="rail-item" data-paraitre data-compte="${V.divisions.length}">
        <span class="chiffre">${V.divisions.length}</span>
        <p class="legende">divisions d'activité couvertes, de la boulangerie au transport routier</p>
      </div>
      <div class="rail-item" data-paraitre data-compte="${nbDomaines}">
        <span class="chiffre">${nbDomaines}</span>
        <p class="legende">sujets à suivre, chacun avec ses obligations, ses textes et ses sources</p>
      </div>
      <div class="rail-item" data-paraitre data-compte="${V.declencheurs.length}">
        <span class="chiffre">${V.declencheurs.length}</span>
        <p class="legende">questions sur votre situation, qui ajoutent ou retirent un sujet</p>
      </div>
      <div class="rail-item" data-paraitre>
        <span class="chiffre">ISO</span>
        <p class="legende">les certifications qui exigent une veille : ISO 14001, ISO 45001, MASE, Qualiopi</p>
      </div>
    </div>
  </div>
</section>

<section class="section section-tein">
  <div class="enveloppe">
    <h2 class="titre-section">Un outil pour chaque façon de travailler</h2>

    <div class="bascule" role="tablist" aria-label="Profil" data-bascule>
      <span class="bascule-curseur" aria-hidden="true"></span>
      <button type="button" role="tab" id="onglet-dirigeant" aria-selected="true" aria-controls="profil-dirigeant">Dirigeant</button>
      <button type="button" role="tab" id="onglet-qhse" aria-selected="false" aria-controls="profil-qhse">Responsable QHSE</button>
    </div>

    <ul class="traits" id="profil-dirigeant" role="tabpanel" aria-labelledby="onglet-dirigeant">
      <li class="trait">
        <svg class="icone" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7v5l3 2"/><circle cx="12" cy="12" r="9"/></svg>
        <div><h3>Ce qui est en retard, tout de suite</h3>
        <p>Le tableau de bord s'ouvre sur les revues en retard, les textes qui attendent
        une décision et les actions ouvertes. Pas de fil d'actualité à éplucher.</p></div>
      </li>
      <li class="trait">
        <svg class="icone" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v16l-7-3-7 3Z"/><path d="M9 9h6"/></svg>
        <div><h3>Ce qui vous concerne, écrit noir sur blanc</h3>
        <p>Votre plan dit quels sujets s'appliquent, à quel rythme les revoir et qui
        s'en occupe. C'est un document, pas une conversation.</p></div>
      </li>
      <li class="trait">
        <svg class="icone" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 20V9l9-5 9 5v11"/><path d="M9 20v-6h6v6"/></svg>
        <div><h3>De quoi répondre à un donneur d'ordre</h3>
        <p>Les fiches de secteur situent un client ou un sous-traitant en deux minutes :
        ce qui s'applique chez lui, et ce qu'il devrait pouvoir montrer.</p></div>
      </li>
      <li class="trait">
        <svg class="icone" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18V6m5 12V10m5 8V4m5 14v-7"/></svg>
        <div><h3>Un prix affiché</h3>
        <p>Les offres comparables sont presque toutes « sur devis ». La grille est sur
        la page des tarifs, sans formulaire à remplir d'abord.</p></div>
      </li>
    </ul>

    <ul class="traits" id="profil-qhse" role="tabpanel" aria-labelledby="onglet-qhse" hidden>
      <li class="trait">
        <svg class="icone" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16M7 12h10m-7 7h4"/></svg>
        <div><h3>Le tri est fait en amont</h3>
        <p>Seuls les textes qui vous concernent arrivent, chacun avec ce qu'il change
        chez vous. Ceux qu'on écarte sont notés, avec la raison.</p></div>
      </li>
      <li class="trait">
        <svg class="icone" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 12l2 2 4-5"/><rect x="4" y="3" width="16" height="18" rx="2"/></svg>
        <div><h3>Le registre que l'auditeur demande</h3>
        <p>Chaque revue, chaque décision, chaque action est datée et conservée.
        Une ligne ne se réécrit pas : une correction s'ajoute. Il s'imprime tel quel.</p></div>
      </li>
      <li class="trait">
        <svg class="icone" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1M7.7 16.3l-2.1 2.1"/></svg>
        <div><h3>Votre situation change la liste</h3>
        <p>${V.declencheurs.length} questions — installation classée, amiante, appareils de levage,
        transport de marchandises — ajoutent les sujets qui vont avec.</p></div>
      </li>
      <li class="trait">
        <svg class="icone" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 3 7v5c0 5 3.8 8.3 9 9 5.2-.7 9-4 9-9V7Z"/></svg>
        <div><h3>Les sources sont citées</h3>
        <p>Chaque sujet porte ses textes et les sources officielles où les vérifier.
        Rien ne vous est demandé sur parole.</p></div>
      </li>
    </ul>
  </div>
</section>

<section class="section">
  <div class="enveloppe">
    <h2 class="titre-section">À quoi ça ressemble</h2>

    ${vitrine(ECRANS, {
      image: "releve.png",
      alt: "Le relevé des textes : chaque texte daté, rattaché à un domaine, avec l'état de la décision.",
      titre: "Ce qui vous concerne, et rien d'autre",
      texte: `Une veille qui remonte tout ne se lit plus, et le texte qui comptait se perd.
        Ici le tri est fait avant, sur votre métier : chaque texte arrive avec ce qu'il change
        chez vous et ce qu'il faut faire.`,
      bouton: "En savoir plus sur le site", lien: "le-site.html"
    })}

    ${vitrine(ECRANS, {
      image: "registre.png",
      alt: "Le registre de preuves : revues, décisions et actions, chronologiques et datées.",
      titre: "Ce qu'un auditeur demande vraiment",
      texte: `L'écart le plus souvent relevé en audit n'est pas l'absence de veille : c'est la
        veille faite et jamais écrite. Tout est daté et conservé, et s'imprime tel quel.`,
      bouton: "En savoir plus sur nous", lien: "nous.html"
    })}
  </div>
</section>

<section class="section">
  <div class="enveloppe">
    <h2 class="titre-section">Votre métier y est</h2>
    <p class="intro titre-section">${V.divisions.length} familles de métiers, chacune avec sa fiche.
    En voici quelques-unes : cliquez la vôtre pour voir ce qui s'applique.</p>
    <div class="panneau-puces">
      <ul class="puces">
        ${VITRINE_SECTEURS.map((c) => {
          const d = V.divisions.filter((x) => x.c === c)[0];
          if (!d) throw new Error(`Vitrine de secteurs : division ${c} inconnue.`);
          return `<li><button type="button" class="puce-fixe" data-division="${esc(d.c)}"
            title="Voir ce qui s'applique : ${esc(d.l)}">
          <span class="code">${esc(d.c)}</span><span class="nom">${esc(d.l)}</span></button></li>`;
        }).join("\n")}
      </ul>
    </div>
    <p class="rangee rangee-centre" style="margin-top:var(--t5)">
      <a class="bouton bouton-accent" href="metiers.html">Voir tout</a>
    </p>
  </div>
</section>

<section class="section section-tein">
  <div class="enveloppe">
    <h2 class="titre-section">Pourquoi nous</h2>
    <ul class="raisons">
      <li class="raison" data-paraitre>
        <span class="numero" aria-hidden="true">1</span>
        <h3>On trie avant de vous envoyer</h3>
        <p>Une veille qui remonte tout ne se lit plus. Seuls les textes qui vous
        concernent arrivent, chacun avec ce qu'il change chez vous et ce qu'il faut
        faire. Les autres sont écartés, et on vous dit pourquoi.</p>
      </li>
      <li class="raison" data-paraitre>
        <span class="numero" aria-hidden="true">2</span>
        <h3>Vous pouvez le prouver</h3>
        <p>Ce qu'on reproche le plus souvent en audit, ce n'est pas l'absence de veille :
        c'est la veille faite et jamais écrite. Chaque revue, chaque décision est datée
        et conservée. Ça s'imprime tel quel.</p>
      </li>
      <li class="raison" data-paraitre>
        <span class="numero" aria-hidden="true">3</span>
        <h3>Le prix est affiché</h3>
        <p>Presque toutes les offres comparables sont « sur devis ». La nôtre est sur la
        page des tarifs, sans formulaire à remplir d'abord.</p>
      </li>
      <li class="raison" data-paraitre>
        <span class="numero" aria-hidden="true">4</span>
        <h3>Quelqu'un en face</h3>
        <p>Pierrel &amp; Co est un cabinet de conseil à ${esc(SITE.ville)}, pas un abonnement
        anonyme. Un interlocuteur unique, qui connaît le site et qui vient dessus.</p>
      </li>
    </ul>
  </div>
</section>

<!-- Pour votre certification. Les services de veille se présentent d'abord
     par norme (ISO 14001, ISO 45001, MASE) : c'est la question qu'un dirigeant
     se pose en premier — « est-ce que ça me sert pour l'audit ? ». Chaque
     carte dit ce que la norme demande sur la réglementation, puis ce que le
     site donne. Les numéros de chapitre sont ceux des normes en vigueur. -->
<section class="section">
  <div class="enveloppe">
    <h2 class="titre-section">Pour votre certification</h2>
    <p class="intro titre-section">Ce que la norme demande sur la réglementation, et ce que le
    site vous donne pour le montrer à l'auditeur.</p>
    <ul class="normes">
      ${[
        { n: "ISO 14001", t: "Environnement",
          demande: "Connaître vos obligations de conformité (§ 6.1.3) et évaluer votre conformité, en gardant la preuve (§ 9.1.2).",
          donne: "La liste de ce qui s'applique chez vous, les textes qui paraissent, et chaque évaluation datée au registre." },
        { n: "ISO 45001", t: "Santé et sécurité au travail",
          demande: "Déterminer les exigences légales applicables (§ 6.1.3) et évaluer votre conformité, preuve à l'appui (§ 9.1.2).",
          donne: "Les sujets santé-sécurité de votre métier, ce qu'il faut faire pour chaque texte, et la case « fait » datée." },
        { n: "MASE", t: "Entreprises intervenantes",
          demande: "Connaître et suivre la réglementation qui s'applique à vos interventions, et le montrer.",
          donne: "La fiche de votre métier, ce qu'il faut faire pour chaque texte, et un registre qui s'imprime tel quel pour l'audit." },
        { n: "Qualiopi", t: "Organismes de formation",
          demande: "Une veille légale et réglementaire sur la formation professionnelle, et son exploitation (indicateur 23).",
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
</section>

<section class="section">
  <div class="enveloppe">
    <h2 class="titre-section">D'où viennent les textes</h2>
    <p class="intro titre-section">Toutes publiques, toutes citées : vous pouvez vérifier
    chaque ligne vous-même.</p>
    <ul class="sources-bande">
      ${V.sourcesGenerales.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.nom)} ${sortant}</a></li>`).join("\n")}
    </ul>
    <div class="deux-colonnes" style="margin-top:var(--t6)">
      <p class="reserve">
        <strong>Ce que le service ne fait pas.</strong>
        Ce n'est pas un conseil juridique, et la liste des textes qui vous concernent n'est
        pas garantie complète. Chaque texte reste à vérifier sur
        <a href="https://www.legifrance.gouv.fr" target="_blank" rel="noopener">Légifrance</a>,
        et ce qu'il implique chez vous, à valider par quelqu'un de compétent.
      </p>
      <p class="reserve">
        <strong>Et ce site, aujourd'hui.</strong>
        L'application est ouverte en démonstration, avec un jeu d'essai : il n'y a pas encore
        de comptes ni de paiement. La « connexion » pose un jeton dans votre navigateur et ne
        protège rien. Tout est écrit sur les écrans concernés.
      </p>
    </div>
  </div>
</section>

<!-- Les questions qu'on pose avant de s'abonner, rangées en trois thèmes.
     Chaque réponse commence par la réponse elle-même (oui, non, le chiffre),
     puis le détail. Elle dit ce qui est vrai aujourd'hui, y compris ce qui
     n'est pas encore en place. Repliées : on n'ouvre que celle qui intéresse. -->
<section class="section section-tein" id="questions">
  <div class="enveloppe">
    <h2 class="titre-section">Vos questions</h2>
    <p class="intro titre-section">Les réponses courtes d'abord, le détail ensuite.
    Ce qui n'est pas encore en place est dit tel quel.</p>
    <div class="faq">
      ${faq.map((t) => `<section class="faq-theme">
        <h3>${esc(t.theme)}</h3>
        ${t.questions.map(([q, r]) => `<details class="faq-question">
          <summary>${esc(q).replace(/ ([?!:;])/g, "\u00a0$1")}</summary>
          <div class="faq-reponse">${r}</div>
        </details>`).join("")}
      </section>`).join("")}
    </div>
  </div>
</section>

<section class="bande-finale" id="cabinet">
  <div class="enveloppe">
    <span class="marque">${sigle}<span>Pierrel <span class="co">&amp; Co</span></span></span>
    <h2>Conseil en organisation et conformité, à ${esc(SITE.ville)}</h2>
    <p class="mentions">
      Clément Pierrel accompagne les entreprises de ${esc(SITE.zone)} sur leur organisation et
      leur conformité réglementaire : définir ce qui les concerne, tenir la veille, garder les preuves,
      préparation d'audit (ISO 14001, ISO 45001, MASE, Qualiopi). Le premier échange d'une heure
      est sans engagement.
    </p>
    <p class="rangee">
      <a class="bouton bouton-accent" href="mailto:${esc(SITE.courriel)}">${esc(SITE.courriel)}</a>
      <a class="bouton bouton-sobre" href="tel:${esc(SITE.telephoneLien)}">${esc(SITE.telephone)}</a>
    </p>
  </div>
</section>`;

  return page({
    titre: `${SITE.nom} — ${SITE.bareme}`,
    description: "Votre veille réglementaire tenue et prouvable : plan de veille, relevé des textes de votre métier, registre de preuves prêt pour l'audit.",
    zone: "public", actif: "produit", corps, donneesPlan: true
  });
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
  const confirmees = SOURCES.filter((x) => x.confirme);
  const manquantes = SOURCES.filter((x) => !x.confirme);
  const nomCourt = (x) => x.nom.split(" — ")[0];
  const nDomaines = Object.keys(V.domaines).length;
  const nCodes = NAF ? NAF.codes.length : 0;
  const nArticles = C ? C.morceaux.reduce((n, m) => n + m.articles.length, 0) : 0;

  const icone = (chemin) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"
    stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${chemin}</svg>`;

  const etapes = [
    { t: "Les sources officielles", i: '<path d="M6 3h9l3 3v15H6z"/><path d="M15 3v3h3M9 11h6M9 15h6"/>',
      d: `${confirmees.length} sources publiques interrogées, Journal officiel en tête : ${esc(
        [["eurlex-l", "EUR-Lex"], ["travail", "ministère du Travail"], ["cnil", "CNIL"], ["anses", "ANSES"], ["has", "HAS"]]
          .filter(([id]) => confirmees.some((x) => x.id === id)).map(([, l]) => l).join(", "))}…` },
    { t: "Relues toutes les heures", i: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      d: `Un robot relit chaque source toutes les heures${C ? `, et le texte des ${C.codes.length} codes suivis une fois par jour` : ""}.` },
    { t: "Triées pour votre métier", i: '<path d="M4 5h16l-6 8v6l-4-2v-4z"/>',
      d: `${nDomaines} sujets, rattachés aux ${V.divisions.length} familles de métiers${nCodes ? ` et aux ${nCodes} codes APE` : ""}. Ce qui ne vous concerne pas n'arrive pas.` },
    { t: "Ce qu'il faut faire", i: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3.5 6 1 1 2-2M3.5 12l1 1 2-2M3.5 18l1 1 2-2"/>',
      d: "Chaque texte arrive avec les gestes à faire, et le texte lui-même, tel que publié." },
    { t: "Fait, et prouvé", i: '<path d="M12 3 4 6v6c0 4.5 3.4 7.8 8 9 4.6-1.2 8-4.5 8-9V6z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
      d: "Vous cochez « fait » ; la date est gardée, et le registre la montre à l'auditeur." }
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
     l'autre, et un texte lisible sans zoomer. */
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
    { img: "bord.png", t: "Tableau de bord", d: "Ce qui est en retard, ce qui attend une décision, ce qu'il faut faire maintenant." },
    { img: "plan.png", t: "Mon plan", d: "Vos sujets, rangés par rythme de revue : quotidienne, hebdomadaire, mensuelle, trimestrielle." },
    { img: "releve.png", t: "Relevé", d: "Les textes parus, par famille. Chacun avec ce qu'il faut faire et le texte officiel." },
    { img: "registre.png", t: "Registre de preuves", d: "Les revues faites et les décisions prises, datées. C'est ce que demande un auditeur." },
    { img: "secteurs.png", t: "Secteurs", d: `Les ${V.divisions.length} familles de métiers${nCodes ? ` et leurs ${nCodes} codes APE` : ""}, et ce qui s'applique à chacune.` },
    { img: "reglages.png", t: "Réglages", d: "Votre entreprise, ses chiffres, vos réponses, vos alertes. Le plan se refait dessus, aussitôt." }
  ];
  const vignette = (p) => {
    if (!p.img || !ECRANS.includes(p.img)) return `<div class="vignette vignette-vide">${icone('<circle cx="12" cy="12" r="3"/><path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1M7.7 16.3l-2.1 2.1"/>')}</div>`;
    const sombre = p.img.replace(".png", "-sombre.png");
    const im = (f, cl) => `<img class="${cl}" src="assets/ecrans/${esc(f)}" alt="Capture : ${esc(p.t)}" loading="lazy" decoding="async" width="1280" height="860">`;
    return `<figure class="vignette">${agrandir(p.t)}${im(p.img, "ecran-clair")}${ECRANS.includes(sombre) ? im(sombre, "ecran-sombre") : ""}</figure>`;
  };

  const corps = `
<section class="heros heros-court">
  <div class="enveloppe">
    <div class="heros-texte">
      <h1>Comment ça marche</h1>
    </div>
    <p class="heros-sous">
      Du Journal officiel à la case « fait » : ce que le site va chercher, comment il
      trie, et ce que vous voyez. En cinq étapes et trois dessins.
    </p>
  </div>
</section>

<section class="section">
  <div class="enveloppe">
    <h2 class="titre-section">Du Journal officiel à votre écran</h2>
    <ol class="etapes">
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
  <div class="enveloppe deux-temps">
    <div>
      <h2>Ce que vous voyez pour chaque texte</h2>
      <ol class="legende">
        <li><strong>Ce que vous devez faire</strong>, en premier : les gestes, en
          français courant. Le bouton <strong>Fait</strong> garde la date.</li>
        <li><strong>Le texte, tel que publié</strong> : pas un résumé, le texte lui-même.</li>
        <li><strong>D'où vient ce texte</strong> : la source, la date, et le lien direct.
          C'est la source qui fait foi.</li>
      </ol>
    </div>
    <figure class="dessin-cadre"><div class="dessin-large">${dessinFiche}</div><div class="dessin-etroit">${dessinFicheTel}</div></figure>
  </div>
</section>

<section class="section">
  <div class="enveloppe deux-temps deux-temps-inverse">
    <figure class="dessin-cadre"><div class="dessin-large">${dessinRythmes}</div><div class="dessin-etroit">${dessinRythmesTel}</div>
      <figcaption>Exemple sur un trimestre. Votre plan dit quels sujets sont à quel rythme.</figcaption></figure>
    <div>
      <h2>Votre plan, à son rythme</h2>
      <p class="lecture">Tout ne se revoit pas aussi souvent. La sécurité d'un chantier se
        relit chaque semaine ; la fiscalité, chaque mois ; les normes, chaque trimestre.
        Votre plan range vos sujets par rythme, et une revue cochée
        « faite » redevient à faire quand son rythme revient.</p>
    </div>
  </div>
</section>

<section class="section section-tein">
  <div class="enveloppe">
    <h2 class="titre-section">Ce que vous trouvez dans l'application</h2>
    <p class="intro titre-section">Six écrans. Cliquez une capture pour la voir en grand.</p>
    <ul class="pieces">
      ${pieces.map((p) => `<li class="piece">
        ${vignette(p)}
        <h3>${esc(p.t)}</h3>
        <p>${esc(p.d)}</p>
      </li>`).join("")}
    </ul>
  </div>
</section>

<section class="section">
  <div class="enveloppe">
    <h2 class="titre-section">Ce que le site ne fait pas</h2>
    <div class="deux-colonnes" style="margin-top:var(--t5)">
      <p class="reserve"><strong>Ce n'est pas un conseil juridique.</strong> La liste des textes qui
        vous concernent n'est pas garantie complète. Chaque texte reste à vérifier à sa source,
        et ce qu'il implique chez vous, à valider par quelqu'un de compétent.</p>
      <p class="reserve"><strong>${manquantes.length} sources ne sont pas encore relevées.</strong>
        ${esc(manquantes.map((x) => `${nomCourt(x)} (${x.pourquoi || "ne répond pas"})`).join(" · "))}.
        Ce qui vient de là n'apparaît pas dans le relevé.</p>
    </div>
    <p class="rangee rangee-centre" style="margin-top:var(--t5)">
      <a class="bouton bouton-accent" href="abonnement.html">Démarrer un abonnement</a>
      <a class="bouton bouton-sobre" href="connexion.html">Connexion</a>
    </p>
  </div>
</section>`;

  return page({
    titre: `Comment ça marche | ${SITE.nom}`,
    description: "Du Journal officiel à la case « fait » : ce que le site va chercher, comment il trie, et ce que vous voyez.",
    zone: "public", actif: "decouvrir", corps
  });
}

function pageAbonnement(V) {
  const corps = `
<section class="heros">
  <div class="enveloppe">
    <div class="heros-texte"><h1>Démarrer un abonnement</h1></div>
    <p class="heros-sous">
      Trois formules, prix affichés — parce que presque personne ne le fait dans ce
      métier : les offres comparables sont toutes « sur devis ». Montants hors taxes.
    </p>
  </div>
</section>

<section class="section">
  <div class="enveloppe">
    <p class="reserve">
      <strong>Proposition à valider, et paiement pas encore branché.</strong>
      Ces montants sont une proposition construite à partir de la revue du marché, pas une
      grille arrêtée par Clément Pierrel. Et « Démarrer un abonnement » ouvre pour l'instant
      un courriel : le prélèvement automatique suppose un service de paiement, qui n'est pas
      encore en place.
    </p>

    <p class="lecture" style="margin-top:var(--t5)">
      <strong>Laquelle prendre ?</strong> Vous ne savez pas ce qui vous concerne : le
      <strong>cadrage</strong>. Vous le savez, mais vous n'avez pas le temps de suivre :
      la <strong>veille tenue</strong>. Vous passez un audit : la
      <strong>veille et preuves</strong>.
    </p>

    <div class="formules">
      <article class="formule" data-paraitre>
        <span class="etiq">01 — Cadrage</span>
        <p class="prix"><span class="grand">890 €</span> <span class="etiq">une fois</span></p>
        <p class="pour">Vous ne savez pas ce qui vous concerne.</p>
        <p>Une demi-journée chez vous, puis le document écrit : ce qui s'applique, à quel
        rythme le revoir, et qui s'en occupe. Vous le gardez, que vous continuiez ou non.</p>
        <a class="bouton bouton-sobre" href="mailto:${esc(SITE.courriel)}?subject=Cadrage">Demander un cadrage</a>
      </article>
      <article class="formule" data-paraitre>
        <span class="etiq">02 — Veille tenue</span>
        <p class="prix"><span class="grand">180 €</span> <span class="etiq">par mois</span></p>
        <p class="pour">Vous savez, mais vous n'avez pas le temps de suivre.</p>
        <p>Le cadrage, puis on vous prévient dès qu'un texte vous concerne, avec ce qu'il
        change chez vous et ce qu'il faut faire. Accès à l'application. Un établissement,
        un interlocuteur.</p>
        <a class="bouton bouton-sobre" href="mailto:${esc(SITE.courriel)}?subject=Démarrer un abonnement — Veille tenue">Démarrer un abonnement</a>
      </article>
      <article class="formule mise-en-avant" data-paraitre>
        <span class="etiq">03 — Veille et preuves</span>
        <p class="prix"><span class="grand">290 €</span> <span class="etiq">par mois</span></p>
        <p class="pour">Vous passez un audit.</p>
        <p>La veille tenue, plus le registre qui garde chaque revue et chaque décision avec sa
        date, et une revue annuelle sur place. ISO 14001, ISO 45001, MASE, Qualiopi.</p>
        <a class="bouton bouton-accent" href="mailto:${esc(SITE.courriel)}?subject=Démarrer un abonnement — Veille et preuves">Démarrer un abonnement</a>
      </article>
    </div>
  </div>
</section>

<section class="section section-tein" id="essayer">
  <div class="enveloppe">
    <h2 class="titre-section">Essayer avant de s'abonner</h2>
    <p class="intro titre-section">Sans compte et sans mot de passe, avec un jeu d'essai.
    La formule choisie décide des écrans ouverts — c'est exactement ce qui se passera
    avec un vrai abonnement.</p>

    <div class="essai" id="essai">
      <div class="choix-formules" id="choix-formules">
        ${Object.keys(FORMULES).map((id) => `<label class="choix-formule">
          <input type="radio" name="formule" value="${esc(id)}"${id === "preuves" ? " checked" : ""}>
          <span class="corps">
            <span class="titre">${esc(FORMULES[id].l)}</span>
            <span class="prix">${esc(FORMULES[id].prix)}</span>
            <span class="ouvre">${esc(FORMULES[id].ouvre)}</span>
          </span>
        </label>`).join("\n")}
      </div>
      <p class="rangee rangee-centre" style="margin-top:var(--t4)">
        <button type="button" class="bouton bouton-accent" id="entrer-demo">Entrer en démonstration</button>
      </p>
      <p class="etiq rangee rangee-centre" id="etat-session" role="status" style="margin-top:var(--t3)"></p>
    </div>
  </div>
</section>

<section class="section">
  <div class="enveloppe">
    <h2 class="titre-section">Ce qui n'est pas compris</h2>
    <ul class="raisons">
      <li class="raison" data-paraitre>
        <span class="numero" aria-hidden="true">—</span>
        <h3>Le conseil juridique</h3>
        <p>Sur un point litigieux, vous serez orienté vers un avocat. Le service donne
        un cadre méthodologique, il ne tranche pas le droit.</p>
      </li>
      <li class="raison" data-paraitre>
        <span class="numero" aria-hidden="true">—</span>
        <h3>La certification</h3>
        <p>Les organismes certificateurs restent indépendants. On prépare l'audit,
        on ne le délivre pas.</p>
      </li>
      <li class="raison" data-paraitre>
        <span class="numero" aria-hidden="true">—</span>
        <h3>Les démarches à votre place</h3>
        <p>Les déclarations auprès de l'administration restent les vôtres. Plusieurs
        établissements, groupes, secteurs très réglementés : sur devis, parce que ce qui
        s'applique change tout.</p>
      </li>
    </ul>
  </div>
</section>

<section class="bande-finale" id="cabinet">
  <div class="enveloppe">
    <span class="marque">${sigle}<span>Pierrel <span class="co">&amp; Co</span></span></span>
    <h2>Un premier échange d'une heure, sans engagement</h2>
    <p class="mentions">
      Décrivez votre activité en trois lignes et ce qui vous inquiète : on vous dira
      franchement si ${V.divisions.length} fiches de secteur et un registre vous servent,
      ou si votre sujet est ailleurs.
    </p>
    <p class="rangee">
      <a class="bouton bouton-accent" href="mailto:${esc(SITE.courriel)}">${esc(SITE.courriel)}</a>
      <a class="bouton bouton-sobre" href="tel:${esc(SITE.telephoneLien)}">${esc(SITE.telephone)}</a>
    </p>
  </div>
</section>`;

  return page({
    titre: `S'abonner | ${SITE.nom}`,
    description: "Trois formules de veille réglementaire, avec leurs prix affichés.",
    zone: "public", actif: "abonnement", corps
  });
}

function pageConnexion() {
  const corps = `
<section class="heros">
  <div class="enveloppe">
    <div class="heros-texte"><h1>Connexion</h1></div>
    <p class="heros-sous">Pour les abonnés. Vous n'avez pas encore de compte ?
    <a href="abonnement.html">Voir les formules</a>.</p>

    <div class="connexion connexion-seule">
      <form class="carte-connexion" id="form-connexion" novalidate>
        <h2>Se connecter à votre espace</h2>

        <p class="reserve">
          <strong>N'entrez pas un vrai mot de passe ici.</strong>
          Cet écran est la maquette de la future connexion : il n'y a pas encore de
          serveur, donc rien n'est vérifié, rien n'est envoyé et rien n'est enregistré.
          Le champ est là pour montrer à quoi ressemblera l'écran, pas pour servir.
        </p>

        <div class="champ">
          <label for="courriel">Adresse électronique</label>
          <input type="email" id="courriel" name="courriel" autocomplete="username"
                 inputmode="email" placeholder="prenom@entreprise.fr" spellcheck="false">
        </div>

        <div class="champ">
          <label for="motdepasse">Mot de passe</label>
          <input type="password" id="motdepasse" name="motdepasse" autocomplete="off"
                 placeholder="••••••••">
        </div>

        <p class="rangee" style="margin-top:var(--t4)">
          <button type="submit" class="bouton bouton-accent bouton-large">Se connecter</button>
        </p>
        <p class="etiq" id="etat-connexion" role="status" style="margin-top:var(--t3)"></p>
        <p style="margin-top:var(--t3)">
          <a href="mailto:${esc(SITE.courriel)}?subject=Mot de passe oublié">Mot de passe oublié</a>
        </p>
      </form>
    </div>

    <p class="rangee rangee-centre" style="margin-top:var(--t5)">
      <a class="bouton bouton-sobre" href="abonnement.html#essayer">Ou entrer en démonstration</a>
    </p>
  </div>
</section>

<section class="section">
  <div class="enveloppe">
    <h2 class="titre-section">Ce qu'il reste à brancher</h2>
    <ul class="raisons">
      <li class="raison" data-paraitre>
        <span class="numero" aria-hidden="true">1</span>
        <h3>L'authentification</h3>
        <p>Netlify Identity ou un équivalent, pour que les comptes existent, que les
        mots de passe soient vérifiés ailleurs que dans le navigateur, et que les
        pages ne soient plus servies à tout le monde.</p>
      </li>
      <li class="raison" data-paraitre>
        <span class="numero" aria-hidden="true">2</span>
        <h3>Le paiement</h3>
        <p>Stripe ou un équivalent, pour l'abonnement mensuel, son renouvellement et
        sa résiliation — et pour que la formule portée par le compte soit la formule
        réellement payée.</p>
      </li>
      <li class="raison" data-paraitre>
        <span class="numero" aria-hidden="true">3</span>
        <h3>En attendant</h3>
        <p>Le tri par formule se fait dans le navigateur : il décrit le produit, il ne
        le protège pas. Qui regarde la source voit tout, quelle que soit la formule
        choisie. C'est écrit sur chaque écran de l'application.</p>
      </li>
    </ul>
  </div>
</section>`;

  return page({
    titre: `Connexion | ${SITE.nom}`,
    description: "Connexion à l'application de veille réglementaire Pierrel & Co.",
    zone: "public", actif: "connexion", corps
  });
}

/* --- Les avis : de quoi alimenter la cloche ------------------------------- */
/* Le relevé complet est engendré dans deux pages seulement ; la cloche, elle,
   vit sur tous les écrans. On en extrait donc le strict nécessaire — moins de
   deux kilo-octets — plutôt que de charger le référentiel partout. */
function donneesAvis(V, D, C) {
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

  const avis = D.releve.map((x) => {
    const dom = V.domaines[x.domaine];
    const ref = dom && dom.textes.length ? dom.textes[0] : "";
    return {
      d: x.date, t: x.titre, q: x.quoi,
      dom: dom ? dom.nom : x.domaine,
      u: ref ? `texte/${slug(ref)}.html` : "",
      s: x.statut, p: x.priorite === "haute" ? 1 : 0
    };
  }).concat(codes).sort((a, b) => (a.d < b.d ? 1 : -1));
  return "/* Engendré par build.mjs — ne pas modifier à la main. */\n" +
         "window.AVIS = " + JSON.stringify(avis) + ";\n";
}

/* --- Les données du simulateur --------------------------------------------- */
/* Le référentiel complet pèse 75 Ko : trop pour l'accueil. On n'y envoie que ce
   dont le calcul a besoin — nom, famille et rythme des domaines, périmètre de
   base de chaque division, questions de contexte. */
function donneesPlan(V, METIERS) {
  const f = {};
  Object.keys(V.frequences).forEach((id) => { f[id] = { l: V.frequences[id].l, ordre: V.frequences[id].ordre }; });

  const d = {};
  Object.keys(V.domaines).forEach((id) => { d[id] = { n: V.domaines[id].nom, f: V.domaines[id].frequence }; });

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

  // Chaque référence citée doit avoir sa fiche, et chaque fiche doit se
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

async function main() {
  const V = await chargeFichier("assets/referentiel.js", "VEILLE");
  const PIEGES = await chargeFichier("contenu/pieges.js", "PIEGES");
  const METIERS = await chargeFichier("contenu/metiers.js", "METIERS");
  const D = await chargeFichier("contenu/demo.js", "DEMO");
  const TEXTES = await chargeFichier("contenu/textes.js", "TEXTES");

  // Le relevé officiel n'existe que si outils/jorf.mjs a tourné. Son absence
  // n'empêche pas de construire : la page le dit, et montre le jeu d'essai.
  const cheminJO = resolve(RACINE, "contenu/veille-releve.json");
  const JO = existsSync(cheminJO) ? JSON.parse(await readFile(cheminJO, "utf8")) : null;

  // Le texte des codes n'existe que si outils/codes.mjs a tourné. Son absence
  // n'empêche pas de construire : les fiches gardent leur lien et le disent.
  // La nomenclature NAF entière : 732 codes APE. Son absence n'empêche pas de
  // construire — la page des secteurs retombe sur les 88 divisions seules.
  const LIENS = await chargeFichier("contenu/liens.js", "LIENS");

  const SOURCES = await chargeFichier("contenu/sources.js", "SOURCES");

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
  const avis = donneesAvis(V, D, C);
  await writeFile(join(SORTIE, "assets", "avis-data.js"), avis);

  // Le manifeste et le service worker vivent à la racine : un worker servi
  // depuis assets/ ne contrôlerait que assets/.
  await writeFile(join(SORTIE, "manifest.webmanifest"), MANIFESTE);

  // Le cache du service worker est nommé d'après l'empreinte de l'habillage.
  // Une empreinte stable évite de purger le cache pour rien ; une empreinte
  // qui change purge tout, et c'est ce qui fait qu'une publication atteint
  // les visiteurs déjà venus.
  /* Tout ce que les pages chargent avec « ?v= » doit entrer dans l'empreinte :
     sans amorce.js ni les données des alertes, un changement de l'un d'eux
     restait servi dans son ancienne version. */
  const habillage = ["site.css", "polices.css", "app.js", "theme.js", "amorce.js",
                     "session.js", "entreprise.js", "avis.js", "referentiel.js"];
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

  await writeFile(join(SORTIE, "index.html"), pageAccueil(V, D, METIERS, ECRANS, C, NAF, SOURCES, AVIS));
  await writeFile(join(SORTIE, "le-site.html"), pageInfos({
    titre: "Le site en détail", h1: "Le site en détail",
    sous: "D'où viennent les textes, ce que vous voyez pour chacun, comment le tri se fait, et ce que vous gardez.",
    encarts: encartsDuSite(V, C, NAF, SOURCES),
    suite: `<a class="bouton bouton-accent" href="decouvrir.html">Comment ça marche, en dessins</a>
      <a class="bouton bouton-sobre" href="index.html#simulateur">Voir ce qui me concerne</a>`
  }));
  await writeFile(join(SORTIE, "nous.html"), pageInfos({
    titre: "Qui sommes-nous", h1: "Qui sommes-nous",
    sous: `${esc(SITE.nom)}, conseil en organisation et conformité à ${esc(SITE.ville)} : le cabinet, votre interlocuteur, ce qu'on fait pour vous et les audits qu'on prépare.`,
    encarts: encartsDeNous(),
    suite: `<a class="bouton bouton-accent" href="mailto:${esc(SITE.courriel)}">${esc(SITE.courriel)}</a>
      <a class="bouton bouton-sobre" href="tel:${esc(SITE.telephoneLien)}">${esc(SITE.telephone)}</a>
      <a class="bouton bouton-sobre" href="abonnement.html">Les tarifs</a>`
  }));
  await writeFile(join(SORTIE, "metiers.html"), pageMetiers(V, NAF));
  await writeFile(join(SORTIE, "abonnement.html"), pageAbonnement(V));
  await writeFile(join(SORTIE, "decouvrir.html"), pageDecouvrir(V, ECRANS, C, NAF, SOURCES));
  await writeFile(join(SORTIE, "connexion.html"), pageConnexion());

  await writeFile(join(SORTIE, "app", "index.html"), appTableauBord(V, D, C, LIENS));
  await writeFile(join(SORTIE, "app", "plan.html"), appPlan(V, D, C, LIENS));
  await writeFile(join(SORTIE, "app", "releve.html"), appReleve(V, D, JO, C, LIENS, SOURCES));
  await writeFile(join(SORTIE, "app", "registre.html"), appRegistre(V, D));
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
  await writeFile(join(SORTIE, "app", "textes.html"), appTextes(V, TEXTES, parTexte, C, LIENS));
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
  console.log(`\n_site/ prêt — ${(total / 1024).toFixed(1)} Ko, ` +
    `${V.divisions.length + Object.keys(parTexte).length + (C ? C.morceaux.length : 0) + 11} pages, ` +
    `${Object.keys(V.domaines).length} domaines, ${Object.keys(PIEGES).length} secteurs avec pièges.`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
