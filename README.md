# Pierrel & Co — veille réglementaire, secteur par secteur

Site statique engendré, sans dépendance ni framework. La porte d'entrée est le
**secteur** : une page par division de la nomenclature NAF, avec ce qui s'y
applique, à quel rythme le revoir, et les pièges du métier.

## Ce que produit la construction

```sh
node build.mjs                      # engendre _site/ : 90 pages
python3 -m http.server -d _site 8080
```

| Page | Rôle |
|---|---|
| `index.html` | Accueil : constat, méthode, sources, contact. |
| `secteurs.html` | Les 88 divisions NAF, cherchables par code, libellé **ou nom de métier**. |
| `secteur/<code>-<libellé>.html` | Une par division. Adresse propre, pour que les moteurs y envoient les bonnes recherches. |

Rien n'est écrit deux fois : un domaine corrigé dans le référentiel se propage
aux 88 pages à la construction suivante.

## Les sources de contenu

| Fichier | Rôle |
|---|---|
| `assets/referentiel.js` | 21 sections NAF, 88 divisions, 44 domaines de veille, 22 questions de contexte, le rattachement division → domaines, les fréquences, la méthode et les sources officielles. |
| `contenu/metiers.js` | Les mots du métier par division — « boulangerie » pour la division 10, « maçon » pour la 43. **C'est ce qui rend l'index trouvable** : les libellés NAF ne disent pas les métiers. 77 divisions couvertes, 397 mots. |
| `contenu/pieges.js` | Les pièges du métier, une entrée par division. Seul contenu qui ne se déduit pas du référentiel. Chaque entrée porte `valide: false` tant qu'elle n'a pas été relue, et la page l'affiche alors avec une mention explicite. |

## Le reste

| Fichier | Rôle |
|---|---|
| `assets/site.css` | Le système visuel : tokens des deux thèmes, composants, impression, écrans étroits. |
| `assets/theme.js` | Le choix du thème — auto, clair, sombre — appliqué avant le premier rendu. |
| `assets/app.js` | Barre de navigation, révélations, recherche de l'index, affinage du périmètre. |
| `assets/polices.css`, `assets/polices/` | EB Garamond, seule police chargée, servie par le site. Les étiquettes, codes NAF et chiffres sont en monospace du système. |
| `build.mjs` | Le générateur, et les garde-fous. |
| `design-system/pierrel-co/MASTER.md` | La direction visuelle, produite par le plugin `ui-ux-pro-max`. |
| `recherche/marche-veille-reglementaire.md` | La revue du marché menée avant de concevoir. |

## Le parti pris graphique

Le registre est **le document**, pas l'application : un registre réglementaire,
une fiche technique. Ce que ce parti pris interdit, et qui était là dans une
première version jugée « trop IA » : aucune ombre portée, aucun angle arrondi,
aucun dégradé, aucune carte flottante, aucun bouton en pastille.

Ce qui structure la page à la place : des filets d'un pixel, une grille
asymétrique à deux colonnes — une étroite pour les étiquettes, une large pour le
texte — et un contraste typographique franc entre le Garamond du texte et le
monospace des codes et des chiffres.

## Les deux thèmes

Clair et sombre, **au choix du visiteur** : auto (on suit le système), clair, ou
sombre. Le choix est gardé dans le navigateur et appliqué avant le premier
rendu, sinon la page clignote en clair avant de passer au sombre.

Les quinze paires de contraste des deux thèmes tiennent le 4,5:1. La palette
retenue — encre sur papier chaud, un seul rouge de tampon — s'écarte du navy et
de l'ambre recommandés par `MASTER.md` : ce couple est le défaut de tous les
générateurs, et c'est précisément ce qui faisait « trop IA ». Deux tokens de
filet coexistent, un décoratif et un pour les contrôles, le critère non textuel
de 3:1 ne visant pas les séparations.

## Trois règles tenues

1. **Aucune requête externe.** Les polices sont dans le dépôt : les appeler chez
   Google transmettrait l'adresse IP de chaque visiteur à un tiers, ce que le
   pied de page promet de ne pas faire.
2. **Sans JavaScript, le site reste complet.** Les décalages de départ sont posés
   par le script, jamais dans le HTML.
3. **`prefers-reduced-motion` coupe tout** sans retirer une ligne de contenu.

## Ajouter du contenu

- **Un métier trouvable** : une entrée dans `contenu/metiers.js`.
- **Un piège** : une entrée dans `contenu/pieges.js`, puis passer `valide: true`
  une fois relue.
- **Un domaine, un rattachement, une question** : `assets/referentiel.js`.

`node build.mjs` refuse de construire si une division manque, si un domaine cité
n'existe pas, si une fréquence est inconnue, ou si deux divisions produisent la
même adresse.

## Limites

Le site fournit un cadre méthodologique, pas un conseil juridique, et ne garantit
pas l'exhaustivité des textes applicables à une entreprise donnée. Le
rattachement d'un domaine à une division NAF est une orientation, pas une
qualification juridique. Ces réserves sont affichées sur chaque page de secteur.

Le courriel, le téléphone, le SIRET et l'hébergeur sont encore des valeurs
d'exemple.
