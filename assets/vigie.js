/* ==========================================================================
   Vigie — la connexion à Supabase (comptes et base de données)
   --------------------------------------------------------------------------
   Sans bibliothèque : quelques appels fetch vers deux services de Supabase,
     /auth/v1/…  les comptes (adresse, mot de passe, liens reçus par courriel)
     /rest/v1/…  la base, dont les règles (RLS) disent qui voit quoi.

   L'adresse du projet et la clé PUBLIQUE viennent de SITE.supabase
   (build.mjs), posées sur <body> : data-supabase, data-supabase-cle. La clé
   publique est faite pour être vue ; ce qui protège les données, ce sont les
   règles de la base. La clé SECRÈTE n'est jamais dans le site.

   La session (le jeton de connexion) est gardée dans le stockage local du
   navigateur, sous « vigie-session ». Le mot de passe, lui, ne fait que
   passer : il part à Supabase en HTTPS et n'est gardé nulle part ici.

   Tout passe par window.VIGIE (voir en bas). Chaque fonction rend une
   promesse ; une erreur rend { erreur: "phrase en français", code }.
   ========================================================================== */
(function () {
  "use strict";
  var corps = document.body;
  var BASE = (corps.getAttribute("data-supabase") || "").replace(/\/+$/, "");
  var CLE = corps.getAttribute("data-supabase-cle") || "";
  var racine = corps.getAttribute("data-racine") || "./";
  var courriel = corps.getAttribute("data-courriel") || "";
  var RANGEMENT = "vigie-session";

  /* L'adresse complète d'une page du site : c'est là que mènent les liens
     envoyés par courriel (confirmation, mot de passe oublié). */
  function pageDuSite(chemin) { return new URL(racine + chemin, window.location.href).href; }
  var ARRIVEE = pageDuSite("compte/");

  /* --- La session, dans le navigateur ---------------------------------------- */
  function lire() {
    try { var s = JSON.parse(window.localStorage.getItem(RANGEMENT)); return s && s.jeton ? s : null; }
    catch (e) { return null; }
  }
  function garder(s) { try { window.localStorage.setItem(RANGEMENT, JSON.stringify(s)); } catch (e) { /* stockage refusé */ } }
  function oublier() { try { window.localStorage.removeItem(RANGEMENT); } catch (e) { /* rien à faire */ } }

  function maintenant() { return Math.floor(Date.now() / 1000); }
  function sessionDepuis(j, utilisateur) {
    var u = utilisateur || j.user || {};
    return {
      jeton: j.access_token,
      renouvellement: j.refresh_token,
      expire: Number(j.expires_at) || maintenant() + (Number(j.expires_in) || 3600),
      utilisateur: { id: u.id || "", courriel: u.email || "" }
    };
  }

  /* --- Les messages, en français ------------------------------------------- */
  var MESSAGES = {
    invalid_credentials: "Adresse ou mot de passe incorrect.",
    invalid_grant: "Adresse ou mot de passe incorrect.",
    email_not_confirmed: "Votre adresse n'est pas encore confirmée : cliquez sur le lien reçu par courriel.",
    user_already_exists: "Cette adresse a déjà un compte : connectez-vous.",
    email_exists: "Cette adresse a déjà un compte.",
    weak_password: "Ce mot de passe est trop faible : prenez-en un plus long (au moins 10 caractères).",
    same_password: "C'est déjà votre mot de passe actuel : choisissez-en un autre.",
    over_email_send_rate_limit: "Trop de courriels envoyés en peu de temps. Réessayez dans une heure.",
    over_request_rate_limit: "Trop d'essais en peu de temps. Patientez quelques minutes.",
    email_address_invalid: "Cette adresse électronique n'est pas valide.",
    validation_failed: "Vérifiez l'adresse et le mot de passe.",
    email_address_not_authorized: "Les courriels de " + (corps.getAttribute("data-nom") || "Vigie") +
      " ne partent pas encore vers cette adresse : le service d'envoi n'est pas encore branché. Écrivez-nous à " + courriel + ".",
    signup_disabled: "La création de compte est fermée pour l'instant.",
    otp_expired: "Ce lien a expiré ou a déjà servi. Demandez-en un nouveau.",
    reauthentication_needed: "Pour cela, reconnectez-vous d'abord.",
    session_not_found: "Votre session a expiré : reconnectez-vous.",
    refresh_token_not_found: "Votre session a expiré : reconnectez-vous.",
    bad_jwt: "Votre session a expiré : reconnectez-vous.",
    hors_ligne: "Le service de comptes ne répond pas. Vérifiez votre connexion et réessayez.",
    ferme: "Les comptes ne sont pas encore ouverts."
  };
  function erreur(rep) {
    var j = rep.j || {};
    var code = j.error_code || (rep.statut === 429 ? "over_request_rate_limit" : "") || j.error || j.code || "";
    if (rep.statut === 0) code = "hors_ligne";
    var texte = MESSAGES[code] || "La demande n'a pas abouti" +
      (j.msg || j.error_description || j.message ? " (" + (j.msg || j.error_description || j.message) + ")." : ".");
    return { erreur: texte, code: code || "inconnu" };
  }

  /* --- Un appel à Supabase ---------------------------------------------------
     La clé publique va dans « apikey » ; le jeton de la personne connectée,
     s'il y en a un, dans « Authorization ». */
  function appel(chemin, o) {
    o = o || {};
    if (!BASE) return Promise.resolve({ ok: false, statut: -1, j: { error_code: "ferme" } });
    var entetes = { apikey: CLE, "Content-Type": "application/json" };
    if (o.jeton) entetes.Authorization = "Bearer " + o.jeton;
    return fetch(BASE + chemin, {
      method: o.methode || (o.corps ? "POST" : "GET"),
      headers: entetes,
      body: o.corps ? JSON.stringify(o.corps) : undefined
    }).then(function (r) {
      return r.text().then(function (t) {
        var j = {};
        try { j = t ? JSON.parse(t) : {}; } catch (e) { j = {}; }
        return { ok: r.ok, statut: r.status, j: j };
      });
    }, function () { return { ok: false, statut: 0, j: {} }; });
  }
  var versArrivee = "?redirect_to=" + encodeURIComponent(ARRIVEE);

  /* La session en cours, renouvelée si son jeton (valable une heure) arrive
     à expiration. null : personne n'est connecté. */
  var renouvellement = null;
  function session() {
    var s = lire();
    if (!s) return Promise.resolve(null);
    if (s.expire - 60 > maintenant()) return Promise.resolve(s);
    if (renouvellement) return renouvellement;
    renouvellement = appel("/auth/v1/token?grant_type=refresh_token", { corps: { refresh_token: s.renouvellement } })
      .then(function (r) {
        renouvellement = null;
        if (r.ok && r.j.access_token) { var n = sessionDepuis(r.j); garder(n); return n; }
        if (r.statut === 0) return s;          // hors ligne : on ne déconnecte pas pour si peu
        oublier(); return null;
      });
    return renouvellement;
  }

  /* --- Les comptes --------------------------------------------------------- */
  function connecter(adresse, motdepasse) {
    return appel("/auth/v1/token?grant_type=password", { corps: { email: adresse, password: motdepasse } })
      .then(function (r) {
        if (!r.ok || !r.j.access_token) return erreur(r);
        var s = sessionDepuis(r.j); garder(s); return { ok: true, session: s };
      });
  }

  /* Créer un compte. Supabase envoie un lien de confirmation ; tant qu'il
     n'est pas cliqué, on ne peut pas se connecter. Pour ne pas dire à un
     inconnu quelles adresses ont un compte, la réponse est la même que
     l'adresse soit neuve ou non. */
  function inscrire(adresse, motdepasse) {
    return appel("/auth/v1/signup" + versArrivee, { corps: { email: adresse, password: motdepasse } })
      .then(function (r) {
        if (!r.ok) return erreur(r);
        if (r.j.access_token) { garder(sessionDepuis(r.j)); return { ok: true, connecte: true }; }
        return { ok: true, attente: true };
      });
  }

  function renvoyer(adresse) {
    return appel("/auth/v1/resend" + versArrivee, { corps: { type: "signup", email: adresse } })
      .then(function (r) { return r.ok ? { ok: true } : erreur(r); });
  }

  function oubli(adresse) {
    return appel("/auth/v1/recover" + versArrivee, { corps: { email: adresse } })
      .then(function (r) { return r.ok ? { ok: true } : erreur(r); });
  }

  /* Changer son mot de passe ({ password }) ou son adresse ({ email }). Pour
     l'adresse, Supabase envoie un lien à confirmer. */
  function changer(champs) {
    return session().then(function (s) {
      if (!s) return { erreur: MESSAGES.session_not_found, code: "session_not_found" };
      return appel("/auth/v1/user" + versArrivee, { methode: "PUT", jeton: s.jeton, corps: champs })
        .then(function (r) {
          if (!r.ok) return erreur(r);
          if (r.j.email) { s.utilisateur.courriel = r.j.email; garder(s); }
          return { ok: true, utilisateur: r.j };
        });
    });
  }

  function deconnecter() {
    var s = lire();
    oublier();
    if (!s) return Promise.resolve({ ok: true });
    return appel("/auth/v1/logout", { corps: {}, jeton: s.jeton }).then(function () { return { ok: true }; });
  }

  /* L'arrivée par un lien reçu par courriel. Supabase renvoie sur la page
     avec, après le « # », soit une session (access_token…, et type : signup,
     recovery, email_change), soit une erreur (error_code…), soit un message
     (la première moitié d'un changement d'adresse). On lit, on range, et on
     efface l'adresse : un jeton ne doit pas traîner dans l'historique. */
  function arrivee() {
    var h = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    var q = new URLSearchParams(window.location.search);
    var rien = !h.get("access_token") && !h.get("error_code") && !q.get("error_code") && !h.get("error") && !h.get("message");
    if (rien) return Promise.resolve(null);
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, "", window.location.pathname);
    }
    var code = h.get("error_code") || q.get("error_code") || h.get("error");
    if (code) {
      return Promise.resolve({ type: "erreur", erreur: MESSAGES[code] || MESSAGES.otp_expired, code: code });
    }
    if (h.get("message")) return Promise.resolve({ type: "message", message: h.get("message") });
    var j = {
      access_token: h.get("access_token"), refresh_token: h.get("refresh_token"),
      expires_at: h.get("expires_at"), expires_in: h.get("expires_in")
    };
    return appel("/auth/v1/user", { jeton: j.access_token }).then(function (r) {
      if (!r.ok) return { type: "erreur", erreur: erreur(r).erreur, code: "lien" };
      garder(sessionDepuis(j, r.j));
      return { type: h.get("type") || "signup", courriel: r.j.email };
    });
  }

  /* --- La base --------------------------------------------------------------- */
  function rpc(nom, args) {
    return session().then(function (s) {
      if (!s) return { erreur: MESSAGES.session_not_found, code: "session_not_found" };
      return appel("/rest/v1/rpc/" + nom, { corps: args || {}, jeton: s.jeton }).then(function (r) {
        return r.ok ? { ok: true, donnees: r.j } : erreur(r);
      });
    });
  }

  /* Lire une table, avec la syntaxe de Supabase (PostgREST) :
     lire("registre", "entreprise_id=eq.…&order=id.desc"). Les règles de la
     base ne rendent que ce que la personne a le droit de voir. */
  function lireTable(table, requete) {
    return session().then(function (s) {
      if (!s) return { erreur: MESSAGES.session_not_found, code: "session_not_found" };
      return appel("/rest/v1/" + table + "?" + (requete || ""), { jeton: s.jeton }).then(function (r) {
        return r.ok ? { ok: true, donnees: r.j } : erreur(r);
      });
    });
  }

  /* Où la personne connectée est membre, avec quel rôle, et le rang de ce que
     l'entreprise a payé (0 rien, 1 Textes, 2 Textes et suivi, 3 complète). */
  function mesEntreprises() {
    return rpc("mes_entreprises").then(function (r) {
      return r.ok ? { ok: true, entreprises: Array.isArray(r.donnees) ? r.donnees : [] } : r;
    });
  }

  function creerEntreprise(denomination) {
    return rpc("creer_entreprise", { denomination: denomination });
  }

  /* L'administration du service (compte/admin.html). La base refuse ces
     appels à tout autre compte que l'administrateur. */
  function suisAdministrateur() {
    return rpc("suis_administrateur").then(function (r) { return r.ok && r.donnees === true; });
  }
  function adminVue() { return rpc("admin_vue"); }
  function adminAbonnement(entreprise, formule) {
    return rpc("admin_abonnement", { entreprise: entreprise, nouvelle_formule: formule || null });
  }

  window.VIGIE = {
    ouvert: !!(BASE && CLE),
    session: session,
    utilisateur: function () { var s = lire(); return s ? s.utilisateur : null; },
    connecter: connecter, inscrire: inscrire, renvoyer: renvoyer, oubli: oubli,
    changer: changer, deconnecter: deconnecter, arrivee: arrivee,
    rpc: rpc, lire: lireTable, mesEntreprises: mesEntreprises, creerEntreprise: creerEntreprise,
    suisAdministrateur: suisAdministrateur, adminVue: adminVue, adminAbonnement: adminAbonnement,
    pageDuSite: pageDuSite
  };
})();
