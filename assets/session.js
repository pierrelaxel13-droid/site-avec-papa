/* ==========================================================================
   Vigie — la session et la formule, dans l'application
   --------------------------------------------------------------------------
   Deux cas :
   - /demo/ : la démonstration. La « formule » choisie est rangée dans le
     navigateur et retire un voile. Ce n'est PAS une sécurité, et ne doit
     jamais être présenté comme telle : c'est une visite.
   - /app/  : l'espace d'un vrai compte. Sans session Supabase, on part à la
     connexion ; la formule est celle que l'entreprise a payée, lue dans la
     base (mes_acces(), par assets/vigie.js) pour l'espace choisi.

   Ce qui protège les DONNÉES d'un abonné, ce sont les règles de la base
   (supabase/), pas ce voile : les pages elles-mêmes sont publiques, comme le
   code du site.
   ========================================================================== */

(function () {
  "use strict";
  var CLE = "pco-session";
  var CLE_DEMO_CONSULTANT = "pco-demo-consultant";

  // Mêmes clés et mêmes rangs que FORMULES dans build.mjs.
  var FORMULES = {
    textes:  { l: "Textes", rang: 1 },
    suivi:   { l: "Textes et suivi", rang: 2 },
    complet: { l: "Veille complète", rang: 3 }
  };
  var CHEMIN = window.location.pathname;
  var DANS_APP = CHEMIN.indexOf("/app/") !== -1;
  var racine = document.body.getAttribute("data-racine") || "./";
  function cleDuRang(rang) {
    for (var k in FORMULES) if (FORMULES[k].rang === rang) return k;
    return null;
  }

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

  var verrou = document.getElementById("verrou");
  function ecrire(id, texte) { var el = document.getElementById(id); if (el) el.textContent = texte; }

  /* --- Dans l'application : le voile, et ce qu'il dit ----------------------- */
  function appliquer(active, compte) {
  if (verrou) {
    var exigee = document.body.getAttribute("data-formule") || "textes";
    var assez = active && FORMULES[active].rang >= (FORMULES[exigee] || FORMULES.textes).rang;

    if (assez) {
      verrou.remove();
      document.body.classList.remove("verrouille");   // posée pendant la vérification du compte
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
          texte.textContent = (compte ? "Votre formule est « " : "Votre démonstration est ouverte en « ") +
            FORMULES[active].l + " », qui ne comprend pas cet écran. " +
            (compte ? "Une formule plus complète l'ouvre : voyez la grille des tarifs."
                    : "Changez de formule pour le voir, ou consultez la grille des tarifs.");
        }
        if (action) {
          action.textContent = compte ? "Mon compte" : "Changer de formule";
          if (compte) action.href = racine + "compte/";
        }
      }
    }

    if (compte) {
      var demo = document.querySelector('.bandeau-demo[data-mode="demo"]');
      var vrai = document.querySelector('.bandeau-demo[data-mode="compte"]');
      if (demo && vrai) {
        demo.hidden = true; vrai.hidden = false;
        var fc = vrai.querySelector("[data-formule-compte]");
        if (fc) fc.textContent = "Formule « " + FORMULES[active].l + " ».";
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
  }

  /* Le voile sans formule : ce qui manque, et où le régler. Rien de ce que
     la formule ouvrirait (la cloche) ne reste visible. */
  function sansFormule(titre, texte, libelle, cible) {
    var parts = document.querySelectorAll("[data-exige]");
    for (var k = 0; k < parts.length; k++) parts[k].hidden = true;
    if (!verrou) return;
    document.body.classList.add("verrouille");
    ecrire("verrou-etiq", "Votre compte");
    ecrire("verrou-titre", titre);
    ecrire("verrou-texte", texte);
    var action = document.getElementById("verrou-action");
    if (action) { action.textContent = libelle; action.href = racine + cible; }
    var tarifs = document.getElementById("verrou-tarifs");
    if (tarifs) tarifs.hidden = cible === "abonnement.html";
  }

  if (!DANS_APP) {
    appliquer(lu(), false);
    bandeauDemoConsultant();
  } else if (!window.VIGIE || !window.VIGIE.ouvert) {
    // Pas de base configurée : le voile reste, avec la démonstration.
    appliquer(null, false);
  } else {
    // Un vrai compte : le bandeau « Démonstration » ne le concerne jamais.
    var bandeauDemo = document.querySelector('.bandeau-demo[data-mode="demo"]');
    if (bandeauDemo) bandeauDemo.hidden = true;
    if (verrou) {
      document.body.classList.add("verrouille");
      ecrire("verrou-etiq", "Un instant");
      ecrire("verrou-titre", "Ouverture de votre espace…");
      ecrire("verrou-texte", "");
    }
    window.VIGIE.session().then(function (s) {
      if (!s) {
        window.location.replace(racine + "connexion.html?retour=" + encodeURIComponent(ici()));
        return;
      }
      return window.VIGIE.espaceChoisi().then(function (r) {
        if (!r.ok) {
          sansFormule("Votre espace n'a pas pu s'ouvrir", r.erreur, "Réessayer", ici());
          return;
        }
        var e = r.entreprise;
        if (!e) {
          return window.VIGIE.mesCabinets().then(function (c) {
            if (c.ok && c.cabinets.length) {
              sansFormule("Choisissez d'abord un client",
                "Vous entrez dans l'espace d'un client depuis votre cabinet : c'est là que vous les créez et les ouvrez.",
                "Mon cabinet", "compte/cabinet.html");
            } else {
              sansFormule("Il reste à nommer votre entreprise",
                "C'est elle qui porte l'abonnement, le plan de veille et le registre. Cela se fait en une ligne, dans votre compte.",
                "Mon compte", "compte/");
            }
          });
        }
        consultant(e);
        if (!e.rang && e.role === "consultant") {
          sansFormule("L'abonnement de votre cabinet n'est pas encore ouvert",
            "L'espace de « " + e.denomination + " » s'ouvre avec lui. Votre page cabinet dit comment l'ouvrir.",
            "Mon cabinet", "compte/cabinet.html");
        } else if (!e.rang) {
          sansFormule("Votre espace ouvre avec l'abonnement",
            "Le compte de « " + e.denomination + " » est prêt. Choisissez votre formule : l'espace s'ouvre dès qu'elle est active.",
            "Choisir ma formule", "abonnement.html");
        } else {
          appliquer(cleDuRang(e.rang), true);
        }
      });
    });
  }
  function ici() { return CHEMIN.slice(CHEMIN.indexOf("/app/") + 1); }

  /* La démonstration consultant (demo/cabinet.html) : « Ouvrir son espace »
     ouvre la démonstration en veille complète, vue par le cabinet fictif ; le
     bandeau le dit sur chaque écran. Entrer par la page des tarifs l'efface. */
  var versClient = document.querySelectorAll("[data-demo-consultant]");
  for (var v = 0; v < versClient.length; v++) {
    versClient[v].addEventListener("click", function (ev) {
      ouvrir("complet");
      var l = ev.currentTarget;
      try {
        window.localStorage.setItem(CLE_DEMO_CONSULTANT, JSON.stringify({
          cabinet: l.getAttribute("data-demo-consultant"), client: l.getAttribute("data-demo-client") }));
      } catch (e) { /* bandeau ordinaire */ }
    });
  }
  function bandeauDemoConsultant() {
    var b = document.querySelector('.bandeau-demo[data-mode="demo"]');
    var vu = null;
    try { vu = JSON.parse(window.localStorage.getItem(CLE_DEMO_CONSULTANT)); } catch (e) { vu = null; }
    if (!b || !vu || !vu.cabinet || CHEMIN.indexOf("/demo/") === -1) return;
    var cabinet = vu.cabinet, nom = vu.client || "votre client";
    b.textContent = "";
    var fort = document.createElement("strong");
    fort.textContent = "Démonstration consultant — espace de « " + nom + " ».";
    b.appendChild(fort);
    b.appendChild(document.createTextNode(" Vous y êtes en tant que consultant (" + cabinet +
      ", fictif) : avec un vrai compte, ce que vous cochez entre à son registre, à votre nom. Ici, données fictives. "));
    var retour = document.createElement("a");
    retour.href = racine + "demo/cabinet.html";
    retour.textContent = "Revenir au cabinet";
    b.appendChild(retour);
    b.classList.add("bandeau-consultant");
  }

  /* Chez un client, le consultant le voit en haut de chaque écran : de qui
     est cet espace, et le chemin du retour vers son cabinet. */
  function consultant(e) {
    var vrai = document.querySelector('.bandeau-demo[data-mode="compte"]');
    if (!vrai || e.role !== "consultant") return;
    vrai.textContent = "";
    var fort = document.createElement("strong");
    fort.textContent = "Espace de « " + e.denomination + " ».";
    vrai.appendChild(fort);
    vrai.appendChild(document.createTextNode(" Vous y êtes en tant que consultant" +
      (e.cabinet ? " (" + e.cabinet + ")" : "") + " : ce que vous cochez entre à son registre, à votre nom. "));
    var retour = document.createElement("a");
    retour.href = racine + "compte/cabinet.html";
    retour.textContent = "Revenir à mon cabinet";
    vrai.appendChild(retour);
    vrai.classList.add("bandeau-consultant");
  }

  /* --- Sur la page des tarifs : ouvrir la démonstration ------------------------ */
  var bouton = document.getElementById("entrer-demo");
  if (bouton) {
    var active = lu();
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
      try { window.localStorage.removeItem(CLE_DEMO_CONSULTANT); } catch (e) { /* rien */ }
      var coche = document.querySelector('input[name="formule"]:checked');
      var f = ouvrir(coche ? coche.value : "complet");
      // Le tableau de bord n'est pas dans « Textes » : on entre par le relevé.
      window.location.href = FORMULES[f].rang >= 2 ? "demo/index.html" : "demo/releve.html";
    });
  }

  window.PCO_SESSION = { formule: lu, ouvrir: ouvrir, fermer: fermer };
})();
