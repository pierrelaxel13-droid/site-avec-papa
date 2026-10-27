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

  // Mêmes clés et mêmes rangs que FORMULES dans build.mjs.
  var FORMULES = {
    textes:  { l: "Textes", rang: 1 },
    suivi:   { l: "Textes et suivi", rang: 2 },
    complet: { l: "Veille complète", rang: 3 }
  };
  // Les noms d'avant la grille du 27 octobre 2026, encore dans des navigateurs.
  var ANCIENNES = { cadrage: "textes", veille: "suivi", preuves: "complet", demo: "complet" };

  function lu() {
    try {
      var v = window.localStorage.getItem(CLE);
      if (!v) return null;
      // Les sessions d'avant les formules portaient la chaîne « demo ».
      if (v === "demo") return "complet";
      var o = JSON.parse(v), f = o && (ANCIENNES[o.formule] || o.formule);
      return FORMULES[f] ? f : "complet";
    } catch (e) { return null; }
  }

  function ouvrir(formule) {
    var f = FORMULES[ANCIENNES[formule] || formule] ? (ANCIENNES[formule] || formule) : "complet";
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
    var exigee = document.body.getAttribute("data-formule") || "textes";
    var assez = active && FORMULES[active].rang >= (FORMULES[exigee] || FORMULES.textes).rang;

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
        "index.html": "suivi", "plan.html": "suivi", "releve.html": "textes",
        "registre.html": "complet", "secteurs.html": "textes",
        "textes.html": "textes", "reglages.html": "textes"
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

  /* Ce qu'une formule n'ouvre pas, à l'intérieur d'un écran qu'elle ouvre :
     la cloche et l'onglet « Mes alertes » sont de « Textes et suivi ». */
  if (active) {
    var parts = document.querySelectorAll("[data-exige]");
    for (var k = 0; k < parts.length; k++) {
      var req = FORMULES[parts[k].getAttribute("data-exige")];
      if (req && FORMULES[active].rang < req.rang) parts[k].hidden = true;
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
      var f = ouvrir(coche ? coche.value : "complet");
      // Le tableau de bord n'est pas dans « Textes » : on entre par le relevé.
      window.location.href = FORMULES[f].rang >= 2 ? "app/index.html" : "app/releve.html";
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
