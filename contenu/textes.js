/* ==========================================================================
   Pierrel & Co — les fiches de texte
   --------------------------------------------------------------------------
   Une entrée par référence citée dans assets/referentiel.js, à la clé exacte
   de la référence. build.mjs vérifie que chaque clé correspond à une référence
   connue, et dit combien de références n'ont pas encore de fiche.

   CE QUE CES FICHES SONT, ET CE QU'ELLES NE SONT PAS

   Elles ne reproduisent pas le texte officiel. Le texte intégral et à jour est
   sur Légifrance, et c'est là qu'il faut le lire : lui seul fait foi, et une
   copie se périme en silence. Ce qui est écrit ici, c'est ce que le texte
   exige — en français courant, en quelques points, avec qui est concerné.
   C'est ce qu'un dirigeant vient chercher, et c'est le travail du cabinet.

   « valide: false » tant que Clément Pierrel ne l'a pas relue. Les fiches non
   validées s'affichent avec une mention explicite.

   Pour en ajouter une : la clé est la référence telle qu'elle est écrite dans
   le référentiel, au caractère près.
   ========================================================================== */

window.TEXTES = {

  /* ===== Santé et sécurité au travail ==================================== */
  "Code du travail, 4e partie (santé et sécurité)": { valide: false,
    nature: "Code", porte: "Articles L4121-1 et suivants",
    qui: "Tout employeur, dès le premier salarié.",
    exige: [
      "Évaluer les risques de chaque poste et consigner le résultat dans le document unique, mis à jour au moins chaque année et à chaque changement notable.",
      "Mettre en œuvre les actions de prévention qui en découlent, dans l'ordre : supprimer le risque, le réduire à la source, protéger collectivement, et seulement ensuite équiper individuellement.",
      "Former chaque salarié à la sécurité de son poste, à l'embauche et à chaque changement.",
      "Tenir à jour la liste des postes à risques et organiser le suivi médical correspondant."
    ] },

  "Décrets et arrêtés d'application par risque": { valide: false,
    nature: "Décrets et arrêtés",
    qui: "Selon les risques réellement présents dans l'entreprise.",
    exige: [
      "Chaque risque a ses règles propres : bruit, vibrations, produits chimiques, travail en hauteur, électricité, manutention.",
      "Ces textes fixent les seuils à ne pas dépasser, la périodicité des mesures et les vérifications obligatoires.",
      "Ils évoluent plus vite que le code lui-même : c'est là que la veille se joue."
    ] },

  "Accords de branche de prévention": { valide: false,
    nature: "Accord collectif",
    qui: "Les entreprises relevant de la branche concernée.",
    exige: [
      "Des obligations propres au métier, souvent plus exigeantes que le code : équipements imposés, formations spécifiques, visites supplémentaires.",
      "Ils s'appliquent de plein droit dès lors que l'entreprise relève de la branche, qu'elle les connaisse ou non."
    ] },

  /* ===== Droit du travail et relations sociales =========================== */
  "Code du travail": { valide: false,
    nature: "Code",
    qui: "Tout employeur.",
    exige: [
      "Un contrat écrit pour tout ce qui n'est pas un CDI à temps plein, et les mentions obligatoires d'information du salarié.",
      "Le respect des durées maximales de travail, des repos quotidien et hebdomadaire, et le décompte du temps de travail.",
      "L'affichage obligatoire et la mise à disposition du règlement intérieur dès 50 salariés.",
      "La mise en place du comité social et économique dès 11 salariés, et ses attributions élargies à 50."
    ] },

  "Convention collective de branche (IDCC)": { valide: false,
    nature: "Convention collective",
    qui: "Toute entreprise relevant de la branche, selon son activité principale.",
    exige: [
      "Des minima de salaire par coefficient, souvent revalorisés une à deux fois par an.",
      "Des règles propres sur les préavis, l'ancienneté, les primes, la prévoyance et les classifications.",
      "L'affichage de son intitulé et la mention de son IDCC sur le bulletin de paie.",
      "Elle l'emporte sur le code du travail chaque fois qu'elle est plus favorable au salarié."
    ] },

  "Accords d'entreprise": { valide: false,
    nature: "Accord collectif",
    qui: "L'entreprise qui en a conclu, ou qui en reprend par transfert.",
    exige: [
      "Un dépôt sur la plateforme nationale et au greffe du conseil de prud'hommes : sans dépôt, l'accord n'entre pas en vigueur.",
      "Une publication en version anonymisée dans la base nationale.",
      "Le respect des thèmes où l'accord d'entreprise prime, et de ceux où la branche reste verrouillée."
    ] },

  /* ===== Paie, cotisations et protection sociale ========================== */
  "Code de la sécurité sociale": { valide: false,
    nature: "Code",
    qui: "Tout employeur, et tout travailleur indépendant pour sa propre affiliation.",
    exige: [
      "La déclaration sociale nominative chaque mois, dans les délais, avec les données exactes de chaque salarié.",
      "Le calcul et le versement des cotisations aux bonnes échéances, selon l'effectif.",
      "La conservation des justificatifs pendant la durée de contrôle, qui porte sur les trois années civiles précédentes plus l'année en cours."
    ] },

  "Bulletin officiel de la Sécurité sociale (BOSS)": { valide: false,
    nature: "Doctrine opposable",
    qui: "Tout employeur.",
    exige: [
      "C'est la doctrine que l'URSSAF applique en contrôle, et elle est opposable à l'administration : s'y conformer protège.",
      "Il change plusieurs fois par an — frais professionnels, avantages en nature, réductions de cotisations.",
      "Une pratique de paie conforme au BOSS de l'an dernier peut être redressée cette année."
    ] },

  "Lois de financement de la sécurité sociale": { valide: false,
    nature: "Loi annuelle",
    qui: "Tout employeur.",
    exige: [
      "Chaque fin d'année, elles modifient les taux, les plafonds et les dispositifs d'exonération pour l'année suivante.",
      "Le plafond mensuel de la Sécurité sociale, qui sert de base à de nombreux calculs, y est fixé.",
      "Les paramètres de paie doivent être repris au 1er janvier, et parfois en cours d'année."
    ] },

  /* ===== Fiscalité, facturation et comptabilité =========================== */
  "Code général des impôts": { valide: false,
    nature: "Code",
    qui: "Toute entreprise.",
    exige: [
      "Les mentions obligatoires sur chaque facture, dont le numéro de TVA intracommunautaire et le délai de paiement.",
      "Les déclarations et versements de TVA au rythme du régime applicable.",
      "La facturation électronique entre entreprises, dont le calendrier est fixé par la loi et décalé à plusieurs reprises : à suivre de près.",
      "Les règles d'assiette et de taux, qui changent chaque année avec la loi de finances."
    ] },

  "Livre des procédures fiscales": { valide: false,
    nature: "Code",
    qui: "Toute entreprise.",
    exige: [
      "La conservation des pièces comptables et des fichiers pendant six ans au moins, dans un format lisible.",
      "La remise du fichier des écritures comptables au format normé en cas de vérification.",
      "Les garanties du contribuable en contrôle : avis préalable, débat oral, délais de réponse."
    ] },

  "Loi de finances annuelle": { valide: false,
    nature: "Loi annuelle",
    qui: "Toute entreprise.",
    exige: [
      "Publiée fin décembre, elle modifie taux, crédits d'impôt, seuils et obligations déclaratives pour l'exercice qui s'ouvre.",
      "Des lois de finances rectificatives peuvent intervenir en cours d'année.",
      "C'est le texte fiscal dont la veille est la plus prévisible dans son calendrier, et la plus lourde dans ses effets."
    ] },

  "Plan comptable général": { valide: false,
    nature: "Règlement de l'Autorité des normes comptables",
    qui: "Toute entreprise tenue à une comptabilité commerciale.",
    exige: [
      "Un plan de comptes conforme et des méthodes d'évaluation stables d'un exercice à l'autre.",
      "L'établissement des comptes annuels selon le modèle correspondant à la taille de l'entreprise.",
      "Une refonte d'ampleur s'applique aux exercices ouverts à compter de 2025 : états financiers et comptes revus."
    ] },

  /* ===== Données personnelles ============================================= */
  "Règlement (UE) 2016/679 — RGPD": { valide: false,
    nature: "Règlement européen",
    qui: "Toute entreprise qui traite des données personnelles — donc toute entreprise qui a des salariés ou des clients.",
    exige: [
      "Tenir un registre des activités de traitement, et pouvoir le présenter.",
      "Informer les personnes de ce qui est collecté, pourquoi, pour combien de temps, et de leurs droits.",
      "Encadrer chaque sous-traitant par un contrat comportant les clauses imposées.",
      "Notifier à la CNIL toute violation de données dans les 72 heures, et aux personnes concernées si le risque est élevé.",
      "Définir des durées de conservation par finalité, et les appliquer réellement."
    ] },

  "Loi Informatique et Libertés": { valide: false,
    nature: "Loi",
    qui: "Toute entreprise établie en France.",
    exige: [
      "Elle complète le règlement européen sur les points laissés aux États : données de santé, condamnations, recherche.",
      "Elle fixe les pouvoirs de contrôle et de sanction de la CNIL.",
      "Les formalités particulières qu'elle maintient, notamment pour certains traitements sensibles."
    ] },

  "Lignes directrices et sanctions CNIL": { valide: false,
    nature: "Doctrine et jurisprudence administrative",
    qui: "Toute entreprise.",
    exige: [
      "Les recommandations de la CNIL disent comment elle lit le règlement : cookies, prospection, vidéosurveillance, géolocalisation des véhicules.",
      "Ses délibérations de sanction, publiques, montrent ce qui est effectivement reproché.",
      "Suivre ces publications coûte moins cher que de découvrir la doctrine en contrôle."
    ] },

  /* ===== Cybersécurité ==================================================== */
  "Directive (UE) 2022/2555 (NIS 2) et sa transposition": { valide: false,
    nature: "Directive européenne et sa transposition",
    qui: "Les entités essentielles et importantes de secteurs listés — dont l'énergie, les transports, l'eau, la santé, les déchets, l'agroalimentaire et certains services numériques — au-delà de seuils de taille.",
    exige: [
      "S'enregistrer auprès de l'autorité nationale, en France l'ANSSI.",
      "Mettre en place des mesures de gestion du risque : analyse, continuité, sauvegardes, chaîne d'approvisionnement, contrôle d'accès.",
      "Notifier un incident significatif dans des délais très courts, avec une alerte précoce.",
      "Engager la responsabilité des dirigeants sur la supervision de ces mesures.",
      "Le périmètre et le calendrier de transposition sont à surveiller : beaucoup d'entreprises moyennes y entrent sans le savoir."
    ] },

  "Référentiels et guides ANSSI": { valide: false,
    nature: "Référentiels techniques",
    qui: "Toute entreprise, et obligatoirement les entités régulées.",
    exige: [
      "Les guides d'hygiène informatique donnent les mesures de base attendues : mots de passe, sauvegardes testées, mises à jour, cloisonnement.",
      "Les référentiels de qualification encadrent le choix des prestataires de sécurité.",
      "En cas d'incident, l'écart aux bonnes pratiques publiées est le premier reproche."
    ] },

  /* ===== Environnement, socle commun ====================================== */
  "Code de l'environnement": { valide: false,
    nature: "Code",
    qui: "Toute entreprise, selon son activité.",
    exige: [
      "La responsabilité du producteur de déchets jusqu'à leur élimination finale, y compris quand ils ont été remis à un tiers.",
      "Les régimes d'autorisation, d'enregistrement ou de déclaration selon l'activité et les quantités.",
      "Les obligations d'information du public et de prévention des pollutions."
    ] },

  "Loi AGEC (économie circulaire)": { valide: false,
    nature: "Loi",
    qui: "Les producteurs, importateurs et distributeurs de produits soumis à une filière, et tout détenteur de déchets.",
    exige: [
      "Adhérer à un éco-organisme et déclarer les quantités mises sur le marché, pour chaque filière concernée.",
      "Informer le consommateur sur la réparabilité, le tri et la présence de substances.",
      "Respecter les interdictions progressives d'usage unique et de destruction des invendus."
    ] },

  "Obligations de tri dites « 5 flux »": { valide: false,
    nature: "Décret",
    qui: "Toute entreprise produisant des déchets au-delà des seuils, et tout établissement regroupant plusieurs producteurs.",
    exige: [
      "Trier à la source le papier et le carton, le métal, le plastique, le verre et le bois — et les biodéchets, dont le tri est généralisé depuis 2024.",
      "Obtenir du collecteur une attestation annuelle de valorisation, et la conserver.",
      "Les plâtres, les fractions minérales et les textiles s'ajoutent selon les cas : la liste s'allonge."
    ] },

  /* ===== Installations classées ========================================== */
  "Code de l'environnement, livre V": { valide: false,
    nature: "Code",
    qui: "Tout exploitant d'une installation classée pour la protection de l'environnement.",
    exige: [
      "Obtenir le bon titre avant de démarrer : déclaration, enregistrement ou autorisation, selon la rubrique et les quantités.",
      "Respecter les prescriptions attachées au régime, et déclarer tout changement notable d'exploitation.",
      "Tenir les registres et les contrôles imposés, et les présenter à l'inspection.",
      "Prévoir et financer la remise en état du site à la cessation d'activité."
    ] },

  "Nomenclature des installations classées": { valide: false,
    nature: "Annexe réglementaire",
    qui: "Toute entreprise qui stocke, transforme ou utilise des substances ou des équipements listés.",
    exige: [
      "Le classement se fait rubrique par rubrique, sur la quantité susceptible d'être présente — pas sur la quantité habituelle.",
      "Un stock de pointe, une livraison avancée ou une nouvelle machine peuvent faire changer de régime du jour au lendemain.",
      "La nomenclature est modifiée régulièrement : une activité non classée hier peut l'être aujourd'hui."
    ] },

  "Arrêtés ministériels de prescriptions générales": { valide: false,
    nature: "Arrêtés",
    qui: "Les installations soumises à déclaration ou à enregistrement.",
    exige: [
      "Ils fixent, par rubrique, les règles d'implantation, de rétention, de ventilation, de rejet et de contrôle.",
      "Ils s'appliquent sans qu'aucun arrêté individuel ne soit pris : il faut aller les chercher.",
      "Leurs modifications s'imposent aux installations existantes, avec un délai de mise en conformité."
    ] },

  "Arrêté préfectoral propre au site": { valide: false,
    nature: "Acte individuel",
    qui: "Les installations soumises à autorisation, et celles ayant reçu des prescriptions particulières.",
    exige: [
      "C'est la vraie loi du site : rejets autorisés, mesures, fréquences, rapports, horaires, moyens de secours.",
      "Il prime sur les textes généraux quand il est plus strict, et il est rarement relu après la mise en service.",
      "L'inspection le connaît mieux que l'exploitant : c'est le premier document sorti en contrôle."
    ] },

  /* ===== Déchets ========================================================== */
  "Code de l'environnement, livre V titre IV": { valide: false,
    nature: "Code",
    qui: "Tout producteur et tout détenteur de déchets.",
    exige: [
      "Tenir un registre chronologique des déchets entrants et sortants, conservé trois ans au moins.",
      "Remettre les déchets à un prestataire autorisé, et conserver la preuve de la filière.",
      "Émettre un bordereau pour les déchets dangereux, désormais par la plateforme nationale de traçabilité.",
      "La responsabilité du producteur ne s'éteint pas à la remise : elle court jusqu'à l'élimination finale."
    ] },

  "Loi AGEC": { valide: false,
    nature: "Loi",
    qui: "Producteurs et détenteurs de déchets, selon les filières.",
    exige: [
      "L'adhésion à un éco-organisme et la déclaration annuelle des quantités mises sur le marché.",
      "Le tri à la source de flux de plus en plus nombreux, dont les biodéchets et les déchets du bâtiment.",
      "La traçabilité des terres excavées et des sédiments pour les chantiers."
    ] },

  "Arrêtés de filières REP": { valide: false,
    nature: "Arrêtés",
    qui: "Les metteurs sur le marché de produits relevant d'une responsabilité élargie du producteur.",
    exige: [
      "Chaque filière a son cahier des charges : emballages, équipements électriques, pneumatiques, bâtiment, textiles, meubles.",
      "L'identifiant unique délivré par l'ADEME doit figurer dans les conditions générales de vente.",
      "Une entreprise découvre souvent son assujettissement par une mise en demeure : le rattrapage est rétroactif."
    ] },

  /* ===== Eau ============================================================== */
  "Code de l'environnement (loi sur l'eau)": { valide: false,
    nature: "Code",
    qui: "Toute entreprise qui prélève, rejette ou modifie un milieu aquatique.",
    exige: [
      "Un régime de déclaration ou d'autorisation selon les volumes prélevés et les surfaces imperméabilisées.",
      "L'interdiction de rejeter une substance susceptible de nuire au milieu, même en dessous des seuils.",
      "La déclaration des ouvrages de prélèvement et le comptage des volumes."
    ] },

  "Arrêtés de prescriptions de rejet": { valide: false,
    nature: "Arrêtés",
    qui: "Les établissements rejetant des eaux industrielles.",
    exige: [
      "Des valeurs limites par paramètre — matières en suspension, DCO, métaux, hydrocarbures — et leur fréquence d'analyse.",
      "La conservation des résultats et leur transmission à l'administration.",
      "Un dépassement isolé non déclaré pèse plus lourd en contrôle que le dépassement lui-même."
    ] },

  "Règlement d'assainissement local": { valide: false,
    nature: "Règlement de collectivité",
    qui: "Tout établissement raccordé au réseau public.",
    exige: [
      "Une autorisation de déversement délivrée par la collectivité pour tout rejet non domestique.",
      "Souvent une convention spéciale, avec ses propres limites et sa redevance.",
      "Ces règles sont locales : elles changent d'une commune à l'autre et ne figurent dans aucun code."
    ] },

  /* ===== Air et bruit ===================================================== */
  "Arrêtés d'émissions applicables à l'activité": { valide: false,
    nature: "Arrêtés",
    qui: "Les installations émettant des poussières, des solvants ou des gaz de combustion.",
    exige: [
      "Des valeurs limites à l'émission, par cheminée et par polluant, et des mesures périodiques par un organisme agréé.",
      "La surveillance des émissions diffuses, qui échappent aux points de mesure mais pas aux plaintes de voisinage.",
      "La tenue d'un registre des mesures et des incidents."
    ] },

  "Réglementation du bruit de voisinage": { valide: false,
    nature: "Code de la santé publique et arrêtés préfectoraux",
    qui: "Toute activité bruyante à proximité d'habitations.",
    exige: [
      "Le respect d'émergences maximales, mesurées chez le voisin et non à la source, de jour comme de nuit.",
      "Souvent des horaires d'activité fixés par arrêté municipal ou préfectoral.",
      "Une étude acoustique dès lors qu'une plainte est déposée."
    ] },

  /* ===== Construction et bâtiment ========================================= */
  "Code de la construction et de l'habitation": { valide: false,
    nature: "Code",
    qui: "Maîtres d'ouvrage, constructeurs, exploitants de bâtiments.",
    exige: [
      "Les règles de sécurité incendie, d'accessibilité, d'acoustique, de ventilation et de performance énergétique.",
      "Les attestations à produire à l'achèvement des travaux.",
      "Les obligations d'entretien et de contrôle en exploitation."
    ] },

  "Dispositif éco-énergie tertiaire (décret tertiaire)": { valide: false,
    nature: "Décret et arrêtés",
    qui: "Tout bâtiment ou ensemble de bâtiments hébergeant des activités tertiaires sur plus de 1 000 m².",
    exige: [
      "Déclarer chaque année les consommations sur la plateforme OPERAT, avant la date limite annuelle.",
      "Réduire les consommations de 40 % en 2030, 50 % en 2040 et 60 % en 2050 par rapport à une année de référence choisie.",
      "Le seuil s'apprécie par cumul sur un même site : plusieurs petites surfaces peuvent y faire entrer."
    ] },

  "Réglementation sur les systèmes d'automatisation (BACS)": { valide: false,
    nature: "Décret et arrêtés",
    qui: "Les bâtiments tertiaires dont les systèmes techniques dépassent une puissance nominale fixée.",
    exige: [
      "Installer un système d'automatisation et de contrôle du bâtiment, avec suivi et analyse des consommations.",
      "Le seuil de puissance a été abaissé par étapes : des bâtiments hors champ hier y entrent aujourd'hui.",
      "Une inspection périodique des systèmes de chauffage et de climatisation au-delà des seuils."
    ] },

  "Code de l'urbanisme": { valide: false,
    nature: "Code",
    qui: "Tout maître d'ouvrage, et tout exploitant qui modifie son site.",
    exige: [
      "L'autorisation préalable adaptée : déclaration, permis de construire, permis d'aménager.",
      "Le respect du plan local d'urbanisme, qui fixe l'implantation, les hauteurs, le stationnement et parfois l'aspect.",
      "Les servitudes d'utilité publique et les plans de prévention des risques, qui s'imposent au PLU."
    ] },

  "RE2020": { valide: false,
    nature: "Décret et arrêtés",
    qui: "Les constructions neuves, selon leur destination et leur calendrier d'entrée en vigueur.",
    exige: [
      "Un calcul réglementaire portant sur l'énergie, le confort d'été et l'impact carbone sur tout le cycle de vie.",
      "Des attestations de prise en compte au dépôt du permis et à l'achèvement.",
      "Des seuils qui se durcissent par paliers : une solution conforme aujourd'hui ne le sera plus au palier suivant."
    ] },

  "DTU et normes NF applicables": { valide: false,
    nature: "Normes",
    qui: "Les entreprises de bâtiment, et leurs assureurs.",
    exige: [
      "Les règles de l'art d'exécution par ouvrage : supports, tolérances, mises en œuvre.",
      "Elles ne sont pas obligatoires en elles-mêmes, mais l'assurance décennale s'y réfère : s'en écarter sans technique validée expose.",
      "Elles sont révisées régulièrement, et c'est la version en vigueur au marché qui compte."
    ] },

  "Code civil — garanties légales": { valide: false,
    nature: "Code",
    qui: "Tout constructeur au sens large, y compris les sous-traitants par la responsabilité contractuelle.",
    exige: [
      "La garantie de parfait achèvement pendant un an, la garantie de bon fonctionnement pendant deux ans.",
      "La garantie décennale sur les désordres compromettant la solidité ou l'usage de l'ouvrage.",
      "L'assurance correspondante doit être souscrite avant l'ouverture du chantier, et couvrir les activités réellement exercées."
    ] },

  "Code du travail — chantiers de bâtiment et génie civil": { valide: false,
    nature: "Code",
    qui: "Maîtres d'ouvrage et entreprises intervenant sur un chantier.",
    exige: [
      "La déclaration préalable du chantier au-delà des seuils de durée et d'effectif.",
      "La désignation d'un coordonnateur sécurité dès que deux entreprises interviennent, même successivement.",
      "Le plan particulier de sécurité pour chaque entreprise, et le collège interentreprises sur les grands chantiers.",
      "Les installations d'hygiène sur le chantier, souvent le premier manquement relevé."
    ] },

  "Règles de coordination SPS": { valide: false,
    nature: "Décrets et arrêtés",
    qui: "Maîtres d'ouvrage, coordonnateurs, entreprises.",
    exige: [
      "Un plan général de coordination et un dossier d'intervention ultérieure sur l'ouvrage.",
      "Les inspections communes préalables, écrites et signées, avant toute intervention.",
      "La catégorie du chantier détermine la lourdeur du dispositif : elle se calcule, elle ne se devine pas."
    ] },

  "Recommandations OPPBTP": { valide: false,
    nature: "Recommandations professionnelles",
    qui: "Les entreprises du bâtiment et des travaux publics.",
    exige: [
      "Des modes opératoires de référence : échafaudages, tranchées, levage, amiante, poussières.",
      "Elles ne créent pas d'obligation par elles-mêmes, mais elles définissent ce qui est raisonnablement faisable.",
      "Après un accident, l'écart à une recommandation connue pèse lourd dans l'appréciation de la faute."
    ] },

  /* ===== Amiante ========================================================== */
  "Code du travail — risque amiante": { valide: false,
    nature: "Code",
    qui: "Toute entreprise dont les salariés peuvent être exposés, y compris en intervention d'entretien.",
    exige: [
      "Distinguer la sous-section 3 — retrait et encapsulage, qui impose la certification de l'entreprise — de la sous-section 4, interventions sur matériaux amiantés.",
      "Évaluer l'empoussièrement, écrire un mode opératoire par processus, et le transmettre à l'inspection et au médecin du travail.",
      "Former chaque intervenant selon sa fonction, avec recyclage périodique.",
      "Assurer le suivi médical renforcé et la traçabilité des expositions, qui se conserve des décennies."
    ] },

  "Code de la santé publique — repérages": { valide: false,
    nature: "Code",
    qui: "Propriétaires, donneurs d'ordre et maîtres d'ouvrage.",
    exige: [
      "Le dossier technique amiante pour les immeubles bâtis concernés, tenu à jour et communicable.",
      "Le repérage avant travaux, à la charge du donneur d'ordre, remis à toute entreprise qui intervient.",
      "L'absence de repérage ne dispense pas l'entreprise : elle doit refuser d'intervenir ou traiter le matériau comme amianté."
    ] },

  "Arrêtés de formation et de certification": { valide: false,
    nature: "Arrêtés",
    qui: "Les entreprises intervenant sur des matériaux amiantés, et leurs salariés.",
    exige: [
      "La certification de l'entreprise par un organisme accrédité pour les travaux de retrait.",
      "Des durées et des contenus de formation fixés par fonction : opérateur, encadrant de chantier, encadrant technique.",
      "Le recyclage à échéance : une attestation périmée rend le chantier irrégulier le jour même."
    ] },

  /* ===== Équipements de travail et levage ================================= */
  "Code du travail — équipements de travail": { valide: false,
    nature: "Code",
    qui: "Tout employeur utilisant des machines ou des appareils de levage.",
    exige: [
      "N'utiliser que des équipements conformes, maintenus en état, avec leur notice disponible.",
      "Délivrer une autorisation de conduite écrite, fondée sur une formation, une aptitude médicale et la connaissance des lieux.",
      "Tenir le registre de sécurité et conserver les rapports de vérification, avec la levée des réserves.",
      "Une machine d'occasion doit être conforme aux règles applicables aux équipements en service, quel que soit son âge."
    ] },

  "Arrêtés de vérifications périodiques": { valide: false,
    nature: "Arrêtés",
    qui: "Les détenteurs d'équipements soumis à vérification.",
    exige: [
      "Des périodicités précises : six mois pour les appareils de levage de personnes, douze mois pour beaucoup d'autres.",
      "Une vérification à la mise en service, à la remise en service et après tout démontage.",
      "Les accessoires de levage — élingues, crochets, palonniers — sont soumis au même régime, et c'est eux qu'on oublie."
    ] },

  "Règlement (UE) 2023/1230 sur les machines": { valide: false,
    nature: "Règlement européen",
    qui: "Fabricants, importateurs et distributeurs de machines, et ceux qui en modifient substantiellement.",
    exige: [
      "Il remplace la directive machines et s'applique directement, sans transposition, à compter de 2027.",
      "Dossier technique, déclaration de conformité, marquage et notice dans la langue du pays d'utilisation.",
      "Il introduit des exigences nouvelles sur les logiciels, la cybersécurité et les systèmes à comportement évolutif.",
      "Une modification substantielle d'une machine en service peut transférer au modificateur les obligations du fabricant."
    ] },

  /* ===== Produits chimiques et risque d'explosion ======================== */
  "Règlement (CE) 1907/2006 REACH": { valide: false,
    nature: "Règlement européen",
    qui: "Fabricants, importateurs et utilisateurs en aval de substances chimiques.",
    exige: [
      "Obtenir du fournisseur la fiche de données de sécurité, et s'en servir pour écrire les consignes de poste.",
      "Vérifier que les usages pratiqués figurent dans les scénarios d'exposition annexés.",
      "Surveiller la liste des substances candidates et les autorisations : une substance utilisée depuis vingt ans peut devenir interdite.",
      "Informer le client de la présence d'une substance extrêmement préoccupante au-delà du seuil."
    ] },

  "Règlement (CE) 1272/2008 CLP": { valide: false,
    nature: "Règlement européen",
    qui: "Tout acteur qui classe, étiquette ou emballe des produits chimiques, y compris en reconditionnant.",
    exige: [
      "Un étiquetage conforme : pictogrammes, mentions de danger, conseils de prudence, identité du fournisseur.",
      "Le maintien de l'étiquetage sur tout contenant, y compris après transvasement dans un pulvérisateur.",
      "La prise en compte des classes de danger ajoutées récemment, dont les perturbateurs endocriniens."
    ] },

  "Code du travail — risque chimique et ACD/CMR": { valide: false,
    nature: "Code",
    qui: "Tout employeur dont les salariés manipulent ou côtoient des produits chimiques.",
    exige: [
      "Évaluer le risque chimique poste par poste, et tenir la liste des agents dangereux utilisés.",
      "Pour les agents cancérogènes, mutagènes ou toxiques pour la reproduction : substitution obligatoire si elle est techniquement possible, travail en vase clos sinon.",
      "Contrôler l'exposition par un organisme accrédité et respecter les valeurs limites.",
      "Assurer le suivi individuel renforcé et conserver la traçabilité des expositions."
    ] },

  "Directive 2012/18/UE (Seveso 3)": { valide: false,
    nature: "Directive européenne, transposée au code de l'environnement",
    qui: "Les établissements dépassant les seuils bas ou hauts pour des substances dangereuses.",
    exige: [
      "Le classement se calcule sur les quantités susceptibles d'être présentes, avec une règle de cumul entre substances.",
      "Politique de prévention des accidents majeurs en seuil bas ; étude de dangers, système de gestion de la sécurité et plan d'opération interne en seuil haut.",
      "L'information du public et le recensement périodique des substances.",
      "Un franchissement temporaire de seuil change le régime : c'est l'erreur la plus fréquente."
    ] },

  "Code du travail — ATEX": { valide: false,
    nature: "Code",
    qui: "Tout employeur dont l'activité peut produire une atmosphère explosive — poussières comprises.",
    exige: [
      "Classer les emplacements en zones, et consigner le résultat dans un document relatif à la protection contre les explosions.",
      "N'utiliser dans ces zones que du matériel de la catégorie correspondante.",
      "Former le personnel et encadrer les travaux par points chauds par un permis de feu.",
      "Les poussières de bois, de farine ou de métal relèvent de ce régime autant que les gaz."
    ] },

  "Arrêtés de stockage de liquides inflammables": { valide: false,
    nature: "Arrêtés",
    qui: "Les établissements stockant des liquides inflammables au-delà des seuils.",
    exige: [
      "Des capacités de rétention dimensionnées, étanches et vérifiées.",
      "Des distances d'éloignement, une ventilation et des moyens de lutte contre l'incendie proportionnés.",
      "La compatibilité des produits stockés ensemble, et la mise à la terre des équipements."
    ] },

  /* ===== Industries extractives ========================================== */
  "Code minier": { valide: false,
    nature: "Code",
    qui: "Les exploitants de mines et de gîtes géothermiques.",
    exige: [
      "Un titre minier, distinct de l'autorisation d'exploiter, avec ses propres procédures.",
      "Des obligations de sécurité, d'arrêt des travaux et de remise en état spécifiques.",
      "Une réforme profonde est intervenue : procédures et police des mines ont changé."
    ] },

  "Code de l'environnement (carrières en ICPE)": { valide: false,
    nature: "Code",
    qui: "Les exploitants de carrières.",
    exige: [
      "Une autorisation environnementale, assortie de garanties financières pour la remise en état.",
      "Un plan de phasage et de réaménagement coordonné à l'exploitation.",
      "La surveillance des poussières, du bruit, des vibrations et des eaux."
    ] },

  "Règlement général des industries extractives": { valide: false,
    nature: "Décrets",
    qui: "Les exploitants de mines et de carrières.",
    exige: [
      "Un dossier de prescriptions par risque, remis au personnel.",
      "Des règles propres aux tirs de mines, aux fronts de taille, aux engins et à l'empoussiérage.",
      "Ce régime se superpose au code du travail : il ne le remplace pas."
    ] },

  /* ===== Énergie et réseaux ============================================== */
  "Code de l'énergie": { valide: false,
    nature: "Code",
    qui: "Producteurs, fournisseurs, gestionnaires de réseau et gros consommateurs.",
    exige: [
      "Les autorisations d'exploiter, et les obligations d'achat ou de complément de rémunération.",
      "Les certificats d'économies d'énergie : obligation pour les obligés, ressource pour les autres.",
      "Les règles d'effacement et de capacité pour les sites raccordés en haute tension."
    ] },

  "Délibérations de la CRE": { valide: false,
    nature: "Décisions du régulateur",
    qui: "Les acteurs des marchés de l'électricité et du gaz.",
    exige: [
      "Les tarifs d'utilisation des réseaux et leurs évolutions périodiques.",
      "Les règles de raccordement, de comptage et d'accès aux données.",
      "Elles produisent des obligations immédiates, sans passer par un décret."
    ] },

  "Règles de raccordement des gestionnaires de réseau": { valide: false,
    nature: "Documentation technique de référence",
    qui: "Tout site qui se raccorde ou modifie sa puissance.",
    exige: [
      "Des prescriptions techniques précises, opposables au demandeur.",
      "Des délais et des coûts fixés par procédure, avec une convention de raccordement.",
      "Elles changent régulièrement et ne sont publiées que par le gestionnaire."
    ] },

  /* ===== Établissements recevant du public =============================== */
  "Règlement de sécurité contre l'incendie dans les ERP": { valide: false,
    nature: "Arrêté",
    qui: "Tout exploitant d'un établissement recevant du public.",
    exige: [
      "Connaître son type et sa catégorie : ils déterminent tout le reste.",
      "Tenir le registre de sécurité, avec les vérifications périodiques des installations électriques, du désenfumage, des alarmes et des extincteurs.",
      "Organiser les exercices d'évacuation et la formation du personnel.",
      "Passer devant la commission de sécurité à la périodicité de la catégorie, et lever les prescriptions."
    ] },

  "Règles d'accessibilité des ERP": { valide: false,
    nature: "Code de la construction et arrêtés",
    qui: "Tout exploitant d'un établissement recevant du public.",
    exige: [
      "Rendre accessibles les parties ouvertes au public : cheminement, accueil, sanitaires, signalétique.",
      "Tenir à disposition le registre public d'accessibilité, avec les attestations et la formation du personnel.",
      "Demander une dérogation motivée quand l'impossibilité est technique, économique ou patrimoniale — ne pas la demander n'en est pas une."
    ] },

  /* ===== Produits mis sur le marché ====================================== */
  "Règlements et directives d'harmonisation de l'UE": { valide: false,
    nature: "Règlements et directives européens",
    qui: "Fabricants, importateurs et distributeurs de produits réglementés.",
    exige: [
      "Identifier les textes applicables au produit : basse tension, compatibilité électromagnétique, machines, équipements de protection, jouets, construction.",
      "Constituer et conserver le dossier technique, établir la déclaration UE de conformité, apposer le marquage.",
      "L'importateur hors Union européenne endosse les obligations du fabricant : l'attestation du fournisseur étranger ne couvre pas.",
      "Le règlement sur la sécurité générale des produits ajoute des obligations de rappel et un point de contact."
    ] },

  "Normes harmonisées citées au JOUE": { valide: false,
    nature: "Normes",
    qui: "Les fabricants qui veulent présumer de leur conformité.",
    exige: [
      "Appliquer une norme harmonisée citée au Journal officiel de l'Union donne présomption de conformité.",
      "La citation d'une norme peut être retirée ou remplacée : la présomption tombe avec elle.",
      "S'en écarter reste possible, mais il faut alors démontrer la conformité autrement, par le dossier technique."
    ] },

  "Code de la consommation — conformité et sécurité": { valide: false,
    nature: "Code",
    qui: "Tout professionnel qui met un produit à disposition du consommateur.",
    exige: [
      "L'obligation générale de sécurité, indépendante de toute réglementation sectorielle.",
      "L'information sur la disponibilité des pièces détachées et, pour certains produits, l'indice de réparabilité.",
      "Les procédures de rappel et l'information des autorités en cas de produit dangereux."
    ] },

  /* ===== Relations avec les clients ====================================== */
  "Code de la consommation": { valide: false,
    nature: "Code",
    qui: "Tout professionnel vendant à des particuliers.",
    exige: [
      "L'information précontractuelle complète, et l'affichage des prix de manière visible et lisible.",
      "La garantie légale de conformité de deux ans, et son information obligatoire.",
      "Le droit de rétractation de quatorze jours pour la vente à distance et hors établissement, avec le formulaire type.",
      "L'interdiction des pratiques commerciales trompeuses, qui couvre aussi les allégations environnementales."
    ] },

  "Code de commerce — pratiques restrictives": { valide: false,
    nature: "Code",
    qui: "Les relations entre professionnels.",
    exige: [
      "Les plafonds légaux de délai de paiement, contrôlés et sanctionnés par une amende administrative publiée.",
      "Les conditions générales de vente comme socle unique de la négociation.",
      "L'interdiction du déséquilibre significatif et de la rupture brutale d'une relation commerciale établie."
    ] },

  "Règles de la vente en ligne": { valide: false,
    nature: "Lois et règlements européens",
    qui: "Tout site marchand.",
    exige: [
      "Les mentions légales et l'identification complète du vendeur.",
      "Le parcours de commande conforme, avec le double clic et le récapitulatif avant paiement.",
      "Des bandeaux de consentement conformes aux recommandations de la CNIL : refuser doit être aussi simple qu'accepter.",
      "Les obligations du règlement sur les services numériques pour les places de marché."
    ] },

  /* ===== Agroalimentaire et agriculture ================================== */
  "Règlement (CE) 178/2002": { valide: false,
    nature: "Règlement européen",
    qui: "Tout exploitant du secteur alimentaire.",
    exige: [
      "La traçabilité d'un pas en amont et d'un pas en aval, mobilisable immédiatement.",
      "Le retrait et le rappel des produits non conformes, et l'information des autorités.",
      "La responsabilité première de la sécurité des aliments pèse sur l'exploitant, pas sur le contrôle."
    ] },

  "Règlement (CE) 852/2004": { valide: false,
    nature: "Règlement européen",
    qui: "Tout établissement manipulant des denrées alimentaires.",
    exige: [
      "Un plan de maîtrise sanitaire fondé sur les principes HACCP, décrivant l'établissement réel et non un modèle.",
      "La déclaration de l'établissement, et l'agrément sanitaire quand il est requis.",
      "La formation du personnel à l'hygiène, et la chaîne du froid avec ses relevés.",
      "Des relevés trop réguliers, sans aucun écart, discréditent tout le dossier."
    ] },

  "Règlement (UE) 1169/2011 (INCO)": { valide: false,
    nature: "Règlement européen",
    qui: "Tout acteur qui étiquette ou sert des denrées.",
    exige: [
      "Les mentions obligatoires : dénomination, ingrédients, quantité nette, date, conservation, origine quand elle est requise.",
      "La mise en évidence des quatorze allergènes, y compris en vente non préemballée et en restauration.",
      "La déclaration nutritionnelle, et les règles de lisibilité, dont la hauteur minimale des caractères."
    ] },

  "Code rural et de la pêche maritime": { valide: false,
    nature: "Code",
    qui: "Exploitants agricoles, et établissements manipulant des produits d'origine animale.",
    exige: [
      "Les règles sanitaires animales et végétales, dont l'identification des animaux et les registres d'élevage.",
      "Les conditions d'agrément et de contrôle des établissements.",
      "Les règles de commercialisation et les signes de qualité."
    ] },

  "Règlements PAC": { valide: false,
    nature: "Règlements européens et déclinaison nationale",
    qui: "Les exploitants demandant des aides.",
    exige: [
      "La déclaration annuelle dans les délais, dont dépend l'ensemble des aides.",
      "Le respect de la conditionnalité : bonnes conditions agricoles et environnementales, et exigences réglementaires.",
      "Les éco-régimes et leurs cahiers des charges, revus à chaque programmation."
    ] },

  "Réglementation sur les produits phytopharmaceutiques": { valide: false,
    nature: "Code rural, règlements européens et arrêtés",
    qui: "Tout utilisateur, distributeur ou applicateur de produits phytopharmaceutiques.",
    exige: [
      "Le certificat individuel Certiphyto, à renouveler — son expiration ne prévient pas.",
      "L'agrément de l'entreprise pour l'application en prestation de service.",
      "Le registre des traitements, rempli le jour même : reconstitué après coup, il ne vaut rien.",
      "Le contrôle périodique du pulvérisateur, et les distances de sécurité près des habitations et des points d'eau."
    ] },

  /* ===== Douane et commerce international ================================ */
  "Code des douanes de l'Union": { valide: false,
    nature: "Règlement européen",
    qui: "Tout importateur et exportateur.",
    exige: [
      "Le classement tarifaire, l'origine et la valeur en douane : les trois piliers de la déclaration.",
      "La conservation des justificatifs pendant la durée de contrôle, qui se compte en années.",
      "Les régimes particuliers — perfectionnement, entrepôt, transit — avec leur autorisation préalable.",
      "Le statut d'opérateur économique agréé, qui allège les contrôles mais impose un audit."
    ] },

  "Code des douanes national": { valide: false,
    nature: "Code",
    qui: "Les opérateurs du commerce extérieur, et les redevables des accises.",
    exige: [
      "Les droits d'accise sur les alcools, les tabacs et les produits énergétiques.",
      "Les pouvoirs de contrôle et le régime des sanctions douanières.",
      "Les obligations déclaratives propres à certains flux."
    ] },

  "Mesures restrictives de l'UE": { valide: false,
    nature: "Règlements européens",
    qui: "Toute entreprise ayant une activité internationale, même indirecte.",
    exige: [
      "Vérifier les listes de personnes et d'entités gelées avant toute relation d'affaires.",
      "Contrôler les biens à double usage et les interdictions sectorielles, qui changent très vite.",
      "Documenter le contrôle effectué : l'absence de vérification est en elle-même un manquement."
    ] },

  /* ===== Transport ======================================================= */
  "Code des transports": { valide: false,
    nature: "Code",
    qui: "Les entreprises de transport pour compte d'autrui, et le compte propre selon les cas.",
    exige: [
      "L'inscription au registre des transporteurs : capacité professionnelle, capacité financière, honorabilité.",
      "La licence de transport et sa copie conforme à bord de chaque véhicule.",
      "Les règles de sous-traitance et la responsabilité du donneur d'ordre."
    ] },

  "Règlements européens sur les temps de conduite et le tachygraphe": { valide: false,
    nature: "Règlements européens",
    qui: "Les conducteurs et les entreprises exploitant des véhicules soumis.",
    exige: [
      "Les durées maximales de conduite et les repos, journaliers et hebdomadaires.",
      "Le tachygraphe intelligent, avec un calendrier de rééquipement imposé pour le transport international.",
      "Le téléchargement périodique des données, leur conservation et leur analyse.",
      "Les règles du paquet mobilité : retour du véhicule, détachement des conducteurs, cabotage."
    ] },

  "Accord ADR": { valide: false,
    nature: "Accord international",
    qui: "Tout acteur de la chaîne du transport de marchandises dangereuses, expéditeur et chargeur compris.",
    exige: [
      "Un conseiller à la sécurité désigné et un rapport annuel, dès que l'activité dépasse les seuils.",
      "La formation de tout intervenant, et le certificat du conducteur selon les classes.",
      "L'emballage, l'étiquetage, le document de transport et la signalisation conformes.",
      "L'accord est révisé tous les deux ans : la version applicable change au 1er janvier des années impaires."
    ] },

  /* ===== Santé et social ================================================= */
  "Code de la santé publique": { valide: false,
    nature: "Code",
    qui: "Les établissements et professionnels de santé, et certains établissements recevant du public.",
    exige: [
      "Les autorisations d'activité et leur renouvellement périodique.",
      "Les règles de qualité et de sécurité des soins, et la gestion des événements indésirables graves.",
      "Les obligations de vigilance sanitaire et la traçabilité des dispositifs."
    ] },

  "Code de l'action sociale et des familles": { valide: false,
    nature: "Code",
    qui: "Les établissements et services sociaux et médico-sociaux.",
    exige: [
      "L'autorisation, renouvelée au vu des évaluations.",
      "Les outils obligatoires : livret d'accueil, contrat de séjour, règlement de fonctionnement, conseil de la vie sociale, projet d'établissement.",
      "Le signalement sans délai des événements indésirables graves."
    ] },

  "Référentiels d'évaluation nationaux": { valide: false,
    nature: "Référentiels de la Haute Autorité de santé",
    qui: "Les établissements et services sociaux et médico-sociaux, et les établissements de santé.",
    exige: [
      "Une évaluation selon le référentiel national, par un organisme habilité, à périodicité fixée.",
      "Une préparation qui porte sur la pratique réelle, pas sur les procédures écrites.",
      "Le plan d'amélioration qui en découle, et son suivi."
    ] },

  "Règlement (UE) 2017/745 sur les dispositifs médicaux": { valide: false,
    nature: "Règlement européen",
    qui: "Fabricants, mandataires, importateurs et distributeurs de dispositifs médicaux.",
    exige: [
      "Un système de gestion de la qualité et une documentation technique par dispositif.",
      "L'enregistrement dans la base européenne et l'identifiant unique des dispositifs.",
      "La surveillance après commercialisation, les rapports périodiques et la vigilance.",
      "Des classifications revues à la hausse : un dispositif autrefois en classe I peut relever d'un organisme notifié."
    ] },

  "Bonnes pratiques de fabrication et de distribution": { valide: false,
    nature: "Lignes directrices opposables",
    qui: "Les établissements pharmaceutiques et leurs sous-traitants.",
    exige: [
      "Des locaux, des équipements et un personnel qualifiés, avec validation des procédés.",
      "La libération des lots par un pharmacien responsable, et la traçabilité complète.",
      "La gestion documentaire, les déviations, les changements et les auto-inspections."
    ] },

  /* ===== Professions réglementées ======================================== */
  "Textes propres à chaque profession": { valide: false,
    nature: "Lois, décrets et arrêtés sectoriels",
    qui: "Les professions dont l'exercice est subordonné à un diplôme, un agrément ou une carte.",
    exige: [
      "Un titre d'exercice valide, souvent à renouveler, et son affichage ou sa production sur demande.",
      "Une assurance de responsabilité civile professionnelle adaptée à l'activité réellement exercée.",
      "Des conditions d'honorabilité vérifiées, et parfois une garantie financière."
    ] },

  "Codes de déontologie": { valide: false,
    nature: "Décrets ou règlements d'ordre professionnel",
    qui: "Les membres de la profession concernée.",
    exige: [
      "L'indépendance et le secret professionnel, dont la portée varie d'une profession à l'autre.",
      "La prévention des conflits d'intérêts, qui se prouve par l'organisation et non par la bonne foi.",
      "Des règles de publicité et de démarchage souvent plus strictes que le droit commun."
    ] },

  "Obligations de formation continue": { valide: false,
    nature: "Décrets et règlements professionnels",
    qui: "Les professionnels soumis à une obligation de maintien des compétences.",
    exige: [
      "Un volume d'heures par période, à justifier par des attestations.",
      "Des thèmes parfois imposés, dont la lutte contre le blanchiment pour les professions assujetties.",
      "Le défaut de formation est un manquement disciplinaire, indépendamment de la qualité du travail."
    ] },

  /* ===== Finance et assurance ============================================ */
  "Code monétaire et financier": { valide: false,
    nature: "Code",
    qui: "Les établissements financiers, les intermédiaires, et toute entreprise assujettie à la lutte anti-blanchiment.",
    exige: [
      "L'agrément ou l'immatriculation préalable à l'exercice.",
      "Une classification des risques écrite, une vigilance proportionnée et la déclaration de soupçon.",
      "L'absence de document de classification est l'écart type relevé en contrôle."
    ] },

  "Code des assurances": { valide: false,
    nature: "Code",
    qui: "Assureurs et intermédiaires d'assurance.",
    exige: [
      "L'immatriculation à l'ORIAS, renouvelée chaque année.",
      "Le devoir de conseil formalisé, et la remise des documents d'information normalisés.",
      "Les règles de gouvernance produit, qui imposent de définir le marché cible."
    ] },

  "Règlements européens et doctrine des autorités": { valide: false,
    nature: "Règlements européens, positions de l'ACPR et de l'AMF",
    qui: "Les acteurs des secteurs bancaire, assurantiel et financier.",
    exige: [
      "Les règlements s'appliquent directement, sans transposition, et changent vite.",
      "Les positions et recommandations des autorités disent comment elles contrôlent.",
      "Les obligations de publication extra-financière et de durabilité s'y ajoutent par paliers."
    ] },

  /* ===== Immobilier ====================================================== */
  "Loi Hoguet et son décret d'application": { valide: false,
    nature: "Loi et décret",
    qui: "Les agents immobiliers, administrateurs de biens et syndics.",
    exige: [
      "La carte professionnelle délivrée par la chambre de commerce, renouvelée tous les trois ans.",
      "La garantie financière et l'assurance de responsabilité civile professionnelle.",
      "Le mandat écrit, numéroté, préalable à toute action, et le registre des mandats.",
      "La formation continue obligatoire, condition du renouvellement de la carte."
    ] },

  "Loi du 6 juillet 1989 sur les baux d'habitation": { valide: false,
    nature: "Loi",
    qui: "Bailleurs et gestionnaires de logements à usage de résidence principale.",
    exige: [
      "Le contrat type, l'état des lieux et le dossier de diagnostics techniques.",
      "Le respect du plafonnement et de l'encadrement des loyers là où ils s'appliquent.",
      "Le critère de performance énergétique conditionnant la mise en location, qui se durcit par étapes."
    ] },

  /* ===== Marchés publics ================================================= */
  "Code de la commande publique": { valide: false,
    nature: "Code",
    qui: "Les acheteurs publics et les entreprises qui répondent.",
    exige: [
      "Les seuils de procédure, révisés tous les deux ans, qui décident de la forme de la consultation.",
      "La dématérialisation complète des échanges et la facturation par Chorus Pro.",
      "Les déclarations sur l'honneur, les attestations de régularité et l'absence d'interdiction de soumissionner.",
      "Les règles de sous-traitance, dont la déclaration et le paiement direct."
    ] },

  "Cahiers des clauses administratives générales": { valide: false,
    nature: "Arrêtés",
    qui: "Les titulaires de marchés publics qui s'y réfèrent.",
    exige: [
      "Des règles d'exécution, de délais, de pénalités et de réception, applicables dès que le marché les vise.",
      "Les versions ont été refondues : c'est celle citée au marché qui s'applique.",
      "Les dérogations doivent être récapitulées dans le marché, sous peine d'inopposabilité."
    ] },

  "Directives européennes marchés": { valide: false,
    nature: "Directives européennes",
    qui: "Les acheteurs et les opérateurs économiques au-delà des seuils européens.",
    exige: [
      "Les principes de liberté d'accès, d'égalité de traitement et de transparence.",
      "La publicité au Journal officiel de l'Union au-delà des seuils.",
      "Les règles de recours et de standstill avant signature."
    ] },

  /* ===== Travail temporaire ============================================== */
  "Code du travail — travail temporaire": { valide: false,
    nature: "Code",
    qui: "Les entreprises de travail temporaire et les entreprises utilisatrices.",
    exige: [
      "Un contrat de mise à disposition et un contrat de mission écrits, dans les délais légaux.",
      "Un motif de recours licite et une durée maximale respectée, avec le délai de carence.",
      "L'égalité de traitement avec un salarié de même qualification de l'entreprise utilisatrice, primes et avantages compris.",
      "La formation renforcée à la sécurité pour les postes à risques particuliers, dont la liste doit être écrite."
    ] },

  "Déclarations obligatoires aux autorités": { valide: false,
    nature: "Code du travail et décrets",
    qui: "Les entreprises de travail temporaire.",
    exige: [
      "La déclaration préalable d'activité et la garantie financière annuelle.",
      "Le relevé mensuel des contrats transmis à l'administration.",
      "L'absence de garantie en cours rend l'activité irrégulière immédiatement."
    ] },

  "Convention collective du travail temporaire": { valide: false,
    nature: "Convention collective",
    qui: "Les entreprises de travail temporaire et leurs salariés permanents et intérimaires.",
    exige: [
      "Les règles propres de classification, de prime et de prévoyance.",
      "Le fonds de sécurisation des parcours et ses contributions.",
      "Les accords sur le CDI intérimaire et ses contreparties."
    ] },

  /* ===== Sécurité privée ================================================= */
  "Code de la sécurité intérieure": { valide: false,
    nature: "Code",
    qui: "Les entreprises de sécurité privée, de surveillance et de transport de fonds, et les opérateurs de jeux.",
    exige: [
      "L'autorisation d'exercice délivrée par le CNAPS, et la carte professionnelle de chaque agent.",
      "L'aptitude professionnelle et la moralité vérifiées, et la formation continue.",
      "L'exclusivité de l'objet social et le port de la tenue avec les mentions imposées."
    ] },

  "Code de déontologie des activités privées de sécurité": { valide: false,
    nature: "Décret",
    qui: "Les dirigeants et les agents de sécurité privée.",
    exige: [
      "Des règles de comportement, de neutralité et de respect des personnes.",
      "L'interdiction de certaines missions et l'encadrement des palpations.",
      "Le manquement est sanctionné disciplinairement par le CNAPS, indépendamment du pénal."
    ] },

  /* ===== Enseignement et formation ======================================= */
  "Code de l'éducation": { valide: false,
    nature: "Code",
    qui: "Les établissements d'enseignement, publics et privés.",
    exige: [
      "Les déclarations d'ouverture et les conditions de direction et d'enseignement.",
      "Les obligations de sécurité et d'accueil des élèves.",
      "Les règles propres à l'enseignement supérieur privé et à la délivrance des titres."
    ] },

  "Code du travail — formation professionnelle": { valide: false,
    nature: "Code",
    qui: "Les organismes de formation et les entreprises qui forment.",
    exige: [
      "La déclaration d'activité auprès de la DREETS, et le bilan pédagogique et financier annuel.",
      "Les mentions obligatoires des conventions et contrats de formation.",
      "Le respect des règles de financement et de prise en charge."
    ] },

  "Référentiel national qualité (Qualiopi)": { valide: false,
    nature: "Décret et arrêté",
    qui: "Les prestataires d'actions de formation qui veulent accéder aux fonds publics et mutualisés.",
    exige: [
      "La certification par un organisme accrédité, avec audit initial, de surveillance et de renouvellement.",
      "La preuve de chaque indicateur par des éléments tracés, sur des actions réelles.",
      "La veille légale et réglementaire est elle-même un indicateur : il faut la tenir et la montrer."
    ] },

  /* ===== Culture et spectacle ============================================ */
  "Code du travail — spectacle et intermittents": { valide: false,
    nature: "Code",
    qui: "Les employeurs d'artistes et de techniciens du spectacle.",
    exige: [
      "La licence d'entrepreneur de spectacles, devenue déclaration, à renouveler.",
      "La présomption de salariat des artistes, et le contrat écrit.",
      "Le recours au guichet unique pour les employeurs occasionnels."
    ] },

  "Code de la propriété intellectuelle": { valide: false,
    nature: "Code",
    qui: "Tout utilisateur d'œuvres, de marques, de dessins ou de brevets.",
    exige: [
      "Obtenir l'autorisation avant toute reproduction ou représentation, et payer les droits dus aux sociétés de gestion.",
      "Encadrer par contrat la cession des droits des salariés et des prestataires — elle n'est jamais automatique pour le droit d'auteur.",
      "Surveiller ses propres titres : une marque se renouvelle, et un usage non exploité se perd."
    ] },

  "Réglementation des lieux de spectacle": { valide: false,
    nature: "Arrêtés et code de la construction",
    qui: "Les exploitants de salles et d'espaces accueillant du public.",
    exige: [
      "Le classement en établissement recevant du public de type L, avec son registre et ses vérifications.",
      "Les règles d'effectif, d'évacuation et de service de sécurité incendie.",
      "Les niveaux sonores maximaux et l'information du public, avec enregistrement des niveaux."
    ] },

  "Directives européennes sur le droit d'auteur": { valide: false,
    nature: "Directives européennes",
    qui: "Les plateformes, les éditeurs et les utilisateurs professionnels d'œuvres.",
    exige: [
      "Le droit voisin des éditeurs de presse et la négociation de sa rémunération.",
      "La responsabilité des plateformes de partage sur les contenus protégés.",
      "Les exceptions de fouille de textes et de données, et le droit d'opposition des titulaires."
    ] },

  /* ===== Télécommunications et numérique ================================= */
  "Code des postes et des communications électroniques": { valide: false,
    nature: "Code",
    qui: "Les opérateurs de communications électroniques et les revendeurs.",
    exige: [
      "La déclaration préalable d'activité auprès de l'ARCEP.",
      "Les obligations de qualité de service, de portabilité et d'information des abonnés.",
      "La conservation des données et les obligations envers les autorités."
    ] },

  "Décisions de l'ARCEP": { valide: false,
    nature: "Décisions du régulateur",
    qui: "Les opérateurs et les acteurs de l'interconnexion.",
    exige: [
      "Les règles d'accès et de tarification des réseaux.",
      "Les obligations de déploiement et de couverture.",
      "Elles produisent des obligations directes, revues régulièrement."
    ] },

  "Réglementation des services audiovisuels": { valide: false,
    nature: "Lois et décisions de l'ARCOM",
    qui: "Les éditeurs et distributeurs de services audiovisuels, y compris en ligne.",
    exige: [
      "Les conventions et déclarations auprès de l'ARCOM.",
      "Les obligations de contribution à la production et de diffusion d'œuvres.",
      "La protection des mineurs et l'accessibilité des programmes."
    ] },

  "Référentiel général d'amélioration de l'accessibilité (RGAA)": { valide: false,
    nature: "Arrêté",
    qui: "Les organismes publics, et les entreprises au-delà d'un seuil de chiffre d'affaires.",
    exige: [
      "Une déclaration d'accessibilité publiée, avec le taux de conformité réel.",
      "Un schéma pluriannuel de mise en accessibilité et son plan d'action annuel.",
      "Cela se chiffre au cahier des charges, pas à la recette : livrer à un organisme public engage sur le référentiel."
    ] },

  "Directive (UE) 2019/882 (accessibilité des produits et services)": { valide: false,
    nature: "Directive européenne, transposée",
    qui: "Les entreprises offrant au consommateur des services numériques listés : commerce en ligne, banque, transport, livres numériques.",
    exige: [
      "Des exigences d'accessibilité applicables depuis le 28 juin 2025 pour les nouveaux services.",
      "Une déclaration de conformité et une documentation technique.",
      "Les microentreprises de services en sont dispensées, mais pas les autres."
    ] },

  /* ===== Jeux, sport, hébergement ======================================== */
  "Réglementation des jeux en ligne": { valide: false,
    nature: "Lois et décrets",
    qui: "Les opérateurs de jeux d'argent et de hasard.",
    exige: [
      "L'agrément préalable par l'Autorité nationale des jeux, par catégorie de jeu.",
      "La protection des joueurs : vérification de l'âge, modération, auto-exclusion.",
      "Les obligations de lutte contre le blanchiment et la certification des systèmes."
    ] },

  "Décisions de l'Autorité nationale des jeux": { valide: false,
    nature: "Décisions du régulateur",
    qui: "Les opérateurs agréés.",
    exige: [
      "L'approbation des programmes d'action annuels en matière de jeu responsable.",
      "Les règles de communication commerciale et d'encadrement des bonus.",
      "Le reporting périodique des données d'activité."
    ] },

  "Code du sport": { valide: false,
    nature: "Code",
    qui: "Les établissements d'activités physiques et sportives et les éducateurs.",
    exige: [
      "La déclaration de l'établissement, avec l'attestation d'assurance.",
      "La carte professionnelle de l'éducateur rémunéré, fondée sur un diplôme inscrit, et son renouvellement.",
      "L'affichage des diplômes, des tarifs et des garanties d'assurance.",
      "Les normes applicables aux équipements et aux aires de pratique."
    ] },

  "Arrêtés relatifs aux équipements et aux diplômes": { valide: false,
    nature: "Arrêtés",
    qui: "Les exploitants d'équipements sportifs et les organismes de formation.",
    exige: [
      "Les normes de sécurité des équipements, dont les buts et les cages.",
      "Les prérogatives attachées à chaque diplôme : enseigner hors de ses prérogatives est une infraction.",
      "Les conditions d'encadrement des activités à environnement spécifique."
    ] },

  "Code du tourisme": { valide: false,
    nature: "Code",
    qui: "Hôtels, campings, résidences de tourisme et loueurs de meublés.",
    exige: [
      "Le classement, facultatif mais déterminant pour la taxe de séjour et la communication.",
      "L'immatriculation des opérateurs de voyages et de séjours, avec garantie financière.",
      "La déclaration en mairie des meublés de tourisme, et le numéro d'enregistrement là où il est exigé."
    ] },

  "Code général des collectivités territoriales (taxe de séjour)": { valide: false,
    nature: "Code",
    qui: "Les hébergeurs et les plateformes de réservation.",
    exige: [
      "La collecte de la taxe de séjour au tarif voté par la collectivité, affiché et appliqué par nuitée et par personne.",
      "La déclaration et le reversement aux échéances fixées.",
      "La tenue d'un état des nuitées, contrôlable."
    ] },

  "Règlement de sécurité des ERP de type O": { valide: false,
    nature: "Arrêté",
    qui: "Les exploitants d'hôtels et d'hébergements.",
    exige: [
      "Les règles de désenfumage, d'isolement et de recoupement propres au type O.",
      "Le système de sécurité incendie, son entretien et son registre.",
      "Les consignes en chambre et la formation du personnel aux premiers secours et à l'évacuation."
    ] },

  /* ===== Associations ==================================================== */
  "Loi du 1er juillet 1901": { valide: false,
    nature: "Loi",
    qui: "Les associations déclarées.",
    exige: [
      "La déclaration en préfecture, et la déclaration de toute modification des statuts ou des dirigeants dans les trois mois.",
      "La tenue des assemblées prévues par les statuts, et leurs procès-verbaux.",
      "Les obligations comptables renforcées au-delà de certains seuils de subventions."
    ] },

  "Code général des impôts — régime des organismes sans but lucratif": { valide: false,
    nature: "Code et doctrine fiscale",
    qui: "Les associations exerçant une activité économique.",
    exige: [
      "L'examen de la gestion désintéressée, puis de la concurrence avec le secteur commercial par la règle des quatre P.",
      "La franchise des activités lucratives accessoires, dans la limite d'un plafond revalorisé chaque année.",
      "La sectorisation ou la filialisation quand le seuil est dépassé."
    ] },

  "Contrat d'engagement républicain": { valide: false,
    nature: "Décret",
    qui: "Toute association demandant une subvention publique ou un agrément.",
    exige: [
      "La souscription du contrat, et son respect par les dirigeants et les membres.",
      "L'information des membres de son contenu.",
      "Le manquement peut entraîner le retrait de la subvention et sa restitution."
    ] }
};
