---
name: site-pierrel
description: "Modifier et publier le site statique Pierrel & Co de ce dépôt (index.html, veille-reglementaire.html, outil-veille.html, assets/site.css, assets/veille-outil.css, assets/veille-outil.js, build.mjs, netlify.toml). À utiliser pour toute demande de changement de contenu, de mise en page, de style, de navigation, de texte, de formulaire, de mentions légales, d'accessibilité ou d'impression, et pour prévisualiser ou publier le site. Déclencheurs typiques : « change le texte de la page d'accueil », « ajoute une section », « corrige le menu », « le site ne se met pas à jour », « comment je vois le rendu », « ajoute une page »."
---

# Site Pierrel & Co

## Ce qu'il faut savoir avant de toucher un fichier

Site **statique, sans build de framework et sans dépendance** : trois pages HTML
écrites à la main, deux feuilles de style, deux scripts. `build.mjs` ne fait que
copier dans `_site/` les fichiers servis aux visiteurs — il ne compile rien, ne
minifie rien, et n'a aucun `npm install` à faire. Pas de React, pas de Tailwind,
pas de bundler : ne pas en introduire.

| Fichier | Rôle |
|---|---|
| `index.html` | Accueil : prestations, méthode, profil, contact. |
| `veille-reglementaire.html` | Présentation de la prestation de veille. |
| `outil-veille.html` | Outil de travail en 6 étapes. |
| `assets/site.css` | Design system partagé (tokens, boutons, sections, tableaux, impression). |
| `assets/veille-outil.css` | Composants propres à l'outil (onglets, tuiles, synthèse). |
| `assets/veille-data.js` | Référentiel de veille → voir le skill `veille-reglementaire`. |
| `assets/veille-outil.js` | Logique de l'outil (NAF, périmètre, registre, CSV, persistance). |

## Prévisualiser

```sh
node build.mjs                  # assemble _site/ et vérifie le référentiel
npx http-server _site -p 8080
```

Servir en HTTP est nécessaire : l'étape 4 de l'outil lit `data/veille-feed.json`
par `fetch`, ce qui échoue en `file://` (un message explicite s'affiche alors à
la place du fil, le reste de l'outil fonctionne — ce n'est pas un bug).

`_site/` est un dossier de sortie, ignoré par git : ne jamais y modifier un
fichier, la modification serait perdue à la construction suivante.

## Design system : la convention à respecter

Direction artistique posée en tête de `assets/site.css` : **angles vifs, bordures
1px, mono pour les labels**. Pas d'arrondis, pas d'ombres portées douces, pas de
dégradés décoratifs.

- Couleurs : uniquement par les tokens de `:root` — `--ink`, `--paper`,
  `--paper-pure`, `--concrete`, `--concrete-light`, `--accent`,
  `--accent-bright`, `--accent-deep`, `--steel`, `--error`, `--warn`, `--ok`,
  `--line`, `--line-strong`. Ne pas écrire une couleur en dur dans une page.
- Typographie : `Archivo Black` pour les titres, `Archivo` pour le texte,
  `IBM Plex Mono` via la classe `.mono` pour les labels et les chiffres
  (`font-variant-numeric: tabular-nums`). Les trois familles sont chargées
  depuis Google Fonts dans le `<head>` des trois pages.
- Structures existantes à réutiliser plutôt que réinventer : `.wrap` /
  `.wrap-wide`, `.section` / `.section-tight`, `.section-head`, `.band`,
  `.eyebrow`, `.btn` (`.btn-outline`, `.btn-sm`, `.btn-danger`), `.plan-card`,
  `.corner-ticks`, `.blueprint`, `.grain`, `.mono`, `.visually-hidden`,
  `.skip-link`.
- Un composant nouveau utilisé par une seule page de l'outil va dans
  `assets/veille-outil.css` ; un composant partagé va dans `assets/site.css`.

## Pièges de ce dépôt

- **En-tête et pied de page sont dupliqués dans les trois pages** (il n'y a
  aucun gabarit). Toucher au menu, au logo ou au pied de page signifie éditer
  `index.html`, `veille-reglementaire.html` **et** `outil-veille.html`, sinon la
  navigation devient incohérente d'une page à l'autre.
- **`[hidden]` est forcé en `display:none !important`** dans `site.css` : les
  composants qui posent un `display` l'emporteraient sinon et resteraient
  visibles à tort. Ne pas retirer cette règle.
- **Le tableau des sources et la liste des étapes de `veille-reglementaire.html`
  sont générés** depuis `window.VEILLE` par le script en fin de page : les
  modifier dans le HTML ne sert à rien, il faut passer par
  `assets/veille-data.js`.
- **Les données de l'outil vivent dans `localStorage`** sous la clé
  `pco-veille-v1`. Aucun backend, aucun compte. Renommer cette clé ferait perdre
  aux utilisateurs leur registre en cours : ne pas y toucher sans prévoir une
  migration.
- **Ajouter une page** suppose trois gestes : le fichier HTML, son entrée dans
  `A_PUBLIER` de `build.mjs`, et le lien dans le menu des autres pages.
- **Styles d'impression** : la synthèse de l'étape 6 est un document destiné à
  l'impression (`.no-print` masque le reste). Vérifier le rendu papier après
  toute modification de la synthèse.
- **Accessibilité** : les pages ont un `.skip-link`, des `aria-label` sur la
  navigation et des libellés associés aux champs. Conserver ces attributs sur
  tout nouveau bloc.

## Publier

Netlify est relié à la branche `main` : il reconstruit et republie à chaque
envoi, en une minute environ.

```sh
node build.mjs          # doit passer avant d'envoyer
git add -A
git commit -m "…"
git push
```

Si `build.mjs` échoue, Netlify échouera de la même façon : la construction
recharge `assets/veille-data.js` et s'interrompt si le référentiel est
incomplet (moins de 40 domaines, ou un nombre de divisions NAF différent de 88).

Réglages de publication dans `netlify.toml` — `command = "node build.mjs"`,
`publish = "_site"`, Node 22. Les en-têtes de cache y sont volontairement
serrés : `data/veille-feed.json` en `max-age=0, must-revalidate` (le fil est
réécrit toutes les heures, un cache afficherait du périmé), les pages HTML de
même, `assets/*` une heure. Procédure complète dans `DEPLOIEMENT.md`.

## Ce qui est volontairement inachevé

À ne pas « corriger » en passant, mais à signaler ou à traiter si la demande le
dit explicitement (détail dans `DEPLOIEMENT.md`) :

- le **formulaire de contact** valide la saisie et affiche une confirmation,
  mais n'envoie rien (Netlify Forms le rendrait fonctionnel en ajoutant
  l'attribut `netlify` à la balise `<form>`) ;
- les **mentions légales** portent des champs « à compléter » (SIRET,
  hébergeur) ;
- le **téléphone** et l'**e-mail** de la page de contact sont des valeurs
  d'exemple.

## Réserves à ne pas retirer

Les mentions rappelant que l'outil fournit un cadre méthodologique et non un
conseil juridique — dans l'interface comme dans la synthèse imprimée — font
partie de la prestation. Ne pas les supprimer ni les adoucir.
