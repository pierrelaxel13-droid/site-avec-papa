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

import { chromium } from "/tmp/claude-0/-home-user-site-avec-papa/029eaf86-024b-5d15-a09c-b072079f1bba/scratchpad/node_modules/playwright/index.mjs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.BASE || "http://127.0.0.1:8080";
const CHROME = process.env.CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const ECRANS = [
  { nom: "bord.png", url: "/app/index.html" },
  { nom: "plan.png", url: "/app/plan.html" },
  { nom: "releve.png", url: "/app/releve.html" },
  { nom: "registre.png", url: "/app/registre.html" },
  { nom: "secteurs.png", url: "/app/secteurs.html" }
];

const navigateur = await chromium.launch({ executablePath: CHROME });
const contexte = await navigateur.newContext({
  viewport: { width: 1280, height: 860 }, locale: "fr-FR", deviceScaleFactor: 1
});
const p = await contexte.newPage();

// On ouvre la session de démonstration avant toute capture, sinon chaque page
// n'affiche que le voile d'accès.
await p.goto(BASE + "/connexion.html", { waitUntil: "domcontentloaded" });
await p.evaluate(() => {
  localStorage.setItem("pco-session", "demo");
  localStorage.setItem("pco-theme", "light");
});

for (const e of ECRANS) {
  await p.goto(BASE + e.url, { waitUntil: "networkidle" });
  await p.waitForTimeout(700);
  const verrou = await p.locator("#verrou").count();
  if (verrou) throw new Error(`${e.url} : le voile d'accès est encore là, la session n'a pas pris.`);
  await p.screenshot({ path: resolve(RACINE, "assets/ecrans", e.nom) });
  console.log("  " + e.nom.padEnd(16) + e.url);
}

await navigateur.close();
console.log("\nCaptures à jour. Relancer node build.mjs pour que l'accueil les reprenne.");
