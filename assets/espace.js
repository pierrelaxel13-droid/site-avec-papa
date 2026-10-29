/* ==========================================================================
   Vigie — l'espace d'un vrai compte : ce qui remplace le jeu d'essai
   --------------------------------------------------------------------------
   Dans un compte (/app/), tout ce qui vient du jeu d'essai porte data-demo et
   est caché (site.css, .espace-compte). Ce fichier montre le vrai à la place :
   - le tableau de bord : les revues à faire, les prochaines, les dernières
     traces du registre ;
   - le registre : toutes les entrées, et la vérification de leur chaîne ;
   - les dates de revue des cartes du plan ;
   - sans code APE : une phrase qui dit quoi faire, au lieu d'un plan inventé ;
   - une seule fois : reprendre les réglages faits dans ce navigateur avant
     le compte.
   Rien n'est inventé : sans donnée, une phrase le dit.
   ========================================================================== */
(function () {
  "use strict";
  var M = window.MAGASIN, V = window.VIGIE;
  if (!M || M.mode !== "compte") return;

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var JOURS = { quotidienne: 1, hebdomadaire: 7, mensuelle: 31, trimestrielle: 92 };
  var GENRES = { revue: "Revue", qualification: "Qualification", decision: "Décision",
                 action: "Action", plan: "Plan de veille", correction: "Correction" };

  function echappe(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function jour(iso) {
    if (!iso) return "";
    var d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso + "T12:00:00") : new Date(iso);
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  }
  function heure(iso) {
    return new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }
  function plus(iso, jours) {
    var d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + jours);
    return d.toISOString().slice(0, 10);
  }
  function rubrique(titre, contenu, teinte) {
    return '<section class="rubrique' + (teinte ? " section-tein" : "") + '"><div class="enveloppe"><h2>' +
      echappe(titre) + "</h2>" + contenu + "</div></section>";
  }

  /* L'état de chaque revue du plan : jamais faite, en retard, ou à jour. */
  function etatDuPlan() {
    var garde = M.lire("pco-entreprise") || {};
    var P = window.PLAN, E = window.PCO_ENTREPRISE;
    if (!garde.naf || !P || !E || !E.perimetre) return null;
    var vue = E.perimetre(garde.naf, garde.contexte || []);
    if (!vue) return null;
    var faits = M.lire("pco-faits") || {};
    var auj = new Date().toISOString().slice(0, 10);
    return vue.liste.map(function (id) {
      var d = P.d[id], periode = JOURS[d.f] || 31, le = faits["plan:" + id];
      var prochaine = le ? plus(le, periode) : null;
      return { id: id, nom: d.n, frequence: d.f, le: le, prochaine: prochaine,
               aFaire: !le || prochaine <= auj };
    });
  }

  /* Les entrées du registre, des plus récentes aux plus anciennes. */
  function registre(limite) {
    return V.lire("registre", "select=id,genre,objet,detail,statut,date_effet,echeance,corrige_id,enregistre_le,auteur_nom" +
      "&entreprise_id=eq." + M.espace.id + "&order=id.desc" + (limite ? "&limit=" + limite : ""));
  }
  function ligne(r, annulees) {
    var annulee = annulees[r.id];
    return '<li class="ligne-registre' + (annulee ? " clos" : "") + '"><details><summary>' +
      '<span class="mono date">' + echappe(jour(r.date_effet)) + "</span>" +
      '<span class="corps"><span class="titre">' + echappe(r.objet) + "</span>" +
      (r.detail ? '<span class="quoi">' + echappe(r.detail) + "</span>" : "") +
      '<span class="meta etiq">' + echappe(GENRES[r.genre] || r.genre) + " · " + echappe(r.auteur_nom || "") +
      (annulee ? " · annulée le " + echappe(jour(annulee)) : "") + "</span></span>" +
      '<svg class="chevron" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>' +
      '</summary><div class="detail"><dl class="detail-champs">' +
      "<div><dt class=\"etiq\">Nature</dt><dd>" + echappe(GENRES[r.genre] || r.genre) + "</dd></div>" +
      "<div><dt class=\"etiq\">Date</dt><dd>" + echappe(jour(r.date_effet)) + "</dd></div>" +
      "<div><dt class=\"etiq\">Par</dt><dd>" + echappe(r.auteur_nom || "—") + "</dd></div>" +
      "<div><dt class=\"etiq\">Inscrite le</dt><dd>" + echappe(heure(r.enregistre_le)) + "</dd></div>" +
      "<div><dt class=\"etiq\">N°</dt><dd>" + echappe(r.id) + "</dd></div>" +
      '</dl><p class="note-source">Une ligne du registre ne se modifie pas après coup : une ' +
      "correction s'ajoute à la suite, avec sa propre date, et celle-ci reste.</p></div></details></li>";
  }
  function annuleesDans(liste) {
    var a = {};
    liste.forEach(function (r) { if (r.genre === "correction" && r.corrige_id) a[r.corrige_id] = r.date_effet; });
    return a;
  }

  /* --- Le tableau de bord ---------------------------------------------------- */
  function tableauDeBord(hote) {
    var plan = etatDuPlan();
    if (!plan) {
      hote.innerHTML = rubrique("Pour commencer",
        '<p class="lecture">Votre tableau de bord se remplit à partir de votre plan de veille, et votre plan se fait ' +
        "à partir de votre code APE et de quelques questions sur votre situation.</p>" +
        '<p class="rangee" style="margin-top:var(--t4)"><a class="bouton bouton-accent" href="reglages.html">Renseigner mon entreprise</a></p>');
      return;
    }
    var aFaire = plan.filter(function (x) { return x.aFaire; });
    var aJour = plan.length - aFaire.length;
    var suivantes = plan.filter(function (x) { return !x.aFaire; })
      .sort(function (a, b) { return a.prochaine < b.prochaine ? -1 : 1; }).slice(0, 6);
    var html = rubrique("Où vous en êtes",
      '<dl class="compteurs compteurs-liens">' +
      "<div" + (aFaire.length ? ' class="alerte"' : "") + '><dt class="etiq">Revues à faire</dt><dd><span class="grand">' +
        aFaire.length + '</span><a class="lien-carte" href="plan.html"><span class="cache-visuellement">Voir le plan de veille</span></a></dd></div>' +
      '<div><dt class="etiq">Revues à jour</dt><dd><span class="grand">' + aJour + "</span>" +
        '<span class="precision">sur ' + plan.length + ' domaines suivis</span><a class="lien-carte" href="plan.html"><span class="cache-visuellement">Voir le plan de veille</span></a></dd></div>' +
      '<div><dt class="etiq">Entrées au registre</dt><dd><span class="grand" id="bord-n-registre">…</span>' +
        '<a class="lien-carte" href="registre.html"><span class="cache-visuellement">Voir le registre</span></a></dd></div>' +
      "</dl>");
    if (aFaire.length) {
      html += rubrique("À faire maintenant",
        '<p class="lecture">Les revues jamais faites, ou dont le rythme est dépassé. Cochez-les dans votre plan : ' +
        "chacune s'inscrit, datée, dans votre registre.</p>" +
        '<ul class="liste-echeances" style="margin-top:var(--t4)">' + aFaire.slice(0, 8).map(function (x) {
          return '<li class="retard"><a href="plan.html#domaine-' + echappe(x.id) + '"><span class="etiq">' + echappe(x.nom) +
            '</span><span class="mono">' + (x.le ? "dernière le " + echappe(jour(x.le)) : "jamais faite") + "</span></a></li>";
        }).join("") + "</ul>" +
        (aFaire.length > 8 ? '<p style="margin-top:var(--t4)"><a class="lien-fleche" href="plan.html">Et ' + (aFaire.length - 8) +
          " autre" + (aFaire.length - 8 > 1 ? "s" : "") + " dans votre plan</a></p>" : ""));
    }
    if (suivantes.length) {
      html += rubrique("Prochaines revues", '<ul class="liste-echeances">' + suivantes.map(function (x) {
        return '<li><a href="plan.html#domaine-' + echappe(x.id) + '"><span class="etiq">' + echappe(x.nom) +
          '</span><span class="mono">' + echappe(jour(x.prochaine)) + "</span></a></li>";
      }).join("") + "</ul>", true);
    }
    html += '<div id="bord-traces"></div>';
    hote.innerHTML = html;

    registre(6).then(function (r) {
      var n = $("#bord-n-registre");
      if (!r.ok) { if (n) n.textContent = "—"; return; }
      var l = r.donnees || [];
      $("#bord-traces").innerHTML = rubrique("Dernières traces", l.length
        ? '<ul class="liste-registre">' + l.map(function (x) { return ligne(x, annuleesDans(l)); }).join("") + "</ul>" +
          '<p style="margin-top:var(--t4)"><a class="lien-fleche" href="registre.html">Voir tout le registre</a></p>'
        : '<p class="lecture">Rien encore. Chaque revue cochée « Faite » dans votre plan s\'inscrira ici, datée, avec votre nom.</p>');
      V.lire("registre", "select=id&entreprise_id=eq." + M.espace.id).then(function (t) {
        if (n) n.textContent = t.ok ? String((t.donnees || []).length) : "—";
      });
    });
  }

  /* --- Le registre ------------------------------------------------------------ */
  function pageRegistre(hote) {
    hote.innerHTML = rubrique("Votre registre", '<p class="lecture" id="registre-etat">Chargement…</p>');
    registre().then(function (r) {
      if (!r.ok) { $("#registre-etat").textContent = r.erreur; return; }
      var l = r.donnees || [];
      if (!l.length) {
        $("#registre-etat").textContent = "Votre registre est vide pour l'instant. Il se remplit tout seul : chaque revue " +
          "cochée « Faite » dans votre plan, et chaque changement de vos réglages, s'y inscrit, daté, avec son auteur.";
        return;
      }
      var a = annuleesDans(l);
      hote.innerHTML = rubrique("Votre registre",
        '<p class="lecture">De la plus récente à la plus ancienne, sans trou. Une ligne ne se modifie pas après coup : une correction ' +
        "s'ajoute, elle ne remplace pas. " + l.length + " entrée" + (l.length > 1 ? "s" : "") + ".</p>" +
        '<p class="reserve" id="registre-chaine" style="margin-top:var(--t4)">Vérification de la chaîne…</p>' +
        '<ul class="liste-registre" style="margin-top:var(--t4)">' + l.map(function (x) { return ligne(x, a); }).join("") + "</ul>" +
        '<p class="rangee" style="margin-top:var(--t5)"><button type="button" class="bouton bouton-sobre" data-imprimer>Imprimer le registre</button></p>');
      V.rpc("verifier_registre", { e: M.espace.id }).then(function (v) {
        var p = $("#registre-chaine"), x = v.ok && v.donnees && v.donnees[0];
        if (!x) { p.textContent = "La vérification n'a pas pu se faire : " + (v.erreur || "réponse vide") + "."; return; }
        if (x.intact) {
          p.classList.add("reserve-ok");
          p.textContent = "Registre intact : ses " + x.entrees + " entrées forment une chaîne d'empreintes complète. " +
            "Empreinte de la dernière : " + String(x.derniere_empreinte || "").slice(0, 16) + "…";
        } else {
          p.textContent = "Attention : la chaîne d'empreintes est rompue à l'entrée n° " + x.rompue_a +
            ". Une ligne a été modifiée en dehors de Vigie. Écrivez-nous.";
        }
      });
    });
  }

  /* --- Le plan : les vraies dates de revue, par rythme --------------------------- */
  function datesDuPlan() {
    var plan = etatDuPlan();
    if (!plan) return;
    $$("[data-prochaine]").forEach(function (el) {
      var f = el.getAttribute("data-prochaine");
      var groupe = plan.filter(function (x) { return x.frequence === f; });
      if (!groupe.length) { el.textContent = ""; return; }
      var aFaire = groupe.filter(function (x) { return x.aFaire; }).length;
      var suivante = groupe.map(function (x) { return x.prochaine; }).sort()[0];
      el.textContent = aFaire ? aFaire + " revue" + (aFaire > 1 ? "s" : "") + " à faire maintenant"
        : "Prochaine revue : " + jour(suivante);
    });
  }

  /* Sans code APE, pas de plan : on le dit, au lieu de montrer celui du jeu d'essai. */
  function sansCodeApe() {
    var garde = M.lire("pco-entreprise") || {};
    var chez = $("#plan-chez");
    if (chez && garde.nom) chez.textContent = garde.nom;
    var resp = $("#plan-responsable");
    if (resp && !garde.responsable) resp.textContent = "à compléter";
    if (garde.naf || !$("#plan-total")) return;
    $$("main > section").forEach(function (s) {
      if (!s.classList.contains("tete-app") && s.id !== "verrou") s.hidden = true;
    });
    var tete = $("main .tete-app");
    if (!tete) return;
    tete.insertAdjacentHTML("afterend", rubrique("Votre plan n'est pas encore fait",
      '<p class="lecture">Il se fait à partir de votre code APE et de quelques questions sur votre situation : ' +
      "deux minutes, dans Réglages.</p>" +
      '<p class="rangee" style="margin-top:var(--t4)"><a class="bouton bouton-accent" href="reglages.html">Renseigner mon entreprise</a></p>'));
  }

  /* Des réglages faits dans ce navigateur avant le compte : les reprendre, une fois. */
  function reprise() {
    var garde = M.lire("pco-entreprise") || {};
    var ancien = null;
    try { ancien = JSON.parse(window.localStorage.getItem("pco-entreprise")); } catch (e) { ancien = null; }
    if (garde.naf || !ancien || !ancien.naf || !M.espace || M.espace.role !== "admin") return;
    var main = $("main");
    if (!main) return;
    var boite = document.createElement("div");
    boite.className = "enveloppe";
    boite.innerHTML = '<p class="reserve" style="margin-top:var(--t4)"><strong>Ce navigateur a gardé des réglages faits avant votre compte</strong>' +
      (ancien.nom ? "« " + echappe(ancien.nom) + " », " : "") + "code APE " + echappe(ancien.naf) +
      (ancien.contexte && ancien.contexte.length ? ", " + ancien.contexte.length + " situation" + (ancien.contexte.length > 1 ? "s" : "") + " cochée" + (ancien.contexte.length > 1 ? "s" : "") : "") +
      '. Voulez-vous les reprendre dans votre compte ?<span class="rangee" style="margin-top:var(--t3)">' +
      '<button type="button" class="bouton bouton-accent" id="reprise-oui">Les reprendre</button>' +
      '<button type="button" class="bouton bouton-sobre" id="reprise-non">Non merci</button></span>' +
      '<span class="etat-compte" id="reprise-etat" role="status"></span></p>';
    main.insertBefore(boite, main.firstChild);
    var oublier = function () { try { window.localStorage.removeItem("pco-entreprise"); } catch (e) { /* rien */ } };
    $("#reprise-non").addEventListener("click", function () { oublier(); boite.remove(); });
    $("#reprise-oui").addEventListener("click", function () {
      $("#reprise-etat").textContent = "Enregistrement…";
      M.ecrire("pco-entreprise", ancien).then(function (r) {
        if (!r.ok) { $("#reprise-etat").textContent = r.erreur; return; }
        oublier();
        window.location.reload();
      });
    });
  }

  M.quandPret(function () {
    $$("[data-compte]").forEach(function (el) { el.hidden = false; });
    reprise();
    sansCodeApe();
    datesDuPlan();
    window.addEventListener("pco-plan", datesDuPlan);
    window.addEventListener("pco-faits", datesDuPlan);
    var bord = $("#bord-compte");
    if (bord) tableauDeBord(bord);
    var reg = $("#registre-compte");
    if (reg) pageRegistre(reg);
  });
})();
