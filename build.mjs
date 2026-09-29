// Assemble le site en un seul fichier autonome : index.html.
//   node build.mjs           # écrit index.html
//   node build.mjs --site    # écrit aussi _site/index.html (publication)
// Sources : src/index.template.html, src/styles.css, src/referentiel.js, src/js/*.js
// Le fichier produit est commité tel quel : il s'ouvre par double-clic et se publie sans étape de construction.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const racine = dirname(fileURLToPath(import.meta.url));
const lire = (p) => readFileSync(join(racine, p), "utf8");

const modeles = lire("src/index.template.html");
const styles = lire("src/styles.css");
const referentiel = lire("src/referentiel.js");
const app = ["core", "radar", "views", "actions"].map((n) => lire(`src/js/${n}.js`)).join("\n");

// Une erreur de syntaxe dans le JavaScript inséré casserait toute la page : on la voit ici.
new vm.Script(referentiel, { filename: "src/referentiel.js" });
new vm.Script(`(function(){"use strict";\n${app}\n})();`, { filename: "src/js/*.js" });

for (const [nom, contenu] of [["styles", styles], ["referentiel", referentiel], ["app", app]]) {
  if (/<\/(script|style)/i.test(contenu)) throw new Error(`${nom} contient une balise de fermeture qui casserait la page.`);
}

const html = modeles
  .replace("/*@STYLES@*/", () => styles)
  .replace("/*@REFERENTIEL@*/", () => referentiel)
  .replace("/*@APP@*/", () => app);

writeFileSync(join(racine, "index.html"), html);

// --site : dépose aussi le fichier dans _site/, le seul dossier que l'hébergeur publie.
if (process.argv.includes("--site")) {
  mkdirSync(join(racine, "_site"), { recursive: true });
  writeFileSync(join(racine, "_site", "index.html"), html);
}

const domaines = (referentiel.match(/^    [a-z_]+: \{\n      nom:/gm) || []).length;
console.log(`index.html écrit : ${(html.length / 1024).toFixed(0)} Ko, ${domaines} domaines de veille.`);
