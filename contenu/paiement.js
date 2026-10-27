/* ==========================================================================
   Pierrel & Co — les liens de paiement Stripe
   --------------------------------------------------------------------------
   C'est le SEUL fichier à remplir pour ouvrir l'abonnement payant.

   Pour chaque formule, coller entre les guillemets le lien de paiement créé
   dans Stripe (Catalogue de produits, puis Liens de paiement). Il commence
   par https://buy.stripe.com/

   Tant qu'un lien est vide, le bouton « Démarrer un abonnement » de cette
   formule ouvre un courriel, comme avant. Dès qu'il est rempli, il ouvre la
   page de paiement Stripe, et la page des tarifs dit que le paiement est en
   ligne.

   « portail » : le lien de connexion du portail client de Stripe (Paramètres,
   Facturation, Portail client). Il commence par https://billing.stripe.com/
   S'il est rempli, un lien « Gérer ou résilier mon abonnement » apparaît sur
   la page des tarifs et en bas de chaque page.

   Ce fichier ne contient aucun secret : ces liens sont faits pour être
   publics. Ne JAMAIS y mettre une clé Stripe (sk_..., pk_..., rk_...).
   ========================================================================== */

window.PAIEMENT = {
  textes:  "",   // Textes — 40 € par mois
  suivi:   "",   // Textes et suivi — 55 € par mois
  complet: "",   // Veille complète — 80 € par mois
  portail: ""    // Gérer ou résilier son abonnement
};
