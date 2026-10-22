/* ==========================================================================
   Pierrel & Co — les sources relevées automatiquement
   --------------------------------------------------------------------------
   Le référentiel cite 89 sources officielles. Toutes ne se relèvent pas de la
   même façon : certaines publient un flux, d'autres non. Ce fichier déclare
   celles que le robot sait aller chercher, et comment.

   « type » dit la méthode :
     dila  — les archives ouvertes de la DILA, un XML par texte, contenu
             intégral. C'est la source primaire du Journal officiel.
     rss   — un flux RSS. Titre, date, résumé, lien.
     atom  — un flux Atom. Même chose, autre balisage.

   « genre » dit ce qu'on reçoit, et il ne faut pas confondre les deux :
     texte      — du droit : une loi, un décret, un arrêté, un règlement.
     actualite  — un commentaire officiel : guide, avis, doctrine, alerte.
                  Cela compte pour la veille, mais ce n'est pas le droit.

   AVERTISSEMENT SUR LES ADRESSES DE FLUX
   Les adresses ci-dessous n'ont pas encore été confirmées contre les serveurs
   réels : l'environnement de développement refuse ces hôtes. Chacune porte
   donc « confirme: false ». `node outils/veille.mjs --verifier` interroge
   chaque flux et dit lequel répond ; c'est au vu de ce rapport qu'on passe une
   source à « confirme: true », pas avant. Une source qui ne répond pas est
   signalée, jamais remplacée par autre chose.
   ========================================================================== */

window.SOURCES = [

  /* --- Le droit, à la source ---------------------------------------------- */
  { id: "jorf", nom: "Journal officiel de la République française",
    type: "dila", genre: "texte", confirme: true,
    url: "https://echanges.dila.gouv.fr/OPENDATA/JORF/",
    note: "Données ouvertes de la DILA, sans compte. Contenu intégral de chaque texte." },

  { id: "eurlex-l", nom: "Journal officiel de l'Union européenne — série L",
    type: "rss", genre: "texte", confirme: false,
    url: "https://eur-lex.europa.eu/EN/display-feed.rss?myRssId=oj-l",
    note: "Règlements et directives, souvent en amont du droit national." },

  /* --- Santé et sécurité au travail ---------------------------------------- */
  { id: "inrs", nom: "INRS — actualités",
    type: "rss", genre: "actualite", confirme: false,
    url: "https://www.inrs.fr/rss/?feed=actualites" },

  { id: "travail", nom: "Ministère du Travail — actualités",
    type: "rss", genre: "actualite", confirme: false,
    url: "https://travail-emploi.gouv.fr/spip.php?page=backend" },

  { id: "oppbtp", nom: "OPPBTP — prévention BTP",
    type: "rss", genre: "actualite", confirme: false,
    url: "https://www.preventionbtp.fr/rss" },

  /* --- Social, paie, fiscal ------------------------------------------------ */
  { id: "boss", nom: "BOSS — Bulletin officiel de la Sécurité sociale",
    type: "rss", genre: "actualite", confirme: false,
    url: "https://boss.gouv.fr/rss.xml" },

  { id: "urssaf", nom: "URSSAF — actualités employeurs",
    type: "rss", genre: "actualite", confirme: false,
    url: "https://www.urssaf.fr/accueil/outils-documentation/actualites.rss" },

  { id: "bofip", nom: "BOFiP — doctrine fiscale",
    type: "rss", genre: "actualite", confirme: false,
    url: "https://bofip.impots.gouv.fr/rss" },

  /* --- Données personnelles et cybersécurité ------------------------------- */
  { id: "cnil", nom: "CNIL — actualités",
    type: "rss", genre: "actualite", confirme: false,
    url: "https://www.cnil.fr/fr/rss.xml" },

  { id: "certfr-avis", nom: "CERT-FR — avis de sécurité",
    type: "rss", genre: "actualite", confirme: false,
    url: "https://www.cert.ssi.gouv.fr/avis/feed/" },

  { id: "certfr-alerte", nom: "CERT-FR — alertes",
    type: "rss", genre: "actualite", confirme: false,
    url: "https://www.cert.ssi.gouv.fr/alerte/feed/" },

  /* --- Environnement ------------------------------------------------------- */
  { id: "ecologie", nom: "Ministère de la Transition écologique",
    type: "rss", genre: "actualite", confirme: false,
    url: "https://www.ecologie.gouv.fr/rss.xml" },

  { id: "ineris-aida", nom: "AIDA — réglementation des installations classées",
    type: "rss", genre: "texte", confirme: false,
    url: "https://aida.ineris.fr/rss" },

  { id: "ademe", nom: "ADEME — actualités",
    type: "rss", genre: "actualite", confirme: false,
    url: "https://presse.ademe.fr/feed" },

  /* --- Produits, consommation, alimentaire --------------------------------- */
  { id: "rappelconso", nom: "RappelConso — rappels de produits",
    type: "rss", genre: "actualite", confirme: false,
    url: "https://rappel.conso.gouv.fr/rss" },

  { id: "dgccrf", nom: "DGCCRF — actualités",
    type: "rss", genre: "actualite", confirme: false,
    url: "https://www.economie.gouv.fr/dgccrf/rss.xml" },

  { id: "anses", nom: "ANSES — avis et actualités",
    type: "rss", genre: "actualite", confirme: false,
    url: "https://www.anses.fr/fr/flux-rss.xml" },

  /* --- Entreprise, secteurs réglementés ------------------------------------ */
  { id: "entreprendre", nom: "Entreprendre — service-public.fr",
    type: "rss", genre: "actualite", confirme: false,
    url: "https://entreprendre.service-public.fr/rss/actualites.rss" },

  { id: "acpr", nom: "ACPR — Banque de France",
    type: "rss", genre: "actualite", confirme: false,
    url: "https://acpr.banque-france.fr/rss.xml" },

  { id: "amf", nom: "AMF — Autorité des marchés financiers",
    type: "rss", genre: "actualite", confirme: false,
    url: "https://www.amf-france.org/fr/rss.xml" },

  { id: "arcep", nom: "ARCEP",
    type: "rss", genre: "actualite", confirme: false,
    url: "https://www.arcep.fr/?eID=rss" },

  { id: "has", nom: "Haute Autorité de santé",
    type: "rss", genre: "actualite", confirme: false,
    url: "https://www.has-sante.fr/jcms/rss.xml" },

  { id: "ansm", nom: "ANSM — sécurité du médicament",
    type: "rss", genre: "actualite", confirme: false,
    url: "https://ansm.sante.fr/rss" },

  { id: "douane", nom: "Douane française",
    type: "rss", genre: "actualite", confirme: false,
    url: "https://www.douane.gouv.fr/rss.xml" },

  { id: "boamp", nom: "BOAMP — marchés publics",
    type: "rss", genre: "actualite", confirme: false,
    url: "https://www.boamp.fr/rss" }
];
