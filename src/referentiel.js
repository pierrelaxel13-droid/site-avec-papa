/* ==========================================================================
   Référentiel de veille réglementaire — données de base
   --------------------------------------------------------------------------
   Contenu :
     - nomenclature NAF (21 sections, 88 divisions, tous secteurs)
     - domaines de veille, avec textes de référence et sources officielles
     - matrice division NAF -> domaines de veille applicables
     - déclencheurs (caractéristiques d'activité qui ajoutent des domaines)
     - étapes de la démarche et fréquences recommandées

   La nomenclature est traitée au niveau « division » (2 chiffres) : un code
   NAF complet (4 chiffres + 1 lettre, ex. 43.99C) est rattaché à sa division
   par ses deux premiers chiffres. Cela couvre tous les secteurs sans figer
   les 700+ sous-classes, qui évoluent à chaque révision INSEE.

   Ce référentiel est un point de départ méthodologique : il ne remplace pas
   la vérification des textes sur Légifrance ni l'avis d'un juriste.
   ========================================================================== */

window.VEILLE = (function () {
  "use strict";

  /* ---------------------------------------------------------------- SECTIONS */
  var sections = [
    { c: "A", l: "Agriculture, sylviculture et pêche", div: ["01", "02", "03"] },
    { c: "B", l: "Industries extractives", div: ["05", "06", "07", "08", "09"] },
    { c: "C", l: "Industrie manufacturière", div: ["10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30", "31", "32", "33"] },
    { c: "D", l: "Production et distribution d'électricité, de gaz, de vapeur et d'air conditionné", div: ["35"] },
    { c: "E", l: "Production et distribution d'eau ; assainissement, gestion des déchets et dépollution", div: ["36", "37", "38", "39"] },
    { c: "F", l: "Construction", div: ["41", "42", "43"] },
    { c: "G", l: "Commerce ; réparation d'automobiles et de motocycles", div: ["45", "46", "47"] },
    { c: "H", l: "Transports et entreposage", div: ["49", "50", "51", "52", "53"] },
    { c: "I", l: "Hébergement et restauration", div: ["55", "56"] },
    { c: "J", l: "Information et communication", div: ["58", "59", "60", "61", "62", "63"] },
    { c: "K", l: "Activités financières et d'assurance", div: ["64", "65", "66"] },
    { c: "L", l: "Activités immobilières", div: ["68"] },
    { c: "M", l: "Activités spécialisées, scientifiques et techniques", div: ["69", "70", "71", "72", "73", "74", "75"] },
    { c: "N", l: "Activités de services administratifs et de soutien", div: ["77", "78", "79", "80", "81", "82"] },
    { c: "O", l: "Administration publique", div: ["84"] },
    { c: "P", l: "Enseignement", div: ["85"] },
    { c: "Q", l: "Santé humaine et action sociale", div: ["86", "87", "88"] },
    { c: "R", l: "Arts, spectacles et activités récréatives", div: ["90", "91", "92", "93"] },
    { c: "S", l: "Autres activités de services", div: ["94", "95", "96"] },
    { c: "T", l: "Activités des ménages en tant qu'employeurs", div: ["97", "98"] },
    { c: "U", l: "Activités extra-territoriales", div: ["99"] }
  ];

  /* --------------------------------------------------------------- DIVISIONS */
  var divisions = [
    { c: "01", s: "A", l: "Culture et production animale, chasse et services annexes" },
    { c: "02", s: "A", l: "Sylviculture et exploitation forestière" },
    { c: "03", s: "A", l: "Pêche et aquaculture" },
    { c: "05", s: "B", l: "Extraction de houille et de lignite" },
    { c: "06", s: "B", l: "Extraction d'hydrocarbures" },
    { c: "07", s: "B", l: "Extraction de minerais métalliques" },
    { c: "08", s: "B", l: "Autres industries extractives (carrières, sablières)" },
    { c: "09", s: "B", l: "Services de soutien aux industries extractives" },
    { c: "10", s: "C", l: "Industries alimentaires" },
    { c: "11", s: "C", l: "Fabrication de boissons" },
    { c: "12", s: "C", l: "Fabrication de produits à base de tabac" },
    { c: "13", s: "C", l: "Fabrication de textiles" },
    { c: "14", s: "C", l: "Industrie de l'habillement" },
    { c: "15", s: "C", l: "Industrie du cuir et de la chaussure" },
    { c: "16", s: "C", l: "Travail du bois et fabrication d'articles en bois" },
    { c: "17", s: "C", l: "Industrie du papier et du carton" },
    { c: "18", s: "C", l: "Imprimerie et reproduction d'enregistrements" },
    { c: "19", s: "C", l: "Cokéfaction et raffinage" },
    { c: "20", s: "C", l: "Industrie chimique" },
    { c: "21", s: "C", l: "Industrie pharmaceutique" },
    { c: "22", s: "C", l: "Fabrication de produits en caoutchouc et en plastique" },
    { c: "23", s: "C", l: "Fabrication d'autres produits minéraux non métalliques (béton, verre, céramique)" },
    { c: "24", s: "C", l: "Métallurgie" },
    { c: "25", s: "C", l: "Fabrication de produits métalliques (hors machines et équipements)" },
    { c: "26", s: "C", l: "Fabrication de produits informatiques, électroniques et optiques" },
    { c: "27", s: "C", l: "Fabrication d'équipements électriques" },
    { c: "28", s: "C", l: "Fabrication de machines et équipements" },
    { c: "29", s: "C", l: "Industrie automobile" },
    { c: "30", s: "C", l: "Fabrication d'autres matériels de transport" },
    { c: "31", s: "C", l: "Fabrication de meubles" },
    { c: "32", s: "C", l: "Autres industries manufacturières" },
    { c: "33", s: "C", l: "Réparation et installation de machines et d'équipements" },
    { c: "35", s: "D", l: "Production et distribution d'électricité, de gaz, de vapeur et d'air conditionné" },
    { c: "36", s: "E", l: "Captage, traitement et distribution d'eau" },
    { c: "37", s: "E", l: "Collecte et traitement des eaux usées" },
    { c: "38", s: "E", l: "Collecte, traitement et élimination des déchets ; récupération" },
    { c: "39", s: "E", l: "Dépollution et autres services de gestion des déchets" },
    { c: "41", s: "F", l: "Construction de bâtiments" },
    { c: "42", s: "F", l: "Génie civil" },
    { c: "43", s: "F", l: "Travaux de construction spécialisés" },
    { c: "45", s: "G", l: "Commerce et réparation d'automobiles et de motocycles" },
    { c: "46", s: "G", l: "Commerce de gros" },
    { c: "47", s: "G", l: "Commerce de détail" },
    { c: "49", s: "H", l: "Transports terrestres et transport par conduites" },
    { c: "50", s: "H", l: "Transports par eau" },
    { c: "51", s: "H", l: "Transports aériens" },
    { c: "52", s: "H", l: "Entreposage et services auxiliaires des transports" },
    { c: "53", s: "H", l: "Activités de poste et de courrier" },
    { c: "55", s: "I", l: "Hébergement (hôtellerie, campings, résidences)" },
    { c: "56", s: "I", l: "Restauration" },
    { c: "58", s: "J", l: "Édition" },
    { c: "59", s: "J", l: "Production de films, de vidéo, de programmes de télévision et de musique" },
    { c: "60", s: "J", l: "Programmation et diffusion (radio, télévision)" },
    { c: "61", s: "J", l: "Télécommunications" },
    { c: "62", s: "J", l: "Programmation, conseil et autres activités informatiques" },
    { c: "63", s: "J", l: "Services d'information (hébergement, portails, traitement de données)" },
    { c: "64", s: "K", l: "Services financiers, hors assurance et caisses de retraite" },
    { c: "65", s: "K", l: "Assurance" },
    { c: "66", s: "K", l: "Activités auxiliaires de services financiers et d'assurance (courtage)" },
    { c: "68", s: "L", l: "Activités immobilières" },
    { c: "69", s: "M", l: "Activités juridiques et comptables" },
    { c: "70", s: "M", l: "Activités des sièges sociaux ; conseil de gestion" },
    { c: "71", s: "M", l: "Architecture, ingénierie, contrôle et analyses techniques" },
    { c: "72", s: "M", l: "Recherche-développement scientifique" },
    { c: "73", s: "M", l: "Publicité et études de marché" },
    { c: "74", s: "M", l: "Autres activités spécialisées, scientifiques et techniques (design, photo, traduction)" },
    { c: "75", s: "M", l: "Activités vétérinaires" },
    { c: "77", s: "N", l: "Activités de location et location-bail" },
    { c: "78", s: "N", l: "Activités liées à l'emploi (intérim, placement)" },
    { c: "79", s: "N", l: "Agences de voyage, voyagistes et services de réservation" },
    { c: "80", s: "N", l: "Enquêtes et sécurité privée" },
    { c: "81", s: "N", l: "Services relatifs aux bâtiments et aménagement paysager (nettoyage, espaces verts)" },
    { c: "82", s: "N", l: "Activités administratives et autres activités de soutien aux entreprises" },
    { c: "84", s: "O", l: "Administration publique et défense ; sécurité sociale obligatoire" },
    { c: "85", s: "P", l: "Enseignement et formation" },
    { c: "86", s: "Q", l: "Activités pour la santé humaine" },
    { c: "87", s: "Q", l: "Hébergement médico-social et social" },
    { c: "88", s: "Q", l: "Action sociale sans hébergement" },
    { c: "90", s: "R", l: "Activités créatives, artistiques et de spectacle" },
    { c: "91", s: "R", l: "Bibliothèques, archives, musées et autres activités culturelles" },
    { c: "92", s: "R", l: "Organisation de jeux de hasard et d'argent" },
    { c: "93", s: "R", l: "Activités sportives, récréatives et de loisirs" },
    { c: "94", s: "S", l: "Activités des organisations associatives" },
    { c: "95", s: "S", l: "Réparation d'ordinateurs et de biens personnels et domestiques" },
    { c: "96", s: "S", l: "Autres services personnels (coiffure, esthétique, blanchisserie, pompes funèbres)" },
    { c: "97", s: "T", l: "Activités des ménages en tant qu'employeurs de personnel domestique" },
    { c: "98", s: "T", l: "Activités indifférenciées des ménages en tant que producteurs" },
    { c: "99", s: "U", l: "Activités des organisations et organismes extra-territoriaux" }
  ];

  /* ---------------------------------------------------------- FAMILLES DE VEILLE
     « Il y a plusieurs veilles réglementaires » : chaque domaine est rattaché
     à une famille, qui correspond à un pilote et à un rythme différents.     */
  var familles = {
    social: { l: "Veille sociale", d: "Droit du travail, paie, relations collectives." },
    sst: { l: "Veille santé-sécurité", d: "Prévention des risques professionnels, vérifications, aptitudes." },
    env: { l: "Veille environnementale", d: "Eau, air, déchets, énergie, installations classées." },
    tech: { l: "Veille technique & normative", d: "Normes produits, règles de l'art, marquage CE, DTU." },
    sect: { l: "Veille sectorielle", d: "Réglementation propre au métier et autorisations d'exercer." },
    fisc: { l: "Veille fiscale & gestion", d: "Fiscalité, facturation, comptabilité, aides." },
    num: { l: "Veille numérique & données", d: "Données personnelles, cybersécurité, accessibilité." },
    juri: { l: "Veille jurisprudentielle", d: "Décisions de justice qui changent l'interprétation des textes." }
  };

  /* ---------------------------------------------------------------- DOMAINES */
  var domaines = {
    /* --- transversaux ------------------------------------------------------ */
    sst: {
      nom: "Santé et sécurité au travail",
      famille: "sst", frequence: "hebdomadaire",
      resume: "Obligation générale de sécurité de l'employeur : évaluation des risques, prévention, formation, suivi médical.",
      textes: ["Code du travail, 4e partie (santé et sécurité)", "Décrets et arrêtés d'application par risque", "Accords de branche de prévention"],
      obligations: ["DUERP rédigé, daté et mis à jour", "Formations et habilitations à jour", "Vérifications périodiques des équipements", "Suivi médical et affichages obligatoires"],
      impacts: ["juridique", "operationnel", "financier"],
      sources: [
        { nom: "INRS", url: "https://www.inrs.fr" },
        { nom: "Ministère du Travail", url: "https://travail-emploi.gouv.fr" },
        { nom: "Code du travail numérique", url: "https://code.travail.gouv.fr" }
      ]
    },
    social: {
      nom: "Droit du travail et relations sociales",
      famille: "social", frequence: "mensuelle",
      resume: "Contrats, durée du travail, rémunération, représentation du personnel, convention collective applicable.",
      textes: ["Code du travail", "Convention collective de branche (IDCC)", "Accords d'entreprise"],
      obligations: ["Convention collective identifiée et appliquée", "Affichage et registre du personnel", "Égalité professionnelle et index", "Entretiens et obligations de formation"],
      impacts: ["juridique", "financier", "social"],
      sources: [
        { nom: "Légifrance — conventions collectives", url: "https://www.legifrance.gouv.fr/liste/idcc" },
        { nom: "Ministère du Travail", url: "https://travail-emploi.gouv.fr" },
        { nom: "Cour de cassation (jurisprudence sociale)", url: "https://www.courdecassation.fr" }
      ]
    },
    paie: {
      nom: "Paie, cotisations et protection sociale",
      famille: "social", frequence: "mensuelle",
      resume: "Assiettes et taux de cotisations, exonérations, DSN, SMIC et minima conventionnels.",
      textes: ["Code de la sécurité sociale", "Bulletin officiel de la Sécurité sociale (BOSS)", "Lois de financement de la sécurité sociale"],
      obligations: ["Taux et plafonds à jour dans le logiciel de paie", "DSN mensuelle conforme", "Minima conventionnels respectés", "Suivi des exonérations et aides à l'embauche"],
      impacts: ["financier", "juridique"],
      sources: [
        { nom: "BOSS — Bulletin officiel de la Sécurité sociale", url: "https://boss.gouv.fr" },
        { nom: "URSSAF", url: "https://www.urssaf.fr" },
        { nom: "Net-entreprises (DSN)", url: "https://www.net-entreprises.fr" }
      ]
    },
    fiscal: {
      nom: "Fiscalité, facturation et comptabilité",
      famille: "fisc", frequence: "mensuelle",
      resume: "TVA, impôt sur les bénéfices, taxes locales, obligations de facturation et de tenue des comptes.",
      textes: ["Code général des impôts", "Livre des procédures fiscales", "Loi de finances annuelle", "Plan comptable général"],
      obligations: ["Mentions obligatoires sur les factures", "Échéancier déclaratif respecté", "Préparation de la facturation électronique", "Conservation des pièces justificatives"],
      impacts: ["financier", "juridique"],
      sources: [
        { nom: "BOFiP — doctrine fiscale", url: "https://bofip.impots.gouv.fr" },
        { nom: "impots.gouv.fr — professionnels", url: "https://www.impots.gouv.fr/professionnel" },
        { nom: "Entreprendre — service-public.fr", url: "https://entreprendre.service-public.fr" }
      ]
    },
    rgpd: {
      nom: "Données personnelles (RGPD)",
      famille: "num", frequence: "mensuelle",
      resume: "Traitements de données de salariés, clients ou prospects : base légale, information, durées, sécurité, sous-traitance.",
      textes: ["Règlement (UE) 2016/679 — RGPD", "Loi Informatique et Libertés", "Lignes directrices et sanctions CNIL"],
      obligations: ["Registre des traitements tenu à jour", "Mentions d'information et gestion des droits", "Contrats de sous-traitance conformes", "Procédure de violation de données"],
      impacts: ["juridique", "financier", "reputation"],
      sources: [
        { nom: "CNIL", url: "https://www.cnil.fr" },
        { nom: "CNIL — professionnels", url: "https://www.cnil.fr/fr/professionnel" },
        { nom: "EUR-Lex", url: "https://eur-lex.europa.eu" }
      ]
    },
    cyber: {
      nom: "Cybersécurité et systèmes d'information",
      famille: "num", frequence: "mensuelle",
      resume: "Sécurisation du SI, gestion des incidents, exigences de la directive NIS 2 pour les entités concernées.",
      textes: ["Directive (UE) 2022/2555 (NIS 2) et sa transposition", "Référentiels et guides ANSSI"],
      obligations: ["Sauvegardes testées et restaurables", "Gestion des accès et des mots de passe", "Procédure de notification d'incident", "Sensibilisation des équipes"],
      impacts: ["operationnel", "financier", "reputation"],
      sources: [
        { nom: "ANSSI / cyber.gouv.fr", url: "https://cyber.gouv.fr" },
        { nom: "Cybermalveillance.gouv.fr", url: "https://www.cybermalveillance.gouv.fr" }
      ]
    },
    jurisprudence: {
      nom: "Jurisprudence et contentieux",
      famille: "juri", frequence: "mensuelle",
      resume: "Décisions de justice qui changent l'interprétation des textes déjà applicables : revirements, sanctions, condamnations dans votre secteur.",
      textes: ["Décisions de la Cour de cassation (chambres sociale, commerciale, criminelle)", "Décisions du Conseil d'État", "Arrêts de la Cour de justice de l'Union européenne"],
      obligations: ["Sources jurisprudentielles identifiées par famille de veille", "Décisions marquantes qualifiées et transmises aux services concernés", "Contrats, procédures et documents ajustés après un revirement"],
      impacts: ["juridique", "financier", "reputation"],
      sources: [
        { nom: "Cour de cassation", url: "https://www.courdecassation.fr" },
        { nom: "Conseil d'État", url: "https://www.conseil-etat.fr" },
        { nom: "Légifrance", url: "https://www.legifrance.gouv.fr" }
      ]
    },
    env_general: {
      nom: "Environnement — socle commun",
      famille: "env", frequence: "trimestrielle",
      resume: "Tri et traçabilité des déchets de l'entreprise, sobriété énergétique, mobilité, informations environnementales.",
      textes: ["Code de l'environnement", "Loi AGEC (économie circulaire)", "Obligations de tri dites « 5 flux »"],
      obligations: ["Tri à la source et contrats d'enlèvement", "Bordereaux et registre des déchets", "Suivi des consommations d'énergie", "Affichage des consignes de tri"],
      impacts: ["operationnel", "financier", "juridique"],
      sources: [
        { nom: "Ministère de la Transition écologique", url: "https://www.ecologie.gouv.fr" },
        { nom: "ADEME", url: "https://www.ademe.fr" }
      ]
    },

    /* --- environnement & industrie ---------------------------------------- */
    icpe: {
      nom: "Installations classées (ICPE)",
      famille: "env", frequence: "hebdomadaire",
      resume: "Activités soumises à déclaration, enregistrement ou autorisation au titre de la nomenclature ICPE.",
      textes: ["Code de l'environnement, livre V", "Nomenclature des installations classées", "Arrêtés ministériels de prescriptions générales", "Arrêté préfectoral propre au site"],
      obligations: ["Régime ICPE identifié et à jour", "Prescriptions de l'arrêté respectées", "Contrôles et mesures périodiques", "Registres et déclaration annuelle (GEREP)"],
      impacts: ["juridique", "operationnel", "financier"],
      sources: [
        { nom: "AIDA — réglementation ICPE (INERIS)", url: "https://aida.ineris.fr" },
        { nom: "Installations classées — service de l'État", url: "https://www.georisques.gouv.fr" },
        { nom: "Ministère de la Transition écologique", url: "https://www.ecologie.gouv.fr" }
      ]
    },
    dechets: {
      nom: "Déchets, REP et économie circulaire",
      famille: "env", frequence: "mensuelle",
      resume: "Responsabilité du producteur de déchets, filières à responsabilité élargie (REP), traçabilité et valorisation.",
      textes: ["Code de l'environnement, livre V titre IV", "Loi AGEC", "Arrêtés de filières REP"],
      obligations: ["Registre des déchets et bordereaux (Trackdéchets)", "Adhésion à l'éco-organisme de la filière", "Éco-contribution et information du consommateur", "Contrats avec des exutoires autorisés"],
      impacts: ["financier", "operationnel", "juridique"],
      sources: [
        { nom: "Trackdéchets", url: "https://trackdechets.beta.gouv.fr" },
        { nom: "ADEME — filières REP", url: "https://www.ademe.fr" },
        { nom: "Ministère de la Transition écologique", url: "https://www.ecologie.gouv.fr" }
      ]
    },
    eau: {
      nom: "Eau, rejets et milieux aquatiques",
      famille: "env", frequence: "mensuelle",
      resume: "Prélèvements, raccordement et rejets d'eaux usées ou pluviales, autorisations et redevances.",
      textes: ["Code de l'environnement (loi sur l'eau)", "Arrêtés de prescriptions de rejet", "Règlement d'assainissement local"],
      obligations: ["Autorisation de déversement à jour", "Auto-surveillance des rejets", "Gestion des eaux pluviales et rétention", "Redevances agence de l'eau"],
      impacts: ["operationnel", "financier", "juridique"],
      sources: [
        { nom: "Ministère de la Transition écologique — eau", url: "https://www.ecologie.gouv.fr" },
        { nom: "Office français de la biodiversité", url: "https://www.ofb.gouv.fr" }
      ]
    },
    air: {
      nom: "Air, émissions et nuisances",
      famille: "env", frequence: "trimestrielle",
      resume: "Émissions atmosphériques, poussières, COV, odeurs et bruit de voisinage industriel.",
      textes: ["Code de l'environnement", "Arrêtés d'émissions applicables à l'activité", "Réglementation du bruit de voisinage"],
      obligations: ["Mesures périodiques d'émissions", "Entretien des dispositifs de captation", "Suivi des plaintes de riverains", "Déclaration des émissions"],
      impacts: ["operationnel", "juridique", "reputation"],
      sources: [
        { nom: "Ministère de la Transition écologique", url: "https://www.ecologie.gouv.fr" },
        { nom: "AIDA (INERIS)", url: "https://aida.ineris.fr" }
      ]
    },
    energie_tertiaire: {
      nom: "Performance énergétique des bâtiments d'activité",
      famille: "env", frequence: "trimestrielle",
      resume: "Réduction des consommations des bâtiments tertiaires, pilotage des équipements techniques, audits.",
      textes: ["Code de la construction et de l'habitation", "Dispositif éco-énergie tertiaire (décret tertiaire)", "Réglementation sur les systèmes d'automatisation (BACS)"],
      obligations: ["Déclaration annuelle des consommations (OPERAT)", "Plan d'actions de réduction", "Pilotage / GTB des installations", "Audit énergétique si seuils atteints"],
      impacts: ["financier", "operationnel"],
      sources: [
        { nom: "OPERAT (ADEME)", url: "https://operat.ademe.fr" },
        { nom: "Ministère de la Transition écologique", url: "https://www.ecologie.gouv.fr" }
      ]
    },
    chimie: {
      nom: "Produits chimiques et risque chimique",
      famille: "sst", frequence: "hebdomadaire",
      resume: "Classification, étiquetage, fiches de données de sécurité, substances soumises à autorisation ou restriction.",
      textes: ["Règlement (CE) 1907/2006 REACH", "Règlement (CE) 1272/2008 CLP", "Code du travail — risque chimique et ACD/CMR"],
      obligations: ["FDS à jour et accessibles", "Inventaire des substances et repérage CMR", "Ventilation et EPI adaptés", "Contrôle des valeurs limites d'exposition"],
      impacts: ["juridique", "operationnel", "financier"],
      sources: [
        { nom: "ECHA — Agence européenne des produits chimiques", url: "https://echa.europa.eu" },
        { nom: "INRS — risque chimique", url: "https://www.inrs.fr" },
        { nom: "ANSES", url: "https://www.anses.fr" }
      ]
    },
    atex: {
      nom: "Risques industriels majeurs et ATEX",
      famille: "sst", frequence: "hebdomadaire",
      resume: "Atmosphères explosives, stockage de produits dangereux, établissements relevant de la directive Seveso.",
      textes: ["Directive 2012/18/UE (Seveso 3)", "Code du travail — ATEX", "Arrêtés de stockage de liquides inflammables"],
      obligations: ["Document relatif à la protection contre les explosions", "Zonage ATEX et matériel conforme", "Plan d'opération interne si requis", "Étude de dangers tenue à jour"],
      impacts: ["juridique", "operationnel", "financier"],
      sources: [
        { nom: "INRS — ATEX", url: "https://www.inrs.fr" },
        { nom: "AIDA (INERIS)", url: "https://aida.ineris.fr" }
      ]
    },
    extractive: {
      nom: "Activités extractives et code minier",
      famille: "sect", frequence: "mensuelle",
      resume: "Titres miniers et autorisations de carrière, remise en état des sites, sécurité des travaux souterrains.",
      textes: ["Code minier", "Code de l'environnement (carrières en ICPE)", "Règlement général des industries extractives"],
      obligations: ["Titre ou autorisation valide", "Garanties financières de remise en état", "Plan de tirs et sécurité des fronts", "Suivi des poussières et vibrations"],
      impacts: ["juridique", "financier", "operationnel"],
      sources: [
        { nom: "Ministère de la Transition écologique", url: "https://www.ecologie.gouv.fr" },
        { nom: "AIDA (INERIS)", url: "https://aida.ineris.fr" }
      ]
    },
    energie_reseau: {
      nom: "Production et fourniture d'énergie",
      famille: "sect", frequence: "hebdomadaire",
      resume: "Autorisations de production, accès aux réseaux, obligations d'achat, protection des consommateurs d'énergie.",
      textes: ["Code de l'énergie", "Délibérations de la CRE", "Règles de raccordement des gestionnaires de réseau"],
      obligations: ["Autorisations et contrats d'accès à jour", "Obligations de comptage et de déclaration", "Conformité des contrats de fourniture", "Suivi des tarifs réglementés"],
      impacts: ["financier", "juridique", "operationnel"],
      sources: [
        { nom: "Commission de régulation de l'énergie", url: "https://www.cre.fr" },
        { nom: "Ministère de la Transition écologique — énergie", url: "https://www.ecologie.gouv.fr" }
      ]
    },

    /* --- construction & équipements --------------------------------------- */
    construction: {
      nom: "Règles de construction et d'ouvrage",
      famille: "tech", frequence: "hebdomadaire",
      resume: "Règles techniques de construction, performance énergétique et environnementale, autorisations d'urbanisme, garanties.",
      textes: ["Code de la construction et de l'habitation", "Code de l'urbanisme", "RE2020", "DTU et normes NF applicables", "Code civil — garanties légales"],
      obligations: ["Assurance décennale et RC pro en cours", "Respect des DTU et règles de l'art", "Attestations thermiques et environnementales", "Réception des travaux et lever des réserves"],
      impacts: ["juridique", "financier", "operationnel"],
      sources: [
        { nom: "RT-Bâtiment / RE2020", url: "https://www.rt-batiment.fr" },
        { nom: "CSTB", url: "https://www.cstb.fr" },
        { nom: "Boutique AFNOR — DTU et normes", url: "https://www.boutique.afnor.org" }
      ]
    },
    chantier_sps: {
      nom: "Sécurité des chantiers et coordination",
      famille: "sst", frequence: "hebdomadaire",
      resume: "Prévention sur les opérations de bâtiment et génie civil : coordination SPS, plans de prévention, co-activité.",
      textes: ["Code du travail — chantiers de bâtiment et génie civil", "Règles de coordination SPS", "Recommandations OPPBTP"],
      obligations: ["PPSPS / plan de prévention établi", "Déclaration préalable et registre-journal", "Accueil sécurité des intervenants", "Vérification des échafaudages et protections"],
      impacts: ["juridique", "operationnel", "financier"],
      sources: [
        { nom: "OPPBTP", url: "https://www.preventionbtp.fr" },
        { nom: "INRS — BTP", url: "https://www.inrs.fr" }
      ]
    },
    amiante: {
      nom: "Amiante, plomb et matériaux dangereux du bâti",
      famille: "sst", frequence: "hebdomadaire",
      resume: "Repérage avant travaux, sous-sections 3 et 4, protection des travailleurs et gestion des déchets dangereux.",
      textes: ["Code du travail — risque amiante", "Code de la santé publique — repérages", "Arrêtés de formation et de certification"],
      obligations: ["Repérage avant travaux exigé du donneur d'ordre", "Certification de l'entreprise si retrait", "Mode opératoire ou plan de retrait", "Traçabilité des déchets amiantés"],
      impacts: ["juridique", "operationnel", "financier"],
      sources: [
        { nom: "INRS — amiante", url: "https://www.inrs.fr" },
        { nom: "Ministère du Travail — amiante", url: "https://travail-emploi.gouv.fr" }
      ]
    },
    levage: {
      nom: "Équipements de travail, levage et vérifications",
      famille: "sst", frequence: "mensuelle",
      resume: "Conformité des machines et engins, vérifications générales périodiques, conduite et habilitations.",
      textes: ["Code du travail — équipements de travail", "Arrêtés de vérifications périodiques", "Règlement (UE) 2023/1230 sur les machines"],
      obligations: ["Registre de sécurité et rapports de VGP", "Autorisations de conduite et CACES", "Carnets de maintenance des engins", "Contrôle des accessoires de levage"],
      impacts: ["operationnel", "juridique", "financier"],
      sources: [
        { nom: "INRS — équipements de travail", url: "https://www.inrs.fr" },
        { nom: "Ministère du Travail", url: "https://travail-emploi.gouv.fr" }
      ]
    },
    erp: {
      nom: "Locaux recevant du public : incendie et accessibilité",
      famille: "tech", frequence: "trimestrielle",
      resume: "Classement ERP, sécurité incendie, accessibilité des personnes handicapées, contrôles périodiques.",
      textes: ["Code de la construction et de l'habitation", "Règlement de sécurité contre l'incendie dans les ERP", "Règles d'accessibilité des ERP"],
      obligations: ["Registre de sécurité tenu à jour", "Vérifications des installations techniques", "Exercices d'évacuation", "Registre public d'accessibilité"],
      impacts: ["juridique", "operationnel", "financier"],
      sources: [
        { nom: "Service-public — ERP", url: "https://entreprendre.service-public.fr" },
        { nom: "Légifrance", url: "https://www.legifrance.gouv.fr" }
      ]
    },
    produits_ce: {
      nom: "Conformité des produits et marquage CE",
      famille: "tech", frequence: "mensuelle",
      resume: "Exigences essentielles applicables aux produits mis sur le marché, documentation technique, déclaration UE.",
      textes: ["Règlements et directives d'harmonisation de l'UE", "Normes harmonisées citées au JOUE", "Code de la consommation — conformité et sécurité"],
      obligations: ["Déclaration UE de conformité et dossier technique", "Notices et étiquetage conformes", "Traçabilité des lots et des fournisseurs", "Surveillance des rappels de produits"],
      impacts: ["juridique", "financier", "reputation"],
      sources: [
        { nom: "EUR-Lex", url: "https://eur-lex.europa.eu" },
        { nom: "Commission européenne — marché intérieur", url: "https://single-market-economy.ec.europa.eu" },
        { nom: "RappelConso", url: "https://rappel.conso.gouv.fr" }
      ]
    },

    /* --- commerce, produits, consommation --------------------------------- */
    consommation: {
      nom: "Droit de la consommation et pratiques commerciales",
      famille: "sect", frequence: "mensuelle",
      resume: "Information précontractuelle, prix, garanties, démarchage, vente à distance, clauses abusives.",
      textes: ["Code de la consommation", "Code de commerce — pratiques restrictives", "Règles de la vente en ligne"],
      obligations: ["CGV et information sur les prix conformes", "Droit de rétractation et garanties affichés", "Médiateur de la consommation désigné", "Conformité des promotions et soldes"],
      impacts: ["juridique", "financier", "reputation"],
      sources: [
        { nom: "DGCCRF", url: "https://www.economie.gouv.fr/dgccrf" },
        { nom: "Entreprendre — service-public.fr", url: "https://entreprendre.service-public.fr" }
      ]
    },
    alimentaire: {
      nom: "Hygiène et sécurité des aliments",
      famille: "sect", frequence: "hebdomadaire",
      resume: "Paquet hygiène, plan de maîtrise sanitaire, HACCP, étiquetage et information du consommateur.",
      textes: ["Règlement (CE) 178/2002", "Règlement (CE) 852/2004", "Règlement (UE) 1169/2011 (INCO)", "Code rural et de la pêche maritime"],
      obligations: ["Déclaration d'activité et agrément si requis", "Plan de maîtrise sanitaire et HACCP", "Traçabilité et gestion des retraits-rappels", "Formation hygiène du personnel"],
      impacts: ["juridique", "operationnel", "reputation"],
      sources: [
        { nom: "Ministère de l'Agriculture", url: "https://agriculture.gouv.fr" },
        { nom: "ANSES", url: "https://www.anses.fr" },
        { nom: "RappelConso", url: "https://rappel.conso.gouv.fr" }
      ]
    },
    agri: {
      nom: "Agriculture, pêche et santé des végétaux et animaux",
      famille: "sect", frequence: "mensuelle",
      resume: "Aides PAC et conditionnalité, produits phytopharmaceutiques, bien-être animal, quotas et licences de pêche.",
      textes: ["Code rural et de la pêche maritime", "Règlements PAC", "Réglementation sur les produits phytopharmaceutiques"],
      obligations: ["Registre phytosanitaire et certificat (Certiphyto)", "Respect des zones de non-traitement", "Identification et registre des animaux", "Déclarations PAC dans les délais"],
      impacts: ["financier", "juridique", "operationnel"],
      sources: [
        { nom: "Ministère de l'Agriculture", url: "https://agriculture.gouv.fr" },
        { nom: "Chambres d'agriculture", url: "https://chambres-agriculture.fr" },
        { nom: "ANSES", url: "https://www.anses.fr" }
      ]
    },
    douane: {
      nom: "Douane et échanges internationaux",
      famille: "sect", frequence: "mensuelle",
      resume: "Classement tarifaire, origine, régimes douaniers, contrôles à l'import-export et sanctions internationales.",
      textes: ["Code des douanes de l'Union", "Code des douanes national", "Mesures restrictives de l'UE"],
      obligations: ["Numéro EORI et déclarations conformes", "Justification de l'origine et des préférences", "Contrôle des listes de sanctions", "Archivage des documents douaniers"],
      impacts: ["financier", "juridique", "operationnel"],
      sources: [
        { nom: "Douane française", url: "https://www.douane.gouv.fr" },
        { nom: "EUR-Lex", url: "https://eur-lex.europa.eu" }
      ]
    },

    /* --- transport --------------------------------------------------------- */
    transport: {
      nom: "Transport, logistique et marchandises dangereuses",
      famille: "sect", frequence: "hebdomadaire",
      resume: "Accès à la profession, temps de conduite et de repos, chronotachygraphe, transport de matières dangereuses.",
      textes: ["Code des transports", "Règlements européens sur les temps de conduite et le tachygraphe", "Accord ADR"],
      obligations: ["Licence de transport et capacité professionnelle", "Suivi des temps de conduite et de repos", "Conseiller à la sécurité ADR si concerné", "Contrôles techniques et arrimage des charges"],
      impacts: ["juridique", "operationnel", "financier"],
      sources: [
        { nom: "Ministère de la Transition écologique — transports", url: "https://www.ecologie.gouv.fr" },
        { nom: "Légifrance — Code des transports", url: "https://www.legifrance.gouv.fr" }
      ]
    },

    /* --- santé, social, professions réglementées -------------------------- */
    sanitaire: {
      nom: "Santé, médico-social et autorisations d'activité",
      famille: "sect", frequence: "hebdomadaire",
      resume: "Autorisations et agréments, qualité et sécurité des soins, droits des usagers, évaluation des établissements.",
      textes: ["Code de la santé publique", "Code de l'action sociale et des familles", "Référentiels d'évaluation nationaux"],
      obligations: ["Autorisation d'activité en cours de validité", "Déclaration des événements indésirables graves", "Projet d'établissement et droits des usagers", "Démarche qualité et évaluation périodique"],
      impacts: ["juridique", "operationnel", "reputation"],
      sources: [
        { nom: "Ministère de la Santé", url: "https://sante.gouv.fr" },
        { nom: "Haute Autorité de santé", url: "https://www.has-sante.fr" },
        { nom: "Agences régionales de santé", url: "https://www.ars.sante.fr" }
      ]
    },
    pharma: {
      nom: "Produits de santé et dispositifs médicaux",
      famille: "sect", frequence: "quotidienne",
      resume: "Autorisations de mise sur le marché, bonnes pratiques, vigilance, publicité des produits de santé.",
      textes: ["Code de la santé publique", "Règlement (UE) 2017/745 sur les dispositifs médicaux", "Bonnes pratiques de fabrication et de distribution"],
      obligations: ["Autorisations et certificats à jour", "Système qualité et traçabilité des lots", "Déclarations de vigilance", "Contrôle de la publicité et des liens d'intérêts"],
      impacts: ["juridique", "financier", "reputation"],
      sources: [
        { nom: "ANSM", url: "https://ansm.sante.fr" },
        { nom: "Agence européenne des médicaments", url: "https://www.ema.europa.eu" }
      ]
    },
    deontologie: {
      nom: "Professions réglementées et déontologie",
      famille: "sect", frequence: "mensuelle",
      resume: "Conditions d'exercice, inscription à un ordre ou une instance, obligations de formation et de secret professionnel.",
      textes: ["Textes propres à chaque profession", "Codes de déontologie", "Obligations de formation continue"],
      obligations: ["Inscription et assurance professionnelle à jour", "Formation continue justifiée", "Secret professionnel et conflits d'intérêts", "Obligations de mandat et de facturation"],
      impacts: ["juridique", "reputation", "financier"],
      sources: [
        { nom: "Légifrance", url: "https://www.legifrance.gouv.fr" },
        { nom: "Entreprendre — activités réglementées", url: "https://entreprendre.service-public.fr" }
      ]
    },

    /* --- finance, immobilier, services ------------------------------------ */
    finance: {
      nom: "Services financiers, assurance et LCB-FT",
      famille: "sect", frequence: "quotidienne",
      resume: "Agréments et immatriculations, information et conseil du client, lutte contre le blanchiment et le financement du terrorisme.",
      textes: ["Code monétaire et financier", "Code des assurances", "Règlements européens et doctrine des autorités"],
      obligations: ["Agrément ou immatriculation ORIAS valide", "Dispositif LCB-FT et gel des avoirs", "Devoir de conseil formalisé", "Reporting réglementaire dans les délais"],
      impacts: ["juridique", "financier", "reputation"],
      sources: [
        { nom: "ACPR", url: "https://acpr.banque-france.fr" },
        { nom: "AMF", url: "https://www.amf-france.org" },
        { nom: "ORIAS", url: "https://www.orias.fr" }
      ]
    },
    immobilier: {
      nom: "Activités immobilières et gestion locative",
      famille: "sect", frequence: "mensuelle",
      resume: "Carte professionnelle, mandats, diagnostics obligatoires, encadrement des loyers et copropriété.",
      textes: ["Loi Hoguet et son décret d'application", "Code de la construction et de l'habitation", "Loi du 6 juillet 1989 sur les baux d'habitation"],
      obligations: ["Carte professionnelle et garantie financière", "Mandats écrits et registres", "Diagnostics et DPE annexés", "Décence et performance énergétique des logements loués"],
      impacts: ["juridique", "financier", "operationnel"],
      sources: [
        { nom: "Entreprendre — agent immobilier", url: "https://entreprendre.service-public.fr" },
        { nom: "Ministère du Logement", url: "https://www.ecologie.gouv.fr" },
        { nom: "ANIL", url: "https://www.anil.org" }
      ]
    },
    marches_publics: {
      nom: "Commande publique",
      famille: "sect", frequence: "mensuelle",
      resume: "Règles de passation et d'exécution des marchés publics, sous-traitance, délais de paiement, avances et révisions.",
      textes: ["Code de la commande publique", "Cahiers des clauses administratives générales", "Directives européennes marchés"],
      obligations: ["Attestations sociales et fiscales à jour", "Déclaration de sous-traitance agréée", "Respect des formalismes de facturation (Chorus Pro)", "Suivi des pénalités et des révisions de prix"],
      impacts: ["financier", "juridique", "operationnel"],
      sources: [
        { nom: "Direction des affaires juridiques — commande publique", url: "https://www.economie.gouv.fr/daj" },
        { nom: "BOAMP", url: "https://www.boamp.fr" },
        { nom: "Chorus Pro", url: "https://portail.chorus-pro.gouv.fr" }
      ]
    },
    travail_temporaire: {
      nom: "Intérim, placement et mise à disposition",
      famille: "social", frequence: "mensuelle",
      resume: "Garantie financière, contrats de mission, égalité de traitement, obligations envers l'entreprise utilisatrice.",
      textes: ["Code du travail — travail temporaire", "Déclarations obligatoires aux autorités", "Convention collective du travail temporaire"],
      obligations: ["Garantie financière et déclaration d'activité", "Contrats de mission et de mise à disposition", "Suivi médical et sécurité des intérimaires", "Relevé mensuel des contrats"],
      impacts: ["juridique", "financier", "operationnel"],
      sources: [
        { nom: "Ministère du Travail", url: "https://travail-emploi.gouv.fr" },
        { nom: "Code du travail numérique", url: "https://code.travail.gouv.fr" }
      ]
    },
    securite_privee: {
      nom: "Sécurité privée et surveillance",
      famille: "sect", frequence: "mensuelle",
      resume: "Autorisation d'exercice, cartes professionnelles des agents, déontologie et encadrement des prestations.",
      textes: ["Code de la sécurité intérieure", "Code de déontologie des activités privées de sécurité"],
      obligations: ["Autorisation d'exercice et agréments dirigeants", "Cartes professionnelles valides", "Registres et tenue des agents", "Contrats conformes et information du client"],
      impacts: ["juridique", "operationnel", "reputation"],
      sources: [
        { nom: "CNAPS", url: "https://www.cnaps.interieur.gouv.fr" },
        { nom: "Légifrance", url: "https://www.legifrance.gouv.fr" }
      ]
    },
    enseignement: {
      nom: "Enseignement, formation et certification qualité",
      famille: "sect", frequence: "mensuelle",
      resume: "Déclaration d'activité, référentiel qualité pour les financements, apprentissage, protection des mineurs.",
      textes: ["Code de l'éducation", "Code du travail — formation professionnelle", "Référentiel national qualité (Qualiopi)"],
      obligations: ["Déclaration d'activité et bilan pédagogique", "Certification qualité si financements publics", "Conventions et information des stagiaires", "Encadrement et sécurité des apprenants"],
      impacts: ["financier", "juridique", "operationnel"],
      sources: [
        { nom: "Ministère du Travail — formation", url: "https://travail-emploi.gouv.fr" },
        { nom: "France compétences", url: "https://www.francecompetences.fr" }
      ]
    },
    culture_spectacle: {
      nom: "Spectacle vivant, audiovisuel et droits d'auteur",
      famille: "sect", frequence: "mensuelle",
      resume: "Licence d'entrepreneur de spectacles, emploi d'artistes, droits d'auteur et droits voisins, sécurité des lieux.",
      textes: ["Code du travail — spectacle et intermittents", "Code de la propriété intellectuelle", "Réglementation des lieux de spectacle"],
      obligations: ["Récépissé de déclaration d'entrepreneur de spectacles", "Contrats d'engagement et GUSO", "Déclarations aux sociétés de gestion collective", "Sécurité du public et des installations temporaires"],
      impacts: ["juridique", "financier", "operationnel"],
      sources: [
        { nom: "Ministère de la Culture", url: "https://www.culture.gouv.fr" },
        { nom: "GUSO", url: "https://www.guso.fr" }
      ]
    },
    propriete_intel: {
      nom: "Propriété intellectuelle et contenus",
      famille: "sect", frequence: "trimestrielle",
      resume: "Droits d'auteur et droits voisins, marques, cession de droits, exploitation des contenus et des images.",
      textes: ["Code de la propriété intellectuelle", "Directives européennes sur le droit d'auteur"],
      obligations: ["Cessions de droits écrites", "Autorisations d'image et de voix", "Surveillance des marques et noms de domaine", "Mentions de crédits et de sources"],
      impacts: ["juridique", "financier", "reputation"],
      sources: [
        { nom: "INPI", url: "https://www.inpi.fr" },
        { nom: "Ministère de la Culture", url: "https://www.culture.gouv.fr" }
      ]
    },
    telecom: {
      nom: "Communications électroniques et audiovisuel",
      famille: "sect", frequence: "mensuelle",
      resume: "Déclaration d'opérateur, qualité de service, protection des abonnés, obligations des services audiovisuels.",
      textes: ["Code des postes et des communications électroniques", "Décisions de l'ARCEP", "Réglementation des services audiovisuels"],
      obligations: ["Déclaration d'activité auprès du régulateur", "Obligations contractuelles envers les abonnés", "Conservation et confidentialité des données de trafic", "Obligations de couverture et de reporting"],
      impacts: ["juridique", "financier", "operationnel"],
      sources: [
        { nom: "ARCEP", url: "https://www.arcep.fr" },
        { nom: "ARCOM", url: "https://www.arcom.fr" }
      ]
    },
    accessibilite_num: {
      nom: "Accessibilité numérique",
      famille: "num", frequence: "trimestrielle",
      resume: "Accessibilité des sites et applications, déclaration de conformité, schéma pluriannuel pour les acteurs concernés.",
      textes: ["Référentiel général d'amélioration de l'accessibilité (RGAA)", "Directive (UE) 2019/882 (accessibilité des produits et services)"],
      obligations: ["Audit d'accessibilité et déclaration", "Schéma pluriannuel de mise en conformité", "Page d'aide et contact accessibilité", "Prise en compte dès la conception"],
      impacts: ["juridique", "reputation", "operationnel"],
      sources: [
        { nom: "accessibilite.numerique.gouv.fr", url: "https://accessibilite.numerique.gouv.fr" },
        { nom: "EUR-Lex", url: "https://eur-lex.europa.eu" }
      ]
    },
    jeux: {
      nom: "Jeux d'argent et de hasard",
      famille: "sect", frequence: "hebdomadaire",
      resume: "Agréments et licences, protection des joueurs, lutte contre le blanchiment, encadrement de la publicité.",
      textes: ["Code de la sécurité intérieure", "Réglementation des jeux en ligne", "Décisions de l'Autorité nationale des jeux"],
      obligations: ["Agrément ou licence en cours", "Dispositif de jeu responsable et interdits de jeu", "Dispositif LCB-FT", "Encadrement des communications commerciales"],
      impacts: ["juridique", "financier", "reputation"],
      sources: [
        { nom: "Autorité nationale des jeux", url: "https://anj.fr" },
        { nom: "Légifrance", url: "https://www.legifrance.gouv.fr" }
      ]
    },
    sport: {
      nom: "Activités physiques et sportives",
      famille: "sect", frequence: "mensuelle",
      resume: "Déclaration des éducateurs et des établissements, sécurité des équipements, encadrement des mineurs.",
      textes: ["Code du sport", "Arrêtés relatifs aux équipements et aux diplômes"],
      obligations: ["Déclaration de l'établissement APS", "Diplômes et cartes professionnelles des éducateurs", "Affichage des garanties et assurances", "Contrôle des équipements et normes de sécurité"],
      impacts: ["juridique", "operationnel", "reputation"],
      sources: [
        { nom: "Ministère des Sports", url: "https://www.sports.gouv.fr" },
        { nom: "Légifrance — Code du sport", url: "https://www.legifrance.gouv.fr" }
      ]
    },
    hotellerie: {
      nom: "Hébergement touristique et accueil",
      famille: "sect", frequence: "mensuelle",
      resume: "Classement et déclaration d'activité, taxe de séjour, fiche individuelle de police, sécurité des hébergements.",
      textes: ["Code du tourisme", "Code général des collectivités territoriales (taxe de séjour)", "Règlement de sécurité des ERP de type O"],
      obligations: ["Déclaration en mairie et classement", "Collecte et reversement de la taxe de séjour", "Affichage des prix et information du client", "Sécurité incendie et registre de sécurité"],
      impacts: ["financier", "juridique", "operationnel"],
      sources: [
        { nom: "Entreprendre — hébergement touristique", url: "https://entreprendre.service-public.fr" },
        { nom: "Atout France", url: "https://www.atout-france.fr" }
      ]
    },
    association: {
      nom: "Régime associatif et subventions",
      famille: "sect", frequence: "trimestrielle",
      resume: "Obligations déclaratives, gestion désintéressée et fiscalité, contrôle de l'emploi des subventions, bénévolat.",
      textes: ["Loi du 1er juillet 1901", "Code général des impôts — régime des organismes sans but lucratif", "Contrat d'engagement républicain"],
      obligations: ["Déclarations de modification en préfecture", "Comptes annuels et commissaire si seuils", "Justification de l'emploi des subventions", "Encadrement du bénévolat et des défraiements"],
      impacts: ["financier", "juridique"],
      sources: [
        { nom: "Associations — service-public.fr", url: "https://www.service-public.fr/associations" },
        { nom: "Légifrance", url: "https://www.legifrance.gouv.fr" }
      ]
    }
  };

  /* -------------------------------------------- DOMAINES TRANSVERSAUX (tous) */
  var transversaux = ["sst", "social", "paie", "fiscal", "rgpd", "cyber", "jurisprudence", "env_general"];

  /* ------------------------------------ MATRICE DIVISION NAF -> DOMAINES ---- */
  var parDivision = {
    "01": ["agri", "chimie", "icpe", "eau", "dechets", "alimentaire"],
    "02": ["agri", "levage", "icpe", "dechets"],
    "03": ["agri", "alimentaire", "eau", "transport"],
    "05": ["extractive", "icpe", "air", "eau", "atex"],
    "06": ["extractive", "icpe", "atex", "air", "energie_reseau"],
    "07": ["extractive", "icpe", "eau", "air", "chimie"],
    "08": ["extractive", "icpe", "air", "eau", "levage", "transport"],
    "09": ["extractive", "icpe", "levage", "chimie"],
    "10": ["alimentaire", "icpe", "eau", "consommation", "dechets", "produits_ce"],
    "11": ["alimentaire", "icpe", "consommation", "douane", "eau"],
    "12": ["consommation", "douane", "icpe", "produits_ce"],
    "13": ["produits_ce", "chimie", "icpe", "dechets", "consommation"],
    "14": ["produits_ce", "consommation", "dechets", "douane"],
    "15": ["chimie", "produits_ce", "icpe", "consommation", "dechets"],
    "16": ["produits_ce", "chimie", "icpe", "levage", "dechets", "construction"],
    "17": ["icpe", "eau", "dechets", "chimie", "air"],
    "18": ["chimie", "icpe", "dechets", "propriete_intel"],
    "19": ["icpe", "atex", "air", "eau", "chimie", "energie_reseau"],
    "20": ["chimie", "icpe", "atex", "air", "eau", "produits_ce"],
    "21": ["pharma", "chimie", "icpe", "produits_ce", "dechets"],
    "22": ["chimie", "icpe", "produits_ce", "dechets", "air"],
    "23": ["icpe", "air", "produits_ce", "construction", "extractive", "levage"],
    "24": ["icpe", "air", "eau", "chimie", "atex", "levage"],
    "25": ["produits_ce", "chimie", "icpe", "levage", "dechets"],
    "26": ["produits_ce", "dechets", "chimie", "cyber"],
    "27": ["produits_ce", "dechets", "chimie", "icpe"],
    "28": ["produits_ce", "levage", "chimie", "icpe"],
    "29": ["produits_ce", "dechets", "chimie", "icpe", "levage"],
    "30": ["produits_ce", "transport", "chimie", "icpe"],
    "31": ["produits_ce", "dechets", "chimie", "consommation"],
    "32": ["produits_ce", "chimie", "dechets", "consommation"],
    "33": ["levage", "produits_ce", "chimie", "dechets"],
    "35": ["energie_reseau", "icpe", "atex", "air", "consommation"],
    "36": ["eau", "icpe", "sanitaire", "consommation"],
    "37": ["eau", "icpe", "dechets", "air"],
    "38": ["dechets", "icpe", "transport", "eau", "levage"],
    "39": ["dechets", "icpe", "amiante", "chimie", "eau"],
    "41": ["construction", "chantier_sps", "amiante", "levage", "dechets", "marches_publics"],
    "42": ["construction", "chantier_sps", "marches_publics", "levage", "dechets", "eau"],
    "43": ["construction", "chantier_sps", "amiante", "levage", "chimie", "dechets"],
    "45": ["consommation", "dechets", "chimie", "produits_ce", "erp"],
    "46": ["consommation", "douane", "produits_ce", "transport", "dechets"],
    "47": ["consommation", "erp", "dechets", "produits_ce", "alimentaire"],
    "49": ["transport", "chimie", "levage", "consommation"],
    "50": ["transport", "douane", "eau", "consommation"],
    "51": ["transport", "douane", "consommation"],
    "52": ["transport", "icpe", "douane", "levage", "dechets"],
    "53": ["transport", "consommation", "telecom"],
    "55": ["hotellerie", "erp", "alimentaire", "consommation"],
    "56": ["alimentaire", "erp", "consommation", "dechets"],
    "58": ["propriete_intel", "consommation", "accessibilite_num"],
    "59": ["culture_spectacle", "propriete_intel", "telecom"],
    "60": ["telecom", "propriete_intel", "culture_spectacle"],
    "61": ["telecom", "accessibilite_num", "consommation"],
    "62": ["accessibilite_num", "propriete_intel", "consommation"],
    "63": ["accessibilite_num", "propriete_intel", "telecom"],
    "64": ["finance", "consommation", "accessibilite_num"],
    "65": ["finance", "consommation"],
    "66": ["finance", "consommation", "deontologie"],
    "68": ["immobilier", "energie_tertiaire", "erp", "construction"],
    "69": ["deontologie", "finance", "propriete_intel"],
    "70": ["deontologie", "marches_publics", "propriete_intel"],
    "71": ["construction", "deontologie", "marches_publics", "chantier_sps"],
    "72": ["chimie", "pharma", "propriete_intel", "icpe"],
    "73": ["consommation", "propriete_intel", "accessibilite_num"],
    "74": ["propriete_intel", "consommation", "deontologie"],
    "75": ["deontologie", "pharma", "agri", "dechets"],
    "77": ["produits_ce", "levage", "consommation", "transport"],
    "78": ["travail_temporaire", "deontologie"],
    "79": ["consommation", "hotellerie", "deontologie"],
    "80": ["securite_privee", "deontologie"],
    "81": ["chimie", "dechets", "levage", "amiante"],
    "82": ["consommation", "deontologie", "accessibilite_num"],
    "84": ["marches_publics", "accessibilite_num", "erp"],
    "85": ["enseignement", "erp", "sport"],
    "86": ["sanitaire", "dechets", "pharma", "deontologie", "erp"],
    "87": ["sanitaire", "erp", "alimentaire", "dechets"],
    "88": ["sanitaire", "association", "erp"],
    "90": ["culture_spectacle", "propriete_intel", "erp", "chantier_sps"],
    "91": ["culture_spectacle", "erp", "accessibilite_num", "propriete_intel"],
    "92": ["jeux", "consommation", "erp"],
    "93": ["sport", "erp", "consommation"],
    "94": ["association", "erp", "culture_spectacle"],
    "95": ["consommation", "dechets", "produits_ce"],
    "96": ["consommation", "erp", "chimie", "sanitaire"],
    "97": ["deontologie"],
    "98": [],
    "99": []
  };

  /* ----------------------------------------------------------- DÉCLENCHEURS
     Caractéristiques d'activité qui ajoutent des domaines, quel que soit
     le code NAF. Elles complètent la matrice sectorielle.                  */
  var declencheurs = [
    { id: "salaries", q: "Vous employez au moins un salarié", d: "Déclenche le socle social, paie et santé-sécurité.", domaines: ["social", "paie", "sst"] },
    { id: "public", q: "Vous recevez du public dans vos locaux", d: "Classement ERP : sécurité incendie et accessibilité.", domaines: ["erp"] },
    { id: "icpe", q: "Vous exploitez une installation classée (ICPE)", d: "Déclaration, enregistrement ou autorisation préfectorale.", domaines: ["icpe", "air", "eau"] },
    { id: "chimique", q: "Vous stockez ou utilisez des produits chimiques dangereux", d: "REACH/CLP, fiches de données de sécurité, risque chimique.", domaines: ["chimie"] },
    { id: "atex", q: "Vous avez des zones à risque d'explosion ou d'incendie industriel", d: "ATEX, liquides inflammables, éventuellement Seveso.", domaines: ["atex"] },
    { id: "dechets_dangereux", q: "Vous produisez des déchets dangereux ou en quantité importante", d: "Traçabilité, bordereaux, filières REP.", domaines: ["dechets"] },
    { id: "vehicules", q: "Vous exploitez des véhicules ou transportez des marchandises", d: "Code des transports, temps de conduite, ADR le cas échéant.", domaines: ["transport"] },
    { id: "engins", q: "Vous utilisez des engins, machines ou appareils de levage", d: "Vérifications périodiques, autorisations de conduite.", domaines: ["levage"] },
    { id: "chantier", q: "Vous intervenez sur des chantiers ou chez des clients", d: "Plans de prévention, coordination SPS, co-activité.", domaines: ["chantier_sps"] },
    { id: "bati_ancien", q: "Vous intervenez sur du bâti susceptible de contenir de l'amiante", d: "Repérage avant travaux, sous-section 3 ou 4.", domaines: ["amiante"] },
    { id: "alimentaire", q: "Vous manipulez, transformez ou servez des denrées alimentaires", d: "Paquet hygiène, HACCP, traçabilité.", domaines: ["alimentaire"] },
    { id: "consommateurs", q: "Vous vendez à des particuliers (BtoC)", d: "Code de la consommation, garanties, vente à distance.", domaines: ["consommation"] },
    { id: "produits", q: "Vous fabriquez ou importez des produits mis sur le marché", d: "Marquage CE, déclaration de conformité, rappels.", domaines: ["produits_ce"] },
    { id: "export", q: "Vous importez ou exportez hors Union européenne", d: "Régimes douaniers, origine, sanctions internationales.", domaines: ["douane"] },
    { id: "marches", q: "Vous répondez à des marchés publics", d: "Code de la commande publique, sous-traitance, Chorus Pro.", domaines: ["marches_publics"] },
    { id: "donnees_sensibles", q: "Vous traitez des données sensibles ou à grande échelle", d: "Analyse d'impact, DPO, sécurité renforcée.", domaines: ["rgpd", "cyber"] },
    { id: "site_web", q: "Vous exploitez un site web ou une application mobile", d: "Mentions légales, cookies, accessibilité.", domaines: ["accessibilite_num", "rgpd"] },
    { id: "tertiaire", q: "Vous occupez plus de 1 000 m² de locaux tertiaires", d: "Dispositif éco-énergie tertiaire et déclaration OPERAT.", domaines: ["energie_tertiaire"] },
    { id: "interim", q: "Vous recourez à l'intérim ou mettez du personnel à disposition", d: "Contrats de mission, égalité de traitement, sécurité.", domaines: ["travail_temporaire"] },
    { id: "formation", q: "Vous dispensez de la formation professionnelle", d: "Déclaration d'activité, référentiel qualité.", domaines: ["enseignement"] },
    { id: "subventions", q: "Vous percevez des subventions publiques", d: "Justification de l'emploi des fonds, contrôle.", domaines: ["association", "marches_publics"] },
    { id: "reglementee", q: "Votre activité exige un diplôme, un agrément ou une carte professionnelle", d: "Conditions d'exercice et déontologie.", domaines: ["deontologie"] }
  ];

  /* ------------------------------------------------------- SOURCES GÉNÉRALES */
  var sourcesGenerales = [
    { nom: "Légifrance", url: "https://www.legifrance.gouv.fr", type: "Base officielle", d: "Textes consolidés, codes, conventions collectives, jurisprudence." },
    { nom: "Journal officiel (JORF)", url: "https://www.legifrance.gouv.fr/jorf/jo", type: "Publication officielle", d: "Lois, décrets et arrêtés du jour — la source primaire." },
    { nom: "EUR-Lex / JOUE", url: "https://eur-lex.europa.eu", type: "Publication officielle", d: "Règlements et directives européens, souvent en amont du droit national." },
    { nom: "Entreprendre.service-public.fr", url: "https://entreprendre.service-public.fr", type: "Portail public", d: "Obligations expliquées par activité et par situation." },
    { nom: "Annuaire des entreprises", url: "https://annuaire-entreprises.data.gouv.fr", type: "Base officielle", d: "Vérifier le code NAF/APE réellement attribué à l'établissement." },
    { nom: "INSEE — nomenclature NAF", url: "https://www.insee.fr/fr/metadonnees/nafr2", type: "Nomenclature", d: "Libellés officiels et notes explicatives des codes NAF." },
    { nom: "BOFiP", url: "https://bofip.impots.gouv.fr", type: "Doctrine", d: "Doctrine fiscale opposable à l'administration." },
    { nom: "BOSS", url: "https://boss.gouv.fr", type: "Doctrine", d: "Doctrine sociale : assiettes, exonérations, frais professionnels." },
    { nom: "Cour de cassation", url: "https://www.courdecassation.fr", type: "Jurisprudence", d: "Décisions qui font évoluer l'interprétation des textes." },
    { nom: "Conseil d'État", url: "https://www.conseil-etat.fr", type: "Jurisprudence", d: "Contentieux administratif : environnement, urbanisme, commande publique." }
  ];

  /* ---------------------------------------------------------------- ÉTAPES */
  var etapes = [
    { n: "01", t: "Identifier les sources", d: "Déterminer les sources pertinentes pour l'activité : sites gouvernementaux, publications officielles, revues spécialisées, bulletins, fédérations. Prioriser l'officiel et le spécialisé, quitte à payer, plutôt que des flux non vérifiés." },
    { n: "02", t: "Collecter", d: "Relever les textes nouveaux ou modifiés, manuellement ou avec des outils : alertes e-mail, flux RSS, agrégateurs, plateformes de veille." },
    { n: "03", t: "Analyser", d: "Qualifier l'applicabilité à l'entreprise, mesurer l'impact financier, juridique et opérationnel, et fixer le délai de mise en conformité." },
    { n: "04", t: "Diffuser", d: "Transmettre aux services concernés sous une forme exploitable : rapport, réunion, alerte, formation. Sans diffusion, la collecte ne sert à rien." },
    { n: "05", t: "Mettre en conformité", d: "Déclencher les actions : modification de processus, de produits, de contrats, formations, investissements. Nommer un responsable et une échéance." },
    { n: "06", t: "Surveiller en continu", d: "Rejouer le cycle à la fréquence retenue, contrôler que les actions ont bien été mises en œuvre et archiver les preuves." }
  ];

  /* ------------------------------------------------------------ FRÉQUENCES */
  var frequences = {
    quotidienne: { l: "Quotidienne", d: "Secteurs très réglementés ou en mouvement (santé, finance, alimentaire).", ordre: 1 },
    hebdomadaire: { l: "Hebdomadaire", d: "Domaines à risque élevé : sécurité, environnement industriel, chantiers.", ordre: 2 },
    mensuelle: { l: "Mensuelle", d: "Socle social, paie, fiscalité, obligations récurrentes.", ordre: 3 },
    trimestrielle: { l: "Trimestrielle", d: "Domaines stables ou prospectifs : normes, veille technique.", ordre: 4 }
  };

  var impactsLabels = {
    financier: "Financier",
    juridique: "Juridique",
    operationnel: "Opérationnel",
    social: "Social",
    reputation: "Réputation"
  };

  /* ------------------------------------------------- MÉTIERS PAR DIVISION
     La nomenclature ne cite pas les métiers courants (la boulangerie tient
     dans « Industries alimentaires »). Ces mots servent uniquement à la
     recherche : on tape le métier, on retrouve la division. */
  var alias = {
    "01": "agriculture agriculteur élevage culture vigne viticulture maraîchage céréales exploitation agricole",
    "02": "forêt forestier bois exploitation forestière",
    "03": "pêche pêcheur aquaculture pisciculture conchyliculture",
    "08": "carrière sablière gravière sable gravier granulats",
    "10": "boulangerie boulanger pâtisserie pâtissier charcuterie boucherie viande lait fromage laiterie conserverie traiteur industriel",
    "11": "boisson brasserie bière vin cave cidre eau minérale spiritueux",
    "13": "textile filature tissage",
    "14": "vêtement confection habillement couture",
    "16": "menuiserie fabrication bois scierie charpente palette",
    "18": "imprimerie impression imprimeur",
    "20": "chimie savon parfum peinture fabrication détergent engrais",
    "22": "plastique plasturgie caoutchouc pneumatique",
    "23": "béton ciment verre céramique tuile brique plâtre pierre",
    "24": "métallurgie fonderie acier aluminium",
    "25": "chaudronnerie serrurerie métallerie usinage mécanique de précision ferronnerie",
    "28": "machine machines-outils équipement industriel",
    "29": "automobile constructeur équipementier",
    "31": "meuble meubles ameublement cuisine fabricant",
    "33": "maintenance industrielle réparation machines installation industrielle",
    "35": "électricité gaz énergie photovoltaïque production énergie renouvelable",
    "36": "eau distribution captage",
    "38": "déchets recyclage collecte tri ferraille",
    "41": "construction promoteur promotion bâtiment constructeur maison individuelle",
    "42": "travaux publics route génie civil terrassement voirie réseaux",
    "43": "maçonnerie maçon plomberie plombier électricien électricité peinture peintre couverture couvreur charpente charpentier plâtrerie plâtrier carrelage carreleur chauffage chauffagiste climatisation menuiserie menuisier installation isolation démolition serrurier vitrier étanchéité gros œuvre artisan du bâtiment",
    "45": "garage réparation automobile carrosserie concessionnaire vente de voitures pièces auto contrôle",
    "46": "grossiste négoce commerce de gros import export",
    "47": "commerce de détail magasin boutique supermarché épicerie librairie pharmacie fleuriste vente en ligne e-commerce marché",
    "49": "transport routier camion taxi vtc déménagement autocar bus voyageurs marchandises chauffeur",
    "50": "transport maritime fluvial bateau",
    "51": "transport aérien aviation",
    "52": "entrepôt logistique manutention stockage parking",
    "53": "courrier coursier livraison colis poste",
    "55": "hôtel hôtellerie camping gîte hébergement touristique chambre d'hôtes location saisonnière",
    "56": "restaurant restauration café bar traiteur brasserie snack restauration rapide food truck cuisine",
    "58": "édition éditeur livre presse journal logiciel édition",
    "59": "cinéma vidéo production audiovisuelle musique studio film",
    "60": "radio télévision diffusion",
    "61": "télécommunications opérateur téléphonie internet fournisseur d'accès",
    "62": "informatique développement logiciel application web ssii esn programmation conseil informatique freelance",
    "63": "hébergement données traitement de données portail internet cloud",
    "64": "banque crédit financement holding société de gestion",
    "65": "assurance mutuelle retraite",
    "66": "courtage courtier assurance agent conseil en gestion de patrimoine",
    "68": "immobilier agence immobilière agent immobilier syndic gestion locative marchand de biens",
    "69": "avocat juridique comptable expert-comptable comptabilité notaire huissier commissaire aux comptes cabinet",
    "70": "conseil de gestion consultant consulting siège social management",
    "71": "architecte architecture ingénierie bureau d'études géomètre contrôle technique diagnostic immobilier",
    "72": "recherche laboratoire recherche et développement",
    "73": "publicité communication marketing agence de communication étude de marché",
    "74": "design graphisme photographe photographie traduction traducteur décorateur",
    "75": "vétérinaire clinique vétérinaire animaux",
    "77": "location de véhicules location de matériel loueur",
    "78": "intérim travail temporaire recrutement agence d'emploi",
    "79": "agence de voyage voyagiste réservation tourisme",
    "80": "sécurité gardiennage surveillance détective alarme",
    "81": "nettoyage entretien espaces verts paysagiste jardinier propreté ménage",
    "82": "secrétariat centre d'appels organisation salons congrès recouvrement",
    "85": "formation école enseignement auto-école centre de formation apprentissage cours",
    "86": "médecin dentiste infirmier infirmière kinésithérapeute hôpital clinique laboratoire ambulance santé cabinet médical ostéopathe",
    "87": "ehpad maison de retraite foyer hébergement médico-social",
    "88": "aide à domicile crèche petite enfance action sociale assistante maternelle",
    "90": "artiste spectacle théâtre musicien création artistique",
    "91": "musée bibliothèque archives patrimoine",
    "93": "sport salle de sport fitness club loisirs parc d'attractions",
    "94": "association syndicat organisation professionnelle",
    "95": "réparation informatique réparation téléphone cordonnier réparation électroménager",
    "96": "coiffure coiffeur esthétique institut de beauté blanchisserie pressing pompes funèbres tatouage salon"
  };

  /* ------------------------------------------------------------- HELPERS --- */

  /** Normalise une saisie utilisateur en division NAF à 2 chiffres. */
  function divisionDepuisCode(saisie) {
    if (!saisie) return null;
    var chiffres = String(saisie).replace(/[^0-9]/g, "");
    if (chiffres.length < 2) return null;
    var code = chiffres.slice(0, 2);
    return divisions.some(function (d) { return d.c === code; }) ? code : null;
  }

  function division(code) {
    return divisions.filter(function (d) { return d.c === code; })[0] || null;
  }

  function section(code) {
    return sections.filter(function (s) { return s.c === code; })[0] || null;
  }

  /** Recherche libre : code NAF partiel ou mots du libellé. */
  function rechercher(terme) {
    var q = String(terme || "").trim().toLowerCase();
    if (!q) return [];
    var chiffres = q.replace(/[^0-9]/g, "");
    var mots = q.replace(/[0-9.]/g, " ").split(/\s+/).filter(function (m) { return m.length > 2; });
    return divisions.filter(function (d) {
      if (chiffres.length >= 1 && d.c.indexOf(chiffres.slice(0, 2)) === 0) return true;
      if (!mots.length) return false;
      var hay = (d.l + " " + (section(d.s) || {}).l).toLowerCase();
      return mots.every(function (m) { return hay.indexOf(m) !== -1; });
    }).slice(0, 12);
  }

  /** Domaines applicables = transversaux + sectoriels + déclenchés. */
  function perimetre(codeDivision, idsDeclencheurs) {
    var vus = {};
    var out = [];
    function pousser(id, origine) {
      if (!domaines[id]) return;
      if (vus[id]) {
        if (out[vus[id] - 1].origines.indexOf(origine) === -1) out[vus[id] - 1].origines.push(origine);
        return;
      }
      out.push({ id: id, origines: [origine] });
      vus[id] = out.length;
    }
    transversaux.forEach(function (id) { pousser(id, "socle"); });
    (parDivision[codeDivision] || []).forEach(function (id) { pousser(id, "secteur"); });
    (idsDeclencheurs || []).forEach(function (dId) {
      var dec = declencheurs.filter(function (x) { return x.id === dId; })[0];
      if (dec) dec.domaines.forEach(function (id) { pousser(id, "activite"); });
    });
    return out.sort(function (a, b) {
      var fa = frequences[domaines[a.id].frequence].ordre;
      var fb = frequences[domaines[b.id].frequence].ordre;
      if (fa !== fb) return fa - fb;
      return domaines[a.id].nom.localeCompare(domaines[b.id].nom, "fr");
    });
  }

  return {
    version: "2.0",
    sections: sections,
    divisions: divisions,
    familles: familles,
    domaines: domaines,
    transversaux: transversaux,
    parDivision: parDivision,
    declencheurs: declencheurs,
    sourcesGenerales: sourcesGenerales,
    etapes: etapes,
    frequences: frequences,
    impactsLabels: impactsLabels,
    divisionDepuisCode: divisionDepuisCode,
    division: division,
    section: section,
    rechercher: rechercher,
    perimetre: perimetre,
    alias: alias
  };
})();
