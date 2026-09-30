/* ==========================================================================
   Pierrel & Co — la constellation du plan
   --------------------------------------------------------------------------
   Le plan, vu d'un coup d'œil. Au centre, l'entreprise. Chaque anneau est un
   rythme de revue : plus un domaine est proche, plus il faut le regarder
   souvent. Chaque trait dit d'où vient le domaine — le socle commun, le
   métier, ou une réponse de contexte.

   Ce n'est pas un ornement : c'est la seule vue qui montre la causalité, et
   c'est elle qu'on regarde en réunion quand on discute un périmètre.

   Elle double la liste détaillée, qui reste la version lisible et imprimable :
   le SVG est donc retiré de l'arbre d'accessibilité plutôt que d'y verser
   trente libellés en double.
   ========================================================================== */

window.CONSTELLATION = (function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var SOBRE = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var RAYONS = { mensuelle: 112, trimestrielle: 178, semestrielle: 244, annuelle: 306 };
  var RAYON_CENTRE = 52;

  var svg = null, gAnneaux = null, gLiens = null, gNoeuds = null, centre = null;
  var noeuds = {};   // id -> { g, point, texte, lien }

  function balise(nom, attrs) {
    var e = document.createElementNS(NS, nom);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }

  function construit(hote, frequences) {
    svg = balise("svg", {
      viewBox: "-560 -400 1120 800",
      class: "constellation",
      "aria-hidden": "true",
      focusable: "false"
    });

    gAnneaux = balise("g", { class: "anneaux" });
    frequences.forEach(function (f) {
      var r = RAYONS[f.id];
      if (!r) return;
      gAnneaux.appendChild(balise("circle", { r: r, cx: 0, cy: 0, class: "anneau" }));
      var t = balise("text", { x: 0, y: -r - 10, class: "anneau-titre", "text-anchor": "middle" });
      t.textContent = f.l.toLowerCase();
      gAnneaux.appendChild(t);
    });

    gLiens = balise("g", { class: "liens" });
    gNoeuds = balise("g", { class: "noeuds" });

    centre = balise("g", { class: "centre" });
    centre.appendChild(balise("circle", { r: RAYON_CENTRE, cx: 0, cy: 0, class: "centre-disque" }));
    var n = balise("text", { x: 0, y: 8, class: "centre-nombre", "text-anchor": "middle" });
    n.textContent = "0";
    centre.appendChild(n);

    svg.appendChild(gAnneaux);
    svg.appendChild(gLiens);
    svg.appendChild(centre);
    svg.appendChild(gNoeuds);
    hote.innerHTML = "";
    hote.appendChild(svg);
  }

  /* D'où vient le domaine : le premier motif décide de la couleur du trait. */
  function origine(entree, nomMetier) {
    if (entree.raisons.indexOf("Toute entreprise") !== -1) return "socle";
    if (entree.raisons.indexOf(nomMetier) !== -1) return "metier";
    return "contexte";
  }

  /* Les libellés sont posés à l'horizontale : au-delà d'une trentaine de
     signes, deux anneaux voisins finissent par se marcher dessus. Le nom
     complet reste dans la liste détaillée, juste en dessous. */
  function court(nom) {
    return nom.length > 30 ? nom.slice(0, 29).replace(/[\s,:]+$/, "") + "…" : nom;
  }

  function rend(p, metier) {
    var hote = document.getElementById("constellation");
    if (!hote) return;
    hote.hidden = false;
    if (!svg) construit(hote, window.REFERENTIEL.frequences);

    centre.querySelector(".centre-nombre").textContent = p.nombre;

    var vus = {};

    p.groupes.forEach(function (g, rang) {
      var r = RAYONS[g.frequence.id];
      if (!r) return;
      var n = g.entrees.length;
      var pas = (Math.PI * 2) / n;
      // Chaque anneau est tourné d'un cran par rapport au précédent : sans ce
      // décalage, deux domaines de rythmes différents tombent au même angle et
      // leurs libellés se chevauchent.
      var phase = rang * (Math.PI / 7);

      g.entrees.forEach(function (e, i) {
        // On part du haut, décalé d'un demi-pas : le sommet reste libre pour le
        // titre de l'anneau.
        var a = -Math.PI / 2 + pas * i + pas / 2 + phase;
        var x = Math.cos(a) * r;
        var y = Math.sin(a) * r;
        var droite = x >= 0;

        var noeud = noeuds[e.id];
        if (!noeud) {
          var gr = balise("g", { class: "noeud" });
          var pt = balise("circle", { r: 5, cx: 0, cy: 0, class: "point" });
          var tx = balise("text", { class: "libelle" });
          tx.textContent = court(e.domaine.nom);
          gr.appendChild(pt);
          gr.appendChild(tx);
          gNoeuds.appendChild(gr);

          var li = balise("line", { class: "lien", x1: 0, y1: 0 });
          gLiens.appendChild(li);

          noeud = noeuds[e.id] = { g: gr, point: pt, texte: tx, lien: li };
          if (!SOBRE) {
            gr.style.opacity = "0";
            gr.style.transform = "translate(0px, 0px) scale(0.4)";
            requestAnimationFrame(function () { gr.style.opacity = ""; });
          }
        }

        noeud.g.style.transform = "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px) scale(1)";
        noeud.g.style.opacity = "";
        noeud.texte.setAttribute("x", droite ? 12 : -12);
        noeud.texte.setAttribute("y", 4);
        noeud.texte.setAttribute("text-anchor", droite ? "start" : "end");

        // Le trait part du bord du disque central, pas de son centre.
        noeud.lien.setAttribute("x1", (Math.cos(a) * RAYON_CENTRE).toFixed(1));
        noeud.lien.setAttribute("y1", (Math.sin(a) * RAYON_CENTRE).toFixed(1));
        noeud.lien.setAttribute("x2", x.toFixed(1));
        noeud.lien.setAttribute("y2", y.toFixed(1));

        var quoi = origine(e, metier ? metier.nom : "");
        noeud.g.setAttribute("data-origine", quoi);
        noeud.lien.setAttribute("data-origine", quoi);
        noeud.g.setAttribute("data-raisons", e.raisons.join("|"));
        vus[e.id] = true;
      });
    });

    Object.keys(noeuds).forEach(function (id) {
      if (vus[id]) return;
      var n = noeuds[id];
      delete noeuds[id];
      if (SOBRE) { n.g.remove(); n.lien.remove(); return; }
      n.g.style.opacity = "0";
      n.g.style.transform = n.g.style.transform.replace("scale(1)", "scale(0.4)");
      n.lien.style.opacity = "0";
      setTimeout(function () { n.g.remove(); n.lien.remove(); }, 420);
    });
  }

  /* Survoler une question allume ce qu'elle apporte : c'est ce qui rend la
     causalité tangible, plutôt que décrite dans une pastille. */
  function souligne(intitule) {
    if (!svg) return;
    svg.classList.toggle("souligne", !!intitule);
    Object.keys(noeuds).forEach(function (id) {
      var n = noeuds[id];
      var porte = !!intitule &&
        (n.g.getAttribute("data-raisons") || "").split("|").indexOf(intitule) !== -1;
      n.g.classList.toggle("vif", porte);
      n.lien.classList.toggle("vif", porte);
    });
  }

  function cache() {
    var hote = document.getElementById("constellation");
    if (hote) { hote.hidden = true; hote.innerHTML = ""; }
    svg = null;
    noeuds = {};
  }

  return { rend: rend, souligne: souligne, cache: cache };
})();
