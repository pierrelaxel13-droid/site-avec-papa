# La base de données de Vigie (Supabase)

Projet Supabase : `denpxyqbvjcwsbxjtqpd` — https://denpxyqbvjcwsbxjtqpd.supabase.co
Les choix sont expliqués dans `docs/lot5-base-de-donnees.md`.

## Ce qu'il y a ici

| Fichier | Rôle |
|---|---|
| `migrations/*.sql` | le schéma, en étapes datées, appliquées une fois chacune, dans l'ordre |
| `tests/isolation.sql` | les vérifications d'isolation : chacun voit et fait ce qu'il doit, et rien d'autre ; le registre ne se modifie jamais |
| `tests/emulation-supabase.sql` | imite Supabase sur un PostgreSQL vide, **pour les tests seulement** |

L'action **« Base de données »** (`.github/workflows/base.yml`) teste puis
applique, toute seule, à chaque envoi qui touche ce dossier.

## Changer le schéma

1. **Ne jamais modifier une migration déjà appliquée.** Ajouter un fichier
   `migrations/AAAAMMJJHHMMSS_ce_qui_change.sql`.
2. Pour toute **nouvelle table** :
   - `alter table … enable row level security;` dans le même fichier ;
   - ses règles (`create policy …`) ;
   - `revoke all on … from anon, authenticated;` puis les seuls `grant`
     nécessaires — Supabase accorde tout par défaut aux nouvelles tables.
3. Ajouter à `tests/isolation.sql` les vérifications de la nouvelle table.
4. Envoyer : l'action rejoue tout sur une base vide, et n'applique à Supabase
   que si les tests passent.

## Les clés

- **Clé publique** (`sb_publishable_…`) et adresse du projet : dans le site.
- **Clé secrète** et **adresse de la base** (mot de passe compris) : uniquement
  dans les secrets GitHub (`SUPABASE_SECRET_KEY`, `SUPABASE_DB_URL`). Jamais
  dans un fichier du dépôt — il est public.

## Ce que l'immuabilité garantit, et ce qu'elle ne garantit pas

- Le navigateur ne peut qu'**ajouter** au registre (pas de droit de
  modification, pas de règle, et un déclencheur en plus).
- La **clé secrète** non plus ne peut ni modifier ni effacer une entrée : le
  déclencheur l'en empêche.
- Le **propriétaire de la base** (le mot de passe de la base) pourrait, en le
  faisant exprès, désactiver le déclencheur. C'est pour ça qu'il y a la
  **chaîne d'empreintes** : toute entrée falsifiée la casse, et
  `verifier_registre()` le montre. Les tests le vérifient.

## Les réglages à faire une fois dans Supabase

**Authentication → URL Configuration** — sinon les liens des courriels
mènent à une adresse d'essai (localhost) :
- *Site URL* : `https://pierrelaxel13-droid.github.io/site-avec-papa/compte/`
- *Redirect URLs* : ajouter `https://pierrelaxel13-droid.github.io/site-avec-papa/**`

Le jour du nom de domaine, ajouter aussi son adresse.

## Poser un abonnement d'essai (en attendant Stripe)

Dans **SQL Editor**, une fois le compte créé et l'entreprise nommée :

```sql
insert into public.abonnements (entreprise_id, formule, periode, statut)
select id, 'complet', 'an', 'active' from public.entreprises
where denomination = 'Le nom exact de l''entreprise';
```

`formule` : `textes`, `suivi` ou `complet`. Pour le retirer :
`delete from public.abonnements where entreprise_id = (…)`.
