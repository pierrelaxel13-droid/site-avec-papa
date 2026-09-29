#!/usr/bin/env node
/* ==========================================================================
   Assemble le site publiable dans _site/
   --------------------------------------------------------------------------
   Seuls les fichiers servis aux visiteurs sont copiés : la documentation et
   les skills restent dans le dépôt et ne partent pas en ligne.

   La construction échoue si le référentiel est incohérent. C'est voulu :
   mieux vaut un déploiement refusé qu'un outil qui affiche un plan amputé.

   Usage : node build.mjs
   ========================================================================== */

import { cp, rm, mkdir, readdir, stat, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = dirname(fileURLToPath(import.meta.url));
const SORTIE = resolve(RACINE, "_site");

const A_PUBLIER = ["index.html", "plan-de-veille.html", "assets"];

async function poids(chemin) {
  const s = await stat(chemin);
  if (!s.isDirectory()) return s.size;
  let total = 0;
  for (const e of await readdir(chemin, { withFileTypes: true })) {
    total += await poids(join(chemin, e.name));
  }
  return total;
}

/* Charge le référentiel hors navigateur et vérifie qu'un plan sort bien. */
async function verifieReferentiel() {
  const source = await readFile(join(SORTIE, "assets/referentiel.js"), "utf8");
  globalThis.window = {};
  new Function(source)();
  const R = globalThis.window.REFERENTIEL;

  if (!R) throw new Error("Référentiel introuvable : assets/referentiel.js n'expose rien.");

  const domaines = Object.keys(R.domaines);
  if (domaines.length < 20) {
    throw new Error(`Référentiel appauvri : ${domaines.length} domaines, 20 au minimum.`);
  }
  if (R.metiers.length < 10 || R.questions.length < 6) {
    throw new Error(`Référentiel incomplet : ${R.metiers.length} métiers, ${R.questions.length} questions.`);
  }

  // Toute référence à un domaine doit exister, sinon un plan perd des lignes
  // en silence.
  const cites = [
    ...R.socle,
    ...R.metiers.flatMap((m) => m.domaines),
    ...R.questions.flatMap((q) => q.domaines)
  ];
  const cassees = [...new Set(cites.filter((id) => !R.domaines[id]))];
  if (cassees.length) {
    throw new Error(`Domaines cités mais absents : ${cassees.join(", ")}.`);
  }

  // Chaque domaine doit porter une fréquence connue, sinon il n'est affiché
  // dans aucun groupe du plan.
  const inconnues = domaines.filter((id) => !R.frequences.some((f) => f.id === R.domaines[id].frequence));
  if (inconnues.length) {
    throw new Error(`Fréquences invalides : ${inconnues.join(", ")}.`);
  }

  // Un domaine que ni le socle, ni un métier, ni une question n'amène est
  // invisible pour toujours : c'est du travail perdu, pas une erreur fatale.
  const orphelins = domaines.filter((id) => !cites.includes(id));
  if (orphelins.length) {
    console.warn(`  Avertissement — domaines inatteignables : ${orphelins.join(", ")}`);
  }

  const essai = R.plan("btp", ["salaries", "public"]);
  if (essai.nombre < 5) {
    throw new Error("Le calcul du plan ne produit presque rien : vérifier plan().");
  }

  return { domaines: domaines.length, metiers: R.metiers.length, questions: R.questions.length };
}

async function main() {
  await rm(SORTIE, { recursive: true, force: true });
  await mkdir(SORTIE, { recursive: true });

  let total = 0;
  for (const nom of A_PUBLIER) {
    const src = resolve(RACINE, nom);
    if (!existsSync(src)) {
      console.error(`Manquant : ${nom}`);
      process.exit(1);
    }
    await cp(src, join(SORTIE, nom), { recursive: true });
    const p = await poids(src);
    total += p;
    console.log(`  ${nom.padEnd(22)} ${(p / 1024).toFixed(1)} Ko`);
  }

  const r = await verifieReferentiel();

  console.log(`\n_site/ prêt — ${(total / 1024).toFixed(1)} Ko, ` +
    `${r.domaines} domaines, ${r.metiers} métiers, ${r.questions} questions.`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
