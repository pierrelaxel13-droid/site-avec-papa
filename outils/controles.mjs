/* ==========================================================================
   Les contrôles de vraisemblance du robot de collecte
   --------------------------------------------------------------------------
   Appelés par outils/veille.mjs à la fin de chaque passage, avant d'écrire.
   Ils comparent ce qui vient d'être relevé au passage précédent, et disent
   ce qui n'est pas normal — sans jamais inventer : une alerte dit ce qu'on a
   constaté, pas ce qu'on suppose.

   Niveaux :
     attention  à regarder ; inscrit au journal du passage
     grave      le client risque de ne pas être prévenu d'un texte ; l'action
                échoue (une fois par jour au plus) : GitHub envoie un courriel

   Et une protection : une source qui répond mais perd d'un coup plus de la
   moitié de ses textes (dix au moins avant) les garde — comme une source
   muette garde les siens. Mieux vaut un texte de trop qu'un texte perdu.

   Tests : node outils/controles.test.mjs
   ========================================================================== */

const jourMoins = (iso, n) => new Date(Date.parse(iso + "T12:00:00Z") - n * 86400000).toISOString().slice(0, 10);
const cle = (t) => `${t.titre}|${t.dateTexte || t.vuLe}`;

/* rapport   : [{ id, nom, entrees, retenus, souci }] de ce passage
   propres   : les textes qui vont être écrits (modifié sur place si on reprend)
   avant     : les textes du passage précédent
   sources   : contenu/sources.js (pour savoir lesquelles sont vérifiées)
   depuis    : début de la fenêtre (AAAA-MM-JJ) ; aujourdhui : AAAA-MM-JJ
   joDernier : date de la plus récente archive du Journal officiel, ou ""   */
export function controle({ rapport, propres, avant, sources, depuis, aujourdhui, joDernier }) {
  const alertes = [];
  const verifiee = new Set(sources.filter((s) => s.confirme).map((s) => s.id));
  const dansFenetre = (t) => (t.vuLe || t.date) >= depuis;
  const compte = (liste) => liste.reduce((m, t) => (m[t.source] = (m[t.source] || 0) + 1, m), {});
  const avantFenetre = avant.filter(dansFenetre);
  const nAvant = compte(avantFenetre);
  const nApres = compte(propres);
  const vus = new Set(propres.map(cle));

  for (const r of rapport) {
    const avantN = nAvant[r.id] || 0, apresN = nApres[r.id] || 0;
    if (r.souci) {
      if (verifiee.has(r.id)) alertes.push({ niveau: "attention", type: "muette", source: r.id, quoi: `${r.nom} n'a pas répondu : ${r.souci}` });
      continue;
    }
    if (r.entrees === 0 && avantN > 0) {
      alertes.push({ niveau: "attention", type: "vide", source: r.id,
        quoi: `${r.nom} a répondu sans aucune entrée, alors qu'elle avait ${avantN} texte${avantN > 1 ? "s" : ""} au passage précédent : son format a peut-être changé.` });
    }
    if (avantN >= 10 && apresN < avantN / 2) {
      const repris = avantFenetre.filter((t) => t.source === r.id && !vus.has(cle(t)));
      repris.forEach((t) => vus.add(cle(t)));
      propres.push(...repris);
      r.repris = (r.repris || 0) + repris.length;
      alertes.push({ niveau: "attention", type: "chute", source: r.id,
        quoi: `${r.nom} est passée de ${avantN} à ${apresN} textes d'un coup : les ${repris.length} manquants sont gardés, à vérifier.` });
    }
  }

  // Le Journal officiel paraît presque chaque jour : trois jours sans, c'est grave.
  if (sources.some((s) => s.id === "jorf")) {
    if (!joDernier) {
      alertes.push({ niveau: "grave", type: "jo", source: "jorf", quoi: "Aucune archive du Journal officiel n'a pu être lue." });
    } else if (joDernier < jourMoins(aujourdhui, 3)) {
      alertes.push({ niveau: "grave", type: "jo", source: "jorf",
        quoi: `Aucun Journal officiel depuis le ${joDernier} : la DILA ne publie plus, ou le robot ne la lit plus.` });
    }
  }

  // Une chute de tout le relevé de plus de moitié : alerte, et on garde
  // tout ce qui était là, plutôt que de publier un relevé appauvri.
  if (avantFenetre.length >= 20 && propres.length < avantFenetre.length / 2) {
    const n = propres.length;
    const repris = avantFenetre.filter((t) => !vus.has(cle(t)));
    repris.forEach((t) => vus.add(cle(t)));
    propres.push(...repris);
    alertes.push({ niveau: "grave", type: "effondrement", source: "",
      quoi: `Le relevé est passé de ${avantFenetre.length} à ${n} textes d'un passage à l'autre : les ${repris.length} manquants sont gardés, à vérifier.` });
  }

  // Des dates qui ne peuvent pas être vraies.
  const demain = jourMoins(aujourdhui, -1);
  const futurs = propres.filter((t) => (t.dateTexte || "") > demain || (t.vuLe || "") > demain);
  if (futurs.length) {
    alertes.push({ niveau: "attention", type: "date", source: "",
      quoi: `${futurs.length} texte${futurs.length > 1 ? "s portent" : " porte"} une date à venir (ex. « ${futurs[0].titre.slice(0, 80)} »).` });
  }

  const dejaVus = new Set(avant.map((t) => t.id));
  const nouveaux = propres.filter((t) => !dejaVus.has(t.id)).length;
  return { alertes, nouveaux };
}
