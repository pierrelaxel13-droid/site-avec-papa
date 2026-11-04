/* ==========================================================================
   Vigie réglementaire — le fonds des textes en vigueur, chargé à la demande
   (4 novembre 2026)
   --------------------------------------------------------------------------
   Les lois, décrets et arrêtés en vigueur publiés depuis 50 ans (base LEGI,
   outils/fonds-legi.mjs) sont des milliers : ils ne sont pas dans la page.
   build.mjs les range dans un fichier par sujet (fonds/<sujet>.html) ; on ne
   charge que ceux des sujets du plan de l'entreprise, on les ajoute au
   tableau, puis on prévient les autres scripts (« pco-lignes ») pour qu'ils
   branchent les colonnes Lu et Applicable, l'analyse et les filtres.
   ========================================================================== */
(function () {
  "use strict";
  var table = document.querySelector(".tableau-textes-plan[data-fonds]");
  if (!table || !window.fetch) return;
  var base = table.getAttribute("data-fonds");
  var dispo = {};
  (table.getAttribute("data-fonds-sujets") || "").split(" ").forEach(function (id) { if (id) dispo[id] = 1; });
  var charges = {}, enCours = false, etat = document.getElementById("fonds-etat");
  var corps = table.tBodies[0];

  function plan() { return window.PCO_AVIS && window.PCO_AVIS.plan ? window.PCO_AVIS.plan() : null; }
  function dire(x) { if (etat) etat.textContent = x; }
  function compter() {
    var n = corps.querySelectorAll('tr[data-cle^="legi:"]:not([hidden])').length;
    dire(n ? n + " loi" + (n > 1 ? "s" : "") + ", décret" + (n > 1 ? "s" : "") + " et arrêté" + (n > 1 ? "s" : "") +
      " en vigueur publiés depuis 50 ans, ajoutés à votre veille (source : Légifrance)." : "");
  }

  function charger() {
    var p = plan();
    if (!p) { dire("Réglez le code APE de votre entreprise pour ajouter les textes en vigueur publiés depuis 50 ans."); return; }
    if (enCours) return;
    var dedans = {};
    p.forEach(function (id) { dedans[id] = 1; });
    // Ceux d'un sujet sorti du plan se cachent ; ceux d'un sujet du plan se montrent.
    [].forEach.call(corps.querySelectorAll('tr[data-cle^="legi:"]'), function (tr) {
      tr.hidden = !(tr.getAttribute("data-domaines") || "").split(" ").some(function (id) { return dedans[id]; });
    });
    var manquants = p.filter(function (id) { return dispo[id] && !charges[id]; });
    if (!manquants.length) { compter(); return; }
    enCours = true;
    dire("Chargement des textes en vigueur publiés depuis 50 ans…");
    Promise.all(manquants.map(function (id) {
      return fetch(base + encodeURIComponent(id) + ".html").then(function (r) { return r.ok ? r.text() : ""; })
        .catch(function () { return ""; }).then(function (html) { charges[id] = 1; return html; });
    })).then(function (morceaux) {
      var t = document.createElement("template");
      t.innerHTML = morceaux.join("\n");
      var deja = {};
      [].forEach.call(corps.querySelectorAll("tr[data-cle]"), function (tr) { deja[tr.getAttribute("data-cle")] = 1; });
      var nouvelles = [].filter.call(t.content.querySelectorAll("tr[data-cle]"), function (tr) {
        var k = tr.getAttribute("data-cle");
        if (deja[k]) return false;
        deja[k] = 1;
        return true;
      }).sort(function (a, b) { return (a.getAttribute("data-date") < b.getAttribute("data-date")) ? 1 : -1; });
      var frag = document.createDocumentFragment();
      nouvelles.forEach(function (tr) {
        tr.hidden = !(tr.getAttribute("data-domaines") || "").split(" ").some(function (id) { return dedans[id]; });
        frag.appendChild(tr);
      });
      corps.appendChild(frag);
      enCours = false;
      try { window.dispatchEvent(new Event("pco-lignes")); } catch (e) { /* vieux navigateur */ }
      compter();
    });
  }
  window.addEventListener("pco-plan", charger);
  if (document.readyState === "complete") charger();
  else window.addEventListener("load", charger);
})();
