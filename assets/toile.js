/* ==========================================================================
   Pierrel & Co — l'animation d'ouverture
   --------------------------------------------------------------------------
   Un flux de textes traverse l'écran. Au passage du tamis, la grande majorité
   est écartée et retombe ; le reste se range dans quatre bandes, une par
   rythme de revue. C'est la prestation, littéralement.

   Contraintes tenues :
   - rien d'essentiel ici : le titre, le texte et les boutons du héros sont du
     HTML ordinaire, posés au-dessus. Sans cette animation, le site est entier ;
   - l'animation s'arrête quand l'onglet passe en arrière-plan ou quand le
     héros sort de l'écran : inutile de faire tourner un ventilateur pour un
     décor qu'on ne voit pas ;
   - qui demande moins d'animations reçoit une image fixe, pas un écran vide.
   ========================================================================== */

(function () {
  "use strict";

  var toile = document.getElementById("toile");
  if (!toile || !toile.getContext) return;

  var ctx = toile.getContext("2d", { alpha: true });
  var SOBRE = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var VERT = "95,179,161";
  var VERT_VIF = "132,220,196";
  var TERRE = "200,122,82";
  var CRAIE = "174,184,180";

  var L = 0, H = 0, dpr = 1;
  var tamis = 0;          // position affichée, qui rattrape la visée
  var vise = 0;           // position voulue : le repos, ou le pointeur
  var repos = 0;
  var pointeur = null;    // {x, y} tant que le pointeur survole le héros
  var bandes = [];
  var flux = [];
  var MAX = 150;
  var PAR_BANDE = 7;
  var dernierT = 0;
  var boucle = null;

  function mesure() {
    var r = toile.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    L = Math.max(1, r.width);
    H = Math.max(1, r.height);
    toile.width = Math.round(L * dpr);
    toile.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    repos = L * 0.46;
    if (!tamis) tamis = repos;
    vise = repos;
    bandes = [0.22, 0.4, 0.58, 0.76].map(function (p) {
      return { y: H * p, rangs: [] };
    });
  }

  function texte(prerempli) {
    return {
      x: prerempli ? Math.random() * tamis : -Math.random() * 140 - 40,
      y: 40 + Math.random() * (H - 80),
      l: 22 + Math.random() * 62,
      // Pixels par seconde. Assez rapide pour qu'une barre traverse en deux à
      // quatre secondes : plus lent, le visiteur part avant d'avoir vu le tri.
      v: 130 + Math.random() * 170,
      a: 0,                                 // opacité
      etat: "vole",
      cy: 0, cx: 0, band: null, rang: 0
    };
  }

  function sort() {
    // Une petite minorité passe le tamis : c'est tout le propos.
    return Math.random() < 0.13;
  }

  function place(t) {
    var b = bandes[Math.floor(Math.random() * bandes.length)];
    if (b.rangs.length >= PAR_BANDE) {
      var vieux = b.rangs.shift();
      vieux.etat = "efface";
      b.rangs.forEach(function (r, i) { r.rang = i; });
    }
    t.band = b;
    t.rang = b.rangs.length;
    b.rangs.push(t);
    t.etat = "range";
  }

  function avance(dt) {
    if (flux.length < MAX && Math.random() < dt * 34) flux.push(texte(false));

    // Le tamis rattrape sa visée sans à-coup : déplacé d'un bond, il couperait
    // le flux en plein vol et on verrait des barres changer d'état sans raison.
    vise = pointeur ? Math.max(L * 0.22, Math.min(L * 0.78, pointeur.x)) : repos;
    tamis += (vise - tamis) * Math.min(1, dt * 5);

    for (var i = flux.length - 1; i >= 0; i--) {
      var t = flux[i];

      if (t.etat === "vole") {
        t.x += t.v * dt;
        t.a = Math.min(1, t.a + dt * 2.2);

        // Léger évitement autour du pointeur : le flux se creuse là où on passe.
        if (pointeur) {
          var dx = t.x + t.l / 2 - pointeur.x;
          var dy = t.y - pointeur.y;
          var d2 = dx * dx + dy * dy;
          if (d2 < 15000 && d2 > 1) {
            var f = (1 - d2 / 15000) * 90 * dt;
            t.y += (dy / Math.sqrt(d2)) * f;
          }
        }
        if (t.x + t.l >= tamis) {
          if (sort()) place(t);
          else { t.etat = "ecarte"; t.cy = 40 + Math.random() * 90; t.cx = 10 + Math.random() * 30; }
        }
      } else if (t.etat === "ecarte") {
        t.x += t.cx * dt;
        t.y += t.cy * dt;
        t.cy += 120 * dt;                       // il retombe
        t.a -= dt * 0.85;
        if (t.a <= 0) flux.splice(i, 1);
      } else if (t.etat === "range") {
        var cibleX = L * 0.6;
        var cibleY = t.band.y + t.rang * 9;
        t.x += (cibleX - t.x) * Math.min(1, dt * 6);
        t.y += (cibleY - t.y) * Math.min(1, dt * 6);
        t.l += (74 - t.l) * Math.min(1, dt * 5);
      } else if (t.etat === "efface") {
        t.a -= dt * 1.4;
        t.y -= dt * 14;
        if (t.a <= 0) flux.splice(i, 1);
      }
    }
  }

  function dessine() {
    ctx.clearRect(0, 0, L, H);

    // Le tamis : un trait en pointillés qui respire.
    var pulse = 0.35 + 0.25 * (0.5 + 0.5 * Math.sin(Date.now() / 900));
    ctx.save();
    ctx.strokeStyle = "rgba(" + VERT + "," + pulse + ")";
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 8]);
    ctx.beginPath();
    ctx.moveTo(tamis, H * 0.06);
    ctx.lineTo(tamis, H * 0.94);
    ctx.stroke();
    ctx.restore();

    flux.forEach(function (t) {
      var couleur = t.etat === "ecarte" ? TERRE
        : t.etat === "range" || t.etat === "efface" ? VERT_VIF
        : CRAIE;
      var opacite = t.etat === "vole" ? t.a * 0.5 : Math.max(0, t.a);
      if (t.etat === "range") opacite = Math.min(1, t.a) * 0.92;
      ctx.fillStyle = "rgba(" + couleur + "," + opacite + ")";
      var ep = t.etat === "range" || t.etat === "efface" ? 4 : 3;
      arrondi(t.x, t.y, t.l, ep, ep / 2);
    });
  }

  function arrondi(x, y, l, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, l, h, r);
    else ctx.rect(x, y, l, h);
    ctx.fill();
  }

  function image(t) {
    var dt = Math.min(0.05, (t - dernierT) / 1000 || 0.016);
    dernierT = t;
    avance(dt);
    dessine();
    boucle = requestAnimationFrame(image);
  }

  function demarre() {
    if (boucle !== null) return;
    dernierT = performance.now();
    boucle = requestAnimationFrame(image);
  }

  function arrete() {
    if (boucle === null) return;
    cancelAnimationFrame(boucle);
    boucle = null;
  }

  function fixe() {
    // Une image posée : le flux à mi-course, les bandes déjà remplies.
    for (var i = 0; i < 46; i++) {
      var t = texte(true);
      t.a = 1;
      if (i % 7 === 0) place(t);
      flux.push(t);
    }
    flux.forEach(function (t) {
      if (t.etat !== "range") return;
      t.x = L * 0.6; t.y = t.band.y + t.rang * 9; t.l = 74;
    });
    dessine();
  }

  mesure();

  var recalage;
  window.addEventListener("resize", function () {
    clearTimeout(recalage);
    recalage = setTimeout(function () {
      var avantL = L;
      mesure();
      flux.length = 0;
      bandes.forEach(function (b) { b.rangs.length = 0; });
      if (SOBRE) fixe();
      else if (avantL) flux.push(texte(true));
    }, 180);
  });

  if (SOBRE) { fixe(); return; }

  for (var i = 0; i < 46; i++) {
    var amorce = texte(true);
    amorce.a = 1;
    if (i % 5 === 0) {
      place(amorce);
      amorce.x = L * 0.6;
      amorce.y = amorce.band.y + amorce.rang * 9;
      amorce.l = 74;
    }
    flux.push(amorce);
  }

  var heros = toile.closest(".heros") || toile.parentElement;
  if (window.matchMedia && window.matchMedia("(pointer: fine)").matches && heros) {
    heros.addEventListener("pointermove", function (e) {
      var r = toile.getBoundingClientRect();
      pointeur = { x: e.clientX - r.left, y: e.clientY - r.top };
    }, { passive: true });
    heros.addEventListener("pointerleave", function () { pointeur = null; });
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) arrete(); else demarre();
  });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (e) {
      if (e[0].isIntersecting && !document.hidden) demarre(); else arrete();
    }, { threshold: 0 }).observe(toile);
  } else {
    demarre();
  }
})();
