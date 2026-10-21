/* ==========================================================================
   Pierrel & Co — comportements de page
   --------------------------------------------------------------------------
   Deux règles tenues partout :
   - sans ce fichier, le site reste complet et lisible. Les décalages de départ
     sont posés ici, jamais dans le HTML ;
   - qui demande moins d'animations n'en reçoit aucune, sans perdre une ligne.
   ========================================================================== */

(function () {
  "use strict";

  var SOBRE = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* --- Barre de navigation : filet et ombre à partir du premier défilement -- */
  function barre() {
    var b = document.querySelector(".bandeau");
    if (!b) return;
    var pose = function () { b.classList.toggle("defile", window.scrollY > 8); };
    pose();
    window.addEventListener("scroll", pose, { passive: true });
  }

  /* --- Révélation en cascade ------------------------------------------------ */
  /* Spécifié par la direction : opacité, léger grossissement, 16 px de montée,
     décalage de 60 ms par élément, et l'état final rendu tout de suite pour qui
     demande moins d'animations. */
  function reveler() {
    if (SOBRE || !("IntersectionObserver" in window)) return;

    var cibles = [];
    [".tete-section", ".carte", ".bloc-domaine", ".question", ".piege", ".reserve",
     ".enveloppe-tableau"].forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (e) {
        if (cibles.indexOf(e) === -1) cibles.push(e);
      });
    });

    var rangs = new Map();
    cibles.forEach(function (e) {
      e.classList.add("arme");
      var r = rangs.get(e.parentElement) || 0;
      rangs.set(e.parentElement, r + 1);
      e.style.transitionDelay = Math.min(r, 6) * 60 + "ms";
    });

    var oeil = new IntersectionObserver(function (entrees) {
      entrees.forEach(function (i) {
        if (!i.isIntersecting) return;
        i.target.classList.add("revele");
        oeil.unobserve(i.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });

    cibles.forEach(function (e) { oeil.observe(e); });
  }

  /* --- Recherche dans l'index des secteurs ---------------------------------- */
  function rechercheSecteurs() {
    var champ = document.getElementById("recherche-secteur");
    var liste = document.getElementById("liste-secteurs");
    if (!champ || !liste) return;

    var entrees = [].slice.call(liste.querySelectorAll("[data-recherche]"));
    var compteur = document.getElementById("compte-secteurs");
    var vide = document.getElementById("aucun-secteur");

    function normalise(s) {
      return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    }

    function filtre() {
      var q = normalise(champ.value.trim());
      var n = 0;
      entrees.forEach(function (e) {
        var ok = !q || normalise(e.getAttribute("data-recherche")).indexOf(q) !== -1;
        e.hidden = !ok;
        if (ok) n++;
      });
      if (compteur) {
        compteur.textContent = n === entrees.length
          ? entrees.length + " secteurs"
          : n + " sur " + entrees.length;
      }
      if (vide) vide.hidden = n !== 0;
      // Les sections de lettre vides disparaissent avec leur contenu.
      liste.querySelectorAll("[data-groupe]").forEach(function (g) {
        g.hidden = !g.querySelector("[data-recherche]:not([hidden])");
      });
    }

    champ.addEventListener("input", filtre);
    filtre();
  }

  /* --- Affiner le périmètre sur une page de secteur -------------------------- */
  function affiner() {
    var hote = document.getElementById("declencheurs");
    if (!hote) return;

    var cases = [].slice.call(hote.querySelectorAll("input[type=checkbox][data-domaines]"));
    var compteur = document.getElementById("compte-domaines");
    var base = Number(document.body.getAttribute("data-domaines-base") || 0);

    function pose() {
      var ajoutes = {};
      cases.forEach(function (c) {
        if (!c.checked) return;
        c.getAttribute("data-domaines").split(" ").forEach(function (id) { ajoutes[id] = true; });
      });

      var n = base;
      document.querySelectorAll("[data-domaine]").forEach(function (bloc) {
        var id = bloc.getAttribute("data-domaine");
        if (bloc.getAttribute("data-origine") !== "declencheur") return;
        var visible = !!ajoutes[id];
        bloc.hidden = !visible;
        if (visible) n++;
      });
      if (compteur) compteur.textContent = n;

      document.querySelectorAll("[data-groupe-frequence]").forEach(function (g) {
        g.hidden = !g.querySelector("[data-domaine]:not([hidden])");
      });
    }

    cases.forEach(function (c) { c.addEventListener("change", pose); });
    pose();
  }

  window.PCO_THEME && window.PCO_THEME.brancher();
  barre();
  reveler();
  rechercheSecteurs();
  affiner();
})();
