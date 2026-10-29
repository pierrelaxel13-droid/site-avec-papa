/* ==========================================================================
   Le journal du robot : une ligne dans public.collectes à chaque passage
   --------------------------------------------------------------------------
   Lancé par l'action « Relève », en dernier, même si le passage a échoué.
   Il lit le bilan laissé par outils/veille.mjs (releve-bilan.json) et
   l'inscrit dans la base : début, fin, statut (reussie / alerte / echouee),
   sources interrogées, textes retenus, alertes, et le détail par source.

   Puis il regarde les 24 derniers passages : une source vérifiée muette à
   chacun d'eux (une journée) devient une alerte grave.

   Les alertes graves font échouer l'action — ce qui envoie un courriel —
   mais seulement au passage du matin (QUOTIDIEN=oui) : un courriel par jour
   au plus, tant que le problème dure. Aux autres passages, elles restent des
   avertissements dans le journal.

   Variables : SUPABASE_DB_URL, DEBUT (heure de début), QUOTIDIEN (oui/non),
   ETAT_DU_PASSAGE (success/failure), CODES_LOG (journal des codes, facultatif).
   ========================================================================== */
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const BASE = process.env.SUPABASE_DB_URL || "";
const QUOTIDIEN = process.env.QUOTIDIEN === "oui";
const echappe = (x) => String(x).replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");

let bilan;
try {
  bilan = JSON.parse(readFileSync(process.env.BILAN || "releve-bilan.json", "utf8"));
} catch {
  bilan = { statut: "echouee", examines: 0, retenus: 0, nouveaux: 0, rapport: [],
    alertes: [{ niveau: "grave", type: "arret", source: "", quoi: "Le robot n'a laissé aucun bilan : il s'est arrêté avant la fin." }] };
}
if (process.env.ETAT_DU_PASSAGE === "failure" && bilan.statut !== "echouee") {
  bilan.statut = "echouee";
  bilan.alertes.push({ niveau: "grave", type: "construction", source: "",
    quoi: "Le passage a échoué après la relève (voir l'action) : rien n'a été publié." });
}
let codes = null;
if (process.env.CODES_LOG && existsSync(process.env.CODES_LOG)) {
  const l = readFileSync(process.env.CODES_LOG, "utf8").trim().split("\n");
  codes = l[l.length - 1].slice(0, 300);
}

const ligne = {
  debut: process.env.DEBUT || new Date().toISOString(),
  statut: bilan.statut,
  examines: bilan.examines || 0,
  retenus: bilan.retenus || 0,
  alertes: bilan.alertes || [],
  details: {
    nouveaux: bilan.nouveaux || 0,
    jo_dernier: bilan.joDernier || null,
    sources: (bilan.rapport || []).map((r) => ({ id: r.id, nom: r.nom, entrees: r.entrees, retenus: r.retenus, souci: r.souci || null, repris: r.repris || 0 })),
    codes,
    passage: process.env.GITHUB_RUN_ID
      ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : null
  }
};

const graves = ligne.alertes.filter((a) => a.niveau === "grave").map((a) => a.quoi);

if (!BASE) {
  console.log("::notice::Pas de SUPABASE_DB_URL : le passage n'est pas inscrit au journal.");
} else {
  const sql = (q) => execFileSync("psql", [BASE, "-qtA", "-v", "ON_ERROR_STOP=1", "-v", "j=" + JSON.stringify(ligne)],
    { input: q + ";\n" }).toString().trim();
  try {
    sql(`insert into public.collectes (debut, fin, statut, examines, retenus, erreurs, details)
      select (j->>'debut')::timestamptz, now(), j->>'statut', (j->>'examines')::int, (j->>'retenus')::int, j->'alertes', j->'details'
      from (select :'j'::jsonb as j) x`);
    // Une source vérifiée muette aux 24 derniers passages : une journée sans elle.
    const longues = sql(`with derniers as (select erreurs from public.collectes order by id desc limit 24)
      select a->>'source' from derniers, jsonb_array_elements(erreurs) a
      where a->>'type' = 'muette' and (select count(*) from derniers) = 24
      group by 1 having count(*) = 24`).split("\n").filter(Boolean);
    for (const id of longues) {
      const nom = (ligne.details.sources.find((s) => s.id === id) || {}).nom || id;
      graves.push(`${nom} ne répond plus depuis au moins 24 passages (une journée) : ses nouveaux textes ne sont pas relevés.`);
    }
    console.log(`::notice title=Journal du robot::Passage inscrit : ${ligne.statut}, ${ligne.retenus} textes, ${ligne.details.nouveaux} nouveaux, ${ligne.alertes.length} alerte(s).`);
  } catch (e) {
    console.log(`::warning::Le passage n'a pas pu être inscrit au journal : ${echappe(String(e.stderr || e.message).slice(0, 300))}`);
  }
}

for (const a of ligne.alertes.filter((x) => x.niveau !== "grave")) console.log(`::warning::${echappe(a.quoi)}`);
if (graves.length && QUOTIDIEN) {
  console.log(`::error title=Le robot a besoin qu'on regarde::${echappe(graves.join("\n"))}`);
  process.exit(1);
}
for (const g of graves) console.log(`::warning title=Grave (alerte envoyée au passage du matin)::${echappe(g)}`);
