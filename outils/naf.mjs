#!/usr/bin/env node
/* ==========================================================================
   Vigie — la nomenclature NAF entière
   --------------------------------------------------------------------------
   Le référentiel de veille raisonne par division : 88 périmètres, un par
   grand secteur. Mais une entreprise ne porte pas une division, elle porte un
   code APE à cinq caractères — 4322B, 5610A, 8690F. Il y en a 732. Ce robot
   va les chercher et écrit contenu/naf.js, pour que le client reconnaisse son
   code exact et retombe sur le bon périmètre.

   LA SOURCE
   La NAF rév. 2, nomenclature officielle de l'INSEE, dans le paquet
   @socialgouv/codes-naf du registre npm. 1 707 entrées : 88 divisions,
   272 groupes, 615 classes, 732 sous-classes. Le registre npm répond partout,
   y compris depuis un environnement fermé — insee.fr, non.

   CE QU'IL NE TOUCHE PAS
   Les 88 divisions du référentiel. Leurs intitulés font les adresses des
   fiches de secteur : les changer casserait toutes les pages déjà publiées.
   Le robot vérifie seulement qu'aucune division n'a disparu de la
   nomenclature, et le dit si c'est le cas.

   USAGE
     node outils/naf.mjs
     node outils/naf.mjs --version 1.1.1
   ========================================================================== */

import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TRAVAIL = join(RACINE, ".naf");
const SORTIE = join(RACINE, "contenu", "naf.js");
const PAQUET = "@socialgouv/codes-naf";

const args = process.argv.slice(2);
const i = args.indexOf("--version");
const VERSION = i !== -1 && args[i + 1] ? args[i + 1] : null;

/* --- L'empreinte de l'archive --------------------------------------------
   Le registre npm publie, à côté de l'adresse de chaque archive, l'empreinte
   de son contenu. Télécharger sans la vérifier, c'est faire confiance au
   transport ; la vérifier, c'est faire confiance à ce que l'éditeur a publié.
   Ce n'est pas théorique pour ce site : le texte de loi que nous republions
   sort de cette archive. Une archive trafiquée ne pourrait pas exécuter de
   code — rien de ce qu'elle contient n'est exécuté, seulement lu comme du
   JSON — mais elle pourrait mettre du faux droit dans les pages, ce qui est
   exactement ce qu'un service de veille ne doit jamais faire.

   Sans empreinte publiée, on s'arrête : mieux vaut pas de relève qu'une
   relève dont on ne peut rien dire. */
function verifieEmpreinte(octets, dist) {
  const integrite = dist && dist.integrity;
  if (integrite) {
    /* « sha512-<base64> ». Le registre peut en donner plusieurs, séparées par
       une espace ; il suffit qu'une corresponde. */
    const formes = String(integrite).trim().split(/\s+/);
    for (const f of formes) {
      const sep = f.indexOf("-");
      const algo = f.slice(0, sep), attendu = f.slice(sep + 1);
      if (!/^sha(256|384|512)$/.test(algo)) continue;
      if (createHash(algo).update(octets).digest("base64") === attendu) return `${algo} vérifié`;
    }
    throw new Error(`empreinte refusée : l'archive ne correspond pas à « ${integrite} »`);
  }
  if (dist && dist.shasum) {
    const obtenu = createHash("sha1").update(octets).digest("hex");
    if (obtenu !== dist.shasum) {
      throw new Error(`empreinte refusée : sha1 ${obtenu} au lieu de ${dist.shasum}`);
    }
    return "sha1 vérifié";
  }
  throw new Error("le registre ne publie aucune empreinte pour cette archive : on n'ouvre pas");
}

async function main() {
  const meta = await (await fetch(`https://registry.npmjs.org/${PAQUET}`,
    { signal: AbortSignal.timeout(60000) })).json();
  const v = VERSION || meta["dist-tags"].latest;
  const infos = meta.versions[v];
  if (!infos) throw new Error(`version ${v} inconnue sur le registre`);
  console.log(`  paquet ${PAQUET} ${v}, publié le ${(meta.time[v] || "").slice(0, 10)}`);

  await mkdir(TRAVAIL, { recursive: true });
  const archive = join(TRAVAIL, "paquet.tgz");
  const r = await fetch(infos.dist.tarball, { signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw new Error(`téléchargement : HTTP ${r.status}`);
  const octets = Buffer.from(await r.arrayBuffer());
  console.log(`  empreinte : ${verifieEmpreinte(octets, infos.dist)}`);
  await writeFile(archive, octets);
  await execFileP("tar", ["-xzf", archive, "-C", TRAVAIL, "--no-same-owner"]);

  const brut = JSON.parse(await readFile(join(TRAVAIL, "package", "index.json"), "utf8"));
  const par = (n) => brut.filter((x) => x.id.length === n);
  const divisions = par(2), groupes = par(4), classes = par(5), sousClasses = par(6);

  if (sousClasses.length < 700)
    throw new Error(`${sousClasses.length} sous-classes seulement : la nomenclature est incomplète.`);

  /* Le référentiel reste la référence pour les 88 divisions. On vérifie
     seulement qu'elles existent toutes dans la nomenclature. */
  const faux = {};
  new Function("window", await readFile(join(RACINE, "assets/referentiel.js"), "utf8"))(faux);
  const connues = new Set(divisions.map((x) => x.id));
  const perdues = faux.VEILLE.divisions.filter((d) => !connues.has(d.c)).map((d) => d.c);
  if (perdues.length)
    throw new Error(`divisions du référentiel absentes de la nomenclature : ${perdues.join(", ")}`);

  const intitules = Object.fromEntries(brut.map((x) => [x.id, x.label]));
  const codes = sousClasses.map((x) => ({
    c: x.id,                    // 01.11Z — le code APE, tel qu'il est écrit
    l: x.label,
    d: x.id.slice(0, 2),        // la division, qui porte le périmètre de veille
    g: x.id.slice(0, 4),
    k: x.id.slice(0, 5)
  }));

  /* Les intitulés de classe et de groupe ne sont gardés que s'ils apportent
     quelque chose : une classe qui répète mot pour mot sa sous-classe n'aide
     personne à se reconnaître. */
  const classesUtiles = {};
  for (const k of classes) {
    const filles = codes.filter((c) => c.k === k.id);
    if (filles.length > 1 || filles[0]?.l !== k.label) classesUtiles[k.id] = k.label;
  }
  const groupesUtiles = Object.fromEntries(groupes.map((g) => [g.id, g.label]));

  const sortie = `/* ==========================================================================
   Vigie — la nomenclature NAF entière
   --------------------------------------------------------------------------
   ENGENDRÉ PAR outils/naf.mjs — NE PAS MODIFIER À LA MAIN.

   ${codes.length} codes APE (sous-classes), ${Object.keys(classesUtiles).length} classes,
   ${Object.keys(groupesUtiles).length} groupes, ${divisions.length} divisions.
   NAF rév. 2 de l'INSEE, relevée le ${new Date().toISOString().slice(0, 10)}
   dans ${PAQUET} ${v}.

   Une entreprise porte un code APE à cinq caractères (4322B). Le périmètre de
   veille, lui, se calcule par division (43) : c'est le niveau où les
   obligations se ressemblent. « d » fait le pont entre les deux.
   ========================================================================== */

window.NAF = {
  version: "NAF rév. 2",
  paquet: ${JSON.stringify(`${PAQUET} ${v}`)},
  releve: ${JSON.stringify(new Date().toISOString().slice(0, 10))},
  source: {
    nom: "Nomenclature d'activités française (NAF rév. 2), INSEE",
    url: "https://www.insee.fr/fr/information/2120875"
  },
  groupes: ${JSON.stringify(groupesUtiles, null, 0)},
  classes: ${JSON.stringify(classesUtiles, null, 0)},
  codes: [
${codes.map((c) => `    ${JSON.stringify(c)}`).join(",\n")}
  ]
};
`;
  await writeFile(SORTIE, sortie, "utf8");
  await rm(TRAVAIL, { recursive: true, force: true });

  console.log(`  ${codes.length} codes APE, ${classes.length} classes, ${groupes.length} groupes, ${divisions.length} divisions`);
  console.log(`  les ${faux.VEILLE.divisions.length} divisions du référentiel existent toutes dans la nomenclature`);
  console.log(`  écrit : ${SORTIE.replace(`${RACINE}/`, "")} (${Math.round(sortie.length / 1024)} Ko)`);
}

main().catch((e) => {
  console.error(`\nLa relève de la nomenclature s'arrête : ${e.message}`);
  process.exit(1);
});
