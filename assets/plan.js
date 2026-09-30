/* ==========================================================================
   Pierrel & Co — outil « plan de veille »
   --------------------------------------------------------------------------
   Un seul parcours : activité, contexte, plan. Aucun registre, aucun import,
   aucun compte. Les réponses sont conservées dans le navigateur pour qu'un
   rechargement ne fasse pas tout recommencer, et rien de plus.
   ========================================================================== */

(function () {
  "use strict";

  var R = window.REFERENTIEL;
  if (!R) return;

  var CLE = "pco-plan-v1";

  var etat = { metier: null, reponses: [] };

  /* --- Persistance : toujours tolérante à l'échec ------------------------- */
  function lit() {
    try {
      var brut = window.localStorage.getItem(CLE);
      if (!brut) return;
      var o = JSON.parse(brut);
      if (o && typeof o.metier === "string" && R.metier(o.metier)) etat.metier = o.metier;
      if (o && Array.isArray(o.reponses)) {
        etat.reponses = o.reponses.filter(function (id) { return !!R.question(id); });
      }
    } catch (e) {
      /* navigation privée, stockage bloqué : l'outil fonctionne sans mémoire. */
    }
  }

  function ecrit() {
    try {
      window.localStorage.setItem(CLE, JSON.stringify(etat));
    } catch (e) { /* sans effet sur l'utilisation */ }
  }

  /* --- Utilitaires -------------------------------------------------------- */
  function esc(v) {
    return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function pluriel(n, singulier, pluriel_) {
    return n + " " + (n > 1 ? pluriel_ : singulier);
  }

  function element(id) { return document.getElementById(id); }

  /* --- Étape 1 : les métiers --------------------------------------------- */
  function rendMetiers() {
    var hote = element("choix-metiers");
    if (!hote) return;

    hote.innerHTML = R.metiers.map(function (m) {
      var actif = etat.metier === m.id;
      return '<button type="button" class="metier" data-metier="' + esc(m.id) + '"' +
        ' aria-pressed="' + (actif ? "true" : "false") + '">' +
        '<span class="nom">' + esc(m.nom) + "</span>" +
        (m.naf ? '<span class="naf">NAF : ' + esc(m.naf) + "</span>" : "") +
        '<span class="exemples">' + esc(m.exemples) + "</span>" +
        "</button>";
    }).join("");

    hote.querySelectorAll("[data-metier]").forEach(function (b) {
      b.addEventListener("click", function () {
        var id = b.getAttribute("data-metier");
        etat.metier = (etat.metier === id) ? null : id;
        ecrit();
        rendMetiers();
        rendPlan();
      });
    });
  }

  /* --- Étape 2 : le contexte --------------------------------------------- */
  function rendQuestions() {
    var hote = element("liste-questions");
    if (!hote) return;

    hote.innerHTML = R.questions.map(function (q) {
      var coche = etat.reponses.indexOf(q.id) !== -1;
      return "<li>" +
        '<label class="question">' +
        '<input type="checkbox" data-question="' + esc(q.id) + '"' + (coche ? " checked" : "") + ">" +
        "<span>" +
        '<span class="intitule">' + esc(q.q) + "</span>" +
        '<span class="aide">' + esc(q.d) + "</span>" +
        "</span></label></li>";
    }).join("");

    hote.querySelectorAll("[data-question]").forEach(function (c) {
      c.addEventListener("change", function () {
        var id = c.getAttribute("data-question");
        var i = etat.reponses.indexOf(id);
        if (c.checked && i === -1) etat.reponses.push(id);
        if (!c.checked && i !== -1) etat.reponses.splice(i, 1);
        ecrit();
        rendPlan();
      });
    });
  }

  /* --- Étape 3 : le plan -------------------------------------------------- */
  function rendPlan() {
    var sortie = element("sortie-plan");
    var actions = element("actions");
    if (!sortie) return;

    if (!etat.metier) {
      sortie.innerHTML = '<p class="etat-vide">Choisissez une activité à l\'étape 1 : ' +
        "votre plan se construit au fur et à mesure.</p>";
      if (actions) actions.hidden = true;
      majEnteteImpression(null);
      document.dispatchEvent(new CustomEvent("plan:rendu"));
      return;
    }

    var m = R.metier(etat.metier);
    var p = R.plan(etat.metier, etat.reponses);

    var html = '<div class="resume-plan">' +
      // Le chiffre est une redite visuelle de la phrase qui suit. Il est retiré
      // de l'arbre d'accessibilité : la zone est en aria-live, et le compteur
      // animé y ferait annoncer chaque valeur intermédiaire.
      '<span class="chiffre" aria-hidden="true">' + p.nombre + "</span>" +
      '<span class="detail"><strong>' + esc(pluriel(p.nombre, "domaine à surveiller", "domaines à surveiller")) +
      "</strong><br>" + esc(m.nom) +
      (etat.reponses.length ? " — " + esc(pluriel(etat.reponses.length, "précision de contexte", "précisions de contexte")) : "") +
      "</span></div>";

    html += p.groupes.map(function (g) {
      return '<section class="groupe">' +
        '<div class="groupe-tete"><h3>' + esc(g.frequence.l) + "</h3>" +
        '<span class="aide">' + esc(g.frequence.d) + "</span></div>" +
        g.entrees.map(rendDomaine).join("") +
        "</section>";
    }).join("");

    sortie.innerHTML = html;
    if (actions) actions.hidden = false;
    majEnteteImpression(m);
    // assets/motion.js écoute cet événement pour rebrancher le dépliage animé,
    // la cascade et le compteur. L'outil fonctionne si personne n'écoute.
    document.dispatchEvent(new CustomEvent("plan:rendu"));
  }

  function rendDomaine(entree) {
    var d = entree.domaine;
    return '<details class="domaine">' +
      "<summary><span><span class=" + '"domaine-nom"' + ">" + esc(d.nom) + "</span>" +
      '<span class="domaine-resume">' + esc(d.resume) + "</span></span></summary>" +
      '<div class="repli">' +
      '<div class="domaine-corps">' +
        "<div><h4>Ce qu'il faut tenir</h4><ul>" +
          d.obligations.map(function (o) { return "<li>" + esc(o) + "</li>"; }).join("") +
        "</ul></div>" +
        "<div><h4>Textes de référence</h4><ul>" +
          d.textes.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") +
        "</ul>" +
        "<h4 style=" + '"margin-top:18px;"' + ">Sources officielles</h4>" +
        '<ul class="sources-domaine">' +
          d.sources.map(function (s) {
            return "<li><a href=" + '"' + esc(s.url) + '"' + ' target="_blank" rel="noopener">' +
              esc(s.nom) + "</a></li>";
          }).join("") +
        "</ul></div>" +
      "</div>" +
      '<div class="raisons" style="padding-bottom:18px;">' +
        entree.raisons.map(function (r) { return '<span class="raison">' + esc(r) + "</span>"; }).join("") +
      "</div>" +
      "</div>" +
      "</details>";
  }

  /* --- En-tête de la feuille imprimée ------------------------------------ */
  function majEnteteImpression(m) {
    var cible = element("impression-details");
    if (!cible) return;
    if (!m) { cible.textContent = ""; return; }

    var d = new Date();
    var date = d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    var contexte = etat.reponses.map(function (id) {
      var q = R.question(id);
      return q ? q.q.toLowerCase() : null;
    }).filter(Boolean);

    cible.textContent = m.nom + " — établi le " + date +
      (contexte.length ? ". Contexte retenu : " + contexte.join(" ; ") + "." : ".") +
      " Pierrel & Co — cadre méthodologique, ne constitue pas un conseil juridique.";
  }

  /* --- Actions ------------------------------------------------------------ */
  function branche() {
    var imprimer = element("bouton-imprimer");
    if (imprimer) imprimer.addEventListener("click", function () { window.print(); });

    var reset = element("bouton-reset");
    if (reset) reset.addEventListener("click", function () {
      etat = { metier: null, reponses: [] };
      try { window.localStorage.removeItem(CLE); } catch (e) { /* rien à faire */ }
      rendMetiers();
      rendQuestions();
      rendPlan();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  lit();
  rendMetiers();
  rendQuestions();
  rendPlan();
  branche();
})();
