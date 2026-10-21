# Pierrel & Co — veille réglementaire, secteur par secteur

Site statique engendré, sans dépendance ni framework. La porte d'entrée est le
**secteur** : une page par division de la nomenclature NAF, avec ce qui s'y
applique, à quel rythme le revoir, et les pièges du métier.

## Deux zones

```sh
node build.mjs                      # engendre _site/ : 96 pages
python3 -m http.server -d _site 8080
```

**Le site public** — trois pages : `index.html` montre le produit avec de
vraies captures de l'application, `tarifs.html` affiche les trois formules,
`connexion.html` ouvre l'accès.

**L'application** — sous `app/` : tableau de bord, mon plan, relevé, registre,
et les 88 fiches de secteur (`app/secteur/<code>-<libellé>.html`).

## Ce qui n'existe pas encore, et qui doit être dit

**Il n'y a pas de serveur.** La « connexion » pose un jeton dans le navigateur
et retire un voile posé au-dessus du contenu : **ce n'est pas une sécurité**.
Les pages de l'application sont servies à tout le monde et leur contenu reste
lisible dans la source. Les données affichées sont un jeu d'essai — entreprise
et textes fictifs.

Les deux faits sont écrits sur les écrans concernés, dans `assets/session.js`
et en tête de `build.mjs`. **Ils doivent y rester** tant que ces deux services
ne sont pas en place :

- **l'authentification** — Netlify Identity ou équivalent, pour que les comptes
  existent et que les pages ne soient plus servies sans jeton valide ;
- **le paiement** — Stripe ou équivalent, pour l'abonnement et sa résiliation.

La grille de tarifs est une **proposition à valider**, construite depuis la
revue de marché, pas une grille arrêtée par Clément Pierrel. La page le dit.

## Les captures de l'accueil

Les écrans montrés sur la page d'accueil sont de **vraies captures** de
l'application, prises par `outils/captures.mjs`. Elles ne peuvent donc pas
mentir sur ce que contient le produit, et elles se périment avec lui — à
relancer après toute modification visible :

```sh
node build.mjs && python3 -m http.server 8080 -d _site &
node outils/captures.mjs
node build.mjs
```

Si les captures manquent, l'accueil l'écrit au lieu d'afficher une image cassée.

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
