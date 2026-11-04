/* ==========================================================================
   Vigie réglementaire — « Créer l'accès d'un client » : l'aperçu de l'e-mail
   d'invitation suit la saisie, et les trois étapes du haut avancent quand
   l'accès est créé. Rien n'est envoyé d'ici : c'est un simple aperçu.
   ========================================================================== */
(function () {
  "use strict";
  var nom = document.getElementById("nc-nom");
  var mail = document.getElementById("nc-courriel");
  var fait = document.getElementById("nc-fait");
  var cabinet = document.getElementById("nc-cabinet");
  var etapes = document.getElementById("nc-etapes");
  if (!nom || !fait) return;
  function poser(sel, texte) { [].forEach.call(document.querySelectorAll(sel), function (x) { x.textContent = texte; }); }
  function suivre() {
    var n = nom.value.trim() || "Votre client";
    poser("#ap-client, [data-ap-client]", n);
    poser("#ap-courriel", (mail && mail.value.trim()) || "prenom.nom@entreprise.fr");
  }
  nom.addEventListener("input", suivre);
  if (mail) mail.addEventListener("input", suivre);
  function nomCabinet() {
    var t = (cabinet && cabinet.textContent) || "";
    var m = t.match(/«\s*(.+?)\s*»/);
    if (m) poser("#ap-cabinet", m[1]);
  }
  function etape() {
    if (!etapes) return;
    var ok = !fait.hidden;
    [].forEach.call(etapes.children, function (li) {
      var n = li.getAttribute("data-etape");
      li.classList.toggle("fait", ok && n === "1");
      li.classList.toggle("en-cours", ok ? n === "2" : n === "1");
      var p = li.querySelector(".nc-pastille");
      if (p) p.textContent = ok && n === "1" ? "✓" : n;
    });
    if (!ok) suivre();
  }
  if (window.MutationObserver) {
    if (cabinet) new MutationObserver(nomCabinet).observe(cabinet, { childList: true, characterData: true, subtree: true });
    new MutationObserver(etape).observe(fait, { attributes: true, attributeFilter: ["hidden"] });
  }
  nomCabinet(); suivre(); etape();
})();
