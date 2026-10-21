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

  /* --- Le périmètre d'un code NAF et d'un contexte -------------------------- */
  function perimetre(naf, contexte) {
    var div = P.div[naf];
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
      var div = P.div[champs.naf.value];
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
      if (garde.naf && P.div[garde.naf]) champs.naf.value = garde.naf;
      (garde.contexte || []).forEach(function (id) { coches[id] = true; });
    }

    poserQuestions();
    rendre();

    champs.naf.addEventListener("change", function () { poserQuestions(); rendre(); });
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

  ecranEntreprise();
  ecranAlertes();
  bandeauEntreprise();
})();
