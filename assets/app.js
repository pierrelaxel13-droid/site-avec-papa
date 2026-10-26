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

  /* --- Chercher comme on parle ----------------------------------------------
     Le client tape « plomberie », le référentiel dit « plombier » ; il tape
     « maçonnerie », le référentiel dit « maçon ». Une recherche qui ne trouve
     pas son métier ne sert à rien. On coupe donc les terminaisons françaises
     les plus courantes et on compare aussi la racine. Chaque mot de la demande
     doit être trouvé : « boulangerie artisanale » cherche les deux. */
  var TERMINAISONS = ["eries", "erie", "iers", "ier", "euses", "euse", "eurs",
                      "eur", "ions", "ion", "ements", "ement", "ages", "age",
                      "aux", "es", "s", "e"];

  function racines(mot) {
    var out = [mot];
    for (var i = 0; i < TERMINAISONS.length; i++) {
      var t = TERMINAISONS[i];
      if (mot.length - t.length >= 4 && mot.slice(-t.length) === t) {
        var r = mot.slice(0, mot.length - t.length);
        out.push(r);
        if (r.length > 4) out.push(r.slice(0, -1));   // maçonn → maçon
        break;
      }
    }
    return out;
  }

  function correspond(foin, demande) {
    if (!demande) return true;
    var mots = demande.split(/[^a-z0-9]+/).filter(function (m) { return m; });
    for (var i = 0; i < mots.length; i++) {
      var essais = racines(mots[i]);
      var trouve = false;
      for (var j = 0; j < essais.length && !trouve; j++) {
        if (foin.indexOf(essais[j]) !== -1) trouve = true;
      }
      if (!trouve) return false;
    }
    return true;
  }
  window.PCO_CHERCHE = { normalise: normalise, correspond: correspond };

  /* --- Bandeau : filet et fond opaque dès le premier défilement ------------- */
  function bandeau() {
    var b = $(".bandeau");
    if (!b) return;
    var pose = function () { b.classList.toggle("pose", window.scrollY > 8); };
    pose();
    window.addEventListener("scroll", pose, { passive: true });
  }

  /* --- Menu repliable quand il ne tient plus sur une ligne ------------------ */
  /* Le menu n'est replié que si ce fichier s'exécute : sans lui il reste
     déployé, ce qui est moins joli mais toujours utilisable. */
  function menu() {
    var bouton = $(".menu-bascule");
    var nav = $(".bandeau .menu");
    if (!bouton || !nav) return;

    /* Le seuil est celui de la feuille de style : 76 rem dans l'application,
       dont le menu a sept liens ; 62 rem sur les pages publiques. */
    var etroit = window.matchMedia(document.body.classList.contains("zone-app")
      ? "(max-width: 76rem)" : "(max-width: 62rem)");
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
  /* --- Ouvrir une fiche la remonte en haut de l'écran -----------------------
     Les fiches sont longues. Cliquée en bas de l'écran, une fiche s'ouvrait
     sous le pli : le client voyait le bas du texte, ou rien, et devait
     remonter à la main. On la ramène donc juste sous le bandeau, pour qu'elle
     commence là où on lit. On ne bouge pas quand elle y est déjà, et on ne
     bouge jamais à la fermeture. */
  function remonterLesFiches() {
    var OUVRABLE = ".ligne-releve, .ligne-registre, .liste-echeances li, .famille-releve, .textes";

    function sousLeBandeau() {
      var b = $(".bandeau");
      return (b ? b.getBoundingClientRect().height : 64) + 16;
    }

    document.addEventListener("toggle", function (e) {
      var d = e.target;
      if (!d || d.tagName !== "DETAILS" || !d.open) return;
      if (!d.closest(OUVRABLE)) return;
      var som = d.querySelector("summary");
      if (!som) return;
      var ecart = som.getBoundingClientRect().top - sousLeBandeau();

      /* Un titre de Journal officiel fait parfois quatre cents signes. Ouvert,
         il remplit l'écran d'un téléphone à lui seul, et « ce qu'il faut
         faire » tombe juste sous le pli — six pixels suffisent pour que le
         client ne le voie pas et croie qu'il n'y a rien. Dans ce cas on
         descend plus bas que le sommaire : le titre, il vient de le lire pour
         cliquer dessus ; c'est la suite qu'il est venu chercher. */
      var detail = d.querySelector(".detail");
      if (detail) {
        var apres = detail.getBoundingClientRect().top - ecart;
        var pli = window.innerHeight * 0.62;
        if (apres > pli) ecart += apres - pli;
      }

      if (Math.abs(ecart) < 8) return;
      window.scrollBy({ top: ecart, left: 0, behavior: SOBRE ? "auto" : "smooth" });
    }, true);
  }

  /* --- Les catégories, puis seulement celle qu'on choisit -----------------
     Les pages Relevé, Textes et Secteurs s'ouvrent sur leurs cartes, et rien
     d'autre. Un clic sur une carte n'affiche plus que ce qui appartient à la
     catégorie : ni l'en-tête, ni les autres catégories, ni les explications.
     « Toutes les catégories », ou le retour du navigateur, ramène aux cartes.
     Taper dans le champ montre tout ce qui correspond, d'où que ce soit.
     Sans JavaScript, les cartes sont des ancres et tout se lit dessous. */
  var LISTES_DE_FICHES = ".liste-releve, .liste-registre, .textes, .textes-depliants";

  function categories() {
    var choix = $("[data-choix]");
    var main = $("main");
    var sections = $$("[data-categorie]");
    if (!choix || !main || !sections.length) return;
    var racine = document.documentElement;
    var champ = $("#recherche-secteur");

    var retour = document.createElement("div");
    retour.className = "retour-categories enveloppe";
    retour.hidden = true;
    var bouton = document.createElement("a");
    bouton.className = "bouton bouton-sobre";
    bouton.href = location.pathname + location.search;
    bouton.textContent = "← Toutes les catégories";
    retour.appendChild(bouton);
    main.insertBefore(retour, main.firstChild);

    var caches = [];
    var depuisLesCartes = false;
    /* Au retour, le navigateur remettrait la page où elle était dans la
       catégorie ; on veut les cartes, depuis le haut. */
    try { history.scrollRestoration = "manual"; } catch (x) { /* sans effet */ }

    function categorieDe(id) {
      var cible = id ? document.getElementById(id) : null;
      if (!cible) return null;
      var sec = cible.hasAttribute("data-categorie") ? cible : cible.closest("[data-categorie]");
      return sec ? { sec: sec, cible: cible } : null;
    }

    function afficher() {
      var avant = racine.getAttribute("data-vue");
      caches.forEach(function (e) { e.classList.remove("hors-vue"); });
      caches = [];
      var id = "";
      try { id = decodeURIComponent(location.hash.slice(1)); } catch (x) { id = ""; }
      var choisi = categorieDe(id);

      if (choisi) {
        /* On cache tout ce qui n'est pas sur le chemin de la catégorie : ses
           voisines, et à chaque étage, les voisins de ce qui la contient. */
        for (var n = choisi.sec; n && n !== main && n.parentElement; n = n.parentElement) {
          [].forEach.call(n.parentElement.children, function (f) {
            if (f !== n && f !== retour) { f.classList.add("hors-vue"); caches.push(f); }
          });
        }
        racine.setAttribute("data-vue", "une");
        retour.hidden = false;
        /* Le navigateur peut encore descendre vers l'ancre juste après nous :
           on remet en haut tout de suite, puis à l'image suivante. */
        var placer = function () {
          if (choisi.cible === choisi.sec) window.scrollTo({ top: 0, left: 0, behavior: "instant" });
          else choisi.cible.scrollIntoView({ block: "start" });
        };
        placer();
        requestAnimationFrame(placer);
      } else {
        racine.setAttribute("data-vue", champ && champ.value.trim() ? "recherche" : "categories");
        retour.hidden = true;
        if (avant === "une") window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      }
    }

    choix.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest('a[href^="#"]')) depuisLesCartes = true;
    });
    bouton.addEventListener("click", function (e) {
      e.preventDefault();
      if (depuisLesCartes) { depuisLesCartes = false; history.back(); return; }
      try { history.pushState(null, "", location.pathname + location.search); } catch (x) { /* sans effet */ }
      afficher();
    });
    window.addEventListener("hashchange", afficher);
    /* Arrivée directe sur une catégorie : le navigateur descend tout seul
       jusqu'à l'ancre après le chargement, et le bouton « Toutes les
       catégories » passe sous le bandeau. On remet la page en haut, après lui. */
    window.addEventListener("load", function () {
      if (racine.getAttribute("data-vue") !== "une") return;
      requestAnimationFrame(function () { afficher(); });
    });
    if (champ) {
      champ.addEventListener("input", function () {
        if (racine.getAttribute("data-vue") !== "une") afficher();
      });
    }
    afficher();
  }

  /* Une fiche à la fois. Ce gestionnaire doit passer avant celui qui remonte
     la fiche en haut de l'écran : refermer les autres fait bouger la page, et
     la position se calcule après. */
  function uneFicheALaFois() {
    document.addEventListener("toggle", function (e) {
      var d = e.target;
      if (!d || d.tagName !== "DETAILS" || !d.open || !d.closest(LISTES_DE_FICHES)) return;
      $$("details[open]").forEach(function (autre) {
        if (autre !== d && autre.closest(LISTES_DE_FICHES) && !autre.contains(d) && !d.contains(autre)) {
          autre.open = false;
        }
      });
    }, true);
  }

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

      /* La même phrase que celle engendrée dans la page, dans les mêmes mots :
         si les deux divergent, le texte saute au premier changement de métier. */
      sortie.phrase.innerHTML = "Pour <strong>" + echappe(div.l) + "</strong> (NAF " + echappe(code) +
        "), il y a <strong>" + liste.length + " sujets à suivre sur " + totalDomaines + "</strong>" +
        (ajoutes ? ", dont <strong>" + ajoutes + "</strong> ajouté" + (ajoutes > 1 ? "s" : "") +
                   " par vos réponses" : "") +
        ". Le plus fréquent est à revoir <strong>" +
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
        var ok = correspond(normalise(e.getAttribute("data-recherche")), q);
        e.hidden = !ok;
        if (ok) n++;
      });
      if (compteur) {
        /* « secteurs », « codes », « textes » : la page dit ce qu'elle compte. */
        var hote = liste.closest ? liste.closest("[data-unite]") : null;
        var unite = (hote && hote.getAttribute("data-unite")) || "secteurs";
        compteur.textContent = n === entrees.length ? entrees.length + " " + unite
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

  /* --- Le code APE qu'on vient de choisir -----------------------------------
     On arrive sur la fiche depuis un code précis : c'est celui-là qu'on veut
     voir, en haut, et pas la liste des vingt-trois autres. Elle reste repliée
     en bas pour qui la cherche. Sans JavaScript, la fiche s'ouvre normalement
     et rien ne manque. */
  function codeChoisi() {
    var cible = document.getElementById("code-choisi");
    if (!cible) return;
    var code = "";
    try { code = new URLSearchParams(window.location.search).get("ape") || ""; } catch (e) { return; }
    if (!code) return;
    var ligne = document.getElementById("ape-" + code.replace(/[^0-9A-Za-z]/g, ""));
    if (!ligne) return;
    var c = ligne.querySelector(".code"), n = ligne.querySelector(".nom");
    document.getElementById("code-choisi-code").textContent = c ? c.textContent : code;
    document.getElementById("code-choisi-nom").textContent = n ? n.textContent : "";
    cible.hidden = false;
    ligne.classList.add("choisi");
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

  /* --- Installation : service worker, puis bouton ---------------------------- */
  /* Le service worker se prend à la racine du site, pas à côté de la page :
     un worker servi depuis app/ ne contrôlerait que app/. D'où data-racine,
     posé par le gabarit. */
  function racineSite() {
    var r = document.body.getAttribute("data-racine") || "./";
    return new URL(r, window.location.href);
  }

  function serviceWorker() {
    if (!("serviceWorker" in navigator)) return;
    if (window.location.protocol !== "https:" && window.location.hostname !== "localhost") return;
    window.addEventListener("load", function () {
      var base = racineSite();
      navigator.serviceWorker.register(new URL("sw.js", base), { scope: base })
        .catch(function () { /* bac à sable, page locale : on s'en passe */ });
    });
  }

  /* Chrome garde l'invite d'installation pour nous et nous laisse la déclencher
     au moment choisi ; Safari n'en a pas, d'où les consignes écrites à côté,
     qui restent affichées dans tous les cas. */
  function installation() {
    var bouton = document.getElementById("installer-appli");
    var etat = document.getElementById("etat-installation");
    if (!bouton) return;

    var invite = null;
    var pose = function (m) { if (etat) etat.textContent = m || ""; };

    var autonome = window.matchMedia && window.matchMedia("(display-mode: standalone)").matches;
    if (autonome || window.navigator.standalone) {
      pose("Déjà installée — vous y êtes.");
      return;
    }

    window.addEventListener("beforeinstallprompt", function (e) {
      e.preventDefault();
      invite = e;
      bouton.hidden = false;
    });

    bouton.addEventListener("click", function () {
      if (!invite) { pose("Suivez la consigne de votre appareil, à droite."); return; }
      bouton.disabled = true;
      invite.prompt();
      invite.userChoice.then(function (choix) {
        invite = null;
        bouton.disabled = false;
        bouton.hidden = choix.outcome === "accepted";
        pose(choix.outcome === "accepted" ? "Installée." : "Installation annulée.");
      });
    });

    window.addEventListener("appinstalled", function () {
      bouton.hidden = true;
      pose("Installée.");
    });
  }

  /* --- Enregistrer une fiche en PDF ------------------------------------------ */
  /* Il n'y a pas de serveur pour fabriquer un PDF, et aucune bibliothèque n'est
     chargée : c'est l'impression du navigateur qui s'en charge, « Enregistrer au
     format PDF » dans sa boîte d'impression. La feuille d'impression ne garde
     alors que la fiche demandée. */
  function imprimerFiche() {
    var boutons = $$(".imprimer-fiche");
    if (!boutons.length) return;

    var nettoie = function () {
      document.body.classList.remove("impression-fiche");
      $$(".a-imprimer").forEach(function (e) { e.classList.remove("a-imprimer"); });
    };

    boutons.forEach(function (b) {
      b.addEventListener("click", function () {
        var ligne = b.closest(".ligne-releve, .ligne-registre");
        if (!ligne) return;
        nettoie();
        ligne.classList.add("a-imprimer");
        document.body.classList.add("impression-fiche");
        var details = ligne.querySelector("details");
        if (details) details.open = true;   // une fiche repliée s'imprimerait vide
        window.print();
      });
    });

    window.addEventListener("afterprint", nettoie);
  }

  window.PCO_THEME && window.PCO_THEME.brancher();
  imprimerFiche();
  serviceWorker();
  installation();
  codeChoisi();
  bandeau();
  menu();
  uneFicheALaFois();
  remonterLesFiches();
  bascules();
  simulateur();
  rechercheSecteurs();
  categories();
  affiner();
  paraitre();
})();
