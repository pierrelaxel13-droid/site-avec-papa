#!/usr/bin/env node
/* ==========================================================================
   Assemble le site publiable dans _site/
   --------------------------------------------------------------------------
   Le site est entièrement engendré depuis assets/referentiel.js : l'accueil,
   l'index des secteurs, et une page par division de la nomenclature NAF. Rien
   n'est écrit deux fois — un domaine corrigé dans le référentiel se propage
   partout à la construction suivante.

   La construction échoue si le référentiel est incohérent. C'est voulu : mieux
   vaut un déploiement refusé qu'un site de 88 pages dont la moitié ment.

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
  bareme: "Conseil en organisation et conformité",
  ville: "Istres (13800)",
  zone: "Istres et pourtour de l'étang de Berre",
  courriel: "contact@pierrel-co.fr",
  telephone: "04 00 00 00 00",
  telephoneLien: "+33400000000"
};

/* --- Chargement du contenu ------------------------------------------------- */
async function chargeFichier(chemin, cle) {
  const source = await readFile(resolve(RACINE, chemin), "utf8");
  const faux = {};
  new Function("window", source)(faux);
  return faux[cle];
}

/* --- Utilitaires ------------------------------------------------------------ */
const esc = (v) => String(v == null ? "" : v)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const sansAccent = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

const slug = (s) => sansAccent(s).toLowerCase()
  .replace(/['’]/g, " ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);

/* --- Gabarit commun ---------------------------------------------------------- */
function page({ titre, description, racine = "", page: nom, corps, classeBody = "", attrsBody = "" }) {
  const a = (f) => racine + f;
  const lien = (f, libelle, courant) =>
    `<a href="${a(f)}"${courant ? ' aria-current="page"' : ""}>${libelle}</a>`;

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titre)}</title>
<meta name="description" content="${esc(description)}">
<meta name="author" content="${esc(SITE.nom)}">
<meta property="og:title" content="${esc(titre)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<link rel="icon" href="${a("assets/favicon.svg")}" type="image/svg+xml">
<link rel="preload" href="${a("assets/polices/eb-garamond.woff2")}" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${a("assets/polices/lato-400.woff2")}" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${a("assets/polices.css")}">
<link rel="stylesheet" href="${a("assets/site.css")}">
<script src="${a("assets/theme.js")}"></script>
<script>/* Avant tout rendu, sinon la page clignote en clair. */window.PCO_THEME.appliquer();</script>
</head>
<body class="${classeBody}"${attrsBody}>

<a class="evitement" href="#contenu">Aller au contenu</a>

<header class="bandeau">
  <div class="bandeau-interieur">
    <a class="marque" href="${a("index.html")}">Pierrel <span>&amp; Co</span></a>
    <nav class="menu" aria-label="Navigation principale">
      ${lien("index.html", "Accueil", nom === "accueil")}
      ${lien("secteurs.html", "Les 88 secteurs", nom === "secteurs")}
      ${lien("index.html#methode", "Méthode", false)}
      ${lien("index.html#contact", "Contact", false)}
      <span class="theme" role="group" aria-label="Thème de la page">
        <button type="button" data-theme-choix="light" aria-pressed="false" title="Thème clair">
          <span class="cache-visuellement">Thème clair</span>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.2M12 19.2v2.2M4.2 12H2M22 12h-2.2M6.1 6.1 4.6 4.6M19.4 19.4l-1.5-1.5M17.9 6.1l1.5-1.5M4.6 19.4l1.5-1.5"/></svg>
        </button>
        <button type="button" data-theme-choix="auto" aria-pressed="false" title="Suivre le système">
          <span class="cache-visuellement">Suivre le réglage du système</span>
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.8" y="4.2" width="18.4" height="13" rx="2"/><path d="M8.5 20.5h7"/></svg>
        </button>
        <button type="button" data-theme-choix="dark" aria-pressed="false" title="Thème sombre">
          <span class="cache-visuellement">Thème sombre</span>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.4 8.4 0 1 0 10.2 10.2Z"/></svg>
        </button>
      </span>
    </nav>
  </div>
</header>

<main id="contenu">
${corps}
</main>

<footer class="pied">
  <div class="enveloppe">
    <div class="pied-grille">
      <div>
        <h4>${esc(SITE.nom)}</h4>
        <p>${esc(SITE.bareme)}.<br>Veille réglementaire, préparation aux contrôles et aux audits.<br>${esc(SITE.zone)}.</p>
      </div>
      <div>
        <h4>Le site</h4>
        <ul>
          <li><a href="${a("index.html")}">Accueil</a></li>
          <li><a href="${a("secteurs.html")}">Les 88 secteurs</a></li>
          <li><a href="${a("index.html#methode")}">Méthode</a></li>
          <li><a href="${a("index.html#contact")}">Contact</a></li>
        </ul>
      </div>
      <div>
        <h4>Sources officielles</h4>
        <ul>
          <li><a href="https://www.legifrance.gouv.fr" target="_blank" rel="noopener">Légifrance</a></li>
          <li><a href="https://entreprendre.service-public.fr" target="_blank" rel="noopener">Entreprendre</a></li>
          <li><a href="https://www.inrs.fr" target="_blank" rel="noopener">INRS</a></li>
          <li><a href="https://www.cnil.fr" target="_blank" rel="noopener">CNIL</a></li>
        </ul>
      </div>
    </div>
    <p class="pied-bas">
      Éditeur : ${esc(SITE.nom)}, Clément Pierrel, ${esc(SITE.ville)}.
      SIRET : à compléter. Directeur de la publication : Clément Pierrel. Hébergement : à compléter.
      Aucun cookie, aucune mesure d'audience, aucune requête vers un service tiers.
    </p>
  </div>
</footer>

<script src="${a("assets/app.js")}"></script>
</body>
</html>
`;
}

/* --- Rendu d'un domaine -------------------------------------------------------- */
function blocDomaine(id, d, origine) {
  return `<article class="bloc-domaine" data-domaine="${esc(id)}" data-origine="${origine}"${origine === "declencheur" ? " hidden" : ""}>
  <div class="bloc-domaine-tete">
    <h3>${esc(d.nom)}</h3>
    ${origine === "declencheur" ? '<span class="etiquette etiquette-accent">ajouté par votre contexte</span>' : ""}
  </div>
  <p class="bloc-domaine-resume">${esc(d.resume)}</p>
  <div class="bloc-domaine-corps">
    <div>
      <h4>Ce qu'il faut tenir</h4>
      <ul>${d.obligations.map((o) => `<li>${esc(o)}</li>`).join("")}</ul>
    </div>
    <div>
      <h4>Textes de référence</h4>
      <ul>${d.textes.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
      <h4 style="margin-top:var(--space-lg)">Sources officielles</h4>
      <ul class="sources">${d.sources.map((s) =>
        `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.nom)}</a></li>`).join("")}</ul>
    </div>
  </div>
</article>`;
}

/* --- Les groupes de fréquence d'une division ---------------------------------- */
function perimetre(V, code) {
  const base = [];
  const vu = new Set();
  [...V.transversaux, ...(V.parDivision[code] || [])].forEach((id) => {
    if (V.domaines[id] && !vu.has(id)) { vu.add(id); base.push(id); }
  });

  // Un déclencheur n'est proposé que s'il apporte un domaine que le secteur
  // n'a pas déjà : sinon la case ne changerait rien et n'aurait rien à faire là.
  const declencheurs = V.declencheurs.filter((q) =>
    q.domaines.some((id) => V.domaines[id] && !vu.has(id)));

  const ajoutables = [];
  const vuAjout = new Set();
  declencheurs.forEach((q) => q.domaines.forEach((id) => {
    if (V.domaines[id] && !vu.has(id) && !vuAjout.has(id)) { vuAjout.add(id); ajoutables.push(id); }
  }));

  const ordre = Object.keys(V.frequences)
    .sort((a, b) => V.frequences[a].ordre - V.frequences[b].ordre);

  const groupes = ordre.map((fid) => ({
    id: fid,
    f: V.frequences[fid],
    base: base.filter((id) => V.domaines[id].frequence === fid),
    ajout: ajoutables.filter((id) => V.domaines[id].frequence === fid)
  })).filter((g) => g.base.length || g.ajout.length);

  return { base, declencheurs, ajoutables, groupes };
}

/* --- Page d'un secteur ----------------------------------------------------------- */
function pageSecteur(V, PIEGES, METIERS, d) {
  const mots = METIERS[d.c] || [];
  const section = V.sections.filter((s) => s.c === d.s)[0];
  const { base, declencheurs, groupes } = perimetre(V, d.c);
  const p = PIEGES[d.c];

  const sujet = encodeURIComponent(`Veille réglementaire — ${d.l} (NAF ${d.c})`);

  const corps = `
<section class="heros">
  <div class="enveloppe">
    <nav class="fil" aria-label="Fil d'Ariane">
      <a href="../index.html">Accueil</a> <span aria-hidden="true">/</span>
      <a href="../secteurs.html">Les 88 secteurs</a> <span aria-hidden="true">/</span>
      <span>${esc(d.c)}</span>
    </nav>
    <span class="surtitre">${esc(section ? section.l : "")}</span>
    <h1>${esc(d.l)}</h1>
    ${mots.length ? `<p class="aussi"><span>On dit aussi</span> ${mots.map((m) => `<em>${esc(m)}</em>`).join(" · ")}</p>` : ""}
    <p class="chapeau lecture">
      Ce qui s'applique à une entreprise de la division <strong>${esc(d.c)}</strong> de la
      nomenclature NAF : les domaines à surveiller, leur rythme de revue, les obligations
      concrètes derrière chacun et les sources officielles à suivre.
    </p>
    <p class="rangee" style="margin-top:var(--space-xl)">
      <span class="etiquette">NAF ${esc(d.c)}</span>
      <span class="etiquette"><span id="compte-domaines">${base.length}</span> domaines de base</span>
      <a class="bouton bouton-accent" href="#contact-secteur">Faire valider ce périmètre</a>
    </p>
  </div>
</section>

<section class="section">
  <div class="enveloppe">
    <div class="tete-section">
      <span class="surtitre">Votre périmètre</span>
      <h2>Ce qui s'applique, groupé par rythme de revue</h2>
      <p>Le socle commun à toute entreprise, plus ce qui tient à ce métier en particulier.</p>
    </div>
    ${groupes.map((g) => `
    <div class="groupe-frequence" data-groupe-frequence="${esc(g.id)}">
      <div class="groupe-tete">
        <h3>${esc(g.f.l)}</h3>
        <span class="groupe-aide">${esc(g.f.d)}</span>
      </div>
      ${g.base.map((id) => blocDomaine(id, V.domaines[id], "base")).join("\n")}
      ${g.ajout.map((id) => blocDomaine(id, V.domaines[id], "declencheur")).join("\n")}
    </div>`).join("\n")}
  </div>
</section>

${declencheurs.length ? `
<section class="section section-muette">
  <div class="enveloppe">
    <div class="tete-section">
      <span class="surtitre">Affiner</span>
      <h2>Votre contexte ajoute des obligations</h2>
      <p>
        Cochez ce qui est vrai chez vous : les domaines correspondants s'ajoutent
        au périmètre ci-dessus. Rien n'est envoyé, tout se calcule dans votre navigateur.
      </p>
    </div>
    <ul class="questions" id="declencheurs">
      ${declencheurs.map((q) => `<li><label class="question">
        <input type="checkbox" data-domaines="${esc(q.domaines.join(" "))}">
        <span><span class="intitule">${esc(q.q)}</span><span class="aide">${esc(q.d)}</span></span>
      </label></li>`).join("\n")}
    </ul>
  </div>
</section>` : ""}

${p ? `
<section class="section">
  <div class="enveloppe">
    <div class="tete-section">
      <span class="surtitre">Le terrain</span>
      <h2>Les pièges de ce métier</h2>
      <p>Ce qui fait tomber les entreprises de ce secteur en particulier — pas la théorie, ce qu'on voit.</p>
      ${p.valide ? "" : `<p class="reserve" style="margin-top:var(--space-lg)">
        <strong>Premier jet, en attente de relecture.</strong>
        Ces pièges sont proposés à partir des obligations du secteur et n'ont pas encore
        été validés par Clément Pierrel. Ils sont à vérifier avant d'en tirer une action.
      </p>`}
    </div>
    <div class="grille grille-2">
      ${p.pieges.map((x) => `<article class="carte piege">
        <h3>${esc(x.titre)}</h3>
        <p>${esc(x.texte)}</p>
      </article>`).join("\n")}
    </div>
  </div>
</section>` : ""}

<section class="section section-muette" id="contact-secteur">
  <div class="enveloppe">
    <div class="grille grille-2">
      <div>
        <span class="surtitre">Contact</span>
        <h2>Faire valider ce périmètre</h2>
        <p class="chapeau" style="margin-top:var(--space-lg)">
          Cette page est un point de départ, pas une conclusion. Un échange d'une heure
          suffit à écarter ce qui ne vous concerne pas et à fixer un rythme tenable.
        </p>
        <p class="rangee" style="margin-top:var(--space-xl)">
          <a class="bouton" href="mailto:${esc(SITE.courriel)}?subject=${sujet}">Écrire à propos de ce secteur</a>
          <a class="bouton bouton-sobre" href="tel:${esc(SITE.telephoneLien)}">${esc(SITE.telephone)}</a>
        </p>
      </div>
      <p class="reserve">
        <strong>Une réserve, dite une fois pour toutes.</strong>
        Cette page fournit un cadre méthodologique, pas un conseil juridique, et ne garantit
        pas l'exhaustivité des textes applicables à une entreprise donnée. Le rattachement
        d'un domaine à une division NAF est une orientation, pas une qualification juridique.
        Chaque texte doit être vérifié sur
        <a href="https://www.legifrance.gouv.fr" target="_blank" rel="noopener">Légifrance</a>
        et l'analyse d'applicabilité validée par une personne compétente.
      </p>
    </div>
  </div>
</section>`;

  return page({
    titre: `Veille réglementaire — ${d.l} (NAF ${d.c}) | ${SITE.nom}`,
    description: `Veille réglementaire ${mots.length ? mots.slice(0, 4).join(", ") + " — " : ""}division NAF ${d.c}, ${d.l} : domaines à surveiller, rythme de revue, textes de référence et sources officielles.`,
    racine: "../",
    page: "secteur",
    corps,
    attrsBody: ` data-domaines-base="${base.length}"`
  });
}

/* --- Index des 88 secteurs --------------------------------------------------------- */
function pageSecteurs(V, METIERS) {
  const parSection = V.sections.map((s) => ({
    s,
    divisions: V.divisions.filter((d) => d.s === s.c)
  })).filter((g) => g.divisions.length);

  const corps = `
<section class="heros">
  <div class="enveloppe">
    <span class="surtitre">Tous les terrains</span>
    <h1>Les 88 secteurs</h1>
    <p class="chapeau lecture">
      La nomenclature d'activités française, division par division. Chacune a sa page :
      ce qui s'y applique, à quel rythme le revoir, et les pièges du métier.
      Cherchez par code, par libellé, ou simplement par le nom de votre métier :
      « boulangerie », « garage », « coiffeur » mènent au bon secteur.
    </p>
    <div class="recherche">
      <label for="recherche-secteur">Chercher un secteur</label>
      <input type="search" id="recherche-secteur" placeholder="boulangerie, 43, transport, coiffure…"
             autocomplete="off" spellcheck="false">
      <p class="recherche-compte"><span id="compte-secteurs">${V.divisions.length} secteurs</span></p>
    </div>
  </div>
</section>

<section class="section">
  <div class="enveloppe">
    <p id="aucun-secteur" class="etat-vide" hidden>
      Aucun secteur ne correspond. Essayez un code à deux chiffres, ou un mot du libellé.
    </p>
    <div id="liste-secteurs">
      ${parSection.map((g) => `
      <section class="groupe-section" data-groupe>
        <div class="groupe-tete">
          <h2><span class="lettre">${esc(g.s.c)}</span> ${esc(g.s.l)}</h2>
        </div>
        <div class="grille grille-3">
          ${g.divisions.map((d) => {
            const mots = METIERS[d.c] || [];
            return `<a class="carte secteur-carte"
             href="secteur/${esc(d.c)}-${slug(d.l)}.html"
             data-recherche="${esc([d.c, d.l, g.s.l, ...mots].join(" "))}">
            <span class="rang">NAF ${esc(d.c)}</span>
            <h3>${esc(d.l)}</h3>
            ${mots.length ? `<p class="mots">${esc(mots.slice(0, 4).join(" · "))}</p>` : ""}
          </a>`; }).join("\n")}
        </div>
      </section>`).join("\n")}
    </div>
  </div>
</section>`;

  return page({
    titre: `Les 88 secteurs — veille réglementaire par métier | ${SITE.nom}`,
    description: "Les 88 divisions de la nomenclature NAF, chacune avec ses obligations réglementaires, son rythme de revue et les pièges propres au métier.",
    page: "secteurs",
    corps
  });
}

/* --- Accueil --------------------------------------------------------------------- */
function pageAccueil(V, PIEGES) {
  const couverts = Object.keys(PIEGES).length;

  const corps = `
<section class="heros heros-accueil">
  <div class="enveloppe">
    <span class="surtitre">${esc(SITE.bareme)}</span>
    <h1>Savoir ce qui s'applique à vous.<br>Et pouvoir le prouver.</h1>
    <p class="chapeau lecture">
      Des textes paraissent chaque semaine. Une poignée vous concerne. Mon travail est de
      tracer cette frontière métier par métier, de la tenir dans le temps, et de vous
      laisser de quoi la prouver le jour d'un contrôle.
    </p>
    <p class="rangee" style="margin-top:var(--space-xl)">
      <a class="bouton bouton-accent" href="secteurs.html">Trouver mon secteur</a>
      <a class="bouton bouton-sobre" href="#methode">La méthode</a>
    </p>
    <dl class="chiffres">
      <div><dt>Secteurs couverts</dt><dd><span class="chiffre">${V.divisions.length}</span></dd></div>
      <div><dt>Domaines de veille</dt><dd><span class="chiffre">${Object.keys(V.domaines).length}</span></dd></div>
      <div><dt>Questions de contexte</dt><dd><span class="chiffre">${V.declencheurs.length}</span></dd></div>
      <div><dt>Métiers déjà documentés</dt><dd><span class="chiffre">${couverts}</span></dd></div>
    </dl>
  </div>
</section>

<section class="section section-muette">
  <div class="enveloppe">
    <div class="tete-section">
      <span class="surtitre">Le constat</span>
      <h2>Trois raisons pour lesquelles la conformité déraille</h2>
    </div>
    <div class="grille grille-3">
      <article class="carte"><span class="rang">01</span><h3>Le périmètre est flou</h3>
        <p>Personne ne vous remet la liste de ce qui vous concerne. Chacun découvre la sienne
        au premier contrôle, et toujours par le mauvais bout.</p></article>
      <article class="carte"><span class="rang">02</span><h3>Le trop-plein noie l'essentiel</h3>
        <p>Suivre tous les textes revient à n'en suivre aucun : celui qui vous concernait
        vraiment se perd dans la masse des alertes.</p></article>
      <article class="carte"><span class="rang">03</span><h3>C'est la preuve qui est demandée</h3>
        <p>Être en règle ne suffit pas. Il faut montrer quand vous avez regardé, ce que vous
        avez décidé et ce que vous avez fait. Sans traces datées, la bonne foi ne pèse rien.</p></article>
    </div>
  </div>
</section>

<section class="section" id="methode">
  <div class="enveloppe">
    <div class="tete-section">
      <span class="surtitre">Méthode</span>
      <h2>${V.etapes.length} étapes, toujours les mêmes</h2>
      <p>Une méthode de veille qui demande douze étapes n'est plus appliquée au bout de six mois.</p>
    </div>
    <ol class="etapes">
      ${V.etapes.map((e) => `<li class="etape">
        <span class="etape-numero">${esc(e.n)}</span>
        <div><h3>${esc(e.t)}</h3><p>${esc(e.d)}</p></div>
      </li>`).join("\n")}
    </ol>
  </div>
</section>

<section class="section section-muette">
  <div class="enveloppe">
    <div class="tete-section">
      <span class="surtitre">Sources</span>
      <h2>Ce que je suis, et que vous pouvez suivre aussi</h2>
      <p>Aucune source payante, aucun agrégateur : tout est public et officiel.
      Le travail n'est pas d'y accéder, il est de trier.</p>
    </div>
    <div class="enveloppe-tableau">
      <table class="tableau">
        <caption class="cache-visuellement">Sources officielles suivies</caption>
        <thead><tr><th scope="col">Source</th><th scope="col">Domaine</th><th scope="col">Ce qu'on y trouve</th></tr></thead>
        <tbody>
          ${V.sourcesGenerales.map((s) => `<tr>
            <td><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.nom)}</a></td>
            <td><span class="etiquette">${esc(s.type)}</span></td>
            <td>${esc(s.d)}</td></tr>`).join("\n")}
        </tbody>
      </table>
    </div>
  </div>
</section>

<section class="section" id="contact">
  <div class="enveloppe">
    <div class="grille grille-2">
      <div>
        <span class="surtitre">Contact</span>
        <h2>Un premier échange d'une heure, sans engagement</h2>
        <p class="chapeau" style="margin-top:var(--space-lg)">
          Décrivez votre activité en trois lignes et ce qui vous inquiète.
          Je réponds sous deux jours ouvrés.
        </p>
        <p class="rangee" style="margin-top:var(--space-xl)">
          <a class="bouton" href="mailto:${esc(SITE.courriel)}">${esc(SITE.courriel)}</a>
          <a class="bouton bouton-sobre" href="tel:${esc(SITE.telephoneLien)}">${esc(SITE.telephone)}</a>
        </p>
        <p style="margin-top:var(--space-lg); color:var(--color-muted-foreground)">
          ${esc(SITE.zone)}.
        </p>
      </div>
      <p class="reserve">
        <strong>Une réserve, dite une fois pour toutes.</strong>
        Ce site fournit un cadre méthodologique, pas un conseil juridique, et ne garantit pas
        l'exhaustivité des textes applicables à une entreprise donnée. Chaque texte doit être
        vérifié sur <a href="https://www.legifrance.gouv.fr" target="_blank" rel="noopener">Légifrance</a>
        et l'analyse d'applicabilité validée par une personne compétente.
      </p>
    </div>
  </div>
</section>`;

  return page({
    titre: `${SITE.nom} — veille réglementaire par secteur`,
    description: "Conseil en organisation et conformité à Istres. Les obligations réglementaires de votre métier, division NAF par division NAF, avec le rythme de revue et les sources officielles.",
    page: "accueil",
    corps
  });
}

/* --- Garde-fous ------------------------------------------------------------------- */
function verifie(V) {
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

  const sansRattachement = V.divisions.filter((d) => !V.parDivision[d.c]);
  if (sansRattachement.length) throw new Error(`Divisions sans rattachement : ${sansRattachement.map((d) => d.c).join(", ")}.`);

  // Deux divisions ne doivent pas produire le même fichier.
  const noms = V.divisions.map((d) => `${d.c}-${slug(d.l)}`);
  const doublons = noms.filter((n, i) => noms.indexOf(n) !== i);
  if (doublons.length) throw new Error(`Adresses en double : ${[...new Set(doublons)].join(", ")}.`);
}

async function poids(chemin) {
  const s = await stat(chemin);
  if (!s.isDirectory()) return s.size;
  let total = 0;
  for (const e of await readdir(chemin, { withFileTypes: true })) total += await poids(join(chemin, e.name));
  return total;
}

/* --- Construction ------------------------------------------------------------------ */
async function main() {
  const V = await chargeFichier("assets/referentiel.js", "VEILLE");
  const PIEGES = await chargeFichier("contenu/pieges.js", "PIEGES");
  const METIERS = await chargeFichier("contenu/metiers.js", "METIERS");
  verifie(V);

  for (const [nom, table] of [["Pièges", PIEGES], ["Mots du métier", METIERS]]) {
    const inconnues = Object.keys(table).filter((c) => !V.divisions.some((d) => d.c === c));
    if (inconnues.length) throw new Error(`${nom} rattachés à des divisions inexistantes : ${inconnues.join(", ")}.`);
  }

  await rm(SORTIE, { recursive: true, force: true });
  await mkdir(join(SORTIE, "secteur"), { recursive: true });
  await cp(resolve(RACINE, "assets"), join(SORTIE, "assets"), { recursive: true });

  await writeFile(join(SORTIE, "index.html"), pageAccueil(V, PIEGES));
  await writeFile(join(SORTIE, "secteurs.html"), pageSecteurs(V, METIERS));

  for (const d of V.divisions) {
    await writeFile(join(SORTIE, "secteur", `${d.c}-${slug(d.l)}.html`), pageSecteur(V, PIEGES, METIERS, d));
  }

  const total = await poids(SORTIE);
  const avecPieges = Object.keys(PIEGES).length;
  console.log(`  index.html + secteurs.html`);
  console.log(`  secteur/            ${V.divisions.length} pages`);
  console.log(`  assets/             ${((await poids(join(SORTIE, "assets"))) / 1024).toFixed(1)} Ko`);
  console.log(`\n_site/ prêt — ${(total / 1024).toFixed(1)} Ko, ${V.divisions.length + 2} pages, ` +
    `${Object.keys(V.domaines).length} domaines, ${avecPieges} secteurs avec pièges rédigés, ` +
    `${Object.keys(METIERS).length} secteurs trouvables par le nom du métier.`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
