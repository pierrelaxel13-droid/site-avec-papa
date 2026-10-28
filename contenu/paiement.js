/* ==========================================================================
   Vigie — les liens de paiement Stripe
   --------------------------------------------------------------------------
   C'est le SEUL fichier à remplir pour ouvrir l'abonnement payant.

   Pour chaque formule, deux liens de paiement créés dans Stripe (Catalogue de
   produits, puis Liens de paiement) : l'un pour le prix à l'année, l'autre
   pour le prix au mois. Ils commencent par https://buy.stripe.com/

   Tant qu'un lien est vide, le bouton correspondant ouvre un courriel. Dès qu'il est rempli, il ouvre la
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
  //         à l'année                 au mois
  textes:  { an: "", /* 590 €/an  */  mois: "" /* 59 €/mois  */ },
  suivi:   { an: "", /* 990 €/an  */  mois: "" /* 99 €/mois  */ },
  complet: { an: "", /* 1 490 €/an */ mois: "" /* 149 €/mois */ },
  portail: ""    // Gérer ou résilier son abonnement
};
