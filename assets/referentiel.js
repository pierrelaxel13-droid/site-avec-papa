/* ==========================================================================
   Pierrel & Co — référentiel de veille réglementaire
   --------------------------------------------------------------------------
   Source unique de l'outil « plan de veille » et de la page d'accueil.
   Autonome, sans dépendance, chargé tel quel par les deux pages.

   Trois listes suffisent à produire un plan :
     metiers   — ce que fait l'entreprise
     questions — ce qui, dans son contexte, ajoute des obligations
     domaines  — ce qu'il faut surveiller, et à quelle fréquence

   Les libellés de textes sont volontairement écrits en clair plutôt qu'en
   références brutes : le plan est lu par un chef d'entreprise, pas par un
   juriste. Chaque domaine renvoie vers ses sources officielles.
   ========================================================================== */

window.REFERENTIEL = (function () {
  "use strict";

  /* --- Rythmes de revue ---------------------------------------------------- */
  var frequences = [
    { id: "mensuelle",     l: "Chaque mois",        d: "Textes qui bougent souvent et touchent la paie, les contrats ou la sécurité." },
    { id: "trimestrielle", l: "Chaque trimestre",   d: "Le rythme de croisière : on relève, on analyse, on décide." },
    { id: "semestrielle",  l: "Deux fois par an",   d: "Domaines stables, mais dont un changement se prépare à l'avance." },
    { id: "annuelle",      l: "Une fois par an",    d: "Vérification de fond : autorisations, qualifications, attestations." }
  ];

  /* --- Domaines de veille -------------------------------------------------- */
  var domaines = {

    /* ---- socle commun ---------------------------------------------------- */
    entreprise: {
      nom: "Obligations générales de l'entreprise",
      frequence: "trimestrielle",
      resume: "Ce qui s'applique du seul fait d'exercer : informations légales, contrats, factures, délais de paiement, assurances.",
      textes: [
        "Code de commerce — immatriculation, factures, délais de paiement",
        "Code civil — formation des contrats et responsabilité",
        "Conditions générales, devis et bons de commande"
      ],
      obligations: [
        "Informations légales à jour : dénomination, forme, capital, SIRET",
        "Mentions obligatoires présentes sur les devis et les factures",
        "Délais de paiement tenus : 30 jours par défaut, 60 jours au plus entre professionnels",
        "Responsabilité civile professionnelle en cours de validité"
      ],
      sources: [
        { nom: "Entreprendre — service-public.fr", url: "https://entreprendre.service-public.fr" },
        { nom: "Légifrance", url: "https://www.legifrance.gouv.fr" }
      ]
    },

    fiscal: {
      nom: "Fiscalité, facturation et comptabilité",
      frequence: "mensuelle",
      resume: "TVA, impôt sur les bénéfices, tenue de comptabilité, et le passage à la facturation électronique.",
      textes: [
        "Code général des impôts",
        "Loi de finances de l'année",
        "Textes sur la facturation électronique entre entreprises"
      ],
      obligations: [
        "Déclarations et paiements de TVA aux échéances",
        "Comptabilité tenue, pièces justificatives conservées dix ans",
        "Facturation électronique : vérifier l'échéance applicable à votre taille d'entreprise et choisir une plateforme",
        "Suivre la loi de finances : taux, seuils et dispositifs changent chaque année"
      ],
      sources: [
        { nom: "impots.gouv.fr — professionnels", url: "https://www.impots.gouv.fr/professionnel" },
        { nom: "Légifrance", url: "https://www.legifrance.gouv.fr" }
      ]
    },

    donnees: {
      nom: "Données personnelles",
      frequence: "trimestrielle",
      resume: "Dès qu'il y a un fichier clients, un logiciel de paie ou une caméra, le RGPD s'applique.",
      textes: [
        "Règlement général sur la protection des données (RGPD)",
        "Loi Informatique et libertés",
        "Recommandations et référentiels de la CNIL"
      ],
      obligations: [
        "Registre des traitements tenu et daté",
        "Personnes informées : clients, salariés, candidats",
        "Durées de conservation définies et appliquées",
        "Contrats avec les sous-traitants informatiques (hébergeur, paie, logiciel métier)",
        "Violation de données notifiée à la CNIL sous 72 heures"
      ],
      sources: [
        { nom: "CNIL", url: "https://www.cnil.fr" },
        { nom: "CNIL — TPE/PME", url: "https://www.cnil.fr/fr/tpe-pme" }
      ]
    },

    /* ---- emploi ---------------------------------------------------------- */
    social: {
      nom: "Droit du travail et relations sociales",
      frequence: "mensuelle",
      resume: "Contrats, durée du travail, convention collective, représentation du personnel.",
      textes: [
        "Code du travail",
        "Convention collective de branche applicable (IDCC)",
        "Accords d'entreprise et usages"
      ],
      obligations: [
        "Convention collective identifiée, affichée et réellement appliquée",
        "Contrats de travail écrits et conformes",
        "Durée du travail, repos et congés suivis",
        "Registre unique du personnel et affichages obligatoires",
        "Entretiens professionnels tenus tous les deux ans"
      ],
      sources: [
        { nom: "Code du travail numérique", url: "https://code.travail.gouv.fr" },
        { nom: "Ministère du Travail", url: "https://travail-emploi.gouv.fr" }
      ]
    },

    paie: {
      nom: "Paie et cotisations sociales",
      frequence: "mensuelle",
      resume: "Le domaine qui change le plus souvent : barèmes, taux, exonérations, déclarations.",
      textes: [
        "Code de la sécurité sociale",
        "Barèmes annuels : SMIC, plafond de la sécurité sociale",
        "Minima conventionnels de la branche"
      ],
      obligations: [
        "Déclaration sociale nominative transmise chaque mois",
        "Bulletins de paie conformes au modèle en vigueur",
        "SMIC et minima de branche respectés après chaque revalorisation",
        "Exonérations et allègements vérifiés à chaque changement de barème"
      ],
      sources: [
        { nom: "URSSAF", url: "https://www.urssaf.fr" },
        { nom: "net-entreprises.fr", url: "https://www.net-entreprises.fr" }
      ]
    },

    sst: {
      nom: "Santé et sécurité au travail",
      frequence: "mensuelle",
      resume: "L'obligation de sécurité de l'employeur : évaluer les risques, prévenir, former, suivre.",
      textes: [
        "Code du travail, quatrième partie",
        "Décrets et arrêtés propres à chaque risque",
        "Accords de branche de prévention"
      ],
      obligations: [
        "Document unique d'évaluation des risques rédigé, daté et mis à jour",
        "Formations et habilitations à jour, accueil sécurité des nouveaux",
        "Suivi médical assuré par le service de prévention et de santé au travail",
        "Accident du travail déclaré dans les 48 heures",
        "Affichages : consignes, secours, coordonnées de l'inspection du travail"
      ],
      sources: [
        { nom: "INRS", url: "https://www.inrs.fr" },
        { nom: "Ministère du Travail — santé au travail", url: "https://travail-emploi.gouv.fr/sante-au-travail" }
      ]
    },

    equipements: {
      nom: "Équipements de travail et vérifications périodiques",
      frequence: "trimestrielle",
      resume: "Les contrôles datés que l'inspection et l'assureur demandent en premier.",
      textes: [
        "Code du travail — vérifications générales périodiques",
        "Arrêtés propres à chaque famille d'équipement"
      ],
      obligations: [
        "Registre de sécurité tenu, rapports de vérification classés",
        "Appareils de levage vérifiés (six ou douze mois selon l'usage)",
        "Installation électrique vérifiée chaque année",
        "Extincteurs, alarme et désenfumage contrôlés chaque année",
        "Équipements de protection individuelle contrôlés et remplacés"
      ],
      sources: [
        { nom: "INRS", url: "https://www.inrs.fr" },
        { nom: "Légifrance", url: "https://www.legifrance.gouv.fr" }
      ]
    },

    /* ---- accueil du public et clients ------------------------------------ */
    erp: {
      nom: "Accueil du public : incendie et accessibilité",
      frequence: "semestrielle",
      resume: "Dès qu'un local reçoit du public, il est classé, et son classement commande des obligations précises.",
      textes: [
        "Code de la construction et de l'habitation — établissements recevant du public",
        "Règlement de sécurité contre l'incendie",
        "Règles d'accessibilité des locaux existants et neufs"
      ],
      obligations: [
        "Type et catégorie d'ERP connus, autorisation de travaux le cas échéant",
        "Registre de sécurité à jour : vérifications, exercices, formation du personnel",
        "Registre public d'accessibilité mis à disposition",
        "Travaux d'accessibilité réalisés, ou dérogation obtenue et justifiée"
      ],
      sources: [
        { nom: "Entreprendre — ERP", url: "https://entreprendre.service-public.fr" },
        { nom: "Légifrance", url: "https://www.legifrance.gouv.fr" }
      ]
    },

    consommation: {
      nom: "Information du client et pratiques commerciales",
      frequence: "trimestrielle",
      resume: "Ce que le client doit savoir avant d'acheter, et ce qu'il peut exiger après.",
      textes: [
        "Code de la consommation",
        "Règles d'affichage des prix",
        "Vente à distance : information précontractuelle et rétractation"
      ],
      obligations: [
        "Prix affichés, toutes taxes comprises",
        "Informations précontractuelles remises avant l'engagement",
        "Droit de rétractation de quatorze jours respecté en vente à distance",
        "Garantie légale de conformité de deux ans rappelée",
        "Médiateur de la consommation désigné et ses coordonnées communiquées"
      ],
      sources: [
        { nom: "DGCCRF", url: "https://www.economie.gouv.fr/dgccrf" },
        { nom: "Entreprendre — service-public.fr", url: "https://entreprendre.service-public.fr" }
      ]
    },

    numerique: {
      nom: "Site internet et sécurité numérique",
      frequence: "trimestrielle",
      resume: "Mentions légales, cookies, sauvegardes : peu coûteux à tenir, très visible quand ça manque.",
      textes: [
        "Obligations d'identification de l'éditeur d'un site",
        "Règles sur les traceurs et les cookies",
        "Référentiel d'accessibilité applicable à certains acteurs"
      ],
      obligations: [
        "Mentions légales complètes : éditeur, hébergeur, contact",
        "Bandeau cookies conforme : refuser doit être aussi simple qu'accepter",
        "Sauvegardes automatiques et restauration testée",
        "Mots de passe robustes et double authentification sur les comptes sensibles",
        "Conduite à tenir en cas d'incident écrite et connue"
      ],
      sources: [
        { nom: "CNIL", url: "https://www.cnil.fr" },
        { nom: "cybermalveillance.gouv.fr", url: "https://www.cybermalveillance.gouv.fr" }
      ]
    },

    /* ---- bâtiment -------------------------------------------------------- */
    batiment: {
      nom: "Règles de construction et responsabilité du constructeur",
      frequence: "mensuelle",
      resume: "Assurance décennale, règles de l'art, performance des bâtiments neufs, réception des travaux.",
      textes: [
        "Code de la construction et de l'habitation",
        "Normes et documents techniques unifiés (DTU)",
        "Réglementation environnementale des bâtiments neufs"
      ],
      obligations: [
        "Assurance décennale souscrite avant le premier chantier, et mentionnée sur les devis et factures",
        "Règles de l'art et DTU applicables suivis",
        "Exigences énergétiques et acoustiques respectées en construction neuve",
        "Réception des travaux prononcée par écrit, réserves levées et tracées"
      ],
      sources: [
        { nom: "Légifrance", url: "https://www.legifrance.gouv.fr" },
        { nom: "Ministère de la Transition écologique", url: "https://www.ecologie.gouv.fr" }
      ]
    },

    chantier: {
      nom: "Sécurité des chantiers",
      frequence: "mensuelle",
      resume: "Coactivité, travail en hauteur, sous-traitance : là où se jouent les accidents graves et les mises en cause.",
      textes: [
        "Code du travail — coordination de la sécurité, travaux en hauteur, risque électrique",
        "Plan de prévention et plan particulier de sécurité selon l'opération"
      ],
      obligations: [
        "Plan de prévention ou PPSPS établi avant l'intervention",
        "Protections collectives installées avant de recourir aux protections individuelles",
        "Habilitations à jour : électrique, échafaudages, engins, levage",
        "Sous-traitants vérifiés : attestation de vigilance, assurance, cartes professionnelles BTP"
      ],
      sources: [
        { nom: "OPPBTP", url: "https://www.preventionbtp.fr" },
        { nom: "INRS", url: "https://www.inrs.fr" }
      ]
    },

    amiante: {
      nom: "Amiante et matériaux dangereux du bâti existant",
      frequence: "semestrielle",
      resume: "Intervenir sur un bâtiment ancien sans repérage préalable est une faute lourde, et fréquente.",
      textes: [
        "Code du travail — interventions sur matériaux contenant de l'amiante",
        "Code de la santé publique — repérage avant travaux"
      ],
      obligations: [
        "Repérage amiante avant travaux demandé au donneur d'ordre pour tout bâti autorisé avant juillet 1997",
        "Mode opératoire ou plan de retrait établi et transmis",
        "Personnel formé selon la nature de l'intervention",
        "Déchets amiante tracés jusqu'à l'installation autorisée"
      ],
      sources: [
        { nom: "INRS — amiante", url: "https://www.inrs.fr" },
        { nom: "Ministère du Travail", url: "https://travail-emploi.gouv.fr" }
      ]
    },

    /* ---- environnement --------------------------------------------------- */
    icpe: {
      nom: "Installations classées (ICPE)",
      frequence: "trimestrielle",
      resume: "Un atelier, un stockage ou un élevage peut relever de la nomenclature sans que personne ne l'ait vu venir.",
      textes: [
        "Code de l'environnement, livre V",
        "Nomenclature des installations classées",
        "Arrêtés de prescriptions générales par rubrique"
      ],
      obligations: [
        "Rubriques et régime déterminés : déclaration, enregistrement ou autorisation",
        "Prescriptions de l'arrêté applicable respectées et contrôlables",
        "Contrôles périodiques réalisés par un organisme agréé",
        "Registres tenus et déclaration annuelle des émissions si l'installation y est soumise"
      ],
      sources: [
        { nom: "AIDA — réglementation ICPE", url: "https://aida.ineris.fr" },
        { nom: "Ministère de la Transition écologique", url: "https://www.ecologie.gouv.fr" }
      ]
    },

    dechets: {
      nom: "Déchets et filières de reprise",
      frequence: "trimestrielle",
      resume: "Tri, traçabilité, éco-contributions : le contrôle porte autant sur les papiers que sur les bacs.",
      textes: [
        "Code de l'environnement — prévention et gestion des déchets",
        "Obligation de tri des flux dans les locaux professionnels",
        "Filières à responsabilité élargie du producteur, dont celle du bâtiment"
      ],
      obligations: [
        "Flux triés à la source et bacs identifiés",
        "Prestataires autorisés, bordereaux et registre des déchets conservés",
        "Filière REP applicable identifiée et contribution versée",
        "Information des clients sur le devenir des déchets, quand elle est due"
      ],
      sources: [
        { nom: "Ministère de la Transition écologique", url: "https://www.ecologie.gouv.fr" },
        { nom: "ADEME", url: "https://www.ademe.fr" }
      ]
    },

    eau_air: {
      nom: "Rejets dans l'eau et dans l'air",
      frequence: "semestrielle",
      resume: "Raccordement, prétraitement, fluides frigorigènes : des obligations d'entretien plus que de paperasse.",
      textes: [
        "Code de l'environnement — rejets et prélèvements",
        "Autorisation ou convention de rejet au réseau",
        "Règles sur les fluides frigorigènes et les solvants"
      ],
      obligations: [
        "Convention de rejet obtenue pour les effluents non domestiques",
        "Séparateur d'hydrocarbures ou bac à graisses entretenu, avec justificatifs",
        "Équipements frigorifiques suivis par un opérateur attesté, fiches d'intervention conservées",
        "Valeurs limites de rejet respectées et mesurées quand elles sont imposées"
      ],
      sources: [
        { nom: "Ministère de la Transition écologique", url: "https://www.ecologie.gouv.fr" },
        { nom: "Les agences de l'eau", url: "https://www.lesagencesdeleau.fr" }
      ]
    },

    chimie: {
      nom: "Produits chimiques",
      frequence: "trimestrielle",
      resume: "Des fiches de données de sécurité à jour et un inventaire : la base de toute la prévention du risque chimique.",
      textes: [
        "Règlements européens REACH et CLP",
        "Code du travail — risque chimique et agents cancérogènes"
      ],
      obligations: [
        "Inventaire des produits tenu à jour",
        "Fiches de données de sécurité obtenues, à jour et accessibles aux salariés",
        "Étiquetage conforme, y compris sur les contenants de transvasement",
        "Notice de poste et formation pour les produits dangereux",
        "Ventilation, stockage séparé des incompatibles, suivi renforcé pour les agents cancérogènes"
      ],
      sources: [
        { nom: "INRS — risque chimique", url: "https://www.inrs.fr" },
        { nom: "Agence européenne des produits chimiques", url: "https://echa.europa.eu/fr" }
      ]
    },

    energie: {
      nom: "Énergie et performance des bâtiments",
      frequence: "semestrielle",
      resume: "Les obligations de sobriété du tertiaire arrivent par paliers, avec des déclarations annuelles.",
      textes: [
        "Code de l'énergie et Code de la construction",
        "Dispositif de réduction des consommations des bâtiments tertiaires",
        "Diagnostic de performance énergétique"
      ],
      obligations: [
        "Consommations déclarées chaque année sur la plateforme OPERAT au-delà de 1 000 m² de tertiaire",
        "Diagnostic de performance énergétique valide pour vendre ou louer",
        "Audit énergétique réalisé si l'entreprise dépasse les seuils",
        "Régulation et gestion technique des bâtiments installées selon la puissance des équipements"
      ],
      sources: [
        { nom: "Ministère de la Transition écologique", url: "https://www.ecologie.gouv.fr" },
        { nom: "ADEME", url: "https://www.ademe.fr" }
      ]
    },

    /* ---- métiers ---------------------------------------------------------- */
    alimentaire: {
      nom: "Hygiène et information alimentaires",
      frequence: "trimestrielle",
      resume: "Plan de maîtrise sanitaire, traçabilité, allergènes : le contrôle est fréquent et documenté.",
      textes: [
        "Paquet hygiène européen",
        "Règlement sur l'information du consommateur sur les denrées",
        "Arrêtés nationaux sur les températures et l'agrément sanitaire"
      ],
      obligations: [
        "Activité déclarée à la direction départementale de la protection des populations",
        "Plan de maîtrise sanitaire écrit, appliqué et vérifié",
        "Au moins une personne formée à l'hygiène alimentaire en restauration commerciale",
        "Traçabilité amont et aval, procédure de retrait-rappel",
        "Allergènes portés à la connaissance du client"
      ],
      sources: [
        { nom: "Ministère de l'Agriculture", url: "https://agriculture.gouv.fr" },
        { nom: "DGCCRF", url: "https://www.economie.gouv.fr/dgccrf" }
      ]
    },

    transport: {
      nom: "Véhicules, transport et déplacements",
      frequence: "trimestrielle",
      resume: "Licences, temps de conduite, arrimage, zones à faibles émissions.",
      textes: [
        "Code des transports et Code de la route",
        "Règles européennes de temps de conduite et de repos",
        "Réglementation des zones à faibles émissions"
      ],
      obligations: [
        "Licence de transport et capacité professionnelle si vous transportez pour le compte d'autrui",
        "Contrôles techniques et entretien des véhicules suivis",
        "Temps de conduite et de repos respectés, données du chronotachygraphe conservées",
        "Chargements arrimés, règles ADR appliquées pour les matières dangereuses",
        "Règles des zones à faibles émissions traversées vérifiées avant intervention"
      ],
      sources: [
        { nom: "Légifrance", url: "https://www.legifrance.gouv.fr" },
        { nom: "Ministère de la Transition écologique", url: "https://www.ecologie.gouv.fr" }
      ]
    },

    agri: {
      nom: "Exploitation agricole et produits phytopharmaceutiques",
      frequence: "trimestrielle",
      resume: "Certificats, registres, zones de traitement et conditionnalité des aides.",
      textes: [
        "Code rural et de la pêche maritime",
        "Règlement européen sur les produits phytopharmaceutiques",
        "Programmes d'actions régionaux nitrates"
      ],
      obligations: [
        "Certificat phytosanitaire valide pour les personnes concernées",
        "Registre des traitements et des intrants tenu",
        "Pulvérisateur contrôlé périodiquement",
        "Zones de non-traitement et conditions météo respectées",
        "Conditionnalité des aides et règles de bien-être animal tenues"
      ],
      sources: [
        { nom: "Ministère de l'Agriculture", url: "https://agriculture.gouv.fr" },
        { nom: "Chambres d'agriculture", url: "https://chambres-agriculture.fr" }
      ]
    },

    sante_social: {
      nom: "Autorisations et qualité dans la santé et le médico-social",
      frequence: "trimestrielle",
      resume: "Autorisation d'exercer, évaluation de la qualité, dossier de l'usager, données de santé.",
      textes: [
        "Code de la santé publique",
        "Code de l'action sociale et des familles",
        "Référentiel d'évaluation de la qualité des établissements et services"
      ],
      obligations: [
        "Autorisation ou agrément en cours de validité",
        "Évaluation de la qualité conduite selon le référentiel applicable",
        "Dossier de l'usager tenu, secret professionnel garanti",
        "Événements indésirables graves signalés aux autorités",
        "Données de santé hébergées chez un prestataire certifié"
      ],
      sources: [
        { nom: "Haute Autorité de santé", url: "https://www.has-sante.fr" },
        { nom: "Ministère de la Santé", url: "https://sante.gouv.fr" }
      ]
    },

    formation: {
      nom: "Qualité des actions de formation",
      frequence: "semestrielle",
      resume: "Déclaration d'activité, certification qualité, information des stagiaires.",
      textes: [
        "Code du travail, sixième partie",
        "Référentiel national qualité des organismes de formation"
      ],
      obligations: [
        "Déclaration d'activité obtenue, bilan pédagogique et financier transmis chaque année",
        "Certification qualité en cours de validité pour accéder aux financements mutualisés",
        "Programmes, règlement intérieur et information des stagiaires à jour",
        "Indicateurs de résultats publiés"
      ],
      sources: [
        { nom: "Ministère du Travail — formation", url: "https://travail-emploi.gouv.fr" },
        { nom: "Légifrance", url: "https://www.legifrance.gouv.fr" }
      ]
    },

    immobilier_pro: {
      nom: "Activités immobilières",
      frequence: "semestrielle",
      resume: "Carte professionnelle, garantie financière, mandats, formation continue, vigilance anti-blanchiment.",
      textes: [
        "Loi Hoguet et son décret d'application",
        "Loi du 10 juillet 1965 sur la copropriété",
        "Obligations de lutte contre le blanchiment"
      ],
      obligations: [
        "Carte professionnelle valide et garantie financière suffisante",
        "Mandats écrits, numérotés et enregistrés",
        "Formation continue annuelle suivie et justifiée",
        "Honoraires affichés en agence et sur les annonces",
        "Vigilance sur l'origine des fonds et déclaration de soupçon le cas échéant"
      ],
      sources: [
        { nom: "Légifrance", url: "https://www.legifrance.gouv.fr" },
        { nom: "Entreprendre — service-public.fr", url: "https://entreprendre.service-public.fr" }
      ]
    },

    marches_publics: {
      nom: "Marchés publics",
      frequence: "trimestrielle",
      resume: "Candidatures recevables, pièces à jour, facturation dématérialisée.",
      textes: [
        "Code de la commande publique",
        "Avis de marché et pièces particulières de chaque consultation"
      ],
      obligations: [
        "Attestations fiscales et sociales à jour dans le dossier de candidature",
        "Pièces du marché respectées : délais, moyens, pénalités",
        "Sous-traitance déclarée et acceptée avant intervention",
        "Factures déposées sur le portail de facturation de l'État",
        "Avances et révisions de prix demandées quand le marché les prévoit"
      ],
      sources: [
        { nom: "Commande publique — economie.gouv.fr", url: "https://www.economie.gouv.fr/daj" },
        { nom: "Chorus Pro", url: "https://chorus-pro.gouv.fr" }
      ]
    },

    metiers_reglementes: {
      nom: "Qualification et autorisation d'exercer",
      frequence: "annuelle",
      resume: "Certaines activités exigent un diplôme, une attestation ou un agrément, renouvelables.",
      textes: [
        "Loi sur la qualification professionnelle artisanale",
        "Textes propres à chaque profession réglementée"
      ],
      obligations: [
        "Qualification ou diplôme exigé détenu par le professionnel ou par l'encadrant du chantier",
        "Déclaration, agrément ou attestation de capacité obtenus avant l'exercice",
        "Assurance obligatoire propre à la profession souscrite",
        "Renouvellement des attestations suivi, avec alerte avant échéance"
      ],
      sources: [
        { nom: "Entreprendre — activités réglementées", url: "https://entreprendre.service-public.fr" },
        { nom: "Chambres de métiers et de l'artisanat", url: "https://www.artisanat.fr" }
      ]
    }
  };

  /* --- Socle commun : s'applique à toute entreprise ------------------------ */
  var socle = ["entreprise", "fiscal", "donnees"];

  /* --- Métiers ------------------------------------------------------------- */
  var metiers = [
    { id: "btp", nom: "Construction et travaux", naf: "divisions 41 à 43",
      exemples: "Maçonnerie, électricité, plomberie, couverture, rénovation",
      domaines: ["batiment", "chantier", "amiante", "equipements", "dechets", "metiers_reglementes"] },

    { id: "industrie", nom: "Industrie, atelier, production", naf: "divisions 10 à 33",
      exemples: "Fabrication, usinage, agroalimentaire industriel, traitement de surface",
      domaines: ["icpe", "equipements", "chimie", "dechets", "eau_air", "energie"] },

    { id: "commerce", nom: "Commerce et vente en ligne", naf: "divisions 45 à 47",
      exemples: "Magasin, négoce, e-commerce, grossiste",
      domaines: ["consommation", "erp", "dechets"] },

    { id: "restauration", nom: "Restauration, café, hôtel", naf: "divisions 55 et 56",
      exemples: "Restaurant, bar, traiteur, hôtel, chambres d'hôtes",
      domaines: ["alimentaire", "erp", "consommation", "dechets", "eau_air"] },

    { id: "transport_log", nom: "Transport et logistique", naf: "divisions 49 à 53",
      exemples: "Transport routier, livraison, entreposage, messagerie",
      domaines: ["transport", "equipements", "dechets"] },

    { id: "conseil", nom: "Conseil et services aux entreprises", naf: "divisions 69 à 74, 82",
      exemples: "Conseil, expertise, ingénierie, communication, administratif",
      domaines: ["numerique"] },

    { id: "sante", nom: "Santé, médico-social, action sociale", naf: "divisions 86 à 88",
      exemples: "Cabinet, soins à domicile, crèche, établissement médico-social",
      domaines: ["sante_social", "erp", "dechets"] },

    { id: "agriculture", nom: "Agriculture, élevage, espaces verts", naf: "divisions 01 à 03, 81",
      exemples: "Exploitation, maraîchage, élevage, paysagiste",
      domaines: ["agri", "chimie", "eau_air", "dechets", "equipements"] },

    { id: "immobilier", nom: "Immobilier, syndic, gestion locative", naf: "division 68",
      exemples: "Agence, transaction, gestion, syndic de copropriété",
      domaines: ["immobilier_pro", "energie", "erp"] },

    { id: "enseignement", nom: "Enseignement et formation", naf: "division 85",
      exemples: "Organisme de formation, soutien scolaire, auto-école",
      domaines: ["formation", "erp"] },

    { id: "artisan_alim", nom: "Artisanat alimentaire", naf: "divisions 10.7, 47.2, 56.1",
      exemples: "Boulangerie, boucherie, pâtisserie, traiteur, primeur",
      domaines: ["alimentaire", "erp", "equipements", "dechets", "metiers_reglementes"] },

    { id: "auto", nom: "Garage et réparation automobile", naf: "division 45.2",
      exemples: "Mécanique, carrosserie, contrôle, dépannage",
      domaines: ["chimie", "dechets", "equipements", "eau_air", "consommation", "metiers_reglementes"] },

    { id: "soins", nom: "Coiffure, esthétique, soins du corps", naf: "division 96.02",
      exemples: "Salon de coiffure, institut de beauté, onglerie, spa",
      domaines: ["erp", "chimie", "consommation", "dechets", "metiers_reglementes"] },

    { id: "numerique_metier", nom: "Informatique, numérique, données", naf: "divisions 58 à 63",
      exemples: "Développement, infogérance, édition de logiciel, hébergement",
      domaines: ["numerique"] },

    { id: "autre", nom: "Autre activité, ou je ne sais pas encore", naf: "",
      exemples: "Vous obtenez le socle commun, puis les questions font le reste",
      domaines: [] }
  ];

  /* --- Questions de contexte ---------------------------------------------- */
  var questions = [
    { id: "salaries", q: "Vous employez au moins un salarié",
      d: "Ouvre tout le socle employeur : contrats, paie, sécurité, vérifications.",
      domaines: ["social", "paie", "sst", "equipements"] },

    { id: "public", q: "Vous recevez du public dans vos locaux",
      d: "Votre local est alors classé : sécurité incendie et accessibilité.",
      domaines: ["erp"] },

    { id: "particuliers", q: "Vous vendez à des particuliers",
      d: "Information précontractuelle, rétractation, garantie légale, médiation.",
      domaines: ["consommation"] },

    { id: "site_web", q: "Vous avez un site internet ou un logiciel qui collecte des données",
      d: "Mentions légales, cookies, sécurité des accès.",
      domaines: ["numerique"] },

    { id: "chimiques", q: "Vous stockez ou utilisez des produits chimiques",
      d: "Même des produits d'entretien professionnels comptent.",
      domaines: ["chimie"] },

    { id: "vehicules", q: "Vous utilisez des véhicules pour votre activité",
      d: "Entretien, conduite, arrimage, zones à faibles émissions.",
      domaines: ["transport"] },

    { id: "denrees", q: "Vous manipulez des denrées alimentaires",
      d: "Déclaration, plan de maîtrise sanitaire, allergènes, traçabilité.",
      domaines: ["alimentaire"] },

    { id: "site_industriel", q: "Vous exploitez un atelier, un stockage important ou une installation bruyante",
      d: "Souvent le déclencheur d'un classement ICPE ignoré.",
      domaines: ["icpe", "dechets", "eau_air"] },

    { id: "bati_ancien", q: "Vous intervenez sur des bâtiments autorisés avant juillet 1997",
      d: "Repérage amiante avant travaux et mode opératoire.",
      domaines: ["amiante"] },

    { id: "marches", q: "Vous répondez à des appels d'offres publics",
      d: "Pièces de candidature, délais, facturation dématérialisée.",
      domaines: ["marches_publics"] },

    { id: "tertiaire", q: "Vous occupez plus de 1 000 m² de locaux tertiaires",
      d: "Déclaration annuelle des consommations et trajectoire de sobriété.",
      domaines: ["energie"] }
  ];

  /* --- Méthode, telle qu'elle est vendue ---------------------------------- */
  var etapes = [
    { n: "01", t: "Cadrer", d: "Définir ce qui s'applique à vous, domaine par domaine, et écarter le reste. C'est ce que fait le plan de veille de ce site.",
      livrable: "Un plan de veille écrit : domaines, fréquences, sources, responsable." },
    { n: "02", t: "Surveiller", d: "Suivre les sources officielles au rythme décidé, et ne relever que ce qui touche votre périmètre.",
      livrable: "Un relevé daté des textes retenus, et de ceux écartés." },
    { n: "03", t: "Analyser", d: "Pour chaque texte retenu : est-ce que ça me concerne, qu'est-ce que ça change, qui agit, avant quand.",
      livrable: "Une fiche d'analyse par texte, et un plan d'actions daté." },
    { n: "04", t: "Prouver", d: "Archiver les revues, les décisions et les actions : c'est ce qu'un auditeur ou un juge demandera.",
      livrable: "Un dossier de preuves, prêt pour un audit ou un contrôle." }
  ];

  /* --- Sources officielles de référence ----------------------------------- */
  var sourcesGenerales = [
    { nom: "Légifrance", type: "Textes", url: "https://www.legifrance.gouv.fr", d: "Le droit en vigueur et le Journal officiel du jour." },
    { nom: "Entreprendre — service-public.fr", type: "Synthèses", url: "https://entreprendre.service-public.fr", d: "Les obligations expliquées par situation d'entreprise." },
    { nom: "Code du travail numérique", type: "Social", url: "https://code.travail.gouv.fr", d: "Réponses sourcées en droit du travail, convention par convention." },
    { nom: "URSSAF", type: "Paie", url: "https://www.urssaf.fr", d: "Barèmes, taux, exonérations et échéances déclaratives." },
    { nom: "INRS", type: "Sécurité", url: "https://www.inrs.fr", d: "Prévention des risques professionnels, par risque et par métier." },
    { nom: "CNIL", type: "Données", url: "https://www.cnil.fr", d: "RGPD : modèles, référentiels et recommandations." },
    { nom: "AIDA — INERIS", type: "Environnement", url: "https://aida.ineris.fr", d: "Nomenclature et prescriptions des installations classées." },
    { nom: "impots.gouv.fr", type: "Fiscal", url: "https://www.impots.gouv.fr/professionnel", d: "Obligations déclaratives et facturation électronique." }
  ];

  /* --- Construction du plan ------------------------------------------------ */
  function metier(id) {
    for (var i = 0; i < metiers.length; i++) if (metiers[i].id === id) return metiers[i];
    return null;
  }

  function question(id) {
    for (var i = 0; i < questions.length; i++) if (questions[i].id === id) return questions[i];
    return null;
  }

  /* Rend la liste des domaines retenus, chacun avec la raison de sa présence.
     Un domaine amené à la fois par le métier et par une réponse porte les deux
     raisons : c'est ce qui rend le plan discutable avec le client. */
  function plan(metierId, reponses) {
    var retenus = {};
    var ordre = [];

    function ajoute(id, raison) {
      if (!domaines[id]) return;
      if (!retenus[id]) {
        retenus[id] = { id: id, domaine: domaines[id], raisons: [] };
        ordre.push(id);
      }
      if (retenus[id].raisons.indexOf(raison) === -1) retenus[id].raisons.push(raison);
    }

    socle.forEach(function (id) { ajoute(id, "Toute entreprise"); });

    var m = metier(metierId);
    if (m) m.domaines.forEach(function (id) { ajoute(id, m.nom); });

    (reponses || []).forEach(function (qid) {
      var q = question(qid);
      if (q) q.domaines.forEach(function (id) { ajoute(id, q.q); });
    });

    var liste = ordre.map(function (id) { return retenus[id]; });

    var groupes = frequences.map(function (f) {
      return {
        frequence: f,
        entrees: liste.filter(function (e) { return e.domaine.frequence === f.id; })
          .sort(function (a, b) { return a.domaine.nom.localeCompare(b.domaine.nom, "fr"); })
      };
    }).filter(function (g) { return g.entrees.length > 0; });

    return { entrees: liste, groupes: groupes, nombre: liste.length };
  }

  return {
    version: "2.0",
    frequences: frequences,
    domaines: domaines,
    socle: socle,
    metiers: metiers,
    questions: questions,
    etapes: etapes,
    sourcesGenerales: sourcesGenerales,
    metier: metier,
    question: question,
    plan: plan
  };
})();
