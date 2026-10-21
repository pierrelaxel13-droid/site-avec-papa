/* ==========================================================================
   Pierrel & Co — comportements de page
   --------------------------------------------------------------------------
   Deux règles tenues partout :
   - sans ce fichier, le site reste complet et lisible. Les décalages de départ
     sont posés ici, jamais dans la feuille de style ni dans le HTML ;
   - qui demande moins d'animations n'en reçoit aucune, sans perdre une ligne
     ni un chiffre.
   ========================================================================== */

(function () {
  "use strict";

  var SOBRE = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };

  function normalise(s) {
    return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  /* --- Bandeau : filet et fond opaque dès le premier défilement ------------- */
  function bandeau() {
    var b = $(".bandeau");
    if (!b) return;
    var pose = function () { b.classList.toggle("pose", window.scrollY > 8); };
    pose();
    window.addEventListener("scroll", pose, { passive: true });
  }

  /* --- Menu repliable sous 62rem -------------------------------------------- */
  /* Le menu n'est replié que si ce fichier s'exécute : sans lui il reste
     déployé, ce qui est moins joli mais toujours utilisable. */
  function menu() {
    var bouton = $(".menu-bascule");
    var nav = $(".bandeau .menu");
    if (!bouton || !nav) return;

    var etroit = window.matchMedia("(max-width: 62rem)");
    var ouvrir = function (v) {
      nav.hidden = !v;
      bouton.setAttribute("aria-expanded", v ? "true" : "false");
    };
    var ajuster = function () { ouvrir(!etroit.matches); };

    ajuster();
    (etroit.addEventListener ? etroit.addEventListener("change", ajuster)
                             : etroit.addListener(ajuster));
    bouton.addEventListener("click", function () {
      ouvrir(nav.hidden);
    });
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a") && etroit.matches) ouvrir(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && etroit.matches && !nav.hidden) { ouvrir(false); bouton.focus(); }
    });
  }

  /* --- Apparition à l'approche ---------------------------------------------- */
  function paraitre() {
    var cibles = $$("[data-paraitre]");
    if (!cibles.length) return;
    if (SOBRE || !("IntersectionObserver" in window)) {
      cibles.forEach(function (e) { e.classList.add("vu"); });
      $$("[data-fil], .jauge").forEach(function (e) { e.classList.add("vu"); });
      return;
    }

    var rangs = new Map();
    cibles.forEach(function (e) {
      var r = rangs.get(e.parentElement) || 0;
      rangs.set(e.parentElement, r + 1);
      e.style.setProperty("--retard", Math.min(r, 6) * 70 + "ms");
    });

    var oeil = new IntersectionObserver(function (entrees) {
      entrees.forEach(function (i) {
        if (!i.isIntersecting) return;
        i.target.classList.add("vu");
        oeil.unobserve(i.target);
        if (i.target.hasAttribute("data-compte")) compter(i.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });

    cibles.forEach(function (e) { oeil.observe(e); });

    $$("[data-fil], .jauge").forEach(function (e) {
      var o = new IntersectionObserver(function (es) {
        es.forEach(function (i) { if (i.isIntersecting) { i.target.classList.add("vu"); o.disconnect(); } });
      }, { threshold: 0.2 });
      o.observe(e);
    });
  }

  /* --- Chiffres du rail ------------------------------------------------------ */
  /* Le nombre final est déjà dans le HTML : l'animation ne fait que remonter
     jusqu'à lui. Si elle n'a pas lieu, le chiffre juste est quand même là. */
  function compter(hote) {
    var cible = Number(hote.getAttribute("data-compte"));
    var el = $(".chiffre", hote);
    if (!el || !isFinite(cible) || SOBRE) return;
    var suffixe = el.getAttribute("data-suffixe") || "";
    var debut = performance.now(), duree = 1100;
    var pas = function (t) {
      var p = Math.min(1, (t - debut) / duree);
      var e = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(cible * e) + suffixe;
      if (p < 1) requestAnimationFrame(pas);
    };
    el.textContent = "0" + suffixe;
    requestAnimationFrame(pas);
  }

  /* --- Bascules à deux segments --------------------------------------------- */
  function bascules() {
    $$("[data-bascule]").forEach(function (groupe) {
      var boutons = $$("button", groupe);
      var curseur = $(".bascule-curseur", groupe);
      if (boutons.length < 2) return;

      var choisir = function (i) {
        boutons.forEach(function (b, j) {
          b.setAttribute("aria-selected", j === i ? "true" : "false");
          var panneau = document.getElementById(b.getAttribute("aria-controls") || "");
          if (panneau) panneau.hidden = j !== i;
        });
        if (curseur) curseur.style.transform = "translateX(" + (i * 100) + "%)";
      };

      boutons.forEach(function (b, i) {
        b.addEventListener("click", function () { choisir(i); });
        b.addEventListener("keydown", function (e) {
          var d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
          if (!d) return;
          e.preventDefault();
          var j = (i + d + boutons.length) % boutons.length;
          boutons[j].focus(); choisir(j);
        });
      });
      choisir(Math.max(0, boutons.findIndex(function (b) { return b.getAttribute("aria-selected") === "true"; })));
    });
  }

  /* --- Simulateur de plan de veille ------------------------------------------ */
  /* Le même calcul que l'application, sur les données de assets/plan-data.js.
     On le fait tourner sur l'accueil pour que le produit se montre avant la
     connexion, au lieu d'être décrit.
     Sans ce fichier, la page garde le résultat engendré pour la division par
     défaut : elle reste juste, elle ne réagit simplement plus. */
  function simulateur() {
    var P = window.PLAN;
    var hote = document.getElementById("simulateur");
    if (!P || !hote) return;

    var choix = $("#choix-division", hote);
    var listeQuestions = $("#sim-questions", hote);
    if (!choix || !listeQuestions) return;

    var sortie = {
      titre:   $("#sim-titre", hote),
      total:   $("#sim-total", hote),
      rythme:  $("#sim-rythme", hote),
      ajouts:  $("#sim-contexte", hote),
      rythmes: $("#sim-rythmes", hote),
      jauge:   $("#sim-jauge", hote),
      phrase:  $("#sim-phrase", hote),
      lien:    $("#sim-lien", hote)
    };

    var ordre = Object.keys(P.f).sort(function (a, b) { return P.f[a].ordre - P.f[b].ordre; });
    var totalDomaines = Object.keys(P.d).length;
    var coches = {};          // les réponses survivent au changement de secteur

    function echappe(s) {
      return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
                      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    /* Les questions posées sont celles qui ajouteraient vraiment quelque chose
       au périmètre de ce secteur : les autres ne feraient que du bruit. */
    function poserQuestions(base) {
      var dedans = {};
      base.forEach(function (id) { dedans[id] = true; });
      var utiles = P.q.filter(function (q) {
        return q.dom.some(function (id) { return P.d[id] && !dedans[id]; });
      });

      listeQuestions.innerHTML = utiles.map(function (q) {
        return '<label class="case">' +
          '<input type="checkbox" data-question="' + echappe(q.id) + '" data-domaines="' +
          echappe(q.dom.join(" ")) + '"' + (coches[q.id] ? " checked" : "") + ">" +
          '<span><span class="intitule">' + echappe(q.q) + "</span>" +
          '<span class="aide">' + echappe(q.d) + "</span></span></label>";
      }).join("");

      $$("input[type=checkbox]", listeQuestions).forEach(function (c) {
        c.addEventListener("change", function () {
          coches[c.getAttribute("data-question")] = c.checked;
          calculer();
        });
      });
      return utiles;
    }

    function calculer(reposer) {
      var code = choix.value;
      var div = P.div[code];
      if (!div) return;

      if (reposer) poserQuestions(div.b);

      var vus = {}, liste = [], ajoutes = 0;
      div.b.forEach(function (id) { if (!vus[id]) { vus[id] = 1; liste.push(id); } });
      $$("input[type=checkbox]:checked", listeQuestions).forEach(function (c) {
        c.getAttribute("data-domaines").split(" ").forEach(function (id) {
          if (P.d[id] && !vus[id]) { vus[id] = 1; liste.push(id); ajoutes++; }
        });
      });

      var paquets = ordre.map(function (fid) {
        return { l: P.f[fid].l, ids: liste.filter(function (id) { return P.d[id].f === fid; }) };
      }).filter(function (g) { return g.ids.length; });

      sortie.titre.textContent = div.l;
      sortie.total.textContent = liste.length;
      sortie.rythme.textContent = paquets.length ? paquets[0].l : "—";
      sortie.ajouts.textContent = ajoutes;

      sortie.rythmes.innerHTML = paquets.map(function (g) {
        var noms = g.ids.map(function (id) { return P.d[id].n; });
        var reste = noms.length - 3;
        return "<li><span class=\"nom\">" + echappe(g.l) + "</span>" +
          "<span class=\"compte\">" + g.ids.length + "</span>" +
          "<span class=\"mots\">" + echappe(noms.slice(0, 3).join(" · ")) +
          (reste > 0 ? " <span class=\"reste\">et " + reste + " autre" + (reste > 1 ? "s" : "") + "</span>" : "") +
          "</span></li>";
      }).join("");

      var barres = $$("span", sortie.jauge);
      barres.forEach(function (b, i) { b.className = i < liste.length ? "pleine" : ""; });
      sortie.jauge.classList.add("vu");

      sortie.phrase.innerHTML = "Pour <strong>" + echappe(div.l) + "</strong> (NAF " + echappe(code) +
        "), le plan retient <strong>" + liste.length + " domaines sur " + totalDomaines + "</strong>" +
        (ajoutes ? ", dont <strong>" + ajoutes + "</strong> ajouté" + (ajoutes > 1 ? "s" : "") +
                   " par le contexte coché" : "") +
        ". Le rythme le plus serré est <strong>" +
        (paquets.length ? paquets[0].l.toLowerCase() : "—") + "</strong>.";

      if (sortie.lien) sortie.lien.href = "app/secteur/" + div.u + ".html";
    }

    choix.addEventListener("change", function () { calculer(true); });

    // Une recherche venue d'ailleurs (?q=boulangerie) choisit la division.
    try {
      var q = new URLSearchParams(window.location.search).get("q");
      if (q) {
        var n = normalise(q);
        var trouve = Object.keys(P.div).filter(function (c) {
          return c.indexOf(q.trim()) === 0 || normalise(P.div[c].l).indexOf(n) !== -1 ||
                 (P.mots[c] || []).some(function (m) { return normalise(m).indexOf(n) !== -1; });
        })[0];
        if (trouve) choix.value = trouve;
      }
    } catch (e) { /* vieux navigateur : on garde la division par défaut */ }

    calculer(true);
  }

  /* --- Recherche dans l'index des secteurs ---------------------------------- */
  function rechercheSecteurs() {
    var champ = $("#recherche-secteur");
    var liste = $("#liste-secteurs");
    if (!champ || !liste) return;

    try {
      var q0 = new URLSearchParams(window.location.search).get("q");
      if (q0) champ.value = q0;
    } catch (e) { /* champ vide */ }

    var entrees = $$("[data-recherche]", liste);
    var compteur = $("#compte-secteurs");
    var vide = $("#aucun-secteur");

    function filtre() {
      var q = normalise(champ.value.trim());
      var n = 0;
      entrees.forEach(function (e) {
        var ok = !q || normalise(e.getAttribute("data-recherche")).indexOf(q) !== -1;
        e.hidden = !ok;
        if (ok) n++;
      });
      if (compteur) {
        compteur.textContent = n === entrees.length ? entrees.length + " secteurs"
                                                    : n + " sur " + entrees.length;
      }
      if (vide) vide.hidden = n !== 0;
      $$("[data-groupe]", liste).forEach(function (g) {
        g.hidden = !g.querySelector("[data-recherche]:not([hidden])");
      });
    }

    champ.addEventListener("input", filtre);
    filtre();
  }

  /* --- Affiner le périmètre sur une fiche de secteur ------------------------- */
  function affiner() {
    var hote = $("#declencheurs");
    if (!hote) return;

    var cases = $$("input[type=checkbox][data-domaines]", hote);
    var compteur = $("#compte-domaines");
    var base = Number(document.body.getAttribute("data-domaines-base") || 0);

    function pose() {
      var ajoutes = {};
      cases.forEach(function (c) {
        if (!c.checked) return;
        c.getAttribute("data-domaines").split(" ").forEach(function (id) { ajoutes[id] = true; });
      });

      var n = base;
      $$("[data-domaine]").forEach(function (bloc) {
        if (bloc.getAttribute("data-origine") !== "declencheur") return;
        var visible = !!ajoutes[bloc.getAttribute("data-domaine")];
        bloc.hidden = !visible;
        if (visible) n++;
      });
      if (compteur) compteur.textContent = n;

      $$("[data-groupe-frequence]").forEach(function (g) {
        g.hidden = !g.querySelector("[data-domaine]:not([hidden])");
      });
    }

    cases.forEach(function (c) { c.addEventListener("change", pose); });
    pose();
  }

  window.PCO_THEME && window.PCO_THEME.brancher();
  bandeau();
  menu();
  bascules();
  simulateur();
  rechercheSecteurs();
  affiner();
  paraitre();
})();
