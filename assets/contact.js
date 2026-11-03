/* ==========================================================================
   Vigie — le formulaire de contact (accueil, #contact)
   --------------------------------------------------------------------------
   Envoie le message à la base par public.contacter() (sans compte). Rien ne
   part par courriel d'ici : les messages se lisent dans l'espace
   administrateur. Sans base joignable, le formulaire dit d'écrire directement.
   ========================================================================== */
(function () {
  "use strict";
  var form = document.getElementById("form-contact");
  if (!form) return;
  var V = window.VIGIE;
  var $ = function (id) { return document.getElementById(id); };
  var etat = $("etat-contact");
  var courriel = document.body.getAttribute("data-courriel") || "";

  function dire(t, ko) { etat.textContent = t; etat.classList.toggle("etat-erreur", !!ko); }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var v = {
      nom: $("c-nom").value.trim(), entreprise: $("c-entreprise").value.trim(),
      courriel: $("c-courriel").value.trim().toLowerCase(), telephone: $("c-telephone").value.trim(),
      objet: $("c-objet").value, message: $("c-message").value.trim()
    };
    if (!v.nom) { dire("Indiquez votre nom.", true); $("c-nom").focus(); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.courriel)) { dire("Indiquez une adresse électronique valable.", true); $("c-courriel").focus(); return; }
    if (!v.message) { dire("Écrivez votre message.", true); $("c-message").focus(); return; }
    if (!$("c-accord").checked) { dire("Cochez l'accord pour que nous puissions vous répondre.", true); return; }
    if ($("c-site").value) { merci(); return; }       // un robot a rempli le piège : on ne l'enregistre pas
    if (!V || !V.ouvert) { dire("L'envoi n'est pas possible pour le moment : écrivez-nous à " + courriel + ".", true); return; }
    var b = form.querySelector("button[type=submit]");
    b.disabled = true;
    dire("Envoi…");
    V.rpcPublic("contacter", v).then(function (r) {
      b.disabled = false;
      if (!r.ok) { dire((r.erreur || "L'envoi n'a pas abouti.") + " Vous pouvez aussi écrire à " + courriel + ".", true); return; }
      merci();
    });
  });

  function merci() {
    form.hidden = true;
    var m = $("contact-merci");
    m.hidden = false;
    m.focus();
  }
})();
