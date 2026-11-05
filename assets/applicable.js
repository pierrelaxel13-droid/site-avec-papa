/* ==========================================================================
   Vigie — Mon plan : « Les textes de votre plan »
   --------------------------------------------------------------------------
   1. La colonne « Applicable » (3 novembre 2026) : Oui ou Non pour chaque
      texte. C'est la qualification du relevé (MAGASIN.qualifier) : « Oui »
      = « S'applique chez nous », « Non » = « Ne nous concerne pas ». Dans un
      compte, chaque choix s'inscrit, daté, au registre ; dans la
      démonstration, il reste dans le navigateur.
   2. Le filtre par catégorie : n'afficher que les textes d'une catégorie.
      Il cache par une classe, pas par « hidden » : « hidden » dit si le texte
      est dans le plan (assets/entreprise.js) et les deux se combinent.
   ========================================================================== */
(function () {
  "use strict";
  // Le texte d'une cellule, sans le volet « Analyse synthétique » : la recherche porte sur le titre du texte.
  function texteSansAnalyse(td) {
    if (!td) return "";
    var c = td.cloneNode(true);
    [].forEach.call(c.querySelectorAll(".analyse"), function (x) { x.remove(); });
    return c.textContent;
  }
  var M = window.MAGASIN;
  var table = document.querySelector(".tableau-textes-plan");
  if (!M || !table) return;
  var lignes = [].slice.call(table.querySelectorAll("tbody tr"));
  var STATUTS = { applicable: "Oui", sans_objet: "Non", a_suivre: "À suivre" };

  function jour(d) {
    if (!d) return "";
    var t = Date.parse(String(d).slice(0, 10) + "T12:00:00");
    return isNaN(t) ? d : new Date(t).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  }

  /* La catégorie principale d'un texte (3 novembre 2026, « qu'il ne compte
     qu'une fois ») : celle de son premier sujet qui est dans le plan. Les
     autres pastilles de catégorie se cachent : une ligne, une catégorie. */
  // La catégorie d'une ligne ne change qu'avec le plan : on la garde en mémoire.
  var memoCat = typeof WeakMap === "function" ? new WeakMap() : null;
  function principale(tr) {
    if (memoCat && memoCat.has(tr)) return memoCat.get(tr);
    var c = principaleCalculee(tr);
    if (memoCat) memoCat.set(tr, c);
    return c;
  }
  window.addEventListener("pco-plan", function () { if (memoCat) memoCat = new WeakMap(); }, true);
  function principaleCalculee(tr) {
    var spans = [].slice.call(tr.querySelectorAll(".categorie-texte[data-cat]"));
    var ids = (tr.getAttribute("data-domaines") || "").split(" "), cat = "";
    for (var i = 0; i < ids.length && !cat; i++) {
      for (var j = 0; j < spans.length; j++) {
        if (!spans[j].hidden && (" " + spans[j].getAttribute("data-sujets") + " ").indexOf(" " + ids[i] + " ") !== -1) { cat = spans[j].getAttribute("data-cat"); break; }
      }
    }
    if (!cat && spans[0]) cat = spans[0].getAttribute("data-cat");
    spans.forEach(function (x) { x.classList.toggle("cat-secondaire", x.getAttribute("data-cat") !== cat); });
    return cat;
  }

  /* --- La recherche : un mot, une période, une source ------------------------ */
  var rMot = document.getElementById("rt-mot"), rDu = document.getElementById("rt-du"),
      rAu = document.getElementById("rt-au"), rSrc = document.getElementById("rt-source"), rEff = document.getElementById("rt-effacer");
  function sansAccent(x) { return String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
  function cherche(tr) {
    if (!rMot) return true;
    var mot = sansAccent(rMot.value.trim()), d = tr.getAttribute("data-date") || "";
    if (mot && sansAccent(texteSansAnalyse(tr.querySelector('[data-titre="Texte"]') || tr.querySelector("td:nth-child(3)"))).indexOf(mot) === -1) return false;
    if (rDu.value && (!d || d < rDu.value)) return false;
    if (rAu.value && (!d || d > rAu.value)) return false;
    if (rSrc.value && tr.getAttribute("data-source") !== rSrc.value) return false;
    return true;
  }
  [rMot, rDu, rAu, rSrc].forEach(function (x) { if (x) x.addEventListener(x === rMot ? "input" : "change", function () { filtrer(); }); });
  if (rEff) rEff.addEventListener("click", function () { rMot.value = rDu.value = rAu.value = rSrc.value = ""; filtrer(); rMot.focus(); });

  /* --- Le filtre par catégorie ---------------------------------------------- */
  var filtre = document.getElementById("filtre-categorie");
  var compte = document.getElementById("filtre-compte");
  function filtrer() {
    var cat = filtre ? filtre.value : "";
    var n = 0;
    lignes.forEach(function (tr) {
      var garde = (!cat || principale(tr) === cat) && cherche(tr);
      tr.classList.toggle("hors-filtre", !garde);
      if (garde && !tr.hidden) n++;
    });
    if (compte) compte.textContent = n + " texte" + (n > 1 ? "s" : "");
    if (rEff) rEff.hidden = !(rMot.value || rDu.value || rAu.value || rSrc.value);
    carres();
  }

  /* Les carrés par catégorie : le nombre de textes du plan dans chacune,
     chaque texte compté une fois, dans sa catégorie principale ; un clic filtre. */
  function carres() {
    var cat = filtre ? filtre.value : "";
    var parCat = {};
    lignes.forEach(function (tr) { if (!tr.hidden) { var c = principale(tr); parCat[c] = (parCat[c] || 0) + 1; } });
    [].forEach.call(document.querySelectorAll(".carre-categorie"), function (b) {
      var c = b.getAttribute("data-filtre-cat"), n = parCat[c] || 0;
      b.querySelector("[data-n-cat]").textContent = n;
      b.querySelector(".precision").textContent = "texte" + (n > 1 ? "s" : "");
      b.setAttribute("aria-pressed", cat === c ? "true" : "false");
      b.disabled = !n;
    });
  }
  [].forEach.call(document.querySelectorAll(".carre-categorie"), function (b) {
    b.addEventListener("click", function () {
      if (!filtre) return;
      var c = b.getAttribute("data-filtre-cat");
      filtre.value = filtre.value === c ? "" : c;   // un second clic remet toutes les catégories
      filtrer();
    });
  });
  if (filtre) filtre.addEventListener("change", filtrer);
  // Le plan peut changer après coup (réglages lus depuis la base) : on recompte.
  window.addEventListener("pco-plan", filtrer);

  /* --- La colonne « Applicable » -------------------------------------------- */
  function peindre(tr) {
    var q = M.qualifications()[tr.getAttribute("data-cle")];
    var sel = tr.querySelector(".applicable"), etat = tr.querySelector(".applicable-etat");
    sel.value = q && (q.statut === "applicable" || q.statut === "sans_objet") ? q.statut : "";
    sel.setAttribute("data-statut", sel.value);
    etat.textContent = q ? (q.statut === "a_suivre" ? "À suivre, " : "") + "le " + jour(q.le) : "";
  }

  function brancherApplicable() {
    var lecture = M.mode === "compte" && M.espace && (!M.espace.ecrit || M.espace.rang < 2);
    lignes.forEach(function (tr) {
      var sel = tr.querySelector(".applicable");
      if (!sel) return;
      peindre(tr);
      if (sel.hasAttribute("data-ecoute")) return;
      sel.setAttribute("data-ecoute", "");
      if (lecture) { sel.disabled = true; return; }
      sel.addEventListener("change", function () {
        if (!sel.value) { peindre(tr); return; }   // « À décider » ne s'enregistre pas : le registre ne s'efface pas
        var etat = tr.querySelector(".applicable-etat");
        sel.disabled = true;
        etat.textContent = "Enregistrement…";
        M.qualifier(tr.getAttribute("data-cle"), tr.getAttribute("data-objet"), sel.value).then(function (r) {
          sel.disabled = false;
          if (!r.ok) { etat.textContent = r.erreur || "Impossible d'enregistrer."; return; }
          peindre(tr);
        });
      });
    });
  }
  M.quandPret(function () {
    brancherApplicable();
    lus();
    filtrer();
  });
  /* Des lignes ajoutées après coup (le fonds des textes en vigueur, assets/fonds.js) :
     on les compte, on branche leurs colonnes et on refiltre. */
  window.addEventListener("pco-lignes", function () {
    lignes = [].slice.call(table.querySelectorAll("tbody tr:not(.ligne-analyse)"));
    M.quandPret(function () { brancherApplicable(); lus(); filtrer(); });
  });

  /* --- La colonne « Lu » et la mention « Nouveau texte » (3 novembre 2026) --
     Même mémoire que la cloche (assets/avis.js) : cocher, c'est avoir lu ;
     décocher, c'est le remettre en attente. Le nombre de textes du plan pas
     encore lus est dit sous le titre. */
  var A = window.PCO_AVIS;
  function attente() {
    var n = 0;
    lignes.forEach(function (tr) {
      var c = tr.querySelector(".lu");
      if (c && !tr.hidden && !c.checked) n++;
    });
    var p = document.getElementById("textes-attente");
    if (!p) return;
    p.classList.toggle("tout-lu", !n);
    p.innerHTML = n
      ? '<span class="ta-nombre">' + n + '</span><span class="ta-libelle">texte' + (n > 1 ? "s" : "") + " à lire</span>" +
        '<span class="ta-aide">Cochez « Lu » dans le tableau après lecture.</span>'
      : '<span class="ta-libelle">Tous les textes de votre plan sont lus.</span>';
  }
  function peindreLu(tr) {
    var c = tr.querySelector(".lu"), k = tr.getAttribute("data-cle");
    if (!c || !A || !A.estLu) return;
    c.checked = A.estLu(k);
    tr.classList.toggle("texte-lu", c.checked);
    var m = tr.querySelector(".marque-nouveau");
    if (m) m.hidden = !A.estNouveau(k);
  }
  function lus() {
    lignes.forEach(function (tr) {
      var c = tr.querySelector(".lu");
      if (!c) return;
      peindreLu(tr);
      if (c.hasAttribute("data-ecoute")) return;
      c.setAttribute("data-ecoute", "");
      c.addEventListener("change", function () {
        A.marquerLu(tr.getAttribute("data-cle"), c.checked);
        peindreLu(tr); attente();
      });
    });
    attente();
  }
  window.addEventListener("pco-plan", function () { if (M.pret) attente(); });
  // La cloche a chargé (ou changé) les textes lus : on repeint la colonne.
  window.addEventListener("pco-lus", function () { if (M.pret) lus(); });
  // Et une fois la page entièrement chargée, quel que soit l'ordre des scripts.
  window.addEventListener("load", function () { M.quandPret(function () { window.setTimeout(lus, 0); }); });
})();
