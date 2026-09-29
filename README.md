# Pierrel & Co — site et outil de veille réglementaire

Site statique (HTML/CSS/JS, sans build ni dépendance) pour Pierrel & Co, conseil
en organisation et conformité, avec un outil de veille réglementaire
multi-secteurs et une collecte automatique des textes du Journal officiel.

Mise en ligne et activation de la collecte : voir [DEPLOIEMENT.md](DEPLOIEMENT.md).

## Pages

| Fichier | Rôle |
|---|---|
| `index.html` | Page d'accueil : prestations, méthode, profil, contact. |
| `veille-reglementaire.html` | Présentation de la prestation de veille : enjeux, code NAF, familles de veille, sources, méthode en 6 étapes, fréquences, outils. |
| `outil-veille.html` | Outil de travail en 6 étapes : profil et code NAF, périmètre, plan de veille, fil du Journal officiel, registre de suivi, synthèse imprimable. |

## Ressources

| Fichier | Rôle |
|---|---|
| `assets/site.css` | Design system partagé : tokens de couleur, typographie, boutons, sections, tableaux, badges, formulaires, styles d'impression. |
| `assets/veille-outil.css` | Composants propres à l'outil : onglets d'étapes, recherche NAF, tuiles de chiffres, listes de domaines, synthèse. |
| `assets/veille-data.js` | Référentiel : nomenclature NAF (21 sections, 88 divisions), 44 domaines de veille avec textes et sources officielles, matrice division → domaines, 22 déclencheurs, étapes et fréquences. |
| `assets/veille-outil.js` | Logique de l'outil : recherche NAF, calcul du périmètre, plan de veille, lecture du fil, registre CRUD, import/export CSV, synthèse, persistance locale. |
| `scripts/collecte-jo.mjs` | Collecte des textes du Journal officiel via l'API Légifrance, rattachement aux domaines par mots-clés, écriture de `data/veille-feed.json`. Sans dépendance. |
| `scripts/fixtures/jorf-exemple.json` | Jeu d'essai permettant de rejouer toute la chaîne sans réseau ni identifiants (`--source=mock`). |
| `data/veille-feed.json` | Le fil publié, lu par l'outil. Produit par la tâche planifiée, commité seulement quand son contenu change. |
| `.github/workflows/veille.yml` | Collecte horaire du Journal officiel. |
| `.claude/skills/` | Deux skills de projet pour Claude Code : `veille-reglementaire` (collecte du Journal officiel, référentiel) et `site-pierrel` (pages, design system, publication). Chargés automatiquement dans une session ouverte sur ce dépôt. |
| `build.mjs` | Assemble dans `_site/` les seuls fichiers servis aux visiteurs. |
| `netlify.toml` | Configuration de publication : commande, dossier, en-têtes de cache. |

`veille-reglementaire.html` et `outil-veille.html` lisent le même référentiel
`veille-data.js` : le tableau des sources et la liste des étapes de la page de
présentation sont générés depuis cette source unique.

## Fonctionnement de l'outil

1. **Profil & code NAF** — recherche par code (`43`, `43.99C`), par mots-clés du
   libellé ou par section. Le code est rattaché à sa division (deux premiers
   chiffres), niveau auquel se joue le rattachement réglementaire.
2. **Périmètre** — 22 caractéristiques d'activité (salariés, ERP, ICPE, produits
   chimiques, véhicules, denrées alimentaires, marchés publics…) complètent la
   base sectorielle. Périmètre = socle commun + domaines sectoriels + déclenchés.
3. **Plan & fréquences** — fréquence et responsable par domaine, date de dernière
   revue, prochaine échéance calculée, alerte si dépassée. Export CSV.
4. **Veille en direct** — le fil des textes parus au Journal officiel, filtré sur
   le périmètre, les prioritaires signalés. Un clic bascule un texte au registre
   avec le formulaire prérempli. Les textes traités ou masqués sortent du
   compteur.
5. **Registre** — saisie des textes relevés avec domaine, dates, niveau et nature
   d'impact, action, responsable, échéance, statut. Filtres, tri par échéance,
   compteurs, export et import CSV (séparateur `;`, BOM UTF-8, compatible Excel).
6. **Synthèse** — rapport imprimable (profil, rythme, actions en retard, points à
   diffuser, sources) pour la réunion ou le dossier d'audit.

## Collecte automatique

`scripts/collecte-jo.mjs`, lancé toutes les heures par GitHub Actions :

1. s'authentifie sur PISTE (OAuth client credentials) ;
2. récupère les textes publiés au Journal officiel sur les derniers jours, en
   essayant `consult/lastNJo` puis, à défaut, `search` sur le fonds JORF ;
3. compare chaque titre normalisé (minuscules, accents retirés) aux 334
   mots-clés répartis sur les 44 domaines, et écarte ce qui ne matche rien ;
4. fusionne avec le fil existant sans perdre la date de première détection,
   garde 120 jours et 400 textes au maximum ;
5. n'écrit le fichier que si le contenu utile a changé — sinon la tâche
   produirait un commit par heure ;
6. poste un résumé sur un webhook si `ALERTE_WEBHOOK_URL` est configuré.

Une collecte en échec ne casse jamais la publication : le fil précédent est
conservé et le message d'erreur, porté par le JSON, est affiché dans l'outil.

Pour rejouer la chaîne sans réseau ni identifiants :

```sh
node scripts/collecte-jo.mjs --source=mock --dry-run
```

## Données

Tout est stocké côté navigateur dans `localStorage`, sous la clé `pco-veille-v1`.
Aucune donnée n'est envoyée à un serveur ; il n'y a ni compte ni backend. Le
bouton « Tout réinitialiser » efface l'espace de travail, et l'export CSV sert de
sauvegarde.

## Mettre à jour le référentiel

Les données réglementaires évoluent. Dans `assets/veille-data.js` :

- **ajouter un domaine** : une entrée dans `domaines` (nom, `famille`, `frequence`,
  `resume`, `textes`, `obligations`, `impacts`, `sources`), puis le référencer
  dans `parDivision` et/ou dans `declencheurs` ;
- **modifier un rattachement sectoriel** : `parDivision["43"]` liste les domaines
  de la division 43 ;
- **faire évoluer la nomenclature** : `sections` et `divisions` suivent la NAF au
  niveau division ; les libellés officiels sont publiés par l'INSEE ;
- **élargir la collecte d'un domaine** : ajouter une entrée dans `motsCles`. Les
  mots-clés sont comparés au titre du texte, accents et casse ignorés ; préférer
  des expressions précises (« appareils de levage ») aux mots isolés (« levage »),
  qui ramènent du bruit.

Le fichier est autonome (aucune dépendance) et se recharge dans les deux pages.

## Développement local

```sh
node build.mjs            # assemble _site/
npx http-server _site -p 8080
```

Le fil de la veille en direct se lit par `fetch` : il faut servir le dossier en
HTTP. Ouvrir les fichiers en `file://` affiche un message explicite à la place
du fil, le reste de l'outil fonctionne normalement.

## Limites

L'outil fournit un cadre méthodologique, pas un conseil juridique, et ne garantit
pas l'exhaustivité du périmètre applicable à une entreprise donnée. Chaque texte
doit être vérifié sur Légifrance et l'analyse d'applicabilité validée par une
personne compétente. Ces réserves sont affichées dans l'interface et dans la
synthèse imprimée.
