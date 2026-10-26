/* ==========================================================================
   Pierrel & Co — captures de l'application
   --------------------------------------------------------------------------
   Les écrans montrés sur la page d'accueil sont de vraies captures de
   l'application, pas des maquettes : elles ne peuvent donc pas mentir sur ce
   que contient le produit, et elles se périment avec lui.

   À relancer après toute modification visible de l'application.

     node build.mjs
     python3 -m http.server 8080 -d _site
     node outils/captures.mjs
     node build.mjs        # l'accueil reprend les nouvelles captures

   Playwright n'est pas une dépendance du site : il est installé à part, et le
   chemin de Chromium est passé par la variable CHROMIUM si besoin.
   ========================================================================== */

import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

/* Playwright n'est pas une dépendance du site. On le prend là où il est : à
   côté du projet s'il y a été installé, sinon dans l'installation globale de
   npm, ou au chemin donné par la variable PLAYWRIGHT. Un « import » nu ne va
   pas chercher les paquets globaux — d'où ce détour. Ce fichier portait
   auparavant le chemin d'un dossier temporaire de session, écrit en dur : il
   ne marchait que là. */
async function chargePlaywright() {
  try { return await import("playwright"); } catch { /* on cherche ailleurs */ }
  const chemin = process.env.PLAYWRIGHT ||
    join(execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim(), "playwright");
  return createRequire(import.meta.url)(chemin);
}
const { chromium } = await chargePlaywright();

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.BASE || "http://127.0.0.1:8080";
const CHROME = process.env.CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const ECRANS = [
  { nom: "bord.png", url: "/app/index.html" },
  { nom: "plan.png", url: "/app/plan.html" },
  { nom: "releve.png", url: "/app/releve.html" },
  { nom: "registre.png", url: "/app/registre.html" },
  { nom: "secteurs.png", url: "/app/secteurs.html" },
  { nom: "reglages.png", url: "/app/reglages.html" }
];

// Le héros montre un téléphone à côté de l'ordinateur : il lui faut une vraie
// capture au format d'un téléphone, pas un recadrage de l'écran large.
const TELEPHONES = [
  { nom: "bord-tel.png", url: "/app/index.html" },
  { nom: "releve-tel.png", url: "/app/releve.html" }
];
const FORMAT_TEL = { width: 390, height: 844 };

const navigateur = await chromium.launch({ executablePath: CHROME });
const contexte = await navigateur.newContext({
  viewport: { width: 1280, height: 860 }, locale: "fr-FR", deviceScaleFactor: 1
});
const p = await contexte.newPage();

// On ouvre la session de démonstration avant toute capture, sinon chaque page
// n'affiche que le voile d'accès.
await p.goto(BASE + "/connexion.html", { waitUntil: "domcontentloaded" });
// La formule la plus large : les captures doivent montrer tous les écrans.
await p.evaluate(() => { localStorage.setItem("pco-session", JSON.stringify({ formule: "preuves" })); });

// Deux jeux : l'accueil montre le jeu qui correspond au thème du visiteur.
// Sans cela, un grand rectangle blanc trône au milieu de la page sombre.
for (const theme of ["light", "dark"]) {
  await p.evaluate((t) => { localStorage.setItem("pco-theme", t); }, theme);

  for (const e of ECRANS) {
    const nom = theme === "dark" ? e.nom.replace(".png", "-sombre.png") : e.nom;
    await p.setViewportSize({ width: 1280, height: 860 });
    await p.goto(BASE + e.url, { waitUntil: "networkidle" });
    await p.waitForTimeout(700);
    if (await p.locator("#verrou").count()) {
      throw new Error(`${e.url} : le voile d'accès est encore là, la session n'a pas pris.`);
    }
    await p.screenshot({ path: resolve(RACINE, "assets/ecrans", nom) });
    console.log("  " + nom.padEnd(22) + e.url);
  }

  for (const e of TELEPHONES) {
    const nom = theme === "dark" ? e.nom.replace(".png", "-sombre.png") : e.nom;
    await p.setViewportSize(FORMAT_TEL);
    await p.goto(BASE + e.url, { waitUntil: "networkidle" });
    await p.waitForTimeout(700);
    if (await p.locator("#verrou").count()) {
      throw new Error(`${e.url} : le voile d'accès est encore là, la session n'a pas pris.`);
    }
    await p.screenshot({ path: resolve(RACINE, "assets/ecrans", nom) });
    console.log("  " + nom.padEnd(22) + e.url + "  (téléphone)");
  }
}

await navigateur.close();
console.log("\nCaptures à jour. Relancer node build.mjs pour que l'accueil les reprenne.");
