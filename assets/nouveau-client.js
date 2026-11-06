/* ==========================================================================
   Vigie réglementaire — créer l'accès d'un client (compte/nouveau-client.html)
   --------------------------------------------------------------------------
   Le consultant crée, en une fois, l'espace de l'entreprise cliente (nom,
   code APE) et l'invitation de son responsable. La base vérifie qu'il est
   bien membre du cabinet (creer_entreprise_cliente) et qu'il peut inviter
   (inviter) ; le lien n'est montré qu'ici, une fois.
   ========================================================================== */
(function () {
  "use strict";
  var V = window.VIGIE;
  var $ = function (s) { return document.querySelector(s); };
  if (!$("#form-nc") || !V || !V.ouvert) return;
  var cabinet = null;
  var valable = function (a) { return /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(a); };

  V.session().then(function (s) {
    // Connecté : le bouton « Connexion » de l'en-tête devient « Mon compte ».
    if (s) [].forEach.call(document.querySelectorAll(".bouton-bandeau"), function (b) { b.textContent = "Mon compte"; b.href = V.pageDuSite("compte/"); });
    if (!s) { window.location.replace(V.pageDuSite("connexion.html") + "?retour=compte/nouveau-client.html"); return; }
    V.mesCabinets().then(function (r) {
      if (!r.ok) { $("#nc-cabinet").textContent = r.erreur; return; }
      if (!r.cabinets.length) { $("#nc-cabinet").textContent = ""; $("#nc-aucun").hidden = false; return; }
      var c = r.cabinets[0];
      cabinet = { id: c.cabinet_id, nom: c.nom };
      $("#nc-cabinet").textContent = "Cabinet « " + (cabinet.nom || "") + " »";
      $("#nc-principal").hidden = false;
      $("#nc-nom").focus();
      // Le nombre de clients de l'abonnement (migration 26) : atteint, on le dit.
      if (window.VIGIE_PLACES) window.VIGIE_PLACES(cabinet.id, $("#form-nc"), $("#form-nc").getAttribute("data-contact"), cabinet.nom);
    });
  });

  $("#form-nc").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var nom = $("#nc-nom").value.trim(), naf = ($("#nc-naf") || {}).value || "";
    var courriel = $("#nc-courriel").value.trim().toLowerCase(), etat = $("#nc-etat");
    if (!nom) { etat.textContent = "Entrez le nom de l'entreprise cliente."; $("#nc-nom").focus(); return; }
    if (!courriel) { etat.textContent = "Entrez l'e-mail de son responsable : il en a besoin pour créer son compte."; $("#nc-courriel").focus(); return; }
    if (!valable(courriel)) { etat.textContent = "L'adresse e-mail est à vérifier."; $("#nc-courriel").focus(); return; }
    var bouton = this.querySelector("button[type=submit]");
    bouton.disabled = true; etat.textContent = "Création de l'espace…";
    V.rpc("creer_entreprise_cliente", { cabinet: cabinet.id, denomination: nom, naf: naf || null }).then(function (r) {
      if (!r.ok) { bouton.disabled = false; etat.textContent = r.erreur; return; }
      var entreprise = r.donnees;
      var fin = function (lien, erreur) {
        bouton.disabled = false; etat.textContent = "";
        $("#form-nc").hidden = true; document.querySelector(".nc-aide").hidden = true;
        $("#nc-fait").hidden = false;
        $("#nc-fait-titre").textContent = "L'accès de « " + nom + " » est créé";
        $("#nc-fait-texte").textContent = lien
          ? "Un e-mail d'invitation part à " + courriel + " dans les minutes qui suivent : il y crée son compte et devient le responsable du compte de son entreprise. Le lien ci-dessous est le même (valable 7 jours, une seule fois), si vous préférez aussi l'envoyer vous-même."
          : (erreur ? "L'espace est créé, mais l'invitation n'a pas pu l'être : " + erreur + " Vous pourrez inviter son responsable depuis le tableau de bord."
                    : "Son espace est prêt. Invitez votre client quand vous voulez, depuis le tableau de bord.") +
            (naf ? "" : " Pensez à régler son code APE dans son espace (Réglages).");
        $("#nc-lien-bloc").hidden = !lien;
        if (lien) {
          $("#nc-lien").value = lien;
          $("#nc-courriel-lien").href = "mailto:" + encodeURIComponent(courriel) +
            "?subject=" + encodeURIComponent("Votre espace de veille réglementaire « " + nom + " »") +
            "&body=" + encodeURIComponent("Bonjour,\n\n" + cabinet.nom + " a ouvert l'espace de « " + nom +
              " » sur Vigie réglementaire, l'outil de veille réglementaire que nous utilisons pour votre suivi QSE.\n\n" +
              "Pour y entrer, ouvrez ce lien (valable 7 jours) :\n" + lien +
              "\n\nVous y créerez votre compte avec cette adresse : " + courriel +
              ". Vous verrez votre veille réglementaire, votre plan d'actions et votre registre de conformité.\n\nBien cordialement,");
        }
        $("#nc-ouvrir").onclick = function () { V.choisir(entreprise); };
        $("#nc-fait").scrollIntoView({ block: "start" });
      };
      if (!courriel) { fin(""); return; }
      etat.textContent = "Création de l'invitation…";
      V.rpc("inviter", { courriel: courriel, role: "admin", entreprise: entreprise }).then(function (x) {
        if (!x.ok) { fin("", x.erreur); return; }
        fin(V.pageDuSite("compte/invitation.html") + "#jeton=" + encodeURIComponent(x.donnees));
      });
    });
  });

  $("#nc-copier").addEventListener("click", function () {
    var l = $("#nc-lien"), b = this;
    (navigator.clipboard ? navigator.clipboard.writeText(l.value) : Promise.reject()).then(function () {
      b.textContent = "Lien copié";
    }).catch(function () { l.select(); document.execCommand && document.execCommand("copy"); b.textContent = "Lien copié"; });
  });
  $("#nc-autre").addEventListener("click", function () {
    $("#form-nc").reset(); $("#form-nc").hidden = false; document.querySelector(".nc-aide").hidden = false;
    $("#nc-fait").hidden = true; $("#nc-copier").textContent = "Copier le lien"; $("#nc-nom").focus();
  });
})();
