/* ==========================================================================
   Vigie réglementaire — démonstration consultant : créer l'accès d'un client
   --------------------------------------------------------------------------
   Sur demo/nouveau-client.html : le même formulaire que dans un vrai compte,
   mais rien n'est créé ni envoyé ; le lien d'invitation est fictif. Le client
   créé est gardé dans ce navigateur seulement, pour apparaître dans le
   tableau de bord de demo/cabinet.html.
   ========================================================================== */
(function () {
  "use strict";
  var CLE = "vigie-demo-clients";
  var $ = function (s) { return document.querySelector(s); };
  function lire() { try { return JSON.parse(window.localStorage.getItem(CLE) || "[]"); } catch (e) { return []; } }
  function garder(l) { try { window.localStorage.setItem(CLE, JSON.stringify(l.slice(-10))); } catch (e) { /* sans effet */ } }

  /* --- Le tableau de bord de la démonstration : les clients ajoutés ici ---- */
  var lignes = $("#cs-lignes");
  if (lignes && !$("#form-nc")) {
    var ajoutes = lire();
    ajoutes.forEach(function (c) {
      var tr = document.createElement("tr");
      tr.className = "cs-nouveau";
      var th = document.createElement("th"); th.scope = "row";
      var n = document.createElement("span"); n.className = "cs-nom"; n.textContent = c.nom; th.appendChild(n);
      var d = document.createElement("span"); d.className = "cs-detail"; d.textContent = c.naf ? "Code APE " + c.naf : "Code APE à régler"; th.appendChild(d);
      tr.appendChild(th);
      var td = document.createElement("td"); td.colSpan = 3; td.className = "cs-coupe";
      td.textContent = c.courriel ? "Invitation envoyée à " + c.courriel + " : en attente de son compte" : "Espace créé : responsable à inviter";
      tr.appendChild(td);
      var tdo = document.createElement("td"); tdo.className = "cs-ouvrir"; tdo.textContent = "Nouveau";
      tr.appendChild(tdo);
      lignes.insertBefore(tr, lignes.firstChild);
    });
    var nb = $("#cs-clients");
    if (nb && ajoutes.length) nb.textContent = String((parseInt(nb.textContent, 10) || 0) + ajoutes.length);
    return;
  }

  /* --- Le formulaire ------------------------------------------------------- */
  var form = $("#form-nc");
  if (!form) return;
  var cabinet = (document.querySelector("[data-demo-cabinet]") || {}).getAttribute ? document.querySelector("[data-demo-cabinet]").getAttribute("data-demo-cabinet") : "Votre cabinet";
  var valable = function (a) { return /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(a); };

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var nom = $("#nc-nom").value.trim(), naf = ($("#nc-naf") || {}).value || "";
    var courriel = $("#nc-courriel").value.trim().toLowerCase(), etat = $("#nc-etat");
    if (!nom) { etat.textContent = "Entrez le nom de l'entreprise cliente."; $("#nc-nom").focus(); return; }
    if (!courriel) { etat.textContent = "Entrez l'e-mail de son responsable : il en a besoin pour créer son compte."; $("#nc-courriel").focus(); return; }
    if (!valable(courriel)) { etat.textContent = "L'adresse e-mail est à vérifier."; $("#nc-courriel").focus(); return; }
    var l = lire(); l.push({ nom: nom, naf: naf, courriel: courriel }); garder(l);
    etat.textContent = "";
    form.hidden = true; document.querySelector(".nc-aide").hidden = true;
    $("#nc-fait").hidden = false;
    $("#nc-fait-titre").textContent = "L'accès de « " + nom + " » est créé";
    $("#nc-fait-texte").textContent = (courriel
      ? "Dans un vrai compte, vous envoyez ce lien à " + courriel + " : valable 7 jours, il ne sert qu'une fois. Il y crée son compte et devient l'administrateur de son espace."
      : "Dans un vrai compte, son espace serait prêt et vous inviteriez son responsable quand vous voulez.") +
      " Démonstration : rien n'a été créé ni envoyé.";
    $("#nc-lien-bloc").hidden = !courriel;
    if (courriel) {
      var lien = new URL("../compte/invitation.html", window.location.href).href + "#jeton=DEMONSTRATION";
      $("#nc-lien").value = lien;
      $("#nc-courriel-lien").href = "mailto:" + encodeURIComponent(courriel) +
        "?subject=" + encodeURIComponent("Votre espace de veille réglementaire « " + nom + " »") +
        "&body=" + encodeURIComponent("Bonjour,\n\n" + cabinet + " a ouvert l'espace de « " + nom +
          " » sur Vigie réglementaire, l'outil de veille réglementaire que nous utilisons pour votre suivi QSE.\n\n" +
          "Pour y entrer, ouvrez ce lien (valable 7 jours) :\n" + lien +
          "\n\n(Démonstration : ce lien est fictif.)\n\nBien cordialement,");
    }
    $("#nc-ouvrir").href = "index.html";
    $("#nc-fait").scrollIntoView({ block: "start" });
  });
  $("#nc-copier").addEventListener("click", function () {
    var l = $("#nc-lien"), b = this;
    (navigator.clipboard ? navigator.clipboard.writeText(l.value) : Promise.reject()).then(function () { b.textContent = "Lien copié"; })
      .catch(function () { l.select(); b.textContent = "Lien copié"; });
  });
  $("#nc-autre").addEventListener("click", function () {
    form.reset(); form.hidden = false; document.querySelector(".nc-aide").hidden = false;
    $("#nc-fait").hidden = true; $("#nc-copier").textContent = "Copier le lien"; $("#nc-nom").focus();
  });
})();
