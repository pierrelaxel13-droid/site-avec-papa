/* ==========================================================================
   Vigie — choix du thème
   --------------------------------------------------------------------------
   Trois états : auto (on suit le système), clair, sombre. Le choix est gardé
   dans le navigateur et appliqué avant le premier rendu, sinon la page
   clignote en clair une fraction de seconde avant de passer au sombre.

   Ce fichier est appelé deux fois : une première fois dans <head> via
   window.PCO_THEME.appliquer(), avant que quoi que ce soit ne s'affiche, et
   une seconde fois en fin de page pour brancher les boutons.
   ========================================================================== */

window.PCO_THEME = (function () {
  "use strict";
  var CLE = "pco-theme";

  function lu() {
    try {
      var v = window.localStorage.getItem(CLE);
      return (v === "light" || v === "dark") ? v : "auto";
    } catch (e) { return "auto"; }   // navigation privée : on reste en auto
  }

  function appliquer(choix) {
    var c = choix || lu();
    var html = document.documentElement;
    if (c === "auto") html.removeAttribute("data-theme");
    else html.setAttribute("data-theme", c);
    return c;
  }

  function choisir(c) {
    try { window.localStorage.setItem(CLE, c); } catch (e) { /* sans effet */ }
    appliquer(c);
    marquer(c);
  }

  function marquer(c) {
    document.querySelectorAll("[data-theme-choix]").forEach(function (b) {
      b.setAttribute("aria-pressed", b.getAttribute("data-theme-choix") === c ? "true" : "false");
    });
  }

  function brancher() {
    var c = lu();
    marquer(c);
    document.querySelectorAll("[data-theme-choix]").forEach(function (b) {
      b.addEventListener("click", function () { choisir(b.getAttribute("data-theme-choix")); });
    });
  }

  return { appliquer: appliquer, brancher: brancher, lu: lu };
})();
