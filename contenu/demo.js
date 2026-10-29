/* ==========================================================================
   Pierrel & Co — jeu de démonstration
   --------------------------------------------------------------------------
   L'application n'a pas de serveur : ce fichier tient lieu de données pour
   qu'elle ait quelque chose à montrer. Entreprise fictive, textes fictifs.

   Il est affiché comme tel dans l'application — un bandeau le rappelle sur
   chaque écran. Rien ici ne doit être présenté comme une vraie veille ni
   comme de vrais textes parus : les références sont inventées.
   ========================================================================== */

window.DEMO = {
  entreprise: {
    nom: "Maçonnerie Vidal",
    ville: "Miramas (13140)",
    naf: "43",
    nafComplet: "43.99C",
    effectif: 14,
    contexte: ["salaries", "public", "bati_ancien", "vehicules"],
    responsable: "Karim Vidal, gérant",
    depuis: "mars 2026"
  },

  /* Le relevé : ce que l'abonné paie. Un texte paru, rattaché à un domaine,
     avec ce que ça change et où on en est. */
  releve: [
    { date: "2026-10-14", titre: "Arrêté modifiant les règles de vérification des échafaudages roulants",
      domaine: "levage", nature: "Arrêté", priorite: "haute", statut: "a-analyser",
      quoi: "Ajoute une vérification à la remise en service après déplacement. Concerne vos trois échafaudages roulants." },
    { date: "2026-10-09", titre: "Décret relatif au repérage amiante avant travaux dans le bâti résidentiel",
      domaine: "amiante", nature: "Décret", priorite: "haute", statut: "action",
      quoi: "Précise les obligations du donneur d'ordre. À faire figurer dans vos devis de rénovation." },
    { date: "2026-10-02", titre: "Revalorisation du plafond de la sécurité sociale",
      domaine: "paie", nature: "Arrêté", priorite: "moyenne", statut: "analyse",
      quoi: "Sans effet sur vos bulletins : aucun salarié au-delà du plafond." },
    { date: "2026-09-28", titre: "Extension de l'avenant salaires de la convention collective du bâtiment",
      domaine: "social", nature: "Arrêté d'extension", priorite: "haute", statut: "clos",
      quoi: "Minima relevés. Deux de vos coefficients étaient en dessous : corrigés sur la paie de septembre." },
    { date: "2026-09-21", titre: "Nouvelle filière de reprise des déchets de chantier",
      domaine: "dechets", nature: "Décret", priorite: "moyenne", statut: "action",
      quoi: "Change votre exutoire pour les gravats mêlés. Devis à demander au prestataire actuel." },
    { date: "2026-09-15", titre: "Zone à faibles émissions — calendrier d'application métropolitain",
      domaine: "transport", nature: "Arrêté préfectoral", priorite: "moyenne", statut: "a-analyser",
      quoi: "Deux de vos quatre utilitaires seront concernés à la prochaine étape." },
    { date: "2026-09-08", titre: "Mise à jour du référentiel de certification des travaux en hauteur",
      domaine: "chantier_sps", nature: "Décision", priorite: "basse", statut: "clos",
      quoi: "Les habilitations en cours restent valables jusqu'à leur échéance." },
    { date: "2026-08-30", titre: "Obligations de facturation électronique — report du calendrier",
      domaine: "fiscal", nature: "Loi", priorite: "haute", statut: "analyse",
      quoi: "Votre échéance de réception est décalée. Le choix de la plateforme reste à faire." }
  ],

  /* Le registre : ce qu'un auditeur demande. Chaque ligne est une trace datée. */
  registre: [
    { date: "2026-10-15", type: "revue", objet: "Revue hebdomadaire santé-sécurité",
      par: "Karim Vidal", detail: "Deux textes relevés, un classé sans suite, un porté en action." },
    { date: "2026-10-10", type: "action", objet: "Mention du repérage amiante dans les devis de rénovation",
      par: "Karim Vidal", detail: "Modèle de devis modifié. Échéance : 31 octobre.", echeance: "2026-10-31" },
    { date: "2026-10-03", type: "decision", objet: "Plafond de la sécurité sociale — sans effet",
      par: "Cabinet comptable", detail: "Écarté après vérification : aucun salarié concerné." },
    { date: "2026-09-29", type: "action", objet: "Correction de deux coefficients de paie",
      par: "Cabinet comptable", detail: "Appliqué sur la paie de septembre. Clos.", clos: true },
    { date: "2026-09-22", type: "action", objet: "Consulter le prestataire déchets sur les gravats mêlés",
      par: "Karim Vidal", detail: "En attente de devis.", echeance: "2026-11-15" },
    { date: "2026-09-18", type: "revue", objet: "Revue mensuelle sociale et paie",
      par: "Karim Vidal", detail: "Trois textes relevés, deux écartés." },
    { date: "2026-09-01", type: "revue", objet: "Revue trimestrielle environnement",
      par: "Karim Vidal", detail: "Un texte relevé, porté en action." }
  ],

  /* La démonstration consultant (demo/cabinet.html) : un cabinet fictif et
     ses clients fictifs. Maçonnerie Vidal est l'entreprise ci-dessus : ses
     chiffres sont calculés depuis son registre, et c'est le seul espace qui
     s'ouvre. Les autres montrent les autres cas : un client en retard, un
     client sans compte (à inviter), un client qui a coupé l'accès. */
  cabinet: {
    nom: "Cabinet Exemple QSE",
    clients: [
      { denomination: "Boulangerie Martin", naf: "10.71C", cree_le: "2026-05-12", membres: 2,
        actions_ouvertes: 3, actions_en_retard: 2, derniere_trace: "2026-09-02" },
      { denomination: "Transports Rey", naf: "49.41A", cree_le: "2026-10-20", membres: 0,
        actions_ouvertes: 0, actions_en_retard: 0, derniere_trace: null },
      { denomination: "Garage Fabre", naf: "45.20A", cree_le: "2026-04-03", membres: 1, acces: false }
    ]
  },

  /* La prochaine échéance de revue, par rythme. */
  echeances: [
    { frequence: "hebdomadaire", prochaine: "2026-10-22", retard: false },
    { frequence: "mensuelle", prochaine: "2026-10-18", retard: true },
    { frequence: "trimestrielle", prochaine: "2026-12-01", retard: false },
    { frequence: "annuelle", prochaine: "2027-03-01", retard: false }
  ]
};
