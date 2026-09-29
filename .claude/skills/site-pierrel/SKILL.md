---
name: site-pierrel
description: "Modifier et publier le site statique Pierrel & Co de ce dépôt (index.html, plan-de-veille.html, assets/site.css, assets/plan.js, assets/polices.css, build.mjs, netlify.toml). À utiliser pour toute demande de changement de contenu, de mise en page, de style, de navigation, de texte, d'accessibilité ou d'impression, et pour prévisualiser ou publier le site. Déclencheurs typiques : « change le texte de l'accueil », « ajoute une section », « corrige le menu », « le rendu est cassé sur téléphone », « comment je vois le site », « ajoute une page », « le site ne se met pas à jour »."
---

# Le site Pierrel & Co

## Ce qu'il faut savoir avant de toucher un fichier

Deux pages HTML écrites à la main, une feuille de style, deux scripts, aucune
dépendance. `build.mjs` ne compile rien : il copie les fichiers publiables dans
`_site/` et vérifie le référentiel. **Ne pas introduire de framework, de
bundler, de Tailwind ni de npm install** — le site n'a pas de `package.json` et
n'en veut pas.

| Fichier | Rôle |
|---|---|
| `index.html` | Accueil. La méthode et le tableau des sources sont **générés** depuis le référentiel par le script en fin de page. |
| `plan-de-veille.html` | L'outil. Structure seulement : tout le contenu est rendu par `assets/plan.js`. |
| `assets/site.css` | Toute la mise en forme des deux pages, impression comprise. |
| `assets/plan.js` | Logique de l'outil. |
| `assets/referentiel.js` | Le contenu métier → voir le skill `veille-reglementaire`. |
| `assets/polices.css`, `assets/polices/` | Les deux polices, servies par le site. |

## Prévisualiser

```sh
node build.mjs
python3 -m http.server -d _site 8080
```

`_site/` est un dossier de sortie, ignoré par git : ne jamais y modifier un
fichier, il est effacé à chaque construction.

Pour vérifier un rendu pour de vrai (parcours de l'outil, largeurs d'écran,
impression), Chromium est installé : `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`,
à piloter avec Playwright. C'est la seule façon de voir un défaut de mise en
page ; lire le CSS ne suffit pas.

## Direction artistique

Document plutôt qu'interface : papier chaud, serif éditoriale pour les titres,
un seul accent vert, beaucoup d'air, angles à peine adoucis.

- **Couleurs** : uniquement par les tokens de `:root` — `--papier`, `--sable`,
  `--encre`, `--encre-douce`, `--gris`, `--vert`, `--vert-clair`,
  `--vert-sombre`, `--vert-voile`, `--terre`, `--alerte`, `--attention`,
  `--trait`, `--trait-fort`. Ne jamais écrire une couleur en dur dans une page.
- **Typographie** : `Newsreader` (serif) pour `h1`, `h2`, `h3` et les gros
  chiffres ; `Inter` pour tout le reste. Les deux sont **variables** : un seul
  fichier couvre toutes les graisses, ne pas les dupliquer par graisse.
- **Composants existants**, à réutiliser avant d'en inventer : `.enveloppe`,
  `.section` (`.section-sable`, `.section-encre`, `.section-serree`),
  `.tete-section`, `.surtitre`, `.carte`, `.carte-sobre`, `.grille-2`,
  `.grille-3`, `.bouton` (`.bouton-clair`, `.bouton-petit`), `.etape`,
  `.livrable`, `.tableau`, `.etiquette`, `.reserve`, `.fiche`.
- Une seule feuille de style : le site est trop petit pour être découpé.

## Pièges de ce dépôt

- **Aucune requête externe, et ça doit le rester.** Les polices sont dans le
  dépôt parce que le pied de page promet qu'aucune donnée ne part chez un tiers ;
  un `<link>` vers `fonts.googleapis.com` transmettrait l'IP de chaque visiteur
  à Google et rendrait cette phrase fausse. Même raison pour les scripts
  d'analyse et les polices d'icônes.
- **L'en-tête et le pied de page sont dupliqués dans les deux pages** (il n'y a
  aucun gabarit). Toucher au menu, à la marque ou au pied de page suppose
  d'éditer `index.html` **et** `plan-de-veille.html`.
- **La méthode et le tableau des sources de l'accueil sont générés** depuis
  `window.REFERENTIEL` : les modifier dans le HTML ne sert à rien.
- **Les réponses de l'outil vivent dans `localStorage`** sous `pco-plan-v1`.
  Renommer cette clé fait perdre leurs réponses aux visiteurs en cours de route.
  Toute lecture ou écriture doit rester dans un `try/catch` : en navigation
  privée, l'accès lève.
- **`[hidden]` est forcé en `display:none !important`** : les composants qui
  posent un `display` l'emporteraient sinon et resteraient visibles à tort.
  C'est ce qui masque la barre d'actions tant qu'aucun métier n'est choisi.
- **`.sans-impression`** masque à l'impression ; `.entete-impression` n'apparaît
  qu'à l'impression. Après toute modification de l'outil, vérifier la feuille
  imprimée, c'est un livrable qui finit dans un dossier d'audit.
- **Ajouter une page** suppose trois gestes : le fichier, son entrée dans
  `A_PUBLIER` de `build.mjs`, et le lien dans le menu **des deux** autres pages.
- **Accessibilité** : lien d'évitement, `aria-label` sur la navigation,
  `aria-pressed` sur les boutons de métier, `aria-live` sur la sortie du plan.
  Conserver ces attributs sur tout nouveau bloc.

## Publier

Netlify est relié à `main` et reconstruit à chaque envoi, en une minute environ.

```sh
node build.mjs     # doit passer avant d'envoyer
git add -A && git commit -m "…" && git push
```

Si `build.mjs` échoue, Netlify échouera de la même façon. Réglages dans
`netlify.toml` : pages HTML revalidées à chaque visite, `assets/*` en cache une
heure. Procédure complète dans `DEPLOIEMENT.md`.

## Ce qui est volontairement absent

À signaler, pas à « corriger » en passant :

- **pas de formulaire de contact** : courriel et téléphone, plutôt qu'un
  formulaire qui n'enverrait rien ;
- **pas de collecte automatique** : aucun workflow, aucun secret, aucune tâche
  planifiée à surveiller ;
- le **courriel**, le **téléphone**, le **SIRET** et l'**hébergeur** sont des
  valeurs d'exemple, listées dans `DEPLOIEMENT.md`.

## Réserves à ne pas retirer

Les mentions rappelant que le site et son outil fournissent un cadre
méthodologique et non un conseil juridique, sur les deux pages et sur la feuille
imprimée, font partie de la prestation. Ne pas les supprimer ni les adoucir.
