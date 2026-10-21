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
const dateFr = (iso) => new Date(iso + "T12:00:00Z").toLocaleDateString("fr-FR", JOUR);

/* --- Le sigle : trois feuillets décalés ------------------------------------ */
const sigle = `<svg class="sigle" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
  <rect x="2" y="4" width="14" height="3.1" rx="1.55"/>
  <rect x="5" y="10.45" width="14" height="3.1" rx="1.55" opacity=".7"/>
  <rect x="8" y="16.9" width="14" height="3.1" rx="1.55" opacity=".42"/>
</svg>`;

const fleche = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"
  stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h13m-5-6 6 6-6 6"/></svg>`;

const sortant = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"
  stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 16 16 8m0 0H9m7 0v7"/></svg>`;

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

/* --- Gabarit commun ----------------------------------------------------------- */
function page({ titre, description, racine = "", zone = "public", actif = "", corps,
                attrsBody = "", verrou = false, donneesPlan = false }) {
  const a = (f) => racine + f;
  const lien = (href, libelle, cle) =>
    `<a href="${a(href)}"${actif === cle ? ' aria-current="page"' : ""}>${libelle}</a>`;

  const menuPublic = `
      ${lien("index.html", "Le produit", "produit")}
      ${lien("tarifs.html", "Tarifs", "tarifs")}
      ${selecteurTheme}
      <a class="bouton" href="${a("connexion.html")}">Ouvrir l'application</a>`;

  const menuApp = `
      ${lien("app/index.html", "Tableau de bord", "bord")}
      ${lien("app/plan.html", "Mon plan", "plan")}
      ${lien("app/releve.html", "Relevé", "releve")}
      ${lien("app/registre.html", "Registre", "registre")}
      ${lien("app/secteurs.html", "Secteurs", "secteurs")}
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
<body class="zone-${zone}"${attrsBody}>

<a class="evitement" href="#contenu">Aller au contenu</a>

<header class="bandeau">
  <div class="enveloppe bandeau-interieur">
    <a class="marque" href="${a(zone === "app" ? "app/index.html" : "index.html")}">
      ${sigle}<span>Pierrel <span class="co">&amp; Co</span></span>
    </a>
    <button type="button" class="menu-bascule" aria-expanded="false" aria-controls="menu-principal">
      <span class="cache-visuellement">Ouvrir le menu</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
        <path d="M4 7h16M4 12h16M4 17h16"/></svg>
    </button>
    <nav class="menu" id="menu-principal" aria-label="Navigation principale">${zone === "app" ? menuApp : menuPublic}</nav>
  </div>
</header>

${zone === "app" ? `<p class="bandeau-demo">
  <strong>Démonstration.</strong> Les données ci-dessous sont un jeu d'essai
  (entreprise et textes fictifs). La connexion ne protège rien : elle pose un
  jeton dans votre navigateur, et le contenu de ces pages reste lisible dans la
  source. Un vrai compte suppose un service d'authentification, qui n'est pas
  encore en place. <a href="${a("index.html")}">Revenir au site</a>
</p>` : ""}

<main id="contenu">
${verrou ? `<section class="verrou" id="verrou">
  <div class="enveloppe">
    <p class="etiq">Accès réservé</p>
    <h1>Votre veille est derrière la connexion</h1>
    <p class="chapeau">
      Le plan de veille, le relevé des textes et le registre de preuves sont réservés
      aux abonnés. Vous pouvez ouvrir la démonstration pour voir exactement ce que
      contient l'application.
    </p>
    <p class="rangee rangee-centre" style="margin-top:var(--t5)">
      <a class="bouton bouton-accent" href="${a("connexion.html")}">Ouvrir la démonstration</a>
      <a class="bouton bouton-sobre" href="${a("tarifs.html")}">Voir les tarifs</a>
    </p>
  </div>
</section>` : ""}
${corps}
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
          <li><a href="${a("tarifs.html")}">Tarifs</a></li>
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
        <a href="${a("tarifs.html")}">Tarifs</a>
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
${zone === "app" || verrou || actif === "connexion" ? `<script src="${a("assets/session.js")}"></script>` : ""}
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

function blocDomaine(id, d, origine) {
  return `<article class="bloc-domaine" data-domaine="${esc(id)}" data-origine="${origine}"${origine === "declencheur" ? " hidden" : ""}>
  <div class="bloc-domaine-tete">
    <h3>${esc(d.nom)}</h3>
    ${origine === "declencheur" ? '<span class="marque-ajout">ajouté par votre contexte</span>' : ""}
  </div>
  <p class="bloc-domaine-resume">${esc(d.resume)}</p>
  <div class="bloc-domaine-corps">
    <div>
      <span class="etiq">Ce qu'il faut tenir</span>
      <ul>${d.obligations.map((o) => `<li>${esc(o)}</li>`).join("")}</ul>
    </div>
    <div>
      <span class="etiq">Textes de référence</span>
      <ul>${d.textes.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
      <span class="etiq" style="margin-top:var(--t4)">Sources officielles</span>
      <ul>${d.sources.map((s) =>
        `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.nom)}</a></li>`).join("")}</ul>
    </div>
  </div>
</article>`;
}

/* Une rubrique de l'application : un titre à gauche, le contenu dessous. */
function rubrique({ etiq, contenu, aplat = false, id = "" }) {
  return `<section class="rubrique${aplat ? " section-tein" : ""}"${id ? ` id="${id}"` : ""}>
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

function enTeteApp(D, titre, chapeau) {
  return `<section class="tete-app">
  <div class="enveloppe">
    <ul class="jalons">
      <li><span class="fort">${esc(D.entreprise.nom)}</span></li>
      <li><span>NAF ${esc(D.entreprise.nafComplet)}</span></li>
      <li><span>${esc(D.entreprise.ville)}</span></li>
      <li><span>${esc(D.entreprise.effectif)} salariés</span></li>
      <li><span>Suivi depuis ${esc(D.entreprise.depuis)}</span></li>
    </ul>
    <h1>${esc(titre)}</h1>
    ${chapeau ? `<p class="chapeau">${chapeau}</p>` : ""}
  </div>
</section>`;
}

/* --- Tableau de bord ------------------------------------------------------- */
function appTableauBord(V, D) {
  const aAnalyser = D.releve.filter((t) => t.statut === "a-analyser");
  const ouvertes = D.registre.filter((r) => r.echeance && !r.clos);
  const enRetard = D.echeances.filter((e) => e.retard);

  const corps = enTeteApp(D, "Tableau de bord",
    "Ce qui attend une décision, ce qui arrive, et ce qui est en retard.") + `

${rubrique({ etiq: "À traiter", contenu: `
  <dl class="compteurs">
    <div${enRetard.length ? ' class="alerte"' : ""}>
      <dt class="etiq">Revues en retard</dt>
      <dd><span class="grand">${enRetard.length}</span>
      ${enRetard.length ? `<span class="precision">${esc(enRetard.map((e) => e.frequence).join(", "))}</span>` : ""}</dd>
    </div>
    <div><dt class="etiq">Textes à analyser</dt><dd><span class="grand">${aAnalyser.length}</span></dd></div>
    <div><dt class="etiq">Actions ouvertes</dt><dd><span class="grand">${ouvertes.length}</span></dd></div>
    <div><dt class="etiq">Textes relevés, 90 jours</dt><dd><span class="grand">${D.releve.length}</span></dd></div>
  </dl>` })}

${rubrique({ etiq: "Prochaines revues", aplat: true, contenu: `
  <ul class="liste-echeances">
    ${D.echeances.map((e) => `<li${e.retard ? ' class="retard"' : ""}>
      <span class="etiq">${esc(V.frequences[e.frequence] ? V.frequences[e.frequence].l : e.frequence)}</span>
      <span class="mono">${esc(dateFr(e.prochaine))}</span>
      ${e.retard ? '<span class="marque-ajout">en retard</span>' : ""}
    </li>`).join("")}
  </ul>` })}

${rubrique({ etiq: "En attente de vous", contenu: `
  <p class="lecture">Les textes relevés qui n'ont pas encore été tranchés.</p>
  <ul class="liste-releve" style="margin-top:var(--t4)">
    ${aAnalyser.map((t) => ligneReleve(V, t)).join("")}
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
    racine: "../", zone: "app", actif: "bord", corps, verrou: true
  });
}

function ligneReleve(V, t) {
  const s = STATUTS[t.statut] || STATUTS.analyse;
  const d = V.domaines[t.domaine];
  return `<li class="ligne-releve statut-${s.c}">
  <span class="mono date">${esc(dateFr(t.date))}</span>
  <span class="corps">
    <span class="titre">${esc(t.titre)}</span>
    <span class="quoi">${esc(t.quoi)}</span>
    <span class="meta etiq">${esc(t.nature)} · ${esc(d ? d.nom : t.domaine)}${t.priorite === "haute" ? " · prioritaire" : ""}</span>
  </span>
  <span class="statut etiq">${esc(s.l)}</span>
</li>`;
}

function ligneRegistre(r) {
  const types = { revue: "Revue", action: "Action", decision: "Décision" };
  return `<li class="ligne-registre${r.clos ? " clos" : ""}">
  <span class="mono date">${esc(dateFr(r.date))}</span>
  <span class="corps">
    <span class="titre">${esc(r.objet)}</span>
    <span class="quoi">${esc(r.detail)}</span>
    <span class="meta etiq">${esc(types[r.type] || r.type)} · ${esc(r.par)}${r.echeance && !r.clos ? " · échéance " + esc(dateFr(r.echeance)) : ""}</span>
  </span>
</li>`;
}

/* --- Mon plan --------------------------------------------------------------- */
function appPlan(V, D) {
  const { base, groupes } = perimetre(V, D.entreprise.naf);
  const ajoutes = new Set();
  D.entreprise.contexte.forEach((qid) => {
    const q = V.declencheurs.filter((x) => x.id === qid)[0];
    if (q) q.domaines.forEach((id) => { if (V.domaines[id] && !base.includes(id)) ajoutes.add(id); });
  });

  const total = base.length + ajoutes.size;
  const contexteNoms = D.entreprise.contexte
    .map((qid) => (V.declencheurs.filter((x) => x.id === qid)[0] || {}).q).filter(Boolean);

  const corps = enTeteApp(D, "Mon plan de veille",
    `Le périmètre retenu pour ${esc(D.entreprise.nom)} : ${total} domaines, groupés par rythme de revue.`) + `

${rubrique({ etiq: "Le périmètre", contenu: `
  <dl class="faits">
    <div><dt class="etiq">Domaines suivis</dt><dd><span class="grand">${total}</span></dd></div>
    <div><dt class="etiq">Division NAF</dt><dd><span class="grand">${esc(D.entreprise.naf)}</span></dd></div>
    <div><dt class="etiq">Responsable</dt><dd>${esc(D.entreprise.responsable)}</dd></div>
  </dl>
  <p style="margin-top:var(--t4)">
    <span class="etiq">Contexte retenu</span>${esc(contexteNoms.join(" · "))}
  </p>` })}

${groupes.map((g) => {
    const dansGroupe = [...g.base, ...g.ajout.filter((id) => ajoutes.has(id))];
    if (!dansGroupe.length) return "";
    const ech = D.echeances.filter((e) => e.frequence === g.id)[0];
    return rubrique({ etiq: g.f.l, contenu: `
      <p class="lecture">${esc(g.f.d)}${ech ? ` Prochaine revue : <strong>${esc(dateFr(ech.prochaine))}</strong>${ech.retard ? " — en retard." : "."}` : ""}</p>
      ${dansGroupe.map((id) => blocDomaine(id, V.domaines[id], ajoutes.has(id) ? "declencheur-retenu" : "base")).join("\n")}` });
  }).join("\n")}`;

  return page({
    titre: `Mon plan de veille | ${SITE.nom}`,
    description: "Le périmètre de veille retenu.",
    racine: "../", zone: "app", actif: "plan", corps, verrou: true
  });
}

/* --- Relevé ------------------------------------------------------------------ */
function appReleve(V, D) {
  const parStatut = Object.keys(STATUTS).map((s) => ({
    s, l: STATUTS[s].l, n: D.releve.filter((t) => t.statut === s).length
  }));

  const corps = enTeteApp(D, "Relevé des textes",
    "Les textes parus qui touchent votre périmètre, et seulement ceux-là. Ce que chacun change, et où en est la décision.") + `

${rubrique({ etiq: "Où ça en est", contenu: `
  <dl class="compteurs">
    ${parStatut.map((x) => `<div><dt class="etiq">${esc(x.l)}</dt><dd><span class="grand">${x.n}</span></dd></div>`).join("")}
  </dl>` })}

${rubrique({ etiq: "Le relevé", aplat: true, contenu: `
  <p class="lecture">Du plus récent au plus ancien. Les textes écartés ne figurent pas ici :
  ils sont tracés dans le registre, avec le motif de leur mise à l'écart.</p>
  <ul class="liste-releve" style="margin-top:var(--t4)">
    ${D.releve.map((t) => ligneReleve(V, t)).join("")}
  </ul>` })}`;

  return page({
    titre: `Relevé des textes | ${SITE.nom}`,
    description: "Les textes parus qui touchent le périmètre.",
    racine: "../", zone: "app", actif: "releve", corps, verrou: true
  });
}

/* --- Registre ------------------------------------------------------------------ */
function appRegistre(V, D) {
  const ouvertes = D.registre.filter((r) => r.echeance && !r.clos);
  const corps = enTeteApp(D, "Registre de preuves",
    "Les revues faites, les décisions prises, les actions menées — avec leurs dates. C'est ce qu'un auditeur demande, et ce qui manque le plus souvent.") + `

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
    racine: "../", zone: "app", actif: "registre", corps, verrou: true
  });
}

/* --- Les 88 fiches ---------------------------------------------------------- */
function appSecteurs(V, METIERS) {
  const parSection = V.sections.map((s) => ({
    s, divisions: V.divisions.filter((d) => d.s === s.c)
  })).filter((g) => g.divisions.length);

  const corps = `<section class="tete-app">
  <div class="enveloppe">
    <ul class="jalons">
      <li><span class="fort">Référentiel</span></li>
      <li><span>${V.divisions.length} divisions · ${V.sections.length} sections</span></li>
      <li><span>${Object.keys(V.domaines).length} domaines</span></li>
    </ul>
    <h1>Fiches par secteur</h1>
    <p class="chapeau">
      La nomenclature d'activités française, division par division. Utile pour situer
      un client, un sous-traitant ou un donneur d'ordre. Cherchez par code, par libellé
      ou par le nom du métier.
    </p>
    <div class="recherche" style="margin-top:var(--t5)">
      <label class="etiq" for="recherche-secteur">Chercher</label>
      <input type="search" id="recherche-secteur" placeholder="boulangerie, 43, transport…"
             autocomplete="off" spellcheck="false">
      <p class="recherche-compte etiq"><span id="compte-secteurs">${V.divisions.length} secteurs</span></p>
    </div>
  </div>
</section>

<section class="rubrique">
<div class="enveloppe">
  <p id="aucun-secteur" class="etat-vide" hidden>
    Aucun secteur ne correspond. Essayez un code à deux chiffres, ou un mot du libellé.
  </p>
  <div id="liste-secteurs">
    ${parSection.map((g) => `
    <section class="groupe-section" data-groupe>
      <span class="etiq">${esc(g.s.c)} — ${esc(g.s.l)}</span>
      <ul class="liste-divisions">
        ${g.divisions.map((d) => {
          const mots = METIERS[d.c] || [];
          return `<li class="ligne-division" data-recherche="${esc([d.c, d.l, g.s.l, ...mots].join(" "))}">
          <a href="secteur/${esc(d.c)}-${slug(d.l)}.html">
            <span class="code">${esc(d.c)}</span>
            <span class="nom">${esc(d.l)}</span>
            <span class="mots">${esc(mots.slice(0, 5).join(" · "))}</span>
          </a></li>`; }).join("\n")}
      </ul>
    </section>`).join("\n")}
  </div>
</div>
</section>`;

  return page({
    titre: `Fiches par secteur | ${SITE.nom}`,
    description: "Les 88 divisions de la nomenclature NAF et leurs obligations.",
    racine: "../", zone: "app", actif: "secteurs", corps, verrou: true
  });
}

function appSecteur(V, PIEGES, METIERS, d) {
  const section = V.sections.filter((s) => s.c === d.s)[0];
  const mots = METIERS[d.c] || [];
  const { base, declencheurs, groupes } = perimetre(V, d.c);
  const p = PIEGES[d.c];
  const rythme = groupes.length ? groupes[0].f.l : "—";

  const corps = `<section class="tete-app">
  <div class="enveloppe">
    <ul class="jalons">
      <li><a href="../secteurs.html">Fiches par secteur</a></li>
      <li><span class="fort">Fiche ${esc(d.c)}</span></li>
      <li><span>Section ${esc(d.s)} — ${esc(section ? section.l : "")}</span></li>
    </ul>
    <h1>${esc(d.l)}</h1>
    ${mots.length ? `<p class="chapeau"><span class="etiq">On dit aussi</span>${esc(mots.join(" · "))}</p>` : ""}
    <dl class="faits" style="margin-top:var(--t5)">
      <div><dt class="etiq">Code NAF</dt><dd><span class="grand">${esc(d.c)}</span></dd></div>
      <div><dt class="etiq">Domaines de base</dt><dd><span class="grand" id="compte-domaines">${base.length}</span></dd></div>
      <div><dt class="etiq">Rythme le plus serré</dt><dd>${esc(rythme)}</dd></div>
      <div><dt class="etiq">Questions de contexte</dt><dd><span class="grand">${declencheurs.length}</span></dd></div>
    </dl>
  </div>
</section>

${rubrique({ etiq: "Périmètre", contenu: `
  <p class="lecture">Le socle commun à toute entreprise, plus ce qui tient à ce métier.
  Groupé par rythme de revue.</p>
  ${groupes.map((g) => `
  <div class="groupe-frequence" data-groupe-frequence="${esc(g.id)}">
    <div class="tete"><h3>${esc(g.f.l)}</h3><span class="etiq">${esc(g.f.d)}</span></div>
    ${g.base.map((id) => blocDomaine(id, V.domaines[id], "base")).join("\n")}
    ${g.ajout.map((id) => blocDomaine(id, V.domaines[id], "declencheur")).join("\n")}
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
    racine: "../../", zone: "app", actif: "secteurs", corps, verrou: true,
    attrsBody: ` data-domaines-base="${base.length}"`
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

function pageAccueil(V, D, METIERS, ECRANS) {
  const nbDomaines = Object.keys(V.domaines).length;
  const defaut = "43";                      // Travaux de construction spécialisés
  const divDefaut = V.divisions.filter((d) => d.c === defaut)[0] || V.divisions[0];
  const vuDefaut = perimetre(V, divDefaut.c);
  const echeanceRetard = D.echeances.filter((e) => e.retard)[0];

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
      <a class="bouton bouton-accent" href="connexion.html">Ouvrir l'application</a>
      <a class="bouton bouton-sobre" href="tarifs.html">Voir les tarifs</a>
    </p>
    <p class="gage">
      ${sigle}
      <span>${V.divisions.length} divisions d'activité couvertes</span>
      <span class="doux">— aucun compte à créer pour regarder</span>
    </p>

    <div class="heros-visuel">
      ${portable(ECRANS, "bord.png", "Le tableau de bord de l'application : revues en retard, textes à analyser, actions ouvertes.")}
      <aside class="carte-flottante" aria-hidden="true">
        <span class="etiq">Prochaine revue</span>
        <p class="grand">${esc(echeanceRetard ? V.frequences[echeanceRetard.frequence].l : "Hebdomadaire")}</p>
        <p class="doux">${esc(echeanceRetard ? dateFr(echeanceRetard.prochaine) : "")}</p>
        <p><span class="marque-ajout">en retard</span></p>
      </aside>
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
    <p class="intro titre-section">Ce sont de vraies captures de l'application, prises automatiquement
    à chaque publication. Pas une maquette.</p>

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
      image: "plan.png",
      alt: "Le plan de veille : les domaines retenus, groupés par rythme de revue.",
      titre: "Un plan de veille écrit, domaine par domaine",
      texte: `${nbDomaines} domaines de veille, ${V.divisions.length} divisions d'activité,
        ${V.declencheurs.length} questions de contexte. Votre plan n'en retient que ce qui vous
        concerne, avec pour chacun un rythme de revue et un responsable désigné.`,
      lien: "connexion.html", libelle: "Voir le plan"
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

    ${vitrine(ECRANS, {
      image: "secteurs.png",
      alt: "Les fiches de secteur, cherchables par code, par libellé ou par métier.",
      titre: `${V.divisions.length} fiches de secteur`,
      texte: `Chaque division de la nomenclature NAF a sa fiche : les domaines qui s'y appliquent,
        les obligations derrière chacun, les sources officielles, et les pièges propres au métier.
        Cherchable par code, par libellé ou par le nom du métier.`,
      lien: "connexion.html", libelle: "Voir les fiches"
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
          ${vuDefaut.groupes.map((g) => `<li>
            <span class="nom">${esc(g.f.l)}</span>
            <span class="mots">${esc(g.base.map((id) => V.domaines[id].nom).join(" · "))}</span>
            <span class="compte">${g.base.length}</span>
          </li>`).join("")}
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
    <h2 class="titre-section">Tous les secteurs, pas une sélection</h2>
    <p class="intro titre-section">Les ${V.divisions.length} divisions de la nomenclature d'activités
    française. Chacune a sa fiche.</p>
    <div class="panneau-puces">
      <ul class="puces">
        ${V.divisions.map((d) => `<li><a href="app/secteur/${esc(d.c)}-${slug(d.l)}.html">
          <span class="code">${esc(d.c)}</span><span class="nom">${esc(d.l)}</span></a></li>`).join("\n")}
      </ul>
    </div>
    <p class="rangee rangee-centre" style="margin-top:var(--t5)">
      <a class="bouton bouton-accent" href="connexion.html">Ouvrir l'application</a>
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

function pageTarifs(V) {
  const corps = `
<section class="heros">
  <div class="enveloppe">
    <div class="heros-texte"><h1>Trois formules, prix affichés</h1></div>
    <p class="heros-sous">
      Affichés, parce que presque personne ne le fait dans ce métier : les offres
      comparables sont toutes « sur devis ». Montants hors taxes.
    </p>
  </div>
</section>

<section class="section">
  <div class="enveloppe">
    <p class="reserve">
      <strong>Proposition à valider.</strong> Ces montants sont une proposition construite
      à partir de la revue du marché, pas une grille arrêtée par Clément Pierrel.
      À confirmer avant toute mise en ligne publique.
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
        secteur. Un site, un responsable.</p>
        <a class="bouton bouton-sobre" href="mailto:${esc(SITE.courriel)}?subject=Veille tenue">En parler</a>
      </article>
      <article class="formule mise-en-avant" data-paraitre>
        <span class="etiq">03 — Veille et preuves</span>
        <p class="prix"><span class="grand">290 €</span> <span class="etiq">par mois</span></p>
        <p>La veille tenue, plus le registre de preuves alimenté à chaque revue et une revue
        annuelle de conformité sur site. C'est la formule pour qui passe un audit — ISO 14001,
        ISO 45001, MASE, Qualiopi.</p>
        <a class="bouton bouton-accent" href="mailto:${esc(SITE.courriel)}?subject=Veille et preuves">En parler</a>
      </article>
    </div>
  </div>
</section>

<section class="section section-tein">
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
        <p>Les déclarations auprès de l'administration restent les vôtres. Multi-sites,
        groupes, secteurs très réglementés : sur devis, le périmètre change tout.</p>
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
    titre: `Tarifs | ${SITE.nom}`,
    description: "Trois formules de veille réglementaire, avec leurs prix affichés.",
    zone: "public", actif: "tarifs", corps
  });
}

function pageConnexion() {
  const corps = `
<section class="heros">
  <div class="enveloppe">
    <div class="heros-texte"><h1>Ouvrir l'application</h1></div>
    <div class="connexion" style="margin-inline:auto">
      <p class="reserve">
        <strong>Il n'y a pas encore de comptes.</strong>
        L'authentification demande un service dédié, qui n'est pas en place : aucun identifiant
        ne serait vérifié, et aucun mot de passe ne doit être saisi ici. C'est pourquoi cet
        écran n'en demande pas. Le bouton ci-dessous ouvre l'application avec un jeu d'essai.
      </p>
      <p style="margin-top:var(--t4)">
        <button type="button" class="bouton bouton-accent bouton-large" id="entrer-demo">Ouvrir la démonstration</button>
      </p>
      <p class="etiq" style="margin-top:var(--t3)" id="etat-session"></p>
      <p class="rangee rangee-centre" style="margin-top:var(--t5)">
        <a href="tarifs.html">Voir les tarifs</a>
        <a href="mailto:${esc(SITE.courriel)}">Demander un accès</a>
      </p>
    </div>
  </div>
</section>

<section class="section">
  <div class="enveloppe">
    <h2 class="titre-section">Ce qu'il reste à brancher</h2>
    <ul class="raisons">
      <li class="raison" data-paraitre>
        <span class="numero" aria-hidden="true">1</span>
        <h3>L'authentification</h3>
        <p>Netlify Identity ou un équivalent, pour que les comptes existent et que les
        pages de l'application ne soient plus servies à tout le monde.</p>
      </li>
      <li class="raison" data-paraitre>
        <span class="numero" aria-hidden="true">2</span>
        <h3>Le paiement</h3>
        <p>Stripe ou un équivalent, pour l'abonnement mensuel, son renouvellement
        et sa résiliation.</p>
      </li>
      <li class="raison" data-paraitre>
        <span class="numero" aria-hidden="true">3</span>
        <h3>En attendant</h3>
        <p>La connexion de cette page ne protège rien : elle pose un jeton dans le
        navigateur, et le contenu des pages de l'application reste lisible par qui
        regarde la source.</p>
      </li>
    </ul>
  </div>
</section>`;

  return page({
    titre: `Connexion | ${SITE.nom}`,
    description: "Accès à l'application de veille réglementaire.",
    zone: "public", actif: "connexion", corps
  });
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
function verifie(V, PIEGES, METIERS, D) {
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
  verifie(V, PIEGES, METIERS, D);

  // Les écrans de l'accueil sont de vraies captures de l'application, prises
  // par outils/captures.mjs. Tant qu'elles n'existent pas, la page le dit au
  // lieu d'afficher une image cassée.
  const dossierEcrans = resolve(RACINE, "assets/ecrans");
  const ECRANS = existsSync(dossierEcrans) ? await readdir(dossierEcrans) : [];

  await rm(SORTIE, { recursive: true, force: true });
  await mkdir(join(SORTIE, "app", "secteur"), { recursive: true });
  await cp(resolve(RACINE, "assets"), join(SORTIE, "assets"), { recursive: true });

  const plan = donneesPlan(V, METIERS);
  await writeFile(join(SORTIE, "assets", "plan-data.js"), plan);

  await writeFile(join(SORTIE, "index.html"), pageAccueil(V, D, METIERS, ECRANS));
  await writeFile(join(SORTIE, "tarifs.html"), pageTarifs(V));
  await writeFile(join(SORTIE, "connexion.html"), pageConnexion());

  await writeFile(join(SORTIE, "app", "index.html"), appTableauBord(V, D));
  await writeFile(join(SORTIE, "app", "plan.html"), appPlan(V, D));
  await writeFile(join(SORTIE, "app", "releve.html"), appReleve(V, D));
  await writeFile(join(SORTIE, "app", "registre.html"), appRegistre(V, D));
  await writeFile(join(SORTIE, "app", "secteurs.html"), appSecteurs(V, METIERS));

  for (const d of V.divisions) {
    await writeFile(join(SORTIE, "app", "secteur", `${d.c}-${slug(d.l)}.html`),
      appSecteur(V, PIEGES, METIERS, d));
  }

  const total = await poids(SORTIE);
  console.log(`  public              3 pages (accueil, tarifs, connexion)`);
  console.log(`  app/                5 écrans + ${V.divisions.length} fiches de secteur`);
  console.log(`  assets/             ${((await poids(join(SORTIE, "assets"))) / 1024).toFixed(1)} Ko`);
  console.log(`  plan-data.js        ${(plan.length / 1024).toFixed(1)} Ko pour le simulateur`);
  console.log(`  écrans de l'accueil ${ECRANS.length ? ECRANS.length + " captures" : "AUCUNE — lancer outils/captures.mjs"}`);
  console.log(`\n_site/ prêt — ${(total / 1024).toFixed(1)} Ko, ${V.divisions.length + 8} pages, ` +
    `${Object.keys(V.domaines).length} domaines, ${Object.keys(PIEGES).length} secteurs avec pièges.`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
