/* ==========================================================================
   Outil de veille réglementaire — logique applicative
   --------------------------------------------------------------------------
   100 % client : aucune donnée ne quitte le navigateur. L'état est conservé
   dans localStorage et peut être exporté/importé en CSV pour être repris dans
   un tableur, qui reste l'outil de référence de la plupart des entreprises.

   Étapes couvertes : 01 identification des sources (profil + périmètre),
   02 collecte et 03 analyse (registre), 04 diffusion (synthèse imprimable),
   05 conformité (actions, responsables, échéances), 06 surveillance continue
   (fréquences et dates de revue).
   ========================================================================== */

(function () {
  "use strict";

  var V = window.VEILLE;
  var KEY = "pco-veille-v1";
  var ETAPES_APP = ["profil", "perimetre", "plan", "direct", "registre", "synthese"];
  var FIL_URL = "data/veille-feed.json";

  var STATUTS = {
    a_analyser: { l: "À analyser", badge: "badge-warn" },
    en_cours: { l: "Action en cours", badge: "badge-accent" },
    conforme: { l: "Conforme", badge: "badge-ok" },
    ecart: { l: "Écart constaté", badge: "badge-error" },
    non_applicable: { l: "Non applicable", badge: "badge-quiet" }
  };
  var NIVEAUX = { majeur: "Majeur", modere: "Modéré", mineur: "Mineur" };
  var JOURS = { quotidienne: 1, hebdomadaire: 7, mensuelle: 30, trimestrielle: 90 };

  /* ------------------------------------------------------------- UTILITAIRES */

  function esc(v) {
    return String(v === null || v === undefined ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function uid() { return "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function aujourdhui() { return new Date().toISOString().slice(0, 10); }

  function fmtDate(iso) {
    if (!iso) return "—";
    var p = String(iso).split("-");
    if (p.length !== 3) return esc(iso);
    return p[2] + "/" + p[1] + "/" + p[0];
  }
  function ajouteJours(iso, n) {
    var d = new Date(iso + "T12:00:00");
    if (isNaN(d.getTime())) return "";
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function enRetard(iso) { return !!iso && iso < aujourdhui(); }

  /* ------------------------------------------------------------------- ÉTAT */

  function etatVierge() {
    return {
      version: 1,
      profil: { entreprise: "", naf: "", division: "", effectif: "", sites: "", pilote: "", maj: aujourdhui() },
      declencheurs: [],
      plan: {},
      registre: [],
      direct: { masques: [] }
    };
  }

  var state = charger() || etatVierge();

  function charger() {
    try {
      var brut = window.localStorage.getItem(KEY);
      if (!brut) return null;
      var o = JSON.parse(brut);
      if (!o || typeof o !== "object") return null;
      var base = etatVierge();
      base.profil = Object.assign(base.profil, o.profil || {});
      base.declencheurs = Array.isArray(o.declencheurs) ? o.declencheurs : [];
      base.plan = o.plan && typeof o.plan === "object" ? o.plan : {};
      base.registre = Array.isArray(o.registre) ? o.registre : [];
      if (o.direct && Array.isArray(o.direct.masques)) base.direct.masques = o.direct.masques;
      return base;
    } catch (e) {
      return null;
    }
  }

  var sauvegardeTimer = null;
  function sauver() {
    clearTimeout(sauvegardeTimer);
    sauvegardeTimer = setTimeout(function () {
      try {
        window.localStorage.setItem(KEY, JSON.stringify(state));
        marqueSauvegarde("Enregistré localement à " + new Date().toLocaleTimeString("fr-FR").slice(0, 5));
      } catch (e) {
        marqueSauvegarde("Sauvegarde impossible (navigation privée ?) — pensez à exporter en CSV", true);
      }
    }, 250);
  }
  function marqueSauvegarde(txt, alerte) {
    var el = $("#save-state");
    if (!el) return;
    el.textContent = txt;
    el.classList.toggle("is-error", !!alerte);
  }

  /* -------------------------------------------------------------- PÉRIMÈTRE */

  function perimetreCourant() {
    if (!state.profil.division) return [];
    return V.perimetre(state.profil.division, state.declencheurs);
  }

  /** Aligne state.plan sur le périmètre : ajoute les nouveaux domaines,
      conserve les réglages saisis, retire ceux qui ne s'appliquent plus. */
  function synchronisePlan() {
    var per = perimetreCourant();
    var actifs = {};
    per.forEach(function (p) {
      actifs[p.id] = true;
      if (!state.plan[p.id]) {
        state.plan[p.id] = {
          frequence: V.domaines[p.id].frequence,
          responsable: "",
          derniereRevue: ""
        };
      }
    });
    Object.keys(state.plan).forEach(function (id) {
      if (!actifs[id]) delete state.plan[id];
    });
  }

  /* ------------------------------------------------------- ONGLETS / ÉTAPES */

  function ouvrir(etape, focus) {
    if (ETAPES_APP.indexOf(etape) === -1) etape = "profil";
    ETAPES_APP.forEach(function (e) {
      var onglet = $('[data-step="' + e + '"]');
      var panneau = $("#panel-" + e);
      var actif = e === etape;
      if (onglet) {
        onglet.setAttribute("aria-selected", actif ? "true" : "false");
        onglet.setAttribute("tabindex", actif ? "0" : "-1");
      }
      if (panneau) panneau.hidden = !actif;
    });
    if (history.replaceState) history.replaceState(null, "", "#" + etape);
    if (focus) {
      var o = $('[data-step="' + etape + '"]');
      if (o) o.focus();
    }
    if (etape === "direct") rendDirect();
    if (etape === "synthese") rendSynthese();
  }

  function initOnglets() {
    var onglets = $$('[data-step]');
    onglets.forEach(function (o) {
      o.addEventListener("click", function () { ouvrir(o.getAttribute("data-step")); });
      o.addEventListener("keydown", function (ev) {
        var i = onglets.indexOf(o);
        var j = null;
        if (ev.key === "ArrowRight") j = (i + 1) % onglets.length;
        if (ev.key === "ArrowLeft") j = (i - 1 + onglets.length) % onglets.length;
        if (ev.key === "Home") j = 0;
        if (ev.key === "End") j = onglets.length - 1;
        if (j !== null) {
          ev.preventDefault();
          ouvrir(onglets[j].getAttribute("data-step"), true);
        }
      });
    });
    $$("[data-goto]").forEach(function (b) {
      b.addEventListener("click", function () {
        ouvrir(b.getAttribute("data-goto"));
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });
    var hash = (location.hash || "").replace("#", "");
    ouvrir(ETAPES_APP.indexOf(hash) !== -1 ? hash : "profil");
  }

  /* ------------------------------------------------------- ÉTAPE 1 : PROFIL */

  function initProfil() {
    var champs = [
      ["#p-entreprise", "entreprise"], ["#p-effectif", "effectif"],
      ["#p-sites", "sites"], ["#p-pilote", "pilote"]
    ];
    champs.forEach(function (c) {
      var el = $(c[0]);
      if (!el) return;
      el.value = state.profil[c[1]] || "";
      el.addEventListener("input", function () {
        state.profil[c[1]] = el.value;
        state.profil.maj = aujourdhui();
        sauver();
      });
    });

    var recherche = $("#p-naf");
    var resultats = $("#naf-resultats");
    recherche.value = state.profil.naf || "";

    function afficheResultats(liste) {
      if (!liste.length) {
        resultats.innerHTML = '<p class="hint">Aucune division ne correspond. Essayez un code (ex. <code>43</code>, <code>56.10A</code>) ou un mot du libellé (ex. <code>maçonnerie</code>, <code>restauration</code>).</p>';
        return;
      }
      resultats.innerHTML = '<ul class="naf-list">' + liste.map(function (d) {
        var s = V.section(d.s);
        return '<li><button type="button" class="naf-opt" data-div="' + esc(d.c) + '">' +
          '<span class="mono naf-code">' + esc(d.c) + '</span>' +
          '<span class="naf-lib">' + esc(d.l) + '</span>' +
          '<span class="mono naf-sec">Section ' + esc(d.s) + " — " + esc(s ? s.l : "") + "</span>" +
          "</button></li>";
      }).join("") + "</ul>";
      $$(".naf-opt", resultats).forEach(function (b) {
        b.addEventListener("click", function () { choisirDivision(b.getAttribute("data-div")); });
      });
    }

    recherche.addEventListener("input", function () {
      state.profil.naf = recherche.value;
      // Une saisie qui ressemble à un code (division seule ou code complet)
      // sélectionne directement la division, sans écraser ce que l'on tape.
      var d = V.divisionDepuisCode(recherche.value);
      var ressembleAUnCode = /^[0-9]{2}([.\-\s]?[0-9]{1,2}[a-zA-Z]?)?$/.test(recherche.value.trim());
      if (d && ressembleAUnCode) choisirDivision(d, true);
      afficheResultats(V.rechercher(recherche.value));
      sauver();
    });

    $$("[data-section-filtre]").forEach(function (b) {
      b.addEventListener("click", function () {
        var sec = V.section(b.getAttribute("data-section-filtre"));
        if (!sec) return;
        afficheResultats(sec.div.map(V.division).filter(Boolean));
        resultats.scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
    });

    if (state.profil.division) rendDivisionRetenue();
    else afficheResultats([]);
  }

  function choisirDivision(code, silencieux) {
    var d = V.division(code);
    if (!d) return;
    state.profil.division = code;
    if (!silencieux) {
      state.profil.naf = code;
      $("#p-naf").value = code;
    }
    synchronisePlan();
    rendDivisionRetenue();
    rendDeclencheurs();
    rendPerimetre();
    rendPlan();
    remplitSelectDomaines();
    dessineDirect();
    majCompteurOnglet();
    sauver();
  }

  function rendDivisionRetenue() {
    var box = $("#naf-retenu");
    var d = V.division(state.profil.division);
    if (!d) { box.innerHTML = ""; box.hidden = true; return; }
    var s = V.section(d.s);
    var sect = V.parDivision[d.c] || [];
    box.hidden = false;
    box.innerHTML =
      '<div class="retenu-head"><span class="badge badge-accent">Division retenue</span>' +
      '<span class="mono retenu-code">' + esc(d.c) + "</span></div>" +
      "<h3>" + esc(d.l) + "</h3>" +
      '<p class="mono retenu-sec">Section ' + esc(d.s) + " — " + esc(s ? s.l : "") + "</p>" +
      '<p class="hint">Un code complet (4 chiffres + 1 lettre, ex. ' + esc(d.c) + '.99B) est rattaché à cette division. ' +
      "Vérifiez le code exact de votre établissement sur l'annuaire des entreprises avant de figer le périmètre.</p>" +
      '<p class="retenu-dom"><strong>' + sect.length + " domaine(s) sectoriel(s)</strong> s'ajoutent au socle commun de " +
      V.transversaux.length + " domaines. Passez à l'étape 2 pour affiner avec les caractéristiques de l'activité.</p>" +
      '<div class="retenu-cta no-print"><button type="button" class="btn btn-sm" data-goto="perimetre">Étape 2 — affiner le périmètre</button>' +
      '<a class="btn btn-outline btn-sm" href="https://annuaire-entreprises.data.gouv.fr" target="_blank" rel="noopener">Vérifier mon code NAF</a></div>';
    $$("[data-goto]", box).forEach(function (b) {
      b.addEventListener("click", function () { ouvrir(b.getAttribute("data-goto")); window.scrollTo({ top: 0, behavior: "smooth" }); });
    });
  }

  /* ---------------------------------------------------- ÉTAPE 2 : PÉRIMÈTRE */

  function rendDeclencheurs() {
    var box = $("#declencheurs-list");
    box.innerHTML = V.declencheurs.map(function (d) {
      var coche = state.declencheurs.indexOf(d.id) !== -1;
      return '<label class="check"><input type="checkbox" value="' + esc(d.id) + '"' + (coche ? " checked" : "") + ">" +
        '<span><span class="check-t">' + esc(d.q) + '</span><span class="check-d">' + esc(d.d) + "</span></span></label>";
    }).join("");
    $$('input[type="checkbox"]', box).forEach(function (cb) {
      cb.addEventListener("change", function () {
        var id = cb.value;
        var i = state.declencheurs.indexOf(id);
        if (cb.checked && i === -1) state.declencheurs.push(id);
        if (!cb.checked && i !== -1) state.declencheurs.splice(i, 1);
        synchronisePlan();
        rendPerimetre();
        rendPlan();
        remplitSelectDomaines();
        dessineDirect();
        majCompteurOnglet();
        sauver();
      });
    });
  }

  function rendPerimetre() {
    var box = $("#perimetre-resume");
    if (!state.profil.division) {
      box.innerHTML = '<div class="notice notice-warn"><strong>Renseignez d\'abord un code NAF</strong>Le périmètre se construit à partir de la division NAF, puis des caractéristiques cochées ci-dessus.</div>';
      return;
    }
    var per = perimetreCourant();
    var parFamille = {};
    per.forEach(function (p) {
      var f = V.domaines[p.id].famille;
      (parFamille[f] = parFamille[f] || []).push(p);
    });
    var html = '<div class="tiles">' +
      tile(per.length, "domaines de veille") +
      tile(Object.keys(parFamille).length, "familles de veille") +
      tile(per.filter(function (p) { return V.domaines[p.id].frequence === "quotidienne" || V.domaines[p.id].frequence === "hebdomadaire"; }).length, "à suivre chaque semaine") +
      tile(state.declencheurs.length, "caractéristiques retenues") +
      "</div>";

    html += Object.keys(V.familles).filter(function (f) { return parFamille[f]; }).map(function (f) {
      var fam = V.familles[f];
      return '<div class="fam-block"><div class="fam-head"><h3>' + esc(fam.l) + '</h3><p class="hint">' + esc(fam.d) + "</p></div>" +
        '<ul class="dom-list">' + parFamille[f].map(function (p) {
          var d = V.domaines[p.id];
          return '<li class="dom-item"><div class="dom-top"><h4>' + esc(d.nom) + "</h4>" +
            '<span class="badge ' + (d.frequence === "quotidienne" || d.frequence === "hebdomadaire" ? "badge-error" : "badge-quiet") + '">' + esc(V.frequences[d.frequence].l) + "</span>" +
            p.origines.map(function (o) { return '<span class="badge badge-quiet">' + esc(libelleOrigine(o)) + "</span>"; }).join("") +
            "</div>" +
            "<p>" + esc(d.resume) + "</p>" +
            '<details><summary class="mono">Textes, points de contrôle et sources</summary>' +
            '<div class="dom-detail">' +
            "<h5>Textes de référence</h5><ul>" + d.textes.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>" +
            "<h5>Points de contrôle typiques</h5><ul>" + d.obligations.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>" +
            "<h5>Sources à surveiller</h5><ul>" + d.sources.map(function (s) {
              return '<li><a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.nom) + "</a></li>";
            }).join("") + "</ul>" +
            "<h5>Nature des impacts</h5><p>" + d.impacts.map(function (i) { return esc(V.impactsLabels[i] || i); }).join(" · ") + "</p>" +
            "</div></details></li>";
        }).join("") + "</ul></div>";
    }).join("");

    box.innerHTML = html;
  }

  function tile(n, l) {
    return '<div class="tile"><div class="tile-n mono">' + esc(n) + '</div><div class="tile-l">' + esc(l) + "</div></div>";
  }
  function libelleOrigine(o) {
    return o === "socle" ? "Socle commun" : o === "secteur" ? "Secteur NAF" : "Caractéristique";
  }

  /* --------------------------------------------------- ÉTAPE 3 : PLAN DE VEILLE */

  function rendPlan() {
    var box = $("#plan-table");
    var per = perimetreCourant();
    if (!per.length) {
      box.innerHTML = '<div class="notice notice-warn"><strong>Plan de veille vide</strong>Renseignez un code NAF à l\'étape 1 pour générer le plan.</div>';
      return;
    }
    var lignes = per.map(function (p) {
      var d = V.domaines[p.id];
      var cfg = state.plan[p.id] || { frequence: d.frequence, responsable: "", derniereRevue: "" };
      var prochaine = cfg.derniereRevue ? ajouteJours(cfg.derniereRevue, JOURS[cfg.frequence] || 30) : "";
      var alerte = prochaine && enRetard(prochaine);
      return "<tr>" +
        "<td><strong>" + esc(d.nom) + "</strong><br><span class=\"mono hint\">" + esc(V.familles[d.famille].l) + "</span></td>" +
        '<td><select class="ctl ctl-sm" data-plan-freq="' + esc(p.id) + '" aria-label="Fréquence pour ' + esc(d.nom) + '">' +
        Object.keys(V.frequences).map(function (f) {
          return '<option value="' + f + '"' + (cfg.frequence === f ? " selected" : "") + ">" + esc(V.frequences[f].l) + "</option>";
        }).join("") + "</select></td>" +
        '<td><input class="ctl ctl-sm" type="text" data-plan-resp="' + esc(p.id) + '" value="' + esc(cfg.responsable) + '" placeholder="Nom / fonction" aria-label="Responsable pour ' + esc(d.nom) + '"></td>' +
        '<td class="num"><input class="ctl ctl-sm" type="date" data-plan-revue="' + esc(p.id) + '" value="' + esc(cfg.derniereRevue) + '" aria-label="Dernière revue pour ' + esc(d.nom) + '"></td>' +
        '<td class="num">' + (prochaine ? '<span class="badge ' + (alerte ? "badge-error" : "badge-ok") + '">' + fmtDate(prochaine) + "</span>" : '<span class="hint mono">à planifier</span>') + "</td>" +
        "<td>" + d.sources.map(function (s) { return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.nom) + "</a>"; }).join('<br>') + "</td>" +
        '<td class="no-print"><button type="button" class="btn btn-outline btn-sm" data-plan-ok="' + esc(p.id) + '">Revue faite</button></td>' +
        "</tr>";
    }).join("");

    box.innerHTML = '<div class="table-scroll"><table class="data"><caption>Plan de veille — ' + per.length + " domaines, généré depuis la division " + esc(state.profil.division) + "</caption>" +
      "<thead><tr><th>Domaine</th><th>Fréquence</th><th>Responsable</th><th>Dernière revue</th><th>Prochaine revue</th><th>Sources</th><th class=\"no-print\">Action</th></tr></thead><tbody>" +
      lignes + "</tbody></table></div>";

    $$("[data-plan-freq]", box).forEach(function (el) {
      el.addEventListener("change", function () {
        state.plan[el.getAttribute("data-plan-freq")].frequence = el.value;
        sauver(); rendPlan();
      });
    });
    $$("[data-plan-resp]", box).forEach(function (el) {
      el.addEventListener("input", function () {
        state.plan[el.getAttribute("data-plan-resp")].responsable = el.value;
        sauver();
      });
    });
    $$("[data-plan-revue]", box).forEach(function (el) {
      el.addEventListener("change", function () {
        state.plan[el.getAttribute("data-plan-revue")].derniereRevue = el.value;
        sauver(); rendPlan();
      });
    });
    $$("[data-plan-ok]", box).forEach(function (el) {
      el.addEventListener("click", function () {
        state.plan[el.getAttribute("data-plan-ok")].derniereRevue = aujourdhui();
        sauver(); rendPlan();
      });
    });
  }

  /* ------------------------------------------------------ ÉTAPE 4 : REGISTRE */

  var editionId = null;
  var formJorfId = null;   // texte du fil à l'origine de la saisie en cours

  function remplitSelectDomaines() {
    var sel = $("#r-domaine");
    if (!sel) return;
    var per = perimetreCourant();
    var ids = per.length ? per.map(function (p) { return p.id; }) : Object.keys(V.domaines);
    var courant = sel.value;
    sel.innerHTML = '<option value="">— choisir —</option>' + ids.map(function (id) {
      return '<option value="' + esc(id) + '">' + esc(V.domaines[id].nom) + "</option>";
    }).join("");
    if (courant && ids.indexOf(courant) !== -1) sel.value = courant;
    var filtre = $("#f-domaine");
    if (filtre) {
      var fc = filtre.value;
      filtre.innerHTML = '<option value="">Tous les domaines</option>' + ids.map(function (id) {
        return '<option value="' + esc(id) + '">' + esc(V.domaines[id].nom) + "</option>";
      }).join("");
      if (fc && ids.indexOf(fc) !== -1) filtre.value = fc;
    }
  }

  function lireFormulaire() {
    return {
      id: editionId || uid(),
      jorfId: formJorfId || null,
      ref: $("#r-ref").value.trim(),
      intitule: $("#r-intitule").value.trim(),
      domaine: $("#r-domaine").value,
      source: $("#r-source").value.trim(),
      datePub: $("#r-datepub").value,
      dateVigueur: $("#r-vigueur").value,
      niveau: $("#r-niveau").value,
      impacts: $$('input[name="r-impact"]:checked').map(function (c) { return c.value; }),
      action: $("#r-action").value.trim(),
      responsable: $("#r-resp").value.trim(),
      echeance: $("#r-echeance").value,
      statut: $("#r-statut").value,
      notes: $("#r-notes").value.trim()
    };
  }

  function remplitFormulaire(e) {
    $("#r-ref").value = e.ref || "";
    $("#r-intitule").value = e.intitule || "";
    $("#r-domaine").value = e.domaine || "";
    $("#r-source").value = e.source || "";
    $("#r-datepub").value = e.datePub || "";
    $("#r-vigueur").value = e.dateVigueur || "";
    $("#r-niveau").value = e.niveau || "modere";
    $$('input[name="r-impact"]').forEach(function (c) { c.checked = (e.impacts || []).indexOf(c.value) !== -1; });
    $("#r-action").value = e.action || "";
    $("#r-resp").value = e.responsable || "";
    $("#r-echeance").value = e.echeance || "";
    $("#r-statut").value = e.statut || "a_analyser";
    $("#r-notes").value = e.notes || "";
  }

  function videFormulaire() {
    editionId = null;
    formJorfId = null;
    $("#registre-form").reset();
    $("#r-niveau").value = "modere";
    $("#r-statut").value = "a_analyser";
    $("#form-mode").textContent = "Nouvelle entrée";
    $("#btn-submit").textContent = "Ajouter au registre";
    $("#btn-annuler").hidden = true;
  }

  function initRegistre() {
    remplitSelectDomaines();
    $("#registre-form").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var e = lireFormulaire();
      var err = $("#registre-erreur");
      if (!e.intitule || !e.domaine) {
        err.textContent = "L'intitulé du texte et le domaine de veille sont obligatoires.";
        err.hidden = false;
        return;
      }
      err.hidden = true;
      if (editionId) {
        state.registre = state.registre.map(function (x) { return x.id === editionId ? e : x; });
      } else {
        state.registre.unshift(e);
      }
      videFormulaire();
      rendRegistre();
      dessineDirect();
      majCompteurOnglet();
      sauver();
    });
    $("#btn-annuler").addEventListener("click", videFormulaire);
    ["#f-domaine", "#f-statut", "#f-texte"].forEach(function (s) {
      var el = $(s);
      if (el) el.addEventListener("input", rendRegistre);
      if (el) el.addEventListener("change", rendRegistre);
    });
    $("#btn-export-registre").addEventListener("click", exporteRegistre);
    var selFil = $("#f-fil");
    if (selFil) selFil.addEventListener("change", dessineDirect);
    var btnRefresh = $("#btn-fil-refresh");
    if (btnRefresh) btnRefresh.addEventListener("click", function () {
      btnRefresh.disabled = true;
      chargeFil(true).then(function () {
        dessineDirect();
        majCompteurOnglet();
        btnRefresh.disabled = false;
      });
    });
    var btnMasques = $("#btn-fil-masques");
    if (btnMasques) btnMasques.addEventListener("click", function () {
      state.direct.masques = [];
      sauver();
      dessineDirect();
      majCompteurOnglet();
    });
    $("#btn-export-plan").addEventListener("click", exportePlan);
    $("#btn-import").addEventListener("click", function () { $("#import-file").click(); });
    $("#import-file").addEventListener("change", importeRegistre);
    $("#btn-exemple").addEventListener("click", chargeExemples);
    $("#btn-reset").addEventListener("click", function () {
      if (!window.confirm("Effacer le profil, le plan de veille et toutes les entrées du registre ? Cette action est définitive.")) return;
      state = etatVierge();
      try { window.localStorage.removeItem(KEY); } catch (e) { /* ignoré */ }
      $("#registre-form").reset();
      $("#p-naf").value = "";
      ["#p-entreprise", "#p-effectif", "#p-sites", "#p-pilote"].forEach(function (s) { if ($(s)) $(s).value = ""; });
      rendDivisionRetenue(); rendDeclencheurs(); rendPerimetre(); rendPlan(); rendRegistre(); remplitSelectDomaines();
      dessineDirect(); majCompteurOnglet();
      marqueSauvegarde("Espace de travail réinitialisé");
    });
    rendRegistre();
  }

  function registreFiltre() {
    var fd = ($("#f-domaine") || {}).value || "";
    var fs = ($("#f-statut") || {}).value || "";
    var ft = (($("#f-texte") || {}).value || "").toLowerCase().trim();
    return state.registre.filter(function (e) {
      if (fd && e.domaine !== fd) return false;
      if (fs && e.statut !== fs) return false;
      if (ft) {
        var hay = [e.ref, e.intitule, e.action, e.responsable, e.notes, e.source].join(" ").toLowerCase();
        if (hay.indexOf(ft) === -1) return false;
      }
      return true;
    });
  }

  function rendRegistre() {
    var stats = $("#registre-stats");
    var retard = state.registre.filter(function (e) {
      return enRetard(e.echeance) && e.statut !== "conforme" && e.statut !== "non_applicable";
    }).length;
    stats.innerHTML = '<div class="tiles">' +
      tile(state.registre.length, "entrées au registre") +
      tile(state.registre.filter(function (e) { return e.statut === "a_analyser"; }).length, "à analyser") +
      tile(state.registre.filter(function (e) { return e.statut === "en_cours"; }).length, "actions en cours") +
      tile(state.registre.filter(function (e) { return e.statut === "ecart"; }).length, "écarts constatés") +
      tile(retard, "échéances dépassées") +
      "</div>";

    var liste = registreFiltre().slice().sort(function (a, b) {
      var ea = a.echeance || "9999-99-99", eb = b.echeance || "9999-99-99";
      if (ea !== eb) return ea < eb ? -1 : 1;
      return (b.datePub || "").localeCompare(a.datePub || "");
    });
    var box = $("#registre-table");
    if (!state.registre.length) {
      box.innerHTML = '<div class="notice"><strong>Registre vide</strong>Ajoutez les textes relevés lors de la collecte, ou chargez un jeu d\'exemples pour voir la structure attendue.</div>';
      return;
    }
    if (!liste.length) {
      box.innerHTML = '<div class="notice"><strong>Aucune entrée ne correspond aux filtres</strong>Modifiez le domaine, le statut ou la recherche.</div>';
      return;
    }
    box.innerHTML = '<div class="table-scroll"><table class="data"><caption>Registre de veille — ' + liste.length + " entrée(s) affichée(s) sur " + state.registre.length + "</caption>" +
      "<thead><tr><th>Texte</th><th>Domaine</th><th>Publication</th><th>Entrée en vigueur</th><th>Impact</th><th>Action / responsable</th><th>Échéance</th><th>Statut</th><th class=\"no-print\">Gérer</th></tr></thead><tbody>" +
      liste.map(function (e) {
        var st = STATUTS[e.statut] || STATUTS.a_analyser;
        var dom = V.domaines[e.domaine];
        var alerte = enRetard(e.echeance) && e.statut !== "conforme" && e.statut !== "non_applicable";
        return "<tr>" +
          "<td><strong>" + esc(e.intitule) + "</strong>" +
          (e.ref ? '<br><span class="mono hint">' + esc(e.ref) + "</span>" : "") +
          (e.source ? '<br>' + lienOuTexte(e.source) : "") +
          (e.notes ? '<br><span class="hint">' + esc(e.notes) + "</span>" : "") + "</td>" +
          "<td>" + esc(dom ? dom.nom : e.domaine) + "</td>" +
          '<td class="num">' + fmtDate(e.datePub) + "</td>" +
          '<td class="num">' + fmtDate(e.dateVigueur) + "</td>" +
          "<td><span class=\"badge " + (e.niveau === "majeur" ? "badge-error" : e.niveau === "mineur" ? "badge-quiet" : "badge-warn") + '">' + esc(NIVEAUX[e.niveau] || "Modéré") + "</span>" +
          ((e.impacts || []).length ? '<br><span class="hint">' + esc(e.impacts.map(function (i) { return V.impactsLabels[i] || i; }).join(" · ")) + "</span>" : "") + "</td>" +
          "<td>" + (e.action ? esc(e.action) : '<span class="hint">—</span>') +
          (e.responsable ? '<br><span class="mono hint">' + esc(e.responsable) + "</span>" : "") + "</td>" +
          '<td class="num">' + (e.echeance ? '<span class="badge ' + (alerte ? "badge-error" : "badge-quiet") + '">' + fmtDate(e.echeance) + "</span>" : "—") + "</td>" +
          '<td><span class="badge ' + st.badge + '">' + esc(st.l) + "</span></td>" +
          '<td class="no-print nowrap"><button type="button" class="btn btn-outline btn-sm" data-edit="' + esc(e.id) + '">Modifier</button> ' +
          '<button type="button" class="btn btn-danger btn-sm" data-del="' + esc(e.id) + '">Suppr.</button></td>' +
          "</tr>";
      }).join("") + "</tbody></table></div>";

    $$("[data-edit]", box).forEach(function (b) {
      b.addEventListener("click", function () {
        var e = state.registre.filter(function (x) { return x.id === b.getAttribute("data-edit"); })[0];
        if (!e) return;
        editionId = e.id;
        formJorfId = e.jorfId || null;
        remplitFormulaire(e);
        $("#form-mode").textContent = "Modification de « " + (e.intitule || "entrée") + " »";
        $("#btn-submit").textContent = "Enregistrer les modifications";
        $("#btn-annuler").hidden = false;
        $("#registre-form").scrollIntoView({ behavior: "smooth", block: "start" });
        $("#r-ref").focus();
      });
    });
    $$("[data-del]", box).forEach(function (b) {
      b.addEventListener("click", function () {
        var id = b.getAttribute("data-del");
        var e = state.registre.filter(function (x) { return x.id === id; })[0];
        if (!window.confirm("Supprimer « " + (e && e.intitule ? e.intitule : "cette entrée") + " » du registre ?")) return;
        state.registre = state.registre.filter(function (x) { return x.id !== id; });
        if (editionId === id) videFormulaire();
        rendRegistre();
        sauver();
      });
    });
  }

  function lienOuTexte(v) {
    if (/^https?:\/\//i.test(v)) {
      var court = v.replace(/^https?:\/\//i, "").slice(0, 46);
      return '<a class="mono hint" href="' + esc(v) + '" target="_blank" rel="noopener">' + esc(court) + "</a>";
    }
    return '<span class="mono hint">' + esc(v) + "</span>";
  }

  /* ------------------------------------------------------------------- CSV */

  var COLS_REGISTRE = [
    ["ref", "Référence du texte"], ["intitule", "Intitulé"], ["domaine", "Domaine"],
    ["source", "Source"], ["datePub", "Date de publication"], ["dateVigueur", "Entrée en vigueur"],
    ["niveau", "Niveau d'impact"], ["impacts", "Nature des impacts"], ["action", "Action à mener"],
    ["responsable", "Responsable"], ["echeance", "Échéance"], ["statut", "Statut"], ["notes", "Notes"]
  ];

  function champCsv(v) {
    var s = v === null || v === undefined ? "" : String(v);
    return /[";\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function telecharge(nom, contenu) {
    var blob = new Blob(["﻿" + contenu], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = nom;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function exporteRegistre() {
    if (!state.registre.length) { marqueSauvegarde("Registre vide : rien à exporter", true); return; }
    var lignes = [COLS_REGISTRE.map(function (c) { return champCsv(c[1]); }).join(";")];
    state.registre.forEach(function (e) {
      lignes.push(COLS_REGISTRE.map(function (c) {
        var v = e[c[0]];
        if (c[0] === "impacts") v = (v || []).join(" ");
        if (c[0] === "domaine") v = V.domaines[v] ? V.domaines[v].nom + " [" + v + "]" : v;
        if (c[0] === "statut") v = (STATUTS[v] || {}).l || v;
        if (c[0] === "niveau") v = NIVEAUX[v] || v;
        return champCsv(v);
      }).join(";"));
    });
    telecharge("veille-registre-" + aujourdhui() + ".csv", lignes.join("\r\n"));
    marqueSauvegarde("Registre exporté (" + state.registre.length + " entrées)");
  }

  function exportePlan() {
    var per = perimetreCourant();
    if (!per.length) { marqueSauvegarde("Aucun plan à exporter : renseignez un code NAF", true); return; }
    var lignes = ["Domaine;Famille;Fréquence;Responsable;Dernière revue;Prochaine revue;Origine;Sources;Textes de référence"];
    per.forEach(function (p) {
      var d = V.domaines[p.id];
      var cfg = state.plan[p.id] || {};
      var prochaine = cfg.derniereRevue ? ajouteJours(cfg.derniereRevue, JOURS[cfg.frequence] || 30) : "";
      lignes.push([
        d.nom, V.familles[d.famille].l, V.frequences[cfg.frequence || d.frequence].l,
        cfg.responsable || "", cfg.derniereRevue || "", prochaine,
        p.origines.map(libelleOrigine).join(" + "),
        d.sources.map(function (s) { return s.nom + " (" + s.url + ")"; }).join(" | "),
        d.textes.join(" | ")
      ].map(champCsv).join(";"));
    });
    telecharge("plan-de-veille-" + aujourdhui() + ".csv", lignes.join("\r\n"));
    marqueSauvegarde("Plan de veille exporté (" + per.length + " domaines)");
  }

  /** Parseur CSV tolérant (séparateur ; ou ,) gérant les champs entre guillemets. */
  function parseCsv(txt) {
    var sep = (txt.split("\n")[0].split(";").length >= txt.split("\n")[0].split(",").length) ? ";" : ",";
    var lignes = [], champ = "", ligne = [], dansGuillemets = false;
    txt = txt.replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    for (var i = 0; i < txt.length; i++) {
      var c = txt[i];
      if (dansGuillemets) {
        if (c === '"' && txt[i + 1] === '"') { champ += '"'; i++; }
        else if (c === '"') dansGuillemets = false;
        else champ += c;
      } else if (c === '"') dansGuillemets = true;
      else if (c === sep) { ligne.push(champ); champ = ""; }
      else if (c === "\n") { ligne.push(champ); lignes.push(ligne); ligne = []; champ = ""; }
      else champ += c;
    }
    if (champ !== "" || ligne.length) { ligne.push(champ); lignes.push(ligne); }
    return lignes.filter(function (l) { return l.some(function (v) { return String(v).trim() !== ""; }); });
  }

  function importeRegistre(ev) {
    var f = ev.target.files && ev.target.files[0];
    if (!f) return;
    var lecteur = new FileReader();
    lecteur.onload = function () {
      var lignes = parseCsv(String(lecteur.result));
      if (lignes.length < 2) { marqueSauvegarde("Fichier CSV vide ou illisible", true); return; }
      var entetes = lignes[0].map(function (h) { return h.trim().toLowerCase(); });
      function idx() {
        for (var i = 0; i < arguments.length; i++) {
          var j = entetes.indexOf(String(arguments[i]).toLowerCase());
          if (j !== -1) return j;
        }
        return -1;
      }
      var map = {
        ref: idx("référence du texte", "reference du texte", "référence", "ref"),
        intitule: idx("intitulé", "intitule", "titre"),
        domaine: idx("domaine"),
        source: idx("source"),
        datePub: idx("date de publication", "publication"),
        dateVigueur: idx("entrée en vigueur", "entree en vigueur", "vigueur"),
        niveau: idx("niveau d'impact", "niveau"),
        impacts: idx("nature des impacts", "impacts"),
        action: idx("action à mener", "action a mener", "action"),
        responsable: idx("responsable"),
        echeance: idx("échéance", "echeance"),
        statut: idx("statut"),
        notes: idx("notes", "commentaires")
      };
      if (map.intitule === -1) { marqueSauvegarde("Colonne « Intitulé » introuvable dans le CSV", true); return; }
      var ajouts = 0;
      lignes.slice(1).forEach(function (l) {
        function val(k) { return map[k] !== -1 && l[map[k]] !== undefined ? String(l[map[k]]).trim() : ""; }
        var intitule = val("intitule");
        if (!intitule) return;
        var domBrut = val("domaine");
        var domId = "";
        var crochets = domBrut.match(/\[([a-z_]+)\]/);
        if (crochets && V.domaines[crochets[1]]) domId = crochets[1];
        else {
          Object.keys(V.domaines).forEach(function (id) {
            if (!domId && (id === domBrut || V.domaines[id].nom.toLowerCase() === domBrut.toLowerCase())) domId = id;
          });
        }
        var statutId = "a_analyser";
        Object.keys(STATUTS).forEach(function (s) {
          if (s === val("statut") || STATUTS[s].l.toLowerCase() === val("statut").toLowerCase()) statutId = s;
        });
        var niveauId = "modere";
        Object.keys(NIVEAUX).forEach(function (n) {
          if (n === val("niveau") || NIVEAUX[n].toLowerCase() === val("niveau").toLowerCase()) niveauId = n;
        });
        state.registre.push({
          id: uid(), ref: val("ref"), intitule: intitule, domaine: domId || "fiscal",
          source: val("source"), datePub: normaliseDate(val("datePub")), dateVigueur: normaliseDate(val("dateVigueur")),
          niveau: niveauId,
          impacts: val("impacts").split(/[ ,;·|]+/).filter(function (x) { return V.impactsLabels[x]; }),
          action: val("action"), responsable: val("responsable"),
          echeance: normaliseDate(val("echeance")), statut: statutId, notes: val("notes")
        });
        ajouts++;
      });
      rendRegistre();
      sauver();
      marqueSauvegarde(ajouts + " entrée(s) importée(s)");
      ev.target.value = "";
    };
    lecteur.readAsText(f, "UTF-8");
  }

  function normaliseDate(v) {
    if (!v) return "";
    var s = v.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    var m = s.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})$/);
    if (m) return m[3] + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[1]).slice(-2);
    return "";
  }

  /* --------------------------------------------------------------- EXEMPLES */

  function chargeExemples() {
    if (state.registre.length && !window.confirm("Ajouter 3 entrées d'exemple au registre existant ?")) return;
    var per = perimetreCourant();
    var dom = function (pref) {
      if (per.some(function (p) { return p.id === pref; })) return pref;
      return per.length ? per[0].id : "fiscal";
    };
    [
      {
        ref: "Veille — à compléter avec la référence exacte du JO",
        intitule: "Exemple : évolution des obligations de facturation électronique",
        domaine: dom("fiscal"), source: "https://bofip.impots.gouv.fr",
        datePub: aujourdhui(), dateVigueur: ajouteJours(aujourdhui(), 180),
        niveau: "majeur", impacts: ["financier", "operationnel"],
        action: "Vérifier la compatibilité du logiciel de facturation et choisir une plateforme",
        responsable: "Direction / comptabilité", echeance: ajouteJours(aujourdhui(), 90),
        statut: "en_cours", notes: "Entrée d'exemple — remplacer par le texte réellement publié."
      },
      {
        ref: "Veille — à compléter",
        intitule: "Exemple : mise à jour du document unique après un nouvel équipement",
        domaine: dom("sst"), source: "https://www.inrs.fr",
        datePub: ajouteJours(aujourdhui(), -20), dateVigueur: ajouteJours(aujourdhui(), -20),
        niveau: "modere", impacts: ["juridique", "operationnel"],
        action: "Réévaluer les risques du poste et former les utilisateurs",
        responsable: "Responsable sécurité", echeance: ajouteJours(aujourdhui(), -5),
        statut: "a_analyser", notes: "Échéance volontairement dépassée pour illustrer l'alerte."
      },
      {
        ref: "Veille — à compléter",
        intitule: "Exemple : nouvelle consigne de tri applicable aux déchets de l'entreprise",
        domaine: dom("env_general"), source: "https://www.ecologie.gouv.fr",
        datePub: ajouteJours(aujourdhui(), -60), dateVigueur: ajouteJours(aujourdhui(), -30),
        niveau: "mineur", impacts: ["operationnel"],
        action: "Mettre à jour l'affichage et le contrat d'enlèvement",
        responsable: "Services généraux", echeance: ajouteJours(aujourdhui(), 30),
        statut: "conforme", notes: ""
      }
    ].forEach(function (e) { e.id = uid(); state.registre.unshift(e); });
    rendRegistre();
    sauver();
    marqueSauvegarde("3 entrées d'exemple ajoutées");
  }

  /* ------------------------------------------- ÉTAPE 4 : VEILLE EN DIRECT ---
     Le fil est produit par scripts/collecte-jo.mjs et publié dans
     data/veille-feed.json. La page ne fait que le lire : aucune requête n'est
     envoyée vers un service tiers depuis le navigateur. */

  var fil = null;          // contenu du fichier, une fois chargé
  var filErreur = null;    // message si le fichier est inaccessible

  function chargeFil(force) {
    if (fil && !force) return Promise.resolve(fil);
    return fetch(FIL_URL, { cache: force ? "reload" : "default" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (j) {
        fil = j && Array.isArray(j.textes) ? j : { statut: "vide", textes: [] };
        filErreur = null;
        return fil;
      })
      .catch(function (e) {
        // Cas courant : page ouverte en local (file://), où fetch est bloqué.
        filErreur = location.protocol === "file:"
          ? "Le fil ne peut pas être lu quand la page est ouverte directement depuis le disque. Publiez le site, ou servez le dossier (npx http-server)."
          : "Fil indisponible (" + e.message + ").";
        fil = null;
        return null;
      });
  }

  /** Textes du fil qui touchent au moins un domaine du périmètre. */
  function filDuPerimetre() {
    if (!fil) return [];
    var ids = {};
    perimetreCourant().forEach(function (p) { ids[p.id] = true; });
    var aucunPerimetre = !state.profil.division;
    return fil.textes.filter(function (t) {
      if (aucunPerimetre) return true;
      return (t.domaines || []).some(function (d) { return ids[d]; });
    });
  }

  function dejaAuRegistre(idJorf) {
    return state.registre.some(function (e) { return e.jorfId === idJorf; });
  }

  function compteNonTraites() {
    return filDuPerimetre().filter(function (t) {
      return !dejaAuRegistre(t.id) && state.direct.masques.indexOf(t.id) === -1;
    }).length;
  }

  function majCompteurOnglet() {
    var el = $("#direct-compteur");
    if (!el) return;
    var n = fil ? compteNonTraites() : 0;
    el.textContent = n > 99 ? "99+" : String(n);
    el.hidden = n === 0;
  }

  function rendDirect() {
    chargeFil(false).then(function () {
      dessineDirect();
      majCompteurOnglet();
    });
  }

  function dessineDirect() {
    var etat = $("#direct-etat");
    var liste = $("#direct-liste");
    if (!etat || !liste) return;

    if (!fil) {
      etat.innerHTML = filErreur
        ? '<div class="notice notice-warn"><strong>Fil non chargé</strong>' + esc(filErreur) + "</div>"
        : '<div class="notice"><strong>Chargement du fil…</strong>Lecture de la dernière collecte.</div>';
      liste.innerHTML = "";
      return;
    }

    // Bandeau d'état : quand la collecte a tourné, et si elle a réussi.
    var bandeau;
    if (fil.statut === "jamais_execute" || !fil.genere) {
      bandeau = '<div class="notice notice-warn"><strong>La collecte automatique n\'a pas encore tourné</strong>' +
        "Le fil se remplira dès la première exécution de la tâche planifiée. Tant que les identifiants de l'API Légifrance ne sont pas renseignés dans les secrets du dépôt, la collecte reste en attente — voir DEPLOIEMENT.md.</div>";
    } else if (fil.statut === "echec") {
      bandeau = '<div class="notice notice-warn"><strong>Dernière collecte en échec</strong>' +
        "Le fil affiché date de " + (fil.derniereReussite ? fmtHorodatage(fil.derniereReussite) : "une exécution antérieure") +
        ". Message : " + esc(String(fil.erreur || "").slice(0, 220)) + "</div>";
    } else {
      bandeau = '<div class="tiles">' +
        tile(fil.textes.length, "textes dans le fil") +
        tile(filDuPerimetre().length, "concernent mon périmètre") +
        tile(compteNonTraites(), "restent à traiter") +
        tile(fil.nombreInedits || 0, "détectés à la dernière passe") +
        '</div><p class="hint" style="margin:-16px 0 26px;">Dernière collecte : ' + fmtHorodatage(fil.genere) +
        " · source : " + esc(fil.source || "inconnue") + "</p>";
    }
    etat.innerHTML = bandeau;

    var mode = ($("#f-fil") || {}).value || "perimetre";
    var base = mode === "tout" ? fil.textes : filDuPerimetre();
    if (mode === "prioritaire") base = base.filter(function (t) { return t.prioritaire; });
    var masques = base.filter(function (t) { return state.direct.masques.indexOf(t.id) !== -1; });
    var visibles = base.filter(function (t) { return state.direct.masques.indexOf(t.id) === -1; });

    var btnMasques = $("#btn-fil-masques");
    if (btnMasques) {
      btnMasques.hidden = masques.length === 0;
      btnMasques.textContent = "Réafficher " + masques.length + " texte(s) masqué(s)";
    }

    if (!fil.textes.length) {
      liste.innerHTML = "";
      return;
    }
    if (!visibles.length) {
      liste.innerHTML = '<div class="notice"><strong>Rien à traiter</strong>' +
        (mode === "perimetre" ? "Aucun texte du fil ne touche votre périmètre. Essayez « Tout le fil » pour voir ce qui a été collecté." : "Aucun texte ne correspond à ce filtre.") +
        "</div>";
      return;
    }

    liste.innerHTML = visibles.map(function (t) {
      var traite = dejaAuRegistre(t.id);
      var noms = (t.domaines || []).map(function (d) {
        return V.domaines[d] ? V.domaines[d].nom : d;
      });
      return '<article class="fil-item' + (traite ? " est-traite" : "") + '">' +
        '<div class="fil-top">' +
        '<span class="badge badge-ink">' + esc(t.nature || "TEXTE") + "</span>" +
        '<span class="mono fil-date">' + fmtDate(t.datePublication) + "</span>" +
        (t.prioritaire ? '<span class="badge badge-error">Prioritaire</span>' : "") +
        (traite ? '<span class="badge badge-ok">Au registre</span>' : "") +
        "</div>" +
        '<h4><a href="' + esc(t.url) + '" target="_blank" rel="noopener">' + esc(t.titre) + "</a></h4>" +
        '<p class="fil-dom">' + noms.map(function (n) { return esc(n); }).join(" · ") + "</p>" +
        ((t.motsCles || []).length ? '<p class="hint fil-mots">Repéré sur : ' + esc(t.motsCles.join(", ")) + "</p>" : "") +
        '<div class="fil-actions no-print">' +
        (traite ? "" : '<button type="button" class="btn btn-sm" data-fil-add="' + esc(t.id) + '">Analyser : ajouter au registre</button>') +
        '<button type="button" class="btn btn-outline btn-sm" data-fil-hide="' + esc(t.id) + '">Masquer</button>' +
        "</div></article>";
    }).join("");

    $$("[data-fil-add]", liste).forEach(function (b) {
      b.addEventListener("click", function () { versLeRegistre(b.getAttribute("data-fil-add")); });
    });
    $$("[data-fil-hide]", liste).forEach(function (b) {
      b.addEventListener("click", function () {
        var id = b.getAttribute("data-fil-hide");
        if (state.direct.masques.indexOf(id) === -1) state.direct.masques.push(id);
        sauver();
        dessineDirect();
        majCompteurOnglet();
      });
    });
  }

  /** Bascule un texte du fil vers le formulaire du registre, prérempli. */
  function versLeRegistre(idJorf) {
    var t = (fil ? fil.textes : []).filter(function (x) { return x.id === idJorf; })[0];
    if (!t) return;
    var per = perimetreCourant().map(function (p) { return p.id; });
    // On choisit le domaine rattaché qui appartient au périmètre, à défaut le premier.
    var domaine = (t.domaines || []).filter(function (d) { return per.indexOf(d) !== -1; })[0] ||
      (t.domaines || [])[0] || "";
    editionId = null;
    remplitFormulaire({
      ref: t.titre.split(" relatif")[0].split(" portant")[0].slice(0, 120),
      intitule: t.titre,
      domaine: domaine,
      source: t.url,
      datePub: t.datePublication,
      dateVigueur: "",
      niveau: t.prioritaire ? "majeur" : "modere",
      impacts: [],
      action: "",
      responsable: (state.plan[domaine] || {}).responsable || "",
      echeance: "",
      statut: "a_analyser",
      notes: "Détecté automatiquement au Journal officiel le " + fmtDate(t.datePublication) + "."
    });
    formJorfId = idJorf;
    $("#form-mode").textContent = "Depuis le fil du Journal officiel";
    $("#btn-submit").textContent = "Ajouter au registre";
    $("#btn-annuler").hidden = false;
    ouvrir("registre");
    window.scrollTo({ top: 0, behavior: "smooth" });
    $("#r-domaine").focus();
  }

  function fmtHorodatage(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return esc(String(iso || ""));
    return d.toLocaleDateString("fr-FR") + " à " + d.toLocaleTimeString("fr-FR").slice(0, 5);
  }

  /* ------------------------------------------------- ÉTAPE 5 : SYNTHÈSE ----- */

  function rendSynthese() {
    var box = $("#synthese");
    var d = V.division(state.profil.division);
    if (!d) {
      box.innerHTML = '<div class="notice notice-warn"><strong>Synthèse indisponible</strong>Renseignez au moins un code NAF à l\'étape 1.</div>';
      return;
    }
    var s = V.section(d.s);
    var per = perimetreCourant();
    var retard = state.registre.filter(function (e) {
      return enRetard(e.echeance) && e.statut !== "conforme" && e.statut !== "non_applicable";
    });
    var parFreq = {};
    per.forEach(function (p) {
      var f = (state.plan[p.id] || {}).frequence || V.domaines[p.id].frequence;
      (parFreq[f] = parFreq[f] || []).push(V.domaines[p.id].nom);
    });

    var html = '<div class="synth-head">' +
      "<h2>Synthèse de veille réglementaire</h2>" +
      '<p class="mono">' + esc(state.profil.entreprise || "Entreprise non renseignée") +
      " · division NAF " + esc(d.c) + " · éditée le " + fmtDate(aujourdhui()) + "</p></div>";

    html += '<div class="panel"><div class="panel-head"><h3>Profil retenu</h3></div><dl class="synth-dl">' +
      dl("Entreprise", state.profil.entreprise) +
      dl("Code NAF saisi", state.profil.naf) +
      dl("Division NAF", d.c + " — " + d.l) +
      dl("Section", d.s + " — " + (s ? s.l : "")) +
      dl("Effectif", state.profil.effectif) +
      dl("Sites / implantations", state.profil.sites) +
      dl("Pilote de la veille", state.profil.pilote) +
      dl("Caractéristiques retenues", state.declencheurs.map(function (id) {
        var x = V.declencheurs.filter(function (y) { return y.id === id; })[0];
        return x ? x.q : id;
      }).join(" · ")) +
      "</dl></div>";

    html += '<div class="tiles">' +
      tile(per.length, "domaines de veille") +
      tile(state.registre.length, "entrées au registre") +
      tile(state.registre.filter(function (e) { return e.statut === "ecart"; }).length, "écarts constatés") +
      tile(retard.length, "échéances dépassées") +
      "</div>";

    html += '<div class="panel"><div class="panel-head"><h3>Rythme de surveillance</h3></div><dl class="synth-dl">' +
      Object.keys(V.frequences).filter(function (f) { return parFreq[f]; }).map(function (f) {
        return dl(V.frequences[f].l, parFreq[f].join(" · "));
      }).join("") + "</dl></div>";

    if (retard.length) {
      html += '<div class="panel"><div class="panel-head"><h3>Actions en retard — à traiter en priorité</h3></div>' +
        '<ul class="synth-ul">' + retard.map(function (e) {
          return "<li><strong>" + esc(e.intitule) + "</strong> — échéance " + fmtDate(e.echeance) +
            (e.responsable ? " · " + esc(e.responsable) : "") +
            (e.action ? '<br><span class="hint">' + esc(e.action) + "</span>" : "") + "</li>";
        }).join("") + "</ul></div>";
    }

    var aDiffuser = state.registre.filter(function (e) { return e.statut === "a_analyser" || e.statut === "en_cours" || e.statut === "ecart"; });
    if (aDiffuser.length) {
      html += '<div class="panel"><div class="panel-head"><h3>Points à diffuser aux services concernés</h3></div>' +
        '<div class="table-scroll"><table class="data"><thead><tr><th>Texte</th><th>Domaine</th><th>Action</th><th>Responsable</th><th>Échéance</th><th>Statut</th></tr></thead><tbody>' +
        aDiffuser.map(function (e) {
          var st = STATUTS[e.statut] || STATUTS.a_analyser;
          return "<tr><td><strong>" + esc(e.intitule) + "</strong>" + (e.ref ? '<br><span class="mono hint">' + esc(e.ref) + "</span>" : "") + "</td>" +
            "<td>" + esc(V.domaines[e.domaine] ? V.domaines[e.domaine].nom : e.domaine) + "</td>" +
            "<td>" + esc(e.action || "—") + "</td><td>" + esc(e.responsable || "—") + "</td>" +
            '<td class="num">' + fmtDate(e.echeance) + '</td><td><span class="badge ' + st.badge + '">' + esc(st.l) + "</span></td></tr>";
        }).join("") + "</tbody></table></div></div>";
    }

    html += '<div class="panel"><div class="panel-head"><h3>Sources de référence du plan</h3></div><ul class="synth-ul">' +
      per.map(function (p) {
        var dm = V.domaines[p.id];
        return "<li><strong>" + esc(dm.nom) + "</strong> — " + dm.sources.map(function (src) {
          return '<a href="' + esc(src.url) + '" target="_blank" rel="noopener">' + esc(src.nom) + "</a>";
        }).join(", ") + "</li>";
      }).join("") + "</ul></div>";

    html += '<div class="notice notice-warn"><strong>Portée de ce document</strong>' +
      "Cette synthèse est un cadre de travail construit à partir de la division NAF et des caractéristiques déclarées. " +
      "Elle ne constitue pas un conseil juridique et ne garantit pas l'exhaustivité : chaque texte doit être vérifié sur Légifrance " +
      "et l'analyse d'applicabilité validée par une personne compétente.</div>";

    box.innerHTML = html;
  }

  function dl(k, v) {
    return '<div class="synth-row"><dt class="mono">' + esc(k) + "</dt><dd>" + (v ? esc(v) : '<span class="hint">non renseigné</span>') + "</dd></div>";
  }

  /* ------------------------------------------------------------------- INIT */

  function init() {
    if (!V) return;
    synchronisePlan();
    initOnglets();
    initProfil();
    rendDeclencheurs();
    rendPerimetre();
    rendPlan();
    initRegistre();
    chargeFil(false).then(function () { dessineDirect(); majCompteurOnglet(); });
    var imprimer = $("#btn-imprimer");
    if (imprimer) imprimer.addEventListener("click", function () { ouvrir("synthese"); window.print(); });
    marqueSauvegarde(state.profil.division ? "Espace de travail restauré" : "Aucune donnée enregistrée pour l'instant");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
