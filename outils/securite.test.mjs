/* ==========================================================================
   Les tests de la revue de sécurité du 31 octobre 2026 (côté site)
   --------------------------------------------------------------------------
   Côté base, les tests sont dans supabase/tests/isolation.sql (section 14).
   Lancer après la construction : node outils/securite.test.mjs
   ========================================================================== */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SITE = process.env.SITE_DIR || "_site";
let n = 0, echecs = 0;
const ok = (c, quoi) => { n++; if (c) console.log("ok :", quoi); else { echecs++; console.log("ÉCHEC :", quoi); } };

/* 1. L'export CSV du registre neutralise les formules. La fonction est prise
   telle quelle dans assets/espace.js. */
const espace = readFileSync("assets/espace.js", "utf8");
const m = espace.match(/var champ = (function \(v\) \{[\s\S]*?\n    \});/);
ok(!!m, "la fonction des cellules du CSV est trouvée");
const champ = m ? new Function("return " + m[1])() : () => "";
ok(champ("=LIEN_HYPERTEXTE(\"http://x\";\"clic\")").startsWith("\"'="), "« =LIEN_HYPERTEXTE(…) » devient du texte, pas une formule");
ok(champ("+33 6 00") === "'+33 6 00" && champ("@SOMME(A1)") === "'@SOMME(A1)" && champ("-2+3") === "'-2+3", "+, @ et - en tête sont neutralisés aussi");
ok(champ("Revue sécurité") === "Revue sécurité" && champ(42) === "42" && champ(-3) === "-3", "le texte ordinaire et les nombres ne changent pas");

/* 2. Les liens « Voir chez la source » : http(s) seulement. */
const pages = ["app/releve.html", "demo/releve.html"].map((f) => readFileSync(join(SITE, f), "utf8"));
const liens = pages.flatMap((h) => [...h.matchAll(/<a href="([^"]*)"[^>]*>Voir chez la source/g)].map((x) => x[1]));
ok(liens.length > 0 && liens.every((u) => /^https?:\/\//.test(u)), `les ${liens.length} liens vers les sources sont en http(s)`);
const toutes = readdirSync(SITE, { recursive: true }).filter((f) => f.endsWith(".html"));
const javascript = toutes.filter((f) => /href="\s*javascript:/i.test(readFileSync(join(SITE, f), "utf8")));
ok(!javascript.length, `aucun lien « javascript: » dans les ${toutes.length} pages` + (javascript.length ? ` (${javascript.slice(0, 3)})` : ""));

/* 3. Une page encadrée par un autre site reste invisible. */
const theme = readFileSync(join(SITE, "assets/theme.js"), "utf8");
ok(/window\.top !== window\.self[\s\S]{0,120}visibility = "hidden"/.test(theme), "theme.js cache la page si elle est dans un cadre");
const index = readFileSync(join(SITE, "index.html"), "utf8");
ok(index.indexOf("assets/theme.js") > -1 && index.indexOf("assets/theme.js") < index.indexOf("<body"), "theme.js est chargé dans l'en-tête de chaque page");

console.log(`\n${n - echecs}/${n} vérifications passées`);
process.exit(echecs ? 1 : 0);
