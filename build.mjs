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
             ouvre: "Le plan de veille et les 88 fiches de secteur." },
  veille:  { l: "Veille tenue", rang: 2, prix: "180 € par mois",
             ouvre: "Le cadrage, plus le tableau de bord et le relevé des textes." },
  preuves: { l: "Veille et preuves", rang: 3, prix: "290 € par mois",
             ouvre: "Tout, registre de preuves compris." }
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

const fleche = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"
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
        <p class="intro">Posée sur l'écran d'accueil, elle s'ouvre comme une application :
        sans barre d'adresse, et le plan de veille reste consultable hors ligne — sur un
        chantier, dans un entrepôt, là où le réseau tombe.</p>
        <p class="rangee" style="margin-top:var(--t4)">
          <button type="button" class="bouton bouton-accent" id="installer-appli" hidden>
            Installer maintenant
          </button>
          <a class="bouton bouton-sobre" href="${a("connexion.html")}">Ouvrir dans le navigateur</a>
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
function page({ titre, description, racine = "", zone = "public", actif = "", corps,
                attrsBody = "", verrou = false, donneesPlan = false, formule = "" }) {
  const a = (f) => racine + f;
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

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
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
<script>/* Avant tout rendu : sinon la page clignote en clair, et les éléments
   qui doivent apparaître en défilant sauteraient de visible à caché.
   Le document n'est marqué « anime » que si JavaScript tourne et que le
   visiteur n'a pas demandé moins d'animations — sans quoi rien n'est caché. */
window.PCO_THEME.appliquer();
if (!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)) {
  document.documentElement.classList.add("anime");
}</script>
</head>
<body class="zone-${zone}" data-racine="${racine || "./"}"${formule ? ` data-formule="${esc(formule)}"` : ""}${attrsBody}>

<a class="evitement" href="#contenu">Aller au contenu</a>

<header class="bandeau">
  <div class="enveloppe bandeau-interieur">
    <a class="marque" href="${a(zone === "app" ? "app/index.html" : "index.html")}">
      ${sigle}<span>Pierrel <span class="co">&amp; Co</span></span>
    </a>
    ${zone === "public" ? `<a class="bouton bouton-bandeau" href="${a("connexion.html")}">Connexion</a>` : ""}
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
          <li><a href="${a("abonnement.html")}">S'abonner et voir les tarifs</a></li>
          <li><a href="${a("connexion.html")}">Connexion</a></li>
        </ul>
      </div>
      <div>
        <h2>L'application</h2>
        <ul>
          <li><a href="${a("app/index.html")}">Tableau de bord</a></li>
          <li><a href="${a("app/plan.html")}">Mon plan de veille</a></li>
          <li><a href="${a("app/releve.html")}">Relevé des textes</a></li>
          <li><a href="${a("app/registre.html")}">Registre de preuves</a></li>
          <li><a href="${a("app/secteurs.html")}">Fiches par secteur</a></li>
          <li><a href="${a("app/reglages.html")}">Mon entreprise et mes alertes</a></li>
        </ul>
      </div>
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
`;
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

function blocDomaine(C, LIENS, id, d, origine, lienSecteur = "", racine = "") {
  return `<article class="bloc-domaine" id="domaine-${esc(id)}" data-domaine="${esc(id)}" data-origine="${origine}"${origine === "declencheur" || origine === "hors" ? " hidden" : ""}>
  <div class="bloc-domaine-tete">
    <h3>${esc(d.nom)}</h3>
    ${origine === "declencheur" ? '<span class="marque-ajout">ajouté par votre contexte</span>' : ""}
  </div>
  <p class="bloc-domaine-resume">${esc(d.resume)}</p>
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
    <ul class="jalons">
      <li><span class="fort" id="tete-nom">${esc(D.entreprise.nom)}</span></li>
      <li>${lienNaf ? `<a href="${lienNaf}">NAF <span id="tete-naf">${esc(D.entreprise.nafComplet)}</span></a>`
                    : `<span>NAF <span id="tete-naf">${esc(D.entreprise.nafComplet)}</span></span>`}</li>
      <li><span id="tete-ville">${esc(D.entreprise.ville)}</span></li>
      <li><span><span id="tete-effectif">${esc(D.entreprise.effectif)}</span> salariés</span></li>
      <li><span>Suivi depuis ${esc(D.entreprise.depuis)}</span></li>
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
      <p class="titre">${esc(t.titre)}</p>
      <p class="meta etiq">${esc(d.nom)}${t.priorite === "haute" ? " · prioritaire" : ""}</p>
      <ul class="a-faire">${(d.actions || []).slice(0, 3).map((a) => `<li>${esc(a)}</li>`).join("")}</ul>
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
  return `<li class="ligne-releve statut-${s.c}">
  <details>
    <summary>
      <span class="mono date">${esc(dateFr(t.date))}</span>
      <span class="corps">
        <span class="titre">${esc(t.titre)}</span>
        <span class="quoi">${esc(t.quoi)}</span>
        <span class="meta etiq">${esc(t.nature)} · ${esc(d ? d.nom : t.domaine)}${t.priorite === "haute" ? " · prioritaire" : ""}</span>
      </span>
      <span class="statut etiq">${esc(s.l)}</span>
      ${chevron}
    </summary>
    <div class="detail">
      ${d ? `<p class="lecture">${esc(d.resume)}</p>
      <div class="detail-grille">
        <div>
          <span class="etiq">Ce qu'il faut faire</span>
          <ul class="a-faire">${(d.actions || []).map((a) => `<li>${esc(a)}</li>`).join("")}</ul>
        </div>
        <div>
          <span class="etiq">Les textes, à la source</span>
          <ul>${d.textes.map((ref) => {
            const L = lienDuTexte(C, LIENS, ref);
            return `<li><a href="${racine}texte/${slug(ref)}.html">${esc(ref)}</a><br>
              <a class="lien-officiel" href="${esc(L.url)}" target="_blank" rel="noopener"
                 title="${esc(L.quoi)}">${esc(intituleDuLien(L))} ${sortant}</a></li>`;
          }).join("")}</ul>
        </div>
      </div>` : ""}
      <p class="rangee" style="margin-top:var(--t4)">
        <button type="button" class="bouton bouton-sobre imprimer-fiche">${imprimante} Enregistrer en PDF</button>
        <a class="lien-fleche" href="${racine}plan.html">Voir ce domaine dans le plan ${fleche}</a>
        ${division ? `<a class="lien-fleche" href="${racine}secteur/${esc(division)}.html">Ouvrir la fiche de secteur ${fleche}</a>` : ""}
      </p>
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
    `Le périmètre retenu pour ${esc(D.entreprise.nom)} : ${total} domaines, groupés par rythme de revue.`,
    ficheDeLEntreprise(V, D)) + `

${rubrique({ etiq: "Le périmètre", id: "plan-perimetre", contenu: `
  <dl class="faits">
    <div><dt class="etiq">Domaines suivis</dt><dd><span class="grand" id="plan-total">${total}</span></dd></div>
    <div><dt class="etiq">Code de l'entreprise</dt><dd><span class="grand" id="plan-naf">${esc(D.entreprise.nafComplet || D.entreprise.naf)}</span></dd></div>
    <div><dt class="etiq">Responsable</dt><dd id="plan-responsable">${esc(D.entreprise.responsable)}</dd></div>
  </dl>
  <p style="margin-top:var(--t4)">
    <span class="etiq">Contexte retenu</span><span id="plan-contexte">${esc(contexteNoms.join(" · "))}</span>
  </p>
  <p class="note-source" id="plan-origine">
    Ce plan est celui du jeu d'essai. Renseignez votre entreprise dans
    <a href="reglages.html">Réglages</a> : il se refera dessus, ici même.
  </p>` })}

${parFrequence.map((g) => {
    const ech = D.echeances.filter((e) => e.frequence === g.id)[0];
    const dedans = g.ids.filter((id) => base.includes(id) || ajoutes.has(id));
    return rubrique({ etiq: g.f.l, id: `frequence-${g.id}`, contenu: `
      <p class="lecture">${esc(g.f.d)}${ech ? ` Prochaine revue : <strong>${esc(dateFr(ech.prochaine))}</strong>${ech.retard ? " — en retard." : "."}` : ""}</p>
      ${g.ids.map((id) => {
        const division = divisionDuDomaine(V, id);
        const origine = base.includes(id) ? "base" : (ajoutes.has(id) ? "declencheur-retenu" : "hors");
        return blocDomaine(C, LIENS, id, V.domaines[id], origine,
          division ? `secteur/${division}.html` : "");
      }).join("\n")}`, attrs: ` data-groupe-frequence="${esc(g.id)}"${dedans.length ? "" : " hidden"}` });
  }).join("\n")}`;

  return page({
    titre: `Mon plan de veille | ${SITE.nom}`,
    description: "Le périmètre de veille retenu.",
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
  const quoi = { modifie: "Texte modifié", nouveau: "Entre au périmètre", sorti: "Sort du périmètre" };
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
function ligneJO(t, i) {
  const noms = t.domaines.map((d) => d.nom);
  return `<li class="ligne-releve statut-attente">
  <details${i === 0 ? " open" : ""}>
    <summary>
      <span class="mono date">${esc(dateFr(t.date))}</span>
      <span class="corps">
        <span class="titre">${esc(t.titre)}</span>
        <span class="quoi">${esc(t.corps.slice(0, 180).replace(/\s+\S*$/, ""))}…</span>
        <span class="meta etiq">${esc(t.nature)} · ${esc(noms.join(" · "))}</span>
      </span>
      <span class="statut etiq">À analyser</span>
      ${chevron}
    </summary>
    <div class="detail">
      <p class="etiq">Texte intégral, tel que publié au Journal officiel</p>
      <div class="texte-officiel">${esc(t.corps).replace(/\n/g, "<br>")}</div>
      ${t.nota ? `<p class="note-source"><strong>Nota.</strong> ${esc(t.nota)}</p>` : ""}
      <p class="note-source">
        Source : Journal officiel de la République française, données ouvertes de la DILA,
        sous Licence Ouverte. Version publiée le ${esc(dateFr(t.date))}${t.id ? ` — identifiant ${esc(t.id)}` : ""}.
        En cas de doute, se référer à Légifrance, qui fait foi.
      </p>
      <p class="rangee" style="margin-top:var(--t4)">
        <button type="button" class="bouton bouton-sobre imprimer-fiche">${imprimante} Enregistrer en PDF</button>
      </p>
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

  const sommaire = `${avecDate ? `<p class="note-source" style="margin-bottom:var(--t4)">
    <strong>Lesquels sont nouveaux.</strong> La colonne « en vigueur depuis » donne la
    dernière évolution du texte, pour les ${avecDate} textes dont nous publions le contenu
    consolidé${neufs ? ` ; ${neufs} ${neufs > 1 ? "ont" : "a"} bougé à la dernière relève et porte${neufs > 1 ? "nt" : ""} la marque <span class="marque-neuf">Nouveau</span>` : " ; aucun n'a bougé à la dernière relève"}.
    Pour les autres, nous n'avons pas encore la date, et nous ne l'inventons pas.
  </p>` : ""}<div class="tableau-boite">
  <table class="tableau-familles">
  <thead><tr><th scope="col">Catégorie</th><th scope="col">Textes</th><th scope="col">Ce que c'est</th></tr></thead>
  <tbody>
    ${familles.map((g) => `<tr${g.textes.length ? "" : ' class="famille-vide"'}>
      <th scope="row" data-intitule="Catégorie">${esc(g.cl.l)}${g.textes.length
        ? lienCarte(`#textes-${esc(g.id)}`, `Aller à la catégorie ${g.cl.l}`) : ""}</th>
      <td data-intitule="Textes"><span class="compte-famille">${g.textes.length}</span></td>
      <td data-intitule="Ce que c'est">${esc(g.cl.d)}</td>
    </tr>`).join("")}
  </tbody>
</table>
</div>`;

  const tables = familles.filter((g) => g.textes.length).map((g) => `
  <section class="famille-textes" id="textes-${esc(g.id)}"${cherchable ? " data-groupe" : ""}>
    <h3>${esc(g.cl.l)} <span class="etiq">${g.textes.length} texte${g.textes.length > 1 ? "s" : ""}</span></h3>
    <p class="precision">${esc(g.cl.d)}</p>
    <div class="tableau-boite">
    <table class="tableau-textes">
      <thead><tr>
        <th scope="col">Texte</th>
        <th scope="col">En vigueur depuis</th>
        <th scope="col">Ce qu'il exige</th>
        <th scope="col">Où le lire</th>
      </tr></thead>
      <tbody>
        ${g.textes.map((e) => {
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
    </div>
  </section>`).join("");

  return { sommaire, tables };
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

function tableauDesFamilles(V, groupes, titreDe, dateDe, domaineDe) {
  if (!groupes.length) return "";
  return `<div class="tableau-boite">
  <table class="tableau-familles">
  <thead><tr>
    <th scope="col">Famille</th>
    <th scope="col">Textes</th>
    <th scope="col">Le plus récent</th>
    <th scope="col">Ce qu'il faut faire en premier</th>
  </tr></thead>
  <tbody>
    ${groupes.map((g) => {
      const liste = g.textes.slice().sort((a, b) => (dateDe(a) < dateDe(b) ? 1 : -1));
      if (!liste.length) {
        return `<tr class="famille-vide">
      <th scope="row" data-intitule="Famille">${esc(g.cl.l)}</th>
      <td data-intitule="Textes"><span class="compte-famille">0</span></td>
      <td data-intitule="Le plus récent" colspan="2">Rien à traiter de ce côté sur la période.</td>
    </tr>`;
      }
      const t = liste[0];
      const d = V.domaines[domaineDe(t)];
      const action = d && d.actions && d.actions.length ? d.actions[0] : "—";
      return `<tr>
      <th scope="row" data-intitule="Famille">${esc(g.cl.l)}${
        lienCarte(`#famille-${esc(g.id)}`, `Aller à la famille ${g.cl.l}`)}</th>
      <td data-intitule="Textes"><span class="compte-famille">${liste.length}</span></td>
      <td data-intitule="Le plus récent">
        <span class="mono date">${esc(dateFr(dateDe(t)))}</span>
        <span class="titre">${esc(titreDe(t))}</span></td>
      <td data-intitule="Ce qu'il faut faire en premier">${esc(action)}</td>
    </tr>`; }).join("")}
  </tbody>
</table>
</div>`;
}

/* --- Relevé ------------------------------------------------------------------ */
function appReleve(V, D, JO, C, LIENS) {
  const parStatut = Object.keys(STATUTS).map((s) => ({
    s, l: STATUTS[s].l, n: D.releve.filter((t) => t.statut === s).length
  }));

  const officiel = JO && JO.textes && JO.textes.length;
  const groupes = groupesParClassement(V, D.releve, (t) => t.domaine);

  const corps = enTeteApp(D, "Relevé des textes",
    "Les textes parus qui touchent votre périmètre, et seulement ceux-là. Ce que chacun change, et où en est la décision.",
    ficheDeLEntreprise(V, D)) + `

${officiel ? rubrique({ etiq: "Relevé officiel", contenu: `
  <dl class="compteurs">
    <div><dt class="etiq">Textes de droit</dt><dd><span class="grand">${JO.textes.filter((x) => x.genre === "texte").length}</span></dd></div>
    <div><dt class="etiq">Publications officielles</dt><dd><span class="grand">${JO.textes.filter((x) => x.genre !== "texte").length}</span></dd></div>
    <div><dt class="etiq">Sources qui ont répondu</dt><dd><span class="grand">${JO.rapport.filter((r) => r.retenus).length}</span>
      <span class="precision">sur ${JO.rapport.length} interrogées</span></dd></div>
    <div><dt class="etiq">Dernière relève</dt><dd>${esc(dateFr(JO.releve_le))}</dd></div>
  </dl>
  <p class="lecture" style="margin-top:var(--t4)">
    Relevé automatiquement sur les sources officielles — Journal officiel en tête — et
    filtré sur les domaines du référentiel. Le contenu est dans la page : rien à aller
    chercher ailleurs. Un <strong>texte</strong> est du droit ; une
    <strong>publication</strong> est un commentaire officiel, qui compte pour la veille
    mais n'en est pas.
  </p>
  ${JO.rapport.some((r) => r.souci) ? `<p class="reserve" style="margin-top:var(--t4)">
    <strong>Sources muettes à la dernière relève.</strong>
    ${esc(JO.rapport.filter((r) => r.souci).map((r) => r.nom).join(" · "))}.
    Elles sont signalées plutôt que remplacées : ce qui n'a pas été relevé ne figure
    pas ici, et ne doit pas être pris pour une absence de texte.</p>` : ""}
  <ul class="liste-releve" style="margin-top:var(--t4)">
    ${JO.textes.map((t, i) => ligneJO(t, i)).join("")}
  </ul>` }) : rubrique({ etiq: "Relevé officiel", contenu: `
  <p class="reserve">
    <strong>Aucune relève n'a encore été faite.</strong>
    Le robot qui va chercher sur les 25 sources officielles tourne
    <strong>toutes les heures</strong>, et le texte des codes une fois par jour ;
    ce qu'il trouve est publié aussitôt. Cette page-ci a été construite sans
    relevé — c'est le cas sur un poste de développement, dont le réseau ne joint
    pas ces hôtes. Elle montre donc le jeu d'essai ci-dessous, et rien d'autre :
    pas de texte inventé.
  </p>` })}

${C ? rubrique({ etiq: "Ce qui a changé dans les codes", contenu: `
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
  ${noteDeSource(C)}` }) : ""}

${rubrique({ etiq: officiel ? "Jeu d'essai" : "Le relevé", aplat: true, contenu: `
  <p class="lecture">${officiel
    ? "Les textes de démonstration, conservés pour montrer le cycle complet : analyse, décision, trace."
    : "Rangés par nature : ce qui touche les personnes, ce qui touche l'hygiène, ce qui touche le contrat, ce qui touche le site, et ce qui tient à votre métier. Les textes écartés ne figurent pas ici : ils sont tracés dans le registre, avec le motif de leur mise à l'écart."}</p>
  <dl class="compteurs" style="margin-top:var(--t4)">
    ${parStatut.map((x) => `<div><dt class="etiq">${esc(x.l)}</dt><dd><span class="grand">${x.n}</span></dd></div>`).join("")}
  </dl>
  ${tableauDesFamilles(V, groupes, (t) => t.titre, (t) => t.date, (t) => t.domaine)}
  ${groupes.filter((g) => g.textes.length).map((g) => `
  <section class="famille-releve" id="famille-${esc(g.id)}">
    <h3>${esc(g.cl.l)} <span class="etiq">${g.textes.length} texte${g.textes.length > 1 ? "s" : ""}</span></h3>
    <p class="precision">${esc(g.cl.d)}</p>
    <ul class="liste-releve">
      ${g.textes.map((t) => ligneReleve(V, C, LIENS, t)).join("")}
    </ul>
  </section>`).join("")}` })}`;

  return page({
    titre: `Relevé des textes | ${SITE.nom}`,
    description: "Les textes parus qui touchent le périmètre.",
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
      ${NAF ? `La nomenclature d'activités française en entier : ses ${codes.length} codes APE,
      ceux que porte votre entreprise — 4322B, 5610A, 8690F. Chacun mène au périmètre
      de veille de sa division, parce que c'est à ce niveau que les obligations se
      ressemblent.`
      : `La nomenclature d'activités française, division par division. Ouvrez un secteur
      pour voir ses textes, ses obligations et les pièges du métier.`}
    </p>
    <div class="recherche" style="margin-top:var(--t5)">
      <label class="etiq" for="recherche-secteur">Chercher un code, un métier, un mot</label>
      <input type="search" id="recherche-secteur" placeholder="4322B, plomberie, boulangerie, 43…"
             autocomplete="off" spellcheck="false">
      <p class="recherche-compte etiq"><span id="compte-secteurs"></span></p>
    </div>
    ${NAF ? `<p class="note-source">
      ${esc(NAF.source.nom)}, relevée le ${esc(dateFr(NAF.releve))}. Votre code APE figure
      sur votre avis de situation INSEE et sur vos bulletins de paie.
    </p>` : ""}
  </div>
</section>

<section class="rubrique">
<div class="enveloppe" data-unite="${NAF ? "codes" : "secteurs"}">
  <p id="aucun-secteur" class="etat-vide" hidden>
    Aucun code ne correspond. Essayez les deux premiers chiffres, ou un mot du métier.
  </p>
  <div id="liste-secteurs">
    ${groupes.map((g) => {
      const mots = METIERS[g.d.c] || [];
      const adresse = `secteur/${esc(g.d.c)}-${slug(g.d.l)}.html`;
      const commun = [g.d.c, g.d.l, g.section ? g.section.l : "", ...mots].join(" ");
      return `
    <section class="grappe grappe-naf" data-groupe>
      <h2 class="etiq">
        <span class="lettre">${esc(g.d.c)}</span>
        <a href="${adresse}">${esc(g.d.l)}</a>
        <span class="precision">${g.codes.length ? `${g.codes.length} code${g.codes.length > 1 ? "s" : ""} APE` : "division"}</span>
      </h2>
      <ul class="puces">
        ${(g.codes.length ? g.codes.map((c) => `<li data-recherche="${esc([c.c, c.c.replace(".", ""), c.l, commun].join(" "))}">
          <a href="${adresse}?ape=${esc(c.c.replace(".", ""))}" title="${esc(c.l)}">
            <span class="code">${esc(c.c)}</span><span class="nom">${esc(c.l)}</span></a></li>`)
          : [`<li data-recherche="${esc(commun)}">
          <a href="${adresse}" title="${esc(g.d.l)}">
            <span class="code">${esc(g.d.c)}</span><span class="nom">${esc(g.d.l)}</span></a></li>`]).join("\n")}
      </ul>
    </section>`; }).join("\n")}
  </div>
</div>
</section>`;

  return page({
    titre: `Trouvez votre code | ${SITE.nom}`,
    description: NAF
      ? `Les ${codes.length} codes APE de la nomenclature NAF, et le périmètre de veille de chacun.`
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
  <ul class="sources-bande" style="justify-content:flex-start;margin-top:var(--t3)">
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
      Chaque texte de référence a sa fiche : à qui il s'applique, ce qu'il exige, et le
      texte officiel lui-même quand nous savons le relever. Lisible ici, sans quitter
      le site.${C ? ` <strong>${Object.keys(C.perimetres).filter((r) => (C.perimetres[r] || []).length).length} fiches
      portent le texte intégral</strong>, soit ${C.morceaux.reduce((n, m) => n + m.articles.length, 0)}
      articles de code, relevés le ${esc(dateFr(C.preleve))}.` : ""}
    </p>
    <div class="recherche" style="margin-top:var(--t5)">
      <label class="etiq" for="recherche-secteur">Chercher</label>
      <input type="search" id="recherche-secteur" placeholder="amiante, RGPD, code du travail…"
             autocomplete="off" spellcheck="false">
      <p class="recherche-compte etiq"><span id="compte-secteurs">${refs.length} textes</span></p>
    </div>
  </div>
</section>

<section class="rubrique">
<div class="enveloppe" data-unite="textes">
  <h2>Les textes, par catégorie</h2>
  ${tableaux.sommaire}
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
      <div><dt class="etiq">Rythme le plus serré</dt><dd>${esc(rythme)}</dd></div>
      <div><dt class="etiq">Questions de contexte</dt><dd><span class="grand">${declencheurs.length}</span></dd></div>
      ${apes.length ? `<div><dt class="etiq">Codes APE</dt><dd><span class="grand">${apes.length}</span></dd></div>` : ""}
    </dl>
  </div>
</section>

${rubrique({ etiq: "Les textes qui s'appliquent", contenu: `
  <p class="lecture">${propres.length
    ? `${propres.length} texte${propres.length > 1 ? "s" : ""} propre${propres.length > 1 ? "s" : ""} à ce métier, et ${socle.length} du socle commun à toute entreprise. Les premiers d'abord : ce sont eux qui vous distinguent.`
    : `Ce secteur n'a pas de texte qui lui soit propre : son périmètre est celui du socle commun à toute entreprise, ${socle.length} textes.`}
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
  <p class="lecture">Cochez ce qui est vrai pour l'entreprise : les domaines correspondants
  s'ajoutent au périmètre ci-dessus.</p>
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
      <span class="precision">Tous relèvent du même périmètre de veille : c'est à ce niveau que les obligations se ressemblent.</span>
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
      Décrivez votre entreprise une fois : le périmètre de veille se recalcule dessus,
      et les textes visent juste. Réglez ensuite ce que vous voulez recevoir, et à quel
      rythme.
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
      <strong>Rien de ceci ne quitte votre navigateur.</strong>
      Il n'y a pas encore de serveur : ces informations sont gardées sur cet appareil
      seulement, ne sont transmises à personne, et disparaissent si vous videz les
      données du site. N'y mettez rien que vous ne voudriez pas y retrouver.
    </p>

    <div class="simulateur" style="margin-top:var(--t5)">
      <form class="reglages" id="form-entreprise" novalidate>
        <div class="reglage">
          <label class="etiq" for="e-nom">Raison sociale</label>
          <input type="text" id="e-nom" name="nom" placeholder="${esc(D.entreprise.nom)}" autocomplete="organization">
        </div>
        ${NAF ? `<div class="reglage">
          <label class="etiq" for="e-activite">Votre activité, en vos mots</label>
          <input type="text" id="e-activite" name="activite" autocomplete="off" spellcheck="false"
                 placeholder="plomberie chauffage, boulangerie, transport de marchandises…">
          <p class="precision">Écrivez ce que vous faites : le site cherche votre code APE
          parmi les ${NAF.codes.length} de la nomenclature.</p>
          <div class="propositions" id="e-propositions" hidden></div>
        </div>` : ""}
        <div class="reglage">
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
          ${NAF ? `<p class="precision" id="e-division">Il figure sur votre avis de situation
          INSEE et sur vos bulletins de paie. Le périmètre se calcule sur sa division.</p>` : ""}
        </div>
        <div class="reglage">
          <label class="etiq" for="e-ville">Commune de l'établissement</label>
          <input type="text" id="e-ville" name="ville" placeholder="${esc(D.entreprise.ville)}" autocomplete="address-level2">
        </div>
        <div class="reglage">
          <label class="etiq" for="e-effectif">Effectif</label>
          <input type="number" id="e-effectif" name="effectif" min="0" max="100000"
                 placeholder="${esc(D.entreprise.effectif)}" inputmode="numeric">
        </div>
        <div class="reglage">
          <label class="etiq" for="e-responsable">Responsable de la veille</label>
          <input type="text" id="e-responsable" name="responsable" placeholder="${esc(D.entreprise.responsable)}" autocomplete="name">
        </div>
        <div class="reglage">
          <span class="etiq">Votre contexte</span>
          <div class="cases" id="e-contexte"></div>
        </div>
        <p class="rangee">
          <button type="submit" class="bouton bouton-accent">Enregistrer</button>
          <button type="button" class="bouton bouton-sobre" id="e-reinit">Revenir au jeu d'essai</button>
        </p>
        <p class="etiq" id="e-etat" role="status"></p>
      </form>

      <div class="resultat">
        <h3 id="e-titre">${esc(D.entreprise.nom)}</h3>
        <p>Le périmètre que ces informations donnent, calculé comme dans le plan de veille.</p>
        <hr class="filet">
        <ul class="coup-d-oeil">
          <li>
            <span class="pastille"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v16l-7-3-7 3Z"/></svg></span>
            <span><span class="etiq">Domaines retenus</span><span class="valeur" id="e-total">—</span></span>
          </li>
          <li>
            <span class="pastille ambre"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></span>
            <span><span class="etiq">Rythme le plus serré</span><span class="valeur" id="e-rythme">—</span></span>
          </li>
          <li>
            <span class="pastille verte"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></span>
            <span><span class="etiq">Ajoutés par le contexte</span><span class="valeur" id="e-ajouts">—</span></span>
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
      <strong>Aucun courriel ne part aujourd'hui.</strong>
      L'envoi suppose un serveur, qui n'est pas en place. Ce que vous réglez ici est
      gardé dans votre navigateur et servira de réglage le jour où l'envoi sera branché.
      En attendant, l'aperçu ci-contre montre exactement ce que vous recevriez.
    </p>

    <div class="simulateur" style="margin-top:var(--t5)">
      <form class="reglages" id="form-alertes" novalidate>
        <div class="reglage">
          <label class="etiq" for="a-courriel">Adresse de réception</label>
          <input type="email" id="a-courriel" name="courriel" placeholder="prenom@entreprise.fr"
                 inputmode="email" spellcheck="false" autocomplete="email">
        </div>
        <div class="reglage">
          <label class="etiq" for="a-rythme">Rythme d'envoi</label>
          <select id="a-rythme" name="rythme">
            <option value="immediat">À chaque texte relevé</option>
            <option value="quotidien">Un résumé par jour</option>
            <option value="hebdomadaire" selected>Un résumé par semaine</option>
            <option value="mensuel">Un résumé par mois</option>
          </select>
        </div>
        <div class="reglage">
          <label class="etiq" for="a-seuil">Ce qui déclenche un envoi</label>
          <select id="a-seuil" name="seuil">
            <option value="tout" selected>Tout texte qui touche mon périmètre</option>
            <option value="prioritaire">Seulement les textes prioritaires</option>
            <option value="action">Seulement ceux qui demandent une action</option>
          </select>
        </div>
        <div class="reglage">
          <span class="etiq">Aussi</span>
          <div class="cases">
            <label class="case">
              <input type="checkbox" id="a-revues" checked>
              <span><span class="intitule">Me rappeler les revues à faire</span>
              <span class="aide">Un rappel avant chaque échéance de revue, et un autre si elle passe.</span></span>
            </label>
            <label class="case">
              <input type="checkbox" id="a-pdf" checked>
              <span><span class="intitule">Joindre la fiche de chaque texte</span>
              <span class="aide">En PDF, prête à classer dans le dossier d'audit.</span></span>
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
        <p>Ce que vous recevriez, avec vos réglages et le relevé de la démonstration.</p>
        <hr class="filet">
        <div class="apercu-courriel" id="a-apercu"></div>
        <p class="note-source">
          Maquette rendue dans la page. Rien n'est envoyé, et l'adresse saisie ne quitte
          pas ce navigateur.
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
function portable(ECRANS, nom, alt) {
  if (!ECRANS.includes(nom)) {
    return `<p class="ecran-absent etiq">Capture manquante : ${esc(nom)} — lancer outils/captures.mjs</p>`;
  }
  const sombre = nom.replace(".png", "-sombre.png");
  const img = (f, classe) => `<img class="${classe}" src="assets/ecrans/${esc(f)}" alt="${esc(alt)}"
         loading="lazy" decoding="async" width="1280" height="860">`;
  return `<figure class="portable" style="margin:0">
         ${img(nom, "ecran-clair")}
         ${ECRANS.includes(sombre) ? img(sombre, "ecran-sombre") : ""}
       </figure>`;
}

function mobile(ECRANS, nom, alt) {
  if (!ECRANS.includes(nom)) return "";
  const sombre = nom.replace(".png", "-sombre.png");
  const img = (f, classe) => `<img class="${classe}" src="assets/ecrans/${esc(f)}" alt="${esc(alt)}"
         loading="lazy" decoding="async" width="390" height="844">`;
  return `<figure class="mobile" style="margin:0">
         ${img(nom, "ecran-clair")}
         ${ECRANS.includes(sombre) ? img(sombre, "ecran-sombre") : ""}
       </figure>`;
}

function vitrine(ECRANS, { image, alt, titre, texte, lien, libelle }) {
  return `<article class="vitrine" data-paraitre>
  ${portable(ECRANS, image, alt)}
  <div class="vitrine-texte">
    <h2>${titre}</h2>
    <p>${texte}</p>
    <a class="lien-fleche" href="${esc(lien)}">${esc(libelle)} ${fleche}</a>
  </div>
</article>`;
}

function questionsSimulateur(declencheurs) {
  return declencheurs.map((q) => `<label class="case">
  <input type="checkbox" data-domaines="${esc(q.domaines.join(" "))}">
  <span><span class="intitule">${esc(q.q)}</span><span class="aide">${esc(q.d)}</span></span>
</label>`).join("\n");
}

/* Les douze secteurs montrés sur l'accueil : ceux qu'un cabinet d'Istres
   rencontre le plus. L'index des 88 est dans l'application. */
const VITRINE_SECTEURS = ["43", "41", "10", "56", "47", "49", "52", "20", "25", "81", "86", "85"];

function pageAccueil(V, D, METIERS, ECRANS) {
  const nbDomaines = Object.keys(V.domaines).length;
  const defaut = "43";                      // Travaux de construction spécialisés
  const divDefaut = V.divisions.filter((d) => d.c === defaut)[0] || V.divisions[0];
  const vuDefaut = perimetre(V, divDefaut.c);

  const parSection = V.sections.map((s) => ({
    s, divisions: V.divisions.filter((d) => d.s === s.c)
  })).filter((g) => g.divisions.length);

  const corps = `
<section class="heros">
  <div class="enveloppe">
    <div class="heros-texte">
      <h1>La veille réglementaire de votre métier, tenue et prouvable</h1>
    </div>
    <p class="heros-sous">
      Les textes qui vous concernent — et seulement ceux-là — relevés et analysés
      chaque semaine. Un plan de veille écrit, un relevé daté, un registre de preuves
      prêt pour l'audit.
    </p>
    <p class="rangee rangee-centre">
      <a class="bouton bouton-accent" href="#installer">Installer l'application</a>
      <a class="bouton bouton-sobre" href="abonnement.html">Démarrer un abonnement</a>
    </p>
    <p class="gage">
      ${sigle}
      <span>${V.divisions.length} divisions d'activité couvertes</span>
      <span class="doux">— aucun compte à créer pour regarder</span>
    </p>

    <div class="heros-visuel">
      ${portable(ECRANS, "bord.png", "Le tableau de bord de l'application : revues en retard, textes à analyser, actions ouvertes.")}
      ${mobile(ECRANS, "releve-tel.png", "Le relevé des textes sur téléphone.")}
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
        <p class="legende">domaines de veille, chacun avec ses obligations, ses textes et ses sources</p>
      </div>
      <div class="rail-item" data-paraitre data-compte="${V.declencheurs.length}">
        <span class="chiffre">${V.declencheurs.length}</span>
        <p class="legende">questions de contexte qui ajoutent ou retirent un domaine du périmètre</p>
      </div>
      <div class="rail-item" data-paraitre>
        <span class="chiffre">ISO</span>
        <p class="legende">les référentiels où la veille est exigée : ISO 14001, ISO 45001, MASE, Qualiopi</p>
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
        <div><h3>Un périmètre écrit, pas une intuition</h3>
        <p>Votre plan dit quels domaines s'appliquent, à quel rythme les revoir et qui
        en répond. C'est un document, pas une conversation.</p></div>
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
        <p>Seuls les textes qui touchent votre périmètre arrivent, chacun avec ce qu'il
        change pour vous. Les textes écartés sont tracés, avec leur motif.</p></div>
      </li>
      <li class="trait">
        <svg class="icone" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 12l2 2 4-5"/><rect x="4" y="3" width="16" height="18" rx="2"/></svg>
        <div><h3>Le registre que l'auditeur demande</h3>
        <p>Chaque revue, chaque décision, chaque action est datée et conservée.
        Une ligne ne se réécrit pas : une correction s'ajoute. Il s'imprime tel quel.</p></div>
      </li>
      <li class="trait">
        <svg class="icone" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1M7.7 16.3l-2.1 2.1"/></svg>
        <div><h3>Le contexte change le périmètre</h3>
        <p>${V.declencheurs.length} questions — installation classée, amiante, appareils de levage,
        transport de marchandises — ajoutent les domaines qui vont avec.</p></div>
      </li>
      <li class="trait">
        <svg class="icone" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 3 7v5c0 5 3.8 8.3 9 9 5.2-.7 9-4 9-9V7Z"/></svg>
        <div><h3>Les sources sont citées</h3>
        <p>Chaque domaine porte ses textes de référence et les sources officielles
        où les vérifier. Rien ne vous est demandé sur parole.</p></div>
      </li>
    </ul>
  </div>
</section>

<section class="section">
  <div class="enveloppe">
    <h2 class="titre-section">Les écrans, avant de vous engager</h2>
    <p class="intro titre-section">De vraies captures de l'application, prises automatiquement à
    chaque publication. Le plan de veille et les fiches de secteur s'ouvrent depuis la
    démonstration.</p>

    ${vitrine(ECRANS, {
      image: "releve.png",
      alt: "Le relevé des textes : chaque texte daté, rattaché à un domaine, avec l'état de la décision.",
      titre: "Ce qui vous concerne, et rien d'autre",
      texte: `Le reproche fait à toutes les plateformes de veille est le même : elles remontent
        tout, donc on ne lit plus rien, et le texte qui comptait se perd. Ici le tri est fait en
        amont, sur votre périmètre, et chaque texte arrive avec ce qu'il change pour vous.`,
      lien: "connexion.html", libelle: "Voir le relevé"
    })}

    ${vitrine(ECRANS, {
      image: "registre.png",
      alt: "Le registre de preuves : revues, décisions et actions, chronologiques et datées.",
      titre: "Ce qu'un auditeur demande vraiment",
      texte: `L'écart le plus souvent relevé en audit n'est pas l'absence de veille : c'est la
        veille faite et jamais tracée. Le registre enregistre chaque revue, chaque décision,
        chaque action, avec sa date. Il s'imprime tel quel.`,
      lien: "connexion.html", libelle: "Voir le registre"
    })}
  </div>
</section>

<section class="section section-tein" id="simulateur">
  <div class="enveloppe">
    <h2 class="titre-section">Le plan de veille de votre métier</h2>
    <p class="intro titre-section">Choisissez votre activité, cochez ce qui est vrai chez vous :
    le périmètre se recalcule. C'est le même calcul que dans l'application.</p>

    <div class="simulateur">
      <div class="reglages">
        <div class="reglage">
          <label class="etiq" for="choix-division">Votre activité</label>
          <select id="choix-division">
            ${parSection.map((g) => `<optgroup label="${esc(g.s.c)} — ${esc(g.s.l)}">
              ${g.divisions.map((d) => `<option value="${esc(d.c)}"${d.c === divDefaut.c ? " selected" : ""}>${esc(d.c)} — ${esc(d.l)}</option>`).join("")}
            </optgroup>`).join("")}
          </select>
        </div>
        <div class="reglage">
          <span class="etiq">Votre contexte</span>
          <div class="cases" id="sim-questions">
            ${questionsSimulateur(vuDefaut.declencheurs)}
          </div>
        </div>
      </div>

      <div class="resultat">
        <h3 id="sim-titre">${esc(divDefaut.l)}</h3>
        <p>Valeur de votre périmètre, comparée au référentiel complet.</p>
        <hr class="filet">

        <ul class="coup-d-oeil">
          <li>
            <span class="pastille"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v16l-7-3-7 3Z"/></svg></span>
            <span><span class="etiq">Domaines retenus</span><span class="valeur" id="sim-total">${vuDefaut.base.length}</span></span>
          </li>
          <li>
            <span class="pastille ambre"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></span>
            <span><span class="etiq">Rythme le plus serré</span><span class="valeur" id="sim-rythme">${esc(vuDefaut.groupes.length ? vuDefaut.groupes[0].f.l : "—")}</span></span>
          </li>
          <li>
            <span class="pastille verte"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></span>
            <span><span class="etiq">Ajoutés par le contexte</span><span class="valeur" id="sim-contexte">0</span></span>
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
          Pour <strong>${esc(divDefaut.l)}</strong> (NAF ${esc(divDefaut.c)}), le plan retient
          <strong>${vuDefaut.base.length} domaines sur ${nbDomaines}</strong>. Le rythme le plus
          serré est <strong>${esc(vuDefaut.groupes.length ? vuDefaut.groupes[0].f.l.toLowerCase() : "—")}</strong>.
        </p>
        <p class="note-source">
          Le périmètre affiché est un cadre de départ, pas un avis juridique sur votre situation.
          Source : le référentiel de ce site, construit à partir de Légifrance et des portails
          publics cités sur chaque domaine.
        </p>
        <p style="margin-top:var(--t4)">
          <a class="lien-fleche" id="sim-lien" href="app/secteur/${esc(divDefaut.c)}-${slug(divDefaut.l)}.html">Ouvrir la fiche complète ${fleche}</a>
        </p>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="enveloppe">
    <h2 class="titre-section">Votre métier y est</h2>
    <p class="intro titre-section">Les ${V.divisions.length} divisions de la nomenclature d'activités
    française ont chacune leur fiche. En voici quelques-unes ; l'index complet est dans
    l'application.</p>
    <div class="panneau-puces">
      <ul class="puces">
        ${VITRINE_SECTEURS.map((c) => {
          const d = V.divisions.filter((x) => x.c === c)[0];
          if (!d) throw new Error(`Vitrine de secteurs : division ${c} inconnue.`);
          return `<li><a href="app/secteur/${esc(d.c)}-${slug(d.l)}.html" title="${esc(d.l)}">
          <span class="code">${esc(d.c)}</span><span class="nom">${esc(d.l)}</span></a></li>`;
        }).join("\n")}
      </ul>
    </div>
    <p class="rangee rangee-centre" style="margin-top:var(--t5)">
      <a class="bouton bouton-accent" href="app/secteurs.html">Voir les ${V.divisions.length} secteurs</a>
      <a class="bouton bouton-sobre" href="connexion.html">Ouvrir la démonstration</a>
    </p>
  </div>
</section>

<section class="section section-tein">
  <div class="enveloppe">
    <h2 class="titre-section">Trois raisons de travailler avec nous</h2>
    <ul class="raisons">
      <li class="raison" data-paraitre>
        <span class="numero" aria-hidden="true">1</span>
        <h3>Le tri avant la masse</h3>
        <p>Une veille qui remonte tout ne se lit plus. Le périmètre est écrit d'abord,
        et seul ce qui le touche vous arrive — avec, pour chaque texte, ce qu'il change
        concrètement chez vous.</p>
      </li>
      <li class="raison" data-paraitre>
        <span class="numero" aria-hidden="true">2</span>
        <h3>La preuve autant que la veille</h3>
        <p>Faire la veille ne suffit pas : il faut pouvoir la montrer. Le registre garde
        les revues, les décisions et les actions avec leurs dates, et s'imprime pour
        l'audit sans retraitement.</p>
      </li>
      <li class="raison" data-paraitre>
        <span class="numero" aria-hidden="true">3</span>
        <h3>Quelqu'un en face</h3>
        <p>Pierrel &amp; Co est un cabinet de conseil à ${esc(SITE.ville)}, pas un abonnement
        anonyme. Un interlocuteur unique, qui connaît le site et qui vient dessus.</p>
      </li>
    </ul>
  </div>
</section>

<section class="section">
  <div class="enveloppe">
    <h2 class="titre-section">D'où viennent les textes</h2>
    <p class="intro titre-section">Les sources suivies sont publiques et citées. Vous pouvez
    vérifier chaque ligne à sa source.</p>
    <ul class="sources-bande">
      ${V.sourcesGenerales.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.nom)} ${sortant}</a></li>`).join("\n")}
    </ul>
    <div class="deux-colonnes" style="margin-top:var(--t6)">
      <p class="reserve">
        <strong>Ce que le service ne fait pas.</strong>
        Il fournit un cadre méthodologique, pas un conseil juridique, et ne garantit pas
        l'exhaustivité des textes applicables à une entreprise donnée. Chaque texte doit être
        vérifié sur <a href="https://www.legifrance.gouv.fr" target="_blank" rel="noopener">Légifrance</a>
        et l'analyse d'applicabilité validée par une personne compétente.
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

<section class="bande-finale">
  <div class="enveloppe">
    <span class="marque">${sigle}<span>Pierrel <span class="co">&amp; Co</span></span></span>
    <h2>Conseil en organisation et conformité, à ${esc(SITE.ville)}</h2>
    <p class="mentions">
      Clément Pierrel accompagne les entreprises de ${esc(SITE.zone)} sur leur organisation et
      leur conformité réglementaire : cadrage du périmètre, veille tenue, registre de preuves,
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

    <div class="formules">
      <article class="formule" data-paraitre>
        <span class="etiq">01 — Cadrage</span>
        <p class="prix"><span class="grand">890 €</span> <span class="etiq">une fois</span></p>
        <p>Une demi-journée sur site, puis votre plan de veille écrit : les domaines qui
        s'appliquent, le rythme de revue de chacun, les sources à suivre, le responsable
        désigné. Vous repartez avec le document, que vous preniez la suite ou non.</p>
        <a class="bouton bouton-sobre" href="mailto:${esc(SITE.courriel)}?subject=Cadrage">Demander un cadrage</a>
      </article>
      <article class="formule" data-paraitre>
        <span class="etiq">02 — Veille tenue</span>
        <p class="prix"><span class="grand">180 €</span> <span class="etiq">par mois</span></p>
        <p>Le cadrage, puis le relevé : les textes qui touchent votre périmètre, analysés et
        datés, avec ce que chacun change pour vous. Accès à l'application et aux fiches de
        secteur. Un établissement, un interlocuteur.</p>
        <a class="bouton bouton-sobre" href="mailto:${esc(SITE.courriel)}?subject=Démarrer un abonnement — Veille tenue">Démarrer un abonnement</a>
      </article>
      <article class="formule mise-en-avant" data-paraitre>
        <span class="etiq">03 — Veille et preuves</span>
        <p class="prix"><span class="grand">290 €</span> <span class="etiq">par mois</span></p>
        <p>La veille tenue, plus le registre de preuves alimenté à chaque revue et une revue
        annuelle de conformité sur site. C'est la formule pour qui passe un audit — ISO 14001,
        ISO 45001, MASE, Qualiopi.</p>
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
        établissements, groupes, secteurs très réglementés : sur devis, le périmètre
        change tout.</p>
      </li>
    </ul>
  </div>
</section>

<section class="bande-finale">
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
      : c.quoi === "nouveau" ? "Entre dans votre périmètre." : "Sort de votre périmètre.") +
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
  const habillage = ["site.css", "polices.css", "app.js", "theme.js",
                     "session.js", "entreprise.js", "avis.js"];
  const empreinte = createHash("sha256");
  for (const f of habillage) empreinte.update(await readFile(join(SORTIE, "assets", f)));
  empreinte.update(plan);
  const version = empreinte.digest("hex").slice(0, 12);
  const worker = (await readFile(resolve(RACINE, "sw.js"), "utf8")).replace("__EMPREINTE__", version);
  if (worker.includes("__EMPREINTE__")) throw new Error("sw.js : l'empreinte n'a pas été posée.");
  await writeFile(join(SORTIE, "sw.js"), worker);
  console.log(`  cache du worker     pco-${version}`);

  await writeFile(join(SORTIE, "index.html"), pageAccueil(V, D, METIERS, ECRANS));
  await writeFile(join(SORTIE, "abonnement.html"), pageAbonnement(V));
  await writeFile(join(SORTIE, "connexion.html"), pageConnexion());

  await writeFile(join(SORTIE, "app", "index.html"), appTableauBord(V, D, C, LIENS));
  await writeFile(join(SORTIE, "app", "plan.html"), appPlan(V, D, C, LIENS));
  await writeFile(join(SORTIE, "app", "releve.html"), appReleve(V, D, JO, C, LIENS));
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
  console.log(`  public              3 pages (accueil, abonnement, connexion)`);
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
    " (" + JO.rapport.filter((r) => r.retenus).length + " sources sur " + JO.rapport.length + ")"
    : "AUCUNE — lancer outils/veille.mjs (tourne toutes les heures dans .github/workflows/releve.yml)"}`);
  console.log(`\n_site/ prêt — ${(total / 1024).toFixed(1)} Ko, ` +
    `${V.divisions.length + Object.keys(parTexte).length + (C ? C.morceaux.length : 0) + 10} pages, ` +
    `${Object.keys(V.domaines).length} domaines, ${Object.keys(PIEGES).length} secteurs avec pièges.`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
