#!/usr/bin/env node
/* ==========================================================================
   Assemble le site publiable dans _site/
   --------------------------------------------------------------------------
   Seuls les fichiers servis aux visiteurs sont copiés : le collecteur, les
   workflows, la documentation et le jeu d'essai restent dans le dépôt et ne
   partent pas en ligne.

   Usage : node build.mjs
   ========================================================================== */

import { cp, rm, mkdir, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = dirname(fileURLToPath(import.meta.url));
const SORTIE = resolve(RACINE, "_site");

// Ce qui est servi aux visiteurs, et rien d'autre.
const A_PUBLIER = [
  "index.html",
  "veille-reglementaire.html",
  "outil-veille.html",
  "assets",
  "data"
];

async function poids(chemin) {
  const s = await stat(chemin);
  if (!s.isDirectory()) return s.size;
  let total = 0;
  for (const e of await readdir(chemin, { withFileTypes: true })) {
    total += await poids(join(chemin, e.name));
  }
  return total;
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
    console.log(`  ${nom.padEnd(26)} ${(p / 1024).toFixed(1)} Ko`);
  }

  // Garde-fou : le référentiel doit se charger, sinon l'outil est vide en ligne.
  const { readFileSync } = await import("node:fs");
  globalThis.window = {};
  new Function(readFileSync(join(SORTIE, "assets/veille-data.js"), "utf8"))();
  const V = globalThis.window.VEILLE;
  if (!V || Object.keys(V.domaines).length < 40 || V.divisions.length !== 88) {
    throw new Error("Référentiel incomplet : la construction est interrompue.");
  }

  console.log(`\n_site/ prêt — ${(total / 1024).toFixed(1)} Ko, ` +
    `${Object.keys(V.domaines).length} domaines, ${V.divisions.length} divisions NAF.`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
