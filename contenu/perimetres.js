/* ==========================================================================
   Pierrel & Co — quel morceau de code va sur quelle fiche
   --------------------------------------------------------------------------
   Le client ne doit pas avoir à quitter le site pour lire le texte. Ce
   fichier dit, pour chaque texte de référence du référentiel, le morceau de
   code consolidé à publier mot pour mot sur sa fiche.

   D'OÙ VIENT LE TEXTE
   De la base LEGI, la base officielle des codes et lois consolidés de l'État.
   Le robot la prend dans l'extraction quotidienne publiée par la Fabrique
   numérique des ministères sociaux (@socialgouv/legi-data sur le registre
   npm), qui interroge l'API Légifrance. Licence ouverte : republier est
   permis, à condition de citer la source et la version. C'est ce que fait
   chaque page.

   QUATRE CODES, PAS PLUS
   L'extraction ne porte aujourd'hui que quatre codes : travail, sécurité
   sociale, rural et pêche maritime, relations entre le public et
   l'administration. Les fiches des autres codes gardent leur lien vers
   Légifrance et le disent franchement. Le jour où une source consolidée
   joignable couvre le reste, il suffit d'ajouter des lignes ici.

   « racines » DÉSIGNE UN MORCEAU DE L'ARBRE DU CODE
   Chaque motif est comparé au chemin complet de la section, titres joints par
   « / ». Un code a deux branches, législative et réglementaire ; un motif qui
   ne cite pas la branche attrape donc les deux, ce qui est presque toujours
   ce qu'on veut : le L et le R vont ensemble.

   CE DÉCOUPAGE EST UNE AIDE À LA LECTURE, PAS UN AVIS JURIDIQUE
   Dire que « ATEX » renvoie aux deux sections « Prévention des explosions »
   est un choix de navigation. Il est à relire par Clément Pierrel, et les
   pages le signalent.
   ========================================================================== */

window.CODES_SUIVIS = [
  { id: "LEGITEXT000006072050", titre: "Code du travail" },
  { id: "LEGITEXT000006073189", titre: "Code de la sécurité sociale" },
  { id: "LEGITEXT000022197698", titre: "Code rural et de la pêche maritime" },
  { id: "LEGITEXT000031366350", titre: "Code des relations entre le public et l'administration" }
];

window.PERIMETRES = [

  /* --- Santé et sécurité au travail : le cœur du métier -------------------- */
  { ref: "Code du travail, 4e partie (santé et sécurité)",
    code: "LEGITEXT000006072050",
    racines: ["Quatrième partie : Santé et sécurité au travail$"] },

  /* La fiche générale du code pointe le même périmètre : c'est celui que la
     veille suit. Le reste du code n'est pas publié ici, et la fiche le dit. */
  { ref: "Code du travail",
    code: "LEGITEXT000006072050",
    racines: ["Quatrième partie : Santé et sécurité au travail$"] },

  { ref: "Code du travail — risque chimique et ACD/CMR",
    code: "LEGITEXT000006072050",
    racines: ["Prévention de certains risques d'exposition / Titre Ier : Risques chimiques$"] },

  { ref: "Code du travail — risque amiante",
    code: "LEGITEXT000006072050",
    racines: [
      "Risques chimiques / Chapitre II bis : Risques d'exposition à l'amiante",
      "Risques chimiques / Chapitre IV : Risques d'exposition à l'amiante",
      "Mesures de prévention des risques chimiques / Section 3 : Risques d'exposition à l'amiante$"
    ] },

  { ref: "Code du travail — équipements de travail",
    code: "LEGITEXT000006072050",
    racines: ["Livre III : Equipements de travail et moyens de protection$"] },

  { ref: "Code du travail — chantiers de bâtiment et génie civil",
    code: "LEGITEXT000006072050",
    racines: ["Prévention des risques liés à certaines activités ou opérations / Titre III : Bâtiment et génie civil$"] },

  { ref: "Code du travail — ATEX",
    code: "LEGITEXT000006072050",
    racines: [
      "Risques d'incendies et d'explosions et évacuation / Section 8 : Prévention des explosions$",
      "Risques d'incendies et d'explosions et évacuation / Section 6 : Prévention des explosions$",
      "Risques d'incendies et d'explosions et évacuation / Section 4 : Emploi et stockage de matières explosives et inflammables$"
    ] },

  /* --- Les trois autres fiches du code du travail -------------------------- */
  { ref: "Code du travail — travail temporaire",
    code: "LEGITEXT000006072050",
    racines: ["Le contrat de travail / Titre V : Contrat de travail temporaire, autres contrats de mise à disposition et portage salarial$"] },

  { ref: "Code du travail — spectacle et intermittents",
    code: "LEGITEXT000006072050",
    racines: ["Livre Ier : Journalistes professionnels, professions du spectacle, de l'audiovisuel, de la publicité et de la mode / Titre II : Professions du spectacle, de l'audiovisuel, de la publicité et de la mode$"] },

  { ref: "Code du travail — formation professionnelle",
    code: "LEGITEXT000006072050",
    racines: ["Sixième partie : La formation professionnelle tout au long de la vie / Livre III : La formation professionnelle"] },

  /* --- Accidents du travail et maladies professionnelles ------------------- */
  { ref: "Code de la sécurité sociale",
    code: "LEGITEXT000006073189",
    racines: ["Livre IV : Accidents du travail et maladies professionnelles"] },

  /* --- Produits phytopharmaceutiques -------------------------------------- */
  { ref: "Réglementation sur les produits phytopharmaceutiques",
    code: "LEGITEXT000022197698",
    racines: [
      "La protection des végétaux / Chapitre III : Mise sur le marché et utilisation des produits phytopharmaceutiques",
      "La protection des végétaux / Chapitre IV : La mise en vente, la vente, la distribution à titre gratuit",
      "La protection des végétaux / Chapitre VI : Règles relatives aux matériels destinés à l'application"
    ] },

  { ref: "Code rural et de la pêche maritime",
    code: "LEGITEXT000022197698",
    racines: ["La protection des végétaux / Chapitre III : Mise sur le marché et utilisation des produits phytopharmaceutiques"] }
];
