# À reprendre

Ce qui est mis de côté, au 29 octobre 2026, pour la prochaine session.

## 1. Lot 7 — l'espace des consultants (marque blanche)

À trancher avec Clément avant de construire :

1. **Ce que le consultant voit** : la liste de ses clients, et pour chacun le
   plan, le registre, les retards ? Autre chose ?
2. **Ce qu'il peut faire chez un client** : regarder seulement, ou aussi cocher
   et décider à sa place ? (La base le permet déjà, si le client l'autorise.)
3. **La marque blanche** : logo, couleur, nom affiché ? Les courriels plus tard ?
4. **Qui crée l'espace du client** : le consultant, ou le client qui choisit
   ensuite son consultant ?
5. **Le prix** : on garde 49 / 42 / 35 € par client, marque blanche dès 6 clients ?

Déjà dans la base (lot 5) : `consultants` (avec `theme` et `marque_blanche`),
`membres_consultant`, `entreprises.consultant_id` et `acces_consultant`,
`creer_cabinet`, `creer_entreprise_cliente`, `choisir_consultant`, la vue
`prive.clients_actifs_consultant` (facturation). Il manque surtout les écrans.

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

À placer **après le lot 7** : Clément pourra relire ce que l'IA propose à ses
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
