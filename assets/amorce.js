/* ==========================================================================
   Pierrel & Co — l'amorce, avant tout rendu
   --------------------------------------------------------------------------
   Ce fichier tenait dans la page, entre deux balises <script>. Il en est sorti
   pour une seule raison : la politique de sécurité du site interdit désormais
   tout script écrit dans le HTML. C'est la règle qui empêche un script injecté
   de s'exécuter ; elle ne vaut que si nous nous l'appliquons à nous-mêmes.

   Il doit rester chargé sans « defer » et avant le corps de la page : sinon
   elle clignote en clair avant de passer au thème choisi, et les éléments qui
   doivent apparaître en défilant sauteraient de visible à caché.
   ========================================================================== */

window.PCO_THEME.appliquer();

/* Le document n'est marqué « anime » que si JavaScript tourne et que le
   visiteur n'a pas demandé moins d'animations — sans quoi rien n'est caché. */
if (!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)) {
  document.documentElement.classList.add("anime");
}

/* Une page à catégories s'ouvre sur ses seules cartes : on le pose avant le
   rendu pour qu'elle n'affiche pas tout une fraction de seconde. Sur une page
   sans catégories, la règle ne trouve rien à cacher. Avec une ancre, app.js
   décide lui-même quelle catégorie montrer. */
if (!location.hash) document.documentElement.setAttribute("data-vue", "categories");
