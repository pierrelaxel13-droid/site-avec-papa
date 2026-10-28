---
name: site-pierrel
description: "Modifier et publier le site Pierrel & Co de ce dépôt (build.mjs, assets/site.css, assets/app.js, assets/theme.js, assets/session.js, contenu/, outils/captures.mjs, netlify.toml). À utiliser pour toute demande de changement de contenu, de mise en page, de style, d'animation, de navigation, de texte, d'accessibilité ou d'impression, et pour prévisualiser ou publier le site. Déclencheurs typiques : « change le texte de l'accueil », « ajoute une section », « l'animation rame », « corrige le menu », « le rendu est cassé sur téléphone », « comment je vois le site », « ajoute une page », « le site ne se met pas à jour »."
---

# Le site Pierrel & Co

**En ligne : https://pierrelaxel13-droid.github.io/site-avec-papa/** —
GitHub Pages (`.github/workflows/publie.yml`) construit `main` à chaque envoi
et après chaque relève, et publie environ deux minutes plus tard. Pousser
suffit. Netlify n'est plus utilisé depuis le 27 octobre 2026 : son quota
gratuit était épuisé (chaque relève y coûtait une construction), l'adresse
netlify.app est figée. Le site vit dans un sous-dossier (`/site-avec-papa/`) :
**aucun chemin absolu** (`href="/…"`), tout passe par `racine`. Pages
n'envoie pas d'en-têtes : la politique de sécurité est aussi une balise meta
(`POLITIQUE` dans build.mjs) — la garder alignée sur `netlify.toml`.
Cet environnement n'atteint pas l'adresse publique ; on vérifie en servant
`_site/` en local, et « Vérifier le site en ligne » constate ce qui est publié.

Site statique **entièrement engendré** par `build.mjs`. Aucune dépendance,
aucun framework, pas de `package.json`, et il n'en faut pas. **Ne jamais
introduire de bundler, de bibliothèque d'animation ni de `npm install`.**

Il n'y a aucun fichier HTML dans le dépôt : tout sort de `build.mjs`. Modifier
un fichier de `_site/` ne sert à rien, il est effacé à chaque construction.

| Fichier | Rôle |
|---|---|
| `build.mjs` | Le gabarit commun (`page()`), les trois pages publiques, les cinq écrans de l'application, les 88 fiches de secteur, et les garde-fous (`verifie`). |
| `assets/site.css` | Toute la mise en forme, les deux thèmes, le mouvement et l'impression. |
| `assets/app.js` | Bandeau, menu repliable, pages à catégories, bascules, simulateur, recherche, affinage du périmètre, apparitions. |
| `assets/theme.js` | Le choix de thème (auto / clair / sombre), appliqué avant le premier rendu. |
| `assets/amorce.js` | Les trois lignes qui appliquent le thème et arment les apparitions, avant tout rendu. Elles tenaient dans la page ; elles en sont sorties parce que la politique de sécurité interdit désormais tout script écrit dans le HTML. **Ne jamais remettre de `<script>` en ligne dans `build.mjs`** : il serait refusé par le navigateur. |
| `assets/session.js` | Le jeton de démonstration et la formule ouverte. **Ce n'est pas une sécurité** — voir plus bas. |
| `assets/entreprise.js` | Les deux volets de `app/reglages.html` : mon entreprise, mes alertes. Tout est gardé dans le navigateur. |
| `assets/avis.js` | La cloche des nouveaux textes, sur tous les écrans de l'application. |
| `assets/referentiel.js` | Le contenu métier → voir le skill `veille-reglementaire`. |
| `contenu/metiers.js` | Les mots du métier qui rendent un secteur trouvable (« boulangerie » → division 10). |
| `contenu/pieges.js` | Les pièges par secteur. `valide: false` tant que Clément Pierrel ne les a pas relus. |
| `contenu/textes.js` | Une fiche par référence citée : nature, à qui, ce qu'elle exige. Clé = la référence exacte du référentiel. |
| `contenu/demo.js` | Le jeu d'essai de l'application. |
| `outils/captures.mjs` | Les vraies captures montrées sur l'accueil : ordinateur et téléphone, claires **et** sombres. |
| `outils/icones.mjs` | Les icônes PNG du manifeste, rendues depuis `assets/favicon.svg`. |
| `outils/veille.mjs` | La relève des 25 sources de `contenu/sources.js` → `contenu/veille-releve.json`. |
| `contenu/liens.js` | Où lire chaque texte : `{ code: "…" }` (adresse reconstruite depuis l'annuaire LEGI) ou `{ url: "…" }`. **Le build échoue si une référence n'y est pas et n'est ni un code ni un texte européen reconnu.** |
| `.github/workflows/releve.yml` | La relève planifiée : les flux toutes les heures, les codes une fois par jour, puis commit de `contenu/` si quelque chose a bougé. **`outils/codes.mjs` ne tourne plus à la construction Netlify** — le régénérer sans le commiter referait la même comparaison à l'infini. |
| `outils/releve-exemple.json` | Jeu d'essai à la forme d'une vraie relève. Le poser dans `contenu/veille-releve.json` et construire est le **seul** moyen d'exercer, sans réseau, le code qui ne s'allume qu'avec des textes relevés (`ligneJO`, la rubrique « relevé officiel »). À faire après toute retouche de `build.mjs`. |
| `outils/naf.mjs` | La nomenclature NAF entière → `contenu/naf.js` (732 codes APE). Source : `@socialgouv/codes-naf` sur le registre npm. |
| `contenu/naf.js` | **Engendré** : 732 codes APE avec leur division. Ne pas modifier à la main. |
| `outils/codes.mjs` | Le texte des codes consolidés → `contenu/codes.json` (193 pages, 4 718 articles), et la comparaison avec la relève précédente. Source : `@socialgouv/legi-data` sur le registre npm, joignable d'ici. |
| `contenu/perimetres.js` | Quel morceau de code va sur quelle fiche : référence exacte, identifiant du code, motif sur le chemin des titres. |
| `contenu/codes.json` | **Suivi par git** : c'est en le comparant que le robot sait ce qui a changé. Ne pas le modifier à la main. |
| `contenu/sources.js` | Les sources relevées : méthode (`dila`/`rss`), genre (`texte`/`actualite`), adresse du flux. |
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
- **Les trois formules sont un rang, pas une liste.** Une page déclare le rang
  qu'elle demande (`formule:` dans l'appel à `page()`, qui pose `data-formule`
  sur `<body>`), la session en porte un, `session.js` compare. Ajouter un écran
  suppose donc de lui donner sa formule, et d'ajouter son fichier à la table
  `exige` de `session.js` pour qu'il soit marqué dans le menu.
- **Le champ du mot de passe ne doit jamais devenir fonctionnel à moitié.**
  Tant qu'il n'y a pas de service d'authentification, il n'est lu nulle part,
  n'est transmis nulle part, est vidé à l'envoi, et la page l'écrit au-dessus
  du champ. Ne pas retirer cet avertissement, ne pas « brancher » une
  vérification dans le navigateur : un mot de passe comparé côté client donne
  l'illusion d'une sécurité et fait taper aux gens un vrai mot de passe.
- **Se connecter et s'abonner sont deux parcours**, donc deux pages :
  `connexion.html` ne porte que le formulaire, `abonnement.html` porte la
  grille, l'essai et le choix de formule. Ne pas les refondre en une.
- **Le périmètre se calcule à deux endroits** — le simulateur de l'accueil et
  l'écran « Mon entreprise » — sur les mêmes données (`assets/plan-data.js`) et
  avec la même règle. Toucher à l'un suppose de vérifier l'autre : un métier
  décrit ici et décrit là-bas doit donner le même plan.
- **Le PDF, c'est l'impression du navigateur.** Pas de bibliothèque, pas de
  serveur : le bouton pose `body.impression-fiche`, marque la ligne, et la
  feuille d'impression ne garde que celle-là.
- **Le nom du cache du service worker porte une empreinte**, posée par
  `build.mjs` depuis le contenu de l'habillage. Il était figé : « cache
  d'abord » servait éternellement l'ancienne feuille de style aux visiteurs
  déjà venus. Ne jamais refiger ce nom. Et dans les sondes Playwright, passer
  `serviceWorkers: "block"` — sinon on vérifie une version périmée.
- **Ne jamais confondre `texte` et `actualite`.** Un texte est du droit ; une
  publication officielle est un commentaire. Les mélanger ferait passer un
  guide de l'INRS pour une obligation, ce qui est exactement la faute qu'un
  cabinet de conformité ne peut pas commettre.
- **Une adresse de flux ne passe à `confirme: true` qu'après un
  `--verifier` qui répond.** Aucune n'a pu être interrogée depuis cet
  environnement : elles sont toutes à `false`, et c'est volontaire.
- **Le relevé officiel est absent tant que `outils/veille.mjs` n'a pas tourné**,
  et l'application le dit. Ne jamais combler ce vide avec des textes inventés,
  ni présenter le jeu d'essai comme un relevé réel : c'est la seule chose qui
  rendrait ce produit malhonnête.
- **Le texte des codes ne couvre que trois codes** (travail, sécurité sociale,
  rural), parce que l'extraction LEGI joignable n'en publie pas d'autres. Les
  fiches des autres codes le disent et gardent leur lien. Ne pas inventer un
  périmètre pour un code absent : `outils/codes.mjs` s'arrêterait.
- **Le découpage de `contenu/perimetres.js` est une aide à la lecture**, pas un
  avis juridique : à relire par Clément Pierrel.
- **Les `actions` des 44 domaines sont un premier jet**, comme les pièges : à
  relire par Clément Pierrel. Le `classement` (santé-sécurité, hygiène, social,
  environnement, métier) commande les tableaux du relevé — le changer change ce
  que voit le client.
- **Le périmètre se calcule par division, pas par code APE.** Les deux premiers
  chiffres du code font le pont (`4322B` → division `43`). Ne pas créer de
  périmètre au niveau du code : les obligations ne se distinguent pas à ce
  niveau-là.
- **Jamais « chercher » sur le site.** 75 fiches mènent au texte même, 49 au
  recueil officiel qui le publie, et la page dit lequel des deux. Une référence
  sans destination fait échouer le build (`verifieLiens`).
- **Une page ne montre que ce qu'on y est venu voir.** Arrivé sur une fiche de
  secteur avec `?ape=4322B`, le client voit son code en haut et les textes qui
  s'appliquent ; les 23 autres codes de la division restent repliés. Ne pas
  remettre de liste longue avant ce qu'il vient lire.
- **Sur une fiche de secteur, les textes propres au métier passent devant**,
  le socle commun à toute entreprise est replié dessous. Ne pas remettre les
  deux à plat : c'est ce qui faisait « brouillon ».
- **La date « en vigueur depuis » ne s'invente pas.** Elle vient du contenu
  consolidé relevé (`dateDuTexte`). Quand il n'y en a pas, la page écrit
  « pas encore relevée ».
- **« Mon plan » porte les 44 domaines**, ceux hors périmètre posés `hidden`
  par `build.mjs` ; `suivrePlan()` (assets/entreprise.js) les réaffiche selon
  les réglages enregistrés. Ne pas revenir à un plan qui ne rendrait que le
  périmètre du jeu d'essai : il cesserait de suivre l'entreprise.
- **On clique la case, pas le mot.** Une ligne ou une carte qui mène quelque
  part reçoit `lienCarte()` ; ses propres liens repassent devant en
  `z-index: 1`.
- **Relevé, Textes, Secteurs : les catégories d'abord, seules.** Ces pages
  s'ouvrent sur `cartesCategories()` (une carte par catégorie) ; chaque
  catégorie porte `data-categorie`, les explications sont repliées dans
  `aSavoir()` (`data-annexe`). Au clic, `categories()` (assets/app.js) cache
  tout ce qui n'est pas la catégorie choisie — en-tête compris — et met un
  bouton « Toutes les catégories ». Ne pas remettre de contenu entre les
  cartes et les catégories : il resterait affiché au clic, et le client
  demande « seulement ça ». Les fiches de secteur, elles, déplient leurs textes.
- **Dans une catégorie, on distingue ce qu'il y a dedans.** `parSujet()` range
  son contenu par sujet (domaine du référentiel) : en haut la liste « Dans
  cette catégorie » avec les nombres, dessous un encadré par sujet. Secteurs
  fait de même avec ses divisions.
- **Pas de barre de défilement**, nulle part (site.css, en tête).
- **Au téléphone, la même disposition qu'au PC** (choix d'Axel, 27 octobre :
  « la même, lisible ») : l'ordinateur et son téléphone en tête, boutons côte
  à côte, cases par deux (site.css § 31). Seuls les longs textes — l'outil,
  les captures, les questions — gardent toute la largeur. Pas de version
  « miniature » du PC : illisible sans zoomer.
- **Rien qui ait l'air cliquable sans l'être.** Une pastille, une case ou une
  capture qu'on clique fait quelque chose : les pastilles de l'entreprise
  mènent à Réglages, les métiers de l'accueil choisissent le métier dans
  l'outil, les captures s'agrandissent (`agrandir()` + `captures()`). Une
  étiquette qui ne mène nulle part est du texte, sans bulle.
- **Les cases d'une même ligne ont la même hauteur** (grilles en
  `align-items: stretch`, puces en flex).
- **Fait / pas fait** : `boutonFait()` dans « Ce que vous devez faire » (relevé,
  tableau de bord) et sur chaque sujet du plan (revue qui redevient à faire à
  son rythme, `JOURS_DE`). État dans `localStorage` « pco-faits » ; les cartes
  comptent « N faits sur M » (`faits()` dans app.js).
- **Comment ça marche** (`decouvrir.html`, `pageDecouvrir()`) : les étapes, des
  dessins SVG aux couleurs du thème (version en hauteur sous 40rem) et les
  captures. On y va par le menu, le bouton du héros de l'accueil et le pied
  (pas dans le bandeau : seul « Connexion » y est) ; elle ne mène pas dans
  l'application.
- **Les vrais comptes** : `functions/` + `serveur/compte.mjs`, sur Cloudflare
  Pages seulement (`.github/workflows/cloudflare.yml`). La démo est copiée de
  `app/` vers `demo/` à la fin de build.mjs (`copieDemo()`), liens réécrits.
  Les pages publiques mènent à la démo par `demo/`, jamais par `app/`. Essayer
  en local : `node outils/comptes-local.mjs 8820` (faux Stripe, faux KV).
  Sur GitHub Pages, `/api/` n'existe pas : la connexion le dit (404 attendu
  sur `api/moi`).
- **Pages légales** : `legales.mjs` (mentions, confidentialité, CGV), liées
  dans le pied de chaque page. Versions de travail : relecture par un avocat
  obligatoire avant le lancement. Identité dans `SITE.editeur`.
- **Les formules** (28 octobre 2026) : Textes 59 €, Textes et suivi 99 €,
  Veille complète 149 € par mois, ou dix mois à l'année (« 2 mois offerts »,
  l'annuel est affiché en premier). Franchise de TVA : mention art. 293 B
  (`SITE.tva`), jamais « HT » ni « TTC » tant qu'elle s'applique. Tout le texte des tarifs,
  de l'accueil, de la FAQ et de « Qui sommes-nous » sort de `FORMULES` ; les
  clés et rangs sont aussi dans `assets/session.js`.
- **« En savoir plus » ouvre une page à part** : `le-site.html` et `nous.html`
  (`pageInfos()`, encarts dans `encartsDuSite()` / `encartsDeNous()`), rien
  ne se déplie sur l'accueil. « Voir tout » sous « Votre métier y est » mène à
  `metiers.html` (`pageMetiers()`, les 88 divisions par section) ; chaque
  métier ouvre `index.html?q=CODE#simulateur`.
- **Vos questions** : seize questions en trois thèmes (`faq` dans
  `pageAccueil()`) — ne pas en ajouter, développer les réponses. Chaque réponse
  commence par la réponse courte en gras. Chiffres tirés des données ; ce qui
  n'est pas en place (courriel, comptes, prix à confirmer) est dit.
- **La barre des avis** (`bandeAvis()`, sous le héros) : défile les avis de
  `contenu/temoignages.js` — de vrais avis seulement, publiés avec l'accord de
  leur auteur. Vide, elle le dit et invite à laisser le sien. « Laisser votre
  avis » ouvre un formulaire (`avis()` dans app.js) qui prépare un courriel à
  l'adresse du cabinet ; sans JS, c'est un simple lien mailto. Pour publier un
  avis reçu : l'ajouter à `temoignages.js`, reconstruire.
- **Réglages, l'entreprise en chiffres** : chiffre d'affaires, forme, création,
  sites, SIRET (contrôle de Luhn), certifications. Ils décrivent l'entreprise
  sur le plan ; ils ne changent pas les sujets, et la page le dit.
- **Le texte va à côté de sa source.** Sur la fiche de secteur, chaque texte se
  déplie sur ce qu'il exige, avec sa fiche et son lien officiel. Dans le plan
  et le tableau de bord, les actions et les textes liés sont visibles sans
  rien déplier.
- **L'extracteur DILA de `veille.mjs` n'a pas encore vu un XML réel.** Il
  préfère remonter « 0 texte extrait » qu'un contenu reconstitué. Au premier
  passage réussi, vérifier ce qu'il sort contre le fichier d'origine avant de
  publier quoi que ce soit.
- **Une fiche de texte ne reproduit pas le texte officiel**, et ne doit jamais
  le faire : Légifrance seul fait foi, et une copie se périme en silence. La
  fiche dit ce que le texte exige. Le lien vers la source reste, en second.
- **La clé d'une fiche est la référence au caractère près.** `build.mjs` refuse
  de construire si une référence n'a pas de fiche ou si une fiche ne correspond
  à aucune référence : renommer dans le référentiel suppose de renommer ici.
- **Un débord par marge négative élargit la page** partout où rien ne le
  rogne. Le pied de la maquette d'ordinateur débordait ainsi de 20 px hors du
  héros, qui seul avait `overflow: hidden`.
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
