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

Dix fichiers : cinq clairs, cinq sombres (`bord.png` / `bord-sombre.png`). Sans
le jeu sombre, un grand rectangle blanc trônerait au milieu de la page sombre.
Si les captures manquent, l'accueil l'écrit au lieu d'afficher une image cassée.

## La direction artistique

Celle des plateformes financières françaises, reprise à la demande : une teinte
saturée unique (indigo), une encre marine très sombre, des fonds teintés très
pâles, des cartes blanches à grands rayons, des boutons pilule, de grands
titres serrés en `Plus Jakarta Sans`. **Les écrans du produit sont le visuel
principal** — pas d'illustration, pas de photographie d'agence.

Pas de témoignage client : il n'y en a pas encore. La bande qui tiendrait cette
place liste les sources officielles suivies, qui sont vérifiables.

## Les trois formules

La formule choisie décide des écrans ouverts : **Cadrage** donne le plan de
veille et les fiches de secteur, **Veille tenue** y ajoute le tableau de bord
et le relevé, **Veille et preuves** ouvre le registre. Une page déclare le rang
qu'elle demande (`data-formule` sur `<body>`), la session en porte un, et
`assets/session.js` compare.

**Ce tri décrit le produit, il ne le protège pas.** Il se fait dans le
navigateur : qui regarde la source voit tout, quelle que soit la formule. C'est
écrit sur chaque écran concerné.

L'écran de connexion est une **maquette** : il n'y a pas de serveur, donc aucun
identifiant n'est vérifié. Le champ du mot de passe n'est lu nulle part, n'est
transmis nulle part, et est vidé dès l'envoi — et la page le dit au-dessus du
champ, avant qu'on y tape quoi que ce soit.

## Mon entreprise, mes alertes

`app/reglages.html` porte deux volets. **Mon entreprise** — raison sociale,
code NAF, commune, effectif, contexte — recalcule le périmètre avec la même
règle et les mêmes données que le simulateur de l'accueil : un métier décrit
ici et décrit là-bas donne exactement le même plan. **Mes alertes** règle le
rythme d'envoi et ce qui déclenche un envoi, avec un aperçu du courriel rendu
dans la page.

**Rien de tout cela ne quitte le navigateur.** Il n'y a pas de serveur : les
saisies sont gardées sur l'appareil, ne sont transmises à personne, et
disparaissent si le visiteur vide les données du site. Aucun courriel ne part.
Les deux pages le disent au-dessus des formulaires, avant qu'on y tape quoi
que ce soit.

## Enregistrer une fiche en PDF

Pas de serveur pour fabriquer un PDF, et aucune bibliothèque chargée : c'est
l'impression du navigateur qui s'en charge, « Enregistrer au format PDF » dans
sa boîte d'impression. Le bouton pose `body.impression-fiche` et marque la
ligne ; la feuille d'impression ne garde que celle-là, avec un en-tête.

## L'application installable

Le site est une application web installable : `manifest.webmanifest` et `sw.js`
sont engendrés à la racine de `_site/` par `build.mjs`, les icônes PNG par
`outils/icones.mjs` depuis `assets/favicon.svg`.

Le service worker sert à deux choses : rendre l'installation possible (Chrome
ne la propose que si un worker avec un gestionnaire `fetch` est enregistré) et
garder le site consultable hors ligne. Les pages passent par le **réseau
d'abord** — une page de veille servie depuis un cache périmé afficherait des
obligations dépassées — et l'habillage par le **cache d'abord**.

**Pierrel & Co n'est ni sur l'App Store ni sur Google Play.** Il n'y a pas
d'application native, donc pas de badge de boutique à afficher : ce serait un
lien vers rien. La bande d'installation montre des pictogrammes d'appareils et
la consigne propre à chacun, et le dit en toutes lettres.

Le worker ne s'enregistre qu'en HTTPS ou sur `localhost`, et jamais dans un bac
à sable qui l'interdit : l'aperçu publié n'a donc pas le bouton « Installer »,
le site déployé l'a.

## Les deux thèmes

Clair et sombre, **au choix du visiteur** : auto (on suit le système), clair, ou
sombre. Le choix est gardé dans le navigateur et appliqué avant le premier
rendu, sinon la page clignote en clair avant de passer au sombre.

Les contrastes des deux thèmes sont mesurés dans Chromium, pas estimés à l'œil,
et tiennent le 4,5:1 sur tout texte visible. Deux jetons de filet coexistent,
un décoratif et un pour les contrôles, le critère non textuel de 3:1 ne visant
pas les séparations.

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
  une fois relue. 34 divisions sur 88 en portent, 90 pièges en tout, **tous en
  attente de relecture** : les pages le disent en toutes lettres.
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
