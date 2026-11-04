/* ==========================================================================
   Vigie — les liens de paiement Stripe
   --------------------------------------------------------------------------
   C'est le SEUL fichier à remplir pour ouvrir l'abonnement payant.

   Pour chaque formule, deux liens de paiement créés dans Stripe (Catalogue de
   produits, puis Liens de paiement) : l'un pour le prix à l'année, l'autre
   pour le prix au mois. Ils commencent par https://buy.stripe.com/

   Tant qu'un lien est vide, le bouton correspondant ouvre un courriel. Dès qu'il est rempli, il ouvre la
   page de paiement Stripe et la page des tarifs dit que le paiement est en
   ligne.

   « portail » : le lien de connexion du portail client de Stripe (Paramètres,
   Facturation, Portail client). Il commence par https://billing.stripe.com/
   S'il est rempli, un lien « Gérer ou résilier mon abonnement » apparaît sur
   la page des tarifs et en bas de chaque page.

   CE QU'IL FAUT RÉGLER DANS STRIPE (une fois)
   1. Paramètres → Moyens de paiement : activer « Carte » et « Prélèvement
      SEPA » (SEPA Direct Debit). La page de paiement Stripe proposera les
      deux ; le client choisit.
   2. Catalogue de produits : un produit par formule, avec deux prix
      récurrents (par an, par mois). Sur chaque produit, une métadonnée
      « formule » = textes, suivi ou complet (sinon le robot lit le nom).
   3. Pour chaque lien de paiement, « Après le paiement » → « Rediriger vers
      votre site » : https://vigie-reglementaire.fr/compte/paiement.html?merci=1
   4. Développeurs → Clés API → « Créer une clé restreinte », en LECTURE sur
      Checkout Sessions, Subscriptions, Products et Prices. La copier dans les
      secrets du dépôt GitHub sous le nom STRIPE_SECRET_KEY — jamais ici, jamais
      dans une conversation. Le robot .github/workflows/paiements.yml ouvre
      alors la formule du client dans les 15 minutes qui suivent son paiement.

   Les boutons « S'abonner » mènent à compte/paiement.html (récapitulatif,
   entreprise, CGV), qui ouvre ensuite ces liens avec l'identifiant de
   l'entreprise (client_reference_id) : c'est ainsi que le paiement retrouve
   son entreprise.

   Ce fichier ne contient aucun secret : ces liens sont faits pour être
   publics. Ne JAMAIS y mettre une clé Stripe (sk_..., pk_..., rk_...).
   ========================================================================== */

window.PAIEMENT = {
  //         à l'année                 au mois
  textes:  { an: "", /* 410 €/an  */  mois: "" /* 39 €/mois  */ },
  suivi:   { an: "", /* 650 €/an  */  mois: "" /* 59 €/mois  */ },
  complet: { an: "", /* 999 €/an */ mois: "" /* 89 €/mois */ },
  portail: ""    // Gérer ou résilier son abonnement
};
