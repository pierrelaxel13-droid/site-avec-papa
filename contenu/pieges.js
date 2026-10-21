/* ==========================================================================
   Pierrel & Co — les pièges du métier
   --------------------------------------------------------------------------
   Une entrée par division NAF. C'est le seul contenu du site qui ne se déduit
   pas du référentiel : il vient du terrain, et c'est lui qui empêche les 88
   pages de se ressembler.

   Chaque entrée porte « valide: false » tant que Clément Pierrel ne l'a pas
   relue. Les pièges non validés s'affichent avec une mention explicite : mieux
   vaut une page qui dit ce qu'elle vaut qu'une page qui affirme sans savoir.

   Pour en ajouter un : une clé = le code de la division (deux chiffres, entre
   guillemets), puis une liste de { titre, texte }. Une division absente
   n'affiche simplement pas le bloc.
   ========================================================================== */

window.PIEGES = {

  /* --- Agriculture ------------------------------------------------------- */
  "01": { valide: false, pieges: [
    { titre: "Le certificat expiré dans un tiroir",
      texte: "Le Certiphyto se renouvelle, et son expiration ne prévient pas. Sans lui, l'achat comme l'application de produits phytopharmaceutiques devient irrégulier du jour au lendemain." },
    { titre: "Le registre tenu de mémoire",
      texte: "Le registre des traitements se remplit le jour même, pas en fin de campagne. Reconstitué après coup, il ne vaut rien devant un contrôle." },
    { titre: "Le pulvérisateur jamais représenté",
      texte: "Le contrôle périodique du pulvérisateur s'oublie facilement : il ne gêne personne tant que rien n'arrive." }
  ]},

  /* --- Industries alimentaires -------------------------------------------- */
  "10": { valide: false, pieges: [
    { titre: "Le plan de maîtrise sanitaire photocopié",
      texte: "Un PMS repris d'un modèle, sans description des postes réels, ne résiste pas à dix minutes d'entretien avec un inspecteur. Il doit décrire votre atelier, pas un atelier." },
    { titre: "La traçabilité qui s'arrête à la réception",
      texte: "Les bons d'entrée sont souvent bien tenus ; la traçabilité aval, beaucoup moins. En cas de retrait-rappel, c'est elle qu'on vous demande." },
    { titre: "Les relevés de température signés d'avance",
      texte: "Des relevés trop réguliers, sans aucun écart sur six mois, se repèrent immédiatement et discréditent tout le dossier." }
  ]},

  /* --- Construction -------------------------------------------------------- */
  "41": { valide: false, pieges: [
    { titre: "La décennale absente des devis",
      texte: "L'assurance existe, mais ses références ne figurent ni sur les devis ni sur les factures. C'est une mention obligatoire, et son absence se voit au premier litige." }
  ]},
  "42": { valide: false, pieges: [
    { titre: "Le plan de prévention oublié en coactivité",
      texte: "Dès que deux entreprises interviennent sur la même zone, le plan de prévention est attendu avant le début des travaux, pas rédigé après l'accident." }
  ]},
  "43": { valide: false, pieges: [
    { titre: "Le repérage amiante que personne n'a demandé",
      texte: "Sur un bâtiment autorisé avant juillet 1997, le repérage avant travaux incombe au donneur d'ordre — mais c'est l'entreprise qui intervient qui se retrouve exposée, et mise en cause, s'il manque." },
    { titre: "Les vérifications d'échafaudage non tracées",
      texte: "Le montage, la mise en service et les vérifications journalières se consignent. Sans registre, la conformité du matériel ne se prouve pas." },
    { titre: "Le sous-traitant jamais vérifié",
      texte: "Attestation de vigilance URSSAF, assurance, cartes BTP : la vérification se fait avant l'intervention et se renouvelle. Elle est rarement refaite en cours de chantier." }
  ]},

  /* --- Commerce et réparation automobile ----------------------------------- */
  "45": { valide: false, pieges: [
    { titre: "Le séparateur d'hydrocarbures jamais curé",
      texte: "Il fonctionne sans bruit jusqu'au jour où il déborde. Les bons de curage sont la première pièce demandée en cas de pollution du réseau." },
    { titre: "Les déchets dangereux sans traçabilité",
      texte: "Huiles usagées, batteries, filtres, solvants : chaque enlèvement laisse un bordereau. C'est leur conservation, plus que le tri, qui pose problème." },
    { titre: "Les fiches de données de sécurité périmées",
      texte: "Les FDS des produits d'atelier doivent être à jour et accessibles aux salariés, pas rangées dans un classeur au bureau." }
  ]},

  /* --- Commerce de détail -------------------------------------------------- */
  "47": { valide: false, pieges: [
    { titre: "Le registre public d'accessibilité manquant",
      texte: "Il est obligatoire et doit être mis à disposition du public. C'est l'un des premiers documents réclamés, et l'un des plus souvent absents." },
    { titre: "Le médiateur de la consommation non désigné",
      texte: "Vendre à des particuliers suppose d'avoir désigné un médiateur et d'en communiquer les coordonnées. L'oubli est massif chez les petits commerces." }
  ]},

  /* --- Transports ---------------------------------------------------------- */
  "49": { valide: false, pieges: [
    { titre: "La capacité professionnelle attachée à une personne",
      texte: "Le départ de la personne qui porte l'attestation de capacité met la licence en cause. La continuité se prépare avant, pas après." },
    { titre: "Les données du chronotachygraphe non déchargées",
      texte: "Les téléchargements périodiques des données conducteur et véhicule, et leur conservation, sont contrôlés aussi sûrement que les temps eux-mêmes." }
  ]},

  /* --- Hébergement et restauration ------------------------------------------ */
  "55": { valide: false, pieges: [
    { titre: "Le registre de sécurité incomplet",
      texte: "Vérifications, exercices, formation du personnel, travaux : tout s'y consigne. Un registre qui s'arrête deux ans en arrière vaut un registre absent." }
  ]},
  "56": { valide: false, pieges: [
    { titre: "Personne de formé à l'hygiène sur place",
      texte: "En restauration commerciale, au moins une personne de l'établissement doit justifier d'une formation à l'hygiène alimentaire. L'attestation est souvent au nom de quelqu'un qui est parti." },
    { titre: "Les allergènes annoncés oralement",
      texte: "L'information sur les allergènes doit être disponible, pas récitée par le serveur de garde." },
    { titre: "Les bacs à graisses sans justificatif d'entretien",
      texte: "L'entretien se contractualise et se prouve. C'est le point que le gestionnaire du réseau d'assainissement regarde en premier." }
  ]},

  /* --- Immobilier ------------------------------------------------------------ */
  "68": { valide: false, pieges: [
    { titre: "La formation continue non justifiée",
      texte: "Le renouvellement de la carte professionnelle suppose de justifier des heures de formation continue. Elles se suivent au fil de l'eau, pas dans les trois mois avant l'échéance." }
  ]},

  /* --- Enseignement ---------------------------------------------------------- */
  "85": { valide: false, pieges: [
    { titre: "La veille faite mais jamais exploitée",
      texte: "C'est l'écart le plus fréquemment relevé sur l'indicateur 23 de Qualiopi. Recevoir des newsletters ne suffit pas : il faut montrer ce qu'on en a tiré et à qui on l'a diffusé." },
    { titre: "Le bilan pédagogique et financier oublié",
      texte: "Il se transmet chaque année. Son absence répétée peut entraîner la caducité de la déclaration d'activité." }
  ]},

  /* --- Santé et médico-social -------------------------------------------------- */
  "86": { valide: false, pieges: [
    { titre: "Les données de santé hébergées n'importe où",
      texte: "Un logiciel métier qui stocke des données de santé suppose un hébergeur certifié. La question ne se pose qu'au moment de l'audit, et il est alors tard pour changer de prestataire." },
    { titre: "Les DASRI sans bordereau",
      texte: "La filière des déchets d'activités de soins à risques infectieux se trace d'un bout à l'autre, enlèvement par enlèvement." }
  ]},

  /* --- Services personnels ------------------------------------------------------ */
  "96": { valide: false, pieges: [
    { titre: "Les produits professionnels sans fiche de sécurité",
      texte: "Colorations, décolorants, solvants d'ongles : ce sont des produits chimiques au sens du Code du travail, avec les fiches et la ventilation qui vont avec." },
    { titre: "L'affichage des prix incomplet",
      texte: "La liste des prestations et leurs prix s'affichent de manière visible de l'extérieur comme à l'intérieur. C'est le contrôle le plus rapide à faire, donc le plus fréquent." }
  ]},

  /* ======================================================================
     Deuxième série : l'industrie et les services de l'étang de Berre.
     Même réserve que ci-dessus — premier jet, en attente de relecture.
     ====================================================================== */

  /* --- Travail du bois ---------------------------------------------------- */
  "16": { valide: false, pieges: [
    { titre: "Les poussières de bois traitées comme de la saleté",
      texte: "Les poussières de bois dur sont classées cancérogènes. Elles relèvent du régime CMR : captage à la source, contrôle d'empoussièrement, suivi médical renforcé, traçabilité des expositions. Un simple coup de balai en fin de journée ne tient pas." },
    { titre: "L'aspiration dimensionnée une fois pour toutes",
      texte: "Le réseau d'aspiration a été calculé pour l'atelier d'il y a dix ans. Deux machines ajoutées depuis, et les vitesses d'air ne sont plus atteintes nulle part. Personne ne s'en aperçoit tant qu'on ne mesure pas." },
    { titre: "Les produits de finition oubliés du document unique",
      texte: "Vernis, colles et solvants sont des produits chimiques à part entière. Ils arrivent avec leurs fiches de données de sécurité, leur ventilation et leur risque incendie — rarement repris dans l'évaluation des risques." }
  ]},

  /* --- Industrie chimique -------------------------------------------------- */
  "20": { valide: false, pieges: [
    { titre: "Le seuil Seveso franchi sans s'en rendre compte",
      texte: "Le classement dépend des quantités susceptibles d'être présentes, pas des quantités habituelles. Un stock de pointe, une livraison avancée, et l'établissement change de régime — avec un plan d'opération interne et une information du public à la clé." },
    { titre: "L'arrêté préfectoral jamais relu",
      texte: "Les prescriptions de l'arrêté d'autorisation sont la vraie loi du site : rejets, mesures, fréquences, rapports. Elles se périment moins vite que la réglementation générale, mais elles se perdent dans un classeur, et l'inspection les connaît mieux que l'exploitant." },
    { titre: "Les fiches de données de sécurité périmées",
      texte: "Une FDS se met à jour quand le classement du produit change. Travailler avec la version de l'achat initial, c'est afficher des consignes et des EPI qui ne correspondent plus au produit livré." },
    { titre: "La sous-traitance d'arrêt sans plan de prévention",
      texte: "Les arrêts techniques font entrer des dizaines d'entreprises extérieures en quelques jours. Le plan de prévention écrit et l'inspection commune préalable sont obligatoires, et c'est le premier point regardé après un accident." }
  ]},

  /* --- Caoutchouc et plastique ---------------------------------------------- */
  "22": { valide: false, pieges: [
    { titre: "Les fumées de plasturgie sous-estimées",
      texte: "La dégradation thermique des polymères dégage des composés irritants, voire des isocyanates selon la matière. Le captage aux presses est souvent l'angle mort d'ateliers par ailleurs bien tenus." },
    { titre: "La REP emballages découverte par un courrier",
      texte: "Mettre sur le marché des emballages ou des produits plastiques entraîne une adhésion à un éco-organisme et une déclaration annuelle. Beaucoup d'entreprises l'apprennent en recevant une mise en demeure." },
    { titre: "Les moules et presses sans vérification tracée",
      texte: "Les presses à injecter sont des équipements de travail à vérification périodique. Les rapports existent souvent ; les levées de réserves, beaucoup plus rarement." }
  ]},

  /* --- Produits minéraux non métalliques ------------------------------------ */
  "23": { valide: false, pieges: [
    { titre: "La silice cristalline devenue procédé cancérogène",
      texte: "Les travaux exposant à la silice cristalline alvéolaire relèvent du régime CMR depuis 2021. Beaucoup d'ateliers de béton, de taille et de céramique n'ont pas basculé leur suivi d'exposition en conséquence." },
    { titre: "Le four et son suivi de rejets",
      texte: "Les installations de cuisson portent des valeurs limites de rejet atmosphérique et des mesures périodiques. Un dépassement isolé non déclaré pèse plus lourd, en contrôle, que le dépassement lui-même." },
    { titre: "Les poussières diffuses hors des points de mesure",
      texte: "Les envols sur les aires de stockage et les voies de circulation ne passent par aucune cheminée : ils échappent aux mesures, mais pas aux plaintes de voisinage, qui déclenchent l'inspection." }
  ]},

  /* --- Métallurgie ---------------------------------------------------------- */
  "24": { valide: false, pieges: [
    { titre: "Les fumées de soudage selon le métal",
      texte: "Souder de l'inox, c'est émettre du chrome hexavalent, cancérogène. Le même poste, la même torche, et un régime réglementaire entièrement différent du soudage de l'acier doux." },
    { titre: "Le bruit mesuré une fois, il y a longtemps",
      texte: "Le mesurage d'exposition sonore se refait quand le procédé change. Entre deux, les protections sont choisies sur une cartographie qui ne décrit plus l'atelier." },
    { titre: "Les appareils de levage et leurs accessoires",
      texte: "Le pont roulant est vérifié ; les élingues, crochets et palonniers le sont beaucoup moins. Ce sont pourtant eux qui cassent." }
  ]},

  /* --- Produits métalliques --------------------------------------------- */
  "25": { valide: false, pieges: [
    { titre: "Le marquage CE assumé par le sous-traitant",
      texte: "Fabriquer une structure métallique pour le bâtiment suppose un marquage CE au titre de la norme d'exécution, avec le contrôle de production en usine et la qualification de soudage qui vont avec. Le donneur d'ordre le découvre parfois à la livraison." },
    { titre: "Le traitement de surface et ses rejets",
      texte: "Dégraissage, décapage, galvanisation : des bains, donc des rejets et souvent une rubrique ICPE. L'atelier de traitement est régulièrement la seule partie classée d'un site qui se croyait hors régime." },
    { titre: "Les machines anciennes sans mise en conformité",
      texte: "Une machine achetée d'occasion doit être conforme aux règles techniques applicables aux équipements en service. Le certificat du constructeur d'origine ne suffit pas quand les protecteurs ont été déposés." }
  ]},

  /* --- Machines et équipements ---------------------------------------------- */
  "28": { valide: false, pieges: [
    { titre: "Le dossier technique qui n'existe que dans les têtes",
      texte: "La déclaration CE de conformité suppose un dossier technique constitué et conservé : analyse de risques, calculs, essais, notice. Il se reconstitue très mal après coup, et c'est la première pièce demandée en cas d'accident." },
    { titre: "La notice d'instructions traduite à la va-vite",
      texte: "La notice doit être rédigée dans la langue du pays d'utilisation et couvrir le montage, l'usage, la maintenance et la mise hors service. Une traduction automatique du manuel anglais ne satisfait pas l'obligation." },
    { titre: "La quasi-machine livrée comme une machine",
      texte: "Livrer un ensemble destiné à être incorporé relève d'un régime différent : déclaration d'incorporation, notice d'assemblage, pas de marquage CE machine. Confondre les deux expose le client autant que le fabricant." }
  ]},

  /* --- Réparation et installation de machines ------------------------------- */
  "33": { valide: false, pieges: [
    { titre: "La modification qui fait de vous le fabricant",
      texte: "Modifier substantiellement une machine en service peut transférer au réparateur les obligations du fabricant, marquage CE compris. La frontière est mince entre remettre en état et transformer." },
    { titre: "L'intervention chez le client sans plan de prévention",
      texte: "Toute intervention d'une entreprise extérieure au-delà d'un certain volume d'heures, ou portant sur des travaux dangereux, impose un plan de prévention écrit après inspection commune. Un bon de commande n'en tient pas lieu." },
    { titre: "La consignation faite de mémoire",
      texte: "Les procédures de consignation et de déconsignation doivent être écrites et tracées. C'est l'écart le plus fréquemment relevé après un accident de maintenance." }
  ]},

  /* --- Électricité, gaz, vapeur --------------------------------------------- */
  "35": { valide: false, pieges: [
    { titre: "Les habilitations électriques accordées trop large",
      texte: "L'habilitation est délivrée par l'employeur pour des opérations précises sur des ouvrages précis. Un titre générique « BR » donné à toute l'équipe ne couvre pas ce que l'équipe fait réellement." },
    { titre: "Les équipements sous pression hors suivi",
      texte: "Générateurs de vapeur, ballons et tuyauteries relèvent d'un suivi en service avec inspections et requalifications périodiques. Le dossier d'exploitation se perd au premier changement de responsable." },
    { titre: "Les garanties d'origine confondues avec la fourniture",
      texte: "Annoncer une électricité renouvelable suppose des garanties d'origine annulées au nom du site. Sans elles, l'allégation environnementale est une pratique commerciale trompeuse." }
  ]},

  /* --- Déchets -------------------------------------------------------------- */
  "38": { valide: false, pieges: [
    { titre: "Le registre des déchets incomplet en sortie",
      texte: "Le registre doit suivre les flux entrants et sortants, avec les codes, les quantités et les destinataires. La partie sortante est systématiquement la plus pauvre, alors que c'est elle qui prouve la filière." },
    { titre: "La traçabilité numérique ignorée",
      texte: "Les bordereaux de déchets dangereux passent par la plateforme nationale. Continuer au format papier ne dispense pas de la déclaration, cela la rend seulement invisible — jusqu'au contrôle." },
    { titre: "La sortie du statut de déchet présumée",
      texte: "Un matériau récupéré reste un déchet tant que les critères de sortie de statut ne sont pas remplis et tracés. Le revendre comme une matière première engage la responsabilité du cédant." }
  ]},

  /* --- Commerce de gros ------------------------------------------------------ */
  "46": { valide: false, pieges: [
    { titre: "La responsabilité d'importateur qui ne se délègue pas",
      texte: "Importer hors Union européenne fait de vous le responsable de la conformité du produit : marquage, documentation technique, langue de la notice. L'attestation du fournisseur étranger ne vous couvre pas." },
    { titre: "Les délais de paiement non respectés entre professionnels",
      texte: "Les plafonds légaux de délai de paiement sont contrôlés et sanctionnés par amende administrative publiée. C'est l'une des rares sanctions rendues publiques, ce qui en fait un sujet de réputation autant que de conformité." },
    { titre: "Le stockage dépassant un seuil ICPE",
      texte: "Entreposer des liquides inflammables, des aérosols, des engrais ou du bois peut faire basculer l'entrepôt sous déclaration ou enregistrement. Le classement suit la quantité, pas l'activité principale." }
  ]},

  /* --- Entreposage et logistique --------------------------------------------- */
  "52": { valide: false, pieges: [
    { titre: "L'entrepôt classé que personne n'a déclaré",
      texte: "Une surface de stockage de matières combustibles au-delà des seuils relève de la rubrique 1510, avec ses prescriptions de désenfumage, de cellules et de rétention. Beaucoup d'entrepôts loués passent en dessous du radar jusqu'au premier sinistre." },
    { titre: "Les chariots conduits avec une autorisation périmée",
      texte: "L'autorisation de conduite se fonde sur un CACES ou un contrôle équivalent, une aptitude médicale et une connaissance des lieux. Les trois se périment, et pas à la même date." },
    { titre: "Le transport de marchandises dangereuses sans conseiller",
      texte: "Dès qu'on expédie, charge ou décharge des marchandises dangereuses au-delà des seuils, un conseiller à la sécurité est obligatoire, avec un rapport annuel. L'activité est souvent occasionnelle, donc invisible dans l'organigramme." }
  ]},

  /* --- Informatique ----------------------------------------------------------- */
  "62": { valide: false, pieges: [
    { titre: "Le sous-traitant RGPD qui se croit responsable",
      texte: "Développer ou héberger pour un client fait de vous un sous-traitant au sens du règlement : contrat de sous-traitance, registre des traitements sous-traités, obligation d'alerte. Ce n'est pas le même jeu d'obligations que celui du client." },
    { titre: "Les sauvegardes jamais restaurées pour de vrai",
      texte: "Une sauvegarde qu'on n'a jamais restaurée est une hypothèse. L'obligation de sécurité impose des mesures adaptées, et l'essai de restauration est ce qui transforme l'intention en preuve." },
    { titre: "L'accessibilité numérique oubliée des marchés publics",
      texte: "Livrer un site ou une application à un organisme public engage sur le référentiel d'accessibilité, avec déclaration et schéma pluriannuel. Cela se chiffre au cahier des charges, pas à la recette." }
  ]},

  /* --- Activités juridiques et comptables -------------------------------------- */
  "69": { valide: false, pieges: [
    { titre: "La lutte anti-blanchiment réduite à une case cochée",
      texte: "Les professions du chiffre et du droit sont assujetties : classification des risques écrite, vigilance proportionnée, déclaration de soupçon. L'absence de document de classification est l'écart type en contrôle." },
    { titre: "La lettre de mission qui n'a pas suivi l'activité",
      texte: "La mission s'est élargie année après année sans avenant. En cas de litige, c'est la lettre d'origine qui définit l'étendue de la responsabilité — et elle ne décrit plus ce qui est fait." },
    { titre: "Les données clients conservées sans limite",
      texte: "Les durées de conservation doivent être définies par finalité. Garder tous les dossiers indéfiniment « au cas où » est précisément ce que le règlement interdit, obligation de conservation légale mise à part." }
  ]},

  /* --- Sièges sociaux, conseil de gestion --------------------------------------- */
  "70": { valide: false, pieges: [
    { titre: "Les obligations transférées au siège sans les moyens",
      texte: "Le siège centralise la paie, les achats, la conformité — mais la responsabilité pénale reste sur l'établissement, sauf délégation de pouvoirs écrite, précise et assortie des moyens. Une note d'organisation n'est pas une délégation." },
    { titre: "La déclaration de performance extrapolée",
      texte: "Les obligations de publication extra-financière dépendent de seuils de taille consolidés. Un groupe les franchit souvent un exercice avant de s'en apercevoir, et le premier rapport se prépare sur l'exercice écoulé." },
    { titre: "Les conventions intra-groupe non formalisées",
      texte: "Les prestations entre sociétés du même groupe doivent être documentées et rémunérées à leur valeur. L'administration fiscale et le commissaire aux comptes regardent le même document, pour des raisons différentes." }
  ]},

  /* --- Ingénierie et contrôle technique ------------------------------------------ */
  "71": { valide: false, pieges: [
    { titre: "L'assurance décennale souscrite trop étroite",
      texte: "La garantie doit couvrir les activités réellement exercées, telles qu'elles sont décrites au contrat. Une mission de maîtrise d'œuvre d'exécution exercée sous une attestation de conception laisse l'entreprise à découvert." },
    { titre: "L'accréditation confondue avec la compétence",
      texte: "Un essai réalisé hors du périmètre d'accréditation reste un essai valable techniquement, mais il ne peut pas être présenté comme accrédité. La portée s'exprime ligne par ligne, et elle se vérifie." },
    { titre: "L'indépendance du contrôleur entamée par le conseil",
      texte: "Conseiller puis contrôler le même ouvrage expose à un conflit d'intérêts qui disqualifie le rapport. La séparation se prouve par l'organisation, pas par la bonne foi." }
  ]},

  /* --- Intérim et placement -------------------------------------------------------- */
  "78": { valide: false, pieges: [
    { titre: "La garantie financière oubliée d'une année sur l'autre",
      texte: "Exercer le travail temporaire suppose une garantie financière annuelle et une déclaration préalable. Son renouvellement tombe à date fixe, et son absence rend l'activité irrégulière immédiatement." },
    { titre: "Les postes à risques particuliers sans formation renforcée",
      texte: "Un intérimaire affecté à un poste à risques particuliers reçoit une formation renforcée à la sécurité et un accueil adapté, à la charge de l'entreprise utilisatrice. La liste des postes concernés doit être écrite, et elle l'est rarement." },
    { titre: "L'égalité de traitement calculée au taux horaire seulement",
      texte: "La rémunération de l'intérimaire se compare à celle d'un salarié de même qualification de l'entreprise utilisatrice, primes et avantages compris. Le rappel porte sur les accessoires bien plus souvent que sur le salaire de base." }
  ]},

  /* --- Nettoyage et espaces verts ---------------------------------------------------- */
  "81": { valide: false, pieges: [
    { titre: "Le transfert des contrats de nettoyage ignoré",
      texte: "La convention collective de la propreté organise le transfert des salariés affectés à un marché repris. Chiffrer une reprise sans intégrer le personnel transféré, c'est se tromper de coût et créer un litige." },
    { titre: "Le Certiphyto de l'applicateur en espaces verts",
      texte: "Appliquer des produits phytopharmaceutiques en prestation suppose un certificat individuel et un agrément de l'entreprise. Les restrictions d'usage dans les lieux publics s'y ajoutent, et elles changent souvent." },
    { titre: "Les produits d'entretien sans étiquetage de transvasement",
      texte: "Un produit reconditionné dans un pulvérisateur garde ses obligations d'étiquetage. C'est le contenant anonyme sous l'évier qui fait l'accident, et le constat." }
  ]},

  /* --- Sport et loisirs -------------------------------------------------------------- */
  "93": { valide: false, pieges: [
    { titre: "L'éducateur rémunéré sans carte professionnelle",
      texte: "Enseigner une activité physique contre rémunération suppose un diplôme inscrit et une déclaration donnant lieu à une carte professionnelle, renouvelable. Le bénévolat encadré n'y échappe que s'il est réellement bénévole." },
    { titre: "La déclaration d'établissement d'APS jamais faite",
      texte: "L'ouverture d'un établissement d'activités physiques et sportives se déclare, avec l'attestation d'assurance. Beaucoup de structures créées par une association ne l'ont jamais faite." },
    { titre: "Le registre de sécurité d'un ERP de type X",
      texte: "Une salle de sport recevant du public relève d'un type d'ERP précis, avec son registre, ses vérifications périodiques et son passage de commission. Le registre existe souvent, vide depuis l'ouverture." }
  ]},

  /* --- Réparation de biens ------------------------------------------------------------ */
  "95": { valide: false, pieges: [
    { titre: "L'indice de réparabilité et les pièces détachées",
      texte: "Les obligations d'information sur la disponibilité des pièces détachées et, pour certains produits, l'indice de réparabilité, s'imposent au vendeur comme au réparateur. L'information manquante est une infraction au Code de la consommation, pas une négligence." },
    { titre: "Le devis obligatoire au-delà du seuil",
      texte: "La réparation au-dessus d'un certain montant impose un devis écrit avant travaux, accepté par le client. La facture détaillée après coup ne répare pas l'absence de devis." },
    { titre: "Les DEEE repris et jamais tracés",
      texte: "Reprendre l'ancien appareil fait entrer l'atelier dans la filière des déchets d'équipements électriques et électroniques, avec enlèvement par un éco-organisme et traçabilité. Le stock en arrière-boutique n'est pas une solution." }
  ]}
};
