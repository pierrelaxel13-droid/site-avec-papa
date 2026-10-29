/* ==========================================================================
   Le plan ne montre que ce qui concerne l'entreprise — lu comme un outil
   --------------------------------------------------------------------------
   « Ce qui vous concerne, et rien d'autre » : c'est la promesse. Ce test lit
   les pages de la démonstration (Maçonnerie Vidal) COMME LES LIT UN OUTIL —
   une IA, un mode lecture, la source de la page —, c'est-à-dire sans tenir
   compte de l'attribut « hidden ». Hors du <template> et des volets repliés
   « ne vous concernent pas », aucun sujet ni aucun texte hors du plan.

   Lancé après la construction : node outils/perimetre.test.mjs
   (dans l'action « Publier le site », avant la mise en ligne).
   ========================================================================== */
import { readFileSync } from "node:fs";
import vm from "node:vm";

const SITE = process.env.SITE_DIR || "_site";
const charge = (f, nom) => { const c = { window: {} }; vm.runInNewContext(readFileSync(f, "utf8"), c); return c.window[nom]; };
const V = charge("assets/referentiel.js", "VEILLE");
const D = charge("contenu/demo.js", "DEMO");
const PLAN = charge(`${SITE}/assets/plan-data.js`, "PLAN");

let n = 0, echecs = 0;
const ok = (c, quoi) => { n++; if (c) console.log("ok :", quoi); else { echecs++; console.log("ÉCHEC :", quoi); } };

// Le plan de Vidal, calculé comme le fait le navigateur (assets/entreprise.js).
const div = PLAN.div[String(D.entreprise.naf).slice(0, 2)];
const liste = [...div.b];
D.entreprise.contexte.forEach((qid) => {
  const q = PLAN.q.find((x) => x.id === qid);
  if (q) q.dom.forEach((id) => { if (PLAN.d[id] && !liste.includes(id)) liste.push(id); });
});
const hors = Object.keys(PLAN.d).filter((id) => !liste.includes(id));

// Ce qu'un outil lit : la page, moins le <template> et les volets « écartés »
// (qui contiennent eux-mêmes des <details> : on compte les niveaux).
function sansVolets(html) {
  const ouvre = /<details class="a-savoir (?:plan|releve)-ecartes"/g;
  let m;
  while ((m = ouvre.exec(html))) {
    let i = m.index + 1, niveau = 1;
    const balise = /<(\/?)details\b/g;
    balise.lastIndex = i;
    let b;
    while (niveau && (b = balise.exec(html))) niveau += b[1] ? -1 : 1;
    const fin = html.indexOf(">", b.index) + 1;
    html = html.slice(0, m.index) + html.slice(fin);
    ouvre.lastIndex = m.index;
  }
  return html;
}
const lu = (html) => sansVolets(html.replace(/<template[\s\S]*?<\/template>/g, ""));

/* --- Mon plan --- */
const plan = readFileSync(`${SITE}/demo/plan.html`, "utf8");
const visiblePlan = lu(plan);
const blocs = [...visiblePlan.matchAll(/<article class="bloc-domaine"[^>]*data-domaine="([^"]+)"/g)].map((m) => m[1]);
ok(blocs.length === liste.length, `plan : ${blocs.length} sujets dans la page, ${liste.length} dans le plan de Vidal`);
ok(blocs.every((id) => liste.includes(id)), "plan : aucun sujet hors du plan dans les rubriques");
const nomsHors = hors.map((id) => PLAN.d[id].n).filter((nom) => visiblePlan.includes(nom));
ok(!nomsHors.length, "plan : aucun nom de sujet écarté hors du volet" + (nomsHors.length ? ` (${nomsHors.join(", ")})` : ""));
ok((plan.match(/data-ecartes-total>(\d+)</) || [])[1] === String(hors.length), `plan : le volet annonce ${hors.length} sujets écartés`);
ok(new RegExp(`data-plan-total>${liste.length}<`).test(plan), `plan : l'en-tête annonce ${liste.length}`);
ok(new RegExp(`${div.b.length} par son code APE`).test(plan), `plan : l'en-tête dit ${div.b.length} par le code APE`);
ok(!/vous ne verrez que ses sujets/.test(plan), "plan : l'ancienne phrase ambiguë a disparu");
ok(new RegExp(`id="plan-total">${liste.length}<`).test(plan), "plan : « Domaines suivis » dit le même chiffre");

/* --- Relevé --- */
const releve = readFileSync(`${SITE}/demo/releve.html`, "utf8");
const visibleReleve = lu(releve);
const lignes = [...visibleReleve.matchAll(/<li class="ligne-releve[^"]*" data-domaines="([^"]*)"/g)].map((m) => m[1].split(" "));
const toutes = [...releve.matchAll(/<li class="ligne-releve[^"]*" data-domaines="([^"]*)"/g)].length;
ok(lignes.length > 0, `relevé : ${lignes.length} textes rangés, sur ${toutes} relevés`);
ok(lignes.every((d) => d.some((id) => liste.includes(id))), "relevé : chaque texte rangé touche un sujet du plan");
const sujets = [...visibleReleve.matchAll(/data-sujet-releve="([^"]+)"/g)].map((m) => m[1]).filter((id) => PLAN.d[id]);
ok(sujets.every((id) => liste.includes(id)), "relevé : aucun sous-titre de sujet hors du plan");
const ecartes = Number((releve.match(/data-ecartes-total>(\d+)</) || [])[1] || 0);
ok(ecartes === toutes - lignes.length, `relevé : le volet annonce les ${ecartes} autres`);

/* --- Les autres pages : le filtre n'est pas débranché ailleurs --- */
const secteur = readFileSync(`${SITE}/demo/secteur/43-travaux-de-construction-specialises.html`, "utf8");
ok(![...secteur.matchAll(/data-origine="hors"/g)].length, "fiche secteur : aucun sujet hors périmètre");
ok(/par le code APE seul/.test(secteur), "fiche secteur : le chiffre dit qu'il vient du code APE seul");

console.log(`\n${n - echecs}/${n} vérifications passées`);
process.exit(echecs ? 1 : 0);
