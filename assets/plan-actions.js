/* ==========================================================================
   Vigie — le plan d'actions (app/actions.html)
   --------------------------------------------------------------------------
   Une ligne par action. On y garde le plan de l'entreprise (data-domaines),
   on enregistre le délai et le responsable (MAGASIN.planEnregistrer), puis on
   valide l'action (MAGASIN.planValider) : dans un compte, tout s'inscrit au
   registre, daté et signé ; dans la démonstration, tout reste ici.
   ========================================================================== */
(function () {
  "use strict";
  var M = window.MAGASIN;
  var table = document.querySelector(".tableau-actions");
  if (!M || !table) return;
  var lignes = [].slice.call(table.querySelectorAll("tbody tr"));
  var $ = function (id) { return document.getElementById(id); };

  function aujourdhui() { var d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function jour(d) {
    if (!d) return "";
    var t = Date.parse(String(d).slice(0, 10) + "T12:00:00");
    return isNaN(t) ? d : new Date(t).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  }

  /* Le plan des réglages : les actions des sujets hors plan se cachent. */
  function suivrePlan() {
    var garde = M.lire("pco-entreprise"), E = window.PCO_ENTREPRISE;
    if (!garde || !garde.naf || !E || !window.PLAN) return;
    var vue = E.perimetre(garde.naf, garde.contexte || []);
    if (!vue) return;
    var dedans = {};
    vue.liste.forEach(function (id) { dedans[id] = 1; });
    lignes.forEach(function (tr) { tr.hidden = !dedans[tr.getAttribute("data-domaines")]; });
  }

  function etatDe(a) {
    if (!a) return "libre";
    if (a.etat === "faite") return "faite";
    return a.echeance && a.echeance < aujourdhui() ? "retard" : "ouverte";
  }

  function peindre(tr) {
    var a = M.planActions()[tr.getAttribute("data-cle")];
    var etat = etatDe(a);
    tr.setAttribute("data-etat", etat);
    var delai = tr.querySelector(".pa-delai"), resp = tr.querySelector(".pa-resp");
    // Pas encore planifiée : le délai proposé est la date d'application du
    // texte quand le texte en donne une ; sinon, il est à renseigner.
    var propose = !a && tr.getAttribute("data-application") || "";
    if (document.activeElement !== delai && !delai.getAttribute("data-touche")) delai.value = a && a.echeance ? String(a.echeance).slice(0, 10) : propose;
    tr.classList.toggle("pa-propose", !!propose && delai.value === propose);
    // Toute date de réalisation dépassée en rouge (6 novembre 2026, demande d'Axel) : enregistrée
    // ou seulement proposée (date d'application d'un texte déjà en vigueur), tant que l'action n'est pas réalisée.
    tr.classList.toggle("pa-depasse", etat !== "faite" && !!delai.value && delai.value < aujourdhui());
    if (document.activeElement !== resp) resp.value = a ? a.responsable || "" : "";
    var fini = etat === "faite";
    delai.disabled = resp.disabled = fini || lecture;
    tr.querySelector(".pa-enregistrer").hidden = fini || lecture;
    tr.querySelector(".pa-valider").hidden = fini || lecture || !a;
    tr.querySelector(".pa-etat").textContent = fini
      ? "✓ Réalisée le " + jour(a.faite_le) + (a.par && a.par !== "vous" ? " par " + a.par : "")
      : etat === "retard" ? "En retard depuis le " + jour(a.echeance)
      : etat === "ouverte" ? "À réaliser pour le " + jour(a.echeance)
      : propose && propose < aujourdhui() ? "Date d'application du texte dépassée : fixez une nouvelle date et enregistrez."
      : propose ? "Délai proposé : la date d'application du texte. Enregistrez pour le retenir."
      : "Délai à renseigner";
  }

  function compter() {
    var n = { libre: 0, ouverte: 0, retard: 0, faite: 0 };
    lignes.forEach(function (tr) { if (!tr.hidden) n[tr.getAttribute("data-etat") || "libre"]++; });
    Object.keys(n).forEach(function (k) { var el = $("pa-n-" + k); if (el) el.textContent = n[k]; });
    $("pa-n-retard").closest("div").classList.toggle("alerte", n.retard > 0);
    $("pa-n-faite").closest("div").classList.toggle("conf-vert", n.faite > 0);
    filtrer();
  }

  function filtrer() {
    var f = $("pa-filtre").value, vus = 0;
    lignes.forEach(function (tr) {
      var garde = !f || tr.getAttribute("data-etat") === f;
      tr.classList.toggle("hors-filtre", !garde);
      if (garde && !tr.hidden) vus++;
    });
    $("pa-compte").textContent = vus + " action" + (vus > 1 ? "s" : "");
  }
  $("pa-filtre").addEventListener("change", filtrer);

  var lecture = false;
  M.quandPret(function () {
    suivrePlan();
    lecture = M.mode === "compte" && M.espace && (!M.espace.ecrit || M.espace.rang < 2);
    if (lecture) {
      var p = document.querySelector(".pa-lecture");
      p.textContent = M.espace.rang < 2 ? "Le plan d'actions n'est pas compris dans votre abonnement : pour y avoir accès, changez d'abonnement (02 ou 03)."
        : "Vous êtes en lecture seule : le responsable du compte ou un utilisateur de votre entreprise planifie et valide.";
      p.hidden = false;
    }
    var garde = M.lire("pco-entreprise") || {};
    lignes.forEach(function (tr) {
      var resp = tr.querySelector(".pa-resp");
      if (garde.responsable) resp.placeholder = garde.responsable;
      peindre(tr);
      var etat = tr.querySelector(".pa-etat");
      // Une date saisie à la main n'est plus remplacée par la date proposée.
      tr.querySelector(".pa-delai").addEventListener("input", function () {
        this.setAttribute("data-touche", "1"); tr.classList.remove("pa-propose");
        tr.classList.toggle("pa-depasse", tr.getAttribute("data-etat") !== "faite" && !!this.value && this.value < aujourdhui());
      });
      tr.querySelector(".pa-enregistrer").addEventListener("click", function () {
        var delai = tr.querySelector(".pa-delai").value;
        if (!delai) { etat.textContent = "Choisissez un délai de réalisation."; tr.querySelector(".pa-delai").focus(); return; }
        var qui = resp.value.trim() || garde.responsable || "";
        var b = this; b.disabled = true; etat.textContent = "Enregistrement…";
        M.planEnregistrer(tr.getAttribute("data-cle"), tr.getAttribute("data-objet"), delai, qui).then(function (r) {
          b.disabled = false;
          if (!r.ok) { etat.textContent = r.erreur || "Impossible d'enregistrer."; return; }
          peindre(tr); compter();
        });
      });
      tr.querySelector(".pa-valider").addEventListener("click", function () {
        var b = this;
        if (!b.hasAttribute("data-sur")) { b.setAttribute("data-sur", ""); b.textContent = "Confirmer : action réalisée"; return; }
        b.disabled = true; etat.textContent = "Enregistrement…";
        M.planValider(tr.getAttribute("data-cle")).then(function (r) {
          b.disabled = false; b.removeAttribute("data-sur"); b.textContent = "Valider l'action";
          if (!r.ok) { etat.textContent = r.erreur || "Impossible d'enregistrer."; return; }
          peindre(tr); compter();
        });
      });
    });
    compter();
  });
})();
