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
     ods   — une API de données ouvertes (Opendatasoft) ; « champs » dit
             quel champ donne le titre, la date, le lien et le corps.

   « genre » dit ce qu'on reçoit, et il ne faut pas confondre les deux :
     texte      — du droit : une loi, un décret, un arrêté, un règlement.
     actualite  — un commentaire officiel : guide, avis, doctrine, alerte.
                  Cela compte pour la veille, mais ce n'est pas le droit.

   OÙ EN SONT LES SOURCES — 25 OCTOBRE 2026
   Le 23 octobre, la vérification depuis une machine qui joint ces hôtes
   (.github/workflows/releve.yml) n'en trouvait que 6 qui répondaient. Le 25,
   la recherche de flux (node outils/veille.mjs --decouvrir) a demandé à
   chaque site où est son flux ; le bilan est dans contenu/sources-decouverte.txt.

     20 répondent — elles portent « confirme: true ». Leur note « vu » dit
        ce qu'elles ont donné, et d'où vient l'adresse. RappelConso, qui a
        fermé son flux, est lu dans les données ouvertes de Bercy (type « ods »).
      5 ne répondent pas, et la note dit pourquoi :
        BOSS et URSSAF ferment la porte aux machines de GitHub ;
        l'ACPR répond 403 ; l'INRS et le BOAMP n'ont pas de flux.

   « pourquoi » est la raison dite au client, en trois mots, sur la page du
   relevé.

   Une source qu'on ne sait pas joindre garde « confirme: false » : elle doit
   se voir, pas se maquiller avec une adresse inventée.
   ========================================================================== */

window.SOURCES = [

  /* --- Le droit, à la source ---------------------------------------------- */
  { id: "jorf", nom: "Journal officiel de la République française",
    type: "dila", genre: "texte", confirme: true,
    url: "https://echanges.dila.gouv.fr/OPENDATA/JORF/",
    note: "Données ouvertes de la DILA, sans compte. Contenu intégral de chaque texte." },

  { id: "eurlex-l", nom: "Journal officiel de l'Union européenne — série L",
    type: "rss", genre: "texte", confirme: true,
    url: "https://eur-lex.europa.eu/FR/display-feed.rss?rssId=165",
    vu: "25 octobre 2026 : trouvé par la recherche de flux, répond avec des entrées datées — 100 entrées, la plus récente du 22 octobre",
    note: "Règlements et directives, souvent en amont du droit national." },

  /* --- Santé et sécurité au travail ---------------------------------------- */
  { id: "inrs", nom: "INRS — actualités",
    type: "rss", genre: "actualite", confirme: false,
    url: "https://www.inrs.fr/rss/?feed=actualites",
    vu: "25 octobre 2026 : l'INRS ne publie pas de flux RSS ; ni sa page d'accueil ni sa page « Suivez-nous » n'en déclarent",
    pourquoi: "pas de flux publié" },

  { id: "travail", nom: "Ministère du Travail — actualités",
    type: "rss", genre: "actualite", confirme: true,
    url: "https://travail-emploi.gouv.fr/rss.xml",
    vu: "25 octobre 2026 : trouvé par la recherche de flux, répond avec des entrées datées — 50 entrées, la plus récente du 23 octobre" },

  { id: "oppbtp", nom: "OPPBTP — prévention BTP",
    type: "rss", genre: "actualite", confirme: true,
    url: "https://www.oppbtp.com/actualites/feed/",
    vu: "25 octobre 2026 : trouvé par la recherche de flux, répond avec des entrées datées — 10 entrées, la plus récente du 8 octobre ; l'OPPBTP a quitté preventionbtp.fr pour oppbtp.com" },

  /* --- Social, paie, fiscal ------------------------------------------------ */
  { id: "boss", nom: "BOSS — Bulletin officiel de la Sécurité sociale",
    type: "rss", genre: "actualite", confirme: false,
    url: "https://boss.gouv.fr/rss.xml",
    vu: "25 octobre 2026 : le serveur ne répond pas aux machines de GitHub (délai de connexion dépassé), ni sur son adresse, ni sur sa page d'accueil",
    pourquoi: "refuse notre robot" },

  { id: "urssaf", nom: "URSSAF — actualités employeurs",
    type: "rss", genre: "actualite", confirme: false,
    url: "https://www.urssaf.fr/accueil/outils-documentation/actualites.rss",
    vu: "25 octobre 2026 : le serveur coupe la connexion aux machines de GitHub (ECONNRESET), sur toutes ses pages",
    pourquoi: "refuse notre robot" },

  { id: "bofip", nom: "BOFiP — doctrine fiscale",
    type: "rss", genre: "actualite", confirme: true,
    url: "https://bofip.impots.gouv.fr/bofip/ext/rss.xml?actualites=1&maxR=50&maxJ=30",
    vu: "25 octobre 2026 : trouvé par la recherche de flux, répond — 7 actualités sur 30 jours. Le flux ne date pas ses entrées : la relève note le jour où elle les voit pour la première fois, sans en inventer" },

  /* --- Données personnelles et cybersécurité ------------------------------- */
  { id: "cnil", nom: "CNIL — actualités",
    type: "rss", genre: "actualite", confirme: true,
    url: "https://www.cnil.fr/fr/rss.xml" },

  { id: "certfr-avis", nom: "CERT-FR — avis de sécurité",
    type: "rss", genre: "actualite", confirme: true,
    url: "https://www.cert.ssi.gouv.fr/avis/feed/" },

  { id: "certfr-alerte", nom: "CERT-FR — alertes",
    type: "rss", genre: "actualite", confirme: true,
    url: "https://www.cert.ssi.gouv.fr/alerte/feed/" },

  /* --- Environnement ------------------------------------------------------- */
  { id: "ecologie", nom: "Ministère de la Transition écologique",
    type: "rss", genre: "actualite", confirme: true,
    url: "https://ecologie.gouv.fr/rss-actualites.xml",
    vu: "25 octobre 2026 : trouvé par la recherche de flux, répond avec des entrées datées — 10 entrées, la plus récente du 23 octobre" },

  { id: "ineris-aida", nom: "Ineris et AIDA — nouveautés",
    type: "rss", genre: "texte", confirme: true,
    url: "https://www.ineris.fr/fr/flux-rss",
    vu: "25 octobre 2026 : trouvé par la recherche de flux, répond avec des entrées datées — le lien « Flux RSS » d'AIDA mène au flux de l'Ineris, 10 entrées, la plus récente du 21 octobre" },

  { id: "ademe", nom: "ADEME — nouvelles publications",
    type: "rss", genre: "actualite", confirme: true,
    url: "https://librairie.ademe.fr/rss/nouveautes.xml",
    vu: "25 octobre 2026 : trouvé par la recherche de flux, répond avec des entrées datées — les nouveautés de la Librairie ADEME (guides, études), 93 entrées, la plus récente du 22 octobre ; ademe.fr refuse le robot (403)" },

  /* --- Produits, consommation, alimentaire --------------------------------- */
  { id: "rappelconso", nom: "RappelConso — rappels de produits",
    type: "ods", genre: "actualite", confirme: true,
    url: "https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/rappelconso-v2-gtin-espaces/records?order_by=date_publication%20desc&limit=100",
    champs: {
      titre: ["libelle", "marque_produit"],
      date: "date_publication",
      lien: "lien_vers_la_fiche_rappel",
      corps: { "Produit": "sous_categorie_produit", "Motif du rappel": "motif_rappel",
               "Risques": "risques_encourus", "Ce qu'il faut faire": "conduites_a_tenir_par_le_consommateur" }
    },
    vu: "25 octobre 2026 : le flux rappel.conso.gouv.fr/rss répond 404 depuis le 23 octobre. Les mêmes fiches sont lues dans les données ouvertes de Bercy (RappelConso V2, 19 111 fiches), avec le lien vers chaque fiche officielle" },

  { id: "dgccrf", nom: "DGCCRF — actualités",
    type: "rss", genre: "actualite", confirme: true,
    url: "https://www.economie.gouv.fr/dgccrf/rss",
    vu: "25 octobre 2026 : trouvé par la recherche de flux, répond avec des entrées datées — 20 entrées, la plus récente du 23 octobre" },

  { id: "anses", nom: "ANSES — avis et actualités",
    type: "rss", genre: "actualite", confirme: true,
    url: "https://www.anses.fr/rss.xml",
    vu: "25 octobre 2026 : trouvé par la recherche de flux, répond avec des entrées datées — 10 entrées, la plus récente du 22 octobre" },

  /* --- Entreprise, secteurs réglementés ------------------------------------ */
  { id: "entreprendre", nom: "Entreprendre — service-public.fr",
    type: "rss", genre: "actualite", confirme: true,
    url: "https://www.service-public.gouv.fr/abonnements/rss/actu-actu-pro.rss",
    vu: "25 octobre 2026 : trouvé par la recherche de flux, répond avec des entrées datées — 235 entrées, la plus récente du 21 octobre" },

  { id: "acpr", nom: "ACPR — Banque de France",
    type: "rss", genre: "actualite", confirme: false,
    url: "https://acpr.banque-france.fr/rss.xml",
    vu: "25 octobre 2026 : HTTP 403, l'hôte refuse le robot ; sa page d'accueil ne déclare aucun flux",
    pourquoi: "refuse notre robot" },

  { id: "amf", nom: "AMF — Autorité des marchés financiers",
    type: "rss", genre: "actualite", confirme: true,
    url: "https://www.amf-france.org/fr/flux-rss/display/21",
    vu: "25 octobre 2026 : trouvé par la recherche de flux, répond avec des entrées datées — « Toutes les actualités et publications », 200 entrées, la plus récente du 22 octobre" },

  { id: "arcep", nom: "ARCEP",
    type: "rss", genre: "actualite", confirme: true,
    url: "https://www.arcep.fr/actualites/suivre-actualite-regulation-arcep/fil-dinfos/rss.xml",
    vu: "25 octobre 2026 : trouvé par la recherche de flux, répond avec des entrées datées — 10 entrées, la plus récente du 22 octobre" },

  { id: "has", nom: "Haute Autorité de santé",
    type: "rss", genre: "actualite", confirme: true,
    url: "https://www.has-sante.fr/feed/Rss2.jsp?id=p_3081656",
    vu: "25 octobre 2026 : trouvé par la recherche de flux, répond avec des entrées datées — 50 entrées, la plus récente du 21 octobre. Le site envoie une chaîne de certificats incomplète : la relève la complète (voir releve.yml)" },

  { id: "ansm", nom: "ANSM — actualités",
    type: "rss", genre: "actualite", confirme: true,
    url: "https://ansm.sante.fr/rss/actualites",
    vu: "25 octobre 2026 : flux officiel trouvé sur ansm.sante.fr/page/flux-rss. C'est un flux « du jour » : il est vide les jours sans publication (vide ce dimanche), et se remplit les autres" },

  { id: "douane", nom: "Douane française",
    type: "rss", genre: "actualite", confirme: true,
    url: "https://www.douane.gouv.fr/rss.xml" },

  { id: "boamp", nom: "BOAMP — marchés publics",
    type: "rss", genre: "actualite", confirme: false,
    url: "https://www.boamp.fr/rss",
    vu: "25 octobre 2026 : le BOAMP n'a pas de flux RSS ; ses données ouvertes sont des avis de marchés publics, pas des textes à appliquer",
    pourquoi: "pas de flux publié" }
];
