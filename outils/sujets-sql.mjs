/* ==========================================================================
   Les 44 domaines de veille du référentiel → la table public.sujets
   --------------------------------------------------------------------------
   Écrit sur la sortie standard le SQL qui met la table à jour (ajoute ou
   modifie ; ne supprime jamais : un domaine retiré du référentiel reste
   dans la base, parce que des entrées du registre peuvent le citer).

     node outils/sujets-sql.mjs | psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -1

   L'action « Base de données » le lance à chaque changement du référentiel.
   ========================================================================== */
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const contexte = { window: {} };
createContext(contexte);
runInContext(readFileSync(resolve(RACINE, "assets/referentiel.js"), "utf8"), contexte);
const V = contexte.window.VEILLE;

const texte = (v) => (v == null ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const lignes = Object.entries(V.domaines).map(([id, d]) =>
  `  (${texte(id)}, ${texte(d.nom)}, ${texte(d.famille)}, ${texte(d.frequence)}, ${texte(d.classement)}, ` +
  `${texte(JSON.stringify(d.actions || []))}::jsonb)`);
if (!lignes.length) throw new Error("Aucun domaine lu dans assets/referentiel.js.");

process.stdout.write(`-- ${lignes.length} domaines, depuis assets/referentiel.js
insert into public.sujets (id, nom, famille, frequence, classement, actions) values
${lignes.join(",\n")}
on conflict (id) do update set
  nom = excluded.nom, famille = excluded.famille, frequence = excluded.frequence,
  classement = excluded.classement, actions = excluded.actions, maj_le = now()
where (sujets.nom, sujets.famille, sujets.frequence, sujets.classement, sujets.actions)
  is distinct from (excluded.nom, excluded.famille, excluded.frequence, excluded.classement, excluded.actions);
`);
