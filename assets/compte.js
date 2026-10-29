/* ==========================================================================
   Vigie — les pages de compte
   --------------------------------------------------------------------------
   Quatre pages, qui parlent à Supabase par window.VIGIE (assets/vigie.js) :
     connexion.html       se connecter
     compte/creer.html    créer son compte (un lien de confirmation suit)
     compte/oubli.html    recevoir un lien pour changer de mot de passe
     compte/index.html    « Mon compte » : c'est aussi là qu'arrivent les
                          liens reçus par courriel (confirmation, nouveau mot
                          de passe, changement d'adresse)

   Les mots de passe ne font que passer : ils partent à Supabase, et les
   champs sont vidés aussitôt.
   ========================================================================== */
(function () {
  "use strict";
  var $ = function (s) { return document.querySelector(s); };
  var V = window.VIGIE;
  var racine = document.body.getAttribute("data-racine") || "./";
  var vers = function (chemin) { return racine + chemin; };
  var MIN = 10;

  /* Où entrer après la connexion : là d'où l'on venait, sinon selon la
     formule — le tableau de bord n'est pas dans « Textes ». On ne revient que
     dans le site : jamais vers une adresse extérieure. */
  function retourSur(valeur) {
    return valeur && /^(app|compte)\/[\w\-./]*$/.test(valeur) && valeur.indexOf("..") === -1 ? valeur : null;
  }
  function entree(retour) {
    if (retour) return Promise.resolve(retour);
    return V.mesEntreprises().then(function (r) {
      var rang = r.ok && r.entreprises.length ? r.entreprises[0].rang : 0;
      return rang >= 2 ? "app/index.html" : rang === 1 ? "app/releve.html" : "compte/";
    });
  }

  function dire(el, texte) { el.textContent = texte || ""; }
  /* Un message avec un lien ou un bouton à la suite. */
  function direAvec(el, texte, action) {
    el.textContent = texte + " ";
    if (action) el.appendChild(action);
  }
  function lien(href, texte) { var a = document.createElement("a"); a.href = href; a.textContent = texte; return a; }
  function bouton(texte, quand) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "lien-nu"; b.textContent = texte;
    b.addEventListener("click", quand);
    return b;
  }
  function boutonRenvoi(adresse, etat) {
    return bouton("Renvoyer le lien", function () {
      dire(etat, "Envoi…");
      V.renvoyer(adresse).then(function (r) {
        dire(etat, r.ok ? "Un nouveau lien vient d'être envoyé à " + adresse + "." : r.erreur);
      });
    });
  }
  function deuxMotsDePasse(m1, m2) {
    if (m1.value.length < MIN) return "Le mot de passe doit faire au moins " + MIN + " caractères.";
    if (m1.value !== m2.value) return "Les deux mots de passe ne sont pas les mêmes.";
    return "";
  }

  /* Connecté, le bouton « Connexion » de l'en-tête devient « Mon compte ». */
  function entete() {
    V.session().then(function (s) {
      var b = document.querySelector(".bouton-bandeau");
      if (s && b) { b.textContent = "Mon compte"; b.href = vers("compte/"); }
    });
  }
  if (V && V.ouvert) entete();

  /* Sans adresse de projet Supabase, rien ne peut marcher : on le dit. */
  if (!V || !V.ouvert) {
    var fermee = $("[data-comptes-fermes]");
    if (fermee) fermee.hidden = false;
    var formes = document.querySelectorAll("form.carte-connexion");
    for (var i = 0; i < formes.length; i++) formes[i].hidden = true;
    return;
  }

  /* --- Connexion ----------------------------------------------------------- */
  var form = $("#form-connexion");
  if (form) {
    var etat = $("#etat-connexion");
    var retour = retourSur(new URLSearchParams(window.location.search).get("retour"));

    V.session().then(function (s) {
      if (!s) return;
      var deja = $("#connexion-deja");
      deja.textContent = "";
      var t = document.createElement("strong");
      t.textContent = "Vous êtes connecté : " + s.utilisateur.courriel + ".";
      deja.appendChild(t);
      var actions = document.createElement("span");
      actions.className = "rangee";
      var ouvrir = lien(vers("compte/"), "Ouvrir mon espace");
      ouvrir.className = "bouton bouton-accent";
      entree(retour).then(function (ou) { ouvrir.href = vers(ou); });
      var sortir = bouton("Se déconnecter", function () {
        V.deconnecter().then(function () { window.location.reload(); });
      });
      actions.appendChild(ouvrir); actions.appendChild(sortir);
      deja.appendChild(actions);
      deja.hidden = false;
      $("#connexion-champs").hidden = true;
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var mdp = $("#motdepasse");
      var adresse = $("#courriel").value.trim();
      if (!adresse || !mdp.value) { dire(etat, "Entrez votre adresse et votre mot de passe."); return; }
      dire(etat, "Connexion…");
      V.connecter(adresse, mdp.value).then(function (r) {
        mdp.value = "";
        if (r.ok) return entree(retour).then(function (ou) { window.location.href = vers(ou); });
        if (r.code === "email_not_confirmed") direAvec(etat, r.erreur, boutonRenvoi(adresse, etat));
        else dire(etat, r.erreur);
      });
    });
  }

  /* --- Créer son compte ------------------------------------------------------ */
  var fc = $("#form-creer");
  if (fc) {
    var etatC = $("#etat-creer");
    fc.addEventListener("submit", function (e) {
      e.preventDefault();
      var adresse = $("#c-courriel").value.trim();
      var m1 = $("#c-motdepasse"), m2 = $("#c-confirme");
      if (!adresse) { dire(etatC, "Entrez votre adresse électronique."); return; }
      var probleme = deuxMotsDePasse(m1, m2);
      if (probleme) { dire(etatC, probleme); return; }
      dire(etatC, "Création du compte…");
      V.inscrire(adresse, m1.value).then(function (r) {
        m1.value = ""; m2.value = "";
        if (!r.ok) { dire(etatC, r.erreur); return; }
        if (r.connecte) { window.location.href = vers("compte/"); return; }
        $("#creer-champs").hidden = true;
        var fait = $("#creer-envoye");
        $("#creer-adresse").textContent = adresse;
        fait.hidden = false;
        dire(etatC, "");
        $("#creer-renvoi").appendChild(boutonRenvoi(adresse, etatC));
        fait.focus();
      });
    });
  }

  /* --- Mot de passe oublié ------------------------------------------------- */
  var fo = $("#form-oubli");
  if (fo) {
    var etatO = $("#etat-oubli");
    fo.addEventListener("submit", function (e) {
      e.preventDefault();
      var adresse = $("#o-courriel").value.trim();
      if (!adresse) { dire(etatO, "Entrez votre adresse électronique."); return; }
      dire(etatO, "Envoi…");
      V.oubli(adresse).then(function (r) {
        dire(etatO, r.ok
          ? "C'est envoyé. Si un compte existe pour " + adresse + ", un lien vient d'y partir : il est valable une heure."
          : r.erreur);
      });
    });
  }

  /* --- Mon compte ------------------------------------------------------------ */
  var principal = $("#compte-principal");
  if (principal) {
    var etatM = $("#etat-compte");
    var FORMULES = {};
    try { FORMULES = JSON.parse(principal.getAttribute("data-formules")); } catch (e) { /* noms par défaut */ }
    var nomDuRang = function (rang) {
      for (var k in FORMULES) if (FORMULES[k].rang === rang) return FORMULES[k].l;
      return "";
    };
    // Une bonne nouvelle en vert ; un problème garde la couleur d'alerte.
    var annonce = function (texte, action, probleme) {
      var a = $("#compte-annonce");
      direAvec(a, texte, action);
      a.classList.toggle("reserve-ok", !probleme);
      a.hidden = false;
    };

    var montrerEntreprise = function () {
      V.mesEntreprises().then(function (r) {
        var boite = $("#compte-entreprise");
        if (!r.ok) { dire(etatM, r.erreur); return; }
        if (!r.entreprises.length) { $("#form-entreprise").hidden = false; boite.hidden = true; return; }
        $("#form-entreprise").hidden = true;
        var e = r.entreprises[0];
        $("#entreprise-nom").textContent = e.denomination;
        $("#entreprise-role").textContent = e.role === "admin" ? "Vous en êtes l'administrateur."
          : e.role === "lecteur" ? "Vous y êtes en lecture seule." : "Vous en êtes membre.";
        var f = $("#entreprise-formule"), ouvrir = $("#entreprise-ouvrir"), tarifs = $("#entreprise-tarifs");
        if (e.rang > 0) {
          f.textContent = "Formule « " + nomDuRang(e.rang) + " ».";
          ouvrir.href = vers(e.rang >= 2 ? "app/index.html" : "app/releve.html");
          ouvrir.hidden = false; tarifs.hidden = true;
        } else {
          f.textContent = "Pas encore d'abonnement : votre espace ouvrira avec lui.";
          ouvrir.hidden = true; tarifs.hidden = false;
        }
        boite.hidden = false;
      });
    };

    var montrer = function (s) {
      $("#compte-adresse").textContent = s.utilisateur.courriel;
      principal.hidden = false;
      dire(etatM, "");
      entete();   // la session vient peut-être d'arriver par le lien du courriel
      montrerEntreprise();
      V.suisAdministrateur().then(function (oui) { $("#compte-admin").hidden = !oui; });
    };

    V.arrivee().then(function (a) {
      if (a && a.type === "erreur") {
        dire(etatM, "");
        annonce(a.erreur, lien(vers("compte/oubli.html"), "Recevoir un nouveau lien"), true);
      } else if (a && a.type === "message") {
        annonce("Premier lien accepté. Cliquez maintenant sur le lien envoyé à l'autre adresse pour terminer le changement.");
      } else if (a && a.type === "recovery") {
        // Le lien « mot de passe oublié » : on ne montre que le choix du nouveau.
        $("#n-courriel").value = a.courriel || "";
        $("#compte-nouveau").hidden = false;
        dire(etatM, "");
        $("#n-motdepasse").focus();
        return;
      } else if (a && a.type === "email_change") {
        annonce("Votre nouvelle adresse est confirmée : c'est désormais elle qui vous connecte.");
      } else if (a) {
        annonce("Votre adresse est confirmée. Bienvenue dans " + (document.body.getAttribute("data-nom") || "Vigie") + ".");
      }
      V.session().then(function (s) {
        if (s) { montrer(s); return; }
        if (a) { $("#compte-annonce").appendChild(lien(vers("connexion.html"), "Se connecter")); dire(etatM, ""); return; }
        window.location.replace(vers("connexion.html?retour=compte/"));
      });
    });

    // Le nouveau mot de passe, après le lien « oublié ».
    $("#compte-nouveau").addEventListener("submit", function (e) {
      e.preventDefault();
      var m1 = $("#n-motdepasse"), m2 = $("#n-confirme"), etatN = $("#etat-nouveau");
      var probleme = deuxMotsDePasse(m1, m2);
      if (probleme) { dire(etatN, probleme); return; }
      dire(etatN, "Enregistrement…");
      V.changer({ password: m1.value }).then(function (r) {
        m1.value = ""; m2.value = "";
        if (!r.ok) { dire(etatN, r.erreur); return; }
        $("#compte-nouveau").hidden = true;
        annonce("Votre nouveau mot de passe est enregistré.");
        V.session().then(function (s) { if (s) montrer(s); });
      });
    });

    // Nommer son entreprise : on en devient l'administrateur.
    $("#form-entreprise").addEventListener("submit", function (e) {
      e.preventDefault();
      var nom = $("#e-nom").value.trim(), etatE = $("#etat-entreprise");
      if (!nom) { dire(etatE, "Entrez le nom de votre entreprise."); return; }
      dire(etatE, "Enregistrement…");
      V.creerEntreprise(nom).then(function (r) {
        if (!r.ok) { dire(etatE, r.erreur); return; }
        dire(etatE, "");
        montrerEntreprise();
      });
    });

    // Changer de mot de passe, connecté.
    $("#form-motdepasse").addEventListener("submit", function (e) {
      e.preventDefault();
      var m1 = $("#m-motdepasse"), m2 = $("#m-confirme"), etatP = $("#etat-motdepasse");
      var probleme = deuxMotsDePasse(m1, m2);
      if (probleme) { dire(etatP, probleme); return; }
      dire(etatP, "Enregistrement…");
      V.changer({ password: m1.value }).then(function (r) {
        m1.value = ""; m2.value = "";
        dire(etatP, r.ok ? "Votre nouveau mot de passe est enregistré." : r.erreur);
      });
    });

    // Changer d'adresse : Supabase envoie un lien à confirmer.
    $("#form-adresse").addEventListener("submit", function (e) {
      e.preventDefault();
      var adresse = $("#a-courriel").value.trim(), etatA = $("#etat-adresse");
      if (!adresse) { dire(etatA, "Entrez la nouvelle adresse."); return; }
      dire(etatA, "Envoi…");
      V.changer({ email: adresse }).then(function (r) {
        dire(etatA, r.ok
          ? "Deux liens viennent de partir, l'un à votre adresse actuelle, l'autre à " + adresse +
            " : cliquez sur les deux pour terminer. D'ici là, votre adresse reste l'ancienne."
          : r.erreur);
      });
    });

    $("#compte-sortir").addEventListener("click", function () {
      V.deconnecter().then(function () { window.location.href = vers("connexion.html"); });
    });
  }

  /* --- L'administration du service --------------------------------------------
     Les entreprises, leur formule et leurs comptes. Jamais leurs registres :
     la base ne les donne pas (admin_vue ne les lit pas). */
  var admin = $("#admin-liste");
  if (admin) {
    var etatAd = $("#admin-etat");
    var FORM = {};
    try { FORM = JSON.parse(admin.getAttribute("data-formules")); } catch (e) { /* noms par défaut */ }
    var nomRang = function (rang) {
      for (var k in FORM) if (FORM[k].rang === rang) return FORM[k].l;
      return "";
    };
    var date = function (d) {
      return d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "—";
    };
    var el = function (balise, classe, texte) {
      var x = document.createElement(balise);
      if (classe) x.className = classe;
      if (texte !== undefined) x.textContent = texte;
      return x;
    };
    var moi = V.utilisateur() || {};

    // Le bouton qui envoie à un compte le lien « choisir un mot de passe ».
    var boutonLien = function (courriel) {
      var b = el("button", "lien-nu", "Envoyer un lien de mot de passe");
      b.type = "button";
      b.addEventListener("click", function () {
        b.disabled = true; b.textContent = "Envoi…";
        V.oubli(courriel).then(function (r) { b.textContent = r.ok ? "Lien envoyé" : r.erreur; if (!r.ok) b.disabled = false; });
      });
      return b;
    };
    var ligneCompte = function (courriel, details, confirme) {
      var li = el("li", "admin-compte");
      var t = el("span", "admin-courriel", courriel);
      li.appendChild(t);
      var d = el("span", "admin-details", details);
      if (!confirme) d.appendChild(el("span", "admin-alerte", " · adresse pas encore confirmée"));
      li.appendChild(d);
      li.appendChild(boutonLien(courriel));
      return li;
    };

    var carteEntreprise = function (e) {
      var carte = el("article", "carte-connexion admin-entreprise");
      carte.appendChild(el("h3", "", e.denomination));
      var infos = "Inscrite le " + date(e.cree_le) + (e.naf ? " · NAF " + e.naf : "") +
        (e.consultant ? " · suivie par " + e.consultant : "") + (e.active ? "" : " · désactivée");
      carte.appendChild(el("p", "admin-details", infos));

      var abos = e.abonnements || [];
      var stripe = abos.filter(function (a) { return a.stripe; })[0];
      var offert = abos.filter(function (a) { return !a.stripe; })[0];
      var mienne = (e.membres || []).some(function (m) { return m.courriel === moi.courriel; });
      var etat = el("p", "admin-formule");
      etat.appendChild(el("strong", "", e.rang ? "« " + nomRang(e.rang) + " »" : "Aucune formule"));
      etat.appendChild(document.createTextNode(
        mienne ? " — votre entreprise : tout est ouvert." :
        stripe ? " — payée chez Stripe (" + stripe.statut + ")." :
        offert ? " — donnée par vous." :
        e.rang && e.consultant ? " — ouverte par l'abonnement de son cabinet consultant." :
        e.rang ? " — entreprise d'un administrateur : tout est ouvert." : " — l'espace est fermé."));
      carte.appendChild(etat);

      // Donner ou retirer une formule (un abonnement Stripe n'est jamais touché).
      var f = el("form", "admin-choix");
      var id = "f-" + e.id;
      var lab = el("label", "", stripe ? "Formule offerte en plus de Stripe" : "Donner une formule");
      lab.htmlFor = id;
      var choix = el("select"); choix.id = id;
      choix.appendChild(new Option("Aucune", ""));
      for (var k in FORM) choix.appendChild(new Option(FORM[k].l, k));
      choix.value = offert ? offert.formule : "";
      var ok = el("button", "bouton bouton-sobre", "Appliquer"); ok.type = "submit";
      var dit = el("span", "etat-compte");
      f.appendChild(lab); f.appendChild(choix); f.appendChild(ok); f.appendChild(dit);
      f.addEventListener("submit", function (ev) {
        ev.preventDefault();
        ok.disabled = true; dit.textContent = "Enregistrement…";
        V.adminAbonnement(e.id, choix.value).then(function (r) {
          ok.disabled = false;
          if (!r.ok) { dit.textContent = r.erreur; return; }
          charger("C'est enregistré pour « " + e.denomination + " ».");
        });
      });
      carte.appendChild(f);

      var ul = el("ul", "admin-comptes");
      (e.membres || []).forEach(function (m) {
        var role = m.role === "admin" ? "administrateur" : m.role === "lecteur" ? "lecteur" : "membre";
        ul.appendChild(ligneCompte(m.courriel, role + " · depuis le " + date(m.depuis) +
          (m.derniere_connexion ? " · dernière connexion le " + date(m.derniere_connexion) : ""), m.confirme));
      });
      carte.appendChild(ul);
      return carte;
    };

    var charger = function (message) {
      V.adminVue().then(function (r) {
        if (!r.ok) {
          etatAd.textContent = r.code === "42501" ? "Réservé à l'administrateur du service." : r.erreur;
          return;
        }
        var d = r.donnees || {}, ents = d.entreprises || [], seuls = d.sans_entreprise || [];
        var avec = ents.filter(function (e) { return e.rang > 0; }).length;
        etatAd.textContent = message || (ents.length + " entreprise" + (ents.length > 1 ? "s" : "") + ", dont " +
          avec + " avec une formule ; " + seuls.length + " compte" + (seuls.length > 1 ? "s" : "") + " sans entreprise.");
        var liste = $("#admin-entreprises"); liste.textContent = "";
        if (!ents.length) liste.appendChild(el("p", "", "Aucune entreprise pour l'instant."));
        ents.forEach(function (e) { liste.appendChild(carteEntreprise(e)); });
        var ul = $("#admin-seuls"); ul.textContent = "";
        if (!seuls.length) ul.appendChild(el("li", "", "Aucun."));
        seuls.forEach(function (c) {
          ul.appendChild(ligneCompte(c.courriel, "inscrit le " + date(c.inscrit_le), c.confirme));
        });
        admin.hidden = false;
      });
    };

    V.session().then(function (s) {
      if (!s) { window.location.replace(vers("connexion.html?retour=compte/admin.html")); return; }
      moi = s.utilisateur;
      charger();
    });
  }
})();
