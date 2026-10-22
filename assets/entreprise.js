/* ==========================================================================
   Pierrel & Co — mon entreprise, et mes alertes
   --------------------------------------------------------------------------
   Ce que le visiteur saisit est gardé dans SON navigateur, et nulle part
   ailleurs : il n'y a pas de serveur. Rien n'est transmis, rien n'est partagé
   entre appareils, et tout disparaît s'il vide les données du site. C'est
   écrit sur la page, au-dessus du formulaire, avant qu'il n'y tape quoi que
   ce soit.

   Le calcul du périmètre est celui du simulateur de l'accueil, sur les mêmes
   données (assets/plan-data.js) : un métier décrit ici et décrit là-bas doit
   donner exactement le même plan.
   ========================================================================== */

(function () {
  "use strict";

  var CLE_E = "pco-entreprise";
  var CLE_A = "pco-alertes";

  function lire(cle) {
    try {
      var v = window.localStorage.getItem(cle);
      return v ? JSON.parse(v) : null;
    } catch (e) { return null; }
  }
  function ecrire(cle, o) {
    try { window.localStorage.setItem(cle, JSON.stringify(o)); return true; }
    catch (e) { return false; }   // navigation privée, stockage plein
  }
  function effacer(cle) {
    try { window.localStorage.removeItem(cle); } catch (e) { /* sans effet */ }
  }

  window.PCO_ENTREPRISE = {
    lu: function () { return lire(CLE_E); },
    ecrire: function (o) { return ecrire(CLE_E, o); },
    effacer: function () { effacer(CLE_E); },
    alertes: function () { return lire(CLE_A); }
  };

  var P = window.PLAN;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };

  function echappe(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* Une entreprise porte un code APE à cinq caractères — 4322B. Le périmètre
     de veille, lui, se calcule sur la division — 43. Les deux premiers
     chiffres font le pont, et un ancien réglage qui ne gardait que la
     division continue de marcher. */
  function division(code) {
    return String(code || "").replace(/[^0-9A-Za-z]/g, "").slice(0, 2);
  }

  /* --- Le périmètre d'un code NAF et d'un contexte -------------------------- */
  function perimetre(naf, contexte) {
    var div = P.div[division(naf)];
    if (!div) return null;
    var vus = {}, liste = [], ajoutes = 0;
    div.b.forEach(function (id) { if (!vus[id]) { vus[id] = 1; liste.push(id); } });
    (contexte || []).forEach(function (qid) {
      var q = P.q.filter(function (x) { return x.id === qid; })[0];
      if (!q) return;
      q.dom.forEach(function (id) {
        if (P.d[id] && !vus[id]) { vus[id] = 1; liste.push(id); ajoutes++; }
      });
    });
    var ordre = Object.keys(P.f).sort(function (a, b) { return P.f[a].ordre - P.f[b].ordre; });
    var paquets = ordre.map(function (fid) {
      return { l: P.f[fid].l, ids: liste.filter(function (id) { return P.d[id].f === fid; }) };
    }).filter(function (g) { return g.ids.length; });
    return { div: div, liste: liste, ajoutes: ajoutes, paquets: paquets };
  }

  /* --- L'en-tête de l'application dit la bonne entreprise -------------------
     Le bandeau d'une page d'application nomme l'entreprise, son code, sa
     commune. Il était figé sur le jeu d'essai : le plan disait « Boulangerie
     Martin » pendant que l'en-tête disait « Maçonnerie Vidal ». */
  function suivreEnTete() {
    var garde = lire(CLE_E);
    if (!garde) return;
    var pose = function (id, valeur) {
      var e = document.getElementById(id);
      if (e && valeur) e.textContent = valeur;
    };
    pose("tete-nom", garde.nom);
    pose("tete-naf", garde.naf);
    pose("tete-ville", garde.ville);
    pose("tete-effectif", garde.effectif);
  }

  /* --- « Mon plan » suit « Mon entreprise » ---------------------------------
     La page porte les 44 domaines ; on ne garde que ceux du périmètre
     enregistré. Sans réglages, elle reste sur le jeu d'essai et le dit.
     Sans JavaScript, elle affiche le périmètre du jeu d'essai, posé à la
     construction : rien ne disparaît. */
  function suivrePlan() {
    if (!document.getElementById("plan-perimetre") || !P) return;
    var garde = lire(CLE_E);
    if (!garde || !garde.naf) return;
    var vue = perimetre(garde.naf, garde.contexte || []);
    if (!vue) return;

    var dedans = {};
    vue.liste.forEach(function (id) { dedans[id] = 1; });
    $$("[data-domaine]").forEach(function (b) {
      b.hidden = !dedans[b.getAttribute("data-domaine")];
    });
    $$("[data-groupe-frequence]").forEach(function (g) {
      g.hidden = !g.querySelector("[data-domaine]:not([hidden])");
    });

    var pose = function (id, texte) {
      var e = document.getElementById(id);
      if (e) e.textContent = texte;
    };
    pose("plan-total", vue.liste.length);
    pose("plan-naf", garde.naf);
    if (garde.responsable) pose("plan-responsable", garde.responsable);

    var questions = (garde.contexte || []).map(function (qid) {
      var q = P.q.filter(function (x) { return x.id === qid; })[0];
      return q ? q.q : "";
    }).filter(Boolean);
    pose("plan-contexte", questions.length ? questions.join(" · ") : "aucune question retenue");

    var origine = document.getElementById("plan-origine");
    if (origine) {
      origine.innerHTML = "Ce plan suit vos réglages : " +
        (garde.nom ? "<strong>" + echappe(garde.nom) + "</strong>, " : "") +
        "code " + echappe(garde.naf) + ", division " + echappe(division(garde.naf)) +
        " — " + echappe(vue.div.l) + '. <a href="reglages.html">Les modifier</a>.';
    }

    var tete = document.querySelector(".tete-app .chapeau");
    if (tete) {
      tete.textContent = "Le périmètre retenu pour " + (garde.nom || vue.div.l) + " : " +
        vue.liste.length + " domaines, groupés par rythme de revue.";
    }
  }

  /* --- L'écran « Mon entreprise » ------------------------------------------- */
  function ecranEntreprise() {
    var form = document.getElementById("form-entreprise");
    if (!form || !P) return;

    var champs = {
      nom: $("#e-nom"), naf: $("#e-naf"), ville: $("#e-ville"),
      effectif: $("#e-effectif"), responsable: $("#e-responsable")
    };
    var hoteContexte = $("#e-contexte");
    var etat = $("#e-etat");
    var coches = {};

    function questionsUtiles(base) {
      var dedans = {};
      base.forEach(function (id) { dedans[id] = 1; });
      return P.q.filter(function (q) {
        return q.dom.some(function (id) { return P.d[id] && !dedans[id]; });
      });
    }

    function poserQuestions() {
      var div = P.div[division(champs.naf.value)];
      if (!div) return;
      hoteContexte.innerHTML = questionsUtiles(div.b).map(function (q) {
        return '<label class="case"><input type="checkbox" data-question="' + echappe(q.id) + '"' +
          (coches[q.id] ? " checked" : "") + '>' +
          '<span><span class="intitule">' + echappe(q.q) + "</span>" +
          '<span class="aide">' + echappe(q.d) + "</span></span></label>";
      }).join("");
      $$("input[type=checkbox]", hoteContexte).forEach(function (c) {
        c.addEventListener("change", function () {
          coches[c.getAttribute("data-question")] = c.checked;
          rendre();
        });
      });
    }

    /* --- Trouver son code APE à partir de ce qu'on fait ---------------------
       Personne ne connaît son code APE par cœur. Le client écrit son métier,
       on cherche dans les intitulés officiels — déjà présents dans la liste
       déroulante, donc rien à télécharger de plus — et on propose. Il choisit :
       on ne décide pas à sa place, parce qu'un code APE engage l'entreprise. */
    function chercheurApe() {
      var champ = $("#e-activite");
      var hote = $("#e-propositions");
      var cherche = window.PCO_CHERCHE;
      if (!champ || !hote || !cherche) return;

      /* Deux foins par code : son intitulé officiel, et les mots du métier
         portés par sa division — personne ne cherche « travaux d'installation
         d'équipements thermiques », on cherche « chauffagiste ». */
      var options = [].slice.call(champs.naf.options).map(function (o) {
        var groupe = o.parentNode && o.parentNode.getAttribute
          ? (o.parentNode.getAttribute("data-mots") || "") : "";
        var titre = o.parentNode && o.parentNode.label ? o.parentNode.label : "";
        return {
          v: o.value, t: o.textContent, dv: titre,
          f: cherche.normalise(o.textContent),
          g: cherche.normalise(o.textContent + " " + groupe)
        };
      });

      function proposer() {
        var q = cherche.normalise(champ.value.trim());
        if (q.length < 3) { hote.hidden = true; hote.innerHTML = ""; return; }
        /* Ceux dont l'intitulé répond passent devant ceux qui ne répondent que
           par le métier de leur division : le plus précis d'abord. */
        var exacts = options.filter(function (o) { return cherche.correspond(o.f, q); });
        var larges = options.filter(function (o) {
          return cherche.correspond(o.g, q) && exacts.indexOf(o) === -1;
        });
        var trouves = exacts.concat(larges);
        hote.hidden = false;
        if (!trouves.length) {
          hote.innerHTML = '<p class="precision">Aucun code ne correspond. ' +
            "Essayez un autre mot, ou prenez-le dans la liste ci-dessous.</p>";
          return;
        }
        hote.innerHTML = '<p class="etiq">' + trouves.length +
          (trouves.length > 1 ? " codes possibles" : " code possible") +
          (trouves.length > 6 ? " — les six premiers" : "") + "</p>" +
          trouves.slice(0, 6).map(function (o) {
            return '<button type="button" class="proposition" data-code="' + echappe(o.v) + '">' +
              echappe(o.t) +
              (o.dv ? '<span class="precision">Division ' + echappe(o.dv) + "</span>" : "") +
              "</button>";
          }).join("");
        $$(".proposition", hote).forEach(function (b) {
          b.addEventListener("click", function () {
            champs.naf.value = b.getAttribute("data-code");
            hote.hidden = true;
            champ.value = "";
            poserQuestions();
            rendre();
            direLaDivision();
            champs.naf.focus();
          });
        });
      }

      champ.addEventListener("input", proposer);
    }

    /* Le code choisi relève d'une division : c'est elle qui porte le périmètre,
       et le client doit le voir écrit. */
    function direLaDivision() {
      var ligne = $("#e-division");
      if (!ligne) return;
      var div = P.div[division(champs.naf.value)];
      ligne.textContent = div
        ? "Division " + division(champs.naf.value) + " — " + div.l +
          ". C'est à ce niveau que se calcule votre périmètre de veille."
        : "Il figure sur votre avis de situation INSEE et sur vos bulletins de paie.";
    }

    function contexteCoche() {
      return Object.keys(coches).filter(function (id) { return coches[id]; });
    }

    function rendre() {
      var vue = perimetre(champs.naf.value, contexteCoche());
      if (!vue) return;
      $("#e-titre").textContent = champs.nom.value.trim() || vue.div.l;
      $("#e-total").textContent = vue.liste.length;
      $("#e-rythme").textContent = vue.paquets.length ? vue.paquets[0].l : "—";
      $("#e-ajouts").textContent = vue.ajoutes;

      var total = Object.keys(P.d).length;
      var jauge = $("#e-jauge");
      jauge.innerHTML = "";
      for (var i = 0; i < total; i++) {
        var s = document.createElement("span");
        if (i < vue.liste.length) s.className = "pleine";
        jauge.appendChild(s);
      }
      jauge.classList.add("vu");

      $("#e-rythmes").innerHTML = vue.paquets.map(function (g) {
        var noms = g.ids.map(function (id) { return P.d[id].n; });
        var reste = noms.length - 3;
        return "<li><span class=\"nom\">" + echappe(g.l) + "</span>" +
          "<span class=\"compte\">" + g.ids.length + "</span>" +
          "<span class=\"mots\">" + echappe(noms.slice(0, 3).join(" · ")) +
          (reste > 0 ? " <span class=\"reste\">et " + reste + " autre" + (reste > 1 ? "s" : "") + "</span>" : "") +
          "</span></li>";
      }).join("");
    }

    // Ce qui a déjà été enregistré reprend sa place.
    var garde = lire(CLE_E);
    if (garde) {
      ["nom", "ville", "responsable"].forEach(function (k) {
        if (garde[k]) champs[k].value = garde[k];
      });
      if (garde.effectif != null) champs.effectif.value = garde.effectif;
      if (garde.naf && P.div[division(garde.naf)]) {
        champs.naf.value = garde.naf;
        /* Un réglage enregistré avant la nomenclature complète ne contenait que
           la division : on retombe sur son premier code APE. */
        if (!champs.naf.value) {
          var premier = champs.naf.querySelector('option[value^="' + garde.naf + '."]');
          if (premier) champs.naf.value = premier.value;
        }
      }
      (garde.contexte || []).forEach(function (id) { coches[id] = true; });
    }

    poserQuestions();
    rendre();
    direLaDivision();

    champs.naf.addEventListener("change", function () { poserQuestions(); rendre(); direLaDivision(); });
    chercheurApe();
    champs.nom.addEventListener("input", rendre);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var o = {
        nom: champs.nom.value.trim(),
        naf: champs.naf.value,
        ville: champs.ville.value.trim(),
        effectif: champs.effectif.value.trim(),
        responsable: champs.responsable.value.trim(),
        contexte: contexteCoche()
      };
      var ok = ecrire(CLE_E, o);
      etat.textContent = ok
        ? "Enregistré dans ce navigateur. Le plan de veille suit désormais ces informations."
        : "Impossible d'enregistrer : le stockage du navigateur est refusé ou plein.";
    });

    $("#e-reinit").addEventListener("click", function () {
      effacer(CLE_E);
      coches = {};
      champs.nom.value = ""; champs.ville.value = "";
      champs.effectif.value = ""; champs.responsable.value = "";
      champs.naf.value = champs.naf.querySelector("option[selected]")
        ? champs.naf.querySelector("option[selected]").value : champs.naf.value;
      poserQuestions();
      rendre();
      direLaDivision();
      etat.textContent = "Revenu au jeu d'essai.";
    });
  }

  /* --- L'écran « Mes alertes » ---------------------------------------------- */
  function ecranAlertes() {
    var form = document.getElementById("form-alertes");
    if (!form) return;

    var champs = {
      courriel: $("#a-courriel"), rythme: $("#a-rythme"), seuil: $("#a-seuil"),
      revues: $("#a-revues"), pdf: $("#a-pdf")
    };
    var etat = $("#a-etat");
    var apercu = $("#a-apercu");

    var LIBELLES = {
      immediat: "à chaque texte relevé", quotidien: "chaque jour",
      hebdomadaire: "chaque semaine", mensuel: "chaque mois"
    };

    function rendre() {
      var ent = lire(CLE_E);
      var nom = (ent && ent.nom) || "Maçonnerie Vidal";
      var quand = LIBELLES[champs.rythme.value] || "chaque semaine";
      var seuil = champs.seuil.options[champs.seuil.selectedIndex].textContent;

      apercu.innerHTML =
        '<div class="courriel-tete">' +
          '<span class="etiq">De</span><span>veille@pierrel-co.fr</span>' +
          '<span class="etiq">À</span><span>' + echappe(champs.courriel.value.trim() || "vous@entreprise.fr") + "</span>" +
          '<span class="etiq">Objet</span><span><strong>2 textes à analyser — ' + echappe(nom) + "</strong></span>" +
        "</div>" +
        '<div class="courriel-corps">' +
          "<p>Bonjour,</p>" +
          "<p>Depuis le dernier envoi, deux textes touchent votre périmètre.</p>" +
          '<ul class="courriel-textes">' +
            "<li><strong>Arrêté modifiant les règles de vérification des échafaudages roulants</strong>" +
            "<span>Ajoute une vérification à la remise en service après déplacement. " +
            "Équipements de travail, levage et vérifications — <em>prioritaire</em>.</span></li>" +
            "<li><strong>Décret relatif au tri des déchets du bâtiment</strong>" +
            "<span>Étend l'obligation de tri à deux flux supplémentaires. " +
            "Déchets, REP et économie circulaire.</span></li>" +
          "</ul>" +
          (champs.revues.checked
            ? "<p><strong>Rappel.</strong> Votre revue mensuelle est en retard depuis le 18 octobre.</p>"
            : "") +
          (champs.pdf.checked
            ? '<p class="courriel-pj">📎 2 fiches jointes, en PDF, prêtes à classer.</p>'
            : "") +
          "<p>— Pierrel &amp; Co</p>" +
        "</div>" +
        '<p class="courriel-pied">Envoi ' + echappe(quand) + " · " + echappe(seuil.toLowerCase()) + "</p>";
    }

    var garde = lire(CLE_A);
    if (garde) {
      if (garde.courriel) champs.courriel.value = garde.courriel;
      if (garde.rythme) champs.rythme.value = garde.rythme;
      if (garde.seuil) champs.seuil.value = garde.seuil;
      champs.revues.checked = garde.revues !== false;
      champs.pdf.checked = garde.pdf !== false;
    }
    rendre();

    ["input", "change"].forEach(function (ev) { form.addEventListener(ev, rendre); });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var ok = ecrire(CLE_A, {
        courriel: champs.courriel.value.trim(),
        rythme: champs.rythme.value,
        seuil: champs.seuil.value,
        revues: champs.revues.checked,
        pdf: champs.pdf.checked
      });
      etat.textContent = ok
        ? "Réglages gardés dans ce navigateur. Aucun courriel ne part : l'envoi suppose un serveur, qui n'est pas en place."
        : "Impossible d'enregistrer : le stockage du navigateur est refusé ou plein.";
    });
  }

  /* --- Le bandeau de l'application porte le nom saisi ------------------------ */
  function bandeauEntreprise() {
    var ent = lire(CLE_E);
    if (!ent || !ent.nom) return;
    var fort = document.querySelector(".jalons .fort");
    if (fort && fort.textContent !== "Réglages" && fort.textContent !== "Référentiel"
        && !/^Fiche /.test(fort.textContent)) {
      fort.textContent = ent.nom;
    }
  }

  suivreEnTete();
  suivrePlan();
  ecranEntreprise();
  ecranAlertes();
  bandeauEntreprise();
})();
