/* ==========================================================================
   Vigie — mon entreprise, et mes alertes
   --------------------------------------------------------------------------
   Où c'est gardé, c'est assets/magasin.js qui le décide : dans la
   démonstration, dans le navigateur (rien n'est transmis) ; dans un vrai
   compte, dans la base, et on le retrouve sur tous ses appareils.

   Le calcul du périmètre est celui du simulateur de l'accueil, sur les mêmes
   données (assets/plan-data.js) : un métier décrit ici et décrit là-bas doit
   donner exactement le même plan.
   ========================================================================== */

(function () {
  "use strict";

  var CLE_E = "pco-entreprise";
  var CLE_A = "pco-alertes";

  /* Sans magasin (une page hors de l'application), le navigateur. */
  var MAG = window.MAGASIN || {
    mode: "demo", espace: null,
    quandPret: function (fn) { fn(); },
    lire: function (cle) { try { var v = window.localStorage.getItem(cle); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
    ecrire: function (cle, o) {
      try { window.localStorage.setItem(cle, JSON.stringify(o)); return Promise.resolve({ ok: true }); }
      catch (e) { return Promise.resolve({ erreur: "Impossible d'enregistrer : le stockage du navigateur est refusé ou plein." }); }
    },
    effacer: function (cle) { try { window.localStorage.removeItem(cle); } catch (e) { /* sans effet */ } }
  };
  var COMPTE = MAG.mode === "compte";
  function lire(cle) { return MAG.lire(cle); }
  function ecrire(cle, o) { return MAG.ecrire(cle, o); }
  function effacer(cle) { MAG.effacer(cle); }

  window.PCO_ENTREPRISE = {
    lu: function () { return lire(CLE_E); },
    ecrire: function (o) { return ecrire(CLE_E, o); },
    effacer: function () { effacer(CLE_E); },
    alertes: function () { return lire(CLE_A); },
    perimetre: function (naf, contexte) { return perimetre(naf, contexte); }
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
      if (!e) return;
      if (valeur) { e.textContent = valeur; return; }
      /* Dans un compte, rien du jeu d'essai ne doit rester : ce qui n'est pas
         encore renseigné le dit, ou disparaît. */
      if (!COMPTE) return;
      if (id === "tete-naf" || id === "tete-nom") e.textContent = "à compléter";
      else if (e.closest("li")) e.closest("li").hidden = true;
    };
    pose("tete-nom", garde.nom);
    pose("tete-naf", garde.naf);
    pose("tete-ville", garde.ville);
    pose("tete-effectif", garde.effectif);
    var depuis = document.getElementById("tete-depuis");
    if (COMPTE && depuis && MAG.espace && MAG.espace.entreprise && MAG.espace.entreprise.cree_le) {
      depuis.textContent = new Date(MAG.espace.entreprise.cree_le)
        .toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    }
  }

  /* --- « Mon plan » suit « Mon entreprise » ---------------------------------
     Les rubriques ne portent que les sujets du plan ; les autres attendent
     dans <template id="plan-reserve">. Quand le périmètre enregistré change,
     on fait passer les blocs de l'un à l'autre, et la liste des sujets
     écartés (le volet replié) suit. Sans réglages, la page reste sur le jeu
     d'essai et le dit. Sans JavaScript, elle montre le plan du jeu d'essai,
     posé à la construction. */
  function suivrePlan() {
    if (!document.getElementById("plan-total") || !P) return;
    var garde = lire(CLE_E);
    if (!garde || !garde.naf) return;
    var vue = perimetre(garde.naf, garde.contexte || []);
    if (!vue) return;

    var dedans = {};
    vue.liste.forEach(function (id) { dedans[id] = 1; });
    var reserve = document.getElementById("plan-reserve");
    var enReserve = reserve && reserve.content ? [].slice.call(reserve.content.querySelectorAll(".bloc-domaine")) : [];
    $$(".bloc-domaine[data-domaine]").concat(enReserve).forEach(function (b) {
      var id = b.getAttribute("data-domaine");
      if (!dedans[id]) { if (reserve && reserve.content) reserve.content.appendChild(b); return; }
      var hote = P.d[id] && document.querySelector('[data-groupe-frequence="' + P.d[id].f + '"] > .enveloppe');
      if (!hote) return;
      b.hidden = false;
      b.setAttribute("data-origine", vue.div.b.indexOf(id) !== -1 ? "base" : "declencheur-retenu");
      // À sa place dans l'ordre du référentiel.
      var rang = Number(b.getAttribute("data-rang"));
      var suivant = $$(".bloc-domaine", hote).filter(function (x) {
        return x !== b && Number(x.getAttribute("data-rang")) > rang;
      })[0];
      if (suivant) hote.insertBefore(b, suivant); else hote.appendChild(b);
    });
    // « À ce rythme » : les sujets présents, et eux seuls.
    $$("[data-groupe-frequence]").forEach(function (g) {
      var ul = g.querySelector(".dedans ul");
      if (!ul) return;
      ul.innerHTML = $$(".bloc-domaine", g).map(function (b) {
        var id = b.getAttribute("data-domaine");
        return '<li data-sujet-plan="' + echappe(id) + '"><a href="#domaine-' + echappe(id) + '"><span>' +
          echappe(P.d[id] ? P.d[id].n : id) + "</span></a></li>";
      }).join("");
    });
    // Le volet des sujets écartés.
    var ecartes = Object.keys(P.d).filter(function (id) { return !dedans[id]; });
    var liste = document.getElementById("plan-ecartes-liste");
    if (liste) {
      liste.innerHTML = ecartes.map(function (id) {
        return '<li data-ecarte="' + echappe(id) + '">' + echappe(P.d[id].n) + "</li>";
      }).join("");
    }
    $$("[data-ecartes-total]").forEach(function (e) { e.textContent = ecartes.length; });
    var volet = document.getElementById("plan-ecartes");
    if (volet) volet.hidden = !ecartes.length;

    $$("[data-groupe-frequence]").forEach(function (g) {
      var n = g.querySelectorAll("[data-domaine]:not([hidden])").length;
      g.hidden = !n;
      /* La carte du rythme dit combien de sujets il y a dedans ; vide, elle ne
         mène nulle part et le dit. */
      var compte = document.querySelector('[data-compte-frequence="' + g.getAttribute("data-groupe-frequence") + '"]');
      if (!compte) return;
      compte.textContent = n ? n + " sujet" + (n > 1 ? "s" : "") : "Aucun sujet à ce rythme";
      var carte = compte.closest(".carte-categorie");
      if (!carte) return;
      carte.classList.toggle("carte-vide", !n);
      if (n) { carte.removeAttribute("aria-disabled"); carte.removeAttribute("tabindex"); }
      else { carte.setAttribute("aria-disabled", "true"); carte.setAttribute("tabindex", "-1"); }
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

    var fiche = document.getElementById("plan-chiffres");
    var plus = garde.plus || {};
    var lignes = [["Chiffre d'affaires", plus.ca], ["Forme juridique", plus.forme],
                  ["Créée en", plus.creation], ["Sites", plus.sites], ["SIRET", plus.siret],
                  ["Certifications", (plus.certifs || []).join(" · ")]]
      .filter(function (l) { return l[1]; });
    if (fiche) {
      fiche.innerHTML = lignes.map(function (l) {
        return "<div><dt class=\"etiq\">" + echappe(l[0]) + "</dt><dd>" + echappe(String(l[1])) + "</dd></div>";
      }).join("");
      fiche.hidden = !lignes.length;
    }

    try { window.dispatchEvent(new Event("pco-plan")); } catch (e) { /* vieux navigateur */ }

    // La même phrase qu'à la construction (phrasePlan, build.mjs) : d'où vient le chiffre.
    var tete = document.querySelector(".tete-app .chapeau");
    if (tete) {
      var parCode = vue.liste.length - vue.ajoutes;
      var ajout = vue.liste.slice(parCode).map(function (id) { return P.d[id].n; });
      tete.innerHTML = '<span data-plan-total>' + vue.liste.length + "</span> sujets s'appliquent chez " +
        '<span id="plan-chez">' + echappe(garde.nom || vue.div.l) + '</span><span id="plan-detail"> : ' +
        (ajout.length
          ? parCode + " par son code APE (" + echappe(garde.naf) + "), " + ajout.length + " par sa situation (" + echappe(ajout.join(", ")) + ")"
          : "tous par son code APE (" + echappe(garde.naf) + ")") +
        "</span>. Ils sont rangés selon le rythme auquel les revoir : cliquez sur un rythme pour voir les sujets à revoir à ce rythme.";
    }
  }

  /* --- Le relevé suit le plan ----------------------------------------------
     Les textes officiels sont rangés à la construction sur le plan du jeu
     d'essai. Avec d'autres réglages (un vrai compte, ou « Réglages » dans la
     démonstration), on refait le tri : un texte qui touche un sujet du plan
     va sous ce sujet, dans sa famille ; les autres, dans le volet replié
     « ne vous concernent pas ». Puis on recompte tout ce qui affiche un
     nombre. Dans un compte sans code APE, tout est montré, et on le dit. */
  var MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août",
              "septembre", "octobre", "novembre", "décembre"];
  function jourFr(iso) {
    var p = String(iso || "").split("-");
    if (p.length < 3) return iso || "";
    var j = Number(p[2]);
    return (j === 1 ? "1er" : j) + " " + MOIS[Number(p[1]) - 1] + " " + p[0];
  }
  function suivreReleve() {
    var volet = document.getElementById("releve-ecartes");
    var ecartes = document.getElementById("releve-ecartes-liste");
    if (!volet || !ecartes || !P) return;
    var garde = lire(CLE_E);
    var vue = garde && garde.naf ? perimetre(garde.naf, garde.contexte || []) : null;
    var dedans = {};
    if (vue) {
      vue.liste.forEach(function (id) { dedans[id] = 1; });
    } else if (COMPTE) {
      Object.keys(P.d).forEach(function (id) { dedans[id] = 1; });
      var sans = document.getElementById("releve-sans-plan");
      if (sans) sans.hidden = false;
    } else {
      return;                              // la démonstration, telle que construite
    }

    $$("li.ligne-releve[data-domaines]").forEach(function (li) {
      var doms = li.getAttribute("data-domaines").split(" ");
      var sujet = doms.filter(function (id) { return dedans[id]; })[0];
      var famille = sujet && P.d[sujet] && document.querySelector('[data-famille="' + P.d[sujet].c + '"]');
      if (!famille) { ecartes.appendChild(li); return; }
      var groupe = famille.querySelector('[data-sujet-releve="' + sujet + '"]');
      if (!groupe) {
        groupe = document.createElement("section");
        groupe.className = "sous-groupe";
        groupe.id = famille.id + "--" + sujet;
        groupe.setAttribute("data-groupe", "");
        groupe.setAttribute("data-sujet-releve", sujet);
        groupe.innerHTML = "<h4>" + echappe(P.d[sujet].n) + ' <span class="etiq"></span></h4><ul class="liste-releve"></ul>';
        famille.appendChild(groupe);
      }
      groupe.querySelector("ul").appendChild(li);
    });

    var parDate = function (ul) {
      $$("li.ligne-releve", ul).sort(function (a, b) {
        return a.getAttribute("data-date") < b.getAttribute("data-date") ? 1 : -1;
      }).forEach(function (li) { ul.appendChild(li); });
    };
    var textes = function (n) { return n + " texte" + (n > 1 ? "s" : ""); };
    parDate(ecartes);
    var nEcartes = ecartes.children.length;
    $$("[data-ecartes-total]", volet).forEach(function (e) { e.textContent = nEcartes; });
    volet.hidden = !nEcartes;

    $$("[data-famille]").forEach(function (famille) {
      var groupes = $$("[data-sujet-releve]", famille);
      groupes.forEach(function (g) {
        var ul = g.querySelector("ul");
        parDate(ul);
        var n = ul.children.length;
        g.hidden = !n;
        var etiq = g.querySelector("h4 .etiq");
        if (etiq) etiq.textContent = textes(n);
      });
      var pleins = groupes.filter(function (g) { return !g.hidden; })
        .sort(function (a, b) { return b.querySelector("ul").children.length - a.querySelector("ul").children.length; });
      pleins.forEach(function (g) { famille.appendChild(g); });
      var lignes = $$("li.ligne-releve", famille);
      famille.hidden = !lignes.length;
      var h3 = famille.querySelector("h3 .etiq");
      if (h3) h3.textContent = textes(lignes.length);

      // « Dans cette catégorie » : un lien par sujet, s'il y en a plus d'un.
      var nav = famille.querySelector(".dedans");
      if (nav) nav.parentNode.removeChild(nav);
      if (pleins.length > 1) {
        nav = document.createElement("nav");
        nav.className = "dedans";
        nav.setAttribute("aria-label", "Ce qu'il y a dans cette catégorie");
        nav.innerHTML = '<p class="etiq">Dans cette catégorie</p><ul>' + pleins.map(function (g) {
          return '<li><a href="#' + echappe(g.id) + '"><span>' + echappe(P.d[g.getAttribute("data-sujet-releve")].n) +
            '</span> <span class="compte">' + g.querySelector("ul").children.length + "</span></a></li>";
        }).join("") + "</ul>";
        var avant = famille.querySelector(".precision");
        famille.insertBefore(nav, avant ? avant.nextSibling : famille.firstChild);
      }

      // La carte de la famille.
      var carte = document.querySelector('.carte-categorie[href="#' + famille.id + '"]');
      if (!carte) return;
      var plusRecent = lignes.slice().sort(function (a, b) {
        return a.getAttribute("data-date") < b.getAttribute("data-date") ? 1 : -1;
      })[0];
      var neufs = lignes.filter(function (l) { return l.hasAttribute("data-neuf"); }).length;
      var compte = carte.querySelector(".carte-compte");
      if (compte) compte.textContent = lignes.length ? textes(lignes.length) : "Rien qui vous concerne";
      var tete = carte.querySelector(".carte-tete");
      var marque = carte.querySelector(".carte-tete .marque-neuf");
      if (neufs && !marque && tete) { marque = document.createElement("span"); marque.className = "marque-neuf"; tete.appendChild(marque); }
      if (marque) { marque.hidden = !neufs; marque.textContent = neufs + " nouveau" + (neufs > 1 ? "x" : ""); }
      var cl = carte.querySelectorAll(".carte-ligne");
      var precision = famille.querySelector(".precision");
      if (cl[0]) cl[0].textContent = plusRecent ? "Le plus récent : " + jourFr(plusRecent.getAttribute("data-date")) : (precision ? precision.textContent : "");
      if (cl[1]) cl[1].textContent = plusRecent && plusRecent.getAttribute("data-premier")
        ? "En premier : " + plusRecent.getAttribute("data-premier") : (plusRecent && precision ? precision.textContent : "");
      carte.classList.toggle("carte-vide", !lignes.length);
      if (lignes.length) { carte.removeAttribute("aria-disabled"); carte.removeAttribute("tabindex"); }
      else { carte.setAttribute("aria-disabled", "true"); carte.setAttribute("tabindex", "-1"); }
    });
    try { window.dispatchEvent(new Event("pco-plan")); } catch (e) { /* vieux navigateur */ }
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
    /* Les chiffres de l'entreprise : chacun porte data-champ, les
       certifications data-certif. Ils décrivent, ils ne décident pas. */
    var chiffres = $$("[data-champ]", form);
    var certifs = $$("[data-certif]", form);
    var siret = $("#e-siret"), siretAide = $("#e-siret-aide");
    /* Un SIRET a 14 chiffres, et les neuf premiers (le SIREN) passent la clé
       de Luhn. On le dit tout de suite, sans bloquer l'enregistrement. */
    function luhn(n) {
      var t = 0;
      for (var i = 0; i < n.length; i++) {
        var c = Number(n[n.length - 1 - i]);
        if (i % 2) { c *= 2; if (c > 9) c -= 9; }
        t += c;
      }
      return t % 10 === 0;
    }
    function verifierSiret() {
      if (!siret || !siretAide) return;
      var n = siret.value.replace(/\s+/g, "");
      siretAide.textContent = !n ? ""
        : !/^\d{14}$/.test(n) ? "Un SIRET a 14 chiffres ; il en a " + n.replace(/\D/g, "").length + " ici."
        : !luhn(n.slice(0, 9)) ? "Ce numéro ne passe pas le contrôle : vérifiez-le sur votre avis de situation INSEE."
        : "Format correct.";
    }
    if (siret) siret.addEventListener("input", verifierSiret);
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
        ? "Votre famille de métier : " + div.l + " (" + division(champs.naf.value) + ")."
        : "Il est sur votre avis de situation INSEE et sur vos bulletins de paie.";
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

    // Dans un compte, seul l'administrateur de l'entreprise (ou son consultant) change ses réglages.
    if (COMPTE && MAG.espace && MAG.espace.role !== "admin" && MAG.espace.role !== "consultant") {
      $$("input, select, textarea, button", form).forEach(function (c) { c.disabled = true; });
      etat.textContent = "Seul l'administrateur de votre entreprise peut changer ces réglages.";
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
      var plus = garde.plus || {};
      chiffres.forEach(function (c) { if (plus[c.getAttribute("data-champ")] != null) c.value = plus[c.getAttribute("data-champ")]; });
      certifs.forEach(function (c) { c.checked = (plus.certifs || []).indexOf(c.getAttribute("data-certif")) !== -1; });
      verifierSiret();
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
        contexte: contexteCoche(),
        plus: (function () {
          var p = {};
          chiffres.forEach(function (c) { var v = String(c.value || "").trim(); if (v) p[c.getAttribute("data-champ")] = v; });
          p.certifs = certifs.filter(function (c) { return c.checked; })
                             .map(function (c) { return c.getAttribute("data-certif"); });
          return p;
        })()
      };
      /* Ce que le registre retiendra si le plan change : en clair, pas en codes. */
      var opt = champs.naf.options[champs.naf.selectedIndex];
      var noms = o.contexte.map(function (id) {
        var q = P.q.filter(function (x) { return x.id === id; })[0];
        return q ? q.q : id;
      });
      o.resume = "Code APE " + (opt ? opt.textContent.trim() : o.naf) + ". Situations retenues : " +
        (noms.length ? noms.join(" ; ") : "aucune") + ".";
      etat.textContent = "Enregistrement…";
      ecrire(CLE_E, o).then(function (r) {
        if (!r.ok) { etat.textContent = r.erreur; return; }
        etat.textContent = COMPTE
          ? "Enregistré dans votre compte. Votre plan suit maintenant ces informations, sur tous vos appareils."
          : "Enregistré. Votre plan suit maintenant ces informations.";
        try { window.dispatchEvent(new Event("pco-plan")); } catch (e) { /* vieux navigateur */ }
      });
    });

    $("#e-reinit").addEventListener("click", function () {
      if (COMPTE) return;
      effacer(CLE_E);
      coches = {};
      champs.nom.value = ""; champs.ville.value = "";
      champs.effectif.value = ""; champs.responsable.value = "";
      chiffres.forEach(function (c) { c.value = ""; });
      certifs.forEach(function (c) { c.checked = false; });
      verifierSiret();
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
      var nom = (ent && ent.nom) || "votre entreprise";
      var quand = LIBELLES[champs.rythme.value] || "chaque semaine";
      var seuil = champs.seuil.options[champs.seuil.selectedIndex].textContent;

      apercu.innerHTML =
        '<div class="courriel-tete">' +
          // L'adresse du cabinet, posée sur <body> par build.mjs : une seule source.
          '<span class="etiq">De</span><span>' + echappe(document.body.getAttribute("data-courriel") || "") + "</span>" +
          '<span class="etiq">À</span><span>' + echappe(champs.courriel.value.trim() || "vous@entreprise.fr") + "</span>" +
          '<span class="etiq">Objet</span><span><strong>2 textes à analyser — ' + echappe(nom) + "</strong></span>" +
        "</div>" +
        '<div class="courriel-corps">' +
          "<p>Bonjour,</p>" +
          "<p>Depuis le dernier envoi, deux textes vous concernent.</p>" +
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
          "<p>— " + echappe(document.body.getAttribute("data-nom") || "") + "</p>" +
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
      etat.textContent = "Enregistrement…";
      ecrire(CLE_A, {
        courriel: champs.courriel.value.trim(),
        rythme: champs.rythme.value,
        seuil: champs.seuil.value,
        revues: champs.revues.checked,
        pdf: champs.pdf.checked
      }).then(function (r) {
        etat.textContent = !r.ok ? r.erreur : COMPTE
          ? "Réglages enregistrés dans votre compte. Aucun courriel ne part encore : leur envoi n'est pas en place."
          : "Réglages gardés dans ce navigateur. Aucun courriel ne part : l'envoi suppose un serveur, qui n'est pas en place.";
      });
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

  MAG.quandPret(function () {
    suivreEnTete();
    suivrePlan();
    suivreReleve();
    ecranEntreprise();
    ecranAlertes();
    bandeauEntreprise();
  });
})();
