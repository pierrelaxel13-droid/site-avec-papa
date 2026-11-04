/* ==========================================================================
   Vigie réglementaire — « Créer l'accès d'un client » : les trois étapes du
   panneau de gauche avancent quand l'accès est créé, et reviennent au début
   pour « Créer un autre client ».
   ========================================================================== */
(function () {
  "use strict";
  var fait = document.getElementById("nc-fait");
  var etapes = document.getElementById("nc-etapes");
  if (!fait || !etapes) return;
  function etape() {
    var ok = !fait.hidden;
    [].forEach.call(etapes.children, function (li) {
      var n = li.getAttribute("data-etape");
      li.classList.toggle("fait", ok && n === "1");
      li.classList.toggle("en-cours", ok ? n === "2" : n === "1");
      var p = li.querySelector(".nc-pastille");
      if (p) p.textContent = ok && n === "1" ? "✓" : n;
    });
  }
  if (window.MutationObserver) new MutationObserver(etape).observe(fait, { attributes: true, attributeFilter: ["hidden"] });
  etape();
})();
