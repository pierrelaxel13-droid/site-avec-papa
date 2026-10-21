---
name: site-pierrel
description: "Modifier et publier le site Pierrel & Co de ce dépôt (build.mjs, assets/site.css, assets/app.js, assets/theme.js, assets/session.js, contenu/, outils/captures.mjs, netlify.toml). À utiliser pour toute demande de changement de contenu, de mise en page, de style, d'animation, de navigation, de texte, d'accessibilité ou d'impression, et pour prévisualiser ou publier le site. Déclencheurs typiques : « change le texte de l'accueil », « ajoute une section », « l'animation rame », « corrige le menu », « le rendu est cassé sur téléphone », « comment je vois le site », « ajoute une page », « le site ne se met pas à jour »."
---

# Le site Pierrel & Co

Site statique **entièrement engendré** par `build.mjs`. Aucune dépendance,
aucun framework, pas de `package.json`, et il n'en faut pas. **Ne jamais
introduire de bundler, de bibliothèque d'animation ni de `npm install`.**

Il n'y a aucun fichier HTML dans le dépôt : tout sort de `build.mjs`. Modifier
un fichier de `_site/` ne sert à rien, il est effacé à chaque construction.

| Fichier | Rôle |
|---|---|
| `build.mjs` | Le gabarit commun (`page()`), les trois pages publiques, les cinq écrans de l'application, les 88 fiches de secteur, et les garde-fous (`verifie`). |
| `assets/site.css` | Toute la mise en forme, les deux thèmes, le mouvement et l'impression. |
| `assets/app.js` | Bandeau, menu repliable, bascules, simulateur, recherche, affinage du périmètre, apparitions. |
| `assets/theme.js` | Le choix de thème (auto / clair / sombre), appliqué avant le premier rendu. |
| `assets/session.js` | Le jeton de démonstration. **Ce n'est pas une sécurité** — voir plus bas. |
| `assets/referentiel.js` | Le contenu métier → voir le skill `veille-reglementaire`. |
| `contenu/metiers.js` | Les mots du métier qui rendent un secteur trouvable (« boulangerie » → division 10). |
| `contenu/pieges.js` | Les pièges par secteur. `valide: false` tant que Clément Pierrel ne les a pas relus. |
| `contenu/demo.js` | Le jeu d'essai de l'application. |
| `outils/captures.mjs` | Les vraies captures montrées sur l'accueil : ordinateur et téléphone, claires **et** sombres. |
| `outils/icones.mjs` | Les icônes PNG du manifeste, rendues depuis `assets/favicon.svg`. |
| `sw.js` | Le service worker, copié à la racine de `_site/`. Réseau d'abord pour les pages, cache d'abord pour l'habillage. |

## Prévisualiser, et vérifier pour de vrai

```sh
node build.mjs
python3 -m http.server -d _site 8080
```

**Lire le CSS ne suffit pas.** Chromium est installé
(`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`), à piloter avec
Playwright. Après toute modification visuelle, contrôler :

- le débordement horizontal à 320, 375, 768, 1024 et 1440 px
  (`scrollWidth - clientWidth <= 0`), sur l'accueil, les tarifs, la connexion,
  le tableau de bord, l'index des secteurs et une fiche de secteur ;
- les contrastes dans **les deux thèmes**, en composant les couches
  translucides. `getComputedStyle` rend `color-mix()` tel quel, parfois en
  `color(srgb …)` dont les composantes vont de 0 à 1 : une sonde qui lit
  naïvement les trois premiers nombres mesure `rgb(1,1,1)`, c'est-à-dire du
  noir, et invente des échecs. Ne pas passer par `canvas.fillStyle` non plus :
  il garde silencieusement la couleur précédente quand il ne comprend pas ;
- le même parcours sous `reducedMotion: "reduce"` et avec
  `javaScriptEnabled: false` : rien ne doit rester invisible ;
- l'absence de toute requête sortante.

Quand on fait défiler la page par script pour déclencher les apparitions,
**neutraliser `scroll-behavior: smooth`** (`html{scroll-behavior:auto}`), sinon
les sections du bas ne sont jamais vraiment affichées et l'observateur ne les
révèle pas : on croit à un bug du site alors que c'est la sonde.

## Direction artistique

Celle des plateformes financières françaises, reprise à la demande de Clément :
une teinte saturée unique, une encre marine très sombre, des fonds teintés très
pâles, des cartes blanches à grands rayons, des boutons pilule, de grands
titres serrés. **Les écrans du produit sont le visuel principal** — pas
d'illustration, pas de photographie d'agence, pas de témoignage client tant
qu'il n'y a pas de client.

- **Couleurs** : uniquement par les jetons de `:root`. Jamais de couleur en dur
  dans une page. `--accent`, `--encre`, `--encre-douce`, `--encre-tenue`,
  `--papier`, `--papier-tein`, `--carte`, `--filet`, `--bouton-fond`,
  `--bouton-texte`, `--vert`, `--ambre`.
- **Typographie** : `Plus Jakarta Sans`, variable 400→800, un seul fichier.
  Les chiffres de tableau passent en `--mono` (police système).
- **Rayons** : `--r1` à `--r4`, `--rp` pour les pilules. Pas de carré vif.
- **Composants** : `.heros`, `.portable`, `.carte-flottante`, `.rail`,
  `.bascule`, `.traits`, `.vitrine`, `.simulateur`, `.puces`, `.raisons`,
  `.sources-bande`, `.bande-finale`, `.formules`, `.rubrique`, `.jalons`,
  `.bloc-domaine`, `.compteurs`, `.ligne-releve`, `.ligne-registre`.

## Pièges de ce dépôt

- **Aucune requête externe, et ça doit le rester.** La police est dans le dépôt
  parce que le pied de page promet qu'aucune donnée ne part chez un tiers ; un
  `<link>` vers `fonts.googleapis.com` transmettrait l'IP de chaque visiteur à
  Google et rendrait cette phrase fausse. Même raison pour les scripts
  d'analyse et les bibliothèques servies par CDN.
- **`ch` se mesure sur la police de l'élément lui-même.** Une largeur en `ch`
  posée sur le conteneur d'un très grand titre vaut la largeur du texte
  courant : le titre du héros tombait sur huit lignes. La limite appartient au
  `h1`.
- **`display: grid` ou `flex` bat `[hidden]`** : la règle du navigateur est
  moins spécifique que la nôtre. D'où `[hidden] { display: none !important; }`,
  sans quoi les deux panneaux de la bascule s'affichent en même temps.
- **Un élément de grille ne descend pas sous la largeur de son contenu.**
  `1fr` vaut `minmax(auto, 1fr)` : utiliser `minmax(0, 1fr)` et `min-width: 0`,
  sinon une table ou une longue liste fait déborder la page à 320 px.
- **La spécificité des sélecteurs de menu.** `.menu a` (0,1,1) l'emporte sur
  `.bouton` (0,1,0) : le bouton du bandeau sortait en gris encre sur fond
  marine. D'où `.menu .bouton { color: var(--bouton-texte) }`.
- **Les décalages de départ sont sous `.anime`**, classe posée par le script de
  `<head>` seulement si JavaScript tourne et que le visiteur n'a pas demandé
  moins d'animations. Les écrire directement sur `[data-paraitre]` rendrait la
  moitié de l'accueil invisible sans JavaScript.
- **Le thème se règle en trois temps**, dans cet ordre : `:root` (clair),
  `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) }`,
  puis `:root[data-theme="dark"]`. Toute règle qui dépend du thème — y compris
  le choix entre capture claire et capture sombre — suit la même séquence,
  sinon un thème forcé à la main ne passe pas.
- **Les captures se périment avec l'application.** Relancer `outils/captures.mjs`
  après toute modification visible, puis `node build.mjs`. Dix fichiers :
  cinq clairs, cinq sombres (`bord.png` / `bord-sombre.png`). Si elles
  manquent, l'accueil l'écrit au lieu d'afficher une image cassée.
- **`assets/plan-data.js` est engendré**, pas écrit à la main : le référentiel
  complet pèse 75 Ko, trop pour l'accueil. Le simulateur n'en reçoit que le nom
  et le rythme des domaines, le périmètre de base de chaque division et les
  questions de contexte.
- **Le simulateur ne propose que les questions utiles** à la division choisie —
  celles qui ajouteraient vraiment un domaine. Les réponses déjà cochées
  survivent à un changement de secteur.
- **Le service worker se prend à la racine du site**, pas à côté de la page :
  un worker servi depuis `app/` ne contrôlerait que `app/`. D'où `data-racine`
  sur `<body>`, que `assets/app.js` relit pour l'enregistrer au bon endroit.
- **Pas de badge App Store ni Google Play.** Il n'y a pas d'application native :
  ces logos mèneraient à rien. La bande d'installation montre des pictogrammes
  d'appareils et la consigne de chacun, et le dit en toutes lettres.
- **Dans une `<dl>`, un `<div>` n'admet que des `<dt>` et des `<dd>`.** Un lien
  qui couvre une carte de compteur se pose donc dans le `<dd>`, en
  `position: absolute; inset: 0`, pas autour du couple.
- **Ajouter une page publique** suppose trois gestes : la fonction dans
  `build.mjs`, son écriture dans `main()`, et le lien dans le menu **et** dans
  le pied de `page()`.

## Les trois règles du mouvement

Elles ne se négocient pas :

1. **Sans les scripts, le site est complet.** Les décalages de départ sont
   posés par `.anime`, jamais dans le HTML.
2. **`prefers-reduced-motion` coupe tout** sans retirer un mot ni fausser un
   chiffre : le compteur du rail part de la valeur finale, déjà écrite dans le
   HTML.
3. **Seuls `transform` et `opacity` sont animés.**

## Ce qui n'est pas en place, et doit rester écrit

**Il n'y a pas de serveur.** La « connexion » pose un jeton dans le navigateur
et retire un voile : **ce n'est pas une sécurité**. Les pages de l'application
sont servies à tout le monde et restent lisibles dans la source. Les données
sont un jeu d'essai.

C'est écrit en tête de `build.mjs`, dans `assets/session.js`, sur le bandeau de
l'application, sur la page de connexion et sur l'accueil. **Ne pas le retirer**
tant que l'authentification (Netlify Identity ou équivalent) et le paiement
(Stripe ou équivalent) ne sont pas branchés.

Restent également à valider par Clément Pierrel : les 90 pièges de 34
divisions (`valide: false`), la grille de tarifs, le courriel, le téléphone, le
SIRET et l'hébergeur.

## Publier

Netlify est relié à `main` et reconstruit à chaque envoi.

```sh
node build.mjs     # doit passer avant d'envoyer
git add -A && git commit -m "…" && git push
```

## Réserves à ne pas retirer

Les mentions rappelant que le service fournit un cadre méthodologique et non un
conseil juridique, et qu'il ne garantit pas l'exhaustivité des textes
applicables, font partie de la prestation. Ne pas les supprimer ni les adoucir.
