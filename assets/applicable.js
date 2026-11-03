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
  }
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
    filtrer();
  });
})();
