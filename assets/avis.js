/* ==========================================================================
   Vigie — les nouveaux textes : la cloche, « Nouveau » et le tableau de bord
   --------------------------------------------------------------------------
   Un texte est NOUVEAU pour une personne quand :
     - il touche un sujet du plan de son entreprise (code APE + situations) ;
     - le robot l'a vu pour la première fois (v, « vuA ») après le début de
       son suivi (lus.depuis) ;
     - elle ne l'a pas encore ouvert (lus.ids).
   « lus » est gardé par assets/magasin.js sous « pco-lus » : dans un compte,
   dans son profil (espace_lus) — on le retrouve sur tous ses appareils ; dans
   la démonstration, dans ce navigateur.

   Trois endroits le montrent : la cloche (compte rouge, liste), la marque
   « Nouveau » des lignes du relevé (et le compte des cartes de famille), et
   le bloc « Nouveaux textes » en haut du tableau de bord. Ouvrir un texte —
   dans la cloche, le tableau de bord ou le relevé — le dit lu.

   Ce que ça ne fait pas : envoyer un courriel, ni une notification quand
   l'application est fermée. Il faut pour cela un service d'envoi (Brevo) :
   le panneau le dit plutôt que de laisser croire que c'est déjà là.
   ========================================================================== */

(function () {
  "use strict";

  var CLE = "pco-lus";
  var M = window.MAGASIN;
  var tous = window.AVIS || [];
  var DEMO = window.AVIS_DEMO || { plan: [], depuis: "" };
  if (!M) return;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var cloche = $("#cloche"), panneau = $("#panneau-avis"), liste = $("#liste-avis"), compte = $("#compte-avis");

  function echappe(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  var MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet",
              "août", "septembre", "octobre", "novembre", "décembre"];
  function dateFr(iso) {
    var p = String(iso || "").slice(0, 10).split("-");
    return p.length < 3 ? "" : (Number(p[2]) === 1 ? "1er" : Number(p[2])) + " " + MOIS[Number(p[1]) - 1] + " " + p[0];
  }
  function maintenant() { return new Date().toISOString().slice(0, 19) + "Z"; }
  /* Les liens de la cloche partent de app/ ; une fiche est un étage plus bas. */
  function racine() {
    return document.body.getAttribute("data-racine") === "../../" ? "../" : "";
  }

  /* --- L'état : depuis quand, et ce qui est déjà ouvert --------------------- */
  var lus = { depuis: "", ids: [] };
  function charger() {
    var e = M.lire(CLE) || {};
    lus = { depuis: e.depuis || "", ids: Array.isArray(e.ids) ? e.ids.slice() : [] };
    if (!lus.depuis) {
      if (M.mode === "compte") {
        // Le suivi commence à la première visite : ce qui était déjà là n'est pas « nouveau ».
        lus.depuis = maintenant();
        garder();
      } else {
        lus.depuis = DEMO.depuis;           // la démonstration : la dernière semaine
      }
    }
  }
  function garder() {
    // On n'oublie que ce qui ne peut plus être nouveau.
    var encore = {};
    tous.forEach(function (a) { if (a.v > lus.depuis) encore[a.k] = 1; });
    lus.ids = lus.ids.filter(function (k) { return encore[k]; });
    return M.ecrire(CLE, { depuis: lus.depuis, ids: lus.ids });
  }

  /* Le plan de l'entreprise : celui de ses réglages ; dans un compte sans
     code APE, pas de filtre (le relevé montre tout, et le dit) ; dans la
     démonstration sans réglages, celui de Maçonnerie Vidal. */
  function plan() {
    var garde = M.lire("pco-entreprise");
    var E = window.PCO_ENTREPRISE;
    if (garde && garde.naf && E && window.PLAN) {
      var vue = E.perimetre(garde.naf, garde.contexte || []);
      if (vue) return vue.liste;
    }
    return M.mode === "compte" ? null : DEMO.plan;
  }
  function nouveaux() {
    var p = plan(), dedans = {};
    if (p) p.forEach(function (id) { dedans[id] = 1; });
    var ouverts = {};
    lus.ids.forEach(function (k) { ouverts[k] = 1; });
    return tous.filter(function (a) {
      if (!(a.v > lus.depuis) || ouverts[a.k]) return false;
      return !p || !a.ds || a.ds.some(function (id) { return dedans[id]; });
    });
  }
  function dansPlan() {
    var p = plan(), dedans = {};
    if (p) p.forEach(function (id) { dedans[id] = 1; });
    return tous.filter(function (a) { return !p || !a.ds || a.ds.some(function (id) { return dedans[id]; }); });
  }

  function ouvrirTexte(k) {
    if (lus.ids.indexOf(k) !== -1) return;
    lus.ids.push(k);
    garder();
    rendre();
  }
  function toutLu() {
    lus.depuis = maintenant();
    lus.ids = [];
    garder();
    rendre();
  }

  /* --- Les trois endroits ----------------------------------------------------- */
  function ligneAvis(a, neuf) {
    return '<li class="avis' + (neuf ? " neuf" : "") + '">' +
      '<a href="' + racine() + echappe(a.u || "releve.html") + '" data-ouvre="' + echappe(a.k) + '">' +
        '<span class="avis-date mono">' + echappe(dateFr(a.d)) + "</span>" +
        '<span class="avis-titre">' + echappe(a.t) + "</span>" +
        '<span class="avis-quoi">' + echappe(a.q) + "</span>" +
        '<span class="avis-dom etiq">' + echappe(a.dom) + "</span>" +
        '<span class="avis-aller">Le texte et ce qu\'il faut faire</span>' +
      "</a></li>";
  }

  function rendreCloche(neufs) {
    if (!cloche || !compte || !liste) return;
    compte.textContent = neufs.length;
    compte.hidden = !neufs.length;
    cloche.classList.toggle("sonne", neufs.length > 0);
    cloche.setAttribute("aria-label", neufs.length
      ? neufs.length + " nouveau" + (neufs.length > 1 ? "x" : "") + " texte" + (neufs.length > 1 ? "s" : "") + " pour vous"
      : "Aucun nouveau texte");
    var tl = $("#tout-lu");
    if (tl) tl.hidden = !neufs.length;
    if (neufs.length) {
      liste.innerHTML = neufs.slice(0, 8).map(function (a) { return ligneAvis(a, true); }).join("") +
        (neufs.length > 8 ? '<li class="avis-separateur"><span class="etiq">… et ' + (neufs.length - 8) +
          ' autre' + (neufs.length - 8 > 1 ? "s" : "") + ', dans le relevé</span></li>' : "");
    } else {
      // Rien de neuf : on le dit, puis les derniers textes de son plan.
      // Un panneau vide ne distingue pas « rien n'est sorti » de « la veille est en panne ».
      liste.innerHTML = '<li class="avis-vide">Rien de neuf pour vous pour l\'instant : le robot relève toutes les heures.</li>' +
        '<li class="avis-separateur"><span class="etiq">Derniers textes de votre plan</span></li>' +
        dansPlan().slice(0, 3).map(function (a) { return ligneAvis(a, false); }).join("");
    }
  }

  function rendreReleve(neufs) {
    var cles = {};
    neufs.forEach(function (a) { cles[a.k] = 1; });
    $$("li.ligne-releve[data-cle]").forEach(function (li) {
      var neuf = !!cles[li.getAttribute("data-cle")];
      li.classList.toggle("est-neuf", neuf);
      if (neuf) li.setAttribute("data-neuf", ""); else li.removeAttribute("data-neuf");
      var titre = $(".titre", li), marque = titre && $(".marque-neuf", titre);
      if (neuf && titre && !marque) {
        marque = document.createElement("span");
        marque.className = "marque-neuf";
        marque.textContent = "Nouveau";
        titre.insertBefore(marque, titre.firstChild);
        titre.insertBefore(document.createTextNode(" "), marque.nextSibling);
      } else if (!neuf && marque) {
        if (marque.nextSibling && marque.nextSibling.nodeType === 3) titre.removeChild(marque.nextSibling);
        titre.removeChild(marque);
      }
    });
    // Les cartes des familles : combien de nouveaux pour vous.
    $$("[data-famille]").forEach(function (f) {
      var n = $$("li[data-neuf]", f).length;
      var carte = $('.carte-categorie[href="#' + f.id + '"]');
      var tete = carte && $(".carte-tete", carte);
      if (!tete) return;
      var m = $(".marque-neuf", tete);
      if (n && !m) { m = document.createElement("span"); m.className = "marque-neuf"; tete.appendChild(m); }
      if (m) { m.hidden = !n; m.textContent = n + " nouveau" + (n > 1 ? "x" : ""); }
    });
  }

  function rendreBord(neufs) {
    var bloc = $("#bord-nouveaux");
    if (!bloc) return;
    bloc.hidden = !neufs.length;
    if (!neufs.length) return;
    $("#bord-nouveaux-titre").textContent = neufs.length + " nouveau" + (neufs.length > 1 ? "x" : "") +
      " texte" + (neufs.length > 1 ? "s" : "") + " vous concerne" + (neufs.length > 1 ? "nt" : "");
    $("#bord-nouveaux-liste").innerHTML = neufs.slice(0, 5).map(function (a) {
      return '<li><a href="' + echappe(a.u || "releve.html") + '" data-ouvre="' + echappe(a.k) + '">' +
        '<span class="avis-titre">' + echappe(a.t) + "</span>" +
        '<span class="avis-dom etiq">' + echappe(dateFr(a.d)) + " · " + echappe(a.dom) + "</span>" +
        '<span class="avis-quoi">' + echappe(a.q) + "</span></a></li>";
    }).join("") + (neufs.length > 5 ? '<li class="avis-separateur"><span class="etiq">… et ' + (neufs.length - 5) +
      " autre" + (neufs.length - 5 > 1 ? "s" : "") + ", dans le relevé</span></li>" : "");
  }

  function rendre() {
    var neufs = nouveaux();
    rendreCloche(neufs);
    rendreReleve(neufs);
    rendreBord(neufs);
  }

  /* Une ligne du relevé visée par l'adresse (#t-…) s'ouvre : c'est là que
     mène la cloche. L'ouvrir, ici ou à la main, la dit lue. */
  function ouvrirCible() {
    var id = "";
    try { id = decodeURIComponent(location.hash.slice(1)); } catch (e) { id = ""; }
    var li = id ? document.getElementById(id) : null;
    if (!li || !li.classList.contains("ligne-releve")) return;
    var d = $("details", li);
    if (d) d.open = true;
  }

  function ouvrirPanneau(v) {
    panneau.hidden = !v;
    cloche.setAttribute("aria-expanded", v ? "true" : "false");
  }

  M.quandPret(function () {
    charger();
    rendre();
    ouvrirCible();
    window.addEventListener("hashchange", ouvrirCible);
    // Le plan a changé (Réglages, ou le relevé refait sur un compte) : on recompte.
    window.addEventListener("pco-plan", rendre);
    document.addEventListener("toggle", function (e) {
      var li = e.target.closest && e.target.closest("li.ligne-releve[data-cle]");
      if (li && e.target.open && e.target.parentNode === li) ouvrirTexte(li.getAttribute("data-cle"));
    }, true);
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest("[data-ouvre]");
      if (a) ouvrirTexte(a.getAttribute("data-ouvre"));
    });
    var bordToutLu = $("#bord-tout-lu");
    if (bordToutLu) bordToutLu.addEventListener("click", toutLu);
    if (!cloche || !panneau) return;
    cloche.addEventListener("click", function (e) {
      e.stopPropagation();
      ouvrirPanneau(panneau.hidden);
    });
    var tl = $("#tout-lu");
    if (tl) tl.addEventListener("click", toutLu);
    document.addEventListener("click", function (e) {
      if (!panneau.hidden && !panneau.contains(e.target) && e.target !== cloche) ouvrirPanneau(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !panneau.hidden) { ouvrirPanneau(false); cloche.focus(); }
    });
  });
})();
