# Lot 5 — La base de données de Vigie (proposition, à valider avant tout code)

Version du 29 octobre 2026. Rien n'est construit : ce document décrit ce qui le
sera, pour que la décision soit prise avant d'écrire une ligne.

## En une phrase

Tout ce qui est **commun** (les 44 sujets, les textes collectés, le journal du
robot) est écrit une fois et lu par tous ; tout ce qui appartient à **une
entreprise** (son plan, ses réponses, son registre) est rangé sous son
identifiant, et la base elle-même refuse de le montrer à qui n'en est pas membre.

## 1. L'architecture

```
Navigateur (site statique, GitHub Pages)
   │  HTTPS, clé « anon » publique + jeton de l'utilisateur connecté
   ▼
Supabase (Europe)  ── Auth : comptes, mots de passe, courriels (via Brevo)
   │                 ── Base PostgreSQL : RLS sur CHAQUE table
   │                 ── Stockage : logos des consultants
   ▲
GitHub Actions (clé « service », dans les secrets du dépôt, jamais dans le site)
   ├─ collecte quotidienne des textes (lot 6)
   ├─ migrations : le schéma, versionné dans supabase/migrations/
   ├─ tests d'isolation, à chaque modification du schéma
   └─ export chiffré hebdomadaire de la base
```

- **Le site reste statique.** Les pages publiques et le contenu commun (textes,
  fiches) restent des pages construites par `build.mjs`. Les données d'un client
  sont chargées par la page, après connexion, depuis Supabase.
- **Pas de bibliothèque Supabase dans le site** : quelques appels `fetch` vers
  l'API REST de Supabase, dans un seul fichier (`assets/donnees.js`). La règle
  « aucun script extérieur » reste vraie ; seule l'adresse du projet Supabase
  s'ajoute à la politique de sécurité (`connect-src`).
- **La démonstration ne change pas** : elle reste dans le navigateur, avec son
  jeu d'essai, sous `/demo/`.
- **Cloudflare devient inutile** : c'est la base qui protège les données, plus
  un serveur devant les pages. `functions/`, `serveur/` et `cloudflare.yml`
  seront retirés quand Supabase marchera.

## 2. Le commun (écrit par le robot, lu par tous)

| Table | Contenu | Qui écrit |
|---|---|---|
| `sujets` | les 44 sujets : nom, famille, fréquence de revue, actions types | l'action, depuis `assets/referentiel.js` |
| `textes` | un texte collecté : source, titre, date de publication, numéro (NOR, n° du JO), lien officiel | le robot (lot 6) |
| `textes_sujets` | quel texte touche quel sujet | le robot |
| `collectes` | le journal du robot : début, fin, durée, textes examinés et retenus, erreurs | le robot (lot 6) |

Lecture : tout utilisateur connecté (ces textes sont publics de toute façon).
Écriture : **aucune règle ne l'autorise**, donc personne ne peut écrire depuis un
navigateur. Seule la clé « service » du robot le peut.

C'est ce qui rend le coût d'un client de plus quasi nul : un texte collecté sert
à toutes les entreprises concernées, sans être recopié.

## 3. Ce qui appartient à un client

### Les comptes et les organisations

| Table | Contenu |
|---|---|
| `auth.users` | géré par Supabase : adresse, mot de passe (empreinte), confirmation |
| `profils` | le nom affiché d'un utilisateur |
| `consultants` | un cabinet consultant : nom, **thème** (logo, couleur, nom affiché aux clients), marque blanche oui/non |
| `entreprises` | une entreprise cliente : dénomination, code NAF, effectif, implantation, `consultant_id` (facultatif), `acces_consultant` (oui/non, décidé par l'entreprise) |
| `membres_entreprise` | qui appartient à quelle entreprise, avec un rôle : **admin**, **membre**, **lecteur** |
| `membres_consultant` | qui appartient à quel cabinet consultant |
| `invitations` | une invitation par courriel à rejoindre une entreprise ou un cabinet, avec expiration |

Les trois niveaux demandés sont là dès le départ :
**consultant → plusieurs entreprises → plusieurs utilisateurs**. Une entreprise
sans consultant (client direct) a simplement `consultant_id` vide.

### Le plan de veille

| Table | Contenu |
|---|---|
| `reponses` | les réponses de l'entreprise aux 22 questions de situation, datées |
| `plan_sujets` | les sujets suivis : origine (métier, réponse, ajout manuel), fréquence, depuis quand |

### Le registre de preuves — immuable

`registre` : **une ligne par fait**, jamais modifiée, jamais effacée.

| Colonne | Rôle |
|---|---|
| `id` | numéro d'ordre, croissant |
| `entreprise_id` | à qui appartient l'entrée |
| `genre` | `revue`, `qualification` (applicable / sans objet / à suivre), `decision`, `action`, `plan` (sujet ajouté ou retiré), `correction` |
| `sujet_id`, `texte_id` | ce dont il s'agit (facultatifs) |
| `objet`, `detail` | ce qui a été fait ou décidé, en clair |
| `date_effet` | la date du fait, déclarée par l'utilisateur (« revue faite le 12 ») |
| `enregistre_le` | l'heure d'enregistrement, **posée par la base**, jamais par le navigateur |
| `auteur_id`, `auteur_nom` | qui l'a écrit — posé par la base d'après la connexion, nom figé au moment de l'écriture |
| `corrige_id` | pour une correction : l'entrée qu'elle annule ou rectifie |
| `empreinte` | empreinte SHA-256 de l'entrée **et de l'empreinte de la précédente** |

Comment l'immuabilité est garantie, en trois couches :

1. **Aucune règle de modification ni de suppression** : depuis le navigateur,
   on ne peut qu'ajouter.
2. **Un déclencheur dans la base** refuse toute modification ou suppression,
   **même avec la clé service** — y compris par nous. Une erreur de notre part
   ne peut pas réécrire l'histoire d'un client.
   Limite honnête : le **propriétaire de la base** (avec le mot de passe de la
   base) pourrait, en le faisant exprès, désactiver ce déclencheur. C'est la
   couche 3 qui le rendrait visible.
3. **La chaîne d'empreintes** : chaque entrée contient l'empreinte de la
   précédente. Si une ligne était altérée par un moyen détourné, la chaîne se
   casserait, et une vérification le montrerait. On peut imprimer l'empreinte de
   la dernière entrée sur l'export remis à l'auditeur.

Une **correction** est une nouvelle entrée datée, qui pointe vers l'entrée
corrigée. L'affichage montre l'original barré, la correction, et les deux dates.

**L'état courant se déduit du registre**, il n'est pas stocké à part : la
qualification d'un texte, c'est sa dernière entrée `qualification` ; une revue
en retard, c'est un sujet dont la dernière `revue` est plus vieille que son
rythme. Ce sont des **vues** calculées. Avantage : l'écran ne peut jamais
contredire le registre.

Seule exception à l'immuabilité : la **suppression d'une entreprise entière**
à la fin de la durée de conservation (RGPD), par une fonction réservée à la
clé service, qui efface tout d'un bloc et le journalise. Jamais une entrée
isolée.

### Abonnements et facturation

| Table | Contenu | Qui écrit |
|---|---|---|
| `abonnements` | formule, période (mois/an), statut, fin de période, identifiants Stripe — pour une entreprise ou un cabinet | uniquement Stripe (via le serveur, au dernier lot) |
| vue `clients_actifs_consultant` | le nombre d'entreprises actives par cabinet, pour la facturation au nombre de clients | calculée |

## 4. L'isolation : qui voit quoi

La RLS (« Row Level Security ») est **activée sur chaque table dès sa
création**. Une table sans règle ne montre rien à personne. Les règles :

| Table | Lire | Ajouter | Modifier | Supprimer |
|---|---|---|---|---|
| commun (`sujets`, `textes`…) | tout connecté | personne | personne | personne |
| `entreprises` | ses membres ; son consultant **si** `acces_consultant` | par une fonction contrôlée | admin de l'entreprise | personne |
| `membres_entreprise` | membres de l'entreprise | admin, par invitation | admin | admin (pas soi-même s'il est le dernier) |
| `reponses`, `plan_sujets` | membres ; consultant autorisé | admin, membre ; consultant autorisé | admin, membre ; consultant autorisé | personne (on retire un sujet par une entrée `plan`) |
| `registre` | membres ; consultant autorisé | admin, membre ; consultant autorisé | **personne, jamais** | **personne, jamais** |
| `consultants` | ses membres ; les entreprises qu'il suit (pour le thème) | par une fonction contrôlée | admin du cabinet | personne |
| `abonnements` | membres concernés | personne (Stripe seul) | personne | personne |

Points clés :

- **Une entreprise choisit si son consultant la voit** (`acces_consultant`).
  Sans son accord, le consultant ne voit rien. Exception logique : quand
  c'est le consultant qui crée l'entreprise pour son client, l'accès est
  ouvert d'emblée ; l'entreprise peut le couper à tout moment.
- **Le consultant autorisé peut aussi écrire** (revues, qualifications,
  actions) chez ses clients : c'est son travail. Chaque entrée porte son nom.
- **Un lecteur ne peut rien écrire**, ni la formule « Textes » (le registre
  et le plan commencent à la formule « Suivi »).
- **Un consultant ne voit jamais les entreprises d'un autre consultant.**
- **L'administrateur (toi) ne lit pas les registres** depuis l'application :
  il voit la liste des entreprises et leurs abonnements, rien de plus. Le
  support se fait à la demande du client. Les données de conformité restent
  confidentielles, même pour nous.
- **Ces règles sont testées automatiquement** à chaque changement du schéma :
  deux entreprises d'essai, deux consultants, et un script qui vérifie qu'aucun
  ne voit ni n'écrit chez l'autre, et que modifier ou supprimer une entrée du
  registre échoue toujours. Si un test échoue, la modification n'est pas
  appliquée.

## 5. Les clés et les secrets

- **Clé « anon »** : publique par nature, elle va dans le site. Seule, elle ne
  donne accès à rien : la RLS décide.
- **Clé « service »** : elle passe outre la RLS. **Uniquement dans les secrets
  GitHub**, utilisée par les actions (robot, migrations, export). Jamais dans
  le site, jamais dans le dépôt. La construction refusera toute page qui la
  contient.
- **Mot de passe de la base** : secrets GitHub uniquement.

## 6. Sauvegardes

1. **Les sauvegardes de Supabase** (selon l'offre, voir plus bas).
2. **Un export hebdomadaire à nous**, par une action GitHub : copie complète de
   la base, **chiffrée avant de quitter la machine**, avec une clé publique dont
   la clé privée est gardée hors ligne par vous deux. Important : le dépôt est
   **public**, un export en clair y serait lisible. Chiffré, il ne l'est pas.
3. **L'export du registre par le client lui-même** (PDF et tableur), à tout
   moment : c'est son document d'audit, il doit pouvoir l'avoir sans nous.

## 7. Coûts et limites de Supabase — à vérifier au moment de s'inscrire

- **L'offre gratuite** suffit pour construire et tester. Mais un projet gratuit
  sans activité pendant une semaine est mis en pause, et ses sauvegardes sont
  limitées.
- **Avant le premier client payant**, passer à l'offre payante (de l'ordre de
  25 $ par mois à ce jour) : pas de mise en pause, sauvegardes quotidiennes.
- Choisir la **région Europe** (Paris si proposée, sinon Francfort) : c'est ce
  qu'annonce la politique de confidentialité.
- Les courriels de Supabase (confirmation, mot de passe oublié) passeront par
  **Brevo** : l'envoi par défaut de Supabase est limité et réservé aux essais.

## 8. L'ordre de construction

1. Créer le projet Supabase (vous) et les secrets GitHub.
2. Le schéma en migrations SQL versionnées, la RLS, les tests d'isolation.
3. La connexion réelle dans le site (création de compte, mot de passe oublié).
4. Brancher les écrans : réglages et plan d'abord, puis le registre.
5. L'export du registre (PDF, tableur) et l'export chiffré hebdomadaire.
6. La vue consultant et son thème.
7. Ensuite seulement : la collecte (lot 6), puis Stripe.

## 9. À décider par vous

1. **Conservation après résiliation** : 12 mois (proposé dans la politique de
   confidentialité) ?
2. **Rôles dans une entreprise** : admin / membre / lecteur, ça vous va ?
3. **Accord de l'entreprise pour que son consultant la voie** : je le
   recommande (c'est ce qui rassure le client final).
4. **L'administrateur ne lit pas les registres** : je le recommande.
5. **Offre Supabase** : gratuite pour construire, payante avant le premier client ?
