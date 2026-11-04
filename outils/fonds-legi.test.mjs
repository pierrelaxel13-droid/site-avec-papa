/* Le robot du fonds LEGI sur une petite archive au format officiel :
   garde un décret en vigueur sur un de nos sujets et ses seuls articles en
   vigueur ; écarte un texte abrogé, un texte de plus de 50 ans, un texte hors
   sujets et une circulaire. */
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fonds } from "./fonds-legi.mjs";

const src = await readFile(new URL("../assets/referentiel.js", import.meta.url), "utf8");
const w = {}; new Function("window", src)(w); const V = w.VEILLE;
const mot = Object.values(V.domaines).flatMap((d) => d.motsCles || []).find((m) => m.length > 8 && /^[a-zà-ÿ ]+$/i.test(m));

const racine = await mkdtemp(join(tmpdir(), "legi-"));
const base = "legi/global/code_et_TNC_en_vigueur/TNC_en_vigueur/JORF/TEXT/00/00/00/00/00";
const version = (id, nature, date, titre, etat = "VIGUEUR", fin = "2999-01-01") => `<?xml version="1.0" encoding="UTF-8"?>
<TEXTE_VERSION><META><META_COMMUN><ID>${id}</ID><NATURE>${nature}</NATURE></META_COMMUN><META_SPEC><META_TEXTE_CHRONICLE><CID>JORF${id}</CID><DATE_PUBLI>${date}</DATE_PUBLI><DATE_TEXTE>${date}</DATE_TEXTE></META_TEXTE_CHRONICLE>
<META_TEXTE_VERSION><TITRE>${titre}</TITRE><TITREFULL>${titre}</TITREFULL><ETAT>${etat}</ETAT><DATE_DEBUT>${date}</DATE_DEBUT><DATE_FIN>${fin}</DATE_FIN></META_TEXTE_VERSION></META_SPEC></META></TEXTE_VERSION>`;
const article = (id, txt, num, etat, corps) => `<?xml version="1.0" encoding="UTF-8"?>
<ARTICLE><META><META_COMMUN><ID>${id}</ID></META_COMMUN><META_SPEC><META_ARTICLE><NUM>${num}</NUM><ETAT>${etat}</ETAT><DATE_DEBUT>2001-01-01</DATE_DEBUT><DATE_FIN>2999-01-01</DATE_FIN></META_ARTICLE></META_SPEC></META>
<CONTEXTE><TEXTE cid="JORF${txt}"><TITRE_TXT id_txt="${txt}">x</TITRE_TXT></TEXTE></CONTEXTE><BLOC_TEXTUEL><CONTENU><p>${corps}</p></CONTENU></BLOC_TEXTUEL></ARTICLE>`;
const ecrire = async (chemin, x) => { await mkdir(join(racine, chemin, ".."), { recursive: true }); await writeFile(join(racine, chemin), x); };
const T = (id) => `${base}/JORF${id}/texte/version/${id}.xml`;
await ecrire(T("LEGITEXT1"), version("LEGITEXT1", "DECRET", "2001-05-10", `Décret n° 2001-1 du 10 mai 2001 relatif à la ${mot}`));
await ecrire(T("LEGITEXT2"), version("LEGITEXT2", "ARRETE", "2005-01-01", `Arrêté du 1er janvier 2005 relatif à la ${mot}`, "ABROGE", "2010-01-01"));
await ecrire(T("LEGITEXT3"), version("LEGITEXT3", "DECRET", "1960-01-01", `Décret du 1er janvier 1960 relatif à la ${mot}`));
await ecrire(T("LEGITEXT4"), version("LEGITEXT4", "DECRET", "2010-01-01", "Décret du 1er janvier 2010 portant création d'un musée"));
await ecrire(T("LEGITEXT5"), version("LEGITEXT5", "CIRCULAIRE", "2010-01-01", `Circulaire du 1er janvier 2010 relative à la ${mot}`));
// Un nom de plus de 100 caractères : passe par l'entrée « nom long » du format tar.
const long = `${base}/JORFLEGITEXT1/article/LEGI/ARTI/00/00/00/00/00/${"x".repeat(60)}/LEGIARTI`;
await ecrire(`${long}2.xml`, article("LEGIARTI2", "LEGITEXT1", "2", "VIGUEUR", "Deuxième article."));
await ecrire(`${long}1.xml`, article("LEGIARTI1", "LEGITEXT1", "1", "VIGUEUR", "Premier article."));
await ecrire(`${long}3.xml`, article("LEGIARTI3", "LEGITEXT1", "3", "ABROGE", "Article abrogé."));
// Le même texte hors du dossier « en vigueur » : ignoré.
await ecrire(`legi/global/code_et_TNC_non_vigueur/TNC_non_vigueur/JORF/TEXT/x/texte/version/LEGITEXT9.xml`, version("LEGITEXT9", "DECRET", "2001-01-01", `Décret relatif à la ${mot}`));
const archive = join(racine, "legi.tar.gz");
execFileSync("tar", ["-czf", archive, "--format=gnu", "-C", racine, "legi"]);

const r = await fonds(archive, V, { auj: "2026-11-04" });
assert.equal(r.limite, "1976-11-04");
assert.deepEqual(r.textes.map((t) => t.id), ["LEGITEXT1"]);
const t = r.textes[0];
assert.equal(t.nature, "Décret"); assert.equal(t.articlesEnVigueur, 2); assert.equal(t.fonds, true);
assert.equal(t.corps, "Article 1 : Premier article.\n\nArticle 2 : Deuxième article.");
assert.equal(t.lien, "https://www.legifrance.gouv.fr/loda/id/LEGITEXT1");
console.log(`fonds-legi : ok (mot-clé d'essai « ${mot} »)`);
