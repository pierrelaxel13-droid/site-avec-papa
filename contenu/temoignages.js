/* ==========================================================================
   Pierrel & Co — les avis des clients
   --------------------------------------------------------------------------
   Ils défilent dans la barre « avis » de l'accueil. On n'y met que de vrais
   avis, reçus par le formulaire « Laisser votre avis » (ils arrivent par
   courriel à contact@pierrel-co.fr) et publiés avec l'accord de leur auteur.
   Tant que la liste est vide, la section n'apparaît pas du tout : on n'invente
   pas d'avis, et on n'affiche pas d'emplacements vides.

   Un avis s'écrit ainsi :
     { nom: "Prénom N.", entreprise: "Nom de l'entreprise", ville: "Ville",
       note: 5, texte: "Ce que la personne a écrit, tel quel.", le: "2026-11-02" },
   « note » (1 à 5), « entreprise », « ville » et « le » sont facultatifs.
   ========================================================================== */

window.TEMOIGNAGES = [
];
