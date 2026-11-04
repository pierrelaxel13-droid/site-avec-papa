/* ==========================================================================
   Vigie réglementaire — statistiques de l'espace administrateur
   (4 novembre 2026)
   --------------------------------------------------------------------------
   Deux courbes : les comptes connectés chaque jour, les abonnements actifs
   jour après jour (payés, et donnés par l'administrateur). Les chiffres
   viennent de admin_statistiques(), que la base refuse à tout autre compte
   que l'administrateur. Graphiques en SVG, dessinés ici : aucune
   bibliothèque, aucun service tiers.
   ========================================================================== */
(function () {
  "use strict";
  var bloc = document.getElementById("admin-stats");
  var V = window.VIGIE;
  if (!bloc || !V || !V.ouvert) return;
  var NS = "http://www.w3.org/2000/svg";
  var jours = 90, donnees = null;

  function el(nom, attrs, parent) {
    var x = document.createElementNS(NS, nom);
    Object.keys(attrs || {}).forEach(function (k) { x.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(x);
    return x;
  }
  function nombre(n) { return Number(n || 0).toLocaleString("fr-FR"); }
  function dateCourte(iso) { return new Date(iso + "T12:00:00Z").toLocaleDateString("fr-FR", { day: "numeric", month: "short" }); }
  function dateLongue(iso) { return new Date(iso + "T12:00:00Z").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); }
  function pas(max) {
    if (max <= 4) return 1;
    var brut = max / 4, p = Math.pow(10, Math.floor(Math.log10(brut))), r = brut / p;
    return (r <= 1 ? 1 : r <= 2 ? 2 : r <= 5 ? 5 : 10) * p;
  }

  /* Un graphique en courbes : séries [{ nom, cle, classe }], une seule échelle. */
  function graphe(hote, lignes, series) {
    hote.textContent = "";
    var L = Math.max(hote.clientWidth || 600, 280), H = 220;
    var m = { g: 36, d: 12, h: 12, b: 26 };
    var w = L - m.g - m.d, h = H - m.h - m.b;
    var max = 0;
    lignes.forEach(function (l) { series.forEach(function (s) { max = Math.max(max, Number(l[s.cle]) || 0); }); });
    var p = pas(max), haut = Math.max(p * Math.ceil(max / p), p);
    var x = function (i) { return m.g + (lignes.length < 2 ? w / 2 : (i * w) / (lignes.length - 1)); };
    var y = function (v) { return m.h + h - (v / haut) * h; };
    var svg = el("svg", { viewBox: "0 0 " + L + " " + H, width: L, height: H, role: "img",
      "aria-label": series.map(function (s) { return s.nom; }).join(" et ") + " sur " + lignes.length + " jours" }, hote);
    // Grille et axe des valeurs : discrets.
    for (var v = 0; v <= haut + 1e-9; v += p) {
      el("line", { x1: m.g, x2: L - m.d, y1: y(v), y2: y(v), class: v === 0 ? "g-base" : "g-grille" }, svg);
      el("text", { x: m.g - 6, y: y(v) + 4, class: "g-axe", "text-anchor": "end" }, svg).textContent = nombre(v);
    }
    // Axe du temps : cinq repères au plus.
    var nRep = Math.min(5, lignes.length);
    for (var k = 0; k < nRep; k++) {
      var i = Math.round((k * (lignes.length - 1)) / Math.max(nRep - 1, 1));
      el("text", { x: x(i), y: H - 6, class: "g-axe", "text-anchor": k === 0 ? "start" : k === nRep - 1 ? "end" : "middle" }, svg)
        .textContent = dateCourte(lignes[i].jour);
    }
    // Les séries : une aire légère pour la première, des traits de 2 px.
    series.forEach(function (s, n) {
      var pts = lignes.map(function (l, i) { return x(i).toFixed(1) + "," + y(Number(l[s.cle]) || 0).toFixed(1); });
      if (n === 0) el("polygon", { points: m.g + "," + y(0) + " " + pts.join(" ") + " " + x(lignes.length - 1) + "," + y(0), class: "g-aire " + s.classe }, svg);
      el("polyline", { points: pts.join(" "), class: "g-trait " + s.classe }, svg);
    });
    // Survol : un repère vertical, un point par série, une bulle.
    var rep = el("line", { y1: m.h, y2: m.h + h, class: "g-repere", visibility: "hidden" }, svg);
    var points = series.map(function (s) { return el("circle", { r: 4.5, class: "g-point " + s.classe, visibility: "hidden" }, svg); });
    var bulle = document.createElement("div");
    bulle.className = "g-bulle"; bulle.hidden = true;
    hote.appendChild(bulle);
    var zone = el("rect", { x: m.g, y: m.h, width: w, height: h, fill: "transparent", tabindex: "0", class: "g-zone" }, svg);
    function montrer(i) {
      var l = lignes[i];
      rep.setAttribute("x1", x(i)); rep.setAttribute("x2", x(i)); rep.setAttribute("visibility", "visible");
      points.forEach(function (c, n) { c.setAttribute("cx", x(i)); c.setAttribute("cy", y(Number(l[series[n].cle]) || 0)); c.setAttribute("visibility", "visible"); });
      bulle.innerHTML = "";
      var t = document.createElement("strong"); t.textContent = dateLongue(l.jour); bulle.appendChild(t);
      series.forEach(function (s) {
        var d = document.createElement("span");
        d.innerHTML = '<i class="g-pastille ' + s.classe + '"></i>';
        d.appendChild(document.createTextNode(s.nom + " : " + nombre(l[s.cle])));
        bulle.appendChild(d);
      });
      bulle.hidden = false;
      var px = (x(i) / L) * hote.clientWidth;
      bulle.style.left = Math.min(Math.max(px - bulle.offsetWidth / 2, 0), hote.clientWidth - bulle.offsetWidth) + "px";
    }
    function cacher() { rep.setAttribute("visibility", "hidden"); points.forEach(function (c) { c.setAttribute("visibility", "hidden"); }); bulle.hidden = true; }
    var courant = lignes.length - 1;
    function depuisSouris(ev) {
      var r = svg.getBoundingClientRect(), px = ((ev.clientX - r.left) / r.width) * L;
      courant = Math.round(((px - m.g) / w) * (lignes.length - 1));
      courant = Math.max(0, Math.min(lignes.length - 1, courant));
      montrer(courant);
    }
    zone.addEventListener("pointermove", depuisSouris);
    zone.addEventListener("pointerdown", depuisSouris);
    zone.addEventListener("pointerleave", cacher);
    zone.addEventListener("focus", function () { montrer(courant); });
    zone.addEventListener("blur", cacher);
    zone.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { courant = Math.max(0, courant - 1); montrer(courant); e.preventDefault(); }
      if (e.key === "ArrowRight") { courant = Math.min(lignes.length - 1, courant + 1); montrer(courant); e.preventDefault(); }
    });
    // Légende, dès deux séries.
    if (series.length > 1) {
      var leg = document.createElement("p");
      leg.className = "g-legende";
      series.forEach(function (s) {
        var d = document.createElement("span");
        d.innerHTML = '<i class="g-pastille ' + s.classe + '"></i>';
        d.appendChild(document.createTextNode(s.nom));
        leg.appendChild(d);
      });
      hote.appendChild(leg);
    }
  }

  var NOMS = { textes: "État des lieux", suivi: "État des lieux et plan d'actions", complet: "Veille complète", consultant: "Consultant" };
  function peindre() {
    if (!donnees) return;
    var l = donnees.jours || [], der = l[l.length - 1] || {};
    document.getElementById("st-auj").textContent = nombre(der.comptes);
    document.getElementById("st-30").textContent = nombre(donnees.comptes_30j);
    document.getElementById("st-abos").textContent = nombre((Number(der.payes) || 0) + (Number(der.offerts) || 0));
    document.getElementById("st-comptes").textContent = nombre(donnees.comptes_total);
    var pf = donnees.par_formule || {};
    var parts = Object.keys(pf).map(function (f) { return (NOMS[f] || f) + " : " + nombre(pf[f]); });
    document.getElementById("st-formules").textContent = parts.length ? "Abonnements en cours, par formule — " + parts.join(" · ") + "." : "Aucun abonnement en cours pour l'instant.";
    graphe(document.getElementById("graphe-connexions"), l, [{ nom: "Comptes connectés", cle: "comptes", classe: "s1" }]);
    graphe(document.getElementById("graphe-abonnements"), l, [
      { nom: "Payés", cle: "payes", classe: "s1" }, { nom: "Donnés par l'administrateur", cle: "offerts", classe: "s2" }]);
    var t = document.getElementById("st-table");
    t.innerHTML = "<thead><tr><th scope=\"col\">Jour</th><th scope=\"col\">Comptes connectés</th><th scope=\"col\">Sessions</th><th scope=\"col\">Abonnements payés</th><th scope=\"col\">Donnés</th><th scope=\"col\">Comptes créés (cumul)</th></tr></thead>";
    var tb = document.createElement("tbody");
    l.slice().reverse().forEach(function (x) {
      var tr = document.createElement("tr");
      [dateCourte(x.jour), nombre(x.comptes), nombre(x.sessions), nombre(x.payes), nombre(x.offerts), nombre(x.inscrits)].forEach(function (v) {
        var td = document.createElement("td"); td.textContent = v; tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    t.appendChild(tb);
  }
  function charger() {
    V.rpc("admin_statistiques", { jours: jours }).then(function (r) {
      if (!r.ok || !r.donnees) return;          // pas administrateur : la section reste cachée
      donnees = r.donnees;
      bloc.hidden = false;
      peindre();
    });
  }
  [].forEach.call(bloc.querySelectorAll("[data-jours]"), function (b) {
    b.addEventListener("click", function () {
      jours = Number(b.getAttribute("data-jours"));
      [].forEach.call(bloc.querySelectorAll("[data-jours]"), function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      charger();
    });
  });
  var attente;
  window.addEventListener("resize", function () { clearTimeout(attente); attente = setTimeout(peindre, 150); });
  V.session().then(function (s) { if (s) charger(); });
})();
