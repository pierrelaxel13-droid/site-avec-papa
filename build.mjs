#!/usr/bin/env node
/* ==========================================================================
   Assemble le site publiable dans _site/
   --------------------------------------------------------------------------
   Deux zones :

     public/   l'accueil qui montre le produit, la tarification, la connexion
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
                attrsBody = "", verrou = false }) {
  const a = (f) => racine + f;
  const lien = (href, libelle, cle) =>
    `<a href="${a(href)}"${actif === cle ? ' aria-current="page"' : ""}>${libelle}</a>`;

  const menuPublic = `
      ${lien("index.html", "Le produit", "produit")}
      ${lien("tarifs.html", "Tarifs", "tarifs")}
      ${lien("connexion.html", "Connexion", "connexion")}
      ${selecteurTheme}`;

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
${zone === "app" ? '<meta name="robots" content="noindex">' : ""}
<meta property="og:title" content="${esc(titre)}">
<meta property="og:description" content="${esc(description)}">
<link rel="icon" href="${a("assets/favicon.svg")}" type="image/svg+xml">
<link rel="preload" href="${a("assets/polices/eb-garamond.woff2")}" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${a("assets/polices.css")}">
<link rel="stylesheet" href="${a("assets/site.css")}">
<script src="${a("assets/theme.js")}"></script>
<script>/* Avant tout rendu, sinon la page clignote en clair. */window.PCO_THEME.appliquer();</script>
</head>
<body class="zone-${zone}"${attrsBody}>

<a class="evitement" href="#contenu">Aller au contenu</a>

<header class="bandeau${zone === "app" ? " bandeau-app" : ""}">
  <div class="bandeau-interieur">
    <a class="marque" href="${a(zone === "app" ? "app/index.html" : "index.html")}">Pierrel <span>&amp; Co</span></a>
    <nav class="menu" aria-label="Navigation principale">${zone === "app" ? menuApp : menuPublic}</nav>
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
    <p class="etiq etiq-tampon">Accès réservé</p>
    <h1>Votre veille est derrière la connexion</h1>
    <p class="chapeau" style="margin-top:var(--t4)">
      Le plan de veille, le relevé des textes et le registre de preuves sont réservés
      aux abonnés. Vous pouvez entrer en démonstration pour voir exactement ce que
      contient l'application.
    </p>
    <p class="rangee" style="margin-top:var(--t5)">
      <a class="bouton" href="${a("connexion.html")}">Entrer en démonstration</a>
      <a class="bouton bouton-sobre" href="${a("tarifs.html")}">Voir les tarifs</a>
    </p>
  </div>
</section>` : ""}
${corps}
</main>

<footer class="pied">
  <div class="enveloppe">
    <div class="pied-grille">
      <span class="etiq">Pierrel &amp; Co</span>
      <div>
        <p>${esc(SITE.bareme)}.<br>Conseil en organisation et conformité, ${esc(SITE.ville)}.</p>
      </div>
      <div>
        <span class="etiq">Le site</span>
        <ul>
          <li><a href="${a("index.html")}">Le produit</a></li>
          <li><a href="${a("tarifs.html")}">Tarifs</a></li>
          <li><a href="${a("connexion.html")}">Connexion</a></li>
        </ul>
      </div>
      <div>
        <span class="etiq">Sources officielles</span>
        <ul>
          <li><a href="https://www.legifrance.gouv.fr" target="_blank" rel="noopener">Légifrance</a></li>
          <li><a href="https://entreprendre.service-public.fr" target="_blank" rel="noopener">Entreprendre</a></li>
          <li><a href="https://www.inrs.fr" target="_blank" rel="noopener">INRS</a></li>
        </ul>
      </div>
    </div>
    <p class="pied-bas">
      Éditeur : ${esc(SITE.nom)}, Clément Pierrel, ${esc(SITE.ville)}.
      SIRET : à compléter. Hébergement : à compléter.
      Aucun cookie, aucune mesure d'audience, aucune requête vers un service tiers.
      Cadre méthodologique, pas un conseil juridique.
    </p>
  </div>
</footer>

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
      <ul class="sources">${d.sources.map((s) =>
        `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.nom)}</a></li>`).join("")}</ul>
    </div>
  </div>
</article>`;
}

function rubrique({ etiq, contenu, aplat = false, id = "" }) {
  const interieur = `<div class="enveloppe"><div class="rubrique"${id ? ` id="${id}"` : ""}>
    <span class="etiq">${esc(etiq)}</span>
    <div>${contenu}</div>
  </div></div>`;
  return aplat ? `<section class="section-aplat">${interieur}</section>` : `<section>${interieur}</section>`;
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
  return `<section class="ouverture ouverture-app">
  <div class="enveloppe">
    <p class="reference etiq">
      <span class="etiq-tampon">${esc(D.entreprise.nom)}</span>
      <span>NAF ${esc(D.entreprise.nafComplet)}</span>
      <span>${esc(D.entreprise.ville)}</span>
      <span>${esc(D.entreprise.effectif)} salariés</span>
      <span>Suivi depuis ${esc(D.entreprise.depuis)}</span>
    </p>
    <h1>${esc(titre)}</h1>
    ${chapeau ? `<p class="chapeau" style="margin-top:var(--t4)">${chapeau}</p>` : ""}
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
      <dd><span class="mono grand">${enRetard.length}</span>
      ${enRetard.length ? `<span class="precision">${esc(enRetard.map((e) => e.frequence).join(", "))}</span>` : ""}</dd>
    </div>
    <div><dt class="etiq">Textes à analyser</dt><dd><span class="mono grand">${aAnalyser.length}</span></dd></div>
    <div><dt class="etiq">Actions ouvertes</dt><dd><span class="mono grand">${ouvertes.length}</span></dd></div>
    <div><dt class="etiq">Textes relevés, 90 jours</dt><dd><span class="mono grand">${D.releve.length}</span></dd></div>
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
  <p style="margin-top:var(--t4)"><a href="releve.html">Voir tout le relevé →</a></p>` })}

${rubrique({ etiq: "Dernières traces", aplat: true, contenu: `
  <p class="lecture">Ce qu'un auditeur regarderait en premier.</p>
  <ul class="liste-registre" style="margin-top:var(--t4)">
    ${D.registre.slice(0, 4).map((r) => ligneRegistre(r)).join("")}
  </ul>
  <p style="margin-top:var(--t4)"><a href="registre.html">Voir tout le registre →</a></p>` })}`;

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
  <dl class="faits" style="border-top:0; padding-top:0">
    <div><dt class="etiq">Domaines suivis</dt><dd><span class="mono grand">${total}</span></dd></div>
    <div><dt class="etiq">Division NAF</dt><dd><span class="mono grand">${esc(D.entreprise.naf)}</span></dd></div>
    <div><dt class="etiq">Responsable</dt><dd>${esc(D.entreprise.responsable)}</dd></div>
  </dl>
  <p class="aussi" style="margin-top:var(--t4)">
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
    ${parStatut.map((x) => `<div><dt class="etiq">${esc(x.l)}</dt><dd><span class="mono grand">${x.n}</span></dd></div>`).join("")}
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
    <button type="button" class="bouton" onclick="window.print()">Imprimer le registre</button>
  </p>` })}`;

  return page({
    titre: `Registre de preuves | ${SITE.nom}`,
    description: "Les traces datées de la veille.",
    racine: "../", zone: "app", actif: "registre", corps, verrou: true
  });
}

/* --- Les 88 fiches, désormais dans l'application ----------------------------- */
function appSecteurs(V, METIERS) {
  const parSection = V.sections.map((s) => ({
    s, divisions: V.divisions.filter((d) => d.s === s.c)
  })).filter((g) => g.divisions.length);

  const corps = `<section class="ouverture ouverture-app">
  <div class="enveloppe">
    <p class="reference etiq">
      <span class="etiq-tampon">Référentiel</span>
      <span>${V.divisions.length} divisions · ${V.sections.length} sections</span>
      <span>${Object.keys(V.domaines).length} domaines</span>
    </p>
    <h1>Fiches par secteur</h1>
    <p class="chapeau" style="margin-top:var(--t4)">
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

  const corps = `<section class="ouverture ouverture-app">
  <div class="enveloppe">
    <p class="reference etiq">
      <span><a href="../secteurs.html">Fiches par secteur</a></span>
      <span class="etiq-tampon">Fiche ${esc(d.c)}</span>
      <span>Section ${esc(d.s)} — ${esc(section ? section.l : "")}</span>
    </p>
    <h1>${esc(d.l)}</h1>
    ${mots.length ? `<p class="aussi"><span class="etiq">On dit aussi</span>${esc(mots.join(" · "))}</p>` : ""}
    <dl class="faits" style="margin-top:var(--t5)">
      <div><dt class="etiq">Code NAF</dt><dd><span class="mono grand">${esc(d.c)}</span></dd></div>
      <div><dt class="etiq">Domaines de base</dt><dd><span class="mono grand" id="compte-domaines">${base.length}</span></dd></div>
      <div><dt class="etiq">Rythme le plus serré</dt><dd>${esc(rythme)}</dd></div>
      <div><dt class="etiq">Questions de contexte</dt><dd><span class="mono grand">${declencheurs.length}</span></dd></div>
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

function pageProduit(V, D, ECRANS) {
  const ecran = (nom, titre, legende) => ECRANS.includes(nom) ? `
    <figure class="ecran">
      <img src="assets/ecrans/${esc(nom)}" alt="${esc(titre)}" loading="lazy" decoding="async" width="1280" height="860">
      <figcaption><span class="etiq">${esc(titre)}</span> ${esc(legende)}</figcaption>
    </figure>` : `<p class="ecran-absent etiq">Capture manquante : ${esc(nom)}</p>`;

  const corps = `
<section class="ouverture ouverture-produit">
  <div class="enveloppe">
    <p class="reference etiq">
      <span class="etiq-tampon">${esc(SITE.bareme)}</span>
      <span>${esc(SITE.ville)}</span>
    </p>
    <h1>Votre veille réglementaire,<br>tenue et prouvable.</h1>
    <p class="chapeau" style="margin-top:var(--t4)">
      Les textes qui concernent votre métier, relevés et analysés chaque semaine.
      Un plan de veille à jour, un relevé daté, un registre de preuves prêt pour l'audit.
      Vous ouvrez l'application, vous voyez ce qui vous attend.
    </p>
    <p class="rangee" style="margin-top:var(--t5)">
      <a class="bouton" href="connexion.html">Voir l'application</a>
      <a class="bouton bouton-sobre" href="tarifs.html">Tarifs</a>
    </p>
    ${ecran("bord.png", "Tableau de bord", "ce qui est en retard, ce qui attend une décision.")}
  </div>
</section>

${rubrique({ etiq: "Le relevé", aplat: true, contenu: `
  <h2>Ce qui vous concerne, et rien d'autre</h2>
  <p class="lecture" style="margin-top:var(--t3)">
    Le reproche fait à toutes les plateformes de veille est le même : elles remontent tout,
    donc on ne lit plus rien, et le texte qui comptait vraiment se perd. Ici le tri est fait
    en amont, sur votre périmètre, et chaque texte arrive avec ce qu'il change pour vous.
  </p>
  ${ecran("releve.png", "Relevé des textes", "daté, rattaché à un domaine, avec l'état de la décision.")}` })}

${rubrique({ etiq: "Le plan", contenu: `
  <h2>Un périmètre écrit, pas une intuition</h2>
  <p class="lecture" style="margin-top:var(--t3)">
    ${Object.keys(V.domaines).length} domaines de veille, ${V.divisions.length} divisions
    d'activité, ${V.declencheurs.length} questions de contexte. Votre plan en retient ce qui
    vous concerne, avec pour chaque domaine un rythme de revue et un responsable désigné.
  </p>
  ${ecran("plan.png", "Mon plan de veille", "les domaines retenus, groupés par rythme de revue.")}` })}

${rubrique({ etiq: "Les preuves", aplat: true, contenu: `
  <h2>Ce qu'un auditeur demande vraiment</h2>
  <p class="lecture" style="margin-top:var(--t3)">
    L'écart le plus fréquemment relevé en audit n'est pas l'absence de veille : c'est la veille
    faite et jamais tracée. Le registre enregistre chaque revue, chaque décision, chaque action,
    avec sa date. Il s'imprime tel quel.
  </p>
  ${ecran("registre.png", "Registre de preuves", "chronologique, sans trou, imprimable.")}` })}

${rubrique({ etiq: "Le référentiel", contenu: `
  <h2>${V.divisions.length} fiches de secteur</h2>
  <p class="lecture" style="margin-top:var(--t3)">
    Chaque division de la nomenclature NAF a sa fiche : les domaines qui s'y appliquent, les
    obligations derrière chacun, les sources officielles, et les pièges propres au métier.
    De quoi situer un client, un sous-traitant ou un donneur d'ordre en deux minutes.
  </p>
  ${ecran("secteurs.png", "Fiches par secteur", "cherchables par code, par libellé ou par métier.")}` })}

${rubrique({ etiq: "Commencer", aplat: true, contenu: `
  <div class="deux-colonnes">
    <div>
      <h2>Voir avant de décider</h2>
      <p style="margin-top:var(--t3)">L'application est ouverte en démonstration, avec un jeu
      d'essai. Vous voyez exactement ce qu'elle contient, sans créer de compte.</p>
      <p class="rangee" style="margin-top:var(--t4)">
        <a class="bouton" href="connexion.html">Entrer en démonstration</a>
        <a class="bouton bouton-sobre" href="mailto:${esc(SITE.courriel)}">${esc(SITE.courriel)}</a>
      </p>
    </div>
    <p class="reserve">
      <strong>Une réserve, dite une fois pour toutes.</strong>
      Le service fournit un cadre méthodologique, pas un conseil juridique, et ne garantit pas
      l'exhaustivité des textes applicables à une entreprise donnée. Chaque texte doit être
      vérifié sur <a href="https://www.legifrance.gouv.fr" target="_blank" rel="noopener">Légifrance</a>
      et l'analyse d'applicabilité validée par une personne compétente.
    </p>
  </div>` })}`;

  return page({
    titre: `${SITE.nom} — ${SITE.bareme}`,
    description: "Votre veille réglementaire tenue et prouvable : plan de veille, relevé des textes de votre métier, registre de preuves prêt pour l'audit.",
    zone: "public", actif: "produit", corps
  });
}

function pageTarifs(V) {
  const corps = `
<section class="ouverture">
  <div class="enveloppe">
    <p class="reference etiq"><span class="etiq-tampon">Tarifs</span><span>Prix hors taxes</span></p>
    <h1>Trois formules</h1>
    <p class="chapeau" style="margin-top:var(--t4)">
      Affichées, parce que presque personne ne le fait dans ce métier : les offres
      comparables sont toutes « sur devis ».
    </p>
    <p class="reserve" style="margin-top:var(--t5)">
      <strong>Proposition à valider.</strong> Ces montants sont une proposition construite
      à partir de la revue du marché, pas une grille arrêtée par Clément Pierrel.
      À confirmer avant toute mise en ligne publique.
    </p>
  </div>
</section>

${rubrique({ etiq: "Formules", contenu: `
  <div class="formules">
    <article class="formule">
      <span class="etiq">01 — Cadrage</span>
      <p class="prix"><span class="mono grand">890 €</span> <span class="etiq">une fois</span></p>
      <p>Une demi-journée sur site, puis votre plan de veille écrit : les domaines qui
      s'appliquent, le rythme de revue de chacun, les sources à suivre, le responsable désigné.
      Vous repartez avec le document, que vous preniez la suite ou non.</p>
    </article>
    <article class="formule">
      <span class="etiq">02 — Veille tenue</span>
      <p class="prix"><span class="mono grand">180 €</span> <span class="etiq">par mois</span></p>
      <p>Le cadrage, puis le relevé : les textes qui touchent votre périmètre, analysés et
      datés, avec ce que chacun change pour vous. Accès à l'application et aux fiches de
      secteur. Un site, un responsable.</p>
    </article>
    <article class="formule mise-en-avant">
      <span class="etiq etiq-tampon">03 — Veille et preuves</span>
      <p class="prix"><span class="mono grand">290 €</span> <span class="etiq">par mois</span></p>
      <p>La veille tenue, plus le registre de preuves alimenté à chaque revue et une revue
      annuelle de conformité sur site. C'est la formule pour qui passe un audit — ISO 14001,
      ISO 45001, MASE, Qualiopi.</p>
    </article>
  </div>` })}

${rubrique({ etiq: "Ce qui n'est pas compris", aplat: true, contenu: `
  <ul class="lecture">
    <li>Le conseil juridique sur un point litigieux : vous serez orienté vers un avocat.</li>
    <li>La certification elle-même : les organismes certificateurs restent indépendants.</li>
    <li>Les démarches à votre place auprès de l'administration.</li>
  </ul>
  <p class="lecture" style="margin-top:var(--t4)">Multi-sites, groupes, secteurs très
  réglementés : sur devis, parce que le périmètre change tout.</p>` })}

${rubrique({ etiq: "Contact", contenu: `
  <p class="lecture">Un premier échange d'une heure, sans engagement. Décrivez votre activité
  en trois lignes et ce qui vous inquiète.</p>
  <p class="rangee" style="margin-top:var(--t4)">
    <a class="bouton" href="mailto:${esc(SITE.courriel)}">${esc(SITE.courriel)}</a>
    <a class="bouton bouton-sobre" href="tel:${esc(SITE.telephoneLien)}">${esc(SITE.telephone)}</a>
  </p>` })}`;

  return page({
    titre: `Tarifs | ${SITE.nom}`,
    description: "Trois formules de veille réglementaire, avec leurs prix affichés.",
    zone: "public", actif: "tarifs", corps
  });
}

function pageConnexion() {
  const corps = `
<section class="ouverture">
  <div class="enveloppe">
    <p class="reference etiq"><span class="etiq-tampon">Accès</span></p>
    <h1>Connexion</h1>
    <div class="connexion">
      <p class="reserve">
        <strong>Il n'y a pas encore de comptes.</strong>
        L'authentification demande un service dédié, qui n'est pas en place : aucun identifiant
        ne serait vérifié, et aucun mot de passe ne doit être saisi ici. C'est pourquoi cet
        écran n'en demande pas. Le bouton ci-dessous ouvre l'application avec un jeu d'essai.
      </p>
      <p style="margin-top:var(--t4)">
        <button type="button" class="bouton" id="entrer-demo">Entrer en démonstration</button>
      </p>
      <p class="etiq" style="margin-top:var(--t3)" id="etat-session"></p>
      <p style="margin-top:var(--t5)">
        <a href="tarifs.html">Voir les tarifs</a> &nbsp;·&nbsp;
        <a href="mailto:${esc(SITE.courriel)}">Demander un accès</a>
      </p>
    </div>
  </div>
</section>

${rubrique({ etiq: "Ce qu'il reste à brancher", contenu: `
  <p class="lecture">Pour de vrais comptes et un vrai abonnement, il faut deux services
  extérieurs, qui s'ajoutent sans rien casser :</p>
  <ul class="lecture">
    <li><strong>L'authentification</strong> — Netlify Identity ou un équivalent, pour que les
    comptes existent et que les pages de l'application ne soient plus servies à tout le monde.</li>
    <li><strong>Le paiement</strong> — Stripe ou un équivalent, pour l'abonnement mensuel et
    sa résiliation.</li>
  </ul>
  <p class="lecture" style="margin-top:var(--t4)">Tant qu'ils ne sont pas là, la connexion de
  cette page ne protège rien : elle pose un jeton dans le navigateur, et le contenu des pages
  de l'application reste lisible par qui regarde la source.</p>` })}`;

  return page({
    titre: `Connexion | ${SITE.nom}`,
    description: "Accès à l'application de veille réglementaire.",
    zone: "public", actif: "connexion", corps
  });
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

  await writeFile(join(SORTIE, "index.html"), pageProduit(V, D, ECRANS));
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
  console.log(`  public              3 pages (produit, tarifs, connexion)`);
  console.log(`  app/                5 écrans + ${V.divisions.length} fiches de secteur`);
  console.log(`  assets/             ${((await poids(join(SORTIE, "assets"))) / 1024).toFixed(1)} Ko`);
  console.log(`  écrans de l'accueil ${ECRANS.length ? ECRANS.length + " captures" : "AUCUNE — lancer outils/captures.mjs"}`);
  console.log(`\n_site/ prêt — ${(total / 1024).toFixed(1)} Ko, ${V.divisions.length + 8} pages, ` +
    `${Object.keys(V.domaines).length} domaines, ${Object.keys(PIEGES).length} secteurs avec pièges.`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
