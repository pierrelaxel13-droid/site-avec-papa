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
  ]}
};
