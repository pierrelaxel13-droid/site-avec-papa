/* ==========================================================================
   Vigie — Mon plan : « Les textes de votre plan »
   --------------------------------------------------------------------------
   1. La colonne « Applicable » (3 novembre 2026) : Oui ou Non pour chaque
      texte. C'est la qualification du relevé (MAGASIN.qualifier) : « Oui »
      = « S'applique chez nous », « Non » = « Ne nous concerne pas ». Dans un
      compte, chaque choix s'inscrit, daté, au registre ; dans la
      démonstration, il reste dans le navigateur.
   2. Le filtre par catégorie : n'afficher que les textes d'une catégorie.
      Il cache par une classe, pas par « hidden » : « hidden » dit si le texte
      est dans le plan (assets/entreprise.js), et les deux se combinent.
   ========================================================================== */
(function () {
  "use strict";
  var M = window.MAGASIN;
  var table = document.querySelector(".tableau-textes-plan");
  if (!M || !table) return;
  var lignes = [].slice.call(table.querySelectorAll("tbody tr"));
  var STATUTS = { applicable: "Oui", sans_objet: "Non", a_suivre: "À suivre" };

  function jour(d) {
    if (!d) return "";
    var t = Date.parse(String(d).slice(0, 10) + "T12:00:00");
    return isNaN(t) ? d : new Date(t).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  }

  /* --- Le filtre par catégorie ---------------------------------------------- */
  var filtre = document.getElementById("filtre-categorie");
  var compte = document.getElementById("filtre-compte");
  function filtrer() {
    var cat = filtre ? filtre.value : "";
    var n = 0;
    lignes.forEach(function (tr) {
      var garde = !cat || [].some.call(tr.querySelectorAll(".categorie-texte[data-cat]"), function (s) {
        return !s.hidden && s.getAttribute("data-cat") === cat;
      });
      tr.classList.toggle("hors-filtre", !garde);
      if (garde && !tr.hidden) n++;
    });
    if (compte) compte.textContent = n + " texte" + (n > 1 ? "s" : "");
    carres();
  }

  /* Les carrés par catégorie : le nombre de textes du plan dans chacune (un
     texte de deux catégories compte dans les deux) ; un clic filtre. */
  function carres() {
    var cat = filtre ? filtre.value : "";
    [].forEach.call(document.querySelectorAll(".carre-categorie"), function (b) {
      var c = b.getAttribute("data-filtre-cat"), n = 0;
      lignes.forEach(function (tr) {
        if (!tr.hidden && [].some.call(tr.querySelectorAll('.categorie-texte[data-cat="' + c + '"]'), function (s) { return !s.hidden; })) n++;
      });
      b.querySelector("[data-n-cat]").textContent = n;
      b.querySelector(".precision").textContent = "texte" + (n > 1 ? "s" : "");
      b.setAttribute("aria-pressed", cat === c ? "true" : "false");
      b.disabled = !n;
    });
  }
  [].forEach.call(document.querySelectorAll(".carre-categorie"), function (b) {
    b.addEventListener("click", function () {
      if (!filtre) return;
      var c = b.getAttribute("data-filtre-cat");
      filtre.value = filtre.value === c ? "" : c;   // un second clic remet toutes les catégories
      filtrer();
    });
  });
  if (filtre) filtre.addEventListener("change", filtrer);
  // Le plan peut changer après coup (réglages lus depuis la base) : on recompte.
  window.addEventListener("pco-plan", filtrer);

  /* --- La colonne « Applicable » -------------------------------------------- */
  function peindre(tr) {
    var q = M.qualifications()[tr.getAttribute("data-cle")];
    var sel = tr.querySelector(".applicable"), etat = tr.querySelector(".applicable-etat");
    sel.value = q && (q.statut === "applicable" || q.statut === "sans_objet") ? q.statut : "";
    sel.setAttribute("data-statut", sel.value);
    etat.textContent = q ? (q.statut === "a_suivre" ? "À suivre, " : "") + "le " + jour(q.le) : "";
  }

  M.quandPret(function () {
    var lecture = M.mode === "compte" && M.espace && (!M.espace.ecrit || M.espace.rang < 2);
    lignes.forEach(function (tr) {
      var sel = tr.querySelector(".applicable");
      if (!sel) return;
      peindre(tr);
      if (lecture) { sel.disabled = true; return; }
      sel.addEventListener("change", function () {
        if (!sel.value) { peindre(tr); return; }   // « À décider » ne s'enregistre pas : le registre ne s'efface pas
        var etat = tr.querySelector(".applicable-etat");
        sel.disabled = true;
        etat.textContent = "Enregistrement…";
        M.qualifier(tr.getAttribute("data-cle"), tr.getAttribute("data-objet"), sel.value).then(function (r) {
          sel.disabled = false;
          if (!r.ok) { etat.textContent = r.erreur || "Impossible d'enregistrer."; return; }
          peindre(tr);
        });
      });
    });
    lus();
    filtrer();
  });

  /* --- La colonne « Lu » et la mention « Nouveau texte » (3 novembre 2026) --
     Même mémoire que la cloche (assets/avis.js) : cocher, c'est avoir lu ;
     décocher, c'est le remettre en attente. Le nombre de textes du plan pas
     encore lus est dit sous le titre. */
  var A = window.PCO_AVIS;
  function attente() {
    var n = 0;
    lignes.forEach(function (tr) {
      var c = tr.querySelector(".lu");
      if (c && !tr.hidden && !c.checked) n++;
    });
    var p = document.getElementById("textes-attente");
    if (p) p.textContent = n ? "Vous avez " + n + " texte" + (n > 1 ? "s" : "") + " en attente de lecture : cochez « Lu » une fois pris connaissance."
      : "Vous avez pris connaissance de tous les textes de votre plan.";
  }
  function peindreLu(tr) {
    var c = tr.querySelector(".lu"), k = tr.getAttribute("data-cle");
    if (!c || !A || !A.estLu) return;
    c.checked = A.estLu(k);
    tr.classList.toggle("texte-lu", c.checked);
    var m = tr.querySelector(".marque-nouveau");
    if (m) m.hidden = !A.estNouveau(k);
  }
  function lus() {
    lignes.forEach(function (tr) {
      var c = tr.querySelector(".lu");
      if (!c) return;
      peindreLu(tr);
      if (c.hasAttribute("data-ecoute")) return;
      c.setAttribute("data-ecoute", "");
      c.addEventListener("change", function () {
        A.marquerLu(tr.getAttribute("data-cle"), c.checked);
        peindreLu(tr); attente();
      });
    });
    attente();
  }
  window.addEventListener("pco-plan", function () { if (M.pret) attente(); });
  // La cloche a chargé (ou changé) les textes lus : on repeint la colonne.
  window.addEventListener("pco-lus", function () { if (M.pret) lus(); });
  // Et une fois la page entièrement chargée, quel que soit l'ordre des scripts.
  window.addEventListener("load", function () { M.quandPret(function () { window.setTimeout(lus, 0); }); });
})();
