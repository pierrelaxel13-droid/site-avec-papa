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
    return Promise.all([V.mesAcces(), V.mesCabinets()]).then(function (x) {
      var siens = x[0].ok ? x[0].acces.filter(function (a) { return a.role !== "consultant"; }) : [];
      // Un consultant sans entreprise à lui arrive dans son cabinet.
      if (!siens.length && x[1].ok && x[1].cabinets.length) return "compte/cabinet.html";
      if (siens.length) V.choisir(siens[0].entreprise_id);
      var rang = siens.length ? siens[0].rang : 0;
      return rang >= 2 ? "app/index.html" : rang === 1 ? "app/releve.html" : "compte/";
    });
  }
  function adresseValable(a) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a); }
  function dateLongue(d) {
    return d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "";
  }
  /* Le lien d'invitation, prêt à copier ou à envoyer par courriel. */
  function copier(champ, b) {
    var fini = function () { b.textContent = "Lien copié"; };
    if (navigator.clipboard) navigator.clipboard.writeText(champ.value).then(fini, function () { champ.select(); });
    else { champ.select(); try { document.execCommand("copy"); fini(); } catch (e) { /* le texte reste sélectionné */ } }
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

  /* Une invitation ouverte avant d'avoir un compte : son jeton attend ici le
     temps de créer le compte et de confirmer l'adresse. */
  var CLE_INVITATION = "vigie-invitation";
  function invitationEnAttente() { try { return window.localStorage.getItem(CLE_INVITATION) || ""; } catch (e) { return ""; } }
  function oublierInvitation() { try { window.localStorage.removeItem(CLE_INVITATION); } catch (e) { /* rien */ } }
  var ROLES = { admin: "administrateur", membre: "membre", lecteur: "lecteur" };
  var CLE_TYPE = "vigie-type";

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
    var prerempli = new URLSearchParams(window.location.search).get("courriel");
    // Venu de la page consultants : après la confirmation, Mon compte proposera le cabinet.
    if (new URLSearchParams(window.location.search).get("type") === "cabinet") {
      try { window.localStorage.setItem(CLE_TYPE, "cabinet"); } catch (e) { /* il choisira */ }
      var titreC = $("#creer-pour");
      if (titreC) titreC.hidden = false;
    }
    if (prerempli) {
      $("#c-courriel").value = prerempli;
      dire(etatC, "Vous avez été invité : créez votre compte avec cette adresse, puis confirmez-la.");
    }
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
      Promise.all([V.mesEntreprises(), V.mesCabinets()]).then(function (x) {
        var r = x[0], c = x[1];
        var boite = $("#compte-entreprise");
        if (!r.ok) { dire(etatM, r.erreur); return; }
        var cab = c.ok && c.cabinets[0];
        montrerCabinet(cab);
        if (!r.entreprises.length) {
          boite.hidden = true;
          if (!cab) formulaireDepart();
          return;
        }
        $("#form-entreprise").hidden = true;
        var e = r.entreprises[0];
        $("#entreprise-nom").textContent = e.denomination;
        $("#entreprise-role").textContent = e.role === "admin" ? "Vous en êtes l'administrateur."
          : e.role === "lecteur" ? "Vous y êtes en lecture seule." : "Vous en êtes membre.";
        var f = $("#entreprise-formule"), ouvrir = $("#entreprise-ouvrir"), tarifs = $("#entreprise-tarifs");
        if (e.rang > 0) {
          f.textContent = "Formule « " + nomDuRang(e.rang) + " ».";
          ouvrir.href = vers(e.rang >= 2 ? "app/index.html" : "app/releve.html");
          ouvrir.onclick = function () { V.choisir(e.entreprise_id); };
          ouvrir.hidden = false; tarifs.hidden = true;
        } else {
          f.textContent = "Pas encore d'abonnement : votre espace ouvrira avec lui.";
          ouvrir.hidden = true; tarifs.hidden = false;
        }
        boite.hidden = false;
        equipe(e);
        sonConsultant(e);
      });
    };

    /* Le premier pas : nommer son entreprise, ou son cabinet de conseil. */
    var formulaireDepart = function () {
      var type = "";
      try { type = window.localStorage.getItem(CLE_TYPE) || ""; } catch (e) { type = ""; }
      var radio = $('input[name="e-type"][value="' + (type === "cabinet" ? "cabinet" : "entreprise") + '"]');
      if (radio) radio.checked = true;
      typeChoisi();
      $("#form-entreprise").hidden = false;
    };
    var typeChoisi = function () {
      var cabinet = ($('input[name="e-type"]:checked') || {}).value === "cabinet";
      $("#e-nom-l").textContent = cabinet ? "Nom de votre cabinet" : "Nom de l'entreprise";
      $("#e-explique").textContent = cabinet
        ? "Vous y créerez l'espace de chacun de vos clients ; vous serez l'administrateur du cabinet."
        : "C'est elle qui portera l'abonnement, le plan de veille et le registre ; vous en serez l'administrateur.";
    };
    var types = document.querySelectorAll('input[name="e-type"]');
    for (var t = 0; t < types.length; t++) types[t].addEventListener("change", typeChoisi);

    /* Votre cabinet (consultants) : un lien vers sa page. */
    var montrerCabinet = function (cab) {
      var b = $("#compte-cabinet");
      if (!cab) { b.hidden = true; return; }
      $("#cabinet-nom").textContent = cab.nom;
      $("#cabinet-statut").textContent = cab.actif
        ? "Abonnement consultant ouvert : vos clients ont la veille complète."
        : "Abonnement consultant pas encore ouvert : votre page cabinet dit comment faire.";
      b.hidden = false;
    };

    /* Le consultant de l'entreprise, et son accès (l'administrateur décide). */
    var sonConsultant = function (e) {
      var b = $("#entreprise-consultant");
      V.rpc("mon_consultant", { e: e.entreprise_id }).then(function (r) {
        var c = r.ok && r.donnees;
        if (!c) { b.hidden = true; return; }
        b.textContent = "";
        var p = document.createElement("p");
        p.textContent = c.acces
          ? "Suivie par le cabinet « " + c.nom + " ». Il entre dans votre espace et peut y travailler ; ce qu'il y fait est inscrit au registre, à son nom."
          : "Suivie par le cabinet « " + c.nom + " », mais vous avez coupé son accès : il ne voit plus rien de votre espace. Le registre garde ce qu'il y a fait.";
        b.appendChild(p);
        if (e.role === "admin") {
          var dit = document.createElement("span"); dit.className = "etat-compte";
          var bt = bouton(c.acces ? "Couper son accès" : "Lui rouvrir l'accès", function () {
            if (c.acces && !bt.hasAttribute("data-sur")) {
              bt.setAttribute("data-sur", ""); bt.textContent = "Confirmer : couper l'accès de « " + c.nom + " »"; return;
            }
            dit.textContent = "Enregistrement…";
            V.rpc("espace_acces_consultant", { e: e.entreprise_id, acces: !c.acces }).then(function (x) {
              if (!x.ok) { dit.textContent = x.erreur; return; }
              sonConsultant(e);
            });
          });
          var rg = document.createElement("p"); rg.className = "rangee";
          rg.appendChild(bt); rg.appendChild(dit);
          b.appendChild(rg);
        }
        b.hidden = false;
      });
    };

    /* --- Votre équipe ------------------------------------------------------- */
    var equipe = function (e) {
      var admin = e.role === "admin";
      V.rpc("espace_membres", { e: e.entreprise_id }).then(function (r) {
        if (!r.ok) return;
        var d = r.donnees || {};
        var liste = $("#equipe-liste");
        liste.textContent = "";
        (d.membres || []).forEach(function (m) {
          var li = document.createElement("li");
          li.className = "admin-compte";
          var t = document.createElement("span"); t.className = "admin-courriel";
          t.textContent = m.courriel + (m.moi ? " (vous)" : "");
          li.appendChild(t);
          var det = document.createElement("span"); det.className = "admin-details";
          det.textContent = ROLES[m.role] + " · depuis le " + new Date(m.depuis).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
          li.appendChild(det);
          if (admin && !m.moi) {
            var outils = document.createElement("span"); outils.className = "equipe-outils";
            var choix = document.createElement("select");
            choix.setAttribute("aria-label", "Rôle de " + m.courriel);
            ["membre", "lecteur", "admin"].forEach(function (k) { choix.appendChild(new Option(ROLES[k], k)); });
            choix.value = m.role;
            choix.addEventListener("change", function () {
              det.textContent = "Enregistrement…";
              V.rpc("espace_role", { e: e.entreprise_id, membre: m.id, nouveau_role: choix.value }).then(function (x) {
                if (!x.ok) { det.textContent = x.erreur; choix.value = m.role; return; }
                equipe(e);
              });
            });
            var retirer = bouton("Retirer", function () {
              if (!retirer.hasAttribute("data-sur")) {
                retirer.setAttribute("data-sur", ""); retirer.textContent = "Confirmer : retirer " + m.courriel; return;
              }
              V.rpc("espace_retirer", { e: e.entreprise_id, membre: m.id }).then(function (x) {
                if (!x.ok) { det.textContent = x.erreur; return; }
                equipe(e);
              });
            });
            outils.appendChild(choix); outils.appendChild(retirer);
            li.appendChild(outils);
          }
          liste.appendChild(li);
        });
        var attente = d.invitations || [];
        $("#equipe-attente").hidden = !attente.length;
        var ul = $("#equipe-invitations");
        ul.textContent = "";
        attente.forEach(function (i) {
          var li = document.createElement("li");
          li.className = "admin-compte";
          var t = document.createElement("span"); t.className = "admin-courriel"; t.textContent = i.courriel; li.appendChild(t);
          var det = document.createElement("span"); det.className = "admin-details";
          det.textContent = ROLES[i.role] + " · invitation valable jusqu'au " + new Date(i.expire_le).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
          li.appendChild(det);
          li.appendChild(bouton("Annuler l'invitation", function () {
            V.rpc("annuler_invitation", { invitation: i.id }).then(function () { equipe(e); });
          }));
          ul.appendChild(li);
        });
        $("#form-inviter").hidden = !admin;
        $("#compte-equipe").hidden = false;
      });
    };

    var fi = $("#form-inviter");
    fi.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var etatI = $("#etat-inviter"), adresse = $("#i-courriel").value.trim().toLowerCase(), role = $("#i-role").value;
      if (!adresseValable(adresse)) { dire(etatI, "Entrez une adresse électronique valable."); return; }
      dire(etatI, "Création…");
      V.mesEntreprises().then(function (m) {
        var e = m.ok && m.entreprises[0];
        if (!e) { dire(etatI, "Nommez d'abord votre entreprise."); return; }
        V.rpc("inviter", { courriel: adresse, role: role, entreprise: e.entreprise_id }).then(function (r) {
          if (!r.ok) { dire(etatI, r.erreur); return; }
          dire(etatI, "");
          var adresseLien = V.pageDuSite("compte/invitation.html") + "#jeton=" + encodeURIComponent(r.donnees);
          $("#i-lien").value = adresseLien;
          $("#i-pour").textContent = adresse;
          var moi = (V.utilisateur() || {}).courriel || "";
          $("#i-mail").href = "mailto:" + encodeURIComponent(adresse) +
            "?subject=" + encodeURIComponent("Invitation à rejoindre « " + e.denomination + " » sur Vigie") +
            "&body=" + encodeURIComponent("Bonjour,\n\n" + (moi ? moi + " vous invite" : "Vous êtes invité") +
              " à rejoindre « " + e.denomination + " » sur Vigie, notre outil de veille réglementaire, comme " +
              ROLES[role] + ".\n\nPour accepter, ouvrez ce lien (valable 7 jours) :\n" + adresseLien +
              "\n\nVous y créerez votre compte avec cette adresse : " + adresse + ".\n");
          $("#invitation-lien").hidden = false;
          $("#i-courriel").value = "";
          equipe(e);
        });
      });
    });
    $("#i-copier").addEventListener("click", function () { copier($("#i-lien"), $("#i-copier")); });

    var montrer = function (s) {
      if (invitationEnAttente()) { window.location.replace(vers("compte/invitation.html")); return; }
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

    // Nommer son entreprise (on en devient l'administrateur), ou son cabinet.
    $("#form-entreprise").addEventListener("submit", function (e) {
      e.preventDefault();
      var nom = $("#e-nom").value.trim(), etatE = $("#etat-entreprise");
      var cabinet = ($('input[name="e-type"]:checked') || {}).value === "cabinet";
      if (!nom) { dire(etatE, cabinet ? "Entrez le nom de votre cabinet." : "Entrez le nom de votre entreprise."); return; }
      dire(etatE, "Enregistrement…");
      (cabinet ? V.rpc("creer_cabinet", { nom: nom }) : V.creerEntreprise(nom)).then(function (r) {
        if (!r.ok) { dire(etatE, r.erreur); return; }
        try { window.localStorage.removeItem(CLE_TYPE); } catch (x) { /* rien */ }
        if (cabinet) { window.location.href = vers("compte/cabinet.html"); return; }
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

  /* --- La page d'invitation ---------------------------------------------------- */
  var carteInv = $("#invitation-carte");
  if (carteInv) {
    var etatInv = $("#etat-invitation");
    var h = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    if (h.get("jeton")) {
      try { window.localStorage.setItem(CLE_INVITATION, h.get("jeton")); } catch (e) { /* tant pis : il faudra rouvrir le lien */ }
      if (window.history && window.history.replaceState) window.history.replaceState(null, "", window.location.pathname);
    }
    var jeton = invitationEnAttente();
    var titre = $("#invitation-titre"), texte = $("#invitation-texte"), actions = $("#invitation-actions");
    var bouton2 = function (href, libelle, classe) { var a = lien(href, libelle); a.className = "bouton " + classe; return a; };
    if (!jeton) {
      dire(etatInv, "");
      titre.textContent = "Ce lien est incomplet";
      texte.textContent = "Ouvrez le lien tel que vous l'avez reçu, en entier. S'il ne marche toujours pas, demandez-en un nouveau à la personne qui vous a invité.";
      carteInv.hidden = false;
    } else {
      V.rpcPublic("invitation_infos", { jeton: jeton }).then(function (r) {
        dire(etatInv, "");
        carteInv.hidden = false;
        var i = r.ok && r.donnees;
        if (!i || !i.valide) {
          oublierInvitation();
          titre.textContent = "Cette invitation n'est plus valable";
          texte.textContent = "Elle a déjà servi, a été annulée, ou a dépassé ses 7 jours. Demandez-en une nouvelle à la personne qui vous l'a envoyée.";
          actions.appendChild(bouton2(vers("connexion.html"), "Se connecter", "bouton-sobre"));
          return;
        }
        titre.textContent = "Rejoindre « " + i.entreprise + " »";
        V.session().then(function (s) {
          if (!s) {
            texte.textContent = "Vous êtes invité comme " + ROLES[i.role] + ". Pour accepter, créez votre compte avec l'adresse " +
              i.courriel + " — ou connectez-vous, si vous en avez déjà un.";
            actions.appendChild(bouton2(vers("compte/creer.html?courriel=" + encodeURIComponent(i.courriel)), "Créer mon compte", "bouton-accent"));
            actions.appendChild(bouton2(vers("connexion.html?retour=compte/invitation.html"), "J'ai déjà un compte", "bouton-sobre"));
            return;
          }
          if (s.utilisateur.courriel.toLowerCase() !== String(i.courriel).toLowerCase()) {
            texte.textContent = "Vous êtes connecté avec " + s.utilisateur.courriel + ", mais l'invitation est pour " + i.courriel +
              ". Déconnectez-vous, puis connectez-vous ou créez votre compte avec la bonne adresse.";
            actions.appendChild(bouton("Se déconnecter", function () { V.deconnecter().then(function () { window.location.reload(); }); }));
            actions.appendChild(bouton("Ignorer cette invitation", function () { oublierInvitation(); window.location.href = vers("compte/"); }));
            return;
          }
          texte.textContent = "Un instant…";
          V.rpc("accepter_invitation", { jeton: jeton }).then(function (x) {
            if (!x.ok) { texte.textContent = x.erreur; return; }
            oublierInvitation();
            titre.textContent = "Vous avez rejoint « " + i.entreprise + " »";
            texte.textContent = "Vous y êtes " + ROLES[i.role] + ". Vous voyez maintenant son plan de veille et son registre.";
            actions.appendChild(bouton2(vers("app/index.html"), "Ouvrir l'espace", "bouton-accent"));
            actions.appendChild(bouton2(vers("compte/"), "Mon compte", "bouton-sobre"));
          });
        });
      });
    }
  }

  /* --- Mon cabinet (consultants) ----------------------------------------------
     Ses clients et où ils en sont — des nombres et une date, jamais le
     contenu de leurs registres —, en ajouter, inviter leur responsable,
     entrer dans leur espace. */
  var cabinetP = $("#cabinet-principal");
  if (cabinetP) {
    var etatCab = $("#cabinet-etat");
    var CONTACT = cabinetP.getAttribute("data-contact") || "";
    var cabinet = null;
    var mk = function (balise, classe, texte) {
      var x = document.createElement(balise);
      if (classe) x.className = classe;
      if (texte !== undefined) x.textContent = texte;
      return x;
    };
    var pluriel = function (n, un, plusieurs) { return n + " " + (n > 1 ? plusieurs : un); };

    // Inviter le responsable d'un client qui n'a pas encore de compte.
    var inviterClient = function (carte, c) {
      var f = mk("form", "admin-choix");
      f.setAttribute("novalidate", "");
      var id = "inv-" + c.id;
      var lab = mk("label", "", "Adresse électronique de son responsable"); lab.htmlFor = id;
      var champ = mk("input"); champ.type = "email"; champ.id = id; champ.autocomplete = "off"; champ.inputMode = "email"; champ.spellcheck = false;
      var ok = mk("button", "bouton bouton-sobre", "Créer l'invitation"); ok.type = "submit";
      var dit = mk("span", "etat-compte"); dit.setAttribute("role", "status");
      f.appendChild(lab); f.appendChild(champ); f.appendChild(ok); f.appendChild(dit);
      f.addEventListener("submit", function (ev) {
        ev.preventDefault();
        var adresse = champ.value.trim().toLowerCase();
        if (!adresseValable(adresse)) { dit.textContent = "Entrez une adresse électronique valable."; return; }
        ok.disabled = true; dit.textContent = "Création…";
        V.rpc("inviter", { courriel: adresse, role: "admin", entreprise: c.id }).then(function (r) {
          ok.disabled = false;
          if (!r.ok) { dit.textContent = r.erreur; return; }
          dit.textContent = "";
          var adresseLien = V.pageDuSite("compte/invitation.html") + "#jeton=" + encodeURIComponent(r.donnees);
          var boite = mk("div", "reserve reserve-ok");
          var p1 = mk("p");
          p1.appendChild(mk("strong", "", "Envoyez-lui ce lien."));
          p1.appendChild(document.createTextNode(" Valable 7 jours, il ne sert qu'une fois : " + adresse +
            " y crée son compte et devient l'administrateur de « " + c.denomination + " »."));
          boite.appendChild(p1);
          var l = mk("input"); l.type = "text"; l.readOnly = true; l.value = adresseLien; l.setAttribute("aria-label", "Le lien d'invitation");
          boite.appendChild(l);
          var rg = mk("p", "rangee"); rg.style.marginTop = "var(--t3)";
          var cp = mk("button", "bouton bouton-accent", "Copier le lien"); cp.type = "button";
          cp.addEventListener("click", function () { copier(l, cp); });
          var mail = mk("a", "bouton bouton-sobre", "Écrire le courriel");
          mail.href = "mailto:" + encodeURIComponent(adresse) +
            "?subject=" + encodeURIComponent("Votre espace de veille réglementaire « " + c.denomination + " »") +
            "&body=" + encodeURIComponent("Bonjour,\n\n" + cabinet.nom + " a ouvert l'espace de « " + c.denomination +
              " » sur Vigie, l'outil de veille réglementaire que nous utilisons pour votre suivi QSE.\n\n" +
              "Pour y entrer, ouvrez ce lien (valable 7 jours) :\n" + adresseLien +
              "\n\nVous y créerez votre compte avec cette adresse : " + adresse +
              ". Vous verrez votre plan de veille, les textes qui vous concernent et votre registre.\n");
          rg.appendChild(cp); rg.appendChild(mail);
          boite.appendChild(rg);
          f.replaceWith(boite);
        });
      });
      return f;
    };

    var carteClient = function (c) {
      var carte = mk("article", "carte-connexion admin-entreprise");
      carte.appendChild(mk("h3", "", c.denomination));
      carte.appendChild(mk("p", "admin-details", "Espace créé le " + dateLongue(c.cree_le) + (c.naf ? " · code APE " + c.naf : " · code APE pas encore réglé")));
      if (!c.acces) {
        carte.appendChild(mk("p", "", "Ce client a coupé votre accès : vous ne voyez plus son espace. Lui seul peut le rouvrir, depuis son compte."));
        return carte;
      }
      var etat = mk("p", "admin-formule");
      if (c.actions_ouvertes) {
        etat.appendChild(mk("strong", "", pluriel(c.actions_ouvertes, "action ouverte", "actions ouvertes")));
        if (c.actions_en_retard) {
          etat.appendChild(document.createTextNode(", dont "));
          etat.appendChild(mk("span", "admin-alerte", c.actions_en_retard + " en retard"));
        }
        etat.appendChild(document.createTextNode("."));
      } else {
        etat.textContent = "Aucune action ouverte.";
      }
      carte.appendChild(etat);
      carte.appendChild(mk("p", "admin-details", c.derniere_trace
        ? "Dernière trace au registre le " + dateLongue(c.derniere_trace) + "."
        : "Rien au registre pour l'instant."));
      if (c.membres) {
        carte.appendChild(mk("p", "admin-details", pluriel(c.membres, "personne de l'entreprise a", "personnes de l'entreprise ont") + " un compte."));
      } else {
        carte.appendChild(mk("p", "", "Votre client n'a pas encore de compte : invitez son responsable."));
        carte.appendChild(inviterClient(carte, c));
      }
      var rg = mk("p", "rangee"); rg.style.marginTop = "var(--t3)";
      if (cabinet.actif) {
        var ouvrir = mk("a", "bouton bouton-accent", "Ouvrir son espace");
        ouvrir.href = vers("app/index.html");
        ouvrir.addEventListener("click", function () { V.choisir(c.id); });
        rg.appendChild(ouvrir);
      } else {
        rg.appendChild(mk("span", "admin-details", "Son espace s'ouvre avec votre abonnement."));
      }
      carte.appendChild(rg);
      return carte;
    };

    var chargerCabinet = function (message) {
      V.rpc("cabinet_vue", { c: cabinet.id }).then(function (r) {
        if (!r.ok) { etatCab.textContent = r.erreur; return; }
        var d = r.donnees || {}, cl = d.clients || [];
        cabinet = d.cabinet || cabinet;
        $("#cabinet-titre").textContent = cabinet.nom;
        var retard = cl.filter(function (c) { return c.actions_en_retard; }).length;
        etatCab.textContent = message || (cl.length
          ? pluriel(cl.length, "client", "clients") + (retard ? " — " + retard + " avec des actions en retard." : ", aucun en retard.")
          : "Pas encore de client : ajoutez le premier ci-dessous.");
        var inactif = $("#cabinet-inactif");
        inactif.hidden = !!cabinet.actif;
        if (!cabinet.actif) {
          $("#cabinet-demander").href = "mailto:" + CONTACT + "?subject=" + encodeURIComponent("Ouvrir l'abonnement consultant — " + cabinet.nom) +
            "&body=" + encodeURIComponent("Bonjour,\n\nPouvez-vous ouvrir l'abonnement consultant du cabinet « " + cabinet.nom +
              " » ?\nCompte : " + ((V.utilisateur() || {}).courriel || "") + "\n");
        }
        var liste = $("#cabinet-clients"); liste.textContent = "";
        cl.forEach(function (c) { liste.appendChild(carteClient(c)); });
        $("#cabinet-vos-clients").hidden = !cl.length;
        cabinetP.hidden = false;
      });
    };

    $("#form-client").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var nom = $("#cl-nom").value.trim(), dit = $("#etat-client");
      if (!nom) { dit.textContent = "Entrez le nom de l'entreprise cliente."; return; }
      dit.textContent = "Création…";
      V.rpc("creer_entreprise_cliente", { cabinet: cabinet.id, denomination: nom }).then(function (r) {
        if (!r.ok) { dit.textContent = r.erreur; return; }
        $("#cl-nom").value = "";
        dit.textContent = "L'espace de « " + nom + " » est créé. Ouvrez-le pour régler son plan, puis invitez son responsable.";
        chargerCabinet();
      });
    });

    V.session().then(function (s) {
      if (!s) { window.location.replace(vers("connexion.html?retour=compte/cabinet.html")); return; }
      V.mesCabinets().then(function (r) {
        if (!r.ok) { etatCab.textContent = r.erreur; return; }
        if (!r.cabinets.length) {
          etatCab.textContent = "";
          var sans = $("#cabinet-aucun"); sans.hidden = false;
          return;
        }
        var c = r.cabinets[0];
        cabinet = { id: c.cabinet_id, nom: c.nom, actif: c.actif };
        chargerCabinet();
      });
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

    /* Un cabinet de conseil : ses clients, ses comptes, et son abonnement
       consultant, ouvert ou fermé à la main tant que Stripe n'est pas là. */
    var carteCabinet = function (c) {
      var carte = el("article", "carte-connexion admin-entreprise");
      carte.appendChild(el("h3", "", c.nom));
      carte.appendChild(el("p", "admin-details", "Inscrit le " + date(c.cree_le) + " · " + c.clients + " client" + (c.clients > 1 ? "s" : "")));
      var abos = c.abonnements || [];
      var stripe = abos.filter(function (a) { return a.stripe && ["active", "trialing", "past_due"].indexOf(a.statut) !== -1; })[0];
      var offert = abos.filter(function (a) { return !a.stripe && a.statut === "offert"; })[0];
      var etat = el("p", "admin-formule");
      etat.appendChild(el("strong", "", stripe || offert ? "Abonnement consultant ouvert" : "Abonnement consultant fermé"));
      etat.appendChild(document.createTextNode(stripe ? " — payé chez Stripe (" + stripe.statut + ")." :
        offert ? " — ouvert par vous : ses clients ont la veille complète." : " — ses clients n'ont pas accès à leur espace."));
      carte.appendChild(etat);
      if (!stripe) {
        var rg = el("p", "rangee");
        var dit = el("span", "etat-compte");
        var b = el("button", "bouton bouton-sobre", offert ? "Fermer l'abonnement" : "Ouvrir l'abonnement");
        b.type = "button";
        b.addEventListener("click", function () {
          b.disabled = true; dit.textContent = "Enregistrement…";
          V.rpc("admin_abonnement_cabinet", { cabinet: c.id, ouvrir: !offert }).then(function (r) {
            b.disabled = false;
            if (!r.ok) { dit.textContent = r.erreur; return; }
            charger("C'est enregistré pour le cabinet « " + c.nom + " ».");
          });
        });
        rg.appendChild(b); rg.appendChild(dit);
        carte.appendChild(rg);
      }
      var ul = el("ul", "admin-comptes");
      (c.membres || []).forEach(function (m) {
        ul.appendChild(ligneCompte(m.courriel, m.role === "admin" ? "administrateur du cabinet" : "membre du cabinet", m.confirme));
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
        var avec = ents.filter(function (e) { return e.rang > 0; }).length, nc = (d.cabinets || []).length;
        etatAd.textContent = message || (ents.length + " entreprise" + (ents.length > 1 ? "s" : "") + ", dont " +
          avec + " avec une formule ; " + nc + " cabinet" + (nc > 1 ? "s" : "") + " ; " +
          seuls.length + " compte" + (seuls.length > 1 ? "s" : "") + " sans entreprise.");
        var liste = $("#admin-entreprises"); liste.textContent = "";
        if (!ents.length) liste.appendChild(el("p", "", "Aucune entreprise pour l'instant."));
        ents.forEach(function (e) { liste.appendChild(carteEntreprise(e)); });
        var cabs = d.cabinets || [], lc = $("#admin-cabinets"); lc.textContent = "";
        if (!cabs.length) lc.appendChild(el("p", "", "Aucun cabinet pour l'instant."));
        cabs.forEach(function (c) { lc.appendChild(carteCabinet(c)); });
        var ul = $("#admin-seuls"); ul.textContent = "";
        if (!seuls.length) ul.appendChild(el("li", "", "Aucun."));
        seuls.forEach(function (c) {
          ul.appendChild(ligneCompte(c.courriel, "inscrit le " + date(c.inscrit_le), c.confirme));
        });
        admin.hidden = false;
        robot();
        conseilsIA();
      });
    };

    /* Le robot de collecte : les 24 derniers passages (table collectes). */
    var ETATS = { reussie: "Réussi", alerte: "En alerte", echouee: "Échoué", en_cours: "En cours" };
    var robot = function () {
      V.lire("collectes", "select=id,debut,statut,retenus,erreurs,details&order=id.desc&limit=24").then(function (r) {
        var ul = $("#admin-collectes");
        ul.textContent = "";
        if (!r.ok) { ul.appendChild(el("li", "", r.erreur)); return; }
        var l = r.donnees || [];
        if (!l.length) { ul.appendChild(el("li", "", "Aucun passage inscrit pour l'instant : le journal commence au prochain passage du robot.")); return; }
        var minutes = Math.round((Date.now() - new Date(l[0].debut).getTime()) / 60000);
        var n = function (s) { return l.filter(function (c) { return c.statut === s; }).length; };
        $("#admin-robot-etat").textContent = "Dernier passage il y a " + (minutes < 90 ? minutes + " min" : Math.round(minutes / 60) + " h") +
          " : " + (ETATS[l[0].statut] || l[0].statut).toLowerCase() + "." + (minutes > 26 * 60 ? " C'est trop vieux : le robot ne tourne plus." : "") +
          " Sur les " + l.length + " derniers passages : " + n("reussie") + " réussi" + (n("reussie") > 1 ? "s" : "") + ", " +
          n("alerte") + " en alerte, " + n("echouee") + " échoué" + (n("echouee") > 1 ? "s" : "") + ".";
        // On ne détaille que ce qui cloche : c'est ce qu'on vient voir.
        var aVoir = l.filter(function (c) { return c.statut !== "reussie"; }).slice(0, 8);
        if (!aVoir.length) { ul.appendChild(el("li", "", "Rien d'anormal sur ces passages.")); return; }
        aVoir.forEach(function (c) {
          var li = el("li", "admin-compte collecte-" + c.statut);
          var quand = new Date(c.debut).toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
          var d = c.details || {};
          li.appendChild(el("span", "admin-courriel", quand + " — " + (ETATS[c.statut] || c.statut)));
          li.appendChild(el("span", "admin-details", c.retenus + " textes dans le relevé · " + (d.nouveaux || 0) + " nouveau" + ((d.nouveaux || 0) > 1 ? "x" : "")));
          (c.erreurs || []).forEach(function (a) {
            li.appendChild(el("span", "admin-details" + (a.niveau === "grave" ? " admin-alerte" : ""), (a.niveau === "grave" ? "Grave : " : "") + a.quoi));
          });
          if (d.passage) { var a = el("a", "", "Voir le passage chez GitHub"); a.href = d.passage; a.target = "_blank"; a.rel = "noopener"; li.appendChild(a); }
          ul.appendChild(li);
        });
      });
    };

    /* Les conseils de l'IA : combien gardés, combien écartés, et ce que l'IA
       dit « à revoir » — un texte qui ne concernerait pas son sujet. */
    var conseilsIA = function () {
      var ul = $("#admin-conseils");
      if (!ul) return;
      V.rpc("admin_conseils", {}).then(function (r) {
        ul.textContent = "";
        if (!r.ok) { ul.appendChild(el("li", "", r.erreur)); return; }
        var c = r.donnees || {};
        $("#admin-conseils-etat").textContent = (c.gardes || 0) + " conseil" + ((c.gardes || 0) > 1 ? "s" : "") + " montré" +
          ((c.gardes || 0) > 1 ? "s" : "") + " aux abonnés, " + (c.ecartes || 0) + " réponse" + ((c.ecartes || 0) > 1 ? "s" : "") +
          " écartée" + ((c.ecartes || 0) > 1 ? "s" : "") + " par les contrôles. À revoir : les textes où l'IA estime que le sujet ne va pas. " +
          "Rien n'est retiré du relevé sans Clément.";
        var l = c.a_revoir || [];
        if (!l.length) { ul.appendChild(el("li", "", "Rien à revoir.")); return; }
        l.forEach(function (x) {
          var li = el("li", "admin-compte");
          li.appendChild(el("span", "admin-courriel", x.titre || x.texte_id));
          li.appendChild(el("span", "admin-details", "Le " + new Date(x.le).toLocaleDateString("fr-FR", { day: "numeric", month: "long" }) +
            (x.metier ? " · pour le métier NAF " + x.metier : " · conseil général") +
            (x.details && x.details.qui ? " · selon l'IA, concerne : " + x.details.qui : "")));
          ul.appendChild(li);
        });
      });
    };

    V.session().then(function (s) {
      if (!s) { window.location.replace(vers("connexion.html?retour=compte/admin.html")); return; }
      moi = s.utilisateur;
      charger();
      // L'application, dans son entreprise à soi (pas chez un client).
      V.mesEntreprises().then(function (m) {
        var b = $("#admin-app"), e = m.ok && m.entreprises[0];
        if (!b || !e) return;
        b.href = vers(e.rang >= 2 ? "app/index.html" : "app/releve.html");
        b.addEventListener("click", function () { V.choisir(e.entreprise_id); });
        b.hidden = false;
      });
    });
  }
})();
