/* ==========================================================================
   Vigie — les normes de référence, par sujet (3 novembre 2026)
   --------------------------------------------------------------------------
   Une liste de normes (NF, EN, ISO, DTU) utiles à chaque sujet du
   référentiel, donc aux métiers (codes APE) qui le suivent.

   CE QUE CETTE LISTE EST, ET CE QU'ELLE N'EST PAS
   - Le texte des normes est payant et protégé (AFNOR, ISO) : le site ne
     donne que la référence et l'intitulé, jamais le contenu.
   - Une norme est d'application VOLONTAIRE, sauf quand un texte
     réglementaire la rend obligatoire. Le site le dit à côté de la liste.
   - Ces propositions ont été préparées par l'assistant, à partir de
     références connues : CHACUNE porte « valide: false » tant que Clément
     Pierrel ne l'a pas relue. Seules les normes « valide: true » s'affichent
     dans l'application ; la liste complète, à relire, est dans l'espace
     administrateur.
   - Les nouvelles normes homologuées ou annulées arrivent d'elles-mêmes dans
     le relevé (avis mensuel du Journal officiel, outils/tri.mjs).

   Pour valider : passer « valide » à true (et corriger l'intitulé s'il le
   faut). Pour en ajouter : { ref, titre, valide } dans le sujet voulu, à la
   clé exacte du sujet dans assets/referentiel.js.
   ========================================================================== */

window.NORMES = {
  sst: [
    { ref: "NF ISO 45001", titre: "Systèmes de management de la santé et de la sécurité au travail — Exigences et lignes directrices pour leur utilisation", valide: false }
  ],
  chantier_sps: [
    { ref: "NF EN 12811-1", titre: "Équipements temporaires de chantiers — Partie 1 : échafaudages — Exigences de performance et étude, en général", valide: false },
    { ref: "NF EN 1004-1", titre: "Échafaudages roulants de service en éléments préfabriqués — Partie 1 : matériaux, dimensions, charges de calcul et exigences de sécurité", valide: false }
  ],
  levage: [
    { ref: "NF EN 280", titre: "Plates-formes élévatrices mobiles de personnel — Calculs de conception, stabilité, construction, sécurité, examens et essais", valide: false },
    { ref: "NF EN 13000", titre: "Appareils de levage à charge suspendue — Grues mobiles", valide: false }
  ],
  produits_ce: [
    { ref: "NF EN ISO 12100", titre: "Sécurité des machines — Principes généraux de conception — Appréciation du risque et réduction du risque", valide: false }
  ],
  chimie: [
    { ref: "NF EN 689", titre: "Exposition sur les lieux de travail — Mesurage de l'exposition par inhalation d'agents chimiques — Stratégie pour vérifier la conformité à des valeurs limites d'exposition professionnelle", valide: false }
  ],
  amiante: [
    { ref: "NF X46-020", titre: "Repérage des matériaux et produits contenant de l'amiante dans les immeubles bâtis", valide: false }
  ],
  atex: [
    { ref: "NF EN IEC 60079-14", titre: "Atmosphères explosives — Partie 14 : conception, sélection et construction des installations électriques", valide: false }
  ],
  construction: [
    { ref: "NF EN 1990", titre: "Eurocodes structuraux — Bases de calcul des structures", valide: false },
    { ref: "NF DTU 20.1", titre: "Ouvrages en maçonnerie de petits éléments — Parois et murs", valide: false },
    { ref: "NF C 15-100", titre: "Installations électriques à basse tension", valide: false }
  ],
  erp: [
    { ref: "NF S 61-970", titre: "Règles d'installation des systèmes de détection incendie", valide: false }
  ],
  env_general: [
    { ref: "NF EN ISO 14001", titre: "Systèmes de management environnemental — Exigences et lignes directrices pour son utilisation", valide: false }
  ],
  energie_tertiaire: [
    { ref: "NF EN ISO 50001", titre: "Systèmes de management de l'énergie — Exigences et recommandations de mise en œuvre", valide: false }
  ],
  alimentaire: [
    { ref: "NF EN ISO 22000", titre: "Systèmes de management de la sécurité des denrées alimentaires — Exigences pour tout organisme appartenant à la chaîne alimentaire", valide: false }
  ],
  cyber: [
    { ref: "NF EN ISO/IEC 27001", titre: "Sécurité de l'information, cybersécurité et protection de la vie privée — Systèmes de management de la sécurité de l'information — Exigences", valide: false }
  ],
  rgpd: [
    { ref: "ISO/IEC 27701", titre: "Techniques de sécurité — Extension d'ISO/IEC 27001 et ISO/IEC 27002 au management de la protection de la vie privée", valide: false }
  ],
  accessibilite_num: [
    { ref: "EN 301 549", titre: "Exigences d'accessibilité applicables aux produits et services TIC", valide: false }
  ],
  pharma: [
    { ref: "NF EN ISO 13485", titre: "Dispositifs médicaux — Systèmes de management de la qualité — Exigences à des fins réglementaires", valide: false }
  ]
};
