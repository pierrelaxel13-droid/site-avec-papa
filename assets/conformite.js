/* ==========================================================================
   Vigie — la conformité réglementaire (formule Veille complète)
   --------------------------------------------------------------------------
   Une ligne par texte de référence du plan : l'évaluation (conforme,
   partiellement, non conforme, à évaluer) et sa preuve ou son commentaire.
   Dans un compte, chaque « Enregistrer » ajoute une entrée datée au registre
   (MAGASIN.evaluer → espace_conformite) ; dans la démonstration, tout reste
   dans le navigateur. Les compteurs du haut ne comptent que les lignes du plan.
   ========================================================================== */
(function () {
  "use strict";
  var M = window.MAGASIN;
  if (!M || !document.querySelector(".tableau-conformite")) return;
  var STATUTS = { a_evaluer: "À évaluer", conforme: "Conforme", partiel: "Partiellement conforme", non_conforme: "Non conforme" };

  function $$(s, r) { return [].slice.call((r || document).querySelectorAll(s)); }
  function jour(d) {
    if (!d) return "";
    var t = Date.parse(String(d).slice(0, 10) + "T12:00:00");
    return isNaN(t) ? d : new Date(t).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  }
  var lignes = $$(".tableau-conformite tbody tr");

  /* Le plan des réglages, quand il y en a un : les lignes et les catégories
     qui n'y sont pas se cachent (sinon on garde le plan posé à la construction). */
  function suivrePlan() {
    var garde = M.lire("pco-entreprise");
    var E = window.PCO_ENTREPRISE;
    if (!garde || !garde.naf || !E || !window.PLAN) return;
    var vue = E.perimetre(garde.naf, garde.contexte || []);
    if (!vue) return;
    var dedans = {};
    vue.liste.forEach(function (id) { dedans[id] = 1; });
    var touche = function (el) {
      return (el.getAttribute("data-sujets") || el.getAttribute("data-domaines") || "").split(" ")
        .some(function (id) { return dedans[id]; });
    };
    lignes.forEach(function (tr) {
      tr.hidden = !touche(tr);
      if (!tr.hidden) $$("[data-sujets]", tr).forEach(function (x) { x.hidden = !touche(x); });
    });
  }

  function compter() {
    var n = { conforme: 0, partiel: 0, non_conforme: 0, a_evaluer: 0 }, ev = M.conformites();
    var vis = lignes.filter(function (tr) { return !tr.hidden; });
    vis.forEach(function (tr) {
      var e = ev[tr.getAttribute("data-cle")];
      n[e && n[e.statut] != null ? e.statut : "a_evaluer"]++;
    });
    Object.keys(n).forEach(function (k) {
      var el = document.getElementById("conf-n-" + k);
      if (el) el.textContent = n[k];
    });
    var nc = document.getElementById("conf-n-non_conforme");
    if (nc) nc.closest("div").classList.toggle("alerte", n.non_conforme > 0);
    var evalues = vis.length - n.a_evaluer, taux = document.getElementById("conf-taux");
    if (taux) taux.textContent = vis.length ? "sur " + vis.length + " textes" + (evalues
      ? " · " + Math.round(100 * n.conforme / evalues) + " % des textes évalués sont conformes" : "") : "";
  }

  function peindre(tr) {
    var e = M.conformites()[tr.getAttribute("data-cle")];
    var sel = tr.querySelector(".conf-statut"), note = tr.querySelector(".conf-note");
    sel.value = e && STATUTS[e.statut] ? e.statut : "a_evaluer";
    sel.setAttribute("data-statut", sel.value);
    if (e && document.activeElement !== note) note.value = e.note || "";
    tr.querySelector(".conf-etat").textContent = e
      ? "Évalué le " + jour(e.le) + (e.par && e.par !== "vous" ? " par " + e.par : "")
      : "Pas encore évalué";
  }

  M.quandPret(function () {
    suivrePlan();
    var lecture = M.mode === "compte" && M.espace && (!M.espace.ecrit || M.espace.rang < 3);
    if (lecture) {
      var p = document.querySelector(".conf-lecture");
      p.textContent = M.espace.rang < 3
        ? "L'évaluation de conformité fait partie de la formule « Veille complète »."
        : "Vous êtes en lecture seule : l'administrateur ou un membre de votre entreprise évalue.";
      p.hidden = false;
    }
    lignes.forEach(function (tr) {
      peindre(tr);
      var sel = tr.querySelector(".conf-statut"), form = tr.querySelector(".conf-form"), etat = tr.querySelector(".conf-etat");
      if (lecture) { sel.disabled = true; $$("input, button", form).forEach(function (x) { x.disabled = true; }); return; }
      function enregistrer() {
        var bouton = form.querySelector("button");
        bouton.disabled = true;
        etat.textContent = "Enregistrement…";
        M.evaluer(tr.getAttribute("data-cle"), tr.getAttribute("data-objet"), sel.value,
                  form.querySelector(".conf-note").value.trim()).then(function (r) {
          bouton.disabled = false;
          if (!r.ok) { etat.textContent = r.erreur || "Impossible d'enregistrer."; return; }
          peindre(tr);
          compter();
        });
      }
      sel.addEventListener("change", enregistrer);
      form.addEventListener("submit", function (ev) { ev.preventDefault(); enregistrer(); });
    });
    compter();
  });
})();
