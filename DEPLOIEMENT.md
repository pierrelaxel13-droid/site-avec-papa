# Mise en ligne et activation de la collecte

Trois étapes. La première met le site en ligne ; les deux autres activent la
collecte automatique des textes du Journal officiel.

Ce dépôt ne contient que ce site, et il est public. Netlify le publie à chaque
envoi ; aucune configuration à refaire ensuite.

---

## 1. Publier le site sur Netlify

`node build.mjs` assemble dans `_site/` les seuls fichiers destinés aux
visiteurs : les trois pages, `assets/` et `data/`. Le collecteur, les
workflows, le jeu d'essai et la documentation restent dans le dépôt et ne
partent pas en ligne.

1. <https://app.netlify.com> → **Add new site** → **Import an existing
   project** → **GitHub**
2. Autoriser l'accès, choisir `pierrelaxel13-droid/site-avec-papa`
3. **Branch to deploy** : `main`
4. Build command : `node build.mjs` — Publish directory : `_site`
   (déjà renseignés par `netlify.toml`, il n'y a qu'à vérifier)
5. **Deploy**

L'adresse sera de la forme `https://<nom-du-site>.netlify.app`, renommable
dans *Site configuration → Change site name*.

**Cloudflare Pages** fonctionne pareil, avec les mêmes réglages.

### Brancher un nom de domaine

*Domain management → Add a domain*, puis chez votre registrar l'enregistrement
que Netlify indique. Le certificat HTTPS est émis automatiquement.

---

## 2. Créer les identifiants de l'API Légifrance

La collecte interroge l'API Légifrance, exposée via la plateforme **PISTE**.
L'accès est gratuit, mais l'inscription est nominative.

1. Créez un compte sur <https://piste.gouv.fr>.
2. Souscrivez à l'**API Légifrance** (DILA).
3. Créez une application : vous obtenez un **client ID** et un **client
   secret**.
4. Dans le dépôt GitHub, **Settings → Secrets and variables → Actions →
   New repository secret**, créez :

   | Nom | Valeur |
   |---|---|
   | `PISTE_CLIENT_ID` | le client ID de l'application |
   | `PISTE_CLIENT_SECRET` | le client secret |

5. Optionnel, pendant les essais : dans l'onglet **Variables**, créez
   `PISTE_ENV` à `sandbox` pour taper sur l'environnement de test de PISTE.

Ces secrets restent dans GitHub. Netlify n'en a pas besoin : il ne fait que
publier le fil déjà collecté.

---

## 3. Lancer la première collecte

1. Onglet **Actions → Veille — collecte du Journal officiel → Run workflow**.
2. Le résumé d'exécution indique le statut, le nombre de textes inédits et si
   le fil a été modifié.
3. Si le fil change, `data/veille-feed.json` est commité, et ce commit
   déclenche une reconstruction Netlify : le site est à jour dans la minute.

Ensuite la collecte tourne toute seule **toutes les heures**, à la minute 17.

### La chaîne complète

```
Journal officiel
      ↓  (toutes les heures)
GitHub Actions : scripts/collecte-jo.mjs
      ↓  commit de data/veille-feed.json, seulement si le fil a changé
Netlify : node build.mjs → _site/
      ↓
site en ligne, étape « Veille en direct » à jour
```

### Si la première exécution échoue

Le script ne casse jamais la publication : il conserve le fil précédent et
inscrit le message d'erreur dans `data/veille-feed.json`, que l'outil affiche
en clair. Les logs indiquent laquelle des deux voies d'accès à l'API a échoué.

- **`Authentification PISTE refusée`** : secrets absents, mal copiés, ou
  application PISTE non abonnée à l'API Légifrance.
- **`Aucune voie d'accès n'a rendu de texte`** : l'authentification passe mais
  la forme des réponses ne correspond pas à ce qu'attend le script. Les logs
  affichent les clés réellement reçues, ce qui suffit pour ajuster
  `extraitDepuisLastNJo` ou `extraitDepuisSearch` dans
  `scripts/collecte-jo.mjs`.

---

## 4. Optionnel : notification vers une messagerie d'équipe

Créez le secret `ALERTE_WEBHOOK_URL` avec l'URL d'un webhook entrant (Slack,
Teams, Make, Zapier, ou tout service acceptant un POST JSON). À chaque
collecte apportant du nouveau, le script poste un résumé, prioritaires en
tête. Le corps envoyé contient `text`, `content`, `nombre`, `prioritaires` et
`textes`, ce qui couvre Slack et Teams sans adaptation.

---

## Modifier le site ensuite

Rien n'est figé par la mise en ligne. On modifie, on envoie :

```sh
git add -A
git commit -m "…"
git push
```

Netlify reconstruit tout seul en une minute environ. Pour vérifier avant
d'envoyer :

```sh
node build.mjs
npx http-server _site -p 8080
```

Le fil ne se lit qu'en HTTP : ouvrir les fichiers directement depuis le disque
(`file://`) affiche un message explicite à la place de la veille en direct,
c'est normal.

Pour rejouer la collecte sans réseau ni identifiants :

```sh
node scripts/collecte-jo.mjs --source=mock --dry-run
```

---

## À savoir

- **Minutes GitHub Actions.** Le dépôt étant public, les exécutions sont
  gratuites et illimitées : la collecte horaire ne coûte rien.
- **Workflows planifiés en sommeil.** GitHub désactive les tâches planifiées
  d'un dépôt sans activité pendant 60 jours. Les commits de la collecte
  comptent comme activité, mais si le fil ne bouge pas pendant deux mois, il
  faudra réactiver le workflow depuis l'onglet Actions.
- **Un dépôt, un site.** Ce dépôt ne contient que ce site : il n'y a pas de
  branche à choisir ni de risque de publier le mauvais projet.
- **GitHub Pages est possible aussi.** Le dépôt étant public, Pages
  fonctionnerait, au prix d'un workflow de publication à ajouter (le site
  passe par une étape de construction). Netlify est déjà prêt ici ; dites-le
  si vous préférez Pages, c'est une dizaine de lignes à écrire.

---

## Ce qu'il reste à faire à la main

- Le **formulaire de contact** de la page d'accueil n'envoie rien : il valide
  la saisie et affiche une confirmation. Netlify Forms le rendrait fonctionnel
  en ajoutant `netlify` à la balise `<form>` — à faire dire si vous le voulez.
- Les **mentions légales** contiennent des champs « à compléter » (SIRET,
  hébergeur). L'hébergeur devient Netlify une fois le site en ligne.
- Le **numéro de téléphone** et l'adresse e-mail de la page de contact sont
  des valeurs d'exemple.
