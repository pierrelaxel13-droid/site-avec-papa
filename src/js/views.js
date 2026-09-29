/* ==========================================================================
   Vigie — écrans
   ========================================================================== */

const VUES = [
  { id: "vue", l: "Vue d’ensemble", ic: "radar" },
  { id: "profil", l: "Profil & NAF", ic: "profil" },
  { id: "plan", l: "Plan de veille", ic: "plan" },
  { id: "calendrier", l: "Calendrier", ic: "calendrier" },
  { id: "registre", l: "Registre", ic: "registre" },
  { id: "sources", l: "Sources", ic: "sources" },
  { id: "synthese", l: "Synthèse", ic: "synthese" }
];

const SECTION_COURT = {
  A: "Agriculture", B: "Industries extractives", C: "Industrie manufacturière", D: "Énergie", E: "Eau et déchets", F: "Construction", G: "Commerce",
  H: "Transports", I: "Hébergement, restauration", J: "Information, communication", K: "Finance, assurance", L: "Immobilier", M: "Activités spécialisées",
  N: "Services de soutien", O: "Administration", P: "Enseignement", Q: "Santé, action sociale", R: "Arts, loisirs", S: "Autres services",
  T: "Ménages employeurs", U: "Extra-territorial"
};
const safeUrl = (u) => (/^https?:\/\//i.test(String(u || "")) ? u : "");
const nafAffiche = () => S.profil.naf || S.profil.division || "";
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const optionsSel = (liste, val, vide) =>
  (vide != null ? '<option value="">' + esc(vide) + "</option>" : "") +
  liste.map((o) => '<option value="' + esc(o[0]) + '"' + (o[0] === val ? " selected" : "") + ">" + esc(o[1]) + "</option>").join("");

function entete(eyebrow, titre, lede, actions) {
  return (
    '<header class="view-head"><div class="vh-txt"><p class="eyebrow">' + esc(eyebrow) + "</p><h1>" + titre + "</h1>" +
    (lede ? '<p class="lede">' + lede + "</p>" : "") + "</div>" +
    (actions ? '<div class="view-actions">' + actions + "</div>" : "") + '</header><div class="ruler" aria-hidden="true"></div>'
  );
}

function plaque() {
  const div = V.division(S.profil.division);
  const code = nafAffiche();
  return (
    '<div class="plaque" title="Code NAF de l’entreprise"><span class="plaque-l">NAF</span><span class="plaque-c">' + (code ? esc(code) : "— —") + "</span>" +
    (div ? '<span class="plaque-d">' + esc(div.l) + "</span>" : '<button type="button" class="lien" data-act="goto" data-v="profil">Renseigner le code</button>') + "</div>"
  );
}

function sourcesPerimetre(P) {
  const m = {};
  P.forEach((p) => {
    p.dom.sources.forEach((s) => {
      const k = s.url;
      if (!m[k]) m[k] = { nom: s.nom, url: s.url, domaines: [] };
      m[k].domaines.push(p.dom.nom);
    });
  });
  return Object.keys(m)
    .map((k) => m[k])
    .sort((a, b) => b.domaines.length - a.domaines.length || a.nom.localeCompare(b.nom, "fr"));
}

/* Barre empilée : segments séparés par 2 px, valeurs lues dans la légende. */
function barreEmpilee(segments) {
  const total = segments.reduce((n, s) => n + s.v, 0);
  if (!total) return '<div class="empile vide" aria-hidden="true"></div>';
  return (
    '<div class="empile" aria-hidden="true">' +
    segments.filter((s) => s.v > 0).map((s) => '<i style="flex:' + s.v + ";background:" + s.c + '" title="' + esc(s.l) + '"></i>').join("") + "</div>"
  );
}

/* ========================================================== VUE D’ENSEMBLE */
function vueVue() {
  const P = perim();
  const st = statsRegistre();
  const ch = chargeMensuelle(P);
  const t = today();
  const retard = P.filter((p) => p.etat === "retard");
  const moy = P.length ? P.reduce((n, p) => n + p.pct, 0) / P.length : 0;
  const orig = { socle: 0, secteur: 0, activite: 0, manuel: 0 };
  P.forEach((p) => {
    orig[["socle", "secteur", "activite", "manuel"].filter((o) => p.origines.indexOf(o) >= 0)[0] || "socle"]++;
  });

  /* à faire */
  const afaire = [];
  P.filter((p) => p.etat !== "avenir").forEach((p) => afaire.push({ k: "revue", j: p.jours, p: p }));
  S.registre.forEach((r) => {
    if (r.statut === "conforme" || r.statut === "non_applicable" || !r.echeance || !parse(r.echeance)) return;
    const j = diffDays(parse(r.echeance), t);
    if (j <= 7) afaire.push({ k: "action", j: j, r: r });
  });
  afaire.sort((a, b) => a.j - b.j);

  const lignesAfaire = afaire
    .slice(0, 7)
    .map((x) => {
      if (x.k === "revue") {
        return (
          '<li class="af"><span class="af-ic">' + ic("plan") + '</span><div class="af-t"><b>' + esc(x.p.dom.nom) + "</b><small>Revue " + esc(x.p.frequence) + (x.p.responsable ? " · " + esc(x.p.responsable) : "") + "</small>" + pilule(x.p) + "</div>" +
          '<button type="button" class="btn btn-sm" data-act="revue" data-id="' + x.p.id + '">' + ic("check") + "Revue faite</button></li>"
        );
      }
      const r = x.r;
      return (
        '<li class="af"><span class="af-ic">' + ic("registre") + '</span><div class="af-t"><b>' + esc(r.intitule) + "</b><small>" + esc(V.domaines[r.domaine] ? V.domaines[r.domaine].nom : "") + (r.resp ? " · " + esc(r.resp) : "") + "</small>" +
        '<span class="pill ' + (x.j < 0 ? "pill-retard" : x.j === 0 ? "pill-jour" : "pill-avenir") + '">' + (x.j < 0 ? ic("alert") : "") + esc(relRetard(x.j)) + "</span></div>" +
        '<button type="button" class="btn btn-sm btn-quiet" data-act="editEntry" data-id="' + r.id + '">Ouvrir</button></li>'
      );
    })
    .join("");
  const autres = afaire.length > 7 ? '<p class="muted small">+ ' + (afaire.length - 7) + " autres dans le plan et le registre.</p>" : "";

  /* auto-évaluation par famille */
  const famLignes = FAM.map((f) => {
    const items = P.filter((p) => p.dom.famille === f);
    const pct = items.length ? items.reduce((n, p) => n + p.pct, 0) / items.length : null;
    return (
      '<li class="fam-l' + (pct == null ? " vide" : "") + '"><span class="fam-n">' + esc(FAM_COURT[f]) + '</span><span class="fam-b" aria-hidden="true"><i style="width:' + Math.round((pct || 0) * 100) + '%"></i></span><span class="fam-v num">' +
      (pct == null ? "—" : Math.round(pct * 100) + " %") + '</span><span class="fam-c num muted">' + items.length + "</span></li>"
    );
  }).join("");

  /* registre */
  const couleurs = { a_analyser: "var(--st-analyser)", en_cours: "var(--st-cours)", ecart: "var(--st-ecart)", conforme: "var(--st-conforme)", non_applicable: "var(--st-na)" };
  const regSeg = Object.keys(STATUTS).map((k) => ({ v: st.n[k], c: couleurs[k], l: STATUTS[k].l }));
  const regLeg = Object.keys(STATUTS)
    .map((k) => '<li class="st st-' + k + '">' + ic(STATUTS[k].ic) + "<span>" + STATUTS[k].l + '</span><b class="num">' + st.n[k] + "</b></li>")
    .join("");

  /* cycle */
  const nSources = sourcesPerimetre(P).length;
  const cycle = [
    { n: nSources, u: "sources suivies", t: V.etapes[0].t, go: "sources" },
    { n: P.filter((p) => p.etat !== "avenir").length, u: "revues à faire", t: V.etapes[1].t, go: "plan" },
    { n: st.n.a_analyser, u: "textes à analyser", t: V.etapes[2].t, go: "registre" },
    { n: st.adiffuser, u: "points majeurs à transmettre", t: V.etapes[3].t, go: "registre" },
    { n: st.n.en_cours + st.n.ecart, u: "actions ouvertes", t: V.etapes[4].t, go: "registre" },
    { n: P.filter((p) => p.jours > 0 && p.jours <= 7).length, u: "revues sous 7 jours", t: V.etapes[5].t, go: "calendrier" }
  ];

  const sansNaf = !S.profil.division;
  const alerteNaf = sansNaf
    ? '<div class="callout" role="note"><div><b>Ajoutez votre code NAF pour compléter le radar.</b><span>Le socle commun (' + V.transversaux.length + ' domaines) est déjà affiché. Le code NAF ajoute les domaines propres à votre secteur.</span></div><button type="button" class="btn" data-act="goto" data-v="profil">Renseigner le code NAF' + ic("arrow") + "</button></div>"
    : "";

  return (
    entete("Vue d’ensemble", esc(S.profil.entreprise) || "Votre entreprise",
      "Ce qui est surveillé, ce qui est en retard et ce qu’il reste à traiter, sur un seul écran.", plaque()) +
    alerteNaf +
    '<div class="vue"><div class="vue-col">' +
    /* radar */
    '<section class="panel radar-panel" aria-labelledby="t-radar"><div class="panel-head"><h2 id="t-radar">Radar de veille</h2>' +
    '<div class="seg" role="group" aria-label="Affichage"><button type="button" data-act="radarVue" data-v="radar" aria-pressed="' + (UI.radar === "radar") + '">Radar</button><button type="button" data-act="radarVue" data-v="liste" aria-pressed="' + (UI.radar === "liste") + '">Liste</button></div></div>' +
    (UI.radar === "radar"
      ? '<div class="radar-wrap"><div class="radar-scan" aria-hidden="true"></div>' + radarSVG(P) + "</div>" + radarLegende(P) +
        '<p class="note-graph">Plus un point est proche du centre, plus sa revue est fréquente. Les familles se lisent le long du cercle. Un point cerclé d’orange est en retard.</p>'
      : radarListe(P)) +
    "</section>" +
    /* familles */
    '<section class="panel fam-panel" aria-labelledby="t-fam"><div class="panel-head"><h2 id="t-fam">Obligations vérifiées par famille</h2><span class="muted small">domaines</span></div><ul class="fam" aria-label="Avancement par famille de veille">' + famLignes + "</ul></section>" +
    /* registre */
    '<section class="panel reg-panel" aria-labelledby="t-reg"><div class="panel-head"><h2 id="t-reg">Registre des textes</h2><button type="button" class="lien" data-act="goto" data-v="registre">Ouvrir' + ic("arrow") + "</button></div>" +
    (st.total ? barreEmpilee(regSeg) + '<ul class="leg-st">' + regLeg + "</ul>" + (st.retard ? '<p class="alerte-l">' + ic("alert") + st.retard + " " + plural(st.retard, "action dépasse", "actions dépassent") + " son échéance.</p>" : "")
      : '<p class="vide-etat">Aucun texte relevé pour l’instant. Ajoutez le premier depuis le registre.</p>') + "</section>" +
    '</div><div class="vue-col">' +
    /* indicateurs */
    '<div class="kpis">' +
    '<article class="kpi"><h3 class="eyebrow">Sous veille</h3><p class="kpi-n num">' + P.length + '</p><p class="kpi-s">domaines</p><p class="kpi-d">' + orig.socle + " socle · " + orig.secteur + " secteur · " + orig.activite + " activité" + (orig.manuel ? " · " + orig.manuel + " ajouté" + plural(orig.manuel, "", "s") : "") + "</p></article>" +
    '<article class="kpi"><h3 class="eyebrow">Charge estimée</h3><p class="kpi-n num">' + (ch.total ? heures(ch.total).replace(" ", "&nbsp;") : "0") + '</p><p class="kpi-s">par mois</p>' +
    barreEmpilee(FREQ.map((f, i) => ({ v: ch.par[f], c: "var(--f" + (i + 1) + ")", l: V.frequences[f].l }))) +
    '<p class="kpi-d">' + FREQ.filter((f) => ch.par[f] > 0).map((f) => FREQ_ABR[f].toLowerCase().replace(".", "") + " " + heures(ch.par[f])).join(" · ") + "</p></article>" +
    '<article class="kpi ' + (retard.length ? "kpi-alerte" : "kpi-ok") + '"><h3 class="eyebrow">Revues en retard</h3><p class="kpi-n num">' + retard.length + '</p><p class="kpi-s">' + plural(retard.length, "domaine", "domaines") + '</p><p class="kpi-d">' +
    (retard.length ? esc(retard.slice(0, 2).map((p) => p.dom.nom).join(", ")) + (retard.length > 2 ? "…" : "") : ic("check") + " Toutes les revues sont à jour") + "</p></article>" +
    '<article class="kpi"><h3 class="eyebrow">Obligations vérifiées</h3><p class="kpi-n num">' + Math.round(moy * 100) + '<small>%</small></p><p class="kpi-s">auto-évaluation</p><p class="kpi-d">Cochées dans la fiche de chaque domaine. À valider par une personne compétente.</p></article>' +
    "</div>" +
    /* à faire */
    '<section class="panel todo" aria-labelledby="t-todo"><div class="panel-head"><h2 id="t-todo">À traiter cette semaine</h2><span class="muted small num">' + afaire.length + "</span></div>" +
    (afaire.length ? '<ul class="liste-af">' + lignesAfaire + "</ul>" + autres : '<p class="vide-etat">' + ic("check") + "Rien d’urgent. Les prochaines revues sont visibles dans le calendrier.</p>") + "</section>" +
    "</div>" +
    /* cycle */
    '<section class="panel cycle-panel" aria-labelledby="t-cycle"><div class="panel-head"><h2 id="t-cycle">Le cycle de veille, où vous en êtes</h2></div><ol class="cycle">' +
    cycle.map((c, i) => '<li><button type="button" class="cy" data-act="goto" data-v="' + c.go + '"><span class="cy-i mono">' + (i + 1) + '</span><span class="cy-n num">' + c.n + '</span><span class="cy-u">' + esc(c.u) + '</span><span class="cy-t">' + esc(c.t) + "</span></button></li>").join("") +
    "</ol></section>" +
    "</div>"
  );
}

/* ================================================================= PROFIL */
function chercherNaf(q) {
  const brut = String(q || "").trim();
  if (!brut) return [];
  const res = [];
  const complet = brut.toUpperCase().replace(/\s/g, "").match(/^(\d{2})\.?(\d{2})([A-Z])$/);
  if (complet) {
    const d = V.division(complet[1]);
    if (d) res.push({ naf: complet[1] + "." + complet[2] + complet[3], div: d, exact: true });
  }
  const chiffres = brut.replace(/[^0-9]/g, "");
  const mots = norm(brut).replace(/[0-9.]/g, " ").split(/\s+/).filter((m) => m.length > 2);
  V.divisions.forEach((d) => {
    if (res.some((r) => r.div.c === d.c && r.exact)) return;
    let ok = false;
    if (chiffres.length >= 1 && !mots.length) ok = d.c.indexOf(chiffres.slice(0, 2)) === 0;
    else if (mots.length) ok = mots.every((m) => norm(d.l + " " + (V.section(d.s) || {}).l + " " + (V.alias[d.c] || "")).indexOf(m) >= 0);
    if (ok) res.push({ naf: d.c, div: d, exact: false });
  });
  return res.slice(0, 12);
}

function nafResultatsHTML() {
  let liste = [];
  let titre = "";
  if (UI.section) {
    const sec = V.section(UI.section);
    titre = "Section " + sec.c + " · " + sec.l;
    liste = sec.div.map((c) => ({ naf: c, div: V.division(c), exact: false }));
  } else {
    liste = chercherNaf(UI.nafRecherche);
    if (UI.nafRecherche && !liste.length) return '<p class="vide-etat petit">Aucune activité trouvée. Essayez un code à deux chiffres ou un mot du libellé, par exemple « boulangerie » ou « transport ».</p>';
  }
  if (!liste.length) return "";
  return (
    (titre ? '<div class="res-titre"><b>' + esc(titre) + '</b><button type="button" class="lien" data-act="pickSection" data-s="">Fermer</button></div>' : "") +
    '<ul class="resultats" role="listbox" aria-label="Activités correspondantes">' +
    liste.map((r) => '<li><button type="button" class="res' + (r.exact ? " exact" : "") + '" role="option" data-act="pickNaf" data-naf="' + esc(r.naf) + '" data-div="' + r.div.c + '"><span class="res-c mono">' + esc(r.naf) + '</span><span class="res-l">' + esc(r.div.l) + (r.exact ? "<small>Code complet, rattaché à la division " + r.div.c + "</small>" : "") + '</span><span class="res-s mono">' + r.div.s + "</span></button></li>").join("") + "</ul>"
  );
}

function nafCarteHTML() {
  const div = V.division(S.profil.division);
  if (!div) {
    return '<div class="vide-etat">' + ic("search") + "Aucune activité sélectionnée. Le radar ne montre que le socle commun.</div>";
  }
  const sec = V.section(div.s);
  const ids = (V.parDivision[div.c] || []).filter((id) => V.domaines[id]);
  return (
    '<div class="naf-c"><span class="naf-plaque mono">' + esc(nafAffiche()) + '</span><div><h3>' + esc(div.l) + '</h3><p class="muted small">Section ' + sec.c + " · " + esc(sec.l) + " · division " + div.c + "</p></div></div>" +
    (String(S.profil.naf).length <= 2 ? '<p class="note-inline">Vous avez choisi une division. Saisissez le code complet (par exemple ' + esc(div.c) + '.xxY) dans la barre de recherche pour l’afficher tel qu’il figure sur votre Kbis.</p>' : "") +
    '<p class="eyebrow">Domaines rattachés à ce secteur</p>' +
    (ids.length ? '<ul class="chips">' + ids.map((id) => '<li><button type="button" class="chip" data-act="detail" data-id="' + id + '">' + esc(V.domaines[id].nom) + "</button></li>").join("") + "</ul>" : '<p class="muted small">Aucun domaine spécifique : seul le socle commun s’applique.</p>') +
    '<button type="button" class="lien danger-l" data-act="effacerNaf">Retirer ce code</button>'
  );
}

function vueProfil() {
  const P = perim();
  const p = S.profil;
  const secBtns = V.sections
    .map((s) => '<button type="button" class="sec-btn' + (UI.section === s.c ? " on" : "") + '" data-act="pickSection" data-s="' + s.c + '" aria-pressed="' + (UI.section === s.c) + '"><b class="mono">' + s.c + "</b><span>" + esc(SECTION_COURT[s.c] || s.l) + "</span></button>")
    .join("");
  const decl = V.declencheurs
    .map((d) => {
      const on = S.declencheurs.indexOf(d.id) >= 0;
      const noms = d.domaines.filter((id) => V.domaines[id]).map((id) => V.domaines[id].nom);
      return (
        '<label class="decl' + (on ? " on" : "") + '"><input type="checkbox" data-chg="decl" value="' + d.id + '"' + (on ? " checked" : "") + '><span class="sw" aria-hidden="true"></span><span class="decl-t"><b>' + esc(d.q) + "</b><small>" + esc(d.d) + '</small><span class="decl-add">' + esc(noms.slice(0, 2).join(" · ")) + (noms.length > 2 ? " · +" + (noms.length - 2) : "") + "</span></span></label>"
      );
    })
    .join("");
  return (
    entete("Profil & code NAF", "Qui êtes-vous, que faites-vous ?",
      "Le code NAF attribué par l’INSEE (quatre chiffres et une lettre, par exemple <span class=\"mono\">43.99C</span>) donne la base sectorielle. Ses deux premiers chiffres désignent la division, niveau auquel se joue le rattachement réglementaire.", plaque()) +
    '<div class="cols">' +
    '<div class="stack"><section class="panel"><div class="panel-head"><h2>Fiche entreprise</h2></div>' +
    '<div class="champ"><label for="p-entreprise">Entreprise</label><input type="text" id="p-entreprise" data-inp="profil" data-f="entreprise" value="' + esc(p.entreprise) + '" placeholder="Raison sociale" autocomplete="organization"></div>' +
    '<div class="champ"><label for="p-effectif">Effectif</label><select id="p-effectif" data-chg="profil" data-f="effectif">' + optionsSel(EFFECTIFS.map((e) => [e, e]), p.effectif, "Non renseigné") + '</select><p class="aide">L’effectif déclenche des obligations propres : représentation du personnel, accords, déclarations.</p></div>' +
    '<div class="champ"><label for="p-sites">Sites et implantations</label><input type="text" id="p-sites" data-inp="profil" data-f="sites" value="' + esc(p.sites) + '" placeholder="Ex. un siège, un atelier, des chantiers"></div>' +
    '<div class="champ"><label for="p-pilote">Pilote de la veille</label><input type="text" id="p-pilote" data-inp="profil" data-f="pilote" value="' + esc(p.pilote) + '" placeholder="Nom ou fonction"><p class="aide">Une veille sans pilote nommé ne tient pas dans le temps. Ce nom est proposé par défaut dans le plan.</p></div></section>' +
    '<aside class="note"><b>Où trouver votre code NAF ?</b> Sur l’avis de situation INSEE, sur un extrait Kbis ou sur <a href="https://annuaire-entreprises.data.gouv.fr" target="_blank" rel="noopener">l’annuaire des entreprises</a>. Le code déclaré ne fixe pas à lui seul le droit applicable : c’est l’activité réelle qui compte, notamment pour la convention collective.</aside></div>' +
    '<div class="stack"><section class="panel"><div class="panel-head"><h2>Rechercher l’activité</h2></div>' +
    '<div class="champ"><label for="naf-q">Code NAF ou mots de l’activité</label><div class="recherche">' + ic("search") + '<input type="search" id="naf-q" data-inp="naf" value="' + esc(UI.nafRecherche) + '" placeholder="43.99C, 5610, boulangerie, transport…" autocomplete="off" spellcheck="false"></div></div>' +
    '<div id="naf-res" aria-live="polite">' + nafResultatsHTML() + "</div>" +
    '<p class="eyebrow espace">Ou parcourir par section</p><div class="sections">' + secBtns + "</div></section>" +
    '<section class="panel naf-carte" id="naf-carte" aria-live="polite">' + nafCarteHTML() + "</section></div></div>" +
    '<section class="panel" style="margin-top:var(--s-6)"><div class="panel-head"><div><h2>Votre activité réelle</h2><p class="aide">Cochez ce qui correspond au terrain, pas aux statuts. Chaque case ajoute des domaines au plan, quel que soit le code NAF.</p></div>' +
    '<div class="perim-n"><b class="num" id="perim-n">' + P.length + '</b><span>domaines dans le périmètre</span><button type="button" class="btn btn-sm" data-act="goto" data-v="plan">Voir le plan' + ic("arrow") + "</button></div></div>" +
    '<div class="decls">' + decl + "</div></section>"
  );
}

/* ==================================================================== PLAN */
function vuePlan() {
  const Ptous = perim();
  let P = Ptous;
  if (UI.planFam) P = P.filter((p) => p.dom.famille === UI.planFam);
  if (UI.planRetard) P = P.filter((p) => p.etat !== "avenir");
  const nbRetard = Ptous.filter((p) => p.etat === "retard").length;
  const ids = {};
  Ptous.forEach((p) => (ids[p.id] = 1));
  const dispo = Object.keys(V.domaines).filter((id) => !ids[id]).sort((a, b) => V.domaines[a].nom.localeCompare(V.domaines[b].nom, "fr"));
  const pilote = S.profil.pilote || "À désigner";

  const chips =
    '<button type="button" class="filtre' + (!UI.planFam ? " on" : "") + '" data-act="planFam" data-f="" aria-pressed="' + !UI.planFam + '">Toutes <b class="num">' + Ptous.length + "</b></button>" +
    FAM.map((f) => {
      const n = Ptous.filter((p) => p.dom.famille === f).length;
      return n ? '<button type="button" class="filtre' + (UI.planFam === f ? " on" : "") + '" data-act="planFam" data-f="' + f + '" aria-pressed="' + (UI.planFam === f) + '">' + esc(FAM_COURT[f]) + ' <b class="num">' + n + "</b></button>" : "";
    }).join("");

  const lignes = P.map((p) => {
    const classes = "tr-" + p.etat;
    return (
      '<tr class="' + classes + '" data-row="' + p.id + '">' +
      '<td data-l="Domaine" class="td-dom"><button type="button" class="dom-lien" data-act="detail" data-id="' + p.id + '">' + esc(p.dom.nom) + "</button><span class=\"tags\"><span class=\"tag\">" + esc(FAM_COURT[p.dom.famille] || "") + "</span>" + p.origines.map((o) => '<span class="tag tag-o">' + ORIGINES[o] + "</span>").join("") + "</span></td>" +
      '<td data-l="Fréquence"><label class="sr" for="fq-' + p.id + '">Fréquence de ' + esc(p.dom.nom) + '</label><select id="fq-' + p.id + '" class="ctl ctl-sm" data-chg="planField" data-id="' + p.id + '" data-f="frequence">' + optionsSel(FREQ.map((f) => [f, V.frequences[f].l]), p.frequence) + "</select></td>" +
      '<td data-l="Responsable"><label class="sr" for="rp-' + p.id + '">Responsable de ' + esc(p.dom.nom) + '</label><input id="rp-' + p.id + '" class="ctl ctl-sm" type="text" data-chg="planField" data-id="' + p.id + '" data-f="responsable" value="' + esc(p.responsable) + '" placeholder="' + esc(pilote) + '"></td>' +
      '<td data-l="Dernière revue"><label class="sr" for="dr-' + p.id + '">Dernière revue de ' + esc(p.dom.nom) + '</label><input id="dr-' + p.id + '" class="ctl ctl-sm" type="date" data-chg="planField" data-id="' + p.id + '" data-f="derniere" value="' + esc(p.derniere) + '"></td>' +
      '<td data-l="Prochaine revue" class="td-proch"><b class="num">' + esc(fmtCourt(p.echeance)) + "</b> " + pilule(p) + "</td>" +
      '<td class="td-act"><button type="button" class="btn btn-sm' + (p.etat === "avenir" ? " btn-quiet" : "") + '" data-act="revue" data-id="' + p.id + '">' + ic("check") + "Revue faite</button></td></tr>"
    );
  }).join("");

  const exclus = S.exclus.filter((id) => V.domaines[id]);
  return (
    entete("Plan de veille", "Fréquences et responsables",
      "Chaque domaine a un rythme et un nom. La prochaine revue se calcule à partir de la dernière : elle passe en orange dès qu’elle est dépassée. La fréquence proposée vient du référentiel, modifiez-la selon votre risque.",
      '<button type="button" class="btn btn-quiet" data-act="copyPlan">' + ic("copy") + 'Copier pour Excel</button><button type="button" class="btn btn-quiet" data-act="exportPlan">' + ic("download") + "Exporter en CSV</button>") +
    '<div class="barre-outils"><div class="filtres" role="group" aria-label="Filtrer par famille">' + chips + '</div><button type="button" class="filtre filtre-alerte' + (UI.planRetard ? " on" : "") + '" data-act="planRetard" aria-pressed="' + UI.planRetard + '">' + ic("alert") + "À traiter <b class=\"num\">" + Ptous.filter((p) => p.etat !== "avenir").length + "</b></button></div>" +
    (P.length
      ? '<div class="table-wrap"><table class="table plan"><thead><tr><th>Domaine</th><th>Fréquence</th><th>Responsable</th><th>Dernière revue</th><th>Prochaine revue</th><th><span class="sr">Action</span></th></tr></thead><tbody>' + lignes + "</tbody></table></div>"
      : '<p class="vide-etat">' + ic("check") + "Aucun domaine ne correspond à ce filtre.</p>") +
    '<div class="plan-pied"><div class="champ inline"><label for="add-dom">Ajouter un domaine hors périmètre</label><select id="add-dom" class="ctl">' + optionsSel(dispo.map((id) => [id, V.domaines[id].nom]), "", "Choisir un domaine…") + '</select></div><button type="button" class="btn btn-quiet" data-act="addDomain">' + ic("plus") + "Ajouter</button>" +
    '<p class="aide plan-tot">' + Ptous.length + " domaines · " + nbRetard + " en retard · charge estimée " + heures(chargeMensuelle(Ptous).total) + " par mois</p></div>" +
    (exclus.length
      ? '<details class="exclus"><summary>Domaines écartés <b class="num">' + exclus.length + '</b></summary><ul>' + exclus.map((id) => "<li><span>" + esc(V.domaines[id].nom) + '</span><button type="button" class="lien" data-act="restore" data-id="' + id + '">Rétablir</button></li>').join("") + "</ul></details>"
      : "")
  );
}

/* ============================================================== CALENDRIER */
function niveauCharge(min) {
  return min <= 0 ? 0 : min <= 15 ? 1 : min <= 45 ? 2 : min <= 90 ? 3 : 4;
}

function vueCalendrier() {
  const t = today();
  const lundi = addDays(t, -((t.getDay() + 6) % 7));
  const SEM = 8;
  const fin = addDays(lundi, SEM * 7 - 1);
  const map = projeter(fin);
  if (!UI.jour) UI.jour = iso(t);
  const total = (k) => (map[k] ? map[k].revues.reduce((n, r) => n + r.min, 0) : 0);

  let cases = "";
  let semaine = 0;
  let pic = { k: "", min: 0 };
  let sommeSemaine = 0;
  let sommeMois = 0;
  for (let i = 0; i < SEM * 7; i++) {
    const d = addDays(lundi, i);
    const k = iso(d);
    const passe = d < t;
    const m = passe ? 0 : total(k);
    const nAct = map[k] ? map[k].actions.length : 0;
    if (!passe && m > pic.min) pic = { k: k, min: m };
    if (i >= (t.getDay() + 6) % 7 && i < 7) sommeSemaine += m;
    if (!passe && i < 28) sommeMois += m;
    const premier = d.getDate() === 1 || i === 0;
    cases +=
      '<button type="button" class="cal-j l' + niveauCharge(m) + (passe ? " passe" : "") + (k === iso(t) ? " auj" : "") + (k === UI.jour ? " sel" : "") + ([0, 6].indexOf(d.getDay()) >= 0 ? " we" : "") + '" data-act="jour" data-d="' + k + '" aria-pressed="' + (k === UI.jour) + '" aria-label="' + esc(fmtLong(d)) + " : " + (passe ? "passé" : m ? heures(m) + " de revue" : "aucune revue") + (nAct ? ", " + nAct + " échéance" + plural(nAct, "", "s") + " du registre" : "") + '">' +
      '<span class="cal-d num">' + d.getDate() + (premier ? "<em>" + d.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "") + "</em>" : "") + "</span>" +
      (m ? '<span class="cal-m num">' + esc(heuresCourt(m)) + "</span>" : "") +
      (nAct ? '<span class="cal-a" title="' + nAct + ' échéance(s) du registre">' + nAct + "</span>" : "") + "</button>";
    if (i % 7 === 6) semaine++;
  }

  const j = parse(UI.jour);
  const info = map[UI.jour] || { revues: [], actions: [] };
  const minJ = info.revues.reduce((n, r) => n + r.min, 0);
  const detail =
    '<section class="panel jour-detail" aria-live="polite"><div class="panel-head"><h2>' + esc(fmtLong(j)) + '</h2><span class="muted small num">' + (minJ ? heures(minJ) : "libre") + "</span></div>" +
    (j < t ? '<p class="vide-etat petit">Jour passé. Le calendrier projette uniquement les revues à venir.</p>'
      : !info.revues.length && !info.actions.length ? '<p class="vide-etat petit">Aucune revue ni échéance ce jour.</p>'
      : (info.revues.length ? '<h3 class="eyebrow">Revues</h3><ul class="liste-j">' + info.revues.map((r) => '<li><button type="button" class="ligne-dom" data-act="detail" data-id="' + r.id + '"><span class="pastille" style="background:var(--f' + (FREQ.indexOf(r.frequence) + 1) + ')"></span><span class="ld-nom">' + esc(r.nom) + '</span><span class="ld-freq">' + esc(V.frequences[r.frequence].l) + '</span><span class="num muted">' + r.min + " min</span></button></li>").join("") + "</ul>" : "") +
        (info.actions.length ? '<h3 class="eyebrow">Échéances du registre</h3><ul class="liste-j">' + info.actions.map((a) => '<li><button type="button" class="ligne-dom" data-act="editEntry" data-id="' + a.id + '"><span class="pastille sq"></span><span class="ld-nom">' + esc(a.intitule) + '</span><span class="ld-freq">' + esc(a.resp || "Sans responsable") + "</span>" + (a.retard ? '<span class="pill pill-retard">' + ic("alert") + "En retard</span>" : "") + "</button></li>").join("") + "</ul>" : "")) +
    "</section>";

  return (
    entete("Calendrier", "Charge de veille sur huit semaines",
      "Chaque case additionne le temps des revues prévues ce jour-là. Le carré orange signale des échéances du registre. La projection suppose que chaque revue est faite à sa date.") +
    '<div class="cal-kpis"><div class="kpi-mini"><span class="eyebrow">Cette semaine</span><b class="num">' + heures(sommeSemaine) + '</b></div><div class="kpi-mini"><span class="eyebrow">4 prochaines semaines</span><b class="num">' + heures(sommeMois) + '</b></div><div class="kpi-mini"><span class="eyebrow">Jour le plus chargé</span><b class="num">' + (pic.min ? esc(fmtCourt(parse(pic.k))) + " · " + heures(pic.min) : "—") + "</b></div></div>" +
    '<div class="cal-cols"><section class="panel cal-panel"><div class="cal-jours" aria-hidden="true">' + ["L", "M", "M", "J", "V", "S", "D"].map((x) => "<span>" + x + "</span>").join("") + '</div><div class="cal-grille" role="group" aria-label="Calendrier de charge de veille">' + cases + "</div>" +
    '<ul class="cal-leg"><li><i class="l0"></i>Aucune</li><li><i class="l1"></i>15 min max</li><li><i class="l2"></i>45 min max</li><li><i class="l3"></i>1 h 30 max</li><li><i class="l4"></i>Plus</li></ul>' +
    '<p class="note-graph">Durées indicatives par session : quotidienne ' + MINUTES.quotidienne + " min, hebdomadaire " + MINUTES.hebdomadaire + " min, mensuelle " + MINUTES.mensuelle + " min, trimestrielle " + MINUTES.trimestrielle + " min. Le quotidien ne compte que les jours ouvrés.</p></section>" + detail + "</div>"
  );
}

/* ================================================================ REGISTRE */
const filtrerRegistre = () => {
  const q = norm(UI.regTexte);
  return S.registre
    .filter((r) => (!UI.regDomaine || r.domaine === UI.regDomaine) && (!UI.regStatut || r.statut === UI.regStatut) && (!q || norm([r.intitule, r.ref, r.action, r.resp, r.notes, (V.domaines[r.domaine] || {}).nom].join(" ")).indexOf(q) >= 0))
    .sort((a, b) => (a.echeance || "9999").localeCompare(b.echeance || "9999"));
};

function echeanceChip(r) {
  if (!r.echeance || !parse(r.echeance)) return '<span class="ech muted">Sans échéance</span>';
  const j = diffDays(parse(r.echeance), today());
  const ouvert = r.statut !== "conforme" && r.statut !== "non_applicable";
  return '<span class="ech' + (ouvert && j < 0 ? " retard" : "") + '">' + (ouvert && j < 0 ? ic("alert") : ic("clock")) + esc(fmtCourt(parse(r.echeance))) + " · " + esc(ouvert ? relRetard(j) : rel(j)) + "</span>";
}

const niveauPill = (n) => '<span class="niv niv-' + n + '"><i aria-hidden="true"></i>' + NIVEAUX[n] + "</span>";

function carteHTML(r) {
  const dom = V.domaines[r.domaine];
  return (
    '<article class="carte" draggable="true" data-id="' + r.id + '"><button type="button" class="carte-t" data-act="editEntry" data-id="' + r.id + '">' + esc(r.intitule) + "</button>" +
    '<div class="carte-m"><span class="tag">' + esc(dom ? dom.nom : "Sans domaine") + "</span>" + niveauPill(r.niveau) + "</div>" +
    (r.action ? '<p class="carte-a">' + esc(r.action) + "</p>" : "") +
    '<div class="carte-p">' + echeanceChip(r) + (r.resp ? '<span class="resp">' + esc(r.resp) + "</span>" : "") + "</div>" +
    '<div class="carte-f"><label class="sr" for="st-' + r.id + '">Statut de ' + esc(r.intitule) + '</label><select id="st-' + r.id + '" class="ctl ctl-sm" data-chg="statut" data-id="' + r.id + '">' + optionsSel(Object.keys(STATUTS).map((k) => [k, STATUTS[k].l]), r.statut) + "</select>" +
    (r.niveau === "majeur" && !r.diffuse && r.statut !== "non_applicable" ? '<span class="a-diffuser" title="Point majeur pas encore transmis aux services concernés">À transmettre</span>' : "") + "</div></article>"
  );
}

function registreListeHTML() {
  const liste = filtrerRegistre();
  if (!S.registre.length) {
    return '<div class="vide-etat grand">' + ic("registre") + '<b>Le registre est vide.</b><span>Relevez un texte qui vous concerne, qualifiez son impact et nommez un responsable. C’est ce qui prouve votre veille en cas de contrôle.</span><button type="button" class="btn" data-act="newEntry">' + ic("plus") + "Ajouter un premier texte</button></div>";
  }
  if (UI.registre === "table") {
    if (!liste.length) return '<p class="vide-etat">Aucun texte ne correspond à ces filtres.</p>';
    return (
      '<div class="table-wrap"><table class="table reg"><thead><tr><th>Texte</th><th>Domaine</th><th>Niveau</th><th>Échéance</th><th>Responsable</th><th>Statut</th></tr></thead><tbody>' +
      liste.map((r) => '<tr><td data-l="Texte" class="td-dom"><button type="button" class="dom-lien" data-act="editEntry" data-id="' + r.id + '">' + esc(r.intitule) + '</button><small class="muted">' + esc(r.ref || "") + '</small></td><td data-l="Domaine">' + esc((V.domaines[r.domaine] || {}).nom || "—") + '</td><td data-l="Niveau">' + niveauPill(r.niveau) + '</td><td data-l="Échéance">' + echeanceChip(r) + '</td><td data-l="Responsable">' + esc(r.resp || "—") + '</td><td data-l="Statut"><label class="sr" for="st-' + r.id + '">Statut de ' + esc(r.intitule) + '</label><select id="st-' + r.id + '" class="ctl ctl-sm" data-chg="statut" data-id="' + r.id + '">' + optionsSel(Object.keys(STATUTS).map((k) => [k, STATUTS[k].l]), r.statut) + "</select></td></tr>").join("") +
      "</tbody></table></div>"
    );
  }
  return (
    '<div class="kanban" role="group" aria-label="Registre par statut">' +
    Object.keys(STATUTS)
      .map((k) => {
        const col = liste.filter((r) => r.statut === k);
        return (
          '<section class="col col-' + k + '" data-statut="' + k + '" aria-label="' + STATUTS[k].l + '"><h3>' + ic(STATUTS[k].ic) + "<span>" + STATUTS[k].l + '</span><b class="num">' + col.length + '</b></h3><div class="col-liste">' +
          (col.map(carteHTML).join("") || '<p class="col-vide">Déposez une carte ici</p>') + "</div></section>"
        );
      })
      .join("") + "</div>"
  );
}

function vueRegistre() {
  const st = statsRegistre();
  const doms = Object.keys(V.domaines).sort((a, b) => V.domaines[a].nom.localeCompare(V.domaines[b].nom, "fr"));
  return (
    entete("Registre", "Collecter, analyser, décider",
      "Chaque texte relevé est qualifié : applicable ou non, impact financier, juridique ou opérationnel, action, responsable, échéance. Glissez une carte d’une colonne à l’autre pour changer son statut.",
      '<button type="button" class="btn" data-act="newEntry">' + ic("plus") + 'Nouveau texte</button><button type="button" class="btn btn-quiet" data-act="importReg">' + ic("upload") + 'Importer</button><button type="button" class="btn btn-quiet" data-act="copyReg">' + ic("copy") + 'Copier</button><button type="button" class="btn btn-quiet" data-act="exportReg">' + ic("download") + "CSV</button>" +
      '<input type="file" id="import-file" accept=".csv,text/csv" class="sr" tabindex="-1">') +
    '<div class="barre-outils"><div class="champ inline recherche-l"><label class="sr" for="reg-q">Rechercher dans le registre</label><div class="recherche">' + ic("search") + '<input type="search" id="reg-q" data-inp="regTexte" value="' + esc(UI.regTexte) + '" placeholder="Texte, action, responsable…"></div></div>' +
    '<div class="champ inline"><label class="sr" for="reg-dom">Domaine</label><select id="reg-dom" class="ctl" data-chg="regFiltre" data-f="regDomaine">' + optionsSel(doms.map((id) => [id, V.domaines[id].nom]), UI.regDomaine, "Tous les domaines") + "</select></div>" +
    (UI.registre === "table" ? '<div class="champ inline"><label class="sr" for="reg-st">Statut</label><select id="reg-st" class="ctl" data-chg="regFiltre" data-f="regStatut">' + optionsSel(Object.keys(STATUTS).map((k) => [k, STATUTS[k].l]), UI.regStatut, "Tous les statuts") + "</select></div>" : "") +
    '<div class="seg" role="group" aria-label="Affichage du registre"><button type="button" data-act="regVue" data-v="kanban" aria-pressed="' + (UI.registre === "kanban") + '">Colonnes</button><button type="button" data-act="regVue" data-v="table" aria-pressed="' + (UI.registre === "table") + '">Tableau</button></div></div>' +
    (st.adiffuser ? '<p class="bandeau-a">' + ic("alert") + "<span><b>" + st.adiffuser + " " + plural(st.adiffuser, "point majeur", "points majeurs") + "</b> à transmettre aux services concernés.</span></p>" : "") +
    '<div id="reg-liste">' + registreListeHTML() + "</div>"
  );
}

/* ================================================================= SOURCES */
const TYPES_SOURCES = [
  { t: "Sites gouvernementaux", f: "Officielle", d: "Ministères, Légifrance, service-public, INRS, CNIL, ANSSI. La référence pour connaître la règle et la vérifier.", u: "Un site par famille de veille, ajoutés aux favoris et aux alertes." },
  { t: "Publications officielles", f: "Officielle", d: "Journal officiel de la République française et Journal officiel de l’Union européenne. Un texte n’est opposable qu’une fois publié.", u: "Consultation du sommaire chaque jour ouvré pour les domaines en veille quotidienne." },
  { t: "Bulletins d’information", f: "Officielle", d: "Bulletins de doctrine comme le BOSS pour le social et le BOFiP pour le fiscal, et lettres d’information des autorités.", u: "Abonnement e-mail, tri le jour de réception." },
  { t: "Revues spécialisées", f: "Spécialisée", d: "Revues juridiques et techniques de votre métier, fédérations professionnelles, organismes de normalisation. Payantes au besoin.", u: "Priorisées sur les domaines sectoriels et techniques." },
  { t: "Communiqués de presse", f: "Indicative", d: "Annonces des ministères et autorités avant ou autour d’une publication. Utiles pour anticiper, jamais suffisants pour appliquer.", u: "À croiser avec le texte publié avant toute décision." },
  { t: "Réseaux sociaux", f: "Indicative", d: "Comptes officiels des autorités et des fédérations. Rapides, mais non vérifiés lorsqu’ils viennent de tiers.", u: "Signal d’alerte seulement : remonter systématiquement à la source primaire." }
];
const OUTILS = [
  { t: "Tableur", d: "Le plus courant : un fichier qui référence textes, échéances et responsables. Le plan et le registre s’exportent en CSV pour cet usage." },
  { t: "Alertes par e-mail", d: "Proposées par la plupart des sources officielles et spécialisées. Une adresse partagée évite qu’une alerte dépende d’une seule personne." },
  { t: "Flux RSS et agrégateur", d: "Rassemble en un point d’entrée les flux des sources retenues. C’est le gain de temps le plus rentable de la démarche." },
  { t: "Plateforme de veille", d: "Collecte, tri et classement automatisés. Utile au-delà de quelques dizaines de textes par mois, en gardant un expert pour l’analyse." }
];

function sourcesHTML(filtre) {
  const P = perim();
  const q = norm(filtre || "");
  const liste = sourcesPerimetre(P).filter((s) => !q || norm(s.nom + " " + s.domaines.join(" ")).indexOf(q) >= 0);
  if (!liste.length) return '<p class="vide-etat petit">Aucune source ne correspond.</p>';
  return (
    '<ul class="sources">' +
    liste.map((s) => '<li><a class="src" href="' + esc(safeUrl(s.url)) + '" target="_blank" rel="noopener"><span class="src-n">' + esc(s.nom) + ic("external") + '</span><span class="src-u mono">' + esc(s.url.replace(/^https?:\/\/(www\.)?/, "")) + '</span><span class="src-d">' + esc(s.domaines.slice(0, 3).join(" · ")) + (s.domaines.length > 3 ? " · +" + (s.domaines.length - 3) : "") + "</span></a></li>").join("") + "</ul>"
  );
}

function vueSources() {
  const P = perim();
  return (
    entete("Sources", "D’où vient l’information fiable",
      "La qualité de la veille dépend de la qualité des sources. Priorisez l’officiel et le spécialisé, payant au besoin, plutôt que des flux automatiques non vérifiés.") +
    '<section class="panel"><div class="panel-head"><div><h2>Vos sources</h2><p class="aide">' + sourcesPerimetre(P).length + " sources issues des " + P.length + " domaines de votre périmètre, les plus partagées en premier.</p></div>" +
    '<div class="recherche petit">' + ic("search") + '<input type="search" id="src-q" data-inp="src" placeholder="Filtrer les sources" aria-label="Filtrer les sources"></div></div><div id="src-liste">' + sourcesHTML("") + "</div></section>" +
    '<h2 class="titre-section">Six types de sources, six usages</h2><div class="types">' +
    TYPES_SOURCES.map((s) => '<article class="type"><span class="fiab fiab-' + norm(s.f) + '">' + s.f + "</span><h3>" + s.t + "</h3><p>" + s.d + '</p><p class="type-u">' + s.u + "</p></article>").join("") + "</div>" +
    '<h2 class="titre-section">Outils de collecte</h2><div class="types outils">' + OUTILS.map((o) => '<article class="type"><h3>' + o.t + "</h3><p>" + o.d + "</p></article>").join("") + "</div>" +
    '<h2 class="titre-section">Sources générales</h2><ul class="sources">' +
    V.sourcesGenerales.map((s) => '<li><a class="src" href="' + esc(safeUrl(s.url)) + '" target="_blank" rel="noopener"><span class="src-n">' + esc(s.nom) + ic("external") + '</span><span class="src-u mono">' + esc(s.type) + '</span><span class="src-d">' + esc(s.d) + "</span></a></li>").join("") + "</ul>"
  );
}

/* ================================================================ SYNTHÈSE */
function donneesSynthese() {
  const P = perim();
  const st = statsRegistre();
  const ch = chargeMensuelle(P);
  const t = today();
  const retard = P.filter((p) => p.etat === "retard");
  const actionsRetard = S.registre.filter((r) => r.echeance && parse(r.echeance) < t && r.statut !== "conforme" && r.statut !== "non_applicable");
  const adiffuser = S.registre.filter((r) => r.niveau === "majeur" && r.statut !== "non_applicable" && !r.diffuse);
  return { P: P, st: st, ch: ch, t: t, retard: retard, actionsRetard: actionsRetard, adiffuser: adiffuser };
}

function vueSynthese() {
  const D = donneesSynthese();
  const P = D.P;
  const div = V.division(S.profil.division);
  const sec = div && V.section(div.s);
  const parFam = FAM.map((f) => ({ f: f, n: P.filter((p) => p.dom.famille === f).length })).filter((x) => x.n);
  return (
    entete("Synthèse", "Note de veille à diffuser",
      "Le rapport pour la réunion, la direction ou le dossier d’audit. Il se construit seul à partir du plan et du registre.",
      '<button type="button" class="btn" data-act="print">' + ic("print") + 'Imprimer ou enregistrer en PDF</button><button type="button" class="btn btn-quiet" data-act="copySynth">' + ic("copy") + "Copier le texte</button>") +
    '<article class="doc" id="synthese-doc">' +
    '<header class="doc-tete"><p class="eyebrow">Note de veille réglementaire</p><h2>' + (esc(S.profil.entreprise) || "Entreprise non renseignée") + '</h2><p class="doc-meta">' + esc(fmtLong(D.t)) + " · " + (nafAffiche() ? "NAF " + esc(nafAffiche()) + (div ? " · " + esc(div.l) : "") : "code NAF non renseigné") + (S.profil.effectif ? " · " + esc(S.profil.effectif) : "") + (S.profil.pilote ? " · pilote : " + esc(S.profil.pilote) : "") + "</p>" + (S.demo ? '<p class="doc-demo">Données d’exemple.</p>' : "") + "</header>" +
    "<h3>1. Périmètre</h3><p>" + P.length + " domaines sont sous veille" + (sec ? ", dans la section « " + esc(sec.l) + " »" : "") + ". " + parFam.map((x) => x.n + " en veille " + esc(FAM_COURT[x.f].toLowerCase())).join(", ") + ".</p>" +
    "<h3>2. Rythme et charge</h3><div class=\"table-wrap\"><table class=\"table doc-t\"><thead><tr><th>Fréquence</th><th class=\"r\">Domaines</th><th class=\"r\">Charge par mois</th></tr></thead><tbody>" +
    FREQ.map((f) => "<tr><td>" + V.frequences[f].l + '</td><td class="r num">' + P.filter((p) => p.frequence === f).length + '</td><td class="r num">' + (D.ch.par[f] ? heures(D.ch.par[f]) : "—") + "</td></tr>").join("") +
    '<tr class="tot"><td>Total</td><td class="r num">' + P.length + '</td><td class="r num">' + heures(D.ch.total) + "</td></tr></tbody></table></div><p class=\"petit muted\">Charge estimée sur des durées de session indicatives, à ajuster selon votre pratique.</p>" +
    "<h3>3. Points d’attention</h3>" +
    "<h4>Revues en retard (" + D.retard.length + ")</h4>" + (D.retard.length ? "<ul>" + D.retard.map((p) => "<li><b>" + esc(p.dom.nom) + "</b>, " + esc(relRetard(p.jours)) + (p.responsable ? " · " + esc(p.responsable) : "") + "</li>").join("") + "</ul>" : "<p>Aucune.</p>") +
    "<h4>Actions dépassant leur échéance (" + D.actionsRetard.length + ")</h4>" + (D.actionsRetard.length ? "<ul>" + D.actionsRetard.map((r) => "<li><b>" + esc(r.intitule) + "</b>, échéance " + esc(fmtIso(r.echeance)) + (r.resp ? " · " + esc(r.resp) : "") + "</li>").join("") + "</ul>" : "<p>Aucune.</p>") +
    "<h4>Points majeurs à transmettre (" + D.adiffuser.length + ")</h4>" + (D.adiffuser.length ? "<ul>" + D.adiffuser.map((r) => "<li><b>" + esc(r.intitule) + "</b> · " + esc(STATUTS[r.statut] ? STATUTS[r.statut].l : "") + "</li>").join("") + "</ul>" : "<p>Rien en attente.</p>") +
    "<h3>4. Registre</h3><p>" + D.st.total + " " + plural(D.st.total, "texte relevé", "textes relevés") + " : " + Object.keys(STATUTS).map((k) => D.st.n[k] + " " + STATUTS[k].l.toLowerCase()).join(", ") + ".</p>" +
    "<h3>5. Plan de veille</h3><div class=\"table-wrap\"><table class=\"table doc-t\"><thead><tr><th>Domaine</th><th>Fréquence</th><th>Responsable</th><th>Prochaine revue</th></tr></thead><tbody>" +
    P.map((p) => "<tr><td>" + esc(p.dom.nom) + "</td><td>" + esc(p.frequence) + "</td><td>" + esc(p.responsable || S.profil.pilote || "—") + '</td><td class="num">' + esc(fmtCourt(p.echeance)) + (p.etat === "retard" ? " (retard)" : "") + "</td></tr>").join("") + "</tbody></table></div>" +
    "<h3>6. Sources principales</h3><ul>" + sourcesPerimetre(P).slice(0, 8).map((s) => "<li>" + esc(s.nom) + " · " + esc(s.url) + "</li>").join("") + "</ul>" +
    '<p class="doc-limite">Cet outil fournit un cadre méthodologique construit à partir de la nomenclature NAF et de sources publiques. Il ne constitue pas un conseil juridique et ne garantit pas l’exhaustivité du périmètre applicable. Chaque texte doit être vérifié sur Légifrance et l’analyse d’applicabilité validée par une personne compétente.</p></article>'
  );
}

function syntheseTexte() {
  const D = donneesSynthese();
  const div = V.division(S.profil.division);
  const L = [];
  L.push("NOTE DE VEILLE RÉGLEMENTAIRE — " + (S.profil.entreprise || "Entreprise non renseignée"));
  L.push(fmtLong(D.t) + (nafAffiche() ? " · NAF " + nafAffiche() + (div ? " (" + div.l + ")" : "") : ""));
  L.push("");
  L.push("Périmètre : " + D.P.length + " domaines · charge estimée " + heures(D.ch.total) + " par mois");
  L.push("");
  L.push("REVUES EN RETARD (" + D.retard.length + ")");
  D.retard.forEach((p) => L.push("- " + p.dom.nom + " : " + relRetard(p.jours) + (p.responsable ? " (" + p.responsable + ")" : "")));
  L.push("");
  L.push("ACTIONS EN RETARD (" + D.actionsRetard.length + ")");
  D.actionsRetard.forEach((r) => L.push("- " + r.intitule + " : échéance " + fmtIso(r.echeance) + (r.resp ? " (" + r.resp + ")" : "")));
  L.push("");
  L.push("POINTS MAJEURS À TRANSMETTRE (" + D.adiffuser.length + ")");
  D.adiffuser.forEach((r) => L.push("- " + r.intitule));
  L.push("");
  L.push("REGISTRE : " + Object.keys(STATUTS).map((k) => D.st.n[k] + " " + STATUTS[k].l.toLowerCase()).join(", "));
  L.push("");
  L.push("Cadre méthodologique, pas un conseil juridique. Vérifier chaque texte sur Légifrance.");
  return L.join("\n");
}

/* ============================================================= FICHE DOMAINE */
function ficheHTML(id) {
  const dom = V.domaines[id];
  if (!dom) return "";
  const p = perim().filter((x) => x.id === id)[0];
  const dansPerimetre = !!p;
  const plan = S.plan[id] || {};
  const coches = S.checks[id] || [];
  const nCoches = dom.obligations.filter((_, i) => coches[i]).length;
  const entrees = S.registre.filter((r) => r.domaine === id);
  return (
    '<div class="dr-tete"><div><p class="eyebrow">' + esc(V.familles[dom.famille].l) + "</p><h2>" + esc(dom.nom) + '</h2></div><button type="button" class="icone" data-act="closeDrawer" aria-label="Fermer la fiche">' + ic("close") + "</button></div>" +
    '<div class="dr-corps"><p class="dr-resume">' + esc(dom.resume) + "</p>" +
    (dansPerimetre
      ? '<section class="dr-bloc"><div class="dr-ligne"><h3 class="eyebrow">Revue</h3><span data-pill>' + pilule(p) + '</span></div><div class="dr-champs">' +
        '<div class="champ"><label for="d-freq">Fréquence</label><select id="d-freq" class="ctl" data-chg="planField" data-id="' + id + '" data-f="frequence">' + optionsSel(FREQ.map((f) => [f, V.frequences[f].l]), p.frequence) + "</select></div>" +
        '<div class="champ"><label for="d-resp">Responsable</label><input id="d-resp" class="ctl" type="text" data-chg="planField" data-id="' + id + '" data-f="responsable" value="' + esc(p.responsable) + '" placeholder="' + esc(S.profil.pilote || "À désigner") + '"></div>' +
        '<div class="champ"><label for="d-der">Dernière revue</label><input id="d-der" class="ctl" type="date" data-chg="planField" data-id="' + id + '" data-f="derniere" value="' + esc(p.derniere) + '"></div></div>' +
        '<div class="dr-revue"><button type="button" class="btn" id="d-revue" data-act="revue" data-id="' + id + '">' + ic("check") + "Revue faite aujourd’hui</button><span class=\"muted small\" data-proch>Prochaine revue le " + esc(fmtCourt(p.echeance)) + "</span></div></section>"
      : '<section class="dr-bloc"><p class="note-inline">Ce domaine n’est pas dans votre périmètre actuel.</p><button type="button" class="btn" data-act="addDomainId" data-id="' + id + '">' + ic("plus") + "Ajouter au plan de veille</button></section>") +
    '<section class="dr-bloc"><div class="dr-ligne"><h3 class="eyebrow">Obligations à vérifier</h3><span class="num muted small" data-prog>' + nCoches + " / " + dom.obligations.length + '</span></div><div class="barre-prog" aria-hidden="true"><i style="width:' + Math.round((nCoches / dom.obligations.length) * 100) + '%"></i></div><ul class="coches">' +
    dom.obligations.map((o, i) => '<li><label class="coche"><input type="checkbox" data-chg="check" data-id="' + id + '" data-i="' + i + '"' + (coches[i] ? " checked" : "") + '><span class="cb" aria-hidden="true">' + ic("check") + "</span><span>" + esc(o) + "</span></label></li>").join("") + "</ul></section>" +
    '<section class="dr-bloc"><h3 class="eyebrow">Textes de référence</h3><ul class="textes">' + dom.textes.map((x) => "<li>" + esc(x) + "</li>").join("") + "</ul></section>" +
    '<section class="dr-bloc"><h3 class="eyebrow">Nature des impacts</h3><ul class="chips">' + dom.impacts.map((i) => '<li><span class="chip statique">' + esc(V.impactsLabels[i] || i) + "</span></li>").join("") + "</ul></section>" +
    '<section class="dr-bloc"><h3 class="eyebrow">Sources officielles</h3><ul class="sources compact">' + dom.sources.map((s) => '<li><a class="src" href="' + esc(safeUrl(s.url)) + '" target="_blank" rel="noopener"><span class="src-n">' + esc(s.nom) + ic("external") + "</span></a></li>").join("") + "</ul></section>" +
    '<section class="dr-bloc"><div class="dr-ligne"><h3 class="eyebrow">Dans le registre</h3><button type="button" class="lien" data-act="newEntry" data-domaine="' + id + '">' + ic("plus") + "Ajouter un texte</button></div>" +
    (entrees.length ? '<ul class="liste-j">' + entrees.map((r) => '<li><button type="button" class="ligne-dom" data-act="editEntry" data-id="' + r.id + '"><span class="ld-nom">' + esc(r.intitule) + '</span><span class="st st-' + r.statut + '">' + ic(STATUTS[r.statut].ic) + esc(STATUTS[r.statut].l) + "</span></button></li>").join("") + "</ul>" : '<p class="muted small">Aucun texte relevé pour ce domaine.</p>') + "</section>" +
    (dansPerimetre ? '<div class="dr-pied"><button type="button" class="lien danger-l" data-act="exclude" data-id="' + id + '">' + (p.origines.indexOf("manuel") >= 0 ? "Retirer du plan" : "Ce domaine ne me concerne pas") + "</button></div>" : "") + "</div>"
  );
}

/* ================================================================ ÉDITEUR */
function editeurHTML(r) {
  const neuf = !r;
  r = r || { id: "", intitule: "", ref: "", domaine: "", source: "", datePub: "", vigueur: "", niveau: "modere", impacts: [], action: "", resp: "", echeance: "", statut: "a_analyser", diffuse: false, notes: "" };
  const P = perim();
  const doms = Object.keys(V.domaines).sort((a, b) => V.domaines[a].nom.localeCompare(V.domaines[b].nom, "fr"));
  const ids = {};
  P.forEach((p) => (ids[p.id] = 1));
  const opt = (liste) => liste.map((id) => '<option value="' + id + '"' + (id === r.domaine ? " selected" : "") + ">" + esc(V.domaines[id].nom) + "</option>").join("");
  return (
    '<form method="dialog" id="editeur-form" novalidate><div class="dr-tete"><div><p class="eyebrow">' + (neuf ? "Nouvelle entrée" : "Modifier l’entrée") + "</p><h2>" + (neuf ? "Relever un texte" : esc(r.intitule)) + '</h2></div><button type="button" class="icone" data-act="closeEditor" aria-label="Fermer">' + ic("close") + "</button></div>" +
    '<div class="dr-corps"><input type="hidden" id="e-id" value="' + esc(r.id) + '"><div class="form-grille">' +
    '<div class="champ large"><label for="e-intitule">Intitulé du texte ou de l’évolution <span class="req" aria-hidden="true">*</span></label><input type="text" id="e-intitule" class="ctl" value="' + esc(r.intitule) + '" placeholder="Ex. Décret relatif aux vérifications périodiques des appareils de levage" required></div>' +
    '<div class="champ"><label for="e-domaine">Domaine de veille <span class="req" aria-hidden="true">*</span></label><select id="e-domaine" class="ctl" required><option value="">Choisir…</option><optgroup label="Votre périmètre">' + opt(doms.filter((id) => ids[id])) + '</optgroup><optgroup label="Autres domaines">' + opt(doms.filter((id) => !ids[id])) + "</optgroup></select></div>" +
    '<div class="champ"><label for="e-ref">Référence</label><input type="text" id="e-ref" class="ctl" value="' + esc(r.ref) + '" placeholder="Ex. Décret n° … du …"></div>' +
    '<div class="champ large"><label for="e-source">Source (adresse ou nom)</label><input type="text" id="e-source" class="ctl" value="' + esc(r.source) + '" placeholder="https://www.legifrance.gouv.fr/…"></div>' +
    '<div class="champ"><label for="e-pub">Date de publication</label><input type="date" id="e-pub" class="ctl" value="' + esc(r.datePub) + '"></div>' +
    '<div class="champ"><label for="e-vig">Entrée en vigueur</label><input type="date" id="e-vig" class="ctl" value="' + esc(r.vigueur) + '"></div>' +
    '<div class="champ"><label for="e-niveau">Niveau d’impact</label><select id="e-niveau" class="ctl">' + optionsSel(Object.keys(NIVEAUX).map((k) => [k, NIVEAUX[k]]), r.niveau) + "</select></div>" +
    '<div class="champ"><label for="e-statut">Statut</label><select id="e-statut" class="ctl">' + optionsSel(Object.keys(STATUTS).map((k) => [k, STATUTS[k].l]), r.statut) + "</select></div>" +
    '<fieldset class="champ large impacts"><legend>Nature des impacts</legend>' + Object.keys(V.impactsLabels).map((k) => '<label class="pastille-c"><input type="checkbox" name="e-impact" value="' + k + '"' + (r.impacts.indexOf(k) >= 0 ? " checked" : "") + "><span>" + esc(V.impactsLabels[k]) + "</span></label>").join("") + "</fieldset>" +
    '<div class="champ large"><label for="e-action">Action de mise en conformité</label><input type="text" id="e-action" class="ctl" value="' + esc(r.action) + '" placeholder="Ex. Mettre à jour le document unique et former les opérateurs"></div>' +
    '<div class="champ"><label for="e-resp">Responsable</label><input type="text" id="e-resp" class="ctl" value="' + esc(r.resp) + '" placeholder="' + esc(S.profil.pilote || "Nom ou service") + '"></div>' +
    '<div class="champ"><label for="e-ech">Échéance</label><input type="date" id="e-ech" class="ctl" value="' + esc(r.echeance) + '"></div>' +
    '<div class="champ large"><label class="coche"><input type="checkbox" id="e-diffuse"' + (r.diffuse ? " checked" : "") + '><span class="cb" aria-hidden="true">' + ic("check") + '</span><span>Transmis aux services concernés</span></label></div>' +
    '<div class="champ large"><label for="e-notes">Notes d’analyse</label><textarea id="e-notes" class="ctl" rows="3" placeholder="Applicabilité, articles concernés, points à vérifier…">' + esc(r.notes) + "</textarea></div></div>" +
    '<p id="e-erreur" class="erreur" role="alert" hidden></p></div>' +
    '<div class="dr-actions"><button type="submit" class="btn" data-act="saveEntry">' + (neuf ? "Ajouter au registre" : "Enregistrer") + '</button><button type="button" class="btn btn-quiet" data-act="closeEditor">Annuler</button>' +
    (neuf ? "" : '<button type="button" class="btn btn-danger" data-act="delEntry" data-id="' + esc(r.id) + '">' + ic("trash") + "Supprimer</button>") + "</div></form>"
  );
}

const RENDU = { vue: vueVue, profil: vueProfil, plan: vuePlan, calendrier: vueCalendrier, registre: vueRegistre, sources: vueSources, synthese: vueSynthese };
