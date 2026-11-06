/* ==========================================================================
   Vigie — l'abonnement consultant en ligne (compte/paiement-consultant.html)
   (6 novembre 2026)
   --------------------------------------------------------------------------
   Le consultant indique son nombre de clients ; le palier en découle (prix
   HT par client et par mois). Puis la page de paiement Stripe du palier,
   avec :
     client_reference_id = l'identifiant du cabinet (le robot
                           outils/stripe.mjs ouvre l'abonnement du cabinet) ;
     prefilled_email     = l'adresse du compte.
   Abonnement mensuel, sans engagement. Aucune donnée bancaire ne passe ici.
   ========================================================================== */
(function () {
  "use strict";
  var hote = document.getElementById("paiement-consultant");
  if (!hote) return;
  var D = JSON.parse(hote.getAttribute("data-paiement") || "{}");
  var V = window.VIGIE;
  var $ = function (s) { return document.querySelector(s); };
  var params = new URLSearchParams(window.location.search);

  if (params.get("merci")) {
    $("#pc-merci").hidden = false;
    $("#pc-formulaire").hidden = true;
    return;
  }

  var min = D.paliers[0].de, cabinet = null, courriel = "", adresseManque = false;
  var champ = $("#pc-clients");
  var depart = parseInt(params.get("clients"), 10);
  if (depart >= min && depart <= 500) champ.value = depart;

  function eur(n) { return n.toLocaleString("fr-FR", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }).replace(/ /g, " ") + " €"; }
  function ligne(dt, dd, fort) { return "<div" + (fort ? ' class="paie-ttc"' : "") + "><dt>" + dt + "</dt><dd>" + dd + "</dd></div>"; }
  function nombre() { var n = parseInt(champ.value, 10); return isNaN(n) ? 0 : n; }
  function palier(n) {
    for (var k = 0; k < D.paliers.length; k++) { var p = D.paliers[k]; if (n >= p.de && (!p.a || n <= p.a)) return k; }
    return -1;
  }

  function peindre() {
    var n = nombre(), k = palier(n), p = D.paliers[k];
    [].forEach.call(document.querySelectorAll("#pc-paliers li"), function (li) {
      li.classList.toggle("pc-actif", Number(li.getAttribute("data-palier")) === k);
    });
    if (!p) {
      $("#pc-total").innerHTML = ligne("Nombre de clients", "au moins " + min);
      bouton(); return;
    }
    var ht = p.mois * n;
    $("#pc-total").innerHTML = D.tva === "ht"
      ? ligne(n + " clients × " + eur(p.mois) + " HT", eur(ht) + " HT par mois") + ligne("TVA 20 %", eur(ht * 0.2)) +
        ligne("Total TTC", eur(ht * 1.2) + " TTC par mois", true)
      : ligne("Total", eur(ht) + " par mois", true) + '<div class="paie-mention"><dd>' + D.mention + "</dd></div>";
    // Le mois d'essai gratuit (6 novembre 2026) : rien aujourd'hui, premier prélèvement 30 jours après.
    if (D.essai) {
      var d = new Date(); d.setDate(d.getDate() + D.essai);
      $("#pc-total").innerHTML += ligne("À payer aujourd'hui", "0 € — 1<sup>er</sup> mois d'essai gratuit", true) +
        ligne("Premier prélèvement", "le " + d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) + ", sauf résiliation avant");
    }
    bouton();
  }

  function bouton() {
    var b = $("#pc-payer"), dit = $("#pc-dit");
    var k = palier(nombre()), lien = k >= 0 ? D.paliers[k].lien : "";
    var pret = !!(lien && cabinet && !adresseManque && $("#pc-cgv").checked);
    b.setAttribute("aria-disabled", pret ? "false" : "true");
    b.classList.toggle("bouton-inactif", !pret);
    if (k >= 0 && !lien) {
      b.href = "mailto:" + D.courriel + "?subject=" + encodeURIComponent("Ouvrir l'abonnement consultant" + (cabinet ? " — " + cabinet.nom : "")) +
        "&body=" + encodeURIComponent("Bonjour,\n\nPouvez-vous ouvrir l'abonnement consultant pour " + nombre() + " clients ?\n");
      b.textContent = "Nous écrire pour démarrer";
      b.setAttribute("aria-disabled", "false"); b.classList.remove("bouton-inactif");
      dit.textContent = "Le paiement en ligne de l'offre consultant ouvre très bientôt. En attendant, écrivez-nous : nous ouvrons votre abonnement à réception.";
      return;
    }
    b.textContent = "Continuer vers le paiement sécurisé";
    b.href = pret ? lien + (lien.indexOf("?") === -1 ? "?" : "&") + "client_reference_id=" + encodeURIComponent(cabinet.cabinet_id) +
      (courriel ? "&prefilled_email=" + encodeURIComponent(courriel) : "") : "#";
    dit.textContent = k < 0 ? "L'offre consultant commence à " + min + " clients."
      : !cabinet ? "" : adresseManque ? "Adresse obligatoire : renseignez l'adresse de votre cabinet avant de vous abonner."
      : !$("#pc-cgv").checked ? "Cochez l'acceptation des conditions générales de vente pour continuer." : "";
  }

  champ.addEventListener("input", peindre);
  $("#pc-cgv").addEventListener("change", bouton);
  $("#pc-payer").addEventListener("click", function (e) {
    if (this.getAttribute("aria-disabled") === "true") { e.preventDefault(); bouton(); }
  });
  peindre();

  /* Le cabinet abonné : il faut un compte et un cabinet dont on est responsable. */
  var compte = $("#pc-compte");
  var ici = "compte/paiement-consultant.html";
  function dire(html) { compte.innerHTML = html; bouton(); }
  if (!V || !V.ouvert) { dire('<p class="precision">Les comptes ne sont pas encore ouverts : écrivez-nous à <a href="mailto:' + D.courriel + '">' + D.courriel + "</a>.</p>"); return; }
  V.session().then(function (s) {
    if (!s) {
      dire("<p>L'abonnement se rattache à votre compte consultant et à votre cabinet.</p>" +
        '<p class="rangee" style="margin-top:var(--t3)"><a class="bouton bouton-sobre" href="../connexion.html?retour=' + encodeURIComponent(ici) + '">Me connecter</a>' +
        '<a class="bouton bouton-sobre" href="creer.html?type=cabinet">Créer mon compte consultant</a></p>');
      return;
    }
    courriel = (V.utilisateur() || {}).courriel || "";
    V.mesCabinets().then(function (r) {
      var liste = r.ok ? r.cabinets : [];
      cabinet = liste.filter(function (c) { return c.role === "admin"; })[0] || null;
      if (!cabinet) {
        dire(liste.length
          ? "<p>Seul le responsable du compte de votre cabinet peut l'abonner.</p>"
          : '<p>Créez d\'abord votre cabinet dans <a href="./">Mon compte</a> (« Un cabinet de conseil QSE »), puis revenez ici.</p>');
        return;
      }
      compte.textContent = "";
      var p = document.createElement("p"), b = document.createElement("strong");
      b.textContent = cabinet.nom || "Votre cabinet"; p.appendChild(b);
      var c = document.createElement("p"); c.className = "precision"; c.textContent = "Compte : " + courriel;
      compte.appendChild(p); compte.appendChild(c);
      // L'adresse est obligatoire (6 novembre 2026, migration 28).
      V.rpc("cabinet_adresse_lire", { c: cabinet.cabinet_id }).then(function (r) {
        var ad = (r.ok && r.donnees) || {};
        adresseManque = !(ad.ligne && ad.cp && ad.ville && ad.pays);
        var q = document.createElement("p");
        if (adresseManque) {
          q.className = "reserve";
          q.appendChild(document.createTextNode("Adresse obligatoire : indiquez l'adresse de votre cabinet (avec le pays) avant de vous abonner. "));
          var a = document.createElement("a"); a.href = "./#cab-adresse"; a.textContent = "Renseigner l'adresse";
          q.appendChild(a);
        } else {
          q.className = "precision";
          q.textContent = "Adresse : " + ad.ligne + ", " + ad.cp + " " + ad.ville + " (" + ad.pays + ")";
        }
        compte.appendChild(q);
        bouton();
      });
      if (cabinet.actif) {
        compte.insertAdjacentHTML("beforeend", '<p class="precision">Votre abonnement consultant est déjà ouvert.' +
          (D.portail ? ' Pour le gérer ou le résilier : <a href="' + D.portail + '">gérer mon abonnement</a>.' : "") + "</p>");
      }
      bouton();
    });
  });
})();
