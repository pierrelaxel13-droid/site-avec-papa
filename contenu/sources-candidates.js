/* ==========================================================================
   Vigie — sources officielles candidates (4 novembre 2026)
   --------------------------------------------------------------------------
   Des sources que le site ne relève pas encore. Le robot de relève les
   essaie en mode « découverte » (node outils/veille.mjs --decouvrir, lancé
   à la main depuis l'onglet Actions) : il cherche leur flux, et écrit ce qu'il
   trouve dans contenu/sources-decouverte.txt. Rien ici n'est publié sur le
   site : une source n'entre dans contenu/sources.js qu'après lecture du
   bilan, à la main, avec « confirme: true ».
   L'adresse donnée est une page d'actualités ; le robot y cherche les liens
   de flux déclarés, puis les chemins courants (/rss.xml, /feed…).
   ========================================================================== */
window.SOURCES_CANDIDATES = [
  { id: "echa", nom: "ECHA — Agence européenne des produits chimiques", type: "rss", genre: "actualite", confirme: false,
    url: "https://echa.europa.eu/fr/news-and-events/news-alerts/all-news", theme: "Produits chimiques (REACH, CLP)" },
  { id: "euosha", nom: "EU-OSHA — Agence européenne pour la sécurité et la santé au travail", type: "rss", genre: "actualite", confirme: false,
    url: "https://osha.europa.eu/fr/oshnews", theme: "Santé et sécurité au travail" },
  { id: "asnr", nom: "ASNR — sûreté nucléaire et radioprotection", type: "rss", genre: "actualite", confirme: false,
    url: "https://www.asnr.fr/actualites", theme: "Radioprotection" },
  { id: "agriculture", nom: "Ministère de l'Agriculture — actualités", type: "rss", genre: "actualite", confirme: false,
    url: "https://agriculture.gouv.fr/", theme: "Agriculture, alimentation" },
  { id: "boagri", nom: "Bulletin officiel du ministère de l'Agriculture", type: "rss", genre: "texte", confirme: false,
    url: "https://info.agriculture.gouv.fr/boagri/", theme: "Agriculture, alimentation" },
  { id: "francecompetences", nom: "France compétences — actualités", type: "rss", genre: "actualite", confirme: false,
    url: "https://www.francecompetences.fr/actualites/", theme: "Formation, Qualiopi" },
  { id: "cre", nom: "CRE — Commission de régulation de l'énergie", type: "rss", genre: "actualite", confirme: false,
    url: "https://www.cre.fr/actualites/toute-l-actualite.html", theme: "Énergie" },
  { id: "cnaps", nom: "CNAPS — sécurité privée", type: "rss", genre: "actualite", confirme: false,
    url: "https://www.cnaps.interieur.gouv.fr/actualites", theme: "Sécurité privée" },
  { id: "anj", nom: "ANJ — Autorité nationale des jeux", type: "rss", genre: "actualite", confirme: false,
    url: "https://anj.fr/actualites", theme: "Jeux d'argent" },
  { id: "arcom", nom: "Arcom — audiovisuel et numérique", type: "rss", genre: "actualite", confirme: false,
    url: "https://www.arcom.fr/actualites", theme: "Audiovisuel" },
  { id: "culture", nom: "Ministère de la Culture — actualités", type: "rss", genre: "actualite", confirme: false,
    url: "https://www.culture.gouv.fr/Actualites", theme: "Spectacle, droits d'auteur" },
  { id: "sports", nom: "Ministère des Sports — actualités", type: "rss", genre: "actualite", confirme: false,
    url: "https://www.sports.gouv.fr/actualites", theme: "Sport" },
  { id: "ameli_entreprise", nom: "Ameli — entreprises, risques professionnels", type: "rss", genre: "actualite", confirme: false,
    url: "https://www.ameli.fr/entreprise/actualites", theme: "Accidents du travail, maladies professionnelles" },
  { id: "circulaires", nom: "Légifrance — circulaires et instructions", type: "rss", genre: "texte", confirme: false,
    url: "https://www.legifrance.gouv.fr/liste/circulaire", theme: "Application des textes" },
  { id: "sante_travail", nom: "Ministère de la Santé — actualités", type: "rss", genre: "actualite", confirme: false,
    url: "https://sante.gouv.fr/actualites/", theme: "Santé, médico-social" },
  { id: "georisques", nom: "Géorisques — risques industriels", type: "rss", genre: "actualite", confirme: false,
    url: "https://www.georisques.gouv.fr/", theme: "Installations classées" }
];
