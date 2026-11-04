/* Vigie réglementaire — ne plus recevoir le récapitulatif ou les rappels
   (compte/recap.html?j=<jeton>[&quoi=rappels]), sans connexion. */
(function () {
  "use strict";
  var etat = document.getElementById("recap-etat");
  var V = window.VIGIE;
  if (!etat) return;
  var p = new URLSearchParams(window.location.search);
  var jeton = p.get("j") || "", quoi = p.get("quoi") === "rappels" ? "rappels" : "recap";
  var nom = quoi === "rappels" ? "les rappels des actions en retard" : "le récapitulatif quotidien";
  if (!/^[0-9a-f-]{36}$/i.test(jeton) || !V || !V.ouvert) {
    etat.textContent = "Ce lien n'est pas valide. Vous pouvez régler vos e-mails dans Mon compte, une fois connecté.";
    return;
  }
  V.rpcPublic("recap_desabonner", { jeton: jeton, quoi: quoi }).then(function (r) {
    etat.textContent = r.ok && r.donnees === true
      ? "C'est fait : vous ne recevrez plus " + nom + ". Vous pouvez le réactiver à tout moment dans Mon compte."
      : "Ce lien n'est plus valide. Vous pouvez régler vos e-mails dans Mon compte, une fois connecté.";
  });
})();
