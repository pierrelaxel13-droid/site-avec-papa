---
name: veille-reglementaire
description: "Le référentiel de veille de ce dépôt, dans assets/referentiel.js : les 26 domaines de veille, les 15 familles de métiers, les 11 questions de contexte, les fréquences de revue, la méthode et les sources officielles. À utiliser pour toute demande de contenu réglementaire — ajouter ou modifier un domaine, rattacher un métier, ajouter une question, changer un rythme de revue, corriger des obligations ou des textes de référence — et pour comprendre pourquoi un domaine apparaît ou non dans un plan. Déclencheurs typiques : « ajoute un domaine », « il manque les ICPE pour ce métier », « pourquoi ce domaine ne sort pas », « change la fréquence », « ajoute le métier X », « corrige les obligations de la partie amiante »."
---

# Le référentiel de veille

## Où ça vit

Un seul fichier : `assets/referentiel.js`. Autonome, sans dépendance, chargé tel
quel par `index.html` (la méthode et le tableau des sources) et par
`plan-de-veille.html` (tout l'outil). Il n'y a pas de base de données, pas d'API,
pas de collecte automatique : le contenu réglementaire est écrit à la main dans
ce fichier, et c'est la seule source de vérité.

Il expose `window.REFERENTIEL` avec : `frequences`, `domaines`, `socle`,
`metiers`, `questions`, `etapes`, `sourcesGenerales`, et les fonctions
`metier()`, `question()`, `plan()`.

## Comment un plan se construit

`plan(metierId, reponses)` empile trois apports, dans cet ordre :

1. **le socle** (`socle`) — s'applique à toute entreprise, sans condition ;
2. **le métier** choisi — ses `domaines` sectoriels ;
3. **chaque réponse** cochée — les `domaines` de la question.

Un domaine amené par plusieurs voies n'apparaît qu'une fois, mais **conserve
toutes ses raisons** : c'est ce que montrent les pastilles sous chaque domaine
déplié, et c'est ce qui rend le plan discutable avec le client. Ne pas casser ce
mécanisme en dédoublonnant les raisons.

Le résultat est regroupé par fréquence, dans l'ordre de `frequences`.

## Ajouter un domaine

```js
mon_domaine: {
  nom: "…",
  frequence: "trimestrielle",        // doit exister dans frequences
  resume: "Une phrase, lisible par un dirigeant.",
  textes: ["…"],                      // les textes de référence
  obligations: ["…"],                 // ce qu'il faut tenir, concrètement
  sources: [{ nom: "…", url: "https://…" }]
}
```

**Puis le rattacher, sinon il n'existe pour personne.** Trois possibilités :
`socle` (toute entreprise), `metiers[].domaines` (sectoriel), ou
`questions[].domaines` (déclenché par le contexte). Un domaine que rien n'amène
fait apparaître un avertissement à la construction, pas une erreur : il faut le
lire.

## Ajouter un métier ou une question

- **Métier** : `{ id, nom, naf, exemples, domaines: [...] }`. Le champ `naf` est
  un repère affiché en petit (« divisions 41 à 43 »), pas une clé de calcul :
  l'outil ne fait aucune recherche par code NAF, c'est délibéré — personne ne
  connaît son code de tête, et une nomenclature recopiée de mémoire serait
  fausse.
- **Question** : `{ id, q, d, domaines: [...] }`. Une bonne question se répond
  par oui ou non sans aller chercher un document, et amène au moins un domaine
  que le métier seul ne donne pas. Sinon elle alourdit le parcours pour rien.

## Comment écrire le contenu

Le lecteur est un chef d'entreprise, pas un juriste.

- `resume` : une phrase, ce que le domaine recouvre et pourquoi il mord.
- `obligations` : des choses **vérifiables**, formulées comme un contrôleur les
  demanderait (« Document unique rédigé, daté et mis à jour », pas « respecter
  l'obligation de sécurité »).
- `textes` : le nom du texte en clair plutôt que sa référence brute. « Code du
  travail, quatrième partie » plutôt qu'un numéro d'article qui bougera.
- `sources` : deux ou trois liens officiels, jamais d'agrégateur payant.
- **Pas de dates ni de seuils qui bougent** quand on peut l'éviter : préférer
  « vérifier l'échéance applicable à votre taille d'entreprise » à une date qui
  sera fausse dans six mois et que personne ne viendra corriger.

## Vérifier

```sh
node build.mjs
```

La construction échoue si un domaine cité n'existe pas, si une fréquence est
inconnue, s'il reste moins de 20 domaines, moins de 10 métiers ou moins de 6
questions, ou si le plan d'essai ne produit presque rien. Elle avertit — sans
échouer — sur les domaines inatteignables.

Pour inspecter un plan sans navigateur :

```sh
node -e 'globalThis.window={};new Function(require("fs").readFileSync("assets/referentiel.js","utf8"))();
const p=window.REFERENTIEL.plan("btp",["salaries","public"]);
console.log(p.nombre);p.groupes.forEach(g=>console.log(g.frequence.l,"—",g.entrees.map(e=>e.domaine.nom).join(" · ")));'
```

## Réserves à ne pas retirer

Les mentions rappelant que l'outil fournit un cadre méthodologique et non un
conseil juridique, qu'il ne garantit pas l'exhaustivité, et que chaque texte doit
être vérifié sur Légifrance — sur les deux pages et sur la feuille imprimée —
font partie de la prestation. Ne pas les supprimer ni les adoucir.
