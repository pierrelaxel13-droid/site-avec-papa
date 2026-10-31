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

## 2. Perplexity : les conseils de l'IA, réservés aux formules 2 et 3

Fait le 31 octobre (outils/conseils.mjs, testé par outils/conseils.test.mjs ;
base : migration 10, testée par supabase/tests/isolation.sql section 15).

**Qui paie quoi** (choix d'Axel) : formule 2 « Textes et suivi », un conseil
par texte, le même pour tous ; formule 3 « Veille complète », le même plus un
conseil pour sa famille de métiers (division NAF). Formule 1 : aucun.

**On ne paie que pour un vrai client** : le robot lit dans la base les
entreprises qui paient la formule 2 ou 3 (abonnement actif ou « offert » ;
l'entreprise de l'administrateur ne compte pas), calcule leur plan comme le
site, et ne demande que pour les textes qui touchent l'un de ces plans. Sans
client : zéro question, zéro centime.

**Personne ne lit ce qu'il ne paie pas** : les conseils sont dans la table
`conseils` de la base (aucun droit pour le navigateur), lus par
`conseils_lire`, qui vérifie l'entreprise et sa formule. Rien dans les pages,
rien dans le dépôt (contenu/conseils.json est supprimé).

**Le robot et l'IA ensemble** : le robot donne le début du texte officiel,
les sujets où il l'a rangé et ce que le référentiel fait déjà suivre ; l'IA
répond en cases (concerne / qui / à faire / quand). Une date « quand » absente
du texte officiel est retirée. « Ne concerne pas ce sujet » n'est pas montré
et part dans l'administration (« Les conseils de l'IA ») pour Clément : l'IA
ne retire jamais un texte du relevé.

**Plafond de dépense** : 10 $ par mois, tous clients confondus
(`CONSEILS_BUDGET_MOIS` dans releve.yml ; migration 11). Chaque conseil garde
son coût ; atteint, le robot ne demande plus rien jusqu'au mois suivant, et le
dit au passage. La dépense du mois s'affiche dans l'administration. Ordre de
grandeur attendu : 0,003 $ la question, ~4 nouveaux textes par jour, un
conseil général partagé par tous les clients et un par métier — quelques
dollars par mois au plus ; le rattrapage du premier client (~0,20 $) une fois.

Garde-fous inchangés : Agent API (`POST https://api.perplexity.ai/v1/agent`,
`effort: "low"`, `web_search` « fast » limité à 20 sites officiels) ; chaque
source contrôlée ; liens et renvois retirés ; 10 questions au plus par
passage ; un 429 attend `Retry-After` ; coût noté au journal.

Premier vrai passage (31 octobre, ancienne version, 10 textes) : 4 gardés,
6 jetés faute de source officielle « qui répond ». Depuis, une page d'un site
officiel qui refuse les robots (401, 403, 429 — Légifrance le fait) compte
comme existante, et le journal dit pourquoi chaque réponse est jetée. **À
regarder au premier passage avec un client** : la part de réponses jetées.

La clé : secret GitHub `PERPLEXITY_API_KEY` (crédit payé sur
console.perplexity.ai — le crédit offert ne suffit pas pour l'Agent API). Si
elle fuit un jour : la refaire sur console.perplexity.ai. Essai : action
« Perplexity », étape `essai`.

À surveiller : la qualité des conseils — Clément devrait en lire quelques-uns.

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
