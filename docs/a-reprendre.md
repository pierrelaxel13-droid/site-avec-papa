# À reprendre

Ce qui est mis de côté, au 29 octobre 2026, pour la prochaine session.

## 1. Lot 7 — fait le 29 octobre (sauf la marque blanche)

Fait : le compte consultant, « Mon cabinet » (ses clients, leurs actions
ouvertes et en retard, leur dernière trace), créer l'espace d'un client,
inviter son responsable, entrer chez lui ; le client coupe ou rouvre l'accès ;
l'abonnement consultant s'ouvre depuis l'Administration.

Choix faits par défaut, à faire valider par Clément :

1. Le consultant voit des nombres et une date par client, jamais le contenu
   des registres depuis sa page cabinet (il le voit en entrant chez le client).
2. Chez le client, il peut tout faire comme un membre (cocher, décider,
   régler le plan), tant que le client l'autorise ; tout est au registre à son nom.
3. C'est le consultant qui crée l'espace, puis invite le responsable du client.
4. Tous les clients d'un cabinet abonné ont la formule complète.

Reste à faire :

- **La marque blanche** : logo, couleur, nom affiché aux clients (et sur les
  exports PDF). À trancher : ce qui change exactement à l'écran.
- **Les collègues du cabinet** : inviter quelqu'un dans le cabinet (la base
  le permet déjà, `inviter(cabinet => …)`, il manque l'écran).
- **Le prix** : 49 / 42 / 35 € par client, marque blanche dès 6 clients —
  à confirmer ; la facturation au nombre de clients viendra avec Stripe.

## 2. Perplexity pour mieux conseiller le client

Idée d'Axel : Perplexity donne, à côté de chaque texte, des conseils et les
sources qui l'entourent (INRS, ministère du Travail, service-public.fr…).

Garde-fous retenus — sans eux, on ne le fait pas :

- recherche **limitée aux sites officiels** (vérifier d'abord ce que permet
  l'API de Perplexity : filtre de domaines) ;
- **chaque lien cité est contrôlé** : site officiel, page qui existe ; sinon la
  réponse n'est pas montrée ;
- la réponse s'affiche **à côté** du texte officiel, jamais à sa place ;
- « proposé par l'IA, à vérifier » et « ne constitue pas un conseil
  juridique » (seuls les avocats donnent un conseil juridique) ;
- rien n'entre au registre sans validation du client ;
- la clé API côté serveur (Supabase), jamais dans le site ; API payante à
  l'usage (prix à vérifier) ; une ligne dans la page de confidentialité.

À placer maintenant que le lot 7 est fait : Clément pourra relire ce que l'IA propose à ses
clients.

Aussi évoqué : Perplexity comme « deuxième paire d'yeux » du robot (il
signale, le robot ne garde que ce qu'il retrouve sur Légifrance / le JO). Et,
plus sûr encore pour une deuxième source du Journal officiel : **l'API
officielle de Légifrance (PISTE)**, gratuite, sur inscription.

## 3. Petites choses en attente

- **Une source retrouvée** : la relève du 29 octobre a trouvé un flux qui
  répond pour une des 6 sources muettes (voir
  `contenu/sources-decouverte.txt`). À vérifier, puis l'ajouter dans
  `contenu/sources.js` (`confirme: true`).

## 4. Côté Axel (rien d'urgent)

- Créer le secret GitHub **`SAUVEGARDE_PHRASE`** (au moins 20 caractères, gardée
  en lieu sûr, copie à Clément) : la sauvegarde hebdomadaire démarre alors.
- Acheter **`pierrel-co.fr`**, puis un compte **Brevo** : courriels automatiques
  (invitations, alertes), en français.
- Créer la société **Pierrel & Co**, puis remplir `SITE.editeur` (build.mjs)
  pour les pages légales ; faire **relire les CGV** par un avocat.
- Option : passer le dépôt en **privé** (GitHub payant, ~4 $/mois) pour que
  personne ne puisse télécharger les sauvegardes chiffrées.
