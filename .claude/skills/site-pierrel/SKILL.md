---
name: site-pierrel
description: "Modifier et publier le site statique Pierrel & Co de ce dépôt (index.html, plan-de-veille.html, assets/site.css, assets/motion.js, assets/toile.js, assets/constellation.js, assets/plan.js, build.mjs, netlify.toml). À utiliser pour toute demande de changement de contenu, de mise en page, de style, d'animation, de navigation, de texte, d'accessibilité ou d'impression, et pour prévisualiser ou publier le site. Déclencheurs typiques : « change le texte de l'accueil », « ajoute une section », « l'animation rame », « corrige le menu », « le rendu est cassé sur téléphone », « comment je vois le site », « ajoute une page », « le site ne se met pas à jour »."
---

# Le site Pierrel & Co

## Avant de toucher un fichier

Deux pages écrites à la main, une feuille de style, trois scripts, aucune
dépendance. `build.mjs` ne compile rien : il copie les fichiers publiables dans
`_site/` et vérifie le référentiel. **Ne pas introduire de framework, de
bundler, de bibliothèque d'animation ni de `npm install`** — il n'y a pas de
`package.json` et il n'en faut pas.

| Fichier | Rôle |
|---|---|
| `index.html` | Accueil. Méthode et tableau des sources **générés** depuis le référentiel par le script en fin de page ; chiffres du récit calculés de même. |
| `plan-de-veille.html` | L'outil. Structure seulement : tout le contenu est rendu par `assets/plan.js`. |
| `assets/site.css` | Toute la mise en forme, mouvement et impression compris. |
| `assets/toile.js` | L'animation d'ouverture sur `<canvas>`. |
| `assets/motion.js` | Le mouvement piloté par script, sur les deux pages. |
| `assets/constellation.js` | La constellation du plan : anneaux, liens, soulignement. |
| `assets/plan.js` | Logique de l'outil : constellation, calendrier, détail. |
| `assets/referentiel.js` | Le contenu métier → voir le skill `veille-reglementaire`. |

## Prévisualiser, et vérifier pour de vrai

```sh
node build.mjs
python3 -m http.server -d _site 8080
```

`_site/` est effacé à chaque construction : ne jamais y modifier un fichier.

**Lire le CSS ne suffit pas sur ce site.** Le héros, le récit au défilement et
le diagramme ne se jugent qu'en mouvement. Chromium est installé —
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome` — à piloter avec
Playwright. Ce qu'il faut contrôler après toute modification visuelle :

- le débordement horizontal à 320, 390, 768, 1024 et 1440 px
  (`scrollWidth - clientWidth <= 0`) ;
- que la toile peigne réellement (compter les pixels non transparents de
  `getImageData`, pas se fier à la présence de la balise) ;
- le parcours complet refait avec `reducedMotion: "reduce"`, pour vérifier
  qu'aucun contenu ne reste caché ;
- le rendu imprimé (`emulateMedia({ media: "print" })`).

## Direction artistique

Sombre, typographie massive, mouvement assumé. Deux registres seulement :
`.nuit` (défaut) et `.jour`, posé sur une section pour casser le rythme.

- **Couleurs** : uniquement par les tokens de `:root` — `--nuit`, `--nuit-2`,
  `--nuit-3`, `--craie`, `--craie-douce`, `--craie-faible`, `--papier`,
  `--vert`, `--vert-vif`, `--vert-sombre`, `--vert-voile`, `--terre`,
  `--alerte`, `--trait`, `--trait-fort`, `--trait-jour`. Jamais de couleur en
  dur dans une page.
- **Typographie** : `Newsreader` (serif, graisse 300) pour les titres,
  `Inter` pour le reste. Les deux sont **variables** : un fichier par famille
  couvre toutes les graisses, ne pas les dupliquer.
- **Courbes** : `--sortie` pour une entrée, `--doux` pour un changement d'état.
  Jamais de rebond.
- **Composants** : `.enveloppe`, `.section`, `.jour`, `.tete-section`,
  `.surtitre`, `.carte`, `.grille-2/3`, `.bouton` (`.bouton-fantome`,
  `.bouton-petit`), `.etape`, `.livrable`, `.tableau`, `.etiquette`,
  `.reserve`, `.geant`.

## Pièges de ce dépôt

- **Aucune requête externe, et ça doit le rester.** Les polices sont dans le
  dépôt parce que le pied de page promet qu'aucune donnée ne part chez un
  tiers ; un `<link>` vers `fonts.googleapis.com` transmettrait l'IP de chaque
  visiteur à Google et rendrait cette phrase fausse. Même raison pour les
  scripts d'analyse et les bibliothèques servies par CDN.
- **La barre de navigation est `position:fixed`.** D'où `scroll-padding-top`
  sur `html` et `scroll-margin-top` sur les sections de l'outil : sans eux,
  toute ancre place son titre sous la barre.
- **Un élément de grille ne descend pas sous la largeur de son contenu.**
  `min-width:0` sur `.colonne-rythme` et `overflow-wrap:anywhere` sur `.jeton`
  sont là pour ça — c'est ce qui faisait déborder l'outil à 320 px.
- **Le héros est une grille, pas un flex.** Un enfant flex se rétracte sur son
  contenu et `.enveloppe` y perdrait sa largeur pleine, décalant tout le texte
  au milieu de l'écran.
- **La constellation n'est jamais réécrite d'un bloc.** Ses nœuds survivent
  d'un rendu à l'autre : c'est ce qui permet de les faire glisser vers leur
  nouvelle place. Un `innerHTML` à chaque rendu casserait l'animation la plus
  parlante du site.
- **Chaque anneau est tourné d'un cran** (`phase`) par rapport au précédent, et
  les libellés sont coupés à trente signes : sans ces deux réglages, deux
  domaines de rythmes différents tombent au même angle et leurs libellés se
  chevauchent. Le nom complet reste dans la liste détaillée.
- **Attention aux noms de classes déjà pris.** La légende de la constellation
  a d'abord utilisé `.metier`, déjà employé par les boutons de métier : ses
  entrées héritaient du style d'une carte. D'où `.de-metier` et `.de-contexte`.
- **La séquence d'ouverture ne doit jamais pouvoir rester en place.** Elle se
  saute au clic et à la touche, et un délai de sécurité la retire au bout de
  quatre secondes quoi qu'il arrive. Elle ne joue qu'une fois par session et
  jamais en `prefers-reduced-motion`.
- **L'en-tête et le pied de page sont dupliqués dans les deux pages** : aucun
  gabarit. Toucher au menu suppose d'éditer les deux fichiers.
- **Les réponses de l'outil vivent dans `localStorage`** sous `pco-plan-v1`,
  toujours sous `try/catch` : en navigation privée, l'accès lève.
- **`[hidden]` est forcé en `display:none !important`** : c'est ce qui masque
  la barre d'actions, le diagramme et le calendrier tant qu'aucun métier n'est
  choisi.
- **`.sans-impression`** masque à l'impression, `.entete-impression` n'apparaît
  qu'à l'impression. La feuille imprimée est un livrable qui finit dans un
  dossier d'audit : la revérifier après toute modification de l'outil.
- **Ajouter une page** suppose trois gestes : le fichier, son entrée dans
  `A_PUBLIER` de `build.mjs`, le lien dans le menu **des deux** autres pages.

## Les trois règles du mouvement

Elles ne se négocient pas, et toute animation ajoutée doit les tenir :

1. **Sans les scripts, le site est complet.** Les décalages de départ (`.arme`,
   `.arme-mot`) sont posés par `motion.js`, jamais dans le HTML.
2. **`prefers-reduced-motion` coupe tout** sans retirer un mot : le récit
   affiche ses trois étapes à la suite, la toile peint une image fixe.
3. **Seuls `transform`, `opacity` et la hauteur d'un bloc déplié sont animés.**

La toile s'arrête quand l'onglet passe en arrière-plan ou quand le héros sort
de l'écran ; ne pas retirer ces garde-fous, c'est ce qui évite de faire tourner
un ventilateur pour un décor qu'on ne voit pas.

`<details>` ne s'anime pas seul : le contenu sort du rendu dès que `open`
tombe. D'où le bloc `.repli`, dont on anime la hauteur réelle avant de fermer.

## Publier

Netlify est relié à `main` et reconstruit à chaque envoi.

```sh
node build.mjs     # doit passer avant d'envoyer
git add -A && git commit -m "…" && git push
```

## Ce qui est volontairement absent

À signaler, pas à « corriger » en passant : pas de formulaire de contact
(courriel et téléphone), pas de collecte automatique, pas de curseur natif
masqué (le halo accompagne le curseur, il ne le remplace pas). Le courriel, le
téléphone, le SIRET et l'hébergeur sont des valeurs d'exemple, listées dans
`DEPLOIEMENT.md`.

## Réserves à ne pas retirer

Les mentions rappelant que le site et son outil fournissent un cadre
méthodologique et non un conseil juridique, sur les deux pages et sur la
feuille imprimée, font partie de la prestation. Ne pas les supprimer ni les
adoucir.
