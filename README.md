# Pierrel & Co — site et outil de plan de veille

Site statique (HTML, CSS, JS, sans build de framework ni dépendance) pour
Pierrel & Co, conseil en organisation et conformité, avec un outil gratuit qui
produit un plan de veille réglementaire à partir de l'activité et du contexte
de l'entreprise.

Mise en ligne : voir [DEPLOIEMENT.md](DEPLOIEMENT.md).

## Pages

| Fichier | Rôle |
|---|---|
| `index.html` | Accueil : constat, prestation, méthode en 4 étapes, sources, profil, contact. |
| `plan-de-veille.html` | L'outil : activité, contexte, plan imprimable. |

## Ressources

| Fichier | Rôle |
|---|---|
| `assets/site.css` | Toute la mise en forme des deux pages : tokens, composants, impression, écrans étroits. |
| `assets/polices.css` | Déclarations `@font-face` des deux polices servies par le site. |
| `assets/polices/` | Inter et Newsreader, variables, sous-jeu latin. Un fichier par famille. |
| `assets/referentiel.js` | Le contenu métier : 26 domaines de veille, 15 familles d'activité, 11 questions de contexte, la méthode et les sources. |
| `assets/plan.js` | La logique de l'outil : rendu des choix, calcul du plan, mémoire locale, impression. |
| `assets/favicon.svg` | Icône d'onglet. |
| `build.mjs` | Assemble `_site/` et refuse de construire si le référentiel est incohérent. |
| `netlify.toml` | Configuration de publication : commande, dossier, en-têtes de cache. |
| `.claude/skills/` | Deux skills de projet pour Claude Code : `veille-reglementaire` (le référentiel) et `site-pierrel` (les pages et la publication). |

## Fonctionnement de l'outil

1. **Activité** — quinze familles de métiers, avec les divisions NAF données à
   titre de repère. Chaque famille amène ses domaines sectoriels.
2. **Contexte** — onze questions fermées (salariés, accueil du public, produits
   chimiques, véhicules, denrées, marchés publics…). Chaque réponse ajoute ses
   domaines.
3. **Plan** — les domaines retenus, groupés par fréquence de revue, chacun
   dépliable sur ses obligations concrètes, ses textes de référence et ses
   sources officielles. Chaque domaine affiche **pourquoi** il est là : le socle
   commun, le métier, ou la réponse qui l'a déclenché.

Le plan s'imprime (ou s'enregistre en PDF) avec un en-tête daté, pour être
classé dans un dossier ou discuté en réunion.

## Données

Rien n'est envoyé nulle part. L'outil n'a ni compte, ni backend, ni mesure
d'audience, ni cookie, et le site ne fait **aucune requête externe** : les
polices sont servies depuis le dépôt. Les réponses sont conservées dans le
navigateur sous la clé `pco-plan-v1`, uniquement pour qu'un rechargement ne
fasse pas tout recommencer. Le bouton « Tout effacer » les supprime.

## Mettre à jour le référentiel

Tout est dans `assets/referentiel.js`, qui est autonome et lu par les deux
pages.

- **Ajouter un domaine** : une entrée dans `domaines` (`nom`, `frequence`,
  `resume`, `textes`, `obligations`, `sources`), puis le rattacher — sinon il
  n'apparaîtra dans aucun plan. On le rattache soit à des métiers
  (`metiers[].domaines`), soit à des questions (`questions[].domaines`), soit au
  socle commun (`socle`, qui s'applique à toute entreprise).
- **Ajouter un métier** : une entrée dans `metiers`, avec ses divisions NAF en
  repère et la liste de ses domaines sectoriels.
- **Ajouter une question** : une entrée dans `questions`. Une bonne question se
  répond par oui ou non sans documentation, et amène au moins un domaine que le
  métier seul ne donne pas.
- **Changer un rythme** : le champ `frequence` d'un domaine, qui doit
  correspondre à un identifiant de `frequences`.

`node build.mjs` vérifie ces invariants et **interrompt la construction** si un
domaine cité n'existe pas, si une fréquence est inconnue, ou si le référentiel
descend sous vingt domaines. Un domaine que rien n'amène produit un
avertissement, pas une erreur.

## Développement local

```sh
node build.mjs                      # assemble _site/
python3 -m http.server -d _site 8080
```

Servir en HTTP n'est pas indispensable — l'outil fonctionne aussi en ouvrant le
fichier depuis le disque, puisqu'il ne charge rien par le réseau — mais c'est
plus proche de la réalité.

## Limites

L'outil fournit un cadre méthodologique, pas un conseil juridique, et ne
garantit pas l'exhaustivité du périmètre applicable à une entreprise donnée.
Chaque texte doit être vérifié sur Légifrance et l'analyse d'applicabilité
validée par une personne compétente. Ces réserves sont affichées sur les deux
pages et reprises sur la feuille imprimée.
