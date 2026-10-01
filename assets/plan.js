/* ==========================================================================
   Pierrel & Co — outil « plan de veille »
   --------------------------------------------------------------------------
   Un seul parcours : activité, contexte, plan. Aucun registre, aucun import,
   aucun compte.

   Le plan sort sous trois formes complémentaires :
     le diagramme   — où l'on voit son périmètre se réorganiser à chaque réponse
     le calendrier  — où l'on voit ce que ça coûte en temps sur l'année
     le détail      — ce qui s'imprime et part dans un dossier

   Le diagramme et le calendrier ne sont jamais réécrits d'un bloc : leurs
   éléments survivent d'un rendu à l'autre, ce qui permet de les animer d'une
   colonne à l'autre plutôt que de les faire clignoter.
   ========================================================================== */

(function () {
  "use strict";

  var R = window.REFERENTIEL;
  if (!R) return;

  var CLE = "pco-plan-v1";
  var SOBRE = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var SORTIE = "cubic-bezier(0.16, 1, 0.3, 1)";

  var MOIS = ["janv", "févr", "mars", "avr", "mai", "juin",
              "juil", "août", "sept", "oct", "nov", "déc"];

  var etat = { metier: null, reponses: [] };

  /* --- L'adresse porte le plan ---------------------------------------------
     Un plan tient en une adresse : « #btp-salaries.public ». On peut donc
     l'envoyer à son expert-comptable ou le garder en favori, ce qu'aucun
     stockage local ne permet. L'adresse l'emporte sur la mémoire du
     navigateur : un lien reçu doit montrer le plan de celui qui l'envoie. */
  function litAdresse() {
    var h = (window.location.hash || "").replace(/^#/, "");
    if (!h) return false;
    var bouts = decodeURIComponent(h).split("-");
    var m = bouts[0];
    if (!R.metier(m)) return false;
    etat.metier = m;
    etat.reponses = (bouts[1] || "").split(".")
      .filter(function (id) { return !!R.question(id); });
    return true;
  }

  function ecritAdresse() {
    var h = etat.metier
      ? "#" + etat.metier + (etat.reponses.length ? "-" + etat.reponses.join(".") : "")
      : " ";
    // replaceState : un clic de plus ne doit pas ajouter une entrée d'historique
    // que le bouton « précédent » devrait ensuite dépiler une par une.
    try { window.history.replaceState(null, "", h); } catch (e) { /* sans effet */ }
  }

  /* --- Persistance, toujours tolérante à l'échec --------------------------- */
  function lit() {
    try {
      var brut = window.localStorage.getItem(CLE);
      if (!brut) return;
      var o = JSON.parse(brut);
      if (o && typeof o.metier === "string" && R.metier(o.metier)) etat.metier = o.metier;
      if (o && Array.isArray(o.reponses)) {
        etat.reponses = o.reponses.filter(function (id) { return !!R.question(id); });
      }
    } catch (e) { /* navigation privée : l'outil marche sans mémoire */ }
  }

  function ecrit() {
    try { window.localStorage.setItem(CLE, JSON.stringify(etat)); } catch (e) { /* sans effet */ }
    ecritAdresse();
  }

  /* --- Utilitaires ---------------------------------------------------------- */
  function esc(v) {
    return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function pluriel(n, s, p) { return n + " " + (n > 1 ? p : s); }
  function element(id) { return document.getElementById(id); }

  /* --- Étape 1 : les métiers ------------------------------------------------ */
  function rendMetiers() {
    var hote = element("choix-metiers");
    if (!hote) return;
    hote.innerHTML = R.metiers.map(function (m) {
      return '<button type="button" class="metier" data-metier="' + esc(m.id) + '"' +
        ' aria-pressed="' + (etat.metier === m.id ? "true" : "false") + '">' +
        '<span class="nom">' + esc(m.nom) + "</span>" +
        (m.naf ? '<span class="naf">NAF : ' + esc(m.naf) + "</span>" : "") +
        '<span class="exemples">' + esc(m.exemples) + "</span></button>";
    }).join("");

    // Survoler un métier en montre le plan sans l'adopter : on compare avant de
    // choisir, et la constellation apparaît dès le premier survol.
    hote.querySelectorAll("[data-metier]").forEach(function (b) {
      var id = b.getAttribute("data-metier");
      b.addEventListener("pointerenter", function () {
        if (etat.metier === id) return;
        apercu(id);
      });
      b.addEventListener("pointerleave", function () { finApercu(); });
      b.addEventListener("focus", function () {
        if (etat.metier !== id) apercu(id);
      });
      b.addEventListener("blur", function () { finApercu(); });
    });

    hote.querySelectorAll("[data-metier]").forEach(function (b) {
      b.addEventListener("click", function () {
        var id = b.getAttribute("data-metier");
        etat.metier = (etat.metier === id) ? null : id;
        ecrit();
        rendMetiers();
        rendPlan();
      });
    });
  }

  /* --- Étape 2 : le contexte ------------------------------------------------- */
  function rendQuestions() {
    var hote = element("liste-questions");
    if (!hote) return;
    hote.innerHTML = R.questions.map(function (q) {
      return "<li><label class=\"question\">" +
        '<input type="checkbox" data-question="' + esc(q.id) + '"' +
        (etat.reponses.indexOf(q.id) !== -1 ? " checked" : "") + ">" +
        '<span><span class="intitule">' + esc(q.q) + "</span>" +
        '<span class="aide">' + esc(q.d) + "</span></span></label></li>";
    }).join("");

    hote.querySelectorAll(".question").forEach(function (l) {
      var q = R.question(l.querySelector("[data-question]").getAttribute("data-question"));
      if (!q || !window.CONSTELLATION) return;
      // Survoler une question allume, dans la constellation, les domaines
      // qu'elle apporte. C'est la causalité rendue tangible.
      l.addEventListener("pointerenter", function () { window.CONSTELLATION.souligne(q.q); });
      l.addEventListener("pointerleave", function () { window.CONSTELLATION.souligne(null); });
      l.addEventListener("focusin", function () { window.CONSTELLATION.souligne(q.q); });
      l.addEventListener("focusout", function () { window.CONSTELLATION.souligne(null); });
    });

    hote.querySelectorAll("[data-question]").forEach(function (c) {
      c.addEventListener("change", function () {
        var id = c.getAttribute("data-question");
        var i = etat.reponses.indexOf(id);
        if (c.checked && i === -1) etat.reponses.push(id);
        if (!c.checked && i !== -1) etat.reponses.splice(i, 1);
        ecrit();
        rendPlan();
      });
    });
  }

  /* --- Étape 3a : le bandeau de tête ----------------------------------------- */
  function rendResume(m, p) {
    var hote = element("sortie-resume");
    if (!hote) return;
    hote.innerHTML = '<div class="resume-plan">' +
      // Redite visuelle de la phrase qui suit : retiré de l'arbre
      // d'accessibilité, sans quoi la zone aria-live annoncerait chaque valeur
      // intermédiaire du compteur animé.
      '<span class="chiffre" aria-hidden="true">' + p.nombre + "</span>" +
      '<span class="detail"><strong>' +
      esc(pluriel(p.nombre, "domaine à surveiller", "domaines à surveiller")) + "</strong>" +
      esc(m.nom) +
      (etat.reponses.length
        ? " — " + esc(pluriel(etat.reponses.length, "précision de contexte", "précisions de contexte"))
        : "") +
      "</span></div>";
  }

  /* --- Aperçu -------------------------------------------------------------- */
  var enApercu = false;

  function apercu(metierId) {
    var m = R.metier(metierId);
    if (!m || !window.CONSTELLATION) return;
    enApercu = true;
    var bloc = element("bloc-constellation");
    if (bloc) {
      bloc.hidden = false;
      bloc.classList.add("apercu");
      var etiq = bloc.querySelector(".etiquette-apercu");
      if (etiq) etiq.textContent = "Aperçu — " + m.nom;
    }
    window.CONSTELLATION.rend(R.plan(metierId, etat.reponses), m);
  }

  function finApercu() {
    if (!enApercu) return;
    enApercu = false;
    var bloc = element("bloc-constellation");
    if (bloc) bloc.classList.remove("apercu");
    rendPlan();
  }

  /* --- Étape 3b : la constellation ---------------------------------------- */
  function rendConstellation(m, p) {
    var bloc = element("bloc-constellation");
    if (bloc) bloc.hidden = false;
    if (window.CONSTELLATION) window.CONSTELLATION.rend(p, m);
  }

  /* --- Étape 3c : l'année ----------------------------------------------------- */
  /* Un rythme se traduit en mois de revue : c'est là qu'un dirigeant voit ce que
     son plan lui coûtera vraiment en temps. */
  function moisDe(frequence) {
    if (frequence === "mensuelle") return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    if (frequence === "trimestrielle") return [0, 3, 6, 9];
    if (frequence === "semestrielle") return [0, 6];
    return [0];
  }

  function rendCalendrier(p) {
    var bloc = element("calendrier");
    var hote = element("mois");
    if (!bloc || !hote) return;
    bloc.hidden = false;

    var compte = new Array(12).fill(0);
    p.entrees.forEach(function (e) {
      moisDe(e.domaine.frequence).forEach(function (m) { compte[m]++; });
    });
    var max = Math.max.apply(null, compte) || 1;

    if (!hote.children.length) {
      hote.innerHTML = MOIS.map(function (nom, i) {
        return "<div>" +
          '<div class="barre"><span class="remplissage" data-mois="' + i + '"></span>' +
          '<span class="n" data-compte="' + i + '">0</span></div>' +
          '<div class="nom">' + esc(nom) + "</div></div>";
      }).join("");
    }

    compte.forEach(function (n, i) {
      var remplissage = hote.querySelector('[data-mois="' + i + '"]');
      var valeur = hote.querySelector('[data-compte="' + i + '"]');
      if (remplissage) remplissage.style.height = Math.round((n / max) * 100) + "%";
      if (valeur) valeur.textContent = n;
    });
  }

  /* --- Étape 3d : le détail ---------------------------------------------------- */
  function rendGroupes(p) {
    var sortie = element("sortie-plan");
    if (!sortie) return;
    sortie.innerHTML = p.groupes.map(function (g) {
      return '<section class="groupe">' +
        '<div class="groupe-tete"><h3>' + esc(g.frequence.l) + "</h3>" +
        '<span class="aide">' + esc(g.frequence.d) + "</span></div>" +
        g.entrees.map(rendDomaine).join("") + "</section>";
    }).join("");
  }

  function rendDomaine(entree) {
    var d = entree.domaine;
    return '<details class="domaine">' +
      "<summary><span><span class=" + '"domaine-nom"' + ">" + esc(d.nom) + "</span>" +
      '<span class="domaine-resume">' + esc(d.resume) + "</span></span></summary>" +
      '<div class="repli">' +
      '<div class="domaine-corps">' +
        "<div><h4>Ce qu'il faut tenir</h4><ul>" +
          d.obligations.map(function (o) { return "<li>" + esc(o) + "</li>"; }).join("") +
        "</ul></div>" +
        "<div><h4>Textes de référence</h4><ul>" +
          d.textes.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") +
        "</ul>" +
        "<h4 style=" + '"margin-top:22px;"' + ">Sources officielles</h4>" +
        '<ul class="sources-domaine">' +
          d.sources.map(function (s) {
            return "<li><a href=" + '"' + esc(s.url) + '"' + ' target="_blank" rel="noopener">' +
              esc(s.nom) + "</a></li>";
          }).join("") +
        "</ul></div>" +
      "</div>" +
      '<div class="raisons">' +
        entree.raisons.map(function (r) { return '<span class="raison">' + esc(r) + "</span>"; }).join("") +
      "</div></div></details>";
  }

  /* --- Assemblage -------------------------------------------------------------- */
  function rendPlan() {
    var actions = element("actions");
    var resume = element("sortie-resume");
    var sortie = element("sortie-plan");

    if (!etat.metier) {
      if (resume) {
        resume.innerHTML = '<p class="etat-vide">Choisissez une activité à l\'étape 1 : ' +
          "votre plan se construit au fur et à mesure.</p>";
      }
      if (sortie) sortie.innerHTML = "";
      var bloc = element("bloc-constellation"), cal = element("calendrier");
      if (bloc) bloc.hidden = true;
      if (window.CONSTELLATION) window.CONSTELLATION.cache();
      if (cal) cal.hidden = true;
      if (actions) actions.hidden = true;
      majEnteteImpression(null);
      document.dispatchEvent(new CustomEvent("plan:rendu"));
      return;
    }

    var m = R.metier(etat.metier);
    var p = R.plan(etat.metier, etat.reponses);

    rendResume(m, p);
    rendConstellation(m, p);
    rendCalendrier(p);
    rendGroupes(p);
    if (actions) actions.hidden = false;
    majEnteteImpression(m);

    // assets/motion.js écoute cet événement pour rebrancher le dépliage animé,
    // la cascade et le compteur. L'outil fonctionne si personne n'écoute.
    document.dispatchEvent(new CustomEvent("plan:rendu"));
  }

  /* --- En-tête de la feuille imprimée --------------------------------------- */
  function majEnteteImpression(m) {
    var cible = element("impression-details");
    if (!cible) return;
    if (!m) { cible.textContent = ""; return; }

    var date = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    var contexte = etat.reponses.map(function (id) {
      var q = R.question(id);
      return q ? q.q.toLowerCase() : null;
    }).filter(Boolean);

    cible.textContent = m.nom + " — établi le " + date +
      (contexte.length ? ". Contexte retenu : " + contexte.join(" ; ") + "." : ".") +
      " Pierrel & Co — cadre méthodologique, ne constitue pas un conseil juridique.";
  }

  /* --- Actions ------------------------------------------------------------------ */
  function branche() {
    var imprimer = element("bouton-imprimer");
    if (imprimer) imprimer.addEventListener("click", function () { window.print(); });

    var copier = element("bouton-copier");
    if (copier) copier.addEventListener("click", function () {
      var dit = function (texte) {
        copier.textContent = texte;
        setTimeout(function () { copier.textContent = "Copier le lien de ce plan"; }, 2200);
      };
      var url = window.location.href;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () { dit("Lien copié"); },
          function () { dit("Copie refusée — l'adresse est dans la barre"); });
      } else {
        // Pas de presse-papiers (contexte non sécurisé, vieux navigateur) :
        // l'adresse de la page porte déjà le plan, on le dit plutôt que de
        // faire semblant.
        dit("L'adresse de la page est le lien");
      }
    });

    var reset = element("bouton-reset");
    if (reset) reset.addEventListener("click", function () {
      etat = { metier: null, reponses: [] };
      try { window.localStorage.removeItem(CLE); } catch (e) { /* rien à faire */ }
      ecritAdresse();
      rendMetiers();
      rendQuestions();
      rendPlan();
      window.scrollTo({ top: 0, behavior: SOBRE ? "auto" : "smooth" });
    });
  }

  /* Changer d'ancre ne recharge pas la page : sans cette écoute, ouvrir un lien
     reçu alors qu'on a déjà l'outil ouvert ne changerait rien à l'écran. */
  window.addEventListener("hashchange", function () {
    if (!litAdresse()) return;
    ecrit();
    rendMetiers();
    rendQuestions();
    rendPlan();
  });

  lit();
  litAdresse();          // l'adresse reçue l'emporte sur la mémoire locale
  // Un plan restauré depuis le navigateur doit lui aussi se retrouver dans
  // l'adresse : sinon, copier le lien en revenant sur le site donnerait un
  // lien vide.
  if (etat.metier) ecritAdresse();
  rendMetiers();
  rendQuestions();
  rendPlan();
  branche();
})();
