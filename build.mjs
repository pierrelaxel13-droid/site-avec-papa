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
      <span class="etiq">Pierrel &amp; Co</span>
      <div>
        <p>${esc(SITE.bareme)}.<br>Veille réglementaire, préparation aux contrôles et aux audits.<br>${esc(SITE.zone)}.</p>
      </div>
      <div>
        <span class="etiq">Le site</span>
        <ul>
          <li><a href="${a("index.html")}">Accueil</a></li>
          <li><a href="${a("secteurs.html")}">Les 88 secteurs</a></li>
          <li><a href="${a("index.html#methode")}">Méthode</a></li>
          <li><a href="${a("index.html#contact")}">Contact</a></li>
        </ul>
      </div>
      <div>
        <span class="etiq">Sources officielles</span>
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

/* --- Une rubrique : étiquette à gauche, contenu à droite ----------------------- */
function rubrique({ etiq, contenu, aplat = false, id = "" }) {
  const interieur = `<div class="enveloppe"><div class="rubrique"${id ? ` id="${id}"` : ""}>
    <span class="etiq">${esc(etiq)}</span>
    <div>${contenu}</div>
  </div></div>`;
  return aplat ? `<section class="section-aplat">${interieur}</section>` : `<section>${interieur}</section>`;
}

/* --- Page d'un secteur ------------------------------------------------------- */
function pageSecteur(V, PIEGES, METIERS, d) {
  const section = V.sections.filter((s) => s.c === d.s)[0];
  const mots = METIERS[d.c] || [];
  const { base, declencheurs, groupes } = perimetre(V, d.c);
  const p = PIEGES[d.c];
  const sujet = encodeURIComponent(`Veille réglementaire — ${d.l} (NAF ${d.c})`);
  const rythme = groupes.length ? groupes[0].f.l : "—";

  const corps = `
<section class="ouverture">
  <div class="enveloppe">
    <p class="reference etiq">
      <span><a href="../index.html">Pierrel &amp; Co</a></span>
      <span><a href="../secteurs.html">Index des secteurs</a></span>
      <span class="etiq-tampon">Fiche ${esc(d.c)}</span>
      <span>Section ${esc(d.s)} — ${esc(section ? section.l : "")}</span>
    </p>
    <h1>${esc(d.l)}</h1>
    ${mots.length ? `<p class="aussi"><span class="etiq">On dit aussi</span>${esc(mots.join(" · "))}</p>` : ""}
    <p class="chapeau" style="margin-top:var(--t4)">
      Ce qui s'applique à une entreprise de cette division : les domaines à surveiller,
      le rythme auquel les revoir, les obligations concrètes derrière chacun, et les
      sources officielles où vérifier.
    </p>
    <dl class="faits" style="margin-top:var(--t5)">
      <div><dt class="etiq">Code NAF</dt><dd><span class="mono">${esc(d.c)}</span></dd></div>
      <div><dt class="etiq">Domaines de base</dt><dd><span class="mono" id="compte-domaines">${base.length}</span></dd></div>
      <div><dt class="etiq">Rythme le plus serré</dt><dd>${esc(rythme)}</dd></div>
      <div><dt class="etiq">Questions de contexte</dt><dd><span class="mono">${declencheurs.length}</span></dd></div>
    </dl>
    <p class="rangee" style="margin-top:var(--t5)">
      <a class="bouton" href="#contact-secteur">Faire valider ce périmètre</a>
    </p>
  </div>
</section>

${rubrique({ etiq: "Périmètre", contenu: `
  <p class="lecture">Le socle commun à toute entreprise, plus ce qui tient à ce métier
  en particulier. Groupé par rythme de revue : c'est le rythme, et non la liste,
  qui détermine ce que la veille coûtera en temps.</p>
  ${groupes.map((g) => `
  <div class="groupe-frequence" data-groupe-frequence="${esc(g.id)}">
    <div class="tete"><h3>${esc(g.f.l)}</h3><span class="etiq">${esc(g.f.d)}</span></div>
    ${g.base.map((id) => blocDomaine(id, V.domaines[id], "base")).join("\n")}
    ${g.ajout.map((id) => blocDomaine(id, V.domaines[id], "declencheur")).join("\n")}
  </div>`).join("\n")}` })}

${declencheurs.length ? rubrique({ etiq: "Contexte", aplat: true, contenu: `
  <p class="lecture">Cochez ce qui est vrai chez vous : les domaines correspondants
  s'ajoutent au périmètre ci-dessus. Seules figurent ici les questions qui apportent
  quelque chose à ce métier — une case qui ne changerait rien n'a pas sa place.
  Rien n'est envoyé, tout se calcule dans votre navigateur.</p>
  <ul class="questions" id="declencheurs" style="margin-top:var(--t4)">
    ${declencheurs.map((q) => `<li><label class="question">
      <input type="checkbox" data-domaines="${esc(q.domaines.join(" "))}">
      <span><span class="intitule">${esc(q.q)}</span><span class="aide">${esc(q.d)}</span></span>
    </label></li>`).join("\n")}
  </ul>` }) : ""}

${p ? rubrique({ etiq: "Le terrain", contenu: `
  <p class="lecture">Ce qui fait tomber les entreprises de ce secteur en particulier.
  Pas la théorie : ce qu'on voit.</p>
  ${p.valide ? "" : `<p class="reserve" style="margin:var(--t4) 0">
    <strong>Premier jet, en attente de relecture.</strong>
    Ces points sont déduits des obligations du secteur et n'ont pas encore été validés
    par Clément Pierrel. À vérifier avant d'en tirer une action.</p>`}
  <div class="pieges" style="margin-top:var(--t5)">
    ${p.pieges.map((x) => `<article class="piege"><h3>${esc(x.titre)}</h3><p>${esc(x.texte)}</p></article>`).join("\n")}
  </div>` }) : ""}

${rubrique({ etiq: "Contact", aplat: true, id: "contact-secteur", contenu: `
  <div class="deux-colonnes">
    <div>
      <h2>Faire valider ce périmètre</h2>
      <p style="margin-top:var(--t3)">Cette fiche est un point de départ, pas une conclusion.
      Un échange d'une heure suffit à écarter ce qui ne vous concerne pas et à fixer un
      rythme tenable.</p>
      <p class="rangee" style="margin-top:var(--t4)">
        <a class="bouton" href="mailto:${esc(SITE.courriel)}?subject=${sujet}">Écrire à propos de ce secteur</a>
        <a class="bouton bouton-sobre" href="tel:${esc(SITE.telephoneLien)}">${esc(SITE.telephone)}</a>
      </p>
    </div>
    <p class="reserve">
      <strong>Une réserve, dite une fois pour toutes.</strong>
      Cette fiche fournit un cadre méthodologique, pas un conseil juridique, et ne garantit
      pas l'exhaustivité des textes applicables à une entreprise donnée. Le rattachement
      d'un domaine à une division NAF est une orientation, pas une qualification juridique.
      Chaque texte doit être vérifié sur
      <a href="https://www.legifrance.gouv.fr" target="_blank" rel="noopener">Légifrance</a>
      et l'analyse d'applicabilité validée par une personne compétente.
    </p>
  </div>` })}`;

  return page({
    titre: `Veille réglementaire — ${d.l} (NAF ${d.c}) | ${SITE.nom}`,
    description: `Veille réglementaire ${mots.length ? mots.slice(0, 4).join(", ") + " — " : ""}division NAF ${d.c}, ${d.l} : domaines à surveiller, rythme de revue, textes de référence et sources officielles.`,
    racine: "../",
    page: "secteur",
    corps,
    attrsBody: ` data-domaines-base="${base.length}"`
  });
}

/* --- Index des 88 secteurs ------------------------------------------------------ */
function pageSecteurs(V, METIERS) {
  const parSection = V.sections.map((s) => ({
    s, divisions: V.divisions.filter((d) => d.s === s.c)
  })).filter((g) => g.divisions.length);

  const corps = `
<section class="ouverture">
  <div class="enveloppe">
    <p class="reference etiq">
      <span><a href="index.html">Pierrel &amp; Co</a></span>
      <span class="etiq-tampon">Index</span>
      <span>${V.divisions.length} divisions · ${V.sections.length} sections</span>
    </p>
    <h1>Index des secteurs</h1>
    <p class="chapeau" style="margin-top:var(--t4)">
      La nomenclature d'activités française, division par division. Chacune a sa fiche.
      Cherchez par code, par libellé, ou par le nom de votre métier — « boulangerie »,
      « garage », « coiffeur » mènent au bon secteur.
    </p>
    <div class="recherche" style="margin-top:var(--t5)">
      <label class="etiq" for="recherche-secteur">Chercher</label>
      <input type="search" id="recherche-secteur" placeholder="boulangerie, 43, transport…"
             autocomplete="off" spellcheck="false">
      <p class="recherche-compte etiq"><span id="compte-secteurs">${V.divisions.length} secteurs</span></p>
    </div>
  </div>
</section>

<div class="enveloppe">
  <p id="aucun-secteur" class="etat-vide" hidden>
    Aucun secteur ne correspond. Essayez un code à deux chiffres, ou un mot du libellé.
  </p>
  <div id="liste-secteurs">
    ${parSection.map((g) => `
    <section class="groupe-section" data-groupe>
      <span class="etiq"><span class="etiq-tampon">${esc(g.s.c)}</span> &nbsp;${esc(g.s.l)}</span>
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
</div>`;

  return page({
    titre: `Index des secteurs — veille réglementaire par métier | ${SITE.nom}`,
    description: "Les 88 divisions de la nomenclature NAF, chacune avec ses obligations réglementaires, son rythme de revue et les pièges propres au métier.",
    page: "secteurs",
    corps
  });
}

/* --- Accueil ---------------------------------------------------------------------- */
function pageAccueil(V, PIEGES, METIERS) {
  const corps = `
<section class="ouverture">
  <div class="enveloppe">
    <p class="reference etiq">
      <span class="etiq-tampon">${esc(SITE.bareme)}</span>
      <span>${esc(SITE.ville)}</span>
    </p>
    <h1>Savoir ce qui s'applique à vous.<br>Et pouvoir le prouver.</h1>
    <p class="chapeau" style="margin-top:var(--t4)">
      Des textes paraissent chaque semaine. Une poignée vous concerne. Mon travail est de
      tracer cette frontière métier par métier, de la tenir dans le temps, et de vous laisser
      de quoi la prouver le jour d'un contrôle.
    </p>
    <div class="recherche" style="margin-top:var(--t6)">
      <label class="etiq" for="recherche-accueil">Commencez par votre métier</label>
      <input type="search" id="recherche-accueil" placeholder="boulangerie, garage, maçon…"
             autocomplete="off" spellcheck="false"
             aria-describedby="aide-recherche">
      <p class="recherche-compte etiq" id="aide-recherche">
        <a href="secteurs.html">ou parcourez l'index des ${V.divisions.length} secteurs</a>
      </p>
    </div>
  </div>
</section>

${rubrique({ etiq: "Le périmètre", contenu: `
  <h2>Personne ne vous remet la liste de ce qui vous concerne</h2>
  <p class="lecture" style="margin-top:var(--t3)">
    Entre le code du travail, l'environnement, la réglementation propre à votre métier et
    ce que vos clients exigent, il n'existe aucun document qui dise, pour votre entreprise :
    voilà ce qui s'applique, voilà ce qui ne s'applique pas. Chacun découvre sa liste au
    premier contrôle, et toujours par le mauvais bout.
  </p>
  <p class="lecture">
    Suivre tout n'est pas une solution : c'est le reproche numéro un fait aux plateformes de
    veille. Le texte qui vous concernait vraiment finit noyé dans les alertes. Le travail
    utile est l'inverse — écarter, et justifier ce qu'on écarte.
  </p>` })}

${rubrique({ etiq: "Ce que je livre", aplat: true, contenu: `
  <dl class="faits" style="border-top:0; padding-top:0; grid-template-columns:1fr">
    <div style="padding-bottom:var(--t4); border-bottom:1px solid var(--filet)">
      <dt class="etiq">01 — Le plan de veille</dt>
      <dd style="margin-top:var(--t2); max-width:var(--lecture)">Les domaines qui s'appliquent
      réellement à votre activité, avec pour chacun la fréquence de revue, les sources à suivre
      et le responsable chez vous. Les fiches de ce site en sont la version publique et
      automatique ; la vôtre tient compte de ce qu'une page ne peut pas savoir.</dd>
    </div>
    <div style="padding:var(--t4) 0; border-bottom:1px solid var(--filet)">
      <dt class="etiq">02 — La veille tenue</dt>
      <dd style="margin-top:var(--t2); max-width:var(--lecture)">Je suis les sources au rythme
      fixé et ne remonte que ce qui touche votre périmètre, avec ce que ça change concrètement.
      Un relevé court et daté, pas une revue de presse.</dd>
    </div>
    <div style="padding-top:var(--t4)">
      <dt class="etiq">03 — Le dossier de preuves</dt>
      <dd style="margin-top:var(--t2); max-width:var(--lecture)">C'est ce qu'un auditeur
      demande, et ce qui manque le plus souvent : non pas la veille, mais la trace de ce qu'on
      en a fait. Revues, analyses, décisions et actions archivées au même endroit.</dd>
    </div>
  </dl>` })}

${rubrique({ etiq: "Méthode", id: "methode", contenu: `
  <h2>${V.etapes.length} étapes, toujours les mêmes</h2>
  <p class="lecture" style="margin-top:var(--t3)">Une méthode de veille qui demande douze
  étapes n'est plus appliquée au bout de six mois.</p>
  <ol class="etapes" style="margin-top:var(--t4)">
    ${V.etapes.map((e) => `<li class="etape">
      <span class="num">${esc(e.n)}</span>
      <div><h3>${esc(e.t)}</h3><p>${esc(e.d)}</p></div>
    </li>`).join("\n")}
  </ol>` })}

${rubrique({ etiq: "Sources", aplat: true, contenu: `
  <h2>Ce que je suis, et que vous pouvez suivre aussi</h2>
  <p class="lecture" style="margin-top:var(--t3)">Aucune source payante, aucun agrégateur :
  tout est public et officiel. Le travail n'est pas d'y accéder, il est de trier.</p>
  <div class="enveloppe-tableau" style="margin-top:var(--t4)">
    <table class="tableau">
      <caption class="cache-visuellement">Sources officielles suivies</caption>
      <thead><tr><th scope="col">Source</th><th scope="col">Domaine</th><th scope="col">Ce qu'on y trouve</th></tr></thead>
      <tbody>${V.sourcesGenerales.map((s) => `<tr>
        <td><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.nom)}</a></td>
        <td>${esc(s.type)}</td>
        <td>${esc(s.d)}</td></tr>`).join("\n")}</tbody>
    </table>
  </div>` })}

${rubrique({ etiq: "Contact", id: "contact", contenu: `
  <div class="deux-colonnes">
    <div>
      <h2>Un premier échange d'une heure, sans engagement</h2>
      <p style="margin-top:var(--t3)">Décrivez votre activité en trois lignes et ce qui vous
      inquiète. Je réponds sous deux jours ouvrés.</p>
      <p class="rangee" style="margin-top:var(--t4)">
        <a class="bouton" href="mailto:${esc(SITE.courriel)}">${esc(SITE.courriel)}</a>
        <a class="bouton bouton-sobre" href="tel:${esc(SITE.telephoneLien)}">${esc(SITE.telephone)}</a>
      </p>
      <p class="etiq" style="margin-top:var(--t4)">${esc(SITE.zone)}</p>
    </div>
    <p class="reserve">
      <strong>Une réserve, dite une fois pour toutes.</strong>
      Ce site fournit un cadre méthodologique, pas un conseil juridique, et ne garantit pas
      l'exhaustivité des textes applicables à une entreprise donnée. Chaque texte doit être
      vérifié sur <a href="https://www.legifrance.gouv.fr" target="_blank" rel="noopener">Légifrance</a>
      et l'analyse d'applicabilité validée par une personne compétente.
    </p>
  </div>` })}`;

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

  await writeFile(join(SORTIE, "index.html"), pageAccueil(V, PIEGES, METIERS));
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
