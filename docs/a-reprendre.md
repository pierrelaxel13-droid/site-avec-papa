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

## 2. Perplexity : construit le 31 octobre, attend la clé

Fait (outils/conseils.mjs, testé par outils/conseils.test.mjs, lancé par la
relève) : une question par nouveau texte, recherche limitée à 20 sites
officiels, chaque source contrôlée (site de la liste + page qui répond),
réponse jetée sans source valable, liens retirés du texte, 10 questions au
plus par passage, coût noté au journal du robot. Affiché **tout de suite**
(choix d'Axel), sous le texte officiel : « Proposé par l'IA, à vérifier »,
ses sources, « Ne constitue pas un conseil juridique ». Une ligne dans la
politique de confidentialité.

**Côté Axel** : compte API sur perplexity.ai, un peu de crédit, une clé, et
le secret GitHub `PERPLEXITY_API_KEY` (jamais dans le chat). Puis relancer
l'action « Relève » : son résumé dit combien de conseils ont été gardés,
écartés, et ce qu'ils ont coûté.

À surveiller au premier vrai passage : les noms de paramètres de l'API
(vérifiés dans leur documentation, mais jamais essayés en vrai) ; la
qualité des conseils — Clément devrait en lire quelques-uns.

## 3. Le tri des textes par sujet (fait en partie le 29 octobre)

Fait (outils/tri.mjs, testé par outils/tri.test.mjs) : les anciens textes
renvoyés par les archives du JO sont écartés ; sept familles d'actes
individuels de plus ; « transition écologique » ne suffit plus ; un rappel de
produit ne va que dans les sujets « produits ». Relevé : 172 → 58 textes ;
Maçonnerie Vidal : 90 → 20.

**À valider par Clément** :

- Écarter les textes sur les **fonctionnaires** (fonction publique, agents
  publics, militaires, magistrats, praticiens hospitaliers) : nos clients sont
  des entreprises privées. Pas fait tant qu'il n'a pas dit oui.
- **Relire les mots-clés de chaque sujet** (assets/referentiel.js, motsCles) :
  il reste du bruit, par ex. une loi sur la rétention administrative rangée en
  santé-sécurité (« prévention des risques »), un fonds réparti entre
  départements rangé en paie.
- **Les rappels de produits** (RappelConso) : faut-il les mettre au relevé des
  métiers de l'alimentation et du commerce ? Aujourd'hui, presque aucun n'y
  entre (le titre est le nom du produit).

## 4. Petites choses en attente

- **Une source retrouvée** : la relève du 29 octobre a trouvé un flux qui
  répond pour une des 6 sources muettes (voir
  `contenu/sources-decouverte.txt`). À vérifier, puis l'ajouter dans
  `contenu/sources.js` (`confirme: true`).

## 5. Côté Axel (rien d'urgent)

- Dans Supabase, **Authentication → Sign In / Providers → Email** : longueur
  minimale du mot de passe à **10** (comme le site) et, si l'option existe,
  la protection contre les mots de passe déjà fuités. Aujourd'hui, les 10
  caractères ne sont imposés que par la page (revue de sécurité du 31 octobre).
- Créer le secret GitHub **`SAUVEGARDE_PHRASE`** (au moins 20 caractères, gardée
  en lieu sûr, copie à Clément) : la sauvegarde hebdomadaire démarre alors.
- Acheter **`pierrel-co.fr`**, puis un compte **Brevo** : courriels automatiques
  (invitations, alertes), en français.
- Créer la société **Pierrel & Co**, puis remplir `SITE.editeur` (build.mjs)
  pour les pages légales ; faire **relire les CGV** par un avocat.
- Option : passer le dépôt en **privé** (GitHub payant, ~4 $/mois) pour que
  personne ne puisse télécharger les sauvegardes chiffrées.
