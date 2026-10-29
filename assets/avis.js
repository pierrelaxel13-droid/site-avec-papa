/* ==========================================================================
   Vigie — la cloche des nouveaux textes
   --------------------------------------------------------------------------
   Ce que la cloche fait vraiment, aujourd'hui : elle compare la date du
   dernier texte lu, gardée dans ce navigateur, aux dates des textes relevés,
   et montre ce qui est arrivé depuis. Cela marche hors ligne et sans compte.

   Ce qu'elle ne fait pas : envoyer un courriel, ni une notification système
   quand l'application est fermée. Les deux supposent un serveur qui pousse —
   pour le courriel, un service d'envoi ; pour la notification système, un
   serveur de push et une clé VAPID. Le panneau le dit en toutes lettres
   plutôt que de laisser croire que c'est déjà là.
   ========================================================================== */

(function () {
  "use strict";

  var CLE = "pco-avis-lus";
  var avis = window.AVIS || [];
  /* Dans un vrai compte, les avis du jeu d'essai (e) n'ont rien à faire là :
     restent les vrais changements des codes suivis. */
  if (window.MAGASIN && window.MAGASIN.mode === "compte") avis = avis.filter(function (x) { return !x.e; });
  var cloche = document.getElementById("cloche");
  if (!cloche || !avis.length) return;

  var panneau = document.getElementById("panneau-avis");
  var liste = document.getElementById("liste-avis");
  var compte = document.getElementById("compte-avis");

  function lu() {
    try { return window.localStorage.getItem(CLE) || ""; } catch (e) { return ""; }
  }
  function poser(d) {
    try { window.localStorage.setItem(CLE, d); } catch (e) { /* sans effet */ }
  }

  function echappe(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  var MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet",
              "août", "septembre", "octobre", "novembre", "décembre"];
  function dateFr(iso) {
    var p = iso.split("-");
    return Number(p[2]) + " " + MOIS[Number(p[1]) - 1] + " " + p[0];
  }

  function racine() {
    return document.body.getAttribute("data-racine") === "../../" ? "../" : "";
  }

  function rendre() {
    var depuis = lu();
    var neufs = avis.filter(function (a) { return a.d > depuis; });

    compte.textContent = neufs.length;
    compte.hidden = neufs.length === 0;
    cloche.classList.toggle("sonne", neufs.length > 0);
    cloche.setAttribute("aria-label",
      neufs.length ? neufs.length + " nouveaux textes" : "Aucun nouveau texte");

    var ligne = function (a) {
      return '<li class="avis' + (a.d > depuis ? " neuf" : "") + (a.p ? " prioritaire" : "") + '">' +
        '<a href="' + racine() + (a.u || "releve.html") + '">' +
          '<span class="avis-date mono">' + echappe(dateFr(a.d)) + "</span>" +
          '<span class="avis-titre">' + echappe(a.t) + "</span>" +
          '<span class="avis-quoi">' + echappe(a.q) + "</span>" +
          '<span class="avis-dom etiq">' + echappe(a.dom) + (a.p ? " · prioritaire" : "") + "</span>" +
          '<span class="avis-aller">Le texte et ce qu\'il faut faire</span>' +
        "</a></li>";
    };

    // Quand rien n'est neuf, on le dit — puis on montre les derniers relevés.
    // Un panneau vide ne distingue pas « rien n'est sorti » de « la veille est
    // en panne », et c'est la différence qui compte pour l'abonné.
    if (neufs.length) {
      liste.innerHTML = neufs.slice(0, 8).map(ligne).join("");
    } else {
      liste.innerHTML = '<li class="avis-vide">Rien de neuf depuis votre dernier passage.</li>' +
        '<li class="avis-separateur"><span class="etiq">Derniers textes relevés</span></li>' +
        avis.slice(0, 3).map(ligne).join("");
    }
  }

  function ouvrir(v) {
    panneau.hidden = !v;
    cloche.setAttribute("aria-expanded", v ? "true" : "false");
  }

  cloche.addEventListener("click", function (e) {
    e.stopPropagation();
    ouvrir(panneau.hidden);
  });

  document.getElementById("tout-lu").addEventListener("click", function () {
    poser(avis[0].d);   // le relevé est trié du plus récent au plus ancien
    rendre();
  });

  document.addEventListener("click", function (e) {
    if (!panneau.hidden && !panneau.contains(e.target) && e.target !== cloche) ouvrir(false);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !panneau.hidden) { ouvrir(false); cloche.focus(); }
  });

  rendre();
})();
