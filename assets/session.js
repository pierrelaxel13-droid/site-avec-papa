/* ==========================================================================
   Pierrel & Co — la « session » et la formule
   --------------------------------------------------------------------------
   AVERTISSEMENT, à lire avant de toucher à ce fichier.

   Ceci n'est pas une sécurité, et ne doit jamais être présenté comme telle.
   Il n'y a pas de serveur : ce fichier pose un jeton dans le navigateur et
   retire un voile posé au-dessus du contenu. Les pages de l'application sont
   servies à tout le monde et restent lisibles dans la source, quelle que soit
   la formule choisie.

   Le tri par formule décrit le produit — qui voit quoi — il ne le protège pas.
   Une vraie protection suppose un service d'authentification et un serveur qui
   refuse de servir la page sans jeton valide.

   Le mot de passe de l'écran de connexion n'est lu nulle part, n'est transmis
   nulle part et n'est enregistré nulle part. Le champ est vidé dès l'envoi.
   ========================================================================== */

(function () {
  "use strict";
  var CLE = "pco-session";

  var FORMULES = {
    cadrage: { l: "Cadrage", rang: 1 },
    veille:  { l: "Veille tenue", rang: 2 },
    preuves: { l: "Veille et preuves", rang: 3 }
  };

  function lu() {
    try {
      var v = window.localStorage.getItem(CLE);
      if (!v) return null;
      // Les sessions d'avant les formules portaient la chaîne « demo ».
      if (v === "demo") return "preuves";
      var o = JSON.parse(v);
      return FORMULES[o && o.formule] ? o.formule : "preuves";
    } catch (e) { return null; }
  }

  function ouvrir(formule) {
    var f = FORMULES[formule] ? formule : "preuves";
    try { window.localStorage.setItem(CLE, JSON.stringify({ formule: f })); } catch (e) { /* sans effet */ }
    return f;
  }

  function fermer() {
    try { window.localStorage.removeItem(CLE); } catch (e) { /* sans effet */ }
  }

  var active = lu();

  /* --- Dans l'application : le voile, et ce qu'il dit ----------------------- */
  var verrou = document.getElementById("verrou");
  if (verrou) {
    var exigee = document.body.getAttribute("data-formule") || "cadrage";
    var assez = active && FORMULES[active].rang >= (FORMULES[exigee] || FORMULES.cadrage).rang;

    if (assez) {
      verrou.remove();
    } else {
      document.body.classList.add("verrouille");
      if (active) {
        // Session ouverte, mais la formule n'ouvre pas cet écran : le dire
        // précisément vaut mieux que de redemander une connexion déjà faite.
        var titre = document.getElementById("verrou-titre");
        var texte = document.getElementById("verrou-texte");
        var etiq = document.getElementById("verrou-etiq");
        var action = document.getElementById("verrou-action");
        if (etiq) etiq.textContent = "Formule " + FORMULES[active].l;
        if (titre) titre.textContent = "Cet écran fait partie de la formule " + FORMULES[exigee].l;
        if (texte) {
          texte.textContent = "Votre démonstration est ouverte en « " + FORMULES[active].l +
            " », qui ne comprend pas cet écran. Changez de formule pour le voir, " +
            "ou consultez la grille des tarifs.";
        }
        if (action) action.textContent = "Changer de formule";
      }
    }

    var banniere = document.getElementById("formule-active");
    if (banniere && active) {
      banniere.textContent = "Formule « " + FORMULES[active].l + " ».";
    }

    /* Les écrans qu'elle n'ouvre pas sont marqués dans le menu, plutôt que de
       laisser cliquer vers un voile. */
    if (active) {
      var exige = {
        "index.html": "veille", "plan.html": "cadrage", "releve.html": "veille",
        "registre.html": "preuves", "secteurs.html": "cadrage"
      };
      var liens = document.querySelectorAll(".bandeau .menu a[href]");
      for (var i = 0; i < liens.length; i++) {
        var fichier = liens[i].getAttribute("href").split("/").pop();
        var besoin = exige[fichier];
        if (besoin && FORMULES[active].rang < FORMULES[besoin].rang) {
          liens[i].classList.add("hors-formule");
          liens[i].title = "Formule " + FORMULES[besoin].l;
        }
      }
    }
  }

  /* --- Sur la page de connexion -------------------------------------------- */
  var bouton = document.getElementById("entrer-demo");
  if (bouton) {
    var etat = document.getElementById("etat-session");
    if (etat && active) {
      etat.textContent = "Une démonstration est déjà ouverte en « " + FORMULES[active].l + " ».";
    }
    // On recoche la formule déjà ouverte : revenir ici ne doit pas la perdre.
    if (active) {
      var deja = document.querySelector('input[name="formule"][value="' + active + '"]');
      if (deja) deja.checked = true;
    }
    bouton.addEventListener("click", function () {
      var coche = document.querySelector('input[name="formule"]:checked');
      ouvrir(coche ? coche.value : "preuves");
      window.location.href = "app/index.html";
    });
  }

  /* Le formulaire de connexion est une maquette : il ne lit pas le mot de
     passe, ne l'envoie nulle part, et le vide aussitôt. */
  var form = document.getElementById("form-connexion");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var mdp = document.getElementById("motdepasse");
      if (mdp) mdp.value = "";
      var dit = document.getElementById("etat-connexion");
      if (dit) {
        dit.textContent = "Aucun compte n'existe encore : rien n'a été vérifié, " +
          "rien n'a été envoyé, et le champ du mot de passe vient d'être vidé. " +
          "Entrez en démonstration ci-dessous.";
      }
      var demo = document.getElementById("entrer-demo");
      if (demo) demo.focus();
    });
  }

  window.PCO_SESSION = { formule: lu, ouvrir: ouvrir, fermer: fermer };
})();
