/* ==========================================================================
   Pierrel & Co — les comptes, côté page
   --------------------------------------------------------------------------
   Trois pages : la connexion, « Bienvenue » (créer son mot de passe après le
   paiement) et « Cet écran n'est pas dans votre formule ». Elles parlent au
   serveur par /api/… (functions/ sur Cloudflare). Sur une adresse sans
   serveur — GitHub Pages —, ces routes n'existent pas : la page le dit et
   propose la démonstration, au lieu de faire semblant.

   Le mot de passe ne fait que passer : il part au serveur en HTTPS, n'est
   gardé ni dans la page ni dans le navigateur, et le champ est vidé.
   ========================================================================== */
(function () {
  "use strict";
  var $ = function (s) { return document.querySelector(s); };
  var racine = document.body.getAttribute("data-racine") || "./";
  var api = function (route) { return racine + "api/" + route; };
  /* Après le serveur, les adresses de l'espace sont absolues (/app/…) :
     on les rend relatives à la racine du site. */
  var vers = function (chemin) { return racine + String(chemin || "app/").replace(/^\//, ""); };

  function envoie(route, donnees) {
    return fetch(api(route), {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(donnees)
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { j.statut = r.status; return j; });
    });
  }

  /* Le serveur est-il là ? 404 ou 405 : cette adresse n'a pas de serveur. */
  function moi() {
    return fetch(api("moi"), { credentials: "same-origin" }).then(function (r) {
      if (!r.ok) return { absent: true };
      return r.json().catch(function () { return { absent: true }; });
    }).catch(function () { return { absent: true }; });
  }

  /* --- Connexion ----------------------------------------------------------- */
  var form = $("#form-connexion");
  if (form) {
    var etat = $("#etat-connexion");
    var params = new URLSearchParams(window.location.search);
    // On ne revient que dans l'espace : jamais vers une adresse extérieure.
    var retour = params.get("retour");
    if (!retour || !/^\/app\//.test(retour)) retour = null;
    if (params.get("fin")) etat.textContent = "Votre abonnement n'est plus actif : l'espace est fermé.";

    moi().then(function (m) {
      if (m.absent) {
        $("#connexion-fermee").hidden = false;
        form.setAttribute("data-ferme", "");
        return;
      }
      if (m.connecte) {
        var deja = $("#connexion-deja");
        deja.innerHTML = "";
        var t = document.createElement("strong");
        t.textContent = "Vous êtes connecté (" + m.courriel + "). ";
        var lien = document.createElement("a");
        lien.href = vers(m.accueil); lien.textContent = "Aller à mon espace";
        var sortie = document.createElement("a");
        sortie.href = api("deconnexion"); sortie.textContent = "Se déconnecter";
        deja.appendChild(t); deja.appendChild(lien);
        deja.appendChild(document.createTextNode(" · ")); deja.appendChild(sortie);
        deja.hidden = false;
      }
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var mdp = $("#motdepasse");
      if (form.hasAttribute("data-ferme")) {
        mdp.value = "";
        etat.textContent = "Les comptes ne sont pas encore ouverts ici : rien n'a été envoyé.";
        return;
      }
      var courriel = $("#courriel").value.trim();
      if (!courriel || !mdp.value) { etat.textContent = "Entrez votre adresse et votre mot de passe."; return; }
      etat.textContent = "Connexion…";
      envoie("connexion", { courriel: courriel, motdepasse: mdp.value }).then(function (r) {
        mdp.value = "";
        if (r.ok) { window.location.href = vers(retour || r.accueil); return; }
        etat.textContent = r.erreur || "La connexion n'a pas abouti. Réessayez.";
      }).catch(function () {
        mdp.value = "";
        etat.textContent = "Le serveur ne répond pas. Vérifiez votre connexion et réessayez.";
      });
    });
  }

  /* --- Bienvenue : créer son mot de passe ------------------------------------ */
  var fb = $("#form-bienvenue");
  if (fb) {
    var etatB = $("#etat-bienvenue");
    var session = new URLSearchParams(window.location.search).get("session") || "";
    var dire = function (texte) { etatB.textContent = texte; };

    if (!session) {
      dire("Ce lien est incomplet. Utilisez le lien reçu après le paiement, ou écrivez-nous.");
    } else {
      fetch(api("bienvenue") + "?session=" + encodeURIComponent(session), { credentials: "same-origin" })
        .then(function (r) {
          if (r.status === 404 || r.status === 405) return { absent: true };
          return r.json().catch(function () { return {}; });
        })
        .then(function (j) {
          if (j.absent) { dire("Les comptes ne sont pas encore ouverts sur cette adresse. Écrivez-nous : votre paiement est bien enregistré."); return; }
          if (j.erreur) { dire(j.erreur); return; }
          if (j.existe) {
            etatB.innerHTML = "";
            etatB.appendChild(document.createTextNode("Votre compte existe déjà. "));
            var a = document.createElement("a"); a.href = racine + "connexion.html"; a.textContent = "Connectez-vous";
            etatB.appendChild(a);
            return;
          }
          dire("");
          $("#b-courriel").value = j.courriel;
          $("#bienvenue-formule").textContent = "Votre formule : « " + j.libelle + " ».";
          $("#bienvenue-champs").hidden = false;
          $("#b-motdepasse").focus();
        })
        .catch(function () { dire("Le serveur ne répond pas. Réessayez dans un instant."); });
    }

    fb.addEventListener("submit", function (e) {
      e.preventDefault();
      var m1 = $("#b-motdepasse"), m2 = $("#b-confirme");
      if (m1.value.length < 10) { dire("Le mot de passe doit faire au moins 10 caractères."); return; }
      if (m1.value !== m2.value) { dire("Les deux mots de passe ne sont pas les mêmes."); return; }
      dire("Création du compte…");
      envoie("bienvenue", { session: session, motdepasse: m1.value }).then(function (r) {
        m1.value = ""; m2.value = "";
        if (r.ok) { window.location.href = vers(r.accueil); return; }
        dire(r.erreur || "Le compte n'a pas pu être créé. Réessayez.");
      }).catch(function () { dire("Le serveur ne répond pas. Réessayez dans un instant."); });
    });
  }

  /* --- La formule ne suffit pas ---------------------------------------------- */
  var manque = $("#formule-manque");
  if (manque) {
    var infos = {};
    try { infos = JSON.parse(manque.getAttribute("data-formules")); } catch (e) { /* texte par défaut */ }
    var p = new URLSearchParams(window.location.search);
    var exige = infos[p.get("exige")], active = infos[p.get("active")];
    if (exige) {
      manque.textContent = "Il fait partie de la formule « " + exige.l + " » (" + exige.prix + ")" +
        (active ? ". Vous êtes en « " + active.l + " » (" + active.prix + ")." : ".");
    }
    if (active) $("#formule-retour").href = racine + (active.rang >= 2 ? "app/" : "app/releve.html");
  }
})();
