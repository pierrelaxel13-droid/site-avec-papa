---
name: veille-reglementaire
description: "Collecte des textes du Journal officiel et référentiel de veille de ce dépôt. À utiliser pour toute demande touchant scripts/collecte-jo.mjs, data/veille-feed.json, le workflow .github/workflows/veille.yml, les identifiants PISTE / API Légifrance, le fil de la « veille en direct », ou le référentiel assets/veille-data.js (ajouter ou modifier un domaine de veille, un rattachement NAF, un mot-clé de collecte, un déclencheur). Déclencheurs typiques : « relancer la collecte », « le fil est vide / périmé », « la collecte est en échec », « ajouter un domaine », « élargir les mots-clés », « pourquoi ce texte n'est pas remonté », « rattacher la division 43 »."
---

# Veille réglementaire : collecte et référentiel

## La chaîne, en une phrase

`.github/workflows/veille.yml` (toutes les heures, minute 17) lance
`scripts/collecte-jo.mjs`, qui interroge l'API Légifrance, rattache les textes
parus aux 44 domaines de `assets/veille-data.js` par mots-clés, écrit
`data/veille-feed.json`, et ne commite que si le contenu utile a changé.
`outil-veille.html` lit ce fichier par `fetch` à l'étape 4 « Veille en direct ».

Tout est en Node pur, sans dépendance : il n'y a jamais de `npm install` à faire.

## Relancer ou tester la collecte

```sh
# Jeu d'essai local : ni réseau ni identifiants. À faire en premier, toujours.
node scripts/collecte-jo.mjs --source=mock --dry-run

# Vrai appel Légifrance, sans rien écrire (exige les identifiants PISTE)
node scripts/collecte-jo.mjs --jours=7 --dry-run

# Vrai appel, écrit data/veille-feed.json
node scripts/collecte-jo.mjs --jours=3
```

Options : `--source=legifrance|mock`, `--jours=N` (fenêtre, défaut 3, minimum 1),
`--sortie=chemin`, `--dry-run`, `--help`.

Pour écrire ailleurs que dans le dépôt pendant un essai :
`--sortie=/tmp/essai-feed.json`.

## Identifiants

| Nom | Où | Rôle |
|---|---|---|
| `PISTE_CLIENT_ID` | secret du dépôt | OAuth client credentials PISTE |
| `PISTE_CLIENT_SECRET` | secret du dépôt | idem |
| `PISTE_ENV` | variable du dépôt | `sandbox` ou vide (= production) |
| `ALERTE_WEBHOOK_URL` | secret du dépôt | résumé posté vers Slack/Teams, optionnel |

Sans `PISTE_CLIENT_ID` / `PISTE_CLIENT_SECRET`, le script sort **en 0** avec un
fil de statut `echec` : c'est voulu, la publication du site ne doit jamais casser
à cause de la collecte. La procédure de création des identifiants est dans
`DEPLOIEMENT.md`, section 2. Ne jamais écrire une valeur d'identifiant dans un
fichier du dépôt ni dans un message de commit.

## Format de data/veille-feed.json

```json
{
  "genere": "ISO 8601", "source": "legifrance|mock", "fenetreJours": 3,
  "statut": "ok|echec", "erreur": "message ou null",
  "derniereReussite": "ISO ou null",
  "nombreTextes": 0, "nombreInedits": 0,
  "textes": []
}
```

Chaque texte porte titre, date de publication, nature déduite du titre
(`deduitNature`), domaines rattachés et date de première détection. La fusion
(`fusionne`) conserve cette date de première détection, garde **120 jours** et
**400 textes** au maximum.

Lire le statut avant de conclure quoi que ce soit sur le fil :

```sh
node -e 'const f=require("./data/veille-feed.json");console.log(f.statut,f.erreur||"",f.nombreTextes,f.genere)'
```

## Le fil est vide ou périmé : dans quel ordre chercher

1. `statut: "echec"` → lire `erreur`. Identifiants absents ou expirés, ou API
   Légifrance indisponible. Rien à corriger dans le code.
2. `statut: "ok"` mais peu de textes → c'est le rattachement par mots-clés qui
   écarte. Un texte sans aucun mot-clé correspondant est volontairement rejeté
   (`rattache`). Élargir `motsCles`, voir plus bas.
3. Fil correct mais l'outil n'affiche rien → le `fetch` échoue. En `file://`
   c'est normal et un message explicite s'affiche ; il faut servir en HTTP
   (`npx http-server _site -p 8080`).
4. Le workflow ne tourne plus → GitHub met en sommeil les tâches planifiées
   après 60 jours sans activité du dépôt ; réactiver depuis l'onglet Actions.
   Les tâches planifiées ne s'exécutent que depuis la branche par défaut.

Le workflow expose `modifie`, `inedits` et `statut` en sorties d'étape, et ne
commite `data/veille-feed.json` que si `modifie == 'true'` — sinon la tâche
produirait un commit par heure.

## Référentiel assets/veille-data.js

Un seul fichier, autonome, lu par les deux pages et par le collecteur. Clés
exportées : `sections`, `divisions` (88), `familles` (8), `domaines` (44),
`motsCles`, `transversaux`, `parDivision`, `declencheurs` (22), `etapes`,
`frequences`, plus les fonctions `rechercher`, `perimetre`, `division`.

**Ajouter un domaine** — une entrée dans `domaines`, puis le rattacher :

```js
mon_domaine: {
  nom: "…", famille: "sst", frequence: "hebdomadaire",
  resume: "…",
  textes: ["…"], obligations: ["…"], impacts: ["juridique", "operationnel"],
  sources: [{ nom: "…", url: "https://…" }]
}
```

- `famille` doit exister dans `familles` (`social`, `sst`, `env`, `tech`,
  `sect`, `fisc`, `num`, `juri`).
- `frequence` doit exister dans `frequences`.
- Puis référencer l'identifiant dans `parDivision["43"]` (rattachement
  sectoriel, au niveau **division** = deux premiers chiffres du code NAF)
  et/ou dans un `declencheurs[].domaines` (caractéristique d'activité).
- Un domaine absent de `parDivision` et de `declencheurs` n'apparaîtra dans
  aucun périmètre.

**Élargir la collecte d'un domaine** — une entrée dans `motsCles`. Les mots-clés
sont comparés au **titre** du texte, accents et casse retirés (`normalise`).
Préférer des expressions précises (« appareils de levage ») aux mots isolés
(« levage »), qui ramènent du bruit dans le fil de tout le monde.

**Nomenclature NAF** — `sections` et `divisions` suivent la NAF au niveau
division ; les libellés officiels sont publiés par l'INSEE.

## Vérifier avant de committer

```sh
node scripts/collecte-jo.mjs --source=mock --dry-run   # la chaîne tourne
node build.mjs                                          # garde-fou référentiel
```

`build.mjs` charge `assets/veille-data.js` et **interrompt la construction** si
le référentiel compte moins de 40 domaines ou un nombre de divisions différent
de 88. Une erreur ici signifie une virgule ou une accolade manquante dans le
référentiel : la publication Netlify échouerait de la même manière.

## Réserves à ne pas retirer

L'outil fournit un cadre méthodologique, pas un conseil juridique. Les réserves
affichées dans l'interface et dans la synthèse imprimée (vérification de chaque
texte sur Légifrance, validation par une personne compétente, non-exhaustivité)
font partie de la prestation : ne pas les supprimer ni les adoucir.
