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

   Les mots de passe ne font que passer : ils partent à Supabase et les
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
    // Une adresse du site, avec au plus des paramètres simples (compte/paiement.html?formule=…&periode=…).
    return valeur && /^(app|compte)\/[\w\-./]*(\?[\w=&-]*)?$/.test(valeur) && valeur.indexOf("..") === -1 ? valeur : null;
  }
  function entree(retour) {
    if (retour) return Promise.resolve(retour);
    return Promise.all([V.mesAcces(), V.mesCabinets()]).then(function (x) {
      var siens = x[0].ok ? x[0].acces.filter(function (a) { return a.role !== "consultant"; }) : [];
      // Un consultant sans entreprise à lui arrive dans son cabinet.
      if (!siens.length && x[1].ok && x[1].cabinets.length) return "compte/cabinet.html";
      if (siens.length) V.choisir(siens[0].entreprise_id);
      var rang = siens.length ? siens[0].rang : 0;
      return rang >= 1 ? "app/index.html" : "compte/";
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
      // Les deux boutons du bandeau (bureau et téléphone) disent « Mon compte ».
      if (s) [].forEach.call(document.querySelectorAll(".bouton-bandeau"), function (b) { b.textContent = "Mon compte"; b.href = vers("compte/"); });
    });
  }
  if (V && V.ouvert) entete();

  /* Une invitation ouverte avant d'avoir un compte : son jeton attend ici le
     temps de créer le compte et de confirmer l'adresse. */
  var CLE_INVITATION = "vigie-invitation";
  function invitationEnAttente() { try { return window.localStorage.getItem(CLE_INVITATION) || ""; } catch (e) { return ""; } }
  function oublierInvitation() { try { window.localStorage.removeItem(CLE_INVITATION); } catch (e) { /* rien */ } }
  var ROLES = { admin: "responsable du compte", membre: "utilisateur", lecteur: "utilisateur en lecture seule" };
  // À l'écran, l'intitulé commence par une capitale (« Administrateur · depuis… »).
  function role(k) { var r = ROLES[k] || k; return r.charAt(0).toUpperCase() + r.slice(1); }
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
      var ouvrir = lien(vers("compte/"), "Accéder à mon espace");
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

    /* L'adresse, obligatoire avant de s'abonner (6 novembre 2026) : le même formulaire pour
       l'entreprise (« ent ») et le cabinet (« cab »). Les Réglages ne s'ouvrent qu'avec
       l'abonnement : c'est ici qu'on la donne avant de payer. */
    var brancherAdresse = function (x, admin, refus, lireAd, ecrireAd) {
      var fa = $("#" + x + "-adresse");
      if (!fa || fa.getAttribute("data-branche")) return;
      fa.setAttribute("data-branche", "1");
      var ca = { ligne: $("#" + x + "-ligne"), cp: $("#" + x + "-cp"), ville: $("#" + x + "-ville"), pays: $("#" + x + "-pays") };
      var dita = $("#" + x + "-adresse-etat");
      lireAd().then(function (ad) {
        Object.keys(ca).forEach(function (k) { if (ad[k]) ca[k].value = ad[k]; });
      });
      if (!admin) {
        Object.keys(ca).forEach(function (k) { ca[k].disabled = true; });
        fa.querySelector("button").hidden = true;
        dita.textContent = refus;
      }
      fa.addEventListener("submit", function (ev) {
        ev.preventDefault();
        var ad = { ligne: ca.ligne.value.trim(), cp: ca.cp.value.trim(), ville: ca.ville.value.trim(), pays: ca.pays.value };
        var manque = [["ligne", "l'adresse"], ["cp", "le code postal"], ["ville", "la ville"], ["pays", "le pays"]].filter(function (k) { return !ad[k[0]]; });
        if (manque.length) { dita.textContent = "Adresse obligatoire : indiquez " + manque.map(function (k) { return k[1]; }).join(", ") + "."; ca[manque[0][0]].focus(); return; }
        dita.textContent = "Enregistrement…";
        ecrireAd(ad).then(function (r) { dita.textContent = r.ok ? "Adresse enregistrée." : r.erreur; });
      });
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
        brancherAdresse("ent", e.role === "admin", "Seul le responsable du compte de l'entreprise change son adresse.",
          function () { return V.rpc("espace_lire", { e: e.entreprise_id }).then(function (r) {
            return (r.ok && r.donnees && r.donnees.entreprise && (r.donnees.entreprise.reglages || {}).adresse) || {}; }); },
          function (ad) { return V.rpc("entreprise_adresse", { e: e.entreprise_id, adresse: ad }); });
        $("#entreprise-role").textContent = e.role === "admin" ? "Responsable du compte"
          : e.role === "lecteur" ? "Lecture seule" : "Utilisateur";
        var f = $("#entreprise-formule"), ouvrir = $("#entreprise-ouvrir"), tarifs = $("#entreprise-tarifs");
        if (e.rang > 0) {
          f.textContent = nomDuRang(e.rang);
          ouvrir.href = vers("app/index.html");
          ouvrir.onclick = function () { V.choisir(e.entreprise_id); };
          ouvrir.hidden = false; tarifs.hidden = true;
        } else {
          f.textContent = "Aucun abonnement pour l'instant : votre espace s'ouvre avec lui.";
          ouvrir.hidden = true; tarifs.hidden = false;
          // Une offre choisie avant de créer le compte : on y revient directement.
          try {
            var voulu = JSON.parse(window.localStorage.getItem("pco-souscrire") || "null");
            if (voulu && /^(textes|suivi|complet)$/.test(voulu.formule) && /^(an|mois)$/.test(voulu.periode)) {
              tarifs.href = vers("compte/paiement.html?formule=" + voulu.formule + "&periode=" + voulu.periode);
              tarifs.textContent = "Finaliser mon abonnement";
            }
          } catch (x) { /* sans effet */ }
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
        ? "Vous y créerez l'espace de chacun de vos clients ; vous en serez le responsable du compte."
        : "C'est elle qui portera l'abonnement, le plan de veille et le registre ; vous en serez le responsable du compte.";
    };
    var types = document.querySelectorAll('input[name="e-type"]');
    for (var t = 0; t < types.length; t++) types[t].addEventListener("change", typeChoisi);

    /* Votre cabinet (consultants) : un lien vers sa page. */
    /* « Mes clients » (5 novembre 2026) : la liste des entreprises du cabinet, et
       les retirer. Sans compte créé, l'espace vide est supprimé ; avec un compte,
       le client est seulement détaché et garde tout (cabinet_retirer_client). */
    var mesClients = function (cab) {
      var carte = $("#compte-clients"), ul = $("#mc-liste"), dit = $("#etat-clients");
      if (!carte) return;
      V.rpc("cabinet_vue", { c: cab.cabinet_id }).then(function (r) {
        if (!r.ok || !r.donnees) return;
        var l = (r.donnees.clients || []).slice().sort(function (a, b) { return a.denomination.localeCompare(b.denomination, "fr"); });
        ul.textContent = "";
        $("#mc-aucun").hidden = l.length > 0;
        l.forEach(function (x) {
          var li = document.createElement("li");
          var t = document.createElement("div"); t.className = "mc-texte";
          var n = document.createElement("strong"); n.textContent = x.denomination; t.appendChild(n);
          var d = document.createElement("span"); d.className = "precision";
          d.textContent = (x.naf ? "Code APE " + x.naf + " · " : "") +
            (x.membres > 0 ? "Compte créé" : "En attente : le client n'a pas encore créé son compte");
          t.appendChild(d);
          li.appendChild(t);
          /* Avant « Supprimer » (6 novembre 2026, demande d'Axel) : créer le compte du
             client (son responsable reçoit l'invitation) et ouvrir sa fiche, la même
             que celle qu'il voit lui-même. */
          var actions = document.createElement("div"); actions.className = "mc-actions";
          li.appendChild(actions);
          if (x.acces) {
            var o = document.createElement("a");
            o.className = "bouton bouton-accent bouton-petit"; o.textContent = "Ouvrir la fiche client";
            o.href = vers("app/index.html");
            o.setAttribute("aria-label", "Ouvrir la fiche de " + x.denomination);
            o.addEventListener("click", function () { V.choisir(x.id); });
            actions.appendChild(o);
          }
          if (!(x.membres > 0) && x.acces && cab.role !== "lecteur") {
            var cc = document.createElement("button");
            cc.type = "button"; cc.className = "bouton bouton-sobre bouton-petit"; cc.textContent = "Inviter mon client";
            cc.setAttribute("aria-expanded", "false");
            cc.addEventListener("click", function () {
              var deja = li.nextElementSibling && li.nextElementSibling.classList.contains("mc-creer") ? li.nextElementSibling : null;
              if (deja) { deja.remove(); cc.setAttribute("aria-expanded", "false"); return; }
              cc.setAttribute("aria-expanded", "true");
              var zone = document.createElement("li"); zone.className = "mc-creer";
              var f = document.createElement("form"); f.setAttribute("novalidate", "");
              var id = "mc-inv-" + x.id;
              var lab = document.createElement("label"); lab.htmlFor = id;
              lab.textContent = "E-mail du responsable de « " + x.denomination + " »";
              var champ = document.createElement("input"); champ.type = "email"; champ.id = id; champ.autocomplete = "off";
              champ.inputMode = "email"; champ.spellcheck = false;
              var ok = document.createElement("button"); ok.type = "submit"; ok.className = "bouton bouton-accent bouton-petit"; ok.textContent = "Envoyer l'invitation";
              var etat = document.createElement("p"); etat.className = "etat-compte"; etat.setAttribute("role", "status");
              var ligneF = document.createElement("div"); ligneF.className = "mc-creer-ligne";
              ligneF.appendChild(champ); ligneF.appendChild(ok);
              f.appendChild(lab); f.appendChild(ligneF); f.appendChild(etat);
              f.addEventListener("submit", function (ev) {
                ev.preventDefault();
                var adresse = champ.value.trim().toLowerCase();
                if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(adresse)) { etat.textContent = "Entrez une adresse e-mail valable."; champ.focus(); return; }
                ok.disabled = true; etat.textContent = "Création du compte…";
                V.rpc("inviter", { courriel: adresse, role: "admin", entreprise: x.id }).then(function (r3) {
                  ok.disabled = false;
                  if (!r3.ok) { etat.textContent = r3.erreur; return; }
                  f.textContent = "";
                  var fait = document.createElement("p");
                  var fort = document.createElement("strong"); fort.textContent = "Un e-mail d'invitation part à " + adresse + " dans les minutes qui suivent.";
                  fait.appendChild(fort);
                  fait.appendChild(document.createTextNode(" Il y crée son compte et devient le responsable du compte de « " + x.denomination + " » (lien valable 7 jours)."));
                  f.appendChild(fait);
                  // Renvoyer l'invitation si le premier e-mail n'est pas arrivé (6 novembre 2026).
                  var rv = document.createElement("p"); rv.className = "mc-renvoyer";
                  var bRv = document.createElement("button"); bRv.type = "button"; bRv.className = "bouton bouton-sobre bouton-petit";
                  bRv.textContent = "Renvoyer l'invitation";
                  var dRv = document.createElement("span"); dRv.className = "precision"; dRv.setAttribute("role", "status");
                  dRv.textContent = " Si le premier e-mail n'est pas arrivé (pensez aussi aux courriers indésirables).";
                  bRv.addEventListener("click", function () {
                    bRv.disabled = true; dRv.textContent = " Envoi…";
                    V.rpc("inviter", { courriel: adresse, role: "admin", entreprise: x.id }).then(function (r4) {
                      bRv.disabled = false;
                      dRv.textContent = r4.ok ? " Invitation renvoyée à " + adresse + " : elle part dans les minutes qui suivent." : " " + r4.erreur;
                    });
                  });
                  rv.appendChild(bRv); rv.appendChild(dRv); f.appendChild(rv);
                  cc.remove();
                });
              });
              zone.appendChild(f);
              li.after(zone);
              champ.focus();
            });
            actions.appendChild(cc);
          }
          if (cab.role === "admin") {
            var b = document.createElement("button");
            b.type = "button"; b.className = "bouton bouton-sobre bouton-petit mc-retirer"; b.textContent = "Supprimer";
            b.addEventListener("click", function () {
              var q = x.membres > 0
                ? "Retirer « " + x.denomination + " » de vos clients ?\n\nSon espace lui appartient : il le garde, avec son plan et son registre, mais votre cabinet n'y aura plus accès."
                : "Supprimer « " + x.denomination + " » ?\n\nLe client n'a pas encore créé son compte : son espace et son invitation seront supprimés.";
              if (!window.confirm(q)) return;
              b.disabled = true; dit.textContent = "Un instant…";
              V.rpc("cabinet_retirer_client", { c: cab.cabinet_id, e: x.id }).then(function (r2) {
                if (!r2.ok) { b.disabled = false; dit.textContent = r2.erreur; return; }
                dit.textContent = r2.donnees === "supprime" ? "« " + x.denomination + " » est supprimé."
                  : "« " + x.denomination + " » ne fait plus partie de vos clients ; il garde son espace.";
                mesClients(cab);
              });
            });
            actions.appendChild(b);
          }
          ul.appendChild(li);
        });
        carte.hidden = false;
      });
    };

    var montrerCabinet = function (cab) {
      var b = $("#compte-cabinet");
      // « Tableaux de bord de mes clients », à côté de « Se déconnecter » et de même forme (6 novembre 2026).
      if ($("#cabinet-tableau")) $("#cabinet-tableau").hidden = !cab;
      if (!cab) { b.hidden = true; return; }
      $("#cabinet-nom").textContent = cab.nom;
      mesClients(cab);
      // L'adresse du cabinet, obligatoire (6 novembre 2026, migration 28).
      brancherAdresse("cab", cab.role === "admin", "Seul le responsable du compte du cabinet change son adresse.",
        function () { return V.rpc("cabinet_adresse_lire", { c: cab.cabinet_id }).then(function (r) { return (r.ok && r.donnees) || {}; }); },
        function (ad) { return V.rpc("cabinet_adresse", { c: cab.cabinet_id, adresse: ad }); });
      $("#cabinet-statut").textContent = cab.actif
        ? "Ouvert : vos clients ont la veille complète"
        : "Aucun abonnement en cours";
      b.hidden = false;
    };

    /* Le consultant de l'entreprise et son accès (l'administrateur décide). */
    var sonConsultant = function (e) {
      var b = $("#entreprise-consultant");
      V.rpc("mon_consultant", { e: e.entreprise_id }).then(function (r) {
        var c = r.ok && r.donnees;
        // Sans cabinet, la base ne rend rien (ou un objet vide) : pas de bloc.
        if (!c || typeof c !== "object" || !c.nom) { b.hidden = true; return; }
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
        // Votre propre ligne n'est pas montrée : la liste dit qui d'autre a accès.
        (d.membres || []).filter(function (m) { return !m.moi; }).forEach(function (m) {
          var li = document.createElement("li");
          li.className = "admin-compte";
          var t = document.createElement("span"); t.className = "admin-courriel";
          t.textContent = m.courriel + (m.moi ? " (vous)" : "");
          li.appendChild(t);
          var det = document.createElement("span"); det.className = "admin-details";
          det.textContent = role(m.role) + " · depuis le " + new Date(m.depuis).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
          li.appendChild(det);
          if (admin && !m.moi) {
            var outils = document.createElement("span"); outils.className = "equipe-outils";
            var choix = document.createElement("select");
            choix.setAttribute("aria-label", "Rôle de " + m.courriel);
            ["membre", "lecteur", "admin"].forEach(function (k) { choix.appendChild(new Option(role(k), k)); });
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
          det.textContent = role(i.role) + " · invitation valable jusqu'au " + new Date(i.expire_le).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
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
      var etatI = $("#etat-inviter"), adresse = $("#i-courriel").value.trim().toLowerCase(), role = "membre";   // le rôle se change ensuite dans la liste de l'équipe
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

    /* Les e-mails (4 novembre 2026) : récapitulatif quotidien et rappels. */
    /* --- Mon abonnement et mes factures (5 novembre 2026) --------------------
       Le type d'abonnement, la fin, le prochain prélèvement (lus chez Stripe par
       outils/stripe.mjs) et les factures déposées par l'administrateur du site.
       Les factures ne sont montrées qu'au responsable du compte (la base ne les
       donne qu'à lui). */
    var bloc = $("#abo-bloc");
    if (bloc) {
      var NOMS_ABO = { textes: "01 — État des lieux réglementaire", suivi: "02 — État des lieux réglementaire et plan d'actions",
                       complet: "03 — Veille complète", consultant: "Offre consultant QSE" };
      var jourAbo = function (iso) {
        return iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "";
      };
      var euros = function (n) { return Number(n).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " € TTC"; };
      var telecharger = function (id, bouton) {
        var avant = bouton.textContent;
        bouton.disabled = true; bouton.textContent = "Téléchargement…";
        V.rpc("ma_facture", { id: id }).then(function (r) {
          bouton.disabled = false; bouton.textContent = avant;
          if (!r.ok || !r.donnees) { $("#etat-abo").textContent = (r && r.erreur) || "La facture n'a pas pu être téléchargée."; return; }
          var bin = atob(r.donnees.contenu), octets = new Uint8Array(bin.length);
          for (var i = 0; i < bin.length; i++) octets[i] = bin.charCodeAt(i);
          var url = URL.createObjectURL(new Blob([octets], { type: "application/pdf" }));
          var a = document.createElement("a");
          a.href = url; a.download = r.donnees.nom || "facture.pdf";
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
        });
      };
      V.rpc("mon_abonnement").then(function (r) {
        if (!r.ok || !r.donnees) return;
        // Le responsable d'un cabinet voit l'abonnement de son cabinet (c'est lui qui le paie),
        // même s'il est aussi membre d'une entreprise (6 novembre 2026).
        var d = r.donnees;
        var cabAdmin = (d.cabinets || []).filter(function (c) { return c.role === "admin"; })[0];
        var esp = cabAdmin || (d.entreprises || [])[0] || (d.cabinets || [])[0];
        if (!esp) return;
        var estCabinet = (d.cabinets || []).indexOf(esp) !== -1;
        var a = esp.abonnement, actif = a && /^(active|trialing|past_due|offert)$/.test(a.statut);
        // Un cabinet consultant : son offre est sur la page consultants ; et le récapitulatif
        // et les rappels ne concernent que le plan d'une entreprise, qu'il n'a pas.
        if (estCabinet) $("#abo-changer").href = vers(bloc.hasAttribute("data-consultant-en-ligne") ? "compte/paiement-consultant.html" : "consultants.html");
        if (!(d.entreprises || []).length) {
          $("#abo-changer").href = vers(bloc.hasAttribute("data-consultant-en-ligne") ? "compte/paiement-consultant.html" : "consultants.html");
          [].forEach.call(document.querySelectorAll(".ligne-bascule"), function (x) { x.hidden = true; });
          var er = $("#etat-recap"); if (er) er.hidden = true;
        }
        var formule = $("#abo-formule"), fin = $("#abo-fin"), prel = $("#abo-prelevement");
        if (esp.par_cabinet && !actif) {
          formule.textContent = "03 — Veille complète, comprise dans l'abonnement de votre cabinet consultant";
          fin.textContent = "Selon l'abonnement de votre cabinet"; prel.textContent = "Aucun : c'est votre cabinet qui est abonné";
        } else if (!actif) {
          formule.textContent = a && a.statut === "canceled" ? (NOMS_ABO[a.formule] || a.formule) + " — résilié" : "Aucun abonnement en cours";
          fin.textContent = a && a.fin_periode ? "Terminé le " + jourAbo(a.fin_periode) : "—";
          prel.textContent = "Aucun";
        } else {
          formule.textContent = (NOMS_ABO[a.formule] || a.formule) + (a.periode === "an" ? " · paiement annuel" : " · paiement mensuel") +
            (a.statut === "trialing" ? " (mois d'essai gratuit)" : "");
          if (a.offert) {
            fin.textContent = a.fin_periode ? jourAbo(a.fin_periode) : "Sans date de fin";
            prel.textContent = "Aucun : abonnement ouvert par nos soins";
          } else if (a.resiliation_prevue) {
            fin.textContent = jourAbo(a.fin_periode) + " (résiliation demandée)";
            prel.textContent = "Aucun : l'abonnement s'arrête à cette date";
          } else {
            fin.textContent = a.fin_periode ? "Aucune : reconduction automatique le " + jourAbo(a.fin_periode) : "Aucune : reconduction automatique";
            prel.textContent = a.fin_periode ? jourAbo(a.fin_periode) : "—";
            if (a.statut === "past_due") prel.textContent += " — le dernier paiement n'est pas passé";
            if (a.statut === "trialing") prel.textContent += " — fin du mois d'essai gratuit";
          }
        }
        /* Résilier (mensuel, à tout moment) ou ne pas renouveler (annuel), 5 novembre 2026.
           Pour un abonnement payé chez Stripe, et pour le responsable du compte seulement.
           Le geste se fait dans le portail client de Stripe (contenu/paiement.js, « portail ») ;
           sans portail, un e-mail prêt à envoyer. Le robot (outils/stripe.mjs) relit la
           résiliation et Mon compte la montre. */
        var zr = $("#abo-resilier");
        zr.textContent = ""; zr.hidden = true;
        if (actif && !a.offert && esp.role === "admin") {
          var portail = bloc.getAttribute("data-portail") || "";
          var annuel = a.periode === "an", qui = (V.utilisateur() || {}).courriel || "";
          var lien = function (texte, objet) {
            var x = document.createElement("a");
            x.className = "bouton bouton-sobre bouton-petit abo-bouton-resilier";
            x.textContent = texte;
            if (portail) {
              x.href = portail + (qui ? (portail.indexOf("?") === -1 ? "?" : "&") + "prefilled_email=" + encodeURIComponent(qui) : "");
              x.target = "_blank"; x.rel = "noopener";
            } else {
              var dest = document.body.getAttribute("data-courriel") || "";
              x.href = "mailto:" + dest + "?subject=" + encodeURIComponent(objet + " — " + esp.nom) +
                "&body=" + encodeURIComponent("Bonjour,\n\n" + objet + " de l'abonnement de « " + esp.nom + " » (" + (NOMS_ABO[a.formule] || a.formule) +
                  ", " + (annuel ? "annuel" : "mensuel") + ").\nCompte : " + qui + "\n\nBien cordialement,");
            }
            return x;
          };
          /* Par la fonction serveur (6 novembre 2026) : le geste est fait directement chez Stripe,
             sans passer par le portail. Si elle ne répond pas : le lien d'avant (portail ou e-mail). */
          var serveur = function (x, action, args, attente) {
            x.addEventListener("click", function (ev) {
              if (ev.defaultPrevented || !V.fonction) return;
              ev.preventDefault();
              if (x.getAttribute("data-attente")) return;
              var avant = x.textContent, secours = x.href;
              x.setAttribute("data-attente", "1"); x.textContent = attente;
              V.fonction(action, args()).then(function (r) {
                x.removeAttribute("data-attente"); x.textContent = avant;
                if (r.ok) { window.location.reload(); return; }
                if (r.absente) { window.location.href = secours; return; }
                $("#etat-abo").textContent = r.erreur;
              });
            });
          };
          var ici2 = function (extra) {
            var o = estCabinet ? { cabinet: esp.id } : { entreprise: esp.id };
            Object.keys(extra || {}).forEach(function (k) { o[k] = extra[k]; });
            return o;
          };
          var note = document.createElement("p"); note.className = "precision";
          if (a.resiliation_prevue) {
            note.textContent = "Résiliation enregistrée : votre abonnement s'arrête le " + jourAbo(a.fin_periode) +
              ", sans nouveau prélèvement. Vous gardez tout votre accès jusqu'à cette date.";
            zr.appendChild(note);
            var rep = lien("Annuler la résiliation", "Annulation de la résiliation");
            serveur(rep, "resilier", function () { return ici2({ reprendre: true }); }, "Annulation…");
            zr.appendChild(rep);
          } else {
            var b = lien(annuel ? "Ne pas renouveler mon abonnement" : "Résilier mon abonnement",
              annuel ? "Non-renouvellement" : "Résiliation");
            b.addEventListener("click", function (ev) {
              var q = annuel
                ? "Ne pas renouveler votre abonnement annuel ?\n\nIl reste actif jusqu'au " + jourAbo(a.fin_periode) + ", puis s'arrête sans nouveau prélèvement."
                : "Résilier votre abonnement mensuel ?\n\nIl s'arrête à la fin du mois en cours, déjà payé (" + jourAbo(a.fin_periode) + "), sans nouveau prélèvement.";
              if (!window.confirm(q + (V.fonction ? "" : portail ? "\n\nVous allez être dirigé vers notre espace de paiement sécurisé (Stripe) pour confirmer." : "\n\nUn e-mail de demande va s'ouvrir : envoyez-le pour confirmer."))) ev.preventDefault();
            });
            serveur(b, "resilier", function () { return ici2(); }, "Résiliation…");
            note.textContent = a.statut === "trialing"
              ? "Mois d'essai gratuit jusqu'au " + jourAbo(a.fin_periode) + " : en résiliant avant cette date, vous ne payez rien."
              : annuel
              ? "Abonnement annuel : vous pouvez choisir de ne pas le renouveler. Il reste actif jusqu'au " + jourAbo(a.fin_periode) + ", puis s'arrête."
              : "Abonnement mensuel : résiliable à tout moment. Il s'arrête à la fin du mois en cours, déjà payé ; aucun nouveau prélèvement.";
            zr.appendChild(note);
            if (a.formule === "consultant") {
              // Le consultant change seul son nombre de clients (6 novembre 2026).
              var nb = lien("Modifier le nombre de clients", "Modification du nombre de clients");
              nb.classList.remove("abo-bouton-resilier");
              var voulu = 0;
              nb.addEventListener("click", function (ev) {
                if (!V.fonction) return;
                var t = window.prompt("Nombre de clients couverts par votre abonnement" +
                  (a.clients_max ? " (actuellement " + a.clients_max + ")" : "") + " :", a.clients_max || "");
                voulu = parseInt(t, 10);
                if (t === null || !(voulu >= 1 && voulu <= 500)) {
                  ev.preventDefault();
                  if (t !== null) $("#etat-abo").textContent = "Indiquez un nombre de clients de 1 à 500.";
                }
              });
              serveur(nb, "clients", function () { return { cabinet: esp.id, nombre: voulu }; }, "Modification…");
              zr.appendChild(nb);
            }
            zr.appendChild(b);
          }
          zr.hidden = false;
        } else if (actif && a.offert && esp.role === "admin") {
          // Un abonnement ouvert par nos soins (sans Stripe) : résilié ici, aussitôt,
          // sans e-mail (6 novembre 2026, migration 27).
          var n2 = document.createElement("p"); n2.className = "precision";
          n2.textContent = "";   // seul le bouton « Résilier mon abonnement » (demande d'Axel)
          var x2 = document.createElement("button"); x2.type = "button";
          x2.className = "bouton bouton-sobre bouton-petit abo-bouton-resilier"; x2.textContent = "Résilier mon abonnement";
          x2.addEventListener("click", function () {
            if (!window.confirm("Résilier l'abonnement de « " + esp.nom + " » ?\n\nIl s'arrête aussitôt" +
              (estCabinet ? " : les espaces de vos clients se ferment." : "."))) return;
            x2.disabled = true; n2.textContent = "Résiliation…";
            V.rpc("resilier_offert", estCabinet ? { entreprise: null, cabinet: esp.id } : { entreprise: esp.id, cabinet: null }).then(function (r5) {
              if (!r5.ok) { x2.disabled = false; n2.textContent = r5.erreur; return; }
              formule.textContent = (NOMS_ABO[a.formule] || a.formule) + " — résilié";
              fin.textContent = "Terminé aujourd'hui"; prel.textContent = "Aucun";
              n2.textContent = "Votre abonnement est résilié.";
              x2.remove();
            });
          });
          zr.appendChild(n2); zr.appendChild(x2);
          zr.hidden = false;
        } else if (!actif && esp.role === "admin" && !esp.par_cabinet) {
          // Rien à résilier : on le dit, plutôt qu'un espace vide (6 novembre 2026).
          var n5 = document.createElement("p"); n5.className = "precision";
          n5.textContent = "Aucun abonnement en cours : il n'y a rien à résilier.";
          zr.appendChild(n5); zr.hidden = false;
        } else if (esp.par_cabinet && !actif) {
          // Le client d'un consultant : c'est le cabinet qui est abonné et qui paie.
          var n3 = document.createElement("p"); n3.className = "precision";
          n3.textContent = "Votre veille est comprise dans l'abonnement de votre cabinet consultant : il n'y a rien à résilier de votre côté. " +
            "Pour arrêter, adressez-vous à votre consultant ; vous pouvez aussi lui retirer l'accès à votre espace.";
          zr.appendChild(n3); zr.hidden = false;
        } else if (actif && esp.role !== "admin") {
          var n4 = document.createElement("p"); n4.className = "precision";
          n4.textContent = "Seul le responsable du compte de « " + esp.nom + " » peut résilier l'abonnement.";
          zr.appendChild(n4); zr.hidden = false;
        }
        // L'abonnement consultant : combien de clients il couvre (migration 26).
        if (a && a.formule === "consultant" && actif && estCabinet) {
          V.rpc("cabinet_places", { c: esp.id }).then(function (rp) {
            if (!rp.ok || !rp.donnees || rp.donnees.max === null || rp.donnees.max === undefined) return;
            formule.textContent += " · " + rp.donnees.max + " client" + (rp.donnees.max > 1 ? "s" : "") +
              " couvert" + (rp.donnees.max > 1 ? "s" : "") + " (" + rp.donnees.clients + " utilisé" + (rp.donnees.clients > 1 ? "s" : "") + ")";
          });
        }

        var liste = $("#abo-liste");
        if (esp.factures) {
          $("#abo-factures").hidden = false;
          $("#abo-aucune").hidden = esp.factures.length > 0;
          liste.textContent = "";
          esp.factures.forEach(function (f) {
            var li = document.createElement("li");
            var txt = document.createElement("span");
            txt.className = "abo-facture";
            var n = document.createElement("strong"); n.textContent = "Facture " + f.numero; txt.appendChild(n);
            var p = document.createElement("span"); p.className = "precision";
            p.textContent = jourAbo(f.emise_le) + (f.montant_ttc != null ? " · " + euros(f.montant_ttc) : "");
            txt.appendChild(p);
            var b = document.createElement("button");
            b.type = "button"; b.className = "bouton bouton-sobre bouton-petit"; b.textContent = "Télécharger (PDF)";
            b.addEventListener("click", function () { telecharger(f.id, b); });
            li.appendChild(txt); li.appendChild(b); liste.appendChild(li);
          });
        }
        bloc.hidden = false;
      });
    }

    var cRecap = $("#p-recap"), cRappels = $("#p-rappels");
    if (cRecap && cRappels) {
      var etatR = $("#etat-recap");
      V.rpc("mon_recap").then(function (r) {
        if (!r.ok || !r.donnees) return;
        cRecap.checked = !!r.donnees.recap; cRappels.checked = r.donnees.rappels !== false;
        cRecap.disabled = cRappels.disabled = false;
      });
      [[cRecap, "oui"], [cRappels, "rappels"]].forEach(function (x) {
        x[0].addEventListener("change", function () {
          var args = {}; args[x[1]] = x[0].checked;
          x[0].disabled = true;
          V.rpc("regler_recap", args).then(function (r) {
            x[0].disabled = false;
            if (!r.ok) { x[0].checked = !x[0].checked; dire(etatR, r.erreur || "Réglage non enregistré."); return; }
            dire(etatR, x[1] === "oui"
              ? (x[0].checked ? "C'est noté : vous recevrez le récapitulatif chaque matin." : "Récapitulatif quotidien arrêté.")
              : (x[0].checked ? "Rappels des actions en retard activés." : "Rappels des actions en retard arrêtés."));
          });
        });
      });
    }

    /* RGPD (4 novembre 2026) : télécharger ses données, supprimer son compte. */
    var bExport = $("#rgpd-exporter");
    if (bExport) bExport.addEventListener("click", function () {
      var etatX = $("#etat-exporter");
      bExport.disabled = true; dire(etatX, "Préparation…");
      V.rpc("mes_donnees").then(function (r) {
        bExport.disabled = false;
        if (!r.ok) { dire(etatX, r.erreur); return; }
        var fichier = new Blob([JSON.stringify(r.donnees, null, 2)], { type: "application/json" });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(fichier);
        a.download = "mes-donnees-vigie-" + new Date().toISOString().slice(0, 10) + ".json";
        document.body.appendChild(a); a.click(); a.remove();
        window.setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
        dire(etatX, "Le fichier est téléchargé.");
      });
    });
    // Venu de Réglages (« Supprimer le compte ») : on ouvre la ligne directement.
    if (window.location.hash === "#supprimer" && $("#supprimer")) { $("#supprimer").open = true; $("#supprimer").scrollIntoView(); }
    var fSuppr = $("#form-supprimer");
    if (fSuppr) fSuppr.addEventListener("submit", function (e) {
      e.preventDefault();
      var etatS = $("#etat-supprimer"), saisie = $("#s-courriel").value.trim().toLowerCase();
      var moi = ((V.utilisateur() || {}).courriel || "").toLowerCase();
      if (!saisie || saisie !== moi) { dire(etatS, "Saisissez exactement votre adresse électronique : " + moi + "."); return; }
      var b = fSuppr.querySelector("button[type=submit]");
      b.disabled = true; dire(etatS, "Suppression…");
      V.rpc("supprimer_mon_compte").then(function (r) {
        if (!r.ok) { b.disabled = false; dire(etatS, r.erreur); return; }
        V.deconnecter().then(function () { window.location.href = vers("index.html?compte=supprime"); });
      });
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
          p1.appendChild(mk("strong", "", "Un e-mail d'invitation part à " + adresse + " dans les minutes qui suivent."));
          p1.appendChild(document.createTextNode(" Il y crée son compte et devient le responsable du compte de « " + c.denomination +
            " ». Le lien ci-dessous est le même (valable 7 jours, une seule fois), si vous préférez aussi l'envoyer vous-même."));
          boite.appendChild(p1);
          var l = mk("input"); l.type = "text"; l.readOnly = true; l.value = adresseLien; l.setAttribute("aria-label", "Le lien d'invitation");
          boite.appendChild(l);
          var rg = mk("p", "rangee"); rg.style.marginTop = "var(--t3)";
          var cp = mk("button", "bouton bouton-accent", "Copier le lien"); cp.type = "button";
          cp.addEventListener("click", function () { copier(l, cp); });
          var mail = mk("a", "bouton bouton-sobre", "L'envoyer aussi depuis ma messagerie");
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
      carte.appendChild(mk("p", "admin-details", c.derniere_trace
        ? "Dernière trace au registre le " + dateLongue(c.derniere_trace) + "."
        : "Rien au registre pour l'instant."));
      if (c.membres) {
        carte.appendChild(mk("p", "admin-details", pluriel(c.membres, "personne de l'entreprise a", "personnes de l'entreprise ont") + " un compte."));
      } else {
        carte.appendChild(mk("p", "", "Votre client n'a pas encore de compte : invitez votre client."));
        carte.appendChild(inviterClient(carte, c));
      }
      var rg = mk("p", "rangee"); rg.style.marginTop = "var(--t3)";
      if (cabinet.actif) {
        var ouvrir = mk("a", "bouton bouton-accent", "Ouvrir son espace");
        ouvrir.href = vers("app/index.html");
        ouvrir.addEventListener("click", function () { V.choisir(c.id); });
        rg.appendChild(ouvrir);
      }
      carte.appendChild(rg);
      return carte;
    };

    /* --- Le tableau de bord consultant (3 novembre 2026) ----------------------
       Pour chaque société : ses textes non lus, sa conformité et l'avancement
       de son plan d'actions. Le plan de veille se recalcule ici (code APE et
       cases « vrai chez nous », comme assets/entreprise.js) ; la liste des
       textes vient de assets/textes-plan.js. */
    var P = window.PLAN, TP = window.TEXTES_PLAN || [];
    var sujetsDu = function (naf, contexte) {
      var div = P && P.div[String(naf || "").replace(/[^0-9A-Za-z]/g, "").slice(0, 2)];
      if (!div) return null;
      var vus = {};
      div.b.forEach(function (id) { vus[id] = 1; });
      (contexte || []).forEach(function (qid) {
        P.q.forEach(function (q) { if (q.id === qid) q.dom.forEach(function (id) { if (P.d[id]) vus[id] = 1; }); });
      });
      return vus;
    };
    var chiffresClient = function (c) {
      if (!c.acces) return null;
      var faites = c.actions_faites || 0, engagees = faites + (c.actions_ouvertes || 0);
      var x = { avancement: engagees ? Math.round(faites / engagees * 100) : null, faites: faites, engagees: engagees,
                retard: c.actions_en_retard || 0, total: 0, nonLus: null, conformite: null };
      var sujets = sujetsDu(c.naf, c.contexte);
      if (!sujets) return x;
      var lus = {}, conf = {};
      (c.lus || []).forEach(function (k) { lus[k] = 1; });
      (c.conformes || []).forEach(function (k) { conf[k] = 1; });
      var nl = 0, nc = 0;
      TP.forEach(function (t) {
        if (!t[1].split(" ").some(function (id) { return sujets[id]; })) return;
        x.total++;
        if (!lus[t[0]]) nl++;
        if (conf[t[0]]) nc++;
      });
      x.nonLus = nl;
      x.conformite = x.total ? Math.round(nc / x.total * 100) : null;
      return x;
    };
    var barre = function (pct, detail) {
      var td = mk("td");
      if (pct == null) { td.appendChild(mk("span", "cs-vide", "—")); }
      else {
        var b = mk("span", "cs-barre"); b.setAttribute("role", "img"); b.setAttribute("aria-label", pct + " %");
        var r = mk("span"); r.style.width = pct + "%"; b.appendChild(r);
        td.appendChild(b); td.appendChild(mk("span", "cs-pct", pct + " %"));
      }
      if (detail) td.appendChild(mk("span", "cs-detail", detail));
      return td;
    };
    var tableauBord = function (cl) {
      var corps = $("#cs-lignes"); corps.textContent = "";
      var tNonLus = 0, confs = [], tFaites = 0, tEngagees = 0, n = 0;
      cl.forEach(function (c) {
        var x = chiffresClient(c), tr = mk("tr");
        var th = mk("th"); th.scope = "row";
        th.appendChild(mk("span", "cs-nom", c.denomination));
        th.appendChild(mk("span", "cs-detail", c.naf ? "Code APE " + c.naf : "Code APE à régler"));
        tr.appendChild(th);
        if (!x) {
          var td = mk("td", "cs-coupe", "Accès coupé par le client"); td.colSpan = 3; tr.appendChild(td);
        } else {
          n++;
          var tdl = mk("td");
          if (x.nonLus == null) tdl.appendChild(mk("span", "cs-vide", "—"));
          else {
            tNonLus += x.nonLus;
            tdl.appendChild(mk("span", "cs-nombre" + (x.nonLus ? " cs-attention" : ""), String(x.nonLus)));
            tdl.appendChild(mk("span", "cs-detail", "sur " + x.total + " texte" + (x.total > 1 ? "s" : "")));
          }
          tdl.setAttribute("data-titre", "Textes non lus");
          tr.appendChild(tdl);
          if (x.conformite != null) confs.push(x.conformite);
          var tdc = barre(x.conformite, x.nonLus == null ? "Code APE à régler" : ""); tdc.setAttribute("data-titre", "Conformité réglementaire"); tr.appendChild(tdc);
          tFaites += x.faites; tEngagees += x.engagees;
          var tda = barre(x.avancement, x.engagees ? x.faites + " sur " + x.engagees + (x.retard ? " · " + x.retard + " en retard" : "") : "Aucune action engagée");
          tda.setAttribute("data-titre", "Avancement du plan d'actions");
          if (x.retard) tda.classList.add("cs-retard");
          tr.appendChild(tda);
        }
        var tdo = mk("td", "cs-ouvrir");
        if (c.acces && cabinet.actif) {
          // Ouvrir le compte du client, directement sur l'écran voulu.
          var ul = mk("ul", "cs-liens");
          [["index.html", "Tableau de bord"], ["plan.html", "Veille réglementaire"], ["actions.html", "Plan d'actions"], ["conformite.html", "Registre de conformité"]].forEach(function (x) {
            var li = mk("li"), o = mk("a", "", x[1]);
            o.href = vers("app/" + x[0]);
            o.setAttribute("aria-label", x[1] + " de " + c.denomination);
            o.addEventListener("click", function () { V.choisir(c.id); });
            li.appendChild(o); ul.appendChild(li);
          });
          tdo.appendChild(ul);
        } else if (c.acces) {
          tdo.appendChild(mk("span", "cs-detail", "S'ouvre avec votre abonnement"));
        }
        tr.appendChild(tdo);
        corps.appendChild(tr);
      });
      $("#cs-clients").textContent = cl.length;
      $("#cs-non-lus").textContent = n ? tNonLus : "—";
      $("#cs-conformite").textContent = confs.length ? Math.round(confs.reduce(function (a, b) { return a + b; }, 0) / confs.length) + " %" : "—";
      $("#cs-avancement").textContent = tEngagees ? Math.round(tFaites / tEngagees * 100) + " %" : "—";
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
          : "Pas encore de client : créez le premier avec « Créer l'accès d'un client ».");
        var inactif = $("#cabinet-inactif");
        inactif.hidden = !!cabinet.actif;
        if (!cabinet.actif && !$("#cabinet-demander").hasAttribute("data-en-ligne")) {
          $("#cabinet-demander").href = "mailto:" + CONTACT + "?subject=" + encodeURIComponent("Ouvrir l'abonnement consultant — " + cabinet.nom) +
            "&body=" + encodeURIComponent("Bonjour,\n\nPouvez-vous ouvrir l'abonnement consultant du cabinet « " + cabinet.nom +
              " » ?\nCompte : " + ((V.utilisateur() || {}).courriel || "") + "\n");
        }
        // « Gérer vos clients » est retiré de cette page (6 novembre 2026) : la liste et
        // l'invitation sont dans Mon compte, « Mes clients ».
        var liste = $("#cabinet-clients");
        if (liste) { liste.textContent = ""; cl.forEach(function (c) { liste.appendChild(carteClient(c)); }); }
        tableauBord(cl);
        // Le tableau de bord s'affiche dès le début, même vide.
        $("#cabinet-vos-clients").hidden = false;
        if (!cl.length) {
          var vide = mk("tr"), tv = mk("td", "cs-vide-ligne", "Aucun client pour l'instant : créez le premier avec « Créer l'accès d'un client ».");
          tv.colSpan = 5; vide.appendChild(tv); $("#cs-lignes").appendChild(vide);
        }
        // Les premiers pas, cochés d'après les données du cabinet.
        var etapes = {
          cabinet: [true, "« " + cabinet.nom + " » est créé ; vous êtes le responsable du compte."],
          client: [cl.length > 0, cl.length ? pluriel(cl.length, "client créé", "clients créés") + "." : null],
          plan: [cl.some(function (c) { return !!c.naf; }), cl.length ? pluriel(cl.filter(function (c) { return !!c.naf; }).length, "client a son code APE", "clients ont leur code APE") + " sur " + cl.length + "." : null],
          invite: [cl.some(function (c) { return c.membres > 0; }), cl.some(function (c) { return c.membres > 0; }) ? pluriel(cl.filter(function (c) { return c.membres > 0; }).length, "client a un compte", "clients ont un compte") + "." : null],
          abonnement: [!!cabinet.actif, cabinet.actif ? "Ouvert : vos clients ont la veille complète." : null]
        };
        var faites = 0;
        Object.keys(etapes).forEach(function (k) {
          var li = document.querySelector('#cs-etapes [data-etape="' + k + '"]');
          if (!li) return;
          li.classList.toggle("fait", etapes[k][0]);
          if (etapes[k][0]) faites++;
          if (etapes[k][1]) li.querySelector("[data-detail]").textContent = etapes[k][1];
        });
        $("#cabinet-demarrage").hidden = faites === Object.keys(etapes).length;
        cabinetP.hidden = false;
        // Le nombre de clients de l'abonnement (migration 26) : atteint, on le dit.
        if (window.VIGIE_PLACES) window.VIGIE_PLACES(cabinet.id, $("#form-client"), CONTACT, cabinet.nom, cabinetP.getAttribute("data-portail") || "");
      });
    };

    if ($("#form-client")) $("#form-client").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var nom = $("#cl-nom").value.trim(), dit = $("#etat-client");
      if (!nom) { dit.textContent = "Entrez le nom de l'entreprise cliente."; return; }
      dit.textContent = "Création…";
      V.rpc("creer_entreprise_cliente", { cabinet: cabinet.id, denomination: nom }).then(function (r) {
        if (!r.ok) {
          dit.textContent = r.erreur;
          if (window.VIGIE_PLACES) window.VIGIE_PLACES(cabinet.id, $("#form-client"), CONTACT, cabinet.nom, cabinetP.getAttribute("data-portail") || "");
          return;
        }
        $("#cl-nom").value = "";
        dit.textContent = "L'espace de « " + nom + " » est créé. Ouvrez-le pour régler son plan, puis invitez votre client.";
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

    /* Les factures d'une entreprise ou d'un cabinet (5 novembre 2026) : les
       déposer (PDF, 2 Mo au plus), les voir, les retirer. Le client les trouve
       dans Mon compte, « Mes factures » (son responsable du compte seulement). */
    var blocFactures = function (entreprise, cabinet) {
      var det = el("details", "admin-factures");
      var sum = el("summary", "", "Factures");
      det.appendChild(sum);
      var liste = el("ul", "admin-comptes");
      var dit = el("p", "etat-compte");
      var f = el("form", "admin-facture-form");
      var champ = function (libelle, input) {
        var l = el("label", "admin-facture-champ"); l.appendChild(el("span", "", libelle)); l.appendChild(input); return l;
      };
      var num = el("input"); num.type = "text"; num.required = true; num.maxLength = 60; num.placeholder = "VR-2026-0001";
      var jour = el("input"); jour.type = "date"; jour.required = true; jour.value = new Date().toISOString().slice(0, 10);
      var montant = el("input"); montant.type = "number"; montant.min = "0"; montant.step = "0.01"; montant.placeholder = "facultatif";
      var fichier = el("input"); fichier.type = "file"; fichier.accept = "application/pdf,.pdf"; fichier.required = true;
      var ok = el("button", "bouton bouton-accent", "Déposer la facture"); ok.type = "submit";
      f.appendChild(champ("Numéro", num)); f.appendChild(champ("Date", jour));
      f.appendChild(champ("Montant TTC (€)", montant)); f.appendChild(champ("Fichier PDF (2 Mo au plus)", fichier));
      f.appendChild(ok);
      det.appendChild(f); det.appendChild(dit); det.appendChild(liste);
      var lister = function () {
        V.rpc("admin_factures", { entreprise: entreprise, cabinet: cabinet }).then(function (r) {
          liste.textContent = "";
          var l = (r.ok && r.donnees) || [];
          sum.textContent = "Factures (" + l.length + ")";
          if (!l.length) liste.appendChild(el("li", "admin-details", "Aucune facture déposée."));
          l.forEach(function (x) {
            var li = el("li", "admin-compte admin-facture-ligne");
            li.appendChild(el("span", "admin-courriel", "Facture " + x.numero));
            li.appendChild(el("span", "admin-details", date(x.emise_le) + (x.montant_ttc != null ? " · " +
              Number(x.montant_ttc).toLocaleString("fr-FR", { minimumFractionDigits: 2 }) + " € TTC" : "") + " · " + x.nom));
            var tel = el("button", "lien-nu", "Télécharger (PDF)"); tel.type = "button";
            tel.addEventListener("click", function () {
              tel.disabled = true;
              V.rpc("ma_facture", { id: x.id }).then(function (r3) {
                tel.disabled = false;
                if (!r3.ok || !r3.donnees) { dit.textContent = (r3 && r3.erreur) || "La facture n'a pas pu être téléchargée."; return; }
                var bin = atob(r3.donnees.contenu), oct = new Uint8Array(bin.length);
                for (var i = 0; i < bin.length; i++) oct[i] = bin.charCodeAt(i);
                var url = URL.createObjectURL(new Blob([oct], { type: "application/pdf" }));
                var a = document.createElement("a"); a.href = url; a.download = r3.donnees.nom || "facture.pdf";
                document.body.appendChild(a); a.click(); a.remove();
                setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
              });
            });
            li.appendChild(tel);
            var sup = el("button", "lien-nu", "Retirer"); sup.type = "button";
            sup.addEventListener("click", function () {
              if (!window.confirm("Retirer la facture " + x.numero + " ? Le client ne la verra plus.")) return;
              sup.disabled = true;
              V.rpc("admin_supprimer_facture", { id: x.id }).then(function (r2) {
                if (!r2.ok) { dit.textContent = r2.erreur; sup.disabled = false; return; }
                dit.textContent = "Facture " + x.numero + " retirée."; lister();
              });
            });
            li.appendChild(sup);
            liste.appendChild(li);
          });
        });
      };
      det.addEventListener("toggle", function () { if (det.open) lister(); });
      f.addEventListener("submit", function (ev) {
        ev.preventDefault();
        var fi = fichier.files && fichier.files[0];
        if (!num.value.trim() || !jour.value || !fi) { dit.textContent = "Numéro, date et fichier PDF sont nécessaires."; return; }
        if (!/\.pdf$/i.test(fi.name)) { dit.textContent = "Le fichier doit être un PDF."; return; }
        if (fi.size > 2097152) { dit.textContent = "Le fichier dépasse 2 Mo."; return; }
        ok.disabled = true; dit.textContent = "Envoi de la facture…";
        var lecteur = new FileReader();
        lecteur.onload = function () {
          var b64 = String(lecteur.result).replace(/^data:[^,]*,/, "");
          V.rpc("admin_ajouter_facture", { entreprise: entreprise, cabinet: cabinet, numero: num.value.trim(), emise_le: jour.value,
            montant_ttc: montant.value === "" ? null : Number(montant.value), nom_fichier: fi.name.replace(/[\/\\]/g, "-"), contenu: b64 }).then(function (r) {
            ok.disabled = false;
            if (!r.ok) { dit.textContent = r.erreur || "La facture n'a pas pu être déposée."; return; }
            dit.textContent = "Facture " + num.value.trim() + " déposée : le client la voit dans Mon compte et reçoit un e-mail pour le prévenir.";
            f.reset(); jour.value = new Date().toISOString().slice(0, 10); lister();
          });
        };
        lecteur.onerror = function () { ok.disabled = false; dit.textContent = "Le fichier n'a pas pu être lu."; };
        lecteur.readAsDataURL(fi);
      });
      return det;
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
        var role = m.role === "admin" ? "Responsable du compte" : m.role === "lecteur" ? "Lecture seule" : "Utilisateur";
        ul.appendChild(ligneCompte(m.courriel, role + " · depuis le " + date(m.depuis) +
          (m.derniere_connexion ? " · dernière connexion le " + date(m.derniere_connexion) : ""), m.confirme));
      });
      carte.appendChild(ul);
      carte.appendChild(blocFactures(e.id, null));
      return carte;
    };

    /* Un cabinet de conseil : ses clients, ses comptes et son abonnement
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
        ul.appendChild(ligneCompte(m.courriel, m.role === "admin" ? "responsable du compte du cabinet" : "utilisateur du cabinet", m.confirme));
      });
      carte.appendChild(ul);
      carte.appendChild(blocFactures(null, c.id));
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
        // « Déposer une facture » : la liste de tous les clients, entreprises et cabinets.
        var choixDepot = $("#depot-client"), zone = $("#depot-zone");
        if (choixDepot) {
          var avant = choixDepot.value;
          choixDepot.length = 1;
          var ge = document.createElement("optgroup"); ge.label = "Entreprises";
          ents.slice().sort(function (a, b) { return a.denomination.localeCompare(b.denomination, "fr"); })
            .forEach(function (e) { ge.appendChild(new Option(e.denomination, "e:" + e.id)); });
          var gc = document.createElement("optgroup"); gc.label = "Cabinets de consultants";
          (d.cabinets || []).slice().sort(function (a, b) { return a.nom.localeCompare(b.nom, "fr"); })
            .forEach(function (c) { gc.appendChild(new Option(c.nom, "c:" + c.id)); });
          if (ge.children.length) choixDepot.appendChild(ge);
          if (gc.children.length) choixDepot.appendChild(gc);
          choixDepot.options[0].text = ge.children.length || gc.children.length
            ? "Choisir une entreprise ou un cabinet…" : "Aucun client pour l'instant";
          choixDepot.value = avant;
          if (!choixDepot.hasAttribute("data-ecoute")) {
            choixDepot.setAttribute("data-ecoute", "");
            choixDepot.addEventListener("change", function () {
              zone.textContent = "";
              var v = choixDepot.value;
              if (!v) return;
              var bloc = blocFactures(v.charAt(0) === "e" ? v.slice(2) : null, v.charAt(0) === "c" ? v.slice(2) : null);
              bloc.open = true;
              zone.appendChild(bloc);
            });
          }
        }
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
        messagesContact();
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

    /* Les conseils de l'IA : combien gardés, combien écartés et ce que l'IA
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
          " écartée" + ((c.ecartes || 0) > 1 ? "s" : "") + " par les contrôles. Dépense du mois : " +
          String(Number(c.depense_mois || 0).toFixed(2)).replace(".", ",") + " $ (le robot s'arrête à 10 $ par mois). " +
          "À revoir : les textes où l'IA estime que le sujet ne va pas. " +
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

    /* Les messages du formulaire de contact (accueil) : du plus récent au plus
       ancien, avec « Répondre » (courriel) et « Marquer comme lu ». Tout est
       posé par textContent : un message n'est jamais lu comme du HTML. */
    var OBJETS = { offres: "Question sur les offres", demonstration: "Démonstration", consultant: "Offre consultant", autre: "Autre" };
    var messagesContact = function () {
      var ul = $("#admin-messages");
      if (!ul) return;
      V.rpc("admin_messages", {}).then(function (r) {
        ul.textContent = "";
        if (!r.ok) { ul.appendChild(el("li", "", r.erreur)); return; }
        var l = r.donnees || [];
        var nonLus = l.filter(function (m) { return !m.lu; }).length;
        $("#admin-messages-etat").textContent = l.length
          ? l.length + " message" + (l.length > 1 ? "s" : "") + ", dont " + nonLus + " non lu" + (nonLus > 1 ? "s" : "") + "."
          : "Aucun message pour l'instant.";
        l.forEach(function (m) {
          var li = el("li", "admin-compte admin-message" + (m.lu ? " message-lu" : ""));
          li.appendChild(el("span", "admin-courriel", (m.lu ? "" : "● ") + m.nom + (m.entreprise ? " — " + m.entreprise : "")));
          li.appendChild(el("span", "admin-details", new Date(m.recu_le).toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) +
            " · " + (OBJETS[m.objet] || m.objet) + " · " + m.courriel + (m.telephone ? " · " + m.telephone : "")));
          li.appendChild(el("p", "message-texte", m.message));
          var outils = el("span", "equipe-outils");
          var rep = el("a", "lien-nu", "Répondre");
          rep.href = "mailto:" + encodeURIComponent(m.courriel) + "?subject=" + encodeURIComponent("Votre message à Vigie");
          outils.appendChild(rep);
          outils.appendChild(bouton(m.lu ? "Marquer comme non lu" : "Marquer comme lu", function () {
            V.rpc("admin_message_lu", { message: m.id, lu: !m.lu }).then(messagesContact);
          }));
          li.appendChild(outils);
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
        b.href = vers("app/index.html");
        b.addEventListener("click", function () { V.choisir(e.entreprise_id); });
        b.hidden = false;
      });
    });
  }
})();
