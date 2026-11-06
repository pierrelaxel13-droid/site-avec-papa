/* ==========================================================================
   Vigie — la page de paiement (compte/paiement.html?formule=…&periode=…)
   --------------------------------------------------------------------------
   Récapitulatif, moyens de paiement, entreprise abonnée, CGV ; puis la page
   de paiement Stripe (lien de paiement de contenu/paiement.js), avec :
     client_reference_id = l'identifiant de l'entreprise (pour que le robot
                           outils/stripe.mjs ouvre la bonne formule) ;
     prefilled_email     = l'adresse du compte.
   Sans lien de paiement rempli, la page le dit et propose d'écrire.
   Aucune donnée bancaire ne passe ici.
   ========================================================================== */
(function () {
  "use strict";
  var hote = document.getElementById("paiement");
  if (!hote) return;
  var D = JSON.parse(hote.getAttribute("data-paiement") || "{}");
  var V = window.VIGIE;
  var $ = function (s) { return document.querySelector(s); };
  var params = new URLSearchParams(window.location.search);

  if (params.get("merci")) {
    $("#paie-merci").hidden = false;
    $("#paie-formulaire").hidden = true;
    try { window.localStorage.removeItem("pco-souscrire"); } catch (e) { /* sans effet */ }
    // Retour du paiement par la fonction serveur : la formule s'ouvre tout de suite (6 novembre 2026).
    if (params.get("session") && V && V.fonction) {
      var m = document.createElement("p"); m.className = "precision"; m.textContent = "Ouverture de votre abonnement…";
      $("#paie-merci").appendChild(m);
      var essai = function (n) {
        V.fonction("confirmer", { session: params.get("session") }).then(function (r) {
          if (r.ok && r.donnees.ouvert) { m.textContent = "C'est fait : votre abonnement est ouvert. Vous pouvez accéder à votre espace dès maintenant."; return; }
          if (n < 3 && r.ok) { setTimeout(function () { essai(n + 1); }, 3000); return; }
          m.textContent = "Votre abonnement s'ouvre dans les minutes qui viennent.";
        });
      };
      essai(0);
    }
    return;
  }

  var formule = D.formules[params.get("formule")] ? params.get("formule") : "complet";
  var periode = params.get("periode") === "mois" ? "mois" : "an";
  var F = D.formules[formule];
  var entreprise = null, courriel = "", adresseManque = false, dejaAbonne = false;
  // Pour revenir ici après la création du compte (Mon compte → « Choisir ma formule »).
  try { window.localStorage.setItem("pco-souscrire", JSON.stringify({ formule: formule, periode: periode })); } catch (e) { /* sans effet */ }

  function eur(n) { return n.toLocaleString("fr-FR", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }).replace(/ /g, " ") + " €"; }
  function ligne(dt, dd, fort) {
    return "<div" + (fort ? ' class="paie-ttc"' : "") + "><dt>" + dt + "</dt><dd>" + dd + "</dd></div>";
  }

  function peindre() {
    $("#paie-offre").textContent = F.l;
    $("#paie-formule").value = formule;
    // Chaque choix dit son prix HT et TTC (TVA à 20 %).
    var ttc = function (n) { return D.tva === "ht" ? " · " + eur(n * 1.2) + " TTC" : ""; };
    $("#paie-prix-an").textContent = F.an + " par an" + ttc(F.montantAn);
    $("#paie-prix-mois").textContent = F.mois + " par mois" + ttc(F.montantMois);
    [].forEach.call(document.querySelectorAll('input[name="paie-periode"]'), function (r) { r.checked = r.value === periode; });
    var montant = periode === "an" ? F.montantAn : F.montantMois;
    var par = periode === "an" ? " par an" : " par mois";
    $("#paie-total").innerHTML = D.tva === "ht"
      ? ligne("Prix HT", eur(montant) + " HT" + par) + ligne("Total TTC", eur(montant * 1.2) + " TTC" + par, true) + ligne("dont TVA 20 %", eur(montant * 0.2))
      : ligne("Total", eur(montant) + par, true) + '<div class="paie-mention"><dd>' + D.mention + "</dd></div>";
    // Le mois d'essai gratuit (6 novembre 2026) : rien aujourd'hui, premier prélèvement 30 jours après.
    if (D.essai) {
      var d = new Date(); d.setDate(d.getDate() + D.essai);
      $("#paie-total").innerHTML += ligne("À payer aujourd'hui", "0 € — 1<sup>er</sup> mois d'essai gratuit", true) +
        ligne("Premier prélèvement", "le " + d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) +
          ", sauf résiliation avant");
    }
    var u = new URL(window.location.href);
    u.searchParams.set("formule", formule); u.searchParams.set("periode", periode);
    window.history.replaceState(null, "", u.pathname + u.search);
    bouton();
  }

  function bouton() {
    var b = $("#paie-payer"), dit = $("#paie-dit");
    var lien = (D.liens[formule] || {})[periode] || "";
    var pret = !!(lien && entreprise && !adresseManque && $("#paie-cgv").checked);
    b.setAttribute("aria-disabled", pret ? "false" : "true");
    b.classList.toggle("bouton-inactif", !pret);
    if (!lien) {
      b.href = "mailto:" + D.courriel + "?subject=" + encodeURIComponent("Démarrer un abonnement — " + F.court + (periode === "an" ? ", à l'année" : ", au mois"));
      b.textContent = "Nous écrire pour démarrer";
      b.setAttribute("aria-disabled", "false"); b.classList.remove("bouton-inactif");
      dit.textContent = "Le paiement en ligne ouvre très bientôt. En attendant, écrivez-nous : nous ouvrons votre abonnement à réception.";
      return;
    }
    b.textContent = dejaAbonne ? "Passer à cette formule" : "Continuer vers le paiement sécurisé";
    b.href = pret ? lien + (lien.indexOf("?") === -1 ? "?" : "&") + "client_reference_id=" + encodeURIComponent(entreprise.entreprise_id) +
      (courriel ? "&prefilled_email=" + encodeURIComponent(courriel) : "") +
      (promo ? "&prefilled_promo_code=" + encodeURIComponent(promo) : "") : "#";
    dit.textContent = !entreprise ? "" : adresseManque ? "Adresse obligatoire : renseignez l'adresse de votre entreprise avant de vous abonner."
      : !$("#paie-cgv").checked ? "Cochez l'acceptation des conditions générales de vente pour continuer." : "";
  }

  /* Le code promo (4 novembre 2026) : il part vers la page de paiement
     Stripe (prefilled_promo_code), qui le vérifie et affiche la réduction
     avant toute validation. Les codes se créent dans Stripe (Produits →
     Coupons → Codes promotionnels) : réduction sur la première échéance, sur
     quelques mois ou sur toute la durée de l'abonnement. */
  var promo = (params.get("code") || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 40);
  function direPromo() {
    $("#paie-promo-dit").textContent = promo
      ? "Code « " + promo + " » retenu : la réduction s'affiche sur la page de paiement sécurisée, avant que vous validiez."
      : "";
  }
  if (promo) $("#paie-code").value = promo;
  direPromo();
  $("#paie-promo").addEventListener("submit", function (e) {
    e.preventDefault();
    var v = $("#paie-code").value.trim().toUpperCase();
    if (v && !/^[A-Z0-9_-]{2,40}$/.test(v)) {
      $("#paie-promo-dit").textContent = "Un code promo ne contient que des lettres, des chiffres, des tirets ou des traits bas.";
      return;
    }
    promo = v; $("#paie-code").value = v;
    direPromo(); bouton();
  });

  [].forEach.call(document.querySelectorAll('input[name="paie-periode"]'), function (r) {
    r.addEventListener("change", function () { periode = r.value; peindre(); });
  });
  // Le choix de la formule (6 novembre 2026) : les trois, dans un menu déroulant.
  $("#paie-formule").addEventListener("change", function () {
    if (!D.formules[this.value]) return;
    formule = this.value; F = D.formules[formule];
    try { window.localStorage.setItem("pco-souscrire", JSON.stringify({ formule: formule, periode: periode })); } catch (e) { /* sans effet */ }
    peindre();
  });
  $("#paie-cgv").addEventListener("change", bouton);
  $("#paie-payer").addEventListener("click", function (e) {
    if (this.getAttribute("aria-disabled") === "true") { e.preventDefault(); bouton(); return; }
    // Le paiement par la fonction serveur (6 novembre 2026) : la page Stripe s'ouvre avec l'adresse
    // déjà connue, donc la TVA affichée dès le début. Si la fonction ne répond pas : le lien de paiement.
    var b = this, lien = b.getAttribute("href") || "";
    if (!entreprise || !V || !V.fonction || !/^https:/.test(lien)) return;
    e.preventDefault();
    if (b.getAttribute("data-attente")) return;
    b.setAttribute("data-attente", "1"); b.textContent = "Ouverture du paiement sécurisé…";
    V.fonction("paiement", { entreprise: entreprise.entreprise_id, formule: formule, periode: periode, code: promo }).then(function (r) {
      b.removeAttribute("data-attente");
      if (r.ok && r.donnees && r.donnees.url) { window.location.href = r.donnees.url; return; }
      if (r.ok && r.donnees && r.donnees.changement) { changerFormule(b, r.donnees); return; }
      if (r.absente) { window.location.href = lien; return; }
      bouton(); $("#paie-dit").textContent = r.erreur;
    });
  });

  /* Déjà abonné (6 novembre 2026) : on change la formule de l'abonnement en cours, chez Stripe,
     au lieu d'en ouvrir un second. Pendant le mois d'essai, rien n'est facturé ; ensuite, la
     différence est facturée ou créditée au prorata. */
  function changerFormule(b, actuel) {
    var dit = $("#paie-dit"), nom = function (f) { return (D.formules[f] || {}).l || f; };
    var essai = actuel.statut === "trialing";
    var q = "Vous avez déjà l'abonnement « " + nom(actuel.formule) + " » (" + (actuel.periode === "an" ? "annuel" : "mensuel") + ").\n\n" +
      "Le remplacer par « " + F.l + " » (" + (periode === "an" ? "annuel" : "mensuel") + ") ?\n\n" +
      (essai ? "Vous êtes dans votre mois d'essai gratuit : rien n'est facturé aujourd'hui ; le nouveau prix s'applique à la fin de l'essai."
             : "La différence de prix est calculée au prorata et facturée (ou déduite) tout de suite.");
    bouton();
    if (!window.confirm(q)) { dit.textContent = "Rien n'a changé : vous gardez votre abonnement actuel."; return; }
    b.setAttribute("data-attente", "1"); b.textContent = "Changement en cours…";
    V.fonction("changer", { entreprise: entreprise.entreprise_id, formule: formule, periode: periode }).then(function (r) {
      b.removeAttribute("data-attente"); bouton();
      if (!r.ok) { dit.textContent = r.erreur; return; }
      dit.textContent = "";
      var m = document.createElement("p"); m.className = "reserve";
      m.appendChild(document.createTextNode("C'est fait : votre abonnement est maintenant « " + F.l + " » (" + (periode === "an" ? "annuel" : "mensuel") + "). "));
      var a2 = document.createElement("a"); a2.href = "./"; a2.textContent = "Voir Mon compte"; m.appendChild(a2);
      dit.appendChild(m);
    });
  }

  /* L'entreprise abonnée : il faut un compte et une entreprise nommée. */
  var compte = $("#paie-compte");
  var ici = "compte/paiement.html?formule=" + formule + "&periode=" + periode;
  function dire(html) { compte.innerHTML = html; bouton(); }
  peindre();
  if (!V || !V.ouvert) { dire('<p class="precision">Les comptes ne sont pas encore ouverts : écrivez-nous à <a href="mailto:' + D.courriel + '">' + D.courriel + "</a>.</p>"); return; }
  V.session().then(function (s) {
    if (!s) {
      dire("<p>L'abonnement se rattache à votre compte et à votre entreprise.</p>" +
        '<p class="rangee" style="margin-top:var(--t3)"><a class="bouton bouton-sobre" href="../connexion.html?retour=' + encodeURIComponent(ici) + '">Me connecter</a>' +
        '<a class="bouton bouton-sobre" href="creer.html">Créer mon compte</a></p>');
      return;
    }
    courriel = (V.utilisateur() || {}).courriel || "";
    V.mesEntreprises().then(function (m) {
      var liste = m.ok ? m.entreprises : [];
      entreprise = liste.filter(function (e) { return e.role === "admin"; })[0] || null;
      if (!entreprise) {
        dire(liste.length
          ? "<p>Seul le responsable du compte de votre entreprise peut l'abonner.</p>"
          : '<p>Nommez d\'abord votre entreprise dans <a href="./">Mon compte</a>, puis revenez ici.</p>');
        return;
      }
      var actuelle = ["", "textes", "suivi", "complet"][Number(entreprise.rang) || 0] || "";
      dejaAbonne = !!actuelle;
      var deja = actuelle ? "<p class=\"precision\">Formule actuelle : « " + D.formules[actuelle].l +
        " ». Pour en changer, choisissez la formule ci-dessus puis « Passer à cette formule ».</p>" : "";
      var p = document.createElement("p");
      var b = document.createElement("strong"); b.textContent = entreprise.denomination || "Votre entreprise";
      p.appendChild(b);
      var c = document.createElement("p"); c.className = "precision"; c.textContent = "Compte : " + courriel;
      compte.textContent = "";
      compte.appendChild(p); compte.appendChild(c);
      if (deja) compte.insertAdjacentHTML("beforeend", deja);
      // L'adresse est obligatoire (6 novembre 2026) : factures et TVA au paiement.
      V.rpc("espace_lire", { e: entreprise.entreprise_id }).then(function (r) {
        var ad = (r.ok && r.donnees && r.donnees.entreprise && (r.donnees.entreprise.reglages || {}).adresse) || {};
        adresseManque = !(ad.ligne && ad.cp && ad.ville && ad.pays);
        if (adresseManque) {
          var q = document.createElement("p"); q.className = "reserve";
          q.appendChild(document.createTextNode("Adresse obligatoire : indiquez l'adresse de votre entreprise (avec le pays) avant de vous abonner. "));
          var a = document.createElement("a"); a.href = "./#ent-adresse"; a.textContent = "Renseigner l'adresse";
          q.appendChild(a); compte.appendChild(q);
        } else {
          var c2 = document.createElement("p"); c2.className = "precision";
          c2.textContent = "Adresse : " + ad.ligne + ", " + ad.cp + " " + ad.ville + " (" + ad.pays + ")";
          compte.appendChild(c2);
        }
        bouton();
      });
      bouton();
    });
  });
})();
