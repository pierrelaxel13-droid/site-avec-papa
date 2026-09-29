# Vigie

Outil de veille réglementaire pour les entreprises françaises. On part du code NAF,
on obtient les domaines à surveiller, on fixe un rythme et des responsables, on
suit les textes relevés jusqu'à leur mise en conformité, et on sort une note à
diffuser.

Un seul fichier, `index.html`, sans serveur, sans compte et sans dépendance. Les
données restent dans le navigateur de la personne qui l'utilise.

## Ce que fait l'outil

| Écran | Rôle |
|---|---|
| **Vue d'ensemble** | Radar de veille (angle = famille, distance au centre = fréquence de revue), charge mensuelle estimée, revues en retard, liste « à traiter », avancement par famille, cycle en six étapes. |
| **Profil & NAF** | Recherche par code (`43.99C`), par métier (« boulangerie », « plombier ») ou par section. 22 caractéristiques d'activité ajoutent des domaines. |
| **Plan de veille** | Fréquence, responsable, dernière revue et prochaine échéance de chaque domaine. Export CSV, copie vers Excel. |
| **Calendrier** | Charge de veille sur huit semaines, jour par jour, avec les échéances du registre. |
| **Registre** | Textes relevés en colonnes par statut (glisser-déposer) ou en tableau. Niveau et nature des impacts, action, responsable, échéance. Import et export CSV. |
| **Sources** | Sources officielles de votre périmètre, six types de sources, outils de collecte. |
| **Synthèse** | Note imprimable ou enregistrable en PDF, copiable en texte. |

Chaque domaine ouvre une fiche : textes de référence, obligations à cocher
(l'auto-évaluation alimente la vue d'ensemble), sources officielles, textes du
registre liés.

Au premier lancement l'outil s'ouvre sur une entreprise d'exemple fictive
(maçonnerie, NAF 43.99C), datée d'aujourd'hui. « Partir de mon entreprise » vide
l'espace.

## Fichiers

| Chemin | Rôle |
|---|---|
| `index.html` | Le site, assemblé. Commité tel quel : il s'ouvre par double-clic. |
| `src/index.template.html` | Coque HTML et polices. |
| `src/styles.css` | Styles, thèmes clair et sombre, impression. |
| `src/referentiel.js` | Données : nomenclature NAF (21 sections, 88 divisions, 68 listes de métiers), 45 domaines de veille, 22 caractéristiques d'activité, fréquences, sources générales. |
| `src/js/core.js` | Dates, état, jeu d'exemple, calcul du périmètre, des échéances et de la charge. |
| `src/js/radar.js` | Dessin du radar. |
| `src/js/views.js` | Les écrans. |
| `src/js/actions.js` | Événements, fenêtres, import et export, démarrage. |
| `build.mjs` | Assemble les sources dans `index.html` et vérifie la syntaxe. |
| `netlify.toml` | Publication et en-têtes de sécurité. |

Après toute modification dans `src/` :

```sh
node build.mjs
```

Ouvrir `index.html` suffit pour essayer. `node build.mjs --site` écrit en plus
`_site/index.html`, ce que publie Netlify.

## Mise en ligne

Netlify : *Add new site → Import an existing project → GitHub*, branche `main`.
Commande et dossier sont déjà dans `netlify.toml` (`node build.mjs --site`, `_site`).
Cloudflare Pages et GitHub Pages fonctionnent avec `index.html`.

La politique de sécurité (`Content-Security-Policy`) n'autorise aucune requête
réseau hors polices Google Fonts.

## Données

Tout est stocké dans `localStorage`, sous la clé `vigie-v1` (le thème sous
`vigie-theme`). Rien n'est envoyé nulle part. Conséquences : les données sont
propres à un navigateur et à un appareil, et effacer les données du site les
supprime. L'export CSV du plan et du registre sert de sauvegarde et de moyen de
partage.

## Faire évoluer le référentiel

Tout est dans `src/referentiel.js` :

- **ajouter un domaine** : une entrée dans `domaines` (nom, `famille`, `frequence`,
  `resume`, `textes`, `obligations`, `impacts`, `sources`), puis la citer dans
  `parDivision` et/ou dans `declencheurs` ;
- **rattacher un secteur** : `parDivision["43"]` liste les domaines de la division 43 ;
- **faire trouver un métier** : ajouter le mot dans `alias` pour sa division ;
- **socle commun** : `transversaux`.

La fréquence proposée pour un domaine est une valeur de départ, modifiable dans le plan.

## Hypothèses à connaître

- La **charge mensuelle** repose sur des durées de session indicatives
  (`MINUTES` et `PAR_MOIS` dans `core.js`) : 10 min par jour ouvré, 15 min par
  semaine, 45 min par mois, 1 h par trimestre.
- Le **calendrier** suppose que chaque revue est faite à sa date.
- Le rattachement se fait au niveau de la **division NAF** (deux chiffres), pas
  de la sous-classe.

## Limites

L'outil fournit un cadre méthodologique, pas un conseil juridique, et ne garantit
pas l'exhaustivité du périmètre applicable à une entreprise donnée. Chaque texte
doit être vérifié sur [Légifrance](https://www.legifrance.gouv.fr) et l'analyse
d'applicabilité validée par une personne compétente. Ces réserves figurent dans
l'interface et dans la note imprimée.

## Historique

La première version du site (pages de présentation, collecte horaire du Journal
officiel via l'API Légifrance) reste consultable dans l'historique git, au commit
`45543a0`.
