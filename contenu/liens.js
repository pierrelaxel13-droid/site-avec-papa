/* ==========================================================================
   Pierrel & Co — où lire chaque texte, pour de vrai
   --------------------------------------------------------------------------
   build.mjs sait déjà trouver tout seul l'adresse d'un code français (par son
   identifiant LEGITEXT) et d'un règlement européen numéroté (par son CELEX).
   Restaient 72 références pour lesquelles il proposait « chercher ce texte » :
   un renvoi vers une recherche, c'est-à-dire du travail laissé au client.

   Ce fichier donne à chacune sa destination officielle. Deux formes :

     { code: "Code du travail" }   le texte est codifié là ; l'adresse exacte
                                   est reconstruite à partir de l'annuaire des
                                   codes relevé dans la base LEGI, jamais
                                   écrite à la main.
     { url: "https://…" }          l'autorité qui publie ce texte, à l'adresse
                                   où il se trouve.

   « quoi » dit ce qu'on va y trouver : c'est ce que lit le client sous le
   lien, pour savoir où il va avant de cliquer.

   RÈGLE
   Quand une référence désigne une famille de textes — « arrêtés de
   vérifications périodiques », « conventions collectives » — il n'existe pas
   un texte unique à pointer. On envoie alors vers le recueil officiel de ces
   textes, et la page le dit : « les textes », pas « le texte ». On n'invente
   jamais un identifiant pour faire joli : une adresse fausse coûte plus cher
   qu'une adresse large.
   ========================================================================== */

window.LIENS = {

  /* --- Travail, santé-sécurité -------------------------------------------- */
  "Décrets et arrêtés d'application par risque":
    { code: "Code du travail", quoi: "la partie réglementaire, où ces décrets sont codifiés" },
  "Règles de coordination SPS":
    { code: "Code du travail", quoi: "le livre V : bâtiment et génie civil" },
  "Arrêtés de vérifications périodiques":
    { code: "Code du travail", quoi: "les vérifications périodiques des équipements" },
  "Arrêtés de formation et de certification":
    { code: "Code du travail", quoi: "les obligations de formation à la sécurité" },
  "Obligations de formation continue":
    { code: "Code du travail", quoi: "la sixième partie : la formation professionnelle" },
  "Réglementation des lieux de spectacle":
    { code: "Code du travail", quoi: "la septième partie : professions du spectacle" },
  "Recommandations OPPBTP":
    { url: "https://www.preventionbtp.fr", quoi: "les recommandations de l'OPPBTP, l'organisme de prévention du bâtiment" },
  "Accords de branche de prévention":
    { url: "https://www.legifrance.gouv.fr/liste/idcc", quoi: "les conventions et accords de branche, sur Légifrance" },

  /* --- Social, paie ------------------------------------------------------- */
  "Convention collective de branche (IDCC)":
    { url: "https://www.legifrance.gouv.fr/liste/idcc", quoi: "les conventions collectives, par numéro IDCC" },
  "Convention collective du travail temporaire":
    { url: "https://www.legifrance.gouv.fr/liste/idcc", quoi: "les conventions collectives, par numéro IDCC" },
  "Accords d'entreprise":
    { url: "https://www.legifrance.gouv.fr/acco", quoi: "la base nationale des accords d'entreprise" },
  "Bulletin officiel de la Sécurité sociale (BOSS)":
    { url: "https://boss.gouv.fr", quoi: "le Bulletin officiel de la Sécurité sociale, opposable à l'URSSAF" },
  "Lois de financement de la sécurité sociale":
    { url: "https://www.securite-sociale.fr", quoi: "le portail de la Sécurité sociale, qui publie chaque LFSS" },

  /* --- Fiscal, comptable --------------------------------------------------- */
  "Loi de finances annuelle":
    { url: "https://www.budget.gouv.fr", quoi: "le portail du budget de l'État, qui publie chaque loi de finances" },
  "Plan comptable général":
    { url: "https://www.anc.gouv.fr", quoi: "l'Autorité des normes comptables, qui écrit le plan comptable" },

  /* --- Données, numérique --------------------------------------------------- */
  "Loi Informatique et Libertés":
    { url: "https://www.cnil.fr/fr/loi-78-17-du-6-janvier-1978-modifiee", quoi: "le texte consolidé, publié par la CNIL" },
  "Lignes directrices et sanctions CNIL":
    { url: "https://www.legifrance.gouv.fr/cnil", quoi: "les délibérations de la CNIL, sur Légifrance" },
  "Référentiels et guides ANSSI":
    { url: "https://cyber.gouv.fr/publications", quoi: "les publications de l'ANSSI" },
  "Référentiel général d'amélioration de l'accessibilité (RGAA)":
    { url: "https://accessibilite.numerique.gouv.fr", quoi: "le RGAA, publié par la DINUM" },

  /* --- Environnement -------------------------------------------------------- */
  "Loi AGEC (économie circulaire)":
    { code: "Code de l'environnement", quoi: "le livre V, où la loi AGEC est codifiée" },
  "Loi AGEC":
    { code: "Code de l'environnement", quoi: "le livre V, où la loi AGEC est codifiée" },
  "Obligations de tri dites « 5 flux »":
    { code: "Code de l'environnement", quoi: "les articles R. 543-281 et suivants" },
  "Arrêtés de filières REP":
    { code: "Code de l'environnement", quoi: "le titre IV du livre V : filières à responsabilité élargie" },
  "Nomenclature des installations classées":
    { url: "https://aida.ineris.fr", quoi: "AIDA, le recueil des textes ICPE tenu par l'INERIS" },
  "Arrêtés ministériels de prescriptions générales":
    { url: "https://aida.ineris.fr", quoi: "AIDA, le recueil des textes ICPE tenu par l'INERIS" },
  "Arrêtés de prescriptions de rejet":
    { url: "https://aida.ineris.fr", quoi: "AIDA, le recueil des textes ICPE tenu par l'INERIS" },
  "Arrêtés d'émissions applicables à l'activité":
    { url: "https://aida.ineris.fr", quoi: "AIDA, le recueil des textes ICPE tenu par l'INERIS" },
  "Arrêtés de stockage de liquides inflammables":
    { url: "https://aida.ineris.fr", quoi: "AIDA, le recueil des textes ICPE tenu par l'INERIS" },
  "Arrêté préfectoral propre au site":
    { url: "https://www.georisques.gouv.fr", quoi: "Géorisques, où sont publiés les actes ICPE de votre site" },
  "Règlement d'assainissement local":
    { url: "https://www.eaufrance.fr", quoi: "le portail de l'eau — ce règlement, lui, est pris par votre collectivité" },
  "Réglementation du bruit de voisinage":
    { code: "Code de la santé publique", quoi: "les articles R. 1334-30 et suivants" },
  "Dispositif éco-énergie tertiaire (décret tertiaire)":
    { url: "https://operat.ademe.fr", quoi: "OPERAT, la plateforme de l'ADEME où se fait la déclaration" },

  /* --- Bâtiment, locaux ------------------------------------------------------ */
  "Réglementation sur les systèmes d'automatisation (BACS)":
    { code: "Code de la construction et de l'habitation", quoi: "le décret BACS, codifié au livre Ier" },
  "RE2020":
    { url: "https://rt-re-batiment.developpement-durable.gouv.fr", quoi: "le site officiel de la réglementation environnementale" },
  "DTU et normes NF applicables":
    { url: "https://www.boutique.afnor.org", quoi: "AFNOR, qui publie les normes NF et les DTU" },
  "Règlement de sécurité contre l'incendie dans les ERP":
    { code: "Code de la construction et de l'habitation", quoi: "la sécurité incendie des établissements recevant du public" },
  "Règlement de sécurité des ERP de type O":
    { code: "Code de la construction et de l'habitation", quoi: "les règles propres aux hôtels, type O" },
  "Règles d'accessibilité des ERP":
    { code: "Code de la construction et de l'habitation", quoi: "l'accessibilité des établissements recevant du public" },

  /* --- Énergie, réseaux ------------------------------------------------------ */
  "Délibérations de la CRE":
    { url: "https://www.cre.fr", quoi: "les délibérations de la Commission de régulation de l'énergie" },
  "Règles de raccordement des gestionnaires de réseau":
    { url: "https://www.enedis.fr", quoi: "les documentations de raccordement du gestionnaire de réseau" },

  /* --- Extractif ------------------------------------------------------------- */
  "Règlement général des industries extractives":
    { code: "Code minier", quoi: "le code minier, dont relève le RGIE" },

  /* --- Europe ---------------------------------------------------------------- */
  "Règlements et directives d'harmonisation de l'UE":
    { url: "https://eur-lex.europa.eu", quoi: "EUR-Lex, le Journal officiel de l'Union européenne" },
  "Normes harmonisées citées au JOUE":
    { url: "https://eur-lex.europa.eu", quoi: "EUR-Lex, où sont citées les normes harmonisées" },
  "Règlements européens et doctrine des autorités":
    { url: "https://eur-lex.europa.eu", quoi: "EUR-Lex, le Journal officiel de l'Union européenne" },
  "Directives européennes marchés":
    { url: "https://eur-lex.europa.eu", quoi: "EUR-Lex, le Journal officiel de l'Union européenne" },
  "Directives européennes sur le droit d'auteur":
    { url: "https://eur-lex.europa.eu", quoi: "EUR-Lex, le Journal officiel de l'Union européenne" },
  "Code des douanes de l'Union":
    { url: "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32013R0952", quoi: "le règlement (UE) 952/2013, texte intégral" },
  "Règlements européens sur les temps de conduite et le tachygraphe":
    { url: "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32006R0561", quoi: "le règlement (CE) 561/2006, texte intégral" },
  "Mesures restrictives de l'UE":
    { url: "https://www.sanctionsmap.eu", quoi: "la carte officielle des sanctions de l'Union européenne" },
  "Règlements PAC":
    { url: "https://agriculture.gouv.fr", quoi: "le ministère de l'Agriculture, qui applique la PAC" },

  /* --- Commerce, consommation ------------------------------------------------ */
  "Règles de la vente en ligne":
    { code: "Code de la consommation", quoi: "les contrats conclus à distance" },
  "Code des douanes national":
    { code: "Code des douanes", quoi: "le code des douanes français" },
  "Déclarations obligatoires aux autorités":
    { url: "https://www.service-public.fr", quoi: "le portail officiel des démarches des entreprises" },

  /* --- Transport, matières dangereuses --------------------------------------- */
  "Accord ADR":
    { url: "https://unece.org/transport/dangerous-goods", quoi: "l'accord ADR, publié par la CEE-ONU" },

  /* --- Santé, médico-social --------------------------------------------------- */
  "Référentiels d'évaluation nationaux":
    { url: "https://www.has-sante.fr", quoi: "la Haute Autorité de santé, qui écrit ces référentiels" },
  "Bonnes pratiques de fabrication et de distribution":
    { url: "https://ansm.sante.fr", quoi: "l'ANSM, qui publie les bonnes pratiques" },

  /* --- Agriculture ------------------------------------------------------------ */
  "Réglementation sur les produits phytopharmaceutiques":
    { code: "Code rural et de la pêche maritime", quoi: "le titre V du livre II : la protection des végétaux" },

  /* --- Professions réglementées ------------------------------------------------ */
  "Textes propres à chaque profession":
    { url: "https://www.legifrance.gouv.fr/liste/code", quoi: "tous les codes en vigueur, sur Légifrance" },
  "Codes de déontologie":
    { url: "https://www.legifrance.gouv.fr/liste/code", quoi: "tous les codes en vigueur, sur Légifrance" },
  "Code de déontologie des activités privées de sécurité":
    { code: "Code de la sécurité intérieure", quoi: "le livre VI : activités privées de sécurité" },
  "Arrêtés relatifs aux équipements et aux diplômes":
    { code: "Code du sport", quoi: "les diplômes et les équipements sportifs" },
  "Référentiel national qualité (Qualiopi)":
    { url: "https://travail-emploi.gouv.fr", quoi: "le ministère du Travail, qui publie le référentiel national qualité" },

  /* --- Immobilier, logement ---------------------------------------------------- */
  "Loi Hoguet et son décret d'application":
    { url: "https://www.economie.gouv.fr/dgccrf", quoi: "la DGCCRF, qui contrôle l'application de la loi Hoguet" },
  "Loi du 6 juillet 1989 sur les baux d'habitation":
    { url: "https://www.service-public.fr", quoi: "le portail officiel, qui publie le régime des baux d'habitation" },

  /* --- Commande publique --------------------------------------------------------- */
  "Code de la commande publique":
    { url: "https://www.economie.gouv.fr/daj", quoi: "la direction des affaires juridiques, qui tient le code" },
  "Cahiers des clauses administratives générales":
    { url: "https://www.economie.gouv.fr/daj", quoi: "la direction des affaires juridiques, qui publie les CCAG" },

  /* --- Communications, audiovisuel, jeux ------------------------------------------- */
  "Décisions de l'ARCEP":
    { url: "https://www.arcep.fr", quoi: "les décisions de l'ARCEP" },
  "Réglementation des services audiovisuels":
    { url: "https://www.arcom.fr", quoi: "l'Arcom, régulateur de l'audiovisuel et du numérique" },
  "Réglementation des jeux en ligne":
    { url: "https://anj.fr", quoi: "l'Autorité nationale des jeux" },
  "Décisions de l'Autorité nationale des jeux":
    { url: "https://anj.fr", quoi: "les décisions de l'Autorité nationale des jeux" },

  /* --- Associations -------------------------------------------------------------- */
  "Loi du 1er juillet 1901":
    { url: "https://www.associations.gouv.fr", quoi: "le portail officiel des associations" },
  "Contrat d'engagement républicain":
    { url: "https://www.associations.gouv.fr", quoi: "le portail officiel des associations" }
};
