/* ==========================================================================
   Vigie — où l'espace range ses données
   --------------------------------------------------------------------------
   Deux cas, une seule façon de lire et d'écrire pour le reste du code :
   - /demo/ (la démonstration) : dans le navigateur, comme avant — rien ne
     part nulle part ;
   - /app/ (un vrai compte) : dans la base Supabase, par assets/vigie.js.
     Rien n'est gardé dans le navigateur : on retrouve tout sur un autre
     appareil, et chaque case « Fait » est une entrée datée du registre.

   Les clés : "pco-entreprise" (les réglages), "pco-alertes", "pco-faits"
   ({ clé: "AAAA-MM-JJ" }), "pco-lus" (les textes déjà ouverts, avis.js).

   Dans un compte, les données arrivent après la page : le code qui en a
   besoin attend avec MAGASIN.quandPret(fonction).
   ========================================================================== */
(function () {
  "use strict";
  var V = window.VIGIE;
  var compte = window.location.pathname.indexOf("/app/") !== -1 && !!(V && V.ouvert);
  var memoire = {}, attente = [];
  var REFUS = "Impossible d'enregistrer : le stockage du navigateur est refusé ou plein.";

  var M = {
    mode: compte ? "compte" : "demo",
    pret: false,
    espace: null      // dans un compte : { id, role, rang, ecrit, entreprise }
  };

  function local(cle) {
    try { var v = window.localStorage.getItem(cle); return v ? JSON.parse(v) : null; } catch (e) { return null; }
  }
  function poserLocal(cle, o) {
    try { window.localStorage.setItem(cle, JSON.stringify(o)); return true; } catch (e) { return false; }
  }
  function copie(o) { return o == null ? null : JSON.parse(JSON.stringify(o)); }
  function aujourdhui() {
    var d = new Date();
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }

  M.quandPret = function (fn) { if (M.pret) fn(); else attente.push(fn); };
  function ouvrir() {
    M.pret = true;
    attente.splice(0).forEach(function (fn) {
      try { fn(); } catch (e) { window.setTimeout(function () { throw e; }); }
    });
  }

  M.lire = function (cle) { return compte ? copie(memoire[cle]) : local(cle); };

  /* Enregistrer. Rend une promesse : { ok } ou { erreur }. */
  M.ecrire = function (cle, o) {
    if (!compte) return Promise.resolve(poserLocal(cle, o) ? { ok: true } : { erreur: REFUS });
    var appel = cle === "pco-entreprise"
      ? V.rpc("espace_reglages", { e: M.espace.id, nouveaux: o })
      : cle === "pco-alertes" ? V.rpc("espace_alertes", { choix: o })
      : cle === "pco-lus" ? V.rpc("espace_lus", { lus: o })
      : Promise.resolve({ erreur: "Rien à enregistrer sous « " + cle + " »." });
    return appel.then(function (r) {
      if (!r.ok) return r;
      var garde = copie(o);
      if (garde) delete garde.resume;
      memoire[cle] = garde;
      return { ok: true };
    });
  };

  M.effacer = function (cle) {
    if (compte) return;     // un compte ne se « remet pas à zéro » : le registre garde tout
    try { window.localStorage.removeItem(cle); } catch (e) { /* sans effet */ }
  };

  /* Cocher ou décocher une case « Fait ». Dans un compte, c'est une entrée
     du registre (ou sa correction) ; rend { ok, le } ou { erreur }. */
  M.fait = function (cle, intitule, sujet, fait) {
    if (!compte) {
      var f = local("pco-faits") || {};
      if (fait) f[cle] = aujourdhui(); else delete f[cle];
      return Promise.resolve(poserLocal("pco-faits", f) ? { ok: true, le: f[cle] || null } : { erreur: REFUS });
    }
    return V.rpc("espace_fait", { e: M.espace.id, quoi: cle, intitule: intitule, sujet: sujet || null, fait: !!fait })
      .then(function (r) {
        if (!r.ok) return r;
        var faits = memoire["pco-faits"] || (memoire["pco-faits"] = {});
        if (fait) faits[cle] = r.donnees || aujourdhui(); else delete faits[cle];
        return { ok: true, le: faits[cle] || null };
      });
  };

  /* Qualifier un texte, ouvrir une action, la dire faite (un compte seulement :
     la démonstration n'a pas de registre). Rendent { ok } ou { erreur }. */
  M.qualifications = function () { return copie(memoire.qualifications) || {}; };
  M.actions = function () { return copie(memoire.actions) || []; };
  M.qualifier = function (cle, intitule, statut, note) {
    return V.rpc("espace_qualifier", { e: M.espace.id, quoi: cle, intitule: intitule, statut: statut, note: note || null })
      .then(function (r) {
        if (!r.ok) return r;
        memoire.qualifications = memoire.qualifications || {};
        memoire.qualifications[cle] = { statut: statut, le: r.donnees, note: note || null };
        return { ok: true };
      });
  };
  M.ouvrirAction = function (cle, intitule, echeance, note) {
    return V.rpc("espace_action", { e: M.espace.id, quoi: cle, intitule: intitule, echeance: echeance, note: note || null })
      .then(function (r) {
        if (!r.ok) return r;
        (memoire.actions = memoire.actions || []).push({ id: r.donnees, cle: cle, objet: intitule, echeance: echeance, note: note || null });
        return { ok: true, id: r.donnees };
      });
  };
  M.actionFaite = function (id) {
    return V.rpc("espace_action_faite", { e: M.espace.id, action: id }).then(function (r) {
      if (!r.ok) return r;
      memoire.actions = (memoire.actions || []).filter(function (a) { return a.id !== id; });
      return { ok: true };
    });
  };

  /* Les réglages tels que le formulaire les connaît, depuis la base. */
  function reglagesDepuis(en, reponses) {
    var rg = en.reglages || {};
    return {
      nom: rg.nom || en.denomination || "",
      naf: en.naf || "",
      ville: en.implantation || "",
      effectif: en.effectif != null ? String(en.effectif) : "",
      responsable: rg.responsable || "",
      contexte: Object.keys(reponses || {}).filter(function (k) { return reponses[k]; }),
      plus: rg.plus || {}
    };
  }

  if (!compte) {
    ouvrir();
  } else {
    V.session().then(function (s) {
      if (!s) return;                    // session.js renvoie à la connexion
      return V.espaceChoisi().then(function (r) {
        var e = r.ok && r.entreprise;
        if (!e || !e.rang) return;       // session.js dit ce qui manque
        return V.rpc("espace_lire", { e: e.entreprise_id }).then(function (x) {
          if (!x.ok) { M.erreur = x.erreur; return; }
          var d = x.donnees || {};
          // Un consultant n'est pas membre : il règle le plan de son client comme son administrateur.
          M.espace = { id: e.entreprise_id, role: d.role || (e.role === "consultant" ? "consultant" : null),
            rang: d.rang, ecrit: !!d.ecrit, entreprise: d.entreprise, cabinet: e.cabinet || null };
          memoire["pco-entreprise"] = reglagesDepuis(d.entreprise || {}, d.reponses);
          memoire["pco-alertes"] = (d.profil && d.profil.alertes) || null;
          memoire["pco-lus"] = (d.profil && d.profil.lus) || null;
          memoire["pco-faits"] = d.faits || {};
          memoire.qualifications = d.qualifications || {};
          memoire.actions = d.actions || [];
          document.body.classList.add("espace-compte");
          ouvrir();
        });
      });
    });
  }

  window.MAGASIN = M;
})();
