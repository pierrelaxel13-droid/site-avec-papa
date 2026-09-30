/* ==========================================================================
   Pierrel & Co — mouvement
   --------------------------------------------------------------------------
   Tout le mouvement piloté par script. Trois règles tenues d'un bout à l'autre :

   1. Sans ce fichier, le site est complet et lisible. Les décalages de départ
      sont posés ici, jamais dans le HTML : si le script ne se charge pas, rien
      n'est caché.
   2. Qui demande moins d'animations n'en reçoit aucune, et le contenu ne change
      pas pour autant.
   3. Rien d'animé en dehors de transform, opacity et de la hauteur d'un bloc
      qu'on déplie.
   ========================================================================== */

(function () {
  "use strict";

  var SOBRE = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var SORTIE = "cubic-bezier(0.16, 1, 0.3, 1)";

  /* --- 1. Révélation à l'approche ----------------------------------------- */
  /* On arme le décalage puis on l'enlève à l'entrée dans l'écran. Les éléments
     d'une même rangée partent en cascade courte, pour qu'on lise un ordre. */
  function reveler() {
    if (SOBRE || !("IntersectionObserver" in window)) return;

    var cibles = [];
    [".tete-section", ".carte", ".carte-sobre", ".etape", ".fiche",
     ".enveloppe-tableau", ".coordonnees", ".reserve", ".resume-plan"]
      .forEach(function (sel) {
        document.querySelectorAll(sel).forEach(function (e) {
          if (e.closest(".heros")) return;          // le héros a sa propre entrée
          if (cibles.indexOf(e) === -1) cibles.push(e);
        });
      });

    var rangs = new Map();
    cibles.forEach(function (e) {
      e.classList.add("arme");
      var parent = e.parentElement;
      var rang = rangs.get(parent) || 0;
      rangs.set(parent, rang + 1);
      e.style.transitionDelay = Math.min(rang, 5) * 70 + "ms";
    });

    var oeil = new IntersectionObserver(function (entrees) {
      entrees.forEach(function (i) {
        if (!i.isIntersecting) return;
        i.target.classList.add("revele");
        oeil.unobserve(i.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });

    cibles.forEach(function (e) { oeil.observe(e); });
  }

  /* --- 2. Barre de navigation --------------------------------------------- */
  function barre() {
    var bandeau = document.querySelector(".bandeau");
    if (!bandeau) return;
    var pose = function () { bandeau.classList.toggle("defile", window.scrollY > 8); };
    pose();
    window.addEventListener("scroll", pose, { passive: true });
  }

  /* --- 3. Dépliage d'un domaine ------------------------------------------- */
  /* <details> ne s'anime pas tout seul : le contenu est retiré du rendu dès que
     l'attribut open tombe. On anime donc la hauteur réelle du bloc, et on ne
     retire open qu'une fois l'animation finie. */
  function deplier(racine) {
    racine.querySelectorAll("details.domaine").forEach(function (d) {
      if (d.dataset.anime) return;
      d.dataset.anime = "1";

      var resume = d.querySelector("summary");
      var repli = d.querySelector(".repli");
      if (!resume || !repli || SOBRE || !repli.animate) return;

      resume.addEventListener("click", function (e) {
        e.preventDefault();
        if (d.dataset.enCours) return;
        d.dataset.enCours = "1";

        var ouvre = !d.open;
        if (ouvre) d.open = true;
        var h = repli.scrollHeight;

        var anim = repli.animate(
          ouvre
            ? [{ height: "0px", opacity: 0 }, { height: h + "px", opacity: 1 }]
            : [{ height: h + "px", opacity: 1 }, { height: "0px", opacity: 0 }],
          { duration: ouvre ? 340 : 240, easing: ouvre ? SORTIE : "cubic-bezier(0.4,0,0.2,1)" }
        );

        anim.onfinish = function () {
          if (!ouvre) d.open = false;
          delete d.dataset.enCours;
        };
      });
    });
  }

  /* --- 4. Le compteur du plan ---------------------------------------------- */
  var dernierNombre = null;

  function compte(cible) {
    var vise = parseInt(cible.textContent, 10);
    if (isNaN(vise)) return;

    if (SOBRE || dernierNombre === null || dernierNombre === vise) {
      dernierNombre = vise;
      return;
    }

    var depart = dernierNombre;
    var t0 = performance.now();
    var duree = 420;
    dernierNombre = vise;

    var resume = cible.closest(".resume-plan");
    if (resume) {
      resume.classList.add("bat");
      setTimeout(function () { resume.classList.remove("bat"); }, 200);
    }

    (function pas(t) {
      var p = Math.min(1, (t - t0) / duree);
      var adouci = 1 - Math.pow(1 - p, 3);
      cible.textContent = Math.round(depart + (vise - depart) * adouci);
      if (p < 1) requestAnimationFrame(pas);
      else cible.textContent = vise;
    })(t0);
  }

  /* --- 5. Cascade du plan --------------------------------------------------- */
  /* Le plan est réécrit à chaque clic : on repose les retards à chaque rendu,
     pour que le lecteur voie le classement se faire. */
  function cascade() {
    if (SOBRE) return;
    var retard = 0;
    document.querySelectorAll("#sortie-plan .groupe").forEach(function (g, i) {
      g.style.animationDelay = (60 + i * 70) + "ms";
      g.querySelectorAll(".domaine").forEach(function (d, j) {
        d.style.animationDelay = (90 + i * 70 + j * 32) + "ms";
        retard = Math.max(retard, 90 + i * 70 + j * 32);
      });
    });
    return retard;
  }

  /* --- Mise en route -------------------------------------------------------- */
  function surRendu() {
    var sortie = document.getElementById("sortie-plan");
    if (!sortie) return;
    deplier(sortie);
    cascade();
    var chiffre = sortie.querySelector(".resume-plan .chiffre");
    if (chiffre) compte(chiffre);
    else dernierNombre = null;                 // plan vidé : on repart de zéro
  }

  barre();
  reveler();
  document.addEventListener("plan:rendu", surRendu);
  surRendu();
})();
