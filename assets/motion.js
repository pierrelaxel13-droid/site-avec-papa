/* ==========================================================================
   Pierrel & Co — mouvement
   --------------------------------------------------------------------------
   Trois règles tenues d'un bout à l'autre :

   1. Sans ce fichier, le site est complet et lisible. Les décalages de départ
      sont posés ici, jamais dans le HTML : une panne de chargement ne cache
      rien.
   2. Qui demande moins d'animations n'en reçoit aucune, et ne perd pas une
      ligne de contenu au passage.
   3. Rien d'animé en dehors de transform, opacity et de la hauteur d'un bloc
      qu'on déplie. Le reste fait ramer les téléphones.
   ========================================================================== */

(function () {
  "use strict";

  var SOBRE = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var FIN = window.matchMedia && window.matchMedia("(pointer: fine)").matches;
  var SORTIE = "cubic-bezier(0.16, 1, 0.3, 1)";
  var el = function (id) { return document.getElementById(id); };

  /* --- 1. Le titre, mot à mot --------------------------------------------- */
  function mots() {
    document.querySelectorAll("[data-mots]").forEach(function (titre) {
      var brut = titre.textContent.trim().split(/\s+/);
      titre.textContent = "";
      brut.forEach(function (mot, i) {
        var boite = document.createElement("span");
        boite.className = "mot" + (SOBRE ? "" : " arme-mot");
        var interne = document.createElement("span");
        interne.textContent = mot;
        interne.style.transitionDelay = (i * 65) + "ms";
        boite.appendChild(interne);
        titre.appendChild(boite);
        if (i < brut.length - 1) titre.appendChild(document.createTextNode(" "));
      });
      if (SOBRE) return;
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          titre.querySelectorAll(".mot").forEach(function (m) { m.classList.add("leve"); });
        });
      });
    });
  }

  /* --- 2. Entrée du héros --------------------------------------------------- */
  function entree() {
    if (SOBRE) return;
    var pieces = document.querySelectorAll("[data-monte]");
    pieces.forEach(function (p, i) {
      p.classList.add("arme");
      p.style.transitionDelay = (260 + i * 110) + "ms";
    });
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        pieces.forEach(function (p) { p.classList.add("revele"); });
      });
    });
  }

  /* --- 3. Révélation à l'approche ------------------------------------------- */
  function reveler() {
    if (SOBRE || !("IntersectionObserver" in window)) return;

    var cibles = [];
    [".tete-section", ".carte", ".etape", ".enveloppe-tableau", ".coordonnees",
     ".reserve", ".calendrier", ".diagramme"].forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (e) {
        if (e.closest(".heros") || e.closest(".recit")) return;
        if (cibles.indexOf(e) === -1) cibles.push(e);
      });
    });

    var rangs = new Map();
    cibles.forEach(function (e) {
      e.classList.add("arme");
      var r = rangs.get(e.parentElement) || 0;
      rangs.set(e.parentElement, r + 1);
      e.style.transitionDelay = Math.min(r, 5) * 90 + "ms";
    });

    var oeil = new IntersectionObserver(function (entrees) {
      entrees.forEach(function (i) {
        if (!i.isIntersecting) return;
        i.target.classList.add("revele");
        oeil.unobserve(i.target);
      });
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.06 });

    cibles.forEach(function (e) { oeil.observe(e); });
  }

  /* --- 4. Le récit au défilement --------------------------------------------- */
  /* La piste fait plusieurs hauteurs d'écran ; le bloc reste collé et c'est la
     position dans la piste qui décide de l'étape affichée. Aucune bibliothèque :
     une règle de trois sur le rectangle de la piste suffit. */
  function recit() {
    var piste = document.querySelector(".recit-piste");
    if (!piste) return;

    var etapes = [].slice.call(piste.querySelectorAll(".recit-etape"));
    var jauge = piste.querySelector(".recit-jauge span");
    if (!etapes.length) return;

    if (SOBRE) {
      etapes.forEach(function (e) { e.classList.add("active"); });
      return;
    }

    var enCours = -1;
    var attente = false;

    function pose() {
      var r = piste.getBoundingClientRect();
      var course = r.height - window.innerHeight;
      var avance = course > 0 ? Math.min(1, Math.max(0, -r.top / course)) : 0;

      if (jauge) jauge.style.width = (avance * 100).toFixed(1) + "%";

      var i = Math.min(etapes.length - 1, Math.floor(avance * etapes.length * 0.999));
      if (i === enCours) return;
      enCours = i;
      etapes.forEach(function (e, j) { e.classList.toggle("active", j === i); });
    }

    window.addEventListener("scroll", function () {
      if (attente) return;
      attente = true;
      requestAnimationFrame(function () { pose(); attente = false; });
    }, { passive: true });
    window.addEventListener("resize", pose, { passive: true });
    pose();
  }

  /* --- 5. Barre de navigation ------------------------------------------------- */
  function barre() {
    var bandeau = document.querySelector(".bandeau");
    if (!bandeau) return;
    var pose = function () { bandeau.classList.toggle("defile", window.scrollY > 24); };
    pose();
    window.addEventListener("scroll", pose, { passive: true });
  }

  /* --- 6. Lueur qui suit le pointeur sur les cartes ---------------------------- */
  function lueur() {
    if (SOBRE || !FIN) return;
    document.querySelectorAll("[data-lueur]").forEach(function (c) {
      c.addEventListener("pointermove", function (e) {
        var r = c.getBoundingClientRect();
        c.style.setProperty("--x", (e.clientX - r.left) + "px");
        c.style.setProperty("--y", (e.clientY - r.top) + "px");
      });
    });
  }

  /* --- 7. Halo de curseur ------------------------------------------------------ */
  /* Il accompagne le curseur natif sans le masquer : cacher le vrai curseur
     coûte trop cher à qui vise mal, pour un gain purement décoratif. */
  function halo() {
    if (SOBRE || !FIN) return;
    var h = document.createElement("div");
    h.className = "halo";
    h.setAttribute("aria-hidden", "true");
    document.body.appendChild(h);

    var x = 0, y = 0, hx = 0, hy = 0, vu = false;

    window.addEventListener("pointermove", function (e) {
      x = e.clientX; y = e.clientY;
      if (!vu) { hx = x; hy = y; vu = true; h.classList.add("vu"); }
      var cible = e.target.closest && e.target.closest("a, button, summary, label, .carte");
      h.classList.toggle("pris", !!cible);
    }, { passive: true });

    window.addEventListener("pointerleave", function () { h.classList.remove("vu"); vu = false; });

    (function suit() {
      hx += (x - hx) * 0.18;
      hy += (y - hy) * 0.18;
      h.style.transform = "translate3d(" + hx + "px," + hy + "px,0)";
      requestAnimationFrame(suit);
    })();
  }

  /* --- 8. Boutons magnétiques --------------------------------------------------- */
  function aimant() {
    if (SOBRE || !FIN) return;
    document.querySelectorAll(".bouton").forEach(function (b) {
      b.addEventListener("pointermove", function (e) {
        var r = b.getBoundingClientRect();
        var dx = (e.clientX - (r.left + r.width / 2)) / r.width;
        var dy = (e.clientY - (r.top + r.height / 2)) / r.height;
        b.style.transform = "translate(" + (dx * 9).toFixed(1) + "px," + (dy * 6).toFixed(1) + "px)";
      });
      b.addEventListener("pointerleave", function () { b.style.transform = ""; });
    });
  }

  /* --- 9. L'outil : dépliage, compteur, cascade ---------------------------------- */
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
        var a = repli.animate(
          ouvre ? [{ height: "0px", opacity: 0 }, { height: h + "px", opacity: 1 }]
                : [{ height: h + "px", opacity: 1 }, { height: "0px", opacity: 0 }],
          { duration: ouvre ? 380 : 260, easing: ouvre ? SORTIE : "cubic-bezier(0.4,0,0.2,1)" }
        );
        a.onfinish = function () {
          if (!ouvre) d.open = false;
          delete d.dataset.enCours;
        };
      });
    });
  }

  var dernierNombre = null;

  function compte(cible) {
    var vise = parseInt(cible.textContent, 10);
    if (isNaN(vise)) return;
    if (SOBRE || dernierNombre === null || dernierNombre === vise) { dernierNombre = vise; return; }

    var depart = dernierNombre, t0 = performance.now(), duree = 460;
    dernierNombre = vise;

    var resume = cible.closest(".resume-plan");
    if (resume) {
      resume.classList.add("bat");
      setTimeout(function () { resume.classList.remove("bat"); }, 220);
    }

    (function pas(t) {
      var p = Math.min(1, (t - t0) / duree);
      cible.textContent = Math.round(depart + (vise - depart) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(pas);
      else cible.textContent = vise;
    })(t0);
  }

  function cascade() {
    if (SOBRE) return;
    document.querySelectorAll("#sortie-plan .groupe").forEach(function (g, i) {
      g.style.animationDelay = (60 + i * 80) + "ms";
      g.querySelectorAll(".domaine").forEach(function (d, j) {
        d.style.animationDelay = (100 + i * 80 + j * 34) + "ms";
      });
    });
  }

  function surRendu() {
    var sortie = el("sortie-plan");
    if (!sortie) return;
    deplier(sortie);
    cascade();
    // Le bandeau de tête vit dans son propre conteneur, au-dessus du diagramme.
    var chiffre = document.querySelector(".resume-plan .chiffre");
    if (chiffre) compte(chiffre);
    else dernierNombre = null;
  }

  /* --- Mise en route -------------------------------------------------------------- */
  mots();
  entree();
  barre();
  reveler();
  recit();
  lueur();
  halo();
  aimant();
  document.addEventListener("plan:rendu", surRendu);
  surRendu();
})();
