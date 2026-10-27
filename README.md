# Pierrel & Co — veille réglementaire, secteur par secteur

**En ligne : https://pierrelaxel13-droid.github.io/site-avec-papa/**
GitHub Pages publie la branche `main` à chaque envoi et après chaque relève
(`.github/workflows/publie.yml`), environ deux minutes plus tard. L'ancienne
adresse Netlify (https://adorable-marigold-fd062f.netlify.app) est figée au
27 octobre 2026 : son quota gratuit de constructions était épuisé. Le nom de
domaine propre reste à brancher.

Site statique engendré, sans dépendance ni framework. La porte d'entrée est le
**secteur** : une page par division de la nomenclature NAF, avec ce qui s'y
applique, à quel rythme le revoir, et les pièges du métier.

## Deux zones

```sh
node build.mjs                      # engendre _site/ : 415 pages
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

### Les vrais comptes (Cloudflare)

GitHub Pages ne sert que des fichiers : il ne peut pas fermer l'application.
Sur **Cloudflare Pages** (`.github/workflows/cloudflare.yml`), `functions/`
tourne à côté des pages :

- `functions/app/_middleware.js` — la porte de `/app/` : sans session, vers la
  connexion ; formule trop basse, vers `compte/formule.html`. La formule est
  relue chez Stripe toutes les six heures.
- `functions/api/` — `connexion`, `deconnexion`, `moi`, `bienvenue` (créer son
  mot de passe après le paiement : Stripe renvoie sur
  `/compte/bienvenue.html?session={CHECKOUT_SESSION_ID}`).
- `serveur/compte.mjs` — mots de passe (PBKDF2), cookie signé, appels Stripe,
  stockage KV « COMPTES ». Ses formules sont vérifiées contre `FORMULES`.

La démonstration est copiée sous `/demo/`, ouverte à tous. Pour essayer tout
ça sur un poste, sans Cloudflare ni Stripe : `node outils/comptes-local.mjs`.

À faire une fois : un compte Cloudflare, puis trois secrets dans GitHub
(`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `STRIPE_SECRET` — clé
restreinte en lecture seule). Le détail est en tête de `cloudflare.yml`.

Pas encore fait : l'oubli de mot de passe (par courriel), et les données
propres à chaque client — l'espace montre encore l'entreprise de démonstration.

### Ouvrir l'abonnement payant

Remplir `contenu/paiement.js` avec les trois liens de paiement Stripe
(`https://buy.stripe.com/…`) et, si possible, le lien du portail client
(`https://billing.stripe.com/…`). Rien d'autre : la construction refuse tout
autre lien, et toute clé Stripe. Tant qu'un lien est vide, le bouton de la
formule ouvre un courriel. Le paiement ne verrouille pas encore l'application :
de vrais comptes restent à faire.

La grille, fixée le 27 octobre 2026 : **40, 55 et 80 € par mois, TTC**, sans
cadrage sur place (`FORMULES` dans build.mjs).

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

## Les nouveaux textes, et comment ils arrivent

Dans l'application, une cloche compare la date du dernier texte lu — gardée
dans le navigateur — aux dates du relevé, et montre ce qui est arrivé depuis.
Elle est sur tous les écrans, elle marche hors ligne et sans compte, et elle
est alimentée par `assets/avis-data.js`, deux kilo-octets engendrés depuis le
jeu d'essai.

**Elle ne peut pas envoyer de courriel, ni de notification système quand
l'application est fermée.** Les deux supposent un serveur qui pousse : un
service d'envoi pour le courriel, un serveur de push et une clé VAPID pour la
notification système. Le panneau le dit plutôt que de le laisser croire.

## Les trois formules

La formule choisie décide des écrans ouverts : **Textes** (40 €) donne le
relevé, les textes, les fiches de secteur et les réglages ; **Textes et suivi**
(55 €) y ajoute le plan, le tableau de bord et les alertes (la cloche, l'onglet
« Mes alertes » : `data-exige="suivi"`) ; **Veille complète** (80 €) ouvre le
registre. Les anciennes clés (cadrage, veille, preuves) restent reconnues. Une page déclare le rang
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

## Exercer le code qui dort

La plupart du temps, `contenu/veille-releve.json` n'existe pas : le site se
construit alors sans relevé officiel, et tout le code qui ne s'allume qu'avec
des textes relevés **n'est jamais exécuté**. C'est par là qu'une fonction
manquante est passée jusqu'en production — le premier passage de la relève
l'a trouvée, et a refusé de publier.

`outils/releve-exemple.json` a la forme exacte de ce qu'écrit
`outils/veille.mjs` : trois textes inventés, un rapport avec une source
muette. Le poser à la place du relevé et construire, c'est exercer ce
chemin-là sans réseau. L'action le fait à chaque passage, après la vraie
relève, puis remet ce qui avait été relevé.

**Ce fichier est un jeu d'essai et le dit dans sa première clé.** Il ne doit
jamais être publié comme s'il était officiel.

## À quelle fréquence la relève tourne

« Idéalement tout le temps, chaque seconde. » Ça ne servirait à rien : les
sources ne bougent pas à ce rythme-là.

| Source | Publie |
| --- | --- |
| Journal officiel | une fois par jour, au petit matin |
| Codes consolidés (base LEGI) | une fois par jour, reconstruits la nuit |
| Flux des autorités (CNIL, ANSES, INRS…) | quelques fois par jour |

Interroger chaque seconde, ce serait 86 400 requêtes par jour pour au mieux
une nouveauté — et un blocage assuré par les serveurs publics.

`.github/workflows/releve.yml` fait donc ceci :

- **toutes les heures** — les 25 sources d'actualité, qui sont des flux légers ;
- **une fois par jour, 7 h 42 à Paris** — les codes consolidés, juste après que
  la base LEGI a été reconstruite (12 Mo à télécharger : inutile d'y revenir
  toutes les heures).

**Le délai maximum entre la parution d'un texte et l'alerte est d'une heure**,
soit plus serré que le rythme des sources elles-mêmes. Quand la relève change
quelque chose, l'action le commite ; Netlify voit le commit et republie. Rien
à régler, aucune clé à poser. L'action construit le site avant de commiter :
elle refuse de livrer des données que `build.mjs` ne saurait pas rendre.

`outils/codes.mjs` ne tourne donc **plus** à la construction Netlify :
`contenu/codes.json` est suivi par git, et c'est en le comparant que le robot
sait ce qui a changé. Le régénérer à chaque construction sans le commiter
referait éternellement la même comparaison.

## Lesquels sont nouveaux

La page Textes et les fiches de secteur portent une colonne **« en vigueur
depuis »** : la date de la dernière évolution du texte, pour ceux dont nous
publions le contenu consolidé. Ce qui a bougé à la dernière relève porte la
marque **Nouveau**. Pour les autres, nous n'avons pas la date, et la page le
dit — elle ne l'invente pas.

## « Mon plan » suit « Mon entreprise »

Le plan de veille était figé sur le jeu d'essai : on changeait d'entreprise
dans Réglages, et les mêmes domaines restaient. La page porte maintenant les
**44 domaines**, ceux hors périmètre posés `hidden` à la construction ; au
chargement, `suivrePlan()` lit les réglages enregistrés, recalcule le
périmètre avec `window.PLAN` et ne garde que ce qui s'applique. Les compteurs,
le contexte retenu, le bandeau d'en-tête et le chapeau suivent. Sans
JavaScript, la page affiche le périmètre du jeu d'essai — rien ne manque, et
la page dit ce qu'elle montre.

## On clique la case, pas le mot

Partout où une ligne ou une carte mène quelque part, c'est **toute la case**
qui est cliquable, par une nappe `.lien-carte` posée dessus ; les liens
qu'elle contient repassent devant en `z-index: 1`. Vaut pour les lignes du
tableau des textes, les lignes des tableaux de catégories, et les cartes de
conseils du tableau de bord.

## Quatre familles, et ce qu'il faut faire

Un texte qui paraît ne vaut rien tant qu'on ne sait pas de quoi il relève ni ce
qu'il demande. Chacun des 44 domaines porte donc deux choses de plus :

- un **classement** parmi cinq — santé & sécurité, hygiène, social,
  environnement, métier & gestion. Le relevé s'ouvre sur un tableau qui range
  les textes dans ces familles, dit combien il y en a, lequel est le plus
  récent, et **ce qu'il faut faire en premier** ; les listes dessous donnent le
  détail, famille par famille.
- des **actions** : trois ou quatre gestes concrets à faire quand le texte
  bouge — mettre à jour le DUERP, reprendre le plan de maîtrise sanitaire,
  prévenir la paie. Elles s'affichent dans le détail de chaque ligne du relevé
  et sur la fiche du texte.

Ces actions sont un **premier jet**, comme les 90 pièges : à relire par Clément
Pierrel. Elles vivent dans `assets/referentiel.js`, au même endroit que les
obligations du domaine.

## Le lien du texte, pas celui du site

« Voir la source » renvoyait sur l'accueil de Légifrance ou de l'INRS, au client
de se débrouiller. `lienDuTexte()` vise maintenant le texte lui-même, dans cet
ordre :

1. **un code français** — son identifiant `LEGITEXT` vient de l'annuaire des
   73 codes en vigueur que relève `outils/codes.mjs` dans la base LEGI, d'où
   `legifrance.gouv.fr/codes/texte_lc/LEGITEXT000006072050` ;
2. **un texte européen** — son numéro CELEX se déduit de sa référence :
   « Règlement (UE) 2016/679 » donne `32016R0679`, d'où le lien EUR-Lex ;
3. **le reste** — une recherche à son nom sur Légifrance, et la page le dit :
   « chercher ce texte », pas « voir le texte ».

`contenu/liens.js` passe avant tout le reste : c'est le seul endroit où un
humain tranche, référence par référence. Une ligne y donne soit le code où le
texte est codifié (`{ code: "Code du travail" }`, dont l'adresse est
reconstruite depuis l'annuaire LEGI, jamais écrite à la main), soit l'adresse
de l'autorité qui le publie (`{ url: "https://boss.gouv.fr" }`). **75 des 124
fiches mènent au texte lui-même**, les 49 autres au recueil officiel qui le
publie — conventions collectives, AIDA pour les ICPE, EUR-Lex.

**Le mot « chercher » a disparu du site.** Renvoyer le client vers une
recherche, c'est lui rendre le travail qu'il nous paie à faire. `build.mjs`
refuse de construire si une référence n'a aucune destination : `verifieLiens()`
la nomme et s'arrête.

## Le texte officiel, sur le site

Le client ne doit pas avoir à partir pour lire la loi. `outils/codes.mjs` va
chercher les **codes consolidés**, en découpe les morceaux déclarés dans
`contenu/perimetres.js`, et écrit `contenu/codes.json`, que `build.mjs` publie
en **193 pages de texte intégral — 4 718 articles**.

```sh
node outils/codes.mjs                # relève, compare, écrit
node outils/codes.mjs --sans-reseau  # réutilise le paquet déjà extrait
node build.mjs
```

**D'où vient le texte.** De la base LEGI, la base officielle des codes et lois
consolidés, dans l'extraction quotidienne publiée par la Fabrique numérique des
ministères sociaux (`@socialgouv/legi-data` sur le registre npm), qui interroge
l'API Légifrance. Licence ouverte : republier est permis, à condition de citer
la source et la version — chaque page le fait, et renvoie sur Légifrance pour
la version qui fait foi. Pas de compte, pas de clé, et le registre npm répond
partout, y compris d'ici : c'est la seule source de texte intégral joignable
depuis l'environnement de développement.

**Trois codes aujourd'hui** — travail, sécurité sociale, rural et pêche
maritime — parce que l'extraction n'en couvre pas d'autres. Les 111 autres
fiches gardent leur lien vers la source et **le disent en toutes lettres** au
lieu de laisser croire que le texte manque.

**Ce que ça change, exactement.** `contenu/codes.json` est suivi par git. À
chaque passage, le robot compare article par article avec la relève précédente
et écrit ce qui a bougé : article nouveau, texte modifié — avec l'avant et
l'après, mot à mot — ou article sorti du périmètre. C'est de là que viennent le
bloc « ce qui a changé » du relevé, celui de la fiche concernée, et l'alerte de
la cloche. Rien n'est deviné : c'est la différence entre deux relevés.

**Ajouter un périmètre.** Une ligne dans `contenu/perimetres.js` : la référence
exacte du référentiel, l'identifiant du code, et un motif qui désigne le
morceau dans l'arbre (les titres joints par `/`). Si le motif ne tombe sur
rien, l'outil s'arrête et le dit : `contenu/codes.json` n'est pas touché.

## Aller chercher ce qui paraît

`outils/veille.mjs` relève **25 sources officielles** déclarées dans
`contenu/sources.js`, et écrit `contenu/veille-releve.json`, que `build.mjs`
publie dans l'application avec **le contenu dans la page**.

```sh
node outils/veille.mjs --verifier   # interroge chaque source, n'écrit rien
node outils/veille.mjs --jours 30
node outils/veille.mjs --source cnil
node build.mjs
```

Deux méthodes de relève. **`dila`** : les archives ouvertes de la DILA pour le
Journal officiel — sans compte ni clé, un XML par texte, contenu intégral.
**`rss`** : un flux, pour les autorités qui en publient (CNIL, CERT-FR, INRS,
ANSES, ADEME, URSSAF, DGCCRF, ARCEP…).

Deux genres, que l'application sépare et nomme : un **texte** est du droit ;
une **publication** est un commentaire officiel — guide, avis, doctrine,
alerte. Cela compte pour la veille, mais ce n'est pas la loi.

**Où ça tourne.** Pas chez Netlify. Netlify ne fait qu'une chose,
`node build.mjs` : il construit ce qui est commité, rien de plus. La relève
tourne dans `.github/workflows/releve.yml`, qui commite ce qu'il a trouvé ;
Netlify voit le commit et republie. C'est voulu — ce que le site affiche est
exactement ce que git contient, donc relisible et reproductible. (L'ancienne
note décrivait une relève à la construction : elle n'a plus lieu d'être.)
L'environnement de développement, lui, a une politique réseau qui refuse les
hôtes officiels : la relève n'y tourne pas non plus.

**Ce que le robot ne fait jamais.** Inventer. Une source injoignable est
signalée par son nom et son code d'erreur, dans le fichier et sur la page. Un
flux au format inattendu remonte « 0 entrée ». Et si la relève entière ne
ramène rien, rien n'est écrit : l'application continue d'afficher « aucune
relève » et son jeu d'essai, nommé comme tel.

**Les adresses ont été vérifiées le 23 octobre 2026, puis cherchées le 25**,
depuis une machine qui joint ces hôtes. Le 23, seules 6 répondaient. Le 25,
la recherche de flux (`node outils/veille.mjs --decouvrir`) a demandé à chaque
site muet où est son flux : les liens que ses pages déclarent, les pistes de sa
documentation, les chemins courants. Bilan dans `contenu/sources-decouverte.txt` :

| | |
| --- | --- |
| **19 répondent** | Journal officiel, EUR-Lex série L, ministère du Travail, OPPBTP, BOFiP, CNIL, CERT-FR avis et alertes, Transition écologique, Ineris-AIDA, ADEME (nouvelles publications), RappelConso, DGCCRF, ANSES, Entreprendre, AMF, ARCEP, HAS, Douane |
| BOSS, URSSAF | ferment la porte aux machines de GitHub (délai dépassé, connexion coupée) |
| ACPR | répond 403 et ne déclare aucun flux |
| INRS, BOAMP | n'ont pas de flux RSS |
| ANSM | son flux répond mais reste vide (vingt relèves de suite, le 26 octobre) |

Celles qui répondent portent `confirme: true`. **Les autres gardent
`confirme: false` et une note datée disant ce qu'elles ont répondu** — on ne
leur invente pas une adresse de remplacement. Le site annonce le nombre de
sources qui répondent, pas le nombre de sources déclarées.

Deux cas méritaient un réglage, pas un contournement :

- **La HAS** envoie son certificat sans l'intermédiaire qui le relie à une
  autorité reconnue. La relève va le chercher à l'adresse que le certificat
  indique, et ne le garde que s'il se vérifie contre les autorités racines du
  système. La vérification n'est jamais coupée.
- **RappelConso** a fermé son flux le 23 octobre. Les mêmes fiches sont lues
  dans les données ouvertes de Bercy (type `ods` dans `contenu/sources.js`),
  avec le lien vers chaque fiche officielle.
- **Le BOFiP** ne date pas ses entrées. La relève leur donne le jour où elle
  les voit pour la première fois, et le garde d'une relève à l'autre.

Le robot se présente sous son nom et ne se déguise pas en navigateur : un site
qui le refuse est noté comme tel. Pour relancer : l'onglet Actions, « Relève »,
« Run workflow » — la vérification et la recherche ne tournent qu'à la demande.

## Les textes, sur le site

`contenu/textes.js` porte **une fiche par référence citée** : 124 fiches,
clés sur la référence exacte écrite dans le référentiel. `build.mjs` engendre
`app/texte/<référence>.html` pour chacune, plus l'index `app/textes.html`.

Une fiche dit, en français courant : **à qui ça s'applique**, **ce que le texte
exige** point par point, **où il s'applique** (domaines et secteurs), et où lire
l'officiel. Elle s'imprime en PDF. On lit tout sans quitter le site.

**Elle ne reproduit pas le texte officiel.** Le texte intégral et à jour est sur
Légifrance : lui seul fait foi, et une copie hébergée ici se périmerait en
silence. Héberger le texte verbatim serait permis — le droit français est sous
licence ouverte — mais suppose d'aller le chercher chaque jour, donc un compte
PISTE pour l'API Légifrance et un serveur qui tourne. Ce n'est pas en place.

Toutes les fiches sont en `valide: false` : les pages le disent. `build.mjs`
refuse de construire si une référence n'a pas de fiche, si une fiche ne
correspond à aucune référence, ou si deux références produisent la même adresse.

## L'index des secteurs

`app/secteurs.html` montre les 88 divisions en grille de cartes, groupées par
section et cherchables. Essayé en bulles dimensionnées par le nombre de
domaines : ce n'était pas beau et ça se lisait mal.

La fiche d'un secteur ouvre sur **la liste à plat de ses textes de référence**,
chacun menant à sa fiche sur le site.

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
