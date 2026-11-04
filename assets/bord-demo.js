/* ==========================================================================
   Vigie — le tableau de bord de la démonstration (4 novembre 2026)
   --------------------------------------------------------------------------
   Les cinq carrés, calculés comme dans un compte (assets/espace.js) : les
   textes à partir de la cloche (PCO_AVIS), les actions à partir du plan
   d'actions gardé dans ce navigateur. Dans un compte, rien à faire ici.
   ========================================================================== */
(function () {
  "use strict";
  var M = window.MAGASIN;
  var hote = document.getElementById("bord-demo");
  if (!M || !hote || M.mode === "compte") return;
  function pose(cle, valeur) {
    var e = hote.querySelector('[data-bord="' + cle + '"]');
    if (e) e.textContent = valeur;
  }
  function peindre() {
    var c = window.PCO_AVIS && window.PCO_AVIS.chiffres ? window.PCO_AVIS.chiffres() : null;
    var nb = function (x) { return x == null ? "—" : x; };
    pose("nouveaux", nb(c && c.nouveaux));
    pose("publies", nb(c && c.publies));
    pose("applicables", nb(c && c.applicables));
    pose("lus", nb(c && c.lus));
    pose("lus-sur", c ? "sur " + c.applicables + " applicables" : "");
    var pa = M.planActions ? M.planActions() : {}, auj = new Date().toISOString().slice(0, 10), n = 0, retard = 0;
    Object.keys(pa).forEach(function (k) {
      if (pa[k].etat !== "ouverte") return;
      n++;
      if (pa[k].echeance && pa[k].echeance < auj) retard++;
    });
    pose("actions", n);
    pose("retard", retard ? "dont " + retard + " en retard" : "");
    hote.querySelector('[data-bord-carre="actions"]').classList.toggle("alerte", retard > 0);
  }
  M.quandPret(peindre);
  window.addEventListener("pco-lus", function () { if (M.pret) peindre(); });
  window.addEventListener("load", function () { M.quandPret(function () { window.setTimeout(peindre, 0); }); });
})();
