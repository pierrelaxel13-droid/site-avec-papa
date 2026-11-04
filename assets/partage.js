/* Vigie réglementaire — partager le site (4 novembre 2026).
   « Copier le lien » met l'adresse dans le presse-papiers ; « Partager »
   (téléphone surtout) ouvre le partage du système. Rien d'autre. */
(function () {
  "use strict";
  var etat = document.querySelector(".partage-etat");
  function dire(t) { if (etat) etat.textContent = t; }
  [].forEach.call(document.querySelectorAll("[data-copier-lien]"), function (b) {
    b.addEventListener("click", function () {
      var url = b.getAttribute("data-copier-lien");
      (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject())
        .then(function () { dire("Lien copié."); })
        .catch(function () { dire("Adresse du site : " + url); });
    });
  });
  if (navigator.share) {
    [].forEach.call(document.querySelectorAll("[data-partage-natif]"), function (li) { li.hidden = false; });
    [].forEach.call(document.querySelectorAll("[data-partager]"), function (b) {
      b.addEventListener("click", function () {
        navigator.share({ title: document.title, text: b.getAttribute("data-texte") || "", url: b.getAttribute("data-partager") })
          .catch(function () {});
      });
    });
  }
})();
