# Mise en ligne

Le site est statique et sans dépendance : il n'y a ni base de données, ni
serveur applicatif, ni identifiants à obtenir. La publication tient en une
opération, à faire une fois.

---

## 1. Publier sur Netlify

`node build.mjs` assemble dans `_site/` les seuls fichiers destinés aux
visiteurs : les deux pages et `assets/`. La documentation et les skills restent
dans le dépôt et ne partent pas en ligne.

1. <https://app.netlify.com> → **Add new site** → **Import an existing
   project** → **GitHub**
2. Autoriser l'accès, choisir `pierrelaxel13-droid/site-avec-papa`
3. **Branch to deploy** : `main`
4. Build command : `node build.mjs` — Publish directory : `_site`
   (déjà renseignés par `netlify.toml`, il n'y a qu'à vérifier)
5. **Deploy**

L'adresse sera de la forme `https://<nom-du-site>.netlify.app`, renommable dans
*Site configuration → Change site name*.

**Cloudflare Pages** fonctionne pareil, avec les mêmes réglages.

### Brancher un nom de domaine

*Domain management → Add a domain*, puis chez le registrar l'enregistrement que
Netlify indique. Le certificat HTTPS est émis automatiquement.

---

## 2. Modifier le site ensuite

```sh
node build.mjs                      # doit passer avant d'envoyer
python3 -m http.server -d _site 8080  # pour regarder le rendu
git add -A
git commit -m "…"
git push
```

Netlify reconstruit tout seul en une minute environ. Si `node build.mjs` échoue
chez vous, il échouera chez Netlify : la construction refuse un référentiel
incohérent, et c'est volontaire.

---

## Ce qu'il reste à compléter

Trois valeurs sont des exemples et doivent être remplacées avant d'annoncer le
site :

| Où | Quoi |
|---|---|
| `index.html`, section contact | Le courriel `contact@pierrel-co.fr` et le téléphone `04 00 00 00 00` |
| `index.html` et `plan-de-veille.html`, pied de page | Le SIRET et l'hébergeur (« à compléter ») |

L'hébergeur devient Netlify une fois le site en ligne ; son adresse postale est
indiquée dans la documentation Netlify.

---

## À savoir

- **Aucune requête externe.** Les polices sont servies par le site lui-même.
  C'est volontaire : charger une police depuis Google transmettrait l'adresse IP
  de chaque visiteur à un tiers, ce que le pied de page promet de ne pas faire.
  Ne pas réintroduire de `<link>` vers `fonts.googleapis.com`.
- **Pas de formulaire.** Le contact se fait par courriel et par téléphone, pas
  par un formulaire qui n'enverrait rien. Si vous en voulez un, Netlify Forms le
  rend fonctionnel en quelques lignes — à demander.
- **Aucune tâche planifiée.** Le site ne collecte rien automatiquement : il n'y
  a pas de workflow GitHub Actions à surveiller, ni de secret à renouveler.
- **Un dépôt, un site.** Il n'y a pas de branche à choisir ni de risque de
  publier le mauvais projet.
