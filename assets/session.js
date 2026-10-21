/* ==========================================================================
   Pierrel & Co — la « session »
   --------------------------------------------------------------------------
   AVERTISSEMENT. Ceci n'est pas une sécurité, et ne doit jamais être présenté
   comme telle. Il n'y a pas de serveur : ce fichier pose un jeton dans le
   navigateur et retire un voile posé au-dessus du contenu. Le contenu des
   pages de l'application est servi à tout le monde et reste lisible dans la
   source de la page.

   C'est assumé pour une démonstration, et c'est écrit sur les écrans concernés.
   Une vraie protection suppose un service d'authentification et un serveur qui
   refuse de servir la page sans jeton valide.
   ========================================================================== */

(function () {
  "use strict";
  var CLE = "pco-session";

  function ouverte() {
    try { return window.localStorage.getItem(CLE) === "demo"; } catch (e) { return false; }
  }

  function ouvrir() {
    try { window.localStorage.setItem(CLE, "demo"); } catch (e) { /* sans effet */ }
  }

  function fermer() {
    try { window.localStorage.removeItem(CLE); } catch (e) { /* sans effet */ }
  }

  /* Dans l'application : on retire le voile si la session est ouverte. */
  var verrou = document.getElementById("verrou");
  if (verrou) {
    if (ouverte()) verrou.remove();
    else document.body.classList.add("verrouille");
  }

  /* Sur la page de connexion : le bouton ouvre la session puis entre. */
  var bouton = document.getElementById("entrer-demo");
  if (bouton) {
    var etat = document.getElementById("etat-session");
    if (etat && ouverte()) etat.textContent = "Une session de démonstration est déjà ouverte.";
    bouton.addEventListener("click", function () {
      ouvrir();
      window.location.href = "app/index.html";
    });
  }

  window.PCO_SESSION = { ouverte: ouverte, ouvrir: ouvrir, fermer: fermer };
})();
